# SICES — Asistente IA con API Key personal

Esta es una copia del proyecto SICES con el **asistente de IA integrado en la pestaña «Análisis»**. No sustituye las gráficas ni altera el esquema SQLite.

## Iniciar el proyecto

Requisitos: Node.js moderno (preferiblemente v22+), npm y conexión a internet para instalar dependencias. En la carpeta raíz del proyecto:

```bash
npm install
npm run db:generate
npm run dev
```

Abre **http://localhost:3000**, inicia sesión, entra en **Análisis** y pulsa **«Preguntar a la IA»**. En el panel lateral selecciona un proveedor, escribe el nombre de modelo y añade una clave válida **del servicio elegido**. Escribe una pregunta y pulsa Enviar.

La base de datos `db/custom.db` del proyecto se incluye en el paquete, junto con los CSV/PDF originales de investigación en `upload/`. El script `predev` comprueba la BD y configura su ruta automáticamente. Si falta el archivo `.env`, no es obligatorio para `npm run dev` (opcionalmente copia `.env.example` a `.env`).

**Importante:** una suscripción ChatGPT Plus o Claude Pro no implica automáticamente tener créditos de API. Las llaves y las cuotas se gestionan en la plataforma API del proveedor.

## Proveedores

- **OpenAI (GPT):** endpoint fijo `api.openai.com/v1/chat/completions`; escribe un modelo de Chat Completions compatible con herramientas.
- **Anthropic (Claude):** endpoint fijo `api.anthropic.com/v1/messages`; usa un modelo que admita *tool use*.
- **Google Gemini:** endpoint oficial `generativelanguage.googleapis.com/v1beta/openai/chat/completions`; modelo predeterminado `gemini-3.5-flash-lite`, compatible con llamadas a herramientas y conservación de `thought_signature`.
- **OpenAI-compatible:** OpenRouter, Groq, Together AI, DeepSeek, Mistral, Fireworks, Cerebras y xAI. Elige un endpoint de la lista y un modelo válido del proveedor. No todos los modelos admiten herramientas.

Las URL personalizadas no se aceptan por defecto por seguridad. Para una pasarela propia, el **administrador** puede añadir una URL **exacta HTTPS** a `SICES_AI_APPROVED_ENDPOINTS` (lista separada por comas), La interfaz incluye «URL personalizada aprobada» para pegar esa URL completa. El backend solo la aceptará si coincide exactamente con una de las URL declaradas en la variable de entorno; no hay proxy abierto. **Ollama/LM Studio en localhost no se admiten mediante el proxy público**; utiliza un gateway HTTPS protegido y aprobado por el administrador. Esto evita que usuarios usen el servidor para acceder a la red interna.

## Herramientas locales de solo lectura

El modelo puede invocar estas funciones a través de los protocolos oficiales de los proveedores:

| Herramienta | Qué consulta |
|---|---|
| `list_investigations` | Investigaciones PSI con tipo de combustión y cantidades de datos |
| `summarize_series` | Estadísticas completas de una serie por ID y muestra de hasta 12 puntos |
| `compare_series` | Compatibilidad de unidades/ejes y estadísticas de dos series |
| `query_measurements` | Conteos, rangos y promedios de telemetría filtrados mediante `filters.ts` |

El servidor construye además un contexto inicial a partir de **las primeras 8 series visibles** en «Análisis». Los IDs, la investigación y la métrica se verifican contra la base de datos. Las estadísticas usan **todos los puntos originales**, no los valores normalizados del gráfico; el prompt solo contiene una muestra reducida. La regresión lineal no se interpreta automáticamente como tasa física K.

El asistente **no puede escribir en SQLite**, ejecutar comandos ni ejecutar SQL que genere el modelo. Las respuestas son interpretaciones automáticas y deben revisarse con el material experimental original.

## Privacidad, gasto y seguridad

1. La clave se mantiene **en memoria del navegador por defecto**. La casilla opcional «Recordar clave en este navegador» la almacena en `localStorage`, que es más vulnerable ante malware/extensiones/XSS. No lo actives en equipos compartidos.
2. La clave viaja por `POST /api/assistant` al **backend de SICES** y luego al **proveedor elegido**. La clave no se almacena en SQLite ni se registra en los logs de esta ruta. SICES envía los mensajes y las estadísticas de las series seleccionadas al proveedor externo: no uses información privada o sensible si no está autorizada para compartirse.
3. El endpoint requiere una sesión válida, verifica `Origin`, limita la cantidad de peticiones y solicitudes concurrentes por usuario y desactiva caché. Los URLs compatibles se comprueban contra una lista cerrada (y se bloquean redirecciones).
4. En producción es obligatorio desplegar con **HTTPS** y configurar un proxy seguro. Las cookies de sesión se establecen `Secure` en `NODE_ENV=production`.
5. Configura presupuesto y límites en la consola del proveedor de IA: los mensajes y herramientas consumen tokens y pueden generar cargos.
6. El límite de peticiones está implementado **en memoria por proceso**. Para producción escalada se aconseja un limitador distribuido (Redis/WAF) y controles de uso por cuenta.
7. El asistente puede procesar metadatos importados por CSV. Estos se consideran datos no confiables; los resultados de investigación no deben asumirse científicamente validados sin revisar las fuentes.

## Archivos incorporados o editados

- `src/components/system/ai-assistant-panel.tsx`: chat lateral y configuración por usuario.
- `src/components/system/analysis-view.tsx`: botón contextual que envía la selección visible.
- `src/app/api/assistant/route.ts`: autenticación, validación, límites y contexto seguro.
- `src/lib/assistant/`: adaptadores, cuatro herramientas, endpoints aprobados y estadística.
- `src/lib/i18n.tsx`: textos en español e inglés.
- `src/lib/auth.ts`: opción `Secure` de la cookie en producción.
- `tests/assistant.test.mjs`: pruebas de cálculo y restricciones de URL.

## Pruebas

Con Node 22+ puedes ejecutar las pruebas unitarias **sin llaves de API**:

```bash
node --experimental-strip-types --test tests/assistant.test.mjs tests/assistant-provider-contract.test.cjs
```

Después de instalar dependencias, verifica también:

```bash
npx tsc --noEmit
npm run build
```

No se ha realizado una prueba real contra OpenAI/Claude porque requiere claves personales y cuota. Revisa los nombres y precios de los modelos en tu proveedor. En el entorno donde se preparó esta entrega, **la instalación de npm no se completó**, por lo que **no fue posible ejecutar la compilación completa de Next.js**. Sí se comprobó la sintaxis de los archivos modificados y se ejecutaron las pruebas unitarias de estadísticas, validación de endpoints y contratos simulados de OpenAI/Claude.
