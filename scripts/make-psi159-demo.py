#!/usr/bin/env python3
"""Genera un CSV de ejemplo PSI-159 con el formato real «Analyzed Data»
de NASA PSI: bloques lado a lado separados por columnas vacías, columnas
de etiquetas (EXP/Model/Sim), modelo y barras de error. Demuestra el
importador de SICES. Los datos son sintéticos (demo)."""
import math

# ---------- datos sintéticos ----------
d0 = 4.2
rows = 90
exp_t, exp_d2, exp_df = [], [], []
for i in range(rows):
    t = round(0.05 * i, 3)
    v = d0**2 - 0.42 * t
    if v <= 0.05:
        break
    exp_t.append(t)
    exp_d2.append(round(v, 3))
    base = 4.2 + 1.1 * (1 - math.exp(-t / 0.8)) - 0.25 * t
    exp_df.append(round(max(base, 0.2), 3))

mod_t = [round(0.04 * i, 4) for i in range(200)]
mod_d2 = [round(max(d0**2 - 0.39 * t, 0.0), 3) for t in mod_t]
mod_df = [round(4.2 + 1.0 * (1 - math.exp(-t / 0.7)) - 0.22 * t, 3) for t in mod_t]

pressures = [0.5, 0.75, 1.0, 1.25, 1.5]
dext_hf_expt = [3.52, 3.58, 3.61, 3.65, 3.70]
dext_cf_expt = [1.92, 0.95, 0.52, 0.35, 0.18]
dext_cf_errp = [2.30, 1.25, 0.78, 0.55, 0.38]
dext_cf_errm = [1.55, 0.66, 0.31, 0.18, 0.05]
dext_hf_model = [3.44, 3.52, 3.60, 3.68, 3.75]

sim_t = [round(0.5 * i, 3) for i in range(120)]
sim_D = [round(4.2 * math.sqrt(max(1 - 0.0009 * t, 0.0)), 4) for t in sim_t]
sim_K = [round(-0.0009 + 0.00002 * t, 6) for t in sim_t]
sim_T = [round(1450 * math.exp(-t / 40) + 950, 2) for t in sim_t]

# ---------- disposición de columnas (33 columnas) ----------
N = 33
header = [""] * N
header[1] = "t"
header[2] = "d^2 (mm^2)"
header[4] = "t"
header[5] = "dflame (mm)"
header[7] = "Model"
header[8] = "t"
header[9] = "d^2 (mm^2)"
header[10] = "dflame (mm)"
header[12] = "P (atm)"
header[13] = "Dext_HF_EXPT"
header[15] = "P (atm)"
header[16] = "Dext_CF_EXPT"
header[18] = "P (atm)"
header[19] = "Dext_CF_ErrorBar+"
header[21] = "P (atm)"
header[22] = "Dext_CF_ErrorBar-"
header[24] = "Model"
header[25] = "Pressure"
header[26] = "Dext_HF"
header[28] = "Simulations"
header[29] = "t (s)"
header[30] = "D (mm)"
header[31] = "K(mm^2/sec)"
header[32] = "T_max(K)"

n_rows = max(len(exp_t), len(mod_t), len(sim_t), len(pressures))
lines = [",".join(header)]
for i in range(n_rows):
    row = [""] * N
    # etiquetas de condición en las primeras filas
    if i == 0:
        row[0] = "EXP"
        row[7] = "1 atm"
        row[24] = "Model"
    elif i == 1:
        row[0] = "do 4.2 mm"
        row[7] = "do 4.2 mm"

    def put(col, vals, j):
        if j < len(vals):
            row[col] = str(vals[j])

    put(1, exp_t, i); put(2, exp_d2, i)
    put(4, exp_t, i); put(5, exp_df, i)
    put(8, mod_t, i); put(9, mod_d2, i); put(10, mod_df, i)
    put(12, pressures, i); put(13, dext_hf_expt, i)
    put(15, pressures, i); put(16, dext_cf_expt, i)
    put(18, pressures, i); put(19, dext_cf_errp, i)
    put(21, pressures, i); put(22, dext_cf_errm, i)
    put(25, pressures, i); put(26, dext_hf_model, i)
    put(29, sim_t, i); put(30, sim_D, i); put(31, sim_K, i); put(32, sim_T, i)
    lines.append(",".join(row))

path = "/home/z/my-project/examples/PSI-159_Analyzed Data_MST_2025_Burning_history_demo.csv"
with open(path, "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")
print(f"OK -> {path}  ({len(lines)} filas)")
