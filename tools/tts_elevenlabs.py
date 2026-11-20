#!/usr/bin/env python3
"""Make voiceover lines in Shawon's cloned ElevenLabs voice: usage tts_elevenlabs.py <spec.json> <outdir> [voice_id]

Writes vo<i>.mp3 for every segment with a "vo" line, same as tts.py, so build_vlog.py works unchanged.
The API key is injected by the session's network proxy; no key is stored here.
"""
import json, os, sys, urllib.request

VOICE = "n9Y04pWSwHXQNHhBhv2s"  # "Shawon (vlog)" instant voice clone
MODEL = "eleven_v4"             # supports Bangla
spec, out = sys.argv[1:3]
voice = sys.argv[3] if len(sys.argv) > 3 else VOICE
os.makedirs(out, exist_ok=True)
segs = json.load(open(spec))["segs"]
lines = [(i, s["vo"]) for i, s in enumerate(segs) if s.get("vo")]
for k, (i, text) in enumerate(lines):
    body = {
        "text": text,
        "model_id": MODEL,
        "language_code": "bn",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.85, "style": 0.2, "use_speaker_boost": True},
        # neighbouring lines keep the delivery flowing like one continuous story
        "previous_text": lines[k - 1][1] if k else None,
        "next_text": lines[k + 1][1] if k < len(lines) - 1 else None,
    }
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128",
        data=json.dumps(body).encode(), method="POST",
        headers={"Content-Type": "application/json", "xi-api-key": "proxy-injected", "Accept": "audio/mpeg"})
    with urllib.request.urlopen(req) as r, open(f"{out}/vo{i}.mp3", "wb") as fh:
        fh.write(r.read())
    print("vo", i, text)
