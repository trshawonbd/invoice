#!/usr/bin/env python3
"""Vlog 01 v2: smooth crossfades, levelled ambient sound, proper fade-out ending."""
import subprocess, sys
C, S, OUT = sys.argv[1:4]
T = 0.4  # crossfade
segs = [  # file, start, dur  (faceless parts only)
    ("IMG_1382", 0.3, 3.0),
    ("IMG_1376", 2.0, 3.5),
    ("IMG_1401", 22.5, 4.0),
    ("IMG_1402", 2.0, 5.0),
    ("IMG_1402", 24.0, 4.5),
    ("IMG_1402", 30.0, 3.5),
]
n = len(segs)
cmd = ["ffmpeg", "-v", "error", "-y"]
for f, s, d in segs:
    cmd += ["-ss", str(s), "-t", str(d), "-i", f"{C}/{f}.MOV"]
starts, t = [], 0.0
for i, (_, _, d) in enumerate(segs):
    starts.append(t); t += d - T
total = t + T
for i in range(n):
    cmd += ["-loop", "1", "-t", f"{total}", "-i", f"{S}/cap{i+1}.png"]
fc = []
for i in range(n):
    fc.append(f"[{i}:v]scale=-2:1920:flags=lanczos,crop=1080:1920,setsar=1,fps=30,format=yuv420p,settb=AVTB[v{i}]")
    fc.append(f"[{i}:a]aformat=sample_rates=48000:channel_layouts=stereo,highpass=f=90,dynaudnorm=f=300:g=21:m=6:p=0.5[a{i}]")
pv, pa = "v0", "a0"
for i in range(1, n):
    fc.append(f"[{pv}][v{i}]xfade=transition=fade:duration={T}:offset={starts[i]:.3f}[x{i}]")
    fc.append(f"[{pa}][a{i}]acrossfade=d={T}:c1=tri:c2=tri[y{i}]")
    pv, pa = f"x{i}", f"y{i}"
for i in range(n):
    a = starts[i] + (0.5 if i else 0.3)
    b = (starts[i + 1] if i < n - 1 else total - 1.0) - 0.3
    fc.append(f"[{n+i}:v]format=rgba,fade=in:st={a:.2f}:d=0.3:alpha=1,fade=out:st={b:.2f}:d=0.3:alpha=1[c{i}]")
    fc.append(f"[{pv}][c{i}]overlay=shortest=0:eof_action=pass[o{i}]")
    pv = f"o{i}"
fc.append(f"[{pv}]fade=out:st={total-0.8:.2f}:d=0.8,format=yuv420p[v]")
fc.append(f"[{pa}]loudnorm=I=-18:TP=-1.5:LRA=7,afade=in:d=0.3,afade=out:st={total-1.2:.2f}:d=1.2[a]")
cmd += ["-filter_complex", ";".join(fc), "-map", "[v]", "-map", "[a]", "-t", f"{total}",
        "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", OUT]
subprocess.run(cmd, check=True)
print("total", total)
