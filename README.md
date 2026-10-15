# LocalFilm Multi-Track Studio DAW (Standalone Edge Edition)
**Deployment Target:** `https://studio.localfilm.online`  
**Host Architecture:** Cloudflare Pages / Workers Sites  
**Version:** 1.7.9

A 100% self-contained, browser-native Digital Audio Workstation (DAW) for film sound designers, podcasters, and audio engineers across Ireland and worldwide.

---

## 🚀 Key Features

1. **Pre-Flight Audio Ingestion Specs & Technical Metadata Inspector**:
   - Inspect container formats (`WAV`, `MP3`, `AAC`, `FLAC`, `OGG`, `WEBM`).
   - Exact sample rate detection (`44.1 kHz`, `48 kHz SMPTE`, `96 kHz Hi-Res`).
   - Bit depth (16-bit / 24-bit PCM) & bitrate estimation.
   - Peak amplitude detection (dBFS) and dynamic headroom safety alerts.
   - 80-bar waveform visualizer with pre-timeline audition player.
   - Configurable destination track & timeline placement (Playhead, 00:00, End of Clips).

2. **10 Native Web Audio DSP Plugins (Zero CDN Dependencies)**:
   - 4-Band Broadcast Parametric EQ with 80Hz rumble cut.
   - 50Hz (Ireland/Europe) & 60Hz (US) surgical electrical ground loop de-hum notch filters.
   - Vintage Compressor Modeling: Teletronix LA-2A (opto), UREI 1176LN (FET punch), SSL G-Master Bus (mix glue).
   - Precision Vocal De-Esser (4.5kHz - 8.5kHz sibilance tamer).
   - Studio Noise Gate & Expander.
   - Algorithmic Space Reverb (Booth, Studio, Plate, Broadcast Hall).
   - Analog Tape Warmth / Saturation (polynomial WaveShaper).
   - Stereo Echo Delay with tempo synchronization.
   - Chorus & Spatial Ensemble Modulation.
   - Stereo Acoustic Widener & Broadcast Peak Limiter (-0.5 dBFS ceiling).

3. **Multi-Track Editing & Precision Film Sound Tools**:
   - 2D multi-clip dragging and track reparenting.
   - Left/right edge audio trimming and slip-editing (`Alt + Drag`).
   - Corner fade-in & fade-out curve handles with SVG shading.
   - Multi-clip selection (`Shift/Ctrl/Cmd + Click`).
   - Magnetic snapping (grid lines, adjacent clip boundaries, musical beat divisions).
   - Non-destructive 50-step Undo / Redo engine (`Cmd+Z` / `Cmd+Y`).
   - Floating, dockable Master VU Meter window (`F8`).
   - Tasteful themes: Obsidian Dark (Default), Cinema Monochrome B&W, Matrix Phosphor Green.
   - SMPTE timecode (24fps cinema, 25fps PAL, 29.97/30fps broadcast).
   - In-app Audio Plugins Directory drawer (`Ctrl+Alt+P`).

4. **Master Rendering & Stems Export**:
   - OfflineAudioContext master WAV mixdown rendering with broadcast normalization.
   - Pure JS PKZIP multi-track stem bundler exporting all active tracks as `.zip`.

---

## ⚡ Deployment to Cloudflare (`studio.localfilm.online`)

### Option 1: Cloudflare Pages (Recommended - 1 Command)
```bash
cd /Users/alanjoyce/Desktop/standalone_daw
npx wrangler pages deploy dist --project-name localfilm-studio
```
Then in the Cloudflare Dashboard under **Workers & Pages -> localfilm-studio -> Custom Domains**, add:
`studio.localfilm.online`

### Option 2: Git-Connected Cloudflare Pages
1. Push this directory to GitHub (e.g. `github.com/alanjoyce/standalone-daw`).
2. Connect the repo in Cloudflare Pages:
   - **Framework Preset**: None (or Vite)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
3. Bind domain to `studio.localfilm.online`.

---

## 💻 Local Development
```bash
cd /Users/alanjoyce/Desktop/standalone_daw
npm run dev
# Opens at http://localhost:3030
```

To build production bundle:
```bash
npm run build
# Outputs to ./dist
```
