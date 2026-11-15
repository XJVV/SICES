#!/usr/bin/env bash
# Orbit SICES: publicar el juego original ya instalado en la rama de entrega.
set -euo pipefail
SRC="${1:?Uso: bash publicar-flamezero.sh /ruta/SICES-con-juego [carpeta-clon]}"
DEST="${2:-$HOME/Descargas/Orbit-SICES-jueces}"
BRANCH="${ORBIT_BRANCH:-fix/orbit-sices-comparison-fire-lab}"
REMOTE="${ORBIT_REMOTE:-https://github.com/XJVV/SICES.git}"
SRC="$(realpath "$SRC")"
for relative in public/games/flamezero/project.json public/games/flamezero/game.js public/games/flamezero/index.html src/components/sices/flamezero-game.tsx; do
  if [[ ! -f "$SRC/$relative" ]]; then echo "Falta $SRC/$relative: ejecuta apply_patch.py primero" >&2; exit 2; fi
done
python3 - "$SRC/public/games/flamezero" <<'PY'
from pathlib import Path
import json,sys
root=Path(sys.argv[1]);project=json.loads((root/'project.json').read_text())
refs={m['md5ext'] for t in project['targets'] for m in t.get('costumes',[])+t.get('sounds',[])}
missing=[m for m in refs if not (root/'assets'/m).is_file()]
if missing: raise SystemExit('Faltan '+str(len(missing))+' recursos Scratch')
print('Verificados',len(refs),'recursos originales')
PY
node --check "$SRC/public/games/flamezero/game.js"
if [[ -e "$DEST" && ! -d "$DEST/.git" ]]; then echo "Destino existente sin .git: $DEST" >&2; exit 2; fi
if [[ ! -d "$DEST/.git" ]]; then git clone --branch "$BRANCH" "$REMOTE" "$DEST"; fi
git -C "$DEST" checkout "$BRANCH"
git -C "$DEST" pull --ff-only origin "$BRANCH"
mkdir -p "$DEST/public/games" "$DEST/src/components/sices"
cp -a "$SRC/public/games/flamezero" "$DEST/public/games/"
cp "$SRC/src/components/sices/flamezero-game.tsx" "$DEST/src/components/sices/"
python3 - "$DEST/src/app/page.tsx" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]);s=p.read_text()
anchor='import { FlamePlayground } from "@/components/sices/flame-playground";'
line='import { FlameZeroGame } from "@/components/sices/flamezero-game";'
section='<section id="simulador" className="scroll-mt-24"><FlamePlayground onStudy={toLab}/></section>'
insert='<FlameZeroGame language={language} onScientific={() => setModeAndTop("scientific")} />'
if line not in s:
 if anchor not in s: raise SystemExit('Falta ancla de importación')
 s=s.replace(anchor,anchor+'\n'+line,1)
if insert not in s:
 if section not in s: raise SystemExit('Falta ancla del simulador')
 s=s.replace(section,section+'\n      '+insert,1)
p.write_text(s)
PY
git -C "$DEST" add public/games/flamezero src/components/sices/flamezero-game.tsx src/app/page.tsx
if ! git -C "$DEST" diff --cached --quiet; then
  git -C "$DEST" -c user.name=ORBIT-06 -c user.email=orbit-06@users.noreply.github.com commit -m 'feat(game): publish original FlameZero V12 assets and JS integration'
  if [[ "${ORBIT_SKIP_PUSH:-0}" != "1" ]]; then git -C "$DEST" push origin "$BRANCH"; fi
fi
echo "Proyecto publicado o preparado en $DEST · rama $BRANCH"
echo "Ver https://github.com/XJVV/SICES/tree/$BRANCH"
