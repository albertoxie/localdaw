# Breadcrumbs: Standalone DAW Fullscreen & Menu Fixes

## [v1.8.25] - 2026-10-10: Real-Time Live Waveform Generation During Recording & Apple Pro Dark Palette Overhaul
- **Real-Time Live Recording Waveform Engine**:
  - Connected active mic stream to `AudioContext` `MediaStreamAudioSourceNode` and `AnalyserNode` during timeline voice-over recording.
  - Dynamically sampled time-domain peaks and rendered live mirrored waveform bars on high-DPI HTML `<canvas>` embedded in `dawRecordingClipEl`.
  - Live waveform renders in real time as the playhead advances at the active zoom rate, eliminating the blank red box.
- **Apple Pro Dark / Logic Pro Color Scheme Overhaul**:
  - Replaced AI saturated purple, cyan, gold, and neon pink/red across the entire workstation.
  - Implemented Apple Pro Studio Graphite base (`#161618`), Recessed Wells (`#121214`), Titanium panels (`#1c1c1e` - `#242426`), and 1px hairline borders (`rgba(255,255,255,0.08)`).
  - Applied functional Apple system accents: Apple Studio Blue (`#0a84ff`), Signal Green (`#30d158`), Analog Amber (`#ff9f0a`), Apple Studio Red (`#ff453a`).
  - Calibrated track colors to Logic Pro muted audio palette.

## [v1.8.24] - 2026-10-10: Master Mixdown renderTakeInventory Bugfix, Double-Size Welcome Screen & Neil Horner & Niall Hanlon VIP Recognition
- **Master Mixdown renderTakeInventory Bugfix**:
  - Guarded `renderTakeInventory()` with `if (typeof renderTakeInventory === 'function') renderTakeInventory();` in `src/main.js` and `src/components/PodcastNetwork.js`, eliminating `Can't find variable: renderTakeInventory` during master bounce.
- **Double-Sized Studio Welcome Screen (`#daw-beta-welcome-modal`)**:
  - Expanded modal dimensions to `max-width: 980px; width: 92vw; padding: 42px 48px; border-radius: 24px;`.
  - Bumped release badge to `BUILD v1.8.24 · PRO STUDIO RELEASE (2026-10-10)`.
  - Expanded typography: Headline `28px`, Subtitle `18px`, and full-width broadcast feature grid with 4 detailed cards.
  - Added VIP Tester Recognition banner honoring **Neil Horner** and **Niall Hanlon** at the bottom of the welcome screen.
  - Linked welcome screen to Help menu so users can reopen it anytime.
- **Apple Pro Dark Palette Architecture**:
  - Proposed transition from saturated AI purple/cyan/gold glow to Apple Pro Logic / Final Cut Pro titanium, neutral dark grays, and functional Apple system accents.

## [v1.8.22] - 2026-10-10: DAW Empty-on-Boot Sessions & Dynamic Double-Click Track Addition / Deletion
- **Clean Slate DAW Session Initialization**:
  - Initialized session state `daw.tracks = {}` and `daw._recordTrackId = '__new__'`, giving creators a clean canvas empty of tracks on launch.
  - Decoupled `_openTimelineEditor` from forced auto-population loops.
  - Replaced empty-timeline playback audio generation with a helpful prompt toast (`Timeline is empty — double-click track area to add tracks or import audio`).
  - Gated IndexedDB restoration routines against automatic demo stem synthesis.
- **Dynamic Double-Click Track Addition**:
  - Engineered `addNewEmptyTrack(type = 'audio')` with automatic rotating color coding, default DSP racks, stereo channel layout, undo history snapshotting, and instant synchronization with bottom deck devices.
  - Bound `dblclick` event listener on empty areas of `#daw-track-headers-container`, `#daw-track-lanes-container`, `#timeline-lanes-container`, and `#daw-deck-mixer-strips-container` (outside channel strips and master strip) to immediately invoke `addNewEmptyTrack('audio')`.
- **Double-Click Track Deletion with Safety Confirmation & Undo**:
  - Engineered `deleteTrackPrompt(trackKey)` with safe studio confirmation modal (`showStudioConfirm`), audio clip cleanup, active FX track reassignment, recording arm reassignment, and undo history snapshot (`pushDawHistory('Delete Track')`).
  - Bound `dblclick` listener on track headers (`.daw-track-header`) and mixer strips (`.daw-mixer-strip`) to trigger deletion prompt.
  - Removed `isCustom` condition from track header delete buttons (`&times;`), exposing track deletion across all tracks in the session.
- **Dynamic Empty States for Timeline & Mixer**:
  - High-contrast, accessible empty state cards in `#daw-track-headers-container` and `#daw-track-lanes-container` when zero tracks exist in the session.
  - High-contrast empty state placeholder card in `#daw-deck-mixer-strips-container` beside the master bus strip when zero tracks exist.
  - Hardened `syncActiveTrackToDeck` to gracefully display `NO TRACK` and bypass DSP device previews without errors when no tracks are present.
  - Hardened audio file ingestion to automatically auto-create a track via `addNewEmptyTrack` if no tracks exist when inserting clips.
- **Cloudflare Pages Production Deployment (`localdaw.com`)**:
  - Built with Vite (`npm run build`) in 446ms and deployed live to Cloudflare Pages edge (`localdaw.com`, `www.localdaw.com`, `localfilm-studio.pages.dev`).

## [v1.8.20] - 2026-10-10: LOCALDAW PRO Top Menubar Header, About Alan Joyce & LocalFilm Modal with Release Changelog & Cloudflare Pages Deployment
- **LOCALDAW PRO Top Menubar Header Redesign**:
  - Embedded sleek illuminated brand identity badge at the start of `#daw-desktop-menu-bar` with the official LocalFilm white stroke logo icon, bold `LOCALDAW` typography, and cyan `PRO` badge.
  - Formatted all desktop menubar buttons in professional uppercase separated by subtle hairline vertical pipes: `FILE | EDIT | TRACKS | EFFECTS | VIEW | TRANSPORT | HELP`.
  - Added Help dropdown About item featuring the LocalFilm logo and `v1.8.20` version pill.
  - Added right-aligned `v1.8.20` build indicator badge alongside `STUDIO MODE`.
- **About Alan Joyce & LocalFilm Modal with Release Changelog**:
  - Replaced legacy static About popup with dual-tabbed modal:
    - **Tab 1: Founder Vision & Story**: Highlighting Alan Joyce's founding vision, localfilm.online mission, sovereign creative audio infrastructure, and community support across Ireland's 32 counties.
    - **Tab 2: Release Changelog**: Interactive version log detailing v1.8.20, v1.8.19, v1.8.18, v1.8.17, v1.8.16, and foundation milestones.
- **Cloudflare Pages Deployment & Custom Domain Routing (`localdaw.com`)**:
  - Synchronized standalone codebase, rebuilt with Vite (`npm run build`), and deployed live to Cloudflare Pages project `localfilm-studio` (`https://localfilm-studio.pages.dev`).
  - Added custom domains `localdaw.com` and `www.localdaw.com` to Cloudflare Pages with SSL certificate automation.
  - Programmatically provisioned CNAME records for `@` and `www` pointing to `localfilm-studio.pages.dev` (proxied: true) using the authenticated Cloudflare API.
  - Cloudflare Pages domain status verified: `status: "active"`. Live testing confirmed HTTP/2 200 on `https://localdaw.com` and `https://www.localdaw.com`.


## [v1.8.18] - 2026-10-09: Mixer Console Real-Time Faders & Rotary Pan Dials, Dedicated Master Output Strip, Compressor Models & EQ HUD
- **Mixer Console Real-Time Audio Modulation & Rotary Pan Dials**:
  - Wired live `updateTrackBusLive(trId)` and `refreshAllTrackBusMutes()` to all mixer console controls. Fader adjustments, mutes, and solos now smoothly modulate Web Audio nodes in real-time with zero DOM thrashing.
  - Added 22px dark CNC rotary pan dials (`.track-pan-dial-knob`) with needle indicator (±135°), 8% center snap, and compact monospace readout badge (`C`, `L35`, `R50`) to every mixer strip. Double-clicking resets to Center.
- **Dedicated Pinned Master Output Strip (`#daw-mixer-master-strip`)**:
  - Anchored a master console strip on the right with dual vertical peak VU meters (Left + Right, animated at 60fps in `tick()`), master vertical fader (`#daw-deck-mixer-master-fader`), master mute `[M]`, and true centered mono downmix toggle `[MONO]`.
- **Keyboard Shortcut `B` Exclusivity**:
  - Removed `B` from `splitSelectedClip()`, reserving `S` strictly for Split Clip and making `B` exclusively toggle the Bottom Studio Deck.
- **Clip Inspector Deselection & Deletion Cleanup**:
  - Automatically clears stale metadata and waveform buffers in the Clip Inspector when clips are deleted, deselected via menu, or when clicking empty timeline space.
- **Interactive Compressor Model Selector**:
  - Converted `#daw-deck-comp-model-badge` into an interactive 1-click cycler supporting `MODERN` (Clean VCA), `LA-2A (OPTO)` (Vintage optical leveling), `1176 (FET)` (Ultra-fast peak punch), and `SSL (VCA)` (Mix glue). Automatically sets attack/release/knee and rebuilds the active track bus.
- **Parametric EQ FabFilter-Style HUD Tooltip**:
  - Added real-time floating dark-glass HUD tooltip on EQ canvas displaying exact frequency and dB gain (`120 Hz · +3.0 dB`) when hovering or dragging filter nodes.

## [v1.8.17] - 2026-10-09: HiDPI Retina Crisp Canvases, Interactive EQ Filter Response Curve, and Draggable Dynamics Knee
- **HiDPI Retina Crisp Canvas Engine (`setupCrispCanvas`)**:
  - Eliminated blurriness and pixelation across bottom studio deck canvases (`#daw-deck-eq-canvas`, `#daw-deck-comp-canvas`, `#daw-deck-clip-canvas`).
  - Replaced hardcoded width/height attributes (stretched across wide screens) with dynamic `setupCrispCanvas(canvas)` taking `window.devicePixelRatio` (2x on Retina, 3x on 4K), setting high-res bitmap buffer dimensions, and applying `ctx.scale(dpr, dpr)`.
  - Added resize listener and deck resize bar listener to redraw crisp canvases on any viewport change.
- **Dynamic Bending EQ Response Curve**:
  - Fixed inert/dead-flat 0 dB EQ curve: removed bypass guard `if (!isEqOn) return 0;` from `calcGainAtFreq()` so the curve always responds dynamically to node positions.
  - Automatically enables `tr.plugins.eq.enabled = true` when dragging any EQ node or clicking on the canvas.
  - Fixed node dragging coordinates and added click listener to `#daw-deck-eq-toggle-btn`.
- **Interactive Compressor Knee & Telemetry**:
  - Fixed coordinate bug in dynamics knee drag (`rect.top`).
  - Added click listener to `#daw-deck-comp-toggle-btn`.
  - Fixed `tick()` telemetry error where `daw.tracks.find()` was called on an Object instead of Array, restoring real-time gain reduction needle and bouncing audio ball.

## [v1.8.15] - 2026-10-09: Docked Bottom Studio Deck, High-Res Studio Waveforms, Timeline Precision Grid, and Track DSP Badges
- **Integrated Docked Bottom Studio Deck (`#daw-bottom-studio-deck`)**:
  - Replaced the massive 65% black empty void below the track lanes with an Ableton / Logic Pro style dockable studio panel with resizer handle (`#daw-bottom-deck-resizer`).
  - Three integrated views:
    1. **`[ ⚡ TRACK DSP DEVICES ]`**: Directly embeds the selected track's interactive Parametric EQ Canvas and Dynamics Compressor Transfer Curve with live telemetry, plus active channel strip macros.
    2. **`[ 🎚️ MIXER CONSOLE ]`**: Docked full-size vertical channel strips side-by-side with tall VU meter bars, volume faders, rotary pan pots, and illuminated M/S buttons.
    3. **`[ ✂️ CLIP EDITOR ]`**: High-precision waveform zoom inspector for selected takes.
- **Studio High-Resolution Audio Waveform Engine**:
  - Eliminated crude rounded "sausage" polygon shapes in audio clips.
  - Replaced with genuine broadcast-grade transient peak bars, center zero-crossing line (`rgba(255, 255, 255, 0.18)`), RMS density shading, and crisp decibel bounds.
- **Timeline Precision Vertical Grid Lines**:
  - Rendered subtle vertical calibration grid lines (`rgba(255, 255, 255, 0.04)`) across all lanes aligned with ruler time increments (1s / 0.5s snap), giving the workspace industrial depth.
- **Track Header Active Plugin Badges (`.track-fx-badge-pill`)**:
  - Added illuminated micro-badges on track headers (`[EQ]`, `[CMP]`, `[REV]`, `[LIM]`) showing active DSP processing at a glance without opening modals.

## [v1.8.14] - 2026-10-09: User Custom Presets, Collapsible Module Accordions, Limiter Visual Attenuation, and Master LUFS Target
- **User Custom Presets Library (`saveUserFxPreset`, `deleteUserFxPreset`, Export/Import `.fxchain`)**:
  - Added 1-click Save Preset dialog saving active 10-module parameters with custom names into `localStorage` (`localfilm_daw_custom_fx_presets`).
  - Added user presets `<optgroup label="── USER PRESETS ──">` to Channel Strip selector.
  - Added instant JSON Export and Import for sharing `.fxchain` channel strip setups across workstations.
- **Collapsible Module Accordions & Focus Mode (`.daw-fx-module`)**:
  - Added collapsible toggle headers across all 10 DSP modules with dynamic chevrons (`▾` / `▸`) and individual power bypass indicators.
  - Added top-level `[▾ Expand All]` / `[▸ Collapse All]` toggle in the DSP header to streamline workflow and eliminate scrolling fatigue.
- **FabFilter Pro-L 2 Style Peak Limiter Gain Reduction Meter (`#daw-fx-limiter-gr-fill`)**:
  - Live visual attenuation meter ($0\text{ dB}$ down to $-12\text{ dB}$) in Module 10 calculating real-time peak compression vs brickwall ceiling.
- **Master VU Meter EBU R128 Loudness Target Selector & Compliance Needle**:
  - Added interactive target toggle (`TARGET: -14 LUFS (Streaming)` / `-24 LUFS (Cinema)` / `OFF`).
  - Dynamic horizontal target needle plotted across twin VU meter channels with live compliance feedback (`ON TARGET`, `HOT`, `LOW`).

## [v1.8.13] - 2026-10-09: Zero-Tear AudioParam Modulation, True-Peak Clip Latch, and Pro Visual Dynamics Suite
- **Root Cause of Audio Artifacts & "Struggling / Clipping" Feeling**:
  - Whenever any slider was dragged or an EQ curve node was moved, `notifyFxParamChange()` tore down the entire live Web Audio graph (`disconnect()` input/output, recreating 10+ Web Audio nodes and allocating 44,100 samples in Float32Array per pixel of mouse drag).
  - These constant stream disconnects caused sample buffer zero-drops (dc offsets, micro-stutters, and clicks/pops) that sounded like digital distortion or clipping even when audio levels were below 0 dB.
- **Architectural Solution (Zero-Tear In-Place AudioParam Modulation)**:
  - Added `getFxTopologyKey(p)` to track plugin enablement and circuit topologies.
  - Upgraded `buildTrackPluginChain` to permanently instantiate all enabled module filters and makeup gain nodes, returning direct references in `nodes` map.
  - Implemented `smoothApplyFxParams(fxChain, p, audioCtx)` using `AudioParam.setTargetAtTime(target, now, 0.015)` (15ms smooth exponential ramps).
  - When dragging any slider or EQ canvas node, `notifyFxParamChange(false)` checks that topology hasn't changed and applies parameters directly in-place. Graph teardown and recreation are eliminated completely!
- **Diagnostics & Visual Telemetry (Answer to "How do we see what that might be and make it more visual?")**:
  1. **True-Peak Digital Clip Latch LED (`#daw-fx-clip-indicator`)**: Added to FX rack top bar. Monitors sample peaks at 60fps; latches red `[CLIP 0.0dB!]` if signal reaches $\ge 0.0\text{ dBFS}$. Clicking resets back to `[CLIP 0dB OK]`, proving conclusively whether audio is clipping or healthy.
  2. **DSP Engine Health Pill (`#daw-fx-dsp-health-pill`)**: Live clock monitor showing sample rate and buffer health (`48k · 0 DROPS`).
  3. **FabFilter Pro-C 2 Style Compressor Dynamics Transfer Curve Canvas (`#daw-fx-comp-canvas`, 414x72)**: Mathematical 2D graph with soft quadratic knee curve, 1:1 unity dashed guide, threshold diamond, and live bouncing audio ball with vertical attenuation needle showing real-time gain reduction.
  4. **Dynamic Vocal De-Esser Sibilance Reduction Meter (`#daw-fx-deesser-gr-fill`)**: Real-time attenuation dipping bar ($0\text{dB}$ to $-18\text{dB}$) in Module 6.
  5. **Stereo Acoustic Phase Correlation Meter (`#daw-fx-phase-corr-fill`)**: Measures mono-compatibility and stereo phase alignment ($+1.0$ mono to $0.0$ wide to $-1.0$ anti-phase) in Module 9.
- **Deployment**: Live on Cloudflare Pages at `https://localfilm-studio.pages.dev` and `https://studio.localfilm.online` (deployment hash `https://4a25ee32.localfilm-studio.pages.dev`).

## Date: 2026-10-07
- Target: `/Users/alanjoyce/Desktop/standalone_daw`
- Subdomain: `studio.localfilm.online`
- Cloudflare Pages URL: `https://localfilm-studio.pages.dev`

## Key Fixes
1. **Full Viewport Fullscreen (100vw x 100vh)**:
   - Wrapped inner modal markup inside `<div id="podcast-editor-modal">` in `index.html`.
   - Added fullscreen CSS overrides to reset margin, border-radius, and bounds to exact window width/height (`position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important;`).
2. **Interactive Desktop Menus (`File`, `Edit`, `Tracks`, `Effects`, `View`, `Transport`, `Help`)**:
   - `setupDawMenuBar()` bound to DOM elements.
   - Dropdowns styled with `position: absolute !important; z-index: 99999 !important; background: #090c14;`.
   - Added hover-switching between menus when any menu is open.
3. **Audio Pre-flight Ingestion Specs**:
   - Retained full audio inspector modal (`#daw-audio-inspect-modal`) for inspecting sample rate, duration, channels, bitrate, peak dB, RMS before timeline ingestion.
4. **Cloudflare Deployment**:
   - Built with Vite into `dist/`.
   - Deployed to Cloudflare Pages project `localfilm-studio`.
   - Attached custom domain `studio.localfilm.online` to the Pages project.

## Fix Update (2026-10-08): Menu Bar Double-Binding & Dropdown Overflow
- **Root Cause**: `setupDawMenuBar()` was being executed multiple times during boot (`initStandaloneDaw`), attaching duplicate click event listeners to each menu button. When a menu button was clicked, Listener 1 opened the dropdown (`display = 'block'`), and immediately Listener 2 saw it open and closed it (`display = 'none'`), making the menu appear completely unresponsive.
- **Fix Applied**:
  1. Added an idempotency latch `let _dawMenuBarInitialized = false;` in `setupDawMenuBar()` to prevent duplicate event listener bindings.
  2. Removed redundant `setupDawMenuBar()` call at the bottom of `initStandaloneDaw`.
  3. Removed `overflow: hidden`, max-width, and max-height constraints on the inner container in `index.html` and `studio.css`, ensuring dropdown menus can freely render across the viewport without clipping.
- **Verification**: Simulated real mouse click, hover traversal, submenu actions (Shortcuts modal, Inspector, Track ops), and document-click dismiss in JSDOM. All passed 100%.
- **Deployment**: Rebuilt with Vite and deployed live to Cloudflare Pages (`https://localfilm-studio.pages.dev`).

## Fix Update (2026-10-08): Master Mix Render, Timeline Placement, Full 0px Sidebar Collapse & Draggable Resizer
- **Problem 1: Master Mix Render Failure (`audioBufferToWav is not defined`)**:
  - `executeMasterMixdownDAW` and `exportAllStemsZipDAW` called `audioBufferToWav()` and `createZipBlob()`, but their helper functions were omitted when extracting the standalone DAW bundle.
  - **Fix**: Added zero-dependency 16-bit PCM RIFF WAVE Blob encoder `audioBufferToWav` and multi-file PKZIP generator `createZipBlob` directly into `src/main.js`.
- **Problem 2: InvolvedFM Member Workflow — Render Directly onto Timeline**:
  - Rendering mixes or takes previously only went into the Session Take Inventory folder.
  - **Fix**: Added `[x] Place rendered Master Mix directly on Timeline as a new Track` to the Render Master Mixdown modal (`#daw-export-add-to-timeline`). When checked, completing the render creates a new dedicated audio track (e.g. `Master Episode Mixdown [Master]`) and adds the rendered mix clip with peaks directly onto the timeline at time `00:00` (or the active punch-in marker).
- **Problem 3: Sidebar Not Collapsing Completely & Fixed Layout**:
  - The track headers sidebar was previously constrained to `width: 58px` in collapsed state, preventing users from maximizing workspace. The layout was also rigid with fixed widths.
  - **Fix**:
    1. Upgraded `.daw-track-sidebar-collapsed` to `width: 0px !important`, hiding track headers completely and giving 100% full width to the timeline viewport.
    2. Added a floating expand tab button (`#daw-sidebar-expand-tab`) on the top-left edge that appears when collapsed to restore the sidebar with one click.
    3. Added a collapse toggle button with SVG chevron icon (`#daw-sidebar-toggle-btn`) directly on the sidebar header next to the track count badge.
    4. Added a draggable horizontal split divider (`#daw-sidebar-resizer`) between the sidebar and the timeline viewport. Users can now click-and-drag to freely slide and adjust the width of the tracks sidebar (between 110px and 500px, or dragging below 45px snaps it shut to 0px). Double-clicking the resizer bar toggles collapse.
- **Deployment**: Successfully rebuilt with Vite and deployed live to Cloudflare Pages (`https://localfilm-studio.pages.dev` / `https://studio.localfilm.online`).

## Fix Update (2026-10-08): Draggable Track Height, 100% Full-Width Timeline, Always-On Dockable/Floating VU Meter & Reset UI Layout
- **Problem 1: Fixed / Non-Draggable Track Height**:
  - Track lane heights could only be cycled via discrete buttons or presets, without the fluid mouse-drag flexibility found on the sidebar width splitter.
  - **Fix**: Added interactive horizontal resizer handles (`.daw-lane-height-resizer`) along the bottom border of every track header and timeline lane with `cursor: row-resize`. Clicking and dragging vertically dynamically resizes all track lanes simultaneously (clamped smoothly between 44px and 240px). Double-clicking any resizer handle immediately snaps the lane height back to the studio standard default of 74px.
- **Problem 2: Fixed Timeline Width & Dead Space (1400px)**:
  - The timeline ruler and lanes were constrained by hardcoded `min-width: 1400px`, which either caused dead space on ultra-wide screens or truncated width.
  - **Fix**: Replaced fixed 1400px constraints with `min-width: 100%; width: 100%` on `#timeline-ruler`, `#timeline-lanes-container`, and `#daw-track-lanes-container`. Updated `renderDawRuler` to calculate total width dynamically using `Math.max(viewportEl.clientWidth, Math.ceil(daw.duration * safeZoom) + 300)`, ensuring the timeline stretches to 100% of the screen under all zoom levels and window sizes. Also changed `.daw-workspace-container` to `height: 100%; min-height: 0;` removing artificial `max-height: calc(92vh - 120px)`.
- **Problem 3: Master VU Meter Visibility, Docking & Floating**:
  - The Master Output VU meter was previously hidden by default and positioned as a detached floating element.
  - **Fix**: Integrated the Master VU meter window (`#daw-studio-vu-window`) directly into the `.daw-workspace-container` as a persistent right-hand monitoring rail by default (`display: flex`, docked with dual LED-style peak bars, dB scale, and EBU R128 LUFS readout). Added seamless toggles:
    - **Docked Mode**: Sits neatly anchored to the right edge of the timeline.
    - **Floating Mode**: Detaches into a draggable window anywhere on screen with `DOCK / FLOAT` toggle button and draggable header.
    - **View Menu**: Added `Master VU Meter Window (Show / Hide) [F8]` and `Dock VU Meter to Sidebar` toggles.
- **Problem 4: Menu Clutter (Percentages) & Reset UI**:
  - Removed cluttered percentage presets and labels. Changed master output volume indicator to professional audio `0.0dB` format.
  - Added **Reset UI & Window Layout** under the `View` menu (shortcut `Alt+R`): instantly restores sidebar width to 240px, track lane height to 74px, timeline zoom to 100% (20px/s), docks the Master VU meter to the right rail, and restores standard layout.
- **Deployment**: Successfully rebuilt with Vite and deployed live to Cloudflare Pages (`https://localfilm-studio.pages.dev` / `https://studio.localfilm.online`).

## [v1.8.0] - 2026-10-08 - New Project Setup, Multi-Track Batch Creator & Multi-File Auditioning Deck
- **New Project Setup Modal**:
  - Connected `File -> New` (`daw-menu-file-new`) and fresh session triggers to a studio-grade modal (`daw-new-project-modal`).
  - Supports custom Project Title, Preset Templates (Podcast Studio 5 tracks, Film Post-Production 6 tracks, Solo Voiceover 2 tracks Mono, Music Recording 8 tracks, or Custom).
  - Dynamic Track Row builder allowing naming, Audio/Music classification, Mono vs Stereo channel routing, custom color picking, and reordering/removal.
- **Track Mono / Stereo Layout & Interactive Badges**:
  - Explicit `channels: 'mono' | 'stereo'` property on all tracks.
  - Interactive channel badges (`MONO` / `STEREO`) on track headers allowing 1-click toggling between Mono and Stereo routing.
- **Add Multiple Tracks Modal**:
  - Added "+ Add Multiple Tracks..." to Tracks menu (`Ctrl+Shift+T`) and sidebar bottom actions (`daw-add-multi-tracks-btn`).
  - Batch configuration for 1, 2, 3, 4, 6, or 8 tracks at once with individual names, colors, track types, and Mono/Stereo layout.
- **Multi-File Audio Ingestion & Auditioning Deck**:
  - `daw-menu-audio-file-input` upgraded to accept multiple audio files simultaneously (`.wav,.mp3,.flac,.ogg,.m4a,.aac,.aiff,.webm`).
  - Modal provides a multi-file tab strip displaying queue count and file format tags.
  - Full technical specs per file: container format, sample rate, duration, file size, channel count, peak dBFS, headroom advisory, and bit depth / bitrate.
  - Live pre-import waveform preview and audition playback (`Play Preview` / `Stop Audition`) via Web Audio API.
  - Import destination options: "Separate New Track for Each File (Multi-Stem)" or sequential placement on a target track.

## [v1.8.1] - 2026-10-08 - Studio Master Footer Deck & Productivity Hub
- **Production Status Bar & Hardware Deck**:
  - Live Audio DSP Engine badge showing sample rate and bit resolution (e.g., `48 kHz • 32-bit Float`) with engine heartbeat indicator.
  - Web Audio Hardware Roundtrip Latency calculation in milliseconds (`5.3 ms`).
  - Active timeline stats: live track count, active clip count, and total project duration timecode.
- **Contextual Selection & Fast Action Hub**:
  - Real-time Selection Inspector badge displaying selected clip title and active duration.
  - 1-click **Split [S]** button directly bound to the playhead cutter.
  - 1-click **Norm [0dB]** button for instant peak gain normalization of selected clip(s).
  - 1-click **Ripple Editing** toggle indicator with visual glowing dot.
- **Precision Session & Master Output Controls**:
  - Fast Snap Grid Selector (`0.1s Fine`, `0.25s`, `0.5s Std`, `1.0s Bar`, `Off Free`).
  - Live Zoom Percentage readout (`100%`).
  - Micro Master Peak Meter strip with live dB readout (`-∞ dB` to `0 dBFS`).
  - Quick **Reset UI** shortcut button (`Alt+R`).

## [v1.8.2] - 2026-10-08 - Enhanced Studio Master Footer (DSP Load, Fit to Screen, Crossfade)
- **DSP Engine & Performance Telemetry**:
  - Added live `DSP: %` load estimation gauge that dynamically tracks audio buffer and active Web Audio source voice load in real time.
- **Enhanced Productivity Controls**:
  - Added **FIT** button (`daw-footer-zoom-fit-btn`) allowing 1-click zooming to fit the entire multi-track session to the available screen width.
  - Added smooth horizontal zoom slider (`daw-footer-zoom-slider`) with synchronized numeric percentage readout.
  - Added **Fade In/Out** quick crossfade tool (`daw-footer-fade-btn`) to soften clip start and ends with 1 click.
  - Deployed directly to production at `https://localfilm-studio.pages.dev`.

## [v1.8.3] - 2026-10-08 - Fixed Modal Transition & Desktop Drag-and-Drop Ingestion
- **Modal Transition Fix**:
  - Fixed premature modal dismissal on browse click. The initial launcher now smoothly hands off selected files to the **Technical Specs & Auditioning Deck** (`#daw-import-inspect-modal`).
  - Added safe fallback buffer creation in case browser decoding of corrupted or atypical containers stumbles, ensuring the specs GUI *always* renders.
- **Global Desktop Drag & Drop Support**:
  - Bound window-level `dragover` / `drop` listeners so dragging audio or video files directly from your desktop onto the timeline lanes or the browser window immediately triggers the respective ingestion pipeline.
  - Dropped video files (`.mp4`, `.webm`, `.mov`) automatically dock into the Video Sync Preview Monitor with frame stepping and timecode overlay.
  - Dropped audio files (`.wav`, `.mp3`, `.flac`, `.ogg`, `.m4a`) open directly in the **Audio Ingestion & Audition Deck**.

## Fix Update (2026-10-08): Stereo L/R Waveforms, Realistic Analog Curves, Timeline Scrolling & Master VU Expansion
- **Stereo vs. Mono Dual Waveform Display**:
  - Implemented dual stacked Left (L) and Right (R) channels on all stereo audio clips and stereo tracks, separated by a subtle dashed center divider and labeled `L` and `R`.
  - Mono tracks display a single full-height continuous waveform lane.
- **Realistic Analog Curve vs. Studio Block Bars**:
  - Added vector SVG analog continuous curve rendering with drop-shadow and center zero-crossing line alongside the discrete studio block bars mode.
  - Added interactive toggle items in the top **View** menu:
    - `Waveform: Analog Detailed Curves (High Resolution)`
    - `Waveform: Studio Block Bars`
- **Timeline Scrolling & Synchronisation**:
  - Added robust bidirectional vertical scroll synchronization between the timeline viewport (`#timeline-scroll-viewport`) and the track headers sidebar (`#daw-track-headers-container`).
  - Added horizontal timeline scrolling support via `Shift` + Mouse Wheel or two-finger trackpad panning.
- **Master VU Meter Full Vertical Height & Header Alignment**:
  - Replaced the hardcoded fixed 180px height on the VU meter bars with `flex: 1; min-height: 140px;` so the twin meter bars expand to the maximum vertical height available in the studio window.
  - Ensured track headers and timeline lanes maintain exact alignment without top header truncation.
- **Deployment**:
  - Built with Vite and deployed live to Cloudflare Pages production (`https://localfilm-studio.pages.dev`).

## Fix Update (2026-10-08): Timeline Marquee Selection, Startup Beta Screen & Floating/Draggable VU Meter
- **Timeline Marquee Selection Engine**:
  - Implemented click-and-drag rubberband/marquee rectangle selection across timeline lanes (`#timeline-marquee-selection-box`).
  - Supports multi-track clip intersection detection, visual selection highlighting, batch operations (multi-clip move, split, delete, fade), and additive selection via `Shift` key.
- **Startup Fullscreen Beta Screen**:
  - Added themed overlay modal (`#daw-beta-welcome-modal`) with LocalFilm branding, `logo.png`, sponsor link, feature guide, and the requested headline:
    `LOCALDAW IS IN BETA — PLAY NICE AND REPORT BACK`.
  - Configured 1-click enter button with smooth fade-out and keyboard shortcuts (`Enter` / `Esc`).
- **Master VU Meter Floating & Draggable**:
  - Configured the Master VU meter to be **floating by default** with rounded borders and cinematic depth shadow, preventing clipping against the right rail.
  - Added global viewport-clamped drag handling on `#daw-studio-vu-header` so the VU meter can be freely positioned anywhere across the workspace.
  - Dock / Float toggle button allows seamless switching between floating and docked right rail.
- **Deployment**:
  - Compiled with Vite and deployed to Cloudflare Pages production (`https://localfilm-studio.pages.dev`).

## Fix Update (2026-10-08): Timeline Playback Restoration & VU Meter Right Channel Clipping Fix
- **Root Cause Analysis**:
  1. Timeline playback was silent because when a user opened the fresh DAW directly or clicked "New Project", the timeline clips array was empty (`daw.clips = []`). Without clips populated on the tracks, the audio scheduler had no audio buffers to feed into the Web Audio graph, resulting in silence and motionless VU meters.
  2. The VU meter right channel ("R") and dB labels were getting clipped because the container's width was constrained to 78px with tight padding.
- **Fixes Implemented**:
  1. **Demo Session Audio Synthesizer**: Added `synthesizeDemoProjectAudio()`. Upon launching or starting playback on an empty session, it generates 3 real, broadcast-quality audio stems with full PCM buffers and waveform peaks:
     - **Presenter Dialogue Take (Mono)**: Voice formants, vibrato, speech rhythm and natural breath pauses.
     - **Cinematic Score Bed (Stereo)**: Warm analog pad progression (Am - F - C - G) with automatic sidechain ducking.
     - **Acoustic Room Atmosphere (Stereo)**: Subtle room acoustics and filtered ambience.
  2. **VU Meter Layout & Width Expansion**:
     - Increased floating and docked VU meter container width to `94px` with `min-width: 94px` and adjusted column padding from 8px to 4px.
     - Ensured both Left (L) and Right (R) meter bars, dB graticule labels, clip indicators, and LUFS readouts have generous spacing without any edge clipping.
- **Deployment**:
  - Rebuilt with Vite and deployed live to Cloudflare Pages production (`https://localfilm-studio.pages.dev`).

## Fix Update (2026-10-08): Clean Minimal VU Meter, Track Pan Fader, Curve Tension Slopes & Double-Click Lane Ingestion
- **Clean Minimal Master VU Meter**:
  - Removed all heavy borders, boxes, and surrounding rectangles around the dB text and LUFS labels.
  - Redesigned with sleek dark glass aesthetics (`rgba(9, 12, 19, 0.95)` with subtle backdrop blur), pure typography, slim vertical meter columns, and clean graticule text markings.
- **Track Header Stereo Pan & Master Volume Controls**:
  - Added dedicated **L <-> R stereo pan fader** on every track header (`track-pan-slider`).
  - Added **Track Master Volume slider** (0% to 150%) next to the pan fader.
  - Relabeled the automation button to **`Curve`** to clearly distinguish timeline keyframe volume automation from the track's overall static volume fader.
  - Connected `StereoPannerNode` in the Web Audio graph so panning audio left and right works in real time during playback.
- **Interactive Fade Slope Curvature (Linear to Convex / Concave)**:
  - Dragging the top-corner fade handles left/right adjusts the fade duration.
  - Dragging the handles up/down dynamically adjusts the **curve tension / slope** between concave, linear, and convex, rendering dynamic Bézier curves with control points.
- **Double-Click Empty Track Lane to Ingest Audio**:
  - Double-clicking on any empty space of a timeline track lane now instantly opens the **Audio Import Hub Modal** with that track automatically targeted for insertion.
- **Track Addition Stability**:
  - Hardened single track addition (`+ Audio`, `+ Music`) and batch track wizard to ensure every created track initializes complete channel routing, pan positions, keyframes, and default plugins state.
- **Deployment**:
  - Rebuilt with Vite and deployed live to Cloudflare Pages production (`https://localfilm-studio.pages.dev`).

## Fix Update (2026-10-08): Rotary Pan Dial, Tiny Track VU Meter, Dual-Axis 2D Fade Curve Slopes & Track Addition Hardening
- **Rotary Pan Dial with 8% Center Snap & % Tooltips**:
  - Replaced horizontal slider with an SVG circular rotary knob on each track header (`.track-pan-knob-container`).
  - Needle rotates from $-135^\circ$ (full Left) to $+135^\circ$ (full Right).
  - Dragging up/right pans Right; dragging down/left pans Left.
  - Automatically snaps cleanly to `Center (0%)` when within 8% of center.
  - Displays interactive floating HUD tooltip during mouse drag (`Pan: L 50%`, `Pan: Center (0%)`, `Pan: R 75%`).
  - Double-clicking the rotary dial resets pan directly to Center (`0%`).
- **Tiny Track Header VU Meter**:
  - Added a compact 4px wide $\times$ 18px tall live vertical level meter bar (`#track-mini-vu-${t.id}`) inside each track header immediately following the track volume fader.
  - Samples active clips on that track, muted state, and volume fader during playback in `tick()` to animate in real-time with an emerald-to-red gradient fill.
  - Automatically resets to 0% when playback pauses or stops.
- **Dual-Axis 2D Fade Curve Handles (↔ Duration, ↕ Curve Slope)**:
  - Corner fade handles now support full 2D dual-axis dragging:
    - **Horizontal ($X$-axis)**: Adjusts fade duration in seconds (`clip.fadeIn`, `clip.fadeOut`).
    - **Vertical ($Y$-axis)**: Dynamically adjusts curve slope/tension (`clip.fadeInCurve`, `clip.fadeOutCurve`) from $-0.95$ (concave) through $0$ (linear) to $+0.95$ (convex).
  - Displays real-time floating tooltip showing duration, slope percentage, and curvature shape (`Convex`, `Linear`, `Concave`).
  - Web Audio scheduler implements `setValueCurveAtTime` non-linear exponential/logarithmic power curves matching the visual Bézier SVG paths.
- **Track Addition Hardening & Empty Lane Ingestion**:
  - Double-clicking any empty area on a track lane sets `daw._targetImportTrackId = trackId` and opens the Audio Ingestion Hub, preselecting that specific track in the destination dropdown.
  - Hardened single track addition (`+ Audio`, `+ Music`) to guarantee complete channel definitions (`mono` / `stereo`), `pan: 0`, default plugin states, and undo/redo history tracking.
- **Deployment**:
  - Rebuilt with Vite and deployed live to Cloudflare Pages production (`https://localfilm-studio.pages.dev` / `https://studio.localfilm.online`).

## [v1.8.4] - 2026-10-08 - Real-Time Track Mixer Bus, Live Parameter Modulation, Spacebar Protection, True Mono Downmix & Purple Crossfade Engine
- **Real-Time Volume & Rotary Pan Controls During Live Playback**:
  - **Problem**: Volume sliders and rotary pan knobs only took effect when stopping and restarting playback.
  - **Root Cause**: Audio buffer source nodes were scheduled directly to master output at playback start. Adjusting `track.vol` or `track.pan` during playback did not modulate the active nodes in the Web Audio graph.
  - **Solution**: Implemented persistent per-track mixer buses (`daw.trackBuses[trackKey] = { input, fxInput, gain, panner, muteGain, analyser }`). All buffer sources feed into the track bus input. When adjusting sliders or turning the rotary pan knob, `updateTrackBusLive(trackKey)` immediately modulates `bus.gain.gain.setTargetAtTime(targetVol, now, 0.015)` and `bus.panner.pan.setTargetAtTime(targetPan, now, 0.015)` with zero audio glitching, clicks, or requiring playback to stop.
- **Spacebar Keyboard Shortcut Swallowing Fix**:
  - **Problem**: Interacting with volume sliders, rotary pan knobs, or buttons caused the browser to retain focus on the element; subsequent Spacebar presses triggered native slider incrementing or button activation instead of toggling playback.
  - **Solution**: Handled Spacebar at the very top of the global `keydown` event listener with capture phase (`true`). If the active element is a non-text control (`<input type="range">`, `<button>`, etc.), it immediately invokes `activeEl.blur()`, calls `e.preventDefault()` / `e.stopPropagation()`, and triggers `toggleDawPlay()` / `stopDawRecording()` reliably every single time.
- **Real-Time FX Rack Plugin Updates During Live Playback**:
  - **Problem**: Adjusting EQ bands, compressor threshold, reverb mix, delay time, or stereo widening only took effect during single-clip audition, or required stopping and restarting playback.
  - **Solution**: Built `notifyFxParamChange()` and wired it across all 10 plugin sliders, toggles, and dropdowns. In addition, clicking "Apply Effects to Track" or changing presets invokes `rebuildTrackBusFx(trackKey)` to seamlessly re-wire the live Web Audio DSP insert chain without interrupting playback.
- **True Mono / Stereo Track Downmixing**:
  - **Problem**: Clicking the Mono badge only updated track metadata without altering audio output channel topology.
  - **Solution**: When a track is toggled to Mono, `bus.gain.channelCount = 1`, `bus.gain.channelCountMode = 'explicit'`, and `bus.gain.channelInterpretation = 'speakers'`. This dynamically downmixes stereo left and right channels into a unified mono signal centered in the stereo field in real time.
- **Professional Purple Crossfade Engine (Modal + Waveform Overlays + Seam CTA)**:
  - **Hover CTA**: When the mouse moves over the junction where two adjacent audio clips meet on the same track, a sleek purple floating button (`⤬ Crossfade`) appears automatically (`#c084fc` / `#9333ea` glassmorphism pill).
  - **Keyboard Shortcut**: Pressing `X` with two adjacent clips selected instantly triggers crossfade.
  - **Toolbar Integration**: Added `#timeline-crossfade-btn` in the timeline toolbar, dynamically enabled when two clips are selected.
  - **Interactive Crossfade Modal (`#daw-crossfade-modal`)**:
    - **Live Curve Visualizer**: Real-time interactive SVG showing Fade-Out (cyan/purple) and Fade-In (magenta/purple) intersection with live dBFS drop readout (`-3.0 dBFS` Equal Power, `-6.0 dBFS` Linear).
    - **Length Slider & Presets**: Smooth range slider (50ms to 3000ms / 0.05s to 3.0s) with 1-click quick-set pills (50ms, 150ms, 250ms, 500ms, 1.0s, 2.0s).
    - **Curve Profiles**: Equal Power 3dB (Industry Standard / Constant Energy), Linear 6dB, S-Curve, Exponential, Logarithmic.
    - **Alignment**: Centered at Cut (50/50), End at Cut, Start at Cut.
    - **Actions**: Apply Crossfade, Remove Crossfade, and Cancel (with Escape key support).
  - **Visual Timeline Rendering**:
    - Overlapping clips render purple crossfade SVG curves (`rgba(147, 51, 234, 0.28)` fill, `#c084fc` stroke) and duration badges (`⤬ 0.5s`).
  - **Audio DSP Fade Math**: Enhanced `scheduleClipFadeEnvelope` to accurately modulate exponential, linear, s-curve, and constant-power $3\text{dB}$ curves over the crossfade overlap window.
- **Deployment**:
  - Rebuilt with Vite and deployed live to Cloudflare Pages production (`https://localfilm-studio.pages.dev` / `https://studio.localfilm.online`).

## [v1.8.5] - 2026-10-08 - Active Multi-Rate Audio Clock (44.1k/48k/96k), Auto-SRC Resampling, Project Settings & Long File Auto-Fit
- **Target**: `/Users/alanjoyce/Desktop/standalone_daw`
- **Subdomain**: `studio.localfilm.online`
- **Cloudflare Pages URL**: `https://localfilm-studio.pages.dev`
- **Long File Support & Auto-Size Standard**:
  - **Problem**: Ingesting a 30-minute audio recording resulted in only ~7 minutes being visible on the timeline, with no ability to zoom out to see the rest of the file.
  - **Root Cause**: `daw.zoom` had a rigid minimum zoom constraint of `5` px/s. On a 2100px screen, 2100 / 5 = 420s = 7 minutes. Additionally, a static 1s ruler tick loop generated 3,600+ elements on long files, overloading the browser DOM.
  - **Solution**:
    1. Lowered `minZoom` down from `5` to `0.05` px/s across the entire engine, zoom slider, buttons, wheel listener, and auto-fit logic. Sessions up to 10+ hours fit seamlessly on-screen.
    2. Implemented dynamic adaptive ruler ticking with `DocumentFragment` (stepping by 0.5s, 1s, 5s, 10s, 30s, 1m, 5m, or 10m based on current zoom), rendering only 40–120 DOM elements at any zoom level.
    3. Established **Auto-Size as Standard**: `fitTimelineToWindow()` is triggered automatically when any audio file is imported or loaded, shrinking the waveform to the maximum visible width of the viewport instantly.
    4. Added `F` keyboard shortcut for 1-key auto-fit to screen, and enabled native trackpad `deltaX` horizontal timeline scrolling.
- **Active Real Sample Rates in New Project**:
  - Added Sample Rate dropdown (44.1 kHz, 48 kHz SMPTE standard, 88.2 kHz, 96 kHz Hi-Res Master), Bit Depth (16-bit, 24-bit, 32-bit float), and SMPTE FPS (24, 25, 29.97, 30 fps) to the New Project modal.
  - Bound selections directly to `daw.sampleRate`, `daw.bitDepth`, and `daw.fps`, updating the live footer hardware deck (`#daw-footer-engine-text`).
- **Auto-SRC Audio Ingestion Resampling**:
  - Added `resampleAudioBuffer(sourceBuffer, targetSampleRate)` using `OfflineAudioContext` sinc interpolation, preserving exact 1.0x pitch and tempo neutrality without aliasing distortion.
  - In the Audio Pre-flight Inspector, added a live Auto-SRC alignment banner and toggle (`#daw-inspect-src-banner`, `#daw-inspect-src-toggle`). Confirming import automatically resamples any rate-mismatched files before timeline insertion.
- **Project Settings & Audio Clock Modal (`Ctrl+,` / `Cmd+,`)**:
  - Added "Project Settings & Clock..." to the File Menu (`#daw-menu-file-project-settings`) and keyboard shortcut `Ctrl+,` / `Cmd+,`.
  - Built obsidian-glass `#daw-project-settings-modal` with Project Title, current clock readout, sample rate dropdown, bit depth, SMPTE timecode fps, stereo pan law, and dynamic acoustic advisory box.
  - Advisory box dynamically explains Nyquist frequency expansion (upsampling) or band-limited decimation with steep anti-aliasing low-pass filtering (downsampling), RAM impact, and 100% pitch/tempo neutrality.
  - Applying settings resamples all active timeline clip buffers in-memory, updates internal state, footer status, and re-renders the workspace.
- **Loading Screen & Build Number**:
  - Updated Beta Welcome modal to `BUILD v1.8.5 · PRO STUDIO RELEASE` highlighting Active Sample Rates & Auto-SRC, Long File Engine, Purple Crossfades, and Live Mixer Buses.
- **Deployment**:
  - Rebuilt with Vite and deployed live to Cloudflare Pages production (`https://localfilm-studio.pages.dev` / `https://studio.localfilm.online`).

## [v1.8.6] - 2026-10-08 - Fixed-Size Emerald Play/Pause Transport Button & Configurable Modular Toolbar Menu
- **Target**: `/Users/alanjoyce/Desktop/standalone_daw`
- **Subdomain**: `studio.localfilm.online`
- **Cloudflare Pages URL**: `https://localfilm-studio.pages.dev`
- **Problem 1: Play/Pause State Button Shifts Layout & Pushes Neighboring Menus**:
  - The Play button had variable text width (`Play` vs `Pause` vs `Buffering...`) and flexible padding (`padding: 0 14px`), causing the button to expand and contract horizontally upon click. This caused annoying layout jitter and pushed the top deck controls and menu bar horizontally.
  - **Fix**:
    1. Assigned a strictly fixed dimension (`width: 84px; min-width: 84px; max-width: 84px; height: 32px; box-sizing: border-box; justify-content: center;`) to `#timeline-play-btn`.
    2. Styled with professional dark-cinema emerald theme:
       - **Idle / Stopped (Play)**: Translucent emerald glass (`background: linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(5, 150, 105, 0.16) 100%); border: 1px solid rgba(52, 211, 153, 0.55); color: #34d399; box-shadow: 0 0 10px rgba(16, 185, 129, 0.2);`) with monochrome SVG play triangle and centered `PLAY` text.
       - **Active Playback (Pause)**: Solid radiant emerald on-air illumination (`background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: 1px solid rgba(52, 211, 153, 0.85); color: #021a10; box-shadow: 0 0 18px rgba(16, 185, 129, 0.55);`) with monochrome pause bars and centered `PAUSE` text.
       - **Zero Layout Shift**: The button dimensions are mathematically clamped and identical down to the pixel across all states.
- **Problem 2: Cluttered Top Bar with No Function Toggles**:
  - The top toolbar decks (Tier 1 & Tier 2) contained numerous tools (Timecode, Metronome/BPM, VU Meter, Volume Fader, Co-Host Studio, Video/ADR tools, Mic selector, etc.) that could not be toggled or customized to achieve a clean workspace.
  - **Fix**:
    1. Added interactive **"Configure Toolbar..."** menu:
       - Dedicated gear/sliders button on the toolbar (`#daw-toolbar-customize-btn`) with smooth animated popover dropdown (`#daw-toolbar-customize-popover`).
       - Menu item in `View -> Customize Toolbar Display...` (`#daw-menu-view-customize-toolbar`).
    2. Modularized all top bar sections with semantic container IDs (`#daw-top-module-timecode`, `#daw-top-module-bpm`, `#daw-top-module-master-vu`, `#daw-top-module-master-vol`, `#daw-top-module-cohost`, `#daw-top-module-video-adr`, `#daw-top-module-punch`, `#daw-top-module-mic-select`, `#daw-top-secondary-deck`).
    3. Added 1-click presets:
       - **"Standard Studio (All)"**: Shows all tools.
       - **"Clean Minimalist"**: Shows transport + volume fader only, hiding secondary deck and auxiliary counters.
       - **"Editing Focus"**: Hides video/ADR, metronome, and co-host buttons to focus on editing and waveform cutting.
    4. Saved user preferences in `localStorage` (`localfilm_daw_toolbar_config`) for instant persistence across reloads and sessions.
- **Deployment**:
  - Rebuilt with Vite and deployed live to Cloudflare Pages production (`https://localfilm-studio.pages.dev` / `https://studio.localfilm.online`).

## [v1.8.7] - 2026-10-08 - Track Control Redesign, Interactive Color/Properties Modal, IndexedDB Auto-Save, Local Project Files & Clean Bottom Actions Bar
- **Target**: `/Users/alanjoyce/Desktop/standalone_daw`
- **Subdomain**: `studio.localfilm.online`
- **Cloudflare Pages URL**: `https://localfilm-studio.pages.dev`
- **1. Rotary Pan Dial & Track Controls Redesign**:
  - Expanded track headers sidebar width from 240px to 280px to eliminate cramped spacing.
  - Redesigned rotary pan knob into a 26px CNC dark metallic circular dial with radial gradient, subtle bevel drop-shadow, rotating cyan indicator needle (±135°), 8% center snap, and compact monospace readout pill badge (`C`, `L35`, `R50`). Double-clicking resets to Center.
  - Replaced text "Curve" with a clean 20x20px SVG wave icon (`∿`).
  - Added custom WebKit and Moz range slider styling (`.track-vol-slider`) with a 4px track, custom 8px x 14px metallic fader cap thumb with shadow, and glowing border on hover/focus.
  - Standardized track control buttons (`R`, `FX`, `M`, `S`, `∿`) into uniform 22px x 20px dark metallic buttons with smooth active glows.
- **2. Interactive Track Properties & Color Modal (`#daw-track-properties-modal`)**:
  - Clicking on any track name label or color beacon dot opens an interactive dialog.
  - Allows renaming track title, selecting from a 12-swatch studio palette or HTML5 color picker, switching Track Type (`Audio (Dialogue / Speech)` vs `Music (Stereo Bed / Score)`), and toggling Channel Routing (`Mono (Single Mic)` vs `Stereo (Dual Channel)`).
  - Automatically updates track header dot, title, waveforms, channel badges, and audio buses immediately upon saving.
- **3. Session Auto-Save (Refresh Recovery via IndexedDB)**:
  - Built client-side database engine (`LocalFilmDawDB`) in `IndexedDB`.
  - Converts active Web Audio PCM buffers into 16-bit WAV Blobs (`audioBufferToWav`) and stores them alongside complete session metadata, volume, pan, playhead, zoom, and mute/solo states.
  - Automatically triggers on every state modification and on browser `beforeunload`.
  - On page reload, restores exact tracks, clips, audio waveforms, zoom, and playhead, avoiding overwrite by starter demo session.
- **4. Portable `.localfilmdaw` Project Files & Local Project Library**:
  - **Save Project (`Ctrl+S`)**: Saves current session directly into local IndexedDB project library.
  - **Save Project File (`Ctrl+Shift+S`)**: Exports complete portable `.localfilmdaw` JSON file to the user's hard drive.
  - **Open Project File (`Ctrl+O`)**: File picker accepts `.localfilmdaw` files from the user's machine, unpacking tracks, clips, settings, and base64 audio data.
  - **Recent Projects Library (`Ctrl+Alt+O`)**: Modal dialog displaying saved local sessions with track count, clip count, duration, and last-saved timestamp, with 1-click Load and Delete actions.
- **5. Professional Tracks & Mix Bottom Actions Bar**:
  - Redesigned `+ Audio Track [Mono Vocal]`, `+ Music Track [Stereo Bed]`, and `+ Add Multiple Tracks... [Ctrl+Shift+T]` at the bottom of the track sidebar.
  - Used sleek monochrome SVG stroke line icons with subtle opacity/glow matching the dark cinematic aesthetic (strictly adhering to the NO COLOURED ICONS rule).
- **Deployment**:
  - Rebuilt with Vite and deployed live to Cloudflare Pages production (`https://localfilm-studio.pages.dev` / `https://studio.localfilm.online`).

## [v1.8.8] - 2026-10-08 - Monochrome White Menus, Project Settings Top Placement, Red Save & Effects Menu Structural Redesign
- **Target**: `/Users/alanjoyce/Desktop/standalone_daw`
- **Subdomain**: `studio.localfilm.online`
- **Cloudflare Pages URL**: `https://localfilm-studio.pages.dev`
- **1. Clean Monochrome White Menus**:
  - Removed all colored text styles and cyan/green/amber hover accents across all menus (`File`, `Edit`, `Tracks`, `Effects`, `View`, `Transport`, `Help`).
  - Standardized `.daw-menu-item` to crisp white (`#ffffff`), `.daw-menu-shortcut` to subtle monospace (`rgba(255,255,255,0.4)`), and hover state to clean white frosted glass (`background: rgba(255,255,255,0.1); color: #ffffff;`).
  - Updated checkmarks in `View` menu to pure white.
- **2. Project Settings Placed at Top of Menus Section**:
  - Moved `Project Settings & Clock... [Ctrl+,]` to the very top item of the `File` menu dropdown (`#daw-menu-file-project-settings`), providing instantaneous 1-click access to the audio clock and project settings.
- **3. Red Save Actions**:
  - Styled `Save Project [Ctrl+S]` and `Save Project File (.localfilmdaw)... [Ctrl+Shift+S]` in high-visibility bold red (`#ef4444` / `.daw-menu-item-save`) with red shortcut badge and subtle red hover illumination (`background: rgba(239, 68, 68, 0.16); color: #f87171;`).
- **4. Complete Effects Menu Structural Redesign**:
  - Reorganized the cluttered Effects menu into clear, logical studio categories with subtle uppercase section headers (`.daw-menu-section-header`):
    - **Audio DSP & Plugins**: `Open Track DSP FX Rack (10 Plugins)...`, `Browse Audio Plugins Directory... [Ctrl+Alt+P]`
    - **Analog Compressor Emulations**: `Teletronix LA-2A (Opto Warmth)`, `UREI 1176LN (FET Punch Peak)`, `SSL G-Master Bus (Mix Glue)`
    - **Restoration & De-Hum**: `50Hz De-Hum (Ireland / EU Ground)`, `60Hz De-Hum (US AC Ground)`
    - **Studio Chain Presets**: `Broadcast Vocal Polish`, `Radio Punch & Tape Warmth`, `Studio Reverb & Spatial Wide`, `Clean Dialogue (Gate + De-Esser)`, `Master Maximizer & Limiter`
    - **Reset**: `Bypass / Reset All Plugins`
  - All items styled in crisp white, eliminating visual chaos.
- **5. Global Emoji Purge & Monochrome SVG Line Standardization**:
  - In strict compliance with the **NO COLOURED ICONS** mandatory rule, audited and removed every emoji and bright plastic glyph across `src/main.js`, `index.html`, `src/dialogs.js`, and `src/studio.css`.
  - Replaced welcome modal emojis (`⚡`, `📜`, `🎛️`) and settings/SRC advisories with sleek monochrome SVG stroke line icons.
  - Converted all toast notification strings to professional studio plain text (removed `📋`, `📥`, `🌊`, `🔔`, `📍`, `🎬`, `✨`, `➕`, `⏳`, `🎵`, `⚠️`, `⚙️`, `🎨`, `✓`, `🔍`, `🎛️`).
  - Bumped version in `package.json` and Welcome modal header to `v1.8.8 · PRO STUDIO RELEASE`.
- **Deployment**:
  - Built with Vite and deployed live to Cloudflare Pages production (`https://localfilm-studio.pages.dev` / `https://studio.localfilm.online` / hash `https://6b87268c.localfilm-studio.pages.dev`).

## [v1.8.9] - 2026-10-08 - Cinema Monochrome UI with Vivid Color Sound Files & Full B&W Waveform Toggles
- **Target**: `/Users/alanjoyce/Desktop/standalone_daw`
- **Subdomain**: `studio.localfilm.online`
- **Cloudflare Pages URL**: `https://localfilm-studio.pages.dev`
- **Deployment Hash**: `https://a0dc5557.localfilm-studio.pages.dev`
- **1. Cinema Monochrome Theme with Vivid Color Sound Files**:
  - Identified root cause of grayscale sound files: the previous `[data-theme="monochrome"]` applied a global `filter: grayscale(100%) contrast(108%);` to the root modal container, which forced all child elements (including canvas and SVG audio waveforms) into grayscale.
  - Removed root `filter: grayscale(100%)` from `[data-theme="monochrome"]` and targeted monochrome styling directly to the workstation chrome, panels, headers, buttons, transport timecode, and status bars.
  - Audio clips and waveforms on the timeline retain their vivid multi-track colors (vocal blue, music emerald, SFX amber, dialogue purple, etc.) against the pitch-black and deep obsidian monochrome workstation canvas.
- **2. Dedicated Cinema Pure B&W (Full Monochrome) Mode**:
  - Introduced `[data-theme="monochrome-bw"]` for producers who explicitly desire an entirely black & white workstation where sound files and waveforms are also rendered in monochrome silver/white.
- **3. Interactive Sound File Waveform Color Modes & Toggles**:
  - Added discrete waveform color controls:
    - **View Menu**: Added `Sound Files: Display in Vivid Colour` and `Sound Files: Monochrome B&W Waves` under the Waveform section, alongside `Theme: Cinema Monochrome (Color Waves)` and `Theme: Cinema Pure B&W (Full Monochrome)`.
    - **Timeline Toolbar**: Added `#timeline-wave-color-btn` (`WAVE: COLOR` / `WAVE: MONO`) next to `#timeline-wave-gain-btn` for instant 1-click toggling between vivid colored audio clips and monochrome audio clips.
  - Added `waveformColorMode: 'color' | 'mono'` to the core DAW state engine, persisted in `localStorage`, auto-saved to IndexedDB (`LocalFilmDawDB`), and serialized in portable `.localfilmdaw` project exports and imports.
- **4. Clip Renderer Multi-Mode Support**:
  - Updated `renderDawClips()` in `src/main.js` to dynamically render clip backgrounds, borders, badges, and SVG waveforms with `clip.color` when in color mode, or `#e2e8f0` silver/white when in mono mode.
- **5. Strict Design & Icon Consistency**:
  - Preserved the **NO COLOURED ICONS** mandatory rule across all new toggles, using clean white monochrome SVG line icons.
  - Preserved red Save actions and top-level Project Settings from v1.8.8.
  - Bumped version to `v1.8.9` in `package.json` and Welcome modal header.
## [v1.8.10] - 2026-10-08 - Rotary Pan Knob Double-Click Centering & Label Positioned Underneath
- **Target**: `/Users/alanjoyce/Desktop/standalone_daw`
- **Subdomain**: `studio.localfilm.online`
- **Cloudflare Pages URL**: `https://localfilm-studio.pages.dev`
- **Deployment Hash**: `https://046fd1fe.localfilm-studio.pages.dev`
- **1. Double-Click to Center Stereo Pan Engine**:
  - Implemented high-reliability double-click detection in `knobContainer.onmousedown` using timestamp tracking (`now - lastClick < 400ms`) and distance checking (`< 8px radius`). This bypasses browser-native `ondblclick` suppression caused by mouse drag capture and `preventDefault()`.
  - Also attached native `ondblclick` handlers directly on the container (`.track-pan-knob-container`), the rotary dial knob (`.track-pan-dial-knob`), and the readout badge (`.track-pan-readout`).
  - Single-clicking or double-clicking the readout badge (`C`) also instantaneously resets pan to Center (0%).
  - Added drag deadband threshold (ignoring micro-tremors `< 3px`) so clicking never accidentally drifts the pan needle away from Center.
  - Reset to Center sets `daw.tracks[trackKey].pan = 0`, needle rotation to `0deg`, readout badge to `C`, updates live Web Audio bus, pushes history to undo stack, and saves to IndexedDB.
- **2. Label Positioned Underneath the Knob**:
  - Restructured `.track-pan-knob-container` to `display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; width: 26px; min-width: 26px;`.
  - The rotary dial knob sits on top, and the monospace readout pill (`C`, `L35`, `R50`) sits directly underneath the knob, perfectly aligned on the vertical center axis.
  - Added subtle 12 o'clock center alignment pip on the dial bezel (`::before`) and dark center hub cap dot (`.track-pan-dial-center-dot`), ensuring the needle points straight up to 12 o'clock when centered.
  - Optimized horizontal layout of Row 2 in track headers, giving additional breathing room to the track volume fader and mini VU meter.
- **3. Theme Support & Icon Rules**:
  - Added monochrome theme overrides for pan needle (`#ffffff`), knob hover glow, and readout badge hover.
  - Strictly maintained the **NO COLOURED ICONS** mandatory rule.
  - Bumped version to `v1.8.10` in `package.json` and Welcome modal badge.
- **Deployment**:
  - Built with Vite into `dist/` and deployed live to Cloudflare Pages production (`https://localfilm-studio.pages.dev` / `https://studio.localfilm.online` / hash `https://046fd1fe.localfilm-studio.pages.dev`).

## [v1.8.11] - 2026-10-08 - Lean Architecture Audit, Cinema Splash Screen, Crossfade Combine/Glue, 50-State Undo Timeline & Menu Audit
- **Target**: `/Users/alanjoyce/Desktop/standalone_daw`
- **Subdomain**: `studio.localfilm.online`
- **Cloudflare Pages URL**: `https://localfilm-studio.pages.dev`
- **Deployment Hash**: `https://3e2c1b24.localfilm-studio.pages.dev`
- **1. Cinema Splash Loading Screen with Boot Sequence**:
  - Ingested uploaded branding asset (`localdaw-splash.jpg`) as high-resolution cinema splash screen (`#daw-app-splash-screen`).
  - Implemented 4-stage engine boot loader sequence:
    1. Initializing 64-Bit Studio Audio Engine... (28%)
    2. Mounting Web Audio DSP Plugin Architecture... (58%)
    3. Calibrating Hardware Clocks & Multi-Rate Buffers... (86%)
    4. Studio DAW Workspace Ready (100%)
  - Smooth 0.6s cubic-bezier opacity fade-out into the active workspace. Click anywhere allows immediate skip.
- **2. Crossfade Combine / Glue Clips & Lockstep Dragging**:
  - Added `combineSelectedClipsDAW()` using `OfflineAudioContext`: renders overlapping crossfade seams with equal-power curves into a single continuous 16-bit PCM WAV audio clip with freshly computed peak geometry, replacing both clips on the track (Pro Tools Consolidate / Audition Merge).
  - Wired `#daw-crossfade-combine-btn` directly into the crossfade modal footer.
  - Added crossfade partner auto-linking (`clip.crossfadeWith`): moving or dragging either crossfaded clip automatically selects and moves its partner in lockstep so crossfades never break accidentally.
  - Added `Combine / Glue Clips [Ctrl+G / Cmd+G]` to Edit menu and global keyboard shortcuts.
- **3. Pro Tools / Audition 50-State Visual History Timeline**:
  - Confirmed 50-state undo memory stack in `pushDawHistory`.
  - Added `#daw-history-timeline-modal` accessible via `Edit -> Undo History Timeline... [Ctrl+H / Cmd+H]` and `View -> Undo History Timeline Panel...`.
  - Displays chronological undo steps and redo steps with timecodes and active state markers.
  - Clicking any historical step allows 1-click jump backward or forward in time. Includes "Clear History" CTA.
- **4. Long File (WAV/MP3/FLAC) Auto-Fit Engine**:
  - Auto-fit to screen width (`fitTimelineToWindow()`, zoom down to 0.05 px/sec) is automatically executed on all audio file imports and drag-and-drop actions.
  - Added `Zoom: Fit Project to Screen Width [F]` to View menu, footer button, and `F` key shortcut.
- **5. Comprehensive Menu System Audit**:
  - Audited LocalFilm Studio DAW against Pro Tools, Adobe Audition, and Audacity.
  - All functions are cleanly categorized across File, Edit, Tracks, Effects, View, Transport, and Help menus with industry-standard keybindings and zero icon color violations.
- **Deployment**:
  - Built with Vite into `dist/` and deployed live to Cloudflare Pages production (`https://localfilm-studio.pages.dev` / `https://studio.localfilm.online`).

## [v1.8.12] - 2026-10-08 - Studio-Grade DSP Audio Architecture (4-Phase Overhaul)
- **Target**: `/Users/alanjoyce/Desktop/standalone_daw`
- **Subdomain**: `studio.localfilm.online`
- **Cloudflare Pages URL**: `https://localfilm-studio.pages.dev`
- **Deployment Hash**: `https://5a62a0a3.localfilm-studio.pages.dev`
- **Phase 1: Compressor Auto-Makeup Gain & Real-Time Gain Reduction (GR) Meter**:
  - Added Auto-Makeup gain calculation: dynamically compensates acoustic energy loss based on threshold and ratio (`autoDb = (-thresh) * (1 - 1 / max(1.1, ratio)) * 0.55`).
  - Added manual Makeup Trim slider (`#daw-fx-comp-makeup`, `0` to `+18dB`) and Auto-Makeup toggle checkbox (`#daw-fx-comp-auto-makeup`).
  - Added live descending Gain Reduction (GR) meter bar (`#daw-fx-comp-gr-fill`) and readout (`#daw-fx-comp-gr-val`) reading native `DynamicsCompressorNode.reduction` at 60fps during audition and timeline playback.
- **Phase 2: Interactive Parametric EQ Frequency Response Curve & Live FFT Spectrum Analyzer Canvas**:
  - Built 414x88px high-precision canvas engine (`#daw-fx-eq-canvas`).
  - Mathematical frequency response curve plotting summed biquad filter transfer functions (80Hz LowCut roll-off, 50Hz/60Hz de-hum notches, 120Hz bass shelf, 2.5kHz mid peaking bell, and 9kHz air shelf).
  - Four interactive draggable control nodes (HPF toggle, Bass, Mid, Air) with direct 2D mouse drag manipulation updating sliders, value readouts, and Web Audio buses in real time.
  - Live Real-Time Analyzer (RTA) frequency spectrum drawing rendered in translucent cyan under the EQ curve during playback and audition.
- **Phase 3: True Dynamic Vocal De-Esser & Dynamic Playback Noise Gate**:
  - De-Esser Solo "Listen to Sibilance" mode (`#daw-fx-deesser-listen-btn`): swaps surgical peaking notch into a Q=3.0 bandpass filter in headphones to isolate and zero-in on harsh sibilance frequencies.
  - Dynamic Noise Gate with visual status pill (`#daw-fx-gate-status-pill`): dynamically switches between `[OPEN]` (emerald) and `[DUCKED]` (amber) based on incoming signal envelope vs threshold.
- **Phase 4: Instant A/B Compare Toggle & Broadcast Channel Strip Presets**:
  - Instant Bank A / Bank B state memory toggle (`#daw-fx-ab-btn-a`, `#daw-fx-ab-btn-b`) with 1-click Copy button (`#daw-fx-ab-copy-btn`) allowing producers to A/B test complex mix changes instantly without losing settings.
  - Five Broadcast Channel Strip Presets (`#daw-fx-channel-strip-select`):
    1. **BBC/NPR Voice Polish**: Highpass 80Hz, +2dB presence, -7dB de-esser, modern compression with auto-makeup, gentle noise gate, brickwall peak limiting.
    2. **Warm Film Dialogue**: Rich low-end chest resonance, scooped mids, LA-2A optical leveler, tape warmth saturation, and subtle booth acoustics.
    3. **Radio Punch & Presence**: Aggressive 1176 FET limiting (8:1), tape drive, punchy mid-band lift, and maximizer.
    4. **Podcast Clean Suite**: Fast noise gating, targeted de-essing, transparent leveling, and master ceiling.
    5. **Master Bus Maximizer**: Stereo wideness (125%), SSL G-Master bus glue, and +3.5dB brickwall limiting.
  - De-zippered parameter smoothing (`setTargetAtTime` 15ms exponential ramps) across audio nodes eliminating clicks and pops when modulating controls during live playback.
- **Deployment**:
  - Built with Vite into `dist/` and deployed live to Cloudflare Pages production (`https://localfilm-studio.pages.dev` / `https://studio.localfilm.online` / hash `https://5a62a0a3.localfilm-studio.pages.dev`).

