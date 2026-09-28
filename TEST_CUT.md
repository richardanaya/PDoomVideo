# Test cut: "Claude Pop" hook (short capability test)

A ~13 s papery p5.js / p5.brush cut, with big lyric motion graphics as the hook, rendered from this repo's pipeline over
chorus 1 of the existing song (`assets/pdoom.mp3`, 23.0–35.9 s). It checks that we can ship the eventual *Claude Pop* look:
readable kinetic type, brush-and-paper texture, K-pop-style cutting and rising intensity. No generative video or TTS
services are involved; everything is canvas code.

- **Artifact:** [`artifacts/test_hook.mp4`](artifacts/test_hook.mp4): 1920×1080, 24 fps, H.264 + AAC, 12.9 s, 23 MB,
  with the synced audio slice (song 23.0–35.9 s), a 40 ms fade-in and a 350 ms fade-out
- **Stills:** [`artifacts/test_hook_frames/`](artifacts/test_hook_frames/) (nine full-res frames taken from the MP4) and
  [`artifacts/test_hook_sheet.jpg`](artifacts/test_hook_sheet.jpg) (a contact sheet from the MP4, one frame every 0.5 s)
- **Code:** [`src/ch/test_hook.js`](src/ch/test_hook.js), registered with `cut('test_hook', 23.0, 35.9, shots)`

## What's in it

The cut follows the song's measured drum grid rather than the 88 BPM grid in `core.js`. An onset scan of the MP3 shows
kicks at **132 BPM**, with kick *n* at `23.87 + n × 0.4545` s. The chorus drop ("P(DOOM)") lands on kick 0, right after a
near-silent break at 23.0–23.15 s, which is where the cut opens.

| Song time | Lyric | Shot | Length |
|---|---|---|---|
| 23.00–23.87 | I'm upping my | **Cold open** in the silence. A blinking prompt cursor, then I'M / UPPING / MY are stamped in ink with clay splats. Tiny Clawd wakes and looks up at each word. The camera sucks in before the drop. | 0.87 s |
| 23.87–24.50 | P(doom) | **The drop.** A cream flash, and "P(DOOM)" slams over an ink swash on a rose/ochre ray burst. Clawd erupts from below with star eyes, and an 8% → 13% sticker pops on the kicks. | 0.63 s |
| 24.50–25.69 | 'cause the future goes | **The curve.** A hand-drawn chart, and Clawd pogo-pumps a bicycle pump (slams on every kick) to push an exponential curve up. The percentage at the tip climbs; the type builds on a torn-paper strip. | 1.19 s |
| 25.69–26.50 | FOOM | The curve goes vertical. Clawd rides the tip skyward through ochre → rose → violet, and giant F-O-O-M letters blast apart over a starburst. | 0.81 s |
| 26.50–28.00 | Trapped in the Chinese room | A paper room whose walls close in on each kick, squeezing the type. Scared Clawd presses outward while rule slips fly in. | 1.50 s |
| 28.00–29.33 | with a bag of shrooms | Rainbow rings flow outward, mushrooms pop on eighths, swirl-eyed Clawd floats, and SHROOMS wobbles letter by letter. | 1.33 s |
| 29.33–31.15 | See through the | **Beat-cut montage** (2 beats each): the smiley mask with SEE / THROUGH, then a suspicious extreme close-up of Clawd with SHOGGOTH'S typed on. | 0.91 s ×2 |
| 31.15–32.06 | shoggoth's lies | 1 beat each: the mask cracks, then the halves fall away to reveal a many-eyed blob behind LIES. | 0.45 s ×2 |
| 32.06–33.42 | (lies) | **Strobe peak:** LIES in three alternating colourways (eyes, falling mask halves, Clawd), cut on eighths and then sixteenths while zooming in, into a red flash. | 0.23 → 0.11 s |
| 33.42–35.24 | with your shinigami eyes | Crimson close-up. SHI-NI-GA-MI stamps by syllable and the red eyes flare. On EYES the camera dives into one eye, and a red iris closes. | 1.82 s |
| 35.24–35.90 | — | End card: CLAUDE POP on a rose brush swash, and tiny Clawd bows. | 0.66 s |

How it gets its look:
- **Type as the hook.** A private kinetic-type layer in `test_hook.js` draws Anton for impact words and Permanent Marker
  for asides. Words have ink drop-shadows and outlines, pop with overshoot, and have dry-brush streaks that boil at 12 fps.
  The type is composited *into* the painting, so the paper grain and vignette sit on top of it.
- **Paper.** Flat washes, low-poly watercolour blots, torn strips, ink splats and p5.brush charcoal hatching on the swashes.
- **Acceleration.** Shots go from 0.9–1.8 s at the start, to one or two beats in the montage, to eighths and then
  sixteenths in the strobe. The palette heats up from cream → rose/ochre → teal → crimson, and the chart's P(doom) keeps
  climbing.

## Re-rendering

You need Node.js, Google Chrome and ffmpeg (all present on the Cursor cloud VM).

```bash
npm install
# the cut (23.0–35.9 s) with its audio slice; 9.5 min on the 4-core cloud VM with no GPU (~2.1 s/frame effective)
node render.mjs --cut=test_hook --workers=3 --out=artifacts/test_hook.mp4
# stills and a contact sheet from the MP4
ffmpeg -ss 0.95 -i artifacts/test_hook.mp4 -frames:v 1 -q:v 3 out/drop.jpg
ffmpeg -i artifacts/test_hook.mp4 -vf "fps=2,scale=400:-1,tile=6x5:padding=4:color=0x1b1820" -frames:v 1 out/sheet.jpg
# quick checks
node render.mjs --cut=test_hook --sheet=23.3,23.95,25.3,25.9,27.6,28.9,29.9,31.8,32.5,34.5,35.1,35.6 --cols=4 --w=480 --out=out/check/hook.jpg
node render.mjs --cut=test_hook --stills=24.2,26.0,34.6 --out=out/check/hook_stills
```

In the browser, open `studio.html?cut=test_hook&t=24` to scrub the cut.

Notes:
- **Linux / no GPU:** `render.mjs` now defaults to `/usr/bin/google-chrome` and ANGLE on desktop GL on Linux. On a
  GPU-less VM that means Mesa llvmpipe, which here set up in about 6 s and averaged roughly 2 s per frame for this cut.
  SwiftShader (`--gl=swiftshader`) also works but is about 5× slower. Windows keeps `d3d11`; `--chrome=` and `--gl=`
  override both defaults.
- **Cuts:** `cut(name, start, end, shots)` in `timeline.js` registers a standalone edit. With `--cut=<name>`, `drawWorld`
  paints only that cut, in song time so the audio slice stays in sync, and skips the karaoke bar, the corner meter and
  the wipes. The full video (`--frames` / `--encode`) is unchanged.
- `--workers=N` now parallelises `--clip` / `--cut` renders. Frames are still piped to ffmpeg in order.
