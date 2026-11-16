#!/usr/bin/env python3
"""Vlog 01 v3 (full story): smooth crossfades, levelled ambient sound, proper fade-out ending."""
import subprocess, sys
C, S, OUT = sys.argv[1:4]
T = 0.4  # crossfade
segs = [  # file, start, dur, zoom height, crop y, colour grade  (faceless parts only)
    ("IMG_1382", 0.3, 3.5, 1920, 0, "eq=gamma=1.08"),            # sky + farm, opening (lift shadows)
    ("IMG_1380", 0.2, 2.9, 1920, 0, ""),                         # garden view
    ("IMG_1376", 2.0, 3.5, 1920, 0, ""),                         # alpacas
    ("IMG_1392", 4.0, 3.5, 1920, 0, ""),                         # chickens
    ("IMG_1401", 22.5, 4.0, 1920, 0, "eq=gamma=1.05"),           # geese in the sun
    ("IMG_1402", 0.2, 3.6, 2100, 180,                            # son watching geese; zoomed to keep bystanders out
     "eq=saturation=1.35:contrast=1.06,colorbalance=rm=0.05:bm=-0.05:rh=0.03:bh=-0.03"),  # shade clip: warm it up
    ("IMG_1402", 24.0, 4.5, 1920, 0, ""),                        # sunny field
    ("IMG_1404", 3.5, 4.5, 2240, 320, ""),                       # walker; zoomed to keep bystanders' faces out
    ("IMG_1402", 30.0, 3.5, 1920, 0, ""),                        # walking away hand in hand
    ("IMG_1402", 36.8, 3.0, 1920, 0, "eq=gamma=1.06"),           # wide closing shot
]
n = len(segs)
cmd = ["ffmpeg", "-v", "error", "-y"]
for f, s, d, *_ in segs:
    cmd += ["-ss", str(s), "-t", str(d), "-i", f"{C}/{f}.MOV"]
starts, t = [], 0.0
for i, (_, _, d, *_) in enumerate(segs):
    starts.append(t); t += d - T
total = t + T
for i in range(n):
    cmd += ["-loop", "1", "-t", f"{total}", "-i", f"{S}/cap{i+1}.png"]
fc = []
for i in range(n):
    zh, cy, grade = segs[i][3:]
    g = ("," + grade) if grade else ""
    # iPhone footage is Display-P3 full range: convert to standard bt709 so colours look right everywhere
    fc.append(f"[{i}:v]scale=-2:{zh}:flags=lanczos,crop=1080:1920:(iw-1080)/2:{cy},"
              f"colorspace=all=bt709:iall=bt601-6-625:iprimaries=smpte432:itrc=bt709:irange=pc:range=tv:format=yuv420p{g},"
              f"setsar=1,fps=30,format=yuv420p,settb=AVTB[v{i}]")
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
        "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-maxrate", "12M", "-bufsize", "24M", "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", OUT]
subprocess.run(cmd, check=True)
print("total", total)
