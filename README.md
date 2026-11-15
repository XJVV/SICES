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


## Recuperación de datos originales y accesibilidad (noviembre de 2026)

El número junto a una investigación en el explorador ahora diferencia **curvas experimentales** de **tablas originales**. Una investigación sin curvas extraídas puede contar con datos legítimos en CSV, XLSX, informes o archivos de otro formato. Por ejemplo, el repositorio conserva las tablas de BASS, BASS-II, SAME, SAME-R, Saffire-III, FLEX-2 y ACME s-Flame.

La ruta \`GET /api/psi-raw\` genera un inventario de archivos de \`cvs/NASA_PSI\`. Al seleccionar un experimento, \`GET /api/psi-raw?code=PSI-100\` lista sus archivos, y \`GET /api/psi-raw?code=PSI-100&file=N\` muestra una vista previa del CSV seleccionado con **encabezados y filas originales**, sin modificar unidades ni inventar mediciones. La vista previa tiene un límite de filas. Los archivos grandes y formatos no interpretados pueden abrirse desde el enlace al archivo original en GitHub. Las series científicas depuradas se siguen mostrando en gráficas independientes; un registro tabular no se atribuye a una curva física por el mero hecho de ser numérico.

**Accesibilidad:** el panel del encabezado permite ampliar/reducir texto y contenido entre 90% y 160%, activar alto contraste, reducir movimiento y restablecer la visualización. Las preferencias se guardan en el navegador; los botones son utilizables con teclado y las tablas disponen de encabezados y etiquetas de accesibilidad.

**Idiomas:** el selector Español / English cambia las experiencias educativas, el cuestionario y las principales pantallas del laboratorio. Se conserva el texto de las columnas científicas tal como aparece en los documentos NASA PSI. La traducción no altera el contenido de los CSV de origen.

El inspector de tablas necesita acceso a la carpeta \`cvs/NASA_PSI\` en la instalación donde corre Next.js. Si se despliega el servidor sin esos archivos, el explorador de tablas indicará que no están disponibles (en local, descarga el repositorio completo y ejecuta \`npm run dev\`).
