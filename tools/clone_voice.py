#!/usr/bin/env python3
"""Re-voice AI voiceover lines in Shawon's own voice timbre with OpenVoice V2 (free, runs locally).

usage: clone_voice.py <openvoice_src_dir> <ckpt_dir> <reference.wav> <lines_dir> <out_dir>

lines_dir holds vo<i>.wav (the Google Bangla voice lines); out_dir gets the same names in the cloned voice.
The reference recording never leaves this machine. OpenVoice's built-in AI watermark stays on.
Only for Shawon's own voice, from a recording he supplied himself.
"""
import glob, os, subprocess, sys
src_dir, ckpt, ref, lines_dir, out = sys.argv[1:6]
sys.path.insert(0, src_dir)
from openvoice.api import ToneColorConverter

os.makedirs(out, exist_ok=True)
tcc = ToneColorConverter(f"{ckpt}/config.json", device="cpu")
tcc.load_ckpt(f"{ckpt}/checkpoint.pth")

lines = sorted(glob.glob(f"{lines_dir}/vo*.wav"))
allsrc = f"{out}/_src_all.wav"
with open(f"{out}/_list.txt", "w") as fh:
    fh.writelines(f"file '{f}'\n" for f in lines)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", f"{out}/_list.txt", allsrc], check=True)

tgt = tcc.extract_se([ref])       # his voice colour
src = tcc.extract_se([allsrc])    # the Google voice's colour
for f in lines:
    o = f"{out}/{os.path.basename(f)}"
    tcc.convert(audio_src_path=f, src_se=src, tgt_se=tgt, output_path=o, tau=0.3)
    print("ok", o)
