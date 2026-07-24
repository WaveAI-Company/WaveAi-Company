"""
CLI do spike:
  wave-eeg demo                       # Exp. B em dados sintéticos (sem hardware)
  wave-eeg capture --port COMx        # captura raw+poor_signal do device -> CSV
  wave-eeg analyze arquivo.csv        # análise (dois sinais agrupados) de 1 CSV
  wave-eeg exp-b b1.csv b2.csv ...    # Exp. B INTERCALADO (§12) sobre N blocos

O `capture` grava `t, raw, poor_signal, condition`. O `exp-b` roda o pipeline
TRAVADO do desenho intercalado (DataScience/31 §12): fs por bloco, descarte de
transição, detrend + passa-banda + notch 60 Hz, alfa RELATIVA — evitando o
falso-negativo da 1ª coleta.
"""
from __future__ import annotations

import argparse
import csv
import sys
import time

import numpy as np

from .analysis import (
    band_powers,
    compare_eyes_closed_open,
    mains_power,
    preprocess,
    relative_band_powers,
    total_power,
)
from .reader import SerialReader

_OC_LABELS = {"OC", "OF", "EYES_CLOSED", "FECHADO", "FECHADOS"}
_OA_LABELS = {"OA", "EYES_OPEN", "ABERTO", "ABERTOS"}


def _synth(fs, secs, alpha_amp, seed=0):
    rng = np.random.default_rng(seed)
    t = np.arange(int(fs * secs)) / fs
    return alpha_amp * np.sin(2 * np.pi * 10 * t) + rng.normal(0, 10, t.size)


def cmd_demo(args) -> int:
    fs = 512
    oc = _synth(fs, args.secs, alpha_amp=20.0, seed=1)
    oa = _synth(fs, args.secs, alpha_amp=5.0, seed=2)
    res = compare_eyes_closed_open(oc, oa, fs)
    print("== DEMO — Exp. B (alfa relativa OF vs OA, dados sintéticos) ==")
    print(f"  alfa_rel(OF) = {res.oc_alpha*100:5.1f}%   alfa_rel(OA) = {res.oa_alpha*100:5.1f}%")
    print(f"  razão OF/OA = {res.ratio:5.2f}   t = {res.t_stat:6.2f}   p = {res.p_value:.2e}")
    print(f"  VEREDITO: {res.verdict}")
    return 0


def capture_rows(reader, max_seconds, clock=time.time):
    """Coleta `(t, raw, poor_signal)` de um `DeviceReader` por até `max_seconds`.

    O `poor_signal` chega em pacotes próprios (~1 Hz); cada amostra raw é pareada
    ao **último** `poor_signal` visto (None até o 1º pacote de qualidade). Puro e
    testável com o `SimulatedReader` (sem hardware).
    """
    t0 = clock()
    poor = None
    rows = []
    for pkt in reader.packets():
        if pkt.poor_signal is not None:
            poor = pkt.poor_signal
        for s in pkt.raw_samples:
            rows.append((clock() - t0, s, poor))
        if clock() - t0 >= max_seconds:
            break
    return rows


def cmd_capture(args) -> int:
    reader = SerialReader(args.port, baudrate=args.baud)
    print(f"Capturando {args.secs}s de {args.port} @ {args.baud} baud...", file=sys.stderr)
    rows = capture_rows(reader, args.secs)
    with open(args.out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["t", "raw", "poor_signal", "condition"])
        for t, s, poor in rows:
            w.writerow([f"{t:.6f}", s, "" if poor is None else poor, args.condition])
    span = (rows[-1][0] - rows[0][0]) if len(rows) > 1 else args.secs
    fs_eff = len(rows) / span if span else 0
    print(f"{len(rows)} amostras em {span:.1f}s (fs efetivo ~{fs_eff:.0f} Hz) -> {args.out}", file=sys.stderr)
    return 0


def _load_by_condition(path):
    data = {"OC": ([], []), "OA": ([], [])}
    with open(path) as f:
        for row in csv.DictReader(f):
            cond = row.get("condition", "").strip().upper()
            key = "OC" if cond in _OC_LABELS else "OA" if cond in _OA_LABELS else None
            if key is None:
                continue
            try:
                data[key][0].append(float(row.get("t", "nan")))
                data[key][1].append(float(row["raw"]))
            except (KeyError, ValueError):
                continue
    return data


def _eff_fs(t, default):
    t = np.asarray([v for v in t if np.isfinite(v)], dtype=float)
    if t.size > 1 and (t.max() - t.min()) > 0:
        return t.size / (t.max() - t.min())
    return float(default)


def cmd_analyze(args) -> int:
    data = _load_by_condition(args.csv)
    oc_t, oc = data["OC"]
    oa_t, oa = data["OA"]
    if not oc or not oa:
        print("ERRO: o CSV precisa de coluna 'condition' com rótulos OC e OA.", file=sys.stderr)
        return 1
    oc = np.array(oc); oa = np.array(oa)
    fs_oc = args.fs if args.fs else _eff_fs(oc_t, 512)
    fs_oa = args.fs if args.fs else _eff_fs(oa_t, 512)
    print(f"fs efetivo: OC={fs_oc:.1f} Hz | OA={fs_oa:.1f} Hz\n")
    for label, x, fs_x in (("OLHOS FECHADOS (OC)", oc, fs_oc), ("OLHOS ABERTOS (OA)", oa, fs_oa)):
        xf = preprocess(x, fs_x)
        rel = relative_band_powers(xf, fs_x)
        print(f"  {label}: n={len(x)}  std={x.std():.0f}  "
              f"60Hz(raw)={mains_power(x, fs_x):.0f}  "
              f"alfa_rel(filtr)={rel['alpha']*100:.1f}%")
    fs = args.fs if args.fs else round((fs_oc + fs_oa) / 2, 1)
    res = compare_eyes_closed_open(oc, oa, fs)
    print(f"\nalfa_rel(OF)={res.oc_alpha*100:.1f}%  alfa_rel(OA)={res.oa_alpha*100:.1f}%  "
          f"razão={res.ratio:.2f}  p={res.p_value:.2e}")
    print("VEREDITO:", res.verdict)
    return 0


def cmd_exp_b(args) -> int:
    """Exp. B intercalado (§12) sobre os CSVs de captura — pipeline TRAVADO."""
    from .exp_b import EYES_CLOSED, analyze_interleaved, load_blocks, read_capture_csv

    blocks = load_blocks(args.csvs)
    print("== Exp. B intercalado (alfa relativa OF vs OA, pipeline travado) ==")
    for path, block in zip(args.csvs, blocks):
        cap = read_capture_csv(path)
        cond = "OF" if block.condition == EYES_CLOSED else "OA"
        mains_ratio = mains_power(block.samples, block.fs) / (total_power(block.samples, block.fs) or 1.0)
        print(f"  {cond}  n={block.samples.size:6d}  fs~{block.fs:5.0f}Hz  "
              f"poor_signal(médio)={cap.poor_signal_mean:5.1f}  60Hz/total={mains_ratio*100:4.1f}%  ({path})")
    res = analyze_interleaved(blocks, discard_s=args.discard)
    print(f"\n  alfa_rel(OF)={res.eyes_closed_rel_alpha*100:5.1f}%  "
          f"alfa_rel(OA)={res.eyes_open_rel_alpha*100:5.1f}%  razão={res.ratio:5.2f}")
    print(f"  épocas OF/OA={res.n_epochs_closed}/{res.n_epochs_open}  "
          f"t={res.t_stat:6.2f}  p={res.p_value:.2e}  d={res.cohens_d:.2f}")
    print(f"  VEREDITO: {res.verdict}")
    return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="wave-eeg", description="WaveAI — spike de captação/análise EEG (NeuroSky).")
    sub = p.add_subparsers(dest="cmd", required=True)

    d = sub.add_parser("demo", help="Exp. B em dados sintéticos (sem hardware).")
    d.add_argument("--secs", type=float, default=30.0)
    d.set_defaults(func=cmd_demo)

    c = sub.add_parser("capture", help="Captura raw do dispositivo real -> CSV.")
    c.add_argument("--port", required=True, help="Porta serial (ex.: COM5 ou /dev/rfcomm0).")
    c.add_argument("--baud", type=int, default=57600)
    c.add_argument("--secs", type=float, default=60.0)
    c.add_argument("--out", default="capture.csv")
    c.add_argument("--condition", default="OC", help="Rótulo da condição (OC/OA).")
    c.set_defaults(func=cmd_capture)

    a = sub.add_parser("analyze", help="Analisa um CSV com colunas t,raw,condition.")
    a.add_argument("csv")
    a.add_argument("--fs", type=int, default=0, help="Força fs (0 = estimar pelos timestamps).")
    a.set_defaults(func=cmd_analyze)

    e = sub.add_parser("exp-b", help="Exp. B intercalado (§12) sobre vários CSVs de captura.")
    e.add_argument("csvs", nargs="+", help="CSVs dos blocos, em ordem (ex.: b1_oc.csv b2_oa.csv ...).")
    e.add_argument("--discard", type=float, default=5.0, help="Segundos de transição descartados por bloco.")
    e.set_defaults(func=cmd_exp_b)

    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
