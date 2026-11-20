#!/usr/bin/env python3
"""Build a 9:16 vlog from a JSON spec: usage build_vlog.py <spec.json> <captions_dir> <out.mp4>

Each segment: src, ss, d, tr (transition INTO it), td (transition secs), grade, cap/title text,
optional photo=true (still image with slow zoom; sound taken from asrc/ass),
optional vo (voiceover line, spoken from the start of that segment; clips made by tts.py as vo<i>.mp3).
Sound: real ambient audio, levelled per clip, crossfaded, faded out at the end.
"""
import json, os, subprocess, sys
spec_path, capdir, out = sys.argv[1:4]
def probe_color(path):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                   "stream=color_primaries,color_range", "-of", "default=nw=1", path], text=True)
    d = dict(l.split("=", 1) for l in out.split())
    return d.get("color_primaries", ""), d.get("color_range", "")

spec = json.load(open(spec_path)); segs = spec["segs"]; n = len(segs)
BASE = spec.get("grade", "")
cmd = ["ffmpeg", "-v", "error", "-y"]
for idx, s in enumerate(segs):  # video inputs 0..n-1
    if s.get("photo"):
        cmd += ["-loop", "1", "-framerate", "30", "-t", str(s["d"]), "-i", s["src"]]
    else:
        cmd += ["-i", f"{capdir}/seg{idx}.mov"]  # pre-rendered below, before the main ffmpeg run
aidx = {}
k = n
for i, s in enumerate(segs):
    if s.get("photo"):
        cmd += ["-ss", str(s["ass"]), "-t", str(s["d"]), "-i", s["asrc"]]; aidx[i] = k; k += 1
starts, t = [], 0.0
for i, s in enumerate(segs):
    td = segs[i + 1].get("td", 0.4) if i < n - 1 else 0
    starts.append(t); t += s["d"] - td
total = t
capbase = k
for i in range(n):
    cmd += ["-loop", "1", "-t", f"{total}", "-i", f"{capdir}/cap{i}.png"]
fc = []
for i, s in enumerate(segs):
    g = ",".join(x for x in (BASE, s.get("grade", "")) if x); g = ("," + g) if g else ""
    if s.get("photo"):
        fr = int(s["d"] * 30)
        fc.append(f"[{i}:v]scale=2160:-2:flags=lanczos,zoompan=z='1+0.10*on/{fr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1440x1920:fps=30,"
                  f"crop=1080:1920,format=yuv420p{g},setsar=1,fps=30,format=yuv420p,settb=AVTB[v{i}]")
    else:
        zh, cy, cx = s.get("zh", 1920), s.get("cy", 0), s.get("cx", "(iw-1080)/2")
        prim, rng = probe_color(s["src"])
        if prim == "smpte432":   # iPhone Display-P3 full range -> standard bt709
            conv = "colorspace=all=bt709:iall=bt601-6-625:iprimaries=smpte432:itrc=bt709:irange=pc:range=tv:format=yuv420p"
        elif rng == "pc":        # already bt709, only full -> tv range
            conv = "scale=in_range=pc:out_range=tv,format=yuv420p"
        else:
            conv = "format=yuv420p"
        proxy = f"{capdir}/seg{i}.mov"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(s["ss"]), "-t", str(s["d"]), "-i", s["src"],
                        "-vf", f"scale=-2:{zh}:flags=lanczos,crop=1080:1920:{cx}:{cy},{conv}{g},setsar=1,fps=30,format=yuv420p",
                        "-c:v", "libx264", "-preset", "veryfast", "-crf", "12", "-c:a", "pcm_s16le", "-ar", "48000", proxy], check=True)
        fc.append(f"[{i}:v]fps=30,format=yuv420p,settb=AVTB[v{i}]")
    a = aidx.get(i, i)
    fc.append(f"[{a}:a]aformat=sample_rates=48000:channel_layouts=stereo,highpass=f=90,dynaudnorm=f=300:g=21:m=6:p=0.5[a{i}]")
pv, pa = "v0", "a0"
for i in range(1, n):
    td = segs[i].get("td", 0.4); tr = segs[i].get("tr", "fade")
    fc.append(f"[{pv}][v{i}]xfade=transition={tr}:duration={td}:offset={starts[i]:.3f}[x{i}]")
    fc.append(f"[{pa}][a{i}]acrossfade=d={td}:c1=tri:c2=tri[y{i}]")
    pv, pa = f"x{i}", f"y{i}"
for i, s in enumerate(segs):
    if not (s.get("cap") or s.get("title")): continue
    a = starts[i] + (0.5 if i else 0.3)
    b = (starts[i + 1] if i < n - 1 else total - 1.0) - 0.25
    fc.append(f"[{capbase+i}:v]format=rgba,fade=in:st={a:.2f}:d=0.3:alpha=1,fade=out:st={b:.2f}:d=0.3:alpha=1[c{i}]")
    fc.append(f"[{pv}][c{i}]overlay=shortest=0:eof_action=pass[o{i}]"); pv = f"o{i}"
fc.append(f"[{pv}]fade=in:st=0:d=0.4,fade=out:st={total-0.8:.2f}:d=0.8,format=yuv420p[v]")
# --- AI voiceover: each line starts with its segment; ambient sound ducks under the voice ---
vos = [i for i, s in enumerate(segs) if s.get("vo") and os.path.exists(f"{capdir}/vo{i}.mp3")]
if vos:
    vbase = capbase + n
    labels = []
    for j, i in enumerate(vos):
        f = f"{capdir}/vo{i}.mp3"; cmd += ["-i", f]
        dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]))
        at = starts[i] + (0.45 if i else 0.6)
        nxt = (starts[vos[j + 1]] + 0.45) if j < len(vos) - 1 else total - 0.5
        tempo = min(max(dur / (nxt - at - 0.15), spec.get("vo_tempo", 1.12)), 1.4)
        if dur / tempo > nxt - at: print(f"WARNING: voice line {i} is too long for its scene ({dur/tempo:.1f}s > {nxt-at:.1f}s)")
        fc.append(f"[{vbase+j}:a]atempo={tempo:.3f},aresample=48000,aformat=channel_layouts=stereo,adelay={int(at*1000)}:all=1[vo{j}]")
        labels.append(f"[vo{j}]")
    fc.append(f"{''.join(labels)}amix=inputs={len(vos)}:normalize=0:dropout_transition=0,apad=whole_dur={total},loudnorm=I=-15:TP=-1.5,apad=whole_dur={total},asplit[voa][vob]")
    fc.append(f"[{pa}]loudnorm=I=-21:TP=-2:LRA=7,apad=whole_dur={total}[amb]")  # apad after loudnorm keeps its last ~3 s from being dropped
    # pad both sides to full length: sidechaincompress stops at the shorter input, which cut the last line short
    fc.append(f"[amb]apad=whole_dur={total}[ambp]")
    fc.append("[ambp][voa]sidechaincompress=threshold=0.015:ratio=10:attack=40:release=450[duck]")
    fc.append(f"[duck][vob]amix=inputs=2:normalize=0:duration=longest,apad=whole_dur={total},atrim=0:{total},alimiter=limit=0.9,afade=in:d=0.4,afade=out:st={total-1.2:.2f}:d=1.2[a]")
else:
    fc.append(f"[{pa}]loudnorm=I=-18:TP=-1.5:LRA=7,afade=in:d=0.4,afade=out:st={total-1.2:.2f}:d=1.2[a]")
cmd += ["-filter_complex", ";".join(fc), "-map", "[v]", "-map", "[a]", "-t", f"{total}",
        "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-maxrate", "12M", "-bufsize", "24M",
        "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", out]
subprocess.run(cmd, check=True)
print("total", round(total, 2), "starts", [round(x, 1) for x in starts])
