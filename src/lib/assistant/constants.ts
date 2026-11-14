/* Endpoints oficiales permitidos para adaptadores Chat Completions. */
export const GEMINI_COMPLETIONS_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

export const COMPATIBLE_ENDPOINTS = [
  { label: "Google Gemini", url: GEMINI_COMPLETIONS_URL },
  { label: "OpenRouter", url: "https://openrouter.ai/api/v1/chat/completions" },
  { label: "Groq", url: "https://api.groq.com/openai/v1/chat/completions" },
  { label: "Together AI", url: "https://api.together.xyz/v1/chat/completions" },
  { label: "DeepSeek", url: "https://api.deepseek.com/chat/completions" },
  { label: "Mistral", url: "https://api.mistral.ai/v1/chat/completions" },
  { label: "Fireworks", url: "https://api.fireworks.ai/inference/v1/chat/completions" },
  { label: "Cerebras", url: "https://api.cerebras.ai/v1/chat/completions" },
  { label: "xAI", url: "https://api.x.ai/v1/chat/completions" },
];

/** Se permiten SOLO URLs exactas y HTTPS para no exponer redes internas. */
export function resolveCompatibleEndpoint(endpoint: string | undefined): string | null {
  if (!endpoint) return null;
  const extras = (process.env.SICES_AI_APPROVED_ENDPOINTS ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  const exact = [...COMPATIBLE_ENDPOINTS.map((e) => e.url), ...extras];
  if (!exact.includes(endpoint)) return null;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.port) return null;
    return url.href;
  } catch { return null; }
}
