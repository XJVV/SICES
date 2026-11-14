/** Adaptadores sin SDK ni persistencia de credenciales. Solo ejecutan herramientas locales de lectura. */
import { TOOL_DEFINITIONS, executeReadOnlyTool } from "@/lib/assistant/tools";
import { GEMINI_COMPLETIONS_URL, resolveCompatibleEndpoint } from "@/lib/assistant/constants";

export type Provider = "openai" | "anthropic" | "compatible" | "gemini";
export type ChatTurn = { role: "user" | "assistant"; content: string };

// URL compatible estrictamente validada en constants.ts contra SSRF.

export class ProviderError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

type GenericRecord = Record<string, unknown>;
const isRecord = (v: unknown): v is GenericRecord => !!v && typeof v === "object" && !Array.isArray(v);

const GEMINI_UNSUPPORTED_SCHEMA_KEYS = new Set([
  "additionalProperties",
  "minimum",
  "maximum",
  "minItems",
  "maxItems",
  "$schema",
  "default",
]);

export function adaptSchemaForGemini(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(adaptSchemaForGemini);
  if (isRecord(schema)) {
    const res: GenericRecord = {};
    for (const [key, value] of Object.entries(schema)) {
      if (GEMINI_UNSUPPORTED_SCHEMA_KEYS.has(key)) continue;
      res[key] = adaptSchemaForGemini(value);
    }
    return res;
  }
  return schema;
}

const toolSchemas = TOOL_DEFINITIONS.map((t) => ({ type: "function" as const, function: { name: t.name, description: t.description, parameters: t.input_schema } }));
const geminiToolSchemas = TOOL_DEFINITIONS.map((t) => ({
  type: "function" as const,
  function: { name: t.name, description: t.description, parameters: adaptSchemaForGemini(t.input_schema) },
}));

async function callApi(url: string, apiKey: string, headers: Record<string, string>, body: unknown, provider?: Provider): Promise<GenericRecord> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST", headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(35000),
    });
  } catch {
    throw new ProviderError(502, "No se pudo conectar con el proveedor de IA o se agotó el tiempo de espera.");
  }
  // Nunca mostramos errores arbitrarios del proveedor: podrían contener secretos reflejados.
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new ProviderError(401, "La API Key no fue aceptada por el proveedor.");
    if (response.status === 402 || response.status === 429) throw new ProviderError(429, "Sin cuota disponible o límite de solicitudes del proveedor alcanzado.");
    if (provider === "gemini") {
      if (response.status === 400) throw new ProviderError(400, "Error 400 en Gemini: Parámetros o esquema de herramientas no compatibles. Comprueba el modelo.");
      if (response.status === 404) throw new ProviderError(404, "Error 404 en Gemini: Modelo no encontrado o endpoint no disponible. Verifica el nombre exacto del modelo.");
      if (response.status === 422) throw new ProviderError(422, "Error 422 en Gemini: Error de validación en la solicitud enviada a Gemini.");
    }
    if (response.status === 400 || response.status === 404 || response.status === 422) throw new ProviderError(400, "Modelo, endpoint o parámetros no compatibles. Comprueba el nombre del modelo y que admita herramientas.");
    throw new ProviderError(502, `El proveedor de IA respondió con un error HTTP ${response.status}.`);
  }
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new ProviderError(502, "El proveedor respondió con un formato no válido."); }
  if (!isRecord(payload)) throw new ProviderError(502, "Respuesta vacía o no válida del proveedor.");
  return payload;
}

function parseToolArgs(raw: unknown): unknown {
  if (typeof raw !== "string" || raw.length > 8000) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

async function runTool(name: string, raw: unknown): Promise<string> {
  const result = await executeReadOnlyTool(name, raw);
  return JSON.stringify(result).slice(0, 17000);
}

function textFromContent(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw.filter((p) => isRecord(p) && p.type === "text" && typeof p.text === "string").map((p) => p.text as string).join("\n");
  return "";
}

async function openAiCompatible({ provider, apiKey, model, endpoint, system, history }: {
  provider: "openai" | "compatible" | "gemini"; apiKey: string; model: string; endpoint?: string; system: string; history: ChatTurn[];
}) {
  let url: string | null = null;
  if (provider === "openai") {
    url = "https://api.openai.com/v1/chat/completions";
  } else if (provider === "gemini") {
    url = GEMINI_COMPLETIONS_URL;
  } else {
    url = resolveCompatibleEndpoint(endpoint);
  }
  if (!url) throw new ProviderError(400, "Endpoint no permitido. Selecciona uno de los proveedores admitidos.");
  const isGemini = provider === "gemini" || url === GEMINI_COMPLETIONS_URL;
  const toolsToSend = isGemini ? geminiToolSchemas : toolSchemas;
  const messages: GenericRecord[] = [{ role: "system", content: system }, ...history];
  let callsCount = 0;
  for (let step = 0; step < 3; step++) {
    const payload = await callApi(url, apiKey, { authorization: `Bearer ${apiKey}` }, {
      model, messages, tools: toolsToSend, tool_choice: step === 2 ? "none" : "auto",
      ...(provider === "openai" ? { max_completion_tokens: 1400 } : { max_tokens: 1400 }),
    }, isGemini ? "gemini" : provider);
    const first = Array.isArray(payload.choices) ? payload.choices[0] : null;
    const reply = isRecord(first) && isRecord(first.message) ? first.message : null;
    if (!reply) throw new ProviderError(502, "El proveedor no devolvió un mensaje.");
    const text = textFromContent(reply.content).trim();
    const tools = Array.isArray(reply.tool_calls)
      ? reply.tool_calls.filter((call) => isRecord(call) && call.type === "function" && isRecord(call.function) && typeof call.id === "string")
      : [];
    if (tools.length > 5) throw new ProviderError(502, "El modelo solicitó demasiadas herramientas a la vez.");
    if (!tools.length) {
      if (!text) throw new ProviderError(502, "El modelo no devolvió texto. Prueba otro modelo.");
      return { answer: text.slice(0, 18000), toolCalls: callsCount };
    }
    if (step === 2) throw new ProviderError(502, "El modelo solicitó demasiadas consultas consecutivas.");
    messages.push({
      role: "assistant",
      content: text || null,
      tool_calls: tools.map((call) => {
        const item: GenericRecord = { id: call.id, type: "function", function: call.function };
        if (call.thought_signature !== undefined) item.thought_signature = call.thought_signature;
        if (call.extra_content !== undefined) item.extra_content = call.extra_content;
        return item;
      }),
    });
    for (const call of tools) {
      const fn = call.function as GenericRecord;
      const output = await runTool(String(fn.name ?? ""), parseToolArgs(fn.arguments));
      messages.push({ role: "tool", tool_call_id: call.id, content: output });
      callsCount++;
    }
  }
  throw new ProviderError(502, "No se pudo completar la conversación.");
}

async function anthropic({ apiKey, model, system, history }: { apiKey: string; model: string; system: string; history: ChatTurn[] }) {
  const messages: GenericRecord[] = history.map((m) => ({ ...m }));
  let callsCount = 0;
  for (let step = 0; step < 3; step++) {
    const payload = await callApi("https://api.anthropic.com/v1/messages", apiKey,
      { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      { model, system, max_tokens: 1400, messages,
        tools: TOOL_DEFINITIONS.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema })),
        tool_choice: { type: step === 2 ? "none" : "auto" },
      });
    const blocks = Array.isArray(payload.content) ? payload.content.filter(isRecord) : [];
    const toolBlocks = blocks.filter((b) => b.type === "tool_use" && typeof b.id === "string" && typeof b.name === "string");
    if (toolBlocks.length > 5) throw new ProviderError(502, "El modelo solicitó demasiadas herramientas a la vez.");
    const answer = blocks.filter((b) => b.type === "text" && typeof b.text === "string").map((b) => b.text as string).join("\n").trim();
    if (!toolBlocks.length) {
      if (!answer) throw new ProviderError(502, "Claude no devolvió texto. Comprueba el modelo.");
      return { answer: answer.slice(0, 18000), toolCalls: callsCount };
    }
    if (step === 2) throw new ProviderError(502, "El modelo solicitó demasiadas consultas consecutivas.");
    messages.push({ role: "assistant", content: blocks });
    const results: { type: "tool_result"; tool_use_id: string; content: string }[] = [];
    for (const tool of toolBlocks) {
      const output = await runTool(tool.name as string, tool.input);
      results.push({ type: "tool_result", tool_use_id: tool.id as string, content: output });
      callsCount++;
    }
    messages.push({ role: "user", content: results });
  }
  throw new ProviderError(502, "No se pudo completar la conversación.");
}

export async function answerWithProvider(args: { provider: Provider; apiKey: string; model: string; endpoint?: string; system: string; history: ChatTurn[] }) {
  if (args.provider === "anthropic") return anthropic(args);
  return openAiCompatible({ ...args, provider: args.provider });
}