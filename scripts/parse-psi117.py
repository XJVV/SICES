#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Parser de los datos analizados de PSI-117 (NASA PSI) → JSON para el seed.

Convierte los 9 CSV de "PSI-117_Analyzed Data_*" (tablas yuxtapuestas
exportadas de Excel) en conjuntos de datos con series (x, y) listas para
cargar en la base de datos del SICES.

Salida: prisma/data/psi117_analyzed.json
"""
import csv
import json
import os

UPLOAD = "/home/z/my-project/upload"
OUT = "/home/z/my-project/prisma/data/psi117_analyzed.json"

DOI_PROCI_2019 = "10.1016/j.proci.2018.05.151"
DOI_PROCI_2019_3S = "10.1016/j.proci.2018.09.015"
DOI_PROCI_2023 = "10.1016/j.proci.2022.07.094"
DOI_MST_2024 = "10.1007/s12217-024-10115-x"


def load(fname):
    path = os.path.join(UPLOAD, fname)
    with open(path, newline="", encoding="utf-8-sig") as f:
        return [row for row in csv.reader(f)]


def num(v):
    if v is None:
        return None
    s = v.strip()
    if s == "":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def rnd(v):
    """6 cifras significativas para mantener el JSON compacto."""
    if v is None:
        return None
    if v == 0:
        return 0
    return float(f"{v:.6g}")


def pairs(rows, xc, yc, start=1):
    """Extrae pares numéricos (x, y) de dos columnas, ignorando celdas no numéricas."""
    out = []
    for r in rows[start:]:
        if len(r) <= max(xc, yc):
            continue
        x, y = num(r[xc]), num(r[yc])
        if x is None or y is None:
            continue
        out.append([rnd(x), rnd(y)])
    return out


def series(metric, x_kind, x_unit, y_unit, label, source, sort, points):
    assert points, f"serie vacía: {metric} / {label}"
    return {
        "metric": metric,
        "xKind": x_kind,
        "xUnit": x_unit,
        "yUnit": y_unit,
        "label": label,
        "source": source,
        "sort": sort,
        "points": points,
    }


T_S = ("time_s", "s")
T_N = ("time_norm", "s/mm²")
P_ATM = ("pressure_atm", "atm")
D_MM = ("diameter_mm", "mm")

datasets = []


def dataset(key, name_es, name_en, tag, fuel, condition, doi, reference, sort, series_list):
    datasets.append(
        {
            "key": key,
            "nameEs": name_es,
            "nameEn": name_en,
            "tag": tag,
            "fuel": fuel,
            "condition": condition,
            "doi": doi,
            "reference": reference,
            "sort": sort,
            "series": series_list,
        }
    )


# ------------------------------------------------------------------
# 1-2) PROCI 2019 — llama fría estable y oscilatoria (n-heptano, sim.)
# ------------------------------------------------------------------
def proci2019(fname, name_es, name_en, tag, condition, key, sort):
    rows = load(fname)
    sims = [
        ("diameter", "mm", 1, "Simulación"),
        ("k", "mm²/s", 2, "Simulación"),
        ("tmax", "K", 3, "Simulación"),
        ("d_tmax", "-", 4, "Simulación"),
        ("d_ohm", "-", 5, "Simulación"),
        ("d2_norm_t", "-", 6, "Simulación"),
    ]
    ss = [
        series(m, T_S[0], T_S[1], unit, label, "SIMULATION", i + 1, pairs(rows, 0, col))
        for i, (m, unit, col, label) in enumerate(sims)
    ]
    dataset(
        key,
        name_es,
        name_en,
        tag,
        "n-heptano",
        condition,
        DOI_PROCI_2019,
        "Proc. Combust. Inst. 37 (2019) · Fig. 1",
        sort,
        ss,
    )


proci2019(
    "PSI-117_Analyzed Data_PROCI_2019_Stable_Cool.csv",
    "Llama fría estable — n-heptano submilimétrico (21% O₂)",
    "Stable cool flame — submillimeter n-heptane (21% O₂)",
    "PROCI 2019 · estable",
    "d₀ = 0.5 mm · 1 atm · X_O₂ 21% · X_N₂ 74% · X_O₃ 5%",
    "proci2019_stable_cool",
    1,
)
proci2019(
    "PSI-117_Analyzed Data_PROCI_2019_Oscillatory_Cool_Flame.csv",
    "Llama fría oscilatoria — n-heptano submilimétrico (10% O₂)",
    "Oscillatory cool flame — submillimeter n-heptane (10% O₂)",
    "PROCI 2019 · oscilante",
    "d₀ = 0.5 mm · 1 atm · X_O₂ 10% · X_N₂ 85% · X_O₃ 5%",
    "proci2019_oscillatory",
    2,
)

# ------------------------------------------------------------------
# 3) PROCI 2019 — combustión en tres etapas (n-dodecano + He)
# ------------------------------------------------------------------
rows = load("PSI-117_Analyzed Data_PROCI_C12_2019_Three_Stage.csv")
ss = [
    series("d2_norm", T_N[0], T_N[1], "-", "EXP", "EXPERIMENT", 1, pairs(rows, 1, 2)),
    series("d2_norm", T_N[0], T_N[1], "-", "Simulación", "SIMULATION", 2, pairs(rows, 35, 36)),
    series("dflame_ratio", T_N[0], T_N[1], "-", "EXP", "EXPERIMENT", 3, pairs(rows, 5, 6)),
    series("dflame_tnorm", T_N[0], T_N[1], "mm", "EXP", "EXPERIMENT", 4, pairs(rows, 8, 9)),
    series("dflame_tnorm", T_N[0], T_N[1], "mm", "Simulación", "SIMULATION", 5, pairs(rows, 35, 37)),
    series("radiance_tnorm", T_N[0], T_N[1], "W", "EXP · medición I", "EXPERIMENT", 6, pairs(rows, 12, 13)),
    series("radiance_tnorm", T_N[0], T_N[1], "W", "EXP · medición II", "EXPERIMENT", 7, pairs(rows, 16, 17)),
    series("radiance_tnorm", T_N[0], T_N[1], "W", "Simulación", "SIMULATION", 8, pairs(rows, 39, 40)),
    series("coolflame_dia", T_N[0], T_N[1], "mm", "EXP · HWFM", "EXPERIMENT", 9, pairs(rows, 20, 21)),
    series("coolflame_dia", T_N[0], T_N[1], "mm", "EXP · pico-pico", "EXPERIMENT", 10, pairs(rows, 23, 24)),
    series("diameter", T_S[0], T_S[1], "mm", "Simulación", "SIMULATION", 11, pairs(rows, 28, 29)),
    series("k", T_S[0], T_S[1], "mm²/s", "Simulación", "SIMULATION", 12, pairs(rows, 28, 30)),
    series("tmax", T_S[0], T_S[1], "K", "Simulación", "SIMULATION", 13, pairs(rows, 28, 31)),
    series("d_tmax", T_S[0], T_S[1], "-", "Simulación", "SIMULATION", 14, pairs(rows, 28, 32)),
    series("d_ohm", T_S[0], T_S[1], "-", "Simulación", "SIMULATION", 15, pairs(rows, 28, 33)),
]
dataset(
    "proci2019_three_stage",
    "Combustión en tres etapas — n-dodecano con sustitución de helio",
    "Three-stage burning — n-dodecane with helium substitution",
    "PROCI 2019 · 3 etapas",
    "n-dodecano",
    "d₀ = 4.5 mm · 2.75 atm · X_O₂ 21% · X_N₂ 50% · X_He 29%",
    DOI_PROCI_2019_3S,
    "Proc. Combust. Inst. 37(3) (2019) 3353–3361 · Fig. 7",
    3,
    ss,
)

# ------------------------------------------------------------------
# 4) PROCI 2023 — diámetros de extinción de alcanos a 1 atm
# ------------------------------------------------------------------
rows = load("PSI-117_Analyzed Data_PROCI_2023_Alkane_Extinction_Diameter_1atm.csv")
blocks = [
    ("C7", "EXPERIMENT", 1, 2, 3),
    ("C7", "SIMULATION", 6, 7, 8),
    ("C10", "EXPERIMENT", 11, 12, 13),
    ("C10", "SIMULATION", 16, 17, 18),
    ("C12", "EXPERIMENT", 21, 22, 23),
    ("C12", "SIMULATION", 26, 27, 28),
]
ss = []
for i, (fuel, src, do_c, hf_c, cf_c) in enumerate(blocks):
    suffix = "EXP" if src == "EXPERIMENT" else "Sim"
    ss.append(
        series("dext_hf_do", D_MM[0], D_MM[1], "mm", f"{fuel} · {suffix}", src, i + 1, pairs(rows, do_c, hf_c))
    )
    ss.append(
        series("dext_cf_do", D_MM[0], D_MM[1], "mm", f"{fuel} · {suffix}", src, i + 7, pairs(rows, do_c, cf_c))
    )
dataset(
    "proci2023_alkanes_1atm",
    "Diámetros de extinción de n-alcanos a 1 atm (experimento y simulación)",
    "n-Alkane extinction diameters at 1 atm (experiment and simulation)",
    "PROCI 2023 · D_ext vs D₀",
    "n-heptano · n-decano · n-dodecano",
    "1 atm · aire (X_O₂ 21%) · D₀ = 2–7 mm",
    DOI_PROCI_2023,
    "Proc. Combust. Inst. 39 (2023) · Fig. 3",
    4,
    ss,
)

# ------------------------------------------------------------------
# 5) PROCI 2023 — extinción de n-dodecano frente a presión (+ barras error)
# ------------------------------------------------------------------
rows = load("PSI-117_Analyzed Data_PROCI_2023_C12_Extinction_Diameter_vs_pressure.csv")
hi_map = {x: y for x, y in pairs(rows, 12, 13)}
lo_map = {x: y for x, y in pairs(rows, 15, 16)}


def pairs_with_err(rows_, xc, yc):
    out = []
    for r in rows_[1:]:
        if len(r) <= max(xc, yc):
            continue
        x, y = num(r[xc]), num(r[yc])
        if x is None or y is None:
            continue
        x = rnd(x)
        hi, lo = hi_map.get(x), lo_map.get(x)
        if hi is not None and lo is not None and (hi > y or lo < y):
            out.append([x, rnd(y), rnd(hi), rnd(lo)])
        else:
            out.append([x, rnd(y)])
    return out


ss = [
    series("dext_hf_p", P_ATM[0], P_ATM[1], "mm", "EXP", "EXPERIMENT", 1, pairs(rows, 0, 1)),
    series("dext_hf_p", P_ATM[0], P_ATM[1], "mm", "Modelo", "MODEL", 2, pairs(rows, 3, 4)),
    series("dext_cf_p", P_ATM[0], P_ATM[1], "mm", "EXP", "EXPERIMENT", 3, pairs_with_err(rows, 6, 7)),
    series("dext_cf_p", P_ATM[0], P_ATM[1], "mm", "Modelo", "MODEL", 4, pairs(rows, 9, 10)),
]
dataset(
    "proci2023_c12_vs_p",
    "Extinción de n-dodecano frente a presión (llama caliente y fría)",
    "n-Dodecane extinction vs pressure (hot and cool flame)",
    "PROCI 2023 · D_ext vs P",
    "n-dodecano",
    "d₀ = 4 mm · 0.5–3 atm · aire (X_O₂ 21%)",
    DOI_PROCI_2023,
    "Proc. Combust. Inst. 39 (2023) · Fig. 7",
    5,
    ss,
)

# ------------------------------------------------------------------
# 6) MST 2024 — historia de combustión y diámetro de llama (n-dodecano)
# ------------------------------------------------------------------
rows = load("PSI-117_Analyzed Data_MST_2024_Burning_history_Flame_diameter.csv")
ss = [
    series("d2", T_S[0], T_S[1], "mm²", "EXP", "EXPERIMENT", 1, pairs(rows, 1, 2)),
    series("d2", T_S[0], T_S[1], "mm²", "Modelo 1 atm", "MODEL", 2, pairs(rows, 13, 14)),
    series("dflame", T_S[0], T_S[1], "mm", "EXP", "EXPERIMENT", 3, pairs(rows, 4, 5)),
    series("dflame", T_S[0], T_S[1], "mm", "Modelo 1 atm", "MODEL", 4, pairs(rows, 13, 15)),
    series("radiance", T_S[0], T_S[1], "W", "EXP · medición A", "EXPERIMENT", 5, pairs(rows, 7, 8)),
    series("radiance", T_S[0], T_S[1], "W", "EXP · medición B", "EXPERIMENT", 6, pairs(rows, 9, 10)),
    series("radiance", T_S[0], T_S[1], "W", "Modelo", "MODEL", 7, pairs(rows, 18, 19)),
]
dataset(
    "mst2024_burning",
    "Historia de combustión y diámetro de llama — n-dodecano (vuelo ISS)",
    "Burning history and flame diameter — n-dodecane (ISS flight)",
    "MST 2024 · historia d²",
    "n-dodecano",
    "d₀ = 4 mm · 1 atm · aire (X_O₂ 21%)",
    DOI_MST_2024,
    "Microgravity Sci. Technol. 36 (2024) · Fig. 1",
    6,
    ss,
)

# ------------------------------------------------------------------
# 7) MST 2024 — diámetros de extinción frente a presión
# ------------------------------------------------------------------
rows = load("PSI-117_Analyzed Data_MST_2024_Dext.csv")
ss = [
    series("dext_cf_p", P_ATM[0], P_ATM[1], "mm", "Modelo", "MODEL", 1, pairs(rows, 1, 2)),
    series("dext_cf_p", P_ATM[0], P_ATM[1], "mm", "EXP", "EXPERIMENT", 2, pairs(rows, 6, 7)),
    series("dext_hf_p", P_ATM[0], P_ATM[1], "mm", "Modelo", "MODEL", 3, pairs(rows, 1, 3)),
]
dataset(
    "mst2024_dext",
    "Diámetros de extinción frente a presión (vuelo y modelo)",
    "Extinction diameters vs pressure (flight and model)",
    "MST 2024 · D_ext vs P",
    "n-dodecano",
    "d₀ ≈ 4 mm · 0.5–3 atm · aire (X_O₂ 21%)",
    DOI_MST_2024,
    "Microgravity Sci. Technol. 36 (2024) · Fig. 5",
    7,
    ss,
)

# ------------------------------------------------------------------
# 8) MST 2024 — K promedio de llama fría frente a presión
# ------------------------------------------------------------------
rows = load("PSI-117_Analyzed Data_MST_2024_Kavg.csv")
ss = [
    series("kavg_p", P_ATM[0], P_ATM[1], "mm²/s", "EXP · K_prom", "EXPERIMENT", 1, pairs(rows, 1, 2)),
    series("kavg_p", P_ATM[0], P_ATM[1], "mm²/s", "Modelo · k_b", "MODEL", 2, pairs(rows, 5, 6)),
]
dataset(
    "mst2024_kavg",
    "Tasa de combustión promedio de llama fría frente a presión",
    "Average cool-flame burning rate vs pressure",
    "MST 2024 · K promedio",
    "n-dodecano",
    "d₀ ≈ 4.5 mm · 0.5–5 atm · aire (X_O₂ 21%)",
    DOI_MST_2024,
    "Microgravity Sci. Technol. 36 (2024) · Fig. 4",
    8,
    ss,
)

# ------------------------------------------------------------------
# 9) MST 2024 — radiancia y diámetro de llama a 0.5 y 5 atm
# ------------------------------------------------------------------
rows = load("PSI-117_Analyzed Data_MST_2024_Radiance_Flame_Diameter.csv")
ss = [
    series("radiance", T_S[0], T_S[1], "W", "EXP · 0.5 atm (d₀ 4.46 mm)", "EXPERIMENT", 1, pairs(rows, 1, 2)),
    series("radiance", T_S[0], T_S[1], "W", "EXP · 5 atm (d₀ 4.48 mm)", "EXPERIMENT", 2, pairs(rows, 8, 9)),
    series("radiance", T_S[0], T_S[1], "W", "Sim · 0.5 atm", "SIMULATION", 3, pairs(rows, 16, 17)),
    series("radiance", T_S[0], T_S[1], "W", "Sim · 5 atm", "SIMULATION", 4, pairs(rows, 20, 21)),
    series("dflame", T_S[0], T_S[1], "mm", "EXP · 0.5 atm (d₀ 4.46 mm)", "EXPERIMENT", 5, pairs(rows, 3, 4)),
    series("dflame", T_S[0], T_S[1], "mm", "EXP · 5 atm (d₀ 4.48 mm)", "EXPERIMENT", 6, pairs(rows, 10, 11)),
    series("dflame", T_S[0], T_S[1], "mm", "Sim · 0.5 atm", "SIMULATION", 7, pairs(rows, 25, 26)),
    series("dflame", T_S[0], T_S[1], "mm", "Sim · 5 atm", "SIMULATION", 8, pairs(rows, 29, 30)),
    series("tmax", T_S[0], T_S[1], "K", "Sim · 0.5 atm", "SIMULATION", 9, pairs(rows, 34, 35)),
    series("tmax", T_S[0], T_S[1], "K", "Sim · 5 atm", "SIMULATION", 10, pairs(rows, 38, 39)),
]
dataset(
    "mst2024_radiance",
    "Radiancia y diámetro de llama a 0.5 y 5 atm (vuelo y simulación)",
    "Radiance and flame diameter at 0.5 and 5 atm (flight and simulation)",
    "MST 2024 · radiancia",
    "n-dodecano",
    "d₀ ≈ 4.5 mm · 0.5 y 5 atm · aire (X_O₂ 21%)",
    DOI_MST_2024,
    "Microgravity Sci. Technol. 36 (2024) · Fig. 11",
    9,
    ss,
)

# ------------------------------------------------------------------
# Metadatos de la investigación PSI-117
# ------------------------------------------------------------------
PSI_BASE = "https://psi.nasa.gov/physci/repo/data/investigations"

payload = {
    "investigation": {
        "psiCode": "PSI-117",
        "shortName": "FLEX Cool Flames",
        "name": "Utilization of FLEX Data to Quantify How Externally Imposed Thermal and Convective Perturbations Affect Droplet Cool Flames",
        "category": "COMPLEMENTARIA",
        "combustionType": "LIQUID_DROPLET",
        "platform": "Investigación en tierra (NASA Glenn) — datos de vuelo del experimento FLEX a bordo de la ISS",
        "period": "Febrero 2017 – Febrero 2022",
        "investigator": "Tanvir Farouk (University of South Carolina)",
        "doi": "10.60555/gz0q-b577",
        "psiUrl": f"{PSI_BASE}/PSI-117",
        "description": "Investigación en tierra basada en los datos de vuelo del experimento FLEX (Flame Extinguishment Experiment) obtenidos del repositorio NASA PSI. Con un modelo CFD multidimensional multifísico (OpenFOAM) de llamas frías de gotas de n-alcano en microgravedad, cuantificó cómo las perturbaciones térmicas y convectivas externas regulan la dinámica y el destino final de llamas frías ya establecidas, y explicó la variabilidad entre corridas aislando los roles del calentamiento deliberado y de la convección inducida por derivas. Combustión de gotas líquidas aisladas de n-heptano, n-decano y n-dodecano en atmósferas de O₂/N₂ con sustitución por helio u ozono.",
        "objectives": "Cuantificar cómo las perturbaciones termo-convectivas externas regulan la dinámica y el destino de las llamas frías de gotas ya establecidas; explicar la variabilidad entre corridas experimentales; mapear las ventanas de estabilidad de ignición, oscilación sostenida, transiciones a ignición caliente y régimen de llama tibia, y extinción en microgravedad; y producir modelos y análisis de sensibilidad reutilizables que acoplen la química de baja temperatura con el transporte y los efectos radiativos.",
        "methodology": "Simulaciones CFD 3-D con OpenFOAM de gotas aisladas de n-alcanos en microgravedad, validadas contra experimentos del FLEX realizados a bordo de la ISS: gotas de n-dodecano de gran tamaño (d₀ ≈ 4–4.5 mm) a 0.5–5 atm, fracciones de O₂ de 10% a 21%, con sustitución de N₂ por He (hasta 29%) y atmósferas asistidas con O₃; además de gotas submilimétricas de n-heptano (d₀ = 0.5 mm) a 1 atm. Los conjuntos de datos analizados incluyen historias de combustión (d² frente a t), diámetros de llama, radiancia, temperaturas máximas de zona de reacción, tasas de combustión y diámetros de extinción de llama caliente y llama fría, tanto de experimentos como de simulaciones.",
        "fuel": "n-heptano, n-decano, n-dodecano",
        "oxygen": "10% – 21% O₂ (dilución variable con N₂, He y O₃)",
        "pressure": "0.5 – 5 atm",
        "temperature": "No expuesta en tabla PSI (extraer de archivos crudos del repositorio)",
        "flow": "Ambiente en reposo (microgravedad)",
        "results": "Los datos analizados documentan: (1) llama fría estable y llama fría oscilatoria en gotas submilimétricas de n-heptano a 1 atm con 21% y 10% de O₂; (2) combustión en tres etapas (llama caliente → llama tibia ≈970 K → llama fría ≈765 K) de n-dodecano a presión elevada con sustitución de N₂ por He, confirmada por experimentos en la ISS; (3) diámetros de extinción de n-alcanos (C7, C10, C12) a 1 atm y frente a presión: el diámetro de extinción de la llama caliente permanece casi constante (≈3.5 mm) mientras el de la llama fría decrece con la presión; y (4) historias de combustión, diámetros de llama, radiancia y K promedio de gotas de n-dodecano a 0.5–5 atm que validan el modelo acoplado cinética-transporte-radiación.",
        "conclusions": "El destino de una llama fría establecida (extinción, oscilación sostenida o transición a ignición caliente) está controlado por el balance entre la química de baja temperatura, las pérdidas difusivas y la radiación. El modelo CFD reproduce las historias de combustión, los diámetros de llama y la radiancia medidas en la ISS, y demuestra que el diámetro de extinción de la llama fría decrece al aumentar la presión mientras que el de la llama caliente permanece casi constante, con acuerdo favorable entre predicciones y observaciones de vuelo.",
        "dataAvailable": "9 conjuntos de datos analizados cargados en la pestaña Análisis: series temporales (d², D, diámetro de llama, radiancia, T_máx, K) y barridos de presión/diámetro (D_ext, K promedio), correspondientes a 4 publicaciones (PROCI 2019 ×2, PROCI 2023, MST 2024). Página PSI con metadatos, documentos y presentaciones.",
        "filesCount": None,
        "publications": [
            {
                "citation": "Alam, F.E., Aghdam, A.C., Dryer, F.L. y Farouk, T.I. — «Oscillatory cool flame combustion behavior of submillimeter sized n-alkane droplet under near limit conditions», Proceedings of the Combustion Institute 37 (2019). https://doi.org/10.1016/j.proci.2018.05.151",
                "year": 2019,
                "url": "https://doi.org/10.1016/j.proci.2018.05.151",
            },
            {
                "citation": "Farouk, T.I., Dietrich, D. y Dryer, F.L. — «Three stage cool flame droplet burning behavior of n-alkane droplets at elevated pressure conditions: Hot, warm and cool flame», Proceedings of the Combustion Institute 37(3) (2019) 3353–3361. https://doi.org/10.1016/j.proci.2018.09.015",
                "year": 2019,
                "url": "https://doi.org/10.1016/j.proci.2018.09.015",
            },
            {
                "citation": "Farouk, T.I. y Dryer, F.L. — «Extinction characteristics of isolated n-alkane fuel droplets during low temperature cool flame burning in air», Proceedings of the Combustion Institute 39 (2023) 2471. https://doi.org/10.1016/j.proci.2022.07.094",
                "year": 2023,
                "url": "https://doi.org/10.1016/j.proci.2022.07.094",
            },
            {
                "citation": "Dietrich, D., Krause, T., Nayagam, V., Farouk, T., Dryer, F. y Williams, F. — «Low Temperature n-Dodecane Droplet Combustion Experiments Aboard the International Space Station», Microgravity Science and Technology 36 (2024), art. 31. https://doi.org/10.1007/s12217-024-10115-x",
                "year": 2024,
                "url": "https://doi.org/10.1007/s12217-024-10115-x",
            },
        ],
    },
    "fuels": [
        {"name": "n-heptano", "type": "líquido", "description": "Hidrocarburo alcano lineal C₇H₁₆; gota submilimétrica en los estudios de llama fría de PSI-117"},
        {"name": "n-decano", "type": "líquido", "description": "Hidrocarburo alcano lineal C₁₀H₂₂; diámetros de extinción a 1 atm (PROCI 2023)"},
        {"name": "n-dodecano", "type": "líquido", "description": "Hidrocarburo alcano lineal C₁₂H₂₆; combustible principal de los experimentos FLEX de llama fría en la ISS"},
    ],
    "variables": [
        {"name": "d2", "unit": "mm²", "description": "Área cuadrática de la gota (d²) en la historia de combustión"},
        {"name": "d2_norm", "unit": "—", "description": "Área normalizada (D/D₀)² frente a tiempo normalizado t/d₀²"},
        {"name": "diameter", "unit": "mm", "description": "Diámetro de la gota D(t)"},
        {"name": "dflame", "unit": "mm", "description": "Diámetro de la llama"},
        {"name": "radiance", "unit": "W", "description": "Radiancia total de la llama"},
        {"name": "tmax", "unit": "K", "description": "Temperatura máxima de la zona de reacción"},
        {"name": "k", "unit": "mm²/s", "description": "Tasa instantánea de combustión (K = −d(d²)/dt)"},
        {"name": "dext_hf", "unit": "mm", "description": "Diámetro de extinción de la llama caliente"},
        {"name": "dext_cf", "unit": "mm", "description": "Diámetro de extinción de la llama fría"},
        {"name": "kavg", "unit": "mm²/s", "description": "Tasa de combustión promedio en régimen de llama fría"},
    ],
    "measurements": [
        {"fuel": "n-heptano", "o2Initial": 0.21, "pressure": 1.0, "result": "Llama fría estable (simulación, d₀ 0.5 mm, O₃ 5%) — PROCI 2019 Fig. 1 · ver series en Análisis"},
        {"fuel": "n-heptano", "o2Initial": 0.10, "pressure": 1.0, "result": "Llama fría oscilatoria (simulación, d₀ 0.5 mm, O₃ 5%) — PROCI 2019 Fig. 1 · ver series en Análisis"},
        {"fuel": "n-dodecano", "o2Initial": 0.21, "pressure": 2.75, "result": "Combustión en 3 etapas (caliente→tibia→fría) con 29% He — PROCI 2019 Fig. 7 · ver series en Análisis"},
        {"fuel": "n-heptano", "o2Initial": 0.21, "pressure": 1.0, "result": "D_ext (llama caliente y fría) frente a D₀, C7 — PROCI 2023 Fig. 3 · ver series en Análisis"},
        {"fuel": "n-decano", "o2Initial": 0.21, "pressure": 1.0, "result": "D_ext (llama caliente y fría) frente a D₀, C10 — PROCI 2023 Fig. 3 · ver series en Análisis"},
        {"fuel": "n-dodecano", "o2Initial": 0.21, "pressure": 1.0, "result": "D_ext (llama caliente y fría) frente a D₀, C12 — PROCI 2023 Fig. 3 · ver series en Análisis"},
        {"fuel": "n-dodecano", "o2Initial": 0.21, "pressure": 3.0, "result": "D_ext frente a presión 0.5–3 atm (llama caliente ≈3.5 mm constante; fría decreciente) — PROCI 2023 Fig. 7 · ver series en Análisis"},
        {"fuel": "n-dodecano", "o2Initial": 0.21, "pressure": 1.0, "result": "Historia de combustión d² y diámetro de llama (d₀ 4 mm, vuelo ISS) — MST 2024 Fig. 1 · ver series en Análisis"},
        {"fuel": "n-dodecano", "o2Initial": 0.21, "pressure": 1.5, "result": "D_ext de llama fría frente a presión (vuelo y modelo) — MST 2024 Fig. 5 · ver series en Análisis"},
        {"fuel": "n-dodecano", "o2Initial": 0.21, "pressure": 5.0, "result": "K promedio de llama fría frente a presión (0.5–5 atm) — MST 2024 Fig. 4 · ver series en Análisis"},
        {"fuel": "n-dodecano", "o2Initial": 0.21, "pressure": 0.5, "result": "Radiancia y diámetro de llama a 0.5 atm (d₀ 4.46 mm) — MST 2024 Fig. 11 · ver series en Análisis"},
        {"fuel": "n-dodecano", "o2Initial": 0.21, "pressure": 5.0, "result": "Radiancia y diámetro de llama a 5 atm (d₀ 4.48 mm) — MST 2024 Fig. 11 · ver series en Análisis"},
    ],
    "datasets": datasets,
}

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False)

# Resumen
total_points = sum(len(s["points"]) for d in datasets for s in d["series"])
print(f"OK -> {OUT}")
print(f"Datasets: {len(datasets)} | Series: {sum(len(d['series']) for d in datasets)} | Puntos: {total_points}")
for d in datasets:
    print(f"  [{d['sort']}] {d['key']}: {len(d['series'])} series, {sum(len(s['points']) for s in d['series'])} pts")
    for s in d["series"]:
        extra = " (+err)" if any(len(p) == 4 for p in s["points"]) else ""
        print(f"      - {s['metric']:<15} {s['label']:<28} {s['source']:<11} {len(s['points']):>4} pts{extra}")
