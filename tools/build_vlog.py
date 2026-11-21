#!/usr/bin/env python3
"""Build a 9:16 vlog from a JSON spec: usage build_vlog.py <spec.json> <work_dir> <out.mp4>

work_dir holds the caption PNGs (cap<i>.png from make_captions.cjs) and voice lines (vo<i>.mp3);
per-scene proxies and the audio mix are written there too.

Top-level spec keys
  grade      colour filter for every scene (ffmpeg filter string)
  look       "cinematic" = gentle S-curve, warm highlights / cool shadows, soft vignette ("" for none)
  music      path to a music track (looped/trimmed to length, ducked under the voice)
  music_db   music level in dBFS RMS (default -22)      ambient_db  real-sound level (default -24, -30 with music)
  bpm        tempo; a scene may then give "beats" instead of "d" so cuts land on the beat
  beat_align true = trim the music so its first beat lands at 0 s (needs librosa)
  ambient    false = drop all real sound (voice only, music added in the app)
  remove_talk  default true: scenes whose real sound has people talking take ambience from a talk-free part of the clip
  sfx        true = automatic whoosh on moving transitions and a soft pop when captions appear
  vo_tempo   minimum voice speed-up (default 1.0)

Scene keys
  src, ss, d | beats   clip, start second, duration on the timeline (seconds or beats)
  speed      0.5 = slow motion (60 fps sources stay smooth), 2 = time-lapse feel. Real sound stays at normal speed; mute=true drops it
  zoom       "in" / "out": slow push-in / pull-out (zoom_amt, default 0.08)
  tr, td     transition into this scene and its length (default fade, 0.4 s)
  sfx        extra sound on the transition into this scene: whoosh, whoosh_soft, riser, impact, pop, click, chime
  hit        sound exactly at this scene's start (e.g. "impact" on the title reveal); hit_at = offset in scene
  grade      extra colour filter for this scene      amb  extra dB for this scene's real sound (e.g. +6 for waves)
  amb_src, amb_ss   take this scene's real sound from another clip of the same place (e.g. when people talk)
  cap/title/sub/tag    on-screen text (rendered by make_captions.cjs); text slides up and fades in
  vo         voiceover line (vo<i>.mp3 in work_dir, made by tts_elevenlabs.py / tts.py)
  photo, asrc, ass     still image with slow zoom; real sound borrowed from another clip
  freeze     seconds to hold the scene's last frame (freeze frame + text)
  jcut       seconds this scene's real sound starts before its picture (J-cut)
  zh, cy, cx crop control to keep faces or signs out of frame
"""
import json, os, subprocess, sys
import numpy as np
import soundfile as sf

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
SFX_DIR = os.path.join(HERE, "sfx")
spec_path, work, out = sys.argv[1:4]
spec = json.load(open(spec_path)); segs = spec["segs"]; n = len(segs)
MUSIC = spec.get("music")
bpm = spec.get("bpm")
for i, s in enumerate(segs):
    if "beats" in s:   # on-timeline length = beats; add the next transition so every cut lands on the beat grid
        if not bpm: sys.exit("scene uses 'beats' but spec has no bpm")
        nxt_td = segs[i + 1].get("td", 0.4) if i < n - 1 else 0
        s["d"] = round(s["beats"] * 60.0 / bpm + nxt_td, 3)

LOOKS = {
    "cinematic": "curves=master='0/0 0.12/0.09 0.5/0.5 0.88/0.92 1/1',"
                 "colorbalance=rs=-0.03:bs=0.03:rh=0.04:bh=-0.04,vignette=angle=PI/5:mode=forward",
    "": "",
}
look = LOOKS[spec.get("look", "")]


def run(cmd): subprocess.run(cmd, check=True)


def probe_color(path):
    o = subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                 "stream=color_primaries,color_range", "-of", "default=nw=1", path], text=True)
    d = dict(l.split("=", 1) for l in o.split())
    return d.get("color_primaries", ""), d.get("color_range", "")


def src_fps(path):
    r = subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate",
                                 "-of", "csv=p=0", path], text=True).strip().split(",")[0].split("/")
    return float(r[0]) / float(r[1] if len(r) > 1 else 1)


def load_audio(path, ss=0.0, dur=None, tempo=1.0, extra=""):
    """decode any file to 48 kHz stereo float32 numpy"""
    cmd = ["ffmpeg", "-v", "error", "-ss", str(max(ss, 0))] + (["-t", str(dur * tempo)] if dur else []) + ["-i", path]
    af = ([f"atempo={tempo}"] if abs(tempo - 1) > 1e-3 else []) + ([extra] if extra else [])
    cmd += (["-af", ",".join(af)] if af else []) + ["-ac", "2", "-ar", str(SR), "-f", "f32le", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)


def at_db(x, db):
    return x * 10 ** ((db - rms_db(x)) / 20) if len(x) and rms_db(x) > -70 else x * 0


def fit(x, n_out):
    return x[:n_out] if len(x) >= n_out else np.vstack([x, np.zeros((n_out - len(x), 2), np.float32)])


# ---------------- timeline ----------------
starts, t = [], 0.0
for i, s in enumerate(segs):
    td = segs[i + 1].get("td", 0.4) if i < n - 1 else 0
    starts.append(t); t += s["d"] - td
total = round(t, 3)
N = int(total * SR)

# ---------------- video: one 1080x1920 proxy per scene ----------------
REUSE = os.environ.get("REUSE_VIDEO") == "1" and os.path.exists(f"{work}/video_only.mp4")  # audio-only rebuild
for i, s in enumerate([] if REUSE else segs):
    g = ",".join(x for x in (spec.get("grade", ""), s.get("grade", ""), look) if x)
    g = ("," + g) if g else ""
    proxy = f"{work}/seg{i}.mov"
    fr = max(int(s["d"] * 30), 1)
    z = s.get("zoom_amt", 0.08)
    zexpr = {"in": f"1+{z}*on/{fr}", "out": f"1+{z}-{z}*on/{fr}"}.get(s.get("zoom"), "1")
    zoom = (f",zoompan=z='{zexpr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30"
            if s.get("zoom") else ",scale=1080:1920:flags=lanczos")
    if s.get("photo"):
        run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-framerate", "30", "-t", str(s["d"]), "-i", s["src"],
             "-vf", f"scale=1350:2400:force_original_aspect_ratio=increase:flags=lanczos,crop=1350:2400,"
                    f"zoompan=z='1+{z if s.get('zoom') else 0.1}*on/{fr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,"
                    f"format=yuv420p{g},setsar=1",
             "-c:v", "libx264", "-preset", "veryfast", "-crf", "12", "-an", proxy])
        continue
    sp = s.get("speed", 1.0)
    zh, cy, cx = s.get("zh", 1920), s.get("cy", 0), s.get("cx", "(iw-1080)/2")
    prim, rng = probe_color(s["src"])
    if prim == "smpte432":   # iPhone Display-P3 full range -> standard bt709
        conv = "colorspace=all=bt709:iall=bt601-6-625:iprimaries=smpte432:itrc=bt709:irange=pc:range=tv:format=yuv420p"
    elif rng == "pc":
        conv = "scale=in_range=pc:out_range=tv,format=yuv420p"
    else:
        conv = "format=yuv420p"
    k = 1.25  # oversample so a push-in stays sharp
    base = (f"scale=-2:{int(zh*k)}:flags=lanczos,crop={int(1080*k)}:{int(1920*k)}:"
            f"{cx if isinstance(cx, str) else int(cx*k)}:{int(cy*k)}")
    fz = s.get("freeze", 0.0)
    smooth = "minterpolate=fps=60:mi_mode=blend," if sp < 1 and src_fps(s["src"]) < 50 else ""
    speed = f"{smooth}setpts=PTS/{sp}," if sp != 1 else ""
    hold = f",tpad=stop_mode=clone:stop_duration={fz}" if fz else ""
    run(["ffmpeg", "-v", "error", "-y", "-ss", str(s["ss"]), "-t", str((s["d"] - fz) * sp), "-i", s["src"],
         "-vf", f"{speed}fps=30,{base},{conv}{zoom}{g}{hold},setsar=1,format=yuv420p",
         "-t", str(s["d"]), "-c:v", "libx264", "-preset", "veryfast", "-crf", "12", "-an", proxy])

cmd = ["ffmpeg", "-v", "error", "-y"]
for i in range(n): cmd += ["-i", f"{work}/seg{i}.mov"]
capbase = n
for i in range(n): cmd += ["-loop", "1", "-t", f"{total}", "-i", f"{work}/cap{i}.png"]
fc = [f"[{i}:v]fps=30,format=yuv420p,settb=AVTB[v{i}]" for i in range(n)]
pv = "v0"
for i in range(1, n):
    fc.append(f"[{pv}][v{i}]xfade=transition={segs[i].get('tr', 'fade')}:duration={segs[i].get('td', 0.4)}:offset={starts[i]:.3f}[x{i}]")
    pv = f"x{i}"
cap_times = []
for i, s in enumerate(segs):
    if not (s.get("cap") or s.get("title")): continue
    a = starts[i] + (spec.get("cap_delay", 0.45) if i else 0.25)
    b = (starts[i + 1] if i < n - 1 else total - 1.0) - 0.25
    cap_times.append(a)
    fc.append(f"[{capbase+i}:v]format=rgba,fade=in:st={a:.2f}:d=0.3:alpha=1,fade=out:st={b:.2f}:d=0.3:alpha=1[c{i}]")
    # slide up 50 px into place while fading in
    fc.append(f"[{pv}][c{i}]overlay=x=0:y='50*max(0\\,1-(t-{a:.2f})/0.35)':shortest=0:eof_action=pass[o{i}]"); pv = f"o{i}"
fc.append(f"[{pv}]fade=in:st=0:d=0.3,fade=out:st={total-0.8:.2f}:d=0.8,format=yuv420p[v]")
if not REUSE: run(cmd + ["-filter_complex", ";".join(fc), "-map", "[v]", "-t", f"{total}", "-c:v", "libx264", "-preset", "veryfast",
           "-crf", "14", "-pix_fmt", "yuv420p", f"{work}/video_only.mp4"])

# ---------------- audio: mixed in numpy (precise, no filter-graph EOF surprises) ----------------
_speech_cache = {}
def speech_spans(src):
    """seconds where people talk in a clip (silero-vad, threshold 0.3, 0.25 s margin)"""
    if src not in _speech_cache:
        import torch, warnings
        warnings.filterwarnings("ignore")
        from silero_vad import load_silero_vad, get_speech_timestamps
        global _vad
        if "_vad" not in globals(): _vad = load_silero_vad()
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                             capture_output=True, check=True).stdout
        w = torch.from_numpy(np.frombuffer(raw, np.float32).copy())
        ts = get_speech_timestamps(w, _vad, sampling_rate=16000, threshold=0.3, min_speech_duration_ms=120, return_seconds=True)
        _speech_cache[src] = (len(w) / 16000, [(t["start"] - 0.25, t["end"] + 0.25) for t in ts])
    return _speech_cache[src]

def speech_free_start(src, ss, dur):
    """ss if [ss, ss+dur] has no talking, else the nearest talk-free window in the same clip, else None"""
    length, spans = speech_spans(src)
    free = lambda a: a >= 0 and a + dur <= length and all(e <= a - 0.4 or st >= a + dur + 0.4 for st, e in spans)  # 0.4 s guard for crossfades
    if free(ss): return ss
    for off in np.arange(0.25, length, 0.25):
        for a in (ss - off, ss + off):
            if free(a): return float(a)
    return None

amb_db = spec.get("ambient_db", -30 if MUSIC else -24)
amb = np.zeros((N, 2), np.float32)
for i, s in enumerate(segs):
    src, ss = (s["asrc"], s["ass"]) if s.get("photo") else (s["src"], s["ss"])
    if s.get("amb_src"): src, ss = s["amb_src"], s.get("amb_ss", 0.0)   # real sound from another clip of the same place
    if s.get("mute") or spec.get("ambient") is False: continue   # slow-mo / time-lapse scenes keep their real sound at normal speed (waves, wind)
    if spec.get("remove_talk", True):   # people talking in the background: borrow talk-free ambience from the same clip
        new_ss = speech_free_start(src, ss, s["d"])
        if new_ss is None:   # borrow talk-free outdoor sound from the nearest other scene's clip
            for j in sorted(range(n), key=lambda j: abs(j - i)):
                o = segs[j]
                if j == i or o.get("photo") or o["src"] == src: continue
                cand = speech_free_start(o["src"], o["ss"], s["d"])
                if cand is not None:
                    print(f"scene {i}: talking everywhere in {os.path.basename(src)}, ambience borrowed from {os.path.basename(o['src'])} at {cand:.1f}s")
                    src, new_ss = o["src"], cand; break
        if new_ss is None:
            print(f"scene {i}: no talk-free ambience found, real sound muted"); continue
        if abs(new_ss - ss) > 1e-3: print(f"scene {i}: talking removed, ambience taken from {new_ss:.1f}s instead of {ss:.1f}s")
        ss = new_ss
    lead = s.get("jcut", 0.0) if i else 0.0      # J-cut: this scene's sound starts before its picture
    x = load_audio(src, ss - lead, s["d"] + lead,
                   extra=spec.get("amb_clean", "highpass=f=100,afftdn=nr=12:nf=-40,lowpass=f=15000"))
    x = at_db(x, amb_db + s.get("amb", 0))
    td_in = segs[i].get("td", 0.4) if i else 0.05
    td_out = segs[i + 1].get("td", 0.4) if i < n - 1 else 0.6
    e = np.ones(len(x), np.float32)
    a_, b_ = int(td_in * SR), int(td_out * SR)
    if a_: e[:a_] = np.linspace(0, 1, a_)
    if b_: e[-b_:] = np.minimum(e[-b_:], np.linspace(1, 0, b_))
    x *= e[:, None]
    p = int((starts[i] - lead) * SR); m = min(len(x), N - p)
    amb[p:p + m] += x[:m]

sf.write(f"{work}/amb_only.wav", amb, SR)   # for the talk check after building
voice = np.zeros((N, 2), np.float32)
vos = [i for i, s in enumerate(segs) if s.get("vo") and os.path.exists(f"{work}/vo{i}.mp3")]
for j, i in enumerate(vos):
    f = f"{work}/vo{i}.mp3"
    dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]))
    at = starts[i] + (0.45 if i else 0.6)
    nxt = (starts[vos[j + 1]] + 0.45) if j < len(vos) - 1 else total - 0.9
    tempo = min(max(dur / max(nxt - at - 0.15, 0.1), spec.get("vo_tempo", 1.0)), 1.3)
    if dur / tempo > nxt - at: print(f"WARNING: voice line {i} is too long for its scene ({dur/tempo:.1f}s > {nxt-at:.1f}s)")
    x = at_db(load_audio(f, tempo=tempo), -17)
    p = int(at * SR); m = min(len(x), N - p); voice[p:p + m] += x[:m]

# ducking envelope from the voice: 1 where silent, -> duck where speaking (40 ms attack, 450 ms release)
lvl = np.abs(voice).max(1)
active = np.convolve(lvl > 0.01, np.ones(int(0.05 * SR)) / (0.05 * SR), "same") > 0.05
duck = np.ones(N, np.float32); g_ = 1.0
a_c, r_c = np.exp(-1 / (0.04 * SR)), np.exp(-1 / (0.45 * SR))
for k_ in range(0, N, 64):  # block-wise for speed
    target = 0.0 if active[k_] else 1.0
    c = a_c if target < g_ else r_c
    g_ = target + (g_ - target) * c ** 64
    duck[k_:k_ + 64] = g_

mix = amb * (0.45 + 0.55 * duck)[:, None]          # real sound dips ~7 dB under the voice
if MUSIC:
    m = load_audio(MUSIC)
    if spec.get("beat_align"):
        import librosa
        y = m.mean(1)
        tempo_, beats = librosa.beat.beat_track(y=y, sr=SR, units="time")
        if len(beats): m = m[int(beats[0] * SR):]
        print("music beat", float(np.atleast_1d(tempo_)[0]), "first beat", round(float(beats[0]), 2) if len(beats) else None)
    reps = int(np.ceil(N / max(len(m), 1)))
    m = fit(np.vstack([m] * reps), N)
    m = at_db(m, spec.get("music_db", -22))
    fi, fo = int(0.6 * SR), int(2.0 * SR)
    m[:fi] *= np.linspace(0, 1, fi)[:, None]; m[-fo:] *= np.linspace(1, 0, fo)[:, None]
    mix += m * (0.30 + 0.70 * duck)[:, None]        # music dips ~10 dB under the voice
mix += voice

sfx_events = []
auto = spec.get("sfx")
for i, s in enumerate(segs):
    if i and (s.get("sfx") or (auto and s.get("tr", "fade") in ("smoothleft", "smoothright", "smoothup", "smoothdown", "slideup", "slideleft", "slideright", "zoomin", "circleopen", "hblur", "wipeleft", "wiperight"))):
        sfx_events.append((starts[i] - 0.15, s.get("sfx") or "whoosh", -1))
    if s.get("hit"): sfx_events.append((starts[i] + s.get("hit_at", 0.0), s["hit"], 0))
if auto:
    for a in cap_times: sfx_events.append((a, "pop", -10))
for t0, name, gdb in sfx_events:
    x = sf.read(f"{SFX_DIR}/{name}.wav", dtype="float32")[0]
    if name == "riser": t0 -= len(x) / SR - 0.1   # a riser ends on the cut
    x *= 10 ** ((spec.get("sfx_db", -4) + gdb) / 20)
    p = max(int(t0 * SR), 0); m_ = min(len(x), N - p)
    if m_ > 0: mix[p:p + m_] += x[:m_]

# master: loudness to about -16 dBFS RMS (Reels/Shorts level), gentle soft-knee limiter, ceiling -2 dBFS
fo = int(1.2 * SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
mix *= 10 ** ((spec.get("master_db", -16) - rms_db(mix)) / 20)
T, C = 0.55, 10 ** (-2 / 20)   # knee start, ceiling
a_ = np.abs(mix)
over = a_ > T
mix[over] = np.sign(mix[over]) * (T + (C - T) * np.tanh((a_[over] - T) / (C - T)))
print("master: limited", round(100 * over.mean(), 2), "% of samples")
sf.write(f"{work}/mix.wav", mix, SR)

run(["ffmpeg", "-v", "error", "-y", "-i", f"{work}/video_only.mp4", "-i", f"{work}/mix.wav",
     "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-maxrate", "12M", "-bufsize", "24M",
     "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
     "-c:a", "aac", "-b:a", "192k", "-t", f"{total}", "-movflags", "+faststart", out])
print("total", total, "starts", [round(x, 2) for x in starts], "sfx", len(sfx_events), "voice lines", len(vos))
