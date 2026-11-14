/**
 * Seed del Sistema de Investigaciones de Combustión Espacial
 * Datos tomados del documento "Investigación científica sobre experimentos de
 * combustión espacial en microgravedad – NASA PSI" (sin inventar valores).
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";
import { randomBytes, scryptSync } from "crypto";

/**
 * URL portable (ver src/lib/db.ts): ignora rutas absolutas de otras máquinas
 * y usa <proyecto>/db/custom.db a partir del directorio de trabajo.
 */
function databaseUrl(): string {
  const env = process.env.DATABASE_URL;
  if (env && env.startsWith("file:")) {
    const p = env.slice(5);
    if (!p.startsWith("/") || p.startsWith(process.cwd())) return env;
  }
  return "file:" + join(process.cwd(), "db", "custom.db").replace(/\\/g, "/");
}

const db = new PrismaClient({ datasources: { db: { url: databaseUrl() } } });
const DATA_DIR = join(__dirname, "data");

const PSI_BASE = "https://psi.nasa.gov/physci/repo/data/investigations";

const investigations = [
  {
    psiCode: "PSI-26",
    shortName: "BASS",
    name: "Burning and Suppression of Solids (BASS)",
    category: "PRINCIPAL",
    combustionType: "SOLID_SURFACE",
    platform: "ISS — Microgravity Science Glovebox (MSG)",
    period: "Octubre 2009 – Junio 2013",
    investigator: "Paul Ferkul",
    doi: "10.60555/58h4-dy80",
    psiUrl: `${PSI_BASE}/PSI-26`,
    description:
      "Estudió la combustión de sólidos en flujos forzados de baja velocidad, incluyendo llamas de estela detrás de obstáculos y geometrías relevantes para incendios en espacios confinados. Combustión difusiva de superficie sólida: la llama se propaga sobre tejidos, películas y geometrías de PMMA, con regímenes de flujo opuesto y concurrente.",
    objectives:
      "Vincular las pruebas terrestres NASA-STD-6001 Test 1, los ensayos terrestres de microgravedad y la inflamabilidad real en microgravedad; además, evaluar la eficacia de un agente extintor gaseoso inerte, análogo al usado en la ISS.",
    methodology:
      "Muestras de tela compuesta por 75% algodón y 25% fibra de vidrio, Nomex y Ultem, encendidas con alambre de Kanthal de calibre 29. El flujo de aire se controló con un ventilador, alcanzando hasta 40 cm/s, en configuraciones concurrentes u opuestas a la propagación de la llama.",
    fuel: "SIBAL (75% algodón / 25% fibra de vidrio), Nomex, Ultem, PMMA",
    oxygen: "Variable, controlada por dilución",
    pressure: "No expuesta en tabla PSI (extraer de archivos crudos del repositorio)",
    temperature: "No expuesta en tabla PSI (extraer de archivos crudos del repositorio)",
    flow: "Hasta 40 cm/s, concurrente u opuesto",
    results:
      "Proporcionó datos para modelos de emisión radiativa, liberación de calor y propagación de llama, y para evaluar la supresión con nitrógeno en microgravedad.",
    conclusions:
      "Su aporte central es demostrar que la inflamabilidad en microgravedad no puede extrapolarse directamente desde ensayos en gravedad normal.",
    dataAvailable:
      "211 archivos añadidos en la versión 4, incluyendo metadatos, presentaciones, documentos y material experimental; la página lista publicaciones sobre propagación en flujo opuesto, radiación, límites de inflamabilidad y efectos del precalentamiento.",
    filesCount: 211,
    publications: [
      {
        citation:
          "Ferkul, Olson, Takahashi, Endo, Johnston y T'ien — “Thickness and Fuel Preheating Effects on Material Flammability in Microgravity from the BASS Experiment”, disponible desde PSI-26.",
        year: null,
      },
    ],
  },
  {
    psiCode: "PSI-25",
    shortName: "BASS-II",
    name: "Burning and Suppression of Solids-II (BASS-II)",
    category: "PRINCIPAL",
    combustionType: "SOLID_SURFACE",
    platform: "ISS — Microgravity Science Glovebox (MSG)",
    period: "2010 – 2022",
    investigator: "",
    doi: "10.60555/4qc4-de67",
    psiUrl: `${PSI_BASE}/PSI-25`,
    description:
      "Continuación directa de BASS; amplió el estudio hacia combustibles más realistas y gruesos —láminas, cilindros y secciones esféricas—, con mayor control de oxígeno, flujo y geometría. Combustión difusiva de sólidos, con especial atención a la extinción radiativa y a la propagación sobre PMMA, tejidos y geometrías tridimensionales.",
    objectives:
      "Estudiar ignición, crecimiento de llama, propagación y límites de extinción de sólidos en flujos forzados de baja velocidad; generar datos para modelos de detección y supresión; y apoyar los requisitos científicos de SoFIE.",
    methodology:
      "Las pruebas se realizaron en el MSG de la ISS, con un túnel de viento que imponía flujos de hasta 40 cm/s. Se midieron aparición de llama, crecimiento y velocidad de propagación en régimen concurrente y opuesto.",
    fuel: "PMMA, telas, barras, secciones esféricas, láminas y películas",
    oxygen: "Variable por dilución con N2 (ej. 22.2%)",
    pressure: "No expuesta en tabla PSI (extraer de archivos crudos del repositorio)",
    temperature: "No expuesta en tabla PSI (extraer de archivos crudos del repositorio)",
    flow: "Hasta 40 cm/s, concurrente u opuesto",
    results:
      "Generó 130 registros experimentales visibles en la tabla PSI, con mediciones de O2 inicial y final, CO2, CO, velocidad de ventilador, radiómetro y número de fotogramas. La tabla registra, por ejemplo, PMMA de 100, 200 y 300 micrómetros con oxígeno calibrado cercano a 22.2% y CO2 inicial de 0.43–0.44%.",
    conclusions:
      "Mostró que, con ventilación adecuada, los materiales pueden arder en microgravedad tan bien o mejor que en gravedad normal bajo condiciones equivalentes; esto respalda la necesidad de criterios de selección de materiales específicos para el espacio.",
    dataAvailable:
      "694 archivos añadidos en la versión 4, incluyendo videos crudos, datos de sensores CSA-CP y CDM, documentos de ingeniería, reportes y publicaciones.",
    filesCount: 694,
    publications: [
      { citation: "Olson y Ferkul (2017), disponible desde PSI-25.", year: 2017 },
      { citation: "Bhattacharjee et al. (2015), disponible desde PSI-25.", year: 2015 },
      { citation: "Zhao et al. (2016), disponible desde PSI-25.", year: 2016 },
    ],
  },
  {
    psiCode: "PSI-98",
    shortName: "SAFFIRE-I",
    name: "Spacecraft Fire Experiment-I (SAFFIRE-I)",
    category: "PRINCIPAL",
    combustionType: "SOLID_SURFACE",
    platform: "Nave Cygnus (tras desacoplarse de la ISS)",
    period: "",
    investigator: "",
    doi: "10.60555/0t15-1z43",
    psiUrl: `${PSI_BASE}/PSI-98`,
    description:
      "Primer experimento de incendio espacial a gran escala, diseñado para caracterizar el crecimiento de fuego y el humo en un ambiente cerrado similar al de una nave de carga. Combustión de superficie sólida en escala grande, con propagación de llama sobre tela compuesta y medición del humo generado.",
    objectives:
      "Determinar la velocidad de crecimiento de un incendio grande en baja gravedad y comparar los límites de inflamabilidad en microgravedad con los de la prueba NASA-STD-6001 en gravedad normal.",
    methodology:
      "Se utilizó una muestra de SIBAL —75% algodón y 25% fibra de vidrio— de aproximadamente 0.94 m × 0.4 m, instalada en un ducto de gran sección con ventiladores y enderezadores de flujo. La velocidad de aire fue de 20 cm/s.",
    fuel: "SIBAL (75% algodón / 25% fibra de vidrio)",
    oxygen: "Medido por sensores",
    pressure: "Medida por sensores",
    temperature: "Termopares (llama y pluma)",
    flow: "20 cm/s",
    results:
      "El experimento midió crecimiento de llama, radiación, composición gaseosa, presión y temperatura, con dos cámaras para registrar la evolución visual. También midió la velocidad mediante anemómetros.",
    conclusions:
      "Estableció una base experimental para validar criterios de selección de materiales y entender cómo la microgravedad y el oxígeno limitado afectan el tamaño de la llama.",
    dataAvailable:
      "Metadatos, documentos de ingeniería, datos crudos, documentos científicos y publicaciones; la versión 4 añadió 74 archivos, incluyendo imágenes originales y cuadrículas de distorsión.",
    filesCount: 74,
    publications: [
      { citation: "Urban et al. (2018), disponible desde PSI-98.", year: 2018 },
      { citation: "Li et al. (2018), disponible desde PSI-98.", year: 2018 },
      { citation: "Jomaas et al. (2014), disponible desde PSI-98.", year: 2014 },
    ],
  },
  {
    psiCode: "PSI-99",
    shortName: "SAFFIRE-II",
    name: "Spacecraft Fire Experiment-II (SAFFIRE-II)",
    category: "PRINCIPAL",
    combustionType: "SOLID_SURFACE",
    platform: "Nave Cygnus",
    period: "Septiembre 2016 – Abril 2017",
    investigator: "",
    doi: "10.60555/2chp-m469",
    psiUrl: `${PSI_BASE}/PSI-99`,
    description:
      "Amplió SAFFIRE-I mediante una tarjeta con nueve muestras de 5 cm × 29 cm, incorporando SIBAL, silicona, PMMA estructural, PMMA plano y PMMA con Nomex. Combustión de superficie sólida sobre múltiples materiales, incluyendo polímeros y textiles compuestos.",
    objectives:
      "Repetir las preguntas de crecimiento y límites de inflamabilidad, pero con mayor diversidad de materiales y condiciones de flujo.",
    methodology:
      "Las pruebas se realizaron a 20 o 30 cm/s, en configuración concurrente u opuesta, con cámaras, termopares, radiómetros, sensores de presión, CO2 y O2, y anemómetros.",
    fuel: "SIBAL, silicona, PMMA estructural, PMMA plano, PMMA + Nomex",
    oxygen: "Medido por sensores",
    pressure: "Medida por sensores",
    temperature: "Termopares",
    flow: "20 o 30 cm/s, concurrente u opuesto",
    results:
      "El experimento buscó determinar límites de inflamabilidad en microgravedad para varios materiales espaciales y validar los criterios de selección de materiales de NASA.",
    conclusions:
      "Amplió la base de datos de materiales y permitió comparar la respuesta de polímeros y textiles bajo flujos controlados en microgravedad.",
    dataAvailable:
      "Metadatos, documentos de ingeniería, presentaciones, datos crudos, documentos científicos y publicaciones.",
    filesCount: null,
    publications: [
      { citation: "Urban et al. (2018), disponible desde PSI-99.", year: 2018 },
      { citation: "Thomsen et al. (2018), disponible desde PSI-99.", year: 2018 },
      { citation: "Olson et al. (2019), disponible desde PSI-99.", year: 2019 },
    ],
  },
  {
    psiCode: "PSI-100",
    shortName: "SAFFIRE-III",
    name: "Spacecraft Fire Experiment-III (SAFFIRE-III)",
    category: "PRINCIPAL",
    combustionType: "SOLID_SURFACE",
    platform: "Nave Cygnus",
    period: "A partir de abril 2017",
    investigator: "",
    doi: "10.60555/040q-4h36",
    psiUrl: `${PSI_BASE}/PSI-100`,
    description:
      "Continuó la línea de SAFFIRE-I utilizando nuevamente SIBAL, pero elevando la velocidad de flujo de 20 a 30 cm/s. Combustión de superficie sólida en escala grande, con énfasis en el efecto de la velocidad de flujo.",
    objectives:
      "Mantener los mismos dos objetivos centrales: crecimiento de incendio en baja gravedad y límites de inflamabilidad en microgravedad frente a las pruebas terrestres.",
    methodology:
      "Muestra de SIBAL en ducto de gran sección, con flujo concurrente u opuesto, cámaras, termopares, radiómetros, sensores de presión, CO2 y O2, y anemómetros.",
    fuel: "SIBAL (75% algodón / 25% fibra de vidrio)",
    oxygen: "Medido por sensores",
    pressure: "Medida por sensores",
    temperature: "Termopares",
    flow: "30 cm/s",
    results:
      "El experimento midió crecimiento de llama, radiación, gases, presión y temperatura, con el mismo paquete instrumental que SAFFIRE-I.",
    conclusions:
      "Permite aislar el efecto del aumento de velocidad de flujo sobre la propagación y extinción de una llama de SIBAL en microgravedad.",
    dataAvailable:
      "Metadatos, documentos de ingeniería, presentaciones, datos crudos, documentos científicos y publicaciones; la versión 4 añadió 85 archivos.",
    filesCount: 85,
    publications: [
      { citation: "Schoren, Ruff y Urban, disponible desde PSI-100.", year: null },
      { citation: "Ruff y Urban, disponible desde PSI-100.", year: null },
    ],
  },
  {
    psiCode: "PSI-102",
    shortName: "SAME",
    name: "Smoke Aerosol Measurement Experiment (SAME)",
    category: "PRINCIPAL",
    combustionType: "AEROSOL",
    platform: "ISS",
    period: "",
    investigator: "",
    doi: "",
    psiUrl: `${PSI_BASE}/PSI-102`,
    description:
      "Investigación original sobre aerosoles de humo en microgravedad: estudió cómo se forman, crecen y transportan las partículas líquidas de humo en microgravedad. No es combustión de llama difusiva, sino pirolisis, nucleación, condensación y coagulación de aerosoles.",
    objectives:
      "Cuantificar el tamaño de las partículas de humo líquido en baja gravedad y relacionar la distribución de tamaños con las condiciones de generación y transporte.",
    methodology:
      "Se calentó una muestra de DBP (dibutil ftalato) para generar vapor y aerosol, y se midió la distribución de tamaños con instrumentos de diagnóstico: dos Commercial Diagnostic Enclosures con DustTrak y detector de ionización.",
    fuel: "DBP (dibutil ftalato)",
    oxygen: "No es el foco del estudio",
    pressure: "No expuesto en tabla PSI",
    temperature: "Temperatura de calentamiento (variable)",
    flow: "Flujo variable",
    results:
      "La hipótesis central es que, sin convección buoyante, las partículas crecen más en microgravedad debido a mayor concentración de vapor y mayor tiempo de residencia.",
    conclusions:
      "Buscó establecer una base de datos para evaluar la respuesta de detectores de humo en microgravedad.",
    dataAvailable:
      "Los datos de SAME y SAME-R se emplearon para validar la suposición de distribución lognormal y el método de momentos; SAME-R reutiliza el hardware de SAME.",
    filesCount: null,
    publications: [],
  },
  {
    psiCode: "PSI-101",
    shortName: "SAME-R",
    name: "Smoke Aerosol Measurement Experiment-Reflight (SAME-R)",
    category: "PRINCIPAL",
    combustionType: "AEROSOL",
    platform: "ISS",
    period: "Julio – Septiembre 2010",
    investigator: "",
    doi: "10.60555/2np7-jv14",
    psiUrl: `${PSI_BASE}/PSI-101`,
    description:
      "Corrigió problemas de contaminación de rejillas TEM observados en SAME y amplió el rango de condiciones experimentales. Generación y evolución de aerosoles de humo, no combustión de llama propiamente dicha.",
    objectives:
      "Cuantificar el tamaño de partículas de humo líquido en microgravedad y relacionarlo con la generación y el transporte del humo.",
    methodology:
      "Se sustituyó DBP por Pyrell® (espuma intumescente retardante de fuego); se amplió el rango de temperaturas de calentamiento; se incluyó la condición de no flujo durante el calentamiento; y se incorporó el instrumento M-pass desarrollado por NASA GRC.",
    fuel: "Pyrell® (espuma intumescente retardante de fuego)",
    oxygen: "No es el foco del estudio",
    pressure: "No expuesto en tabla PSI",
    temperature: "Temperaturas más altas, sin flujo en algunos casos",
    flow: "Flujo variable o nulo",
    results:
      "Generó 66 puntos de prueba y permitió validar la hipótesis de que las partículas crecen más en microgravedad por menor mezclado y mayor tiempo de residencia.",
    conclusions:
      "Los resultados son directamente relevantes para el diseño de detectores de humo espaciales, porque el tamaño y la densidad numérica de partículas afectan la respuesta de los sensores.",
    dataAvailable:
      "342 archivos añadidos en la versión 4, incluyendo informe final, presentaciones, documentos de ingeniería y datos analizados.",
    filesCount: 342,
    publications: [
      { citation: "Meyer et al. (2013), disponible desde PSI-101.", year: 2013 },
      { citation: "Urban et al. (2012), disponible desde PSI-101.", year: 2012 },
      { citation: "Meyer et al. (2018), disponible desde PSI-101.", year: 2018 },
    ],
  },
  {
    psiCode: "PSI-69",
    shortName: "FLEX",
    name: "Flame Extinguishment Experiment (FLEX)",
    category: "PRINCIPAL",
    combustionType: "LIQUID_DROPLET",
    platform: "ISS — Combustion Integrated Rack (CIR) / Multi-user Droplet Combustion Apparatus (MDCA)",
    period: "2007 – 2016",
    investigator: "",
    doi: "10.60555/mbq8-0451",
    psiUrl: `${PSI_BASE}/PSI-69`,
    description:
      "Estudió la combustión y extinción de gotas líquidas relativamente grandes en microgravedad, con énfasis en límites de inflamabilidad y supresores gaseosos. Combustión de gota líquida, con llamas de difusión y fenómenos de “cool flames” en alcanos.",
    objectives:
      "Mapear límites de inflamabilidad de combustibles líquidos, medir la eficacia de CO2, He y SF6 como supresores, y desarrollar modelos predictivos de límites de combustión en gravedad reducida.",
    methodology:
      "Se encendieron gotas de aproximadamente 3 mm y se varió presión entre 0.5 y 1.5 atm, oxígeno y tamaño de gota, siguiendo un procedimiento iterativo hasta determinar el Índice Límite de Oxígeno (LOI).",
    fuel: "Metanol, n-heptano, etc.",
    oxygen: "Variable, con supresores",
    pressure: "0.5 – 1.5 atm",
    temperature: "No expuesta en tabla PSI",
    flow: "Baja o nula",
    results:
      "La tabla experimental de PSI registra 275 pruebas, con metanol como combustible en los primeros casos mostrados, presiones cercanas a 760 mmHg, oxígeno inicial de 0.21 y diámetros iniciales de 1.6 a 2.1 mm.",
    conclusions:
      "Demostró que la microgravedad altera de forma fundamental la combustión y extinción de gotas, y que los supresores gaseosos tienen eficacia distinta bajo esas condiciones.",
    dataAvailable:
      "275 registros experimentales, con fecha, GMT, combustible, presión, composición inicial, diámetro inicial y final, tasa de combustión, tiempo de combustión y resultado final.",
    filesCount: null,
    publications: [
      { citation: "Nayagam et al., disponible desde PSI-69.", year: null },
      { citation: "Farouk y Dryer (2013), disponible desde PSI-69.", year: 2013 },
    ],
  },
  {
    psiCode: "PSI-68",
    shortName: "FLEX-2",
    name: "Flame Extinguishment Experiment-2 (FLEX-2)",
    category: "PRINCIPAL",
    combustionType: "LIQUID_DROPLET",
    platform: "ISS — Combustion Integrated Rack (CIR) / MDCA",
    period: "2016 – 2019",
    investigator: "",
    doi: "10.60555/byp8-h018",
    psiUrl: `${PSI_BASE}/PSI-68`,
    description:
      "Extendió FLEX hacia combustibles y condiciones más cercanas a combustores reales, incluyendo mezclas binarias y arreglos de gotas. Combustión de gota líquida monocomponente, bicomponente y en arreglos de gotas.",
    objectives:
      "Estudiar mezcla líquida en gotas bicomponentes, fenómenos estacionarios y no estacionarios, mecanismos de extinción, formación de hollín, interacción entre gotas y validación de modelos.",
    methodology:
      "La cámara se llenó con mezclas de O2/N2 u O2/He, con presión entre 0.5 y 3.0 atm, oxígeno entre 0.1 y 0.4, temperatura de 25 °C y velocidad de flujo entre 0.1 y 5 cm/s.",
    fuel: "Iso-octano, n-octano, heptano, decano, etanol",
    oxygen: "0.1 – 0.4",
    pressure: "0.5 – 3.0 atm",
    temperature: "25 °C",
    flow: "0.1 – 5 cm/s",
    results:
      "Generó datos de referencia para validar simulaciones numéricas y desarrollar modelos teóricos de combustión de gotas. La tabla experimental muestra 9 configuraciones visibles.",
    conclusions:
      "Permitió estudiar la transición entre extinción radiativa y difusiva, y el papel de la química de baja temperatura en la combustión de alcanos.",
    dataAvailable:
      "Tabla experimental con 9 configuraciones visibles, metadatos, documentos y más de 40 publicaciones asociadas.",
    filesCount: null,
    publications: [
      { citation: "Liu et al. (2014), disponible desde PSI-68.", year: 2014 },
      { citation: "Farouk et al., disponible desde PSI-68.", year: null },
      { citation: "Nayagam et al. (2018), disponible desde PSI-68.", year: 2018 },
    ],
  },
  // ---- Investigaciones complementarias ----
  {
    psiCode: "PSI-62",
    shortName: "Concurrent Flame Spread Modeling",
    name: "Concurrent Flame Spread Modeling using Flamelet Generated Manifolds in Microgravity with Comparison to BASS Experiments using Two-Color Tomography",
    category: "COMPLEMENTARIA",
    combustionType: "SOLID_SURFACE",
    platform: "Modelado numérico (referencia: datos de BASS / BASS-II)",
    period: "",
    investigator: "",
    doi: "",
    psiUrl: `${PSI_BASE}/PSI-62`,
    description:
      "Utiliza datos de BASS y BASS-II como referencia para validar modelos de propagación de llama y reconstrucciones 3D de hollín y temperatura. Es complementario porque conecta experimento y simulación.",
    objectives:
      "Validar modelos de propagación de llama concurrente en microgravedad mediante Flamelet Generated Manifolds, comparándolos con los experimentos BASS usando tomografía de dos colores.",
    methodology:
      "Modelado numérico de propagación de llama concurrente con comparación contra datos experimentales de BASS/BASS-II mediante tomografía de dos colores.",
    fuel: "Datos experimentales de BASS / BASS-II (tejidos, PMMA)",
    oxygen: "No aplicable (estudio de modelado)",
    pressure: "No aplicable (estudio de modelado)",
    temperature: "No aplicable (estudio de modelado)",
    flow: "No aplicable (estudio de modelado)",
    results:
      "Valida modelos de propagación de llama y reconstrucciones 3D de hollín y temperatura contra datos experimentales de BASS/BASS-II.",
    conclusions:
      "Es complementario porque conecta el experimento y la simulación: los datos experimentales sirven como referencia para validar los modelos.",
    dataAvailable: "Modelos y comparaciones con datos de BASS / BASS-II en el repositorio PSI.",
    filesCount: null,
    publications: [],
  },
  {
    psiCode: "PSI-115",
    shortName: "SAME Data Modeling",
    name: "Utilization of the Smoke Aerosol Measurement Experiment Data for Advanced Modeling and Simulation of Smoke Generation in Micro-Gravity",
    category: "COMPLEMENTARIA",
    combustionType: "AEROSOL",
    platform: "Modelado numérico (referencia: geometría de SAME)",
    period: "",
    investigator: "",
    doi: "",
    psiUrl: `${PSI_BASE}/PSI-115`,
    description:
      "Modela numéricamente la formación y crecimiento de partículas de DBP en gravedad normal y microgravedad, usando la geometría de SAME.",
    objectives:
      "Modelar y simular de forma avanzada la generación de humo en microgravedad aprovechando los datos del experimento SAME.",
    methodology:
      "Simulación numérica de la formación y crecimiento de partículas de DBP en gravedad normal y microgravedad, empleando la geometría del experimento SAME.",
    fuel: "Partículas de DBP (referencia: SAME)",
    oxygen: "No aplicable (estudio de modelado)",
    pressure: "No aplicable (estudio de modelado)",
    temperature: "No aplicable (estudio de modelado)",
    flow: "No aplicable (estudio de modelado)",
    results:
      "Explica los mecanismos fluidodinámicos detrás de la formación y el crecimiento de partículas de DBP observados en SAME/SAME-R.",
    conclusions:
      "Es complementario porque explica los mecanismos fluidodinámicos detrás de SAME/SAME-R.",
    dataAvailable: "Modelos y simulaciones basados en los datos de SAME en el repositorio PSI.",
    filesCount: null,
    publications: [],
  },
  {
    psiCode: "PSI-10",
    shortName: "ACME / Flame Design",
    name: "Advanced Combustion via Microgravity Experiments / Flame Design (ACME/Flame Design)",
    category: "COMPLEMENTARIA",
    combustionType: "GASEOUS",
    platform: "ISS",
    period: "",
    investigator: "",
    doi: "",
    psiUrl: `${PSI_BASE}/PSI-10`,
    description:
      "Investigación de combustión de gases, útil como referencia complementaria para entender llamas de difusión y diseño de combustión en microgravedad.",
    objectives:
      "Estudiar llamas de difusión de combustibles gaseosos y el diseño de combustión limpia en microgravedad.",
    methodology: "Experimentos de combustión gaseosa en microgravedad (ACME).",
    fuel: "Combustibles gaseosos",
    oxygen: "Variable",
    pressure: "No expuesto en tabla PSI",
    temperature: "No expuesto en tabla PSI",
    flow: "No expuesto en tabla PSI",
    results:
      "Datos de llamas de difusión gaseosas en microgravedad aplicables al diseño de sistemas de combustión.",
    conclusions:
      "Referencia complementaria para entender llamas de difusión y diseño de combustión en microgravedad; no sustituye a BASS/SAFFIRE/FLEX.",
    dataAvailable: "Metadatos, datos y publicaciones en el repositorio PSI.",
    filesCount: null,
    publications: [],
  },
  {
    psiCode: "PSI-159",
    shortName: "ACME CFI-G",
    name: "Advanced Combustion via Microgravity Experiments / Cool Flames Investigation with Gases (ACME CFI-G)",
    category: "COMPLEMENTARIA",
    combustionType: "GASEOUS",
    platform: "ISS",
    period: "",
    investigator: "",
    doi: "",
    psiUrl: `${PSI_BASE}/PSI-159`,
    description:
      "Investigación de llamas frías con combustibles gaseosos del proyecto ACME a bordo de la ISS: llamas normales e inversas (etano, propano, butano y mezclas diluidas con nitrógeno) sobre un quemador, con barridos de presión, fracción de oxígeno y caudal de combustible.",
    objectives:
      "Caracterizar la ignición, estabilidad, tiempo de combustión y extinción de llamas frías y calientes con combustibles gaseosos (etano, propano, butano y mezclas) en microgravedad.",
    methodology:
      "Matriz de pruebas con quemador de gas en el módulo ACME: cada test varía presión, X_O2 y caudal de combustible; registros experimentales en el repositorio PSI.",
    fuel: "Etano, propano, butano y mezclas diluidas (30–50 %)",
    oxygen: "Variable (X_O2)",
    pressure: "Variable (≈ 0.5–3.3 bar)",
    temperature: "No expuesto en tabla PSI",
    flow: "Caudal de combustible variable (mg/s)",
    results:
      "Registra ignición (sí/no/flash), tiempo de combustión, extinción y temperatura pico del quemador para cientos de pruebas.",
    conclusions:
      "Complementa FLEX con combustión gaseosa y llamas frías de gases; alimenta modelos de extinción y de llamas frías.",
    dataAvailable: "Metadatos, tablas experimentales y datos en el repositorio PSI (Versión 1).",
    filesCount: null,
    publications: [],
  },
];

// ---------------------------------------------------------------------------
// Fusión con el proyecto Flask: CSVs de combustibles, variables y mediciones
// ---------------------------------------------------------------------------

/** Parser CSV mínimo con soporte de campos entrecomillados. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function readCsv(name: string): Record<string, string>[] {
  const raw = readFileSync(join(DATA_DIR, name), "utf-8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

function num(v: string | undefined): number | null {
  if (v === undefined || v === null || v.trim() === "") return null;
  const x = parseFloat(v.replace(",", "."));
  return Number.isNaN(x) ? null : x;
}

async function main() {
  console.log("Limpiando base de datos...");
  await db.queryLog.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
  await db.dataSeries.deleteMany();
  await db.dataset.deleteMany();
  await db.measurement.deleteMany();
  await db.variable.deleteMany();
  await db.publication.deleteMany();
  await db.investigation.deleteMany();
  await db.fuel.deleteMany();

  // Experimentos del CSV (fechas aproximadas y combustibles por experimento)
  const exps = readCsv("psi_experiments.csv");

  console.log("Insertando investigaciones...");
  for (const inv of investigations) {
    const { publications, ...data } = inv;
    const exp = exps.find((e) => e.nombre === inv.shortName);
    const created = await db.investigation.create({
      data: {
        ...data,
        startDate: exp?.fecha_inicio ? new Date(exp.fecha_inicio) : null,
        endDate: exp?.fecha_fin ? new Date(exp.fecha_fin) : null,
      },
    });
    for (const pub of publications) {
      await db.publication.create({
        data: { ...pub, investigationId: created.id },
      });
    }
    console.log(`  ✓ ${inv.psiCode} — ${inv.shortName} (${publications.length} publicaciones)`);
  }

  // Combustibles (catálogo) + relación N:M con investigaciones
  console.log("Insertando combustibles...");
  const fuelMap = new Map<string, number>();
  for (const f of readCsv("psi_fuels.csv")) {
    const created = await db.fuel.create({
      data: { name: f.nombre, type: f.tipo, description: f.descripcion },
    });
    fuelMap.set(f.nombre, created.id);
  }
  for (const exp of exps) {
    const inv = await db.investigation.findFirst({ where: { shortName: exp.nombre } });
    if (!inv) continue;
    for (const fname of exp.combustibles
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)) {
      const fid = fuelMap.get(fname);
      if (fid) {
        await db.investigation.update({
          where: { id: inv.id },
          data: { fuels: { connect: { id: fid } } },
        });
      }
    }
  }

  // Variables por experimento (catálogo de telemetría)
  console.log("Insertando variables...");
  let varCount = 0;
  for (const v of readCsv("psi_variables.csv")) {
    const inv = await db.investigation.findFirst({ where: { shortName: v.experimento } });
    if (!inv) {
      console.warn(`  ! variable sin experimento: ${v.experimento}`);
      continue;
    }
    await db.variable.create({
      data: {
        investigationId: inv.id,
        name: v.nombre,
        unit: v.unidad,
        dataType: v.tipo_dato,
        description: v.descripcion,
      },
    });
    varCount++;
  }

  // Mediciones (datos de demostración con la estructura de la documentación)
  console.log("Insertando mediciones...");
  let measCount = 0;
  for (const m of readCsv("psi_results.csv")) {
    const inv = await db.investigation.findFirst({ where: { shortName: m.experimento } });
    if (!inv) continue;
    await db.measurement.create({
      data: {
        investigationId: inv.id,
        fuel: m.combustible || "",
        date: m.fecha ? new Date(m.fecha) : null,
        o2Initial: num(m.o2_inicial),
        o2Final: num(m.o2_final),
        co2: num(m.co2),
        co: num(m.co),
        pressure: num(m.presion),
        temperature: num(m.temperatura),
        flow: num(m.velocidad_flujo),
        radiation: num(m.radiacion),
        propagationSpeed: num(m.velocidad_propagacion),
        frames: m.fotogramas ? parseInt(m.fotogramas, 10) : null,
        result: m.resultado || "",
        source: "DEMO",
      },
    });
    measCount++;
  }

  // ------------------------------------------------------------------
  // PSI-117 — datos analizados reales (series de publicaciones)
  // ------------------------------------------------------------------
  console.log("Insertando PSI-117 (datos analizados)...");
  const analyzed = JSON.parse(
    readFileSync(join(DATA_DIR, "psi117_analyzed.json"), "utf-8")
  ) as {
    investigation: {
      psiCode: string;
      shortName: string;
      name: string;
      category: string;
      combustionType: string;
      platform: string;
      period: string;
      investigator: string;
      doi: string;
      psiUrl: string;
      description: string;
      objectives: string;
      methodology: string;
      fuel: string;
      oxygen: string;
      pressure: string;
      temperature: string;
      flow: string;
      results: string;
      conclusions: string;
      dataAvailable: string;
      filesCount: number | null;
      publications: { citation: string; year: number | null; url: string }[];
    };
    fuels: { name: string; type: string; description: string }[];
    variables: { name: string; unit: string; description: string }[];
    measurements: {
      fuel: string;
      o2Initial: number | null;
      pressure: number | null;
      result: string;
    }[];
    datasets: {
      key: string;
      nameEs: string;
      nameEn: string;
      tag: string;
      fuel: string;
      condition: string;
      doi: string;
      reference: string;
      sort: number;
      series: {
        metric: string;
        xKind: string;
        xUnit: string;
        yUnit: string;
        label: string;
        source: string;
        sort: number;
        points: number[][];
      }[];
    }[];
  };

  const {
    publications: pubs117,
    filesCount: files117,
    ...invData117
  } = analyzed.investigation;
  const inv117 = await db.investigation.create({
    data: {
      ...invData117,
      filesCount: files117 ?? null,
      startDate: new Date("2017-02-15"),
      endDate: new Date("2022-02-14"),
    },
  });
  for (const pub of pubs117) {
    await db.publication.create({ data: { ...pub, investigationId: inv117.id } });
  }

  // Combustibles de PSI-117 (n-alcanos) + relación N:M (upsert por nombre)
  for (const f of analyzed.fuels) {
    const existing = await db.fuel.findUnique({ where: { name: f.name } });
    const fuel =
      existing ??
      (await db.fuel.create({
        data: { name: f.name, type: f.type, description: f.description },
      }));
    await db.investigation.update({
      where: { id: inv117.id },
      data: { fuels: { connect: { id: fuel.id } } },
    });
  }

  // Catálogo de variables de telemetría de PSI-117
  let var117 = 0;
  for (const v of analyzed.variables) {
    await db.variable.create({
      data: {
        investigationId: inv117.id,
        name: v.name,
        unit: v.unit,
        dataType: "float",
        description: v.description,
      },
    });
    var117++;
  }

  // Mediciones resumen (condiciones experimentales reales de cada conjunto)
  let meas117 = 0;
  for (const m of analyzed.measurements) {
    await db.measurement.create({
      data: {
        investigationId: inv117.id,
        fuel: m.fuel,
        o2Initial: m.o2Initial,
        pressure: m.pressure,
        result: m.result,
        source: "PSI",
      },
    });
    meas117++;
  }

  // Conjuntos de datos y series (puntos embebidos como JSON)
  let seriesCount = 0;
  for (const ds of analyzed.datasets) {
    const created = await db.dataset.create({
      data: {
        investigationId: inv117.id,
        key: ds.key,
        nameEs: ds.nameEs,
        nameEn: ds.nameEn,
        tag: ds.tag,
        fuel: ds.fuel,
        condition: ds.condition,
        doi: ds.doi,
        reference: ds.reference,
        sort: ds.sort,
      },
    });
    for (const s of ds.series) {
      await db.dataSeries.create({
        data: {
          datasetId: created.id,
          metric: s.metric,
          xKind: s.xKind,
          xUnit: s.xUnit,
          yUnit: s.yUnit,
          label: s.label,
          source: s.source,
          sort: s.sort,
          pointsJson: JSON.stringify(s.points),
        },
      });
      seriesCount++;
    }
  }
  const pointCount = analyzed.datasets.reduce(
    (acc, d) => acc + d.series.reduce((a, s) => a + s.points.length, 0),
    0
  );
  console.log(
    `  ✓ PSI-117 — ${analyzed.datasets.length} conjuntos, ${seriesCount} series (${pointCount} puntos), ${pubs117.length} publicaciones`
  );

  // Conjuntos de datos del PSI-159 (ACME CFI-G): tablas experimentales reales
  // (Inverse + Normal Flames), generadas con el mismo parser de importación
  // (scripts/make-psi159-seed.js) para que un db:seed los restaure intactos.
  try {
    const cfi = JSON.parse(
      readFileSync(join(DATA_DIR, "psi159_cfig.json"), "utf-8")
    ) as { datasets: typeof analyzed.datasets };
    const inv159 = await db.investigation.findUnique({ where: { psiCode: "PSI-159" } });
    if (inv159) {
      let s159 = 0;
      let p159 = 0;
      for (const ds of cfi.datasets) {
        const created = await db.dataset.create({
          data: {
            investigationId: inv159.id,
            key: ds.key,
            nameEs: ds.nameEs,
            nameEn: ds.nameEn,
            tag: ds.tag,
            fuel: ds.fuel,
            condition: ds.condition,
            doi: ds.doi,
            reference: ds.reference,
            sort: ds.sort,
          },
        });
        for (const s of ds.series) {
          await db.dataSeries.create({
            data: {
              datasetId: created.id,
              metric: s.metric,
              xKind: s.xKind,
              xUnit: s.xUnit,
              yUnit: s.yUnit,
              label: s.label,
              source: s.source,
              sort: s.sort,
              pointsJson: JSON.stringify(s.points),
            },
          });
          s159++;
          p159 += s.points.length;
        }
      }
      console.log(`  ✓ PSI-159 (ACME CFI-G) — ${cfi.datasets.length} conjuntos, ${s159} series (${p159} puntos)`);
    }
  } catch (e) {
    console.warn("  ⚠ PSI-159 CFI-G: no se pudo cargar psi159_cfig.json:", String(e));
  }

  // Usuario de demostración (scrypt: salt:hash)
  console.log("Creando usuario de demostración...");
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync("Demo2026!", salt, 64).toString("hex");
  await db.user.create({
    data: {
      name: "Usuario Demo",
      email: "demo@sices.dev",
      passwordHash: `${salt}:${hash}`,
      role: "ADMIN",
    },
  });

  const total = await db.investigation.count();
  const pubs = await db.publication.count();
  const fuels = await db.fuel.count();
  const datasetsN = await db.dataset.count();
  console.log(
    `Listo: ${total} investigaciones, ${pubs} publicaciones, ${fuels} combustibles, ${varCount + var117} variables, ${measCount + meas117} mediciones, ${datasetsN} conjuntos de datos analizados.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
