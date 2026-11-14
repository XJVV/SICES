"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import { Bot, KeyRound, LoaderCircle, MessageSquare, Send, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/components/system/auth";
import { useLanguage } from "@/lib/i18n";
import { COMPATIBLE_ENDPOINTS } from "@/lib/assistant/constants";

type Provider = "openai" | "anthropic" | "compatible" | "gemini";
type ChatTurn = { role: "user" | "assistant"; content: string; toolCalls?: number };
const CONFIG_STORAGE = "sices-ai-config-v1";
const KEY_STORAGE = "sices-ai-key-v1";
const defaults: Record<Provider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5",
  gemini: "gemini-3.5-flash-lite",
  compatible: "openai/gpt-4o-mini",
};

export function AiAssistantPanel({ investigationId, metric, seriesIds, psiCode }: {
  investigationId: number | null; metric: string | null; seriesIds: number[]; psiCode?: string;
}) {
  const { t } = useLanguage();
  const T = t.assistant;
  const { user, openLogin } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(true);
  const [provider, setProvider] = React.useState<Provider>("openai");
  const [model, setModel] = React.useState(defaults.openai);
  const [endpoint, setEndpoint] = React.useState(COMPATIBLE_ENDPOINTS[0].url);
  const [apiKey, setApiKey] = React.useState("");
  const [remember, setRemember] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);
  const [question, setQuestion] = React.useState("");
  const [messages, setMessages] = React.useState<ChatTurn[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CONFIG_STORAGE) ?? "null");
      if (saved && typeof saved === "object") {
        const p: Provider = ["openai", "anthropic", "compatible", "gemini"].includes(saved.provider) ? saved.provider : "openai";
        setProvider(p);
        const savedModel = typeof saved.model === "string" ? saved.model.trim() : "";
        setModel(savedModel || defaults[p]);
        setEndpoint(typeof saved.endpoint === "string" && saved.endpoint.length < 241 ? saved.endpoint : COMPATIBLE_ENDPOINTS[0].url);
      }
      const k = localStorage.getItem(KEY_STORAGE);
      if (k) { setApiKey(k); setRemember(true); }
    } catch { /* El navegador puede bloquear almacenamiento local. */ }
    finally { setHydrated(true); }
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(CONFIG_STORAGE, JSON.stringify({ provider, model, endpoint }));
      if (remember && apiKey) localStorage.setItem(KEY_STORAGE, apiKey);
      else localStorage.removeItem(KEY_STORAGE);
    } catch { /* Sin almacenamiento: la clave sigue en memoria de esta pestaña. */ }
  }, [provider, model, endpoint, apiKey, remember, hydrated]);

  React.useEffect(() => { if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, open]);

  const chooseProvider = (next: Provider) => {
    if (next === provider) return;
    setProvider(next); setModel(defaults[next]); setError(""); setMessages([]);
    // Una clave de OpenAI no debe enviarse por accidente al seleccionar Claude u otro servicio.
    setApiKey(""); setRemember(false);
    try { localStorage.removeItem(KEY_STORAGE); } catch { /* ignore */ }
  };
  const clearKey = () => {
    setApiKey(""); setRemember(false);
    try { localStorage.removeItem(KEY_STORAGE); } catch { /* ignore */ }
  };

  async function send() {
    const q = question.trim();
    if (!q || busy) return;
    if (!apiKey.trim() || !model.trim()) { setError(T.missingKey); setShowSettings(true); return; }
    if (!user) { openLogin(); return; }
    setError(""); setBusy(true); setQuestion("");
    const history = [
      ...messages.map(({ role, content }) => ({
        role,
        content: typeof content === "string" ? content.slice(0, 4000).trim() : "",
      })),
      { role: "user" as const, content: q },
    ].filter((m) => m.content.length > 0).slice(-7);
    while (history[0]?.role === "assistant") history.shift();
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", cache: "no-store",
        body: JSON.stringify({
          provider,
          apiKey: apiKey.trim(),
          model: model.trim(),
          ...(provider === "compatible" && endpoint?.trim() ? { endpoint: endpoint.trim() } : {}),
          history,
          selection: {
            investigationId: typeof investigationId === "number" ? investigationId : null,
            metric: typeof metric === "string" ? metric : null,
            seriesIds: Array.isArray(seriesIds) ? seriesIds.slice(0, 8) : [],
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Error del proveedor");
      if (typeof data.answer !== "string") throw new Error("Respuesta de IA inválida");
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer, toolCalls: Number(data.toolCalls) || 0 }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar.");
      setQuestion(q);
      setMessages((prev) => prev.slice(0, -1)); // Permite reintentar sin duplicar el turno fallido.
    } finally { setBusy(false); }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Bot className="h-4 w-4 text-primary" aria-hidden="true" /> {T.open}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[560px]" aria-describedby="sices-ai-description">
          <SheetHeader className="border-b border-border/60 pr-12">
            <SheetTitle className="display-title flex items-center gap-2 text-base">
              <Bot className="h-5 w-5 text-primary" aria-hidden="true" /> {T.title}
            </SheetTitle>
            <SheetDescription id="sices-ai-description">{T.description}</SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-border/60 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <button type="button" className="flex items-center gap-2 text-xs font-bold" onClick={() => setShowSettings((v) => !v)} aria-expanded={showSettings}>
                  <Settings2 className="h-4 w-4" /> {T.settings} <span className="data-mono font-normal text-muted-foreground">({provider})</span>
                </button>
                <Button variant="ghost" size="sm" onClick={() => { setMessages([]); setError(""); }} title={T.clear}>
                  <Trash2 className="h-3.5 w-3.5" /> {T.clear}
                </Button>
              </div>
              {showSettings ? (
                <div className="mt-3 grid gap-3 text-xs">
                  <div className="grid gap-1.5">
                    <Label htmlFor="sices-ai-provider">{T.provider}</Label>
                    <select id="sices-ai-provider" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={provider} onChange={(e) => chooseProvider(e.target.value as Provider)}>
                      <option value="openai">OpenAI (GPT)</option>
                      <option value="anthropic">Anthropic (Claude)</option>
                      <option value="gemini">Google Gemini</option>
                      <option value="compatible">OpenAI compatible (OpenRouter, Groq…)</option>
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="sices-ai-model">{T.model}</Label>
                    <Input id="sices-ai-model" value={model} onChange={(e) => setModel(e.target.value)} maxLength={120} placeholder="Model ID" autoComplete="off" />
                  </div>
                  {provider === "compatible" ? (
                    <div className="grid gap-1.5">
                      <Label htmlFor="sices-ai-endpoint">{T.endpoint}</Label>
                      <select id="sices-ai-endpoint" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={COMPATIBLE_ENDPOINTS.some((e) => e.url === endpoint) ? endpoint : "__custom__"} onChange={(e) => setEndpoint(e.target.value === "__custom__" ? "" : e.target.value)}>
                        {COMPATIBLE_ENDPOINTS.map((e) => <option key={e.url} value={e.url}>{e.label}</option>)}
                        <option value="__custom__">{T.customEndpoint}</option>
                      </select>
                      {!COMPATIBLE_ENDPOINTS.some((e) => e.url === endpoint) ? (
                        <Input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} maxLength={240} placeholder={T.customEndpointPlaceholder} autoComplete="off" />
                      ) : null}
                    </div>
                  ) : null}
                  <div className="grid gap-1.5">
                    <Label htmlFor="sices-ai-key">{T.key}</Label>
                    <div className="flex gap-2">
                      <Input id="sices-ai-key" type="password" autoComplete="off" spellCheck={false} maxLength={512} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={T.keyPlaceholder} />
                      <Button variant="outline" size="icon" title={T.removeKey} aria-label={T.removeKey} onClick={clearKey}><KeyRound className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="sices-ai-remember" checked={remember} onCheckedChange={setRemember} />
                    <Label htmlFor="sices-ai-remember" className="text-xs font-normal">{T.remember}</Label>
                  </div>
                  <p className="rounded border border-border/50 p-2 text-[11px] leading-relaxed text-muted-foreground">{T.security}</p>
                </div>
              ) : null}
              <p className="mt-3 text-[11px] text-muted-foreground">
                <MessageSquare className="mr-1 inline h-3 w-3" /> {T.selected}: <strong>{seriesIds.length}</strong> {psiCode ? `· ${psiCode}` : ""} {metric ? `· ${metric}` : ""}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">{seriesIds.length ? T.limited : T.noSelection}</p>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
              {messages.length === 0 && (
                <div className="rounded-md border border-border/50 bg-muted/10 p-3 text-xs leading-relaxed text-muted-foreground">
                  <p>{T.welcome}</p>
                  <button type="button" onClick={() => setQuestion(T.example)} className="mt-3 text-left font-medium text-primary hover:underline">{T.example}</button>
                </div>
              )}
              {messages.map((msg, index) => (
                <div key={index} className={`max-w-full rounded-lg border p-3 text-xs leading-relaxed ${msg.role === "user" ? "ml-8 border-primary/30 bg-primary/10" : "mr-3 border-border/60 bg-muted/20"}`}>
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{msg.role === "user" ? "Tú / You" : "SICES IA"}</span>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none break-words dark:prose-invert [&_p]:my-2 [&_li]:my-0.5 [&_ul]:ml-4 [&_ol]:ml-4 [&_a]:text-primary">
                      <ReactMarkdown components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}>{msg.content}</ReactMarkdown>
                    </div>
                  ) : <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
                  {msg.toolCalls ? <p className="mt-2 text-[10px] text-muted-foreground">{T.tools}: {msg.toolCalls}</p> : null}
                </div>
              ))}
              {busy && <p className="flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> {T.sending}</p>}
              <div ref={bottomRef} />
            </div>
            <div className="shrink-0 border-t border-border/60 p-4">
              {error && <p role="alert" className="mb-2 text-xs text-destructive">{error}</p>}
              {!user ? (
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>{T.login}</p>
                  <Button onClick={openLogin} size="sm">{T.loginButton}</Button>
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <Textarea rows={2} maxLength={1400} className="min-h-[60px] resize-none text-sm" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={T.ask} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} />
                  <Button disabled={busy || !question.trim()} size="icon" title={T.send} aria-label={T.send} onClick={() => void send()}>
                    {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              )}
              <p className="mt-2 text-[10px] leading-snug text-muted-foreground">{T.disclaimer}</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
