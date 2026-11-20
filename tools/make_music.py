#!/usr/bin/env python3
"""Generate royalty-free background music locally with ACE-Step 1.5 (Apache-2.0, free for commercial use).

usage (inside the ACE-Step venv):
  make_music.py <out.wav> <seconds> <bpm> "<caption>" [checkpoint_dir]

Runs on CPU (no GPU here): turbo DiT, no language model, 8 steps. Instrumental only.
Checkpoints download from huggingface.co on first use (hosts huggingface.co, us.aws.cdn.hf.co).
"""
import os, shutil, sys, time
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
import acestep.model_downloader as md
# instrumental DiT-only mode never uses the 3.7 GB language model: don't require or download it
md.MAIN_MODEL_COMPONENTS[:] = [c for c in md.MAIN_MODEL_COMPONENTS if "5Hz-lm" not in c]
from acestep.handler import AceStepHandler
from acestep.inference import GenerationParams, GenerationConfig, generate_music
import gc

# CPU has no VRAM to juggle: the 2B DiT (~9.5 GB in float32) and the VAE decode do not both fit in 15 GB RAM.
# One clip per run, so free the DiT right before decoding.
_orig_decode = AceStepHandler._decode_generate_music_pred_latents
def _decode_after_freeing_dit(self, *a, **k):
    self.model = None; gc.collect()
    return _orig_decode(self, *a, **k)
AceStepHandler._decode_generate_music_pred_latents = _decode_after_freeing_dit
os.environ.setdefault("ACESTEP_VAE_DECODE_CHUNK_SIZE", "128")

out, seconds, bpm, caption = sys.argv[1], float(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
ckpt = sys.argv[5] if len(sys.argv) > 5 else os.path.expanduser("~/.cache/acestep/checkpoints")
os.makedirs(ckpt, exist_ok=True)
t0 = time.time()
dit = AceStepHandler()
status = dit.initialize_service(project_root=os.path.dirname(ckpt), config_path="acestep-v15-turbo", device="cpu")
print("init:", status, round(time.time() - t0), "s", flush=True)
params = GenerationParams(caption=caption, lyrics="[Instrumental]", instrumental=True, bpm=bpm, duration=seconds,
                          inference_steps=8, thinking=False)
config = GenerationConfig(batch_size=1, audio_format="wav")
res = generate_music(dit, None, params, config, save_dir=os.path.dirname(os.path.abspath(out)))
if not res.success:
    sys.exit(f"music generation failed: {res.error}")
shutil.move(res.audios[0]["path"], out)
print("saved", out, round(time.time() - t0), "s total", flush=True)
