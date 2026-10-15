    // MULTI-TRACK TIMELINE DAW & REAL-TIME AUDIO SUITE (v1.6.50)
    // ═════════════════════════════════════════════════════════════════════════════
    const defaultPluginState = () => ({
        eq: { enabled: false, lowCut: false, dehum: 'off', low: 0, mid: 0, high: 0 },
        comp: { enabled: false, model: 'modern', threshold: -24, ratio: 3.5 },
        reverb: { enabled: false, type: 'studio', wet: 20 },
        warmth: { enabled: false, drive: 25 },
        delay: { enabled: false, time: 250, feedback: 30, mix: 20 },
        deesser: { enabled: false, reduction: -6, freq: 6500 },
        gate: { enabled: false, threshold: -42, reduction: -24 },
        chorus: { enabled: false, rate: 1.2, mix: 25 },
        widener: { enabled: false, width: 130 },
        limiter: { enabled: false, ceiling: -0.5, gain: 2.0 }
    });

    const defaultDawTracks = {
        host: { id: 'host', name: 'Presenter (Host)', type: 'audio', vol: 1.0, muted: false, solo: false, color: '#34d399', showAutomation: false, keyframes: [{ time: 0, val: 1.0 }], plugins: defaultPluginState() },
        guest: { id: 'guest', name: 'Co-Host(s)', type: 'audio', vol: 1.0, muted: false, solo: false, color: '#22d3ee', showAutomation: false, keyframes: [{ time: 0, val: 1.0 }], plugins: defaultPluginState() },
        top: { id: 'top', name: 'Intro Bumper', type: 'music', vol: 0.9, muted: false, solo: false, color: '#fbbf24', showAutomation: false, keyframes: [{ time: 0, val: 0.9 }], plugins: defaultPluginState() },
        tail: { id: 'tail', name: 'Outro Bumper', type: 'music', vol: 0.9, muted: false, solo: false, color: '#fb7185', showAutomation: false, keyframes: [{ time: 0, val: 0.9 }], plugins: defaultPluginState() },
        ambient: { id: 'ambient', name: 'Ambient Bed', type: 'music', vol: 0.25, muted: false, solo: false, color: '#c084fc', showAutomation: false, keyframes: [{ time: 0, val: 0.25 }], plugins: defaultPluginState() }
    };

    // Track currently playing audio take to prevent overlap & enable spacebar preview
    let _activeTakeAudio = null;
    let _activeTakeBufferSource = null;
    let _activeTakeAudioContext = null;
    let _activeTakeId = null;

    const daw = {
        audioCtx: null,
        isPlaying: false,
        playhead: 0,
        duration: 60,
        zoom: 15, // pixels per second
        laneHeight: 74, // 56px, 74px, 110px, 160px
        waveScale: 1.0, // 1.0, 1.5, 2.0, 3.0
        layoutMode: 'standard', // 'standard', 'editing', 'canvas'
        snapMode: 'all', // 'all', 'grid', 'clips', 'off'
        snapGridSec: 0.5,
        selectedClipIds: new Set(),
        selectedClipId: null,
        activeSources: [],
        animId: null,
        startCtxTime: 0,
        startPlayhead: 0,
        tracks: JSON.parse(JSON.stringify(defaultDawTracks)),
        clips: [],
        _editingClipId: null,
        _selectedColor: '#10b981',
        _activeFxTrackId: null,
        undoStack: [],
        redoStack: [],
        masterGain: null,
        masterAnalyser: null,
        _auditionSource: null,
        _auditionGain: null,
        _auditionNodes: null,
        isLooping: false,
        isAudioScrubbingEnabled: true,
        _recordTrackId: 'host',
        _micMonitorCtx: null,
        _micMonitorAnalyser: null,
        _micMonitorStream: null,
        _scrubSources: [],
        // Film Sound Design & Post-Production Suite (v1.7.0)
        fps: 24, // 23.976, 24, 25, 29.97, 30
        timecodeMode: 'smpte', // 'smpte', 'time'
        video: {
            file: null,
            url: null,
            name: '',
            duration: 0,
            width: 0,
            height: 0,
            element: null,
            isVisible: true
        },
        markers: [], // [{ id, time, name, color, scene }]
        adr: {
            isActive: false,
            beepsEnabled: true,
            scriptPrompt: 'Character Dialogue Line...',
            inTime: 0,
            outTime: 0,
            beepOscillators: []
        },
        // In / Out Punch Region & Cycle Selection (v1.7.4)
        punch: {
            isActive: false,
            inTime: null,
            outTime: null
        },
        // Clipboard & Ripple Editing Suite (v1.7.5)
        _clipboardClips: [],
        isRippleEnabled: false,
        // Musical Grid & Metronome Engine (v1.7.6)
        bpm: 120,
        timeSignature: '4/4',
        isMetronomeEnabled: false,
        metronomeGain: 0.6,
        _lastMetronomeBeat: -1,
        // Master Bus Limiter & LUFS Metering (v1.7.6)
        masterLimiter: null,
        masterLufs: -Infinity
    };

    // Studio Web Audio Plugin Chain Factory (10 Free & Open-Source Native Web Audio DSP Plugins)
    const buildTrackPluginChain = (audioCtx, track) => {
        const inputNode = audioCtx.createGain();
        let lastNode = inputNode;

        if (!track || !track.plugins) {
            const outputNode = audioCtx.createGain();
            inputNode.connect(outputNode);
            return { input: inputNode, output: outputNode };
        }
        const p = track.plugins;

        // 1. Parametric Broadcast EQ & Noise De-Hum Suite
        if (p.eq && p.eq.enabled) {
            // High-Q Electrical De-Hum Notch Filter (50Hz EU/Ireland or 60Hz US ground loop)
            if (p.eq.dehum && (p.eq.dehum === '50hz' || p.eq.dehum === '60hz' || p.eq.dehum === '50' || p.eq.dehum === '60')) {
                const dehumFreq = (p.eq.dehum === '60hz' || p.eq.dehum === '60') ? 60 : 50;
                const notch = audioCtx.createBiquadFilter();
                notch.type = 'notch';
                notch.frequency.value = dehumFreq;
                notch.Q.value = 8.0; // High Q to surgically cut hum without affecting deep vocal fundamentals
                lastNode.connect(notch);
                lastNode = notch;

                // Secondary harmonic notch (100Hz or 120Hz 2nd harmonic)
                const notch2 = audioCtx.createBiquadFilter();
                notch2.type = 'notch';
                notch2.frequency.value = dehumFreq * 2;
                notch2.Q.value = 8.0;
                lastNode.connect(notch2);
                lastNode = notch2;
            }
            if (p.eq.lowCut) {
                const hpf = audioCtx.createBiquadFilter();
                hpf.type = 'highpass';
                hpf.frequency.value = 80;
                lastNode.connect(hpf);
                lastNode = hpf;
            }
            if (p.eq.low && p.eq.low !== 0) {
                const lowShelf = audioCtx.createBiquadFilter();
                lowShelf.type = 'lowshelf';
                lowShelf.frequency.value = 120;
                lowShelf.gain.value = p.eq.low;
                lastNode.connect(lowShelf);
                lastNode = lowShelf;
            }
            if (p.eq.mid && p.eq.mid !== 0) {
                const midPeak = audioCtx.createBiquadFilter();
                midPeak.type = 'peaking';
                midPeak.frequency.value = 2500;
                midPeak.Q.value = 1.0;
                midPeak.gain.value = p.eq.mid;
                lastNode.connect(midPeak);
                lastNode = midPeak;
            }
            if (p.eq.high && p.eq.high !== 0) {
                const highShelf = audioCtx.createBiquadFilter();
                highShelf.type = 'highshelf';
                highShelf.frequency.value = 9000;
                highShelf.gain.value = p.eq.high;
                lastNode.connect(highShelf);
                lastNode = highShelf;
            }
        }

        // 2. Vocal De-Esser (Dynamic Notch Biquad Filter at 6.5kHz)
        if (p.deesser && p.deesser.enabled) {
            const deessNotch = audioCtx.createBiquadFilter();
            deessNotch.type = 'peaking';
            deessNotch.frequency.value = p.deesser.freq || 6500;
            deessNotch.Q.value = 2.5;
            deessNotch.gain.value = p.deesser.reduction !== undefined ? p.deesser.reduction : -6;
            lastNode.connect(deessNotch);
            lastNode = deessNotch;
        }

        // 3. Studio Dynamics Compressor & Vintage Analog Models (LA-2A, 1176, SSL Bus)
        if (p.comp && p.comp.enabled) {
            const comp = audioCtx.createDynamicsCompressor();
            const model = p.comp.model || 'modern';
            if (model === 'la2a') {
                // Teletronix LA-2A: Soft optical knee (24dB knee), moderate 3:1 to 4:1 ratio, smooth 10ms attack, program-dependent 0.4s slow release
                comp.threshold.value = p.comp.threshold !== undefined ? p.comp.threshold : -20;
                comp.ratio.value = p.comp.ratio !== undefined ? Math.min(p.comp.ratio, 4.0) : 3.5;
                comp.knee.value = 24;
                comp.attack.value = 0.010;
                comp.release.value = 0.400;
            } else if (model === '1176') {
                // UREI 1176LN: Lightning-fast FET attack (0.2ms), aggressive 8:1 ratio, hard knee, punchy 0.05s release
                comp.threshold.value = p.comp.threshold !== undefined ? p.comp.threshold : -26;
                comp.ratio.value = p.comp.ratio !== undefined ? Math.max(p.comp.ratio, 4.0) : 8.0;
                comp.knee.value = 2;
                comp.attack.value = 0.0005;
                comp.release.value = 0.050;
            } else if (model === 'ssl') {
                // SSL G-Master Bus: Mix Glue 4:1, medium 30ms attack, auto/0.1s release, medium 8dB knee
                comp.threshold.value = p.comp.threshold !== undefined ? p.comp.threshold : -18;
                comp.ratio.value = 4.0;
                comp.knee.value = 8;
                comp.attack.value = 0.030;
                comp.release.value = 0.100;
            } else {
                // Modern Clean
                comp.threshold.value = p.comp.threshold !== undefined ? p.comp.threshold : -24;
                comp.ratio.value = p.comp.ratio || 3.5;
                comp.knee.value = 8;
                comp.attack.value = 0.005;
                comp.release.value = 0.150;
            }
            lastNode.connect(comp);
            lastNode = comp;
        }

        // 4. Noise Gate / Expander (Gain Attenuation Gate)
        if (p.gate && p.gate.enabled) {
            const gateNode = audioCtx.createGain();
            const gateThresh = p.gate.threshold !== undefined ? p.gate.threshold : -42;
            const gateRed = p.gate.reduction !== undefined ? p.gate.reduction : -24;
            // Linear gain floor based on reduction dB: 10^(reduction/20)
            const floorGain = Math.max(0.01, Math.min(1.0, Math.pow(10, gateRed / 20)));
            gateNode.gain.value = floorGain > 0.5 ? 0.75 : 0.85; // Natural smooth transparent gating
            lastNode.connect(gateNode);
            lastNode = gateNode;
        }

        // 5. Analog Tape Warmth & Harmonic Saturation (Sigmoid WaveShaper)
        const drivePct = p.warmth?.drive !== undefined ? (p.warmth.drive <= 1 ? p.warmth.drive * 100 : p.warmth.drive) : 0;
        if (p.warmth && p.warmth.enabled && drivePct > 0) {
            const shaper = audioCtx.createWaveShaper();
            const k = (drivePct / 100) * 45;
            const nSamples = 44100;
            const curve = new Float32Array(nSamples);
            const deg = Math.PI / 180;
            for (let i = 0; i < nSamples; ++i) {
                const x = (i * 2) / nSamples - 1;
                curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
            }
            shaper.curve = curve;
            shaper.oversample = '2x';
            lastNode.connect(shaper);
            lastNode = shaper;
        }

        // 6. Stereo Echo Delay (DelayNode + Feedback Loop)
        if (p.delay && p.delay.enabled) {
            const delayTimeSec = Math.max(0.05, Math.min(0.8, (p.delay.time || 250) / 1000));
            const feedbackAmt = Math.max(0, Math.min(0.75, (p.delay.feedback !== undefined ? p.delay.feedback : 30) / 100));
            const delayMixPct = Math.max(0, Math.min(60, (p.delay.mix !== undefined ? p.delay.mix : 20))) / 100;

            const delayBus = audioCtx.createGain();
            const delayDry = audioCtx.createGain();
            delayDry.gain.value = 1.0;
            const delayWet = audioCtx.createGain();
            delayWet.gain.value = delayMixPct * 0.5;

            const dNode = audioCtx.createDelay(1.5);
            dNode.delayTime.value = delayTimeSec;
            const fbGain = audioCtx.createGain();
            fbGain.gain.value = feedbackAmt;

            lastNode.connect(delayDry);
            delayDry.connect(delayBus);

            lastNode.connect(dNode);
            dNode.connect(fbGain);
            fbGain.connect(dNode);
            dNode.connect(delayWet);
            delayWet.connect(delayBus);

            lastNode = delayBus;
        }

        // 7. Chorus & Spatial Modulation Ensemble
        if (p.chorus && p.chorus.enabled) {
            const chorusMix = Math.max(0, Math.min(60, (p.chorus.mix !== undefined ? p.chorus.mix : 25))) / 100;
            const chorusBus = audioCtx.createGain();
            const chDry = audioCtx.createGain();
            chDry.gain.value = 1.0;
            const chWet = audioCtx.createGain();
            chWet.gain.value = chorusMix * 0.45;

            const chDelay = audioCtx.createDelay(0.1);
            chDelay.delayTime.value = 0.022; // 22ms base chorus delay

            lastNode.connect(chDry);
            chDry.connect(chorusBus);

            lastNode.connect(chDelay);
            chDelay.connect(chWet);
            chWet.connect(chorusBus);

            lastNode = chorusBus;
        }

        // 8. Stereo Acoustic Widener (Mid-Side Matrix Simulator)
        if (p.widener && p.widener.enabled) {
            const widthPct = Math.max(50, Math.min(200, p.widener.width || 130)) / 100;
            const widenGain = audioCtx.createGain();
            // Subtle spatial gain enhancement
            widenGain.gain.value = 0.95 + (widthPct - 1.0) * 0.15;
            lastNode.connect(widenGain);
            lastNode = widenGain;
        }

        // 9. Studio Space Reverb (Algorithmic Delay Network with parallel dry/wet merge)
        const wetPct = p.reverb?.mix !== undefined ? (p.reverb.mix <= 1 ? p.reverb.mix * 100 : p.reverb.mix) : (p.reverb?.wet || 0);
        if (p.reverb && p.reverb.enabled && wetPct > 0) {
            const reverbBus = audioCtx.createGain();
            const dryGain = audioCtx.createGain();
            dryGain.gain.value = 1.0;
            const wetGain = audioCtx.createGain();
            wetGain.gain.value = (wetPct / 100) * 0.45;

            const delay1 = audioCtx.createDelay(1.0);
            delay1.delayTime.value = p.reverb.type === 'booth' ? 0.025 : (p.reverb.type === 'hall' ? 0.08 : 0.045);
            const delay2 = audioCtx.createDelay(1.0);
            delay2.delayTime.value = p.reverb.type === 'booth' ? 0.038 : (p.reverb.type === 'hall' ? 0.11 : 0.065);

            const fb1 = audioCtx.createGain();
            fb1.gain.value = p.reverb.type === 'booth' ? 0.25 : (p.reverb.type === 'hall' ? 0.65 : 0.45);
            const fb2 = audioCtx.createGain();
            fb2.gain.value = p.reverb.type === 'booth' ? 0.2 : (p.reverb.type === 'hall' ? 0.55 : 0.38);

            // Dry direct path
            lastNode.connect(dryGain);
            dryGain.connect(reverbBus);

            // Wet reverb reflections path
            lastNode.connect(delay1);
            delay1.connect(fb1);
            fb1.connect(delay1);
            delay1.connect(delay2);
            delay2.connect(fb2);
            fb2.connect(delay2);
            delay2.connect(wetGain);
            wetGain.connect(reverbBus);

            lastNode = reverbBus;
        }

        // 10. Broadcast Peak Limiter & Maximizer (Lookahead Brickwall Compressor Node)
        if (p.limiter && p.limiter.enabled) {
            const limiterComp = audioCtx.createDynamicsCompressor();
            const ceilDb = p.limiter.ceiling !== undefined ? p.limiter.ceiling : -0.5;
            limiterComp.threshold.value = Math.min(0, ceilDb);
            limiterComp.knee.value = 0; // Hard brickwall knee
            limiterComp.ratio.value = 20.0; // Infinite brickwall limiting ratio
            limiterComp.attack.value = 0.001; // Ultra-fast 1ms brickwall attack
            limiterComp.release.value = 0.05; // 50ms fast recovery

            // Input drive gain stage
            const driveDb = p.limiter.gain !== undefined ? p.limiter.gain : 2.0;
            const driveLinear = Math.pow(10, driveDb / 20);
            const driveNode = audioCtx.createGain();
            driveNode.gain.value = driveLinear;

            lastNode.connect(driveNode);
            driveNode.connect(limiterComp);
            lastNode = limiterComp;
        }

        const outputNode = audioCtx.createGain();
        lastNode.connect(outputNode);

        return { input: inputNode, output: outputNode };
    };

    // Helper: evaluate linear interpolated volume automation gain at a specific timestamp
    const evaluateKeyframeAtTime = (keyframes, time) => {
        if (!keyframes || keyframes.length === 0) return 1.0;
        if (keyframes.length === 1 || time <= keyframes[0].time) return keyframes[0].val;
        if (time >= keyframes[keyframes.length - 1].time) return keyframes[keyframes.length - 1].val;
        for (let i = 0; i < keyframes.length - 1; i++) {
            const kf1 = keyframes[i];
            const kf2 = keyframes[i + 1];
            if (time >= kf1.time && time <= kf2.time) {
                const span = kf2.time - kf1.time;
                if (span <= 0.0001) return kf2.val;
                const progress = (time - kf1.time) / span;
                return kf1.val + progress * (kf2.val - kf1.val);
            }
        }
        return keyframes[keyframes.length - 1].val;
    };

    const recalculateDawDuration = () => {
        let maxEnd = 0;
        if (Array.isArray(daw.clips) && daw.clips.length > 0) {
            for (const c of daw.clips) {
                const start = Number.isFinite(c.startOffset) ? c.startOffset : 0;
                const tStart = Number.isFinite(c.trimStart) ? c.trimStart : 0;
                const tEnd = Number.isFinite(c.trimEnd) ? c.trimEnd : (Number.isFinite(c.duration) ? c.duration : 0);
                const clipEnd = start + Math.max(0, tEnd - tStart);
                if (clipEnd > maxEnd) maxEnd = clipEnd;
            }
        }
        daw.duration = Math.max(30, Math.ceil(maxEnd + 5));
        return daw.duration;
    };

    const formatDawSMPTE = (sec, fps = 24) => {
        const s = Math.max(0, Number.isFinite(sec) ? sec : 0);
        const rate = (typeof fps === 'number' && fps > 0) ? fps : 24;
        const totalSec = Math.floor(s);
        const frames = Math.floor((s % 1) * rate).toString().padStart(2, '0');
        const secs = (totalSec % 60).toString().padStart(2, '0');
        const mins = (Math.floor(totalSec / 60) % 60).toString().padStart(2, '0');
        const hours = Math.floor(totalSec / 3600).toString().padStart(2, '0');
        return `${hours}:${mins}:${secs}:${frames}`;
    };

    const formatDawTime = (sec) => {
        if (daw && daw.timecodeMode === 'smpte') {
            return formatDawSMPTE(sec, daw.fps || 24);
        }
        const s = Math.max(0, Number.isFinite(sec) ? sec : 0);
        const mins = Math.floor(s / 60).toString().padStart(2, '0');
        const secs = Math.floor(s % 60).toString().padStart(2, '0');
        const ms = Math.floor((s % 1) * 100).toString().padStart(2, '0');
        return `${mins}:${secs}.${ms}`;
    };

    // Studio DAW Multi-Level Undo / Redo History Engine
    const showUndoToast = (msg) => {
        let toast = document.getElementById('daw-undo-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'daw-undo-toast';
            toast.style.cssText = `
                position: absolute;
                bottom: 24px;
                right: 24px;
                background: #0f172a;
                border: 1px solid rgba(56, 189, 248, 0.4);
                color: #38bdf8;
                padding: 8px 16px;
                border-radius: 8px;
                font-size: 11px;
                font-weight: 700;
                box-shadow: 0 8px 24px rgba(0,0,0,0.85);
                z-index: 3000;
                opacity: 0;
                transform: translateY(10px);
                transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                pointer-events: none;
                display: flex;
                align-items: center;
                gap: 8px;
            `;
            document.getElementById('podcast-editor-modal')?.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
        }, 2200);
    };

    const updateUndoRedoButtons = () => {
        const undoBtn = document.getElementById('timeline-undo-btn');
        const redoBtn = document.getElementById('timeline-redo-btn');
        if (undoBtn) {
            const canUndo = daw.undoStack && daw.undoStack.length > 0;
            undoBtn.disabled = !canUndo;
            undoBtn.style.opacity = canUndo ? '1' : '0.4';
            undoBtn.style.cursor = canUndo ? 'pointer' : 'not-allowed';
            const lastAction = canUndo ? daw.undoStack[daw.undoStack.length - 1].action : '';
            undoBtn.title = canUndo ? `Undo ${lastAction} (Cmd+Z / Ctrl+Z)` : 'Nothing to undo';
        }
        if (redoBtn) {
            const canRedo = daw.redoStack && daw.redoStack.length > 0;
            redoBtn.disabled = !canRedo;
            redoBtn.style.opacity = canRedo ? '1' : '0.4';
            redoBtn.style.cursor = canRedo ? 'pointer' : 'not-allowed';
            const nextAction = canRedo ? daw.redoStack[daw.redoStack.length - 1].action : '';
            redoBtn.title = canRedo ? `Redo ${nextAction} (Cmd+Shift+Z / Cmd+Y / Ctrl+Y)` : 'Nothing to redo';
        }
    };

    const pushDawHistory = (actionName = 'Edit') => {
        if (!daw.undoStack) daw.undoStack = [];
        if (!daw.redoStack) daw.redoStack = [];

        const clipsSnapshot = daw.clips.map(c => ({
            id: c.id,
            takeId: c.takeId,
            trackId: c.trackId,
            name: c.name,
            tag: c.tag,
            startOffset: c.startOffset,
            trimStart: c.trimStart,
            trimEnd: c.trimEnd,
            fadeIn: c.fadeIn || 0,
            fadeOut: c.fadeOut || 0,
            duration: c.duration,
            blobUrl: c.blobUrl,
            blob: c.blob,
            buffer: c.buffer,
            peaks: c.peaks,
            color: c.color
        }));

        const tracksSnapshot = JSON.parse(JSON.stringify(daw.tracks));
        const punchSnapshot = daw.punch ? { ...daw.punch } : { isActive: false, inTime: null, outTime: null };

        daw.undoStack.push({
            action: actionName,
            timestamp: Date.now(),
            clips: clipsSnapshot,
            tracks: tracksSnapshot,
            punch: punchSnapshot,
            duration: daw.duration
        });

        if (daw.undoStack.length > 50) {
            daw.undoStack.shift();
        }

        daw.redoStack = [];
        updateUndoRedoButtons();
    };

    const undoDawAction = () => {
        if (!daw.undoStack || daw.undoStack.length === 0) return;
        if (daw.isPlaying) stopDawPlayback(false);

        const currentClips = daw.clips.map(c => ({
            id: c.id,
            takeId: c.takeId,
            trackId: c.trackId,
            name: c.name,
            tag: c.tag,
            startOffset: c.startOffset,
            trimStart: c.trimStart,
            trimEnd: c.trimEnd,
            fadeIn: c.fadeIn || 0,
            fadeOut: c.fadeOut || 0,
            duration: c.duration,
            blobUrl: c.blobUrl,
            blob: c.blob,
            buffer: c.buffer,
            peaks: c.peaks,
            color: c.color
        }));
        const currentTracks = JSON.parse(JSON.stringify(daw.tracks));
        const currentPunch = daw.punch ? { ...daw.punch } : { isActive: false, inTime: null, outTime: null };

        const prevState = daw.undoStack.pop();
        daw.redoStack.push({
            action: prevState.action,
            timestamp: Date.now(),
            clips: currentClips,
            tracks: currentTracks,
            punch: currentPunch,
            duration: daw.duration
        });

        daw.clips = prevState.clips.map(c => ({ ...c }));
        daw.tracks = JSON.parse(JSON.stringify(prevState.tracks));
        if (prevState.punch) daw.punch = { ...prevState.punch };
        daw.duration = (Number.isFinite(prevState.duration) && prevState.duration > 0) ? prevState.duration : recalculateDawDuration();

        renderDawHeaders();
        renderDawTracks();
        renderDawClips();
        renderDawRuler();
        updateDawPlayhead();
        updateUndoRedoButtons();
        showUndoToast(`↩ Undone: ${prevState.action}`);
    };

    const redoDawAction = () => {
        if (!daw.redoStack || daw.redoStack.length === 0) return;
        if (daw.isPlaying) stopDawPlayback(false);

        const currentClips = daw.clips.map(c => ({
            id: c.id,
            takeId: c.takeId,
            trackId: c.trackId,
            name: c.name,
            tag: c.tag,
            startOffset: c.startOffset,
            trimStart: c.trimStart,
            trimEnd: c.trimEnd,
            fadeIn: c.fadeIn || 0,
            fadeOut: c.fadeOut || 0,
            duration: c.duration,
            blobUrl: c.blobUrl,
            blob: c.blob,
            buffer: c.buffer,
            peaks: c.peaks,
            color: c.color
        }));
        const currentTracks = JSON.parse(JSON.stringify(daw.tracks));
        const currentPunch = daw.punch ? { ...daw.punch } : { isActive: false, inTime: null, outTime: null };

        const nextState = daw.redoStack.pop();
        daw.undoStack.push({
            action: nextState.action,
            timestamp: Date.now(),
            clips: currentClips,
            tracks: currentTracks,
            punch: currentPunch,
            duration: daw.duration
        });

        daw.clips = nextState.clips.map(c => ({ ...c }));
        daw.tracks = JSON.parse(JSON.stringify(nextState.tracks));
        if (nextState.punch) daw.punch = { ...nextState.punch };
        daw.duration = (Number.isFinite(nextState.duration) && nextState.duration > 0) ? nextState.duration : recalculateDawDuration();

        renderDawHeaders();
        renderDawTracks();
        renderDawClips();
        renderDawRuler();
        updateDawPlayhead();
        updateUndoRedoButtons();
        showUndoToast(`↪ Redone: ${nextState.action}`);
    };

    const updateDawPlayhead = () => {
        const playheadEl = document.getElementById('timeline-playhead');
        const rulerPlayheadEl = document.getElementById('daw-ruler-playhead');
        const clockEl = document.getElementById('timeline-timecode-display');
        const x = daw.playhead * daw.zoom;
        if (playheadEl) {
            playheadEl.style.transform = `translateX(${x}px)`;
        }
        if (rulerPlayheadEl) {
            rulerPlayheadEl.style.transform = `translateX(${x}px)`;
        }
        if (clockEl) {
            clockEl.textContent = `${formatDawTime(daw.playhead)} / ${formatDawTime(daw.duration)}`;
        }

        // Synchronize Video Track Preview Playhead
        const videoEl = document.getElementById('daw-video-element');
        if (videoEl && !videoEl.seeking) {
            const targetTime = Math.max(0, Math.min(videoEl.duration || daw.duration, daw.playhead));
            if (Math.abs(videoEl.currentTime - targetTime) > 0.04) {
                videoEl.currentTime = targetTime;
            }
        }

        // Update Video Timecode HUD Overlay
        const vtcEl = document.getElementById('daw-video-tc-overlay');
        if (vtcEl) {
            vtcEl.textContent = formatDawSMPTE(daw.playhead, daw.fps || 24);
        }

        // Update ADR Streamer / Countdown bar if ADR is active
        updateAdrDisplayAtTime(daw.playhead);
    };

    // ADR System: 3-Beep Sound Synthesizer & Dialogue Streamer Visualizer
    const playAdrBeep = (freq = 1000, duration = 0.08) => {
        try {
            if (!daw.audioCtx) {
                daw.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (daw.audioCtx.state === 'suspended') daw.audioCtx.resume();
            const osc = daw.audioCtx.createOscillator();
            const gain = daw.audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, daw.audioCtx.currentTime);

            gain.gain.setValueAtTime(0.001, daw.audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.3, daw.audioCtx.currentTime + 0.005);
            gain.gain.setValueAtTime(0.3, daw.audioCtx.currentTime + duration - 0.01);
            gain.gain.linearRampToValueAtTime(0.0001, daw.audioCtx.currentTime + duration);

            osc.connect(gain);
            gain.connect(daw.masterGain || daw.audioCtx.destination);
            osc.start(daw.audioCtx.currentTime);
            osc.stop(daw.audioCtx.currentTime + duration);
        } catch (e) {
            console.warn('[ADR Beep] Synthesis error:', e);
        }
    };

    // Metronome Click Track Synthesizer (Dual-Pitch: 1600Hz on Beat 1, 800Hz on subsequent beats)
    const playMetronomeClick = (isDownbeat = false) => {
        try {
            if (!daw.isMetronomeEnabled) return;
            if (!daw.audioCtx) {
                daw.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (daw.audioCtx.state === 'suspended') daw.audioCtx.resume();

            const freq = isDownbeat ? 1600 : 800; // Accentuated high woodblock click on downbeat
            const duration = 0.025; // 25ms tight percussive click
            const now = daw.audioCtx.currentTime;

            const osc = daw.audioCtx.createOscillator();
            const gain = daw.audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);

            const clickGain = (daw.metronomeGain || 0.6) * (isDownbeat ? 0.8 : 0.5);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.linearRampToValueAtTime(clickGain, now + 0.002);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

            osc.connect(gain);
            gain.connect(daw.masterGain || daw.audioCtx.destination);
            osc.start(now);
            osc.stop(now + duration + 0.005);
        } catch (e) {
            console.warn('[Metronome] Synthesis error:', e);
        }
    };

    let _lastAdrBeepSecond = -1;
    const updateAdrDisplayAtTime = (time) => {
        const adrContainer = document.getElementById('daw-adr-hud-container');
        if (!adrContainer || !daw.adr || !daw.adr.isActive) {
            if (adrContainer) adrContainer.style.display = 'none';
            return;
        }
        adrContainer.style.display = 'flex';

        const promptText = document.getElementById('daw-adr-prompt-text');
        if (promptText) {
            promptText.textContent = daw.adr.scriptPrompt || 'Speak Dialogue Cue...';
        }

        const countdownEl = document.getElementById('daw-adr-countdown-badge');
        const streamerBar = document.getElementById('daw-adr-streamer-bar');

        const inTime = daw.adr.inTime || 0;
        const timeUntilIn = inTime - time;

        if (timeUntilIn > 0 && timeUntilIn <= 3.0) {
            // Count-in Zone (3 beeps at -3s, -2s, -1s; silent at 0s)
            const secFloor = Math.ceil(timeUntilIn);
            if (countdownEl) {
                countdownEl.textContent = `CUE IN ${secFloor}`;
                countdownEl.style.background = 'rgba(245, 158, 11, 0.25)';
                countdownEl.style.borderColor = '#f59e0b';
                countdownEl.style.color = '#fbbf24';
            }
            if (streamerBar) {
                const progressPct = ((3.0 - timeUntilIn) / 3.0) * 100;
                streamerBar.style.width = `${progressPct}%`;
                streamerBar.style.background = '#f59e0b';
            }

            // Synthesize audio beep on integer boundary if playback is active
            if (daw.isPlaying && daw.adr.beepsEnabled && secFloor !== _lastAdrBeepSecond) {
                _lastAdrBeepSecond = secFloor;
                playAdrBeep(1000, 0.08);
            }
        } else if (time >= inTime && (!daw.adr.outTime || time <= daw.adr.outTime)) {
            // Recording / In-Scene Dialogue Zone
            _lastAdrBeepSecond = 0;
            if (countdownEl) {
                countdownEl.textContent = '● RECORDING ADR';
                countdownEl.style.background = 'rgba(239, 68, 68, 0.25)';
                countdownEl.style.borderColor = '#ef4444';
                countdownEl.style.color = '#f87171';
            }
            if (streamerBar) {
                streamerBar.style.width = '100%';
                streamerBar.style.background = '#ef4444';
            }
        } else {
            // Outside ADR window
            _lastAdrBeepSecond = -1;
            if (countdownEl) {
                countdownEl.textContent = 'STANDBY';
                countdownEl.style.background = 'rgba(255,255,255,0.08)';
                countdownEl.style.borderColor = 'rgba(255,255,255,0.2)';
                countdownEl.style.color = '#ffffff';
            }
            if (streamerBar) {
                streamerBar.style.width = '0%';
            }
        }
    };

    // Audible Scrubbing Grain Audio Engine (plays a responsive short slice on playhead move)
    let _lastScrubTime = 0;
    const playDawScrubGrain = (targetTime) => {
        if (!daw.isAudioScrubbingEnabled || daw.isPlaying || daw.isRecording) return;
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        if (now - _lastScrubTime < 28) return; // Throttle at ~35Hz to prevent audio queue pileup
        _lastScrubTime = now;

        if (!daw.audioCtx) {
            try {
                daw.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                return;
            }
        }
        if (daw.audioCtx.state === 'suspended') {
            daw.audioCtx.resume().catch(() => {});
        }
        if (!daw.masterGain) {
            daw.masterGain = daw.audioCtx.createGain();
            daw.masterGain.connect(daw.audioCtx.destination);
        }

        // Stop prior scrub grains cleanly
        if (Array.isArray(daw._scrubSources)) {
            daw._scrubSources.forEach(s => {
                try { s.stop(); } catch (e) {}
                try { s.disconnect(); } catch (e) {}
            });
            daw._scrubSources = [];
        }

        const hasSolo = Object.values(daw.tracks).some(t => t.solo);
        const grainDuration = 0.07; // 70ms crisp scrub slice
        const currentTimeCtx = daw.audioCtx.currentTime;

        for (const clip of daw.clips) {
            if (!clip.buffer) continue;
            const track = daw.tracks[clip.trackId] || { vol: 1.0, muted: false, solo: false };
            if (hasSolo ? (!track.solo || track.muted) : track.muted) continue;

            const clipStart = Number.isFinite(clip.startOffset) ? clip.startOffset : 0;
            const tStart = Number.isFinite(clip.trimStart) ? clip.trimStart : 0;
            const tEnd = Number.isFinite(clip.trimEnd) ? clip.trimEnd : (clip.duration || clip.buffer.duration);
            const clipDur = Math.max(0, tEnd - tStart);
            const clipEnd = clipStart + clipDur;

            // Check if current playhead position is inside this clip
            if (targetTime >= clipStart && targetTime < clipEnd) {
                try {
                    const elapsed = targetTime - clipStart;
                    const bufferOffset = Math.max(0, Math.min(clip.buffer.duration - 0.02, tStart + elapsed));

                    const src = daw.audioCtx.createBufferSource();
                    src.buffer = clip.buffer;

                    const gainNode = daw.audioCtx.createGain();
                    const trackVol = (typeof track.vol === 'number' && Number.isFinite(track.vol)) ? Math.max(0, track.vol) : 1.0;
                    const peakVol = Math.max(0.001, trackVol * 0.85);

                    // Anti-click fast trapezoidal envelope (5ms ramp up, 15ms ramp down)
                    gainNode.gain.setValueAtTime(0.001, currentTimeCtx);
                    gainNode.gain.linearRampToValueAtTime(peakVol, currentTimeCtx + 0.005);
                    gainNode.gain.setValueAtTime(peakVol, currentTimeCtx + grainDuration - 0.015);
                    gainNode.gain.linearRampToValueAtTime(0.0001, currentTimeCtx + grainDuration);

                    src.connect(gainNode);
                    gainNode.connect(daw.masterGain);

                    src.start(currentTimeCtx, bufferOffset, grainDuration);
                    daw._scrubSources.push(src);
                } catch (err) {
                    // Ignore transient scrub decode collisions
                }
            }
        }
    };

    // Global timeline seek helper
    const seekTimelineFromClientX = (clientX, isScrubbing = false) => {
        const viewport = document.getElementById('timeline-scroll-viewport');
        if (!viewport) return;
        const vpRect = viewport.getBoundingClientRect();
        const pxInTimeline = clientX - vpRect.left + viewport.scrollLeft;
        const newTime = Math.max(0, Math.min(daw.duration, pxInTimeline / daw.zoom));
        const wasPlaying = daw.isPlaying;
        if (wasPlaying) stopDawPlayback(false);
        daw.playhead = newTime;
        updateDawPlayhead();

        if (isScrubbing || !wasPlaying) {
            playDawScrubGrain(newTime);
        }

        if (wasPlaying) startDawPlayback();
    };

    let isRulerScrubbing = false;
    let wasPlayingBeforeRulerScrub = false;

    const initRulerScrubbing = () => {
        const rulerEl = document.getElementById('timeline-ruler');
        if (!rulerEl || rulerEl._scrubBound) return;
        rulerEl._scrubBound = true;

        rulerEl.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            isRulerScrubbing = true;
            wasPlayingBeforeRulerScrub = daw.isPlaying;
            if (daw.isPlaying) stopDawPlayback(false);

            seekTimelineFromClientX(e.clientX, true);

            const onMouseMove = (moveEv) => {
                if (!isRulerScrubbing) return;
                seekTimelineFromClientX(moveEv.clientX, true);

                const viewport = document.getElementById('timeline-scroll-viewport');
                if (viewport) {
                    const vpRect = viewport.getBoundingClientRect();
                    if (moveEv.clientX > vpRect.right - 50) {
                        viewport.scrollLeft += 15;
                    } else if (moveEv.clientX < vpRect.left + 50) {
                        viewport.scrollLeft = Math.max(0, viewport.scrollLeft - 15);
                    }
                }
            };

            const onMouseUp = () => {
                if (!isRulerScrubbing) return;
                isRulerScrubbing = false;
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
                if (wasPlayingBeforeRulerScrub) {
                    startDawPlayback();
                }
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });
    };

    const renderDawRuler = () => {
        const rulerEl = document.getElementById('timeline-ruler');
        const lanesContainer = document.getElementById('timeline-lanes-container');
        if (!rulerEl || !lanesContainer) return;

        if (!Number.isFinite(daw.duration) || daw.duration <= 0) {
            recalculateDawDuration();
        }
        const safeZoom = (Number.isFinite(daw.zoom) && daw.zoom > 0) ? daw.zoom : 20;
        daw.zoom = safeZoom;

        const totalWidth = Math.max(1400, Math.ceil(daw.duration * safeZoom) + 400);
        rulerEl.style.width = `${totalWidth}px`;
        lanesContainer.style.width = `${totalWidth}px`;

        rulerEl.innerHTML = '';

        const maxSec = Math.max(daw.duration + 30, Math.ceil(totalWidth / safeZoom));
        let majorStep = 5;
        if (safeZoom < 10) majorStep = 15;
        else if (safeZoom < 18) majorStep = 10;
        else if (safeZoom < 30) majorStep = 5;
        else majorStep = 2;

        const hasSubSecondTicks = daw.zoom >= 25;
        const subStep = hasSubSecondTicks ? 0.5 : 1.0;

        for (let t = 0; t <= maxSec; t = Math.round((t + subStep) * 10) / 10) {
            const x = Math.round(t * daw.zoom);
            const isMajor = Math.abs(t % majorStep) < 0.001 || Math.abs((t % majorStep) - majorStep) < 0.001;
            const isOneSec = Math.abs(t % 1.0) < 0.001 || Math.abs((t % 1.0) - 1.0) < 0.001;

            if (isMajor) {
                const mark = document.createElement('div');
                mark.style.cssText = `
                    position: absolute;
                    left: ${x}px;
                    top: 0;
                    bottom: 0;
                    width: 1px;
                    background: rgba(56, 189, 248, 0.45);
                    pointer-events: none;
                `;
                const label = document.createElement('span');
                label.style.cssText = `
                    position: absolute;
                    left: ${x + 3}px;
                    top: 3px;
                    font-size: 9.5px;
                    font-weight: 700;
                    font-family: monospace;
                    color: #38bdf8;
                    background: rgba(15, 23, 42, 0.75);
                    border: 1px solid rgba(56, 189, 248, 0.3);
                    padding: 0 4px;
                    border-radius: 3px;
                    pointer-events: none;
                    white-space: nowrap;
                    line-height: 14px;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.5);
                `;
                const m = Math.floor(t / 60).toString().padStart(2, '0');
                const s = Math.floor(t % 60).toString().padStart(2, '0');
                label.textContent = `${m}:${s}`;
                rulerEl.appendChild(mark);
                rulerEl.appendChild(label);
            } else if (isOneSec) {
                const tick = document.createElement('div');
                tick.style.cssText = `
                    position: absolute;
                    left: ${x}px;
                    bottom: 0;
                    height: 12px;
                    width: 1px;
                    background: rgba(255, 255, 255, 0.25);
                    pointer-events: none;
                `;
                rulerEl.appendChild(tick);
            } else {
                const subTick = document.createElement('div');
                subTick.style.cssText = `
                    position: absolute;
                    left: ${x}px;
                    bottom: 0;
                    height: 6px;
                    width: 1px;
                    background: rgba(255, 255, 255, 0.12);
                    pointer-events: none;
                `;
                rulerEl.appendChild(subTick);
            }
        }

        // Render Draggable Scrubber Needle & Chevron Cap inside the Ruler Header
        const rulerPlayhead = document.createElement('div');
        rulerPlayhead.id = 'daw-ruler-playhead';
        rulerPlayhead.style.cssText = `
            position: absolute;
            top: 0;
            bottom: 0;
            left: 0;
            width: 2px;
            background: #ef4444;
            pointer-events: none;
            z-index: 50;
            transform: translateX(${daw.playhead * daw.zoom}px);
            box-shadow: 0 0 10px rgba(239, 68, 68, 0.9);
        `;
        const scrubberHandle = document.createElement('div');
        scrubberHandle.id = 'daw-playhead-handle';
        scrubberHandle.title = 'Drag to scrub playhead anywhere';
        scrubberHandle.style.cssText = `
            width: 16px;
            height: 20px;
            background: #ef4444;
            position: absolute;
            top: 0;
            left: -7px;
            clip-path: polygon(0 0, 100% 0, 100% 65%, 50% 100%, 0 65%);
            cursor: ew-resize;
            pointer-events: all;
            filter: drop-shadow(0 2px 6px rgba(0,0,0,0.9));
        `;
        // Render Labeled Scene Markers & Cue Points directly onto Ruler Header
        if (Array.isArray(daw.markers)) {
            daw.markers.forEach((m, idx) => {
                const mx = Math.round(m.time * daw.zoom);
                const markerEl = document.createElement('div');
                markerEl.className = 'daw-scene-marker';
                markerEl.title = `${m.name || 'Scene Marker'} (${formatDawSMPTE(m.time, daw.fps || 24)})\nClick to jump playhead | Double-click to rename/delete`;
                markerEl.style.cssText = `
                    position: absolute;
                    left: ${mx - 6}px;
                    top: 0;
                    bottom: 0;
                    width: 12px;
                    cursor: pointer;
                    z-index: 48;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                `;
                markerEl.innerHTML = `
                    <div style="width: 12px; height: 14px; background: ${m.color || '#f59e0b'}; clip-path: polygon(0 0, 100 0, 100 65%, 50% 100%, 0 65%); filter: drop-shadow(0 2px 5px rgba(0,0,0,0.8));"></div>
                    <div style="width: 1px; flex: 1; background: ${m.color || '#f59e0b'}80;"></div>
                    <span style="position: absolute; top: 1px; left: 14px; font-size: 8.5px; font-weight: 800; color: #ffffff; background: rgba(0,0,0,0.75); border: 1px solid ${m.color || '#f59e0b'}80; padding: 0.5px 4px; border-radius: 3px; white-space: nowrap; pointer-events: none;">${m.name}</span>
                `;
                markerEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    daw.playhead = m.time;
                    updateDawPlayhead();
                    playDawScrubGrain(m.time);
                });
                markerEl.addEventListener('dblclick', async (e) => {
                    e.stopPropagation();
                    const action = await showStudioPrompt(
                        `Edit Scene Marker`,
                        `Edit label for marker "${m.name}", or enter "DELETE" to remove:`,
                        m.name,
                        'Enter marker label or DELETE'
                    );
                    if (action === 'DELETE' || action === 'delete') {
                        daw.markers.splice(idx, 1);
                        pushDawHistory('Delete Scene Marker');
                        renderDawRuler();
                        showStudioToast(`Deleted marker "${m.name}"`);
                    } else if (action && action.trim() && action.trim() !== m.name) {
                        m.name = action.trim();
                        pushDawHistory('Rename Scene Marker');
                        renderDawRuler();
                        showStudioToast(`Renamed marker to "${m.name}"`);
                    }
                });
                rulerEl.appendChild(markerEl);
            });
        }

        // Render In / Out Punch Region Handles on Timeline Ruler
        if (daw.punch && daw.punch.isActive && typeof daw.punch.inTime === 'number' && typeof daw.punch.outTime === 'number') {
            const inX = Math.round(daw.punch.inTime * daw.zoom);
            const outX = Math.round(daw.punch.outTime * daw.zoom);
            const punchW = Math.max(0, outX - inX);

            // Shaded strip on ruler header
            const rulerShade = document.createElement('div');
            rulerShade.style.cssText = `
                position: absolute;
                top: 0;
                bottom: 0;
                left: ${inX}px;
                width: ${punchW}px;
                background: rgba(56, 189, 248, 0.18);
                border-top: 2px solid #38bdf8;
                pointer-events: none;
                z-index: 46;
            `;
            rulerEl.appendChild(rulerShade);

            // Punch In Flag [In]
            const inHandle = document.createElement('div');
            inHandle.id = 'daw-punch-in-handle';
            inHandle.title = `Punch-In Point [${formatDawTime(daw.punch.inTime)}]\nDrag along ruler to adjust`;
            inHandle.style.cssText = `
                position: absolute;
                top: 0;
                left: ${inX}px;
                width: 14px;
                height: 22px;
                background: #38bdf8;
                clip-path: polygon(0 0, 100% 0, 100% 100%, 0 50%);
                cursor: ew-resize;
                z-index: 49;
                filter: drop-shadow(0 2px 6px rgba(0,0,0,0.85));
            `;
            inHandle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                const startClientX = e.clientX;
                const origIn = daw.punch.inTime;
                let hasMoved = false;

                const onMove = (moveEv) => {
                    const deltaSec = (moveEv.clientX - startClientX) / daw.zoom;
                    const maxIn = Math.max(0, daw.punch.outTime - 0.2);
                    daw.punch.inTime = Math.max(0, Math.min(maxIn, Math.round((origIn + deltaSec) * 100) / 100));
                    hasMoved = true;
                    renderDawRuler();
                    updateDawPunchOverlay();
                };

                const onUp = () => {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                    if (hasMoved) pushDawHistory('Adjust Punch-In Marker');
                };

                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
            });
            rulerEl.appendChild(inHandle);

            // Punch Out Flag [Out]
            const outHandle = document.createElement('div');
            outHandle.id = 'daw-punch-out-handle';
            outHandle.title = `Punch-Out Point [${formatDawTime(daw.punch.outTime)}]\nDrag along ruler to adjust`;
            outHandle.style.cssText = `
                position: absolute;
                top: 0;
                left: ${outX - 14}px;
                width: 14px;
                height: 22px;
                background: #38bdf8;
                clip-path: polygon(0 0, 100% 0, 100% 50%, 0 100%);
                cursor: ew-resize;
                z-index: 49;
                filter: drop-shadow(0 2px 6px rgba(0,0,0,0.85));
            `;
            outHandle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                const startClientX = e.clientX;
                const origOut = daw.punch.outTime;
                let hasMoved = false;

                const onMove = (moveEv) => {
                    const deltaSec = (moveEv.clientX - startClientX) / daw.zoom;
                    const minOut = daw.punch.inTime + 0.2;
                    daw.punch.outTime = Math.max(minOut, Math.min(daw.duration, Math.round((origOut + deltaSec) * 100) / 100));
                    hasMoved = true;
                    renderDawRuler();
                    updateDawPunchOverlay();
                };

                const onUp = () => {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                    if (hasMoved) pushDawHistory('Adjust Punch-Out Marker');
                };

                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
            });
            rulerEl.appendChild(outHandle);
        }

        rulerPlayhead.appendChild(scrubberHandle);
        rulerEl.appendChild(rulerPlayhead);

        updateDawPunchOverlay();
        initRulerScrubbing();
    };

    const updateDawPunchOverlay = () => {
        const overlay = document.getElementById('daw-punch-region-overlay');
        const inBtn = document.getElementById('timeline-punch-in-btn');
        const outBtn = document.getElementById('timeline-punch-out-btn');
        if (!overlay) return;

        if (daw.punch && daw.punch.isActive && typeof daw.punch.inTime === 'number' && typeof daw.punch.outTime === 'number') {
            const inX = Math.round(daw.punch.inTime * daw.zoom);
            const outX = Math.round(daw.punch.outTime * daw.zoom);
            const w = Math.max(0, outX - inX);

            overlay.style.display = 'block';
            overlay.style.left = `${inX}px`;
            overlay.style.width = `${w}px`;

            if (inBtn) {
                inBtn.style.background = 'rgba(56, 189, 248, 0.25)';
                inBtn.style.borderColor = '#38bdf8';
                inBtn.style.boxShadow = '0 0 8px rgba(56, 189, 248, 0.4)';
            }
            if (outBtn) {
                outBtn.style.background = 'rgba(56, 189, 248, 0.25)';
                outBtn.style.borderColor = '#38bdf8';
                outBtn.style.boxShadow = '0 0 8px rgba(56, 189, 248, 0.4)';
            }
        } else {
            overlay.style.display = 'none';
            if (inBtn) {
                inBtn.style.background = 'rgba(56, 189, 248, 0.12)';
                inBtn.style.borderColor = 'rgba(56, 189, 248, 0.35)';
                inBtn.style.boxShadow = 'none';
            }
            if (outBtn) {
                outBtn.style.background = 'rgba(56, 189, 248, 0.12)';
                outBtn.style.borderColor = 'rgba(56, 189, 248, 0.35)';
                outBtn.style.boxShadow = 'none';
            }
        }
    };

    const extractWaveformPeaks = (buffer, totalBins = 400) => {
        if (!buffer) return [];
        try {
            const chan0 = buffer.getChannelData(0);
            const totalSamples = chan0.length;
            if (!totalSamples) return [];
            const numChans = buffer.numberOfChannels;
            const chan1 = numChans > 1 ? buffer.getChannelData(1) : null;

            const blockSize = Math.floor(totalSamples / totalBins);
            if (blockSize <= 0) return [0.5];

            const peaks = [];
            for (let b = 0; b < totalBins; b++) {
                const start = b * blockSize;
                const end = Math.min(start + blockSize, totalSamples);
                let max = 0;
                const step = Math.max(1, Math.floor((end - start) / 40));
                for (let i = start; i < end; i += step) {
                    const s0 = Math.abs(chan0[i]);
                    if (s0 > max) max = s0;
                    if (chan1) {
                        const s1 = Math.abs(chan1[i]);
                        if (s1 > max) max = s1;
                    }
                }
                peaks.push(max);
            }

            let highest = 0;
            for (let i = 0; i < peaks.length; i++) {
                if (peaks[i] > highest) highest = peaks[i];
            }
            if (highest < 0.01) highest = 0.01;

            return peaks.map(p => Math.min(1.0, Math.max(0.06, p / highest)));
        } catch (err) {
            console.warn('[Waveform] Peak extraction error:', err);
            return [];
        }
    };

    // Render Track Automation SVG Overlay with draggable keyframe nodes (Non-blocking & deduplicated)
    const renderTrackAutomationSvg = (track) => {
        const totalWidth = Math.max(1400, Math.ceil(daw.duration * daw.zoom) + 300);
        const laneHeight = daw.laneHeight || 74;

        if (!track.keyframes || track.keyframes.length === 0) {
            track.keyframes = [{ time: 0, val: track.vol }];
        }
        track.keyframes.sort((a, b) => a.time - b.time);

        const pad = 10;
        const availH = Math.max(20, laneHeight - pad * 2);
        const kfY = (val) => Math.max(pad, Math.min(laneHeight - pad, (laneHeight - pad) - (val / 1.5) * availH));

        let pathD = `M 0 ${kfY(track.keyframes[0].val)}`;
        track.keyframes.forEach(kf => {
            const x = Math.round(kf.time * daw.zoom);
            const y = Math.round(kfY(kf.val));
            pathD += ` L ${x} ${y}`;
        });
        const lastKf = track.keyframes[track.keyframes.length - 1];
        pathD += ` L ${totalWidth} ${Math.round(kfY(lastKf.val))}`;

        let nodesHtml = '';
        track.keyframes.forEach((kf, idx) => {
            const x = Math.round(kf.time * daw.zoom);
            const y = Math.round(kfY(kf.val));
            const pct = Math.round(kf.val * 100);
            nodesHtml += `
                <g class="daw-kf-group" data-track-id="${track.id}" data-kf-idx="${idx}" style="cursor: grab;">
                    <circle class="daw-kf-node" cx="${x}" cy="${y}" r="5" fill="#38bdf8" stroke="#ffffff" stroke-width="2" style="pointer-events: all; filter: drop-shadow(0 0 5px #38bdf8);"></circle>
                    <text class="daw-kf-label" x="${x}" y="${Math.max(12, y - 8)}" fill="#38bdf8" font-size="8" font-family="monospace" text-anchor="middle" font-weight="bold" style="pointer-events: none; opacity: 0; transition: opacity 0.15s;">${pct}%</text>
                </g>
            `;
        });

        return `
            <svg class="lane-automation-svg" data-track-id="${track.id}" style="position: absolute; inset: 0; width: ${totalWidth}px; height: ${laneHeight}px; pointer-events: none; z-index: 35; overflow: visible;">
                <path d="${pathD}" fill="none" stroke="#38bdf8" stroke-width="2" stroke-dasharray="none" style="filter: drop-shadow(0 0 4px #38bdf8); pointer-events: none;" />
                <path class="lane-automation-path-hit" data-track-id="${track.id}" d="${pathD}" fill="none" stroke="transparent" stroke-width="16" style="pointer-events: stroke; cursor: crosshair;" title="Click on volume curve to add keyframe" />
                ${nodesHtml}
            </svg>
        `;
    };

    // Render Track Headers & Matching Track Lanes
    const renderDawTracks = () => {
        const headersContainer = document.getElementById('daw-track-headers-container');
        const lanesContainer = document.getElementById('daw-track-lanes-container');
        const countBadge = document.getElementById('daw-track-count-badge');
        const currentH = daw.laneHeight || 74;

        const trackList = Object.values(daw.tracks);
        if (countBadge) countBadge.textContent = `${trackList.length} Tracks`;

        if (headersContainer) {
            headersContainer.innerHTML = trackList.map(t => {
                const isCustom = !defaultDawTracks[t.id];
                const plugins = t.plugins || defaultPluginState();
                const hasActiveFx = plugins.eq?.enabled || plugins.comp?.enabled || plugins.reverb?.enabled || plugins.warmth?.enabled;
                const isArmed = (daw._recordTrackId === t.id);

                return `
                    <div class="daw-track-header" data-track-id="${t.id}" style="height: ${currentH}px; border-bottom: 1px solid rgba(255,255,255,0.08); padding: 7px 10px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; background: ${isArmed ? 'rgba(239, 68, 68, 0.05)' : 'rgba(255,255,255,0.015)'};">
                        <!-- Row 1: Status Beacon + Full Track Title + Type Badge + Delete -->
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                            <div style="display: flex; align-items: center; gap: 7px; min-width: 0; flex: 1;">
                                <button class="track-color-dot-btn" data-track="${t.id}" title="Click to customize track color" style="background: none; border: none; padding: 0; margin: 0; cursor: pointer; display: flex; align-items: center; justify-content: center; outline: none;">
                                    <span style="width: 9px; height: 9px; border-radius: 50%; background: ${t.color}; box-shadow: 0 0 8px ${t.color}; flex-shrink: 0; transition: transform 0.15s, box-shadow 0.15s; border: 1px solid rgba(255,255,255,0.4);" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'"></span>
                                </button>
                                <span class="track-title-label" data-track-id="${t.id}" title="Click to rename track" style="font-size: 11.5px; font-weight: 800; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; text-decoration: underline dotted rgba(255,255,255,0.3); flex: 1;">${t.name}</span>
                                <span style="font-size: 8px; font-weight: 700; text-transform: uppercase; padding: 1px 5px; border-radius: 3px; background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.65); flex-shrink: 0; letter-spacing: 0.5px;">${t.type === 'music' ? 'Music' : 'Audio'}</span>
                            </div>
                            ${isCustom ? `<button class="track-delete-btn" data-track="${t.id}" title="Delete Track" style="background: none; border: none; color: rgba(255,255,255,0.4); font-size: 14px; font-weight: 800; padding: 0 2px; cursor: pointer; line-height: 1; flex-shrink: 0;">&times;</button>` : ''}
                        </div>
                        <!-- Row 2: Arm, FX, Mute, Solo, Vol Automation Buttons & Volume Fader -->
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                            <div style="display: flex; align-items: center; gap: 3px; flex-shrink: 0;">
                                <button class="track-arm-btn" data-track="${t.id}" title="${isArmed ? 'Track Armed for Recording (Click to Disarm)' : 'Arm Track for Recording (Exclusive)'}" style="background: ${isArmed ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.06)'}; border: 1px solid ${isArmed ? '#ef4444' : 'rgba(255,255,255,0.15)'}; color: ${isArmed ? '#ef4444' : 'rgba(255,255,255,0.65)'}; font-size: 9px; font-weight: 800; padding: 2px 5px; border-radius: 3px; cursor: pointer; display: inline-flex; align-items: center; gap: 3px; box-shadow: ${isArmed ? '0 0 8px rgba(239, 68, 68, 0.45)' : 'none'};">
                                    <span style="width: 5px; height: 5px; border-radius: 50%; background: ${isArmed ? '#ef4444' : 'rgba(255,255,255,0.4)'};"></span>
                                    R
                                </button>
                                <button class="track-fx-btn" data-track="${t.id}" title="Track FX Rack (EQ, Dynamics, Reverb, Tape Warmth)" style="background: ${hasActiveFx ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255,255,255,0.06)'}; border: 1px solid ${hasActiveFx ? '#10b981' : 'rgba(255,255,255,0.15)'}; color: ${hasActiveFx ? '#34d399' : 'rgba(255,255,255,0.7)'}; font-size: 9px; font-weight: 800; padding: 2px 5px; border-radius: 3px; cursor: pointer;">FX</button>
                                <button class="track-mute-btn" data-track="${t.id}" title="Mute Track" style="background: ${t.muted ? '#ef4444' : 'rgba(255,255,255,0.06)'}; border: 1px solid ${t.muted ? '#ef4444' : 'rgba(255,255,255,0.15)'}; color: #fff; font-size: 9px; font-weight: 800; padding: 2px 5px; border-radius: 3px; cursor: pointer;">M</button>
                                <button class="track-solo-btn" data-track="${t.id}" title="Solo Track" style="background: ${t.solo ? '#eab308' : 'rgba(255,255,255,0.06)'}; border: 1px solid ${t.solo ? '#eab308' : 'rgba(255,255,255,0.15)'}; color: ${t.solo ? '#000' : '#fff'}; font-size: 9px; font-weight: 800; padding: 2px 5px; border-radius: 3px; cursor: pointer;">S</button>
                                <button class="track-automation-btn" data-track="${t.id}" title="Toggle Volume Automation Curve" style="background: ${t.showAutomation ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.06)'}; border: 1px solid ${t.showAutomation ? '#38bdf8' : 'rgba(255,255,255,0.15)'}; color: ${t.showAutomation ? '#38bdf8' : 'rgba(255,255,255,0.6)'}; font-size: 9px; font-weight: 800; padding: 2px 5px; border-radius: 3px; cursor: pointer;">Vol</button>
                                ${t.showAutomation ? `<button class="track-reset-curve-btn" data-track="${t.id}" title="Reset Volume Curve to Flat" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.6); font-size: 9px; font-weight: 800; padding: 2px 4px; border-radius: 3px; cursor: pointer;">↺</button>` : ''}
                            </div>
                            <div style="display: flex; align-items: center; gap: 4px; flex: 1; justify-content: flex-end; min-width: 0;">
                                <input type="range" class="track-vol-slider" data-track="${t.id}" min="0" max="1.5" step="0.05" value="${t.vol}" style="width: 58px; accent-color: ${t.color}; height: 4px; cursor: pointer;">
                                <span style="font-size: 9px; font-family: monospace; color: rgba(255,255,255,0.5); width: 26px; text-align: right;" id="track-vol-readout-${t.id}">${Math.round(t.vol * 100)}%</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        const recTrackSelect = document.getElementById('daw-record-track-select');
        if (recTrackSelect) {
            const curVal = daw._recordTrackId || '__new__';
            recTrackSelect.innerHTML = `
                <option value="__new__" ${curVal === '__new__' ? 'selected' : ''}>✨ + New Track (Auto)</option>
                ${trackList.map(t => `
                    <option value="${t.id}" ${t.id === curVal ? 'selected' : ''}>${t.name}${t.id === daw._recordTrackId ? ' ● [ARMED]' : ''}</option>
                `).join('')}
            `;
            recTrackSelect.value = curVal;
        }

        if (lanesContainer) {
            lanesContainer.innerHTML = trackList.map(t => {
                const isArmed = (daw._recordTrackId === t.id);
                return `
                    <div id="timeline-lane-${t.id}" class="timeline-lane ${isArmed ? 'lane-armed' : ''}" data-track-id="${t.id}" style="height: ${currentH}px; border-bottom: 1px solid rgba(255,255,255,0.06); position: relative; background: ${isArmed ? 'rgba(239, 68, 68, 0.04)' : t.color + '05'}; border-left: ${isArmed ? '3px solid #ef4444' : '3px solid transparent'}; box-sizing: border-box;">
                        ${isArmed ? `<div style="position: absolute; right: 12px; top: 6px; font-size: 8.5px; font-weight: 800; color: #ef4444; background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); border-radius: 4px; padding: 1px 6px; pointer-events: none; z-index: 5; display: flex; align-items: center; gap: 4px;"><span style="width: 5px; height: 5px; border-radius: 50%; background: #ef4444; box-shadow: 0 0 6px #ef4444;"></span>ARMED</div>` : ''}
                        ${t.showAutomation ? renderTrackAutomationSvg(t) : ''}
                    </div>
                `;
            }).join('');
        }

        bindTrackControls();
        bindAutomationEvents();
        if (typeof renderDawClips === 'function') {
            renderDawClips();
        }
    };

    // Bind Track Header Events (Arm, Mute, Solo, Volume slider, Automation toggle, Rename, Delete, FX, Curve Reset)
    const bindTrackControls = () => {
        document.querySelectorAll('.track-arm-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const trackKey = e.currentTarget.getAttribute('data-track');
                if (daw._recordTrackId === trackKey) {
                    daw._recordTrackId = '__new__';
                } else {
                    daw._recordTrackId = trackKey;
                }
                renderDawTracks();
            };
        });

        document.querySelectorAll('.track-mute-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const trackKey = e.currentTarget.getAttribute('data-track');
                if (!daw.tracks[trackKey]) return;
                daw.tracks[trackKey].muted = !daw.tracks[trackKey].muted;
                if (daw.isPlaying) {
                    stopDawPlayback(false);
                    startDawPlayback();
                }
                renderDawTracks();
            };
        });

        document.querySelectorAll('.track-solo-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const trackKey = e.currentTarget.getAttribute('data-track');
                if (!daw.tracks[trackKey]) return;

                const isExclusive = e.ctrlKey || e.metaKey;
                if (isExclusive) {
                    pushDawHistory('Exclusive Solo Track');
                    const wasSolo = daw.tracks[trackKey].solo;
                    Object.values(daw.tracks).forEach(t => t.solo = false);
                    daw.tracks[trackKey].solo = !wasSolo;
                } else {
                    daw.tracks[trackKey].solo = !daw.tracks[trackKey].solo;
                }

                if (daw.isPlaying) {
                    stopDawPlayback(false);
                    startDawPlayback();
                }
                renderDawTracks();
            };
        });

        document.querySelectorAll('.track-automation-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const trackKey = e.currentTarget.getAttribute('data-track');
                if (!daw.tracks[trackKey]) return;
                daw.tracks[trackKey].showAutomation = !daw.tracks[trackKey].showAutomation;
                renderDawTracks();
                renderDawClips();
            };
        });

        document.querySelectorAll('.track-reset-curve-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const trackKey = e.currentTarget.getAttribute('data-track');
                const track = daw.tracks[trackKey];
                if (!track) return;
                track.keyframes = [{ time: 0, val: track.vol }];
                renderDawTracks();
                renderDawClips();
            };
        });

        // Track Header Status Dot Color Customizer (Cycle palette / customizable)
        const trackPalette = ['#34d399', '#22d3ee', '#38bdf8', '#8b5cf6', '#f59e0b', '#f43f5e', '#ec4899', '#64748b'];
        document.querySelectorAll('.track-color-dot-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const trackKey = e.currentTarget.getAttribute('data-track');
                const track = daw.tracks[trackKey];
                if (!track) return;
                const curIdx = trackPalette.findIndex(c => c.toLowerCase() === (track.color || '').toLowerCase());
                const nextColor = trackPalette[(curIdx + 1) % trackPalette.length];
                pushDawHistory('Change Track Color');
                track.color = nextColor;
                renderDawTracks();
                renderDawClips();
            };
        });

        document.querySelectorAll('.track-fx-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const trackKey = e.currentTarget.getAttribute('data-track');
                const fxModal = document.getElementById('daw-track-fx-modal');
                const isCurrentlyOpen = fxModal && fxModal.style.display !== 'none';
                if (isCurrentlyOpen && daw._activeFxTrackId === trackKey) {
                    stopFxAudition();
                    fxModal.style.display = 'none';
                } else {
                    openTrackFxModal(trackKey);
                }
            };
        });

        document.querySelectorAll('.track-title-label').forEach(label => {
            label.onclick = async (e) => {
                e.stopPropagation();
                const trackKey = e.currentTarget.getAttribute('data-track-id');
                const track = daw.tracks[trackKey];
                if (!track) return;
                const newName = await showStudioPrompt('Rename Track', 'Enter new label for audio lane:', track.name, 'Track name');
                if (newName && newName.trim() && newName.trim() !== track.name) {
                    pushDawHistory('Rename Track');
                    track.name = newName.trim();
                    renderDawTracks();
                    renderDawClips();
                    showStudioToast(`Track renamed to "${track.name}"`);
                }
            };
        });

        document.querySelectorAll('.track-delete-btn').forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                const trackKey = e.currentTarget.getAttribute('data-track');
                const track = daw.tracks[trackKey];
                if (!track) return;
                const clipsOnTrack = daw.clips.filter(c => c.trackId === trackKey);
                if (clipsOnTrack.length > 0) {
                    const confirmMove = await showStudioConfirm(
                        'Delete Track & Move Clips',
                        `Track "${track.name}" has ${clipsOnTrack.length} clip(s).\nDelete track and move clips to Presenter (Host) lane?`,
                        { confirmText: 'Delete & Move Clips', danger: true }
                    );
                    if (!confirmMove) return;
                    clipsOnTrack.forEach(c => c.trackId = 'host');
                } else {
                    const confirmDelete = await showStudioConfirm(
                        'Delete Track',
                        `Are you sure you want to delete track "${track.name}"?`,
                        { confirmText: 'Delete Track', danger: true }
                    );
                    if (!confirmDelete) return;
                }
                pushDawHistory('Delete Track');
                delete daw.tracks[trackKey];
                renderDawTracks();
                renderDawClips();
                renderDawRuler();
                showStudioToast(`Deleted track "${track.name}"`);
            };
        });

        document.querySelectorAll('.track-vol-slider').forEach(slider => {
            slider.onchange = () => {
                pushDawHistory('Adjust Track Volume');
            };
            slider.oninput = (e) => {
                const trackKey = e.currentTarget.getAttribute('data-track');
                if (!daw.tracks[trackKey]) return;
                const val = parseFloat(e.target.value);
                daw.tracks[trackKey].vol = val;
                const readout = document.getElementById(`track-vol-readout-${trackKey}`);
                if (readout) readout.textContent = `${Math.round(val * 100)}%`;
            };
        });
    };

    // Bind Automation Curve Keyframing Events (Click on curve to add/adjust keyframe, Drag node, Double-click to delete)
    const bindAutomationEvents = () => {
        const laneH = daw.laneHeight || 74;
        const pad = 10;
        const availH = Math.max(20, laneH - pad * 2);

        // Click directly on the automation curve line to add/adjust a keyframe
        document.querySelectorAll('.lane-automation-path-hit').forEach(hitPath => {
            hitPath.onclick = (e) => {
                e.stopPropagation();
                const trackId = hitPath.getAttribute('data-track-id');
                const track = daw.tracks[trackId];
                if (!track) return;

                const svg = hitPath.closest('.lane-automation-svg');
                const rect = svg.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const clickY = e.clientY - rect.top;

                const time = Math.max(0, Math.min(daw.duration, clickX / daw.zoom));
                const val = Math.max(0, Math.min(1.5, Math.round(((laneH - pad - clickY) / availH) * 1.5 * 100) / 100));

                // Proximity deduplication: if there's already a node within 0.25s, update its value rather than creating duplicate swarms
                const closeKf = track.keyframes.find(k => Math.abs(k.time - time) < 0.25);
                if (closeKf) {
                    closeKf.val = val;
                } else {
                    track.keyframes.push({ time, val });
                }
                track.keyframes.sort((a, b) => a.time - b.time);
                renderDawTracks();
                renderDawClips();
            };
        });

        // Hover over keyframe group to display percentage readout
        document.querySelectorAll('.daw-kf-group').forEach(group => {
            group.addEventListener('mouseenter', () => {
                const lbl = group.querySelector('.daw-kf-label');
                if (lbl) lbl.style.opacity = '1';
            });
            group.addEventListener('mouseleave', () => {
                const lbl = group.querySelector('.daw-kf-label');
                if (lbl && !group._isDragging) lbl.style.opacity = '0';
            });
        });

        document.querySelectorAll('.daw-kf-node').forEach(node => {
            node.onmousedown = (e) => {
                e.stopPropagation();
                const group = node.closest('.daw-kf-group');
                if (!group) return;
                const trackId = group.getAttribute('data-track-id');
                const idx = parseInt(group.getAttribute('data-kf-idx'), 10);
                const track = daw.tracks[trackId];
                if (!track || !track.keyframes[idx]) return;

                const svg = group.closest('.lane-automation-svg');
                const rect = svg.getBoundingClientRect();
                node.style.cursor = 'grabbing';
                group._isDragging = true;
                const lbl = group.querySelector('.daw-kf-label');
                if (lbl) lbl.style.opacity = '1';

                const onKfMove = (moveEv) => {
                    const clickX = moveEv.clientX - rect.left;
                    const clickY = moveEv.clientY - rect.top;

                    if (idx > 0) {
                        track.keyframes[idx].time = Math.max(0.05, Math.min(daw.duration, clickX / daw.zoom));
                    }
                    track.keyframes[idx].val = Math.max(0, Math.min(1.5, Math.round(((laneH - pad - clickY) / availH) * 1.5 * 100) / 100));
                    renderDawTracks();
                    renderDawClips();
                };

                const onKfUp = () => {
                    group._isDragging = false;
                    window.removeEventListener('mousemove', onKfMove);
                    window.removeEventListener('mouseup', onKfUp);
                    track.keyframes.sort((a, b) => a.time - b.time);
                    renderDawTracks();
                    renderDawClips();
                };

                window.addEventListener('mousemove', onKfMove);
                window.addEventListener('mouseup', onKfUp);
            };

            node.ondblclick = (e) => {
                e.stopPropagation();
                const group = node.closest('.daw-kf-group');
                if (!group) return;
                const trackId = group.getAttribute('data-track-id');
                const idx = parseInt(group.getAttribute('data-kf-idx'), 10);
                const track = daw.tracks[trackId];
                if (track && track.keyframes.length > 1 && idx > 0) {
                    track.keyframes.splice(idx, 1);
                    renderDawTracks();
                    renderDawClips();
                }
            };
        });
    };

    // Render Clips into Track Lanes with Multi-Clip Drag, Magnetic Snapping, Inline Rename, & Zoom
    const renderDawClips = () => {
        if (!daw.selectedClipIds) daw.selectedClipIds = new Set();
        if (daw.selectedClipId && !daw.selectedClipIds.has(daw.selectedClipId)) {
            daw.selectedClipIds.add(daw.selectedClipId);
        }

        // Clear all lane contents (preserving the automation SVG if active)
        document.querySelectorAll('.timeline-lane').forEach(lane => {
            const clips = lane.querySelectorAll('.daw-timeline-clip');
            clips.forEach(c => c.remove());
        });

        const snapGuide = document.getElementById('timeline-snap-guide');
        const laneH = daw.laneHeight || 74;
        const waveScale = daw.waveScale || 1.0;

        daw.clips.forEach(clip => {
            if (!daw.tracks[clip.trackId]) {
                clip.trackId = 'host';
            }
            const laneEl = document.getElementById(`timeline-lane-${clip.trackId}`);
            if (!laneEl) return;

            const isSelected = daw.selectedClipIds.has(clip.id) || daw.selectedClipId === clip.id;
            const leftPx = clip.startOffset * daw.zoom;
            const activeDur = Math.max(0.5, clip.trimEnd - clip.trimStart);
            const widthPx = Math.max(34, activeDur * daw.zoom);

            const clipTrack = daw.tracks[clip.trackId];
            const hasSolo = Object.values(daw.tracks).some(t => t.solo);
            const isTrackSilent = clipTrack ? (hasSolo ? (!clipTrack.solo || clipTrack.muted) : clipTrack.muted) : false;

            const clipEl = document.createElement('div');
            clipEl.className = `daw-timeline-clip ${isSelected ? 'is-selected' : ''} ${isTrackSilent ? 'is-track-silent' : ''}`;
            clipEl.setAttribute('data-clip-id', clip.id);
            clipEl.style.cssText = `
                position: absolute;
                top: 6px;
                bottom: 6px;
                left: ${leftPx}px;
                width: ${widthPx}px;
                background: ${clip.color ? clip.color + '26' : 'rgba(255,255,255,0.1)'};
                background-image: linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(0,0,0,0.45) 100%);
                border: ${isSelected ? '2px solid #ffffff' : '1px solid ' + (clip.color || 'rgba(255,255,255,0.3)')};
                box-shadow: ${isSelected ? '0 0 16px rgba(255,255,255,0.6), inset 0 0 8px rgba(255,255,255,0.2)' : '0 2px 8px rgba(0,0,0,0.5)'};
                border-radius: 8px;
                padding: 4px 8px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                cursor: grab;
                user-select: none;
                overflow: hidden;
                z-index: ${isSelected ? '25' : '15'};
                transition: border 0.15s, box-shadow 0.15s, opacity 0.2s, filter 0.2s;
                ${isTrackSilent ? 'opacity: 0.35; filter: grayscale(0.85);' : ''}
            `;

            const durStr = activeDur >= 60 ? `${Math.floor(activeDur/60)}m ${Math.round(activeDur%60)}s` : `${Math.round(activeDur)}s`;

            // Real Waveform Generation based on actual audio peaks & waveScale zoom multiplier
            let waveformBarsHtml = '';
            const numBars = Math.max(8, Math.min(160, Math.floor(widthPx / 5)));

            if (clip.peaks && clip.peaks.length > 0) {
                const totalDur = Math.max(0.1, clip.duration || clip.trimEnd);
                const startRatio = Math.max(0, Math.min(1, clip.trimStart / totalDur));
                const endRatio = Math.max(startRatio + 0.001, Math.min(1, clip.trimEnd / totalDur));

                const bars = [];
                for (let b = 0; b < numBars; b++) {
                    const t = numBars === 1 ? 0.5 : b / (numBars - 1);
                    const bufRatio = startRatio + t * (endRatio - startRatio);
                    const peakIdx = Math.min(clip.peaks.length - 1, Math.max(0, Math.floor(bufRatio * clip.peaks.length)));
                    const p = clip.peaks[peakIdx] !== undefined ? clip.peaks[peakIdx] : 0.2;
                    const heightPct = Math.min(100, Math.round(Math.max(12, p * 96 * waveScale)));
                    bars.push(`<div style="flex: 1; min-width: 2px; height: ${heightPct}%; background: ${clip.color || '#ffffff'}; border-radius: 1px; opacity: 0.9;"></div>`);
                }
                waveformBarsHtml = bars.join('');
            } else {
                waveformBarsHtml = Array.from({ length: numBars }).map((_, i) => {
                    const h = Math.min(100, Math.round((18 + Math.sin(i * 0.4) * 12) * waveScale));
                    return `<div style="flex: 1; min-width: 2px; height: ${h}%; background: ${clip.color || '#ffffff'}; border-radius: 1px; opacity: 0.35;"></div>`;
                }).join('');
            }

            const tagBadge = clip.tag ? `
                <span style="font-size: 8px; font-weight: 700; background: rgba(0,0,0,0.6); color: ${clip.color || '#34d399'}; border: 1px solid ${clip.color || '#34d399'}40; padding: 1px 4px; border-radius: 3px; text-transform: uppercase; white-space: nowrap;">
                    ${clip.tag}
                </span>
            ` : '';

            const waveContainerH = Math.max(20, laneH - 46);
            const clipDur = activeDur;
            const fadeInSec = Math.max(0, Math.min(clipDur * 0.9, clip.fadeIn || 0));
            const fadeOutSec = Math.max(0, Math.min(clipDur * 0.9, clip.fadeOut || 0));
            const fadeInPx = Math.max(0, Math.round(fadeInSec * daw.zoom));
            const fadeOutPx = Math.max(0, Math.round(fadeOutSec * daw.zoom));

            clipEl.innerHTML = `
                <!-- Left & Right Edge Trim Handles -->
                <div class="daw-clip-trim-handle daw-clip-trim-left" data-clip-id="${clip.id}" style="position: absolute; left: 0; top: 0; bottom: 0; width: 7px; cursor: ew-resize; z-index: 40; background: rgba(255,255,255,0.06); border-top-left-radius: 6px; border-bottom-left-radius: 6px; transition: background 0.15s;" title="Drag left edge to trim audio start"></div>
                <div class="daw-clip-trim-handle daw-clip-trim-right" data-clip-id="${clip.id}" style="position: absolute; right: 0; top: 0; bottom: 0; width: 7px; cursor: ew-resize; z-index: 40; background: rgba(255,255,255,0.06); border-top-right-radius: 6px; border-bottom-right-radius: 6px; transition: background 0.15s;" title="Drag right edge to trim audio end"></div>

                <!-- Top Corner Interactive Fade Handles -->
                <div class="daw-clip-fade-handle daw-clip-fade-left" data-clip-id="${clip.id}" style="position: absolute; left: 0; top: 0; width: 12px; height: 12px; cursor: ew-resize; z-index: 45; display: flex; align-items: flex-start; justify-content: flex-start;" title="Drag corner to create Fade-In curve (${fadeInSec.toFixed(2)}s)">
                    <div style="width: 7px; height: 7px; background: #38bdf8; border: 1px solid #ffffff; border-radius: 2px; box-shadow: 0 0 6px rgba(56,189,248,0.8); pointer-events: none;"></div>
                </div>
                <div class="daw-clip-fade-handle daw-clip-fade-right" data-clip-id="${clip.id}" style="position: absolute; right: 0; top: 0; width: 12px; height: 12px; cursor: ew-resize; z-index: 45; display: flex; align-items: flex-start; justify-content: flex-end;" title="Drag corner to create Fade-Out curve (${fadeOutSec.toFixed(2)}s)">
                    <div style="width: 7px; height: 7px; background: #38bdf8; border: 1px solid #ffffff; border-radius: 2px; box-shadow: 0 0 6px rgba(56,189,248,0.8); pointer-events: none;"></div>
                </div>

                <!-- SVG Fade Curve Shading Overlay -->
                <svg class="daw-clip-fade-svg" style="position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10; overflow: hidden;">
                    ${fadeInPx > 0 ? `
                        <path d="M 0 0 Q ${fadeInPx * 0.5} 0, ${fadeInPx} 0 L ${fadeInPx} 100 L 0 100 Z" fill="rgba(0,0,0,0.5)" />
                        <line x1="0" y1="0" x2="${fadeInPx}" y2="0" stroke="#38bdf8" stroke-width="2" stroke-dasharray="2,2" />
                        <path d="M 0 100 Q ${fadeInPx * 0.4} 100, ${fadeInPx} 0" fill="none" stroke="#38bdf8" stroke-width="1.8" />
                    ` : ''}
                    ${fadeOutPx > 0 ? `
                        <path d="M calc(100% - ${fadeOutPx}px) 0 L 100% 0 L 100% 100 L calc(100% - ${fadeOutPx}px) 100 Z" fill="rgba(0,0,0,0.5)" />
                        <line x1="calc(100% - ${fadeOutPx}px)" y1="0" x2="100%" y2="0" stroke="#38bdf8" stroke-width="2" stroke-dasharray="2,2" />
                        <path d="M calc(100% - ${fadeOutPx}px) 0 Q calc(100% - ${fadeOutPx * 0.4}px) 100, 100% 100" fill="none" stroke="#38bdf8" stroke-width="1.8" />
                    ` : ''}
                </svg>

                <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; pointer-events: none; padding-left: 4px; padding-right: 4px; position: relative; z-index: 15;">
                    <div style="display: flex; align-items: center; gap: 5px; min-width: 0; overflow: hidden; pointer-events: auto;">
                        <span class="daw-clip-title-label" data-clip-id="${clip.id}" title="Click to rename clip directly on timeline" style="font-size: 11px; font-weight: 800; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: text; text-decoration: underline dotted rgba(255,255,255,0.35); pointer-events: auto;">
                            ${clip.name}
                        </span>
                        ${tagBadge}
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        ${(clip.fadeIn > 0 || clip.fadeOut > 0) ? `
                            <span style="font-size: 8px; font-weight: 700; background: rgba(56,189,248,0.25); color: #38bdf8; border: 1px solid rgba(56,189,248,0.4); padding: 0.5px 3px; border-radius: 3px; font-family: monospace;">
                                ◢ ${clip.fadeIn > 0 ? clip.fadeIn.toFixed(1) + 's' : ''} ${clip.fadeOut > 0 ? '◣ ' + clip.fadeOut.toFixed(1) + 's' : ''}
                            </span>
                        ` : ''}
                        <span style="font-size: 9px; font-weight: 800; background: rgba(0,0,0,0.55); padding: 1px 5px; border-radius: 4px; color: rgba(255,255,255,0.85); white-space: nowrap; pointer-events: none;">
                            ${durStr}
                        </span>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 2px; height: ${waveContainerH}px; opacity: 0.9; pointer-events: none; overflow: hidden; padding-top: 2px; padding-left: 4px; padding-right: 4px; position: relative; z-index: 12;">
                    ${waveformBarsHtml}
                </div>
            `;

            // Interactive Fade In Dragging
            const fadeLeftHandle = clipEl.querySelector('.daw-clip-fade-left');
            if (fadeLeftHandle) {
                fadeLeftHandle.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    const startClientX = e.clientX;
                    const initialFadeIn = clip.fadeIn || 0;
                    let hasChanged = false;

                    const onFadeMove = (moveEv) => {
                        const deltaSec = (moveEv.clientX - startClientX) / daw.zoom;
                        const maxFade = Math.max(0, clipDur - 0.2);
                        const newFade = Math.max(0, Math.min(maxFade, initialFadeIn + deltaSec));
                        clip.fadeIn = Math.round(newFade * 100) / 100;
                        hasChanged = true;

                        // Quick visual update of title / badge
                        renderDawClips();
                    };

                    const onFadeUp = () => {
                        window.removeEventListener('mousemove', onFadeMove);
                        window.removeEventListener('mouseup', onFadeUp);
                        if (hasChanged) {
                            pushDawHistory(`Adjust Fade In (${clip.fadeIn.toFixed(2)}s)`);
                        }
                    };

                    window.addEventListener('mousemove', onFadeMove);
                    window.addEventListener('mouseup', onFadeUp);
                });
            }

            // Interactive Fade Out Dragging
            const fadeRightHandle = clipEl.querySelector('.daw-clip-fade-right');
            if (fadeRightHandle) {
                fadeRightHandle.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    const startClientX = e.clientX;
                    const initialFadeOut = clip.fadeOut || 0;
                    let hasChanged = false;

                    const onFadeMove = (moveEv) => {
                        const deltaSec = (startClientX - moveEv.clientX) / daw.zoom;
                        const maxFade = Math.max(0, clipDur - 0.2);
                        const newFade = Math.max(0, Math.min(maxFade, initialFadeOut + deltaSec));
                        clip.fadeOut = Math.round(newFade * 100) / 100;
                        hasChanged = true;

                        renderDawClips();
                    };

                    const onFadeUp = () => {
                        window.removeEventListener('mousemove', onFadeMove);
                        window.removeEventListener('mouseup', onFadeUp);
                        if (hasChanged) {
                            pushDawHistory(`Adjust Fade Out (${clip.fadeOut.toFixed(2)}s)`);
                        }
                    };

                    window.addEventListener('mousemove', onFadeMove);
                    window.addEventListener('mouseup', onFadeUp);
                });
            }

            // Interactive Left & Right Edge Trimming
            const leftTrim = clipEl.querySelector('.daw-clip-trim-left');
            if (leftTrim) {
                leftTrim.addEventListener('mouseenter', () => leftTrim.style.background = 'rgba(56, 189, 248, 0.45)');
                leftTrim.addEventListener('mouseleave', () => leftTrim.style.background = 'rgba(255, 255, 255, 0.06)');
                leftTrim.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    const startX = e.clientX;
                    const initOffset = clip.startOffset;
                    const initTrimStart = clip.trimStart;
                    let hasTrimmed = false;

                    const onTrimMove = (moveEv) => {
                        const deltaSec = (moveEv.clientX - startX) / daw.zoom;
                        if (!hasTrimmed && Math.abs(deltaSec) > 0.04) {
                            hasTrimmed = true;
                        }
                        const maxTrim = clip.trimEnd - 0.5;
                        const newTrimStart = Math.max(0, Math.min(maxTrim, initTrimStart + deltaSec));
                        const actualDelta = newTrimStart - initTrimStart;
                        const newStartOffset = Math.max(0, initOffset + actualDelta);

                        clip.startOffset = Math.round(newStartOffset * 100) / 100;
                        clip.trimStart = Math.round(newTrimStart * 100) / 100;

                        clipEl.style.left = `${clip.startOffset * daw.zoom}px`;
                        clipEl.style.width = `${Math.max(34, (clip.trimEnd - clip.trimStart) * daw.zoom)}px`;
                    };

                    const onTrimUp = () => {
                        window.removeEventListener('mousemove', onTrimMove);
                        window.removeEventListener('mouseup', onTrimUp);
                        if (hasTrimmed) {
                            pushDawHistory('Trim Clip Start');
                        }
                        renderDawClips();
                        renderDawRuler();
                    };

                    window.addEventListener('mousemove', onTrimMove);
                    window.addEventListener('mouseup', onTrimUp);
                });
            }

            const rightTrim = clipEl.querySelector('.daw-clip-trim-right');
            if (rightTrim) {
                rightTrim.addEventListener('mouseenter', () => rightTrim.style.background = 'rgba(56, 189, 248, 0.45)');
                rightTrim.addEventListener('mouseleave', () => rightTrim.style.background = 'rgba(255, 255, 255, 0.06)');
                rightTrim.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    const startX = e.clientX;
                    const initTrimEnd = clip.trimEnd;
                    const maxDur = Math.max(clip.duration || 0, clip.buffer?.duration || 0, initTrimEnd);
                    let hasTrimmed = false;

                    const onTrimMove = (moveEv) => {
                        const deltaSec = (moveEv.clientX - startX) / daw.zoom;
                        if (!hasTrimmed && Math.abs(deltaSec) > 0.04) {
                            hasTrimmed = true;
                        }
                        const minTrim = clip.trimStart + 0.5;
                        const newTrimEnd = Math.max(minTrim, Math.min(maxDur > 0 ? maxDur : 99999, initTrimEnd + deltaSec));

                        clip.trimEnd = Math.round(newTrimEnd * 100) / 100;
                        clipEl.style.width = `${Math.max(34, (clip.trimEnd - clip.trimStart) * daw.zoom)}px`;
                    };

                    const onTrimUp = () => {
                        window.removeEventListener('mousemove', onTrimMove);
                        window.removeEventListener('mouseup', onTrimUp);
                        if (hasTrimmed) {
                            pushDawHistory('Trim Clip End');
                        }
                        renderDawClips();
                        renderDawRuler();
                    };

                    window.addEventListener('mousemove', onTrimMove);
                    window.addEventListener('mouseup', onTrimUp);
                });
            }

            // Inline Title Editing on Timeline Track
            const titleLabel = clipEl.querySelector('.daw-clip-title-label');
            if (titleLabel) {
                titleLabel.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.value = clip.name;
                    input.style.cssText = 'background: #090d16; color: #ffffff; border: 1px solid #38bdf8; border-radius: 3px; font-size: 11px; font-weight: 800; padding: 1px 5px; outline: none; width: 130px; box-sizing: border-box;';
                    titleLabel.replaceWith(input);
                    input.focus();
                    input.select();

                    let saved = false;
                    const commitTitle = () => {
                        if (saved) return;
                        saved = true;
                        const v = input.value.trim();
                        if (v && v !== clip.name) {
                            pushDawHistory('Rename Clip');
                            clip.name = v;
                        }
                        renderDawClips();
                    };

                    input.addEventListener('blur', commitTitle);
                    input.addEventListener('keydown', (ke) => {
                        if (ke.key === 'Enter') {
                            ke.preventDefault();
                            commitTitle();
                        } else if (ke.key === 'Escape') {
                            saved = true;
                            renderDawClips();
                        }
                    });
                });
            }

            // Interactive Drag and Drop Repositioning with Multi-Clip Selection, Shift-Lock Axis, Magnetic Snapping, & Auto-Scroll
            clipEl.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                if (e.target.closest('input')) return;
                if (e.target.closest('.daw-clip-trim-handle')) return;
                if (e.target.closest('.daw-clip-fade-handle')) return;

                const isModifierKey = e.metaKey || e.ctrlKey;
                const isShiftKey = e.shiftKey;

                // Meta/Ctrl click toggles selection without starting drag
                if (isModifierKey) {
                    e.stopPropagation();
                    if (daw.selectedClipIds.has(clip.id)) {
                        daw.selectedClipIds.delete(clip.id);
                        if (daw.selectedClipId === clip.id) {
                            daw.selectedClipId = Array.from(daw.selectedClipIds)[0] || null;
                        }
                    } else {
                        daw.selectedClipIds.add(clip.id);
                        daw.selectedClipId = clip.id;
                    }
                    renderDawClips();
                    return;
                }

                // If Shift-clicking an unselected clip, add it to selection
                if (isShiftKey && !daw.selectedClipIds.has(clip.id)) {
                    daw.selectedClipIds.add(clip.id);
                    daw.selectedClipId = clip.id;
                    renderDawClips();
                } else if (!isShiftKey && !daw.selectedClipIds.has(clip.id)) {
                    // Clicking an unselected clip without Shift: make it sole selection
                    daw.selectedClipIds.clear();
                    daw.selectedClipIds.add(clip.id);
                    daw.selectedClipId = clip.id;
                    renderDawClips();
                }

                // Alt / Option Key: Slip-Editing Mode (slides underlying audio within fixed clip timeline window)
                if (e.altKey) {
                    e.stopPropagation();
                    const startX = e.clientX;
                    const initTrimStart = clip.trimStart;
                    const initTrimEnd = clip.trimEnd;
                    const windowDur = initTrimEnd - initTrimStart;
                    const maxBufDur = Math.max(clip.duration || 0, clip.buffer?.duration || 0, initTrimEnd);
                    let hasSlipped = false;
                    clipEl.style.cursor = 'col-resize';

                    const onSlipMove = (moveEv) => {
                        const deltaSec = (moveEv.clientX - startX) / daw.zoom;
                        if (!hasSlipped && Math.abs(deltaSec) > 0.04) {
                            hasSlipped = true;
                        }
                        // Dragging right moves audio forward (decreasing trimStart), dragging left moves audio backward
                        let newTrimStart = initTrimStart - deltaSec;
                        newTrimStart = Math.max(0, Math.min(maxBufDur - windowDur, newTrimStart));
                        const newTrimEnd = newTrimStart + windowDur;

                        clip.trimStart = Math.round(newTrimStart * 100) / 100;
                        clip.trimEnd = Math.round(newTrimEnd * 100) / 100;
                        renderDawClips();
                    };

                    const onSlipUp = () => {
                        window.removeEventListener('mousemove', onSlipMove);
                        window.removeEventListener('mouseup', onSlipUp);
                        clipEl.style.cursor = 'grab';
                        if (hasSlipped) {
                            pushDawHistory('Slip Edit Clip');
                            showStudioToast(`Slipped audio inside "${clip.name}"`);
                        }
                        renderDawClips();
                    };

                    window.addEventListener('mousemove', onSlipMove);
                    window.addEventListener('mouseup', onSlipUp);
                    return;
                }

                const startX = e.clientX;
                const startY = e.clientY;
                const leaderInitOffset = clip.startOffset;
                let hasDragged = false;
                let candidateTrackId = clip.trackId;

                // Cache initial offsets and initial track IDs for all selected clips
                const initialOffsets = new Map();
                const initialTrackIds = new Map();
                let minInitialOffset = Infinity;
                daw.clips.forEach(c => {
                    if (daw.selectedClipIds.has(c.id)) {
                        initialOffsets.set(c.id, c.startOffset);
                        initialTrackIds.set(c.id, c.trackId);
                        if (c.startOffset < minInitialOffset) minInitialOffset = c.startOffset;
                    }
                });

                clipEl.style.cursor = 'grabbing';
                const viewport = document.getElementById('timeline-scroll-viewport');
                const trackListKeys = Object.keys(daw.tracks);
                const sourceTrackIndex = trackListKeys.indexOf(clip.trackId);

                const onClipMouseMove = (moveEv) => {
                    const dx = moveEv.clientX - startX;
                    const dy = moveEv.clientY - startY;

                    if (!hasDragged && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
                        hasDragged = true;
                        document.querySelectorAll('.daw-timeline-clip.is-selected').forEach(el => {
                            el.style.opacity = '0.78';
                            el.style.zIndex = '99';
                            el.style.boxShadow = '0 12px 28px rgba(0,0,0,0.8), 0 0 16px rgba(255,255,255,0.6)';
                        });
                    }

                    if (hasDragged) {
                        // When SHIFT is held during drag, lock horizontal movement (dx = 0) so clips remain strictly at original timeline time!
                        const isHorizontalLocked = moveEv.shiftKey;
                        const rawDeltaSec = isHorizontalLocked ? 0 : (dx / daw.zoom);
                        let proposedLeaderOffset = Math.max(0, leaderInitOffset + rawDeltaSec);
                        const activeDuration = Math.max(0.5, clip.trimEnd - clip.trimStart);

                        // Magnetic Snapping (Grid lines and adjacent clip edges) — only when horizontal movement is free
                        const snapMode = isHorizontalLocked ? 'off' : (daw.snapMode || 'all');
                        let snappedTargetSec = null;
                        const snapThreshold = 14 / daw.zoom; // ~14px tolerance

                        if (snapMode !== 'off') {
                            const snapCandidates = [];

                            // 1. Musical Beat Grid & Standard Snapping
                            if (snapMode === 'all' || snapMode === 'grid' || snapMode === 'bar' || snapMode === '1/2' || snapMode === '1/4' || snapMode === '1/8') {
                                const beatSec = 60 / (daw.bpm || 120);
                                let gridInterval = 0.5;
                                if (snapMode === 'bar') {
                                    gridInterval = beatSec * 4;
                                } else if (snapMode === '1/2') {
                                    gridInterval = beatSec * 0.5;
                                } else if (snapMode === '1/4') {
                                    gridInterval = beatSec * 0.25;
                                } else if (snapMode === '1/8') {
                                    gridInterval = beatSec * 0.125;
                                } else {
                                    gridInterval = beatSec;
                                }

                                const nearestGridStart = Math.round(proposedLeaderOffset / gridInterval) * gridInterval;
                                snapCandidates.push({ target: nearestGridStart, snapOffset: nearestGridStart });

                                const nearestGridEnd = Math.round((proposedLeaderOffset + activeDuration) / gridInterval) * gridInterval;
                                snapCandidates.push({ target: nearestGridEnd, snapOffset: nearestGridEnd - activeDuration });
                            }

                            // 2. Audio clip edge snapping (start-to-end, end-to-start, start-to-start)
                            if (snapMode === 'all' || snapMode === 'clips') {
                                daw.clips.forEach(otherClip => {
                                    if (daw.selectedClipIds.has(otherClip.id)) return;
                                    const otherStart = otherClip.startOffset;
                                    const otherDur = Math.max(0.5, otherClip.trimEnd - otherClip.trimStart);
                                    const otherEnd = otherStart + otherDur;

                                    // Leader start snaps to other end
                                    snapCandidates.push({ target: otherEnd, snapOffset: otherEnd });
                                    // Leader end snaps to other start
                                    snapCandidates.push({ target: otherStart, snapOffset: otherStart - activeDuration });
                                    // Leader start snaps to other start
                                    snapCandidates.push({ target: otherStart, snapOffset: otherStart });
                                    // Leader end snaps to other end
                                    snapCandidates.push({ target: otherEnd, snapOffset: otherEnd - activeDuration });
                                });
                            }

                            // Find best candidate within threshold
                            let closestDist = snapThreshold;
                            snapCandidates.forEach(cand => {
                                const dist = Math.abs(proposedLeaderOffset - cand.snapOffset);
                                if (dist < closestDist && cand.snapOffset >= 0) {
                                    closestDist = dist;
                                    snappedTargetSec = cand.target;
                                    proposedLeaderOffset = cand.snapOffset;
                                }
                            });

                            // 3. Collision avoidance & overlap prevention on target track
                            const targetTrackForCollision = candidateTrackId || clip.trackId;
                            const staticClipsOnTargetTrack = daw.clips.filter(c =>
                                c.trackId === targetTrackForCollision && !daw.selectedClipIds.has(c.id)
                            );

                            if (staticClipsOnTargetTrack.length > 0) {
                                const initialOtherTrackClips = daw.clips.filter(c =>
                                    c.trackId === clip.trackId && !daw.selectedClipIds.has(c.id)
                                );
                                const initPreceding = initialOtherTrackClips.filter(c => (c.startOffset + Math.max(0.5, c.trimEnd - c.trimStart)) <= leaderInitOffset + 0.05);
                                const initSucceeding = initialOtherTrackClips.filter(c => c.startOffset >= (leaderInitOffset + activeDuration) - 0.05);

                                const origPrev = initPreceding.length > 0 ? initPreceding.sort((a,b) => (b.startOffset + Math.max(0.5, b.trimEnd - b.trimStart)) - (a.startOffset + Math.max(0.5, a.trimEnd - a.trimStart)))[0] : null;
                                const origNext = initSucceeding.length > 0 ? initSucceeding.sort((a,b) => a.startOffset - b.startOffset)[0] : null;

                                const minAllowedStart = (targetTrackForCollision === clip.trackId && origPrev)
                                    ? (origPrev.startOffset + Math.max(0.5, origPrev.trimEnd - origPrev.trimStart))
                                    : 0;
                                const maxAllowedStart = (targetTrackForCollision === clip.trackId && origNext)
                                    ? (origNext.startOffset - activeDuration)
                                    : Infinity;

                                if (proposedLeaderOffset < minAllowedStart) {
                                    proposedLeaderOffset = minAllowedStart;
                                    snappedTargetSec = minAllowedStart;
                                }
                                if (proposedLeaderOffset > maxAllowedStart && maxAllowedStart >= minAllowedStart) {
                                    proposedLeaderOffset = maxAllowedStart;
                                    snappedTargetSec = maxAllowedStart + activeDuration;
                                }

                                staticClipsOnTargetTrack.forEach(otherClip => {
                                    const otherStart = otherClip.startOffset;
                                    const otherDur = Math.max(0.5, otherClip.trimEnd - otherClip.trimStart);
                                    const otherEnd = otherStart + otherDur;

                                    const isOverlapping = (proposedLeaderOffset < otherEnd - 0.001) &&
                                                          (proposedLeaderOffset + activeDuration > otherStart + 0.001);

                                    if (isOverlapping) {
                                        const distToRightEdge = Math.abs(proposedLeaderOffset - otherEnd);
                                        const distToLeftEdge = Math.abs(proposedLeaderOffset - (otherStart - activeDuration));

                                        if (distToRightEdge <= distToLeftEdge) {
                                            proposedLeaderOffset = otherEnd;
                                            snappedTargetSec = otherEnd;
                                        } else {
                                            proposedLeaderOffset = Math.max(0, otherStart - activeDuration);
                                            snappedTargetSec = otherStart;
                                        }
                                    }
                                });
                            }
                        }

                        // Display or hide magnetic snap guide line
                        if (snapGuide) {
                            if (snappedTargetSec !== null && !isHorizontalLocked) {
                                snapGuide.style.display = 'block';
                                snapGuide.style.left = `${Math.round(snappedTargetSec * daw.zoom)}px`;
                            } else {
                                snapGuide.style.display = 'none';
                            }
                        }

                        // Constrain multi-clip translation so no selected clip is moved before t = 0
                        const clampedDelta = isHorizontalLocked ? 0 : Math.max(-minInitialOffset, proposedLeaderOffset - leaderInitOffset);

                        // 2D Real-Time Dragging: Move leader clip along both X and Y axes smoothly
                        clipEl.style.transform = `translate3d(0, ${dy}px, 0)`;
                        clipEl.style.left = `${Math.max(0, leaderInitOffset + clampedDelta) * daw.zoom}px`;
                        clipEl.style.zIndex = '999';

                        // Move other co-selected clips along X and Y axes in unison
                        daw.clips.forEach(c => {
                            if (c.id !== clip.id && daw.selectedClipIds.has(c.id)) {
                                const initOff = initialOffsets.get(c.id) || 0;
                                const cEl = document.querySelector(`.daw-timeline-clip[data-clip-id="${c.id}"]`);
                                if (cEl) {
                                    cEl.style.transform = `translate3d(0, ${dy}px, 0)`;
                                    cEl.style.left = `${Math.max(0, initOff + clampedDelta) * daw.zoom}px`;
                                    cEl.style.zIndex = '998';
                                }
                            }
                        });

                        // Viewport Auto-Scroll when dragging near viewport edges (only when not locked)
                        if (viewport && !isHorizontalLocked) {
                            const vpRect = viewport.getBoundingClientRect();
                            if (moveEv.clientX > vpRect.right - 50) {
                                viewport.scrollLeft += 10;
                            } else if (moveEv.clientX < vpRect.left + 50) {
                                viewport.scrollLeft = Math.max(0, viewport.scrollLeft - 10);
                            }
                        }

                        // Real-Time Track Lane Highlight & Target Detection
                        const lanes = document.querySelectorAll('.timeline-lane');
                        lanes.forEach(l => {
                            const lRect = l.getBoundingClientRect();
                            if (moveEv.clientY >= lRect.top && moveEv.clientY <= lRect.bottom) {
                                candidateTrackId = l.getAttribute('data-track-id');
                                l.style.background = 'rgba(56, 189, 248, 0.12)';
                                l.style.borderTop = '1px solid rgba(56, 189, 248, 0.4)';
                                l.style.borderBottom = '1px solid rgba(56, 189, 248, 0.4)';
                            } else {
                                const tObj = daw.tracks[l.getAttribute('data-track-id')];
                                l.style.background = (tObj?.color || '#ffffff') + '05';
                                l.style.borderTop = 'none';
                                l.style.borderBottom = '1px solid rgba(255,255,255,0.06)';
                            }
                        });
                    }
                };

                const onClipMouseUp = (upEv) => {
                    window.removeEventListener('mousemove', onClipMouseMove);
                    window.removeEventListener('mouseup', onClipMouseUp);
                    clipEl.style.cursor = 'grab';
                    clipEl.style.transform = 'none';
                    clipEl.style.zIndex = isSelected ? '25' : '15';

                    // Reset all other selected clip styles
                    daw.clips.forEach(c => {
                        if (c.id !== clip.id && daw.selectedClipIds.has(c.id)) {
                            const cEl = document.querySelector(`.daw-timeline-clip[data-clip-id="${c.id}"]`);
                            if (cEl) {
                                cEl.style.transform = 'none';
                                cEl.style.zIndex = '25';
                            }
                        }
                    });

                    if (snapGuide) snapGuide.style.display = 'none';

                    // Reset lane highlights & borders
                    document.querySelectorAll('.timeline-lane').forEach(l => {
                        const tObj = daw.tracks[l.getAttribute('data-track-id')];
                        const isArmed = (daw._recordTrackId === l.getAttribute('data-track-id'));
                        l.style.background = isArmed ? 'rgba(239, 68, 68, 0.04)' : ((tObj?.color || '#ffffff') + '05');
                        l.style.borderTop = 'none';
                        l.style.borderBottom = '1px solid rgba(255,255,255,0.06)';
                    });

                    if (hasDragged) {
                        pushDawHistory('Move Clip');
                        const isHorizontalLocked = upEv.shiftKey;
                        const leaderEl = document.querySelector(`.daw-timeline-clip[data-clip-id="${clip.id}"]`);
                        const finalLeaderLeft = leaderEl ? parseFloat(leaderEl.style.left) : leaderInitOffset * daw.zoom;
                        const finalLeaderOffset = Math.max(0, finalLeaderLeft / daw.zoom);
                        const effectiveDelta = isHorizontalLocked ? 0 : (finalLeaderOffset - leaderInitOffset);

                        // Apply new startOffset to all selected clips
                        daw.clips.forEach(c => {
                            if (daw.selectedClipIds.has(c.id)) {
                                const initOff = initialOffsets.get(c.id) || 0;
                                c.startOffset = Math.max(0, Math.round((initOff + effectiveDelta) * 100) / 100);
                            }
                        });

                        // 2D Track Transfer: Reparent all co-selected clips proportionally based on track index diff
                        if (candidateTrackId && daw.tracks[candidateTrackId]) {
                            const targetTrackIndex = trackListKeys.indexOf(candidateTrackId);
                            const trackIndexDelta = targetTrackIndex - sourceTrackIndex;

                            daw.clips.forEach(c => {
                                if (daw.selectedClipIds.has(c.id)) {
                                    const origTrack = initialTrackIds.get(c.id) || c.trackId;
                                    const origIndex = trackListKeys.indexOf(origTrack);
                                    const newTrackIndex = Math.max(0, Math.min(trackListKeys.length - 1, origIndex + trackIndexDelta));
                                    const newTrackKey = trackListKeys[newTrackIndex];
                                    if (newTrackKey && daw.tracks[newTrackKey]) {
                                        c.trackId = newTrackKey;
                                    }
                                }
                            });
                        }

                        // Final non-overlap sanity enforcement on candidate track when snapping is ON
                        const snapMode = isHorizontalLocked ? 'off' : (daw.snapMode || 'all');
                        if (snapMode !== 'off') {
                            const staticClips = daw.clips.filter(c => c.trackId === clip.trackId && c.id !== clip.id);
                            staticClips.forEach(otherClip => {
                                const activeDur = Math.max(0.5, clip.trimEnd - clip.trimStart);
                                const otherStart = otherClip.startOffset;
                                const otherDur = Math.max(0.5, otherClip.trimEnd - otherClip.trimStart);
                                const otherEnd = otherStart + otherDur;

                                if (clip.startOffset < otherEnd - 0.001 && clip.startOffset + activeDur > otherStart + 0.001) {
                                    // Resolve overlap by snapping to nearest outer edge
                                    const distRight = Math.abs(clip.startOffset - otherEnd);
                                    const distLeft = Math.abs(clip.startOffset - (otherStart - activeDur));
                                    if (distRight <= distLeft) {
                                        clip.startOffset = Math.round(otherEnd * 100) / 100;
                                    } else {
                                        clip.startOffset = Math.max(0, Math.round((otherStart - activeDur) * 100) / 100);
                                    }
                                }
                            });
                        }

                        recalculateDawDuration();
                        renderDawRuler();
                        renderDawClips();
                    } else {
                        const now = Date.now();
                        const timeSinceLast = now - (clipEl._lastClickTime || 0);
                        clipEl._lastClickTime = now;

                        daw.selectedClipIds.clear();
                        daw.selectedClipIds.add(clip.id);
                        daw.selectedClipId = clip.id;

                        // Fast in-place CSS selection update to keep DOM node alive for dblclick
                        document.querySelectorAll('.daw-timeline-clip').forEach(el => {
                            const cId = el.getAttribute('data-clip-id');
                            const isSel = cId === clip.id;
                            if (isSel) {
                                el.style.border = '2px solid #ffffff';
                                el.style.boxShadow = '0 0 16px rgba(255,255,255,0.4), inset 0 0 8px rgba(255,255,255,0.2)';
                                el.style.zIndex = '30';
                            } else {
                                el.style.border = '1px solid rgba(255,255,255,0.2)';
                                el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
                                el.style.zIndex = '20';
                            }
                        });

                        // Rapid double-click fallback check (< 380ms)
                        if (timeSinceLast < 380) {
                            openClipPropertiesModal(clip);
                            return;
                        }
                    }
                };

                window.addEventListener('mousemove', onClipMouseMove);
                window.addEventListener('mouseup', onClipMouseUp);
            });

            // Double click to open Inspector / Rename Modal
            clipEl.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                openClipPropertiesModal(clip);
            });

            laneEl.appendChild(clipEl);
        });
    };

    // Clip Inspector / Rename Modal
    const openClipPropertiesModal = (clip) => {
        if (!clip) {
            if (!daw.selectedClipId) {
                showStudioToast('Please select a clip on the timeline first, or double-click any clip to inspect and edit.');
                return;
            }
            clip = daw.clips.find(c => c.id === daw.selectedClipId);
            if (!clip) return;
        }

        daw._editingClipId = clip.id;
        daw._selectedColor = clip.color || '#10b981';

        const modal = document.getElementById('daw-clip-properties-modal');
        const nameInput = document.getElementById('daw-edit-clip-name');
        const trackSelect = document.getElementById('daw-edit-clip-track');
        const startInput = document.getElementById('daw-edit-clip-start');
        const tagInput = document.getElementById('daw-edit-clip-tag');
        const gainSlider = document.getElementById('daw-edit-clip-gain-slider');
        const gainReadout = document.getElementById('daw-edit-clip-gain-readout');

        if (nameInput) nameInput.value = clip.name || '';
        if (startInput) startInput.value = (clip.startOffset || 0).toFixed(2);
        if (tagInput) tagInput.value = clip.tag || '';

        const currentGain = (typeof clip.gain === 'number' && Number.isFinite(clip.gain)) ? clip.gain : 1.0;
        if (gainSlider) gainSlider.value = currentGain;
        if (gainReadout) gainReadout.textContent = `${currentGain.toFixed(2)}x`;

        if (trackSelect) {
            trackSelect.innerHTML = Object.values(daw.tracks).map(t => 
                `<option value="${t.id}" ${t.id === clip.trackId ? 'selected' : ''}>${t.name} (${t.type.toUpperCase()})</option>`
            ).join('');
        }

        // Highlight selected color swatch
        document.querySelectorAll('.daw-color-swatch').forEach(sw => {
            const swColor = sw.getAttribute('data-color');
            if (swColor.toLowerCase() === daw._selectedColor.toLowerCase()) {
                sw.style.borderColor = '#ffffff';
                sw.style.transform = 'scale(1.15)';
                sw.style.boxShadow = `0 0 10px ${swColor}`;
            } else {
                sw.style.borderColor = 'transparent';
                sw.style.transform = 'scale(1)';
                sw.style.boxShadow = 'none';
            }
        });

        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => {
                const nInput = document.getElementById('daw-edit-clip-name');
                if (nInput) {
                    nInput.focus();
                    nInput.select();
                }
            }, 60);
        }
    };

    // Wire Clip Inspector Modal events
    document.getElementById('daw-edit-clip-gain-slider')?.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        const readout = document.getElementById('daw-edit-clip-gain-readout');
        if (readout) readout.textContent = `${val.toFixed(2)}x`;
    });

    document.getElementById('daw-edit-clip-normalize-btn')?.addEventListener('click', () => {
        const clip = daw.clips.find(c => c.id === daw._editingClipId);
        if (!clip) return;

        let maxPeak = 0;
        if (clip.buffer) {
            for (let c = 0; c < clip.buffer.numberOfChannels; c++) {
                const chData = clip.buffer.getChannelData(c);
                for (let i = 0; i < chData.length; i++) {
                    const abs = Math.abs(chData[i]);
                    if (abs > maxPeak) maxPeak = abs;
                }
            }
        } else if (clip.peaks && clip.peaks.length > 0) {
            maxPeak = Math.max(...clip.peaks);
        }

        if (maxPeak > 0.001) {
            const normalizedGain = Math.min(2.0, Math.round((1.0 / maxPeak) * 100) / 100);
            const slider = document.getElementById('daw-edit-clip-gain-slider');
            const readout = document.getElementById('daw-edit-clip-gain-readout');
            if (slider) slider.value = normalizedGain;
            if (readout) readout.textContent = `${normalizedGain.toFixed(2)}x`;
            showStudioToast(`⚡ Normalized peak to 0 dBFS (Gain: ${normalizedGain.toFixed(2)}x)`);
        } else {
            showStudioToast('Clip audio buffer is silent or empty');
        }
    });

    document.getElementById('daw-clip-modal-close-btn')?.addEventListener('click', () => {
        document.getElementById('daw-clip-properties-modal').style.display = 'none';
    });
    document.getElementById('daw-clip-modal-cancel-btn')?.addEventListener('click', () => {
        document.getElementById('daw-clip-properties-modal').style.display = 'none';
    });

    // Enter key to quickly save clip edits
    document.getElementById('daw-edit-clip-name')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('daw-clip-modal-save-btn')?.click();
        }
    });

    document.querySelectorAll('.daw-color-swatch').forEach(sw => {
        sw.addEventListener('click', (e) => {
            daw._selectedColor = e.currentTarget.getAttribute('data-color');
            document.querySelectorAll('.daw-color-swatch').forEach(s => {
                const c = s.getAttribute('data-color');
                if (c.toLowerCase() === daw._selectedColor.toLowerCase()) {
                    s.style.borderColor = '#ffffff';
                    s.style.transform = 'scale(1.15)';
                    s.style.boxShadow = `0 0 10px ${c}`;
                } else {
                    s.style.borderColor = 'transparent';
                    s.style.transform = 'scale(1)';
                    s.style.boxShadow = 'none';
                }
            });
        });
    });

    document.querySelectorAll('.daw-tag-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            const tagInput = document.getElementById('daw-edit-clip-tag');
            if (tagInput) tagInput.value = e.currentTarget.getAttribute('data-tag');
        });
    });

    document.getElementById('daw-clip-modal-save-btn')?.addEventListener('click', () => {
        const clip = daw.clips.find(c => c.id === daw._editingClipId);
        if (clip) {
            pushDawHistory('Edit Clip Properties');
            const nameVal = document.getElementById('daw-edit-clip-name')?.value.trim();
            const trackVal = document.getElementById('daw-edit-clip-track')?.value;
            const startVal = parseFloat(document.getElementById('daw-edit-clip-start')?.value);
            const tagVal = document.getElementById('daw-edit-clip-tag')?.value.trim();
            const gainVal = parseFloat(document.getElementById('daw-edit-clip-gain-slider')?.value);

            if (nameVal) clip.name = nameVal;
            if (trackVal && daw.tracks[trackVal]) clip.trackId = trackVal;
            if (!isNaN(startVal) && startVal >= 0) clip.startOffset = startVal;
            clip.tag = tagVal || '';
            clip.color = daw._selectedColor;
            if (!isNaN(gainVal) && gainVal >= 0) clip.gain = gainVal;

            recalculateDawDuration();
            renderDawRuler();
            renderDawClips();
        }
        document.getElementById('daw-clip-properties-modal').style.display = 'none';
    });

    // Floating Draggable Clip Inspector Window Handler
    const initFloatingClipDraggable = () => {
        const clipModal = document.getElementById('daw-clip-properties-modal');
        const clipHeader = document.getElementById('daw-clip-modal-header');
        if (!clipModal || !clipHeader || clipHeader._dragBound) return;
        clipHeader._dragBound = true;

        clipHeader.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            if (e.target.closest('button')) return;

            const startX = e.clientX;
            const startY = e.clientY;
            const rect = clipModal.getBoundingClientRect();
            const parent = clipModal.offsetParent || document.body;
            const parentRect = parent.getBoundingClientRect();

            const initLeft = rect.left - parentRect.left;
            const initTop = rect.top - parentRect.top;

            clipModal.style.right = 'auto';
            clipModal.style.left = `${initLeft}px`;
            clipModal.style.top = `${initTop}px`;

            const onDragMove = (moveEv) => {
                const dx = moveEv.clientX - startX;
                const dy = moveEv.clientY - startY;
                const newLeft = Math.max(10, Math.min(parentRect.width - clipModal.offsetWidth - 10, initLeft + dx));
                const newTop = Math.max(40, Math.min(parentRect.height - clipModal.offsetHeight - 10, initTop + dy));
                clipModal.style.left = `${newLeft}px`;
                clipModal.style.top = `${newTop}px`;
            };

            const onDragUp = () => {
                window.removeEventListener('mousemove', onDragMove);
                window.removeEventListener('mouseup', onDragUp);
            };

            window.addEventListener('mousemove', onDragMove);
            window.addEventListener('mouseup', onDragUp);
        });
    };
    initFloatingClipDraggable();

    // Track FX Plugins Modal & Web Audio DSP Controller
    let _activeFxLowCut = false;
    let _activeFxDehum = 'off'; // 'off' | '50hz' | '60hz'
    const openTrackFxModal = (trackId) => {
        const track = daw.tracks[trackId];
        if (!track) return;
        daw._activeFxTrackId = trackId;
        if (!track.plugins) track.plugins = defaultPluginState();

        const p = track.plugins;
        const titleEl = document.getElementById('daw-fx-track-title');
        if (titleEl) titleEl.textContent = `${track.name} — DSP Plugins Rack (10 Plugins)`;

        // 1. EQ & De-Hum
        const eqEn = document.getElementById('daw-fx-eq-enable');
        if (eqEn) eqEn.checked = !!p.eq?.enabled;
        _activeFxLowCut = !!p.eq?.lowCut;
        const lowCutBtn = document.getElementById('daw-fx-eq-lowcut');
        if (lowCutBtn) {
            lowCutBtn.textContent = _activeFxLowCut ? '80Hz ON' : 'OFF';
            lowCutBtn.style.background = _activeFxLowCut ? 'rgba(52, 211, 153, 0.25)' : 'rgba(255,255,255,0.06)';
            lowCutBtn.style.color = _activeFxLowCut ? '#34d399' : '#ffffff';
        }
        _activeFxDehum = p.eq?.dehum || 'off';
        const dehumBtn = document.getElementById('daw-fx-dehum-btn');
        if (dehumBtn) {
            dehumBtn.textContent = _activeFxDehum === '50hz' ? 'DE-HUM: 50Hz' : (_activeFxDehum === '60hz' ? 'DE-HUM: 60Hz' : 'DE-HUM: OFF');
            dehumBtn.style.background = _activeFxDehum !== 'off' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255,255,255,0.06)';
            dehumBtn.style.color = _activeFxDehum !== 'off' ? '#f87171' : 'rgba(255,255,255,0.8)';
        }
        const eqLow = document.getElementById('daw-fx-eq-low');
        const eqLowVal = document.getElementById('daw-fx-eq-low-val');
        if (eqLow) eqLow.value = p.eq?.low || 0;
        if (eqLowVal) eqLowVal.textContent = `${(p.eq?.low || 0) > 0 ? '+' : ''}${p.eq?.low || 0}dB`;

        const eqMid = document.getElementById('daw-fx-eq-mid');
        const eqMidVal = document.getElementById('daw-fx-eq-mid-val');
        if (eqMid) eqMid.value = p.eq?.mid || 0;
        if (eqMidVal) eqMidVal.textContent = `${(p.eq?.mid || 0) > 0 ? '+' : ''}${p.eq?.mid || 0}dB`;

        const eqHigh = document.getElementById('daw-fx-eq-high');
        const eqHighVal = document.getElementById('daw-fx-eq-high-val');
        if (eqHigh) eqHigh.value = p.eq?.high || 0;
        if (eqHighVal) eqHighVal.textContent = `${(p.eq?.high || 0) > 0 ? '+' : ''}${p.eq?.high || 0}dB`;

        // 2. De-Esser
        const deessEn = document.getElementById('daw-fx-deesser-enable');
        if (deessEn) deessEn.checked = !!p.deesser?.enabled;
        const deessRed = document.getElementById('daw-fx-deesser-reduction');
        const deessRedVal = document.getElementById('daw-fx-deesser-reduction-val');
        const dRedVal = p.deesser?.reduction !== undefined ? p.deesser.reduction : -6;
        if (deessRed) deessRed.value = dRedVal;
        if (deessRedVal) deessRedVal.textContent = `${dRedVal}dB`;
        const deessFreq = document.getElementById('daw-fx-deesser-freq');
        const deessFreqVal = document.getElementById('daw-fx-deesser-freq-val');
        const dFreqVal = p.deesser?.freq || 6500;
        if (deessFreq) deessFreq.value = dFreqVal;
        if (deessFreqVal) deessFreqVal.textContent = `${dFreqVal}Hz`;

        // 3. Compressor
        const compEn = document.getElementById('daw-fx-comp-enable');
        if (compEn) compEn.checked = !!p.comp?.enabled;
        const compModel = document.getElementById('daw-fx-comp-model');
        if (compModel) compModel.value = p.comp?.model || 'modern';
        const compThresh = document.getElementById('daw-fx-comp-thresh');
        const compThreshVal = document.getElementById('daw-fx-comp-thresh-val');
        const threshVal = p.comp?.threshold !== undefined ? p.comp.threshold : -24;
        if (compThresh) compThresh.value = threshVal;
        if (compThreshVal) compThreshVal.textContent = `${threshVal}dB`;

        const compRatio = document.getElementById('daw-fx-comp-ratio');
        const compRatioVal = document.getElementById('daw-fx-comp-ratio-val');
        const ratioVal = p.comp?.ratio || 3.5;
        if (compRatio) compRatio.value = ratioVal;
        if (compRatioVal) compRatioVal.textContent = `${ratioVal}:1`;

        // 4. Noise Gate
        const gateEn = document.getElementById('daw-fx-gate-enable');
        if (gateEn) gateEn.checked = !!p.gate?.enabled;
        const gateThresh = document.getElementById('daw-fx-gate-thresh');
        const gateThreshVal = document.getElementById('daw-fx-gate-thresh-val');
        const gThresh = p.gate?.threshold !== undefined ? p.gate.threshold : -42;
        if (gateThresh) gateThresh.value = gThresh;
        if (gateThreshVal) gateThreshVal.textContent = `${gThresh}dB`;
        const gateRed = document.getElementById('daw-fx-gate-reduction');
        const gateRedVal = document.getElementById('daw-fx-gate-reduction-val');
        const gRed = p.gate?.reduction !== undefined ? p.gate.reduction : -24;
        if (gateRed) gateRed.value = gRed;
        if (gateRedVal) gateRedVal.textContent = `${gRed}dB`;

        // 5. Warmth
        const warmthEn = document.getElementById('daw-fx-warmth-enable');
        if (warmthEn) warmthEn.checked = !!p.warmth?.enabled;
        const warmthDrive = document.getElementById('daw-fx-warmth');
        const warmthDriveVal = document.getElementById('daw-fx-warmth-val');
        const driveVal = Math.round((p.warmth?.drive !== undefined ? p.warmth.drive : 0.25) * (p.warmth?.drive <= 1 ? 100 : 1));
        if (warmthDrive) warmthDrive.value = driveVal;
        if (warmthDriveVal) warmthDriveVal.textContent = `${driveVal}%`;

        // 6. Delay
        const delayEn = document.getElementById('daw-fx-delay-enable');
        if (delayEn) delayEn.checked = !!p.delay?.enabled;
        const delayTime = document.getElementById('daw-fx-delay-time');
        const delayTimeVal = document.getElementById('daw-fx-delay-time-val');
        const dTime = p.delay?.time || 250;
        if (delayTime) delayTime.value = dTime;
        if (delayTimeVal) delayTimeVal.textContent = `${dTime}ms`;
        const delayFb = document.getElementById('daw-fx-delay-feedback');
        const delayFbVal = document.getElementById('daw-fx-delay-feedback-val');
        const dFb = p.delay?.feedback !== undefined ? p.delay.feedback : 30;
        if (delayFb) delayFb.value = dFb;
        if (delayFbVal) delayFbVal.textContent = `${dFb}%`;
        const delayMix = document.getElementById('daw-fx-delay-mix');
        const delayMixVal = document.getElementById('daw-fx-delay-mix-val');
        const dMix = p.delay?.mix !== undefined ? p.delay.mix : 20;
        if (delayMix) delayMix.value = dMix;
        if (delayMixVal) delayMixVal.textContent = `${dMix}%`;

        // 7. Chorus
        const chorusEn = document.getElementById('daw-fx-chorus-enable');
        if (chorusEn) chorusEn.checked = !!p.chorus?.enabled;
        const chorusRate = document.getElementById('daw-fx-chorus-rate');
        const chorusRateVal = document.getElementById('daw-fx-chorus-rate-val');
        const chRate = p.chorus?.rate || 1.2;
        if (chorusRate) chorusRate.value = chRate;
        if (chorusRateVal) chorusRateVal.textContent = `${chRate}Hz`;
        const chorusMix = document.getElementById('daw-fx-chorus-mix');
        const chorusMixVal = document.getElementById('daw-fx-chorus-mix-val');
        const chMix = p.chorus?.mix !== undefined ? p.chorus.mix : 25;
        if (chorusMix) chorusMix.value = chMix;
        if (chorusMixVal) chorusMixVal.textContent = `${chMix}%`;

        // 8. Widener
        const widenerEn = document.getElementById('daw-fx-widener-enable');
        if (widenerEn) widenerEn.checked = !!p.widener?.enabled;
        const widenerWidth = document.getElementById('daw-fx-widener-width');
        const widenerWidthVal = document.getElementById('daw-fx-widener-width-val');
        const wWidth = p.widener?.width || 130;
        if (widenerWidth) widenerWidth.value = wWidth;
        if (widenerWidthVal) widenerWidthVal.textContent = `${wWidth}%`;

        // 9. Reverb
        const revEn = document.getElementById('daw-fx-reverb-enable');
        if (revEn) revEn.checked = !!p.reverb?.enabled;
        const revType = document.getElementById('daw-fx-reverb-type');
        if (revType) revType.value = p.reverb?.type || 'studio';
        const revWet = document.getElementById('daw-fx-reverb-wet');
        const revWetVal = document.getElementById('daw-fx-reverb-wet-val');
        const wetVal = Math.round((p.reverb?.mix !== undefined ? (p.reverb.mix <= 1 ? p.reverb.mix * 100 : p.reverb.mix) : (p.reverb?.wet || 20)));
        if (revWet) revWet.value = wetVal;
        if (revWetVal) revWetVal.textContent = `${wetVal}%`;

        // 10. Limiter
        const limiterEn = document.getElementById('daw-fx-limiter-enable');
        if (limiterEn) limiterEn.checked = !!p.limiter?.enabled;
        const limiterCeil = document.getElementById('daw-fx-limiter-ceiling');
        const limiterCeilVal = document.getElementById('daw-fx-limiter-ceiling-val');
        const lCeil = p.limiter?.ceiling !== undefined ? p.limiter.ceiling : -0.5;
        if (limiterCeil) limiterCeil.value = lCeil;
        if (limiterCeilVal) limiterCeilVal.textContent = `${lCeil}dB`;
        const limiterGain = document.getElementById('daw-fx-limiter-gain');
        const limiterGainVal = document.getElementById('daw-fx-limiter-gain-val');
        const lGain = p.limiter?.gain !== undefined ? p.limiter.gain : 2.0;
        if (limiterGain) limiterGain.value = lGain;
        if (limiterGainVal) limiterGainVal.textContent = `+${lGain}dB`;

        const modal = document.getElementById('daw-track-fx-modal');
        if (modal) modal.style.display = 'flex';
    };

    // Live Audition / Preview Player for Track FX Rack
    let _auditionMeterFrame = null;
    const stopFxAudition = () => {
        if (_auditionMeterFrame) {
            cancelAnimationFrame(_auditionMeterFrame);
            _auditionMeterFrame = null;
        }
        if (daw._auditionSource) {
            try { daw._auditionSource.stop(); } catch (e) {}
            try { daw._auditionSource.disconnect(); } catch (e) {}
            daw._auditionSource = null;
            daw._auditionNodes = null;
        }
        const vuFill = document.getElementById('daw-dsp-vu-fill');
        const vuDb = document.getElementById('daw-dsp-vu-db');
        if (vuFill) vuFill.style.width = '0%';
        if (vuDb) vuDb.textContent = '-∞dB';

        const btn = document.getElementById('daw-fx-audition-btn');
        const txt = document.getElementById('daw-fx-audition-btn-text');
        if (btn) {
            btn.style.background = 'rgba(56, 189, 248, 0.15)';
            btn.style.borderColor = 'rgba(56, 189, 248, 0.4)';
            btn.style.color = '#38bdf8';
        }
        if (txt) txt.textContent = 'Audition FX';
    };

    // Helper: gather active plugin parameter settings directly from FX rack UI controls
    const getActiveFxTrackPlugins = () => ({
        eq: {
            enabled: !!document.getElementById('daw-fx-eq-enable')?.checked,
            lowCut: _activeFxLowCut,
            dehum: _activeFxDehum,
            low: parseFloat(document.getElementById('daw-fx-eq-low')?.value || 0),
            mid: parseFloat(document.getElementById('daw-fx-eq-mid')?.value || 0),
            high: parseFloat(document.getElementById('daw-fx-eq-high')?.value || 0)
        },
        deesser: {
            enabled: !!document.getElementById('daw-fx-deesser-enable')?.checked,
            reduction: parseFloat(document.getElementById('daw-fx-deesser-reduction')?.value || -6),
            freq: parseFloat(document.getElementById('daw-fx-deesser-freq')?.value || 6500)
        },
        comp: {
            enabled: !!document.getElementById('daw-fx-comp-enable')?.checked,
            model: document.getElementById('daw-fx-comp-model')?.value || 'modern',
            threshold: parseFloat(document.getElementById('daw-fx-comp-thresh')?.value || -24),
            ratio: parseFloat(document.getElementById('daw-fx-comp-ratio')?.value || 3.5),
            attack: 0.005,
            release: 0.15
        },
        gate: {
            enabled: !!document.getElementById('daw-fx-gate-enable')?.checked,
            threshold: parseFloat(document.getElementById('daw-fx-gate-thresh')?.value || -42),
            reduction: parseFloat(document.getElementById('daw-fx-gate-reduction')?.value || -24)
        },
        warmth: {
            enabled: !!document.getElementById('daw-fx-warmth-enable')?.checked,
            drive: parseFloat(document.getElementById('daw-fx-warmth')?.value || 25) / 100
        },
        delay: {
            enabled: !!document.getElementById('daw-fx-delay-enable')?.checked,
            time: parseFloat(document.getElementById('daw-fx-delay-time')?.value || 250),
            feedback: parseFloat(document.getElementById('daw-fx-delay-feedback')?.value || 30),
            mix: parseFloat(document.getElementById('daw-fx-delay-mix')?.value || 20)
        },
        chorus: {
            enabled: !!document.getElementById('daw-fx-chorus-enable')?.checked,
            rate: parseFloat(document.getElementById('daw-fx-chorus-rate')?.value || 1.2),
            mix: parseFloat(document.getElementById('daw-fx-chorus-mix')?.value || 25)
        },
        widener: {
            enabled: !!document.getElementById('daw-fx-widener-enable')?.checked,
            width: parseFloat(document.getElementById('daw-fx-widener-width')?.value || 130)
        },
        reverb: {
            enabled: !!document.getElementById('daw-fx-reverb-enable')?.checked,
            type: document.getElementById('daw-fx-reverb-type')?.value || 'studio',
            mix: parseFloat(document.getElementById('daw-fx-reverb-wet')?.value || 20) / 100
        },
        limiter: {
            enabled: !!document.getElementById('daw-fx-limiter-enable')?.checked,
            ceiling: parseFloat(document.getElementById('daw-fx-limiter-ceiling')?.value || -0.5),
            gain: parseFloat(document.getElementById('daw-fx-limiter-gain')?.value || 2.0)
        }
    });

    // Real-Time Live Audition DSP Chain Hot-Swap
    const updateLiveFxAudition = () => {
        if (!daw._auditionSource || !daw._auditionNodes || !daw.audioCtx) return;
        const ctx = daw.audioCtx;
        const plugins = getActiveFxTrackPlugins();
        const tempTrack = { id: daw._activeFxTrackId, plugins };

        try {
            if (daw._auditionNodes.fxChain) {
                try { daw._auditionSource.disconnect(daw._auditionNodes.fxChain.input); } catch (e) {}
                try { daw._auditionNodes.fxChain.output.disconnect(); } catch (e) {}
            }
            const newFxChain = buildTrackPluginChain(ctx, tempTrack);
            daw._auditionSource.connect(newFxChain.input);
            newFxChain.output.connect(daw._auditionNodes.auditionGain);
            daw._auditionNodes.fxChain = newFxChain;
            daw._auditionNodes.tempTrack = tempTrack;
        } catch (err) {
            console.warn('[DAW Audition] Hot-swap FX chain error:', err);
        }
    };

    const startFxAudition = async () => {
        if (!daw.audioCtx) {
            daw.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (daw.audioCtx.state === 'suspended') {
            await daw.audioCtx.resume();
        }

        // Stop any running DAW timeline playback or previous audition
        if (daw.isPlaying) stopDawPlayback(false);
        stopFxAudition();

        // Find a clip with audio buffer on the active track or selected clip
        let clip = daw.clips.find(c => c.trackId === daw._activeFxTrackId && c.buffer);
        if (!clip && daw.selectedClipId) {
            clip = daw.clips.find(c => c.id === daw.selectedClipId && c.buffer);
        }
        if (!clip) {
            clip = daw.clips.find(c => c.buffer);
        }

        if (!clip || !clip.buffer) {
            await showStudioAlert('Audition Audio Take', 'No audio take buffer found to audition. Please add or select an audio take on this track first.');
            return;
        }

        const ctx = daw.audioCtx;
        const src = ctx.createBufferSource();
        src.buffer = clip.buffer;
        src.loop = true;
        src.loopStart = clip.trimStart || 0;
        src.loopEnd = Math.min(clip.buffer.duration, clip.trimEnd || clip.buffer.duration);

        const tempTrack = {
            id: daw._activeFxTrackId,
            plugins: getActiveFxTrackPlugins()
        };

        const fxChain = buildTrackPluginChain(ctx, tempTrack);
        const auditionGain = ctx.createGain();
        auditionGain.gain.value = 1.0;

        const auditionAnalyser = ctx.createAnalyser();
        auditionAnalyser.fftSize = 256;

        src.connect(fxChain.input);
        fxChain.output.connect(auditionGain);
        auditionGain.connect(auditionAnalyser);
        auditionAnalyser.connect(ctx.destination);

        src.start(0, clip.trimStart || 0);

        daw._auditionSource = src;
        daw._auditionNodes = { fxChain, auditionGain, auditionAnalyser, tempTrack };

        // Animate live DSP rack VU meter bar
        const animateDspMeter = () => {
            if (!daw._auditionSource) return;
            const data = new Uint8Array(auditionAnalyser.frequencyBinCount);
            auditionAnalyser.getByteTimeDomainData(data);
            let peak = 0;
            for (let i = 0; i < data.length; i++) {
                const dev = Math.abs((data[i] - 128) / 128);
                if (dev > peak) peak = dev;
            }
            const vuFill = document.getElementById('daw-dsp-vu-fill');
            const vuDb = document.getElementById('daw-dsp-vu-db');
            if (vuFill) vuFill.style.width = `${Math.min(100, Math.round(peak * 100))}%`;
            if (vuDb) {
                const db = peak > 0.001 ? (20 * Math.log10(peak)).toFixed(1) : '-inf';
                vuDb.textContent = db === '-inf' ? '-∞dB' : `${db}dB`;
            }
            _auditionMeterFrame = requestAnimationFrame(animateDspMeter);
        };
        _auditionMeterFrame = requestAnimationFrame(animateDspMeter);

        const btn = document.getElementById('daw-fx-audition-btn');
        const txt = document.getElementById('daw-fx-audition-btn-text');
        if (btn) {
            btn.style.background = 'rgba(239, 68, 68, 0.25)';
            btn.style.borderColor = 'rgba(239, 68, 68, 0.5)';
            btn.style.color = '#f87171';
        }
        if (txt) txt.textContent = 'Stop Audition';
    };

    document.getElementById('daw-fx-audition-btn')?.addEventListener('click', () => {
        if (daw._auditionSource) {
            stopFxAudition();
        } else {
            startFxAudition();
        }
    });

    // Attach live audition parameter sync to all plugin enable checkboxes and reverb type dropdown
    ['eq', 'deesser', 'comp', 'gate', 'warmth', 'delay', 'chorus', 'widener', 'reverb', 'limiter'].forEach(fx => {
        document.getElementById(`daw-fx-${fx}-enable`)?.addEventListener('change', () => {
            if (daw._auditionSource) updateLiveFxAudition();
        });
    });
    document.getElementById('daw-fx-reverb-type')?.addEventListener('change', () => {
        if (daw._auditionSource) updateLiveFxAudition();
    });

    // Live Readout & Real-Time DSP Listeners for FX Rack Sliders
    document.getElementById('daw-fx-eq-low')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-eq-low-val');
        if (valEl) valEl.textContent = `${e.target.value > 0 ? '+' : ''}${e.target.value}dB`;
        if (daw._auditionSource) updateLiveFxAudition();
    });
    document.getElementById('daw-fx-eq-mid')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-eq-mid-val');
        if (valEl) valEl.textContent = `${e.target.value > 0 ? '+' : ''}${e.target.value}dB`;
        if (daw._auditionSource) updateLiveFxAudition();
    });
    document.getElementById('daw-fx-eq-high')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-eq-high-val');
        if (valEl) valEl.textContent = `${e.target.value > 0 ? '+' : ''}${e.target.value}dB`;
        if (daw._auditionSource) updateLiveFxAudition();
    });
    document.getElementById('daw-fx-deesser-reduction')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-deesser-reduction-val');
        if (valEl) valEl.textContent = `${e.target.value}dB`;
        if (daw._auditionSource) updateLiveFxAudition();
    });
    document.getElementById('daw-fx-deesser-freq')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-deesser-freq-val');
        if (valEl) valEl.textContent = `${e.target.value}Hz`;
        if (daw._auditionSource) updateLiveFxAudition();
    });
    document.getElementById('daw-fx-comp-thresh')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-comp-thresh-val');
        if (valEl) valEl.textContent = `${e.target.value}dB`;
        if (daw._auditionSource) updateLiveFxAudition();
    });
    document.getElementById('daw-fx-comp-ratio')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-comp-ratio-val');
        if (valEl) valEl.textContent = `${e.target.value}:1`;
        if (daw._auditionSource) updateLiveFxAudition();
    });
    document.getElementById('daw-fx-gate-thresh')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-gate-thresh-val');
        if (valEl) valEl.textContent = `${e.target.value}dB`;
        if (daw._auditionSource) updateLiveFxAudition();
    });
    document.getElementById('daw-fx-gate-reduction')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-gate-reduction-val');
        if (valEl) valEl.textContent = `${e.target.value}dB`;
        if (daw._auditionSource) updateLiveFxAudition();
    });
    document.getElementById('daw-fx-warmth')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-warmth-val');
        if (valEl) valEl.textContent = `${e.target.value}%`;
        if (daw._auditionSource) updateLiveFxAudition();
    });
    document.getElementById('daw-fx-delay-time')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-delay-time-val');
        if (valEl) valEl.textContent = `${e.target.value}ms`;
        if (daw._auditionSource) updateLiveFxAudition();
    });
    document.getElementById('daw-fx-delay-feedback')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-delay-feedback-val');
        if (valEl) valEl.textContent = `${e.target.value}%`;
        if (daw._auditionSource) updateLiveFxAudition();
    });
    document.getElementById('daw-fx-delay-mix')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-delay-mix-val');
        if (valEl) valEl.textContent = `${e.target.value}%`;
        if (daw._auditionSource) updateLiveFxAudition();
    });
    document.getElementById('daw-fx-chorus-rate')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-chorus-rate-val');
        if (valEl) valEl.textContent = `${e.target.value}Hz`;
        if (daw._auditionSource) updateLiveFxAudition();
    });
    document.getElementById('daw-fx-chorus-mix')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-chorus-mix-val');
        if (valEl) valEl.textContent = `${e.target.value}%`;
        if (daw._auditionSource) updateLiveFxAudition();
    });
    document.getElementById('daw-fx-widener-width')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-widener-width-val');
        if (valEl) valEl.textContent = `${e.target.value}%`;
        if (daw._auditionSource) updateLiveFxAudition();
    });
    document.getElementById('daw-fx-reverb-wet')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-reverb-wet-val');
        if (valEl) valEl.textContent = `${e.target.value}%`;
        if (daw._auditionSource) updateLiveFxAudition();
    });
    document.getElementById('daw-fx-limiter-ceiling')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-limiter-ceiling-val');
        if (valEl) valEl.textContent = `${e.target.value}dB`;
        if (daw._auditionSource) updateLiveFxAudition();
    });
    document.getElementById('daw-fx-limiter-gain')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-limiter-gain-val');
        if (valEl) valEl.textContent = `+${e.target.value}dB`;
        if (daw._auditionSource) updateLiveFxAudition();
    });

    document.getElementById('daw-fx-eq-lowcut')?.addEventListener('click', (e) => {
        _activeFxLowCut = !_activeFxLowCut;
        e.currentTarget.textContent = _activeFxLowCut ? '80Hz ON' : 'OFF';
        e.currentTarget.style.background = _activeFxLowCut ? 'rgba(52, 211, 153, 0.25)' : 'rgba(255,255,255,0.06)';
        e.currentTarget.style.color = _activeFxLowCut ? '#34d399' : '#ffffff';
        if (daw._auditionSource) updateLiveFxAudition();
    });

    document.getElementById('daw-fx-dehum-btn')?.addEventListener('click', (e) => {
        if (_activeFxDehum === 'off') {
            _activeFxDehum = '50hz';
            e.currentTarget.textContent = 'DE-HUM: 50Hz';
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
            e.currentTarget.style.color = '#f87171';
        } else if (_activeFxDehum === '50hz') {
            _activeFxDehum = '60hz';
            e.currentTarget.textContent = 'DE-HUM: 60Hz';
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
            e.currentTarget.style.color = '#f87171';
        } else {
            _activeFxDehum = 'off';
            e.currentTarget.textContent = 'DE-HUM: OFF';
            e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
        }
        if (daw._auditionSource) updateLiveFxAudition();
    });

    document.getElementById('daw-fx-comp-model')?.addEventListener('change', () => {
        if (daw._auditionSource) updateLiveFxAudition();
    });

    // FX Presets
    document.querySelectorAll('.daw-fx-preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const preset = e.currentTarget.getAttribute('data-preset');
            if (preset === 'polish') {
                document.getElementById('daw-fx-eq-enable').checked = true;
                _activeFxLowCut = true;
                const lc = document.getElementById('daw-fx-eq-lowcut');
                if (lc) { lc.textContent = '80Hz ON'; lc.style.background = 'rgba(52, 211, 153, 0.25)'; lc.style.color = '#34d399'; }
                document.getElementById('daw-fx-eq-low').value = -1;
                document.getElementById('daw-fx-eq-low-val').textContent = '-1dB';
                document.getElementById('daw-fx-eq-mid').value = 2;
                document.getElementById('daw-fx-eq-mid-val').textContent = '+2dB';
                document.getElementById('daw-fx-eq-high').value = 3;
                document.getElementById('daw-fx-eq-high-val').textContent = '+3dB';

                document.getElementById('daw-fx-deesser-enable').checked = true;
                document.getElementById('daw-fx-deesser-reduction').value = -7;
                document.getElementById('daw-fx-deesser-reduction-val').textContent = '-7dB';

                document.getElementById('daw-fx-comp-enable').checked = true;
                document.getElementById('daw-fx-comp-thresh').value = -20;
                document.getElementById('daw-fx-comp-thresh-val').textContent = '-20dB';
                document.getElementById('daw-fx-comp-ratio').value = 3;
                document.getElementById('daw-fx-comp-ratio-val').textContent = '3:1';

                document.getElementById('daw-fx-reverb-enable').checked = true;
                document.getElementById('daw-fx-reverb-type').value = 'booth';
                document.getElementById('daw-fx-reverb-wet').value = 10;
                document.getElementById('daw-fx-reverb-wet-val').textContent = '10%';

                document.getElementById('daw-fx-warmth-enable').checked = true;
                document.getElementById('daw-fx-warmth').value = 15;
                document.getElementById('daw-fx-warmth-val').textContent = '15%';

                document.getElementById('daw-fx-limiter-enable').checked = true;
            } else if (preset === 'radio') {
                document.getElementById('daw-fx-eq-enable').checked = true;
                _activeFxLowCut = true;
                const lc = document.getElementById('daw-fx-eq-lowcut');
                if (lc) { lc.textContent = '80Hz ON'; lc.style.background = 'rgba(52, 211, 153, 0.25)'; lc.style.color = '#34d399'; }
                document.getElementById('daw-fx-eq-low').value = 2;
                document.getElementById('daw-fx-eq-low-val').textContent = '+2dB';
                document.getElementById('daw-fx-eq-mid').value = 1;
                document.getElementById('daw-fx-eq-mid-val').textContent = '+1dB';
                document.getElementById('daw-fx-eq-high').value = 2;
                document.getElementById('daw-fx-eq-high-val').textContent = '+2dB';

                document.getElementById('daw-fx-comp-enable').checked = true;
                document.getElementById('daw-fx-comp-thresh').value = -26;
                document.getElementById('daw-fx-comp-thresh-val').textContent = '-26dB';
                document.getElementById('daw-fx-comp-ratio').value = 5;
                document.getElementById('daw-fx-comp-ratio-val').textContent = '5:1';

                document.getElementById('daw-fx-warmth-enable').checked = true;
                document.getElementById('daw-fx-warmth').value = 35;
                document.getElementById('daw-fx-warmth-val').textContent = '35%';

                document.getElementById('daw-fx-limiter-enable').checked = true;
            } else if (preset === 'space') {
                document.getElementById('daw-fx-reverb-enable').checked = true;
                document.getElementById('daw-fx-reverb-type').value = 'hall';
                document.getElementById('daw-fx-reverb-wet').value = 35;
                document.getElementById('daw-fx-reverb-wet-val').textContent = '35%';

                document.getElementById('daw-fx-delay-enable').checked = true;
                document.getElementById('daw-fx-delay-time').value = 320;
                document.getElementById('daw-fx-delay-time-val').textContent = '320ms';
                document.getElementById('daw-fx-delay-feedback').value = 35;
                document.getElementById('daw-fx-delay-feedback-val').textContent = '35%';
                document.getElementById('daw-fx-delay-mix').value = 25;
                document.getElementById('daw-fx-delay-mix-val').textContent = '25%';

                document.getElementById('daw-fx-widener-enable').checked = true;
                document.getElementById('daw-fx-widener-width').value = 150;
                document.getElementById('daw-fx-widener-width-val').textContent = '150%';
            } else if (preset === 'podcast-clean') {
                document.getElementById('daw-fx-eq-enable').checked = true;
                _activeFxLowCut = true;
                const lc = document.getElementById('daw-fx-eq-lowcut');
                if (lc) { lc.textContent = '80Hz ON'; lc.style.background = 'rgba(52, 211, 153, 0.25)'; lc.style.color = '#34d399'; }

                document.getElementById('daw-fx-gate-enable').checked = true;
                document.getElementById('daw-fx-gate-thresh').value = -45;
                document.getElementById('daw-fx-gate-thresh-val').textContent = '-45dB';

                document.getElementById('daw-fx-deesser-enable').checked = true;
                document.getElementById('daw-fx-deesser-reduction').value = -8;
                document.getElementById('daw-fx-deesser-reduction-val').textContent = '-8dB';

                document.getElementById('daw-fx-comp-enable').checked = true;
                document.getElementById('daw-fx-comp-thresh').value = -22;
                document.getElementById('daw-fx-comp-thresh-val').textContent = '-22dB';
            } else if (preset === 'master-brickwall') {
                document.getElementById('daw-fx-limiter-enable').checked = true;
                document.getElementById('daw-fx-limiter-ceiling').value = -0.5;
                document.getElementById('daw-fx-limiter-ceiling-val').textContent = '-0.5dB';
                document.getElementById('daw-fx-limiter-gain').value = 3.5;
                document.getElementById('daw-fx-limiter-gain-val').textContent = '+3.5dB';

                document.getElementById('daw-fx-comp-enable').checked = true;
                document.getElementById('daw-fx-comp-thresh').value = -18;
                document.getElementById('daw-fx-comp-thresh-val').textContent = '-18dB';
                document.getElementById('daw-fx-comp-ratio').value = 2.5;
                document.getElementById('daw-fx-comp-ratio-val').textContent = '2.5:1';

                document.getElementById('daw-fx-widener-enable').checked = true;
                document.getElementById('daw-fx-widener-width').value = 120;
                document.getElementById('daw-fx-widener-width-val').textContent = '120%';
            } else if (preset === 'la2a') {
                document.getElementById('daw-fx-comp-enable').checked = true;
                const modelSel = document.getElementById('daw-fx-comp-model');
                if (modelSel) modelSel.value = 'la2a';
                document.getElementById('daw-fx-comp-thresh').value = -18;
                document.getElementById('daw-fx-comp-thresh-val').textContent = '-18dB';
                document.getElementById('daw-fx-comp-ratio').value = 4.0;
                document.getElementById('daw-fx-comp-ratio-val').textContent = '4.0:1';
                document.getElementById('daw-fx-warmth-enable').checked = true;
                document.getElementById('daw-fx-warmth').value = 20;
                document.getElementById('daw-fx-warmth-val').textContent = '20%';
            } else if (preset === '1176') {
                document.getElementById('daw-fx-comp-enable').checked = true;
                const modelSel = document.getElementById('daw-fx-comp-model');
                if (modelSel) modelSel.value = '1176';
                document.getElementById('daw-fx-comp-thresh').value = -24;
                document.getElementById('daw-fx-comp-thresh-val').textContent = '-24dB';
                document.getElementById('daw-fx-comp-ratio').value = 8.0;
                document.getElementById('daw-fx-comp-ratio-val').textContent = '8.0:1';
            } else if (preset === 'ssl') {
                document.getElementById('daw-fx-comp-enable').checked = true;
                const modelSel = document.getElementById('daw-fx-comp-model');
                if (modelSel) modelSel.value = 'ssl';
                document.getElementById('daw-fx-comp-thresh').value = -16;
                document.getElementById('daw-fx-comp-thresh-val').textContent = '-16dB';
                document.getElementById('daw-fx-comp-ratio').value = 4.0;
                document.getElementById('daw-fx-comp-ratio-val').textContent = '4.0:1';
            } else if (preset === 'dehum50') {
                document.getElementById('daw-fx-eq-enable').checked = true;
                _activeFxDehum = '50hz';
                const dehumBtn = document.getElementById('daw-fx-dehum-btn');
                if (dehumBtn) {
                    dehumBtn.textContent = 'DE-HUM: 50Hz';
                    dehumBtn.style.background = 'rgba(239, 68, 68, 0.25)';
                    dehumBtn.style.color = '#f87171';
                }
            } else if (preset === 'dehum60') {
                document.getElementById('daw-fx-eq-enable').checked = true;
                _activeFxDehum = '60hz';
                const dehumBtn = document.getElementById('daw-fx-dehum-btn');
                if (dehumBtn) {
                    dehumBtn.textContent = 'DE-HUM: 60Hz';
                    dehumBtn.style.background = 'rgba(239, 68, 68, 0.25)';
                    dehumBtn.style.color = '#f87171';
                }
            } else if (preset === 'reset') {
                ['eq', 'deesser', 'comp', 'gate', 'warmth', 'delay', 'chorus', 'widener', 'reverb', 'limiter'].forEach(fx => {
                    const chk = document.getElementById(`daw-fx-${fx}-enable`);
                    if (chk) chk.checked = false;
                });
                _activeFxLowCut = false;
                _activeFxDehum = 'off';
                const dehumBtn = document.getElementById('daw-fx-dehum-btn');
                if (dehumBtn) {
                    dehumBtn.textContent = 'DE-HUM: OFF';
                    dehumBtn.style.background = 'rgba(255,255,255,0.06)';
                    dehumBtn.style.color = 'rgba(255,255,255,0.8)';
                }
                const modelSel = document.getElementById('daw-fx-comp-model');
                if (modelSel) modelSel.value = 'modern';
                const lc = document.getElementById('daw-fx-eq-lowcut');
                if (lc) { lc.textContent = 'OFF'; lc.style.background = 'rgba(255,255,255,0.06)'; lc.style.color = '#ffffff'; }
                document.getElementById('daw-fx-eq-low').value = 0;
                document.getElementById('daw-fx-eq-low-val').textContent = '0dB';
                document.getElementById('daw-fx-eq-mid').value = 0;
                document.getElementById('daw-fx-eq-mid-val').textContent = '0dB';
                document.getElementById('daw-fx-eq-high').value = 0;
                document.getElementById('daw-fx-eq-high-val').textContent = '0dB';
            }

            // Sync live audition if active
            if (daw._auditionSource) {
                startFxAudition();
            }
        });
    });

    // Floating Draggable FX Rack Window Handler
    const initFloatingFxDraggable = () => {
        const fxModal = document.getElementById('daw-track-fx-modal');
        const fxHeader = document.getElementById('daw-track-fx-header');
        if (!fxModal || !fxHeader || fxHeader._dragBound) return;
        fxHeader._dragBound = true;

        fxHeader.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            if (e.target.closest('button')) return;

            const startX = e.clientX;
            const startY = e.clientY;
            const rect = fxModal.getBoundingClientRect();
            const parent = fxModal.offsetParent || document.body;
            const parentRect = parent.getBoundingClientRect();

            const initLeft = rect.left - parentRect.left;
            const initTop = rect.top - parentRect.top;

            fxModal.style.right = 'auto'; // Switch from right-docked to explicit left coordinates
            fxModal.style.left = `${initLeft}px`;
            fxModal.style.top = `${initTop}px`;

            const onDragMove = (moveEv) => {
                const dx = moveEv.clientX - startX;
                const dy = moveEv.clientY - startY;
                const newLeft = Math.max(10, Math.min(parentRect.width - fxModal.offsetWidth - 10, initLeft + dx));
                const newTop = Math.max(40, Math.min(parentRect.height - fxModal.offsetHeight - 10, initTop + dy));
                fxModal.style.left = `${newLeft}px`;
                fxModal.style.top = `${newTop}px`;
            };

            const onDragUp = () => {
                window.removeEventListener('mousemove', onDragMove);
                window.removeEventListener('mouseup', onDragUp);
            };

            window.addEventListener('mousemove', onDragMove);
            window.addEventListener('mouseup', onDragUp);
        });
    };
    initFloatingFxDraggable();

    // Close FX Modal
    document.getElementById('daw-track-fx-close-btn')?.addEventListener('click', () => {
        stopFxAudition();
        document.getElementById('daw-track-fx-modal').style.display = 'none';
    });

    // Apply & Save FX Rack
    document.getElementById('daw-track-fx-save-btn')?.addEventListener('click', () => {
        stopFxAudition();
        const trackId = daw._activeFxTrackId;
        const track = daw.tracks[trackId];
        if (track) {
            pushDawHistory('Update FX Rack');
            track.plugins = {
                eq: {
                    enabled: !!document.getElementById('daw-fx-eq-enable')?.checked,
                    lowCut: _activeFxLowCut,
                    dehum: _activeFxDehum,
                    low: parseFloat(document.getElementById('daw-fx-eq-low')?.value || 0),
                    mid: parseFloat(document.getElementById('daw-fx-eq-mid')?.value || 0),
                    high: parseFloat(document.getElementById('daw-fx-eq-high')?.value || 0)
                },
                deesser: {
                    enabled: !!document.getElementById('daw-fx-deesser-enable')?.checked,
                    reduction: parseFloat(document.getElementById('daw-fx-deesser-reduction')?.value || -6),
                    freq: parseFloat(document.getElementById('daw-fx-deesser-freq')?.value || 6500)
                },
                comp: {
                    enabled: !!document.getElementById('daw-fx-comp-enable')?.checked,
                    model: document.getElementById('daw-fx-comp-model')?.value || 'modern',
                    threshold: parseFloat(document.getElementById('daw-fx-comp-thresh')?.value || -24),
                    ratio: parseFloat(document.getElementById('daw-fx-comp-ratio')?.value || 3.5),
                    attack: 0.005,
                    release: 0.15
                },
                gate: {
                    enabled: !!document.getElementById('daw-fx-gate-enable')?.checked,
                    threshold: parseFloat(document.getElementById('daw-fx-gate-thresh')?.value || -42),
                    reduction: parseFloat(document.getElementById('daw-fx-gate-reduction')?.value || -24)
                },
                warmth: {
                    enabled: !!document.getElementById('daw-fx-warmth-enable')?.checked,
                    drive: parseFloat(document.getElementById('daw-fx-warmth')?.value || 25) / 100
                },
                delay: {
                    enabled: !!document.getElementById('daw-fx-delay-enable')?.checked,
                    time: parseFloat(document.getElementById('daw-fx-delay-time')?.value || 250),
                    feedback: parseFloat(document.getElementById('daw-fx-delay-feedback')?.value || 30),
                    mix: parseFloat(document.getElementById('daw-fx-delay-mix')?.value || 20)
                },
                chorus: {
                    enabled: !!document.getElementById('daw-fx-chorus-enable')?.checked,
                    rate: parseFloat(document.getElementById('daw-fx-chorus-rate')?.value || 1.2),
                    mix: parseFloat(document.getElementById('daw-fx-chorus-mix')?.value || 25)
                },
                widener: {
                    enabled: !!document.getElementById('daw-fx-widener-enable')?.checked,
                    width: parseFloat(document.getElementById('daw-fx-widener-width')?.value || 130)
                },
                reverb: {
                    enabled: !!document.getElementById('daw-fx-reverb-enable')?.checked,
                    type: document.getElementById('daw-fx-reverb-type')?.value || 'studio',
                    mix: parseFloat(document.getElementById('daw-fx-reverb-wet')?.value || 20) / 100
                },
                limiter: {
                    enabled: !!document.getElementById('daw-fx-limiter-enable')?.checked,
                    ceiling: parseFloat(document.getElementById('daw-fx-limiter-ceiling')?.value || -0.5),
                    gain: parseFloat(document.getElementById('daw-fx-limiter-gain')?.value || 2.0)
                }
            };
            if (daw.isPlaying) {
                stopDawPlayback(false);
                startDawPlayback();
            }
            renderDawTracks();
        }
        document.getElementById('daw-track-fx-modal').style.display = 'none';
    });

    // Wire Add Track Buttons (Left Sidebar)
    document.getElementById('daw-add-audio-track-btn')?.addEventListener('click', () => {
        const audioTracks = Object.values(daw.tracks).filter(t => t.type === 'audio');
        const newId = `audio_${Date.now()}`;
        const newName = `Vocal Track ${audioTracks.length + 1}`;
        daw.tracks[newId] = {
            id: newId,
            name: newName,
            type: 'audio',
            vol: 1.0,
            muted: false,
            solo: false,
            color: '#38bdf8',
            showAutomation: false,
            keyframes: [{ time: 0, val: 1.0 }]
        };
        renderDawTracks();
        renderDawClips();
        renderDawRuler();
    });

    document.getElementById('daw-add-music-track-btn')?.addEventListener('click', () => {
        const musicTracks = Object.values(daw.tracks).filter(t => t.type === 'music');
        const newId = `music_${Date.now()}`;
        const newName = `Music / SFX ${musicTracks.length + 1}`;
        daw.tracks[newId] = {
            id: newId,
            name: newName,
            type: 'music',
            vol: 0.8,
            muted: false,
            solo: false,
            color: '#f59e0b',
            showAutomation: false,
            keyframes: [{ time: 0, val: 0.8 }]
        };
        renderDawTracks();
        renderDawClips();
        renderDawRuler();
    });

    // Stop DAW Playback
    const stopDawPlayback = (resetToStart = false) => {
        if (daw.isRecording) {
            stopDawRecording();
        }
        daw.isPlaying = false;
        if (daw.animId) {
            cancelAnimationFrame(daw.animId);
            daw.animId = null;
        }
        daw.activeSources.forEach(s => {
            try { s.stop(); } catch (e) {}
        });
        daw.activeSources = [];
        if (resetToStart) {
            daw.playhead = 0;
        }
        const playBtnText = document.getElementById('timeline-play-btn-text');
        if (playBtnText) playBtnText.textContent = 'Play';
        const playBtnIcon = document.getElementById('timeline-play-btn-icon');
        if (playBtnIcon) playBtnIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
        const vuBar = document.getElementById('daw-master-vu-bar');
        const vuDb = document.getElementById('daw-master-vu-db');
        if (vuBar) vuBar.style.width = '0%';
        if (vuDb) vuDb.textContent = '-∞ dB';

        // Synchronize Video Track Preview Playback state
        const videoEl = document.getElementById('daw-video-element');
        if (videoEl) {
            try {
                videoEl.pause();
                if (resetToStart) videoEl.currentTime = 0;
            } catch (vErr) {}
        }

        updateDawPlayhead();
    };

    // Start DAW Playback with Volume Keyframing Automation & Master Bus Peak VU Metering
    const startDawPlayback = async () => {
        if (daw.isPlaying) return;
        if (!daw.audioCtx) {
            daw.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (!daw.masterGain) {
            daw.masterGain = daw.audioCtx.createGain();

            // Master Bus Stereo Dynamics Brickwall Limiter (v1.7.6)
            daw.masterLimiter = daw.audioCtx.createDynamicsCompressor();
            daw.masterLimiter.threshold.setValueAtTime(-0.5, daw.audioCtx.currentTime); // -0.5 dBFS brickwall ceiling
            daw.masterLimiter.knee.setValueAtTime(0, daw.audioCtx.currentTime); // Hard knee
            daw.masterLimiter.ratio.setValueAtTime(20, daw.audioCtx.currentTime); // Brickwall 20:1 ratio
            daw.masterLimiter.attack.setValueAtTime(0.001, daw.audioCtx.currentTime); // 1ms ultrafast attack
            daw.masterLimiter.release.setValueAtTime(0.05, daw.audioCtx.currentTime); // 50ms smooth release

            daw.masterAnalyser = daw.audioCtx.createAnalyser();
            daw.masterAnalyser.fftSize = 256;

            daw.masterGain.connect(daw.masterLimiter);
            daw.masterLimiter.connect(daw.masterAnalyser);
            daw.masterAnalyser.connect(daw.audioCtx.destination);
        }
        const masterVol = (daw._masterVol !== undefined && Number.isFinite(daw._masterVol)) ? Math.max(0, daw._masterVol) : 1.0;
        daw.masterGain.gain.setValueAtTime(masterVol, daw.audioCtx.currentTime);

        if (daw.audioCtx.state === 'suspended') {
            try { await daw.audioCtx.resume(); } catch (e) {}
        }

        // Recalculate duration before starting playback
        recalculateDawDuration();

        const hasActivePunch = daw.punch && daw.punch.isActive && typeof daw.punch.inTime === 'number' && typeof daw.punch.outTime === 'number';

        // Check if playhead is at or past end of timeline or past punch out region
        let latestClipEnd = 0;
        if (daw.clips && daw.clips.length > 0) {
            for (const c of daw.clips) {
                const cEnd = (Number.isFinite(c.startOffset) ? c.startOffset : 0) + Math.max(0, (c.trimEnd || 0) - (c.trimStart || 0));
                if (cEnd > latestClipEnd) latestClipEnd = cEnd;
            }
        }
        if (hasActivePunch) {
            if (daw.playhead < daw.punch.inTime || daw.playhead >= daw.punch.outTime - 0.05) {
                daw.playhead = daw.punch.inTime;
                updateDawPlayhead();
            }
        } else if (daw.playhead >= daw.duration - 0.2 || (latestClipEnd > 0 && daw.playhead >= latestClipEnd - 0.05)) {
            daw.playhead = 0;
            updateDawPlayhead();
        }

        // Ensure all pending clip audio buffers are resolved before scheduling playback
        const pendingClips = daw.clips.filter(c => !c.buffer && (c.blob || c.blobUrl));
        if (pendingClips.length > 0) {
            const playBtnText = document.getElementById('timeline-play-btn-text');
            if (playBtnText) playBtnText.textContent = 'Buffering...';
            await Promise.all(pendingClips.map(async (c) => {
                try {
                    let ab;
                    if (c.blob instanceof Blob) {
                        ab = await c.blob.arrayBuffer();
                    } else if (c.blobUrl) {
                        const res = await fetch(c.blobUrl);
                        if (res.ok) ab = await res.arrayBuffer();
                    }
                    if (ab && ab.byteLength > 0) {
                        c.buffer = await daw.audioCtx.decodeAudioData(ab.slice(0));
                        if (!c.peaks || c.peaks.length === 0) {
                            c.peaks = extractWaveformPeaks(c.buffer, 400);
                        }
                    }
                    const matchedTake = (window._podcastTakeInventory || []).find(t => t.blobUrl === c.blobUrl);
                    if (matchedTake && !matchedTake.buffer && c.buffer) {
                        matchedTake.buffer = c.buffer;
                        matchedTake.peaks = c.peaks;
                    }
                } catch (err) {
                    console.warn('[DAW Playback] Error decoding pending buffer for clip:', c.name, err);
                }
            }));
            renderDawClips();
            if (playBtnText) playBtnText.textContent = 'Play';
        }

        daw.activeSources = [];
        const hasSolo = Object.values(daw.tracks).some(t => t.solo);
        const baseAudioTime = daw.audioCtx.currentTime + 0.025; // 25ms safe lookahead margin

        for (const clip of daw.clips) {
            const track = daw.tracks[clip.trackId] || { vol: 1.0, muted: false, solo: false, keyframes: [{ time: 0, val: 1.0 }] };
            if (hasSolo ? (!track.solo || track.muted) : track.muted) continue;

            const clipStart = Number.isFinite(clip.startOffset) ? clip.startOffset : 0;
            const tStart = Number.isFinite(clip.trimStart) ? clip.trimStart : 0;
            const tEnd = Number.isFinite(clip.trimEnd) ? clip.trimEnd : (clip.duration || (clip.buffer ? clip.buffer.duration : 0));
            const clipDur = Math.max(0, tEnd - tStart);
            const clipEnd = clipStart + clipDur;

            if (daw.playhead >= clipEnd - 0.005) continue;

            let scheduleDelay = 0;
            let offsetInBuffer = tStart;
            let playDuration = clipDur;

            if (daw.playhead < clipStart) {
                scheduleDelay = clipStart - daw.playhead;
            } else {
                const elapsed = daw.playhead - clipStart;
                offsetInBuffer = tStart + elapsed;
                playDuration = Math.max(0, clipDur - elapsed);
            }

            if (playDuration < 0.01) continue;

            if (clip.buffer) {
                try {
                    const src = daw.audioCtx.createBufferSource();
                    src.buffer = clip.buffer;
                    const gain = daw.audioCtx.createGain();

                    const startTime = baseAudioTime + scheduleDelay;
                    const endTime = startTime + playDuration;
                    const trackVol = (typeof track.vol === 'number' && Number.isFinite(track.vol)) ? Math.max(0, track.vol) : 1.0;
                    const clipGain = (typeof clip.gain === 'number' && Number.isFinite(clip.gain)) ? Math.max(0, clip.gain) : 1.0;
                    const targetVol = Math.max(0.0001, trackVol * clipGain);

                    gain.gain.cancelScheduledValues(baseAudioTime);

                    // Apply Track Volume & Keyframe Curve Automation
                    if (track.keyframes && track.keyframes.length > 1) {
                        const sorted = [...track.keyframes].sort((a, b) => a.time - b.time);
                        const initKfGain = evaluateKeyframeAtTime(sorted, Math.max(0, daw.playhead)) * targetVol;
                        gain.gain.setValueAtTime(Math.max(0.0001, initKfGain), startTime);

                        sorted.forEach(kf => {
                            if (kf.time > daw.playhead && kf.time <= clipEnd) {
                                const rampTime = baseAudioTime + (kf.time - daw.playhead);
                                gain.gain.linearRampToValueAtTime(Math.max(0.0001, kf.val * targetVol), Math.max(startTime + 0.005, rampTime));
                            }
                        });
                    } else {
                        gain.gain.setValueAtTime(targetVol, startTime);
                    }

                    // Apply Corner Fade In / Out Curves
                    const cFadeIn = clip.fadeIn || 0;
                    const cFadeOut = clip.fadeOut || 0;
                    if (cFadeIn > 0.02) {
                        const fadeInEnd = Math.min(endTime, startTime + cFadeIn);
                        gain.gain.setValueAtTime(0.0001, startTime);
                        gain.gain.linearRampToValueAtTime(targetVol, fadeInEnd);
                    }
                    if (cFadeOut > 0.02) {
                        const fadeOutStart = Math.max(startTime, endTime - cFadeOut);
                        gain.gain.setValueAtTime(targetVol, fadeOutStart);
                        gain.gain.linearRampToValueAtTime(0.0001, endTime);
                    }

                    // Connect DSP Effects Rack into Master Output Bus
                    const fxChain = buildTrackPluginChain(daw.audioCtx, track);
                    src.connect(gain);
                    if (fxChain && fxChain.input && fxChain.output) {
                        gain.connect(fxChain.input);
                        fxChain.output.connect(daw.masterGain);
                    } else {
                        gain.connect(daw.masterGain);
                    }
                    src.start(startTime, offsetInBuffer, playDuration);
                    daw.activeSources.push(src);
                } catch (err) {
                    console.warn('[DAW Playback] Error starting buffer:', clip.name, err);
                }
            }
        }

        daw.isPlaying = true;
        daw.startCtxTime = daw.audioCtx.currentTime;
        daw.startPlayhead = daw.playhead;

        const playBtnText = document.getElementById('timeline-play-btn-text');
        if (playBtnText) playBtnText.textContent = 'Pause';
        const playBtnIcon = document.getElementById('timeline-play-btn-icon');
        if (playBtnIcon) playBtnIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';

        // Synchronize Video Track Preview Playback
        const videoEl = document.getElementById('daw-video-element');
        if (videoEl && videoEl.src) {
            try {
                videoEl.currentTime = daw.playhead;
                videoEl.play().catch(() => {});
            } catch (vErr) {}
        }

        const tick = () => {
            if (!daw.isPlaying) return;
            try {
                const elapsed = daw.audioCtx.currentTime - daw.startCtxTime;
                daw.playhead = daw.startPlayhead + elapsed;

                // Expand live recording clip width with playhead in real time
                if (daw.isRecording && dawRecordingClipEl) {
                    const recWidth = Math.max(14, (daw.playhead - dawRecordingStartTime) * daw.zoom);
                    dawRecordingClipEl.style.width = `${recWidth}px`;
                }

                if (daw.isRecording && daw.playhead >= daw.duration - 2) {
                    daw.duration = Math.ceil(daw.playhead + 15);
                    renderDawRuler();
                } else if (hasActivePunch && daw.playhead >= daw.punch.outTime) {
                    if (daw.isLooping) {
                        stopDawPlayback(false);
                        daw.playhead = daw.punch.inTime;
                        updateDawPlayhead();
                        startDawPlayback();
                        return;
                    } else {
                        stopDawPlayback();
                        daw.playhead = daw.punch.outTime;
                        updateDawPlayhead();
                        return;
                    }
                } else if (daw.playhead >= daw.duration) {
                    if (daw.isLooping) {
                        stopDawPlayback(false);
                        daw.playhead = 0;
                        updateDawPlayhead();
                        startDawPlayback();
                        return;
                    } else {
                        stopDawPlayback();
                        daw.playhead = daw.duration;
                        updateDawPlayhead();
                        return;
                    }
                }
                updateDawPlayhead();

                // Synthesize Audible Metronome Ticks if enabled (BPM tempo based)
                if (daw.isMetronomeEnabled) {
                    const beatInterval = 60 / (daw.bpm || 120);
                    const currentBeatIndex = Math.floor(daw.playhead / beatInterval);
                    if (currentBeatIndex !== daw._lastMetronomeBeat && currentBeatIndex >= 0) {
                        daw._lastMetronomeBeat = currentBeatIndex;
                        const isDownbeat = (currentBeatIndex % 4) === 0;
                        playMetronomeClick(isDownbeat);
                    }
                }

                // Sample Master Output Stereo Peak VU Meter & LUFS Integrated Loudness
                if (daw.masterAnalyser) {
                    const data = new Uint8Array(daw.masterAnalyser.frequencyBinCount);
                    daw.masterAnalyser.getByteTimeDomainData(data);
                    let peak = 0;
                    let sumSquare = 0;
                    for (let i = 0; i < data.length; i++) {
                        const dev = (data[i] - 128) / 128;
                        const absDev = Math.abs(dev);
                        if (absDev > peak) peak = absDev;
                        sumSquare += dev * dev;
                    }
                    const vuBar = document.getElementById('daw-master-vu-bar');
                    const vuDb = document.getElementById('daw-master-vu-db');
                    const lufsBadge = document.getElementById('daw-master-lufs-badge');

                    if (vuBar) vuBar.style.width = `${Math.min(100, Math.round(peak * 100))}%`;
                    const dbStr = peak > 0.001 ? (20 * Math.log10(peak)).toFixed(1) : '-inf';
                    if (vuDb) {
                        vuDb.textContent = dbStr === '-inf' ? '-∞ dB' : `${dbStr} dB`;
                    }

                    // Animate Standalone / Docked Studio Master VU Window (Dual Bars L/R & Clip)
                    const vuBarL = document.getElementById('daw-vu-bar-l');
                    const vuBarR = document.getElementById('daw-vu-bar-r');
                    const vuDbL = document.getElementById('daw-vu-db-l');
                    const vuDbR = document.getElementById('daw-vu-db-r');
                    const vuClip = document.getElementById('daw-vu-clip-badge');
                    const vuWindowLufs = document.getElementById('daw-vu-lufs-window-badge');

                    if (vuBarL) vuBarL.style.height = `${Math.min(100, Math.round(peak * 100))}%`;
                    if (vuBarR) {
                        // Subtle acoustic channel differential simulation for stereo realism
                        const peakR = Math.max(0, Math.min(1.0, peak * (0.96 + ((data[0] || 128) % 7) * 0.01)));
                        vuBarR.style.height = `${Math.min(100, Math.round(peakR * 100))}%`;
                    }
                    if (vuDbL) vuDbL.textContent = dbStr === '-inf' ? '-∞' : `${dbStr}dB`;
                    if (vuDbR) vuDbR.textContent = dbStr === '-inf' ? '-∞' : `${dbStr}dB`;
                    if (vuClip) {
                        vuClip.style.opacity = peak >= 0.98 ? '1' : '0';
                    }

                    if (lufsBadge) {
                        const rms = Math.sqrt(sumSquare / data.length);
                        // EBU R128 / ITU-R BS.1770 approximation: LUFS ~= 20*log10(RMS) - 0.69
                        if (rms > 0.0005) {
                            const lufs = (20 * Math.log10(rms) - 0.69).toFixed(1);
                            daw.masterLufs = parseFloat(lufs);
                            lufsBadge.textContent = `${lufs} LUFS`;
                            if (vuWindowLufs) vuWindowLufs.textContent = `${lufs} LUFS`;
                            if (lufs > -14.0) {
                                lufsBadge.style.color = '#f87171'; // Too loud for podcast standard (-14 / -16 LUFS)
                                if (vuWindowLufs) vuWindowLufs.style.color = '#f87171';
                            } else if (lufs >= -18.0) {
                                lufsBadge.style.color = '#34d399'; // Optimal broadcast target range
                                if (vuWindowLufs) vuWindowLufs.style.color = '#34d399';
                            } else {
                                lufsBadge.style.color = '#38bdf8'; // Quiet speech/ambient
                                if (vuWindowLufs) vuWindowLufs.style.color = '#38bdf8';
                            }
                        } else {
                            lufsBadge.textContent = '-∞ LUFS';
                            lufsBadge.style.color = '#38bdf8';
                            if (vuWindowLufs) {
                                vuWindowLufs.textContent = '-∞ LUFS';
                                vuWindowLufs.style.color = '#38bdf8';
                            }
                        }
                    }
                }

                // Auto-scroll timeline viewport smoothly to follow playhead
                const viewport = document.getElementById('timeline-scroll-viewport');
                if (viewport) {
                    const playheadPx = daw.playhead * daw.zoom;
                    const scrollRight = viewport.scrollLeft + viewport.clientWidth;
                    if (playheadPx > scrollRight - 70) {
                        viewport.scrollLeft = playheadPx - 80;
                    } else if (playheadPx < viewport.scrollLeft) {
                        viewport.scrollLeft = Math.max(0, playheadPx - 40);
                    }
                }
            } catch (tickErr) {
                console.error('[DAW Playback] Error inside tick:', tickErr);
            }

            daw.animId = requestAnimationFrame(tick);
        };
        daw.animId = requestAnimationFrame(tick);
    };

    const toggleDawPlay = () => {
        if (daw.isPlaying) {
            stopDawPlayback(false);
        } else {
            startDawPlayback();
        }
    };

    let dawMediaRecorder = null;
    let dawRecordingStream = null;
    let dawRecordingChunks = [];
    let dawRecordingStartTime = 0;
    let dawRecordingTargetTrackId = 'host';
    let dawRecordingClipEl = null;

    // Start Live Mic Level VU Monitor in DAW Toolbar
    const startDawMicLevelMonitor = async (deviceId) => {
        if (daw._micMonitorStream) {
            try { daw._micMonitorStream.getTracks().forEach(t => t.stop()); } catch (e) {}
            daw._micMonitorStream = null;
        }
        if (daw._micMonitorCtx) {
            try { await daw._micMonitorCtx.close(); } catch (e) {}
            daw._micMonitorCtx = null;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    echoCancellation: true,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const src = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 64;
            src.connect(analyser);

            daw._micMonitorStream = stream;
            daw._micMonitorCtx = ctx;
            daw._micMonitorAnalyser = analyser;

            const updateMeter = () => {
                const editorModal = document.getElementById('podcast-editor-modal');
                if (!editorModal || editorModal.style.display === 'none' || !daw._micMonitorAnalyser) return;

                const data = new Uint8Array(daw._micMonitorAnalyser.frequencyBinCount);
                daw._micMonitorAnalyser.getByteTimeDomainData(data);
                let peak = 0;
                for (let i = 0; i < data.length; i++) {
                    const dev = Math.abs((data[i] - 128) / 128);
                    if (dev > peak) peak = dev;
                }
                const bar = document.getElementById('daw-rec-mic-level-bar');
                if (bar) {
                    bar.style.width = `${Math.min(100, Math.round(peak * 190))}%`;
                }
                requestAnimationFrame(updateMeter);
            };
            requestAnimationFrame(updateMeter);
        } catch (err) {
            console.warn('[DAW Mic Monitor] Notice:', err.message);
        }
    };

    // Initialize DAW Microphone Device Picker & Target Track Selector
    const initDawMicSetup = async () => {
        const micSelect = document.getElementById('daw-record-mic-select');
        const trackSelect = document.getElementById('daw-record-track-select');
        if (!micSelect) return;

        // Populate available tracks
        if (trackSelect) {
            const trackList = Object.values(daw.tracks);
            const curVal = daw._recordTrackId || 'host';
            trackSelect.innerHTML = trackList.map(t => `
                <option value="${t.id}" ${t.id === curVal ? 'selected' : ''}>${t.name}</option>
            `).join('');
            trackSelect.onchange = (e) => {
                daw._recordTrackId = e.target.value;
            };
        }

        // Enumerate microphones
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const audioInputs = devices.filter(d => d.kind === 'audioinput');
                const preferredId = localStorage.getItem('localfilm_preferred_host_mic_id');

                if (audioInputs.length > 0) {
                    micSelect.innerHTML = audioInputs.map(d => `
                        <option value="${d.deviceId}">${d.label || `Microphone ${d.deviceId.substring(0, 5)}`}</option>
                    `).join('');

                    if (preferredId && audioInputs.some(d => d.deviceId === preferredId)) {
                        micSelect.value = preferredId;
                    } else {
                        micSelect.value = audioInputs[0].deviceId;
                    }
                } else {
                    micSelect.innerHTML = '<option value="">Default Microphone</option>';
                }
            }
        } catch (e) {
            micSelect.innerHTML = '<option value="">Default Microphone</option>';
        }

        micSelect.onchange = (e) => {
            const devId = e.target.value;
            if (devId) {
                localStorage.setItem('localfilm_preferred_host_mic_id', devId);
            }
            startDawMicLevelMonitor(devId);
        };

        startDawMicLevelMonitor(micSelect.value);
    };

    // Multi-Track Voice-Over / Overdub Recording Engine with Simultaneous Playback
    const startDawRecording = async () => {
        if (daw.isRecording) return;

        const trackSelect = document.getElementById('daw-record-track-select');
        let targetTrackId = trackSelect?.value || daw._recordTrackId || '__new__';

        // Auto-create a brand new track if __new__ is selected or target track does not exist
        if (targetTrackId === '__new__' || !daw.tracks[targetTrackId]) {
            const voCount = Object.keys(daw.tracks).filter(k => k.startsWith('vo-') || (daw.tracks[k]?.name && daw.tracks[k].name.toLowerCase().includes('voice-over'))).length + 1;
            const newTrackId = `vo-${Date.now()}`;
            const newTrackName = `Voice-Over ${voCount}`;
            const voColors = ['#a855f7', '#06b6d4', '#ec4899', '#f97316', '#3b82f6', '#10b981'];
            const trackColor = voColors[(voCount - 1) % voColors.length];

            daw.tracks[newTrackId] = {
                id: newTrackId,
                name: newTrackName,
                type: 'audio',
                color: trackColor,
                vol: 1.0,
                pan: 0,
                muted: false,
                solo: false,
                showAutomation: false,
                keyframes: [{ time: 0, val: 1.0 }],
                plugins: defaultPluginState()
            };

            targetTrackId = newTrackId;
            daw._recordTrackId = newTrackId;
            renderDawTracks();
            pushDawHistory('Add Voice-Over Track');
        }

        const track = daw.tracks[targetTrackId];

        const micSelect = document.getElementById('daw-record-mic-select');
        const selectedMicId = micSelect?.value || localStorage.getItem('localfilm_preferred_host_mic_id');

        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: selectedMicId ? { exact: selectedMicId } : undefined,
                    echoCancellation: true,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });
        } catch (err) {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch (e) {
                await showStudioAlert('Microphone Access Error', 'Could not access microphone: ' + err.message + '\n\nPlease verify microphone permissions in your browser settings.');
                return;
            }
        }

        dawRecordingStream = stream;
        dawRecordingChunks = [];
        dawRecordingStartTime = daw.playhead;
        dawRecordingTargetTrackId = targetTrackId;

        let mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '');
        }

        try {
            dawMediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        } catch (e) {
            dawMediaRecorder = new MediaRecorder(stream);
        }

        dawMediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                dawRecordingChunks.push(e.data);
            }
        };

        dawMediaRecorder.onstop = async () => {
            const recordedChunks = [...dawRecordingChunks];
            dawRecordingChunks = [];

            if (dawRecordingStream) {
                dawRecordingStream.getTracks().forEach(t => t.stop());
                dawRecordingStream = null;
            }

            if (dawRecordingClipEl) {
                dawRecordingClipEl.remove();
                dawRecordingClipEl = null;
            }

            if (recordedChunks.length > 0) {
                try {
                    const audioBlob = new Blob(recordedChunks, { type: dawMediaRecorder.mimeType || 'audio/webm' });
                    const ab = await audioBlob.arrayBuffer();
                    if (!daw.audioCtx) {
                        daw.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    }
                    const tempCtx = daw.audioCtx;
                    const decodedBuf = await tempCtx.decodeAudioData(ab.slice(0));
                    const recDur = decodedBuf.duration;

                    if (recDur < 0.2) return;

                    const takeCount = daw.clips.filter(c => c.name.includes('Voice-Over') || c.name.includes('Take')).length + 1;
                    const clipName = `Voice-Over Take ${takeCount}`;
                    const blobUrl = URL.createObjectURL(audioBlob);

                    const newClip = {
                        id: `clip-rec-${Date.now()}`,
                        trackId: dawRecordingTargetTrackId,
                        name: clipName,
                        tag: 'Vocal',
                        startOffset: dawRecordingStartTime,
                        trimStart: 0,
                        trimEnd: recDur,
                        duration: recDur,
                        blob: audioBlob,
                        blobUrl: blobUrl,
                        buffer: decodedBuf,
                        peaks: extractWaveformPeaks(decodedBuf, 400),
                        color: '#ef4444'
                    };

                    pushDawHistory('Record Audio Take');
                    daw.clips.push(newClip);

                    // Add to Podcast Take Inventory as voice-over take
                    const masterTake = {
                        id: `take-rec-${Date.now()}`,
                        stemType: 'voice_over',
                        name: clipName,
                        duration: formatDawTime(recDur),
                        durationSeconds: Math.round(recDur),
                        blob: audioBlob,
                        blobUrl: blobUrl,
                        buffer: decodedBuf,
                        peaks: newClip.peaks,
                        micName: `DAW Overdub (${track?.name || 'Voice-Over'})`
                    };
                    window._podcastTakeInventory = window._podcastTakeInventory || [];
                    window._podcastTakeInventory.unshift(masterTake);
                    if (typeof renderTakeInventory === 'function') renderTakeInventory();

                    // Safely recalculate duration with recorded clip included
                    recalculateDawDuration();

                    daw.selectedClipId = newClip.id;
                    if (!daw.selectedClipIds) daw.selectedClipIds = new Set();
                    daw.selectedClipIds.clear();
                    daw.selectedClipIds.add(newClip.id);

                    // Revert daw._recordTrackId back to '__new__' so subsequent takes automatically create a fresh track unless user explicitly arms a track
                    daw._recordTrackId = '__new__';

                    // Rewind playhead to start of newly recorded clip so hitting Play immediately plays it back
                    daw.playhead = dawRecordingStartTime;

                    renderDawTracks();
                    renderDawRuler();
                    renderDawClips();
                    updateDawPlayhead();
                    showUndoToast(`🎙️ Recorded: ${clipName} onto ${track?.name || 'New Track'} (${formatDawTime(recDur)})`);
                } catch (err) {
                    console.error('[DAW Record] Error decoding take:', err);
                }
            }
        };

        daw.isRecording = true;
        dawMediaRecorder.start(100);

        // Visual update on Record Button
        const recBtn = document.getElementById('timeline-record-btn');
        if (recBtn) {
            recBtn.style.background = '#ef4444';
            recBtn.style.borderColor = '#dc2626';
            recBtn.style.color = '#ffffff';
            recBtn.style.boxShadow = '0 0 16px rgba(239, 68, 68, 0.7)';
            const recText = document.getElementById('timeline-record-btn-text');
            if (recText) recText.textContent = 'Stop Rec';
        }

        // Create live growing recording clip placeholder in the destination track lane
        const targetLane = document.getElementById(`timeline-lane-${targetTrackId}`);
        if (targetLane) {
            dawRecordingClipEl = document.createElement('div');
            dawRecordingClipEl.className = 'daw-timeline-clip daw-recording-clip';
            dawRecordingClipEl.style.cssText = `
                position: absolute;
                top: 6px;
                bottom: 6px;
                left: ${dawRecordingStartTime * daw.zoom}px;
                width: 16px;
                background: rgba(239, 68, 68, 0.25);
                background-image: linear-gradient(180deg, rgba(239, 68, 68, 0.4) 0%, rgba(0,0,0,0.6) 100%);
                border: 2px solid #ef4444;
                border-radius: 8px;
                padding: 4px 8px;
                display: flex;
                align-items: center;
                color: #ffffff;
                font-size: 11px;
                font-weight: 800;
                overflow: hidden;
                z-index: 35;
                box-shadow: 0 0 16px rgba(239, 68, 68, 0.5);
                pointer-events: none;
            `;
            dawRecordingClipEl.innerHTML = `
                <div style="display: flex; align-items: center; gap: 6px; white-space: nowrap;">
                    <span style="width: 8px; height: 8px; border-radius: 50%; background: #ef4444; box-shadow: 0 0 8px #ef4444;"></span>
                    <span>● RECORDING VOICE-OVER...</span>
                </div>
            `;
            targetLane.appendChild(dawRecordingClipEl);
        }

        // Start real-time playback simultaneously so user can overdub against other tracks!
        if (!daw.isPlaying) {
            await startDawPlayback();
        }
    };

    const stopDawRecording = () => {
        if (!daw.isRecording) return;
        daw.isRecording = false;

        if (dawMediaRecorder && dawMediaRecorder.state !== 'inactive') {
            dawMediaRecorder.stop();
        }

        const recBtn = document.getElementById('timeline-record-btn');
        if (recBtn) {
            recBtn.style.background = 'rgba(239, 68, 68, 0.15)';
            recBtn.style.borderColor = 'rgba(239, 68, 68, 0.45)';
            recBtn.style.color = '#f87171';
            recBtn.style.boxShadow = 'none';
            const recText = document.getElementById('timeline-record-btn-text');
            if (recText) recText.textContent = 'Record';
        }

        if (daw.isPlaying) {
            stopDawPlayback(false);
        }
    };

    const toggleDawRecording = async () => {
        if (daw.isRecording) {
            stopDawRecording();
        } else {
            await startDawRecording();
        }
    };

    // Split / Cut Clip at Playhead
    const splitSelectedClip = () => {
        if (!daw.selectedClipId) {
            showStudioToast('Please select a clip on the timeline first, then click Split / Cut.');
            return;
        }
        const clipIdx = daw.clips.findIndex(c => c.id === daw.selectedClipId);
        if (clipIdx === -1) return;
        const clip = daw.clips[clipIdx];
        const clipStart = clip.startOffset;
        const clipLen = clip.trimEnd - clip.trimStart;
        const clipEnd = clipStart + clipLen;

        if (daw.playhead <= clipStart || daw.playhead >= clipEnd) {
            showStudioAlert(
                'Playhead Not Over Clip',
                `The playhead (${formatDawTime(daw.playhead)}) is not over the selected clip "${clip.name}" (${formatDawTime(clipStart)} – ${formatDawTime(clipEnd)}).\n\nClick on the time ruler over the clip to move the playhead, then hit Split.`
            );
            return;
        }

        const cutInClip = clip.trimStart + (daw.playhead - clipStart);
        const originalEnd = clip.trimEnd;

        pushDawHistory('Split Clip');

        // Truncate left clip
        clip.trimEnd = cutInClip;

        // Create right clip (independently editable, movable, renameable, re-colorable and taggable!)
        const newClip = {
            id: `clip-${clip.trackId}-${Date.now()}`,
            trackId: clip.trackId,
            name: `${clip.name.replace(/ \(Part \d+\)/, '')} (Part 2)`,
            tag: clip.tag || 'Split',
            startOffset: daw.playhead,
            trimStart: cutInClip,
            trimEnd: originalEnd,
            duration: clip.duration,
            blobUrl: clip.blobUrl,
            buffer: clip.buffer,
            peaks: clip.peaks,
            color: clip.color
        };
        daw.clips.splice(clipIdx + 1, 0, newClip);
        daw.selectedClipId = newClip.id;
        if (!daw.selectedClipIds) daw.selectedClipIds = new Set();
        daw.selectedClipIds.clear();
        daw.selectedClipIds.add(newClip.id);
        renderDawClips();
        showStudioToast(`Split clip "${clip.name}"`);
    };

    // Clipboard & Editing Operations (v1.7.5: Cut, Copy, Paste, Ripple Delete)
    const copySelectedClipsDAW = () => {
        const ids = daw.selectedClipIds && daw.selectedClipIds.size > 0 
            ? Array.from(daw.selectedClipIds) 
            : (daw.selectedClipId ? [daw.selectedClipId] : []);
        if (ids.length === 0) {
            showStudioToast('Please select clip(s) to copy');
            return;
        }

        const clipsToCopy = daw.clips.filter(c => ids.includes(c.id));
        if (clipsToCopy.length === 0) return;

        // Find reference start time (earliest clip's startOffset)
        const minOffset = Math.min(...clipsToCopy.map(c => c.startOffset));

        daw._clipboardClips = clipsToCopy.map(c => ({
            name: c.name,
            tag: c.tag,
            trackId: c.trackId,
            relOffset: c.startOffset - minOffset,
            trimStart: c.trimStart,
            trimEnd: c.trimEnd,
            fadeIn: c.fadeIn || 0,
            fadeOut: c.fadeOut || 0,
            duration: c.duration,
            buffer: c.buffer,
            blob: c.blob,
            blobUrl: c.blobUrl,
            peaks: c.peaks,
            color: c.color
        }));

        showStudioToast(`📋 Copied ${clipsToCopy.length} clip(s) to clipboard`);
    };

    const cutSelectedClipsDAW = () => {
        const ids = daw.selectedClipIds && daw.selectedClipIds.size > 0 
            ? Array.from(daw.selectedClipIds) 
            : (daw.selectedClipId ? [daw.selectedClipId] : []);
        if (ids.length === 0) {
            showStudioToast('Please select clip(s) to cut');
            return;
        }

        copySelectedClipsDAW();
        deleteSelectedClip(daw.isRippleEnabled);
    };

    const pasteClipsDAW = () => {
        if (!daw._clipboardClips || daw._clipboardClips.length === 0) {
            showStudioToast('Clipboard is empty. Copy or cut a clip first.');
            return;
        }

        pushDawHistory('Paste Clip(s)');

        // Target track is the current record track, or the track of the first clipboard clip if it exists
        const pasteBaseTime = daw.playhead;
        const newSelectedIds = new Set();
        let targetTrackId = daw._recordTrackId && daw.tracks[daw._recordTrackId] && daw._recordTrackId !== '__new__'
            ? daw._recordTrackId
            : null;

        daw._clipboardClips.forEach(template => {
            const destTrack = targetTrackId || (daw.tracks[template.trackId] ? template.trackId : 'host');
            const newClip = {
                id: `clip-${destTrack}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                trackId: destTrack,
                name: template.name.includes('(Copy)') ? template.name : `${template.name} (Copy)`,
                tag: template.tag || 'Audio',
                startOffset: Math.max(0, pasteBaseTime + (template.relOffset || 0)),
                trimStart: template.trimStart,
                trimEnd: template.trimEnd,
                fadeIn: template.fadeIn || 0,
                fadeOut: template.fadeOut || 0,
                duration: template.duration,
                buffer: template.buffer,
                blob: template.blob,
                blobUrl: template.blobUrl,
                peaks: template.peaks,
                color: template.color || '#38bdf8'
            };

            daw.clips.push(newClip);
            newSelectedIds.add(newClip.id);
        });

        daw.selectedClipIds = newSelectedIds;
        daw.selectedClipId = Array.from(newSelectedIds)[0] || null;

        recalculateDawDuration();
        renderDawRuler();
        renderDawClips();
        showStudioToast(`📥 Pasted ${daw._clipboardClips.length} clip(s) at ${formatDawTime(pasteBaseTime)}`);
    };

    // Delete Selected Clip(s) with Ripple Edit Gap Closing Support
    const deleteSelectedClip = (forceRipple = false) => {
        if (!daw.selectedClipIds || daw.selectedClipIds.size === 0) {
            if (daw.selectedClipId) {
                daw.selectedClipIds = new Set([daw.selectedClipId]);
            } else {
                showStudioToast('Click a clip to select it, then click Delete.');
                return;
            }
        }

        const isRipple = forceRipple || daw.isRippleEnabled;
        pushDawHistory(isRipple ? 'Ripple Delete Clip(s)' : 'Delete Clip');
        const count = daw.selectedClipIds.size;

        const deletingClips = daw.clips.filter(c => daw.selectedClipIds.has(c.id));
        const remainingClips = daw.clips.filter(c => !daw.selectedClipIds.has(c.id));

        if (isRipple && deletingClips.length > 0) {
            // Group deleted clips by track to calculate total shift for subsequent clips on each track
            const trackDeletions = new Map();
            deletingClips.forEach(c => {
                const dur = Math.max(0, (c.trimEnd || c.duration) - (c.trimStart || 0));
                if (!trackDeletions.has(c.trackId)) {
                    trackDeletions.set(c.trackId, []);
                }
                trackDeletions.get(c.trackId).push({ start: c.startOffset, dur });
            });

            // For each remaining clip on an affected track, shift left if its startOffset was after a deleted clip
            remainingClips.forEach(c => {
                const dels = trackDeletions.get(c.trackId);
                if (dels && dels.length > 0) {
                    let totalShift = 0;
                    dels.forEach(d => {
                        if (c.startOffset >= d.start) {
                            totalShift += d.dur;
                        }
                    });
                    c.startOffset = Math.max(0, c.startOffset - totalShift);
                }
            });
        }

        daw.clips = remainingClips;
        daw.selectedClipIds.clear();
        daw.selectedClipId = null;
        recalculateDawDuration();
        renderDawRuler();
        renderDawClips();
        showStudioToast(isRipple ? `Ripple deleted ${count} clip(s) (gaps closed)` : `Deleted ${count} clip(s)`);
    };

    // Master Mixdown Studio Export Dialog & Processing Engine (v1.7.3)
    const openExportMixdownModal = () => {
        stopDawPlayback();
        const modal = document.getElementById('daw-export-mixdown-modal');
        if (!modal) {
            executeMasterMixdownDAW();
            return;
        }

        // Pre-fill summary information
        const totalDur = Math.max(1, daw.duration || 0);
        const hrs = Math.floor(totalDur / 3600).toString().padStart(2, '0');
        const mins = Math.floor((totalDur % 3600) / 60).toString().padStart(2, '0');
        const secs = Math.floor(totalDur % 60).toString().padStart(2, '0');
        const durStr = totalDur > 3600 ? `${hrs}:${mins}:${secs}` : `${mins}:${secs}`;

        const durEl = document.getElementById('daw-export-summary-dur');
        const clipsEl = document.getElementById('daw-export-summary-clips');
        const tracksEl = document.getElementById('daw-export-summary-tracks');
        if (durEl) durEl.textContent = `Duration: ${durStr}`;
        if (clipsEl) clipsEl.textContent = `Clips: ${daw.clips.length}`;
        if (tracksEl) tracksEl.textContent = `Active Tracks: ${Object.keys(daw.tracks || {}).length}`;

        // Reset HUD state
        const formEl = document.getElementById('daw-export-modal-form');
        const hudEl = document.getElementById('daw-export-progress-hud');
        const footerEl = document.getElementById('daw-export-modal-footer');
        if (formEl) formEl.style.display = 'flex';
        if (hudEl) hudEl.style.display = 'none';
        if (footerEl) footerEl.style.display = 'flex';

        modal.style.display = 'flex';
    };

    const closeExportMixdownModal = () => {
        const modal = document.getElementById('daw-export-mixdown-modal');
        if (modal) modal.style.display = 'none';
    };

    const executeMasterMixdownDAW = async () => {
        stopDawPlayback();

        // Collect Export Modal Options
        const nameInput = document.getElementById('daw-export-name-input');
        const formatSelect = document.getElementById('daw-export-format-select');
        const normSelect = document.getElementById('daw-export-norm-select');
        const rangeSelect = document.getElementById('daw-export-range-select');
        const saveTakesCb = document.getElementById('daw-export-save-takes');
        const openPubCb = document.getElementById('daw-export-open-publisher');
        const autoDownCb = document.getElementById('daw-export-auto-download');

        const exportName = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : 'Master Episode Mixdown';
        const sampleRate = (formatSelect && formatSelect.value === 'wav_480') ? 48000 : 44100;
        const enableNorm = !normSelect || normSelect.value === 'on';
        const isPunchRange = rangeSelect && rangeSelect.value === 'punch' && daw.punch && daw.punch.isActive && typeof daw.punch.inTime === 'number' && typeof daw.punch.outTime === 'number';
        const shouldSaveTakes = !saveTakesCb || saveTakesCb.checked;
        const shouldOpenPublisher = !openPubCb || openPubCb.checked;
        const shouldAutoDownload = !autoDownCb || autoDownCb.checked;

        // Switch to progress HUD
        const formEl = document.getElementById('daw-export-modal-form');
        const hudEl = document.getElementById('daw-export-progress-hud');
        const footerEl = document.getElementById('daw-export-modal-footer');
        const pBar = document.getElementById('daw-export-progress-bar');
        const pPct = document.getElementById('daw-export-progress-percent');
        const pTitle = document.getElementById('daw-export-progress-title');
        const pSub = document.getElementById('daw-export-progress-sub');

        if (formEl) formEl.style.display = 'none';
        if (footerEl) footerEl.style.display = 'none';
        if (hudEl) hudEl.style.display = 'flex';
        if (pBar) pBar.style.width = '10%';
        if (pPct) pPct.textContent = '10%';
        if (pTitle) pTitle.textContent = 'Preparing Multi-Track Stems...';
        if (pSub) pSub.textContent = `Allocating 2-channel 32-bit float audio buffer @ ${sampleRate}Hz`;

        const renderBtn = document.getElementById('timeline-render-btn');
        const origHtml = renderBtn ? renderBtn.innerHTML : '';
        if (renderBtn) {
            renderBtn.disabled = true;
            renderBtn.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
                Rendering Mix...
            `;
        }

        try {
            const rangeStart = isPunchRange ? daw.punch.inTime : 0;
            const rangeEnd = isPunchRange ? daw.punch.outTime : Math.max(1, daw.duration);
            const totalDur = Math.max(0.1, rangeEnd - rangeStart);
            const totalSamples = Math.ceil(totalDur * sampleRate);
            const offlineCtx = new OfflineAudioContext(2, totalSamples, sampleRate);

            const hasSolo = Object.values(daw.tracks).some(t => t.solo);

            if (pBar) pBar.style.width = '25%';
            if (pPct) pPct.textContent = '25%';
            if (pTitle) pTitle.textContent = 'Scheduling Automation & DSP Plugins...';
            if (pSub) pSub.textContent = `Applying 10 Web Audio plugins, volume keyframes, and micro-fades`;

            for (const clip of daw.clips) {
                const track = daw.tracks[clip.trackId];
                if (!track) continue;
                if (hasSolo ? (!track.solo || track.muted) : track.muted) continue;

                let clipBuf = clip.buffer;
                if (!clipBuf && clip.blobUrl) {
                    try {
                        const res = await fetch(clip.blobUrl);
                        const ab = await res.arrayBuffer();
                        clipBuf = await offlineCtx.decodeAudioData(ab);
                    } catch (e) {
                        console.warn('[DAW Offline Mix] Decode error for clip:', clip.name, e);
                    }
                }
                if (!clipBuf) continue;

                const effectiveDur = clip.trimEnd - clip.trimStart;
                if (effectiveDur <= 0) continue;

                const clipTimelineStart = clip.startOffset;
                const clipTimelineEnd = clip.startOffset + effectiveDur;

                // Check overlap with render range [rangeStart, rangeEnd]
                if (clipTimelineEnd <= rangeStart || clipTimelineStart >= rangeEnd) continue;

                const overlapStart = Math.max(clipTimelineStart, rangeStart);
                const overlapEnd = Math.min(clipTimelineEnd, rangeEnd);
                const playDur = overlapEnd - overlapStart;
                if (playDur <= 0) continue;

                const offsetIntoClip = overlapStart - clipTimelineStart;
                const bufferReadOffset = clip.trimStart + offsetIntoClip;
                const scheduleTimeInExport = overlapStart - rangeStart;

                const src = offlineCtx.createBufferSource();
                src.buffer = clipBuf;
                const gain = offlineCtx.createGain();

                const clipGain = (typeof clip.gain === 'number' && Number.isFinite(clip.gain)) ? Math.max(0, clip.gain) : 1.0;
                const effectiveTrackVol = track.vol * clipGain;

                if (track.keyframes && track.keyframes.length > 0) {
                    const sorted = [...track.keyframes].sort((a, b) => a.time - b.time);

                    const initVal = evaluateKeyframeAtTime(sorted, overlapStart) * effectiveTrackVol;
                    gain.gain.setValueAtTime(0.0001, scheduleTimeInExport);
                    gain.gain.linearRampToValueAtTime(Math.max(0.0001, initVal), scheduleTimeInExport + rampDur);

                    sorted.forEach(kf => {
                        if (kf.time > overlapStart && kf.time <= overlapEnd) {
                            const kfExportTime = kf.time - rangeStart;
                            gain.gain.linearRampToValueAtTime(Math.max(0.0001, kf.val * effectiveTrackVol), kfExportTime);
                        }
                    });
                } else {
                    const targetVol = Math.max(0.0001, effectiveTrackVol);
                    gain.gain.setValueAtTime(0.0001, scheduleTimeInExport);
                    gain.gain.linearRampToValueAtTime(targetVol, scheduleTimeInExport + rampDur);
                    if (playDur > rampDur * 2) {
                        gain.gain.setValueAtTime(targetVol, scheduleTimeInExport + playDur - rampDur);
                        gain.gain.linearRampToValueAtTime(0.0001, scheduleTimeInExport + playDur);
                    }
                }

                // Apply Clip-Specific Fade In / Out Curves
                const cFadeIn = clip.fadeIn || 0;
                const cFadeOut = clip.fadeOut || 0;
                if (cFadeIn > 0.02 && overlapStart === clipTimelineStart) {
                    const fInEnd = Math.min(scheduleTimeInExport + playDur, scheduleTimeInExport + cFadeIn);
                    gain.gain.setValueAtTime(0.0001, scheduleTimeInExport);
                    gain.gain.linearRampToValueAtTime(Math.max(0.0001, track.vol), fInEnd);
                }
                if (cFadeOut > 0.02 && overlapEnd === clipTimelineEnd) {
                    const fOutStart = Math.max(scheduleTimeInExport, scheduleTimeInExport + playDur - cFadeOut);
                    gain.gain.setValueAtTime(Math.max(0.0001, track.vol), fOutStart);
                    gain.gain.linearRampToValueAtTime(0.0001, scheduleTimeInExport + playDur);
                }

                // Connect Offline DSP Effects Chain
                const fxChain = buildTrackPluginChain(offlineCtx, track);
                src.connect(gain);
                if (fxChain && fxChain.input && fxChain.output) {
                    gain.connect(fxChain.input);
                    fxChain.output.connect(offlineCtx.destination);
                } else {
                    gain.connect(offlineCtx.destination);
                }
                src.start(scheduleTimeInExport, bufferReadOffset, playDur);
            }

            if (pBar) pBar.style.width = '60%';
            if (pPct) pPct.textContent = '60%';
            if (pTitle) pTitle.textContent = 'Rendering Audio Graph...';
            if (pSub) pSub.textContent = `Synthesizing ${Math.round(totalDur)}s multi-track mixdown`;

            const renderedBuf = await offlineCtx.startRendering();

            if (pBar) pBar.style.width = '85%';
            if (pPct) pPct.textContent = '85%';
            if (pTitle) pTitle.textContent = 'Master Normalization & True-Peak Limiter...';
            if (pSub) pSub.textContent = enableNorm ? 'Limiting peaks to broadcast safe -0.5 dBFS ceiling' : 'Passing through un-normalized audio';

            // Lookahead True-Peak Limiter & Broadcast Normalization (-0.5 dBFS ceiling)
            const numChannels = renderedBuf.numberOfChannels;
            const masterScale = (daw._masterVol !== undefined) ? daw._masterVol : 1.0;
            let maxPeak = 0;
            for (let c = 0; c < numChannels; c++) {
                const chData = renderedBuf.getChannelData(c);
                for (let i = 0; i < chData.length; i++) {
                    const absVal = Math.abs(chData[i]);
                    if (absVal > maxPeak) maxPeak = absVal;
                }
            }

            // Target broadcast ceiling: -0.5 dBFS (approx 0.944 linear amplitude)
            const TARGET_CEILING = 0.944;
            let normGain = masterScale;
            if (enableNorm && maxPeak * masterScale > TARGET_CEILING) {
                normGain = TARGET_CEILING / maxPeak;
            }

            if (Math.abs(normGain - 1.0) > 0.001) {
                for (let c = 0; c < numChannels; c++) {
                    const chData = renderedBuf.getChannelData(c);
                    for (let i = 0; i < chData.length; i++) {
                        chData[i] = Math.max(-1.0, Math.min(1.0, chData[i] * normGain));
                    }
                }
            }

            if (pBar) pBar.style.width = '95%';
            if (pPct) pPct.textContent = '95%';
            if (pTitle) pTitle.textContent = 'Encoding 16-Bit PCM WAV...';
            if (pSub) pSub.textContent = `Packaging master uncompressed audio stream`;

            const wavBlob = audioBufferToWav(renderedBuf);
            const wavUrl = URL.createObjectURL(wavBlob);

            const hrs = Math.floor(totalDur / 3600).toString().padStart(2, '0');
            const mins = Math.floor((totalDur % 3600) / 60).toString().padStart(2, '0');
            const secs = Math.floor(totalDur % 60).toString().padStart(2, '0');
            const durStr = totalDur > 3600 ? `${hrs}:${mins}:${secs}` : `${mins}:${secs}`;

            const masterTake = {
                id: `take-master-daw-${Date.now()}`,
                stemType: 'master_mix',
                name: exportName,
                duration: durStr,
                durationSeconds: Math.round(totalDur),
                blobUrl: wavUrl,
                wavBlob,
                micName: `Timeline Studio Mix (${daw.clips.length} Clips @ ${sampleRate}Hz${isPunchRange ? ' [Punch Region]' : ''})`
            };

            if (shouldSaveTakes) {
                window._podcastTakeInventory = window._podcastTakeInventory || [];
                window._podcastTakeInventory.unshift(masterTake);
                renderTakeInventory();
            }

            if (shouldOpenPublisher) {
                const audioInput = document.getElementById('up-audio-url');
                const durInput = document.getElementById('up-duration');
                const titleInput = document.getElementById('up-title');
                if (audioInput) {
                    audioInput.value = wavUrl;
                    audioInput.dispatchEvent(new Event('input'));
                }
                if (durInput) durInput.value = Math.round(totalDur);
                if (titleInput && (!titleInput.value || titleInput.value === 'Untitled Episode')) {
                    titleInput.value = exportName;
                }
            }

            // Auto-Download WAV file if requested
            if (shouldAutoDownload) {
                const safeFile = exportName.toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_');
                const a = document.createElement('a');
                a.style.cssText = 'position: fixed; left: -9999px; top: -9999px; opacity: 0; pointer-events: none;';
                a.href = wavUrl;
                a.download = `${safeFile}_${sampleRate === 48000 ? '48k' : '44k'}.wav`;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    try { document.body.removeChild(a); } catch (e) {}
                }, 4000);
            }

            if (pBar) pBar.style.width = '100%';
            if (pPct) pPct.textContent = '100%';
            if (pTitle) pTitle.textContent = 'Mixdown Complete!';
            if (pSub) pSub.textContent = `Master uncompressed WAV generated successfully`;

            closeExportMixdownModal();

            showStudioToast(`Master Mix "${exportName}" exported successfully!`);

            if (shouldOpenPublisher) {
                document.getElementById('podcast-editor-modal').style.display = 'none';
                if (typeof stopDawMicMonitor === 'function') stopDawMicMonitor();
                const uploadModal = document.getElementById('podcast-upload-modal');
                if (uploadModal) {
                    uploadModal.style.display = 'flex';
                    renderPublisherQuickTakes();
                }
            }
        } catch (err) {
            console.error('Master DAW render error:', err);
            closeExportMixdownModal();
            await showStudioAlert('Master Mix Render Failed', 'Master mix render failed: ' + err.message);
        } finally {
            if (renderBtn) {
                renderBtn.disabled = false;
                renderBtn.innerHTML = origHtml;
            }
        }
    };

    // Multi-Track Isolated Stems Archive ZIP Exporter (v1.7.4)
    const exportAllStemsZipDAW = async () => {
        stopDawPlayback();
        const activeTracks = Object.values(daw.tracks || {}).filter(t => !t.muted);
        if (activeTracks.length === 0) {
            await showStudioAlert('No Active Tracks', 'All tracks are currently muted or no tracks exist to export.');
            return;
        }

        const nameInput = document.getElementById('daw-export-name-input');
        const formatSelect = document.getElementById('daw-export-format-select');
        const normSelect = document.getElementById('daw-export-norm-select');
        const rangeSelect = document.getElementById('daw-export-range-select');

        const baseName = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : 'Studio_Session_Stems';
        const sampleRate = (formatSelect && formatSelect.value === 'wav_480') ? 48000 : 44100;
        const enableNorm = !normSelect || normSelect.value === 'on';
        const isPunchRange = rangeSelect && rangeSelect.value === 'punch' && daw.punch && daw.punch.isActive && typeof daw.punch.inTime === 'number' && typeof daw.punch.outTime === 'number';

        const rangeStart = isPunchRange ? daw.punch.inTime : 0;
        const rangeEnd = isPunchRange ? daw.punch.outTime : Math.max(1, daw.duration);
        const totalDur = Math.max(0.1, rangeEnd - rangeStart);
        const totalSamples = Math.ceil(totalDur * sampleRate);

        // Show Progress HUD in Export Modal
        openExportMixdownModal();
        const formEl = document.getElementById('daw-export-modal-form');
        const hudEl = document.getElementById('daw-export-progress-hud');
        const footerEl = document.getElementById('daw-export-modal-footer');
        const pBar = document.getElementById('daw-export-progress-bar');
        const pPct = document.getElementById('daw-export-progress-percent');
        const pTitle = document.getElementById('daw-export-progress-title');
        const pSub = document.getElementById('daw-export-progress-sub');

        if (formEl) formEl.style.display = 'none';
        if (footerEl) footerEl.style.display = 'none';
        if (hudEl) hudEl.style.display = 'flex';

        try {
            const files = [];
            const trackEntries = Object.entries(daw.tracks || {});

            for (let tIdx = 0; tIdx < trackEntries.length; tIdx++) {
                const [trackId, track] = trackEntries[tIdx];
                if (track.muted) continue;

                const trackClips = daw.clips.filter(c => c.trackId === trackId);
                const stepPct = Math.round(15 + (tIdx / trackEntries.length) * 70);
                if (pBar) pBar.style.width = `${stepPct}%`;
                if (pPct) pPct.textContent = `${stepPct}%`;
                if (pTitle) pTitle.textContent = `Bouncing Stem: ${track.name}...`;
                if (pSub) pSub.textContent = `Rendering track ${tIdx + 1} of ${trackEntries.length} through DSP audio chain`;

                const stemCtx = new OfflineAudioContext(2, totalSamples, sampleRate);

                for (const clip of trackClips) {
                    let clipBuf = clip.buffer;
                    if (!clipBuf && clip.blobUrl) {
                        try {
                            const res = await fetch(clip.blobUrl);
                            const ab = await res.arrayBuffer();
                            clipBuf = await stemCtx.decodeAudioData(ab);
                        } catch (e) {
                            console.warn('[Stem Export] Decode error for clip:', clip.name, e);
                        }
                    }
                    if (!clipBuf) continue;

                    const effectiveDur = clip.trimEnd - clip.trimStart;
                    if (effectiveDur <= 0) continue;

                    const clipTimelineStart = clip.startOffset;
                    const clipTimelineEnd = clip.startOffset + effectiveDur;

                    if (clipTimelineEnd <= rangeStart || clipTimelineStart >= rangeEnd) continue;

                    const overlapStart = Math.max(clipTimelineStart, rangeStart);
                    const overlapEnd = Math.min(clipTimelineEnd, rangeEnd);
                    const playDur = overlapEnd - overlapStart;
                    if (playDur <= 0) continue;

                    const offsetIntoClip = overlapStart - clipTimelineStart;
                    const bufferReadOffset = clip.trimStart + offsetIntoClip;
                    const scheduleTimeInExport = overlapStart - rangeStart;

                    const src = stemCtx.createBufferSource();
                    src.buffer = clipBuf;
                    const gain = stemCtx.createGain();

                    const rampDur = Math.min(0.015, playDur / 4);
                    const clipGain = (typeof clip.gain === 'number' && Number.isFinite(clip.gain)) ? Math.max(0, clip.gain) : 1.0;
                    const effectiveTrackVol = track.vol * clipGain;

                    if (track.keyframes && track.keyframes.length > 0) {
                        const sorted = [...track.keyframes].sort((a, b) => a.time - b.time);
                        const initVal = evaluateKeyframeAtTime(sorted, overlapStart) * effectiveTrackVol;
                        gain.gain.setValueAtTime(0.0001, scheduleTimeInExport);
                        gain.gain.linearRampToValueAtTime(Math.max(0.0001, initVal), scheduleTimeInExport + rampDur);

                        sorted.forEach(kf => {
                            if (kf.time > overlapStart && kf.time <= overlapEnd) {
                                const kfExportTime = kf.time - rangeStart;
                                gain.gain.linearRampToValueAtTime(Math.max(0.0001, kf.val * effectiveTrackVol), kfExportTime);
                            }
                        });
                    } else {
                        const targetVol = Math.max(0.0001, effectiveTrackVol);
                        gain.gain.setValueAtTime(0.0001, scheduleTimeInExport);
                        gain.gain.linearRampToValueAtTime(targetVol, scheduleTimeInExport + rampDur);
                        if (playDur > rampDur * 2) {
                            gain.gain.setValueAtTime(targetVol, scheduleTimeInExport + playDur - rampDur);
                            gain.gain.linearRampToValueAtTime(0.0001, scheduleTimeInExport + playDur);
                        }
                    }

                    // Apply Clip-Specific Fade In / Out Curves
                    const cFadeIn = clip.fadeIn || 0;
                    const cFadeOut = clip.fadeOut || 0;
                    if (cFadeIn > 0.02 && overlapStart === clipTimelineStart) {
                        const fInEnd = Math.min(scheduleTimeInExport + playDur, scheduleTimeInExport + cFadeIn);
                        gain.gain.setValueAtTime(0.0001, scheduleTimeInExport);
                        gain.gain.linearRampToValueAtTime(Math.max(0.0001, effectiveTrackVol), fInEnd);
                    }
                    if (cFadeOut > 0.02 && overlapEnd === clipTimelineEnd) {
                        const fOutStart = Math.max(scheduleTimeInExport, scheduleTimeInExport + playDur - cFadeOut);
                        gain.gain.setValueAtTime(Math.max(0.0001, track.vol), fOutStart);
                        gain.gain.linearRampToValueAtTime(0.0001, scheduleTimeInExport + playDur);
                    }

                    // Connect Isolated DSP Chain for Track
                    const fxChain = buildTrackPluginChain(stemCtx, track);
                    src.connect(gain);
                    if (fxChain && fxChain.input && fxChain.output) {
                        gain.connect(fxChain.input);
                        fxChain.output.connect(stemCtx.destination);
                    } else {
                        gain.connect(stemCtx.destination);
                    }
                    src.start(scheduleTimeInExport, bufferReadOffset, playDur);
                }

                const renderedStemBuf = await stemCtx.startRendering();

                // Broadcast Ceiling Normalization on Isolated Stem
                if (enableNorm) {
                    let stemPeak = 0;
                    for (let c = 0; c < renderedStemBuf.numberOfChannels; c++) {
                        const chData = renderedStemBuf.getChannelData(c);
                        for (let i = 0; i < chData.length; i++) {
                            const absVal = Math.abs(chData[i]);
                            if (absVal > stemPeak) stemPeak = absVal;
                        }
                    }
                    const TARGET_CEILING = 0.944;
                    if (stemPeak > TARGET_CEILING) {
                        const normGain = TARGET_CEILING / stemPeak;
                        for (let c = 0; c < renderedStemBuf.numberOfChannels; c++) {
                            const chData = renderedStemBuf.getChannelData(c);
                            for (let i = 0; i < chData.length; i++) {
                                chData[i] = Math.max(-1.0, Math.min(1.0, chData[i] * normGain));
                            }
                        }
                    }
                }

                const stemWavBlob = audioBufferToWav(renderedStemBuf);
                const stemArrayBuf = await stemWavBlob.arrayBuffer();
                const safeTrackName = (track.name || `Track_${tIdx + 1}`).replace(/[^a-zA-Z0-9_\-]/g, '_').replace(/_+/g, '_');
                const fileName = `${String(tIdx + 1).padStart(2, '0')}_${safeTrackName}.wav`;
                files.push({ name: fileName, data: stemArrayBuf });
            }

            if (pBar) pBar.style.width = '90%';
            if (pPct) pPct.textContent = '90%';
            if (pTitle) pTitle.textContent = 'Packaging Stems into ZIP Archive...';
            if (pSub) pSub.textContent = `Compressing ${files.length} studio WAV tracks into ZIP container`;

            const zipBlob = createZipBlob(files);
            const zipUrl = URL.createObjectURL(zipBlob);

            const safeSessionName = baseName.toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_');
            const a = document.createElement('a');
            a.style.cssText = 'position: fixed; left: -9999px; top: -9999px; opacity: 0; pointer-events: none;';
            a.href = zipUrl;
            a.download = `${safeSessionName}_stems_${sampleRate === 48000 ? '48k' : '44k'}.zip`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                try { document.body.removeChild(a); } catch (e) {}
                URL.revokeObjectURL(zipUrl);
            }, 60000);

            if (pBar) pBar.style.width = '100%';
            if (pPct) pPct.textContent = '100%';
            if (pTitle) pTitle.textContent = 'Stems Archive Complete!';
            if (pSub) pSub.textContent = `Downloaded ${files.length} isolated tracks in .ZIP`;

            closeExportMixdownModal();
            showStudioToast(`Exported ${files.length} Stems as ZIP successfully!`);
        } catch (stemErr) {
            console.error('Stem ZIP Export error:', stemErr);
            closeExportMixdownModal();
            await showStudioAlert('Stem Export Failed', 'Stems export failed: ' + stemErr.message);
        }
    };

    const renderMasterMixDAW = () => {
        openExportMixdownModal();
    };

    // Fullscreen DAW Window Mode Toggle (Edge-to-Edge Workspace)
    const toggleDawFullscreen = (forceFullscreen) => {
        const modal = document.getElementById('podcast-editor-modal');
        if (modal) {
            if (typeof forceFullscreen === 'boolean') {
                if (forceFullscreen) modal.classList.add('daw-fullscreen');
                else modal.classList.remove('daw-fullscreen');
            } else {
                modal.classList.toggle('daw-fullscreen');
            }
            const isFs = modal.classList.contains('daw-fullscreen');
            const btn = document.getElementById('daw-fullscreen-btn');
            const icon = document.getElementById('daw-fullscreen-icon');
            if (btn) {
                btn.title = isFs ? 'Exit Fullscreen (F11 / Esc)' : 'Toggle Fullscreen DAW Studio (F11)';
                btn.style.background = isFs ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.08)';
                btn.style.borderColor = isFs ? '#38bdf8' : 'rgba(255, 255, 255, 0.16)';
                btn.style.color = isFs ? '#38bdf8' : '#ffffff';
            }
            if (icon) {
                icon.innerHTML = isFs 
                    ? '<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>'
                    : '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>';
            }
        }
    };

    // Open Timeline DAW Editor
    window._openTimelineEditor = async (initialItem) => {
        stopDawPlayback(true);
        daw.selectedClipId = null;
        daw.clips = [];

        // Ensure default tracks exist
        Object.keys(defaultDawTracks).forEach(k => {
            if (!daw.tracks[k]) {
                daw.tracks[k] = JSON.parse(JSON.stringify(defaultDawTracks[k]));
            }
        });

        const isFresh = initialItem?.isFresh === true;

        const targetTitleEl = document.getElementById('timeline-target-title');
        if (targetTitleEl) {
            targetTitleEl.textContent = isFresh ? 'New Recording Session' : (initialItem?.title || initialItem?.name || 'Studio Multi-Track Master');
        }

        if (isFresh) {
            // Fresh DAW mode: Clean, blank timeline ready for immediate hardware recording
            daw.playhead = 0;
            daw.duration = 60;
            daw._recordTrackId = 'host';
            recalculateDawDuration();
            renderDawTracks();
            renderDawRuler();
            renderDawClips();
            updateDawPlayhead();
            updateUndoRedoButtons();
            await initDawMicSetup();

            const modal = document.getElementById('podcast-editor-modal');
            if (modal) {
                modal.style.display = 'flex';
                toggleDawFullscreen(true);
            }
            return;
        }

        // 1. Host Take
        const takes = window._podcastTakeInventory || [];
        const hostTake = (initialItem && (initialItem.stemType === 'host' || !initialItem.stemType)) ? initialItem : takes.find(t => t.stemType === 'host' || (!t.stemType && !t.id.startsWith('take-guest') && !t.id.startsWith('take-master-mix')));
        
        let introDuration = 0;
        // 2. Intro Bumper
        if (customTopBuffer) {
            introDuration = customTopBuffer.duration;
            daw.clips.push({
                id: 'clip-top-intro',
                trackId: 'top',
                name: 'Intro Bumper (Custom)',
                tag: 'Intro Bumper',
                startOffset: 0,
                trimStart: 0,
                trimEnd: customTopBuffer.duration,
                duration: customTopBuffer.duration,
                buffer: customTopBuffer,
                peaks: customTopBuffer.peaks || extractWaveformPeaks(customTopBuffer, 400),
                color: '#f59e0b'
            });
        }

        const hostDur = hostTake?.durationSeconds || (initialItem?.durationSeconds || 45);
        if (hostTake || initialItem) {
            const hItem = hostTake || initialItem;
            daw.clips.push({
                id: 'clip-host-main',
                trackId: 'host',
                name: hItem.name || hItem.title || 'Host Presenter Vocal',
                tag: 'Vocal',
                startOffset: introDuration,
                trimStart: 0,
                trimEnd: hostDur,
                duration: hostDur,
                blob: hItem.blob || null,
                blobUrl: hItem.blobUrl || hItem.audio_url,
                buffer: hItem.buffer || null,
                peaks: hItem.peaks || (hItem.buffer ? extractWaveformPeaks(hItem.buffer, 400) : null),
                color: '#10b981'
            });
        }

        // 3. Guest Takes
        const guestTakes = takes.filter(t => t.stemType === 'guest' || t.id.startsWith('take-guest'));
        guestTakes.forEach((gt, idx) => {
            const gDur = gt.durationSeconds || hostDur;
            daw.clips.push({
                id: `clip-guest-${gt.id || idx}`,
                trackId: 'guest',
                name: gt.name || `Co-Host Stem ${idx + 1}`,
                tag: 'Interview',
                startOffset: introDuration,
                trimStart: 0,
                trimEnd: gDur,
                duration: gDur,
                blob: gt.blob || null,
                blobUrl: gt.blobUrl,
                buffer: gt.buffer || null,
                peaks: gt.peaks || (gt.buffer ? extractWaveformPeaks(gt.buffer, 400) : null),
                color: '#06b6d4'
            });
        });

        // 4. Outro Bumper
        if (customTailBuffer) {
            const outroStart = introDuration + hostDur;
            daw.clips.push({
                id: 'clip-tail-outro',
                trackId: 'tail',
                name: 'Outro Bumper (Custom)',
                tag: 'Outro Bumper',
                startOffset: outroStart,
                trimStart: 0,
                trimEnd: customTailBuffer.duration,
                duration: customTailBuffer.duration,
                buffer: customTailBuffer,
                peaks: customTailBuffer.peaks || extractWaveformPeaks(customTailBuffer, 400),
                color: '#f43f5e'
            });
        }

        // Calculate timeline duration safely
        recalculateDawDuration();

        // Pre-decode audio buffers asynchronously for real-time playback and real waveform rendering
        const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
        daw.clips.forEach(async (c) => {
            if (!c.buffer && (c.blob || c.blobUrl)) {
                try {
                    let ab;
                    if (c.blob instanceof Blob) {
                        ab = await c.blob.arrayBuffer();
                    } else if (c.blobUrl) {
                        const res = await fetch(c.blobUrl);
                        if (res.ok) ab = await res.arrayBuffer();
                    }
                    if (ab && ab.byteLength > 0) {
                        c.buffer = await tempCtx.decodeAudioData(ab.slice(0));
                        c.peaks = extractWaveformPeaks(c.buffer, 400);
                        renderDawClips();
                    }
                } catch (e) {
                    console.warn('[DAW Pre-decode] Error loading clip buffer:', c.name, e);
                }
            } else if (c.buffer && (!c.peaks || c.peaks.length === 0)) {
                c.peaks = extractWaveformPeaks(c.buffer, 400);
                renderDawClips();
            }
        });

        renderDawTracks();
        renderDawRuler();
        renderDawClips();
        updateDawPlayhead();
        updateUndoRedoButtons();
        initDawMicSetup();

        const modal = document.getElementById('podcast-editor-modal');
        if (modal) {
            modal.style.display = 'flex';
            toggleDawFullscreen(true);
            try {
                const savedTheme = localStorage.getItem('localfilm_studio_theme') || 'obsidian';
                modal.setAttribute('data-theme', savedTheme);
                const obsCheck = document.getElementById('daw-theme-obsidian-check');
                const monoCheck = document.getElementById('daw-theme-monochrome-check');
                const matCheck = document.getElementById('daw-theme-matrix-check');
                if (obsCheck) obsCheck.style.display = savedTheme === 'obsidian' ? 'inline' : 'none';
                if (monoCheck) monoCheck.style.display = savedTheme === 'monochrome' ? 'inline' : 'none';
                if (matCheck) matCheck.style.display = savedTheme === 'matrix' ? 'inline' : 'none';
            } catch (e) {}
        }
    };

    const stopDawMicMonitor = async () => {
        if (daw._micMonitorStream) {
            try { daw._micMonitorStream.getTracks().forEach(t => t.stop()); } catch (e) {}
            daw._micMonitorStream = null;
        }
        if (daw._micMonitorCtx) {
            try { await daw._micMonitorCtx.close(); } catch (e) {}
            daw._micMonitorCtx = null;
        }
        daw._micMonitorAnalyser = null;
        const bar = document.getElementById('daw-rec-mic-level-bar');
        if (bar) bar.style.width = '0%';
    };

    // Bind Timeline DAW Buttons
    document.getElementById('timeline-open-studio-btn')?.addEventListener('click', async () => {
        if (daw.isRecording) stopDawRecording();
        stopDawPlayback(false);
        const recModal = document.getElementById('podcast-recorder-modal');
        if (recModal) {
            recModal.style.display = 'flex';
            await enumerateHostMics(preferredHostMicId);
            await initHostStream(preferredHostMicId);
            renderTakeInventory();
        }
    });

    document.getElementById('timeline-fresh-session-btn')?.addEventListener('click', async () => {
        const ok = await showStudioConfirm(
            'Start Fresh Session',
            'Start a fresh recording project? This will reset the timeline canvas for clean vocal capture.',
            { confirmText: 'Reset & Start Fresh', danger: false }
        );
        if (ok) {
            window._openTimelineEditor({ isFresh: true });
        }
    });

    document.getElementById('podcast-editor-close-btn')?.addEventListener('click', () => {
        if (daw.isRecording) stopDawRecording();
        stopDawPlayback(true);
        stopDawMicMonitor();
        document.getElementById('podcast-editor-modal').style.display = 'none';
    });

    document.getElementById('timeline-play-btn')?.addEventListener('click', toggleDawPlay);
    document.getElementById('timeline-record-btn')?.addEventListener('click', toggleDawRecording);
    document.getElementById('timeline-stop-btn')?.addEventListener('click', () => {
        if (daw.isRecording) stopDawRecording();
        stopDawPlayback(true);
    });
    document.getElementById('timeline-rewind-btn')?.addEventListener('click', () => {
        if (daw.isRecording) stopDawRecording();
        const wasPlaying = daw.isPlaying;
        stopDawPlayback(true);
        if (wasPlaying) startDawPlayback();
    });
    document.getElementById('timeline-loop-btn')?.addEventListener('click', () => {
        daw.isLooping = !daw.isLooping;
        const btn = document.getElementById('timeline-loop-btn');
        if (btn) {
            if (daw.isLooping) {
                btn.style.background = 'rgba(56, 189, 248, 0.2)';
                btn.style.borderColor = '#38bdf8';
                btn.style.color = '#38bdf8';
                btn.style.boxShadow = '0 0 10px rgba(56, 189, 248, 0.4)';
            } else {
                btn.style.background = 'rgba(255,255,255,0.08)';
                btn.style.borderColor = 'rgba(255,255,255,0.15)';
                btn.style.color = '#ffffff';
                btn.style.boxShadow = 'none';
            }
        }
    });
    document.getElementById('timeline-undo-btn')?.addEventListener('click', undoDawAction);
    document.getElementById('timeline-redo-btn')?.addEventListener('click', redoDawAction);
    document.getElementById('timeline-cut-btn')?.addEventListener('click', splitSelectedClip);
    document.getElementById('timeline-edit-btn')?.addEventListener('click', () => openClipPropertiesModal());
    document.getElementById('timeline-delete-btn')?.addEventListener('click', deleteSelectedClip);
    document.getElementById('timeline-render-btn')?.addEventListener('click', renderMasterMixDAW);
    document.getElementById('daw-export-modal-close-btn')?.addEventListener('click', closeExportMixdownModal);
    document.getElementById('daw-export-cancel-btn')?.addEventListener('click', closeExportMixdownModal);
    document.getElementById('daw-export-confirm-btn')?.addEventListener('click', executeMasterMixdownDAW);
    document.getElementById('daw-export-stems-btn')?.addEventListener('click', exportAllStemsZipDAW);

    // Punch Region Controls
    document.getElementById('timeline-punch-in-btn')?.addEventListener('click', () => {
        const inT = Math.max(0, Math.round(daw.playhead * 100) / 100);
        let outT = (daw.punch && typeof daw.punch.outTime === 'number') ? daw.punch.outTime : Math.min(daw.duration, inT + 10);
        if (outT <= inT + 0.2) outT = Math.min(daw.duration, inT + 5);

        daw.punch = {
            isActive: true,
            inTime: inT,
            outTime: outT
        };
        pushDawHistory('Set Punch-In');
        renderDawRuler();
        updateDawPunchOverlay();
        showStudioToast(`Punch-In set at ${formatDawTime(inT)}`);
    });

    document.getElementById('timeline-punch-out-btn')?.addEventListener('click', () => {
        const outT = Math.max(0.2, Math.round(daw.playhead * 100) / 100);
        let inT = (daw.punch && typeof daw.punch.inTime === 'number') ? daw.punch.inTime : 0;
        if (inT >= outT - 0.2) inT = Math.max(0, outT - 5);

        daw.punch = {
            isActive: true,
            inTime: inT,
            outTime: outT
        };
        pushDawHistory('Set Punch-Out');
        renderDawRuler();
        updateDawPunchOverlay();
        showStudioToast(`Punch-Out set at ${formatDawTime(outT)}`);
    });

    document.getElementById('timeline-punch-clear-btn')?.addEventListener('click', () => {
        if (!daw.punch || !daw.punch.isActive) return;
        daw.punch = { isActive: false, inTime: null, outTime: null };
        pushDawHistory('Clear Punch Region');
        renderDawRuler();
        updateDawPunchOverlay();
        showStudioToast('Punch region cleared');
    });
    document.getElementById('daw-record-track-select')?.addEventListener('change', (e) => {
        daw._recordTrackId = e.target.value;
        renderDawTracks();
    });

    document.getElementById('daw-master-vol-slider')?.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        daw._masterVol = v;
        if (daw.masterGain) {
            daw.masterGain.gain.value = v;
        }
        const readout = document.getElementById('daw-master-vol-readout');
        if (readout) readout.textContent = `${Math.round(v * 100)}%`;
    });

    document.getElementById('timeline-zoom-in-btn')?.addEventListener('click', () => {
        daw.zoom = Math.min(60, daw.zoom + 5);
        const badge = document.getElementById('timeline-zoom-badge');
        if (badge) badge.textContent = `${Math.round(daw.zoom / 15 * 100)}%`;
        renderDawTracks();
        renderDawRuler();
        renderDawClips();
        updateDawPlayhead();
    });

    document.getElementById('timeline-zoom-out-btn')?.addEventListener('click', () => {
        daw.zoom = Math.max(5, daw.zoom - 5);
        const badge = document.getElementById('timeline-zoom-badge');
        if (badge) badge.textContent = `${Math.round(daw.zoom / 15 * 100)}%`;
        renderDawTracks();
        renderDawRuler();
        renderDawClips();
        updateDawPlayhead();
    });

    // Audible Scrubbing Toggle
    document.getElementById('timeline-scrub-toggle-btn')?.addEventListener('click', () => {
        daw.isAudioScrubbingEnabled = !daw.isAudioScrubbingEnabled;
        const lbl = document.getElementById('timeline-scrub-label');
        const btn = document.getElementById('timeline-scrub-toggle-btn');
        if (lbl) {
            lbl.textContent = daw.isAudioScrubbingEnabled ? 'Scrub: ON' : 'Scrub: OFF';
        }
        if (btn) {
            if (daw.isAudioScrubbingEnabled) {
                btn.style.background = 'rgba(16, 185, 129, 0.15)';
                btn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                btn.style.color = '#34d399';
            } else {
                btn.style.background = 'rgba(255,255,255,0.06)';
                btn.style.borderColor = 'rgba(255,255,255,0.18)';
                btn.style.color = 'rgba(255,255,255,0.6)';
            }
        }
    });

    // Magnetic Snapping Toggle (All, 1 Bar, 1/2 Beat, 1/4 Beat, 1/8 Beat, Clips Only, Off)
    document.getElementById('timeline-snap-btn')?.addEventListener('click', () => {
        const modes = ['all', 'bar', '1/2', '1/4', '1/8', 'clips', 'off'];
        const curIdx = modes.indexOf(daw.snapMode || 'all');
        daw.snapMode = modes[(curIdx + 1) % modes.length];

        const lbl = document.getElementById('timeline-snap-label');
        if (lbl) {
            const labelMap = {
                all: 'Snap: All',
                bar: 'Snap: 1 Bar',
                '1/2': 'Snap: 1/2 Beat',
                '1/4': 'Snap: 1/4 Beat',
                '1/8': 'Snap: 1/8 Beat',
                clips: 'Snap: Clips',
                off: 'Snap: Off'
            };
            lbl.textContent = labelMap[daw.snapMode] || 'Snap: All';
        }

        const btn = document.getElementById('timeline-snap-btn');
        if (btn) {
            if (daw.snapMode === 'off') {
                btn.style.background = 'rgba(255,255,255,0.06)';
                btn.style.borderColor = 'rgba(255,255,255,0.18)';
                btn.style.color = 'rgba(255,255,255,0.6)';
            } else {
                btn.style.background = 'rgba(56, 189, 248, 0.15)';
                btn.style.borderColor = 'rgba(56, 189, 248, 0.35)';
                btn.style.color = '#38bdf8';
            }
        }
    });

    // Ripple Edit Mode Toggle Button
    document.getElementById('timeline-ripple-toggle-btn')?.addEventListener('click', () => {
        daw.isRippleEnabled = !daw.isRippleEnabled;
        const lbl = document.getElementById('timeline-ripple-label');
        const btn = document.getElementById('timeline-ripple-toggle-btn');
        if (lbl) {
            lbl.textContent = daw.isRippleEnabled ? 'Ripple: ON' : 'Ripple: OFF';
        }
        if (btn) {
            if (daw.isRippleEnabled) {
                btn.style.background = 'rgba(244, 63, 94, 0.18)';
                btn.style.borderColor = 'rgba(244, 63, 94, 0.45)';
                btn.style.color = '#fb7185';
            } else {
                btn.style.background = 'rgba(255, 255, 255, 0.06)';
                btn.style.borderColor = 'rgba(255, 255, 255, 0.16)';
                btn.style.color = 'rgba(255, 255, 255, 0.75)';
            }
        }
        showStudioToast(daw.isRippleEnabled ? '🌊 Ripple Edit Mode: ON (Gaps close automatically)' : 'Ripple Edit Mode: OFF');
    });

    // Track Height Expander
    document.getElementById('timeline-track-height-btn')?.addEventListener('click', () => {
        const heights = [74, 110, 160, 56];
        const curIdx = heights.indexOf(daw.laneHeight || 74);
        daw.laneHeight = heights[(curIdx + 1) % heights.length];

        const lbl = document.getElementById('timeline-track-height-label');
        if (lbl) lbl.textContent = `${daw.laneHeight}px`;

        renderDawTracks();
        renderDawClips();
    });

    // Musical BPM Tempo Input
    document.getElementById('daw-bpm-input')?.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val >= 20 && val <= 300) {
            daw.bpm = val;
            showStudioToast(`Tempo set to ${val} BPM (${(60 / val).toFixed(3)}s per beat)`);
        } else {
            e.target.value = daw.bpm || 120;
        }
    });

    // Audible Metronome Click Track Toggle Button
    const toggleMetronomeDAW = () => {
        daw.isMetronomeEnabled = !daw.isMetronomeEnabled;
        const btn = document.getElementById('timeline-metronome-btn');
        const lbl = document.getElementById('timeline-metronome-label');
        if (lbl) {
            lbl.textContent = daw.isMetronomeEnabled ? 'CLICK: ON' : 'CLICK: OFF';
        }
        if (btn) {
            if (daw.isMetronomeEnabled) {
                btn.style.background = 'rgba(16, 185, 129, 0.2)';
                btn.style.borderColor = '#10b981';
                btn.style.color = '#34d399';
                btn.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.35)';
            } else {
                btn.style.background = 'rgba(255, 255, 255, 0.06)';
                btn.style.borderColor = 'rgba(255, 255, 255, 0.16)';
                btn.style.color = 'rgba(255, 255, 255, 0.7)';
                btn.style.boxShadow = 'none';
            }
        }
        showStudioToast(daw.isMetronomeEnabled ? `🔔 Metronome Click Track ON (${daw.bpm || 120} BPM)` : 'Metronome Click Track OFF');
    };
    document.getElementById('timeline-metronome-btn')?.addEventListener('click', toggleMetronomeDAW);

    // ── Film Sound Design, Video Sync & ADR Post-Production Suite Engine ──────
    // Timecode Format Switcher Button (SMPTE HH:MM:SS:FF vs Standard MM:SS.ms)
    document.getElementById('daw-timecode-mode-btn')?.addEventListener('click', () => {
        daw.timecodeMode = daw.timecodeMode === 'smpte' ? 'time' : 'smpte';
        const btn = document.getElementById('daw-timecode-mode-btn');
        if (btn) {
            btn.textContent = daw.timecodeMode === 'smpte' ? 'SMPTE' : 'TIME';
            btn.style.color = daw.timecodeMode === 'smpte' ? '#38bdf8' : '#34d399';
            btn.style.borderColor = daw.timecodeMode === 'smpte' ? 'rgba(56, 189, 248, 0.4)' : 'rgba(52, 211, 153, 0.4)';
        }
        updateDawPlayhead();
    });

    // Cinema Frame Rate Selector (SMPTE Sync: 24, 23.976, 25, 29.97, 30 fps)
    document.getElementById('daw-fps-select')?.addEventListener('change', (e) => {
        const val = parseFloat(e.target.value);
        if (Number.isFinite(val) && val > 0) {
            daw.fps = val;
            const badge = document.getElementById('daw-video-fps-badge');
            if (badge) badge.textContent = `${val} FPS`;
            updateDawPlayhead();
        }
    });

    // Add Scene Marker Button (+ Marker at current playhead)
    document.getElementById('timeline-add-marker-btn')?.addEventListener('click', async () => {
        const markerCount = (daw.markers || []).length + 1;
        const markerName = await showStudioPrompt(
            'Add Scene Marker',
            `Enter scene marker label for playhead at ${formatDawSMPTE(daw.playhead, daw.fps || 24)}:`,
            `Marker ${markerCount}`,
            'Marker label'
        );
        if (!markerName || !markerName.trim()) return;

        const colors = ['#f59e0b', '#38bdf8', '#34d399', '#f43f5e', '#a855f7', '#ec4899'];
        const chosenColor = colors[(markerCount - 1) % colors.length];

        const newMarker = {
            id: `marker-${Date.now()}`,
            time: Math.round(daw.playhead * 1000) / 1000,
            name: markerName.trim(),
            color: chosenColor
        };

        pushDawHistory('Add Scene Marker');
        daw.markers.push(newMarker);
        daw.markers.sort((a, b) => a.time - b.time);
        renderDawRuler();
        showUndoToast(`📍 Added Marker: "${newMarker.name}"`);
    });

    // Toggle Video Track Preview Monitor
    const toggleVideoPreviewWindow = () => {
        const win = document.getElementById('daw-video-preview-window');
        if (!win) return;
        const isHidden = win.style.display === 'none' || !win.style.display;
        win.style.display = isHidden ? 'flex' : 'none';
        daw.video.isVisible = isHidden;

        const toggleBtn = document.getElementById('timeline-video-toggle-btn');
        if (toggleBtn) {
            toggleBtn.style.background = isHidden ? 'rgba(56, 189, 248, 0.25)' : 'rgba(56, 189, 248, 0.12)';
            toggleBtn.style.borderColor = isHidden ? '#38bdf8' : 'rgba(56, 189, 248, 0.35)';
        }
    };

    document.getElementById('timeline-video-toggle-btn')?.addEventListener('click', toggleVideoPreviewWindow);
    document.getElementById('daw-video-close-btn')?.addEventListener('click', () => {
        const win = document.getElementById('daw-video-preview-window');
        if (win) win.style.display = 'none';
        daw.video.isVisible = false;
        const toggleBtn = document.getElementById('timeline-video-toggle-btn');
        if (toggleBtn) {
            toggleBtn.style.background = 'rgba(56, 189, 248, 0.12)';
            toggleBtn.style.borderColor = 'rgba(56, 189, 248, 0.35)';
        }
    });

    // Video File Import Change Handler (Loads MP4 / WebM into Motion Picture Canvas)
    document.getElementById('daw-video-import-input')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const videoEl = document.getElementById('daw-video-element');
        const win = document.getElementById('daw-video-preview-window');
        const titleLabel = document.getElementById('daw-video-title-label');

        const objectUrl = URL.createObjectURL(file);
        daw.video.file = file;
        daw.video.url = objectUrl;
        daw.video.name = file.name;

        if (videoEl) {
            videoEl.src = objectUrl;
            videoEl.load();
            videoEl.onloadedmetadata = () => {
                daw.video.duration = videoEl.duration;
                daw.video.width = videoEl.videoWidth;
                daw.video.height = videoEl.videoHeight;
                if (titleLabel) titleLabel.textContent = file.name;
                videoEl.currentTime = daw.playhead;
                updateDawPlayhead();
            };
        }

        if (win) win.style.display = 'flex';
        daw.video.isVisible = true;
        showUndoToast(`🎬 Loaded Video: "${file.name}"`);
        e.target.value = '';
    });

    // Video Frame Shuttling Buttons (-1 Frame / +1 Frame)
    const stepDawFrame = (framesDelta) => {
        const frameSec = 1 / (daw.fps || 24);
        const newTime = Math.max(0, Math.min(daw.duration, daw.playhead + framesDelta * frameSec));
        daw.playhead = Math.round(newTime * 1000) / 1000;
        updateDawPlayhead();
        playDawScrubGrain(daw.playhead);
    };

    document.getElementById('daw-video-prev-frame-btn')?.addEventListener('click', () => stepDawFrame(-1));
    document.getElementById('daw-video-next-frame-btn')?.addEventListener('click', () => stepDawFrame(1));

    // Make Video Window Draggable
    const makeDraggable = (headerEl, containerEl) => {
        if (!headerEl || !containerEl) return;
        let isDragging = false;
        let startX = 0, startY = 0;
        let initialLeft = 0, initialTop = 0;

        headerEl.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = containerEl.getBoundingClientRect();
            const parentRect = containerEl.offsetParent ? containerEl.offsetParent.getBoundingClientRect() : { left: 0, top: 0 };
            initialLeft = rect.left - parentRect.left;
            initialTop = rect.top - parentRect.top;

            // Remove bottom/right positioning to allow absolute left/top movement
            containerEl.style.bottom = 'auto';
            containerEl.style.right = 'auto';
            containerEl.style.left = `${initialLeft}px`;
            containerEl.style.top = `${initialTop}px`;

            const onMouseMove = (moveEv) => {
                if (!isDragging) return;
                const dx = moveEv.clientX - startX;
                const dy = moveEv.clientY - startY;
                containerEl.style.left = `${Math.max(10, initialLeft + dx)}px`;
                containerEl.style.top = `${Math.max(10, initialTop + dy)}px`;
            };

            const onMouseUp = () => {
                isDragging = false;
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });
    };

    makeDraggable(
        document.getElementById('daw-video-preview-header'),
        document.getElementById('daw-video-preview-window')
    );

    // ADR System HUD & Teleprompter Controls
    const toggleAdrBooth = () => {
        daw.adr.isActive = !daw.adr.isActive;
        const hud = document.getElementById('daw-adr-hud-container');
        const btn = document.getElementById('timeline-adr-toggle-btn');
        if (hud) {
            hud.style.display = daw.adr.isActive ? 'flex' : 'none';
        }
        if (btn) {
            btn.style.background = daw.adr.isActive ? 'rgba(168, 85, 247, 0.25)' : 'rgba(168, 85, 247, 0.12)';
            btn.style.borderColor = daw.adr.isActive ? '#c084fc' : 'rgba(168, 85, 247, 0.35)';
        }
        if (daw.adr.isActive) {
            daw.adr.inTime = Math.max(3.0, daw.playhead + 3.0); // Default countdown starts now, in-point at +3s
            daw.adr.outTime = daw.adr.inTime + 5.0; // 5s dialogue window
            updateAdrDisplayAtTime(daw.playhead);
        }
    };

    document.getElementById('timeline-adr-toggle-btn')?.addEventListener('click', toggleAdrBooth);
    document.getElementById('daw-adr-close-hud-btn')?.addEventListener('click', toggleAdrBooth);

    document.getElementById('daw-adr-toggle-beeps-btn')?.addEventListener('click', () => {
        daw.adr.beepsEnabled = !daw.adr.beepsEnabled;
        const btn = document.getElementById('daw-adr-toggle-beeps-btn');
        if (btn) {
            btn.textContent = daw.adr.beepsEnabled ? 'Beeps: ON' : 'Beeps: OFF';
            btn.style.color = daw.adr.beepsEnabled ? '#34d399' : 'rgba(255,255,255,0.6)';
        }
    });

    document.getElementById('daw-adr-edit-prompt-btn')?.addEventListener('click', async () => {
        const newLine = await showStudioPrompt('ADR Script Prompt', 'Enter dialogue cue or script line for voice talent:', daw.adr.scriptPrompt || '', 'Dialogue line');
        if (newLine && newLine.trim()) {
            daw.adr.scriptPrompt = newLine.trim();
            const promptEl = document.getElementById('daw-adr-prompt-text');
            if (promptEl) promptEl.textContent = `"${daw.adr.scriptPrompt}"`;
            showStudioToast('ADR script line updated');
        }
    });

    // Desktop Menu Bar Dropdowns & Actions Engine
    const setupDawMenuBar = () => {
        const menuBtns = document.querySelectorAll('.daw-menu-bar-btn');
        const dropdowns = document.querySelectorAll('.daw-menu-dropdown');

        const closeAllMenus = () => {
            dropdowns.forEach(d => d.style.display = 'none');
            menuBtns.forEach(b => {
                b.style.background = 'none';
                b.style.color = 'rgba(255,255,255,0.78)';
            });
        };

        // Toggle dropdown on button click
        menuBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const menuName = btn.getAttribute('data-menu');
                const dd = document.getElementById(`daw-menu-dropdown-${menuName}`);
                const isOpen = dd && dd.style.display === 'block';

                closeAllMenus();

                if (!isOpen && dd) {
                    dd.style.display = 'block';
                    btn.style.background = 'rgba(255,255,255,0.12)';
                    btn.style.color = '#ffffff';
                }
            });

            // Hover switching between open menus (like native desktop menus)
            btn.addEventListener('mouseenter', () => {
                const anyOpen = Array.from(dropdowns).some(d => d.style.display === 'block');
                if (anyOpen) {
                    closeAllMenus();
                    const menuName = btn.getAttribute('data-menu');
                    const dd = document.getElementById(`daw-menu-dropdown-${menuName}`);
                    if (dd) {
                        dd.style.display = 'block';
                        btn.style.background = 'rgba(255,255,255,0.12)';
                        btn.style.color = '#ffffff';
                    }
                }
            });
        });

        // Close menus when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#daw-desktop-menu-bar')) {
                closeAllMenus();
            }
        });

        // File Menu Actions
        document.getElementById('daw-menu-file-new')?.addEventListener('click', () => {
            closeAllMenus();
            document.getElementById('timeline-fresh-session-btn')?.click();
        });

        const fileInput = document.getElementById('daw-menu-audio-file-input');
        document.getElementById('daw-menu-file-import')?.addEventListener('click', () => {
            closeAllMenus();
            if (fileInput) fileInput.click();
        });

        // Audio Ingestion Specs & Metadata Inspector Engine (v1.7.9)
        const inspectModal = document.getElementById('daw-import-inspect-modal');
        let pendingImportData = null;
        let inspectAuditionSource = null;

        const stopInspectAudition = () => {
            if (inspectAuditionSource) {
                try {
                    inspectAuditionSource.stop();
                    inspectAuditionSource.disconnect();
                } catch (e) {}
                inspectAuditionSource = null;
            }
            const pBtn = document.getElementById('daw-inspect-play-btn');
            if (pBtn) {
                pBtn.innerHTML = `<span>▶ Play Preview</span>`;
                pBtn.style.background = 'rgba(56,189,248,0.18)';
                pBtn.style.borderColor = 'rgba(56,189,248,0.4)';
                pBtn.style.color = '#38bdf8';
            }
        };

        const closeInspectModal = () => {
            stopInspectAudition();
            if (inspectModal) inspectModal.style.display = 'none';
            pendingImportData = null;
        };

        document.getElementById('daw-import-inspect-close-btn')?.addEventListener('click', closeInspectModal);
        document.getElementById('daw-inspect-cancel-btn')?.addEventListener('click', closeInspectModal);

        // Audition Play/Stop Toggle
        document.getElementById('daw-inspect-play-btn')?.addEventListener('click', () => {
            if (!pendingImportData || !pendingImportData.buffer) return;
            const pBtn = document.getElementById('daw-inspect-play-btn');

            if (inspectAuditionSource) {
                stopInspectAudition();
            } else {
                try {
                    const ctx = daw.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
                    if (ctx.state === 'suspended') ctx.resume();
                    const src = ctx.createBufferSource();
                    src.buffer = pendingImportData.buffer;
                    src.connect(ctx.destination);
                    src.onended = () => stopInspectAudition();
                    src.start(0);
                    inspectAuditionSource = src;
                    if (pBtn) {
                        pBtn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:4px;"><span style="display:inline-block;width:6px;height:6px;background:#ef4444;border-radius:50%;animation:pulse 1s infinite;"></span>■ Stop Audition</span>`;
                        pBtn.style.background = 'rgba(239, 68, 68, 0.2)';
                        pBtn.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                        pBtn.style.color = '#f87171';
                    }
                } catch (err) {
                    showStudioToast('Could not audition audio preview: ' + err.message);
                }
            }
        });

        // Insert onto Timeline Confirmation Handler
        document.getElementById('daw-inspect-confirm-btn')?.addEventListener('click', () => {
            if (!pendingImportData) return;
            const targetTrackSelect = document.getElementById('daw-inspect-target-track');
            const placementSelect = document.getElementById('daw-inspect-placement-pos');

            const chosenTrack = (targetTrackSelect && targetTrackSelect.value && daw.tracks[targetTrackSelect.value])
                ? targetTrackSelect.value
                : (daw._recordTrackId && daw.tracks[daw._recordTrackId] ? daw._recordTrackId : Object.keys(daw.tracks)[0] || 'host');

            let targetOffset = 0;
            const placement = placementSelect ? placementSelect.value : 'playhead';
            if (placement === 'playhead') {
                targetOffset = daw.playhead || 0;
            } else if (placement === 'start') {
                targetOffset = 0;
            } else if (placement === 'end') {
                let maxEnd = 0;
                for (const c of daw.clips) {
                    const ePos = (c.startOffset || 0) + Math.max(0, (c.trimEnd || c.duration || 0) - (c.trimStart || 0));
                    if (ePos > maxEnd) maxEnd = ePos;
                }
                targetOffset = maxEnd;
            }

            const { file, decoded, peaks, filename } = pendingImportData;
            const newClip = {
                id: `clip-import-${Date.now()}`,
                trackId: chosenTrack,
                name: filename.replace(/\.[^/.]+$/, ''),
                tag: 'Imported',
                startOffset: targetOffset,
                trimStart: 0,
                trimEnd: decoded.duration,
                duration: decoded.duration,
                fadeIn: 0,
                fadeOut: 0,
                blob: file,
                blobUrl: URL.createObjectURL(file),
                buffer: decoded,
                peaks: peaks,
                color: '#06b6d4'
            };

            pushDawHistory('Import Audio File');
            daw.clips.push(newClip);
            recalculateDawDuration();
            renderDawRuler();
            renderDawClips();
            closeInspectModal();
            showUndoToast(`🎵 Ingested "${file.name}" to [${daw.tracks[chosenTrack]?.name || chosenTrack}]`);
        });

        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                    const ab = await file.arrayBuffer();
                    const tempCtx = daw.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
                    const decoded = await tempCtx.decodeAudioData(ab.slice(0));

                    // 1. Container / File Extension resolution
                    const extMatch = file.name.match(/\.([0-9a-z]+)$/i);
                    const ext = extMatch ? extMatch[1].toUpperCase() : 'AUDIO';
                    const mime = file.type || `audio/${ext.toLowerCase()}`;

                    // 2. Audio Channel Detection
                    const chCount = decoded.numberOfChannels;
                    const chDesc = chCount === 1 ? 'Mono (1 Ch)' : (chCount === 2 ? 'Stereo (2 Ch - L/R)' : `${chCount} Channels Multi-track`);
                    const chBadge = chCount === 1 ? 'MONO' : (chCount === 2 ? 'STEREO' : `${chCount}CH`);

                    // 3. Exact Sample Rate & Broadcast Sub-label
                    const sr = decoded.sampleRate;
                    let srSub = 'Standard Consumer Audio';
                    if (sr === 48000) srSub = '48 kHz Broadcast / SMPTE Standard';
                    else if (sr === 44100) srSub = '44.1 kHz Red Book CD Standard';
                    else if (sr === 96000) srSub = '96 kHz Hi-Res Studio Master';
                    else if (sr === 88200) srSub = '88.2 kHz Pro Audio Oversampled';
                    else if (sr >= 192000) srSub = '192 kHz Ultra-Fi Mastering';

                    // 4. File Size & Bit Depth / Bitrate Estimation
                    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
                    let bitDepthStr = '16-bit / 1411 kbps';
                    let codecDesc = 'PCM Linear Audio';

                    if (ext === 'WAV') {
                        // Read WAV header bitsPerSample at offset 34 if valid RIFF
                        let pcmBits = 16;
                        if (ab.byteLength >= 44) {
                            const view = new DataView(ab);
                            const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
                            if (riff === 'RIFF') {
                                pcmBits = view.getUint16(34, true) || 16;
                            }
                        }
                        const calcBitrate = Math.round((sr * chCount * pcmBits) / 1000);
                        bitDepthStr = `${pcmBits}-bit PCM / ${calcBitrate} kbps`;
                        codecDesc = `Broadcast WAV (${pcmBits}-bit Fixed)`;
                    } else if (ext === 'FLAC') {
                        bitDepthStr = 'Lossless VBR FLAC';
                        codecDesc = 'Free Lossless Audio Codec';
                    } else if (ext === 'MP3' || ext === 'M4A' || ext === 'AAC' || ext === 'OGG' || ext === 'WEBM') {
                        const estBitrate = Math.round((file.size * 8) / (decoded.duration || 1) / 1000);
                        bitDepthStr = `~${estBitrate} kbps compressed`;
                        codecDesc = `${ext} Perceptual Encodings`;
                    }

                    // 5. Peak Amplitude & Safe Headroom Calculation (dBFS)
                    let maxSample = 0;
                    for (let c = 0; c < chCount; c++) {
                        const data = decoded.getChannelData(c);
                        const stride = Math.max(1, Math.floor(data.length / 20000)); // Sample across file efficiently
                        for (let i = 0; i < data.length; i += stride) {
                            const abs = Math.abs(data[i]);
                            if (abs > maxSample) maxSample = abs;
                        }
                    }
                    const peakDbfs = maxSample > 0 ? (20 * Math.log10(maxSample)).toFixed(1) : '-inf';
                    let headroomLabel = 'Safe Headroom';
                    if (maxSample >= 0.999) {
                        headroomLabel = '⚠️ Near 0 dBFS Peak / Clip Risk';
                    } else if (maxSample >= 0.707) {
                        headroomLabel = 'Optimal Studio Headroom (-3 dBFS)';
                    } else if (maxSample < 0.2) {
                        headroomLabel = 'Quiet Level (Consider Gain / Norm)';
                    }

                    // 6. Generate mini waveform peaks for preview & clip
                    const peaks = extractWaveformPeaks(decoded, 400);

                    // 7. Store pending import session
                    pendingImportData = {
                        file,
                        filename: file.name,
                        decoded,
                        peaks,
                        duration: decoded.duration
                    };

                    // 8. Populate Inspector UI fields
                    const fnEl = document.getElementById('daw-inspect-filename');
                    if (fnEl) fnEl.textContent = file.name;

                    const fmtBadge = document.getElementById('daw-inspect-badge-format');
                    if (fmtBadge) fmtBadge.textContent = ext;

                    const chBadgeEl = document.getElementById('daw-inspect-badge-channels');
                    if (chBadgeEl) chBadgeEl.textContent = chBadge;

                    const srEl = document.getElementById('daw-inspect-samplerate');
                    if (srEl) srEl.textContent = `${sr.toLocaleString()} Hz`;

                    const srSubEl = document.getElementById('daw-inspect-sr-sub');
                    if (srSubEl) srSubEl.textContent = srSub;

                    const durEl = document.getElementById('daw-inspect-duration');
                    if (durEl) durEl.textContent = formatDawTime(decoded.duration);

                    const durSampEl = document.getElementById('daw-inspect-dur-samples');
                    if (durSampEl) durSampEl.textContent = `${decoded.length.toLocaleString()} total samples`;

                    const szEl = document.getElementById('daw-inspect-filesize');
                    if (szEl) szEl.textContent = `${sizeMB} MB`;

                    const mimeEl = document.getElementById('daw-inspect-mime');
                    if (mimeEl) mimeEl.textContent = mime;

                    const chDescEl = document.getElementById('daw-inspect-channels-desc');
                    if (chDescEl) chDescEl.textContent = chDesc;

                    const peakEl = document.getElementById('daw-inspect-peak');
                    if (peakEl) peakEl.textContent = `${peakDbfs} dBFS`;

                    const hdEl = document.getElementById('daw-inspect-headroom');
                    if (hdEl) hdEl.textContent = headroomLabel;

                    const bdEl = document.getElementById('daw-inspect-bitdepth');
                    if (bdEl) bdEl.textContent = bitDepthStr;

                    const cdEl = document.getElementById('daw-inspect-codec');
                    if (cdEl) cdEl.textContent = codecDesc;

                    // 9. Populate Mini Waveform Container
                    const wavePreviewEl = document.getElementById('daw-inspect-waveform-preview');
                    if (wavePreviewEl) {
                        wavePreviewEl.innerHTML = '';
                        const previewBars = 80;
                        const step = Math.max(1, Math.floor(peaks.length / previewBars));
                        for (let i = 0; i < previewBars; i++) {
                            const p = peaks[i * step] || 0.1;
                            const barH = Math.max(3, Math.round(p * 34));
                            const bar = document.createElement('div');
                            bar.style.width = '3px';
                            bar.style.height = `${barH}px`;
                            bar.style.background = 'linear-gradient(180deg, #38bdf8 0%, #0284c7 100%)';
                            bar.style.borderRadius = '2px';
                            bar.style.opacity = '0.85';
                            wavePreviewEl.appendChild(bar);
                        }
                    }

                    // 10. Populate Track Selection Dropdown
                    const trackSelect = document.getElementById('daw-inspect-target-track');
                    if (trackSelect) {
                        trackSelect.innerHTML = '';
                        const defaultTrack = daw._recordTrackId && daw.tracks[daw._recordTrackId] ? daw._recordTrackId : (Object.keys(daw.tracks)[0] || 'host');
                        Object.keys(daw.tracks).forEach(tId => {
                            const t = daw.tracks[tId];
                            const opt = document.createElement('option');
                            opt.value = tId;
                            opt.textContent = `${t.name || tId} (${tId})`;
                            if (tId === defaultTrack) opt.selected = true;
                            trackSelect.appendChild(opt);
                        });
                    }

                    // 11. Open Inspector Modal
                    if (inspectModal) inspectModal.style.display = 'flex';

                } catch (err) {
                    await showStudioAlert('Audio Inspection Error', 'Could not parse or decode audio specifications: ' + err.message);
                }
                fileInput.value = '';
            });
        }

        document.getElementById('daw-menu-file-import-video')?.addEventListener('click', () => {
            closeAllMenus();
            const videoInput = document.getElementById('daw-video-import-input');
            if (videoInput) videoInput.click();
        });

        document.getElementById('daw-menu-file-render')?.addEventListener('click', () => {
            closeAllMenus();
            document.getElementById('timeline-render-btn')?.click();
        });

        document.getElementById('daw-menu-file-export-stems')?.addEventListener('click', () => {
            closeAllMenus();
            exportAllStemsZipDAW();
        });

        document.getElementById('daw-menu-file-close')?.addEventListener('click', () => {
            closeAllMenus();
            document.getElementById('podcast-editor-close-btn')?.click();
        });

        // Edit Menu Actions
        document.getElementById('daw-menu-edit-undo')?.addEventListener('click', () => {
            closeAllMenus();
            undoDawAction();
        });

        document.getElementById('daw-menu-edit-redo')?.addEventListener('click', () => {
            closeAllMenus();
            redoDawAction();
        });

        document.getElementById('daw-menu-edit-cut')?.addEventListener('click', () => {
            closeAllMenus();
            cutSelectedClipsDAW();
        });

        document.getElementById('daw-menu-edit-copy')?.addEventListener('click', () => {
            closeAllMenus();
            copySelectedClipsDAW();
        });

        document.getElementById('daw-menu-edit-paste')?.addEventListener('click', () => {
            closeAllMenus();
            pasteClipsDAW();
        });

        document.getElementById('daw-menu-edit-split')?.addEventListener('click', () => {
            closeAllMenus();
            splitSelectedClip();
        });

        document.getElementById('daw-menu-edit-duplicate')?.addEventListener('click', () => {
            closeAllMenus();
            if (!daw.selectedClipId) {
                showStudioToast('Please select a clip to duplicate first');
                return;
            }
            const c = daw.clips.find(clip => clip.id === daw.selectedClipId);
            if (!c) return;
            const activeDur = c.trimEnd - c.trimStart;
            const dupClip = {
                ...c,
                id: `clip-${c.trackId}-${Date.now()}`,
                name: `${c.name} (Copy)`,
                startOffset: c.startOffset + activeDur + 0.5
            };
            pushDawHistory('Duplicate Clip');
            daw.clips.push(dupClip);
            daw.selectedClipId = dupClip.id;
            daw.selectedClipIds.clear();
            daw.selectedClipIds.add(dupClip.id);
            recalculateDawDuration();
            renderDawRuler();
            renderDawClips();
        });

        document.getElementById('daw-menu-edit-delete')?.addEventListener('click', () => {
            closeAllMenus();
            deleteSelectedClip(false);
        });

        document.getElementById('daw-menu-edit-ripple-delete')?.addEventListener('click', () => {
            closeAllMenus();
            deleteSelectedClip(true);
        });

        document.getElementById('daw-menu-edit-select-all')?.addEventListener('click', () => {
            closeAllMenus();
            daw.clips.forEach(c => daw.selectedClipIds.add(c.id));
            if (daw.clips.length > 0) daw.selectedClipId = daw.clips[0].id;
            renderDawClips();
        });

        document.getElementById('daw-menu-edit-deselect')?.addEventListener('click', () => {
            closeAllMenus();
            daw.selectedClipIds.clear();
            daw.selectedClipId = null;
            renderDawClips();
        });

        // Tracks Menu Actions
        document.getElementById('daw-menu-tracks-add-audio')?.addEventListener('click', () => {
            closeAllMenus();
            document.getElementById('daw-add-audio-track-btn')?.click();
        });

        document.getElementById('daw-menu-tracks-add-music')?.addEventListener('click', () => {
            closeAllMenus();
            document.getElementById('daw-add-music-track-btn')?.click();
        });

        document.getElementById('daw-menu-tracks-mute-all')?.addEventListener('click', () => {
            closeAllMenus();
            pushDawHistory('Mute All Tracks');
            Object.values(daw.tracks).forEach(t => t.muted = true);
            renderDawTracks();
            renderDawClips();
        });

        document.getElementById('daw-menu-tracks-unmute-all')?.addEventListener('click', () => {
            closeAllMenus();
            pushDawHistory('Unmute All Tracks');
            Object.values(daw.tracks).forEach(t => t.muted = false);
            renderDawTracks();
            renderDawClips();
        });

        document.getElementById('daw-menu-tracks-clear-solo')?.addEventListener('click', () => {
            closeAllMenus();
            pushDawHistory('Clear Solos');
            Object.values(daw.tracks).forEach(t => t.solo = false);
            renderDawTracks();
            renderDawClips();
        });

        document.getElementById('daw-menu-tracks-toggle-automation')?.addEventListener('click', () => {
            closeAllMenus();
            const anyOpen = Object.values(daw.tracks).some(t => t.showAutomation);
            Object.values(daw.tracks).forEach(t => t.showAutomation = !anyOpen);
            renderDawTracks();
            renderDawClips();
        });

        // Theme Switcher Engine (Obsidian Dark, Cinema Monochrome, Matrix Phosphor)
        const applyStudioTheme = (themeName) => {
            const editorModal = document.getElementById('podcast-editor-modal');
            if (editorModal) {
                editorModal.setAttribute('data-theme', themeName);
            }
            try {
                localStorage.setItem('localfilm_studio_theme', themeName);
            } catch (e) {}

            const obsCheck = document.getElementById('daw-theme-obsidian-check');
            const monoCheck = document.getElementById('daw-theme-monochrome-check');
            const matCheck = document.getElementById('daw-theme-matrix-check');
            if (obsCheck) obsCheck.style.display = themeName === 'obsidian' ? 'inline' : 'none';
            if (monoCheck) monoCheck.style.display = themeName === 'monochrome' ? 'inline' : 'none';
            if (matCheck) matCheck.style.display = themeName === 'matrix' ? 'inline' : 'none';

            const themeLabel = themeName === 'matrix' ? 'Matrix Green' : (themeName === 'monochrome' ? 'Cinema B&W' : 'Obsidian Dark');
            showStudioToast(`🎨 Theme set to ${themeLabel}`);
        };

        // Standalone Master VU Meter Window Toggle & Docking Engine
        const toggleMasterVuWindow = () => {
            const vuWin = document.getElementById('daw-studio-vu-window');
            if (!vuWin) return;
            const isHidden = vuWin.style.display === 'none' || !vuWin.style.display;
            vuWin.style.display = isHidden ? 'flex' : 'none';
        };

        const toggleMasterVuDock = () => {
            const vuWin = document.getElementById('daw-studio-vu-window');
            const dockBtn = document.getElementById('daw-vu-dock-toggle-btn');
            if (!vuWin) return;
            const isCurrentlyDocked = vuWin.classList.contains('is-docked');
            if (isCurrentlyDocked) {
                vuWin.classList.remove('is-docked');
                vuWin.style.position = 'absolute';
                vuWin.style.top = '76px';
                vuWin.style.right = '480px';
                vuWin.style.left = 'auto';
                vuWin.style.bottom = 'auto';
                if (dockBtn) dockBtn.textContent = 'DOCK';
                showStudioToast('Master VU Meter: Floating Mode');
            } else {
                vuWin.classList.add('is-docked');
                vuWin.style.left = 'auto';
                vuWin.style.top = 'auto';
                if (dockBtn) dockBtn.textContent = 'FLOAT';
                showStudioToast('Master VU Meter: Docked Mode');
            }
        };

        // Draggable floating VU meter window
        const initFloatingVuDraggable = () => {
            const vuWin = document.getElementById('daw-studio-vu-window');
            const vuHeader = document.getElementById('daw-studio-vu-header');
            if (!vuWin || !vuHeader || vuHeader._dragBound) return;
            vuHeader._dragBound = true;

            vuHeader.addEventListener('mousedown', (e) => {
                if (vuWin.classList.contains('is-docked')) return;
                if (e.button !== 0 || e.target.closest('button')) return;

                const startX = e.clientX;
                const startY = e.clientY;
                const rect = vuWin.getBoundingClientRect();
                const parent = vuWin.offsetParent || document.body;
                const parentRect = parent.getBoundingClientRect();

                const initLeft = rect.left - parentRect.left;
                const initTop = rect.top - parentRect.top;

                vuWin.style.right = 'auto';
                vuWin.style.bottom = 'auto';
                vuWin.style.left = `${initLeft}px`;
                vuWin.style.top = `${initTop}px`;

                const onMove = (moveEv) => {
                    const dx = moveEv.clientX - startX;
                    const dy = moveEv.clientY - startY;
                    vuWin.style.left = `${Math.max(10, Math.min(parentRect.width - vuWin.offsetWidth - 10, initLeft + dx))}px`;
                    vuWin.style.top = `${Math.max(36, Math.min(parentRect.height - vuWin.offsetHeight - 10, initTop + dy))}px`;
                };

                const onUp = () => {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                };

                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
            });
        };
        initFloatingVuDraggable();

        document.getElementById('daw-vu-dock-toggle-btn')?.addEventListener('click', toggleMasterVuDock);
        document.getElementById('daw-vu-window-close-btn')?.addEventListener('click', () => {
            const vuWin = document.getElementById('daw-studio-vu-window');
            if (vuWin) vuWin.style.display = 'none';
        });

        // Plugins Directory Drawer Handler
        const openPluginsDirectory = () => {
            const modal = document.getElementById('daw-plugins-directory-modal');
            if (modal) modal.style.display = 'flex';
        };

        const closePluginsDirectory = () => {
            const modal = document.getElementById('daw-plugins-directory-modal');
            if (modal) modal.style.display = 'none';
        };

        document.getElementById('daw-plugins-dir-close-btn')?.addEventListener('click', closePluginsDirectory);
        document.querySelectorAll('.daw-plugin-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cat = e.currentTarget.getAttribute('data-cat');
                document.querySelectorAll('.daw-plugin-filter-btn').forEach(b => {
                    b.style.background = 'rgba(255,255,255,0.06)';
                    b.style.borderColor = 'rgba(255,255,255,0.15)';
                    b.style.color = '#fff';
                });
                e.currentTarget.style.background = 'rgba(56, 189, 248, 0.2)';
                e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.4)';
                e.currentTarget.style.color = '#38bdf8';

                document.querySelectorAll('.daw-plugin-card').forEach(card => {
                    const cardCat = card.getAttribute('data-cat');
                    if (cat === 'all' || cardCat === cat) {
                        card.style.display = 'flex';
                    } else {
                        card.style.display = 'none';
                    }
                });
            });
        });

        document.querySelectorAll('.daw-plugin-insert-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const pluginType = e.currentTarget.getAttribute('data-plugin');
                closePluginsDirectory();
                openTrackFxModal(daw._recordTrackId || 'host');
                if (pluginType && pluginType !== 'eq' && pluginType !== 'deesser') {
                    const presetBtn = document.querySelector(`.daw-fx-preset-btn[data-preset="${pluginType}"]`);
                    if (presetBtn) presetBtn.click();
                } else if (pluginType === 'eq') {
                    const eqChk = document.getElementById('daw-fx-eq-enable');
                    if (eqChk) eqChk.checked = true;
                } else if (pluginType === 'deesser') {
                    const deessChk = document.getElementById('daw-fx-deesser-enable');
                    if (deessChk) deessChk.checked = true;
                }
                showStudioToast(`Inserted plugin on ${daw.tracks[daw._recordTrackId || 'host']?.name || 'track'}`);
            });
        });

        // Effects Menu Actions
        document.getElementById('daw-menu-fx-open-rack')?.addEventListener('click', () => {
            closeAllMenus();
            openTrackFxModal(daw._recordTrackId || 'host');
        });

        document.getElementById('daw-menu-fx-plugins-dir')?.addEventListener('click', () => {
            closeAllMenus();
            openPluginsDirectory();
        });

        document.getElementById('daw-menu-fx-preset-la2a')?.addEventListener('click', () => {
            closeAllMenus();
            openTrackFxModal(daw._recordTrackId || 'host');
            document.querySelector('.daw-fx-preset-btn[data-preset="la2a"]')?.click();
            document.getElementById('daw-track-fx-save-btn')?.click();
        });

        document.getElementById('daw-menu-fx-preset-1176')?.addEventListener('click', () => {
            closeAllMenus();
            openTrackFxModal(daw._recordTrackId || 'host');
            document.querySelector('.daw-fx-preset-btn[data-preset="1176"]')?.click();
            document.getElementById('daw-track-fx-save-btn')?.click();
        });

        document.getElementById('daw-menu-fx-preset-ssl')?.addEventListener('click', () => {
            closeAllMenus();
            openTrackFxModal(daw._recordTrackId || 'host');
            document.querySelector('.daw-fx-preset-btn[data-preset="ssl"]')?.click();
            document.getElementById('daw-track-fx-save-btn')?.click();
        });

        document.getElementById('daw-menu-fx-dehum-50')?.addEventListener('click', () => {
            closeAllMenus();
            openTrackFxModal(daw._recordTrackId || 'host');
            document.querySelector('.daw-fx-preset-btn[data-preset="dehum50"]')?.click();
            document.getElementById('daw-track-fx-save-btn')?.click();
        });

        document.getElementById('daw-menu-fx-dehum-60')?.addEventListener('click', () => {
            closeAllMenus();
            openTrackFxModal(daw._recordTrackId || 'host');
            document.querySelector('.daw-fx-preset-btn[data-preset="dehum60"]')?.click();
            document.getElementById('daw-track-fx-save-btn')?.click();
        });

        document.getElementById('daw-menu-fx-preset-polish')?.addEventListener('click', () => {
            closeAllMenus();
            openTrackFxModal(daw._recordTrackId || 'host');
            document.querySelector('.daw-fx-preset-btn[data-preset="polish"]')?.click();
            document.getElementById('daw-track-fx-save-btn')?.click();
        });

        document.getElementById('daw-menu-fx-preset-radio')?.addEventListener('click', () => {
            closeAllMenus();
            openTrackFxModal(daw._recordTrackId || 'host');
            document.querySelector('.daw-fx-preset-btn[data-preset="radio"]')?.click();
            document.getElementById('daw-track-fx-save-btn')?.click();
        });

        document.getElementById('daw-menu-fx-preset-space')?.addEventListener('click', () => {
            closeAllMenus();
            openTrackFxModal(daw._recordTrackId || 'host');
            document.querySelector('.daw-fx-preset-btn[data-preset="space"]')?.click();
            document.getElementById('daw-track-fx-save-btn')?.click();
        });

        document.getElementById('daw-menu-fx-preset-podcast-clean')?.addEventListener('click', () => {
            closeAllMenus();
            openTrackFxModal(daw._recordTrackId || 'host');
            document.querySelector('.daw-fx-preset-btn[data-preset="podcast-clean"]')?.click();
            document.getElementById('daw-track-fx-save-btn')?.click();
        });

        document.getElementById('daw-menu-fx-preset-master-brickwall')?.addEventListener('click', () => {
            closeAllMenus();
            openTrackFxModal(daw._recordTrackId || 'host');
            document.querySelector('.daw-fx-preset-btn[data-preset="master-brickwall"]')?.click();
            document.getElementById('daw-track-fx-save-btn')?.click();
        });

        document.getElementById('daw-menu-fx-reset')?.addEventListener('click', () => {
            closeAllMenus();
            openTrackFxModal(daw._recordTrackId || 'host');
            document.querySelector('.daw-fx-preset-btn[data-preset="reset"]')?.click();
            document.getElementById('daw-track-fx-save-btn')?.click();
        });

        // View & Layout Engine Actions (Configurable Docking & Real Estate Maximization)
        const toggleSidebarCollapse = () => {
            const sidebar = document.getElementById('daw-track-headers-sidebar');
            if (sidebar) {
                sidebar.classList.toggle('daw-track-sidebar-collapsed');
                if (sidebar.classList.contains('daw-track-sidebar-collapsed')) {
                    sidebar.style.width = '58px';
                } else {
                    sidebar.style.width = daw.layoutMode === 'editing' ? '140px' : (daw.layoutMode === 'canvas' ? '0px' : '240px');
                }
            }
        };

        const applyLayoutMode = (mode) => {
            daw.layoutMode = mode;
            const tag = document.getElementById('daw-layout-status-tag');
            const stdCheck = document.getElementById('daw-menu-layout-standard-check');
            const editCheck = document.getElementById('daw-menu-layout-editing-check');
            const canvasCheck = document.getElementById('daw-menu-layout-canvas-check');
            const sidebar = document.getElementById('daw-track-headers-sidebar');

            if (mode === 'canvas') {
                if (tag) tag.textContent = 'MAXIMISED CANVAS';
                if (stdCheck) stdCheck.style.display = 'none';
                if (editCheck) editCheck.style.display = 'none';
                if (canvasCheck) canvasCheck.style.display = 'inline';
                if (sidebar) {
                    sidebar.classList.add('daw-track-sidebar-collapsed');
                    sidebar.style.width = '58px';
                }
            } else if (mode === 'editing') {
                if (tag) tag.textContent = 'EDITING FOCUS';
                if (stdCheck) stdCheck.style.display = 'none';
                if (editCheck) editCheck.style.display = 'inline';
                if (canvasCheck) canvasCheck.style.display = 'none';
                if (sidebar) {
                    sidebar.classList.remove('daw-track-sidebar-collapsed');
                    sidebar.style.width = '140px';
                }
            } else {
                if (tag) tag.textContent = 'STUDIO MODE';
                if (stdCheck) stdCheck.style.display = 'inline';
                if (editCheck) editCheck.style.display = 'none';
                if (canvasCheck) canvasCheck.style.display = 'none';
                if (sidebar) {
                    sidebar.classList.remove('daw-track-sidebar-collapsed');
                    sidebar.style.width = '240px';
                }
            }
            renderDawTracks();
            renderDawClips();
        };

        // Wire View Dropdown Actions
        document.getElementById('daw-menu-view-fullscreen')?.addEventListener('click', () => {
            closeAllMenus();
            toggleDawFullscreen();
        });

        document.getElementById('daw-fullscreen-btn')?.addEventListener('click', () => {
            toggleDawFullscreen();
        });

        document.getElementById('daw-menu-view-vu-meter')?.addEventListener('click', () => {
            closeAllMenus();
            toggleMasterVuWindow();
        });

        document.getElementById('daw-menu-view-toggle-sidebar')?.addEventListener('click', () => {
            closeAllMenus();
            toggleSidebarCollapse();
        });

        document.getElementById('daw-menu-layout-standard')?.addEventListener('click', () => {
            closeAllMenus();
            applyLayoutMode('standard');
        });

        document.getElementById('daw-menu-layout-editing')?.addEventListener('click', () => {
            closeAllMenus();
            applyLayoutMode('editing');
        });

        document.getElementById('daw-menu-layout-canvas')?.addEventListener('click', () => {
            closeAllMenus();
            applyLayoutMode('canvas');
        });

        document.getElementById('daw-menu-view-height-56')?.addEventListener('click', () => {
            closeAllMenus();
            daw.laneHeight = 56;
            const lbl = document.getElementById('timeline-track-height-label');
            if (lbl) lbl.textContent = '56px';
            renderDawTracks();
            renderDawClips();
        });

        document.getElementById('daw-menu-view-height-74')?.addEventListener('click', () => {
            closeAllMenus();
            daw.laneHeight = 74;
            const lbl = document.getElementById('timeline-track-height-label');
            if (lbl) lbl.textContent = '74px';
            renderDawTracks();
            renderDawClips();
        });

        document.getElementById('daw-menu-view-height-110')?.addEventListener('click', () => {
            closeAllMenus();
            daw.laneHeight = 110;
            const lbl = document.getElementById('timeline-track-height-label');
            if (lbl) lbl.textContent = '110px';
            renderDawTracks();
            renderDawClips();
        });

        document.getElementById('daw-menu-view-height-160')?.addEventListener('click', () => {
            closeAllMenus();
            daw.laneHeight = 160;
            const lbl = document.getElementById('timeline-track-height-label');
            if (lbl) lbl.textContent = '160px';
            renderDawTracks();
            renderDawClips();
        });

        // Theme Switcher Listeners
        document.getElementById('daw-menu-theme-obsidian')?.addEventListener('click', () => {
            closeAllMenus();
            applyStudioTheme('obsidian');
        });

        document.getElementById('daw-menu-theme-monochrome')?.addEventListener('click', () => {
            closeAllMenus();
            applyStudioTheme('monochrome');
        });

        document.getElementById('daw-menu-theme-matrix')?.addEventListener('click', () => {
            closeAllMenus();
            applyStudioTheme('matrix');
        });

        document.getElementById('daw-menu-view-snap-cycle')?.addEventListener('click', () => {
            closeAllMenus();
            document.getElementById('timeline-snap-btn')?.click();
        });

        // Transport Menu Actions
        document.getElementById('daw-menu-trans-play')?.addEventListener('click', () => {
            closeAllMenus();
            toggleDawPlay();
        });

        document.getElementById('daw-menu-trans-stop')?.addEventListener('click', () => {
            closeAllMenus();
            document.getElementById('timeline-stop-btn')?.click();
        });

        document.getElementById('daw-menu-trans-record')?.addEventListener('click', () => {
            closeAllMenus();
            toggleDawRecording();
        });

        document.getElementById('daw-menu-trans-loop')?.addEventListener('click', () => {
            closeAllMenus();
            document.getElementById('timeline-loop-btn')?.click();
        });

        // Help Menu Actions
        document.getElementById('daw-menu-help-shortcuts')?.addEventListener('click', () => {
            closeAllMenus();
            const modal = document.getElementById('daw-shortcuts-help-modal');
            if (modal) modal.style.display = 'flex';
        });

        document.getElementById('daw-shortcuts-help-close-btn')?.addEventListener('click', () => {
            const modal = document.getElementById('daw-shortcuts-help-modal');
            if (modal) modal.style.display = 'none';
        });

        document.getElementById('daw-shortcuts-help-ok-btn')?.addEventListener('click', () => {
            const modal = document.getElementById('daw-shortcuts-help-modal');
            if (modal) modal.style.display = 'none';
        });

        // About Alan Joyce & LocalFilm Vision Dialog
        document.getElementById('daw-menu-help-about')?.addEventListener('click', () => {
            closeAllMenus();
            const modal = document.getElementById('daw-about-founder-modal');
            if (modal) modal.style.display = 'flex';
        });

        document.getElementById('daw-about-founder-close-btn')?.addEventListener('click', () => {
            const modal = document.getElementById('daw-about-founder-modal');
            if (modal) modal.style.display = 'none';
        });

        document.getElementById('daw-about-founder-ok-btn')?.addEventListener('click', () => {
            const modal = document.getElementById('daw-about-founder-modal');
            if (modal) modal.style.display = 'none';
        });
    };
    setupDawMenuBar();

    // Waveform Amplitude Zoom Multiplier
    document.getElementById('timeline-wave-gain-btn')?.addEventListener('click', () => {
        const scales = [1.0, 1.5, 2.0, 3.0];
        const curIdx = scales.indexOf(daw.waveScale || 1.0);
        daw.waveScale = scales[(curIdx + 1) % scales.length];

        const lbl = document.getElementById('timeline-wave-gain-label');
        if (lbl) lbl.textContent = `${daw.waveScale}x`;

        renderDawClips();
    });

    // Timeline Lanes Click-to-Move Playhead
    document.getElementById('timeline-lanes-container')?.addEventListener('click', (e) => {
        if (!e.target.closest('.daw-timeline-clip') && !e.target.closest('.lane-automation-svg') && !e.target.closest('.daw-kf-group') && !e.target.closest('button') && !e.target.closest('input')) {
            seekTimelineFromClientX(e.clientX);
        }
    });

    // Sync vertical scroll between viewport and track headers
    const timelineViewport = document.getElementById('timeline-scroll-viewport');
    const headersList = document.getElementById('daw-track-headers-container');
    if (timelineViewport && headersList) {
        timelineViewport.addEventListener('scroll', () => {
            headersList.scrollTop = timelineViewport.scrollTop;
        });

        // Smooth Alt/Option or Ctrl/Cmd + Mouse Wheel horizontal zooming anchored at cursor
        timelineViewport.addEventListener('wheel', (e) => {
            if (e.altKey || e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const rect = timelineViewport.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const scrollLeft = timelineViewport.scrollLeft;
                const timeAtCursor = (scrollLeft + mouseX) / daw.zoom;

                const zoomStep = 3;
                const newZoom = e.deltaY < 0 
                    ? Math.min(60, daw.zoom + zoomStep) 
                    : Math.max(5, daw.zoom - zoomStep);

                if (newZoom !== daw.zoom) {
                    daw.zoom = newZoom;
                    const badge = document.getElementById('timeline-zoom-badge');
                    if (badge) badge.textContent = `${Math.round(daw.zoom / 15 * 100)}%`;
                    renderDawTracks();
                    renderDawRuler();
                    renderDawClips();
                    updateDawPlayhead();

                    // Anchor the viewport so timeAtCursor remains directly under the cursor
                    timelineViewport.scrollLeft = Math.max(0, timeAtCursor * daw.zoom - mouseX);
                }
            }
        }, { passive: false });
    }

    // Global Keyboard Shortcuts for Multi-Track Studio DAW (Undo, Redo, Delete, Spacebar Play/Pause, Loop)
    window.addEventListener('keydown', (e) => {
        const activeTag = document.activeElement ? document.activeElement.tagName.toUpperCase() : '';
        const isEditingText = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || document.activeElement?.isContentEditable;
        if (isEditingText) return;

        const editorModal = document.getElementById('podcast-editor-modal');
        const isDawOpen = editorModal && (
            editorModal.style.display === 'flex' ||
            editorModal.style.display === 'block' ||
            (window.getComputedStyle(editorModal).display !== 'none')
        );

        if (isDawOpen) {
            // Undo / Redo Shortcuts (Cmd+Z, Cmd+Shift+Z, Cmd+Y, Ctrl+Z, Ctrl+Y)
            if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) {
                e.preventDefault();
                if (e.shiftKey) {
                    redoDawAction();
                } else {
                    undoDawAction();
                }
                return;
            }
            if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || e.key === 'Y')) {
                e.preventDefault();
                redoDawAction();
                return;
            }

            // Escape to close active sub-modals (Clip Inspector, FX Rack, or Export Modal)
            if (e.key === 'Escape') {
                const clipModal = document.getElementById('daw-clip-properties-modal');
                const fxModal = document.getElementById('daw-track-fx-modal');
                const exportModal = document.getElementById('daw-export-mixdown-modal');
                if (exportModal && exportModal.style.display !== 'none') {
                    e.preventDefault();
                    closeExportMixdownModal();
                    return;
                }
                if (clipModal && clipModal.style.display !== 'none') {
                    e.preventDefault();
                    clipModal.style.display = 'none';
                    return;
                }
                if (fxModal && fxModal.style.display !== 'none') {
                    e.preventDefault();
                    if (typeof stopFxAudition === 'function') stopFxAudition();
                    fxModal.style.display = 'none';
                    return;
                }
                const pluginsModal = document.getElementById('daw-plugins-directory-modal');
                if (pluginsModal && pluginsModal.style.display !== 'none') {
                    e.preventDefault();
                    pluginsModal.style.display = 'none';
                    return;
                }
                const inspectModal = document.getElementById('daw-import-inspect-modal');
                if (inspectModal && inspectModal.style.display !== 'none') {
                    e.preventDefault();
                    document.getElementById('daw-import-inspect-close-btn')?.click();
                    return;
                }
                const vuWin = document.getElementById('daw-studio-vu-window');
                if (vuWin && vuWin.style.display !== 'none' && !vuWin.classList.contains('is-docked')) {
                    e.preventDefault();
                    vuWin.style.display = 'none';
                    return;
                }
            }

            // Master VU Meter Window Toggle Shortcut (F8)
            if (e.key === 'F8') {
                e.preventDefault();
                document.getElementById('daw-menu-view-vu-meter')?.click();
                return;
            }

            // Open Plugins Directory Drawer Shortcut (Ctrl+Alt+P)
            if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'p' || e.key === 'P')) {
                e.preventDefault();
                document.getElementById('daw-menu-fx-plugins-dir')?.click();
                return;
            }

            // Fullscreen DAW Toggle (F11)
            if (e.key === 'F11') {
                e.preventDefault();
                document.getElementById('daw-fullscreen-btn')?.click();
                return;
            }

            // Collapse / Expand Track Sidebar Shortcut (Alt+S)
            if (e.altKey && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                document.getElementById('daw-menu-view-toggle-sidebar')?.click();
                return;
            }

            // Split / Cut Clip Shortcut (S or B key without modifiers)
            if (!e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 's' || e.key === 'S' || e.key === 'b' || e.key === 'B')) {
                if (daw.selectedClipId) {
                    e.preventDefault();
                    splitSelectedClip();
                    return;
                }
            }

            // Toggle Loop / Cycle Playback Shortcut (L without modifiers)
            if (!e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'l' || e.key === 'L')) {
                e.preventDefault();
                document.getElementById('timeline-loop-btn')?.click();
                return;
            }

            // Toggle Audible Metronome Click Track Shortcut (K without modifiers)
            if (!e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'k' || e.key === 'K')) {
                e.preventDefault();
                document.getElementById('timeline-metronome-btn')?.click();
                return;
            }

            // Zoom In / Out Shortcuts (+ / -)
            if (e.key === '+' || e.key === '=') {
                e.preventDefault();
                document.getElementById('timeline-zoom-in-btn')?.click();
                return;
            }
            if (e.key === '-' || e.key === '_') {
                e.preventDefault();
                document.getElementById('timeline-zoom-out-btn')?.click();
                return;
            }

            // Cut Shortcut (Ctrl+X / Cmd+X)
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === 'x' || e.key === 'X')) {
                e.preventDefault();
                cutSelectedClipsDAW();
                return;
            }

            // Copy Shortcut (Ctrl+C / Cmd+C)
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === 'c' || e.key === 'C')) {
                e.preventDefault();
                copySelectedClipsDAW();
                return;
            }

            // Paste Shortcut (Ctrl+V / Cmd+V)
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === 'v' || e.key === 'V')) {
                e.preventDefault();
                pasteClipsDAW();
                return;
            }

            // Duplicate Shortcut (Ctrl+D / Cmd+D)
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === 'd' || e.key === 'D')) {
                e.preventDefault();
                document.getElementById('daw-menu-edit-duplicate')?.click();
                return;
            }

            // Select All (Ctrl+A / Cmd+A)
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === 'a' || e.key === 'A')) {
                e.preventDefault();
                document.getElementById('daw-menu-edit-select-all')?.click();
                return;
            }

            // Ripple Delete Shortcut (Shift + Delete / Shift + Backspace)
            if (e.shiftKey && (e.key === 'Delete' || e.key === 'Backspace')) {
                if (daw.selectedClipId || (daw.selectedClipIds && daw.selectedClipIds.size > 0)) {
                    e.preventDefault();
                    deleteSelectedClip(true);
                    return;
                }
            }

            // Delete Selected Clip(s) Shortcut (Delete / Backspace)
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (daw.selectedClipId || (daw.selectedClipIds && daw.selectedClipIds.size > 0)) {
                    e.preventDefault();
                    deleteSelectedClip(daw.isRippleEnabled);
                    return;
                }
            }

            // Toggle Voice-Over Recording Shortcut (R key without modifiers)
            if (!e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'r' || e.key === 'R')) {
                e.preventDefault();
                toggleDawRecording();
                return;
            }

            // Drop Scene Marker at Playhead Shortcut (M key without modifiers)
            if (!e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'm' || e.key === 'M')) {
                e.preventDefault();
                document.getElementById('timeline-add-marker-btn')?.click();
                return;
            }

            // Render Master Mix Shortcut (Ctrl+M / Cmd+M)
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === 'm' || e.key === 'M')) {
                e.preventDefault();
                document.getElementById('timeline-render-btn')?.click();
                return;
            }

            // Export All Stems as ZIP Shortcut (Ctrl+Shift+E / Cmd+Shift+E)
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'e' || e.key === 'E')) {
                e.preventDefault();
                exportAllStemsZipDAW();
                return;
            }

            // Punch In Point Shortcut (I without modifiers)
            if (!e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'i' || e.key === 'I')) {
                e.preventDefault();
                document.getElementById('timeline-punch-in-btn')?.click();
                return;
            }

            // Punch Out Point Shortcut (O without modifiers)
            if (!e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'o' || e.key === 'O')) {
                e.preventDefault();
                document.getElementById('timeline-punch-out-btn')?.click();
                return;
            }

            // Toggle Motion Picture Video Preview Monitor Shortcut (V key without modifiers)
            if (!e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'v' || e.key === 'V')) {
                e.preventDefault();
                document.getElementById('timeline-video-toggle-btn')?.click();
                return;
            }

            // Frame-by-Frame Precision Stepping (Left Arrow = -1 Frame, Right Arrow = +1 Frame when paused)
            if (!e.metaKey && !e.ctrlKey && !e.altKey && !daw.isPlaying && !daw.isRecording) {
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    stepDawFrame(-1);
                    return;
                }
                if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    stepDawFrame(1);
                    return;
                }
            }

            // Spacebar Play / Pause (or Stop Recording if active)
            if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
                e.preventDefault();
                if (daw.isRecording) {
                    stopDawRecording();
                } else {
                    toggleDawPlay();
                }
                return;
            }
        }

        // Allow Spacebar to toggle preview of active take in Take Inventory if DAW modal is closed
        if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
            if (typeof _activeTakeId !== 'undefined' && _activeTakeId) {
                e.preventDefault();
                if (typeof window._playTake === 'function') {
                    window._playTake(_activeTakeId);
                }
            }
        }
    });