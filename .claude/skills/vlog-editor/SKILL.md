---
name: vlog-editor
description: Edit Shawon's raw phone clips into a finished faceless personal vlog (9:16 Short/Reel) with a story, Bangla captions, colour correction, varied transitions and a Bangla AI voiceover. Use when he sends clips or a Drive folder and asks for a vlog, reel, short, voiceover, or "edit this video".
---

# Vlog editor

Turn raw clips into a finished vertical vlog. Shawon has no coding knowledge and about 30 minutes a day:
reply in Bangla, keep steps tiny, and deliver a finished file rather than options.

## House rules (always)

- **Format:** 1080x1920 (9:16), H.264 MP4, 30 fps.
- **Length:** personal vlog 25-40 s. Hillcup Coffee page version max 20 s. Never under 10 s.
- **No faces:** not his, not his son's, not strangers'. Cut the moment, or zoom/crop (`zh`, `cy`, `cx`) so the face leaves the frame. Check every scene at large size, not thumbnails. Tell him what you cut.
- **Location:** frame it as "Europe / Nordic", never Tallinn or Estonia. Crop out Estonian signs and text.
- **Text:** Bangla only, short lines. No emoji in on-screen text (no emoji font).
- **Sound:** real ambient sound, no music. Voiceover is added on top when he asks for it.
- **Other brands:** fine in the personal vlog. In a Hillcup version, flag any visible competitor logo and ask.
- One video at a time. Show it, wait for his OK. Ask before big creative changes.

## Workflow

1. **Setup (once per session)**
   ```bash
   apt-get install -y -q fonts-noto-core
   pip install -q gTTS gdown pillow-heif
   ```
2. **Get clips.** Chat uploads land in `/root/.claude/uploads/...`. For a Drive folder, list with
   `gdown.download_folder(url, skip_download=True)` and download each file with
   `curl -L "https://drive.usercontent.google.com/download?id=<ID>&export=download&confirm=t"`.
   Copy into a new `clips/<set>/` folder (git-ignored).
3. **Look at everything.** For each clip make a timestamped contact sheet (one frame every 1-2 s) and read it.
   Note per clip: what happens, usable seconds, faces, readable signs, and mean volume (`volumedetect`).
4. **Write the story.** Beginning (where/when, big title) -> middle (3-8 moments) -> ending (a closing shot and line).
   Pick 2.5-4 s from each clip. A video must feel complete: it needs an opening and a real ending.
5. **Write the spec** in `tools/specs/<name>.json` (see below), one entry per scene.
6. **Build.**
   ```bash
   W=<scratchpad>/<name>; mkdir -p $W
   python3 tools/tts.py tools/specs/<name>.json $W          # only if the spec has "vo" lines
   NODE_PATH=$(npm root -g) node tools/make_captions.cjs $W tools/specs/<name>.json
   python3 tools/build_vlog.py tools/specs/<name>.json $W output/<name>.mp4
   ```
   Fix any `WARNING: voice line ... too long` by shortening the line or moving it one scene earlier.
7. **Check the result** before sending: extract one frame from the middle of every scene at >=280 px wide and
   look for faces, foreign text, cropped-off subjects, captions covering the subject, and colour jumps between scenes.
8. **Deliver** with SendUserFile, plus: a Bangla title (max one emoji), a 2-3 line Bangla description,
   3-5 hashtags, and the reminder to set YouTube video language to **Bengali**.
   Say plainly what you could not verify: you cannot hear audio, only measure levels.

## Spec format

```json
{
 "grade": "eq=contrast=1.07:saturation=1.16:gamma=1.02,colorbalance=rm=0.03:bm=-0.03",
 "segs": [
  {"src": "clips/set3/IMG_1633.mov", "ss": 0.3, "d": 3.4,
   "title": "ইউরোপে শরতের সকাল", "sub": "একটু হাঁটা, এক কাপ কফি", "vo": "ইউরোপে শরতের এক সকাল।"},
  {"src": "clips/set3/IMG_1638.mov", "ss": 0.6, "d": 2.8, "tr": "smoothup",
   "cap": "হাঁটতে বের হলাম", "vo": "একটু হাঁটতে বের হলাম।"},
  {"src": "clips/set3/IMG_1634.jpg", "photo": true, "d": 2.4,
   "asrc": "clips/set3/IMG_1633.mov", "ass": 5.0, "tr": "zoomin", "td": 0.5}
 ]
}
```

| Key | Meaning |
|---|---|
| `src`, `ss`, `d` | clip, start second, duration |
| `tr`, `td` | transition into this scene and its length (default `fade`, 0.4 s). Mix several: `fade`, `dissolve`, `smoothleft`, `smoothup`, `slideup`, `zoomin`, `circleopen`, `hblur` |
| `title`, `sub` | big opening title and subtitle (first scene) |
| `cap`, `tag` | bottom caption, optional small brand line under it |
| `vo` | voiceover line, spoken from the start of this scene. Keep it under the scene length (about 4 Bangla words per second) |
| `grade` | extra colour filter for this scene, e.g. `eq=gamma=1.12` for dark shots |
| `zh`, `cy`, `cx` | zoom height (default 1920) and crop offsets, to push faces or signs out of frame |
| `photo`, `asrc`, `ass` | still image with slow zoom; ambient sound borrowed from another clip |

Top-level `grade` applies to every scene: add warmth and contrast on overcast days, leave empty on sunny days.
Match a shaded scene to sunny neighbours with a per-scene `grade`.

## What the builder already does

- Converts iPhone Display-P3 footage to standard bt709 so colours are right on every phone.
- Levels each clip's ambient sound, crossfades between scenes, fades picture and sound out at the end.
- Voiceover: speeds lines slightly to fit, ducks ambient sound under the voice, limits peaks.
- Captions fade in and out with each scene.

## Voice

`tools/tts.py` makes the lines with Google's free Bangla voice (female; needs host `translate.google.com`).
Only the voiceover text is sent out. Microsoft's voices (edge-tts) do not work here: the proxy blocks WebSockets.

### Shawon's own voice: ElevenLabs (default, best quality)

He has an ElevenLabs Starter plan; the API key is saved on the "Vlog video editing" environment and the
proxy injects it for `api.elevenlabs.io` (never ask for or print the key). His cloned voice is
"Shawon (vlog)", id `n9Y04pWSwHXQNHhBhv2s`, made from his own recording with his consent.

```bash
python3 tools/tts_elevenlabs.py tools/specs/<name>.json $W     # writes vo<i>.mp3 in his voice
```
Then make captions and build as usual; set `"vo_tempo": 1.0` in the spec so his real delivery is not sped up.
Model `eleven_v4` (Bangla). Starter allows `mp3_44100_128` only, and 40,000 characters a month
(a 35 s vlog uses about 90). Check usage with `GET /v1/user/subscription`.

### Fallback: free local re-voicing (much weaker)

`tools/clone_voice.py` re-voices those lines in his voice colour with OpenVoice V2, locally on CPU.
Use only his own voice, from a recording he gave. Keep the built-in AI watermark on.

```bash
pip install -q torch torchaudio librosa soundfile inflect unidecode eng_to_ipa pypinyin cn2an jieba wavmark==0.0.3 whisper-timestamped pydub
pip download --no-deps -d $W/pip "git+https://github.com/myshell-ai/OpenVoice.git" && unzip -q $W/pip/*.zip -d $W/src
# converter/config.json + converter/checkpoint.pth from huggingface.co/myshell-ai/OpenVoiceV2 into $W/ckpt
# (hosts huggingface.co and us.aws.cdn.hf.co)
ffmpeg -i <his recording> -af "highpass=f=70,afftdn=nr=10,loudnorm=I=-20" -ar 22050 -ac 1 $W/ref.wav
# convert each vo<i>.mp3 from tts.py to 22050 Hz mono vo<i>.wav in $W/in, then:
HF_HUB_DISABLE_XET=1 python3 tools/clone_voice.py $W/src/MyShell-OpenVoice $W/ckpt $W/ref.wav $W/in $W/out
# convert $W/out/vo<i>.wav back to vo<i>.mp3 in the captions folder, then run build_vlog.py as usual
```

Check it worked: the median pitch (librosa.pyin) of the output should be near his recording (~105 Hz),
not the Google voice (~270 Hz). Rhythm and pronunciation stay Google's, so tell him it is "close", not identical.
The session must not be in Auto mode for the clone step; ask him to switch to Accept edits and approve it.

## Voiceover writing

First person, warm, simple spoken Bangla, one short sentence per scene. Describe the feeling, not the picture.
Leave one or two scenes without voice so the real sound comes through. End on a line that closes the story.
