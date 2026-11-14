/** Contratos de adaptadores con respuestas sintéticas. Sin red ni llaves reales. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');

const root = path.join(__dirname, '..');
function loadTs(file, mocks = {}) {
  const filePath = path.join(root, file);
  const source = fs.readFileSync(filePath, 'utf8');
  const code = ts.transpileModule(source, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  const requireMock = (name) => mocks[name] ?? require(name);
  new Function('require', 'module', 'exports', code)(requireMock, module, module.exports);
  return module.exports;
}
const constants = loadTs('src/lib/assistant/constants.ts');
const invoked = [];
const providers = loadTs('src/lib/assistant/providers.ts', {
  '@/lib/assistant/constants': constants,
  '@/lib/assistant/tools': {
    TOOL_DEFINITIONS: [{ name: 'summarize_series', description: 'Mock', input_schema: { type: 'object', properties: { seriesId: {type:'integer'} } } }],
    executeReadOnlyTool: async (name, args) => { invoked.push([name,args]); return { seriesId: args.seriesId, count: 3 }; },
  },
});
const common = { apiKey: 'test-secret-key', system: 'sices system', history: [{ role:'user', content: '¿Cuántos?' }] };

test('OpenAI ejecuta herramienta local y retorna interpretación', async () => {
  invoked.length = 0;
  const sent = [];
  const original = global.fetch;
  global.fetch = async (url, options) => {
    sent.push({ url, body: JSON.parse(options.body), headers: options.headers });
    return new Response(JSON.stringify(sent.length === 1
      ? { choices:[{message:{content:null,tool_calls:[{id:'c1',type:'function',function:{name:'summarize_series',arguments:'{"seriesId":11}'}}]}}] }
      : { choices:[{message:{content:'La serie #11 contiene 3 puntos.'}}] }), {status:200});
  };
  try {
    const r = await providers.answerWithProvider({...common, provider:'openai', model:'gpt-4o-mini'});
    assert.match(r.answer,/3 puntos/); assert.equal(r.toolCalls,1);
    assert.deepEqual(invoked,[['summarize_series',{seriesId:11}]]);
    assert.equal(sent[0].headers.authorization,'Bearer test-secret-key');
    assert.equal(sent[1].body.messages.at(-1).role,'tool');
  } finally {global.fetch = original;}
});

test('Claude devuelve tool_result tras tool_use', async () => {
  invoked.length=0;
  const calls = [];
  const original=global.fetch;
  global.fetch = async (url, options) => {
    calls.push({url,body:JSON.parse(options.body),headers:options.headers});
    return new Response(JSON.stringify(calls.length===1
      ? {content:[{type:'tool_use',id:'c2',name:'summarize_series',input:{seriesId:20}}],stop_reason:'tool_use'}
      : {content:[{type:'text',text:'La serie #20 tiene 3 registros.'}],stop_reason:'end_turn'}),{status:200});
  };
  try {
    const r=await providers.answerWithProvider({...common, provider:'anthropic', model:'claude-haiku-4-5'});
    assert.equal(r.toolCalls,1); assert.deepEqual(invoked,[['summarize_series',{seriesId:20}]]);
    assert.equal(calls[0].headers['x-api-key'],'test-secret-key');
    assert.equal(calls[1].body.messages.at(-1).content[0].type,'tool_result');
  } finally {global.fetch=original;}
});

test('Endpoint arbitrario no origina una petición externa', async () => {
  const original = global.fetch;
  let called=false;
  global.fetch = async () => {called=true; throw Error('no');};
  try {
    await assert.rejects(providers.answerWithProvider({...common,provider:'compatible',model:'x',endpoint:'http://127.0.0.1/admin'}),/Endpoint no permitido/);
    assert.equal(called,false);
  } finally {global.fetch=original;}
});

test('Gemini ejecuta herramienta conservando thought_signature', async () => {
  invoked.length = 0;
  const sent = [];
  const original = global.fetch;
  global.fetch = async (url, options) => {
    sent.push({ url, body: JSON.parse(options.body), headers: options.headers });
    return new Response(JSON.stringify(sent.length === 1
      ? {
          choices: [{
            message: {
              content: null,
              tool_calls: [{
                id: 'call_gemini_1',
                type: 'function',
                thought_signature: 'thought-sig-xyz-987',
                function: { name: 'summarize_series', arguments: '{"seriesId":15}' },
              }],
            },
          }],
        }
      : { choices: [{ message: { content: 'La serie #15 contiene 3 mediciones analizadas.' } }] }), { status: 200 });
  };
  try {
    const r = await providers.answerWithProvider({ ...common, provider: 'gemini', model: 'gemini-3.5-flash-lite' });
    assert.match(r.answer, /3 mediciones/);
    assert.equal(r.toolCalls, 1);
    assert.deepEqual(invoked, [['summarize_series', { seriesId: 15 }]]);
    assert.equal(sent[0].url, constants.GEMINI_COMPLETIONS_URL);
    assert.equal(sent[0].headers.authorization, 'Bearer test-secret-key');
    // Verificar que thought_signature se conserva en el turno del asistente
    const assistantMsg = sent[1].body.messages.find((m) => m.role === 'assistant');
    assert.ok(assistantMsg && assistantMsg.tool_calls);
    assert.equal(assistantMsg.tool_calls[0].thought_signature, 'thought-sig-xyz-987');
  } finally { global.fetch = original; }
});

test('Gemini adapta esquemas de herramientas eliminando additionalProperties', async () => {
  const sent = [];
  const original = global.fetch;
  global.fetch = async (url, options) => {
    sent.push({ url, body: JSON.parse(options.body) });
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Listo' } }] }), { status: 200 });
  };
  try {
    await providers.answerWithProvider({ ...common, provider: 'gemini', model: 'gemini-3.5-flash-lite' });
    const tools = sent[0].body.tools;
    assert.ok(tools && tools.length > 0);
    for (const t of tools) {
      assert.equal(t.function.parameters.additionalProperties, undefined);
    }
  } finally { global.fetch = original; }
});

test('Gemini maneja errores específicos 400, 404 y 422', async () => {
  const original = global.fetch;
  try {
    global.fetch = async () => new Response(JSON.stringify({ error: 'bad' }), { status: 400 });
    await assert.rejects(
      providers.answerWithProvider({ ...common, provider: 'gemini', model: 'gemini-3.5-flash-lite' }),
      /Error 400 en Gemini/
    );

    global.fetch = async () => new Response(JSON.stringify({ error: 'not found' }), { status: 404 });
    await assert.rejects(
      providers.answerWithProvider({ ...common, provider: 'gemini', model: 'gemini-3.5-flash-lite' }),
      /Error 404 en Gemini/
    );

    global.fetch = async () => new Response(JSON.stringify({ error: 'unprocessable' }), { status: 422 });
    await assert.rejects(
      providers.answerWithProvider({ ...common, provider: 'gemini', model: 'gemini-3.5-flash-lite' }),
      /Error 422 en Gemini/
    );
  } finally { global.fetch = original; }
});
