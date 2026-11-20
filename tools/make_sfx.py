#!/usr/bin/env python3
"""Synthesise a small, copyright-free sound-effect kit for vlog editing: usage make_sfx.py <outdir>

whoosh      - swipe for slide/smooth transitions
whoosh_soft - gentle air swipe for fades/dissolves
riser       - 1.5 s build-up before a big reveal
impact      - soft cinematic boom on a reveal / title hit
pop         - small bubble pop when on-screen text appears
click       - camera shutter, for a "photo moment" freeze
chime       - warm sparkle for a happy or emotional moment
"""
import os, sys
import numpy as np
import soundfile as sf

SR = 48000
rng = np.random.default_rng(7)


def env(n, attack, release, curve=2.0):
    a = int(n * attack); r = int(n * release)
    e = np.ones(n)
    e[:a] = np.linspace(0, 1, a) ** curve if a else 1
    e[n - r:] = np.linspace(1, 0, r) ** curve if r else 1
    return e


def sweep_noise(dur, f0, f1, q=6.0):
    """noise through a moving band-pass (simple state-variable filter)"""
    n = int(dur * SR); x = rng.standard_normal(n)
    fc = np.geomspace(f0, f1, n)
    low = band = 0.0; out = np.empty(n)
    for i in range(n):
        f = 2 * np.sin(np.pi * fc[i] / SR)
        low += f * band; high = x[i] - low - band / q; band += f * high
        out[i] = band
    return out / (np.abs(out).max() + 1e-9)


def stereo_pan(m, start=-0.8, end=0.8):
    p = np.linspace(start, end, len(m))
    return np.stack([m * np.sqrt((1 - p) / 2), m * np.sqrt((1 + p) / 2)], 1)


def norm(x, db):
    return x / (np.abs(x).max() + 1e-9) * 10 ** (db / 20)


def save(out, name, x):
    if x.ndim == 1: x = np.stack([x, x], 1)
    sf.write(f"{out}/{name}.wav", x.astype(np.float32), SR)
    print(name, round(len(x) / SR, 2), "s")


def main(out):
    os.makedirs(out, exist_ok=True)
    w = sweep_noise(0.55, 300, 4500) * env(int(0.55 * SR), 0.6, 0.4, 1.5)
    save(out, "whoosh", norm(stereo_pan(w), -6))
    w = sweep_noise(0.8, 200, 1800, q=3) * env(int(0.8 * SR), 0.5, 0.5, 2)
    save(out, "whoosh_soft", norm(stereo_pan(w, -0.4, 0.4), -12))

    n = int(1.6 * SR); t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * np.cumsum(np.geomspace(110, 880, n)) / SR)
    noise = sweep_noise(1.6, 400, 9000, q=2)
    save(out, "riser", norm((0.5 * tone + 0.6 * noise) * np.linspace(0, 1, n) ** 3 * env(n, 0, 0.02), -8))

    n = int(1.4 * SR); t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * (55 * t - 25 * t ** 2)) * np.exp(-t * 3.5)
    thump = rng.standard_normal(n) * np.exp(-t * 40) * 0.3
    save(out, "impact", norm(boom + thump, -5))

    n = int(0.12 * SR); t = np.arange(n) / SR
    pop = np.sin(2 * np.pi * np.cumsum(np.linspace(900, 300, n)) / SR) * np.exp(-t * 45)
    save(out, "pop", norm(pop, -10))

    n = int(0.25 * SR); t = np.arange(n) / SR
    c = rng.standard_normal(n) * (np.exp(-((t - 0.005) * 900) ** 2) + 0.7 * np.exp(-((t - 0.09) * 700) ** 2))
    save(out, "click", norm(c, -10))

    n = int(1.8 * SR); t = np.arange(n) / SR; ch = np.zeros(n)
    for k, f in enumerate([1318.5, 1760, 2093, 2637]):  # E6 A6 C7 E7 arpeggio
        d = int(k * 0.07 * SR); tt = t[: n - d]
        ch[d:] += np.sin(2 * np.pi * f * tt) * np.exp(-tt * 3) * (0.8 ** k)
    save(out, "chime", norm(ch * env(n, 0.002, 0.2), -14))


if __name__ == "__main__":
    main(sys.argv[1])
