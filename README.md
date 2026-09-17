# Cutbeat — AI reels, zero setup

An MVP for AI-assisted short-form video editing that runs entirely in the browser.
Pick templates and motion graphics, describe anything that's missing, drop in a few
clips, and the auto-editor cuts a 9:16 video that's built to hold attention — hook
first, cuts on the beat, graphics on the peaks — then exports a real MP4.

No plugins, no installs, no upload, no render queue.

```bash
npm install
npm run dev     # http://localhost:5173
```

Chrome or Edge recommended (Safari 17+ works). Firefox can browse and preview but
its WebCodecs encoder support is partial, so export may be unavailable.

---

## What actually works

| Flow | State |
| --- | --- |
| Template / motion-graphics library with live animated previews, search, filters | **Real** — 22 templates, all drawn in code |
| "Describe it" → generates an editable asset from a text prompt | **Real matcher, mocked as an API** (no model call) |
| Clip analysis: motion, audio, focus, exposure, novelty, scene cuts | **Real** — runs on decoded frames in the browser |
| Auto-edit → beat-synced EDL with an explanation for every decision | **Real** — rule-based director |
| Preview player with timeline, engagement score and attention curve | **Real** |
| MP4 export (H.264 + AAC, WebCodecs) | **Real** — ~2.5× faster than real time at 720p |
| Credits, tiers, checkout | **Stubbed** — localStorage, fake checkout |
| Publish to TikTok / Reels / Shorts | **Stubbed** — buttons explain what's missing |
| Generative video ("make me a clip of X") | **Stubbed** — escalation path, costed at 5 credits |

Three demo clips ship with the app. They're generated, not stock footage: a synthwave
drive with a speed ramp at 4s, a wave that breaks at 5.4s, and a skyline with firework
bursts at 2.7s and 7.2s. Each has genuine motion and audio peaks, so the analysis finds
real highlights rather than staged ones. Drag in your own footage any time.

---

## The two architectural bets

### 1. Motion graphics are code, not video files

Every template is a draw function over a fixed 1080×1920 design space plus a typed
parameter list (`src/motion/templates/`). That decision pays for itself three times:

- **Previews are free.** A card renders the real asset at any size, live.
- **Generation becomes tractable.** "Describe it" doesn't have to synthesise pixels —
  it picks a template and fills in parameters. Instant, free, deterministic, and the
  text stays text, so it's still editable afterwards.
- **Exports stay sharp.** The same function renders at 720p or 4K.

The cost is expressiveness: the library can only draw what the engine can draw. That's
why the generative-video path exists as a paid escalation rather than the default.

### 2. Everything renders in the browser

Decode (mediabunny + WebCodecs), analyse, composite (Canvas 2D) and encode
(WebCodecs → MP4) all happen locally.

- No upload wait, which is the thing that actually makes web editors feel slow.
- ~$0 marginal cost per video, which is what makes a credit model have any margin.
- Clips never leave the machine.

The cost: Chromium/Safari-first, and long or 4K renders will hurt on a weak laptop.
The EDL (`src/edit/types.ts`) is the contract between every stage, so a server-side
renderer can be added later for heavy jobs without touching the director or the UI.

---

## How "engaging" is defined

The auto-editor is a hybrid: signal processing decides *where* the good moments are,
the music grid decides *when* cuts land, and rules decide the *shape* of the story.

**1. Analyse** (`src/analysis/analyze.ts`) — frames are sampled at 6fps and reduced to:

| Signal | How | Why it matters |
| --- | --- | --- |
| Motion energy | mean abs frame difference | movement holds attention |
| Motion centroid | x-weighted difference | drives smart 9:16 cropping |
| Sharpness | Laplacian energy | rejects out-of-focus shots |
| Exposure | mean luma, scored against a sweet spot | rejects dark/blown-out shots |
| Novelty | χ² distance between colour histograms | detects scene changes |
| Audio energy + onsets | RMS envelope, rise over local average | a spike usually marks the payoff |

**2. Score moments** — sliding 1.4s windows, non-max suppressed:

```
engagement = 0.34·motion + 0.20·audio + 0.14·novelty + 0.18·sharpness + 0.14·exposure
           − penalties (underexposed, soft focus, static, cut in the middle)
```

**3. Direct the cut** (`src/edit/director.ts`):

- The single best moment opens the video, positioned so the payoff lands ~0.4s in.
- Every following shot is chosen to match a target **energy arc** — hook, breather,
  build, peak around 75%, payoff — rather than just descending quality order.
- Shot lengths follow the style's pacing curve (e.g. 1.1s → 0.62s), then snap to the
  music's beat grid. Because the music is synthesised, the BPM is exact.
- Same-clip repeats and reused source ranges are penalised; punch-ins go on the peaks;
  transitions are chosen from the style's palette when the energy delta is large.
- Captions are split from your script and stretched to beat boundaries, placed at 66%
  height to stay clear of platform UI.

**4. Report** (`src/edit/score.ts`) — hook strength, pacing vs. the style's target,
beat-sync %, variety (entropy of clips/effects/transitions), payoff, plus an attention
curve that decays between cuts and lifts on cuts, graphics and motion peaks. Flat
stretches are flagged as retention risks you can click to jump to.

Every step writes to a decision log, so the editor explains itself in the UI instead of
being a black box. Same seed → same edit; "New variation" just changes the seed.

---

## Where an LLM slots in

Deliberately not used yet — models are weak at frame-accurate timing and the
deterministic path is instant, free and reproducible. The two places it earns its keep:

1. **`chooseMoment`** — semantic ranking ("the dog catches the frisbee" beats "camera
   shakes") from keyframes via a vision model, feeding the same moment scores.
2. **`buildCaptions`** — writing the words. Pair with Whisper for real transcription;
   the caption cue structure already supports word-level timing.

`src/services/generate.ts` mirrors the response shape a model endpoint would return,
so swapping the matcher for a real call is a change to one file.

---

## Project layout

```
src/
  motion/       # template engine + 22 motion-graphics templates (pure draw functions)
  media/        # clip sources (generated + uploaded), synthesiser, demo scenes, music
  analysis/     # frame & audio signal extraction, moment scoring
  edit/         # EDL types, edit recipes, the director, the engagement report
  render/       # compositor, transitions, preview player, audio mix, MP4 exporter
  services/     # describe-it generator (mock), billing (stub)
  state/        # zustand store
  ui/           # views and components
```

Stack: Vite + React + TypeScript + Tailwind v4 + zustand + mediabunny. No backend.

---

## Known gaps / next steps

- **Credits are client-side.** Before launch the balance and the export gate must move
  server-side; anything in localStorage is a suggestion, not a paywall.
- **No transcription**, so captions come from a script you paste rather than speech.
- **Manual editing is minimal.** You can regenerate, reseed, change recipe/music/length
  and edit any asset's parameters, but there's no drag-to-trim on the timeline yet.
- **Long-form and 4K** will strain low-end devices — that's the case for adding the
  server-side renderer behind the same EDL.
- **Keep the tab in front while exporting.** Chrome throttles background tabs, which
  slows decode and offline audio rendering considerably.
- **Export speed depends on the source.** Generated demo clips render ~2.5× faster than
  real time at 720p; real footage is slower because every frame has to be decoded.
- **Publishing** needs OAuth with each platform.
