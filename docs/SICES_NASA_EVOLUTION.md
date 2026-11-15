# SICES · evolución del observatorio científico

Este cambio es una **entrega incremental**, no una certificación de cumplimiento total del desafío NASA.

## Instalación y carga

En la raíz del repositorio:

\`\`\`bash
npm ci
npm run db:generate
npm run db:setup
python3 -m pip install -r python/requirements-batch.txt
npm run ingest:batch -- --root cvs
npm run test:ingest
npm run build
npm run dev
\`\`\`

\`npm run db:setup\` crea/prepara las tablas sin sembrar experimentos inventados. La base se resuelve desde \`DATABASE_URL\` (relativo al directorio \`prisma/\`), o desde \`db/custom.db\` en ausencia de configuración. El catálogo histórico no se borra.

La ingesta de \`cvs/\` detecta la agencia en la primera subcarpeta (p. ej. \`NASA_PSI\`, \`JAXA_KIBO\`), lee CSV y XLSX, y CSV/XLSX comprimidos en ZIP. Documentos PDF/DOC/DAT no se convierten en mediciones. Los ZIP tienen límites de tamaño. Registra trazabilidad, ruta, SHA-256, estado, encabezados originales y filas por hoja. Los archivos repetidos se saltan por ruta y SHA. Las unidades se normalizan **solo si los encabezados las declaran**. El informe está en \`reports/batch-ingest.json\`.

**Limitación conocida:** el parser de lotes almacena observaciones de tablas identificables; no convierte automáticamente cada matriz o archivo de lectura sin encabezados, ni infiere tipos de combustión/gravedad de nombres ambiguos. Mantiene \`UNMAPPED\` cuando no hay datos verificables. No sustituye la revisión por especialistas. Algunas series del catálogo original se preservan sin vincularse al nuevo \`SourceAsset\`.

## Consultas

La pestaña Observatorio muestra filtros de agencia, equipo y gravedad cuando esos valores existen; series, fichas y archivos provienen de SQLite. El modo Divulgación evita inventar resúmenes para documentos sin descripción. El modo Científico muestra condiciones experimentales y mediciones. El simulador ofrece **similitud exploratoria de condiciones**, no probabilidad de incendio, causalidad ni recomendaciones certificadas.

Se desactivó \`/api/import\` (HTTP 410) y se retiró el diálogo manual. \`/api/observatory/export\` exporta observaciones (máximo 200,000 filas por solicitud); no incluye todo el contenido bruto y las cifras mayores deben exportarse por lotes adicionales en una implementación futura. El asistente sigue requiriendo autenticación y configuración del proveedor.

## Pendientes científicos y técnicos

- **No se ha ejecutado una ingesta completa de los datasets originales ni generado una SQLite precargada en este PR**. Ejecutar los comandos anteriores y revisar la cobertura del informe antes de desplegar.
- La ingesta CSV lee cada archivo en memoria; es necesario procesamiento en streaming para colecciones mucho mayores.
- Por ahora las agencias no equivalen a certificación de que la investigación se realizó en esa agencia.
- Marcadores de eventos en curvas (ignición, llama fría, extinción), interpretación Tierra → microgravedad y estrategias de supresión requieren fuentes y anotaciones validadas, no coordenadas ficticias.
- El modo de divulgación no modifica todavía todas las gráficas heredadas.
- Presets de Tierra/ISS/Luna/Traje solo pueden mostrarse cuando están documentados en la base. No se inventan condiciones físicas.
- Ejecutar CI de TypeScript, Prisma y Python antes del merge; revisar comportamiento en dispositivo móvil.
