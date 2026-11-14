#!/bin/bash
# Actualiza el paquete portable con el código actual (v2.1: explorador de series,
# detalle de registros y comparación gráfica) y regenera el ZIP descargable.
set -e

ROOT=/home/z/my-project
STAGE=$ROOT/scripts/staging/sistema-combustion-espacial
KEEP=$ROOT/scripts/staging/keep-v2
ZIP=$ROOT/download/sistema-combustion-espacial.zip

# 1. Preservar archivos propios del paquete portable
mkdir -p "$KEEP"
for f in package.json next.config.ts .env .gitignore README-INSTALACION.md; do
  if [ -f "$STAGE/$f" ]; then
    cp "$STAGE/$f" "$KEEP/$f"
  fi
done

# 2. Recopiar código y datos actualizados
bash "$ROOT/scripts/make-package.sh"

# 3. Restaurar archivos propios
for f in package.json next.config.ts .env .gitignore README-INSTALACION.md; do
  if [ -f "$KEEP/$f" ]; then
    cp "$KEEP/$f" "$STAGE/$f"
  fi
done

# 4. Fijar versión del paquete (2.6.0: importación de datos analizados)
sed -i '0,/"version": ".*"/s//"version": "2.6.0"/' "$STAGE/package.json"

# 5. Limpieza: nada de artefactos locales
rm -rf "$STAGE/node_modules" "$STAGE/.next" "$STAGE/dev.log" "$STAGE/server.log"

# 6. Comprimir
mkdir -p "$ROOT/download"
rm -f "$ZIP"
cd "$STAGE/.." && zip -qr "$ZIP" sistema-combustion-espacial -x "*/node_modules/*" "*/.next/*"

echo "ZIP regenerado:"
ls -lh "$ZIP"
unzip -l "$ZIP" | tail -3
