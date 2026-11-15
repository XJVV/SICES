# ORBIT SICES — ORBIT-06 🚀
### Observatorio NASA PSI de combustión en microgravedad + aprendizaje interactivo

**Proyecto para NASA Space Apps Challenge 2026 — Flame in Freefall.** Orbit SICES reúne un observatorio científico de experimentos NASA PSI, comparación de variables trazables, curvas experimentales, asistente IA opcional y una experiencia educativa interactiva. El videojuego **FlameZero / Microgravity Fire Lab** se integra como módulo de «Aprender jugando» una vez incluidos sus recursos originales de Scratch.

> **Criterio científico:** una animación educativa NO equivale a una simulación física validada. Una ficha con N/D en una magnitud puede contener documentos y tablas originales; no se inventan valores, puntos ni curvas. Cada comparación indica origen, unidades y número de datos aprovechables.

## Requisitos

- **Node.js 22** o superior y **npm**, Python **3.10+** para tareas de ingesta (no necesario para arrancar con la SQLite existente).
- Un navegador moderno (Chrome, Firefox o Edge).
- Repositorio completo, incluyendo `db/custom.db` y `cvs/NASA_PSI/` si se quieren previsualizar archivos científicos originales.
- La interfaz trabaja en `http://localhost:3000`. No abras el HTML del juego mediante `file://`, pues necesita un servidor HTTP.

## Instalación inmediata en Linux, Windows o macOS

```bash
git clone --branch feature/sices-nasa-evolution https://github.com/XJVV/SICES.git
cd SICES
npm install
npm run db:generate
npm run dev
```

**Mientras los cambios de comparación estén en revisión**, se pueden usar desde `fix/orbit-sices-comparison-fire-lab`:

```bash
git clone --branch fix/orbit-sices-comparison-fire-lab https://github.com/XJVV/SICES.git
cd SICES
npm install
npm run db:generate
npm run dev
```

Abre **http://localhost:3000**. La terminal debe permanecer abierta. `npm run dev` prepara automáticamente la base SQLite mediante `predev`. No ejecutes `prisma migrate reset` ni resembrados DEMO sobre la base curada.

### Arranque de producción local para demostración

```bash
npm run build
npm run start
```

La compilación y el inicio de producción son verificaciones necesarias antes de la evaluación; **no se garantiza un despliegue sin ejecutar esas pruebas en el equipo**.

## Pantallas y demostración sugerida para jueces

1. **Aprender jugando:** compara Tierra y microgravedad, cambia condiciones y resuelve el quiz; los casos de prevención, detección y extinción enlazan con estudios NASA.
2. **Jugar Microgravity Fire Lab** (cuando los archivos de FlameZero estén instalados): selecciona idioma, accesibilidad y personaje, explora laboratorio, interactúa con objetos y responde cuestionarios.
3. **Laboratorio científico:** consulta series experimentales `EXPERIMENT` respaldadas por archivos NASA PSI, con ejes, unidades y exportación de los datos disponibles.
4. **Comparar:** selecciona investigaciones diferentes. Muestra rangos extraídos, unidades, procedencia `NORMALIZED_PSI_TABLE` / `CATALOG`, número de valores y avisos de muestreo. **N/D no significa necesariamente que el experimento carezca de datos originales**.
5. **Explorador PSI:** revisa tablas originales y fuentes para investigaciones sin curvas numéricas.
6. **Asistente IA** (opcional): requiere configuración de proveedor y, según entorno, inicio de sesión; nunca dependas de él para una demostración sin conexión.

## Integrar el videojuego original FlameZero V12

El motor JavaScript del videojuego y los **534 recursos originales** (512 PNG y 22 WAV) se distribuyeron junto al ZIP de integración separado. **Estos recursos binarios no están todavía en la rama de GitHub hasta que el equipo publique la carpeta `public/games/flamezero`.** Sin esa carpeta el observatorio científico funciona, pero el juego no estará disponible. Nunca se simula la existencia de archivos faltantes.

Para instalar desde el paquete **Orbit_SICES_FlameZero_Integracion.zip**:

```bash
# descomprime el ZIP, luego:
python3 /ruta/Orbit_SICES_FlameZero_Integracion/orbit-sices-delivery/apply_patch.py /ruta/SICES
cd /ruta/SICES
npm install
npm run db:generate
npm run dev
```

El instalador conserva las pantallas existentes e inserta `FlameZeroGame` en `src/app/page.tsx`. Después de publicar los archivos en GitHub, clonar la rama corregida debe bastar. Para publicar **los binarios** desde una instalación ya realizada, utiliza el script `scripts/publicar-flamezero.sh` de esta rama (requiere acceso de escritura en GitHub).

### Controles principales FlameZero

- Flechas o WASD: desplazamiento; **E**: examinar/interactuar; **Q**: regresar.
- **1–5**: seleccionar respuesta; **H/J**: aumentar/disminuir texto; pausa y ajustes disponibles mediante controles.
- Selector Español / English, alto contraste, reducción de movimiento y botones accesibles para teclado.
- Los recursos provienen del `.sb3` suministrado por el equipo; el motor JavaScript interpreta bloques, pero no se debe afirmar una equivalencia visual/técnica perfecta sin validación en navegador real.

## Datos NASA PSI y validación

- Grupos de investigación: **BASS/BASS-II, Saffire I–III, SAME/SAME-R, FLEX/FLEX-2, ACME**, entre otros.
- La curación declara 15 estudios, 12 datasets documentales, 188 curvas experimentales y 276 observaciones normalizadas en la versión curada (las cantidades pueden cambiar si se reingesta).
- Oxígeno en % y presión en psi en la comparación; las unidades originales se respetan en los archivos de origen.
- API principales: `/api/observatory`, `/api/series`, `/api/psi-raw`, `/api/compare?a=<id>&b=<id>`, `/api/assistant`.

Pruebas disponibles en el repositorio:

```bash
npm run test:ingest
npm run build
npm run test:observatory
```

Si importas archivos científicos nuevos, sigue la documentación de ingesta existente: `npm run ingest:batch -- --root cvs --force`, después `npm run db:curate`. La ingesta puede ser larga y no se recomienda justo antes de presentar.

**Estado de validación:** el arranque anterior en Linux reportó `GET / 200`, `/api/observatory 200`, `/api/series 200`, `/api/psi-raw 200` y `/api/compare 200` antes de un error JSX introducido en la rama de comparación. La expresión JSX se corrigió en `scientific-lab.tsx`; el resultado final de CI/E2E debe verificarse de nuevo. Los 17 avisos de auditoría de npm no causaban ese error, pero requieren revisión de dependencias antes del despliegue público.

## Diagnóstico rápido

- **Error `Expected '</', got '{'`**: descarga la versión corregida de `src/components/sices/scientific-lab.tsx` desde la rama de correcciones; el problema era una llave de cierre JSX que faltaba.
- **GET / 500**: revisa el primer error en la terminal; con frecuencia la causa es compilación/Prisma, no el navegador.
- **N/D en Comparar**: la fuente seleccionada no tiene esa variable normalizada. Revisa unidades, conteos y el explorador PSI. No se deben generar valores ficticios.
- **Juego no aparece**: verifica `public/games/flamezero/project.json`, `game.js`, `assets/` y `src/components/sices/flamezero-game.tsx`; ejecutar `apply_patch.py` desde el ZIP si faltan.
- **Módulos ausentes**: ejecuta `npm install` y `npm run db:generate`; comprueba Node 22.
- **Puerto en uso**: detén el proceso anterior antes de lanzar otro `npm run dev`.

## Créditos

**ORBIT-06**, equipo creador de Orbit SICES y de la integración educativa FlameZero. Se conservan las atribuciones originales de las obras y medios utilizados. NASA PSI aporta las fuentes científicas, pero ello **no implica que la NASA certifique, patrocine o avale la aplicación**.

## Fuentes científicas

- [NASA Physical Sciences Informatics (PSI)](https://www.nasa.gov/physical-sciences-informatics-psi/)
- [NASA — Studying Combustion and Fire Safety](https://www.nasa.gov/missions/station/studying-combustion-and-fire-safety/)
- [NASA — Candle Flame in 1g vs Microgravity](https://www.nasa.gov/image-article/candle-flame-1g-vs-microgravity/)
- [NASA Space Apps 2026 — Flame in Freefall](https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/)

### Guías técnicas existentes

- [docs/SCIENTIFIC-CURATION.md](docs/SCIENTIFIC-CURATION.md)
- [docs/PSI_SERIES.md](docs/PSI_SERIES.md)
- [README-ASISTENTE-IA.md](README-ASISTENTE-IA.md)

