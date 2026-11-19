#!/usr/bin/env python3
"""Make Bangla AI voiceover clips for a vlog spec: usage tts.py <spec.json> <outdir>
Writes vo<i>.mp3 for every segment that has a "vo" line. Uses Google's free Bangla voice (gTTS).
Only the voiceover text is sent to the service."""
import json, os, sys
from gtts import gTTS
spec, out = sys.argv[1:3]
os.makedirs(out, exist_ok=True)
for i, s in enumerate(json.load(open(spec))["segs"]):
    if s.get("vo"):
        gTTS(s["vo"], lang=json.load(open(spec)).get("vo_lang", "bn")).save(f"{out}/vo{i}.mp3")
        print("vo", i, s["vo"])
