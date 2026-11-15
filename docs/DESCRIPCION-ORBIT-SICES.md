# Descripción integral — ORBIT SICES (ORBIT-06)

## Resumen ejecutivo

**Orbit SICES** es una plataforma web científica, educativa e interactiva desarrollada por **ORBIT-06** para el NASA Space Apps Challenge 2026, desafío **Flame in Freefall**. Su objetivo es hacer más accesibles los hallazgos de la NASA acerca de la combustión en microgravedad y su relación con la seguridad contra incendios en estaciones espaciales, vehículos y futuras misiones de exploración.

La NASA ha realizado múltiples campañas de investigación del fuego, las llamas, el humo y su supresión en condiciones de gravedad reducida. Sin embargo, los datos están dispersos en experimentos, tablas, series, informes y formatos de consulta especializados. Orbit SICES los presenta a través de una experiencia unificada, donde usuarios de diferentes niveles pueden **explorar, consultar, comparar, visualizar y aprender** a partir de fuentes trazables de **NASA Physical Sciences Informatics (PSI)**.

## Problema

En microgravedad, la ausencia de flotabilidad gravitatoria dominante modifica cómo se alimentan, se extienden y se extinguen las llamas, así como el transporte del humo. Esto obliga a comprender mejor los materiales combustibles, la ventilación y los métodos de detección y supresión en ambientes espaciales. Aunque existen resultados científicos relevantes, interpretar y comparar sus conjuntos de datos puede ser difícil para estudiantes, educadores y equipos interdisciplinarios.

## Solución: una plataforma, dos experiencias complementarias

### 1. Observatorio y laboratorio científico
El observatorio organiza investigaciones de NASA PSI como **BASS, BASS-II, Saffire I–III, SAME/SAME-R, FLEX/FLEX-2 y ACME**. Ofrece fichas, filtros, parámetros y fuentes originales. Cuando existen datos experimentales numéricos adecuados, representa **curvas reales** con unidades y procedencia; cuando una investigación solo tiene material descriptivo o tablas no normalizadas, conserva la ficha y permite revisar su fuente sin inventar series.

El **comparador** contrasta variables disponibles como concentración inicial de oxígeno, presión, flujo de aire y temperatura. Informa rangos, número de valores y si provienen de tablas NASA PSI normalizadas o registros del catálogo. Esto **no** implica que los ensayos sean equivalentes entre sí; las diferencias de equipos, combustibles y condiciones deben considerarse.

### 2. Aprender jugando: FlameZero / Microgravity Fire Lab
La zona educativa explica de forma intuitiva cómo difiere el comportamiento del fuego entre la Tierra y la microgravedad. Incluye animaciones conceptuales, retos, cuestionarios y casos de **prevención, detección y extinción** conectados con investigaciones científicas.

El videojuego educativo **FlameZero V12**, desarrollado originalmente en Scratch y migrado a HTML5/CSS3/JavaScript, utiliza sus **sprites y sonidos originales**, personajes Boy y Girl, escenarios de laboratorio, mecanismos de interacción, preguntas y reglas de juego. Se integra en «Aprender jugando» sin reemplazar el dashboard.

### 3. IA y análisis guiado
Orbit SICES contempla un asistente contextual de IA para ayudar a interpretar información disponible y navegar investigaciones. **Su uso depende de la configuración de proveedor y autenticación del entorno**. El asistente debe diferenciar los resultados respaldados por NASA PSI de las explicaciones didácticas y de la información no disponible.

### 4. Accesibilidad e internacionalización
La plataforma incorpora interfaz en **español e inglés**, ajuste del tamaño de texto, alto contraste, reducción de movimiento y controles compatibles con teclado. El juego incorpora opciones de accesibilidad educativa. No se afirma certificación WCAG 2.2 sin una auditoría formal de accesibilidad.

## Tecnologías

- **Next.js 16**, React, TypeScript, Tailwind CSS y componentes de interfaz para el observatorio.
- **SQLite + Prisma** para catálogo, trazabilidad y registros normalizados.
- **JavaScript ES6+, HTML5, CSS3 y Canvas** para FlameZero.
- Scripts de ingesta y curación para archivos NASA PSI.
- APIs de comparación, exploración, series y asistente de IA.

## Público objetivo

Estudiantes y docentes de ciencias y tecnología, divulgadores científicos, entusiastas de la exploración espacial, participantes de hackatones y equipos que necesiten una introducción accesible a la investigación experimental de seguridad contra incendios en el espacio.

## Qué aporta el proyecto

1. **Reúne la búsqueda y el análisis** de estudios NASA PSI en una interfaz navegable.
2. **Hace explícita la trazabilidad** y evita gráficos o magnitudes inventados.
3. **Conecta datos con aprendizaje**, mediante retos y el juego educativo original.
4. **Baja barreras de acceso** con idiomas y ajustes de legibilidad.
5. **Separa la ciencia experimental de la simulación conceptual**, para no presentar el juego como un modelo físico predictivo.

## Alcance y limitaciones

Orbit SICES es una herramienta de exploración y educación, **no un sistema certificado de predicción, detección o extinción de incendios reales**. Una investigación puede incluir tablas originales aunque el comparador muestre «Sin valor numérico extraído» para ciertas variables. La disponibilidad del módulo de IA depende de credenciales. La migración de Scratch ha superado pruebas de integridad de recursos y ejecución lógica básica; las pruebas visuales completas de navegador y la publicación final de recursos originales en GitHub deben confirmarse antes de afirmar que toda la plataforma fue validada.

## Presentación oral breve (aprox. 45–60 segundos)

> «Somos ORBIT-06 y presentamos Orbit SICES, una plataforma que convierte investigaciones de combustión en microgravedad en conocimiento accesible. Reunimos datos de NASA PSI sobre llamas, humo, materiales y extinción; permitimos consultarlos, compararlos y visualizarlos con sus fuentes originales. Además, incorporamos explicaciones educativas, un asistente de inteligencia artificial configurable y FlameZero, un videojuego interactivo que enseña los retos de la seguridad contra incendios en el espacio. Nuestra prioridad es conectar ciencia y aprendizaje sin fabricar resultados: las curvas proceden de datos experimentales y las simulaciones del juego son didácticas. Con Orbit SICES queremos acercar el conocimiento científico a más personas y apoyar la comprensión de los desafíos de futuras misiones espaciales».

## Equipo y atribuciones

**ORBIT-06** — Proyecto Orbit SICES y su integración educativa. Investigaciones y archivos científicos procedentes de **NASA PSI**, con atribuciones preservadas en los materiales. No se implica patrocinio ni aval oficial de la NASA.

## Enlaces
- [Repositorio](https://github.com/XJVV/SICES)
- [NASA PSI](https://www.nasa.gov/physical-sciences-informatics-psi/)
- [NASA — Studying Combustion and Fire Safety](https://www.nasa.gov/missions/station/studying-combustion-and-fire-safety/)
- [NASA Space Apps Challenge 2026 — Flame in Freefall](https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/)
