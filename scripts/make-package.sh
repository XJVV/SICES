#!/bin/bash
# Empaqueta el proyecto v2.0 para ejecución local en el PC del usuario
set -e

ROOT=/home/z/my-project
STAGE=$ROOT/scripts/staging/sistema-combustion-espacial

rm -rf "$STAGE"
mkdir -p "$STAGE"

# --- Código fuente y configuración ---
cp -r "$ROOT/src" "$STAGE/src"
cp -r "$ROOT/prisma" "$STAGE/prisma"
cp -r "$ROOT/public" "$STAGE/public"

# Base de datos ya precargada (14 investigaciones + 20 publicaciones + 200 mediciones)
mkdir -p "$STAGE/db"
cp "$ROOT/db/custom.db" "$STAGE/db/custom.db"

# Documentación fuente (PDF original)
mkdir -p "$STAGE/docs"
cp "$ROOT/upload/CombustiónEspacial.pdf" "$STAGE/docs/CombustiónEspacial.pdf"

# Archivos de configuración
for f in tsconfig.json tailwind.config.ts postcss.config.mjs components.json eslint.config.mjs next-env.d.ts .gitignore package.json next.config.ts README-INSTALACION.md; do
  if [ -f "$ROOT/$f" ]; then
    cp "$ROOT/$f" "$STAGE/$f"
  elif [ -f "$STAGE/$f" ]; then
    : # ya copiado en pasos previos si estaba en staging
  fi
done

# v2.2: script auto-sanador de BD (hooks predev/prestart) + importador CLI (v2.5)
mkdir -p "$STAGE/scripts"
cp "$ROOT/scripts/ensure-db.js" "$STAGE/scripts/ensure-db.js"
cp "$ROOT/scripts/import-csv.mjs" "$STAGE/scripts/import-csv.mjs"

# v2.5: archivo de ejemplo para probar la importación de datos
mkdir -p "$STAGE/examples"
cp "$ROOT/examples/PSI-159_Analyzed Data_MST_2025_Burning_history_demo.csv" "$STAGE/examples/"

# package.json, next.config.ts, .env, .gitignore y README se regeneran aparte;
# los borramos aquí para que la versión v2 (creada por el script principal) no se sobreescriba
rm -f "$STAGE/package.json" "$STAGE/next.config.ts" "$STAGE/.env" "$STAGE/.gitignore" "$STAGE/README-INSTALACION.md"

# v2.2: .env portable (ruta relativa; el runtime no depende de él gracias a src/lib/db.ts)
printf 'DATABASE_URL=file:../db/custom.db\n' > "$STAGE/.env"

echo "Estructura copiada."
find "$STAGE" -maxdepth 2 | head -30
