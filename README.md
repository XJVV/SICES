# SICES FINAL — NASA Physical Sciences Informatics

El producto se enfoca exclusivamente en NASA PSI. No hay importación ni filtros multiagencia.

## Experiencias

**Aprender jugando**: animación interactiva original Tierra vs microgravedad, controles de oxígeno y ventilación, extinción visual, quiz con preguntas y casos Prevención / Detección / Extinción que enlazan a BASS, SAME y FLEX.

**Laboratorio científico**: curvas NASA PSI clasificadas como EXPERIMENT y asociadas a un archivo SourceAsset real, comparación únicamente con unidades y métricas compatibles, marcador del máximo experimental real, exploración de puntos, exportación CSV original, escenarios y asistente contextual.

### Distinción esencial

La animación educativa no resuelve ecuaciones de combustión ni emplea datos científicos para predecir tamaños o temperaturas de llama. Es conceptual. El máximo de una curva es un dato real pero NO constituye un punto de ignición o extinción confirmado.

## Datos curados

- 15 investigaciones NASA PSI; 12 datasets con origen documental; 188 curvas experimentales; 276 observaciones normalizadas.
- Ninguna medición histórica DEMO, ninguna serie MODEL/SIMULATION y ningún dataset legado sin SourceAsset.
- Cuatro escenarios de referencia documentados NO son datos experimentales.
- Oxígeno como porcentaje y presión como psi al visualizar; exportación CSV conserva las unidades originales.
- Investigaciones sin mediciones interpretables mantienen ficha informativa sin puntos inventados.

### Iniciar con la SQLite del repositorio

    npm install
    npm run db:generate
    npm run dev

El archivo db/custom.db en la rama contiene la base curada. No vuelvas a sembrar datos DEMO.

### Regenerar de fuentes NASA PSI (cuando cambie el parser)

    npm run db:setup
    npm run ingest:batch -- --root cvs --force
    npm run db:curate
    npm run test:ingest
    npm run build
    npm run test:observatory

La importación solo acepta cvs/NASA_PSI. La ingesta completa y publicación de SQLite en GitHub Actions requieren ejecución manual de workflow_dispatch; CI de compilación y API sigue en cada PR/push de código.

### Fuentes oficiales

- NASA (2020), Candle Flame 1g vs Microgravity: https://www.nasa.gov/image-article/candle-flame-1g-vs-microgravity/
- NASA, Studying Combustion and Fire Safety: https://www.nasa.gov/missions/station/studying-combustion-and-fire-safety/
- NASA Space Apps, Flame in Freefall: https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/

### Límites

El ranking representa similitud de variables disponibles o relevancia temática, NO probabilidad de incendio. El O₂ del quemador CFI-G no equivale necesariamente al de una cabina. El asistente requiere inicio de sesión y clave de proveedor, y no se valida su disponibilidad externa en CI. No se crean marcadores ficticios de ignición/extinción.

No fusionar main sin revisión del equipo.
