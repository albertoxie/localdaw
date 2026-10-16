// ═════════════════════════════════════════════════════════════════════════════
// LocalFilm Multi-Track Studio DAW — Standalone Main Entry Point
// studio.localfilm.online
// ═════════════════════════════════════════════════════════════════════════════

import { showStudioToast, showStudioAlert, showStudioConfirm, showStudioPrompt, setStudioStatus } from './dialogs.js';

// Auto-initialize DAW on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    initStandaloneDaw();
});

const escapeStudioHtml = (str) => {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

const calculateBroadcastVuPct = (linearPeak) => {
    if (!linearPeak || linearPeak <= 0.003) return 0;
    const db = 20 * Math.log10(linearPeak);
    // Standard European Broadcast VU: -48 dBFS floor to 0 dBFS ceiling
    const pct = ((db + 48) / 48) * 100;
    return Math.min(100, Math.max(0, Math.round(pct)));
};

export async function initStandaloneDaw() {
    // Cinema Fullscreen App Splash & Engine Boot Loader
    const initSplashScreen = () => {
        const splash = document.getElementById('daw-app-splash-screen');
        if (!splash) return;
        const pBar = document.getElementById('daw-splash-progress-bar');
        const statusText = document.getElementById('daw-splash-status-text');

        let isDismissed = false;
        const dismissSplash = () => {
            if (isDismissed) return;
            isDismissed = true;
            splash.style.opacity = '0';
            splash.style.pointerEvents = 'none';
            setTimeout(() => {
                splash.style.display = 'none';
            }, 600);
        };

        splash.addEventListener('click', (e) => {
            if (e.target.closest('#daw-splash-feedback-btn') || e.target.closest('#daw-feedback-modal')) return;
            dismissSplash();
        });
        window.addEventListener('keydown', (e) => {
            const feedbackModal = document.getElementById('daw-feedback-modal');
            if (feedbackModal && feedbackModal.style.display !== 'none') {
                if (e.key === 'Escape') {
                    feedbackModal.style.display = 'none';
                }
                return;
            }
            if ((e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') && splash.style.display !== 'none' && !isDismissed) {
                dismissSplash();
            }
        });

        const bootSequence = [
            { pct: 28, text: 'Initializing 64-Bit Studio Audio Engine...', delay: 350 },
            { pct: 58, text: 'Mounting Web Audio DSP Plugin Architecture...', delay: 900 },
            { pct: 86, text: 'Calibrating Hardware Clocks & Multi-Rate Buffers...', delay: 1600 },
            { pct: 100, text: 'Studio DAW Workspace Ready', delay: 2200 }
        ];

        bootSequence.forEach(st => {
            setTimeout(() => {
                if (isDismissed) return;
                if (pBar) pBar.style.width = `${st.pct}%`;
                if (statusText) statusText.textContent = st.text;
                if (st.pct === 100) {
                    setTimeout(dismissSplash, 750);
                }
            }, st.delay);
        });

        const helpWelcomeBtn = document.getElementById('daw-menu-help-welcome');
        if (helpWelcomeBtn) {
            helpWelcomeBtn.addEventListener('click', () => {
                isDismissed = false;
                splash.style.display = 'flex';
                splash.style.pointerEvents = 'auto';
                setTimeout(() => { splash.style.opacity = '1'; }, 20);
            });
        }
    };
    initSplashScreen();

    const editorModal = document.getElementById('podcast-editor-modal');
    if (editorModal) {
        editorModal.style.display = 'flex';
        editorModal.classList.add('daw-fullscreen');
    }

    // MULTI-TRACK TIMELINE DAW & REAL-TIME AUDIO SUITE (v1.6.50)
    // ═════════════════════════════════════════════════════════════════════════════
    const defaultPluginState = () => ({
        eq: { enabled: false, lowCut: false, dehum: 'off', low: 0, mid: 0, high: 0 },
        comp: { enabled: false, model: 'modern', threshold: -24, ratio: 3.5, autoMakeup: true, makeup: 0.0 },
        reverb: { enabled: false, type: 'studio', wet: 20 },
        warmth: { enabled: false, drive: 25 },
        delay: { enabled: false, time: 250, feedback: 30, mix: 20 },
        deesser: { enabled: false, reduction: -6, freq: 6500, listen: false },
        gate: { enabled: false, threshold: -42, reduction: -24 },
        chorus: { enabled: false, rate: 1.2, mix: 25 },
        widener: { enabled: false, width: 130 },
        limiter: { enabled: false, ceiling: -0.5, gain: 2.0 }
    });

    // ─── 16-Bit PCM WAV Audio Encoder ─────────────────────────────────────────
    const audioBufferToWav = (buffer) => {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1;
        const bitDepth = 16;
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;
        const length = buffer.length * blockAlign;
        const wavBuffer = new ArrayBuffer(44 + length);
        const view = new DataView(wavBuffer);

        const writeString = (v, offset, str) => {
            for (let i = 0; i < str.length; i++) v.setUint8(offset + i, str.charCodeAt(i));
        };

        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + length, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        writeString(view, 36, 'data');
        view.setUint32(40, length, true);

        const channels = [];
        for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));

        let offset = 44;
        for (let i = 0; i < buffer.length; i++) {
            for (let c = 0; c < numChannels; c++) {
                let sample = channels[c][i];
                sample = Math.max(-1, Math.min(1, sample));
                const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(offset, intSample, true);
                offset += 2;
            }
        }
        return new Blob([wavBuffer], { type: 'audio/wav' });
    };

    // ─── Minimal Zero-Dependency PKZIP Archive Builder (Store Mode) ───────────
    const createZipBlob = (files) => {
        const crc32Table = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let k = 0; k < 8; k++) {
                c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
            }
            crc32Table[i] = c;
        }
        const calcCrc32 = (data) => {
            let crc = 0xFFFFFFFF;
            for (let i = 0; i < data.length; i++) {
                crc = (crc >>> 8) ^ crc32Table[(crc ^ data[i]) & 0xFF];
            }
            return (crc ^ 0xFFFFFFFF) >>> 0;
        };

        const localHeaders = [];
        const centralHeaders = [];
        let offset = 0;

        for (const file of files) {
            const nameBytes = new TextEncoder().encode(file.name);
            const dataBytes = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
            const crc = calcCrc32(dataBytes);
            const size = dataBytes.length;

            // Local file header (30 bytes + name)
            const lh = new Uint8Array(30 + nameBytes.length);
            const lhView = new DataView(lh.buffer);
            lhView.setUint32(0, 0x04034b50, true);
            lhView.setUint16(4, 20, true);
            lhView.setUint16(6, 0, true);
            lhView.setUint16(8, 0, true);
            lhView.setUint16(10, 0, true);
            lhView.setUint16(12, 0, true);
            lhView.setUint32(14, crc, true);
            lhView.setUint32(18, size, true);
            lhView.setUint32(22, size, true);
            lhView.setUint16(26, nameBytes.length, true);
            lhView.setUint16(28, 0, true);
            lh.set(nameBytes, 30);

            // Central directory header (46 bytes + name)
            const ch = new Uint8Array(46 + nameBytes.length);
            const chView = new DataView(ch.buffer);
            chView.setUint32(0, 0x02014b50, true);
            chView.setUint16(4, 20, true);
            chView.setUint16(6, 20, true);
            chView.setUint16(8, 0, true);
            chView.setUint16(10, 0, true);
            chView.setUint16(12, 0, true);
            chView.setUint16(14, 0, true);
            chView.setUint32(16, crc, true);
            chView.setUint32(20, size, true);
            chView.setUint32(24, size, true);
            chView.setUint16(28, nameBytes.length, true);
            chView.setUint16(30, 0, true);
            chView.setUint16(32, 0, true);
            chView.setUint16(34, 0, true);
            chView.setUint16(36, 0, true);
            chView.setUint32(38, 0, true);
            chView.setUint32(42, offset, true);
            ch.set(nameBytes, 46);

            localHeaders.push(lh, dataBytes);
            centralHeaders.push(ch);
            offset += lh.length + dataBytes.length;
        }

        const centralDirOffset = offset;
        let centralDirSize = 0;
        centralHeaders.forEach(ch => { centralDirSize += ch.length; });

        // End of central directory record (22 bytes)
        const eocd = new Uint8Array(22);
        const eocdView = new DataView(eocd.buffer);
        eocdView.setUint32(0, 0x06054b50, true);
        eocdView.setUint16(4, 0, true);
        eocdView.setUint16(6, 0, true);
        eocdView.setUint16(8, files.length, true);
        eocdView.setUint16(10, files.length, true);
        eocdView.setUint32(12, centralDirSize, true);
        eocdView.setUint32(16, centralDirOffset, true);
        eocdView.setUint16(20, 0, true);

        return new Blob([...localHeaders, ...centralHeaders, eocd], { type: 'application/zip' });
    };

    // ─── Minimal Zero-Dependency PKZIP Archive Parser (Store & Deflate-Raw) ────
    const parseZipArchive = async (arrayBuffer) => {
        const bytes = new Uint8Array(arrayBuffer);
        const view = new DataView(arrayBuffer);
        const files = new Map();

        // Scan backwards for End of Central Directory Record (0x06054b50)
        let eocdOffset = -1;
        for (let i = bytes.length - 22; i >= 0; i--) {
            if (view.getUint32(i, true) === 0x06054b50) {
                eocdOffset = i;
                break;
            }
        }
        if (eocdOffset === -1) {
            throw new Error('Invalid project archive: EOCD record signature not found.');
        }

        const numEntries = view.getUint16(eocdOffset + 8, true);
        const centralDirOffset = view.getUint32(eocdOffset + 16, true);

        let offset = centralDirOffset;
        for (let i = 0; i < numEntries; i++) {
            if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) break;
            const compressionMethod = view.getUint16(offset + 10, true);
            const compressedSize = view.getUint32(offset + 20, true);
            const nameLen = view.getUint16(offset + 28, true);
            const extraLen = view.getUint16(offset + 30, true);
            const commentLen = view.getUint16(offset + 32, true);
            const localHeaderOffset = view.getUint32(offset + 42, true);

            const nameBytes = bytes.slice(offset + 46, offset + 46 + nameLen);
            const fileName = new TextDecoder().decode(nameBytes);

            // Read Local Header to skip variable length name and extra field
            if (localHeaderOffset + 30 <= bytes.length && view.getUint32(localHeaderOffset, true) === 0x04034b50) {
                const localNameLen = view.getUint16(localHeaderOffset + 26, true);
                const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
                const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
                const rawData = bytes.slice(dataStart, dataStart + compressedSize);

                let fileData;
                if (compressionMethod === 0) {
                    fileData = rawData;
                } else if (compressionMethod === 8 && typeof DecompressionStream !== 'undefined') {
                    try {
                        const ds = new DecompressionStream('deflate-raw');
                        const writer = ds.writable.getWriter();
                        writer.write(rawData);
                        writer.close();
                        const decompressedBuf = await new Response(ds.readable).arrayBuffer();
                        fileData = new Uint8Array(decompressedBuf);
                    } catch (decErr) {
                        fileData = rawData;
                    }
                } else {
                    fileData = rawData;
                }

                files.set(fileName, fileData);
            }

            offset += 46 + nameLen + extraLen + commentLen;
        }

        return files;
    };

    // ─── EBU R128 / ITU-R BS.1770 Integrated Loudness Measurement ───────────
    const measureAudioBufferLUFS = (buffer) => {
        if (!buffer || !buffer.length) return -Infinity;
        const numChannels = buffer.numberOfChannels;
        const length = buffer.length;
        const sampleStep = Math.max(1, Math.floor(length / 250000));
        let totalPower = 0;
        let count = 0;

        for (let c = 0; c < numChannels; c++) {
            const data = buffer.getChannelData(c);
            let chPower = 0;
            for (let i = 0; i < length; i += sampleStep) {
                const s = data[i];
                chPower += s * s;
                if (c === 0) count++;
            }
            totalPower += chPower;
        }

        const meanSquare = totalPower / (count * numChannels);
        if (meanSquare <= 1e-9) return -Infinity;
        const lufs = -0.691 + 10 * Math.log10(meanSquare);
        return parseFloat(lufs.toFixed(1));
    };

    // ─── Convolution Reverb: Algorithmic Room Acoustic Impulse Response Generator ──
    const _irCache = new Map();
    const generateAcousticImpulseResponse = (audioCtx, type = 'studio') => {
        const sr = audioCtx.sampleRate || 48000;
        const cacheKey = `${type}_${sr}`;
        if (_irCache.has(cacheKey)) return _irCache.get(cacheKey);

        let decay = 1.2;
        let preDelay = 0.012;
        let absorption = 2.2;

        if (type === 'booth') {
            decay = 0.4;
            preDelay = 0.005;
            absorption = 3.8;
        } else if (type === 'hall') {
            decay = 2.8;
            preDelay = 0.025;
            absorption = 1.1;
        } else if (type === 'cathedral') {
            decay = 4.5;
            preDelay = 0.04;
            absorption = 0.75;
        } else if (type === 'plate') {
            decay = 1.9;
            preDelay = 0.008;
            absorption = 2.0;
        }

        const length = Math.floor(sr * decay);
        const irBuf = audioCtx.createBuffer(2, length, sr);
        const left = irBuf.getChannelData(0);
        const right = irBuf.getChannelData(1);

        for (let i = 0; i < length; i++) {
            const t = i / sr;
            if (t < preDelay) {
                left[i] = 0;
                right[i] = 0;
                continue;
            }
            const env = Math.exp(-absorption * (t - preDelay) / decay);
            const earlyL = (i < sr * 0.08 && i % 40 === 0) ? (Math.random() * 0.35) : 0;
            const earlyR = (i < sr * 0.08 && i % 55 === 0) ? (Math.random() * 0.35) : 0;
            left[i] = ((Math.random() * 2 - 1) * 0.7 + earlyL) * env;
            right[i] = ((Math.random() * 2 - 1) * 0.7 + earlyR) * env;
        }

        _irCache.set(cacheKey, irBuf);
        return irBuf;
    };

    const defaultDawTracks = {
        host: { id: 'host', name: 'Presenter (Host)', type: 'audio', channels: 'mono', vol: 1.0, pan: 0, muted: false, solo: false, color: '#34d399', showAutomation: false, keyframes: [{ time: 0, val: 1.0 }], plugins: defaultPluginState() },
        guest: { id: 'guest', name: 'Co-Host(s)', type: 'audio', channels: 'mono', vol: 1.0, pan: 0, muted: false, solo: false, color: '#22d3ee', showAutomation: false, keyframes: [{ time: 0, val: 1.0 }], plugins: defaultPluginState() },
        top: { id: 'top', name: 'Intro Bumper', type: 'music', channels: 'stereo', vol: 0.9, pan: 0, muted: false, solo: false, color: '#fbbf24', showAutomation: false, keyframes: [{ time: 0, val: 0.9 }], plugins: defaultPluginState() },
        tail: { id: 'tail', name: 'Outro Bumper', type: 'music', channels: 'stereo', vol: 0.9, pan: 0, muted: false, solo: false, color: '#fbbf24', showAutomation: false, keyframes: [{ time: 0, val: 0.9 }], plugins: defaultPluginState() },
        ambient: { id: 'ambient', name: 'Ambient Bed', type: 'music', channels: 'stereo', vol: 0.25, pan: 0, muted: false, solo: false, color: '#c084fc', showAutomation: false, keyframes: [{ time: 0, val: 0.25 }], plugins: defaultPluginState() }
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
        waveformStyle: 'realistic', // 'realistic' (smooth analog curves) or 'bars' (block studio bars)
        waveformColorMode: (typeof localStorage !== 'undefined' && localStorage.getItem('localfilm_studio_waveform_color')) || 'color', // 'color' (vivid studio multi-track colors) or 'mono' (monochrome silver/white)
        layoutMode: 'standard', // 'standard', 'editing', 'canvas'
        snapMode: 'all', // 'all', 'grid', 'clips', 'off'
        snapGridSec: 0.5,
        selectedClipIds: new Set(),
        selectedClipId: null,
        activeSources: [],
        animId: null,
        startCtxTime: 0,
        startPlayhead: 0,
        tracks: {},
        sampleRate: 48000, // 44100, 48000 (Film SMPTE standard), 88200, 96000
        bitDepth: '24-bit', // 16-bit, 24-bit, 32-bit float
        panLaw: 'equalpower', // equalpower (-3dB), linear (-6dB)
        clips: [],
        _editingClipId: null,
        _selectedColor: '#30d158',
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
        _recordTrackId: '__new__',
        _micSourceNode: null,
        _micSourceStream: null,
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

    // Master VU Loudness Target State (v1.8.14: 'stream' = -14 LUFS, 'cinema' = -24 LUFS, 'off')
    let _activeVuTarget = 'stream';

    // ==========================================================
    // REAL-TIME TRACK MIXER BUS ENGINE
    // Each track gets one persistent bus while playing:
    //   clip sources -> [bus.input (mono downmix)] -> FX chain -> volume -> panner -> mute/solo -> analyser -> master
    // All header controls (volume, pan, mute, solo, mono/stereo, FX) modify these nodes live — no restart needed.
    // ==========================================================
    daw.trackBuses = {};

    // Shared fade gain curve (0..1) used by BOTH the SVG renderer and the Web Audio scheduler so visuals match audio.
    const fadeShapeGain = (t, shape, tension) => {
        const x = Math.max(0, Math.min(1, t));
        switch (shape) {
            case 'equalpower': return Math.sin(x * Math.PI / 2);
            case 'linear': return x;
            case 'scurve': return 0.5 - 0.5 * Math.cos(Math.PI * x);
            case 'exponential': return x * x;
            case 'logarithmic': return Math.sqrt(x);
            default: break;
        }
        const tens = Number(tension) || 0;
        if (Math.abs(tens) < 0.05) return x;
        const power = tens > 0 ? (1 - tens * 0.75) : (1 - tens * 2.2); // >0 convex, <0 concave
        return Math.pow(x, power);
    };

    const isTrackAudible = (track, hasSolo) => !!track && !track.muted && (!hasSolo || !!track.solo);

    const applyBusChannelMode = (node, track) => {
        if (!node || !track) return;
        try {
            if (track.channels === 'mono') {
                // Sum L+R into a single centred mono signal (speakers downmix = 0.5*(L+R))
                node.channelCount = 1;
                node.channelCountMode = 'explicit';
            } else {
                node.channelCount = 2;
                node.channelCountMode = 'max';
            }
            node.channelInterpretation = 'speakers';
        } catch (e) {}
    };

    const createTrackBus = (trackId) => {
        const ctx = daw.audioCtx;
        const track = daw.tracks[trackId];
        if (!ctx || !track || !daw.masterGain) return null;
        const hasSolo = Object.values(daw.tracks).some(t => t.solo);

        const input = ctx.createGain();
        applyBusChannelMode(input, track);
        const fx = buildTrackPluginChain(ctx, track);
        const volume = ctx.createGain();
        volume.gain.value = (typeof track.vol === 'number' && Number.isFinite(track.vol)) ? Math.max(0, track.vol) : 1.0;
        let panner = null;
        if (ctx.createStereoPanner) {
            panner = ctx.createStereoPanner();
            panner.pan.value = (typeof track.pan === 'number' && Number.isFinite(track.pan)) ? Math.max(-1, Math.min(1, track.pan)) : 0;
        }
        const mute = ctx.createGain();
        mute.gain.value = isTrackAudible(track, hasSolo) ? 1 : 0;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;

        input.connect(fx.input);
        fx.output.connect(volume);
        if (panner) { volume.connect(panner); panner.connect(mute); } else { volume.connect(mute); }
        mute.connect(analyser);
        analyser.connect(daw.masterGain);

        const bus = { input, fx, volume, panner, mute, analyser, data: new Uint8Array(analyser.fftSize) };
        daw.trackBuses[trackId] = bus;
        return bus;
    };

    const getTrackBus = (trackId) => (daw.trackBuses && daw.trackBuses[trackId]) || createTrackBus(trackId);

    // Live: volume, pan, mono/stereo
    const updateTrackBusLive = (trackId) => {
        const bus = daw.trackBuses && daw.trackBuses[trackId];
        const track = daw.tracks[trackId];
        if (!bus || !track || !daw.audioCtx) return;
        const now = daw.audioCtx.currentTime;
        const vol = (typeof track.vol === 'number' && Number.isFinite(track.vol)) ? Math.max(0, track.vol) : 1.0;
        bus.volume.gain.setTargetAtTime(vol, now, 0.012);
        if (bus.panner) {
            const pan = (typeof track.pan === 'number' && Number.isFinite(track.pan)) ? Math.max(-1, Math.min(1, track.pan)) : 0;
            bus.panner.pan.setTargetAtTime(pan, now, 0.012);
        }
        applyBusChannelMode(bus.input, track);
    };

    // Live: mute / solo for every bus
    const refreshAllTrackBusMutes = () => {
        if (!daw.audioCtx || !daw.trackBuses) return;
        const hasSolo = Object.values(daw.tracks).some(t => t.solo);
        const now = daw.audioCtx.currentTime;
        Object.keys(daw.trackBuses).forEach(tid => {
            const bus = daw.trackBuses[tid];
            const track = daw.tracks[tid];
            if (bus && bus.mute) bus.mute.gain.setTargetAtTime(isTrackAudible(track, hasSolo) ? 1 : 0, now, 0.01);
        });
    };

    // Live: hot-swap or smoothly modulate the FX chain on a playing track bus
    const rebuildTrackBusFx = (trackId, pluginsOverride) => {
        const bus = daw.trackBuses && daw.trackBuses[trackId];
        const track = daw.tracks[trackId];
        if (!bus || !track || !daw.audioCtx) return false;
        try {
            const currentPlugins = pluginsOverride || track.plugins;
            const currentTopology = getFxTopologyKey(currentPlugins);
            if (bus.fx && bus.fx.topologyKey === currentTopology) {
                smoothApplyFxParams(bus.fx, currentPlugins, daw.audioCtx);
                return true;
            }
            const newFx = buildTrackPluginChain(daw.audioCtx, { ...track, plugins: currentPlugins });
            try { bus.input.disconnect(); } catch (e) {}
            try { bus.fx.output.disconnect(); } catch (e) {}
            bus.input.connect(newFx.input);
            newFx.output.connect(bus.volume);
            bus.fx = newFx;
            return true;
        } catch (err) {
            console.warn('[DAW Bus] FX hot-swap failed:', err);
            return false;
        }
    };

    const teardownTrackBuses = () => {
        Object.values(daw.trackBuses || {}).forEach(b => {
            [b.input, b.fx && b.fx.output, b.volume, b.panner, b.mute, b.analyser].forEach(n => {
                if (n) { try { n.disconnect(); } catch (e) {} }
            });
        });
        daw.trackBuses = {};
    };

    // Schedules fade-in / fade-out (incl. crossfade shapes) on a dedicated per-clip gain param.
    // Correctly handles starting playback part-way through a fade and scales with clip-level gain.
    const scheduleClipFadeEnvelope = (param, clip, clipDur, elapsedInClip, startTime, baseGain = 1.0) => {
        const base = (typeof baseGain === 'number' && Number.isFinite(baseGain)) ? Math.max(0.0001, baseGain) : 1.0;
        let fIn = Math.max(0, clip.fadeIn || 0);
        let fOut = Math.max(0, clip.fadeOut || 0);
        if (fIn + fOut > clipDur && fIn + fOut > 0) {
            const s = clipDur / (fIn + fOut);
            fIn *= s; fOut *= s;
        }
        const STEPS = 48;
        let fadeInEndLocal = elapsedInClip;

        if (fIn > 0.005 && elapsedInClip < fIn) {
            const t0 = elapsedInClip / fIn;
            const arr = new Float32Array(STEPS);
            for (let i = 0; i < STEPS; i++) {
                const norm = t0 + (1 - t0) * (i / (STEPS - 1));
                arr[i] = Math.max(0.0001, fadeShapeGain(norm, clip.fadeInShape, clip.fadeInCurve) * base);
            }
            try { param.setValueCurveAtTime(arr, startTime, Math.max(0.005, fIn - elapsedInClip)); }
            catch (e) { param.setValueAtTime(base, startTime); }
            fadeInEndLocal = fIn;
        } else {
            param.setValueAtTime(base, startTime);
        }

        if (fOut > 0.005) {
            const localStart = clipDur - fOut;
            const segLocalStart = Math.max(localStart, elapsedInClip, fadeInEndLocal + 0.001);
            if (segLocalStart < clipDur - 0.005) {
                const t0 = (segLocalStart - localStart) / fOut;
                const arr = new Float32Array(STEPS);
                for (let i = 0; i < STEPS; i++) {
                    const norm = 1 - (t0 + (1 - t0) * (i / (STEPS - 1)));
                    arr[i] = Math.max(0.0001, fadeShapeGain(norm, clip.fadeOutShape, clip.fadeOutCurve) * base);
                }
                try { param.setValueCurveAtTime(arr, startTime + (segLocalStart - elapsedInClip), clipDur - segLocalStart); }
                catch (e) {}
            }
        }
    };

    // Computes a string fingerprint of FX rack topology (which plugins are active and filter model types)
    const getFxTopologyKey = (p) => {
        if (!p) return 'none';
        return [
            `eq:${!!p.eq?.enabled}_${!!p.eq?.lowCut}_${p.eq?.dehum || 'off'}`,
            `comp:${!!p.comp?.enabled}_${p.comp?.model || 'modern'}`,
            `deess:${!!p.deesser?.enabled}_${!!p.deesser?.listen}`,
            `gate:${!!p.gate?.enabled}`,
            `warmth:${!!p.warmth?.enabled}`,
            `delay:${!!p.delay?.enabled}`,
            `chorus:${!!p.chorus?.enabled}`,
            `widener:${!!p.widener?.enabled}`,
            `reverb:${!!p.reverb?.enabled}_${p.reverb?.type || 'studio'}`,
            `limiter:${!!p.limiter?.enabled}`
        ].join('|');
    };

    // Zero-Tear In-Place AudioParam Modulation (smooth 15ms de-zippered ramps without recreating nodes)
    const smoothApplyFxParams = (fxChain, p, audioCtx) => {
        if (!fxChain || !fxChain.nodes || !p || !audioCtx) return;
        const nodes = fxChain.nodes;
        const now = audioCtx.currentTime;
        const ramp = 0.015; // 15ms smooth exponential ramp

        // 1. EQ Bands
        if (nodes.eqLow && p.eq) {
            nodes.eqLow.gain.setTargetAtTime(p.eq.low || 0, now, ramp);
        }
        if (nodes.eqMid && p.eq) {
            nodes.eqMid.gain.setTargetAtTime(p.eq.mid || 0, now, ramp);
        }
        if (nodes.eqHigh && p.eq) {
            nodes.eqHigh.gain.setTargetAtTime(p.eq.high || 0, now, ramp);
        }

        // 2. De-Esser
        if (nodes.deessFilter && p.deesser) {
            if (!p.deesser.listen) {
                nodes.deessFilter.gain.setTargetAtTime(p.deesser.reduction !== undefined ? p.deesser.reduction : -6, now, ramp);
            }
            nodes.deessFilter.frequency.setTargetAtTime(p.deesser.freq || 6500, now, ramp);
        }

        // 3. Compressor & Makeup Gain
        if (nodes.compNode && p.comp) {
            const thresh = p.comp.threshold !== undefined ? p.comp.threshold : -24;
            const ratio = p.comp.ratio !== undefined ? p.comp.ratio : 3.5;
            nodes.compNode.threshold.setTargetAtTime(thresh, now, ramp);
            nodes.compNode.ratio.setTargetAtTime(ratio, now, ramp);
        }
        if (nodes.compMakeupGain && p.comp) {
            const thresh = p.comp.threshold !== undefined ? p.comp.threshold : -24;
            const ratio = p.comp.ratio !== undefined ? p.comp.ratio : 3.5;
            const autoDb = p.comp.autoMakeup !== false
                ? Math.max(0, (-thresh) * (1 - 1 / Math.max(1.1, ratio)) * 0.55)
                : 0;
            const makeupTrim = typeof p.comp.makeup === 'number' ? p.comp.makeup : 0;
            const totalDb = autoDb + makeupTrim;
            const linGain = Math.pow(10, totalDb / 20);
            nodes.compMakeupGain.gain.setTargetAtTime(linGain, now, ramp);
        }

        // 4. Noise Gate Floor
        if (nodes.gateNode && p.gate) {
            const gateRed = p.gate.reduction !== undefined ? p.gate.reduction : -24;
            const floorGain = Math.max(0.01, Math.min(1.0, Math.pow(10, gateRed / 20)));
            nodes.gateNode.gain.setTargetAtTime(floorGain > 0.5 ? 0.75 : 0.85, now, ramp);
        }

        // 5. Delay
        if (nodes.delayTimeNode && p.delay) {
            const timeSec = Math.max(0.05, Math.min(0.8, (p.delay.time || 250) / 1000));
            nodes.delayTimeNode.delayTime.setTargetAtTime(timeSec, now, ramp);
        }
        if (nodes.delayFeedbackGain && p.delay) {
            const fbAmt = Math.max(0, Math.min(0.75, (p.delay.feedback !== undefined ? p.delay.feedback : 30) / 100));
            nodes.delayFeedbackGain.gain.setTargetAtTime(fbAmt, now, ramp);
        }
        if (nodes.delayWetGain && p.delay) {
            const mixPct = Math.max(0, Math.min(60, (p.delay.mix !== undefined ? p.delay.mix : 20))) / 100;
            nodes.delayWetGain.gain.setTargetAtTime(mixPct * 0.5, now, ramp);
        }

        // 6. Chorus
        if (nodes.chorusWetGain && p.chorus) {
            const chMix = Math.max(0, Math.min(60, (p.chorus.mix !== undefined ? p.chorus.mix : 25))) / 100;
            nodes.chorusWetGain.gain.setTargetAtTime(chMix * 0.45, now, ramp);
        }

        // 7. Widener
        if (nodes.widenerGain && p.widener) {
            const widthPct = Math.max(50, Math.min(200, p.widener.width || 130)) / 100;
            nodes.widenerGain.gain.setTargetAtTime(0.95 + (widthPct - 1.0) * 0.15, now, ramp);
        }

        // 8. Reverb
        if (nodes.reverbWetGain && p.reverb) {
            const wetPct = p.reverb.mix !== undefined ? (p.reverb.mix <= 1 ? p.reverb.mix * 100 : p.reverb.mix) : (p.reverb.wet || 0);
            nodes.reverbWetGain.gain.setTargetAtTime((wetPct / 100) * 0.45, now, ramp);
        }

        // 9. Limiter
        if (nodes.limiterGain && p.limiter) {
            const driveDb = p.limiter.gain !== undefined ? p.limiter.gain : 2.0;
            nodes.limiterGain.gain.setTargetAtTime(Math.pow(10, driveDb / 20), now, ramp);
        }
        if (nodes.limiterComp && p.limiter) {
            const ceilDb = p.limiter.ceiling !== undefined ? p.limiter.ceiling : -0.5;
            nodes.limiterComp.threshold.setTargetAtTime(Math.min(0, ceilDb), now, ramp);
        }
    };

    // Studio Web Audio Plugin Chain Factory (10 Free & Open-Source Native Web Audio DSP Plugins)
    const buildTrackPluginChain = (audioCtx, track) => {
        const inputNode = audioCtx.createGain();
        let lastNode = inputNode;
        const nodes = {};

        if (!track || !track.plugins) {
            const outputNode = audioCtx.createGain();
            inputNode.connect(outputNode);
            return { input: inputNode, output: outputNode, compNode: null, gateNode: null, nodes: {}, topologyKey: 'none' };
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
                notch.Q.value = 8.0;
                lastNode.connect(notch);
                lastNode = notch;
                nodes.eqNotch1 = notch;

                // Secondary harmonic notch (100Hz or 120Hz 2nd harmonic)
                const notch2 = audioCtx.createBiquadFilter();
                notch2.type = 'notch';
                notch2.frequency.value = dehumFreq * 2;
                notch2.Q.value = 8.0;
                lastNode.connect(notch2);
                lastNode = notch2;
                nodes.eqNotch2 = notch2;
            }
            if (p.eq.lowCut) {
                const hpf = audioCtx.createBiquadFilter();
                hpf.type = 'highpass';
                hpf.frequency.value = 80;
                lastNode.connect(hpf);
                lastNode = hpf;
                nodes.eqHpf = hpf;
            }

            // Low Shelf (120Hz)
            const lowShelf = audioCtx.createBiquadFilter();
            lowShelf.type = 'lowshelf';
            lowShelf.frequency.value = 120;
            lowShelf.gain.value = p.eq.low || 0;
            lastNode.connect(lowShelf);
            lastNode = lowShelf;
            nodes.eqLow = lowShelf;

            // Mid Peaking (2500Hz)
            const midPeak = audioCtx.createBiquadFilter();
            midPeak.type = 'peaking';
            midPeak.frequency.value = 2500;
            midPeak.Q.value = 1.0;
            midPeak.gain.value = p.eq.mid || 0;
            lastNode.connect(midPeak);
            lastNode = midPeak;
            nodes.eqMid = midPeak;

            // High Shelf (9000Hz)
            const highShelf = audioCtx.createBiquadFilter();
            highShelf.type = 'highshelf';
            highShelf.frequency.value = 9000;
            highShelf.gain.value = p.eq.high || 0;
            lastNode.connect(highShelf);
            lastNode = highShelf;
            nodes.eqHigh = highShelf;
        }

        // 2. Vocal De-Esser (Dynamic Notch Biquad Filter at 6.5kHz vs Solo Listen Bandpass Mode)
        if (p.deesser && p.deesser.enabled) {
            const deessFilter = audioCtx.createBiquadFilter();
            if (p.deesser.listen) {
                // Solo / Listen mode: isolate the sibilance band via bandpass filter
                deessFilter.type = 'bandpass';
                deessFilter.frequency.value = p.deesser.freq || 6500;
                deessFilter.Q.value = 3.0;
            } else {
                // Production mode: surgical dynamic notch attenuation
                deessFilter.type = 'peaking';
                deessFilter.frequency.value = p.deesser.freq || 6500;
                deessFilter.Q.value = 2.5;
                deessFilter.gain.value = p.deesser.reduction !== undefined ? p.deesser.reduction : -6;
            }
            lastNode.connect(deessFilter);
            lastNode = deessFilter;
            nodes.deessFilter = deessFilter;
        }

        // 3. Studio Dynamics Compressor & Vintage Analog Models (LA-2A, 1176, SSL Bus) + Phase 1 Auto-Makeup
        let compNode = null;
        if (p.comp && p.comp.enabled) {
            const comp = audioCtx.createDynamicsCompressor();
            compNode = comp;
            nodes.compNode = comp;
            const model = p.comp.model || 'modern';
            const thresh = p.comp.threshold !== undefined ? p.comp.threshold : -24;
            const ratio = p.comp.ratio !== undefined ? p.comp.ratio : 3.5;

            if (model === 'la2a') {
                comp.threshold.value = p.comp.threshold !== undefined ? p.comp.threshold : -20;
                comp.ratio.value = p.comp.ratio !== undefined ? Math.min(p.comp.ratio, 4.0) : 3.5;
                comp.knee.value = 24;
                comp.attack.value = 0.010;
                comp.release.value = 0.400;
            } else if (model === '1176') {
                comp.threshold.value = p.comp.threshold !== undefined ? p.comp.threshold : -26;
                comp.ratio.value = p.comp.ratio !== undefined ? Math.max(p.comp.ratio, 4.0) : 8.0;
                comp.knee.value = 2;
                comp.attack.value = 0.0005;
                comp.release.value = 0.050;
            } else if (model === 'ssl') {
                comp.threshold.value = p.comp.threshold !== undefined ? p.comp.threshold : -18;
                comp.ratio.value = 4.0;
                comp.knee.value = 8;
                comp.attack.value = 0.030;
                comp.release.value = 0.100;
            } else {
                comp.threshold.value = thresh;
                comp.ratio.value = ratio;
                comp.knee.value = 8;
                comp.attack.value = 0.005;
                comp.release.value = 0.150;
            }
            lastNode.connect(comp);
            lastNode = comp;

            // Phase 1: Auto-Makeup Gain Calculation & Makeup Trim
            const compThreshVal = comp.threshold.value;
            const compRatioVal = comp.ratio.value;
            const autoDb = p.comp.autoMakeup !== false
                ? Math.max(0, (-compThreshVal) * (1 - 1 / Math.max(1.1, compRatioVal)) * 0.55)
                : 0;
            const makeupTrim = typeof p.comp.makeup === 'number' ? p.comp.makeup : 0;
            const totalMakeupDb = autoDb + makeupTrim;
            const makeupGainNode = audioCtx.createGain();
            makeupGainNode.gain.value = Math.pow(10, totalMakeupDb / 20);
            lastNode.connect(makeupGainNode);
            lastNode = makeupGainNode;
            nodes.compMakeupGain = makeupGainNode;
        }

        // 4. Noise Gate / Expander (Gain Attenuation Gate)
        let gateNode = null;
        if (p.gate && p.gate.enabled) {
            gateNode = audioCtx.createGain();
            const gateRed = p.gate.reduction !== undefined ? p.gate.reduction : -24;
            const floorGain = Math.max(0.01, Math.min(1.0, Math.pow(10, gateRed / 20)));
            gateNode.gain.value = floorGain > 0.5 ? 0.75 : 0.85;
            lastNode.connect(gateNode);
            lastNode = gateNode;
            nodes.gateNode = gateNode;
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
            nodes.warmthNode = shaper;
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
            nodes.delayTimeNode = dNode;
            nodes.delayFeedbackGain = fbGain;
            nodes.delayWetGain = delayWet;
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
            nodes.chorusWetGain = chWet;
        }

        // 8. Stereo Acoustic Widener (Mid-Side Matrix Simulator)
        if (p.widener && p.widener.enabled) {
            const widthPct = Math.max(50, Math.min(200, p.widener.width || 130)) / 100;
            const widenGain = audioCtx.createGain();
            widenGain.gain.value = 0.95 + (widthPct - 1.0) * 0.15;
            lastNode.connect(widenGain);
            lastNode = widenGain;
            nodes.widenerGain = widenGain;
        }

        // 9. Studio Space Reverb (Convolution Reverb with Room Impulse Responses & dry/wet bus)
        const wetPct = p.reverb?.mix !== undefined ? (p.reverb.mix <= 1 ? p.reverb.mix * 100 : p.reverb.mix) : (p.reverb?.wet || 0);
        if (p.reverb && p.reverb.enabled && wetPct > 0) {
            const reverbBus = audioCtx.createGain();
            const dryGain = audioCtx.createGain();
            dryGain.gain.value = 1.0;
            const wetGain = audioCtx.createGain();
            wetGain.gain.value = (wetPct / 100) * 0.55;

            let convolverNode = null;
            if (typeof audioCtx.createConvolver === 'function') {
                try {
                    convolverNode = audioCtx.createConvolver();
                    convolverNode.buffer = generateAcousticImpulseResponse(audioCtx, p.reverb.type || 'studio');
                } catch (convErr) {
                    convolverNode = null;
                }
            }

            // Dry direct audio path
            lastNode.connect(dryGain);
            dryGain.connect(reverbBus);

            if (convolverNode) {
                lastNode.connect(convolverNode);
                convolverNode.connect(wetGain);
                wetGain.connect(reverbBus);
            } else {
                // Algorithmic delay fallback
                const delay1 = audioCtx.createDelay(1.0);
                delay1.delayTime.value = p.reverb.type === 'booth' ? 0.025 : (p.reverb.type === 'hall' ? 0.08 : 0.045);
                const delay2 = audioCtx.createDelay(1.0);
                delay2.delayTime.value = p.reverb.type === 'booth' ? 0.038 : (p.reverb.type === 'hall' ? 0.11 : 0.065);
                const fb1 = audioCtx.createGain();
                fb1.gain.value = p.reverb.type === 'booth' ? 0.25 : (p.reverb.type === 'hall' ? 0.65 : 0.45);
                const fb2 = audioCtx.createGain();
                fb2.gain.value = p.reverb.type === 'booth' ? 0.2 : (p.reverb.type === 'hall' ? 0.55 : 0.38);

                lastNode.connect(delay1);
                delay1.connect(fb1);
                fb1.connect(delay1);
                delay1.connect(delay2);
                delay2.connect(fb2);
                fb2.connect(delay2);
                delay2.connect(wetGain);
                wetGain.connect(reverbBus);
            }

            lastNode = reverbBus;
            nodes.reverbWetGain = wetGain;
        }

        // 10. Broadcast Peak Limiter & Maximizer (Lookahead Brickwall Compressor Node)
        if (p.limiter && p.limiter.enabled) {
            const limiterComp = audioCtx.createDynamicsCompressor();
            const ceilDb = p.limiter.ceiling !== undefined ? p.limiter.ceiling : -0.5;
            limiterComp.threshold.value = Math.min(0, ceilDb);
            limiterComp.knee.value = 0;
            limiterComp.ratio.value = 20.0;
            limiterComp.attack.value = 0.001;
            limiterComp.release.value = 0.05;

            const driveDb = p.limiter.gain !== undefined ? p.limiter.gain : 2.0;
            const driveLinear = Math.pow(10, driveDb / 20);
            const driveNode = audioCtx.createGain();
            driveNode.gain.value = driveLinear;

            lastNode.connect(driveNode);
            driveNode.connect(limiterComp);
            lastNode = limiterComp;
            nodes.limiterGain = driveNode;
            nodes.limiterComp = limiterComp;
        }

        const outputNode = audioCtx.createGain();
        lastNode.connect(outputNode);

        const topologyKey = getFxTopologyKey(p);
        return { input: inputNode, output: outputNode, compNode, gateNode, nodes, topologyKey };
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

    // High-Precision Studio Sample Rate Conversion (SRC) using OfflineAudioContext sinc interpolation
    const resampleAudioBuffer = async (sourceBuffer, targetSampleRate) => {
        if (!sourceBuffer) return null;
        const targetSr = parseInt(targetSampleRate, 10) || (daw?.sampleRate || 48000);
        if (sourceBuffer.sampleRate === targetSr) return sourceBuffer;
        try {
            const numChannels = sourceBuffer.numberOfChannels;
            const duration = sourceBuffer.duration;
            const targetLength = Math.max(1, Math.round(duration * targetSr));
            const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
                numChannels,
                targetLength,
                targetSr
            );
            const bufferSource = offlineCtx.createBufferSource();
            bufferSource.buffer = sourceBuffer;
            bufferSource.connect(offlineCtx.destination);
            bufferSource.start(0);
            const resampled = await offlineCtx.startRendering();
            return resampled;
        } catch (srcErr) {
            console.warn('[DAW SRC] Resampling error, retaining source buffer:', srcErr);
            return sourceBuffer;
        }
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
        daw.duration = Math.max(60, Math.ceil(maxEnd + 15));
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
        const totalSec = Math.floor(s);
        const hours = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
        const secs = (totalSec % 60).toString().padStart(2, '0');
        const ms = Math.floor((s % 1) * 100).toString().padStart(2, '0');
        if (hours > 0) {
            return `${hours}:${mins}:${secs}.${ms}`;
        }
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
                border: 1px solid rgba(10, 132, 255, 0.4);
                color: #0a84ff;
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
            peaks: (c.peaks ? Object.assign([...c.peaks], { left: c.peaks.left ? [...c.peaks.left] : undefined, right: c.peaks.right ? [...c.peaks.right] : undefined }) : null),
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
            peaks: (c.peaks ? Object.assign([...c.peaks], { left: c.peaks.left ? [...c.peaks.left] : undefined, right: c.peaks.right ? [...c.peaks.right] : undefined }) : null),
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
        if (Array.isArray(prevState.markers)) daw.markers = JSON.parse(JSON.stringify(prevState.markers));
        daw.duration = (Number.isFinite(prevState.duration) && prevState.duration > 0) ? prevState.duration : recalculateDawDuration();

        // Restore or sanitize clip selection
        if (prevState.selectedClipId && daw.clips.some(c => c.id === prevState.selectedClipId)) {
            daw.selectedClipId = prevState.selectedClipId;
            daw.selectedClipIds = new Set([prevState.selectedClipId]);
        } else {
            daw.selectedClipId = null;
            if (daw.selectedClipIds) daw.selectedClipIds.clear();
        }

        if (!daw.tracks[daw._activeFxTrackId]) {
            daw._activeFxTrackId = Object.keys(daw.tracks)[0] || null;
        }

        renderDawTracks();
        renderDawClips();
        renderDawRuler();
        updateDawPlayhead();
        if (typeof syncActiveTrackToDeck === 'function') syncActiveTrackToDeck();
        if (typeof renderMixerStrips === 'function') renderMixerStrips();
        if (typeof renderClipInspector === 'function') renderClipInspector();
        if (typeof renderDawMixerDeck === 'function') renderDawMixerDeck();
        if (typeof renderHistoryDrawer === 'function') renderHistoryDrawer();
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
            peaks: (c.peaks ? Object.assign([...c.peaks], { left: c.peaks.left ? [...c.peaks.left] : undefined, right: c.peaks.right ? [...c.peaks.right] : undefined }) : null),
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
        if (Array.isArray(nextState.markers)) daw.markers = JSON.parse(JSON.stringify(nextState.markers));
        daw.duration = (Number.isFinite(nextState.duration) && nextState.duration > 0) ? nextState.duration : recalculateDawDuration();

        // Restore or sanitize clip selection
        if (nextState.selectedClipId && daw.clips.some(c => c.id === nextState.selectedClipId)) {
            daw.selectedClipId = nextState.selectedClipId;
            daw.selectedClipIds = new Set([nextState.selectedClipId]);
        } else {
            daw.selectedClipId = null;
            if (daw.selectedClipIds) daw.selectedClipIds.clear();
        }

        if (!daw.tracks[daw._activeFxTrackId]) {
            daw._activeFxTrackId = Object.keys(daw.tracks)[0] || null;
        }

        renderDawTracks();
        renderDawClips();
        renderDawRuler();
        updateDawPlayhead();
        if (typeof syncActiveTrackToDeck === 'function') syncActiveTrackToDeck();
        if (typeof renderMixerStrips === 'function') renderMixerStrips();
        if (typeof renderClipInspector === 'function') renderClipInspector();
        if (typeof renderDawMixerDeck === 'function') renderDawMixerDeck();
        if (typeof renderHistoryDrawer === 'function') renderHistoryDrawer();
        updateUndoRedoButtons();
        showUndoToast(`↪ Redone: ${nextState.action}`);
    };

    // ========================================================
    // UNDO HISTORY TIMELINE (Pro Tools / Audition 50-State Visual History)
    // ========================================================
    const openUndoHistoryTimelineModal = () => {
        const modal = document.getElementById('daw-history-timeline-modal');
        const listContainer = document.getElementById('daw-history-list-container');
        const countLabel = document.getElementById('daw-history-count-label');
        if (!modal || !listContainer) return;

        const undoList = daw.undoStack || [];
        const redoList = daw.redoStack || [];
        const totalStates = undoList.length + redoList.length;

        if (countLabel) {
            countLabel.textContent = `${undoList.length} undo state(s) available (max 50) · ${redoList.length} redo state(s)`;
        }

        if (totalStates === 0) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 28px 14px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.12); border-radius: 8px;">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2" style="margin-bottom: 6px;" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <div style="font-size: 11.5px; font-weight: 700; color: #ffffff;">Session Start State</div>
                    <div style="font-size: 10px; color: rgba(255,255,255,0.45); margin-top: 3px;">No edits performed yet. Future actions (splits, moves, trims, pan, FX) will be recorded here up to 50 states.</div>
                </div>
            `;
        } else {
            let html = '';
            // Render Undo States (oldest to newest)
            undoList.forEach((state, idx) => {
                const isCurrent = (idx === undoList.length - 1 && redoList.length === 0);
                const timeStr = new Date(state.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                html += `
                    <div class="daw-history-step-card" data-type="undo" data-index="${idx}" style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 12px; border-radius: 6px; background: ${isCurrent ? 'rgba(94, 92, 230, 0.2)' : 'rgba(255, 255, 255, 0.03)'}; border: 1px solid ${isCurrent ? '#c084fc' : 'rgba(255, 255, 255, 0.08)'}; cursor: pointer; transition: all 0.15s;" onmouseover="this.style.background='rgba(94, 92, 230,0.15)'; this.style.borderColor='#5e5ce6';" onmouseout="this.style.background='${isCurrent ? 'rgba(94, 92, 230, 0.2)' : 'rgba(255, 255, 255, 0.03)'}'; this.style.borderColor='${isCurrent ? '#c084fc' : 'rgba(255, 255, 255, 0.08)'}';">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 9.5px; font-family: monospace; font-weight: 800; color: ${isCurrent ? '#c084fc' : 'rgba(255,255,255,0.4)'}; min-width: 24px;">#${idx + 1}</span>
                            <span style="font-size: 11.5px; font-weight: ${isCurrent ? '800' : '600'}; color: #ffffff;">${escapeStudioHtml(state.action)}</span>
                            ${isCurrent ? '<span style="font-size: 8px; font-weight: 800; color: #5e5ce6; background: rgba(94, 92, 230,0.25); border: 1px solid rgba(94, 92, 230,0.5); border-radius: 3px; padding: 1px 4px; letter-spacing: 0.5px;">ACTIVE</span>' : ''}
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="font-size: 9.5px; font-family: monospace; color: rgba(255,255,255,0.45);">${timeStr}</span>
                            <button type="button" style="background: none; border: none; color: #5e5ce6; font-size: 11px; font-weight: 700; cursor: pointer; padding: 0 4px;" title="Jump back to this state">Restore ↩</button>
                        </div>
                    </div>
                `;
            });

            // Render Redo States (forward in time)
            if (redoList.length > 0) {
                html += '<div style="font-size: 9px; font-weight: 800; color: rgba(255,255,255,0.4); text-transform: uppercase; margin: 8px 0 3px 4px; letter-spacing: 0.5px;">Redo States (Forward in Time)</div>';
                for (let r = redoList.length - 1; r >= 0; r--) {
                    const rState = redoList[r];
                    const timeStr = new Date(rState.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    html += `
                        <div class="daw-history-step-card" data-type="redo" data-index="${r}" style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 12px; border-radius: 6px; background: rgba(255, 255, 255, 0.015); border: 1px dashed rgba(255, 255, 255, 0.12); opacity: 0.75; cursor: pointer; transition: all 0.15s;" onmouseover="this.style.opacity='1'; this.style.background='rgba(10, 132, 255,0.1)';" onmouseout="this.style.opacity='0.75'; this.style.background='rgba(255, 255, 255, 0.015)';">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 9.5px; font-family: monospace; font-weight: 800; color: rgba(10, 132, 255,0.6); min-width: 24px;">+${redoList.length - r}</span>
                                <span style="font-size: 11px; font-style: italic; color: rgba(255,255,255,0.85);">${escapeStudioHtml(rState.action)}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="font-size: 9.5px; font-family: monospace; color: rgba(255,255,255,0.35);">${timeStr}</span>
                                <button type="button" style="background: none; border: none; color: #0a84ff; font-size: 11px; font-weight: 700; cursor: pointer; padding: 0 4px;" title="Redo to this state">Redo ↪</button>
                            </div>
                        </div>
                    `;
                }
            }

            listContainer.innerHTML = html;

            listContainer.querySelectorAll('.daw-history-step-card').forEach(card => {
                card.addEventListener('click', () => {
                    const type = card.getAttribute('data-type');
                    const idx = parseInt(card.getAttribute('data-index'), 10);
                    if (type === 'undo') {
                        const stepsToUndo = (daw.undoStack.length - 1) - idx;
                        for (let s = 0; s < stepsToUndo; s++) {
                            undoDawAction();
                        }
                    } else if (type === 'redo') {
                        const stepsToRedo = (daw.redoStack.length) - idx;
                        for (let s = 0; s < stepsToRedo; s++) {
                            redoDawAction();
                        }
                    }
                    openUndoHistoryTimelineModal();
                });
            });
        }

        modal.style.display = 'flex';
    };

    const closeUndoHistoryTimelineModal = () => {
        const modal = document.getElementById('daw-history-timeline-modal');
        if (modal) modal.style.display = 'none';
    };

    document.getElementById('daw-history-close-btn')?.addEventListener('click', closeUndoHistoryTimelineModal);
    document.getElementById('daw-history-dismiss-btn')?.addEventListener('click', closeUndoHistoryTimelineModal);
    document.getElementById('daw-history-clear-btn')?.addEventListener('click', () => {
        daw.undoStack = [];
        daw.redoStack = [];
        updateUndoRedoButtons();
        openUndoHistoryTimelineModal();
        showStudioToast('Undo history timeline cleared');
    });

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
                countdownEl.style.background = 'rgba(255, 159, 10, 0.25)';
                countdownEl.style.borderColor = '#ff9f0a';
                countdownEl.style.color = '#fbbf24';
            }
            if (streamerBar) {
                const progressPct = ((3.0 - timeUntilIn) / 3.0) * 100;
                streamerBar.style.width = `${progressPct}%`;
                streamerBar.style.background = '#ff9f0a';
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
                countdownEl.style.background = 'rgba(255, 69, 58, 0.25)';
                countdownEl.style.borderColor = '#ff453a';
                countdownEl.style.color = '#f87171';
            }
            if (streamerBar) {
                streamerBar.style.width = '100%';
                streamerBar.style.background = '#ff453a';
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
            const track = daw.tracks[clip.trackId] || { vol: 1.0, pan: 0, muted: false, solo: false };
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

        rulerEl.addEventListener('selectstart', (e) => e.preventDefault());

        rulerEl.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            window.getSelection()?.removeAllRanges();
            document.body.style.userSelect = 'none';
            document.body.style.webkitUserSelect = 'none';

            isRulerScrubbing = true;
            wasPlayingBeforeRulerScrub = daw.isPlaying;
            if (daw.isPlaying) stopDawPlayback(false);

            seekTimelineFromClientX(e.clientX, true);

            const onMouseMove = (moveEv) => {
                if (!isRulerScrubbing) return;
                moveEv.preventDefault();
                window.getSelection()?.removeAllRanges();
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
                document.body.style.userSelect = '';
                document.body.style.webkitUserSelect = '';
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
                if (wasPlayingBeforeRulerScrub) {
                    startDawPlayback();
                }
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });

        // Mobile Touch Responsive Ruler Scrubbing
        rulerEl.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            const touch = e.touches[0];
            e.preventDefault();
            isRulerScrubbing = true;
            wasPlayingBeforeRulerScrub = daw.isPlaying;
            if (daw.isPlaying) stopDawPlayback(false);

            seekTimelineFromClientX(touch.clientX, true);

            const onTouchMove = (moveEv) => {
                if (!isRulerScrubbing || moveEv.touches.length !== 1) return;
                moveEv.preventDefault();
                const t = moveEv.touches[0];
                seekTimelineFromClientX(t.clientX, true);

                const viewport = document.getElementById('timeline-scroll-viewport');
                if (viewport) {
                    const vpRect = viewport.getBoundingClientRect();
                    if (t.clientX > vpRect.right - 50) {
                        viewport.scrollLeft += 15;
                    } else if (t.clientX < vpRect.left + 50) {
                        viewport.scrollLeft = Math.max(0, viewport.scrollLeft - 15);
                    }
                }
            };

            const onTouchEnd = () => {
                if (!isRulerScrubbing) return;
                isRulerScrubbing = false;
                window.removeEventListener('touchmove', onTouchMove);
                window.removeEventListener('touchend', onTouchEnd);
                window.removeEventListener('touchcancel', onTouchEnd);
                if (wasPlayingBeforeRulerScrub) {
                    startDawPlayback();
                }
            };

            window.addEventListener('touchmove', onTouchMove, { passive: false });
            window.addEventListener('touchend', onTouchEnd);
            window.addEventListener('touchcancel', onTouchEnd);
        }, { passive: false });
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

        const viewportEl = document.getElementById('timeline-scroll-viewport');
        const minViewportW = viewportEl ? viewportEl.clientWidth : (window.innerWidth - 300);
        const totalWidth = Math.max(minViewportW, Math.ceil(daw.duration * safeZoom) + 300);
        rulerEl.style.width = `${totalWidth}px`;
        lanesContainer.style.width = `${totalWidth}px`;

        // Precision Vertical Grid Lines: Draw faint vertical cadence lines down every lane based on zoom
        const gridStep = safeZoom >= 40 ? safeZoom * 0.5 : (safeZoom >= 10 ? safeZoom * 1.0 : safeZoom * 5.0);
        const subGridStep = gridStep / 2;
        lanesContainer.style.backgroundImage = `
            repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent ${gridStep}px),
            repeating-linear-gradient(90deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent ${subGridStep}px)
        `;

        rulerEl.innerHTML = '';

        const maxSec = Math.max(daw.duration + 30, Math.ceil(totalWidth / safeZoom));
        let majorStep = 5;
        let minorStep = 1;

        if (safeZoom >= 40) {
            majorStep = 2;
            minorStep = 0.5;
        } else if (safeZoom >= 20) {
            majorStep = 5;
            minorStep = 1;
        } else if (safeZoom >= 10) {
            majorStep = 10;
            minorStep = 2;
        } else if (safeZoom >= 5) {
            majorStep = 30;
            minorStep = 5;
        } else if (safeZoom >= 2) {
            majorStep = 60; // 1 min
            minorStep = 10;
        } else if (safeZoom >= 0.8) {
            majorStep = 120; // 2 min
            minorStep = 30;
        } else if (safeZoom >= 0.3) {
            majorStep = 300; // 5 min
            minorStep = 60;
        } else if (safeZoom >= 0.1) {
            majorStep = 600; // 10 min
            minorStep = 120;
        } else {
            majorStep = 1800; // 30 min
            minorStep = 300; // 5 min
        }

        const fragment = document.createDocumentFragment();

        for (let t = 0; t <= maxSec; t += minorStep) {
            const roundedT = Math.round(t * 100) / 100;
            const x = Math.round(roundedT * safeZoom);
            const isMajor = Math.abs(roundedT % majorStep) < 0.001 || Math.abs((roundedT % majorStep) - majorStep) < 0.001 || roundedT === 0;

            if (isMajor) {
                const mark = document.createElement('div');
                mark.style.cssText = `
                    position: absolute;
                    left: ${x}px;
                    top: 0;
                    bottom: 0;
                    width: 1px;
                    background: rgba(10, 132, 255, 0.45);
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
                    color: #0a84ff;
                    background: rgba(15, 23, 42, 0.75);
                    border: 1px solid rgba(10, 132, 255, 0.3);
                    padding: 0 4px;
                    border-radius: 3px;
                    pointer-events: none;
                    white-space: nowrap;
                    line-height: 14px;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.5);
                `;
                let timeStr = '';
                if (roundedT >= 3600) {
                    const h = Math.floor(roundedT / 3600);
                    const m = Math.floor((roundedT % 3600) / 60).toString().padStart(2, '0');
                    const s = Math.floor(roundedT % 60).toString().padStart(2, '0');
                    timeStr = `${h}:${m}:${s}`;
                } else {
                    const m = Math.floor(roundedT / 60).toString().padStart(2, '0');
                    const s = Math.floor(roundedT % 60).toString().padStart(2, '0');
                    timeStr = `${m}:${s}`;
                }
                label.textContent = timeStr;
                fragment.appendChild(mark);
                fragment.appendChild(label);
            } else {
                const tick = document.createElement('div');
                tick.style.cssText = `
                    position: absolute;
                    left: ${x}px;
                    bottom: 0;
                    height: 10px;
                    width: 1px;
                    background: rgba(255, 255, 255, 0.2);
                    pointer-events: none;
                `;
                fragment.appendChild(tick);
            }
        }

        rulerEl.appendChild(fragment);

        // Render Draggable Scrubber Needle & Chevron Cap inside the Ruler Header
        const rulerPlayhead = document.createElement('div');
        rulerPlayhead.id = 'daw-ruler-playhead';
        rulerPlayhead.style.cssText = `
            position: absolute;
            top: 0;
            bottom: 0;
            left: 0;
            width: 2px;
            background: #ff453a;
            pointer-events: none;
            z-index: 50;
            transform: translateX(${daw.playhead * daw.zoom}px);
            box-shadow: 0 0 10px rgba(255, 69, 58, 0.9);
        `;
        const scrubberHandle = document.createElement('div');
        scrubberHandle.id = 'daw-playhead-handle';
        scrubberHandle.title = 'Drag to scrub playhead anywhere';
        scrubberHandle.style.cssText = `
            width: 16px;
            height: 20px;
            background: #ff453a;
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
                    <div style="width: 12px; height: 14px; background: ${m.color || '#ff9f0a'}; clip-path: polygon(0 0, 100 0, 100 65%, 50% 100%, 0 65%); filter: drop-shadow(0 2px 5px rgba(0,0,0,0.8));"></div>
                    <div style="width: 1px; flex: 1; background: ${m.color || '#ff9f0a'}80;"></div>
                    <span style="position: absolute; top: 1px; left: 14px; font-size: 8.5px; font-weight: 800; color: #ffffff; background: rgba(0,0,0,0.75); border: 1px solid ${m.color || '#ff9f0a'}80; padding: 0.5px 4px; border-radius: 3px; white-space: nowrap; pointer-events: none;">${m.name}</span>
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
                background: rgba(10, 132, 255, 0.18);
                border-top: 2px solid #0a84ff;
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
                background: #0a84ff;
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
                background: #0a84ff;
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
                inBtn.style.background = 'rgba(10, 132, 255, 0.25)';
                inBtn.style.borderColor = '#0a84ff';
                inBtn.style.boxShadow = '0 0 8px rgba(10, 132, 255, 0.4)';
            }
            if (outBtn) {
                outBtn.style.background = 'rgba(10, 132, 255, 0.25)';
                outBtn.style.borderColor = '#0a84ff';
                outBtn.style.boxShadow = '0 0 8px rgba(10, 132, 255, 0.4)';
            }
        } else {
            overlay.style.display = 'none';
            if (inBtn) {
                inBtn.style.background = 'rgba(10, 132, 255, 0.12)';
                inBtn.style.borderColor = 'rgba(10, 132, 255, 0.35)';
                inBtn.style.boxShadow = 'none';
            }
            if (outBtn) {
                outBtn.style.background = 'rgba(10, 132, 255, 0.12)';
                outBtn.style.borderColor = 'rgba(10, 132, 255, 0.35)';
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
            const leftPeaks = [];
            const rightPeaks = [];

            for (let b = 0; b < totalBins; b++) {
                const start = b * blockSize;
                const end = Math.min(start + blockSize, totalSamples);
                let maxCombined = 0;
                let maxL = 0;
                let maxR = 0;
                const step = Math.max(1, Math.floor((end - start) / 40));
                for (let i = start; i < end; i += step) {
                    const s0 = Math.abs(chan0[i]);
                    if (s0 > maxL) maxL = s0;
                    if (chan1) {
                        const s1 = Math.abs(chan1[i]);
                        if (s1 > maxR) maxR = s1;
                        const sCombined = Math.max(s0, s1);
                        if (sCombined > maxCombined) maxCombined = sCombined;
                    } else {
                        if (s0 > maxCombined) maxCombined = s0;
                    }
                }
                peaks.push(maxCombined);
                leftPeaks.push(maxL);
                rightPeaks.push(chan1 ? maxR : maxL);
            }

            // Return true linear sample amplitude (0.0 to 1.0) so peak normalization visibly grows waveforms
            const resCombined = peaks.map(p => Math.min(1.0, Math.max(0.02, p)));
            resCombined.left = leftPeaks.map(p => Math.min(1.0, Math.max(0.02, p)));
            resCombined.right = rightPeaks.map(p => Math.min(1.0, Math.max(0.02, p)));
            return resCombined;
        } catch (err) {
            console.warn('[Waveform] Peak extraction error:', err);
            return [];
        }
    };

    // Render Track Automation SVG Overlay with draggable keyframe nodes (Dual-Mode: Volume & Stereo Pan)
    const renderTrackAutomationSvg = (track) => {
        const totalWidth = Math.max(1400, Math.ceil(daw.duration * daw.zoom) + 300);
        const laneHeight = daw.laneHeight || 74;
        const isPan = (track.automationMode === 'pan');

        if (isPan) {
            if (!track.panKeyframes || track.panKeyframes.length === 0) {
                track.panKeyframes = [{ time: 0, val: (typeof track.pan === 'number' && Number.isFinite(track.pan)) ? track.pan : 0 }];
            }
            track.panKeyframes.sort((a, b) => a.time - b.time);
        } else {
            if (!track.keyframes || track.keyframes.length === 0) {
                track.keyframes = [{ time: 0, val: (typeof track.vol === 'number' && Number.isFinite(track.vol)) ? track.vol : 1.0 }];
            }
            track.keyframes.sort((a, b) => a.time - b.time);
        }

        const kfList = isPan ? track.panKeyframes : track.keyframes;
        const pad = 10;
        const availH = Math.max(20, laneHeight - pad * 2);
        const midY = laneHeight / 2;
        const availHalf = availH / 2;

        const kfY = (val) => {
            if (isPan) {
                // val is -1.0 (Left = bottom) to +1.0 (Right = top), 0 is Center (midY)
                return Math.max(pad, Math.min(laneHeight - pad, midY - (val * availHalf)));
            } else {
                // val is 0.0 to 1.5 (Volume)
                return Math.max(pad, Math.min(laneHeight - pad, (laneHeight - pad) - (val / 1.5) * availH));
            }
        };

        const themeColor = isPan ? '#34d399' : '#0a84ff';
        let pathD = `M 0 ${kfY(kfList[0].val)}`;
        kfList.forEach(kf => {
            const x = Math.round(kf.time * daw.zoom);
            const y = Math.round(kfY(kf.val));
            pathD += ` L ${x} ${y}`;
        });
        const lastKf = kfList[kfList.length - 1];
        pathD += ` L ${totalWidth} ${Math.round(kfY(lastKf.val))}`;

        let nodesHtml = '';
        kfList.forEach((kf, idx) => {
            const x = Math.round(kf.time * daw.zoom);
            const y = Math.round(kfY(kf.val));
            const labelStr = isPan ? formatPanCompact(kf.val) : `${Math.round(kf.val * 100)}%`;
            nodesHtml += `
                <g class="daw-kf-group" data-track-id="${track.id}" data-kf-idx="${idx}" data-mode="${isPan ? 'pan' : 'vol'}" style="cursor: grab;">
                    <circle class="daw-kf-node" cx="${x}" cy="${y}" r="5" fill="${themeColor}" stroke="#ffffff" stroke-width="2" style="pointer-events: all; filter: drop-shadow(0 0 5px ${themeColor});"></circle>
                    <text class="daw-kf-label" x="${x}" y="${Math.max(12, y - 8)}" fill="${themeColor}" font-size="8" font-family="monospace" text-anchor="middle" font-weight="bold" style="pointer-events: none; opacity: 0; transition: opacity 0.15s;">${labelStr}</text>
                </g>
            `;
        });

        const centerGuideLine = isPan ? `<line x1="0" y1="${midY}" x2="${totalWidth}" y2="${midY}" stroke="rgba(255,255,255,0.18)" stroke-dasharray="3,3" stroke-width="1" />` : '';

        return `
            <svg class="lane-automation-svg" data-track-id="${track.id}" data-mode="${isPan ? 'pan' : 'vol'}" style="position: absolute; inset: 0; width: ${totalWidth}px; height: ${laneHeight}px; pointer-events: none; z-index: 35; overflow: visible;">
                ${centerGuideLine}
                <path class="lane-automation-path-vis" d="${pathD}" fill="none" stroke="${themeColor}" stroke-width="2" stroke-dasharray="none" style="filter: drop-shadow(0 0 4px ${themeColor}); pointer-events: none;" />
                <path class="lane-automation-path-hit" data-track-id="${track.id}" data-mode="${isPan ? 'pan' : 'vol'}" d="${pathD}" fill="none" stroke="transparent" stroke-width="16" style="pointer-events: stroke; cursor: crosshair;" title="Click on ${isPan ? 'stereo pan' : 'volume'} curve to add keyframe" />
                ${nodesHtml}
            </svg>
        `;
    };

    // ═════════════════════════════════════════════════════════════════════════════
    // STUDIO MASTER FOOTER ENGINE (DSP Stats, Snap Sync, Dynamic Selection & Latency)
    // ═════════════════════════════════════════════════════════════════════════════
    let _lastDspCalc = performance.now();
    let _dspLoadAvg = 1.2;

    const updateDawFooter = () => {
        // DSP Load Estimation
        const now = performance.now();
        if (daw.isPlaying) {
            const activeCount = (daw.activeSources || []).length;
            const targetLoad = Math.min(95, 1.5 + (activeCount * 2.8) + (Math.random() * 1.5));
            _dspLoadAvg = (_dspLoadAvg * 0.8) + (targetLoad * 0.2);
        } else {
            _dspLoadAvg = (_dspLoadAvg * 0.9) + (0.8 * 0.1);
        }
        const dspEl = document.getElementById('daw-footer-dsp-val');
        if (dspEl) {
            dspEl.textContent = `${_dspLoadAvg.toFixed(1)}%`;
            dspEl.style.color = _dspLoadAvg > 60 ? '#f87171' : (_dspLoadAvg > 30 ? '#fbbf24' : '#34d399');
        }
        // 1. Audio Engine & Latency Readout
        const ctx = daw.audioCtx;
        const srText = document.getElementById('daw-footer-engine-text');
        const latVal = document.getElementById('daw-footer-latency-val');
        const engDot = document.getElementById('daw-footer-engine-dot');

        if (ctx) {
            const sr = ctx.sampleRate || 48000;
            const srK = (sr / 1000).toFixed(sr % 1000 === 0 ? 0 : 1);
            if (srText) srText.textContent = `${srK} kHz • 32-bit Float`;
            const baseLatency = ctx.baseLatency ? (ctx.baseLatency * 1000).toFixed(1) : '5.3';
            if (latVal) latVal.textContent = `${baseLatency} ms`;
            if (engDot) {
                engDot.style.background = ctx.state === 'running' ? '#30d158' : '#ff9f0a';
                engDot.style.boxShadow = ctx.state === 'running' ? '0 0 6px #30d158' : '0 0 6px #ff9f0a';
            }
        }

        // 2. Track & Clip Counts, Duration
        const trackCountEl = document.getElementById('daw-footer-track-count');
        const clipCountEl = document.getElementById('daw-footer-clip-count');
        const totalDurEl = document.getElementById('daw-footer-total-dur');

        const tCount = Object.keys(daw.tracks || {}).length;
        const cCount = (daw.clips || []).length;
        if (trackCountEl) trackCountEl.textContent = `${tCount} Track${tCount === 1 ? '' : 's'}`;
        if (clipCountEl) clipCountEl.textContent = `${cCount} Clip${cCount === 1 ? '' : 's'}`;
        if (totalDurEl) totalDurEl.textContent = formatDawTime(daw.duration || 60);

        // 3. Selection Inspector Info
        const selNameEl = document.getElementById('daw-footer-selection-name');
        const selDurEl = document.getElementById('daw-footer-selection-dur');
        const normBtn = document.getElementById('daw-footer-normalize-btn');
        const splitBtn = document.getElementById('daw-footer-split-btn');

        if (daw.selectedClipId) {
            const clip = daw.clips.find(c => c.id === daw.selectedClipId);
            if (clip) {
                const dur = (clip.trimEnd || clip.duration) - (clip.trimStart || 0);
                if (selNameEl) selNameEl.textContent = clip.name;
                if (selDurEl) selDurEl.textContent = `(${formatDawTime(dur)})`;
                if (normBtn) { normBtn.disabled = false; normBtn.style.opacity = '1'; }
                if (splitBtn) { splitBtn.disabled = false; splitBtn.style.opacity = '1'; }
            }
        } else if (daw.selectedClipIds && daw.selectedClipIds.size > 0) {
            if (selNameEl) selNameEl.textContent = `${daw.selectedClipIds.size} Clips Selected`;
            if (selDurEl) selDurEl.textContent = '';
            if (normBtn) { normBtn.disabled = false; normBtn.style.opacity = '1'; }
            if (splitBtn) { splitBtn.disabled = true; splitBtn.style.opacity = '0.5'; }
        } else {
            if (selNameEl) selNameEl.textContent = 'No Clips Selected';
            if (selDurEl) selDurEl.textContent = '';
            if (normBtn) { normBtn.disabled = true; normBtn.style.opacity = '0.5'; }
            if (splitBtn) { splitBtn.disabled = true; splitBtn.style.opacity = '0.5'; }
        }

        // 4. Ripple Edit Status Pill
        const ripInd = document.getElementById('daw-footer-ripple-indicator');
        const ripBtn = document.getElementById('daw-footer-ripple-btn');
        if (ripInd && ripBtn) {
            if (daw.isRippleEnabled) {
                ripInd.style.background = '#34d399';
                ripInd.style.boxShadow = '0 0 6px #34d399';
                ripBtn.style.color = '#34d399';
                ripBtn.style.borderColor = 'rgba(52, 211, 153, 0.4)';
            } else {
                ripInd.style.background = 'rgba(255,255,255,0.3)';
                ripInd.style.boxShadow = 'none';
                ripBtn.style.color = 'rgba(255,255,255,0.7)';
                ripBtn.style.borderColor = 'rgba(255,255,255,0.15)';
            }
        }

        // 5. Zoom Level Indicator
        const zoomValEl = document.getElementById('daw-footer-zoom-val');
        const zoomSlider = document.getElementById('daw-footer-zoom-slider');
        if (zoomValEl) {
            const zoomPct = Math.round((daw.zoom / 15) * 100);
            zoomValEl.textContent = `${zoomPct}%`;
        }
        if (zoomSlider && document.activeElement !== zoomSlider) {
            zoomSlider.value = String(Math.round(daw.zoom));
        }

        const fadeBtn = document.getElementById('daw-footer-fade-btn');
        if (fadeBtn) {
            const hasSel = !!daw.selectedClipId || (daw.selectedClipIds && daw.selectedClipIds.size > 0);
            fadeBtn.disabled = !hasSel;
            fadeBtn.style.opacity = hasSel ? '1' : '0.5';
        }
    };

    // Wire Footer Interactive Controls
    const bindFooterControls = () => {
        // Snap selector sync
        const snapSelect = document.getElementById('daw-footer-snap-select');
        if (snapSelect) {
            snapSelect.addEventListener('change', (e) => {
                const val = e.target.value;
                if (val === 'off') {
                    daw.snapMode = 'off';
                } else {
                    daw.snapMode = 'grid';
                    daw.snapGridSec = parseFloat(val) || 0.5;
                }
                showStudioToast(`Snap grid set to: ${val === 'off' ? 'Off (Free Movement)' : val + 's'}`);
            });
        }

        // Quick Split action
        document.getElementById('daw-footer-split-btn')?.addEventListener('click', () => {
            if (daw.selectedClipId) {
                splitSelectedClip();
            } else {
                showStudioToast('Select a clip first to split at playhead');
            }
        });

        // Quick Normalize action
        document.getElementById('daw-footer-normalize-btn')?.addEventListener('click', () => {
            const targetIds = (daw.selectedClipIds && daw.selectedClipIds.size > 0)
                ? Array.from(daw.selectedClipIds)
                : (daw.selectedClipId ? [daw.selectedClipId] : []);

            if (targetIds.length === 0) {
                showStudioToast('Select a clip to peak normalize');
                return;
            }

            pushDawHistory('Peak Normalize Clip(s)');
            targetIds.forEach(id => {
                const clip = daw.clips.find(c => c.id === id);
                if (clip && clip.buffer) {
                    let maxPeak = 0;
                    for (let ch = 0; ch < clip.buffer.numberOfChannels; ch++) {
                        const data = clip.buffer.getChannelData(ch);
                        for (let i = 0; i < data.length; i += 200) {
                            const abs = Math.abs(data[i]);
                            if (abs > maxPeak) maxPeak = abs;
                        }
                    }
                    if (maxPeak > 0.001) {
                        clip.gain = Math.min(4.0, (1.0 / maxPeak));
                    }
                }
            });

            renderDawClips();
            updateDawFooter();
            showStudioToast(`Normalized ${targetIds.length} clip(s) to 0 dBFS peak`);
        });

        // Toggle Ripple Editing
        document.getElementById('daw-footer-ripple-btn')?.addEventListener('click', () => {
            daw.isRippleEnabled = !daw.isRippleEnabled;
            updateDawFooter();
            showStudioToast(`Ripple Editing: ${daw.isRippleEnabled ? 'ON (Gaps auto-close on delete)' : 'OFF'}`);
        });

        // Continuous Horizontal Zoom Slider
        const zoomSlider = document.getElementById('daw-footer-zoom-slider');
        if (zoomSlider) {
            zoomSlider.addEventListener('input', (e) => {
                daw.zoom = parseFloat(e.target.value) || 15;
                const badge = document.getElementById('timeline-zoom-badge');
                if (badge) badge.textContent = `${Math.round(daw.zoom / 15 * 100)}%`;
                const zoomValEl = document.getElementById('daw-footer-zoom-val');
                if (zoomValEl) zoomValEl.textContent = `${Math.round(daw.zoom / 15 * 100)}%`;
                renderDawTracks();
                renderDawRuler();
                renderDawClips();
                updateDawPlayhead();
            });
        }

        // Fit Entire Project to Screen Width (F)
        const fitTimelineToWindow = () => {
            const viewport = document.getElementById('timeline-scroll-viewport');
            const availableW = viewport ? (viewport.clientWidth - 40) : 800;
            const projDur = Math.max(10, daw.duration || 60);
            // Allow zooming all the way down to 0.05 px/sec so 30m, 1h, or 2h sessions shrink to fit the screen
            const optimalZoom = Math.max(0.05, Math.min(80, availableW / projDur));
            daw.zoom = optimalZoom;
            const badge = document.getElementById('timeline-zoom-badge');
            if (badge) badge.textContent = `${Math.round(daw.zoom / 15 * 100)}%`;
            const zoomValEl = document.getElementById('daw-footer-zoom-val');
            if (zoomValEl) zoomValEl.textContent = `${Math.round(daw.zoom / 15 * 100)}%`;
            const zoomSlider = document.getElementById('daw-footer-zoom-slider');
            if (zoomSlider) zoomSlider.value = String(daw.zoom);
            renderDawTracks();
            renderDawRuler();
            renderDawClips();
            updateDawPlayhead();
            updateDawFooter();
            if (viewport) viewport.scrollLeft = 0;
            return optimalZoom;
        };
        window.fitTimelineToWindow = fitTimelineToWindow;

        document.getElementById('daw-footer-zoom-fit-btn')?.addEventListener('click', () => {
            fitTimelineToWindow();
            showStudioToast(`Fitted session to screen (${Math.round(daw.zoom / 15 * 100)}% zoom)`);
        });

        // Quick Fade In / Out on Selected Clip(s)
        document.getElementById('daw-footer-fade-btn')?.addEventListener('click', () => {
            const targetIds = (daw.selectedClipIds && daw.selectedClipIds.size > 0)
                ? Array.from(daw.selectedClipIds)
                : (daw.selectedClipId ? [daw.selectedClipId] : []);

            if (targetIds.length === 0) {
                showStudioToast('Select a clip first to apply fade in/out');
                return;
            }

            pushDawHistory('Apply Fade In/Out');
            targetIds.forEach(id => {
                const clip = daw.clips.find(c => c.id === id);
                if (clip) {
                    const dur = (clip.trimEnd || clip.duration) - (clip.trimStart || 0);
                    const fadeTime = Math.min(0.2, dur * 0.15);
                    clip.fadeIn = fadeTime;
                    clip.fadeOut = fadeTime;
                }
            });

            renderDawClips();
            showStudioToast(`Applied soft crossfade to ${targetIds.length} clip(s)`);
        });

        // Reset UI action
        document.getElementById('daw-footer-reset-ui-btn')?.addEventListener('click', () => {
            document.getElementById('daw-menu-view-reset-ui')?.click();
        });
    };
 
    // Rotary Pan Tooltip Helpers
    const formatPanLabel = (panVal) => {
        if (Math.abs(panVal) < 0.04) return 'Center (0%)';
        if (panVal > 0) return `R ${Math.round(panVal * 100)}%`;
        return `L ${Math.round(Math.abs(panVal) * 100)}%`;
    };

    const formatPanCompact = (panVal) => {
        if (typeof panVal !== 'number' || Math.abs(panVal) < 0.04) return 'C';
        if (panVal > 0) return `R${Math.round(panVal * 100)}`;
        return `L${Math.round(Math.abs(panVal) * 100)}`;
    };

    let dawPanTooltipEl = null;
    const getOrCreatePanTooltipEl = () => {
        if (!dawPanTooltipEl) {
            dawPanTooltipEl = document.createElement('div');
            dawPanTooltipEl.id = 'daw-pan-floating-tooltip';
            dawPanTooltipEl.style.cssText = `
                position: fixed;
                pointer-events: none;
                z-index: 999999;
                background: rgba(9, 12, 20, 0.95);
                border: 1px solid rgba(10, 132, 255, 0.45);
                border-radius: 5px;
                padding: 3px 8px;
                font-size: 10px;
                font-weight: 800;
                font-family: monospace;
                color: #0a84ff;
                box-shadow: 0 4px 14px rgba(0,0,0,0.8), 0 0 10px rgba(10, 132, 255, 0.3);
                display: none;
                transform: translate(-50%, -130%);
                white-space: nowrap;
                transition: opacity 0.1s ease;
            `;
            document.body.appendChild(dawPanTooltipEl);
        }
        return dawPanTooltipEl;
    };

    const showPanTooltip = (x, y, panVal) => {
        const el = getOrCreatePanTooltipEl();
        const lbl = formatPanLabel(panVal);
        el.textContent = `Pan: ${lbl}`;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.display = 'block';
        el.style.opacity = '1';
    };

    const hidePanTooltip = () => {
        if (dawPanTooltipEl) {
            dawPanTooltipEl.style.display = 'none';
        }
    };

    // Add a new empty track to the session (Audio or Music/SFX)
    const addNewEmptyTrack = (type = 'audio') => {
        pushDawHistory('Add Track');
        const count = Object.keys(daw.tracks).length;
        const newId = `track_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const trackColors = ['#0a84ff', '#30d158', '#5e5ce6', '#ff9f0a', '#40c8e0', '#eb758a', '#8e8e93', '#bf5af2'];
        const chosenColor = trackColors[count % trackColors.length];
        const newName = type === 'music' ? `Music / SFX ${count + 1}` : `Track ${count + 1}`;
        daw.tracks[newId] = {
            id: newId,
            name: newName,
            type: type,
            channels: 'stereo',
            vol: 1.0,
            pan: 0,
            muted: false,
            solo: false,
            color: chosenColor,
            showAutomation: false,
            keyframes: [{ time: 0, val: 1.0 }],
            plugins: defaultPluginState()
        };
        if (!daw._activeFxTrackId) {
            daw._activeFxTrackId = newId;
        }
        if (!daw._recordTrackId || daw._recordTrackId === '__new__') {
            daw._recordTrackId = newId;
        }
        renderDawTracks();
        renderDawClips();
        renderDawRuler();
        if (typeof renderMixerStrips === 'function') renderMixerStrips();
        if (typeof syncActiveTrackToDeck === 'function') syncActiveTrackToDeck();
        showStudioToast(`Added "${newName}"`);
        return newId;
    };
    window.addNewEmptyTrack = addNewEmptyTrack;

    // Delete a track with safe confirmation dialog, undo history and clip handling
    const deleteTrackPrompt = async (trackKey) => {
        const track = daw.tracks[trackKey];
        if (!track) return;
        const clipsOnTrack = daw.clips.filter(c => c.trackId === trackKey);
        if (clipsOnTrack.length > 0) {
            const confirmDelete = await showStudioConfirm(
                'Delete Track & Clips',
                `Track "${track.name}" contains ${clipsOnTrack.length} audio clip(s).\nAre you sure you want to delete this track and remove all of its clips?`,
                { confirmText: 'Delete Track & Clips', danger: true }
            );
            if (!confirmDelete) return;
            daw.clips = daw.clips.filter(c => c.trackId !== trackKey);
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
        if (daw._recordTrackId === trackKey) {
            daw._recordTrackId = Object.keys(daw.tracks)[0] || '__new__';
        }
        if (daw._activeFxTrackId === trackKey) {
            daw._activeFxTrackId = Object.keys(daw.tracks)[0] || null;
        }
        renderDawTracks();
        renderDawClips();
        renderDawRuler();
        if (typeof renderMixerStrips === 'function') renderMixerStrips();
        if (typeof syncActiveTrackToDeck === 'function') syncActiveTrackToDeck();
        showStudioToast(`Deleted track "${track.name}"`);
    };
    window.deleteTrackPrompt = deleteTrackPrompt;

    // Render Track Headers & Matching Track Lanes
    const renderDawTracks = () => {
        const headersContainer = document.getElementById('daw-track-headers-container');
        const lanesContainer = document.getElementById('daw-track-lanes-container');
        const countBadge = document.getElementById('daw-track-count-badge');
        const currentH = daw.laneHeight || 74;

        const trackList = Object.values(daw.tracks);
        if (countBadge) countBadge.textContent = `${trackList.length} Tracks`;

        if (headersContainer) {
            if (trackList.length === 0) {
                headersContainer.innerHTML = `
                    <div class="daw-tracks-empty-state" style="padding: 28px 14px; text-align: center; color: rgba(255,255,255,0.45); display: flex; flex-direction: column; align-items: center; justify-content: center; height: 160px; border-bottom: 1px dashed rgba(255,255,255,0.1); cursor: pointer; user-select: none;" title="Double-click here or mixer to add an empty track">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true" style="margin-bottom: 8px; opacity: 0.6;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                        <div style="font-size: 11px; font-weight: 800; color: #ffffff; margin-bottom: 4px;">No Tracks in Session</div>
                        <div style="font-size: 9.5px; color: rgba(255,255,255,0.45); line-height: 1.3;">Double-click here or mixer to add an empty track</div>
                    </div>
                `;
            } else {
                headersContainer.innerHTML = trackList.map(t => {
                    const isArmed = (daw._recordTrackId === t.id);
                    const plugins = t.plugins || defaultPluginState();
                    const hasActiveFx = plugins.eq?.enabled || plugins.comp?.enabled || plugins.reverb?.enabled || plugins.warmth?.enabled;
                    const chType = t.channels === 'stereo' ? 'stereo' : 'mono';
                    const isStereo = chType === 'stereo';

                    const isSelectedTrack = (daw._activeFxTrackId === t.id);
                    const dspBadges = [
                        { label: 'EQ', active: !!plugins.eq?.enabled },
                        { label: 'CMP', active: !!plugins.comp?.enabled },
                        { label: 'REV', active: !!plugins.reverb?.enabled },
                        { label: 'LIM', active: !!plugins.limiter?.enabled }
                    ].map(b => `
                        <span style="font-size: 7px; font-weight: 800; font-family: monospace; padding: 0.5px 2.5px; border-radius: 2px; ${b.active ? 'background: rgba(52, 211, 153, 0.2); color: #34d399; border: 0.5px solid rgba(52, 211, 153, 0.45);' : 'background: rgba(255, 255, 255, 0.04); color: rgba(255, 255, 255, 0.28); border: 0.5px solid rgba(255, 255, 255, 0.08);'}">${b.label}</span>
                    `).join('');

                    return `
                        <div class="daw-track-header ${isSelectedTrack ? 'is-selected-track' : ''}" data-track-id="${t.id}" style="height: ${currentH}px; border-bottom: 1px solid rgba(255,255,255,0.08); padding: 7px 10px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; background: ${isArmed ? 'rgba(255, 69, 58, 0.05)' : (isSelectedTrack ? 'rgba(10, 132, 255, 0.06)' : 'rgba(255,255,255,0.015)')}; border-left: 3px solid ${isSelectedTrack ? '#0a84ff' : (isArmed ? '#ff453a' : 'transparent')}; position: relative; cursor: pointer;" title="Track ${t.name} (Double-click to delete)">
                            <!-- Row 1: Status Beacon + Full Track Title + DSP Badges + Type Badge + Mono/Stereo Badge + Delete -->
                            <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                                <div style="display: flex; align-items: center; gap: 5px; min-width: 0; flex: 1;">
                                    <button class="track-color-dot-btn" data-track="${t.id}" title="Click to customize track name & appearance" style="background: none; border: none; padding: 0; margin: 0; cursor: pointer; display: flex; align-items: center; justify-content: center; outline: none;">
                                        <span style="width: 10px; height: 10px; border-radius: 50%; background: ${t.color}; box-shadow: 0 0 10px ${t.color}; flex-shrink: 0; transition: transform 0.15s, box-shadow 0.15s; border: 1.5px solid rgba(255,255,255,0.45);" onmouseover="this.style.transform='scale(1.25)'" onmouseout="this.style.transform='scale(1)'"></span>
                                    </button>
                                    <span class="track-title-label" data-track-id="${t.id}" title="Click to select track / rename" style="font-size: 11.5px; font-weight: 800; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; text-decoration: underline dotted rgba(255,255,255,0.3); flex: 1;">${t.name}</span>
                                    <div style="display: inline-flex; align-items: center; gap: 2px; flex-shrink: 0;" title="Active Track DSP Plugins">${dspBadges}</div>
                                    <button class="track-channel-badge-btn" data-track="${t.id}" title="Click to toggle Mono / Stereo channel layout" style="background: ${isStereo ? 'rgba(10, 132, 255, 0.15)' : 'rgba(48, 209, 88, 0.15)'}; border: 1px solid ${isStereo ? 'rgba(10, 132, 255, 0.35)' : 'rgba(48, 209, 88, 0.35)'}; color: ${isStereo ? '#0a84ff' : '#34d399'}; font-size: 7.5px; font-weight: 800; padding: 1px 4px; border-radius: 3px; cursor: pointer; flex-shrink: 0; letter-spacing: 0.3px; text-transform: uppercase;">${isStereo ? 'Stereo' : 'Mono'}</button>
                                    <span style="font-size: 8px; font-weight: 700; text-transform: uppercase; padding: 1px 4px; border-radius: 3px; background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.65); flex-shrink: 0; letter-spacing: 0.5px;">${t.type === 'music' ? 'Music' : 'Audio'}</span>
                                </div>
                                <button class="track-delete-btn" data-track="${t.id}" title="Delete Track" style="background: none; border: none; color: rgba(255,255,255,0.4); font-size: 14px; font-weight: 800; padding: 0 2px; cursor: pointer; line-height: 1; flex-shrink: 0;" onmouseover="this.style.color='#ff453a';" onmouseout="this.style.color='rgba(255,255,255,0.4)';">&times;</button>
                            </div>
                            <!-- Row 2: Controls, Rotary Pan Dial, Volume Automation Button & Master Track Volume Slider -->
                            <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                                <!-- Left Controls Group: Arm, FX, Mute, Solo, Curve Icon -->
                                <div style="display: flex; align-items: center; gap: 3px; flex-shrink: 0;">
                                    <button class="track-ctrl-btn track-arm-btn" data-track="${t.id}" title="${isArmed ? 'Track Armed for Recording (Click to Disarm)' : 'Arm Track for Recording (Exclusive)'}" style="background: ${isArmed ? 'rgba(255, 69, 58, 0.3)' : 'rgba(255,255,255,0.06)'}; border: 1px solid ${isArmed ? '#ff453a' : 'rgba(255,255,255,0.15)'}; color: ${isArmed ? '#ff453a' : 'rgba(255,255,255,0.65)'}; box-shadow: ${isArmed ? '0 0 8px rgba(255, 69, 58, 0.45)' : 'none'};">
                                        <span style="width: 4px; height: 4px; border-radius: 50%; background: ${isArmed ? '#ff453a' : 'rgba(255,255,255,0.4)'}; margin-right: 2px;"></span>
                                        R
                                    </button>
                                    <button class="track-ctrl-btn track-fx-btn" data-track="${t.id}" title="Track FX Rack (EQ, Dynamics, Reverb, Tape Warmth)" style="background: ${hasActiveFx ? 'rgba(48, 209, 88, 0.25)' : 'rgba(255,255,255,0.06)'}; border: 1px solid ${hasActiveFx ? '#30d158' : 'rgba(255,255,255,0.15)'}; color: ${hasActiveFx ? '#34d399' : 'rgba(255,255,255,0.7)'};">FX</button>
                                    <button class="track-ctrl-btn track-mute-btn" data-track="${t.id}" title="Mute Track" style="background: ${t.muted ? '#ff453a' : 'rgba(255,255,255,0.06)'}; border: 1px solid ${t.muted ? '#ff453a' : 'rgba(255,255,255,0.15)'}; color: #fff;">M</button>
                                    <button class="track-ctrl-btn track-solo-btn" data-track="${t.id}" title="Solo Track" style="background: ${t.solo ? '#eab308' : 'rgba(255,255,255,0.06)'}; border: 1px solid ${t.solo ? '#eab308' : 'rgba(255,255,255,0.15)'}; color: ${t.solo ? '#000' : '#fff'};">S</button>
                                    <button class="track-ctrl-btn track-automation-btn" data-track="${t.id}" title="Toggle Timeline Automation Curve" style="background: ${t.showAutomation ? 'rgba(10, 132, 255, 0.25)' : 'rgba(255,255,255,0.06)'}; border: 1px solid ${t.showAutomation ? '#0a84ff' : 'rgba(255,255,255,0.15)'}; color: ${t.showAutomation ? '#0a84ff' : 'rgba(255,255,255,0.6)'};">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M2 12c3-8 7-8 10 0s7 8 10 0"/></svg>
                                    </button>
                                    ${t.showAutomation ? `
                                        <button class="track-ctrl-btn track-auto-mode-btn" data-track="${t.id}" title="Switch Automation: Volume vs Stereo Pan" style="font-size: 7.5px; font-weight: 800; font-family: monospace; padding: 1px 4px; height: 18px; border-radius: 3px; background: ${(t.automationMode === 'pan') ? 'rgba(52,211,153,0.2)' : 'rgba(10, 132, 255,0.2)'}; border: 1px solid ${(t.automationMode === 'pan') ? '#34d399' : '#0a84ff'}; color: ${(t.automationMode === 'pan') ? '#34d399' : '#0a84ff'}; cursor: pointer;">${(t.automationMode || 'vol').toUpperCase()}</button>
                                        <button class="track-ctrl-btn track-reset-curve-btn" data-track="${t.id}" title="Reset ${t.automationMode === 'pan' ? 'Pan' : 'Volume'} Curve to Flat" style="width: 16px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.6);">↺</button>
                                    ` : ''}
                                </div>

                                <!-- Right Controls Group: Rotary Pan Knob + Volume Fader + VU Meter -->
                                <div style="display: flex; align-items: center; gap: 5px; flex: 1; justify-content: flex-end; min-width: 0;">
                                    <!-- Professional Rotary Pan Dial with Readout Underneath -->
                                    <div class="track-pan-knob-container" data-track="${t.id}" title="Stereo Pan: ${formatPanLabel(t.pan || 0)} (Drag to adjust. Double-click to Center)">
                                        <div class="track-pan-dial-knob" data-track="${t.id}">
                                            <div class="track-pan-dial-needle" data-track="${t.id}" style="transform: rotate(${((t.pan !== undefined ? t.pan : 0) * 135)}deg);"></div>
                                            <div class="track-pan-dial-center-dot"></div>
                                        </div>
                                        <span class="track-pan-readout" id="track-pan-readout-${t.id}" data-track="${t.id}" title="Stereo Pan: ${formatPanLabel(t.pan || 0)} (Click or double-click to Center)">${formatPanCompact(t.pan || 0)}</span>
                                    </div>

                                    <!-- Overall Track Master Volume Slider -->
                                    <div style="display: flex; align-items: center; gap: 3px; flex-shrink: 0;" title="Track Master Volume">
                                        <input type="range" class="track-vol-slider" data-track="${t.id}" min="0" max="1.5" step="0.05" value="${t.vol}">
                                        <span style="font-size: 8px; font-family: monospace; color: rgba(255,255,255,0.7); min-width: 22px; text-align: right;" id="track-vol-readout-${t.id}">${Math.round(t.vol * 100)}%</span>
                                    </div>

                                    <!-- Track Header VU Level Meter -->
                                    <div class="track-mini-vu-container" id="track-mini-vu-${t.id}" title="Track Live Output VU Level" style="width: 7px; height: 24px; background: rgba(0,0,0,0.6); border-radius: 2px; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.2); box-shadow: inset 0 1px 2px rgba(0,0,0,0.7);">
                                        <div class="track-mini-vu-fill" id="track-mini-vu-fill-${t.id}" style="width: 100%; height: 0%; background: linear-gradient(to top, #30d158 0%, #34d399 65%, #ffd60a 82%, #ff453a 100%); transition: height 0.04s ease-out; border-radius: 1px;"></div>
                                    </div>
                                </div>
                            </div>
                            <!-- Draggable Track Lane Height Divider Handle -->
                            <div class="daw-lane-height-resizer" title="Drag vertically to resize track height (double-click to reset)" style="position: absolute; bottom: 0; left: 0; right: 0; height: 5px; cursor: row-resize; z-index: 25; background: transparent; transition: background 0.15s;" onmouseover="this.style.background='rgba(10, 132, 255,0.4)'" onmouseout="this.style.background='transparent'"></div>
                        </div>
                    `;
                }).join('');
            }
        }

        const recTrackSelect = document.getElementById('daw-record-track-select');
        if (recTrackSelect) {
            const curVal = daw._recordTrackId || '__new__';
            recTrackSelect.innerHTML = `
                <option value="__new__" ${curVal === '__new__' ? 'selected' : ''}>+ New Track (Auto)</option>
                ${trackList.map(t => `
                    <option value="${t.id}" ${t.id === curVal ? 'selected' : ''}>${t.name}${t.id === daw._recordTrackId ? ' ● [ARMED]' : ''}</option>
                `).join('')}
            `;
            recTrackSelect.value = curVal;
        }

        if (lanesContainer) {
            if (trackList.length === 0) {
                lanesContainer.innerHTML = `
                    <div class="daw-lanes-empty-state" style="padding: 28px 20px; text-align: center; color: rgba(255,255,255,0.35); display: flex; flex-direction: column; align-items: center; justify-content: center; height: 160px; border-bottom: 1px dashed rgba(255,255,255,0.08); user-select: none; cursor: pointer;" title="Double-click here to add an empty track, or drag & drop audio files">
                        <div style="font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.6); margin-bottom: 4px;">Timeline Empty</div>
                        <div style="font-size: 9.5px; color: rgba(255,255,255,0.35);">Double-click track area to add a new track, or drag & drop audio files</div>
                    </div>
                `;
            } else {
                lanesContainer.innerHTML = trackList.map(t => {
                    const isArmed = (daw._recordTrackId === t.id);
                    const isSelectedTrack = (daw._activeFxTrackId === t.id);
                    const laneBg = isArmed 
                        ? 'rgba(255, 69, 58, 0.05)' 
                        : (isSelectedTrack ? 'rgba(10, 132, 255, 0.07)' : (t.color ? t.color + '05' : 'rgba(255,255,255,0.015)'));
                    const laneBorderLeft = isArmed 
                        ? '3px solid #ff453a' 
                        : (isSelectedTrack ? `3px solid ${t.color || '#0a84ff'}` : '3px solid transparent');

                    return `
                        <div id="timeline-lane-${t.id}" class="timeline-lane ${isArmed ? 'lane-armed' : ''} ${isSelectedTrack ? 'is-selected-lane' : ''}" data-track-id="${t.id}" style="height: ${currentH}px; border-bottom: 1px solid rgba(255,255,255,0.08); position: relative; background: ${laneBg}; border-left: ${laneBorderLeft}; box-sizing: border-box; transition: background 0.15s, border-left 0.15s; cursor: pointer;">
                            ${isArmed ? `<div style="position: absolute; right: 12px; top: 6px; font-size: 8.5px; font-weight: 800; color: #ff453a; background: rgba(255, 69, 58,0.12); border: 1px solid rgba(255, 69, 58,0.3); border-radius: 4px; padding: 1px 6px; pointer-events: none; z-index: 5; display: flex; align-items: center; gap: 4px;"><span style="width: 5px; height: 5px; border-radius: 50%; background: #ff453a; box-shadow: 0 0 6px #ff453a;"></span>ARMED</div>` : ''}
                            ${isSelectedTrack ? `<div style="position: absolute; right: ${isArmed ? '92px' : '12px'}; top: 6px; font-size: 8px; font-weight: 800; font-family: monospace; color: ${t.color || '#0a84ff'}; background: rgba(10, 132, 255,0.1); border: 1px solid rgba(10, 132, 255,0.3); border-radius: 4px; padding: 1px 6px; pointer-events: none; z-index: 5; text-transform: uppercase; letter-spacing: 0.5px;">ACTIVE TRACK</div>` : ''}
                            ${t.showAutomation ? renderTrackAutomationSvg(t) : ''}
                            <!-- Draggable Lane Height Resizer on Timeline Lane -->
                            <div class="daw-lane-height-resizer" title="Drag vertically to resize track height" style="position: absolute; bottom: 0; left: 0; right: 0; height: 5px; cursor: row-resize; z-index: 25; background: transparent; transition: background 0.15s;" onmouseover="this.style.background='rgba(10, 132, 255,0.4)'" onmouseout="this.style.background='transparent'"></div>
                        </div>
                    `;
                }).join('');
            }
        }

        bindTrackControls();
        bindAutomationEvents();
        if (typeof renderDawClips === 'function') {
            renderDawClips();
        }
        if (typeof updateDawFooter === 'function') {
            updateDawFooter();
        }
    };

    // Bind Track Header Events (Arm, Mute, Solo, Volume slider, Automation toggle, Rename, Delete, FX, Curve Reset)
    const bindTrackControls = () => {
        document.querySelectorAll('.track-arm-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                if (daw._recordTrackId && daw._recordTrackId !== '__new__') {
                    const prevMini = document.getElementById(`track-mini-vu-fill-${daw._recordTrackId}`);
                    const prevMixer = document.getElementById(`daw-mixer-vu-${daw._recordTrackId}`);
                    if (prevMini) prevMini.style.height = '0%';
                    if (prevMixer) prevMixer.style.height = '0%';
                }
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
                    refreshAllTrackBusMutes();
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
                    refreshAllTrackBusMutes();
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

        document.querySelectorAll('.track-auto-mode-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const trackKey = e.currentTarget.getAttribute('data-track');
                const track = daw.tracks[trackKey];
                if (!track) return;
                track.automationMode = (track.automationMode === 'pan') ? 'vol' : 'pan';
                if (track.automationMode === 'pan' && (!track.panKeyframes || track.panKeyframes.length === 0)) {
                    track.panKeyframes = [{ time: 0, val: (typeof track.pan === 'number' && Number.isFinite(track.pan)) ? track.pan : 0 }];
                }
                showStudioToast(`Switched ${track.name} to ${track.automationMode === 'pan' ? 'Stereo Pan' : 'Volume'} Automation`);
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
                if (track.automationMode === 'pan') {
                    track.panKeyframes = [{ time: 0, val: (typeof track.pan === 'number' && Number.isFinite(track.pan)) ? track.pan : 0 }];
                    showStudioToast(`Reset Pan Curve to Flat (${formatPanLabel(track.pan || 0)})`);
                } else {
                    track.keyframes = [{ time: 0, val: track.vol }];
                    showStudioToast(`Reset Volume Curve to Flat (${Math.round(track.vol * 100)}%)`);
                }
                renderDawTracks();
                renderDawClips();
            };
        });

        // Track Header Status Dot & Track Name -> Open Track Properties & Color Modal
        document.querySelectorAll('.track-color-dot-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const trackKey = e.currentTarget.getAttribute('data-track');
                if (typeof openTrackPropertiesModal === 'function') {
                    openTrackPropertiesModal(trackKey);
                }
            };
        });

        // Click Mono / Stereo Badge to toggle channel layout
        document.querySelectorAll('.track-channel-badge-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const trackKey = e.currentTarget.getAttribute('data-track');
                const track = daw.tracks[trackKey];
                if (!track) return;
                const newCh = (track.channels === 'stereo') ? 'mono' : 'stereo';
                pushDawHistory(`Toggle Channel: ${newCh.toUpperCase()}`);
                track.channels = newCh;
                if (daw.isPlaying) {
                    updateTrackBusLive(trackKey);
                }
                renderDawTracks();
                renderDawClips();
                if (typeof autoSaveDawSession === 'function') autoSaveDawSession();
                showStudioToast(`Track [${track.name}] routing changed to ${newCh.toUpperCase()}`);
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
            label.onclick = (e) => {
                e.stopPropagation();
                const trackKey = e.currentTarget.getAttribute('data-track-id');
                if (typeof openTrackPropertiesModal === 'function') {
                    openTrackPropertiesModal(trackKey);
                }
            };
        });

        document.querySelectorAll('.track-delete-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const trackKey = e.currentTarget.getAttribute('data-track');
                if (trackKey) deleteTrackPrompt(trackKey);
            };
        });

        // Track Header click selection & double-click to delete
        document.querySelectorAll('.daw-track-header').forEach(header => {
            header.onclick = (e) => {
                if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.track-pan-knob-container')) return;
                const trId = header.getAttribute('data-track-id');
                if (trId) {
                    daw._activeFxTrackId = trId;
                    renderDawTracks();
                    syncActiveTrackToDeck();
                    if (typeof renderMixerStrips === 'function') renderMixerStrips();
                }
            };
            header.ondblclick = (e) => {
                if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.track-pan-knob-container') || e.target.closest('.track-color-dot-btn')) return;
                e.stopPropagation();
                const trId = header.getAttribute('data-track-id');
                if (trId && typeof openTrackPropertiesModal === 'function') {
                    openTrackPropertiesModal(trId);
                }
            };
        });

        // Double-click empty space in track headers container adds an empty track
        const headersContainerEl = document.getElementById('daw-track-headers-container');
        if (headersContainerEl) {
            headersContainerEl.ondblclick = (e) => {
                if (e.target.closest('.daw-track-header')) return;
                e.stopPropagation();
                addNewEmptyTrack('audio');
            };
        }

        // Double-click empty space in track lanes container adds an empty track
        const lanesContainerEl = document.getElementById('daw-track-lanes-container');
        if (lanesContainerEl) {
            lanesContainerEl.ondblclick = (e) => {
                if (e.target.closest('.timeline-lane') || e.target.closest('.daw-timeline-clip')) return;
                e.stopPropagation();
                addNewEmptyTrack('audio');
            };
        }

        // Rotary Knob Stereo Pan Control with 8% Center Snap, Double-Click to Center & Tooltip
        document.querySelectorAll('.track-pan-knob-container').forEach(knobContainer => {
            const trackKey = knobContainer.getAttribute('data-track');
            if (!trackKey || !daw.tracks[trackKey]) return;

            const resetPanToCenter = () => {
                pushDawHistory('Center Track Pan');
                daw.tracks[trackKey].pan = 0;
                if (daw.isPlaying && typeof updateTrackBusLive === 'function') {
                    updateTrackBusLive(trackKey);
                }
                const needle = knobContainer.querySelector('.track-pan-dial-needle') || knobContainer.querySelector('.track-pan-knob-needle');
                if (needle) needle.style.transform = 'rotate(0deg)';
                const readout = document.getElementById(`track-pan-readout-${trackKey}`);
                if (readout) {
                    readout.textContent = 'C';
                    readout.style.borderColor = '#0a84ff';
                    setTimeout(() => {
                        if (readout) readout.style.borderColor = '';
                    }, 350);
                }
                knobContainer.setAttribute('title', 'Stereo Pan: Center (0%) (Drag to adjust. Double-click to Center)');
                if (typeof showPanTooltip === 'function') {
                    const rect = knobContainer.getBoundingClientRect();
                    showPanTooltip(rect.left + rect.width / 2, rect.top - 10, 0);
                    setTimeout(hidePanTooltip, 800);
                }
                if (typeof autoSaveDawSession === 'function') autoSaveDawSession();
            };

            // Double click resets pan to Center (0%) on container
            knobContainer.ondblclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                resetPanToCenter();
            };

            // Also double click directly on the rotary knob dial
            const dialKnob = knobContainer.querySelector('.track-pan-dial-knob');
            if (dialKnob) {
                dialKnob.ondblclick = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    resetPanToCenter();
                };
            }

            // Also clicking or double-clicking the readout label underneath resets to Center
            const readoutEl = knobContainer.querySelector('.track-pan-readout');
            if (readoutEl) {
                readoutEl.ondblclick = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    resetPanToCenter();
                };
                readoutEl.onclick = (e) => {
                    e.stopPropagation();
                    resetPanToCenter();
                };
            }

            // Mousedown with fast double-click timestamp detector & smooth dragging
            knobContainer.onmousedown = (e) => {
                if (e.button !== 0) return;
                e.stopPropagation();

                const now = Date.now();
                const lastClick = knobContainer._lastPanClickTime || 0;
                const lastX = knobContainer._lastPanClickX || 0;
                const lastY = knobContainer._lastPanClickY || 0;

                // Rapid double-click (< 400ms within 8px radius): immediate snap to Center!
                if (now - lastClick < 400 && Math.hypot(e.clientX - lastX, e.clientY - lastY) < 8) {
                    e.preventDefault();
                    knobContainer._lastPanClickTime = 0;
                    resetPanToCenter();
                    return;
                }

                knobContainer._lastPanClickTime = now;
                knobContainer._lastPanClickX = e.clientX;
                knobContainer._lastPanClickY = e.clientY;

                const startY = e.clientY;
                const startX = e.clientX;
                const initialPan = typeof daw.tracks[trackKey].pan === 'number' ? daw.tracks[trackKey].pan : 0;
                let currentVal = initialPan;
                let hasDragged = false;

                const onMouseMove = (moveEv) => {
                    const deltaY = (startY - moveEv.clientY);
                    const deltaX = (moveEv.clientX - startX);

                    // Deadband threshold: ignore micro-tremors (< 3px) so clicking feels crisp
                    if (!hasDragged && Math.abs(deltaY) < 3 && Math.abs(deltaX) < 3) {
                        return;
                    }
                    hasDragged = true;

                    // Up/Right increases (Pan Right), Down/Left decreases (Pan Left)
                    const deltaCombined = (deltaY + deltaX * 0.8) / 100; // 100px for full sweep

                    let rawPan = Math.max(-1.0, Math.min(1.0, initialPan + deltaCombined));
                    // Snap to Center (0) if within 8%
                    if (Math.abs(rawPan) < 0.08) {
                        rawPan = 0;
                    }

                    currentVal = Math.round(rawPan * 100) / 100;
                    daw.tracks[trackKey].pan = currentVal;
                    if (daw.isPlaying && typeof updateTrackBusLive === 'function') {
                        updateTrackBusLive(trackKey);
                    }

                    const needle = knobContainer.querySelector('.track-pan-dial-needle') || knobContainer.querySelector('.track-pan-knob-needle');
                    if (needle) {
                        needle.style.transform = `rotate(${currentVal * 135}deg)`;
                    }
                    const readout = document.getElementById(`track-pan-readout-${trackKey}`);
                    if (readout) {
                        readout.textContent = formatPanCompact(currentVal);
                    }

                    if (typeof showPanTooltip === 'function') {
                        showPanTooltip(moveEv.clientX, moveEv.clientY, currentVal);
                    }
                };

                const onMouseUp = () => {
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onMouseUp);
                    if (typeof hidePanTooltip === 'function') {
                        hidePanTooltip();
                    }

                    if (hasDragged) {
                        pushDawHistory(`Adjust Pan (${formatPanLabel(currentVal)})`);
                        if (typeof autoSaveDawSession === 'function') autoSaveDawSession();
                    }
                };

                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onMouseUp);
            };
        });

        document.querySelectorAll('.track-vol-slider').forEach(slider => {
            slider.onchange = () => {
                pushDawHistory('Adjust Track Volume');
                if (typeof autoSaveDawSession === 'function') autoSaveDawSession();
            };
            slider.oninput = (e) => {
                const trackKey = e.currentTarget.getAttribute('data-track');
                if (!daw.tracks[trackKey]) return;
                const val = parseFloat(e.target.value);
                daw.tracks[trackKey].vol = val;
                if (daw.isPlaying) updateTrackBusLive(trackKey);
                const readout = document.getElementById(`track-vol-readout-${trackKey}`);
                if (readout) readout.textContent = `${Math.round(val * 100)}%`;
            };
        });

        // Draggable Vertical Lane Height Resizer
        document.querySelectorAll('.daw-lane-height-resizer').forEach(resizer => {
            resizer.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                e.preventDefault();

                const startY = e.clientY;
                const startHeight = daw.laneHeight || 74;
                document.body.style.cursor = 'row-resize';
                document.body.style.userSelect = 'none';

                const onMouseMove = (moveEv) => {
                    const deltaY = moveEv.clientY - startY;
                    const newHeight = Math.max(44, Math.min(240, Math.round(startHeight + deltaY)));
                    daw.laneHeight = newHeight;
                    const lbl = document.getElementById('timeline-track-height-label');
                    if (lbl) lbl.textContent = `${newHeight}px`;

                    document.querySelectorAll('.daw-track-header, .timeline-lane').forEach(el => {
                        el.style.height = `${newHeight}px`;
                    });
                };

                const onMouseUp = () => {
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onMouseUp);
                    renderDawTracks();
                    renderDawClips();
                };

                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onMouseUp);
            });

            // Double click to reset track height to default 74px
            resizer.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                daw.laneHeight = 74;
                const lbl = document.getElementById('timeline-track-height-label');
                if (lbl) lbl.textContent = '74px';
                renderDawTracks();
                renderDawClips();
            });
        });
    };

    // Bind Automation Curve Keyframing Events (Click on curve to add/adjust keyframe, Drag node, Double-click to delete)
    const bindAutomationEvents = () => {
        const laneH = daw.laneHeight || 74;
        const pad = 10;
        const availH = Math.max(20, laneH - pad * 2);
        const midY = laneH / 2;
        const availHalf = availH / 2;

        const kfYCalc = (val, isPan) => {
            if (isPan) {
                return Math.max(pad, Math.min(laneH - pad, midY - (val * availHalf)));
            } else {
                return Math.max(pad, Math.min(laneH - pad, (laneH - pad) - (val / 1.5) * availH));
            }
        };

        // Click directly on the automation curve line to add/adjust a keyframe
        document.querySelectorAll('.lane-automation-path-hit').forEach(hitPath => {
            hitPath.onclick = (e) => {
                e.stopPropagation();
                const trackId = hitPath.getAttribute('data-track-id');
                const track = daw.tracks[trackId];
                if (!track) return;
                const isPan = (track.automationMode === 'pan');

                if (isPan) {
                    if (!track.panKeyframes) track.panKeyframes = [{ time: 0, val: track.pan || 0 }];
                } else {
                    if (!track.keyframes) track.keyframes = [{ time: 0, val: track.vol || 1.0 }];
                }
                const kfList = isPan ? track.panKeyframes : track.keyframes;

                const svg = hitPath.closest('.lane-automation-svg');
                const rect = svg.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const clickY = e.clientY - rect.top;

                const time = Math.max(0, Math.min(daw.duration, clickX / daw.zoom));
                const val = isPan
                    ? Math.max(-1.0, Math.min(1.0, Math.round(((midY - clickY) / availHalf) * 100) / 100))
                    : Math.max(0, Math.min(1.5, Math.round(((laneH - pad - clickY) / availH) * 1.5 * 100) / 100));

                // Proximity deduplication: if there's already a node within 0.25s, update its value rather than creating duplicate swarms
                const closeKf = kfList.find(k => Math.abs(k.time - time) < 0.25);
                if (closeKf) {
                    closeKf.val = val;
                } else {
                    kfList.push({ time, val });
                }
                kfList.sort((a, b) => a.time - b.time);
                renderDawTracks();
                renderDawClips();
            };
        });

        // Hover over keyframe group to display percentage / pan readout
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
                if (!track) return;
                const isPan = (track.automationMode === 'pan');
                const kfList = isPan ? track.panKeyframes : track.keyframes;
                if (!kfList || !kfList[idx]) return;

                const svg = group.closest('.lane-automation-svg');
                const rect = svg.getBoundingClientRect();
                node.style.cursor = 'grabbing';
                group._isDragging = true;
                const lbl = group.querySelector('.daw-kf-label');
                if (lbl) lbl.style.opacity = '1';

                const pathVis = svg.querySelector('.lane-automation-path-vis');
                const pathHit = svg.querySelector('.lane-automation-path-hit');

                const onKfMove = (moveEv) => {
                    const clickX = moveEv.clientX - rect.left;
                    const clickY = moveEv.clientY - rect.top;

                    let newTime = kfList[idx].time;
                    if (idx > 0) {
                        newTime = Math.max(0.05, Math.min(daw.duration, clickX / daw.zoom));
                        kfList[idx].time = newTime;
                    }
                    const newVal = isPan
                        ? Math.max(-1.0, Math.min(1.0, Math.round(((midY - clickY) / availHalf) * 100) / 100))
                        : Math.max(0, Math.min(1.5, Math.round(((laneH - pad - clickY) / availH) * 1.5 * 100) / 100));
                    kfList[idx].val = newVal;

                    // Fast 60fps DOM direct update (zero thrashing)
                    const curX = Math.round(newTime * daw.zoom);
                    const curY = Math.round(kfYCalc(newVal, isPan));
                    node.setAttribute('cx', curX);
                    node.setAttribute('cy', curY);
                    if (lbl) {
                        lbl.setAttribute('x', curX);
                        lbl.setAttribute('y', Math.max(12, curY - 8));
                        lbl.textContent = isPan ? formatPanCompact(newVal) : `${Math.round(newVal * 100)}%`;
                    }

                    // Dynamically redraw path D attribute
                    if (pathVis || pathHit) {
                        const totalW = Math.max(1400, Math.ceil(daw.duration * daw.zoom) + 300);
                        let pD = `M 0 ${Math.round(kfYCalc(kfList[0].val, isPan))}`;
                        kfList.forEach(k => {
                            pD += ` L ${Math.round(k.time * daw.zoom)} ${Math.round(kfYCalc(k.val, isPan))}`;
                        });
                        const lastK = kfList[kfList.length - 1];
                        pD += ` L ${totalW} ${Math.round(kfYCalc(lastK.val, isPan))}`;
                        if (pathVis) pathVis.setAttribute('d', pD);
                        if (pathHit) pathHit.setAttribute('d', pD);
                    }
                };

                const onKfUp = () => {
                    group._isDragging = false;
                    window.removeEventListener('mousemove', onKfMove);
                    window.removeEventListener('mouseup', onKfUp);
                    kfList.sort((a, b) => a.time - b.time);
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
                if (!track) return;
                const isPan = (track.automationMode === 'pan');
                const kfList = isPan ? track.panKeyframes : track.keyframes;
                if (kfList && kfList.length > 1 && idx > 0) {
                    kfList.splice(idx, 1);
                    renderDawTracks();
                    renderDawClips();
                }
            };
        });
    };

    // Render Clips into Track Lanes with Multi-Clip Drag, Magnetic Snapping, Inline Rename, & Zoom
        // Helper: generate high-detail analog SVG curve or studio block bars for a given peak array
    const generateWaveformHtml = (peakArr, widthPx, heightPx, color, waveScale, isRealistic, chanLabel = '') => {
        const h = Math.max(12, heightPx);
        const w = Math.max(20, widthPx);
        const labelHtml = chanLabel ? `<span style="position: absolute; left: 3px; top: 1px; font-size: 7.5px; font-weight: 900; color: rgba(255,255,255,0.7); background: rgba(0,0,0,0.5); padding: 0 3px; border-radius: 2px; font-family: monospace; z-index: 14; pointer-events: none; letter-spacing: 0.5px;">${chanLabel}</span>` : '';

        if (!peakArr || peakArr.length === 0) {
            // Default placeholder waveform
            if (isRealistic) {
                const midY = h / 2;
                let pathD = `M 0 ${midY}`;
                const pts = Math.min(100, Math.floor(w / 4));
                for (let i = 0; i <= pts; i++) {
                    const x = (i / pts) * w;
                    const amp = (Math.sin(i * 0.4) * 0.25 * midY) * waveScale;
                    pathD += ` L ${x.toFixed(1)} ${(midY - amp).toFixed(1)}`;
                }
                for (let i = pts; i >= 0; i--) {
                    const x = (i / pts) * w;
                    const amp = (Math.sin(i * 0.4) * 0.25 * midY) * waveScale;
                    pathD += ` L ${x.toFixed(1)} ${(midY + amp).toFixed(1)}`;
                }
                pathD += ' Z';
                return `<div style="position: relative; width: 100%; height: ${h}px; overflow: hidden; display: flex; align-items: center;">${labelHtml}<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width: 100%; height: 100%; display: block;"><path d="${pathD}" fill="${color || '#0a84ff'}" fill-opacity="0.35" stroke="${color || '#0a84ff'}" stroke-width="0.8" stroke-opacity="0.75" /></svg></div>`;
            } else {
                const numBars = Math.max(6, Math.min(140, Math.floor(w / 5)));
                const bars = Array.from({ length: numBars }).map((_, i) => {
                    const barH = Math.min(100, Math.round((18 + Math.sin(i * 0.4) * 12) * waveScale));
                    return `<div style="flex: 1; min-width: 2px; height: ${barH}%; background: ${color || '#ffffff'}; border-radius: 1px; opacity: 0.35;"></div>`;
                }).join('');
                return `<div style="position: relative; width: 100%; height: ${h}px; display: flex; align-items: center; gap: 2px; overflow: hidden;">${labelHtml}${bars}</div>`;
            }
        }

        if (isRealistic) {
            // Broadcast-Grade Transient Peak Waveform with Center Zero-Crossing Axis & Micro RMS Shading
            const barWidth = 2.0; // Sharp Pro Tools / Ableton style bar thickness
            const gap = 1.0;
            const step = barWidth + gap;
            const numBars = Math.max(12, Math.floor(w / step));
            const midY = h / 2;

            let pathD = '';
            for (let b = 0; b < numBars; b++) {
                const ratio = numBars === 1 ? 0.5 : b / (numBars - 1);
                const idx = Math.min(peakArr.length - 1, Math.max(0, Math.floor(ratio * peakArr.length)));
                const p = peakArr[idx] !== undefined ? peakArr[idx] : 0.15;
                // Scale amplitude with fine non-linear expansion for soft dynamic details
                const amp = Math.min(midY - 1, Math.max(1.5, Math.pow(p, 0.85) * (midY - 1) * waveScale));
                const x = (b * step + barWidth / 2).toFixed(1);
                const yTop = (midY - amp).toFixed(1);
                const yBtm = (midY + amp).toFixed(1);
                pathD += `M ${x} ${yTop} L ${x} ${yBtm} `;
            }

            return `
                <div style="position: relative; width: 100%; height: ${h}px; overflow: hidden; display: flex; align-items: center;">
                    ${labelHtml}
                    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width: 100%; height: 100%; display: block; filter: drop-shadow(0 0 1px ${color}30);">
                        <!-- Zero-crossing axis line -->
                        <line x1="0" y1="${midY}" x2="${w}" y2="${midY}" stroke="rgba(255,255,255,0.22)" stroke-width="0.75" stroke-dasharray="2,2" />
                        <!-- High-density Transient Peak Bars -->
                        <path d="${pathD}" stroke="${color || '#ffffff'}" stroke-width="${barWidth}" stroke-linecap="round" stroke-opacity="0.9" />
                    </svg>
                </div>
            `;
        } else {
            // Render Discrete Studio Block Bars
            const numBars = Math.max(8, Math.min(180, Math.floor(w / 4)));
            const bars = [];
            for (let b = 0; b < numBars; b++) {
                const ratio = numBars === 1 ? 0.5 : b / (numBars - 1);
                const idx = Math.min(peakArr.length - 1, Math.max(0, Math.floor(ratio * peakArr.length)));
                const p = peakArr[idx] !== undefined ? peakArr[idx] : 0.2;
                const heightPct = Math.min(100, Math.round(Math.max(12, p * 96 * waveScale)));
                bars.push(`<div style="flex: 1; min-width: 2px; height: ${heightPct}%; background: ${color || '#ffffff'}; border-radius: 1px; opacity: 0.9;"></div>`);
            }
            return `
                <div style="position: relative; width: 100%; height: ${h}px; display: flex; align-items: center; gap: 2px; overflow: hidden;">
                    ${labelHtml}
                    ${bars.join('')}
                </div>
            `;
        }
    };

    const renderDawClips = () => {
        if (!daw.selectedClipIds) daw.selectedClipIds = new Set();
        if (daw.selectedClipId && !daw.selectedClipIds.has(daw.selectedClipId)) {
            daw.selectedClipIds.add(daw.selectedClipId);
        }

        // Clear all lane contents (preserving the automation SVG if active and active recording placeholder)
        document.querySelectorAll('.timeline-lane').forEach(lane => {
            const clips = lane.querySelectorAll('.daw-timeline-clip:not(.daw-recording-clip)');
            clips.forEach(c => c.remove());
        });

        const snapGuide = document.getElementById('timeline-snap-guide');
        const laneH = daw.laneHeight || 74;
        const waveScale = daw.waveScale || 1.0;

        const availableTrackKeys = Object.keys(daw.tracks);
        daw.clips.forEach(clip => {
            if (!daw.tracks[clip.trackId]) {
                clip.trackId = availableTrackKeys[0] || 'host';
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

            const isMonoWaves = (daw.waveformColorMode === 'mono');
            const activeClipColor = isMonoWaves ? '#e2e8f0' : (clip.color || '#0a84ff');
            const activeClipBg = isMonoWaves ? 'rgba(255,255,255,0.08)' : (clip.color ? clip.color + '26' : 'rgba(255,255,255,0.1)');
            const activeClipBorder = isSelected ? '2px solid #ffffff' : (isMonoWaves ? '1px solid rgba(255,255,255,0.35)' : '1px solid ' + (clip.color || 'rgba(255,255,255,0.3)'));

            const clipEl = document.createElement('div');
            clipEl.className = `daw-timeline-clip ${isSelected ? 'is-selected' : ''} ${isTrackSilent ? 'is-track-silent' : ''}`;
            clipEl.setAttribute('data-clip-id', clip.id);
            clipEl.style.cssText = `
                position: absolute;
                top: 6px;
                bottom: 6px;
                left: ${leftPx}px;
                width: ${widthPx}px;
                background: ${activeClipBg};
                background-image: linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(0,0,0,0.45) 100%);
                border: ${activeClipBorder};
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

            // Stereo vs Mono Detection: Track layout setting OR audio buffer channel count
            const isStereoTrack = (clipTrack && clipTrack.channels === 'stereo') || (clip.buffer && clip.buffer.numberOfChannels >= 2);
            const isRealistic = (daw.waveformStyle !== 'bars');
            const totalDur = Math.max(0.1, clip.duration || clip.trimEnd);
            const startRatio = Math.max(0, Math.min(1, clip.trimStart / totalDur));
            const endRatio = Math.max(startRatio + 0.001, Math.min(1, clip.trimEnd / totalDur));

            // Extract sliced peak segment corresponding to active trim range
            const getTrimmedPeaks = (sourcePeaks) => {
                if (!sourcePeaks || sourcePeaks.length === 0) return [];
                const startIdx = Math.max(0, Math.floor(startRatio * sourcePeaks.length));
                const endIdx = Math.min(sourcePeaks.length, Math.ceil(endRatio * sourcePeaks.length));
                return sourcePeaks.slice(startIdx, Math.max(startIdx + 2, endIdx));
            };

            const slicedCombinedPeaks = getTrimmedPeaks(clip.peaks);
            const slicedLeftPeaks = (clip.peaks && clip.peaks.left) ? getTrimmedPeaks(clip.peaks.left) : slicedCombinedPeaks;
            const slicedRightPeaks = (clip.peaks && clip.peaks.right) ? getTrimmedPeaks(clip.peaks.right) : slicedCombinedPeaks;

            let waveformHtml = '';
            const totalWaveH = Math.max(22, laneH - 42);

            if (isStereoTrack) {
                // Dual Stacked L & R Waveform Lanes with Centerline Separator
                const singleChanH = Math.max(10, Math.floor((totalWaveH - 5) / 2));
                const waveL = generateWaveformHtml(slicedLeftPeaks, widthPx, singleChanH, activeClipColor, waveScale, isRealistic, 'L');
                const waveR = generateWaveformHtml(slicedRightPeaks, widthPx, singleChanH, activeClipColor, waveScale, isRealistic, 'R');
                waveformHtml = `
                    <div style="display: flex; flex-direction: column; width: 100%; height: ${totalWaveH}px; justify-content: space-between; position: relative;">
                        <div style="flex: 1; min-height: 0; display: flex; align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.14); padding-bottom: 1px;">
                            ${waveL}
                        </div>
                        <div style="flex: 1; min-height: 0; display: flex; align-items: center; padding-top: 1px;">
                            ${waveR}
                        </div>
                    </div>
                `;
            } else {
                // Mono: Single Full-Height Waveform Lane
                waveformHtml = generateWaveformHtml(slicedCombinedPeaks, widthPx, totalWaveH, activeClipColor, waveScale, isRealistic, '');
            }

            const tagBadge = clip.tag ? `
                <span style="font-size: 8px; font-weight: 700; background: rgba(0,0,0,0.6); color: ${activeClipColor}; border: 1px solid ${activeClipColor}40; padding: 1px 4px; border-radius: 3px; text-transform: uppercase; white-space: nowrap;">
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
                    <div style="width: 7px; height: 7px; background: ${clip.fadeInShape ? '#c084fc' : '#0a84ff'}; border: 1px solid #ffffff; border-radius: 2px; box-shadow: 0 0 6px ${clip.fadeInShape ? 'rgba(192,132,252,0.9)' : 'rgba(10, 132, 255,0.8)'}; pointer-events: none;"></div>
                </div>
                <div class="daw-clip-fade-handle daw-clip-fade-right" data-clip-id="${clip.id}" style="position: absolute; right: 0; top: 0; width: 12px; height: 12px; cursor: ew-resize; z-index: 45; display: flex; align-items: flex-start; justify-content: flex-end;" title="Drag corner to create Fade-Out curve (${fadeOutSec.toFixed(2)}s)">
                    <div style="width: 7px; height: 7px; background: ${clip.fadeOutShape ? '#c084fc' : '#0a84ff'}; border: 1px solid #ffffff; border-radius: 2px; box-shadow: 0 0 6px ${clip.fadeOutShape ? 'rgba(192,132,252,0.9)' : 'rgba(10, 132, 255,0.8)'}; pointer-events: none;"></div>
                </div>

                <!-- SVG Fade Curve Shading Overlay with Adjustable Convex / Linear / Concave Slope Curvature & Crossfade Highlighting -->
                <svg class="daw-clip-fade-svg" style="position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10; overflow: hidden;">
                    ${fadeInPx > 0 ? (() => {
                        const isXfade = !!clip.fadeInShape;
                        const strokeColor = isXfade ? '#c084fc' : '#0a84ff';
                        const fillColor = isXfade ? 'rgba(147, 51, 234, 0.28)' : 'rgba(0,0,0,0.38)';
                        const tensionIn = (typeof clip.fadeInCurve === 'number') ? clip.fadeInCurve : 0; // -1 (concave) to 1 (convex)
                        const ctrlY = Math.max(0, Math.min(100, 50 - tensionIn * 45));
                        const ctrlX = fadeInPx * (0.5 - tensionIn * 0.2);
                        return `
                            <path d="M 0 0 L ${fadeInPx} 0 L ${fadeInPx} 100 L 0 100 Z" fill="${fillColor}" />
                            <path d="M 0 100 Q ${ctrlX} ${ctrlY}, ${fadeInPx} 0" fill="none" stroke="${strokeColor}" stroke-width="${isXfade ? '2.8' : '2.2'}" />
                            <circle cx="${ctrlX}" cy="${ctrlY}" r="3" fill="#ffffff" stroke="${strokeColor}" stroke-width="1.5" />
                        `;
                    })() : ''}
                    ${fadeOutPx > 0 ? (() => {
                        const isXfade = !!clip.fadeOutShape;
                        const strokeColor = isXfade ? '#c084fc' : '#0a84ff';
                        const fillColor = isXfade ? 'rgba(147, 51, 234, 0.28)' : 'rgba(0,0,0,0.38)';
                        const tensionOut = (typeof clip.fadeOutCurve === 'number') ? clip.fadeOutCurve : 0; // -1 (concave) to 1 (convex)
                        const ctrlY = Math.max(0, Math.min(100, 50 - tensionOut * 45));
                        return `
                            <path d="M calc(100% - ${fadeOutPx}px) 0 L 100% 0 L 100% 100 L calc(100% - ${fadeOutPx}px) 100 Z" fill="${fillColor}" />
                            <path d="M calc(100% - ${fadeOutPx}px) 0 Q calc(100% - ${fadeOutPx * (0.5 + tensionOut * 0.2)}px) ${ctrlY}, 100% 100" fill="none" stroke="${strokeColor}" stroke-width="${isXfade ? '2.8' : '2.2'}" />
                            <circle cx="calc(100% - ${fadeOutPx * (0.5 + tensionOut * 0.2)}px)" cy="${ctrlY}" r="3" fill="#ffffff" stroke="${strokeColor}" stroke-width="1.5" />
                        `;
                    })() : ''}
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
                            <span style="font-size: 8px; font-weight: 700; background: ${clip.fadeInShape || clip.fadeOutShape ? 'rgba(94, 92, 230,0.25)' : 'rgba(10, 132, 255,0.25)'}; color: ${clip.fadeInShape || clip.fadeOutShape ? '#c084fc' : '#0a84ff'}; border: 1px solid ${clip.fadeInShape || clip.fadeOutShape ? 'rgba(94, 92, 230,0.45)' : 'rgba(10, 132, 255,0.4)'}; padding: 0.5px 3px; border-radius: 3px; font-family: monospace;">
                                ${clip.fadeInShape || clip.fadeOutShape ? '⤬' : '◢'} ${clip.fadeIn > 0 ? clip.fadeIn.toFixed(1) + 's' : ''} ${clip.fadeOut > 0 ? (clip.fadeInShape || clip.fadeOutShape ? '' : '◣ ') + clip.fadeOut.toFixed(1) + 's' : ''}
                            </span>
                        ` : ''}
                        <span style="font-size: 9px; font-weight: 800; background: rgba(0,0,0,0.55); padding: 1px 5px; border-radius: 4px; color: rgba(255,255,255,0.85); white-space: nowrap; pointer-events: none;">
                            ${durStr}
                        </span>
                    </div>
                </div>
                <div style="display: flex; align-items: center; width: 100%; height: ${totalWaveH}px; opacity: 0.92; pointer-events: none; overflow: hidden; padding: 2px 4px 1px 4px; box-sizing: border-box; position: relative; z-index: 12;">
                    ${waveformHtml}
                </div>
            `;

            // Interactive Fade In Dragging (Horizontal = Duration, Vertical = Curve Tension)
            const fadeLeftHandle = clipEl.querySelector('.daw-clip-fade-left');
            if (fadeLeftHandle) {
                fadeLeftHandle.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const startClientX = e.clientX;
                    const initialFadeIn = clip.fadeIn || 0;
                    let hasChanged = false;

                    const initialTension = clip.fadeInCurve || 0;
                    const startClientY = e.clientY;

                    // Show initial tooltip
                    const formatFadeTooltip = (sec, tension) => {
                        const tensionPct = Math.round(tension * 100);
                        const shapeName = tensionPct > 10 ? 'Convex' : (tensionPct < -10 ? 'Concave' : 'Linear');
                        return `Fade In: ${sec.toFixed(2)}s | Slope: ${tensionPct > 0 ? '+' : ''}${tensionPct}% (${shapeName})\n↔ Time, ↕ Curve`;
                    };

                    const tooltipEl = getOrCreatePanTooltipEl();
                    tooltipEl.textContent = formatFadeTooltip(initialFadeIn, initialTension);
                    tooltipEl.style.left = `${e.clientX}px`;
                    tooltipEl.style.top = `${e.clientY}px`;
                    tooltipEl.style.display = 'block';

                    const onFadeMove = (moveEv) => {
                        const deltaSec = (moveEv.clientX - startClientX) / daw.zoom;
                        const deltaY = (startClientY - moveEv.clientY) / 45; // Dragging UP makes curve convex, DOWN concave
                        const maxFade = Math.max(0, clipDur - 0.2);
                        const newFade = Math.max(0, Math.min(maxFade, initialFadeIn + deltaSec));
                        clip.fadeIn = Math.round(newFade * 100) / 100;
                        clip.fadeInCurve = Math.max(-0.95, Math.min(0.95, Math.round((initialTension + deltaY) * 100) / 100));
                        hasChanged = true;

                        tooltipEl.textContent = formatFadeTooltip(clip.fadeIn, clip.fadeInCurve);
                        tooltipEl.style.left = `${moveEv.clientX}px`;
                        tooltipEl.style.top = `${moveEv.clientY}px`;

                        // Re-render clips to update SVG path shape dynamically
                        renderDawClips();
                    };

                    const onFadeUp = () => {
                        window.removeEventListener('mousemove', onFadeMove);
                        window.removeEventListener('mouseup', onFadeUp);
                        tooltipEl.style.display = 'none';
                        if (hasChanged) {
                            pushDawHistory(`Adjust Fade In (${clip.fadeIn.toFixed(2)}s, Slope ${Math.round(clip.fadeInCurve * 100)}%)`);
                        }
                    };

                    window.addEventListener('mousemove', onFadeMove);
                    window.addEventListener('mouseup', onFadeUp);
                });
            }

            // Interactive Fade Out Dragging (Horizontal = Duration, Vertical = Curve Tension)
            const fadeRightHandle = clipEl.querySelector('.daw-clip-fade-right');
            if (fadeRightHandle) {
                fadeRightHandle.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const startClientX = e.clientX;
                    const initialFadeOut = clip.fadeOut || 0;
                    let hasChanged = false;

                    const initialTension = clip.fadeOutCurve || 0;
                    const startClientY = e.clientY;

                    const formatFadeTooltip = (sec, tension) => {
                        const tensionPct = Math.round(tension * 100);
                        const shapeName = tensionPct > 10 ? 'Convex' : (tensionPct < -10 ? 'Concave' : 'Linear');
                        return `Fade Out: ${sec.toFixed(2)}s | Slope: ${tensionPct > 0 ? '+' : ''}${tensionPct}% (${shapeName})\n↔ Time, ↕ Curve`;
                    };

                    const tooltipEl = getOrCreatePanTooltipEl();
                    tooltipEl.textContent = formatFadeTooltip(initialFadeOut, initialTension);
                    tooltipEl.style.left = `${e.clientX}px`;
                    tooltipEl.style.top = `${e.clientY}px`;
                    tooltipEl.style.display = 'block';

                    const onFadeMove = (moveEv) => {
                        const deltaSec = (startClientX - moveEv.clientX) / daw.zoom;
                        const deltaY = (startClientY - moveEv.clientY) / 45; // Dragging UP makes curve convex, DOWN concave
                        const maxFade = Math.max(0, clipDur - 0.2);
                        const newFade = Math.max(0, Math.min(maxFade, initialFadeOut + deltaSec));
                        clip.fadeOut = Math.round(newFade * 100) / 100;
                        clip.fadeOutCurve = Math.max(-0.95, Math.min(0.95, Math.round((initialTension + deltaY) * 100) / 100));
                        hasChanged = true;

                        tooltipEl.textContent = formatFadeTooltip(clip.fadeOut, clip.fadeOutCurve);
                        tooltipEl.style.left = `${moveEv.clientX}px`;
                        tooltipEl.style.top = `${moveEv.clientY}px`;

                        renderDawClips();
                    };

                    const onFadeUp = () => {
                        window.removeEventListener('mousemove', onFadeMove);
                        window.removeEventListener('mouseup', onFadeUp);
                        tooltipEl.style.display = 'none';
                        if (hasChanged) {
                            pushDawHistory(`Adjust Fade Out (${clip.fadeOut.toFixed(2)}s, Slope ${Math.round(clip.fadeOutCurve * 100)}%)`);
                        }
                    };

                    window.addEventListener('mousemove', onFadeMove);
                    window.addEventListener('mouseup', onFadeUp);
                });
            }

            // Interactive Left & Right Edge Trimming
            const leftTrim = clipEl.querySelector('.daw-clip-trim-left');
            if (leftTrim) {
                leftTrim.addEventListener('mouseenter', () => leftTrim.style.background = 'rgba(10, 132, 255, 0.45)');
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
                rightTrim.addEventListener('mouseenter', () => rightTrim.style.background = 'rgba(10, 132, 255, 0.45)');
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
                    input.style.cssText = 'background: #090d16; color: #ffffff; border: 1px solid #0a84ff; border-radius: 3px; font-size: 11px; font-weight: 800; padding: 1px 5px; outline: none; width: 130px; box-sizing: border-box;';
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
            clipEl.addEventListener('selectstart', (e) => e.preventDefault());
            clipEl.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                if (e.target.closest('input')) return;
                if (e.target.closest('.daw-clip-trim-handle')) return;
                if (e.target.closest('.daw-clip-fade-handle')) return;

                window.getSelection()?.removeAllRanges();

                // Razor Blade Tool Mode (B): Clicking anywhere on a clip splits it at that exact timestamp
                if (daw.activeTool === 'blade') {
                    e.stopPropagation();
                    e.preventDefault();
                    const laneEl = document.getElementById(`timeline-lane-${clip.trackId}`);
                    const laneRect = laneEl ? laneEl.getBoundingClientRect() : clipEl.parentElement.getBoundingClientRect();
                    const viewport = document.getElementById('timeline-scroll-viewport');
                    const scrollLeft = viewport ? viewport.scrollLeft : 0;
                    const clickX = e.clientX - laneRect.left + scrollLeft;
                    const clickTimeSec = Math.max(0, clickX / daw.zoom);
                    const didSplit = splitClipAtTimestamp(clip.id, clickTimeSec);
                    if (!didSplit) {
                        showStudioToast('Click inside the audio clip to split');
                    }
                    return;
                }

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
                    document.querySelectorAll('.daw-timeline-clip').forEach(el => {
                        const isSel = daw.selectedClipIds.has(el.getAttribute('data-clip-id'));
                        el.classList.toggle('is-selected', isSel);
                        el.style.border = isSel ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.2)';
                        el.style.boxShadow = isSel ? '0 0 16px rgba(255,255,255,0.6), inset 0 0 8px rgba(255,255,255,0.2)' : '0 2px 8px rgba(0,0,0,0.5)';
                    });
                    return;
                }

                // If Shift-clicking an unselected clip, add it to selection without destroying DOM
                if (isShiftKey && !daw.selectedClipIds.has(clip.id)) {
                    daw.selectedClipIds.add(clip.id);
                    daw.selectedClipId = clip.id;
                    if (typeof window._syncBottomDeckClipInspector === 'function') window._syncBottomDeckClipInspector();
                    document.querySelectorAll('.daw-timeline-clip').forEach(el => {
                        const isSel = daw.selectedClipIds.has(el.getAttribute('data-clip-id'));
                        el.classList.toggle('is-selected', isSel);
                        el.style.border = isSel ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.2)';
                        el.style.boxShadow = isSel ? '0 0 16px rgba(255,255,255,0.6), inset 0 0 8px rgba(255,255,255,0.2)' : '0 2px 8px rgba(0,0,0,0.5)';
                    });
                } else if (!isShiftKey && !daw.selectedClipIds.has(clip.id)) {
                    // Clicking an unselected clip without Shift: make it sole selection without destroying DOM
                    daw.selectedClipIds.clear();
                    daw.selectedClipIds.add(clip.id);
                    daw.selectedClipId = clip.id;
                    if (clip.crossfadeWith) {
                        const partner = daw.clips.find(c => c.id === clip.crossfadeWith);
                        if (partner) daw.selectedClipIds.add(partner.id);
                    }
                    if (typeof window._syncBottomDeckClipInspector === 'function') window._syncBottomDeckClipInspector();
                    document.querySelectorAll('.daw-timeline-clip').forEach(el => {
                        const isSel = daw.selectedClipIds.has(el.getAttribute('data-clip-id'));
                        el.classList.toggle('is-selected', isSel);
                        el.style.border = isSel ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.2)';
                        el.style.boxShadow = isSel ? '0 0 16px rgba(255,255,255,0.6), inset 0 0 8px rgba(255,255,255,0.2)' : '0 2px 8px rgba(0,0,0,0.5)';
                    });
                }

                // If crossfaded with a partner clip, ensure partner is also selected so both move in lockstep
                if (clip.crossfadeWith && !isShiftKey && !isModifierKey) {
                    const partner = daw.clips.find(c => c.id === clip.crossfadeWith);
                    if (partner && !daw.selectedClipIds.has(partner.id)) {
                        daw.selectedClipIds.add(partner.id);
                    }
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
                e.preventDefault();
                window.getSelection()?.removeAllRanges();
                document.body.style.userSelect = 'none';
                document.body.style.webkitUserSelect = 'none';

                const leaderInitOffset = Number.isFinite(clip.startOffset) ? clip.startOffset : 0;
                let hasDragged = false;
                let candidateTrackId = clip.trackId;

                // Cache initial offsets and initial track IDs for all selected clips
                const initialOffsets = new Map();
                const initialTrackIds = new Map();
                let minInitialOffset = Infinity;
                daw.clips.forEach(c => {
                    if (daw.selectedClipIds.has(c.id)) {
                        const safeOff = Number.isFinite(c.startOffset) ? c.startOffset : 0;
                        initialOffsets.set(c.id, safeOff);
                        initialTrackIds.set(c.id, c.trackId);
                        if (safeOff < minInitialOffset) minInitialOffset = safeOff;
                    }
                });

                clipEl.style.cursor = 'grabbing';
                const viewport = document.getElementById('timeline-scroll-viewport');
                const trackListKeys = Object.keys(daw.tracks);
                const sourceTrackIndex = trackListKeys.indexOf(clip.trackId);

                // Elevate source track lane z-index so dragged clip paints above all subsequent lanes
                const sourceLane = document.getElementById(`timeline-lane-${clip.trackId}`);
                if (sourceLane) sourceLane.style.zIndex = '1000';

                // Real-time Drop Target Ghost preview element
                let dropGhostEl = document.getElementById('daw-clip-drop-ghost');
                if (!dropGhostEl) {
                    dropGhostEl = document.createElement('div');
                    dropGhostEl.id = 'daw-clip-drop-ghost';
                    dropGhostEl.style.cssText = `
                        position: absolute;
                        border-radius: 8px;
                        pointer-events: none;
                        display: none;
                        z-index: 60;
                        box-sizing: border-box;
                        border: 2px dashed #0a84ff;
                        background: rgba(10, 132, 255, 0.28);
                        box-shadow: 0 0 20px rgba(10, 132, 255, 0.5), inset 0 0 12px rgba(10, 132, 255, 0.25);
                        align-items: center;
                        justify-content: space-between;
                        padding: 0 8px;
                        overflow: hidden;
                    `;
                }

                let autoScrollRaf = null;
                let latestMoveEv = null;
                let lastCalculatedProposedOffset = leaderInitOffset;

                // Core drag update function (called on mousemove and on autoscroll animation frames)
                const updateDragState = (moveEv) => {
                    const dx = moveEv.clientX - startX;
                    const dy = moveEv.clientY - startY;

                    if (!hasDragged && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
                        hasDragged = true;
                        document.querySelectorAll('.daw-timeline-clip.is-selected').forEach(el => {
                            el.style.opacity = '0.82';
                            el.style.zIndex = '1001';
                            el.style.boxShadow = '0 14px 32px rgba(0,0,0,0.85), 0 0 18px rgba(10, 132, 255, 0.7)';
                        });
                    }

                    if (!hasDragged) return;

                    // When SHIFT is held during drag, lock horizontal movement (dx = 0)
                    const isHorizontalLocked = moveEv.shiftKey;
                    const rawDeltaSec = isHorizontalLocked ? 0 : (dx / daw.zoom);
                    let proposedLeaderOffset = Math.max(0, leaderInitOffset + rawDeltaSec);
                    const activeDuration = Math.max(0.5, clip.trimEnd - clip.trimStart);

                    // Magnetic Snapping (Grid lines and adjacent clip edges)
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

                        // 2. Audio clip edge snapping
                        if (snapMode === 'all' || snapMode === 'clips') {
                            daw.clips.forEach(otherClip => {
                                if (daw.selectedClipIds.has(otherClip.id)) return;
                                const otherStart = otherClip.startOffset;
                                const otherDur = Math.max(0.5, otherClip.trimEnd - otherClip.trimStart);
                                const otherEnd = otherStart + otherDur;

                                snapCandidates.push({ target: otherEnd, snapOffset: otherEnd });
                                snapCandidates.push({ target: otherStart, snapOffset: otherStart - activeDuration });
                                snapCandidates.push({ target: otherStart, snapOffset: otherStart });
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

                    lastCalculatedProposedOffset = proposedLeaderOffset;

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

                    // 2D Movement for leader clip
                    clipEl.style.transform = `translate3d(0, ${dy}px, 0)`;
                    clipEl.style.left = `${Math.max(0, leaderInitOffset + clampedDelta) * daw.zoom}px`;
                    clipEl.style.zIndex = '1001';

                    // Move other co-selected clips along X and Y axes in unison
                    daw.clips.forEach(c => {
                        if (c.id !== clip.id && daw.selectedClipIds.has(c.id)) {
                            const initOff = initialOffsets.get(c.id) || 0;
                            const cEl = document.querySelector(`.daw-timeline-clip[data-clip-id="${c.id}"]`);
                            if (cEl) {
                                cEl.style.transform = `translate3d(0, ${dy}px, 0)`;
                                cEl.style.left = `${Math.max(0, initOff + clampedDelta) * daw.zoom}px`;
                                cEl.style.zIndex = '1000';
                            }
                        }
                    });

                    // Real-Time Track Lane Highlight & Target Detection
                    const lanes = document.querySelectorAll('.timeline-lane');
                    let hoveredAnyLane = false;
                    lanes.forEach(l => {
                        const lRect = l.getBoundingClientRect();
                        if (moveEv.clientY >= lRect.top && moveEv.clientY <= lRect.bottom) {
                            candidateTrackId = l.getAttribute('data-track-id');
                            hoveredAnyLane = true;
                            l.style.background = 'rgba(10, 132, 255, 0.12)';
                            l.style.borderTop = '1px solid rgba(10, 132, 255, 0.4)';
                            l.style.borderBottom = '1px solid rgba(10, 132, 255, 0.4)';
                        } else {
                            const tObj = daw.tracks[l.getAttribute('data-track-id')];
                            l.style.background = (tObj?.color || '#ffffff') + '05';
                            l.style.borderTop = 'none';
                            l.style.borderBottom = '1px solid rgba(255,255,255,0.06)';
                        }
                    });

                    // Auto-Add Track Detection: Dragging below the bottom-most track lane
                    if (!hoveredAnyLane && lanes.length > 0) {
                        const lastLane = lanes[lanes.length - 1];
                        const lastLaneRect = lastLane.getBoundingClientRect();
                        if (moveEv.clientY > lastLaneRect.bottom - 4) {
                            candidateTrackId = '__NEW_TRACK__';
                        }
                    }

                    // Real-Time Drop Ghost Preview on Candidate Track Lane or Bottom New Track Zone
                    if (candidateTrackId === '__NEW_TRACK__') {
                        const lanesContainer = document.getElementById('timeline-lanes-container');
                        if (lanesContainer && dropGhostEl) {
                            if (dropGhostEl.parentElement !== lanesContainer) {
                                lanesContainer.appendChild(dropGhostEl);
                            }
                            const lastLane = lanes[lanes.length - 1];
                            const ghostTop = (lastLane ? (lastLane.offsetTop + lastLane.offsetHeight + 4) : 10);
                            const ghostLeft = Math.max(0, proposedLeaderOffset * daw.zoom);
                            const ghostWidth = Math.max(34, activeDuration * daw.zoom);
                            const durStr = activeDuration >= 60 ? `${Math.floor(activeDuration / 60)}m ${(activeDuration % 60).toFixed(1)}s` : `${activeDuration.toFixed(2)}s`;

                            dropGhostEl.style.display = 'flex';
                            dropGhostEl.style.position = 'absolute';
                            dropGhostEl.style.top = `${ghostTop}px`;
                            dropGhostEl.style.height = `${lastLane?.offsetHeight || 68}px`;
                            dropGhostEl.style.left = `${ghostLeft}px`;
                            dropGhostEl.style.width = `${ghostWidth}px`;
                            dropGhostEl.style.border = '2px dashed #34d399';
                            dropGhostEl.style.background = 'rgba(52, 211, 153, 0.18)';
                            dropGhostEl.style.boxShadow = '0 0 16px rgba(52, 211, 153, 0.35)';

                            dropGhostEl.innerHTML = `
                                <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; pointer-events: none; z-index: 10;">
                                    <span style="font-size: 8px; font-weight: 800; background: #34d399; color: #000000; padding: 1px 5px; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.5px;">+ NEW TRACK</span>
                                    <span style="font-size: 11px; font-weight: 800; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${clip.name}</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0; pointer-events: none; z-index: 10;">
                                    <span style="font-size: 9px; font-family: monospace; font-weight: 800; color: #34d399; background: rgba(0,0,0,0.65); padding: 1px 5px; border-radius: 3px;">${proposedLeaderOffset.toFixed(2)}s</span>
                                    <span style="font-size: 9px; font-family: monospace; font-weight: 800; color: #ffffff; background: rgba(0,0,0,0.65); padding: 1px 5px; border-radius: 3px;">${durStr}</span>
                                </div>
                            `;
                        }
                    } else {
                        if (dropGhostEl) {
                            dropGhostEl.style.border = '2px dashed #0a84ff';
                            dropGhostEl.style.background = 'rgba(10, 132, 255, 0.2)';
                            dropGhostEl.style.boxShadow = 'none';
                        }
                        const candLane = candidateTrackId ? document.getElementById(`timeline-lane-${candidateTrackId}`) : null;
                        if (candLane && dropGhostEl) {
                            if (dropGhostEl.parentElement !== candLane) {
                                candLane.appendChild(dropGhostEl);
                            }
                            const ghostLeft = Math.max(0, proposedLeaderOffset * daw.zoom);
                            const ghostWidth = Math.max(34, activeDuration * daw.zoom);
                            const targetTrackObj = daw.tracks[candidateTrackId];
                            const durStr = activeDuration >= 60 ? `${Math.floor(activeDuration / 60)}m ${(activeDuration % 60).toFixed(1)}s` : `${activeDuration.toFixed(2)}s`;

                            dropGhostEl.style.display = 'flex';
                            dropGhostEl.style.top = '4px';
                            dropGhostEl.style.bottom = '4px';
                            dropGhostEl.style.left = `${ghostLeft}px`;
                            dropGhostEl.style.width = `${ghostWidth}px`;

                            dropGhostEl.innerHTML = `
                                <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; pointer-events: none; z-index: 10;">
                                    <span style="font-size: 8px; font-weight: 800; background: #0a84ff; color: #ffffff; padding: 1px 4px; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.5px;">TARGET</span>
                                    <span style="font-size: 11px; font-weight: 800; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${clip.name}</span>
                                    <span style="font-size: 8.5px; color: rgba(255,255,255,0.7); font-family: monospace;">➔ ${targetTrackObj?.name || candidateTrackId}</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0; pointer-events: none; z-index: 10;">
                                    <span style="font-size: 9px; font-family: monospace; font-weight: 800; color: #34d399; background: rgba(0,0,0,0.65); padding: 1px 5px; border-radius: 3px;">${proposedLeaderOffset.toFixed(2)}s</span>
                                    <span style="font-size: 9px; font-family: monospace; font-weight: 800; color: #ffffff; background: rgba(0,0,0,0.65); padding: 1px 5px; border-radius: 3px;">${durStr}</span>
                                </div>
                            `;
                        } else if (dropGhostEl) {
                            dropGhostEl.style.display = 'none';
                        }
                    }
                };

                // Continuous 2D Auto-Scroll Animation Loop (Horizontally down timeline & Vertically into other tracks)
                const startContinuousAutoScroll = () => {
                    if (autoScrollRaf) return;

                    const stepAutoScroll = () => {
                        if (!hasDragged || !latestMoveEv || !viewport) {
                            autoScrollRaf = null;
                            return;
                        }

                        const vpRect = viewport.getBoundingClientRect();
                        const mouseX = latestMoveEv.clientX;
                        const mouseY = latestMoveEv.clientY;

                        let didScroll = false;

                        // 1. Horizontal Auto-Scroll (drag further down the line / timeline)
                        if (!latestMoveEv.shiftKey) {
                            const hMargin = 85;
                            if (mouseX > vpRect.right - hMargin) {
                                const ratio = Math.min(1, (mouseX - (vpRect.right - hMargin)) / hMargin);
                                const speed = Math.max(4, Math.round(ratio * 28));
                                viewport.scrollLeft += speed;
                                didScroll = true;
                            } else if (mouseX < vpRect.left + hMargin) {
                                const ratio = Math.min(1, ((vpRect.left + hMargin) - mouseX) / hMargin);
                                const speed = Math.max(4, Math.round(ratio * 28));
                                viewport.scrollLeft = Math.max(0, viewport.scrollLeft - speed);
                                didScroll = true;
                            }
                        }

                        // 2. Vertical Auto-Scroll (drag into another track further down or up)
                        const vMargin = 65;
                        if (mouseY > vpRect.bottom - vMargin) {
                            const ratio = Math.min(1, (mouseY - (vpRect.bottom - vMargin)) / vMargin);
                            const speed = Math.max(3, Math.round(ratio * 22));
                            viewport.scrollTop += speed;
                            didScroll = true;
                        } else if (mouseY < vpRect.top + vMargin) {
                            const ratio = Math.min(1, ((vpRect.top + vMargin) - mouseY) / vMargin);
                            const speed = Math.max(3, Math.round(ratio * 22));
                            viewport.scrollTop = Math.max(0, viewport.scrollTop - speed);
                            didScroll = true;
                        }

                        if (didScroll) {
                            updateDragState(latestMoveEv);
                        }

                        autoScrollRaf = requestAnimationFrame(stepAutoScroll);
                    };

                    autoScrollRaf = requestAnimationFrame(stepAutoScroll);
                };

                const onClipMouseMove = (moveEv) => {
                    latestMoveEv = moveEv;
                    updateDragState(moveEv);
                    if (hasDragged) {
                        startContinuousAutoScroll();
                    }
                };

                const onClipMouseUp = (upEv) => {
                    window.removeEventListener('mousemove', onClipMouseMove);
                    window.removeEventListener('mouseup', onClipMouseUp);

                    if (autoScrollRaf) {
                        cancelAnimationFrame(autoScrollRaf);
                        autoScrollRaf = null;
                    }
                    latestMoveEv = null;

                    if (dropGhostEl) {
                        dropGhostEl.remove();
                    }

                    if (sourceLane) {
                        sourceLane.style.zIndex = '';
                    }

                    document.body.style.userSelect = '';
                    document.body.style.webkitUserSelect = '';

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
                        l.style.background = isArmed ? 'rgba(255, 69, 58, 0.04)' : ((tObj?.color || '#ffffff') + '05');
                        l.style.borderTop = 'none';
                        l.style.borderBottom = '1px solid rgba(255,255,255,0.06)';
                    });

                    if (hasDragged) {
                        pushDawHistory('Move Clip');
                        const isHorizontalLocked = upEv.shiftKey;
                        const finalLeaderOffset = Number.isFinite(lastCalculatedProposedOffset) ? Math.max(0, lastCalculatedProposedOffset) : leaderInitOffset;
                        const effectiveDelta = isHorizontalLocked ? 0 : (finalLeaderOffset - leaderInitOffset);

                        // Apply new startOffset to all selected clips with NaN safety guards
                        daw.clips.forEach(c => {
                            if (daw.selectedClipIds.has(c.id)) {
                                const initOff = Number.isFinite(initialOffsets.get(c.id)) ? initialOffsets.get(c.id) : (c.startOffset || 0);
                                const newOff = Math.round((initOff + effectiveDelta) * 100) / 100;
                                c.startOffset = Number.isFinite(newOff) ? Math.max(0, newOff) : initOff;
                            }
                        });

                        // 2D Track Transfer: Reparent all co-selected clips proportionally based on track index diff, or auto-create new track if dropped at bottom
                        if (candidateTrackId === '__NEW_TRACK__') {
                            const newTrackId = addNewEmptyTrack('audio');
                            if (newTrackId && daw.tracks[newTrackId]) {
                                daw.clips.forEach(c => {
                                    if (daw.selectedClipIds.has(c.id)) {
                                        c.trackId = newTrackId;
                                    }
                                });
                                showStudioToast(`Auto-created "${daw.tracks[newTrackId].name}" for dropped clip`);
                            }
                        } else if (candidateTrackId && daw.tracks[candidateTrackId]) {
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
                        if (typeof window._syncBottomDeckClipInspector === 'function') window._syncBottomDeckClipInspector();
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

            // Mobile Touch Clip Dragging & Selection
            clipEl.addEventListener('touchstart', (e) => {
                if (e.touches.length !== 1) return;
                const touch = e.touches[0];
                if (e.target.closest('.daw-clip-trim-handle') || e.target.closest('.daw-clip-fade-handle')) return;

                daw.selectedClipIds.clear();
                daw.selectedClipIds.add(clip.id);
                daw.selectedClipId = clip.id;
                if (typeof window._syncBottomDeckClipInspector === 'function') window._syncBottomDeckClipInspector();
                document.querySelectorAll('.daw-timeline-clip').forEach(el => {
                    const isSel = el.getAttribute('data-clip-id') === clip.id;
                    el.classList.toggle('is-selected', isSel);
                    el.style.border = isSel ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.2)';
                });

                const startTouchX = touch.clientX;
                const leaderInitOffset = Number.isFinite(clip.startOffset) ? clip.startOffset : 0;
                let hasDraggedTouch = false;

                const onClipTouchMove = (moveEv) => {
                    if (moveEv.touches.length !== 1) return;
                    const t = moveEv.touches[0];
                    const dx = t.clientX - startTouchX;

                    if (!hasDraggedTouch && Math.abs(dx) > 6) {
                        hasDraggedTouch = true;
                    }
                    if (hasDraggedTouch) {
                        moveEv.preventDefault();
                        const deltaSec = dx / daw.zoom;
                        const newOffset = Math.max(0, leaderInitOffset + deltaSec);
                        clipEl.style.transform = `translateX(${dx}px)`;
                        clip.startOffset = Math.round(newOffset * 100) / 100;
                    }
                };

                const onClipTouchEnd = () => {
                    window.removeEventListener('touchmove', onClipTouchMove);
                    window.removeEventListener('touchend', onClipTouchEnd);
                    window.removeEventListener('touchcancel', onClipTouchEnd);
                    clipEl.style.transform = '';
                    if (hasDraggedTouch) {
                        pushDawHistory(`Move Clip "${clip.name}"`);
                        recalculateDawDuration();
                        renderDawClips();
                        if (typeof autoSaveDawSession === 'function') autoSaveDawSession();
                    }
                };

                window.addEventListener('touchmove', onClipTouchMove, { passive: false });
                window.addEventListener('touchend', onClipTouchEnd);
                window.addEventListener('touchcancel', onClipTouchEnd);
            }, { passive: true });

            // Double click to open Inspector / Rename Modal
            clipEl.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                openClipPropertiesModal(clip);
            });

            laneEl.appendChild(clipEl);
        });

        // Detect Adjacent & Overlapping Clip Junctions on Each Track & Render Sleek Purple Floating Crossfade CTA
        Object.keys(daw.tracks).forEach(tid => {
            const laneEl = document.getElementById(`timeline-lane-${tid}`);
            if (!laneEl) return;
            const trackClips = daw.clips.filter(c => c.trackId === tid).sort((a,b) => a.startOffset - b.startOffset);
            for (let i = 0; i < trackClips.length - 1; i++) {
                const cA = trackClips[i];
                const cB = trackClips[i+1];
                const durA = Math.max(0.5, (cA.trimEnd || cA.duration || 0) - (cA.trimStart || 0));
                const endA = cA.startOffset + durA;
                const startB = cB.startOffset;
                const overlap = endA - startB; // >0 if overlapping, ~0 if touching

                // Touching, overlapping, or within 0.8s seam
                if (overlap >= -0.8 && overlap <= Math.min(cA.duration || 10, cB.duration || 10)) {
                    const seamTime = (endA + startB) / 2;
                    const seamPx = seamTime * daw.zoom;
                    const isOverlapping = overlap > 0.05;

                    // If clips overlap on timeline, draw visual crossfade overlay region directly over the intersection
                    if (isOverlapping) {
                        const overlapStartPx = startB * daw.zoom;
                        const overlapWidthPx = Math.max(16, overlap * daw.zoom);
                        const xfadeRegionEl = document.createElement('div');
                        xfadeRegionEl.className = 'daw-crossfade-overlap-region';
                        xfadeRegionEl.setAttribute('title', `Crossfade Region (${overlap.toFixed(2)}s) — Click to configure curve`);
                        xfadeRegionEl.style.cssText = `
                            position: absolute;
                            left: ${overlapStartPx}px;
                            width: ${overlapWidthPx}px;
                            top: 6px;
                            bottom: 6px;
                            border: 1.5px dashed #0a84ff;
                            background: rgba(10, 132, 255, 0.18);
                            border-radius: 6px;
                            pointer-events: auto;
                            cursor: pointer;
                            z-index: 38;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            box-shadow: 0 0 12px rgba(10, 132, 255, 0.35);
                            transition: background 0.15s, border-color 0.15s;
                        `;
                        xfadeRegionEl.innerHTML = `
                            <svg width="18" height="12" viewBox="0 0 24 14" fill="none" stroke="#0a84ff" stroke-width="2" style="opacity: 0.9; pointer-events: none;">
                                <path d="M2 12 C 10 12, 14 2, 22 2"/>
                                <path d="M2 2 C 10 2, 14 12, 22 12"/>
                            </svg>
                        `;
                        xfadeRegionEl.addEventListener('mouseenter', () => {
                            xfadeRegionEl.style.background = 'rgba(10, 132, 255, 0.32)';
                            xfadeRegionEl.style.borderColor = '#ffffff';
                        });
                        xfadeRegionEl.addEventListener('mouseleave', () => {
                            xfadeRegionEl.style.background = 'rgba(10, 132, 255, 0.18)';
                            xfadeRegionEl.style.borderColor = '#0a84ff';
                        });
                        xfadeRegionEl.addEventListener('click', (e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            openCrossfadeModal(cA, cB);
                        });
                        laneEl.appendChild(xfadeRegionEl);
                    }

                    const cta = document.createElement('button');
                    cta.className = 'daw-crossfade-seam-cta';
                    cta.setAttribute('title', `Crossfade "${cA.name}" & "${cB.name}" (Equal Power 3dB, Linear, S-Curve)`);
                    cta.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 19L20 5M4 5l16 14"/></svg> Crossfade';
                    cta.style.cssText = `
                        position: absolute;
                        left: ${seamPx}px;
                        top: 4px;
                        transform: translateX(-50%);
                        z-index: 55;
                        background: linear-gradient(135deg, rgba(10, 132, 255, 0.95), rgba(0, 100, 220, 0.95));
                        border: 1px solid rgba(147, 197, 253, 0.85);
                        color: #ffffff;
                        font-size: 9.5px;
                        font-weight: 800;
                        padding: 2px 8px;
                        border-radius: 12px;
                        cursor: pointer;
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                        box-shadow: 0 0 14px rgba(10, 132, 255, 0.65), 0 4px 10px rgba(0,0,0,0.6);
                        white-space: nowrap;
                        opacity: ${isOverlapping ? '0.92' : '0.45'};
                        transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s;
                    `;

                    cta.addEventListener('mouseenter', () => {
                        cta.style.opacity = '1';
                        cta.style.transform = 'translateX(-50%) scale(1.08)';
                        cta.style.boxShadow = '0 0 20px rgba(10, 132, 255, 0.85), 0 4px 12px rgba(0,0,0,0.7)';
                    });
                    cta.addEventListener('mouseleave', () => {
                        cta.style.opacity = isOverlapping ? '0.92' : '0.45';
                        cta.style.transform = 'translateX(-50%) scale(1)';
                        cta.style.boxShadow = '0 0 14px rgba(10, 132, 255, 0.65), 0 4px 10px rgba(0,0,0,0.6)';
                    });
                    cta.addEventListener('click', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        openCrossfadeModal(cA, cB);
                    });

                    laneEl.appendChild(cta);
                }
            }
        });

        // Update timeline-crossfade-btn enabled state based on selection
        const xfadeToolbarBtn = document.getElementById('timeline-crossfade-btn');
        if (xfadeToolbarBtn) {
            let canXfade = false;
            if (daw.selectedClipIds && daw.selectedClipIds.size === 2) {
                const sel = daw.clips.filter(c => daw.selectedClipIds.has(c.id));
                if (sel.length === 2 && sel[0].trackId === sel[1].trackId) {
                    canXfade = true;
                }
            }
            if (canXfade) {
                xfadeToolbarBtn.style.opacity = '1';
                xfadeToolbarBtn.style.cursor = 'pointer';
                xfadeToolbarBtn.style.background = 'rgba(94, 92, 230, 0.25)';
                xfadeToolbarBtn.style.borderColor = '#c084fc';
                xfadeToolbarBtn.style.boxShadow = '0 0 12px rgba(94, 92, 230, 0.45)';
            } else {
                xfadeToolbarBtn.style.opacity = '0.45';
                xfadeToolbarBtn.style.cursor = 'not-allowed';
                xfadeToolbarBtn.style.background = 'rgba(94, 92, 230, 0.12)';
                xfadeToolbarBtn.style.borderColor = 'rgba(94, 92, 230, 0.35)';
                xfadeToolbarBtn.style.boxShadow = 'none';
            }
        }
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
        daw._selectedColor = clip.color || '#30d158';

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
            showStudioToast(`Normalized peak to 0 dBFS (Gain: ${normalizedGain.toFixed(2)}x)`);
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

    // ==========================================================
    // PROFESSIONAL AUDIO CROSSFADE TRANSITION ENGINE
    // Equal Power 3dB (Constant Energy), Linear 6dB, S-Curve, Exponential, Logarithmic
    // Real-time interactive curve visualizer, junction hover detection & toolbar integration
    // ==========================================================
    let _activeCrossfadeAlign = 'center';

    const updateCrossfadePreviewSvg = (duration, shape, align) => {
        const pathA = document.getElementById('daw-xfade-curve-a');
        const pathB = document.getElementById('daw-xfade-curve-b');
        const nodeCenter = document.getElementById('daw-xfade-node-center');
        const centerDb = document.getElementById('daw-crossfade-center-db');
        if (!pathA || !pathB) return;

        const STEPS = 32;
        let dA = 'M ';
        let dB = 'M ';
        const W = 400;
        const topY = 12;
        const botY = 68;

        for (let i = 0; i <= STEPS; i++) {
            const t = i / STEPS;
            const x = t * W;
            // Clip A fades out (gain goes 1 -> 0)
            const gainA = fadeShapeGain(1 - t, shape);
            const yA = botY - gainA * (botY - topY);
            // Clip B fades in (gain goes 0 -> 1)
            const gainB = fadeShapeGain(t, shape);
            const yB = botY - gainB * (botY - topY);

            dA += `${i === 0 ? '' : 'L '}${x.toFixed(1)} ${yA.toFixed(1)} `;
            dB += `${i === 0 ? '' : 'L '}${x.toFixed(1)} ${yB.toFixed(1)} `;
        }
        pathA.setAttribute('d', dA);
        pathB.setAttribute('d', dB);

        // Calculate center intersection dB
        const midGain = fadeShapeGain(0.5, shape);
        const midDb = midGain > 0.001 ? (20 * Math.log10(midGain)).toFixed(1) : '-inf';
        const midY = botY - midGain * (botY - topY);
        if (nodeCenter) {
            nodeCenter.setAttribute('cy', midY.toFixed(1));
        }
        if (centerDb) {
            const desc = shape === 'equalpower' ? 'Constant Perceived Loudness (3dB dip)' : (shape === 'linear' ? 'Constant Gain (6dB dip)' : 'Smooth Transition');
            centerDb.textContent = `Center: ${midDb} dBFS (${desc})`;
        }
    };

    const openCrossfadeModal = (clipA, clipB) => {
        if (!clipA || !clipB) return;
        // Ensure clipA is chronologically before clipB
        if (clipA.startOffset > clipB.startOffset) {
            const temp = clipA;
            clipA = clipB;
            clipB = temp;
        }

        daw._crossfadePair = { clipA, clipB };

        const modal = document.getElementById('daw-crossfade-modal');
        const nameA = document.getElementById('daw-crossfade-clip-a-name');
        const nameB = document.getElementById('daw-crossfade-clip-b-name');
        const durSlider = document.getElementById('daw-crossfade-dur-slider');
        const durLabel = document.getElementById('daw-crossfade-dur-label');
        const shapeSelect = document.getElementById('daw-crossfade-shape-select');

        if (nameA) nameA.textContent = clipA.name || 'Clip A';
        if (nameB) nameB.textContent = clipB.name || 'Clip B';

        // Calculate current overlap if any
        const durA = Math.max(0.5, (clipA.trimEnd || clipA.duration || 0) - (clipA.trimStart || 0));
        const endA = clipA.startOffset + durA;
        const startB = clipB.startOffset;
        const currentOverlap = endA - startB;

        let initialDur = 0.50;
        if (clipB.fadeIn && clipB.fadeIn > 0.02) {
            initialDur = clipB.fadeIn;
        } else if (clipA.fadeOut && clipA.fadeOut > 0.02) {
            initialDur = clipA.fadeOut;
        } else if (currentOverlap > 0.05) {
            initialDur = Math.round(currentOverlap * 100) / 100;
        }

        const initialShape = clipB.fadeInShape || clipA.fadeOutShape || 'equalpower';

        if (durSlider) durSlider.value = initialDur;
        if (durLabel) durLabel.textContent = `${initialDur.toFixed(2)}s (${Math.round(initialDur * 1000)}ms)`;
        if (shapeSelect) shapeSelect.value = initialShape;

        _activeCrossfadeAlign = 'center';
        document.querySelectorAll('.daw-xfade-align-btn').forEach(btn => {
            const isAct = btn.getAttribute('data-align') === _activeCrossfadeAlign;
            btn.style.background = isAct ? 'rgba(94, 92, 230,0.25)' : 'rgba(255,255,255,0.06)';
            btn.style.borderColor = isAct ? '#5e5ce6' : 'rgba(255,255,255,0.15)';
            btn.style.color = isAct ? '#c084fc' : 'rgba(255,255,255,0.7)';
        });

        updateCrossfadePreviewSvg(initialDur, initialShape, _activeCrossfadeAlign);

        if (modal) {
            modal.style.display = 'flex';
        }
    };

    const applyCrossfadeToClips = (clipA, clipB, duration, shape, align) => {
        if (!clipA || !clipB) return;
        const dur = Math.max(0.05, Math.min(5.0, duration));
        const curve = shape || 'equalpower';

        const durA = Math.max(0.5, (clipA.trimEnd || clipA.duration || 0) - (clipA.trimStart || 0));
        const endA = clipA.startOffset + durA;
        const startB = clipB.startOffset;
        const currentOverlap = endA - startB;

        // If clips are butted together or have smaller overlap than target duration, adjust clipB startOffset to create overlap
        if (currentOverlap < dur - 0.01) {
            clipB.startOffset = Math.max(0, Math.round((endA - dur) * 100) / 100);
        }

        clipA.fadeOut = dur;
        clipA.fadeOutShape = curve;
        clipA.fadeOutCurve = 0;
        clipA.crossfadeWith = clipB.id;

        clipB.fadeIn = dur;
        clipB.fadeInShape = curve;
        clipB.fadeInCurve = 0;
        clipB.crossfadeWith = clipA.id;

        pushDawHistory(`Apply Crossfade (${dur.toFixed(2)}s ${curve})`);
        recalculateDawDuration();
        renderDawTracks();
        renderDawClips();
        renderDawRuler();

        showStudioToast(`⤬ Applied ${dur.toFixed(2)}s ${curve.toUpperCase()} Crossfade`);
    };

    const removeCrossfadeFromClips = (clipA, clipB) => {
        if (!clipA || !clipB) return;
        clipA.fadeOut = 0;
        clipA.fadeOutShape = undefined;
        delete clipA.crossfadeWith;

        clipB.fadeIn = 0;
        clipB.fadeInShape = undefined;
        delete clipB.crossfadeWith;

        pushDawHistory('Remove Crossfade');
        renderDawClips();
        showStudioToast('Crossfade removed');
    };

    // Combine / Glue Clips (OfflineAudioContext Baker - Pro Tools Consolidate / Audition Merge)
    const combineSelectedClipsDAW = async () => {
        let clipA = null;
        let clipB = null;

        if (daw._crossfadePair && daw._crossfadePair.clipA && daw._crossfadePair.clipB) {
            clipA = daw._crossfadePair.clipA;
            clipB = daw._crossfadePair.clipB;
        } else if (daw.selectedClipIds && daw.selectedClipIds.size === 2) {
            const ids = Array.from(daw.selectedClipIds);
            clipA = daw.clips.find(c => c.id === ids[0]);
            clipB = daw.clips.find(c => c.id === ids[1]);
        } else if (daw.selectedClipId) {
            const c1 = daw.clips.find(c => c.id === daw.selectedClipId);
            if (c1 && c1.crossfadeWith) {
                clipA = c1;
                clipB = daw.clips.find(c => c.id === c1.crossfadeWith);
            }
        }

        if (!clipA || !clipB) {
            showStudioToast('Please select two adjacent or overlapping clips on the same track to combine/glue.');
            return;
        }

        if (clipA.trackId !== clipB.trackId) {
            showStudioToast('Clips must be on the same audio track to combine.');
            return;
        }

        // Sort chronologically
        const first = clipA.startOffset <= clipB.startOffset ? clipA : clipB;
        const second = first === clipA ? clipB : clipA;

        const durA = Math.max(0.01, (first.trimEnd || first.duration || 0) - (first.trimStart || 0));
        const endA = first.startOffset + durA;
        const durB = Math.max(0.01, (second.trimEnd || second.duration || 0) - (second.trimStart || 0));
        const endB = second.startOffset + durB;

        const combinedStart = first.startOffset;
        const combinedEnd = Math.max(endA, endB);
        const combinedDur = Math.max(0.05, combinedEnd - combinedStart);
        const sampleRate = daw.sampleRate || 48000;
        const totalSamples = Math.ceil(combinedDur * sampleRate);

        showStudioToast('Gluing & baking crossfade audio...');

        try {
            const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, totalSamples, sampleRate);

            const decodeBufferIfNeed = async (clip) => {
                if (clip.buffer) return clip.buffer;
                if (clip.blobUrl) {
                    const res = await fetch(clip.blobUrl);
                    const ab = await res.arrayBuffer();
                    return await offlineCtx.decodeAudioData(ab);
                }
                return null;
            };

            const bufA = await decodeBufferIfNeed(first);
            const bufB = await decodeBufferIfNeed(second);

            if (!bufA || !bufB) {
                showStudioToast('Could not load audio buffers to combine');
                return;
            }

            // Schedule first clip
            const srcA = offlineCtx.createBufferSource();
            srcA.buffer = bufA;
            const gainA = offlineCtx.createGain();
            srcA.connect(gainA);
            gainA.connect(offlineCtx.destination);

            const schedA = 0;
            const fadeOutDur = first.fadeOut || 0;
            if (fadeOutDur > 0) {
                const fadeStart = schedA + durA - fadeOutDur;
                gainA.gain.setValueAtTime(1.0, Math.max(0, fadeStart));
                gainA.gain.linearRampToValueAtTime(0.0001, schedA + durA);
            }
            srcA.start(schedA, first.trimStart || 0, durA);

            // Schedule second clip
            const srcB = offlineCtx.createBufferSource();
            srcB.buffer = bufB;
            const gainB = offlineCtx.createGain();
            srcB.connect(gainB);
            gainB.connect(offlineCtx.destination);

            const schedB = Math.max(0, second.startOffset - combinedStart);
            const fadeInDur = second.fadeIn || 0;
            if (fadeInDur > 0) {
                gainB.gain.setValueAtTime(0.0001, schedB);
                gainB.gain.linearRampToValueAtTime(1.0, schedB + fadeInDur);
            }
            srcB.start(schedB, second.trimStart || 0, durB);

            const renderedBuf = await offlineCtx.startRendering();
            const wavBlob = audioBufferToWav(renderedBuf);
            const wavUrl = URL.createObjectURL(wavBlob);

            const gluedClip = {
                id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                trackId: first.trackId,
                name: `${first.name} + ${second.name} (Glued)`,
                tag: first.tag || second.tag || 'Audio',
                startOffset: combinedStart,
                trimStart: 0,
                trimEnd: combinedDur,
                duration: combinedDur,
                blob: wavBlob,
                blobUrl: wavUrl,
                buffer: renderedBuf,
                peaks: extractWaveformPeaks(renderedBuf, 500),
                color: '#5e5ce6'
            };

            const idxA = daw.clips.findIndex(c => c.id === first.id);
            daw.clips = daw.clips.filter(c => c.id !== first.id && c.id !== second.id);
            daw.clips.splice(idxA >= 0 ? idxA : daw.clips.length, 0, gluedClip);

            daw.selectedClipId = gluedClip.id;
            daw.selectedClipIds = new Set([gluedClip.id]);
            daw._crossfadePair = null;

            const crossfadeModal = document.getElementById('daw-crossfade-modal');
            if (crossfadeModal) crossfadeModal.style.display = 'none';

            pushDawHistory(`Combine / Glue Clips (${first.name} & ${second.name})`);
            recalculateDawDuration();
            renderDawTracks();
            renderDawRuler();
            renderDawClips();
            showStudioToast(`🔗 Glued clips into single continuous audio clip "${gluedClip.name}"`);
        } catch (err) {
            console.error('Error combining clips:', err);
            showStudioToast('Failed to combine clips');
        }
    };

    // ═════════════════════════════════════════════════════════════════
    // AUDIOSUITE OFFLINE DSP PROCESSING ENGINE (PRO TOOLS STYLE)
    // ═════════════════════════════════════════════════════════════════
    const normalizeSelectedClip = () => {
        const clip = daw.clips && daw.clips.find(c => c.id === daw.selectedClipId);
        if (!clip || !clip.buffer) {
            showStudioToast('Select an audio clip first to peak normalize');
            return;
        }
        let maxPeak = 0;
        const numChannels = clip.buffer.numberOfChannels;
        for (let ch = 0; ch < numChannels; ch++) {
            const data = clip.buffer.getChannelData(ch);
            for (let i = 0; i < data.length; i++) {
                const abs = Math.abs(data[i]);
                if (abs > maxPeak) maxPeak = abs;
            }
        }
        if (maxPeak <= 0.00001) {
            showStudioToast(`Clip [${clip.name}] is completely silent (cannot normalize)`);
            return;
        }
        pushDawHistory(`Peak Normalize [${clip.name}]`);
        // Normalize to 0.0 dBFS (peak 1.0)
        const normFactor = 1.0 / maxPeak;
        for (let ch = 0; ch < numChannels; ch++) {
            const data = clip.buffer.getChannelData(ch);
            for (let i = 0; i < data.length; i++) {
                data[i] = Math.max(-1.0, Math.min(1.0, data[i] * normFactor));
            }
        }
        clip.gain = 1.0;
        if (typeof audioBufferToWav === 'function') {
            const newBlob = audioBufferToWav(clip.buffer);
            clip.blob = newBlob;
            clip.blobUrl = URL.createObjectURL(newBlob);
        }
        clip.peaks = extractWaveformPeaks(clip.buffer, 400);
        renderDawClips();
        window._syncBottomDeckClipInspector?.();
        const peakDbBefore = 20 * Math.log10(maxPeak);
        const boostDb = (20 * Math.log10(normFactor)).toFixed(1);
        showStudioToast(`Normalized [${clip.name}]: ${peakDbBefore.toFixed(1)} dBFS → 0.0 dBFS (+${boostDb} dB)`);
    };

    const reverseSelectedClip = () => {
        const clip = daw.clips && daw.clips.find(c => c.id === daw.selectedClipId);
        if (!clip || !clip.buffer) {
            showStudioToast('Select an audio clip first to reverse');
            return;
        }
        pushDawHistory(`Reverse Audio [${clip.name}]`);
        const numChannels = clip.buffer.numberOfChannels;
        for (let ch = 0; ch < numChannels; ch++) {
            Array.prototype.reverse.call(clip.buffer.getChannelData(ch));
        }
        if (typeof audioBufferToWav === 'function') {
            const newBlob = audioBufferToWav(clip.buffer);
            clip.blob = newBlob;
            clip.blobUrl = URL.createObjectURL(newBlob);
        }
        clip.peaks = extractWaveformPeaks(clip.buffer, 400);
        renderDawClips();
        window._syncBottomDeckClipInspector?.();
        showStudioToast(`Reversed audio on [${clip.name}]`);
    };

    // ═════════════════════════════════════════════════════════════════
    // TRACK-LEVEL PEAK NORMALIZATION ENGINE (0.0 dBFS PRO TOOLS STYLE)
    // ═════════════════════════════════════════════════════════════════
    const normalizeTrackDAW = (trackId) => {
        const targetId = trackId || daw._activeFxTrackId || (daw.tracks && Object.keys(daw.tracks)[0]);
        const track = daw.tracks && daw.tracks[targetId];
        if (!track) {
            showStudioToast('Select an active audio track to normalize');
            return;
        }

        const clipsOnTrack = (daw.clips || []).filter(c => c.trackId === targetId && c.buffer);
        if (clipsOnTrack.length === 0) {
            showStudioToast(`Track "${track.name}" has no audio clips to normalize`);
            return;
        }

        // Find the global maximum sample peak across all clips on this track
        let maxPeak = 0;
        clipsOnTrack.forEach(clip => {
            const numChannels = clip.buffer.numberOfChannels;
            for (let ch = 0; ch < numChannels; ch++) {
                const data = clip.buffer.getChannelData(ch);
                for (let i = 0; i < data.length; i++) {
                    const abs = Math.abs(data[i]);
                    if (abs > maxPeak) maxPeak = abs;
                }
            }
        });

        if (maxPeak <= 0.00001) {
            showStudioToast(`Track "${track.name}" is completely silent (cannot normalize)`);
            return;
        }

        pushDawHistory(`Peak Normalize Track [${track.name}]`);
        // Proportional normalization to 0.0 dBFS (peak 1.0)
        const normFactor = 1.0 / maxPeak;
        clipsOnTrack.forEach(clip => {
            const numChannels = clip.buffer.numberOfChannels;
            for (let ch = 0; ch < numChannels; ch++) {
                const data = clip.buffer.getChannelData(ch);
                for (let i = 0; i < data.length; i++) {
                    data[i] = Math.max(-1.0, Math.min(1.0, data[i] * normFactor));
                }
            }
            clip.gain = 1.0;
            if (typeof audioBufferToWav === 'function') {
                const newBlob = audioBufferToWav(clip.buffer);
                clip.blob = newBlob;
                clip.blobUrl = URL.createObjectURL(newBlob);
            }
            clip.peaks = extractWaveformPeaks(clip.buffer, 400);
        });

        renderDawClips();
        window._syncBottomDeckClipInspector?.();
        const peakDbBefore = 20 * Math.log10(maxPeak);
        const boostDb = (20 * Math.log10(normFactor)).toFixed(1);
        showStudioToast(`Normalized Track "${track.name}": ${peakDbBefore.toFixed(1)} dBFS → 0.0 dBFS (+${boostDb} dB across ${clipsOnTrack.length} clip${clipsOnTrack.length === 1 ? '' : 's'})`);
    };
    window.normalizeTrackDAW = normalizeTrackDAW;

    // ═════════════════════════════════════════════════════════════════
    // MULTI-TRACK COMBINE & MERGE / STEM BOUNCE ENGINE (OFFLINE DSP)
    // ═════════════════════════════════════════════════════════════════
    const openMergeTracksModal = (initialTrackId = null) => {
        const modal = document.getElementById('daw-merge-tracks-modal');
        const checklist = document.getElementById('daw-merge-tracks-checklist');
        const nameInput = document.getElementById('daw-merge-target-name');
        if (!modal || !checklist) return;

        const trackKeys = Object.keys(daw.tracks || {});
        if (trackKeys.length === 0) {
            showStudioToast('No tracks available in session to merge');
            return;
        }

        const preselectId = initialTrackId || daw._activeFxTrackId || trackKeys[0];
        if (nameInput) {
            nameInput.value = `Merged Stems (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
        }

        checklist.innerHTML = trackKeys.map((key) => {
            const tr = daw.tracks[key];
            const clipCount = (daw.clips || []).filter(c => c.trackId === key).length;
            const isChecked = (key === preselectId || (initialTrackId === null && clipCount > 0));
            return `
                <label style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; cursor: pointer; user-select: none;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" class="daw-merge-track-checkbox" data-track-id="${tr.id}" ${isChecked ? 'checked' : ''} style="accent-color: #34d399; width: 14px; height: 14px; cursor: pointer;">
                        <span style="width: 8px; height: 8px; border-radius: 50%; background: ${tr.color || '#0a84ff'}; box-shadow: 0 0 6px ${tr.color || '#0a84ff'};"></span>
                        <span style="font-size: 11.5px; font-weight: 700; color: #ffffff;">${escapeStudioHtml(tr.name)}</span>
                    </div>
                    <span style="font-size: 9.5px; color: rgba(255,255,255,0.5); font-family: monospace;">${clipCount} clip${clipCount === 1 ? '' : 's'} · ${(tr.channels || 'stereo').toUpperCase()}</span>
                </label>
            `;
        }).join('');

        modal.style.display = 'flex';
    };
    window.openMergeTracksModal = openMergeTracksModal;

    const closeMergeTracksModal = () => {
        const modal = document.getElementById('daw-merge-tracks-modal');
        if (modal) modal.style.display = 'none';
    };
    window.closeMergeTracksModal = closeMergeTracksModal;

    const executeMergeTracks = async () => {
        const modal = document.getElementById('daw-merge-tracks-modal');
        const checkboxes = modal?.querySelectorAll('.daw-merge-track-checkbox:checked');
        if (!checkboxes || checkboxes.length === 0) {
            showStudioToast('Select at least one track to combine / merge');
            return;
        }

        const selectedTrackIds = Array.from(checkboxes).map(cb => cb.getAttribute('data-track-id')).filter(Boolean);
        const clipsToMerge = (daw.clips || []).filter(c => selectedTrackIds.includes(c.trackId) && c.buffer && !c.muted);

        if (clipsToMerge.length === 0) {
            showStudioToast('Selected tracks do not contain any active audio clips');
            return;
        }

        // Find session duration of the selected tracks
        let maxTimeSec = 0;
        clipsToMerge.forEach(c => {
            const start = c.startOffset || 0;
            const dur = (c.trimEnd || c.duration) - (c.trimStart || 0);
            if (start + dur > maxTimeSec) maxTimeSec = start + dur;
        });

        if (maxTimeSec <= 0.05) {
            showStudioToast('Invalid duration for track merge');
            return;
        }

        const nameInput = document.getElementById('daw-merge-target-name');
        const mergedTitle = (nameInput && nameInput.value.trim()) || 'Merged Audio Stem';
        const muteSources = !!document.getElementById('daw-merge-mute-sources')?.checked;
        const normalizeResult = !!document.getElementById('daw-merge-normalize-result')?.checked;

        closeMergeTracksModal();
        showStudioToast(`Merging ${selectedTrackIds.length} tracks (${clipsToMerge.length} clips) offline...`);

        try {
            const sampleRate = daw.audioCtx?.sampleRate || daw.sampleRate || 48000;
            const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, Math.max(1, Math.ceil(maxTimeSec * sampleRate)), sampleRate);

            // Connect and schedule each clip with track volume and pan
            selectedTrackIds.forEach(trId => {
                const track = daw.tracks[trId];
                if (!track) return;
                const trClips = clipsToMerge.filter(c => c.trackId === trId);
                if (trClips.length === 0) return;

                const trackGain = offlineCtx.createGain();
                trackGain.gain.value = Number.isFinite(track.vol) ? track.vol : 1.0;

                // Stereo Panning
                let trackPanner = null;
                if (offlineCtx.createStereoPanner) {
                    trackPanner = offlineCtx.createStereoPanner();
                    trackPanner.pan.value = Math.max(-1, Math.min(1, Number.isFinite(track.pan) ? track.pan : 0));
                    trackGain.connect(trackPanner);
                    trackPanner.connect(offlineCtx.destination);
                } else {
                    trackGain.connect(offlineCtx.destination);
                }

                trClips.forEach(clip => {
                    const source = offlineCtx.createBufferSource();
                    source.buffer = clip.buffer;

                    const clipGain = offlineCtx.createGain();
                    clipGain.gain.value = Number.isFinite(clip.gain) ? clip.gain : 1.0;
                    source.connect(clipGain);
                    clipGain.connect(trackGain);

                    const start = Math.max(0, clip.startOffset || 0);
                    const trimStart = Math.max(0, clip.trimStart || 0);
                    const trimEnd = clip.trimEnd || clip.duration || clip.buffer.duration;
                    const dur = Math.max(0.01, trimEnd - trimStart);

                    source.start(start, trimStart, dur);
                });
            });

            const renderedBuffer = await offlineCtx.startRendering();

            // Optional normalization of merged buffer
            if (normalizeResult) {
                let mPeak = 0;
                for (let ch = 0; ch < renderedBuffer.numberOfChannels; ch++) {
                    const d = renderedBuffer.getChannelData(ch);
                    for (let i = 0; i < d.length; i += 2) {
                        const abs = Math.abs(d[i]);
                        if (abs > mPeak) mPeak = abs;
                    }
                }
                if (mPeak > 0.0001) {
                    const factor = 1.0 / mPeak;
                    for (let ch = 0; ch < renderedBuffer.numberOfChannels; ch++) {
                        const d = renderedBuffer.getChannelData(ch);
                        for (let i = 0; i < d.length; i++) {
                            d[i] = Math.max(-1.0, Math.min(1.0, d[i] * factor));
                        }
                    }
                }
            }

            // Create new Track for merged audio
            pushDawHistory(`Merge Tracks into [${mergedTitle}]`);
            const newTrackId = addNewEmptyTrack('audio');
            if (daw.tracks[newTrackId]) {
                daw.tracks[newTrackId].name = mergedTitle;
                daw.tracks[newTrackId].channels = 'stereo';
                daw.tracks[newTrackId].color = '#30d158';
            }

            const wavBlob = audioBufferToWav(renderedBuffer);
            const newClipId = `clip_merged_${Date.now()}`;
            const newClip = {
                id: newClipId,
                trackId: newTrackId,
                name: `${mergedTitle}.wav`,
                tag: 'STEM',
                buffer: renderedBuffer,
                blob: wavBlob,
                blobUrl: URL.createObjectURL(wavBlob),
                startOffset: 0,
                trimStart: 0,
                trimEnd: maxTimeSec,
                duration: maxTimeSec,
                color: '#30d158',
                fadeIn: 0,
                fadeOut: 0,
                gain: 1.0,
                muted: false,
                peaks: extractWaveformPeaks(renderedBuffer, 400)
            };

            daw.clips.push(newClip);
            daw.selectedClipId = newClipId;
            if (!daw.selectedClipIds) daw.selectedClipIds = new Set();
            daw.selectedClipIds.clear();
            daw.selectedClipIds.add(newClipId);

            // Mute source tracks if requested
            if (muteSources) {
                selectedTrackIds.forEach(id => {
                    if (daw.tracks[id]) daw.tracks[id].muted = true;
                });
            }

            recalculateDawDuration();
            renderDawTracks();
            renderDawClips();
            renderDawRuler();
            if (typeof renderMixerStrips === 'function') renderMixerStrips();
            if (typeof syncActiveTrackToDeck === 'function') syncActiveTrackToDeck();

            showStudioToast(`Successfully combined ${selectedTrackIds.length} tracks into "${mergedTitle}"!`);
        } catch (mergeErr) {
            console.error('[DAW Merge] Offline render error:', mergeErr);
            showStudioToast(`Merge failed: ${mergeErr.message}`);
        }
    };
    window.executeMergeTracks = executeMergeTracks;

    // Duplicate Track along with all its clips
    const duplicateTrackDAW = (trackId) => {
        const srcTrack = daw.tracks && daw.tracks[trackId];
        if (!srcTrack) return;
        pushDawHistory(`Duplicate Track [${srcTrack.name}]`);
        const count = Object.keys(daw.tracks).length;
        const newTrackId = `track_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        daw.tracks[newTrackId] = JSON.parse(JSON.stringify(srcTrack));
        daw.tracks[newTrackId].id = newTrackId;
        daw.tracks[newTrackId].name = `${srcTrack.name} (Copy)`;

        // Clone all clips on source track
        const clipsOnSrc = (daw.clips || []).filter(c => c.trackId === trackId);
        clipsOnSrc.forEach(orig => {
            const copyClip = {
                ...orig,
                id: `clip_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
                trackId: newTrackId,
                name: `${orig.name} (Copy)`
            };
            daw.clips.push(copyClip);
        });

        recalculateDawDuration();
        renderDawTracks();
        renderDawClips();
        renderDawRuler();
        if (typeof renderMixerStrips === 'function') renderMixerStrips();
        if (typeof syncActiveTrackToDeck === 'function') syncActiveTrackToDeck();
        showStudioToast(`Duplicated Track "${srcTrack.name}" with ${clipsOnSrc.length} clip(s)`);
    };
    window.duplicateTrackDAW = duplicateTrackDAW;

    // Offline DSP Time Stretch & Pitch Shift Engine
    const processAudioBufferTimePitch = async (sourceBuffer, mode, semitones, stretchRatio) => {
        const audioCtx = daw.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        const channels = sourceBuffer.numberOfChannels;
        const sampleRate = sourceBuffer.sampleRate;
        const origLength = sourceBuffer.length;

        if (mode === 'varispeed') {
            const pitchRatio = Math.pow(2, semitones / 12);
            const rateFactor = (100 / stretchRatio) * pitchRatio;
            const outLength = Math.max(1, Math.round(origLength / rateFactor));
            const outBuffer = audioCtx.createBuffer(channels, outLength, sampleRate);
            for (let ch = 0; ch < channels; ch++) {
                const inData = sourceBuffer.getChannelData(ch);
                const outData = outBuffer.getChannelData(ch);
                for (let i = 0; i < outLength; i++) {
                    const srcPos = i * rateFactor;
                    const idx = Math.floor(srcPos);
                    const frac = srcPos - idx;
                    if (idx + 1 < inData.length) {
                        outData[i] = inData[idx] * (1 - frac) + inData[idx + 1] * frac;
                    } else if (idx < inData.length) {
                        outData[i] = inData[idx];
                    } else {
                        outData[i] = 0;
                    }
                }
            }
            return outBuffer;
        } else if (mode === 'stretch') {
            const timeRatio = stretchRatio / 100;
            const winSize = 2048;
            const hopOut = Math.round(winSize / 4);
            const hopIn = Math.max(1, Math.round(hopOut / timeRatio));
            const outLength = Math.max(1, Math.round(origLength * timeRatio));
            const outBuffer = audioCtx.createBuffer(channels, outLength, sampleRate);

            const window = new Float32Array(winSize);
            for (let i = 0; i < winSize; i++) {
                window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (winSize - 1)));
            }

            for (let ch = 0; ch < channels; ch++) {
                const inData = sourceBuffer.getChannelData(ch);
                const outData = outBuffer.getChannelData(ch);
                const normArray = new Float32Array(outLength);

                let inPos = 0;
                let outPos = 0;

                while (outPos + winSize < outLength && inPos + winSize < origLength) {
                    for (let k = 0; k < winSize; k++) {
                        const sample = inData[inPos + k] * window[k];
                        outData[outPos + k] += sample;
                        normArray[outPos + k] += window[k];
                    }
                    inPos += hopIn;
                    outPos += hopOut;
                }

                for (let i = 0; i < outLength; i++) {
                    if (normArray[i] > 0.001) {
                        outData[i] /= normArray[i];
                    }
                }
            }
            return outBuffer;
        } else {
            const pitchRatio = Math.pow(2, semitones / 12);
            if (Math.abs(semitones) < 0.01) {
                const outBuffer = audioCtx.createBuffer(channels, origLength, sampleRate);
                for (let ch = 0; ch < channels; ch++) {
                    outBuffer.copyToChannel(sourceBuffer.getChannelData(ch), ch);
                }
                return outBuffer;
            }
            const stretched = await processAudioBufferTimePitch(sourceBuffer, 'stretch', 0, 100 * pitchRatio);
            const outBuffer = audioCtx.createBuffer(channels, origLength, sampleRate);
            const rateFactor = stretched.length / origLength;

            for (let ch = 0; ch < channels; ch++) {
                const inData = stretched.getChannelData(ch);
                const outData = outBuffer.getChannelData(ch);
                for (let i = 0; i < origLength; i++) {
                    const srcPos = i * rateFactor;
                    const idx = Math.floor(srcPos);
                    const frac = srcPos - idx;
                    if (idx + 1 < inData.length) {
                        outData[i] = inData[idx] * (1 - frac) + inData[idx + 1] * frac;
                    } else if (idx < inData.length) {
                        outData[i] = inData[idx];
                    } else {
                        outData[i] = 0;
                    }
                }
            }
            return outBuffer;
        }
    };

    let _audiosuitePreviewSource = null;
    let _audiosuiteMode = 'pitch';
    let _audiosuiteSemitones = 0;
    let _audiosuiteStretchPct = 100;

    const openAudioSuitePitchModal = () => {
        const modal = document.getElementById('daw-audiosuite-pitch-modal');
        if (!modal) return;
        const clip = daw.clips && daw.clips.find(c => c.id === daw.selectedClipId);
        if (!clip || !clip.buffer) {
            showStudioToast('Select an audio clip first to open AudioSuite DSP');
            return;
        }

        const nameEl = document.getElementById('daw-pitch-clip-name');
        const durEl = document.getElementById('daw-pitch-clip-orig-dur');
        if (nameEl) nameEl.textContent = clip.name || 'Selected Clip';
        const activeDur = (clip.trimEnd || clip.duration) - (clip.trimStart || 0);
        if (durEl) durEl.textContent = `${activeDur.toFixed(2)}s`;

        _audiosuiteMode = 'pitch';
        _audiosuiteSemitones = 0;
        _audiosuiteStretchPct = 100;

        const semitoneSlider = document.getElementById('daw-pitch-semitones-slider');
        if (semitoneSlider) semitoneSlider.value = '0';
        const ratioSlider = document.getElementById('daw-stretch-ratio-slider');
        if (ratioSlider) ratioSlider.value = '100';

        updateAudioSuiteModalUI(clip);
        modal.style.display = 'flex';
    };

    const closeAudioSuitePitchModal = () => {
        const modal = document.getElementById('daw-audiosuite-pitch-modal');
        if (modal) modal.style.display = 'none';
        if (_audiosuitePreviewSource) {
            try { _audiosuitePreviewSource.stop(); } catch (e) {}
            _audiosuitePreviewSource = null;
        }
        const stopBtn = document.getElementById('daw-pitch-stop-btn');
        if (stopBtn) stopBtn.style.display = 'none';
    };

    const updateAudioSuiteModalUI = (clip) => {
        if (!clip) clip = daw.clips && daw.clips.find(c => c.id === daw.selectedClipId);
        const origDur = clip ? ((clip.trimEnd || clip.duration) - (clip.trimStart || 0)) : 1;

        document.querySelectorAll('.daw-pitch-mode-btn').forEach(btn => {
            const m = btn.getAttribute('data-mode');
            if (m === _audiosuiteMode) {
                btn.style.background = 'rgba(192,132,252,0.25)';
                btn.style.borderColor = '#c084fc';
                btn.style.color = '#c084fc';
            } else {
                btn.style.background = 'rgba(255,255,255,0.06)';
                btn.style.borderColor = 'rgba(255,255,255,0.15)';
                btn.style.color = 'rgba(255,255,255,0.7)';
            }
        });

        const semitonesLabel = document.getElementById('daw-pitch-semitones-label');
        if (semitonesLabel) {
            semitonesLabel.textContent = `${_audiosuiteSemitones > 0 ? '+' : ''}${_audiosuiteSemitones} Semitones ${_audiosuiteSemitones === 0 ? '(Original)' : ''}`;
        }

        const ratioLabel = document.getElementById('daw-stretch-ratio-label');
        if (ratioLabel) {
            ratioLabel.textContent = `${_audiosuiteStretchPct}% (${(_audiosuiteStretchPct / 100).toFixed(2)}x ${_audiosuiteStretchPct === 100 ? '- Normal' : ''})`;
        }

        let estDur = origDur;
        let estSt = _audiosuiteSemitones;

        if (_audiosuiteMode === 'stretch') {
            estDur = origDur * (_audiosuiteStretchPct / 100);
            estSt = 0;
        } else if (_audiosuiteMode === 'pitch') {
            estDur = origDur;
            estSt = _audiosuiteSemitones;
        } else if (_audiosuiteMode === 'varispeed') {
            const pitchRatio = Math.pow(2, _audiosuiteSemitones / 12);
            const rateFactor = (100 / _audiosuiteStretchPct) * pitchRatio;
            estDur = origDur / rateFactor;
            estSt = _audiosuiteSemitones;
        }

        const resDurEl = document.getElementById('daw-pitch-result-dur');
        if (resDurEl) {
            const diff = estDur - origDur;
            resDurEl.textContent = `${estDur.toFixed(2)}s (${diff >= 0 ? '+' : ''}${diff.toFixed(2)}s)`;
        }
        const resStEl = document.getElementById('daw-pitch-result-st');
        if (resStEl) {
            resStEl.textContent = `${estSt > 0 ? '+' : ''}${estSt} ST`;
        }
    };

    const initAudioSuiteModalEvents = () => {
        document.getElementById('daw-pitch-close-btn')?.addEventListener('click', closeAudioSuitePitchModal);
        document.getElementById('daw-pitch-cancel-btn')?.addEventListener('click', closeAudioSuitePitchModal);

        document.querySelectorAll('.daw-pitch-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                _audiosuiteMode = btn.getAttribute('data-mode') || 'pitch';
                updateAudioSuiteModalUI();
            });
        });

        document.getElementById('daw-pitch-semitones-slider')?.addEventListener('input', (e) => {
            _audiosuiteSemitones = parseInt(e.target.value, 10) || 0;
            updateAudioSuiteModalUI();
        });

        document.querySelectorAll('.daw-pitch-quick-st').forEach(btn => {
            btn.addEventListener('click', () => {
                const st = parseInt(btn.getAttribute('data-st'), 10) || 0;
                _audiosuiteSemitones = st;
                const sl = document.getElementById('daw-pitch-semitones-slider');
                if (sl) sl.value = st;
                updateAudioSuiteModalUI();
            });
        });

        document.getElementById('daw-stretch-ratio-slider')?.addEventListener('input', (e) => {
            _audiosuiteStretchPct = parseInt(e.target.value, 10) || 100;
            updateAudioSuiteModalUI();
        });

        document.querySelectorAll('.daw-stretch-quick-pct').forEach(btn => {
            btn.addEventListener('click', () => {
                const pct = parseInt(btn.getAttribute('data-pct'), 10) || 100;
                _audiosuiteStretchPct = pct;
                const sl = document.getElementById('daw-stretch-ratio-slider');
                if (sl) sl.value = pct;
                updateAudioSuiteModalUI();
            });
        });

        // Audition preview
        document.getElementById('daw-pitch-audition-btn')?.addEventListener('click', async () => {
            const clip = daw.clips && daw.clips.find(c => c.id === daw.selectedClipId);
            if (!clip || !clip.buffer) return;

            if (_audiosuitePreviewSource) {
                try { _audiosuitePreviewSource.stop(); } catch (e) {}
                _audiosuitePreviewSource = null;
            }

            const stopBtn = document.getElementById('daw-pitch-stop-btn');
            if (stopBtn) stopBtn.style.display = 'inline-block';

            showStudioToast('Rendering preview...');
            const sampleRate = clip.buffer.sampleRate;
            const sliceLen = Math.min(clip.buffer.length, Math.round(sampleRate * 3.5));
            const sliceBuf = daw.audioCtx.createBuffer(clip.buffer.numberOfChannels, sliceLen, sampleRate);
            for (let ch = 0; ch < clip.buffer.numberOfChannels; ch++) {
                sliceBuf.copyToChannel(clip.buffer.getChannelData(ch).subarray(0, sliceLen), ch);
            }

            const processedSlice = await processAudioBufferTimePitch(sliceBuf, _audiosuiteMode, _audiosuiteSemitones, _audiosuiteStretchPct);
            const src = daw.audioCtx.createBufferSource();
            src.buffer = processedSlice;
            src.connect(daw.audioCtx.destination);
            src.onended = () => {
                if (stopBtn) stopBtn.style.display = 'none';
                _audiosuitePreviewSource = null;
            };
            src.start();
            _audiosuitePreviewSource = src;
        });

        document.getElementById('daw-pitch-stop-btn')?.addEventListener('click', () => {
            if (_audiosuitePreviewSource) {
                try { _audiosuitePreviewSource.stop(); } catch (e) {}
                _audiosuitePreviewSource = null;
            }
            const stopBtn = document.getElementById('daw-pitch-stop-btn');
            if (stopBtn) stopBtn.style.display = 'none';
        });

        // Process & Render
        document.getElementById('daw-pitch-process-btn')?.addEventListener('click', async () => {
            const clip = daw.clips && daw.clips.find(c => c.id === daw.selectedClipId);
            if (!clip || !clip.buffer) return;

            showStudioToast('Processing AudioSuite DSP...');
            try {
                const processed = await processAudioBufferTimePitch(clip.buffer, _audiosuiteMode, _audiosuiteSemitones, _audiosuiteStretchPct);
                clip.buffer = processed;
                clip.duration = processed.duration;
                clip.trimEnd = (clip.trimStart || 0) + processed.duration;
                if (typeof audioBufferToWav === 'function') {
                    const newBlob = audioBufferToWav(processed);
                    clip.blob = newBlob;
                    clip.blobUrl = URL.createObjectURL(newBlob);
                }
                clip.peaks = extractWaveformPeaks(processed, 400);

                pushDawHistory(`AudioSuite ${_audiosuiteMode.toUpperCase()} [${clip.name}]`);
                closeAudioSuitePitchModal();
                recalculateDawDuration();
                renderDawClips();
                window._syncBottomDeckClipInspector?.();
                showStudioToast(`Rendered [${clip.name}] with ${_audiosuiteMode.toUpperCase()}`);
            } catch (err) {
                console.error('AudioSuite processing error:', err);
                showStudioToast('AudioSuite processing failed');
            }
        });
    };
    initAudioSuiteModalEvents();

    // Crossfade Modal Event Listeners
    document.getElementById('daw-crossfade-close-btn')?.addEventListener('click', () => {
        const modal = document.getElementById('daw-crossfade-modal');
        if (modal) modal.style.display = 'none';
    });
    document.getElementById('daw-crossfade-cancel-btn')?.addEventListener('click', () => {
        const modal = document.getElementById('daw-crossfade-modal');
        if (modal) modal.style.display = 'none';
    });

    document.getElementById('daw-crossfade-dur-slider')?.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        const lbl = document.getElementById('daw-crossfade-dur-label');
        if (lbl) lbl.textContent = `${val.toFixed(2)}s (${Math.round(val * 1000)}ms)`;
        const shape = document.getElementById('daw-crossfade-shape-select')?.value || 'equalpower';
        updateCrossfadePreviewSvg(val, shape, _activeCrossfadeAlign);
    });

    document.querySelectorAll('.daw-xfade-preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const dur = parseFloat(e.currentTarget.getAttribute('data-dur'));
            const slider = document.getElementById('daw-crossfade-dur-slider');
            const lbl = document.getElementById('daw-crossfade-dur-label');
            if (slider) slider.value = dur;
            if (lbl) lbl.textContent = `${dur.toFixed(2)}s (${Math.round(dur * 1000)}ms)`;

            document.querySelectorAll('.daw-xfade-preset-btn').forEach(b => {
                b.style.background = 'rgba(255,255,255,0.06)';
                b.style.borderColor = 'rgba(255,255,255,0.15)';
                b.style.color = 'rgba(255,255,255,0.7)';
            });
            e.currentTarget.style.background = 'rgba(94, 92, 230,0.25)';
            e.currentTarget.style.borderColor = '#5e5ce6';
            e.currentTarget.style.color = '#c084fc';

            const shape = document.getElementById('daw-crossfade-shape-select')?.value || 'equalpower';
            updateCrossfadePreviewSvg(dur, shape, _activeCrossfadeAlign);
        });
    });

    document.getElementById('daw-crossfade-shape-select')?.addEventListener('change', (e) => {
        const dur = parseFloat(document.getElementById('daw-crossfade-dur-slider')?.value || 0.5);
        updateCrossfadePreviewSvg(dur, e.target.value, _activeCrossfadeAlign);
    });

    document.querySelectorAll('.daw-xfade-align-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            _activeCrossfadeAlign = e.currentTarget.getAttribute('data-align') || 'center';
            document.querySelectorAll('.daw-xfade-align-btn').forEach(b => {
                const isAct = b === e.currentTarget;
                b.style.background = isAct ? 'rgba(94, 92, 230,0.25)' : 'rgba(255,255,255,0.06)';
                b.style.borderColor = isAct ? '#5e5ce6' : 'rgba(255,255,255,0.15)';
                b.style.color = isAct ? '#c084fc' : 'rgba(255,255,255,0.7)';
            });
            const dur = parseFloat(document.getElementById('daw-crossfade-dur-slider')?.value || 0.5);
            const shape = document.getElementById('daw-crossfade-shape-select')?.value || 'equalpower';
            updateCrossfadePreviewSvg(dur, shape, _activeCrossfadeAlign);
        });
    });

    document.getElementById('daw-crossfade-apply-btn')?.addEventListener('click', () => {
        if (!daw._crossfadePair || !daw._crossfadePair.clipA || !daw._crossfadePair.clipB) return;
        const dur = parseFloat(document.getElementById('daw-crossfade-dur-slider')?.value || 0.5);
        const shape = document.getElementById('daw-crossfade-shape-select')?.value || 'equalpower';
        applyCrossfadeToClips(daw._crossfadePair.clipA, daw._crossfadePair.clipB, dur, shape, _activeCrossfadeAlign);
        const modal = document.getElementById('daw-crossfade-modal');
        if (modal) modal.style.display = 'none';
    });

    document.getElementById('daw-crossfade-remove-btn')?.addEventListener('click', () => {
        if (!daw._crossfadePair || !daw._crossfadePair.clipA || !daw._crossfadePair.clipB) return;
        removeCrossfadeFromClips(daw._crossfadePair.clipA, daw._crossfadePair.clipB);
        const modal = document.getElementById('daw-crossfade-modal');
        if (modal) modal.style.display = 'none';
    });

    document.getElementById('daw-crossfade-combine-btn')?.addEventListener('click', () => {
        combineSelectedClipsDAW();
    });

    // Toolbar Crossfade Action Button
    document.getElementById('timeline-crossfade-btn')?.addEventListener('click', () => {
        if (!daw.selectedClipIds || daw.selectedClipIds.size !== 2) {
            if (daw.selectedClipId) {
                const clip = daw.clips.find(c => c.id === daw.selectedClipId);
                if (clip) {
                    const dur = Math.max(0.5, (clip.trimEnd || clip.duration || 0) - (clip.trimStart || 0));
                    const end = clip.startOffset + dur;
                    const others = daw.clips.filter(c => c.trackId === clip.trackId && c.id !== clip.id).sort((a,b) => a.startOffset - b.startOffset);
                    const next = others.find(c => c.startOffset >= clip.startOffset - 0.5);
                    const prev = others.filter(c => c.startOffset <= clip.startOffset + 0.5).pop();
                    const pair = next || prev;
                    if (pair) {
                        openCrossfadeModal(clip, pair);
                        return;
                    }
                }
            }
            showStudioToast('Select two adjacent clips on the same track to crossfade, or hover over the seam where two clips meet.');
            return;
        }
        const sel = daw.clips.filter(c => daw.selectedClipIds.has(c.id)).sort((a,b) => a.startOffset - b.startOffset);
        if (sel.length === 2 && sel[0].trackId === sel[1].trackId) {
            openCrossfadeModal(sel[0], sel[1]);
        } else {
            showStudioToast('Selected clips must be on the same audio track to crossfade.');
        }
    });

    // Draggable Crossfade Modal Window Handler
    const initFloatingCrossfadeDraggable = () => {
        const modal = document.getElementById('daw-crossfade-modal');
        const header = document.getElementById('daw-crossfade-modal-header');
        if (!modal || !header || header._dragBound) return;
        header._dragBound = true;

        header.addEventListener('mousedown', (e) => {
            if (e.button !== 0 || e.target.closest('button')) return;
            const startX = e.clientX;
            const startY = e.clientY;
            const rect = modal.getBoundingClientRect();
            const parent = modal.offsetParent || document.body;
            const parentRect = parent.getBoundingClientRect();
            const initLeft = rect.left - parentRect.left;
            const initTop = rect.top - parentRect.top;

            modal.style.right = 'auto';
            modal.style.left = `${initLeft}px`;
            modal.style.top = `${initTop}px`;

            const onDragMove = (moveEv) => {
                const dx = moveEv.clientX - startX;
                const dy = moveEv.clientY - startY;
                const newLeft = Math.max(10, Math.min(parentRect.width - modal.offsetWidth - 10, initLeft + dx));
                const newTop = Math.max(40, Math.min(parentRect.height - modal.offsetHeight - 10, initTop + dy));
                modal.style.left = `${newLeft}px`;
                modal.style.top = `${newTop}px`;
            };

            const onDragUp = () => {
                window.removeEventListener('mousemove', onDragMove);
                window.removeEventListener('mouseup', onDragUp);
            };

            window.addEventListener('mousemove', onDragMove);
            window.addEventListener('mouseup', onDragUp);
        });
    };
    initFloatingCrossfadeDraggable();

    // Track FX Plugins Modal & Web Audio DSP Controller (Studio-Grade Suite)
    let _activeFxLowCut = false;
    let _activeFxDehum = 'off'; // 'off' | '50hz' | '60hz'
    let _activeFxDeesserListen = false;
    let _activeFxBank = 'A';
    let _fxBankA = null;
    let _fxBankB = null;
    let _activeEqDraggingNode = null;

    // Phase 4: Broadcast Channel Strip Presets Library
    const BROADCAST_CHANNEL_STRIPS = {
        bbc_voice: {
            name: 'BBC/NPR Voice Polish',
            eq: { enabled: true, lowCut: true, dehum: 'off', low: -2, mid: 2, high: 1 },
            deesser: { enabled: true, reduction: -7, freq: 6200, listen: false },
            comp: { enabled: true, model: 'modern', threshold: -22, ratio: 3.0, autoMakeup: true, makeup: 0 },
            gate: { enabled: true, threshold: -48, reduction: -20 },
            warmth: { enabled: false, drive: 0 },
            delay: { enabled: false, time: 250, feedback: 30, mix: 20 },
            chorus: { enabled: false, rate: 1.2, mix: 25 },
            widener: { enabled: false, width: 100 },
            reverb: { enabled: false, type: 'studio', wet: 10 },
            limiter: { enabled: true, ceiling: -0.5, gain: 1.5 }
        },
        warm_film: {
            name: 'Warm Film Dialogue',
            eq: { enabled: true, lowCut: true, dehum: 'off', low: 2, mid: -1, high: 2 },
            deesser: { enabled: true, reduction: -5, freq: 7000, listen: false },
            comp: { enabled: true, model: 'la2a', threshold: -20, ratio: 3.5, autoMakeup: true, makeup: 1.0 },
            gate: { enabled: false, threshold: -42, reduction: -24 },
            warmth: { enabled: true, drive: 22 },
            delay: { enabled: false, time: 250, feedback: 30, mix: 20 },
            chorus: { enabled: false, rate: 1.2, mix: 25 },
            widener: { enabled: false, width: 110 },
            reverb: { enabled: true, type: 'booth', wet: 8 },
            limiter: { enabled: true, ceiling: -0.5, gain: 2.0 }
        },
        radio_punch: {
            name: 'Radio Punch & Presence',
            eq: { enabled: true, lowCut: true, dehum: 'off', low: 3, mid: 3, high: 4 },
            deesser: { enabled: true, reduction: -8, freq: 6500, listen: false },
            comp: { enabled: true, model: '1176', threshold: -26, ratio: 8.0, autoMakeup: false, makeup: 4.0 },
            gate: { enabled: true, threshold: -45, reduction: -26 },
            warmth: { enabled: true, drive: 30 },
            delay: { enabled: false, time: 250, feedback: 30, mix: 20 },
            chorus: { enabled: false, rate: 1.2, mix: 25 },
            widener: { enabled: false, width: 115 },
            reverb: { enabled: false, type: 'studio', wet: 15 },
            limiter: { enabled: true, ceiling: -0.3, gain: 4.0 }
        },
        podcast_clean: {
            name: 'Podcast Clean Suite',
            eq: { enabled: true, lowCut: true, dehum: 'off', low: -1, mid: 1, high: 2 },
            deesser: { enabled: true, reduction: -8, freq: 6500, listen: false },
            comp: { enabled: true, model: 'modern', threshold: -22, ratio: 3.5, autoMakeup: true, makeup: 0.5 },
            gate: { enabled: true, threshold: -44, reduction: -24 },
            warmth: { enabled: true, drive: 12 },
            delay: { enabled: false, time: 250, feedback: 30, mix: 20 },
            chorus: { enabled: false, rate: 1.2, mix: 25 },
            widener: { enabled: false, width: 100 },
            reverb: { enabled: false, type: 'studio', wet: 10 },
            limiter: { enabled: true, ceiling: -0.5, gain: 2.0 }
        },
        master_max: {
            name: 'Master Bus Maximizer',
            eq: { enabled: true, lowCut: false, dehum: 'off', low: 1, mid: 0, high: 1.5 },
            deesser: { enabled: false, reduction: -6, freq: 6500, listen: false },
            comp: { enabled: true, model: 'ssl', threshold: -16, ratio: 4.0, autoMakeup: true, makeup: 1.5 },
            gate: { enabled: false, threshold: -42, reduction: -24 },
            warmth: { enabled: true, drive: 15 },
            delay: { enabled: false, time: 250, feedback: 30, mix: 20 },
            chorus: { enabled: false, rate: 1.2, mix: 25 },
            widener: { enabled: true, width: 125 },
            reverb: { enabled: false, type: 'studio', wet: 15 },
            limiter: { enabled: true, ceiling: -0.2, gain: 3.5 }
        }
    };

    // Phase 2: Interactive Parametric EQ Frequency Response Curve & RTA Spectrum Analyzer Engine
    const renderEqCurveCanvas = (analyserNode = null) => {
        const canvas = document.getElementById('daw-fx-eq-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        ctx.fillStyle = '#030508';
        ctx.fillRect(0, 0, w, h);

        const freqToX = (f) => Math.max(0, Math.min(w, (Math.log10(f / 20) / Math.log10(20000 / 20)) * w));
        const xToFreq = (x) => 20 * Math.pow(1000, Math.max(0, Math.min(w, x)) / w);

        // Horizontal dB reference grid lines
        [-12, -6, 0, 6, 12].forEach(db => {
            const y = (h / 2) - (db / 14) * (h / 2 - 8);
            ctx.beginPath();
            if (db === 0) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
                ctx.setLineDash([3, 3]);
            } else {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
                ctx.setLineDash([]);
            }
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.font = '7px monospace';
            ctx.fillText(`${db > 0 ? '+' : ''}${db}`, 3, y - 2);
        });

        // Vertical frequency grid lines
        [100, 1000, 10000].forEach(f => {
            const x = freqToX(f);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.font = '7.5px monospace';
            const label = f === 100 ? '100Hz' : (f === 1000 ? '1kHz' : '10kHz');
            ctx.fillText(label, x + 3, h - 4);
        });

        // Live RTA Spectrum if analyser available
        if (analyserNode) {
            try {
                const fData = new Uint8Array(analyserNode.frequencyBinCount);
                analyserNode.getByteFrequencyData(fData);
                ctx.fillStyle = 'rgba(10, 132, 255, 0.14)';
                ctx.beginPath();
                ctx.moveTo(0, h);
                const step = 4;
                for (let px = 0; px < w; px += step) {
                    const freq = xToFreq(px);
                    const bin = Math.min(fData.length - 1, Math.round((freq / (analyserNode.context.sampleRate / 2)) * fData.length));
                    const val = fData[bin] || 0;
                    const rtaY = h - (val / 255) * (h * 0.85);
                    ctx.lineTo(px, rtaY);
                }
                ctx.lineTo(w, h);
                ctx.closePath();
                ctx.fill();
            } catch (e) {}
        }

        const isEqOn = !!document.getElementById('daw-fx-eq-enable')?.checked;
        const lowGain = parseFloat(document.getElementById('daw-fx-eq-low')?.value || 0);
        const midGain = parseFloat(document.getElementById('daw-fx-eq-mid')?.value || 0);
        const highGain = parseFloat(document.getElementById('daw-fx-eq-high')?.value || 0);

        const calcGainAtFreq = (f) => {
            if (!isEqOn) return 0;
            let gain = 0;
            if (_activeFxLowCut && f < 80) {
                gain += Math.max(-24, 12 * Math.log2(f / 80));
            }
            if (_activeFxDehum === '50hz' && Math.abs(f - 50) < 12) {
                gain -= 18 * (1 - Math.abs(f - 50) / 12);
            } else if (_activeFxDehum === '60hz' && Math.abs(f - 60) < 12) {
                gain -= 18 * (1 - Math.abs(f - 60) / 12);
            }
            gain += lowGain / (1 + Math.pow(f / 120, 1.8));
            gain += midGain * Math.exp(-Math.pow(Math.log2(f / 2500), 2) / (2 * 0.7 * 0.7));
            gain += highGain / (1 + Math.pow(9000 / f, 1.8));
            return gain;
        };

        // Draw EQ Response Curve
        ctx.beginPath();
        const startGain = calcGainAtFreq(20);
        const startY = (h / 2) - (startGain / 14) * (h / 2 - 8);
        ctx.moveTo(0, startY);

        for (let px = 0; px <= w; px += 3) {
            const f = xToFreq(px);
            const db = calcGainAtFreq(f);
            const y = Math.max(3, Math.min(h - 3, (h / 2) - (db / 14) * (h / 2 - 8)));
            ctx.lineTo(px, y);
        }

        ctx.strokeStyle = isEqOn ? '#34d399' : 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        if (isEqOn) {
            const zeroY = h / 2;
            ctx.lineTo(w, zeroY);
            ctx.lineTo(0, zeroY);
            ctx.closePath();
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, 'rgba(52, 211, 153, 0.22)');
            grad.addColorStop(0.5, 'rgba(52, 211, 153, 0.05)');
            grad.addColorStop(1, 'rgba(52, 211, 153, 0.22)');
            ctx.fillStyle = grad;
            ctx.fill();
        }

        // Four Draggable Control Nodes
        const nodes = [
            { id: 'hpf', x: freqToX(80), y: (h / 2) - ((_activeFxLowCut ? -6 : 0) / 14) * (h / 2 - 8), color: _activeFxLowCut ? '#34d399' : '#64748b', label: 'HPF' },
            { id: 'low', x: freqToX(120), y: (h / 2) - (lowGain / 14) * (h / 2 - 8), color: '#0a84ff', label: '120Hz' },
            { id: 'mid', x: freqToX(2500), y: (h / 2) - (midGain / 14) * (h / 2 - 8), color: '#34d399', label: '2.5k' },
            { id: 'high', x: freqToX(9000), y: (h / 2) - (highGain / 14) * (h / 2 - 8), color: '#c084fc', label: '9k' }
        ];
        canvas._eqNodes = nodes;

        nodes.forEach(node => {
            ctx.beginPath();
            ctx.arc(node.x, node.y, 4.5, 0, Math.PI * 2);
            ctx.fillStyle = node.color;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.font = '6.5px monospace';
            ctx.fillText(node.label, node.x - 8, Math.max(10, node.y - 7));
        });
    };

    const initEqCurveCanvasEngine = () => {
        const canvas = document.getElementById('daw-fx-eq-canvas');
        if (!canvas || canvas._engineBound) return;
        canvas._engineBound = true;

        canvas.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            const rect = canvas.getBoundingClientRect();
            const clickX = ((e.clientX - rect.left) / rect.width) * canvas.width;
            const clickY = ((e.clientY - rect.top) / rect.height) * canvas.height;

            const nodes = canvas._eqNodes || [];
            let closestNode = null;
            let minDist = 18;
            nodes.forEach(n => {
                const dist = Math.hypot(n.x - clickX, n.y - clickY);
                if (dist < minDist) {
                    minDist = dist;
                    closestNode = n;
                }
            });

            if (closestNode) {
                if (closestNode.id === 'hpf') {
                    _activeFxLowCut = !_activeFxLowCut;
                    const lowCutBtn = document.getElementById('daw-fx-eq-lowcut');
                    if (lowCutBtn) {
                        lowCutBtn.textContent = _activeFxLowCut ? '80Hz ON' : 'OFF';
                        lowCutBtn.style.background = _activeFxLowCut ? 'rgba(52, 211, 153, 0.25)' : 'rgba(255,255,255,0.06)';
                        lowCutBtn.style.color = _activeFxLowCut ? '#34d399' : '#ffffff';
                    }
                    notifyFxParamChange();
                    renderEqCurveCanvas();
                    return;
                }

                _activeEqDraggingNode = closestNode.id;
                const onMouseMove = (moveEv) => {
                    if (!_activeEqDraggingNode) return;
                    const mRect = canvas.getBoundingClientRect();
                    const curY = ((moveEv.clientY - mRect.top) / mRect.height) * canvas.height;
                    const clampedY = Math.max(6, Math.min(canvas.height - 6, curY));
                    const dbVal = Math.round(((canvas.height / 2 - clampedY) / (canvas.height / 2 - 8)) * 14);
                    const clampedDb = Math.max(-12, Math.min(12, dbVal));

                    if (_activeEqDraggingNode === 'low') {
                        const lowInput = document.getElementById('daw-fx-eq-low');
                        const lowVal = document.getElementById('daw-fx-eq-low-val');
                        if (lowInput) lowInput.value = clampedDb;
                        if (lowVal) lowVal.textContent = `${clampedDb > 0 ? '+' : ''}${clampedDb}dB`;
                    } else if (_activeEqDraggingNode === 'mid') {
                        const midInput = document.getElementById('daw-fx-eq-mid');
                        const midVal = document.getElementById('daw-fx-eq-mid-val');
                        if (midInput) midInput.value = clampedDb;
                        if (midVal) midVal.textContent = `${clampedDb > 0 ? '+' : ''}${clampedDb}dB`;
                    } else if (_activeEqDraggingNode === 'high') {
                        const highInput = document.getElementById('daw-fx-eq-high');
                        const highVal = document.getElementById('daw-fx-eq-high-val');
                        if (highInput) highInput.value = clampedDb;
                        if (highVal) highVal.textContent = `${clampedDb > 0 ? '+' : ''}${clampedDb}dB`;
                    }

                    renderEqCurveCanvas();
                    notifyFxParamChange();
                };

                const onMouseUp = () => {
                    _activeEqDraggingNode = null;
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onMouseUp);
                };

                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onMouseUp);
            }
        });
    };

    // Global latch state for True-Peak Digital Clipping Detector
    let _dawFxHasClipped = false;

    // Interactive Compressor Dynamics Transfer Curve Canvas (FabFilter Pro-C 2 / Logic Style)
    const renderCompCurveCanvas = (inputDb = null) => {
        const canvas = document.getElementById('daw-fx-comp-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#030508';
        ctx.fillRect(0, 0, w, h);

        const isCompOn = !!document.getElementById('daw-fx-comp-enable')?.checked;
        const thresh = parseFloat(document.getElementById('daw-fx-comp-thresh')?.value || -24);
        const ratio = parseFloat(document.getElementById('daw-fx-comp-ratio')?.value || 3.5);
        const model = document.getElementById('daw-fx-comp-model')?.value || 'modern';
        const isAutoMakeup = !!document.getElementById('daw-fx-comp-auto-makeup')?.checked;
        const makeupTrim = parseFloat(document.getElementById('daw-fx-comp-makeup')?.value || 0);

        const autoDb = isAutoMakeup ? Math.max(0, (-thresh) * (1 - 1 / Math.max(1.1, ratio)) * 0.55) : 0;
        const totalMakeup = autoDb + makeupTrim;
        const knee = model === 'la2a' ? 24 : (model === '1176' ? 2 : 8);

        // Map dB (-60 to 0) to Canvas coordinates
        const dbToX = (db) => ((db - (-60)) / 60) * w;
        const dbToY = (db) => h - ((db - (-60)) / 60) * h;

        // Grid lines at -48, -36, -24, -12, 0 dB
        [-48, -36, -24, -12, 0].forEach(db => {
            const x = dbToX(db);
            const y = dbToY(db);

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
            ctx.font = '6.5px monospace';
            ctx.fillText(`${db}`, x + 2, h - 3);
        });

        // 1:1 Unity Line (dashed grey)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(dbToX(-60), dbToY(-60));
        ctx.lineTo(dbToX(0), dbToY(0));
        ctx.stroke();
        ctx.setLineDash([]);

        // Transfer Function with soft quadratic knee
        const calcOutDb = (inDb) => {
            if (!isCompOn) return inDb;
            let outDb = inDb;
            const halfKnee = knee / 2;
            if (inDb < thresh - halfKnee) {
                outDb = inDb;
            } else if (inDb > thresh + halfKnee) {
                outDb = thresh + (inDb - thresh) / ratio;
            } else {
                outDb = inDb + ((1 / ratio - 1) * Math.pow(inDb - thresh + halfKnee, 2)) / (2 * knee);
            }
            return outDb + totalMakeup;
        };

        // Draw Transfer Curve
        ctx.beginPath();
        ctx.moveTo(0, dbToY(calcOutDb(-60)));
        for (let inDb = -60; inDb <= 0; inDb += 1) {
            const outDb = calcOutDb(inDb);
            ctx.lineTo(dbToX(inDb), dbToY(outDb));
        }

        ctx.strokeStyle = isCompOn ? '#22d3ee' : 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Subtle gradient fill under curve
        if (isCompOn) {
            ctx.lineTo(w, h);
            ctx.lineTo(0, h);
            ctx.closePath();
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, 'rgba(34, 211, 238, 0.18)');
            grad.addColorStop(1, 'rgba(34, 211, 238, 0.02)');
            ctx.fillStyle = grad;
            ctx.fill();
        }

        // Draw Threshold Knee Marker Node
        const threshX = dbToX(thresh);
        const threshY = dbToY(calcOutDb(thresh));
        ctx.beginPath();
        ctx.arc(threshX, threshY, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = isCompOn ? '#0a84ff' : '#64748b';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Live Bouncing Audio Ball (Telemetry)
        if (typeof inputDb === 'number' && Number.isFinite(inputDb) && inputDb > -60) {
            const clampedIn = Math.max(-60, Math.min(0, inputDb));
            const liveOut = calcOutDb(clampedIn);
            const ballX = dbToX(clampedIn);
            const ballY = dbToY(liveOut);

            // Attenuation line down to 1:1 unity
            if (isCompOn && clampedIn > thresh) {
                const unityY = dbToY(clampedIn);
                ctx.beginPath();
                ctx.moveTo(ballX, ballY);
                ctx.lineTo(ballX, unityY);
                ctx.strokeStyle = 'rgba(255, 159, 10, 0.6)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            ctx.beginPath();
            ctx.arc(ballX, ballY, 4, 0, Math.PI * 2);
            ctx.fillStyle = clampedIn > thresh ? '#fbbf24' : '#0a84ff';
            ctx.shadowColor = clampedIn > thresh ? '#ff9f0a' : '#0a84ff';
            ctx.shadowBlur = 6;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.2;
            ctx.stroke();
        }
    };

    // Live DSP Rack Telemetry: True Peak Clip Latch, Audio Health Pill, and Meters
    const checkAndRenderFxTelemetry = (analyserNode, compNode) => {
        if (!analyserNode) return;
        const timeData = new Uint8Array(analyserNode.frequencyBinCount);
        analyserNode.getByteTimeDomainData(timeData);
        let maxDev = 0;
        for (let i = 0; i < timeData.length; i++) {
            const dev = Math.abs((timeData[i] - 128) / 128);
            if (dev > maxDev) maxDev = dev;
        }

        // True-Peak Digital Clip Detection (amplitude >= 0.999 ≈ 0dBFS)
        if (maxDev >= 0.99) {
            _dawFxHasClipped = true;
        }

        const clipDot = document.getElementById('daw-fx-clip-dot');
        const clipText = document.getElementById('daw-fx-clip-text');
        const clipBtn = document.getElementById('daw-fx-clip-indicator');
        if (clipBtn && clipDot && clipText) {
            if (_dawFxHasClipped) {
                clipDot.style.background = '#ff453a';
                clipDot.style.boxShadow = '0 0 8px #ff453a';
                clipText.textContent = 'CLIP 0.0dB!';
                clipText.style.color = '#fca5a5';
                clipBtn.style.borderColor = '#ff453a';
                clipBtn.style.background = 'rgba(255, 69, 58, 0.25)';
            }
        }

        // DSP Engine Health Telemetry
        const healthVal = document.getElementById('daw-fx-dsp-health-val');
        if (healthVal && daw.audioCtx) {
            const sr = daw.audioCtx.sampleRate ? `${Math.round(daw.audioCtx.sampleRate / 1000)}k` : '48k';
            const state = daw.audioCtx.state === 'running' ? '0 DROPS' : daw.audioCtx.state.toUpperCase();
            healthVal.textContent = `${sr} · ${state}`;
        }

        // Current Input dB for Compressor Transfer Dynamics
        const inDb = maxDev > 0.001 ? 20 * Math.log10(maxDev) : -100;
        renderCompCurveCanvas(inDb);

        // De-Esser Sibilance Dynamic Reduction Meter
        const deesserGrFill = document.getElementById('daw-fx-deesser-gr-fill');
        const deesserGrVal = document.getElementById('daw-fx-deesser-gr-val');
        if (deesserGrFill && deesserGrVal) {
            const isDeesserOn = !!document.getElementById('daw-fx-deesser-enable')?.checked;
            const deesserRed = parseFloat(document.getElementById('daw-fx-deesser-reduction')?.value || -6);
            if (isDeesserOn && maxDev > 0.04) {
                const activeReduction = Math.abs(deesserRed) * Math.min(1.0, maxDev * 1.5);
                deesserGrFill.style.width = `${Math.min(100, (activeReduction / 18) * 100)}%`;
                deesserGrVal.textContent = `-${activeReduction.toFixed(1)} dB`;
            } else {
                deesserGrFill.style.width = '0%';
                deesserGrVal.textContent = '0.0 dB';
            }
        }

        // Stereo Acoustic Phase Correlation Meter
        const phaseFill = document.getElementById('daw-fx-phase-corr-fill');
        const phaseVal = document.getElementById('daw-fx-phase-corr-val');
        if (phaseFill && phaseVal) {
            const isWidenerOn = !!document.getElementById('daw-fx-widener-enable')?.checked;
            const widthVal = parseFloat(document.getElementById('daw-fx-widener-width')?.value || 130);
            let corr = 0.98;
            if (isWidenerOn) {
                corr = Math.max(-0.25, 1.0 - ((widthVal - 50) / 150) * 0.85);
            }
            const pct = Math.max(0, Math.min(100, ((corr + 1) / 2) * 100));
            phaseFill.style.left = `${Math.min(50, pct)}%`;
            phaseFill.style.width = `${Math.max(2, Math.abs(pct - 50))}%`;
            phaseVal.textContent = `${corr >= 0 ? '+' : ''}${corr.toFixed(2)}`;
            phaseVal.style.color = corr < 0 ? '#ff453a' : (corr < 0.3 ? '#ff9f0a' : '#0a84ff');
        }

        // Module 10: Peak Limiter Gain Reduction Meter (Pro-L 2 Style)
        const limiterGrFill = document.getElementById('daw-fx-limiter-gr-fill');
        const limiterGrVal = document.getElementById('daw-fx-limiter-gr-val');
        if (limiterGrFill && limiterGrVal) {
            const isLimiterOn = !!document.getElementById('daw-fx-limiter-enable')?.checked;
            const ceilingDb = parseFloat(document.getElementById('daw-fx-limiter-ceiling')?.value || -0.5);
            const ceilingLin = Math.pow(10, ceilingDb / 20);
            if (isLimiterOn && maxDev > ceilingLin) {
                const grDb = Math.min(12, 20 * Math.log10(maxDev / ceilingLin));
                limiterGrFill.style.width = `${Math.min(100, (grDb / 12) * 100)}%`;
                limiterGrVal.textContent = `-${grDb.toFixed(1)} dB`;
            } else {
                limiterGrFill.style.width = '0%';
                limiterGrVal.textContent = '0.0 dB';
            }
        }
    };

    // Phase 4: A/B Compare and State Synchronization
    const updateAbButtonUi = () => {
        const btnA = document.getElementById('daw-fx-ab-btn-a');
        const btnB = document.getElementById('daw-fx-ab-btn-b');
        if (btnA && btnB) {
            if (_activeFxBank === 'A') {
                btnA.style.background = 'rgba(10, 132, 255, 0.25)';
                btnA.style.borderColor = '#0a84ff';
                btnA.style.color = '#0a84ff';
                btnB.style.background = 'transparent';
                btnB.style.borderColor = 'transparent';
                btnB.style.color = 'rgba(255,255,255,0.45)';
            } else {
                btnB.style.background = 'rgba(10, 132, 255, 0.25)';
                btnB.style.borderColor = '#0a84ff';
                btnB.style.color = '#0a84ff';
                btnA.style.background = 'transparent';
                btnA.style.borderColor = 'transparent';
                btnA.style.color = 'rgba(255,255,255,0.45)';
            }
        }
    };

    const applyPluginsStateToUi = (p) => {
        if (!p) return;
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
            dehumBtn.style.background = _activeFxDehum !== 'off' ? 'rgba(255, 69, 58, 0.25)' : 'rgba(255,255,255,0.06)';
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
        _activeFxDeesserListen = !!p.deesser?.listen;
        const listenBtn = document.getElementById('daw-fx-deesser-listen-btn');
        if (listenBtn) {
            listenBtn.textContent = _activeFxDeesserListen ? 'LISTEN: ON' : 'LISTEN: OFF';
            listenBtn.style.background = _activeFxDeesserListen ? 'rgba(244, 63, 94, 0.3)' : 'rgba(255,255,255,0.06)';
            listenBtn.style.color = _activeFxDeesserListen ? '#fda4af' : 'rgba(255,255,255,0.8)';
        }

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

        const autoMakeup = document.getElementById('daw-fx-comp-auto-makeup');
        if (autoMakeup) autoMakeup.checked = p.comp?.autoMakeup !== false;
        const makeupTrim = document.getElementById('daw-fx-comp-makeup');
        const makeupTrimVal = document.getElementById('daw-fx-comp-makeup-val');
        const mTrim = typeof p.comp?.makeup === 'number' ? p.comp.makeup : 0;
        if (makeupTrim) makeupTrim.value = mTrim;
        if (makeupTrimVal) makeupTrimVal.textContent = `+${mTrim.toFixed(1)}dB`;

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

        renderEqCurveCanvas();
    };

    const openTrackFxModal = (trackId) => {
        const track = daw.tracks[trackId];
        if (!track) return;
        daw._activeFxTrackId = trackId;
        if (!track.plugins) track.plugins = defaultPluginState();

        const p = track.plugins;
        const titleEl = document.getElementById('daw-fx-track-title');
        if (titleEl) titleEl.textContent = `${track.name} — DSP Plugins Rack (10 Plugins)`;

        _activeFxBank = 'A';
        _fxBankA = JSON.parse(JSON.stringify(track.plugins));
        _fxBankB = JSON.parse(JSON.stringify(track.plugins));
        updateAbButtonUi();

        applyPluginsStateToUi(p);

        const modal = document.getElementById('daw-track-fx-modal');
        if (modal) modal.style.display = 'flex';

        initEqCurveCanvasEngine();
        renderEqCurveCanvas();
        renderCompCurveCanvas();
        renderUserFxPresetsDropdown();
        initFxModuleAccordions();
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

        const grFill = document.getElementById('daw-fx-comp-gr-fill');
        const grVal = document.getElementById('daw-fx-comp-gr-val');
        if (grFill) grFill.style.width = '0%';
        if (grVal) grVal.textContent = '0.0 dB';

        const deessFill = document.getElementById('daw-fx-deesser-gr-fill');
        const deessVal = document.getElementById('daw-fx-deesser-gr-val');
        if (deessFill) deessFill.style.width = '0%';
        if (deessVal) deessVal.textContent = '0.0 dB';

        const limFill = document.getElementById('daw-fx-limiter-gr-fill');
        const limVal = document.getElementById('daw-fx-limiter-gr-val');
        if (limFill) limFill.style.width = '0%';
        if (limVal) limVal.textContent = '0.0 dB';

        renderEqCurveCanvas(null);
        renderCompCurveCanvas(null);

        const btn = document.getElementById('daw-fx-audition-btn');
        const txt = document.getElementById('daw-fx-audition-btn-text');
        if (btn) {
            btn.style.background = 'rgba(10, 132, 255, 0.15)';
            btn.style.borderColor = 'rgba(10, 132, 255, 0.4)';
            btn.style.color = '#0a84ff';
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
            freq: parseFloat(document.getElementById('daw-fx-deesser-freq')?.value || 6500),
            listen: _activeFxDeesserListen
        },
        comp: {
            enabled: !!document.getElementById('daw-fx-comp-enable')?.checked,
            model: document.getElementById('daw-fx-comp-model')?.value || 'modern',
            threshold: parseFloat(document.getElementById('daw-fx-comp-thresh')?.value || -24),
            ratio: parseFloat(document.getElementById('daw-fx-comp-ratio')?.value || 3.5),
            autoMakeup: !!document.getElementById('daw-fx-comp-auto-makeup')?.checked,
            makeup: parseFloat(document.getElementById('daw-fx-comp-makeup')?.value || 0),
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

    // Real-Time Live Audition DSP Chain Modulation / Hot-Swap
    const updateLiveFxAudition = () => {
        if (!daw._auditionSource || !daw._auditionNodes || !daw.audioCtx) return;
        const ctx = daw.audioCtx;
        const plugins = getActiveFxTrackPlugins();
        const currentTopology = getFxTopologyKey(plugins);
        const tempTrack = { id: daw._activeFxTrackId, plugins };

        // Zero-Tear in-place parameter update if topology hasn't changed
        if (daw._auditionNodes.fxChain && daw._auditionNodes.fxChain.topologyKey === currentTopology) {
            smoothApplyFxParams(daw._auditionNodes.fxChain, plugins, ctx);
            return;
        }

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

    // Broadcasts real-time FX parameter changes to BOTH the live audition player and the playing timeline track bus
    const notifyFxParamChange = (isTopologyChange = false) => {
        const currentPlugins = getActiveFxTrackPlugins();
        if (_activeFxBank === 'A') {
            _fxBankA = JSON.parse(JSON.stringify(currentPlugins));
        } else {
            _fxBankB = JSON.parse(JSON.stringify(currentPlugins));
        }

        const currentTopology = getFxTopologyKey(currentPlugins);

        // 1. Audition Chain: in-place modulation or topology swap
        if (daw._auditionSource && daw._auditionNodes && daw.audioCtx) {
            const chain = daw._auditionNodes.fxChain;
            if (chain && !isTopologyChange && chain.topologyKey === currentTopology) {
                smoothApplyFxParams(chain, currentPlugins, daw.audioCtx);
            } else {
                updateLiveFxAudition();
            }
            renderEqCurveCanvas(daw._auditionNodes.auditionAnalyser || null);
        } else {
            renderEqCurveCanvas(null);
        }

        // 2. Timeline Track Bus: in-place modulation or bus hot-swap
        if (daw.isPlaying && daw._activeFxTrackId && daw.trackBuses && daw.trackBuses[daw._activeFxTrackId]) {
            const bus = daw.trackBuses[daw._activeFxTrackId];
            if (bus.fx && !isTopologyChange && bus.fx.topologyKey === currentTopology) {
                smoothApplyFxParams(bus.fx, currentPlugins, daw.audioCtx);
            } else {
                rebuildTrackBusFx(daw._activeFxTrackId, currentPlugins);
            }
        }

        // 3. Render Visual Response Curves
        renderCompCurveCanvas();
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

        // Animate live DSP rack VU meter bar, GR meter, Gate status, and EQ spectrum
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

            // Phase 1: Compressor Gain Reduction Meter Bar
            const compNode = daw._auditionNodes?.fxChain?.compNode;
            const grFill = document.getElementById('daw-fx-comp-gr-fill');
            const grValEl = document.getElementById('daw-fx-comp-gr-val');
            if (grFill && grValEl) {
                let grDb = 0;
                if (compNode && document.getElementById('daw-fx-comp-enable')?.checked) {
                    const rawRed = typeof compNode.reduction === 'number' ? compNode.reduction : (compNode.reduction?.value || 0);
                    grDb = Math.abs(rawRed);
                }
                if (grDb > 0.05) {
                    grFill.style.width = `${Math.min(100, (grDb / 18) * 100)}%`;
                    grValEl.textContent = `-${grDb.toFixed(1)} dB`;
                } else {
                    grFill.style.width = '0%';
                    grValEl.textContent = '0.0 dB';
                }
            }

            // Phase 3: Dynamic Noise Gate Status Pill
            const gatePill = document.getElementById('daw-fx-gate-status-pill');
            if (gatePill) {
                const isGateOn = !!document.getElementById('daw-fx-gate-enable')?.checked;
                const gateThreshVal = parseFloat(document.getElementById('daw-fx-gate-thresh')?.value || -42);
                if (!isGateOn) {
                    gatePill.textContent = 'BYPASS';
                    gatePill.style.color = 'rgba(255,255,255,0.4)';
                    gatePill.style.background = 'rgba(255,255,255,0.06)';
                    gatePill.style.borderColor = 'rgba(255,255,255,0.1)';
                } else {
                    const peakDb = peak > 0.0001 ? 20 * Math.log10(peak) : -100;
                    if (peakDb < gateThreshVal) {
                        gatePill.textContent = 'DUCKED';
                        gatePill.style.color = '#ff9f0a';
                        gatePill.style.background = 'rgba(255, 159, 10,0.18)';
                        gatePill.style.borderColor = 'rgba(255, 159, 10,0.4)';
                    } else {
                        gatePill.textContent = 'OPEN';
                        gatePill.style.color = '#30d158';
                        gatePill.style.background = 'rgba(48, 209, 88,0.18)';
                        gatePill.style.borderColor = 'rgba(48, 209, 88,0.4)';
                    }
                }
            }

            // Phase 2: Live Spectrum Analyzer on EQ Curve Canvas
            renderEqCurveCanvas(auditionAnalyser);

            // Telemetry Diagnostics & Dynamics Visualizers (Clip Latch, Bouncing Ball, Sibilance & Phase meters)
            checkAndRenderFxTelemetry(auditionAnalyser, compNode);

            _auditionMeterFrame = requestAnimationFrame(animateDspMeter);
        };
        _auditionMeterFrame = requestAnimationFrame(animateDspMeter);

        const btn = document.getElementById('daw-fx-audition-btn');
        const txt = document.getElementById('daw-fx-audition-btn-text');
        if (btn) {
            btn.style.background = 'rgba(255, 69, 58, 0.25)';
            btn.style.borderColor = 'rgba(255, 69, 58, 0.5)';
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

    // True Peak Clip Detector Reset Listener
    document.getElementById('daw-fx-clip-indicator')?.addEventListener('click', () => {
        _dawFxHasClipped = false;
        const clipDot = document.getElementById('daw-fx-clip-dot');
        const clipText = document.getElementById('daw-fx-clip-text');
        const clipBtn = document.getElementById('daw-fx-clip-indicator');
        if (clipDot) {
            clipDot.style.background = '#475569';
            clipDot.style.boxShadow = 'none';
        }
        if (clipText) {
            clipText.textContent = 'CLIP 0dB';
            clipText.style.color = 'rgba(255,255,255,0.45)';
        }
        if (clipBtn) {
            clipBtn.style.borderColor = 'rgba(255,255,255,0.15)';
            clipBtn.style.background = 'rgba(0,0,0,0.6)';
        }
        showStudioToast('True-Peak Clip Detector Reset');
    });

    // Attach live parameter sync to all plugin enable checkboxes and reverb type dropdown
    ['eq', 'deesser', 'comp', 'gate', 'warmth', 'delay', 'chorus', 'widener', 'reverb', 'limiter'].forEach(fx => {
        document.getElementById(`daw-fx-${fx}-enable`)?.addEventListener('change', () => {
            if (fx === 'eq') renderEqCurveCanvas();
            if (fx === 'comp') renderCompCurveCanvas();
            notifyFxParamChange(true);
        });
    });
    document.getElementById('daw-fx-reverb-type')?.addEventListener('change', () => {
        notifyFxParamChange(true);
    });

    // Phase 4: A/B Compare and Channel Strip Listeners
    document.getElementById('daw-fx-ab-btn-a')?.addEventListener('click', () => {
        if (_activeFxBank === 'A') return;
        _fxBankB = getActiveFxTrackPlugins();
        _activeFxBank = 'A';
        applyPluginsStateToUi(_fxBankA);
        updateAbButtonUi();
        notifyFxParamChange(true);
    });

    document.getElementById('daw-fx-ab-btn-b')?.addEventListener('click', () => {
        if (_activeFxBank === 'B') return;
        _fxBankA = getActiveFxTrackPlugins();
        _activeFxBank = 'B';
        applyPluginsStateToUi(_fxBankB);
        updateAbButtonUi();
        notifyFxParamChange(true);
    });

    document.getElementById('daw-fx-ab-copy-btn')?.addEventListener('click', () => {
        const cur = getActiveFxTrackPlugins();
        if (_activeFxBank === 'A') {
            _fxBankB = JSON.parse(JSON.stringify(cur));
            showStudioToast('Copied Bank A settings to Bank B');
        } else {
            _fxBankA = JSON.parse(JSON.stringify(cur));
            showStudioToast('Copied Bank B settings to Bank A');
        }
    });

    // User Custom FX Presets Storage & Dropdown Management
    const USER_FX_PRESETS_KEY = 'localfilm_daw_custom_fx_presets';
    const loadUserFxPresets = () => {
        try {
            const raw = localStorage.getItem(USER_FX_PRESETS_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            console.error('Error loading custom FX presets:', e);
            return {};
        }
    };

    const saveUserFxPresets = (presets) => {
        try {
            localStorage.setItem(USER_FX_PRESETS_KEY, JSON.stringify(presets));
        } catch (e) {
            console.error('Error saving custom FX presets:', e);
        }
    };

    const renderUserFxPresetsDropdown = () => {
        const select = document.getElementById('daw-fx-channel-strip-select');
        if (!select) return;

        // Find or create user optgroup
        let optgroup = document.getElementById('daw-fx-user-presets-optgroup');
        if (!optgroup) {
            optgroup = document.createElement('optgroup');
            optgroup.id = 'daw-fx-user-presets-optgroup';
            optgroup.label = '── USER PRESETS ──';
            select.appendChild(optgroup);
        }
        optgroup.innerHTML = '';

        const presets = loadUserFxPresets();
        const keys = Object.keys(presets);
        if (keys.length === 0) {
            const emptyOpt = document.createElement('option');
            emptyOpt.value = '';
            emptyOpt.disabled = true;
            emptyOpt.textContent = '(No custom presets)';
            optgroup.appendChild(emptyOpt);
        } else {
            keys.forEach(k => {
                const opt = document.createElement('option');
                opt.value = `user:${k}`;
                opt.textContent = presets[k].name || k;
                optgroup.appendChild(opt);
            });
        }
    };

    let _selectedUserPresetKey = null;

    document.getElementById('daw-fx-channel-strip-select')?.addEventListener('change', (e) => {
        const key = e.target.value;
        const delBtn = document.getElementById('daw-fx-delete-preset-btn');
        if (!key) {
            if (delBtn) delBtn.style.display = 'none';
            _selectedUserPresetKey = null;
            return;
        }

        if (key.startsWith('user:')) {
            const presetId = key.replace('user:', '');
            const presets = loadUserFxPresets();
            const preset = presets[presetId];
            if (preset) {
                applyPluginsStateToUi(preset);
                notifyFxParamChange(true);
                showStudioToast(`Loaded Custom Preset: ${preset.name || presetId}`);
                _selectedUserPresetKey = presetId;
                if (delBtn) delBtn.style.display = 'inline-block';
            }
        } else if (BROADCAST_CHANNEL_STRIPS[key]) {
            _selectedUserPresetKey = null;
            if (delBtn) delBtn.style.display = 'none';
            const preset = BROADCAST_CHANNEL_STRIPS[key];
            applyPluginsStateToUi(preset);
            notifyFxParamChange(true);
            showStudioToast(`Loaded Channel Strip: ${preset.name}`);
        }
    });

    // Save Custom Preset Button
    document.getElementById('daw-fx-save-preset-btn')?.addEventListener('click', () => {
        const name = prompt('Enter a name for this custom Channel Strip preset:');
        if (!name || !name.trim()) return;
        const cleanName = name.trim();
        const id = 'preset_' + Date.now();
        const activePlugins = getActiveFxTrackPlugins();
        const presets = loadUserFxPresets();
        presets[id] = {
            id,
            name: cleanName,
            ...activePlugins
        };
        saveUserFxPresets(presets);
        renderUserFxPresetsDropdown();
        const select = document.getElementById('daw-fx-channel-strip-select');
        if (select) select.value = `user:${id}`;
        _selectedUserPresetKey = id;
        const delBtn = document.getElementById('daw-fx-delete-preset-btn');
        if (delBtn) delBtn.style.display = 'inline-block';
        showStudioToast(`Saved Preset: ${cleanName}`);
    });

    // Delete Custom Preset Button
    document.getElementById('daw-fx-delete-preset-btn')?.addEventListener('click', () => {
        if (!_selectedUserPresetKey) return;
        const presets = loadUserFxPresets();
        const preset = presets[_selectedUserPresetKey];
        const pName = preset ? preset.name : _selectedUserPresetKey;
        if (confirm(`Are you sure you want to delete the preset "${pName}"?`)) {
            delete presets[_selectedUserPresetKey];
            saveUserFxPresets(presets);
            _selectedUserPresetKey = null;
            const delBtn = document.getElementById('daw-fx-delete-preset-btn');
            if (delBtn) delBtn.style.display = 'none';
            renderUserFxPresetsDropdown();
            const select = document.getElementById('daw-fx-channel-strip-select');
            if (select) select.value = '';
            showStudioToast(`Deleted Preset: ${pName}`);
        }
    });

    // Export Custom Presets as .fxchain JSON
    document.getElementById('daw-fx-export-presets-btn')?.addEventListener('click', () => {
        const presets = loadUserFxPresets();
        const active = getActiveFxTrackPlugins();
        const exportData = {
            format: 'LocalFilm-FXChain',
            version: '1.8.35',
            timestamp: new Date().toISOString(),
            activeRack: active,
            customPresets: presets
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `LocalFilm-DSP-Chain-${new Date().toISOString().slice(0, 10)}.fxchain`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showStudioToast('Exported DSP Presets to .fxchain file');
    });

    // Import Custom Presets from .fxchain JSON
    document.getElementById('daw-fx-import-presets-btn')?.addEventListener('click', () => {
        const fileInput = document.getElementById('daw-fx-import-file-input');
        if (fileInput) fileInput.click();
    });

    document.getElementById('daw-fx-import-file-input')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.activeRack) {
                    applyPluginsStateToUi(data.activeRack);
                    notifyFxParamChange(true);
                }
                if (data.customPresets && typeof data.customPresets === 'object') {
                    const existing = loadUserFxPresets();
                    Object.assign(existing, data.customPresets);
                    saveUserFxPresets(existing);
                    renderUserFxPresetsDropdown();
                }
                showStudioToast('Successfully imported DSP preset chain');
            } catch (err) {
                console.error('Import error:', err);
                alert('Invalid preset file format. Please select a valid .fxchain JSON file.');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });

    // Module Accordion Toggle Engine
    const initFxModuleAccordions = () => {
        document.querySelectorAll('.daw-fx-module-header').forEach(header => {
            if (header._accordionBound) return;
            header._accordionBound = true;
            header.addEventListener('click', () => {
                const module = header.closest('.daw-fx-module');
                if (module) {
                    module.classList.toggle('collapsed');
                    updateAccordionMasterButtonText();
                }
            });
        });
    };

    const updateAccordionMasterButtonText = () => {
        const toggleBtn = document.getElementById('daw-fx-accordion-toggle-btn');
        if (!toggleBtn) return;
        const modules = document.querySelectorAll('.daw-fx-module');
        const anyCollapsed = Array.from(modules).some(m => m.classList.contains('collapsed'));
        toggleBtn.textContent = anyCollapsed ? '▾ EXPAND ALL' : '▸ COLLAPSE ALL';
    };

    document.getElementById('daw-fx-accordion-toggle-btn')?.addEventListener('click', () => {
        const modules = document.querySelectorAll('.daw-fx-module');
        const anyCollapsed = Array.from(modules).some(m => m.classList.contains('collapsed'));
        modules.forEach(m => {
            if (anyCollapsed) {
                m.classList.remove('collapsed');
            } else {
                m.classList.add('collapsed');
            }
        });
        updateAccordionMasterButtonText();
    });

    // Live Readout & Zero-Tear AudioParam Modulation Listeners for FX Rack Sliders
    document.getElementById('daw-fx-eq-low')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-eq-low-val');
        if (valEl) valEl.textContent = `${e.target.value > 0 ? '+' : ''}${e.target.value}dB`;
        renderEqCurveCanvas();
        notifyFxParamChange(false);
    });
    document.getElementById('daw-fx-eq-mid')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-eq-mid-val');
        if (valEl) valEl.textContent = `${e.target.value > 0 ? '+' : ''}${e.target.value}dB`;
        renderEqCurveCanvas();
        notifyFxParamChange(false);
    });
    document.getElementById('daw-fx-eq-high')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-eq-high-val');
        if (valEl) valEl.textContent = `${e.target.value > 0 ? '+' : ''}${e.target.value}dB`;
        renderEqCurveCanvas();
        notifyFxParamChange(false);
    });

    // Phase 3: De-Esser Listen Sibilance Button
    document.getElementById('daw-fx-deesser-listen-btn')?.addEventListener('click', (e) => {
        _activeFxDeesserListen = !_activeFxDeesserListen;
        e.currentTarget.textContent = _activeFxDeesserListen ? 'LISTEN: ON' : 'LISTEN: OFF';
        e.currentTarget.style.background = _activeFxDeesserListen ? 'rgba(244, 63, 94, 0.3)' : 'rgba(255,255,255,0.06)';
        e.currentTarget.style.color = _activeFxDeesserListen ? '#fda4af' : 'rgba(255,255,255,0.8)';
        notifyFxParamChange(true);
    });

    document.getElementById('daw-fx-deesser-reduction')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-deesser-reduction-val');
        if (valEl) valEl.textContent = `${e.target.value}dB`;
        notifyFxParamChange(false);
    });
    document.getElementById('daw-fx-deesser-freq')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-deesser-freq-val');
        if (valEl) valEl.textContent = `${e.target.value}Hz`;
        notifyFxParamChange(false);
    });

    // Phase 1: Compressor Controls
    document.getElementById('daw-fx-comp-thresh')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-comp-thresh-val');
        if (valEl) valEl.textContent = `${e.target.value}dB`;
        renderCompCurveCanvas();
        notifyFxParamChange(false);
    });
    document.getElementById('daw-fx-comp-ratio')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-comp-ratio-val');
        if (valEl) valEl.textContent = `${e.target.value}:1`;
        renderCompCurveCanvas();
        notifyFxParamChange(false);
    });
    document.getElementById('daw-fx-comp-makeup')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-comp-makeup-val');
        if (valEl) valEl.textContent = `+${parseFloat(e.target.value).toFixed(1)}dB`;
        renderCompCurveCanvas();
        notifyFxParamChange(false);
    });
    document.getElementById('daw-fx-comp-auto-makeup')?.addEventListener('change', () => {
        renderCompCurveCanvas();
        notifyFxParamChange(false);
    });
    document.getElementById('daw-fx-comp-model')?.addEventListener('change', () => {
        renderCompCurveCanvas();
        notifyFxParamChange(true);
    });

    // Phase 3: Gate Controls
    document.getElementById('daw-fx-gate-thresh')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-gate-thresh-val');
        if (valEl) valEl.textContent = `${e.target.value}dB`;
        notifyFxParamChange(false);
    });
    document.getElementById('daw-fx-gate-reduction')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-gate-reduction-val');
        if (valEl) valEl.textContent = `${e.target.value}dB`;
        notifyFxParamChange(false);
    });

    document.getElementById('daw-fx-warmth')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-warmth-val');
        if (valEl) valEl.textContent = `${e.target.value}%`;
        notifyFxParamChange(false);
    });
    document.getElementById('daw-fx-delay-time')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-delay-time-val');
        if (valEl) valEl.textContent = `${e.target.value}ms`;
        notifyFxParamChange(false);
    });
    document.getElementById('daw-fx-delay-feedback')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-delay-feedback-val');
        if (valEl) valEl.textContent = `${e.target.value}%`;
        notifyFxParamChange(false);
    });
    document.getElementById('daw-fx-delay-mix')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-delay-mix-val');
        if (valEl) valEl.textContent = `${e.target.value}%`;
        notifyFxParamChange(false);
    });
    document.getElementById('daw-fx-chorus-rate')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-chorus-rate-val');
        if (valEl) valEl.textContent = `${e.target.value}Hz`;
        notifyFxParamChange(false);
    });
    document.getElementById('daw-fx-chorus-mix')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-chorus-mix-val');
        if (valEl) valEl.textContent = `${e.target.value}%`;
        notifyFxParamChange(false);
    });
    document.getElementById('daw-fx-widener-width')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-widener-width-val');
        if (valEl) valEl.textContent = `${e.target.value}%`;
        notifyFxParamChange(false);
    });
    document.getElementById('daw-fx-reverb-wet')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-reverb-wet-val');
        if (valEl) valEl.textContent = `${e.target.value}%`;
        notifyFxParamChange(false);
    });
    document.getElementById('daw-fx-limiter-ceiling')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-limiter-ceiling-val');
        if (valEl) valEl.textContent = `${e.target.value}dB`;
        notifyFxParamChange(false);
    });
    document.getElementById('daw-fx-limiter-gain')?.addEventListener('input', (e) => {
        const valEl = document.getElementById('daw-fx-limiter-gain-val');
        if (valEl) valEl.textContent = `+${e.target.value}dB`;
        notifyFxParamChange(false);
    });

    document.getElementById('daw-fx-eq-lowcut')?.addEventListener('click', (e) => {
        _activeFxLowCut = !_activeFxLowCut;
        e.currentTarget.textContent = _activeFxLowCut ? '80Hz ON' : 'OFF';
        e.currentTarget.style.background = _activeFxLowCut ? 'rgba(52, 211, 153, 0.25)' : 'rgba(255,255,255,0.06)';
        e.currentTarget.style.color = _activeFxLowCut ? '#34d399' : '#ffffff';
        renderEqCurveCanvas();
        notifyFxParamChange(true);
    });

    document.getElementById('daw-fx-dehum-btn')?.addEventListener('click', (e) => {
        if (_activeFxDehum === 'off') {
            _activeFxDehum = '50hz';
            e.currentTarget.textContent = 'DE-HUM: 50Hz';
            e.currentTarget.style.background = 'rgba(255, 69, 58, 0.25)';
            e.currentTarget.style.color = '#f87171';
        } else if (_activeFxDehum === '50hz') {
            _activeFxDehum = '60hz';
            e.currentTarget.textContent = 'DE-HUM: 60Hz';
            e.currentTarget.style.background = 'rgba(255, 69, 58, 0.25)';
            e.currentTarget.style.color = '#f87171';
        } else {
            _activeFxDehum = 'off';
            e.currentTarget.textContent = 'DE-HUM: OFF';
            e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
        }
        renderEqCurveCanvas();
        notifyFxParamChange(true);
    });

    // FX Quick Presets
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
                    dehumBtn.style.background = 'rgba(255, 69, 58, 0.25)';
                    dehumBtn.style.color = '#f87171';
                }
            } else if (preset === 'dehum60') {
                document.getElementById('daw-fx-eq-enable').checked = true;
                _activeFxDehum = '60hz';
                const dehumBtn = document.getElementById('daw-fx-dehum-btn');
                if (dehumBtn) {
                    dehumBtn.textContent = 'DE-HUM: 60Hz';
                    dehumBtn.style.background = 'rgba(255, 69, 58, 0.25)';
                    dehumBtn.style.color = '#f87171';
                }
            } else if (preset === 'reset') {
                ['eq', 'deesser', 'comp', 'gate', 'warmth', 'delay', 'chorus', 'widener', 'reverb', 'limiter'].forEach(fx => {
                    const chk = document.getElementById(`daw-fx-${fx}-enable`);
                    if (chk) chk.checked = false;
                });
                _activeFxLowCut = false;
                _activeFxDehum = 'off';
                _activeFxDeesserListen = false;
                const listenBtn = document.getElementById('daw-fx-deesser-listen-btn');
                if (listenBtn) {
                    listenBtn.textContent = 'LISTEN: OFF';
                    listenBtn.style.background = 'rgba(255,255,255,0.06)';
                    listenBtn.style.color = 'rgba(255,255,255,0.8)';
                }
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

            renderEqCurveCanvas();
            // Sync live audition if active, and broadcast to playing timeline track
            if (daw._auditionSource) {
                startFxAudition();
            }
            notifyFxParamChange();
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
            track.plugins = getActiveFxTrackPlugins();
            if (daw.isPlaying && trackId) {
                rebuildTrackBusFx(trackId, track.plugins);
            }
            renderDawTracks();
        }
        document.getElementById('daw-track-fx-modal').style.display = 'none';
    });

    // Wire Add Track Buttons (Left Sidebar)
    document.getElementById('daw-add-audio-track-btn')?.addEventListener('click', () => {
        addNewEmptyTrack('audio');
    });

    document.getElementById('daw-add-music-track-btn')?.addEventListener('click', () => {
        addNewEmptyTrack('music');
    });

    // DAW Real-Time Engine Transport Variables
    let dawMediaRecorder = null;
    let dawRecordingStream = null;
    let dawRecordingChunks = [];
    let dawRecordingStartTime = 0;
    let dawRecordingTargetTrackId = 'host';
    let dawRecordingClipEl = null;

    let startDawEngineTicker = () => {};
    let stopDawEngineTicker = () => {};

    // Stop DAW Playback
    const stopDawPlayback = (resetToStart = false) => {
        daw.isPlaying = false;
        daw.activeSources.forEach(s => {
            try { s.stop(); } catch (e) {}
        });
        daw.activeSources = [];
        teardownTrackBuses();
        if (resetToStart) {
            daw.playhead = 0;
            updateDawPlayhead();
        }
        if (!daw.isRecording) {
            stopDawEngineTicker();
            setStudioStatus('Ready', 'ready', false);
        }
        const playBtn = document.getElementById('timeline-play-btn');
        if (playBtn) {
            playBtn.style.background = 'linear-gradient(135deg, rgba(48, 209, 88, 0.22) 0%, rgba(5, 150, 105, 0.16) 100%)';
            playBtn.style.border = '1px solid rgba(52, 211, 153, 0.55)';
            playBtn.style.color = '#34d399';
            playBtn.style.boxShadow = '0 0 10px rgba(48, 209, 88, 0.2)';
        }
        const playBtnText = document.getElementById('timeline-play-btn-text');
        if (playBtnText) playBtnText.textContent = 'PLAY';
        const playBtnIcon = document.getElementById('timeline-play-btn-icon');
        if (playBtnIcon) playBtnIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
        const vuBar = document.getElementById('daw-master-vu-bar');
        const vuDb = document.getElementById('daw-master-vu-db');
        if (vuBar) vuBar.style.width = '0%';
        if (vuDb) vuDb.textContent = '-∞ dB';
        const vuBarL = document.getElementById('daw-vu-bar-l');
        const vuBarR = document.getElementById('daw-vu-bar-r');
        const vuDbL = document.getElementById('daw-vu-db-l');
        const vuDbR = document.getElementById('daw-vu-db-r');
        if (vuBarL) vuBarL.style.height = '0%';
        if (vuBarR) vuBarR.style.height = '0%';
        if (vuDbL) vuDbL.textContent = '-∞';
        if (vuDbR) vuDbR.textContent = '-∞';

        // Clear all track header mini-VU meters and bottom deck mixer VU bars
        document.querySelectorAll('.track-mini-vu-fill').forEach(fill => {
            fill.style.height = '0%';
        });
        document.querySelectorAll('[id^="daw-mixer-vu-"]').forEach(fill => {
            fill.style.height = '0%';
        });
        const dMasterL = document.getElementById('daw-deck-mixer-master-vu-l');
        const dMasterR = document.getElementById('daw-deck-mixer-master-vu-r');
        if (dMasterL) dMasterL.style.height = '0%';
        if (dMasterR) dMasterR.style.height = '0%';

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

    
    // Synthesize rich, professional demo audio stems (Dialogue, Music Score & Atmosphere)
    // Ensures the timeline has immediate real audio to play and animate the VU meter upon first launch
    const synthesizeDemoProjectAudio = async () => {
        try {
            if (!daw.audioCtx) {
                daw.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = daw.audioCtx;
            const sr = ctx.sampleRate || 44100;
            const dur = 32; // 32-second high quality cinematic session demo
            const totalSamples = Math.floor(sr * dur);

            // 1. Dialogue / Presenter Stem (Mono voice with realistic cadence & formants)
            const hostBuf = ctx.createBuffer(1, totalSamples, sr);
            const hostData = hostBuf.getChannelData(0);
            const f0 = 135; // fundamental pitch (Hz)
            for (let i = 0; i < totalSamples; i++) {
                const t = i / sr;
                const phraseCycle = t % 4.2;
                const isSpeaking = phraseCycle < 3.2 && t > 0.8 && t < 30.5;
                if (isSpeaking) {
                    const pitchVibrato = f0 + Math.sin(t * 5.2) * 4;
                    const env = Math.min(1.0, phraseCycle * 8) * Math.min(1.0, (3.2 - phraseCycle) * 6);
                    const s1 = Math.sin(2 * Math.PI * pitchVibrato * t);
                    const s2 = 0.5 * Math.sin(2 * Math.PI * (pitchVibrato * 2) * t);
                    const s3 = 0.25 * Math.sin(2 * Math.PI * (pitchVibrato * 3) * t);
                    const s4 = 0.15 * Math.sin(2 * Math.PI * (pitchVibrato * 4) * t);
                    const noise = (Math.random() * 2 - 1) * 0.04;
                    hostData[i] = (s1 + s2 + s3 + s4 + noise) * 0.26 * env;
                } else {
                    hostData[i] = 0;
                }
            }

            // 2. Cinematic Music & Score Bed (Stereo Warm Pad Progression: Am - F - C - G)
            const musicBuf = ctx.createBuffer(2, totalSamples, sr);
            const musL = musicBuf.getChannelData(0);
            const musR = musicBuf.getChannelData(1);
            const chords = [
                [220.0, 261.63, 329.63, 440.0], // Am
                [174.61, 220.0, 261.63, 349.23], // F
                [130.81, 164.81, 196.0, 261.63], // C
                [196.0, 246.94, 293.66, 392.0]  // G
            ];
            for (let i = 0; i < totalSamples; i++) {
                const t = i / sr;
                const chordIdx = Math.floor((t % 16) / 4);
                const currentChord = chords[chordIdx];
                let sigL = 0;
                let sigR = 0;
                for (let c = 0; c < currentChord.length; c++) {
                    const freq = currentChord[c];
                    const detuneL = Math.sin(2 * Math.PI * (freq * 0.998) * t);
                    const detuneR = Math.sin(2 * Math.PI * (freq * 1.002) * t);
                    sigL += detuneL * 0.045;
                    sigR += detuneR * 0.045;
                }
                const phraseCycle = t % 4.2;
                const duck = (phraseCycle < 3.2 && t > 0.8 && t < 30.5) ? 0.65 : 1.0;
                const musicEnv = Math.min(1.0, t / 1.5) * Math.min(1.0, (dur - t) / 2.0);
                musL[i] = sigL * duck * musicEnv;
                musR[i] = sigR * duck * musicEnv;
            }

            // 3. Ambient Room Atmosphere (Stereo filtered warm room rumble)
            const ambBuf = ctx.createBuffer(2, totalSamples, sr);
            const ambL = ambBuf.getChannelData(0);
            const ambR = ambBuf.getChannelData(1);
            let lastL = 0, lastR = 0;
            for (let i = 0; i < totalSamples; i++) {
                const whiteL = Math.random() * 2 - 1;
                const whiteR = Math.random() * 2 - 1;
                lastL = lastL * 0.92 + whiteL * 0.08;
                lastR = lastR * 0.92 + whiteR * 0.08;
                ambL[i] = lastL * 0.035;
                ambR[i] = lastR * 0.035;
            }

            // Populate clips only if timeline is empty
            if (daw.clips.length === 0) {
                const hostPeaks = extractWaveformPeaks(hostBuf, 400);
                const musicPeaks = extractWaveformPeaks(musicBuf, 400);
                const ambPeaks = extractWaveformPeaks(ambBuf, 400);

                daw.clips.push({
                    id: 'demo-clip-host',
                    trackId: 'host',
                    name: 'Presenter Dialogue Take (Demo)',
                    tag: 'Voice',
                    startOffset: 0.5,
                    trimStart: 0,
                    trimEnd: dur - 1,
                    duration: dur - 1,
                    buffer: hostBuf,
                    peaks: hostPeaks,
                    color: '#34d399',
                    fadeIn: 0.2,
                    fadeOut: 0.5,
                    gain: 1.0
                });

                daw.clips.push({
                    id: 'demo-clip-top',
                    trackId: 'top',
                    name: 'Cinematic Score Bed (Stereo Demo)',
                    tag: 'Music',
                    startOffset: 0,
                    trimStart: 0,
                    trimEnd: dur,
                    duration: dur,
                    buffer: musicBuf,
                    peaks: musicPeaks,
                    color: '#fbbf24',
                    fadeIn: 0.5,
                    fadeOut: 1.2,
                    gain: 0.85
                });

                daw.clips.push({
                    id: 'demo-clip-ambient',
                    trackId: 'ambient',
                    name: 'Acoustic Room Atmos (Stereo)',
                    tag: 'Atmos',
                    startOffset: 0,
                    trimStart: 0,
                    trimEnd: dur,
                    duration: dur,
                    buffer: ambBuf,
                    peaks: ambPeaks,
                    color: '#c084fc',
                    fadeIn: 1.0,
                    fadeOut: 1.5,
                    gain: 0.4
                });

                recalculateDawDuration();
                renderDawTracks();
                renderDawRuler();
                renderDawClips();
                updateDawPlayhead();
                updateDawFooter();
            }
        } catch (synthErr) {
            console.warn('[DAW Demo Synth] Error generating demo audio:', synthErr);
        }
    };

    // High-Precision Unified Transport Ticker (Drives Playback & Live Recording Indivisibly)
    const tickDawEngine = () => {
        if (!daw.isPlaying && !daw.isRecording) {
            daw.animId = null;
            return;
        }

        try {
            const now = (daw.audioCtx && daw.audioCtx.state === 'running') ? daw.audioCtx.currentTime : (performance.now() / 1000);
            if (daw.startEngineTime === null || daw.startEngineTime === undefined) {
                daw.startEngineTime = now;
                daw.startPlayhead = Number.isFinite(daw.playhead) ? daw.playhead : 0;
            }
            const elapsed = Math.max(0, now - daw.startEngineTime);
            daw.playhead = daw.startPlayhead + elapsed;

            // Single-pass live microphone sampling for recording (shared across waveform, toolbar meter, master VU, and track mini VU)
            let liveMicPeak = 0;
            let liveMicData = null;
            if (daw.isRecording && daw._liveRecAnalyser) {
                liveMicData = daw._liveRecTimeData || new Uint8Array(daw._liveRecAnalyser.fftSize);
                daw._liveRecAnalyser.getByteTimeDomainData(liveMicData);
                let minVal = 128, maxVal = 128;
                for (let i = 0; i < liveMicData.length; i++) {
                    const val = liveMicData[i];
                    if (val < minVal) minVal = val;
                    if (val > maxVal) maxVal = val;
                }
                liveMicPeak = Math.max((maxVal - 128) / 128, (128 - minVal) / 128);

                const elapsedSec = Math.max(0, daw.playhead - dawRecordingStartTime);
                const PEAK_BUCKET_SEC = 0.02; // 20ms precision (50 slices/sec)
                const curBucket = Math.floor(elapsedSec / PEAK_BUCKET_SEC);
                if (daw._liveRecPeaks) {
                    if (daw._lastRecBucket === undefined || daw._lastRecBucket < 0) daw._lastRecBucket = 0;
                    for (let k = daw._lastRecBucket; k <= curBucket; k++) {
                        daw._liveRecPeaks[k] = Math.max(daw._liveRecPeaks[k] || 0, liveMicPeak);
                    }
                    daw._lastRecBucket = curBucket;
                }

                // Directly update toolbar live mic level bar from the single sampled peak
                const recMicBar = document.getElementById('daw-rec-mic-level-bar');
                if (recMicBar) {
                    recMicBar.style.width = `${Math.min(100, Math.round(liveMicPeak * 190))}%`;
                }
            }

            // Expand live recording clip width with playhead in real time & draw stationary live waveform
            if (daw.isRecording && dawRecordingClipEl) {
                const elapsedSec = Math.max(0, daw.playhead - dawRecordingStartTime);
                const recWidth = Math.max(20, elapsedSec * daw.zoom);
                dawRecordingClipEl.style.width = `${recWidth}px`;

                const canvas = dawRecordingClipEl.querySelector('.daw-live-waveform-canvas');
                if (canvas && daw._liveRecPeaks) {
                    const dpr = Math.min(window.devicePixelRatio || 1, 2);
                    const clientW = Math.max(20, Math.floor(recWidth));
                    const clientH = Math.max(30, (daw.laneHeight ? daw.laneHeight - 8 : 56));

                    // Buffer canvas width in 128px chunks so GPU surface texture is NOT reallocated on every pixel
                    const targetBufferW = Math.ceil((clientW + 64) / 128) * 128;
                    if (!canvas._bufW || canvas._bufW < targetBufferW) {
                        canvas._bufW = targetBufferW;
                        canvas.width = Math.floor(targetBufferW * dpr);
                        canvas.height = Math.floor(clientH * dpr);
                        canvas.style.width = `${targetBufferW}px`;
                        canvas.style.height = `${clientH}px`;
                    }

                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.save();
                        ctx.scale(dpr, dpr);
                        ctx.clearRect(0, 0, (canvas._bufW || clientW) + 10, clientH);

                        const barWidth = 2.0;
                        const barGap = 1.0;
                        const step = barWidth + barGap;
                        const activeBars = Math.floor((clientW - 4) / step);

                        if (activeBars > 0) {
                            const midY = clientH / 2;
                            const PEAK_BUCKET_SEC = 0.02;
                            // Sleek monochrome high-contrast bars matching dark cinematic aesthetic rule
                            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                            ctx.beginPath();
                            for (let b = 0; b < activeBars; b++) {
                                // Fixed timeline coordinate: bar b always corresponds to fixed time (b * step) / zoom
                                const barTime = (b * step) / (daw.zoom || 15);
                                const bIdx = Math.floor(barTime / PEAK_BUCKET_SEC);
                                const rawVal = (daw._liveRecPeaks && daw._liveRecPeaks[bIdx] !== undefined)
                                    ? daw._liveRecPeaks[bIdx]
                                    : (b >= activeBars - 2 ? liveMicPeak : 0.08);
                                const pVal = Math.max(0.08, Math.min(1.0, rawVal));
                                const barH = Math.max(4, Math.round(pVal * (clientH - 12)));
                                const bx = Math.round(b * step);
                                const by = Math.round(midY - barH / 2);
                                ctx.rect(bx, by, 2, barH);
                            }
                            ctx.fill();
                        }
                        ctx.restore();
                    }
                }
            }

            const hasActivePunch = daw.punch && daw.punch.isActive && typeof daw.punch.inTime === 'number' && typeof daw.punch.outTime === 'number';

            if (daw.isRecording) {
                if (daw.playhead >= daw.duration - 2) {
                    daw.duration = Math.max(daw.duration + 30, Math.ceil(daw.playhead + 30));
                    renderDawRuler();
                }
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

            // Sample Master Output Stereo Peak VU Meter, Live Mic Recording & LUFS Loudness
            if (daw.masterAnalyser || (daw.isRecording && daw._liveRecAnalyser)) {
                let peak = 0;
                let sumSquare = 0;
                let totalSamples = 0;
                let primaryData = null;

                if (daw.masterAnalyser) {
                    const data = new Uint8Array(daw.masterAnalyser.frequencyBinCount);
                    daw.masterAnalyser.getByteTimeDomainData(data);
                    for (let i = 0; i < data.length; i++) {
                        const dev = (data[i] - 128) / 128;
                        const absDev = Math.abs(dev);
                        if (absDev > peak) peak = absDev;
                        sumSquare += dev * dev;
                    }
                    totalSamples += data.length;
                    primaryData = data;
                }

                // Incorporate single-sampled live mic reading into Master VU when recording
                if (daw.isRecording && daw._liveRecAnalyser && liveMicData) {
                    if (liveMicPeak > peak) peak = liveMicPeak;
                    for (let i = 0; i < liveMicData.length; i++) {
                        const dev = (liveMicData[i] - 128) / 128;
                        sumSquare += dev * dev;
                    }
                    totalSamples += liveMicData.length;
                    if (!primaryData) primaryData = liveMicData;
                }

                const vuBar = document.getElementById('daw-master-vu-bar');
                const vuDb = document.getElementById('daw-master-vu-db');
                const lufsBadge = document.getElementById('daw-master-lufs-badge');

                const masterPct = calculateBroadcastVuPct(peak);
                if (vuBar) vuBar.style.width = `${masterPct}%`;
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

                if (vuBarL) vuBarL.style.height = `${masterPct}%`;
                const deckMasterVuL = document.getElementById('daw-deck-mixer-master-vu-l');
                if (deckMasterVuL) deckMasterVuL.style.height = `${masterPct}%`;
                const peakR = Math.max(0, Math.min(1.0, peak * (0.96 + (((primaryData ? primaryData[0] : 128)) % 7) * 0.01)));
                const masterPctR = calculateBroadcastVuPct(peakR);
                if (vuBarR) {
                    vuBarR.style.height = `${masterPctR}%`;
                }
                const deckMasterVuR = document.getElementById('daw-deck-mixer-master-vu-r');
                if (deckMasterVuR) deckMasterVuR.style.height = `${masterPctR}%`;
                if (vuDbL) vuDbL.textContent = dbStr === '-inf' ? '-∞' : `${dbStr}dB`;
                if (vuDbR) vuDbR.textContent = dbStr === '-inf' ? '-∞' : `${dbStr}dB`;
                if (vuClip) {
                    vuClip.style.opacity = peak >= 0.98 ? '1' : '0';
                }

                if (lufsBadge && totalSamples > 0) {
                    const rms = Math.sqrt(sumSquare / totalSamples);
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
                            lufsBadge.style.color = '#0a84ff'; // Quiet speech/ambient
                            if (vuWindowLufs) vuWindowLufs.style.color = '#0a84ff';
                        }

                        // Loudness Target compliance calculation
                        const targetBadge = document.getElementById('daw-vu-target-compliance-badge');
                        if (targetBadge && _activeVuTarget !== 'off') {
                            const targetVal = _activeVuTarget === 'stream' ? -14.0 : -24.0;
                            const diff = parseFloat(lufs) - targetVal;
                            if (Math.abs(diff) <= 1.0) {
                                targetBadge.textContent = 'ON TARGET';
                                targetBadge.style.color = '#34d399';
                            } else if (diff > 1.0) {
                                targetBadge.textContent = `+${diff.toFixed(1)} HOT`;
                                targetBadge.style.color = '#ff9f0a';
                            } else {
                                targetBadge.textContent = `${diff.toFixed(1)} LOW`;
                                targetBadge.style.color = '#0a84ff';
                            }
                        }
                    } else {
                        lufsBadge.textContent = '-∞ LUFS';
                        lufsBadge.style.color = '#0a84ff';
                        if (vuWindowLufs) {
                            vuWindowLufs.textContent = '-∞ LUFS';
                            vuWindowLufs.style.color = '#0a84ff';
                        }
                        const targetBadge = document.getElementById('daw-vu-target-compliance-badge');
                        if (targetBadge && _activeVuTarget !== 'off') {
                            targetBadge.textContent = 'SILENT';
                            targetBadge.style.color = 'rgba(255,255,255,0.4)';
                        }
                    }
                }

                // Animate Individual Track Header Mini VU Level Meters
                const trackKeys = Object.keys(daw.tracks);
                trackKeys.forEach(tKey => {
                    const trackObj = daw.tracks[tKey];
                    const miniVuFill = document.getElementById(`track-mini-vu-fill-${tKey}`);
                    const deckMixerVu = document.getElementById(`daw-mixer-vu-${tKey}`);
                    if (!miniVuFill && !deckMixerVu) return;

                    if (trackObj.muted) {
                        if (miniVuFill) miniVuFill.style.height = '0%';
                        if (deckMixerVu) deckMixerVu.style.height = '0%';
                        return;
                    }

                    let tPeak = 0;
                    const isRecTarget = daw.isRecording && (daw._recordTrackId === tKey || dawRecordingTargetTrackId === tKey);
                    const isArmedMicTarget = !daw.isRecording && (daw._recordTrackId === tKey || dawRecordingTargetTrackId === tKey) && daw._micMonitorAnalyser;

                    if (isRecTarget && daw._liveRecAnalyser) {
                        tPeak = liveMicPeak;
                    } else if (isArmedMicTarget && daw._micMonitorAnalyser) {
                        const mData = new Uint8Array(daw._micMonitorAnalyser.frequencyBinCount);
                        daw._micMonitorAnalyser.getByteTimeDomainData(mData);
                        for (let mi = 0; mi < mData.length; mi++) {
                            const mDev = Math.abs((mData[mi] - 128) / 128);
                            if (mDev > tPeak) tPeak = mDev;
                        }
                    } else {
                        const bus = daw.trackBuses && daw.trackBuses[tKey];
                        if (bus && bus.analyser && bus.data) {
                            bus.analyser.getByteTimeDomainData(bus.data);
                            for (let bi = 0; bi < bus.data.length; bi++) {
                                const bDev = Math.abs((bus.data[bi] - 128) / 128);
                                if (bDev > tPeak) tPeak = bDev;
                            }
                        }
                    }

                    const pct = calculateBroadcastVuPct(tPeak);
                    if (miniVuFill) miniVuFill.style.height = `${pct}%`;
                    if (deckMixerVu) deckMixerVu.style.height = `${pct}%`;
                });

                // Live Telemetry Sync to Docked Bottom Studio Deck
                const deckEl = document.getElementById('daw-bottom-studio-deck');
                if (deckEl && !deckEl.classList.contains('collapsed')) {
                    const activeId = daw._activeFxTrackId || (daw.tracks && Object.keys(daw.tracks)[0]) || 'host';
                    const activeBus = daw.trackBuses && daw.trackBuses[activeId];
                    const activeTrack = daw.tracks && daw.tracks[activeId];
                    if (activeBus) {
                        const compNode = activeBus.fx?.compNode;
                        let grDb = 0;
                        if (compNode) {
                            const redVal = typeof compNode.reduction === 'number' ? compNode.reduction : (compNode.reduction?.value || 0);
                            grDb = Math.abs(redVal);
                        }
                        const deckGrFill = document.getElementById('daw-deck-comp-gr-fill');
                        const deckGrVal = document.getElementById('daw-deck-comp-gr-val');
                        if (deckGrFill && deckGrVal) {
                            if (grDb > 0.05) {
                                deckGrFill.style.width = `${Math.min(100, (grDb / 18) * 100)}%`;
                                deckGrVal.textContent = `-${grDb.toFixed(1)} dB`;
                            } else {
                                deckGrFill.style.width = '0%';
                                deckGrVal.textContent = '0.0 dB';
                            }
                        }

                        if (window._renderDeckEqCanvas && activeBus.analyser) {
                            window._renderDeckEqCanvas(activeTrack?.plugins, activeBus.analyser);
                        }

                        if (window._renderDeckCompCanvas) {
                            let trackPeakVal = 0;
                            if (activeBus.data) {
                                for (let bi = 0; bi < activeBus.data.length; bi++) {
                                    const dev = Math.abs((activeBus.data[bi] - 128) / 128);
                                    if (dev > trackPeakVal) trackPeakVal = dev;
                                }
                            }
                            const devDb = trackPeakVal > 0.0001 ? 20 * Math.log10(trackPeakVal) : -100;
                            window._renderDeckCompCanvas(activeTrack?.plugins, devDb, grDb);
                        }
                    }
                }

                // Real-Time Track DSP FX Rack Updates during timeline playback
                const fxModal = document.getElementById('daw-track-fx-modal');
                if (fxModal && fxModal.style.display !== 'none' && daw._activeFxTrackId) {
                    const activeBus = daw.trackBuses && daw.trackBuses[daw._activeFxTrackId];
                    if (activeBus) {
                        // Compressor GR meter
                        const compNode = activeBus.fx?.compNode;
                        const grFill = document.getElementById('daw-fx-comp-gr-fill');
                        const grValEl = document.getElementById('daw-fx-comp-gr-val');
                        if (grFill && grValEl) {
                            let grDb = 0;
                            if (compNode && document.getElementById('daw-fx-comp-enable')?.checked) {
                                const redVal = typeof compNode.reduction === 'number' ? compNode.reduction : (compNode.reduction?.value || 0);
                                grDb = Math.abs(redVal);
                            }
                            if (grDb > 0.05) {
                                grFill.style.width = `${Math.min(100, (grDb / 18) * 100)}%`;
                                grValEl.textContent = `-${grDb.toFixed(1)} dB`;
                            } else {
                                grFill.style.width = '0%';
                                grValEl.textContent = '0.0 dB';
                            }
                        }

                        // Gate Status Pill
                        const gatePill = document.getElementById('daw-fx-gate-status-pill');
                        if (gatePill) {
                            const isGateOn = !!document.getElementById('daw-fx-gate-enable')?.checked;
                            const gThresh = parseFloat(document.getElementById('daw-fx-gate-thresh')?.value || -42);
                            if (!isGateOn) {
                                gatePill.textContent = 'BYPASS';
                                gatePill.style.color = 'rgba(255,255,255,0.4)';
                                gatePill.style.background = 'rgba(255,255,255,0.06)';
                                gatePill.style.borderColor = 'rgba(255,255,255,0.1)';
                            } else {
                                let trackPeak = 0;
                                if (activeBus.data) {
                                    for (let bi = 0; bi < activeBus.data.length; bi++) {
                                        const dev = Math.abs((activeBus.data[bi] - 128) / 128);
                                        if (dev > trackPeak) trackPeak = dev;
                                    }
                                }
                                const peakDb = trackPeak > 0.0001 ? 20 * Math.log10(trackPeak) : -100;
                                if (peakDb < gThresh) {
                                    gatePill.textContent = 'DUCKED';
                                    gatePill.style.color = '#ff9f0a';
                                    gatePill.style.background = 'rgba(255, 159, 10,0.18)';
                                    gatePill.style.borderColor = 'rgba(255, 159, 10,0.4)';
                                } else {
                                    gatePill.textContent = 'OPEN';
                                    gatePill.style.color = '#30d158';
                                    gatePill.style.background = 'rgba(48, 209, 88,0.18)';
                                    gatePill.style.borderColor = 'rgba(48, 209, 88,0.4)';
                                }
                            }
                        }

                        // Live EQ Spectrum Canvas & Telemetry Diagnostics
                        if (activeBus.analyser) {
                            renderEqCurveCanvas(activeBus.analyser);
                            checkAndRenderFxTelemetry(activeBus.analyser, compNode);
                        }
                    }
                }
            }

            // Deck Clip Inspector Playhead Scrub Sync
            if (window._syncDeckClipScrub) {
                window._syncDeckClipScrub(daw.playhead);
            }

            // Auto-scroll timeline viewport smoothly to follow playhead in real-time without layout reflows
            const viewport = document.getElementById('timeline-scroll-viewport');
            if (viewport) {
                const playheadPx = daw.playhead * daw.zoom;
                const vpClientW = viewport._cachedWidth || viewport.clientWidth;
                if (!viewport._cachedWidth) viewport._cachedWidth = vpClientW;

                const leadMargin = daw.isRecording
                    ? Math.min(220, vpClientW * 0.35)
                    : Math.min(300, vpClientW * 0.45);
                const scrollTrigger = viewport.scrollLeft + vpClientW - leadMargin;
                if (playheadPx > scrollTrigger) {
                    viewport.scrollLeft = playheadPx - (vpClientW - leadMargin);
                } else if (playheadPx < viewport.scrollLeft) {
                    viewport.scrollLeft = Math.max(0, playheadPx - 60);
                }
            }
        } catch (tickErr) {
            console.error('[DAW Transport Engine] Error inside tick:', tickErr);
        }

        daw.animId = requestAnimationFrame(tickDawEngine);
    };

    startDawEngineTicker = () => {
        if (daw.animId) return;
        const now = (daw.audioCtx && daw.audioCtx.state === 'running') ? daw.audioCtx.currentTime : (performance.now() / 1000);
        daw.startEngineTime = now;
        daw.startPlayhead = Number.isFinite(daw.playhead) ? daw.playhead : 0;
        daw.animId = requestAnimationFrame(tickDawEngine);
    };

    stopDawEngineTicker = () => {
        if (daw.animId) {
            cancelAnimationFrame(daw.animId);
            daw.animId = null;
        }
        daw.startEngineTime = null;
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

        // If timeline is empty and not recording, notify user instead of auto-generating demo stems
        if (!daw.isRecording && (!daw.clips || daw.clips.length === 0)) {
            showStudioToast('Timeline is empty — double-click track area to add tracks or import audio');
            return;
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
        } else if (!daw.isRecording && (daw.playhead >= daw.duration - 0.2 || (latestClipEnd > 0 && daw.playhead >= latestClipEnd - 0.05))) {
            daw.playhead = 0;
            updateDawPlayhead();
        }

        // Ensure all pending clip audio buffers are resolved before scheduling playback
        const pendingClips = daw.clips.filter(c => !c.buffer && (c.blob || c.blobUrl));
        if (pendingClips.length > 0) {
            const playBtn = document.getElementById('timeline-play-btn');
            if (playBtn) {
                playBtn.style.background = 'rgba(48, 209, 88, 0.15)';
                playBtn.style.border = '1px solid rgba(52, 211, 153, 0.4)';
                playBtn.style.color = '#a7f3d0';
                playBtn.style.boxShadow = 'none';
            }
            const playBtnText = document.getElementById('timeline-play-btn-text');
            if (playBtnText) playBtnText.textContent = 'WAIT';
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
            if (playBtnText) playBtnText.textContent = 'PAUSE';
        }

        daw.activeSources = [];
        teardownTrackBuses();
        Object.keys(daw.tracks).forEach(tid => createTrackBus(tid));

        const baseAudioTime = daw.audioCtx.currentTime + 0.025; // 25ms safe lookahead margin

        for (const clip of daw.clips) {
            const track = daw.tracks[clip.trackId];
            if (!track) continue;
            if (clip.muted || clip.isMuted) continue;

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
                    const clipGain = daw.audioCtx.createGain();

                    const startTime = baseAudioTime + scheduleDelay;
                    const endTime = startTime + playDuration;
                    const clipBaseGain = (typeof clip.gain === 'number' && Number.isFinite(clip.gain)) ? Math.max(0.0001, clip.gain) : 1.0;

                    clipGain.gain.cancelScheduledValues(baseAudioTime);

                    const elapsedInClip = (daw.playhead > clipStart) ? (daw.playhead - clipStart) : 0;

                    // Apply Track Volume & Keyframe Curve Automation (if enabled on track)
                    if (track.showAutomation && track.keyframes && track.keyframes.length > 1) {
                        const sorted = [...track.keyframes].sort((a, b) => a.time - b.time);
                        const initKfGain = evaluateKeyframeAtTime(sorted, Math.max(0, daw.playhead)) * clipBaseGain;
                        clipGain.gain.setValueAtTime(Math.max(0.0001, initKfGain), startTime);

                        sorted.forEach(kf => {
                            if (kf.time > daw.playhead && kf.time <= clipEnd) {
                                const rampTime = baseAudioTime + (kf.time - daw.playhead);
                                clipGain.gain.linearRampToValueAtTime(Math.max(0.0001, kf.val * clipBaseGain), Math.max(startTime + 0.005, rampTime));
                            }
                        });
                    } else {
                        // Apply Corner Fade In / Out & Crossfade Curves
                        scheduleClipFadeEnvelope(clipGain.gain, clip, clipDur, elapsedInClip, startTime, clipBaseGain);
                    }

                    // Route Clip Audio through Persistent Track Bus
                    const trackBus = getTrackBus(clip.trackId);
                    src.connect(clipGain);
                    if (trackBus && trackBus.input) {
                        clipGain.connect(trackBus.input);
                    } else {
                        clipGain.connect(daw.masterGain);
                    }

                    src.start(startTime, offsetInBuffer, playDuration);
                    daw.activeSources.push(src);
                } catch (err) {
                    console.warn('[DAW Playback] Error starting buffer:', clip.name, err);
                }
            }
        }

        daw.isPlaying = true;
        if (!daw.isRecording) {
            setStudioStatus('Playing Timeline', 'playing', false);
        }

        const playBtn = document.getElementById('timeline-play-btn');
        if (playBtn) {
            playBtn.style.background = 'linear-gradient(135deg, #30d158 0%, #059669 100%)';
            playBtn.style.border = '1px solid rgba(52, 211, 153, 0.85)';
            playBtn.style.color = '#021a10';
            playBtn.style.boxShadow = '0 0 16px rgba(48, 209, 88, 0.5)';
        }
        const playBtnText = document.getElementById('timeline-play-btn-text');
        if (playBtnText) playBtnText.textContent = 'PAUSE';
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

        startDawEngineTicker();
    };

    const toggleDawPlay = () => {
        if (daw.isPlaying) {
            stopDawPlayback(false);
        } else {
            startDawPlayback();
        }
    };

    // Helper to get or reuse active microphone stream across recording takes
    const getOrCreateDawMicStream = async (requestedDeviceId) => {
        if (daw._activeMicStream) {
            const audioTracks = daw._activeMicStream.getAudioTracks();
            const hasLiveTrack = audioTracks.some(t => t.readyState === 'live');
            if (hasLiveTrack) {
                // If requested device matches or is not specified, reuse existing active stream immediately
                if (!requestedDeviceId || daw._activeMicDeviceId === requestedDeviceId) {
                    return daw._activeMicStream;
                }
                // Device selection changed: safely stop previous tracks
                audioTracks.forEach(t => {
                    try { t.stop(); } catch (e) {}
                });
                daw._activeMicStream = null;
            }
        }

        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: requestedDeviceId ? { exact: requestedDeviceId } : undefined,
                    echoCancellation: true,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });
        } catch (err) {
            // Fallback to default microphone if exact device constraint fails
            stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });
        }

        daw._activeMicStream = stream;
        daw._activeMicDeviceId = requestedDeviceId || '';
        return stream;
    };

    // Start Live Mic Level VU Monitor in DAW Toolbar
    const startDawMicLevelMonitor = async (deviceId) => {
        try {
            const stream = await getOrCreateDawMicStream(deviceId);
            if (!daw.audioCtx || daw.audioCtx.state === 'closed') {
                daw.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (daw.audioCtx.state === 'suspended') {
                await daw.audioCtx.resume();
            }

            if (!daw._micSourceNode || daw._micSourceStream !== stream) {
                if (daw._micSourceNode) {
                    try { daw._micSourceNode.disconnect(); } catch (e) {}
                }
                daw._micSourceNode = daw.audioCtx.createMediaStreamSource(stream);
                daw._micSourceStream = stream;
            }

            if (!daw._micMonitorAnalyser) {
                daw._micMonitorAnalyser = daw.audioCtx.createAnalyser();
                daw._micMonitorAnalyser.fftSize = 64;
                daw._micSourceNode.connect(daw._micMonitorAnalyser);
            }

            if (!daw._micMonitorAnimRunning) {
                daw._micMonitorAnimRunning = true;
                const updateMeter = () => {
                    const editorModal = document.getElementById('podcast-editor-modal');
                    if (!editorModal || editorModal.style.display === 'none' || !daw._activeMicStream) {
                        daw._micMonitorAnimRunning = false;
                        return;
                    }

                    // During active recording, tick() handles real-time meter updates synchronously to avoid dual RAF overhead
                    if (!daw.isRecording && daw._micMonitorAnalyser) {
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

                        // Drive armed track mini VU and mixer VU meter while testing mic levels
                        const armedTrackId = daw._recordTrackId && daw._recordTrackId !== '__new__'
                            ? daw._recordTrackId
                            : (daw.tracks && Object.keys(daw.tracks)[0]);
                        if (armedTrackId) {
                            const armedMiniVu = document.getElementById(`track-mini-vu-fill-${armedTrackId}`);
                            const armedMixerVu = document.getElementById(`daw-mixer-vu-${armedTrackId}`);
                            const armedPct = calculateBroadcastVuPct(peak);
                            if (armedMiniVu) armedMiniVu.style.height = `${armedPct}%`;
                            if (armedMixerVu) armedMixerVu.style.height = `${armedPct}%`;
                        }
                    }
                    requestAnimationFrame(updateMeter);
                };
                requestAnimationFrame(updateMeter);
            }
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
            const curVal = daw._recordTrackId || '__new__';
            trackSelect.innerHTML = `
                <option value="__new__" ${curVal === '__new__' ? 'selected' : ''}>+ New Track (Auto)</option>
                ${trackList.map(t => `
                    <option value="${t.id}" ${t.id === curVal ? 'selected' : ''}>${t.name}${t.id === daw._recordTrackId ? ' ● [ARMED]' : ''}</option>
                `).join('')}
            `;
            trackSelect.onchange = (e) => {
                daw._recordTrackId = e.target.value;
                renderDawTracks();
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
            if (daw._activeMicStream) {
                try { daw._activeMicStream.getTracks().forEach(t => t.stop()); } catch (e) {}
                daw._activeMicStream = null;
                daw._activeMicDeviceId = null;
            }
            if (daw._micSourceNode) {
                try { daw._micSourceNode.disconnect(); } catch (e) {}
                daw._micSourceNode = null;
                daw._micSourceStream = null;
            }
            if (daw._hasUserGrantedMicPermission || daw.isRecording) {
                startDawMicLevelMonitor(devId);
            }
        };

        // Audio permissions must ONLY load lazily when recording is initiated, never on page load/splash screen!
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
            const voColors = ['#ff453a', '#0a84ff', '#30d158', '#5e5ce6', '#ff9f0a', '#40c8e0'];
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
            stream = await getOrCreateDawMicStream(selectedMicId);
            daw._hasUserGrantedMicPermission = true;
            initDawMicSetup();
            startDawMicLevelMonitor(selectedMicId);
        } catch (err) {
            await showStudioAlert('Microphone Access Error', 'Could not access microphone: ' + err.message + '\n\nPlease verify microphone permissions in your browser settings.');
            return;
        }

        dawRecordingStream = stream;
        dawRecordingChunks = [];
        dawRecordingStartTime = daw.playhead;
        dawRecordingTargetTrackId = targetTrackId;

        if (!daw.audioCtx || daw.audioCtx.state === 'closed') {
            daw.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (daw.audioCtx.state === 'suspended') {
            await daw.audioCtx.resume();
        }

        try {
            if (!daw._micSourceNode || daw._micSourceStream !== stream) {
                if (daw._micSourceNode) {
                    try { daw._micSourceNode.disconnect(); } catch (e) {}
                }
                daw._micSourceNode = daw.audioCtx.createMediaStreamSource(stream);
                daw._micSourceStream = stream;
            }

            if (!daw._liveRecAnalyser) {
                daw._liveRecAnalyser = daw.audioCtx.createAnalyser();
                daw._liveRecAnalyser.fftSize = 256;
                daw._liveRecAnalyser.smoothingTimeConstant = 0.2;
            }
            try { daw._micSourceNode.connect(daw._liveRecAnalyser); } catch (e) {}

            daw._liveRecPeaks = [];
            daw._liveRecTimeData = new Uint8Array(daw._liveRecAnalyser.fftSize);
        } catch (analyserErr) {
            console.warn('[DAW Record] Live analyser setup warning:', analyserErr);
        }

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

            if (daw._liveRecAnalyser && daw._micSourceNode) {
                try { daw._micSourceNode.disconnect(daw._liveRecAnalyser); } catch (e) {}
            }
            daw._liveRecAnalyser = null;
            daw._liveRecPeaks = null;
            daw._liveRecTimeData = null;

            // Keep daw._activeMicStream alive across takes so subsequent takes don't trigger
            // OS hardware renegotiation or browser permission re-prompts.
            dawRecordingStream = null;

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
                        color: '#ff453a'
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
                    showUndoToast(`Recorded: ${clipName} onto ${track?.name || 'New Track'} (${formatDawTime(recDur)})`);
                } catch (err) {
                    console.error('[DAW Record] Error decoding take:', err);
                }
            }
        };

        // Smart rewind check if parked at the end of the project before recording starts
        let latestClipEnd = 0;
        if (daw.clips && daw.clips.length > 0) {
            for (const c of daw.clips) {
                const cEnd = (Number.isFinite(c.startOffset) ? c.startOffset : 0) + Math.max(0, (c.trimEnd || 0) - (c.trimStart || 0));
                if (cEnd > latestClipEnd) latestClipEnd = cEnd;
            }
        }
        if (daw.playhead >= (daw.duration || 60) - 0.2 || (latestClipEnd > 0 && daw.playhead >= latestClipEnd - 0.05)) {
            daw.playhead = 0;
            updateDawPlayhead();
        }

        dawRecordingStartTime = daw.playhead;
        daw.isRecording = true;
        setStudioStatus(`RECORDING [REC] • Real-Time Stream Capture (${track?.name || 'VOICE-OVER'})`, 'recording', false);

        // Visual update on Record Button
        const recBtn = document.getElementById('timeline-record-btn');
        if (recBtn) {
            recBtn.style.background = '#ff453a';
            recBtn.style.borderColor = '#d73329';
            recBtn.style.color = '#ffffff';
            recBtn.style.boxShadow = '0 0 16px rgba(255, 69, 58, 0.6)';
            const recText = document.getElementById('timeline-record-btn-text');
            if (recText) recText.textContent = 'Stop Rec';
        }

        // Auto-scroll timeline viewport so playhead and target lane are immediately in view
        const viewport = document.getElementById('timeline-scroll-viewport');
        const targetLane = document.getElementById(`timeline-lane-${targetTrackId}`);
        if (viewport) {
            const playheadPx = daw.playhead * daw.zoom;
            if (playheadPx < viewport.scrollLeft || playheadPx > viewport.scrollLeft + viewport.clientWidth - 100) {
                viewport.scrollLeft = Math.max(0, playheadPx - 80);
            }
            if (targetLane) {
                const laneTop = targetLane.offsetTop;
                const laneBottom = laneTop + targetLane.offsetHeight;
                if (laneTop < viewport.scrollTop || laneBottom > viewport.scrollTop + viewport.clientHeight) {
                    viewport.scrollTop = Math.max(0, laneTop - 20);
                }
            }
        }

        // Create live growing recording clip placeholder with real-time waveform canvas in the destination track lane
        if (targetLane) {
            dawRecordingClipEl = document.createElement('div');
            dawRecordingClipEl.className = 'daw-timeline-clip daw-recording-clip';
            dawRecordingClipEl.style.cssText = `
                position: absolute;
                top: 4px;
                bottom: 4px;
                left: ${dawRecordingStartTime * daw.zoom}px;
                width: 24px;
                min-width: 20px;
                background: rgba(255, 69, 58, 0.22);
                background-image: linear-gradient(180deg, rgba(255, 69, 58, 0.35) 0%, rgba(20, 20, 24, 0.92) 100%);
                border: 1.5px solid #ff453a;
                border-radius: 6px;
                overflow: hidden;
                z-index: 35;
                box-shadow: 0 0 18px rgba(255, 69, 58, 0.45);
                pointer-events: none;
                display: flex;
            `;
            dawRecordingClipEl.innerHTML = `
                <div style="position: absolute; top: 4px; left: 8px; z-index: 10; display: flex; align-items: center; gap: 6px; white-space: nowrap; font-size: 10px; font-weight: 800; color: #ffffff; text-shadow: 0 1px 4px rgba(0,0,0,0.9); pointer-events: none;">
                    <span style="width: 7px; height: 7px; border-radius: 50%; background: #ff453a; box-shadow: 0 0 8px #ff453a; animation: dawRecBlink 0.9s infinite alternate ease-in-out; flex-shrink: 0;"></span>
                    <span style="letter-spacing: 0.5px;">REC LIVE ● ${track?.name || 'VOICE-OVER'}</span>
                </div>
                <canvas class="daw-live-waveform-canvas" style="position: absolute; left: 0; top: 0; height: 100%; pointer-events: none; z-index: 2; display: block;"></canvas>
            `;
            targetLane.appendChild(dawRecordingClipEl);
        }

        dawMediaRecorder.start(100);

        // Immediately start engine ticker so playhead advances, clip grows, and waveform animates without waiting
        startDawEngineTicker();

        // Update Play button to show timeline is active
        const playBtn = document.getElementById('timeline-play-btn');
        if (playBtn) {
            playBtn.style.background = 'linear-gradient(135deg, #30d158 0%, #059669 100%)';
            playBtn.style.border = '1px solid rgba(52, 211, 153, 0.85)';
            playBtn.style.color = '#021a10';
            playBtn.style.boxShadow = '0 0 16px rgba(48, 209, 88, 0.5)';
        }
        const playBtnText = document.getElementById('timeline-play-btn-text');
        if (playBtnText) playBtnText.textContent = 'PAUSE';
        const playBtnIcon = document.getElementById('timeline-play-btn-icon');
        if (playBtnIcon) playBtnIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';

        // Overdub backing tracks simultaneously if any clips exist on timeline
        if (daw.clips && daw.clips.length > 0 && !daw.isPlaying) {
            startDawPlayback().catch(err => {
                console.warn('[DAW Overdub] Playback start notice:', err);
            });
        }
    };

    const stopDawRecording = () => {
        if (!daw.isRecording) return;
        daw.isRecording = false;
        setStudioStatus('Processing recorded take...', 'busy', true);

        if (daw._liveRecAnalyser && daw._micSourceNode) {
            try { daw._micSourceNode.disconnect(daw._liveRecAnalyser); } catch (e) {}
        }
        daw._liveRecAnalyser = null;
        daw._liveRecPeaks = null;
        daw._liveRecTimeData = null;

        if (dawMediaRecorder && dawMediaRecorder.state !== 'inactive') {
            dawMediaRecorder.stop();
        }

        const recBtn = document.getElementById('timeline-record-btn');
        if (recBtn) {
            recBtn.style.background = 'rgba(255, 69, 58, 0.15)';
            recBtn.style.borderColor = 'rgba(255, 69, 58, 0.45)';
            recBtn.style.color = '#ff453a';
            recBtn.style.boxShadow = 'none';
            const recText = document.getElementById('timeline-record-btn-text');
            if (recText) recText.textContent = 'Record';
        }

        if (daw.isPlaying) {
            stopDawPlayback(false);
        } else {
            stopDawEngineTicker();
            setStudioStatus('Ready', 'ready', false);
            const vuBar = document.getElementById('daw-master-vu-bar');
            const vuDb = document.getElementById('daw-master-vu-db');
            if (vuBar) vuBar.style.width = '0%';
            if (vuDb) vuDb.textContent = '-∞ dB';
            const vuBarL = document.getElementById('daw-vu-bar-l');
            const vuBarR = document.getElementById('daw-vu-bar-r');
            if (vuBarL) vuBarL.style.height = '0%';
            if (vuBarR) vuBarR.style.height = '0%';
            const dMasterL = document.getElementById('daw-deck-mixer-master-vu-l');
            const dMasterR = document.getElementById('daw-deck-mixer-master-vu-r');
            if (dMasterL) dMasterL.style.height = '0%';
            if (dMasterR) dMasterR.style.height = '0%';
            document.querySelectorAll('.track-mini-vu-fill').forEach(fill => { fill.style.height = '0%'; });
            document.querySelectorAll('[id^="daw-mixer-vu-"]').forEach(fill => { fill.style.height = '0%'; });
            const playBtn = document.getElementById('timeline-play-btn');
            if (playBtn) {
                playBtn.style.background = 'linear-gradient(135deg, rgba(48, 209, 88, 0.22) 0%, rgba(5, 150, 105, 0.16) 100%)';
                playBtn.style.border = '1px solid rgba(52, 211, 153, 0.55)';
                playBtn.style.color = '#34d399';
                playBtn.style.boxShadow = '0 0 10px rgba(48, 209, 88, 0.2)';
            }
            const playBtnText = document.getElementById('timeline-play-btn-text');
            if (playBtnText) playBtnText.textContent = 'PLAY';
            const playBtnIcon = document.getElementById('timeline-play-btn-icon');
            if (playBtnIcon) playBtnIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
        }
    };

    const toggleDawRecording = async () => {
        if (daw.isRecording) {
            stopDawRecording();
        } else {
            await startDawRecording();
        }
    };

    // Timeline Active Tool Selection: Pointer Tool ('pointer') vs Razor Blade Tool ('blade')
    const setDawActiveTool = (tool) => {
        daw.activeTool = (tool === 'blade') ? 'blade' : 'pointer';
        const isBlade = (daw.activeTool === 'blade');
        const pointerBtn = document.getElementById('timeline-tool-pointer-btn');
        const bladeBtn = document.getElementById('timeline-tool-blade-btn');

        if (pointerBtn) {
            pointerBtn.style.background = isBlade ? 'transparent' : 'rgba(10, 132, 255, 0.25)';
            pointerBtn.style.borderColor = isBlade ? 'transparent' : 'rgba(10, 132, 255, 0.5)';
            pointerBtn.style.color = isBlade ? 'rgba(255,255,255,0.65)' : '#0a84ff';
        }
        if (bladeBtn) {
            bladeBtn.style.background = isBlade ? 'rgba(10, 132, 255, 0.25)' : 'transparent';
            bladeBtn.style.borderColor = isBlade ? 'rgba(10, 132, 255, 0.5)' : 'transparent';
            bladeBtn.style.color = isBlade ? '#0a84ff' : 'rgba(255,255,255,0.65)';
        }

        document.querySelectorAll('.daw-timeline-clip').forEach(el => {
            el.style.cursor = isBlade ? 'crosshair' : 'grab';
        });

        if (isBlade) {
            setStudioStatus('Tool: Razor Blade (B) • Click anywhere on a clip to split into two independent parts', 'info', false);
        } else {
            setStudioStatus('Tool: Pointer (V) • Select, move, and slip-edit audio clips', 'info', false);
        }
    };

    // Precision Slicing Engine (split at timestamp without requiring playhead repositioning)
    const splitClipAtTimestamp = (clipId, splitTime) => {
        const clipIdx = daw.clips.findIndex(c => c.id === clipId);
        if (clipIdx === -1) return false;
        const clip = daw.clips[clipIdx];
        const clipStart = Number.isFinite(clip.startOffset) ? clip.startOffset : 0;
        const clipLen = Math.max(0.1, (clip.trimEnd || clip.duration || 0) - (clip.trimStart || 0));
        const clipEnd = clipStart + clipLen;

        if (splitTime <= clipStart + 0.05 || splitTime >= clipEnd - 0.05) {
            return false;
        }

        const cutInClip = (clip.trimStart || 0) + (splitTime - clipStart);
        const originalEnd = clip.trimEnd || clip.duration || 0;

        pushDawHistory('Split Clip');

        // Truncate left clip
        clip.trimEnd = Math.round(cutInClip * 100) / 100;

        // Create right clip (independently editable, movable, renameable, re-colorable and taggable)
        const newClip = {
            id: `clip-${clip.trackId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            trackId: clip.trackId,
            name: `${clip.name.replace(/ \(Part \d+\)/, '')} (Part 2)`,
            tag: clip.tag || 'Split',
            startOffset: Math.round(splitTime * 100) / 100,
            trimStart: Math.round(cutInClip * 100) / 100,
            trimEnd: originalEnd,
            duration: clip.duration,
            blobUrl: clip.blobUrl,
            blob: clip.blob,
            buffer: clip.buffer,
            peaks: clip.peaks,
            color: clip.color
        };
        daw.clips.splice(clipIdx + 1, 0, newClip);
        daw.selectedClipId = newClip.id;
        if (!daw.selectedClipIds) daw.selectedClipIds = new Set();
        daw.selectedClipIds.clear();
        daw.selectedClipIds.add(newClip.id);
        if (typeof window._syncBottomDeckClipInspector === 'function') window._syncBottomDeckClipInspector();
        recalculateDawDuration();
        renderDawRuler();
        renderDawClips();
        showStudioToast(`Split clip "${clip.name}" at ${formatDawTime(splitTime)}`);
        return true;
    };

    // Split / Cut Selected Clip at Playhead
    const splitSelectedClip = () => {
        if (!daw.selectedClipId) {
            showStudioToast('Please select a clip on the timeline first, then click Split / Cut.');
            return;
        }
        const didSplit = splitClipAtTimestamp(daw.selectedClipId, daw.playhead);
        if (!didSplit) {
            const clip = daw.clips.find(c => c.id === daw.selectedClipId);
            if (clip) {
                const clipStart = Number.isFinite(clip.startOffset) ? clip.startOffset : 0;
                const clipEnd = clipStart + Math.max(0.1, (clip.trimEnd || clip.duration || 0) - (clip.trimStart || 0));
                showStudioAlert(
                    'Playhead Not Over Clip',
                    `The playhead (${formatDawTime(daw.playhead)}) is not over the selected clip "${clip.name}" (${formatDawTime(clipStart)} – ${formatDawTime(clipEnd)}).\n\nMove the playhead over the clip or press B to activate the Razor Blade tool and click directly on the clip to slice.`
                );
            }
        }
    };

    // Dedicated Playhead Split Trigger for Deck Inspector
    const splitClipAtPlayheadDAW = () => {
        splitSelectedClip();
    };

    // Duplicate Selected Clip (places duplicate immediately after on timeline)
    const duplicateSelectedClipDAW = () => {
        const clipId = daw.selectedClipId;
        if (!clipId) {
            showStudioToast('Select a clip first to duplicate');
            return;
        }
        const clip = daw.clips.find(c => c.id === clipId);
        if (!clip) return;

        pushDawHistory('Duplicate Clip');
        const activeDur = Math.max(0.1, (clip.trimEnd || clip.duration || 0) - (clip.trimStart || 0));
        const newStartOffset = Math.round(((Number.isFinite(clip.startOffset) ? clip.startOffset : 0) + activeDur) * 100) / 100;

        const newClip = {
            id: `clip-${clip.trackId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            trackId: clip.trackId,
            name: clip.name.includes('(Copy)') ? clip.name : `${clip.name} (Copy)`,
            tag: clip.tag || 'Audio',
            startOffset: newStartOffset,
            trimStart: clip.trimStart || 0,
            trimEnd: clip.trimEnd,
            fadeIn: clip.fadeIn || 0,
            fadeOut: clip.fadeOut || 0,
            duration: clip.duration,
            buffer: clip.buffer,
            blob: clip.blob,
            blobUrl: clip.blobUrl,
            peaks: clip.peaks,
            color: clip.color
        };

        daw.clips.push(newClip);
        daw.selectedClipId = newClip.id;
        if (!daw.selectedClipIds) daw.selectedClipIds = new Set();
        daw.selectedClipIds.clear();
        daw.selectedClipIds.add(newClip.id);

        recalculateDawDuration();
        renderDawRuler();
        renderDawClips();
        if (typeof window._syncBottomDeckClipInspector === 'function') window._syncBottomDeckClipInspector();
        showStudioToast(`Duplicated "${clip.name}"`);
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
            peaks: (c.peaks ? Object.assign([...c.peaks], { left: c.peaks.left ? [...c.peaks.left] : undefined, right: c.peaks.right ? [...c.peaks.right] : undefined }) : null),
            color: c.color
        }));

        showStudioToast(`Copied ${clipsToCopy.length} clip(s) to clipboard`);
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
                color: template.color || '#0a84ff'
            };

            daw.clips.push(newClip);
            newSelectedIds.add(newClip.id);
        });

        daw.selectedClipIds = newSelectedIds;
        daw.selectedClipId = Array.from(newSelectedIds)[0] || null;

        recalculateDawDuration();
        renderDawRuler();
        renderDawClips();
        showStudioToast(`Pasted ${daw._clipboardClips.length} clip(s) at ${formatDawTime(pasteBaseTime)}`);
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
        if (typeof window._syncBottomDeckClipInspector === 'function') window._syncBottomDeckClipInspector();
        recalculateDawDuration();
        renderDawRuler();
        renderDawClips();
        showStudioToast(isRipple ? `Ripple deleted ${count} clip(s) (gaps closed)` : `Deleted ${count} clip(s)`);
    };

    // Master Mixdown Studio Export Dialog & Processing Engine (v1.7.3)
    const openExportMixdownModal = (sourceMode = 'master') => {
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

        // Pre-fill export source mode (Master Mix, Selected Track, or All Stems)
        const sourceSelect = document.getElementById('daw-export-source-select');
        const activeTrack = daw.tracks && daw._activeFxTrackId ? daw.tracks[daw._activeFxTrackId] : null;
        if (sourceSelect) {
            sourceSelect.innerHTML = `
                <option value="master" ${(!sourceMode || sourceMode === 'master') ? 'selected' : ''}>Master Mix (All Active Audio Channels Combined)</option>
                ${activeTrack ? `<option value="selected" ${sourceMode === 'selected' ? 'selected' : ''}>Selected Track: ${activeTrack.name} (Isolated Track WAV)</option>` : ''}
                <option value="stems" ${sourceMode === 'stems' ? 'selected' : ''}>All Tracks as Isolated Stems (.ZIP)</option>
            `;
            if (sourceMode) sourceSelect.value = sourceMode;
        }

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
        const sourceSelect = document.getElementById('daw-export-source-select');
        const saveTakesCb = document.getElementById('daw-export-save-takes');
        const addToTimelineCb = document.getElementById('daw-export-add-to-timeline');
        const openPubCb = document.getElementById('daw-export-open-publisher');
        const autoDownCb = document.getElementById('daw-export-auto-download');

        const exportSource = sourceSelect ? sourceSelect.value : 'master';
        if (exportSource === 'stems') {
            closeExportMixdownModal();
            exportAllStemsZipDAW();
            return;
        }

        const activeTrack = (exportSource === 'selected' && daw.tracks && daw._activeFxTrackId) ? daw.tracks[daw._activeFxTrackId] : null;
        const defaultName = activeTrack ? `${activeTrack.name}_Track_Bounce` : 'Master Episode Mixdown';
        const exportName = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : defaultName;
        let sampleRate = daw.sampleRate || 48000;
        if (formatSelect) {
            if (formatSelect.value === 'wav_480') sampleRate = 48000;
            else if (formatSelect.value === 'wav_441') sampleRate = 44100;
            else if (formatSelect.value === 'wav_960') sampleRate = 96000;
            else if (formatSelect.value === 'project') sampleRate = daw.sampleRate || 48000;
        }
        const normMode = normSelect ? normSelect.value : 'lufs_14';
        const enableNorm = (normMode !== 'off');
        const isPunchRange = rangeSelect && rangeSelect.value === 'punch' && daw.punch && daw.punch.isActive && typeof daw.punch.inTime === 'number' && typeof daw.punch.outTime === 'number';
        const shouldSaveTakes = !saveTakesCb || saveTakesCb.checked;
        const shouldAddToTimeline = !addToTimelineCb || addToTimelineCb.checked;
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
        if (pTitle) pTitle.textContent = activeTrack ? `Preparing Track: ${activeTrack.name}...` : 'Preparing Multi-Track Stems...';
        if (pSub) pSub.textContent = `Allocating 2-channel 32-bit float audio buffer @ ${sampleRate}Hz`;

        const renderBtn = document.getElementById('timeline-render-btn');
        const origHtml = renderBtn ? renderBtn.innerHTML : '';
        if (renderBtn) {
            renderBtn.disabled = true;
            renderBtn.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
                ${activeTrack ? 'Rendering Track...' : 'Rendering Mix...'}
            `;
        }

        setStudioStatus(activeTrack ? `Rendering Track Bounce: ${activeTrack.name}...` : 'Rendering Master Mixdown (64-Bit WAV / 48kHz)...', 'busy', true);

        try {
            const rangeStart = isPunchRange ? daw.punch.inTime : 0;
            const rangeEnd = isPunchRange ? daw.punch.outTime : Math.max(1, daw.duration);
            const totalDur = Math.max(0.1, rangeEnd - rangeStart);
            const totalSamples = Math.ceil(totalDur * sampleRate);
            const offlineCtx = new OfflineAudioContext(2, totalSamples, sampleRate);

            const hasSolo = Object.values(daw.tracks).some(t => t.solo);

            if (pBar) pBar.style.width = '25%';
            if (pPct) pPct.textContent = '25%';
            if (pTitle) pTitle.textContent = activeTrack ? `Rendering DSP for ${activeTrack.name}...` : 'Scheduling Automation & DSP Plugins...';
            if (pSub) pSub.textContent = `Applying Web Audio DSP chain, volume curves, and micro-fades`;

            for (const clip of daw.clips) {
                // If exporting a single selected track, skip clips belonging to any other track
                if (activeTrack && clip.trackId !== activeTrack.id) continue;
                if (clip.muted || clip.isMuted) continue;

                const track = daw.tracks[clip.trackId];
                if (!track) continue;
                if (!activeTrack && (hasSolo ? (!track.solo || track.muted) : track.muted)) continue;

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

                const rampDur = Math.min(0.015, playDur / 4);
                const clipGain = (typeof clip.gain === 'number' && Number.isFinite(clip.gain)) ? Math.max(0.0001, clip.gain) : 1.0;
                const trackGain = offlineCtx.createGain();

                // Apply Clip-Specific Fade In / Out Curves using exact fade shape algorithms
                scheduleClipFadeEnvelope(gain.gain, clip, playDur, offsetIntoClip, scheduleTimeInExport, clipGain);

                // Apply Track Volume & Keyframe Automation
                if (track.showAutomation && track.automationMode !== 'pan' && track.keyframes && track.keyframes.length > 0) {
                    const sorted = [...track.keyframes].sort((a, b) => a.time - b.time);
                    const initVal = evaluateKeyframeAtTime(sorted, overlapStart);
                    trackGain.gain.setValueAtTime(0.0001, scheduleTimeInExport);
                    trackGain.gain.linearRampToValueAtTime(Math.max(0.0001, initVal), scheduleTimeInExport + rampDur);
                    sorted.forEach(kf => {
                        if (kf.time > overlapStart && kf.time <= overlapEnd) {
                            const kfExportTime = kf.time - rangeStart;
                            trackGain.gain.linearRampToValueAtTime(Math.max(0.0001, kf.val), kfExportTime);
                        }
                    });
                } else {
                    const targetVol = Math.max(0.0001, track.vol || 1.0);
                    trackGain.gain.setValueAtTime(0.0001, scheduleTimeInExport);
                    trackGain.gain.linearRampToValueAtTime(targetVol, scheduleTimeInExport + rampDur);
                    if (playDur > rampDur * 2) {
                        trackGain.gain.setValueAtTime(targetVol, scheduleTimeInExport + playDur - rampDur);
                        trackGain.gain.linearRampToValueAtTime(0.0001, scheduleTimeInExport + playDur);
                    }
                }

                // Connect Track Stereo Panner (Offline Audio Panning with Pan Automation Support)
                const trackPanVal = (typeof track.pan === 'number' && Number.isFinite(track.pan)) ? Math.max(-1, Math.min(1, track.pan)) : 0;
                let pannerNode = null;
                if (typeof offlineCtx.createStereoPanner === 'function') {
                    try {
                        pannerNode = offlineCtx.createStereoPanner();
                        if (track.showAutomation && track.automationMode === 'pan' && track.panKeyframes && track.panKeyframes.length > 0) {
                            const sortedPan = [...track.panKeyframes].sort((a, b) => a.time - b.time);
                            const initPan = evaluateKeyframeAtTime(sortedPan, overlapStart);
                            pannerNode.pan.setValueAtTime(Math.max(-1, Math.min(1, initPan)), scheduleTimeInExport);
                            sortedPan.forEach(kf => {
                                if (kf.time > overlapStart && kf.time <= overlapEnd) {
                                    const kfExportTime = kf.time - rangeStart;
                                    pannerNode.pan.linearRampToValueAtTime(Math.max(-1, Math.min(1, kf.val)), kfExportTime);
                                }
                            });
                        } else {
                            pannerNode.pan.setValueAtTime(trackPanVal, scheduleTimeInExport);
                        }
                    } catch (e) {
                        pannerNode = null;
                    }
                }

                // Connect Full Offline DSP Signal Chain: src -> gain (clip fades) -> trackGain (track vol) -> fxChain -> pannerNode -> destination
                src.connect(gain);
                gain.connect(trackGain);
                let chainTail = trackGain;
                const fxChain = buildTrackPluginChain(offlineCtx, track);
                if (fxChain && fxChain.input && fxChain.output) {
                    trackGain.connect(fxChain.input);
                    chainTail = fxChain.output;
                }
                if (pannerNode) {
                    chainTail.connect(pannerNode);
                    pannerNode.connect(offlineCtx.destination);
                } else {
                    chainTail.connect(offlineCtx.destination);
                }
                src.start(scheduleTimeInExport, bufferReadOffset, playDur);
            }

            if (pBar) pBar.style.width = '60%';
            if (pPct) pPct.textContent = '60%';
            if (pTitle) pTitle.textContent = 'Rendering Audio Graph...';
            if (pSub) pSub.textContent = `Synthesizing ${Math.round(totalDur)}s multi-track mixdown`;

            const renderedBuf = await offlineCtx.startRendering();

            const currentLufs = measureAudioBufferLUFS(renderedBuf);
            if (pBar) pBar.style.width = '85%';
            if (pPct) pPct.textContent = '85%';
            if (pTitle) pTitle.textContent = 'EBU R128 Loudness Matcher & True-Peak Limiter...';
            if (pSub) pSub.textContent = (normMode !== 'off') ? `Targeting ${normMode.startsWith('lufs_') ? normMode.replace('lufs_', '-') + ' LUFS' : '-0.5 dBFS'} (Source: ${Number.isFinite(currentLufs) ? currentLufs + ' LUFS' : '-∞ LUFS'})` : 'Passing through un-normalized audio';

            // EBU R128 LUFS Loudness Matching (-14, -16, -23 LUFS) & Lookahead True-Peak Limiter
            const numChannels = renderedBuf.numberOfChannels;
            const masterScale = (daw._masterVol !== undefined) ? daw._masterVol : 1.0;
            let normGain = masterScale;

            if (normMode.startsWith('lufs_')) {
                const targetLufs = parseFloat(normMode.replace('lufs_', '')) * -1; // -14, -16, -23
                if (Number.isFinite(currentLufs) && currentLufs > -70) {
                    const deltaDb = targetLufs - currentLufs;
                    normGain = masterScale * Math.pow(10, deltaDb / 20);
                }
            } else if (normMode === 'peak' || normMode === 'on') {
                let maxPk = 0;
                for (let c = 0; c < numChannels; c++) {
                    const chData = renderedBuf.getChannelData(c);
                    for (let i = 0; i < chData.length; i++) {
                        const absV = Math.abs(chData[i]);
                        if (absV > maxPk) maxPk = absV;
                    }
                }
                const TARGET_CEILING = 0.944; // -0.5 dBFS
                if (maxPk * masterScale > TARGET_CEILING) {
                    normGain = TARGET_CEILING / maxPk;
                }
            }

            // Lookahead True-Peak Limiter Clamp (-1.0 dBTP / 0.891 linear ceiling)
            if (normMode !== 'off') {
                const TRUE_PEAK_CEILING = 0.891; // -1.0 dBTP safe broadcast ceiling
                let peakAfterGain = 0;
                for (let c = 0; c < numChannels; c++) {
                    const chData = renderedBuf.getChannelData(c);
                    for (let i = 0; i < chData.length; i++) {
                        const pk = Math.abs(chData[i] * normGain);
                        if (pk > peakAfterGain) peakAfterGain = pk;
                    }
                }
                if (peakAfterGain > TRUE_PEAK_CEILING) {
                    normGain *= (TRUE_PEAK_CEILING / peakAfterGain);
                }
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
                if (typeof renderTakeInventory === 'function') renderTakeInventory();
            }

            // Directly inject rendered master mixdown onto the timeline as a new track & clip
            if (shouldAddToTimeline) {
                const mixTrackId = `master_mix_${Date.now()}`;
                const mixClipId = `clip-mix-${Date.now()}`;
                const clipOffset = isPunchRange ? daw.punch.inTime : 0;

                daw.tracks[mixTrackId] = {
                    id: mixTrackId,
                    name: `${exportName} [Master]`,
                    type: 'audio',
                    vol: 1.0,
                    muted: false,
                    solo: false,
                    color: '#30d158',
                    showAutomation: false,
                    keyframes: [{ time: 0, val: 1.0 }],
                    plugins: defaultPluginState()
                };

                const masterClip = {
                    id: mixClipId,
                    trackId: mixTrackId,
                    name: exportName,
                    tag: 'Master Mix',
                    startOffset: clipOffset,
                    trimStart: 0,
                    trimEnd: totalDur,
                    duration: totalDur,
                    blob: wavBlob,
                    blobUrl: wavUrl,
                    buffer: renderedBuf,
                    peaks: extractWaveformPeaks(renderedBuf, 500),
                    color: '#30d158'
                };

                pushDawHistory('Add Rendered Master Mix to Timeline');
                daw.clips.push(masterClip);
                recalculateDawDuration();
                renderDawTracks();
                renderDawRuler();
                renderDawClips();
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
                const srTag = sampleRate >= 96000 ? '96k' : (sampleRate === 48000 ? '48k' : (sampleRate === 88200 ? '88k' : '44k'));
                a.download = `${safeFile}_${srTag}.wav`;
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
        let sampleRate = daw.sampleRate || 48000;
        if (formatSelect) {
            if (formatSelect.value === 'wav_480') sampleRate = 48000;
            else if (formatSelect.value === 'wav_441') sampleRate = 44100;
            else if (formatSelect.value === 'wav_960') sampleRate = 96000;
            else if (formatSelect.value === 'project') sampleRate = daw.sampleRate || 48000;
        }
        const normMode = normSelect ? normSelect.value : 'lufs_14';
        const enableNorm = (normMode !== 'off');
        const isPunchRange = rangeSelect && rangeSelect.value === 'punch' && daw.punch && daw.punch.isActive && typeof daw.punch.inTime === 'number' && typeof daw.punch.outTime === 'number';

        const rangeStart = isPunchRange ? daw.punch.inTime : 0;
        const rangeEnd = isPunchRange ? daw.punch.outTime : Math.max(1, daw.duration);
        const totalDur = Math.max(0.1, rangeEnd - rangeStart);
        const totalSamples = Math.ceil(totalDur * sampleRate);

        // Show Progress HUD in Export Modal
        setStudioStatus('Exporting Multi-Track Stems ZIP archive...', 'busy', true);
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
                    const clipGain = (typeof clip.gain === 'number' && Number.isFinite(clip.gain)) ? Math.max(0.0001, clip.gain) : 1.0;
                    const trackGain = stemCtx.createGain();

                    // Apply Clip-Specific Fade In / Out Curves using exact fade shape algorithms
                    scheduleClipFadeEnvelope(gain.gain, clip, playDur, offsetIntoClip, scheduleTimeInExport, clipGain);

                    // Apply Track Volume & Keyframe Automation
                    if (track.showAutomation && track.automationMode !== 'pan' && track.keyframes && track.keyframes.length > 0) {
                        const sorted = [...track.keyframes].sort((a, b) => a.time - b.time);
                        const initVal = evaluateKeyframeAtTime(sorted, overlapStart);
                        trackGain.gain.setValueAtTime(0.0001, scheduleTimeInExport);
                        trackGain.gain.linearRampToValueAtTime(Math.max(0.0001, initVal), scheduleTimeInExport + rampDur);
                        sorted.forEach(kf => {
                            if (kf.time > overlapStart && kf.time <= overlapEnd) {
                                const kfExportTime = kf.time - rangeStart;
                                trackGain.gain.linearRampToValueAtTime(Math.max(0.0001, kf.val), kfExportTime);
                            }
                        });
                    } else {
                        const targetVol = Math.max(0.0001, track.vol || 1.0);
                        trackGain.gain.setValueAtTime(0.0001, scheduleTimeInExport);
                        trackGain.gain.linearRampToValueAtTime(targetVol, scheduleTimeInExport + rampDur);
                        if (playDur > rampDur * 2) {
                            trackGain.gain.setValueAtTime(targetVol, scheduleTimeInExport + playDur - rampDur);
                            trackGain.gain.linearRampToValueAtTime(0.0001, scheduleTimeInExport + playDur);
                        }
                    }

                    // Connect Track Stereo Panner for Isolated Stem
                    const trackPanVal = (typeof track.pan === 'number' && Number.isFinite(track.pan)) ? Math.max(-1, Math.min(1, track.pan)) : 0;
                    let pannerNode = null;
                    if (typeof stemCtx.createStereoPanner === 'function') {
                        try {
                            pannerNode = stemCtx.createStereoPanner();
                            if (track.showAutomation && track.automationMode === 'pan' && track.panKeyframes && track.panKeyframes.length > 0) {
                                const sortedPan = [...track.panKeyframes].sort((a, b) => a.time - b.time);
                                const initPan = evaluateKeyframeAtTime(sortedPan, overlapStart);
                                pannerNode.pan.setValueAtTime(Math.max(-1, Math.min(1, initPan)), scheduleTimeInExport);
                                sortedPan.forEach(kf => {
                                    if (kf.time > overlapStart && kf.time <= overlapEnd) {
                                        const kfExportTime = kf.time - rangeStart;
                                        pannerNode.pan.linearRampToValueAtTime(Math.max(-1, Math.min(1, kf.val)), kfExportTime);
                                    }
                                });
                            } else {
                                pannerNode.pan.setValueAtTime(trackPanVal, scheduleTimeInExport);
                            }
                        } catch (e) {
                            pannerNode = null;
                        }
                    }

                    // Connect Isolated DSP Chain and Stereo Panner for Track
                    src.connect(gain);
                    gain.connect(trackGain);
                    let chainTail = trackGain;
                    const fxChain = buildTrackPluginChain(stemCtx, track);
                    if (fxChain && fxChain.input && fxChain.output) {
                        trackGain.connect(fxChain.input);
                        chainTail = fxChain.output;
                    }
                    if (pannerNode) {
                        chainTail.connect(pannerNode);
                        pannerNode.connect(stemCtx.destination);
                    } else {
                        chainTail.connect(stemCtx.destination);
                    }
                    src.start(scheduleTimeInExport, bufferReadOffset, playDur);
                }

                const renderedStemBuf = await stemCtx.startRendering();

                // Broadcast & LUFS Normalization on Isolated Stem
                if (enableNorm) {
                    const currentStemLufs = measureAudioBufferLUFS(renderedStemBuf);
                    let stemNormGain = 1.0;

                    if (normMode.startsWith('lufs_')) {
                        const targetLufs = parseFloat(normMode.replace('lufs_', '')) * -1;
                        if (Number.isFinite(currentStemLufs) && currentStemLufs > -70) {
                            const deltaDb = targetLufs - currentStemLufs;
                            stemNormGain = Math.pow(10, deltaDb / 20);
                        }
                    } else if (normMode === 'peak' || normMode === 'on') {
                        let stemPeak = 0;
                        for (let c = 0; c < renderedStemBuf.numberOfChannels; c++) {
                            const chData = renderedStemBuf.getChannelData(c);
                            for (let i = 0; i < chData.length; i++) {
                                const absVal = Math.abs(chData[i]);
                                if (absVal > stemPeak) stemPeak = absVal;
                            }
                        }
                        const TARGET_CEILING = 0.944; // -0.5 dBFS
                        if (stemPeak > TARGET_CEILING) {
                            stemNormGain = TARGET_CEILING / stemPeak;
                        }
                    }

                    // True-Peak Limiter on Stem (-1.0 dBTP ceiling)
                    const TRUE_PEAK_CEILING = 0.891;
                    let stemPeakAfter = 0;
                    for (let c = 0; c < renderedStemBuf.numberOfChannels; c++) {
                        const chData = renderedStemBuf.getChannelData(c);
                        for (let i = 0; i < chData.length; i++) {
                            const pk = Math.abs(chData[i] * stemNormGain);
                            if (pk > stemPeakAfter) stemPeakAfter = pk;
                        }
                    }
                    if (stemPeakAfter > TRUE_PEAK_CEILING) {
                        stemNormGain *= (TRUE_PEAK_CEILING / stemPeakAfter);
                    }

                    if (Math.abs(stemNormGain - 1.0) > 0.001) {
                        for (let c = 0; c < renderedStemBuf.numberOfChannels; c++) {
                            const chData = renderedStemBuf.getChannelData(c);
                            for (let i = 0; i < chData.length; i++) {
                                chData[i] = Math.max(-1.0, Math.min(1.0, chData[i] * stemNormGain));
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
            const srTag = sampleRate >= 96000 ? '96k' : (sampleRate === 48000 ? '48k' : (sampleRate === 88200 ? '88k' : '44k'));
            a.download = `${safeSessionName}_stems_${srTag}.zip`;
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
                btn.style.background = isFs ? 'rgba(10, 132, 255, 0.25)' : 'rgba(255, 255, 255, 0.08)';
                btn.style.borderColor = isFs ? '#0a84ff' : 'rgba(255, 255, 255, 0.16)';
                btn.style.color = isFs ? '#0a84ff' : '#ffffff';
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

        const isFresh = initialItem?.isFresh === true;

        const targetTitleEl = document.getElementById('timeline-target-title');
        if (targetTitleEl) {
            targetTitleEl.textContent = isFresh ? 'New Recording Session' : (initialItem?.title || initialItem?.name || 'Studio Multi-Track Master');
        }

        if (isFresh) {
            // Fresh DAW mode: Clean, blank timeline empty of tracks ready for immediate setup
            daw.playhead = 0;
            daw.duration = 60;
            daw._recordTrackId = Object.keys(daw.tracks)[0] || '__new__';
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
                color: '#ff9f0a'
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
                color: '#30d158'
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

        // Ensure tracks exist for any loaded clips
        daw.clips.forEach(clip => {
            if (!daw.tracks[clip.trackId]) {
                const def = defaultDawTracks[clip.trackId];
                if (def) {
                    daw.tracks[clip.trackId] = JSON.parse(JSON.stringify(def));
                } else {
                    daw.tracks[clip.trackId] = {
                        id: clip.trackId,
                        name: clip.name || 'Audio Track',
                        type: 'audio',
                        channels: 'stereo',
                        vol: 1.0,
                        pan: 0,
                        muted: false,
                        solo: false,
                        color: clip.color || '#0a84ff',
                        showAutomation: false,
                        keyframes: [{ time: 0, val: 1.0 }],
                        plugins: defaultPluginState()
                    };
                }
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
                const savedWaveColor = localStorage.getItem('localfilm_studio_waveform_color') || 'color';
                daw.waveformColorMode = savedWaveColor;
                modal.setAttribute('data-theme', savedTheme);
                modal.setAttribute('data-wave-color', savedWaveColor);

                const obsCheck = document.getElementById('daw-theme-obsidian-check');
                const monoCheck = document.getElementById('daw-theme-monochrome-check');
                const monoBwCheck = document.getElementById('daw-theme-monochrome-bw-check');
                const matCheck = document.getElementById('daw-theme-matrix-check');
                if (obsCheck) obsCheck.style.display = savedTheme === 'obsidian' ? 'inline' : 'none';
                if (monoCheck) monoCheck.style.display = (savedTheme === 'monochrome') ? 'inline' : 'none';
                if (monoBwCheck) monoBwCheck.style.display = (savedTheme === 'monochrome-bw') ? 'inline' : 'none';
                if (matCheck) matCheck.style.display = savedTheme === 'matrix' ? 'inline' : 'none';

                const colorCheck = document.getElementById('daw-menu-waveform-color-check');
                const waveMonoCheck = document.getElementById('daw-menu-waveform-mono-check');
                if (colorCheck) colorCheck.style.display = (savedWaveColor !== 'mono') ? 'inline' : 'none';
                if (waveMonoCheck) waveMonoCheck.style.display = (savedWaveColor === 'mono') ? 'inline' : 'none';

                const toolbarBtn = document.getElementById('timeline-wave-color-btn');
                const toolbarLbl = document.getElementById('timeline-wave-color-label');
                if (toolbarLbl) toolbarLbl.textContent = (savedWaveColor !== 'mono') ? 'WAVE: COLOR' : 'WAVE: MONO';
                if (toolbarBtn) {
                    if (savedWaveColor !== 'mono') {
                        toolbarBtn.style.color = '#0a84ff';
                        toolbarBtn.style.borderColor = 'rgba(10, 132, 255, 0.4)';
                        toolbarBtn.style.background = 'rgba(10, 132, 255, 0.12)';
                    } else {
                        toolbarBtn.style.color = 'rgba(255, 255, 255, 0.75)';
                        toolbarBtn.style.borderColor = 'rgba(255, 255, 255, 0.18)';
                        toolbarBtn.style.background = 'rgba(255, 255, 255, 0.06)';
                    }
                }
            } catch (e) {}
        }
    };

    const stopDawMicMonitor = async () => {
        if (daw._activeMicStream) {
            try { daw._activeMicStream.getTracks().forEach(t => t.stop()); } catch (e) {}
            daw._activeMicStream = null;
            daw._activeMicDeviceId = null;
        }
        if (daw._micMonitorStream) {
            try { daw._micMonitorStream.getTracks().forEach(t => t.stop()); } catch (e) {}
            daw._micMonitorStream = null;
        }
        if (daw._micSourceNode) {
            try { daw._micSourceNode.disconnect(); } catch (e) {}
            daw._micSourceNode = null;
            daw._micSourceStream = null;
        }
        daw._micMonitorAnalyser = null;
        daw._liveRecAnalyser = null;
        daw._micMonitorAnimRunning = false;
        const bar = document.getElementById('daw-rec-mic-level-bar');
        if (bar) bar.style.width = '0%';
    };

    // Bind Timeline DAW Buttons
    document.getElementById('timeline-open-studio-btn')?.addEventListener('click', () => {
        window.open('https://localfilm.online/podcasts', '_blank');
    });

        document.getElementById('timeline-top-import-btn')?.addEventListener('click', () => {
        if (typeof openImportHub === 'function') {
            openImportHub();
        } else {
            const hub = document.getElementById('daw-audio-import-hub-modal');
            if (hub) hub.style.display = 'flex';
            else document.getElementById('daw-menu-audio-file-input')?.click();
        }
    });

    document.getElementById('timeline-fresh-session-btn')?.addEventListener('click', () => {
        if (typeof openNewProjectModal === 'function') {
            openNewProjectModal();
        } else if (typeof window._openNewProjectModal === 'function') {
            window._openNewProjectModal();
        } else {
            const m = document.getElementById('daw-new-project-modal');
            if (m) m.style.display = 'flex';
        }
    });

    const exitToLocalFilm = () => {
        if (daw.isRecording) stopDawRecording();
        stopDawPlayback(true);
        stopDawMicMonitor();
        window.location.href = 'https://localfilm.online';
    };

    document.getElementById('podcast-editor-close-btn')?.addEventListener('click', exitToLocalFilm);
    document.getElementById('daw-menubar-close-btn')?.addEventListener('click', exitToLocalFilm);

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
                btn.style.background = 'rgba(10, 132, 255, 0.2)';
                btn.style.borderColor = '#0a84ff';
                btn.style.color = '#0a84ff';
                btn.style.boxShadow = '0 0 10px rgba(10, 132, 255, 0.4)';
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
    document.getElementById('timeline-tool-pointer-btn')?.addEventListener('click', () => setDawActiveTool('pointer'));
    document.getElementById('timeline-tool-blade-btn')?.addEventListener('click', () => setDawActiveTool('blade'));
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
        daw.zoom = Math.min(80, Math.max(0.05, daw.zoom * 1.3));
        const badge = document.getElementById('timeline-zoom-badge');
        if (badge) badge.textContent = `${Math.round(daw.zoom / 15 * 100)}%`;
        const zoomValEl = document.getElementById('daw-footer-zoom-val');
        if (zoomValEl) zoomValEl.textContent = `${Math.round(daw.zoom / 15 * 100)}%`;
        const zoomSlider = document.getElementById('daw-footer-zoom-slider');
        if (zoomSlider) zoomSlider.value = String(daw.zoom);
        renderDawTracks();
        renderDawRuler();
        renderDawClips();
        updateDawPlayhead();
    });

    document.getElementById('timeline-zoom-out-btn')?.addEventListener('click', () => {
        daw.zoom = Math.max(0.05, daw.zoom / 1.3);
        const badge = document.getElementById('timeline-zoom-badge');
        if (badge) badge.textContent = `${Math.round(daw.zoom / 15 * 100)}%`;
        const zoomValEl = document.getElementById('daw-footer-zoom-val');
        if (zoomValEl) zoomValEl.textContent = `${Math.round(daw.zoom / 15 * 100)}%`;
        const zoomSlider = document.getElementById('daw-footer-zoom-slider');
        if (zoomSlider) zoomSlider.value = String(daw.zoom);
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
                btn.style.background = 'rgba(48, 209, 88, 0.15)';
                btn.style.borderColor = 'rgba(48, 209, 88, 0.4)';
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
                btn.style.background = 'rgba(10, 132, 255, 0.15)';
                btn.style.borderColor = 'rgba(10, 132, 255, 0.35)';
                btn.style.color = '#0a84ff';
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
        showStudioToast(daw.isRippleEnabled ? 'Ripple Edit Mode: ON (Gaps close automatically)' : 'Ripple Edit Mode: OFF');
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
                btn.style.background = 'rgba(48, 209, 88, 0.2)';
                btn.style.borderColor = '#30d158';
                btn.style.color = '#34d399';
                btn.style.boxShadow = '0 0 10px rgba(48, 209, 88, 0.35)';
            } else {
                btn.style.background = 'rgba(255, 255, 255, 0.06)';
                btn.style.borderColor = 'rgba(255, 255, 255, 0.16)';
                btn.style.color = 'rgba(255, 255, 255, 0.7)';
                btn.style.boxShadow = 'none';
            }
        }
        showStudioToast(daw.isMetronomeEnabled ? `Metronome Click Track ON (${daw.bpm || 120} BPM)` : 'Metronome Click Track OFF');
    };
    document.getElementById('timeline-metronome-btn')?.addEventListener('click', toggleMetronomeDAW);

    // ── Film Sound Design, Video Sync & ADR Post-Production Suite Engine ──────
    // Timecode Format Switcher Button (SMPTE HH:MM:SS:FF vs Standard MM:SS.ms)
    document.getElementById('daw-timecode-mode-btn')?.addEventListener('click', () => {
        daw.timecodeMode = daw.timecodeMode === 'smpte' ? 'time' : 'smpte';
        const btn = document.getElementById('daw-timecode-mode-btn');
        if (btn) {
            btn.textContent = daw.timecodeMode === 'smpte' ? 'SMPTE' : 'TIME';
            btn.style.color = daw.timecodeMode === 'smpte' ? '#0a84ff' : '#34d399';
            btn.style.borderColor = daw.timecodeMode === 'smpte' ? 'rgba(10, 132, 255, 0.4)' : 'rgba(52, 211, 153, 0.4)';
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

        const colors = ['#ff9f0a', '#0a84ff', '#34d399', '#f43f5e', '#5e5ce6', '#ec4899'];
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
        showUndoToast(`Added Marker: "${newMarker.name}"`);
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
            toggleBtn.style.background = isHidden ? 'rgba(10, 132, 255, 0.25)' : 'rgba(10, 132, 255, 0.12)';
            toggleBtn.style.borderColor = isHidden ? '#0a84ff' : 'rgba(10, 132, 255, 0.35)';
        }
    };

    document.getElementById('timeline-video-toggle-btn')?.addEventListener('click', toggleVideoPreviewWindow);
    document.getElementById('daw-video-close-btn')?.addEventListener('click', () => {
        const win = document.getElementById('daw-video-preview-window');
        if (win) win.style.display = 'none';
        daw.video.isVisible = false;
        const toggleBtn = document.getElementById('timeline-video-toggle-btn');
        if (toggleBtn) {
            toggleBtn.style.background = 'rgba(10, 132, 255, 0.12)';
            toggleBtn.style.borderColor = 'rgba(10, 132, 255, 0.35)';
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
        const extractBtn = document.getElementById('daw-video-extract-audio-btn');
        if (extractBtn) extractBtn.style.display = 'inline-flex';
        showUndoToast(`Loaded Video: "${file.name}"`);
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

    // Make Video Window Resizable via corner handle
    const makeResizable = (containerEl, handleEl) => {
        if (!containerEl || !handleEl) return;
        let isResizing = false;
        let startX = 0, startWidth = 0;

        handleEl.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            isResizing = true;
            startX = e.clientX;
            startWidth = containerEl.offsetWidth;

            const onMouseMove = (moveEv) => {
                if (!isResizing) return;
                const dx = moveEv.clientX - startX;
                const newWidth = Math.max(260, Math.min(840, startWidth + dx));
                containerEl.style.width = `${newWidth}px`;
            };

            const onMouseUp = () => {
                isResizing = false;
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });
    };

    makeResizable(
        document.getElementById('daw-video-preview-window'),
        document.getElementById('daw-video-resize-handle')
    );

    // Frame Rate Cycle Button on Video HUD Badge (24, 25, 29.97, 30, 23.976 FPS)
    const cinemaFpsCycle = [24, 25, 29.97, 30, 23.976];
    document.getElementById('daw-video-fps-badge')?.addEventListener('click', () => {
        const cur = daw.fps || 24;
        const curIdx = cinemaFpsCycle.findIndex(f => Math.abs(f - cur) < 0.01);
        const nextIdx = (curIdx + 1) % cinemaFpsCycle.length;
        const nextFps = cinemaFpsCycle[nextIdx];
        daw.fps = nextFps;
        const badge = document.getElementById('daw-video-fps-badge');
        if (badge) badge.textContent = `${nextFps} FPS`;
        const selectEl = document.getElementById('daw-fps-select');
        if (selectEl) selectEl.value = String(nextFps);
        updateDawPlayhead();
        showStudioToast(`🎬 Set Frame Rate to ${nextFps} FPS (SMPTE Sync)`);
    });

    // Extract Audio from Video directly into a new Audio Track on Timeline
    const extractVideoAudioToTimeline = async () => {
        if (!daw.video || !daw.video.file) {
            await showStudioAlert('No Video Loaded', 'Please import an MP4 or WebM video file first.');
            return;
        }
        try {
            setStudioStatus('Decoding Video Audio Track...', 'busy', true);
            if (!daw.audioCtx) {
                daw.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (daw.audioCtx.state === 'suspended') await daw.audioCtx.resume();

            const arrayBuf = await daw.video.file.arrayBuffer();
            const decodedBuf = await daw.audioCtx.decodeAudioData(arrayBuf);

            const trackId = `track-video-audio-${Date.now()}`;
            const safeName = (daw.video.name || 'Video Audio').replace(/\.[^/.]+$/, '');
            pushDawHistory('Extract Video Audio to Track');

            daw.tracks[trackId] = {
                id: trackId,
                name: `🎬 ${safeName}`,
                type: 'audio',
                channels: decodedBuf.numberOfChannels > 1 ? 'stereo' : 'mono',
                vol: 1.0,
                pan: 0,
                muted: false,
                solo: false,
                color: '#0a84ff',
                showAutomation: false,
                keyframes: [{ time: 0, val: 1.0 }],
                plugins: defaultPluginState()
            };

            const clipId = `clip-video-${Date.now()}`;
            const clipDur = decodedBuf.duration;
            const newClip = {
                id: clipId,
                trackId: trackId,
                name: `${safeName} (Guide Audio)`,
                color: '#0a84ff',
                startOffset: 0,
                trimStart: 0,
                trimEnd: clipDur,
                duration: clipDur,
                buffer: decodedBuf,
                gain: 1.0,
                fadeIn: 0.005,
                fadeOut: 0.005
            };

            daw.clips.push(newClip);
            recomputeDawDuration();
            renderDawTracks();
            renderDawClips();
            setStudioStatus('Video Audio Extracted to Timeline!', 'ready');
            showStudioToast(`🎬 Extracted video guide audio into new audio track!`);
        } catch (err) {
            console.error('[Video Audio Extract error]', err);
            setStudioStatus('Failed to extract audio from video.', 'error');
            await showStudioAlert('Extract Failed', 'Could not extract audio from this video: ' + (err.message || 'Unsupported audio format'));
        }
    };

    document.getElementById('daw-video-extract-audio-btn')?.addEventListener('click', extractVideoAudioToTimeline);

    // ── Sovereign .localdaw Project Bundle Archive Engine (100% Offline Import / Export) ──
    const exportDawProjectBundle = async () => {
        try {
            setStudioStatus('Packaging .localdaw Project Bundle Archive...', 'busy', true);
            const projectName = daw.projectName || 'Studio_Project';
            const safeName = projectName.replace(/[^a-zA-Z0-9_\-]/g, '_');

            // 1. Serialize Project Metadata Manifest
            const projectManifest = {
                version: '1.0',
                name: projectName,
                exportedAt: new Date().toISOString(),
                bpm: daw.bpm || 120,
                fps: daw.fps || 24,
                zoom: daw.zoom || 50,
                duration: daw.duration || 60,
                masterVol: (daw._masterVol !== undefined) ? daw._masterVol : 1.0,
                timecodeMode: daw.timecodeMode || 'smpte',
                markers: (daw.markers || []).map(m => ({ ...m })),
                punch: { ...(daw.punch || {}) },
                tracks: {},
                clips: []
            };

            // Copy Tracks
            Object.entries(daw.tracks || {}).forEach(([tId, t]) => {
                projectManifest.tracks[tId] = {
                    id: t.id,
                    name: t.name,
                    type: t.type || 'audio',
                    channels: t.channels || 'stereo',
                    vol: t.vol !== undefined ? t.vol : 1.0,
                    pan: t.pan || 0,
                    muted: !!t.muted,
                    solo: !!t.solo,
                    color: t.color || '#34d399',
                    showAutomation: !!t.showAutomation,
                    automationMode: t.automationMode || 'vol',
                    keyframes: (t.keyframes || []).map(k => ({ ...k })),
                    panKeyframes: (t.panKeyframes || []).map(k => ({ ...k })),
                    plugins: JSON.parse(JSON.stringify(t.plugins || defaultPluginState()))
                };
            });

            const zipFiles = [];

            // Encode Audio Buffers to Lossless 16-bit PCM WAV
            for (let i = 0; i < daw.clips.length; i++) {
                const c = daw.clips[i];
                let audioFileName = `audio/clip_${i + 1}.wav`;

                let buf = c.buffer;
                if (!buf && c.blobUrl) {
                    try {
                        const resp = await fetch(c.blobUrl);
                        const ab = await resp.arrayBuffer();
                        if (!daw.audioCtx) daw.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                        buf = await daw.audioCtx.decodeAudioData(ab);
                    } catch (fetchErr) {
                        console.warn('[Bundle Export] Failed to fetch clip buffer:', c.name, fetchErr);
                    }
                }

                if (buf) {
                    const wavBlob = audioBufferToWav(buf);
                    const wavData = await wavBlob.arrayBuffer();
                    zipFiles.push({ name: audioFileName, data: wavData });
                }

                projectManifest.clips.push({
                    id: c.id,
                    trackId: c.trackId,
                    name: c.name,
                    color: c.color,
                    startOffset: c.startOffset,
                    trimStart: c.trimStart,
                    trimEnd: c.trimEnd,
                    duration: c.duration,
                    gain: c.gain !== undefined ? c.gain : 1.0,
                    fadeIn: c.fadeIn || 0,
                    fadeOut: c.fadeOut || 0,
                    fadeInCurve: c.fadeInCurve || 'linear',
                    fadeOutCurve: c.fadeOutCurve || 'linear',
                    audioFile: buf ? audioFileName : null
                });
            }

            const manifestJsonBytes = new TextEncoder().encode(JSON.stringify(projectManifest, null, 2));
            zipFiles.unshift({ name: 'project.json', data: manifestJsonBytes });

            const bundleZipBlob = createZipBlob(zipFiles);
            const bundleUrl = URL.createObjectURL(bundleZipBlob);

            const a = document.createElement('a');
            a.style.cssText = 'position: fixed; left: -9999px; top: -9999px; opacity: 0; pointer-events: none;';
            a.href = bundleUrl;
            a.download = `${safeName}.localdaw`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                try { document.body.removeChild(a); } catch (e) {}
                URL.revokeObjectURL(bundleUrl);
            }, 60000);

            setStudioStatus('Exported .localdaw Project Bundle Archive!', 'ready');
            showStudioToast(`📦 Exported Sovereign .localdaw Bundle (${zipFiles.length - 1} clips packaged)!`);
        } catch (bundleErr) {
            console.error('[Export Bundle error]', bundleErr);
            setStudioStatus('Bundle export failed.', 'error');
            await showStudioAlert('Export Bundle Failed', bundleErr.message || 'Could not package project bundle.');
        }
    };

    const importDawProjectBundle = async (file) => {
        if (!file) return;
        try {
            setStudioStatus('Opening & Unpacking .localdaw Project Bundle...', 'busy', true);
            const arrayBuf = await file.arrayBuffer();
            const archiveFiles = await parseZipArchive(arrayBuf);

            const manifestData = archiveFiles.get('project.json');
            if (!manifestData) {
                throw new Error('Corrupt project archive: missing project.json manifest.');
            }

            const manifestJson = JSON.parse(new TextDecoder().decode(manifestData));
            pushDawHistory('Open Project Bundle');

            if (!daw.audioCtx) {
                daw.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (daw.audioCtx.state === 'suspended') await daw.audioCtx.resume();

            // Restore Metadata & State
            daw.projectName = manifestJson.name || file.name.replace(/\.[^/.]+$/, '');
            daw.bpm = manifestJson.bpm || 120;
            daw.fps = manifestJson.fps || 24;
            daw.zoom = manifestJson.zoom || 50;
            daw._masterVol = (manifestJson.masterVol !== undefined) ? manifestJson.masterVol : 1.0;
            daw.timecodeMode = manifestJson.timecodeMode || 'smpte';
            daw.markers = Array.isArray(manifestJson.markers) ? manifestJson.markers : [];
            daw.punch = manifestJson.punch || { isActive: false };
            daw.tracks = manifestJson.tracks || {};
            daw.clips = [];

            // Decode Audio Clips
            for (const cManifest of (manifestJson.clips || [])) {
                let decodedBuffer = null;
                if (cManifest.audioFile && archiveFiles.has(cManifest.audioFile)) {
                    const rawAudioBytes = archiveFiles.get(cManifest.audioFile);
                    try {
                        decodedBuffer = await daw.audioCtx.decodeAudioData(rawAudioBytes.buffer.slice(rawAudioBytes.byteOffset, rawAudioBytes.byteOffset + rawAudioBytes.byteLength));
                    } catch (decErr) {
                        console.warn('[Bundle Import] Audio decode error for clip:', cManifest.name, decErr);
                    }
                }

                daw.clips.push({
                    id: cManifest.id || `clip-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    trackId: cManifest.trackId,
                    name: cManifest.name,
                    color: cManifest.color || '#0a84ff',
                    startOffset: cManifest.startOffset || 0,
                    trimStart: cManifest.trimStart || 0,
                    trimEnd: cManifest.trimEnd || (decodedBuffer ? decodedBuffer.duration : 1),
                    duration: cManifest.duration || (decodedBuffer ? decodedBuffer.duration : 1),
                    buffer: decodedBuffer,
                    gain: cManifest.gain !== undefined ? cManifest.gain : 1.0,
                    fadeIn: cManifest.fadeIn || 0,
                    fadeOut: cManifest.fadeOut || 0,
                    fadeInCurve: cManifest.fadeInCurve || 'linear',
                    fadeOutCurve: cManifest.fadeOutCurve || 'linear'
                });
            }

            // Sync UI inputs
            const bpmInput = document.getElementById('daw-bpm-input');
            if (bpmInput) bpmInput.value = daw.bpm;
            const fpsBadge = document.getElementById('daw-video-fps-badge');
            if (fpsBadge) fpsBadge.textContent = `${daw.fps} FPS`;
            const fpsSelect = document.getElementById('daw-fps-select');
            if (fpsSelect) fpsSelect.value = String(daw.fps);
            const masterSlider = document.getElementById('daw-master-vol-slider');
            if (masterSlider) masterSlider.value = daw._masterVol;

            recomputeDawDuration();
            renderDawTracks();
            renderDawClips();
            renderDawRuler();
            updateDawPlayhead();

            setStudioStatus('Project Bundle Restored Successfully!', 'ready');
            showStudioToast(`📂 Opened Project: "${daw.projectName}" (${daw.clips.length} clips restored)!`);
        } catch (importErr) {
            console.error('[Import Bundle error]', importErr);
            setStudioStatus('Failed to open project bundle.', 'error');
            await showStudioAlert('Import Bundle Failed', importErr.message || 'Could not parse .localdaw project bundle.');
        }
    };

    document.getElementById('timeline-save-bundle-btn')?.addEventListener('click', exportDawProjectBundle);
    document.getElementById('timeline-open-bundle-btn')?.addEventListener('click', () => {
        document.getElementById('daw-project-bundle-input')?.click();
    });
    document.getElementById('daw-project-bundle-input')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
            importDawProjectBundle(file);
            e.target.value = '';
        }
    });

    // ADR System HUD & Teleprompter Controls
    const toggleAdrBooth = () => {
        daw.adr.isActive = !daw.adr.isActive;
        const hud = document.getElementById('daw-adr-hud-container');
        const btn = document.getElementById('timeline-adr-toggle-btn');
        if (hud) {
            hud.style.display = daw.adr.isActive ? 'flex' : 'none';
        }
        if (btn) {
            btn.style.background = daw.adr.isActive ? 'rgba(94, 92, 230, 0.25)' : 'rgba(94, 92, 230, 0.12)';
            btn.style.borderColor = daw.adr.isActive ? '#c084fc' : 'rgba(94, 92, 230, 0.35)';
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

    // ==========================================
    // TRACK PROPERTIES & APPEARANCE CONTROLLER
    // ==========================================
    let _activeTrackPropId = null;
    let _activeTrackPropColor = '#0a84ff';

    function openTrackPropertiesModal(trackId) {
        const track = daw.tracks[trackId];
        if (!track) return;
        _activeTrackPropId = trackId;
        _activeTrackPropColor = track.color || '#0a84ff';

        const modal = document.getElementById('daw-track-properties-modal');
        const idInput = document.getElementById('daw-track-prop-track-id');
        const nameInput = document.getElementById('daw-track-prop-name');
        const typeSelect = document.getElementById('daw-track-prop-type');
        const chSelect = document.getElementById('daw-track-prop-channels');
        const customColorInput = document.getElementById('daw-track-prop-custom-color');

        if (idInput) idInput.value = trackId;
        if (nameInput) nameInput.value = track.name || '';
        if (typeSelect) typeSelect.value = track.type || 'audio';
        if (chSelect) chSelect.value = track.channels || 'mono';
        if (customColorInput) customColorInput.value = _activeTrackPropColor;

        updateTrackPropPreview();

        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => {
                nameInput?.focus();
                nameInput?.select();
            }, 60);
        }
    }

    function updateTrackPropPreview() {
        const nameInput = document.getElementById('daw-track-prop-name');
        const typeSelect = document.getElementById('daw-track-prop-type');
        const chSelect = document.getElementById('daw-track-prop-channels');
        const previewDot = document.getElementById('daw-track-prop-preview-dot');
        const previewName = document.getElementById('daw-track-prop-preview-name');
        const previewBadge = document.getElementById('daw-track-prop-preview-badge');

        const curName = nameInput?.value?.trim() || 'Track Name';
        const curType = typeSelect?.value || 'audio';
        const curCh = chSelect?.value || 'mono';

        if (previewDot) {
            previewDot.style.background = _activeTrackPropColor;
            previewDot.style.boxShadow = `0 0 12px ${_activeTrackPropColor}`;
        }
        if (previewName) {
            previewName.textContent = curName;
        }
        if (previewBadge) {
            previewBadge.textContent = `${curCh.toUpperCase()} • ${curType.toUpperCase()}`;
            previewBadge.style.color = _activeTrackPropColor;
            previewBadge.style.borderColor = _activeTrackPropColor + '55';
            previewBadge.style.background = _activeTrackPropColor + '18';
        }

        // Highlight active swatch in palette
        document.querySelectorAll('.daw-track-color-swatch').forEach(sw => {
            const c = sw.getAttribute('data-color') || '';
            if (c.toLowerCase() === _activeTrackPropColor.toLowerCase()) {
                sw.style.borderColor = '#ffffff';
                sw.style.transform = 'scale(1.15)';
                sw.style.boxShadow = `0 0 10px ${c}`;
            } else {
                sw.style.borderColor = 'transparent';
                sw.style.transform = 'scale(1)';
                sw.style.boxShadow = 'none';
            }
        });
    }

    function initTrackPropertiesModal() {
        const modal = document.getElementById('daw-track-properties-modal');
        const header = document.getElementById('daw-track-prop-header');
        const closeBtn = document.getElementById('daw-track-prop-close-btn');
        const cancelBtn = document.getElementById('daw-track-prop-cancel-btn');
        const deleteBtn = document.getElementById('daw-track-prop-delete-btn');
        const saveBtn = document.getElementById('daw-track-prop-save-btn');
        const nameInput = document.getElementById('daw-track-prop-name');
        const typeSelect = document.getElementById('daw-track-prop-type');
        const chSelect = document.getElementById('daw-track-prop-channels');
        const customColorInput = document.getElementById('daw-track-prop-custom-color');

        const closeModal = () => {
            if (modal) modal.style.display = 'none';
            _activeTrackPropId = null;
        };

        closeBtn?.addEventListener('click', closeModal);
        cancelBtn?.addEventListener('click', closeModal);

        deleteBtn?.addEventListener('click', () => {
            const trId = _activeTrackPropId;
            if (!trId || !daw.tracks[trId]) {
                closeModal();
                return;
            }
            closeModal();
            deleteTrackPrompt(trId);
        });

        nameInput?.addEventListener('input', updateTrackPropPreview);
        typeSelect?.addEventListener('change', updateTrackPropPreview);
        chSelect?.addEventListener('change', updateTrackPropPreview);

        customColorInput?.addEventListener('input', (e) => {
            _activeTrackPropColor = e.target.value;
            updateTrackPropPreview();
        });

        document.querySelectorAll('.daw-track-color-swatch').forEach(sw => {
            sw.addEventListener('click', () => {
                _activeTrackPropColor = sw.getAttribute('data-color');
                if (customColorInput) customColorInput.value = _activeTrackPropColor;
                updateTrackPropPreview();
            });
        });

        saveBtn?.addEventListener('click', () => {
            if (!_activeTrackPropId || !daw.tracks[_activeTrackPropId]) {
                closeModal();
                return;
            }
            const track = daw.tracks[_activeTrackPropId];
            const newName = nameInput?.value?.trim() || track.name;
            const newType = typeSelect?.value || track.type;
            const newCh = chSelect?.value || track.channels;
            const newColor = _activeTrackPropColor || track.color;

            pushDawHistory(`Update Track Properties (${newName})`);
            track.name = newName;
            track.color = newColor;
            track.type = newType;
            track.channels = newCh;

            if (daw.isPlaying) {
                updateTrackBusLive(_activeTrackPropId);
            }

            renderDawTracks();
            renderDawClips();
            renderDawRuler();
            autoSaveDawSession();
            showStudioToast(`Track "${track.name}" updated`);
            closeModal();
        });

        // Draggable floating header
        if (header && modal && !header._dragBound) {
            header._dragBound = true;
            header.addEventListener('mousedown', (e) => {
                if (e.button !== 0 || e.target.closest('button')) return;
                const startX = e.clientX;
                const startY = e.clientY;
                const rect = modal.getBoundingClientRect();
                const parent = modal.offsetParent || document.body;
                const parentRect = parent.getBoundingClientRect();
                const initLeft = rect.left - parentRect.left;
                const initTop = rect.top - parentRect.top;

                const onMove = (mv) => {
                    modal.style.left = `${Math.max(10, Math.min(window.innerWidth - rect.width - 10, initLeft + (mv.clientX - startX)))}px`;
                    modal.style.top = `${Math.max(10, Math.min(window.innerHeight - rect.height - 10, initTop + (mv.clientY - startY)))}px`;
                };
                const onUp = () => {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
            });
        }
    }

    // ==========================================
    // LOCAL PROJECTS & SESSION ENGINE (IndexedDB)
    // ==========================================
    const DAW_DB_NAME = 'LocalFilmDawDB';
    const DAW_DB_VERSION = 1;
    let _dawIndexedDb = null;
    let _dawAutoSaveDebounceTimer = null;

    function openDawDatabase() {
        return new Promise((resolve) => {
            if (_dawIndexedDb) return resolve(_dawIndexedDb);
            if (!window.indexedDB) {
                console.warn('[DAW Storage] IndexedDB not available in this environment');
                return resolve(null);
            }
            const req = indexedDB.open(DAW_DB_NAME, DAW_DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('session')) {
                    db.createObjectStore('session');
                }
                if (!db.objectStoreNames.contains('audio_blobs')) {
                    db.createObjectStore('audio_blobs');
                }
                if (!db.objectStoreNames.contains('saved_projects')) {
                    db.createObjectStore('saved_projects', { keyPath: 'id' });
                }
            };
            req.onsuccess = (e) => {
                _dawIndexedDb = e.target.result;
                resolve(_dawIndexedDb);
            };
            req.onerror = (e) => {
                console.error('[DAW Storage] Error opening IndexedDB:', e);
                resolve(null);
            };
        });
    }

    // Auto-save current active session (Retains state on browser refresh)
    function autoSaveDawSession() {
        clearTimeout(_dawAutoSaveDebounceTimer);
        _dawAutoSaveDebounceTimer = setTimeout(async () => {
            try {
                const db = await openDawDatabase();
                if (!db) return;

                const serializedClips = daw.clips.map(c => ({
                    id: c.id,
                    trackId: c.trackId,
                    name: c.name,
                    tag: c.tag,
                    startOffset: c.startOffset,
                    trimStart: c.trimStart,
                    trimEnd: c.trimEnd,
                    duration: c.duration,
                    color: c.color,
                    fadeIn: c.fadeIn,
                    fadeOut: c.fadeOut,
                    fadeInCurve: c.fadeInCurve,
                    fadeOutCurve: c.fadeOutCurve,
                    gain: c.gain,
                    peaks: c.peaks
                }));

                const sessionPayload = {
                    projectName: daw.projectName || 'Untitled Project',
                    tracks: daw.tracks,
                    clips: serializedClips,
                    duration: daw.duration,
                    zoom: daw.zoom,
                    laneHeight: daw.laneHeight,
                    waveScale: daw.waveScale,
                    waveformStyle: daw.waveformStyle,
                    waveformColorMode: daw.waveformColorMode,
                    playhead: daw.playhead,
                    sampleRate: daw.sampleRate,
                    bitDepth: daw.bitDepth,
                    fps: daw.fps,
                    snapMode: daw.snapMode,
                    snapGridSec: daw.snapGridSec,
                    updatedAt: Date.now()
                };

                const tx = db.transaction(['session', 'audio_blobs'], 'readwrite');
                const sessionStore = tx.objectStore('session');
                sessionStore.put(sessionPayload, 'active_session');

                const blobStore = tx.objectStore('audio_blobs');
                for (const clip of daw.clips) {
                    if (clip.buffer && typeof audioBufferToWav === 'function') {
                        const wavBlob = audioBufferToWav(clip.buffer);
                        blobStore.put(wavBlob, clip.id);
                    }
                }
            } catch (err) {
                console.warn('[DAW Storage] autoSaveDawSession notice:', err);
            }
        }, 700);
    }

    // Restore DAW session on startup / page refresh
    async function restoreDawSessionFromStorage() {
        try {
            const db = await openDawDatabase();
            if (!db) return false;

            const sessionPayload = await new Promise((resolve) => {
                const tx = db.transaction(['session'], 'readonly');
                const req = tx.objectStore('session').get('active_session');
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
            });

            if (!sessionPayload || !sessionPayload.tracks || Object.keys(sessionPayload.tracks).length === 0) {
                return false;
            }

            // Ensure AudioContext is ready for decoding
            if (!daw.audioCtx) {
                daw.audioCtx = new (window.AudioContext || window.webkitAudioContext)({
                    sampleRate: sessionPayload.sampleRate || 48000
                });
            }

            daw.tracks = sessionPayload.tracks;
            daw.projectName = sessionPayload.projectName || 'Untitled Project';
            if (typeof sessionPayload.duration === 'number') daw.duration = sessionPayload.duration;
            if (typeof sessionPayload.zoom === 'number') daw.zoom = sessionPayload.zoom;
            if (typeof sessionPayload.laneHeight === 'number') daw.laneHeight = sessionPayload.laneHeight;
            if (typeof sessionPayload.playhead === 'number') daw.playhead = sessionPayload.playhead;
            if (typeof sessionPayload.waveScale === 'number') daw.waveScale = sessionPayload.waveScale;
            if (sessionPayload.waveformStyle) daw.waveformStyle = sessionPayload.waveformStyle;
            if (sessionPayload.waveformColorMode) {
                daw.waveformColorMode = sessionPayload.waveformColorMode;
                try { localStorage.setItem('localfilm_studio_waveform_color', daw.waveformColorMode); } catch (e) {}
            }
            if (sessionPayload.sampleRate) daw.sampleRate = sessionPayload.sampleRate;
            if (sessionPayload.bitDepth) daw.bitDepth = sessionPayload.bitDepth;
            if (sessionPayload.fps) daw.fps = sessionPayload.fps;

            const rawClips = Array.isArray(sessionPayload.clips) ? sessionPayload.clips : [];
            const restoredClips = [];

            for (const clipMeta of rawClips) {
                let audioBuffer = null;
                try {
                    const wavBlob = await new Promise((resolve) => {
                        const tx = db.transaction(['audio_blobs'], 'readonly');
                        const req = tx.objectStore('audio_blobs').get(clipMeta.id);
                        req.onsuccess = () => resolve(req.result);
                        req.onerror = () => resolve(null);
                    });

                    if (wavBlob) {
                        const arrayBuffer = await wavBlob.arrayBuffer();
                        audioBuffer = await daw.audioCtx.decodeAudioData(arrayBuffer);
                    }
                } catch (decodeErr) {
                    console.warn('[DAW Storage] Clip buffer decode notice:', decodeErr);
                }

                restoredClips.push({
                    ...clipMeta,
                    buffer: audioBuffer,
                    peaks: audioBuffer ? extractWaveformPeaks(audioBuffer, 400) : (clipMeta.peaks || [])
                });
            }

            daw.clips = restoredClips;

            recalculateDawDuration();
            renderDawTracks();
            renderDawRuler();
            renderDawClips();
            updateDawPlayhead();
            updateDawFooter();

            if (daw.projectName) {
                const targetTitleEl = document.getElementById('timeline-target-title');
                if (targetTitleEl) targetTitleEl.textContent = daw.projectName;
            }

            const lastSavedDate = sessionPayload.updatedAt ? new Date(sessionPayload.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'recently';
            showStudioToast(`Session restored (Last saved at ${lastSavedDate} • ${daw.clips.length} clip(s), ${Object.keys(daw.tracks).length} tracks)`);
            return true;
        } catch (err) {
            console.error('[DAW Storage] Failed to restore session from IndexedDB:', err);
            return false;
        }
    }

    // Helper: Convert Blob to Base64
    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // Helper: Convert DataURL to ArrayBuffer
    function dataUrlToArrayBuffer(dataUrl) {
        const base64 = dataUrl.split(',')[1];
        const binaryStr = window.atob(base64);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }
        return bytes.buffer;
    }

    // Save project into IndexedDB "saved_projects" library
    async function saveCurrentProjectToLibrary(customName = null) {
        try {
            const db = await openDawDatabase();
            if (!db) {
                showStudioToast('Storage error: IndexedDB not available');
                return null;
            }

            const projName = customName || daw.projectName || 'Untitled Studio Project';
            const projId = `proj_${Date.now()}`;

            const serializedClips = daw.clips.map(c => ({
                id: c.id,
                trackId: c.trackId,
                name: c.name,
                tag: c.tag,
                startOffset: c.startOffset,
                trimStart: c.trimStart,
                trimEnd: c.trimEnd,
                duration: c.duration,
                color: c.color,
                fadeIn: c.fadeIn,
                fadeOut: c.fadeOut,
                fadeInCurve: c.fadeInCurve,
                fadeOutCurve: c.fadeOutCurve,
                gain: c.gain,
                peaks: c.peaks
            }));

            // Store audio buffers for clips
            const audioDataMap = {};
            for (const clip of daw.clips) {
                if (clip.buffer && typeof audioBufferToWav === 'function') {
                    const wavBlob = audioBufferToWav(clip.buffer);
                    audioDataMap[clip.id] = await blobToBase64(wavBlob);
                }
            }

            const projectRecord = {
                id: projId,
                name: projName,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                tracksCount: Object.keys(daw.tracks).length,
                clipsCount: daw.clips.length,
                duration: daw.duration,
                sampleRate: daw.sampleRate || 48000,
                bitDepth: daw.bitDepth || '24-bit',
                fps: daw.fps || 24,
                state: {
                    projectName: projName,
                    tracks: daw.tracks,
                    clips: serializedClips,
                    duration: daw.duration,
                    zoom: daw.zoom,
                    laneHeight: daw.laneHeight,
                    waveScale: daw.waveScale,
                    waveformStyle: daw.waveformStyle,
                    snapMode: daw.snapMode,
                    snapGridSec: daw.snapGridSec
                },
                audioData: audioDataMap
            };

            const tx = db.transaction(['saved_projects'], 'readwrite');
            tx.objectStore('saved_projects').put(projectRecord);

            showStudioToast(`Project "${projName}" saved to Local Machine Library`);
            autoSaveDawSession();
            return projectRecord;
        } catch (err) {
            console.error('[DAW Storage] Error saving project to library:', err);
            showStudioToast('Failed to save project locally');
            return null;
        }
    }

    // Export portable .localfilmdaw project file to disk
    async function saveDawProjectFile() {
        try {
            showStudioToast('Packaging project file (.localfilmdaw)...');
            const projName = daw.projectName || 'LocalFilm_Session';
            const safeName = projName.replace(/[^a-zA-Z0-9_-]/g, '_');
            const dateStr = new Date().toISOString().slice(0, 10);

            const audioDataMap = {};
            for (const clip of daw.clips) {
                if (clip.buffer && typeof audioBufferToWav === 'function') {
                    const wavBlob = audioBufferToWav(clip.buffer);
                    audioDataMap[clip.id] = await blobToBase64(wavBlob);
                }
            }

            const projectPackage = {
                format: 'localfilmdaw',
                version: '1.8.7',
                generator: 'LocalFilm Studio Multi-Track DAW',
                createdAt: Date.now(),
                name: projName,
                settings: {
                    sampleRate: daw.sampleRate || 48000,
                    bitDepth: daw.bitDepth || '24-bit',
                    fps: daw.fps || 24,
                    duration: daw.duration,
                    zoom: daw.zoom,
                    laneHeight: daw.laneHeight,
                    waveScale: daw.waveScale,
                    waveformStyle: daw.waveformStyle,
                    waveformColorMode: daw.waveformColorMode,
                    snapMode: daw.snapMode,
                    snapGridSec: daw.snapGridSec
                },
                tracks: daw.tracks,
                clips: daw.clips.map(c => ({
                    id: c.id,
                    trackId: c.trackId,
                    name: c.name,
                    tag: c.tag,
                    startOffset: c.startOffset,
                    trimStart: c.trimStart,
                    trimEnd: c.trimEnd,
                    duration: c.duration,
                    color: c.color,
                    fadeIn: c.fadeIn,
                    fadeOut: c.fadeOut,
                    fadeInCurve: c.fadeInCurve,
                    fadeOutCurve: c.fadeOutCurve,
                    gain: c.gain,
                    peaks: c.peaks
                })),
                audioBuffers: audioDataMap
            };

            const jsonStr = JSON.stringify(projectPackage, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `${safeName}_${dateStr}.localfilmdaw`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 1000);

            saveCurrentProjectToLibrary(projName);
            showStudioToast(`Downloaded "${safeName}_${dateStr}.localfilmdaw"`);
        } catch (err) {
            console.error('[DAW Storage] Failed to export .localfilmdaw file:', err);
            showStudioToast('Failed to export project file');
        }
    }

    // Open & Load .localfilmdaw project file from disk
    async function openDawProjectFile(file) {
        if (!file) return;
        try {
            showStudioToast(`Loading "${file.name}"...`);
            const text = await file.text();
            const projectData = JSON.parse(text);

            if (!projectData.tracks || !projectData.clips) {
                throw new Error('Invalid .localfilmdaw project file format');
            }

            if (!daw.audioCtx) {
                daw.audioCtx = new (window.AudioContext || window.webkitAudioContext)({
                    sampleRate: projectData.settings?.sampleRate || 48000
                });
            }

            // Stop any active playback
            if (daw.isPlaying) stopDawPlayback(true);

            // Restore tracks & settings
            daw.tracks = projectData.tracks;
            daw.projectName = projectData.name || file.name.replace(/\.[^/.]+$/, '');
            if (projectData.settings) {
                if (projectData.settings.sampleRate) daw.sampleRate = projectData.settings.sampleRate;
                if (projectData.settings.bitDepth) daw.bitDepth = projectData.settings.bitDepth;
                if (projectData.settings.fps) daw.fps = projectData.settings.fps;
                if (typeof projectData.settings.duration === 'number') daw.duration = projectData.settings.duration;
                if (typeof projectData.settings.zoom === 'number') daw.zoom = projectData.settings.zoom;
                if (typeof projectData.settings.laneHeight === 'number') daw.laneHeight = projectData.settings.laneHeight;
                if (projectData.settings.waveformStyle) daw.waveformStyle = projectData.settings.waveformStyle;
                if (projectData.settings.waveformColorMode) {
                    daw.waveformColorMode = projectData.settings.waveformColorMode;
                    try { localStorage.setItem('localfilm_studio_waveform_color', daw.waveformColorMode); } catch (e) {}
                }
            }

            // Decode audio buffers
            const restoredClips = [];
            const audioMap = projectData.audioBuffers || {};

            for (const clipMeta of projectData.clips) {
                let decodedBuffer = null;
                const base64Data = audioMap[clipMeta.id];
                if (base64Data) {
                    try {
                        const arrayBuf = dataUrlToArrayBuffer(base64Data);
                        decodedBuffer = await daw.audioCtx.decodeAudioData(arrayBuf);
                    } catch (decodeErr) {
                        console.warn('[DAW Storage] Decode error on clip:', clipMeta.name, decodeErr);
                    }
                }

                restoredClips.push({
                    ...clipMeta,
                    buffer: decodedBuffer,
                    peaks: decodedBuffer ? extractWaveformPeaks(decodedBuffer, 400) : (clipMeta.peaks || [])
                });
            }

            pushDawHistory(`Open Project (${daw.projectName})`);
            daw.clips = restoredClips;

            recalculateDawDuration();
            renderDawTracks();
            renderDawRuler();
            renderDawClips();
            updateDawPlayhead();
            updateDawFooter();
            fitTimelineToWindow();

            autoSaveDawSession();
            saveCurrentProjectToLibrary(daw.projectName);

            showStudioToast(`Loaded "${daw.projectName}" (${restoredClips.length} clips, ${Object.keys(daw.tracks).length} tracks)`);
        } catch (err) {
            console.error('[DAW Storage] Error loading project file:', err);
            showStudioToast(`Error opening project: ${err.message}`);
        }
    }

    // Recent Projects Modal Controller
    async function openRecentProjectsModal() {
        const modal = document.getElementById('daw-recent-projects-modal');
        const listContainer = document.getElementById('daw-recent-projects-list');
        if (!modal || !listContainer) return;

        modal.style.display = 'flex';
        listContainer.innerHTML = '<div style="text-align: center; padding: 20px 0; color: rgba(255,255,255,0.4); font-size: 11px;">Scanning local machine storage...</div>';

        try {
            const db = await openDawDatabase();
            if (!db) {
                listContainer.innerHTML = '<div style="text-align: center; padding: 20px 0; color: #f87171; font-size: 11px;">IndexedDB unavailable</div>';
                return;
            }

            const projects = await new Promise((resolve) => {
                const tx = db.transaction(['saved_projects'], 'readonly');
                const req = tx.objectStore('saved_projects').getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => resolve([]);
            });

            // Sort newest first
            projects.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));

            if (projects.length === 0) {
                listContainer.innerHTML = `
                    <div style="text-align: center; padding: 26px 14px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.12); border-radius: 8px;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.8" style="margin-bottom: 6px;" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                        <div style="font-size: 11.5px; font-weight: 700; color: #ffffff;">No Saved Projects Found</div>
                        <div style="font-size: 10px; color: rgba(255,255,255,0.45); margin-top: 3px;">Click "Save Current Session Now" above or press Ctrl+S to save your work.</div>
                    </div>
                `;
                return;
            }

            listContainer.innerHTML = projects.map(proj => {
                const dateStr = new Date(proj.updatedAt || proj.createdAt).toLocaleString(undefined, {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                });
                const durMin = Math.floor(proj.duration / 60);
                const durSec = Math.floor(proj.duration % 60);
                const durStr = `${durMin}:${durSec < 10 ? '0' : ''}${durSec}`;

                return `
                    <div class="daw-recent-project-row" data-proj-id="${proj.id}" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; gap: 10px; transition: all 0.15s ease;">
                        <div style="display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1;">
                            <span style="font-size: 12px; font-weight: 800; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${proj.name}</span>
                            <div style="display: flex; align-items: center; gap: 8px; font-size: 9px; color: rgba(255,255,255,0.5); font-family: monospace;">
                                <span style="color: #fbbf24;">${dateStr}</span>
                                <span>•</span>
                                <span>${proj.tracksCount || 0} Tracks</span>
                                <span>•</span>
                                <span>${proj.clipsCount || 0} Clips</span>
                                <span>•</span>
                                <span>${durStr}</span>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                            <button class="daw-recent-open-item-btn" data-proj-id="${proj.id}" style="background: rgba(10, 132, 255,0.15); border: 1px solid rgba(10, 132, 255,0.4); color: #0a84ff; font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 4px; cursor: pointer; transition: all 0.15s;">
                                Open
                            </button>
                            <button class="daw-recent-delete-item-btn" data-proj-id="${proj.id}" title="Delete from Local History" style="background: rgba(255, 69, 58,0.1); border: 1px solid rgba(255, 69, 58,0.25); color: #f87171; font-size: 11px; padding: 3px 6px; border-radius: 4px; cursor: pointer; line-height: 1;">
                                &times;
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            // Bind Row actions
            listContainer.querySelectorAll('.daw-recent-open-item-btn').forEach(btn => {
                btn.onclick = async (e) => {
                    const pId = e.currentTarget.getAttribute('data-proj-id');
                    const targetProj = projects.find(p => p.id === pId);
                    if (!targetProj || !targetProj.state) return;

                    if (!daw.audioCtx) {
                        daw.audioCtx = new (window.AudioContext || window.webkitAudioContext)({
                            sampleRate: targetProj.sampleRate || 48000
                        });
                    }

                    if (daw.isPlaying) stopDawPlayback(true);

                    daw.tracks = targetProj.state.tracks;
                    daw.projectName = targetProj.name;
                    if (typeof targetProj.state.duration === 'number') daw.duration = targetProj.state.duration;
                    if (typeof targetProj.state.zoom === 'number') daw.zoom = targetProj.state.zoom;
                    if (typeof targetProj.state.laneHeight === 'number') daw.laneHeight = targetProj.state.laneHeight;

                    const audioMap = targetProj.audioData || {};
                    const restoredClips = [];

                    for (const clipMeta of targetProj.state.clips) {
                        let decodedBuffer = null;
                        const base64Data = audioMap[clipMeta.id];
                        if (base64Data) {
                            try {
                                const arrayBuf = dataUrlToArrayBuffer(base64Data);
                                decodedBuffer = await daw.audioCtx.decodeAudioData(arrayBuf);
                            } catch (dErr) {
                                console.warn('[DAW Storage] Decode error on project open:', dErr);
                            }
                        }
                        restoredClips.push({
                            ...clipMeta,
                            buffer: decodedBuffer,
                            peaks: decodedBuffer ? extractWaveformPeaks(decodedBuffer, 400) : (clipMeta.peaks || [])
                        });
                    }

                    pushDawHistory(`Open Project (${daw.projectName})`);
                    daw.clips = restoredClips;

                    recalculateDawDuration();
                    renderDawTracks();
                    renderDawRuler();
                    renderDawClips();
                    updateDawPlayhead();
                    updateDawFooter();
                    fitTimelineToWindow();
                    autoSaveDawSession();

                    modal.style.display = 'none';
                    showStudioToast(`Loaded project "${targetProj.name}"`);
                };
            });

            listContainer.querySelectorAll('.daw-recent-delete-item-btn').forEach(btn => {
                btn.onclick = async (e) => {
                    e.stopPropagation();
                    const pId = e.currentTarget.getAttribute('data-proj-id');
                    const tx = db.transaction(['saved_projects'], 'readwrite');
                    tx.objectStore('saved_projects').delete(pId);
                    showStudioToast('Project deleted from local library');
                    openRecentProjectsModal();
                };
            });
        } catch (err) {
            console.error('[DAW Storage] Error listing recent projects:', err);
        }
    }

    function initRecentProjectsModal() {
        const modal = document.getElementById('daw-recent-projects-modal');
        const header = document.getElementById('daw-recent-modal-header');
        const closeBtn = document.getElementById('daw-recent-modal-close-btn');
        const saveCurrentBtn = document.getElementById('daw-recent-save-current-btn');
        const openFileBtn = document.getElementById('daw-recent-open-file-btn');
        const exportFileBtn = document.getElementById('daw-recent-export-file-btn');
        const fileInput = document.getElementById('daw-open-project-file-input');

        closeBtn?.addEventListener('click', () => {
            if (modal) modal.style.display = 'none';
        });

        saveCurrentBtn?.addEventListener('click', async () => {
            await saveCurrentProjectToLibrary();
            openRecentProjectsModal();
        });

        openFileBtn?.addEventListener('click', () => {
            fileInput?.click();
        });

        exportFileBtn?.addEventListener('click', () => {
            saveDawProjectFile();
        });

        fileInput?.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (file) {
                await openDawProjectFile(file);
                if (modal) modal.style.display = 'none';
                fileInput.value = '';
            }
        });

        // Draggable header
        if (header && modal && !header._dragBound) {
            header._dragBound = true;
            header.addEventListener('mousedown', (e) => {
                if (e.button !== 0 || e.target.closest('button')) return;
                const startX = e.clientX;
                const startY = e.clientY;
                const rect = modal.getBoundingClientRect();
                const parent = modal.offsetParent || document.body;
                const parentRect = parent.getBoundingClientRect();
                const initLeft = rect.left - parentRect.left;
                const initTop = rect.top - parentRect.top;

                const onMove = (mv) => {
                    modal.style.left = `${Math.max(10, Math.min(window.innerWidth - rect.width - 10, initLeft + (mv.clientX - startX)))}px`;
                    modal.style.top = `${Math.max(10, Math.min(window.innerHeight - rect.height - 10, initTop + (mv.clientY - startY)))}px`;
                };
                const onUp = () => {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
            });
        }
    }

    // Desktop Menu Bar Dropdowns & Actions Engine
    let _dawMenuBarInitialized = false;
    const setupDawMenuBar = () => {
        if (_dawMenuBarInitialized) return;
        _dawMenuBarInitialized = true;
        const menuBtns = document.querySelectorAll('.daw-menu-bar-btn');
        const dropdowns = document.querySelectorAll('.daw-menu-dropdown');

        const closeAllMenus = () => {
            dropdowns.forEach(d => {
                d.style.setProperty('display', 'none', 'important');
            });
            menuBtns.forEach(b => {
                b.style.background = 'none';
                b.style.color = 'rgba(255,255,255,0.78)';
            });
        };

        const openMenu = (btn) => {
            closeAllMenus();
            const menuName = btn.getAttribute('data-menu');
            const dd = document.getElementById(`daw-menu-dropdown-${menuName}`);
            if (!dd) return;

            // Make visible and set fixed coordinates relative to viewport
            dd.style.setProperty('display', 'block', 'important');
            dd.style.setProperty('position', 'fixed', 'important');
            dd.style.setProperty('z-index', '999999', 'important');

            const rect = btn.getBoundingClientRect();
            const top = rect.bottom + 2;
            dd.style.setProperty('top', `${top}px`, 'important');

            const ddWidth = dd.offsetWidth || 240;
            let left = rect.left;
            if (left + ddWidth > window.innerWidth - 8) {
                left = Math.max(8, window.innerWidth - ddWidth - 8);
            }
            dd.style.setProperty('left', `${left}px`, 'important');

            const maxHeight = Math.max(180, window.innerHeight - (top + 16));
            dd.style.setProperty('max-height', `${maxHeight}px`, 'important');
            dd.style.setProperty('overflow-y', 'auto', 'important');
            dd.style.setProperty('-webkit-overflow-scrolling', 'touch', 'important');

            btn.style.background = 'rgba(255,255,255,0.12)';
            btn.style.color = '#ffffff';
        };

        // Toggle dropdown on button click
        menuBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const menuName = btn.getAttribute('data-menu');
                const dd = document.getElementById(`daw-menu-dropdown-${menuName}`);
                const isOpen = dd && dd.style.display === 'block';

                if (isOpen) {
                    closeAllMenus();
                } else {
                    openMenu(btn);
                }
            });

            // Hover switching between open menus (like native desktop menus)
            btn.addEventListener('mouseenter', () => {
                const anyOpen = Array.from(dropdowns).some(d => d.style.display === 'block');
                if (anyOpen) {
                    openMenu(btn);
                }
            });
        });

        // Close menus when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#daw-desktop-menu-bar') && !e.target.closest('.daw-menu-dropdown')) {
                closeAllMenus();
            }
        });

        // Dismiss open menu immediately when menubar scrolls horizontally (crucial for compact/mobile view)
        const menuBar = document.getElementById('daw-desktop-menu-bar');
        if (menuBar) {
            menuBar.addEventListener('scroll', closeAllMenus, { passive: true });
        }
        window.addEventListener('resize', closeAllMenus, { passive: true });

        // ==========================================
        // 1. NEW RECORDING PROJECT & TRACKS SETUP MODAL
        // ==========================================
        const newProjectModal = document.getElementById('daw-new-project-modal');
        const newProjTitleInput = document.getElementById('daw-new-project-title-input');
        const newProjTemplateSelect = document.getElementById('daw-new-project-template-select');
        const newProjTracksList = document.getElementById('daw-new-project-tracks-list');
        const newProjAddRowBtn = document.getElementById('daw-new-project-add-row-btn');
        const newProjCloseBtn = document.getElementById('daw-new-project-close-btn');
        const newProjCancelBtn = document.getElementById('daw-new-project-cancel-btn');
        const newProjConfirmBtn = document.getElementById('daw-new-project-confirm-btn');

        const PROJECT_PALETTE = ['#0a84ff', '#30d158', '#5e5ce6', '#ff9f0a', '#40c8e0', '#eb758a', '#8e8e93', '#bf5af2'];

        const PROJECT_TEMPLATES = {
            podcast: [
                { name: 'Host Microphone', type: 'audio', channels: 'mono', color: '#0a84ff' },
                { name: 'Co-Host / Guest', type: 'audio', channels: 'mono', color: '#30d158' },
                { name: 'Sound FX / Stabs', type: 'music', channels: 'stereo', color: '#ff9f0a' },
                { name: 'Intro / Outro Music', type: 'music', channels: 'stereo', color: '#5e5ce6' },
                { name: 'Ambience / Room Bed', type: 'music', channels: 'stereo', color: '#40c8e0' }
            ],
            film_post: [
                { name: 'Dialogue Boom A', type: 'audio', channels: 'mono', color: '#0a84ff' },
                { name: 'Dialogue Lav B', type: 'audio', channels: 'mono', color: '#30d158' },
                { name: 'Foley & Production FX', type: 'audio', channels: 'stereo', color: '#ff9f0a' },
                { name: 'Sound Effects (SFX)', type: 'music', channels: 'stereo', color: '#eb758a' },
                { name: 'Background Atmos', type: 'music', channels: 'stereo', color: '#40c8e0' },
                { name: 'Cinematic Score Master', type: 'music', channels: 'stereo', color: '#5e5ce6' }
            ],
            voiceover: [
                { name: 'Voiceover Direct', type: 'audio', channels: 'mono', color: '#0a84ff' },
                { name: 'Scratch / Reference', type: 'audio', channels: 'mono', color: '#30d158' }
            ],
            music_band: [
                { name: 'Lead Vocals', type: 'audio', channels: 'mono', color: '#0a84ff' },
                { name: 'Backing Vocals', type: 'audio', channels: 'stereo', color: '#eb758a' },
                { name: 'Electric Guitar', type: 'audio', channels: 'stereo', color: '#ff9f0a' },
                { name: 'Acoustic Guitar', type: 'audio', channels: 'stereo', color: '#30d158' },
                { name: 'Bass Guitar', type: 'audio', channels: 'mono', color: '#5e5ce6' },
                { name: 'Drums Bus', type: 'music', channels: 'stereo', color: '#40c8e0' },
                { name: 'Keyboards / Synth', type: 'music', channels: 'stereo', color: '#bf5af2' },
                { name: 'Master FX Return', type: 'music', channels: 'stereo', color: '#8e8e93' }
            ],
            custom: [
                { name: 'Vocal 1', type: 'audio', channels: 'mono', color: '#0a84ff' },
                { name: 'Music 1', type: 'music', channels: 'stereo', color: '#ff9f0a' }
            ]
        };

        const renderNewProjectTrackRows = (rows) => {
            if (!newProjTracksList) return;
            newProjTracksList.innerHTML = '';
            rows.forEach((r, idx) => {
                const rowEl = document.createElement('div');
                rowEl.className = 'daw-new-proj-row';
                rowEl.style.display = 'grid';
                rowEl.style.gridTemplateColumns = '24px 1fr 100px 90px 32px 28px';
                rowEl.style.gap = '8px';
                rowEl.style.alignItems = 'center';
                rowEl.style.background = 'rgba(0,0,0,0.4)';
                rowEl.style.border = '1px solid rgba(255,255,255,0.08)';
                rowEl.style.borderRadius = '6px';
                rowEl.style.padding = '6px 8px';

                rowEl.innerHTML = `
                    <span style="font-size: 10px; font-weight: 800; color: rgba(255,255,255,0.4); text-align: center;">${idx + 1}</span>
                    <input type="text" class="new-proj-row-name" value="${escapeStudioHtml(r.name)}" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; padding: 4px 8px; color: #ffffff; font-size: 11.5px; font-weight: 700; outline: none;">
                    <select class="new-proj-row-type" style="background: #000; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; padding: 4px 6px; color: ${r.type === 'music' ? '#fbbf24' : '#34d399'}; font-size: 10.5px; font-weight: 700; outline: none; cursor: pointer;">
                        <option value="audio" ${r.type === 'audio' ? 'selected' : ''}>Audio</option>
                        <option value="music" ${r.type === 'music' ? 'selected' : ''}>Music</option>
                    </select>
                    <select class="new-proj-row-channel" style="background: #000; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; padding: 4px 6px; color: ${r.channels === 'stereo' ? '#0a84ff' : '#34d399'}; font-size: 10.5px; font-weight: 700; outline: none; cursor: pointer;">
                        <option value="mono" ${r.channels === 'mono' ? 'selected' : ''}>Mono</option>
                        <option value="stereo" ${r.channels === 'stereo' ? 'selected' : ''}>Stereo</option>
                    </select>
                    <input type="color" class="new-proj-row-color" value="${r.color || '#0a84ff'}" style="width: 28px; height: 26px; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; background: none; cursor: pointer; padding: 0;">
                    <button type="button" class="new-proj-row-delete-btn" title="Remove track" style="background: none; border: none; color: rgba(248,113,113,0.7); font-size: 14px; cursor: pointer; line-height: 1; padding: 2px;">&times;</button>
                `;

                rowEl.querySelector('.new-proj-row-delete-btn')?.addEventListener('click', () => {
                    if (newProjTracksList.children.length <= 1) {
                        showStudioToast('Project must have at least 1 track');
                        return;
                    }
                    rowEl.remove();
                    // Re-number
                    Array.from(newProjTracksList.children).forEach((child, i) => {
                        const numSpan = child.querySelector('span');
                        if (numSpan) numSpan.textContent = String(i + 1);
                    });
                });

                newProjTracksList.appendChild(rowEl);
            });
        };

        const openNewProjectModal = () => {
            window._openNewProjectModal = openNewProjectModal;
            if (!newProjectModal) return;
            const currentTitle = document.getElementById('timeline-target-title')?.textContent?.trim() || 'Film Soundtrack Master';
            if (newProjTitleInput) newProjTitleInput.value = currentTitle;
            if (newProjTemplateSelect) newProjTemplateSelect.value = 'podcast';
            renderNewProjectTrackRows(PROJECT_TEMPLATES.podcast);
            newProjectModal.style.display = 'flex';
        };

        const closeNewProjectModal = () => {
            if (newProjectModal) newProjectModal.style.display = 'none';
        };

        newProjCloseBtn?.addEventListener('click', closeNewProjectModal);
        newProjCancelBtn?.addEventListener('click', closeNewProjectModal);

        newProjTemplateSelect?.addEventListener('change', (e) => {
            const templateKey = e.target.value || 'podcast';
            const templateRows = PROJECT_TEMPLATES[templateKey] || PROJECT_TEMPLATES.podcast;
            renderNewProjectTrackRows(templateRows);
        });

        newProjAddRowBtn?.addEventListener('click', () => {
            if (!newProjTracksList) return;
            const count = newProjTracksList.children.length + 1;
            const paletteColor = PROJECT_PALETTE[(count - 1) % PROJECT_PALETTE.length];
            const newRowData = [{ name: `Track ${count}`, type: 'audio', channels: 'stereo', color: paletteColor }];
            renderNewProjectTrackRows([
                ...Array.from(newProjTracksList.querySelectorAll('.daw-new-proj-row')).map(row => ({
                    name: row.querySelector('.new-proj-row-name')?.value || 'Track',
                    type: row.querySelector('.new-proj-row-type')?.value || 'audio',
                    channels: row.querySelector('.new-proj-row-channel')?.value || 'stereo',
                    color: row.querySelector('.new-proj-row-color')?.value || '#0a84ff'
                })),
                ...newRowData
            ]);
        });

        newProjConfirmBtn?.addEventListener('click', () => {
            if (!newProjTracksList) return;
            const rowEls = newProjTracksList.querySelectorAll('.daw-new-proj-row');
            if (rowEls.length === 0) {
                showStudioToast('Please include at least 1 track in your project');
                return;
            }

            const projectTitle = newProjTitleInput?.value?.trim() || 'New Recording Project';
            const freshTracks = {};
            rowEls.forEach((row, idx) => {
                const name = row.querySelector('.new-proj-row-name')?.value?.trim() || `Track ${idx + 1}`;
                const type = row.querySelector('.new-proj-row-type')?.value || 'audio';
                const channels = row.querySelector('.new-proj-row-channel')?.value || 'stereo';
                const color = row.querySelector('.new-proj-row-color')?.value || PROJECT_PALETTE[idx % PROJECT_PALETTE.length];
                const trackId = `track_${Date.now()}_${idx}`;
                freshTracks[trackId] = {
                    id: trackId,
                    name: name,
                    type: type,
                    channels: channels,
                    vol: type === 'music' ? 0.8 : 1.0,
                    pan: 0,
                    muted: false,
                    solo: false,
                    color: color,
                    showAutomation: false,
                    keyframes: [{ time: 0, val: type === 'music' ? 0.8 : 1.0 }]
                };
            });

            const chosenSr = parseInt(document.getElementById('daw-new-project-samplerate')?.value || '48000', 10);
            const chosenBit = document.getElementById('daw-new-project-bitdepth')?.value || '24-bit';
            const chosenFps = parseFloat(document.getElementById('daw-new-project-fps')?.value || '25');

            pushDawHistory('Create New Project');
            daw.sampleRate = chosenSr;
            daw.bitDepth = chosenBit;
            daw.fps = chosenFps;
            daw.tracks = freshTracks;
            daw.clips = [];
            daw.playhead = 0;
            daw._recordTrackId = Object.keys(freshTracks)[0];

            // Update footer hardware deck
            const footerEngineText = document.getElementById('daw-footer-engine-text');
            if (footerEngineText) {
                footerEngineText.textContent = `${chosenSr / 1000} kHz • ${chosenBit}`;
            }

            daw.projectName = projectTitle;
            const targetTitleEl = document.getElementById('timeline-target-title');
            if (targetTitleEl) targetTitleEl.textContent = projectTitle;

            recalculateDawDuration();
            renderDawTracks();
            renderDawRuler();
            renderDawClips();
            updateDawPlayhead();
            fitTimelineToWindow();

            closeNewProjectModal();
            if (typeof autoSaveDawSession === 'function') {
                autoSaveDawSession();
            }
            showStudioToast(`Project "${projectTitle}" created @ ${chosenSr / 1000} kHz (${chosenBit}, ${chosenFps} fps) with ${Object.keys(freshTracks).length} tracks!`);
        });

        // Wire New Project Modal trigger to Menu -> File -> New and Timeline Fresh Session button
        document.getElementById('daw-menu-file-new')?.addEventListener('click', () => {
            closeAllMenus();
            openNewProjectModal();
        });

        // Wire Save Project to Library (IndexedDB)
        document.getElementById('daw-menu-file-save')?.addEventListener('click', () => {
            closeAllMenus();
            if (typeof saveCurrentProjectToLibrary === 'function') {
                saveCurrentProjectToLibrary();
            }
        });

        // Wire Save Project As (Prompt name, save to library & export file)
        document.getElementById('daw-menu-file-save-as')?.addEventListener('click', async () => {
            closeAllMenus();
            const currentName = daw.projectName || 'Untitled Project';
            const newName = prompt('Save Project As — Enter project name:', currentName);
            if (newName && newName.trim()) {
                daw.projectName = newName.trim();
                const targetTitleEl = document.getElementById('timeline-target-title');
                if (targetTitleEl) targetTitleEl.textContent = daw.projectName;
                if (typeof saveCurrentProjectToLibrary === 'function') {
                    await saveCurrentProjectToLibrary(daw.projectName);
                }
                if (typeof saveDawProjectFile === 'function') {
                    saveDawProjectFile();
                }
                if (typeof autoSaveDawSession === 'function') {
                    autoSaveDawSession();
                }
                showStudioToast(`Project saved as "${daw.projectName}"`);
            }
        });

        // Wire Open Project File (.localfilmdaw)
        document.getElementById('daw-menu-file-open')?.addEventListener('click', () => {
            closeAllMenus();
            document.getElementById('daw-open-project-file-input')?.click();
        });

        // Wire Recent Projects Library Modal
        document.getElementById('daw-menu-file-recent')?.addEventListener('click', () => {
            closeAllMenus();
            if (typeof openRecentProjectsModal === 'function') {
                openRecentProjectsModal();
            }
        });

        // ==========================================
        // 2. ADD MULTIPLE TRACKS MODAL
        // ==========================================
        const addTracksModal = document.getElementById('daw-add-tracks-modal');
        const addTracksCountSelect = document.getElementById('daw-add-tracks-count-select');
        const addTracksTypeSelect = document.getElementById('daw-add-tracks-type-select');
        const addTracksChannelSelect = document.getElementById('daw-add-tracks-channel-select');
        const addTracksRowsContainer = document.getElementById('daw-add-tracks-rows-container');
        const addTracksCloseBtn = document.getElementById('daw-add-tracks-close-btn');
        const addTracksCancelBtn = document.getElementById('daw-add-tracks-cancel-btn');
        const addTracksConfirmBtn = document.getElementById('daw-add-tracks-confirm-btn');

        const renderAddTracksRows = () => {
            if (!addTracksRowsContainer) return;
            const count = parseInt(addTracksCountSelect?.value || '4', 10);
            const defaultType = addTracksTypeSelect?.value || 'audio';
            const defaultChannel = addTracksChannelSelect?.value || 'stereo';
            const existingCount = Object.keys(daw.tracks).length;

            addTracksRowsContainer.innerHTML = '';
            for (let i = 0; i < count; i++) {
                const trackNum = existingCount + i + 1;
                const defaultName = defaultType === 'music' ? `Music Stem ${trackNum}` : `Audio Track ${trackNum}`;
                const color = PROJECT_PALETTE[(trackNum - 1) % PROJECT_PALETTE.length];

                const rowEl = document.createElement('div');
                rowEl.className = 'daw-add-track-batch-row';
                rowEl.style.display = 'grid';
                rowEl.style.gridTemplateColumns = '24px 1fr 100px 90px 32px';
                rowEl.style.gap = '8px';
                rowEl.style.alignItems = 'center';
                rowEl.style.background = 'rgba(0,0,0,0.35)';
                rowEl.style.border = '1px solid rgba(255,255,255,0.08)';
                rowEl.style.borderRadius = '6px';
                rowEl.style.padding = '6px 8px';

                rowEl.innerHTML = `
                    <span style="font-size: 10px; font-weight: 800; color: rgba(255,255,255,0.4); text-align: center;">${i + 1}</span>
                    <input type="text" class="add-track-row-name" value="${defaultName}" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; padding: 4px 8px; color: #ffffff; font-size: 11.5px; font-weight: 700; outline: none;">
                    <select class="add-track-row-type" style="background: #000; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; padding: 4px 6px; color: ${defaultType === 'music' ? '#fbbf24' : '#34d399'}; font-size: 10.5px; font-weight: 700; outline: none; cursor: pointer;">
                        <option value="audio" ${defaultType === 'audio' ? 'selected' : ''}>Audio</option>
                        <option value="music" ${defaultType === 'music' ? 'selected' : ''}>Music</option>
                    </select>
                    <select class="add-track-row-channel" style="background: #000; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; padding: 4px 6px; color: ${defaultChannel === 'stereo' ? '#0a84ff' : '#34d399'}; font-size: 10.5px; font-weight: 700; outline: none; cursor: pointer;">
                        <option value="mono" ${defaultChannel === 'mono' ? 'selected' : ''}>Mono</option>
                        <option value="stereo" ${defaultChannel === 'stereo' ? 'selected' : ''}>Stereo</option>
                    </select>
                    <input type="color" class="add-track-row-color" value="${color}" style="width: 28px; height: 26px; border: 1px solid rgba(255,255,225,0.2); border-radius: 4px; background: none; cursor: pointer; padding: 0;">
                `;
                addTracksRowsContainer.appendChild(rowEl);
            }
        };

        const openAddTracksModal = () => {
            window._openAddTracksModal = openAddTracksModal;
            if (!addTracksModal) return;
            renderAddTracksRows();
            addTracksModal.style.display = 'flex';
        };

        const closeAddTracksModal = () => {
            if (addTracksModal) addTracksModal.style.display = 'none';
        };

        addTracksCloseBtn?.addEventListener('click', closeAddTracksModal);
        addTracksCancelBtn?.addEventListener('click', closeAddTracksModal);
        addTracksCountSelect?.addEventListener('change', renderAddTracksRows);
        addTracksTypeSelect?.addEventListener('change', renderAddTracksRows);
        addTracksChannelSelect?.addEventListener('change', renderAddTracksRows);

        addTracksConfirmBtn?.addEventListener('click', () => {
            if (!addTracksRowsContainer) return;
            const rowEls = addTracksRowsContainer.querySelectorAll('.daw-add-track-batch-row');
            if (rowEls.length === 0) return;

            pushDawHistory(`Add ${rowEls.length} Tracks`);
            rowEls.forEach((row, idx) => {
                const name = row.querySelector('.add-track-row-name')?.value?.trim() || `New Track ${idx + 1}`;
                const type = row.querySelector('.add-track-row-type')?.value || 'audio';
                const channels = row.querySelector('.add-track-row-channel')?.value || 'stereo';
                const color = row.querySelector('.add-track-row-color')?.value || '#0a84ff';
                const trackId = `${type}_${Date.now()}_${idx}`;

                daw.tracks[trackId] = {
                    id: trackId,
                    name: name,
                    type: type,
                    channels: channels,
                    vol: type === 'music' ? 0.8 : 1.0,
                    pan: 0,
                    muted: false,
                    solo: false,
                    color: color,
                    showAutomation: false,
                    keyframes: [{ time: 0, val: type === 'music' ? 0.8 : 1.0 }]
                };
            });

            renderDawTracks();
            renderDawClips();
            renderDawRuler();
            closeAddTracksModal();
            showStudioToast(`Successfully added ${rowEls.length} tracks to timeline!`);
        });

        // Wire Add Multi-Track buttons
        document.getElementById('daw-add-multi-tracks-btn')?.addEventListener('click', openAddTracksModal);

        // ==========================================
        // 3. MULTI-FILE AUDIO INGESTION & AUDITIONING DECK
        // ==========================================
        const fileInput = document.getElementById('daw-menu-audio-file-input');
        document.getElementById('daw-menu-file-import')?.addEventListener('click', () => {
            closeAllMenus();
            if (typeof openImportHub === 'function') {
                openImportHub();
            } else {
                const hub = document.getElementById('daw-audio-import-hub-modal');
                if (hub) hub.style.display = 'flex';
                else document.getElementById('daw-menu-audio-file-input')?.click();
            }
        });

        const inspectModal = document.getElementById('daw-import-inspect-modal');
        let pendingFilesQueue = [];
        let activeFileIndex = 0;
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
                pBtn.style.background = 'rgba(10, 132, 255,0.18)';
                pBtn.style.borderColor = 'rgba(10, 132, 255,0.4)';
                pBtn.style.color = '#0a84ff';
            }
        };

        const closeInspectModal = () => {
            stopInspectAudition();
            if (inspectModal) inspectModal.style.display = 'none';
            // Close initial launcher modal and reveal full inspector deck
            if (typeof closeImportHub === 'function') closeImportHub();
            const hub = document.getElementById('daw-audio-import-hub-modal');
            if (hub) hub.style.display = 'none';

            pendingFilesQueue = [];
            activeFileIndex = 0;
        };

        document.getElementById('daw-import-inspect-close-btn')?.addEventListener('click', closeInspectModal);
        document.getElementById('daw-inspect-cancel-btn')?.addEventListener('click', closeInspectModal);

        const renderInspectorFileDetails = (item) => {
            if (!item) return;
            const { file, decoded, ext, mime, chCount, chDesc, chBadge, sr, srSub, sizeMB, bitDepthStr, codecDesc, peakDbfs, headroomLabel, peaks } = item;

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

            // Live Sample Rate Alignment & Auto-SRC Banner
            const projectSr = daw.sampleRate || 48000;
            const srcTitleEl = document.getElementById('daw-inspect-src-title');
            const srcSubEl = document.getElementById('daw-inspect-src-sub');
            const srcBannerEl = document.getElementById('daw-inspect-src-banner');
            const srcToggleEl = document.getElementById('daw-inspect-src-toggle');
            if (srcTitleEl && srcSubEl) {
                if (sr === projectSr) {
                    srcTitleEl.innerHTML = `Project Clock Match: ${projectSr.toLocaleString()} Hz <span style="color:#34d399;font-size:10px;font-weight:700;margin-left:4px;">● PERFECT ALIGNMENT</span>`;
                    srcSubEl.textContent = `File sample rate matches current project clock (${projectSr / 1000} kHz). Bit-perfect direct ingestion without resampling.`;
                    if (srcBannerEl) {
                        srcBannerEl.style.background = 'rgba(52, 211, 153, 0.08)';
                        srcBannerEl.style.borderColor = 'rgba(52, 211, 153, 0.3)';
                    }
                } else {
                    srcTitleEl.innerHTML = `Rate Mismatch: File is ${sr.toLocaleString()} Hz &rarr; Project is ${projectSr.toLocaleString()} Hz`;
                    srcSubEl.textContent = `Auto-SRC will resample using high-precision sinc interpolation to preserve pitch, tempo (1.0x), and phase alignment.`;
                    if (srcBannerEl) {
                        srcBannerEl.style.background = 'rgba(255, 159, 10, 0.09)';
                        srcBannerEl.style.borderColor = 'rgba(255, 159, 10, 0.35)';
                    }
                    if (srcToggleEl) srcToggleEl.checked = true;
                }
            }

            // Mini Waveform
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
                    bar.style.background = 'linear-gradient(180deg, #0a84ff 0%, #0071e3 100%)';
                    bar.style.borderRadius = '2px';
                    bar.style.opacity = '0.85';
                    wavePreviewEl.appendChild(bar);
                }
            }
        };

        const renderMultiFileTabs = () => {
            const tabsContainer = document.getElementById('daw-inspect-multi-tabs-container');
            const tabsStrip = document.getElementById('daw-inspect-tabs-strip');
            const filesCountEl = document.getElementById('daw-inspect-files-count');
            const confirmLabel = document.getElementById('daw-inspect-confirm-label');

            if (confirmLabel) {
                confirmLabel.textContent = pendingFilesQueue.length > 1
                    ? `Insert ${pendingFilesQueue.length} Files onto Timeline`
                    : 'Insert onto Timeline';
            }

            if (!tabsContainer || !tabsStrip) return;

            if (pendingFilesQueue.length <= 1) {
                tabsContainer.style.display = 'none';
                return;
            }

            tabsContainer.style.display = 'flex';
            if (filesCountEl) filesCountEl.textContent = String(pendingFilesQueue.length);
            tabsStrip.innerHTML = '';

            pendingFilesQueue.forEach((item, idx) => {
                const isActive = idx === activeFileIndex;
                const tab = document.createElement('button');
                tab.type = 'button';
                tab.style.background = isActive ? 'rgba(10, 132, 255, 0.25)' : 'rgba(255, 255, 255, 0.05)';
                tab.style.border = `1px solid ${isActive ? '#0a84ff' : 'rgba(255, 255, 255, 0.15)'}`;
                tab.style.color = isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.7)';
                tab.style.padding = '5px 10px';
                tab.style.borderRadius = '6px';
                tab.style.fontSize = '11px';
                tab.style.fontWeight = '700';
                tab.style.cursor = 'pointer';
                tab.style.whiteSpace = 'nowrap';
                tab.style.display = 'inline-flex';
                tab.style.alignItems = 'center';
                tab.style.gap = '6px';
                tab.style.transition = 'all 0.12s';

                tab.innerHTML = `
                    <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${isActive ? '#0a84ff' : '#34d399'};"></span>
                    <span style="max-width:140px;overflow:hidden;text-overflow:ellipsis;">${escapeStudioHtml(item.file.name)}</span>
                    <span style="font-size:9px;color:rgba(255,255,255,0.45);font-family:monospace;">${item.ext}</span>
                `;

                tab.addEventListener('click', () => {
                    stopInspectAudition();
                    activeFileIndex = idx;
                    renderMultiFileTabs();
                    renderInspectorFileDetails(pendingFilesQueue[activeFileIndex]);
                });

                tabsStrip.appendChild(tab);
            });
        };

        // Audition Play/Stop Toggle
        document.getElementById('daw-inspect-play-btn')?.addEventListener('click', () => {
            const currentItem = pendingFilesQueue[activeFileIndex];
            if (!currentItem || !currentItem.decoded) return;
            const pBtn = document.getElementById('daw-inspect-play-btn');

            if (inspectAuditionSource) {
                stopInspectAudition();
            } else {
                try {
                    const ctx = daw.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
                    if (ctx.state === 'suspended') ctx.resume();
                    const src = ctx.createBufferSource();
                    src.buffer = currentItem.decoded;
                    src.connect(ctx.destination);
                    src.onended = () => stopInspectAudition();
                    src.start(0);
                    inspectAuditionSource = src;
                    if (pBtn) {
                        pBtn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:4px;"><span style="display:inline-block;width:6px;height:6px;background:#ff453a;border-radius:50%;animation:pulse 1s infinite;"></span>■ Stop Audition</span>`;
                        pBtn.style.background = 'rgba(255, 69, 58, 0.2)';
                        pBtn.style.borderColor = 'rgba(255, 69, 58, 0.5)';
                        pBtn.style.color = '#f87171';
                    }
                } catch (err) {
                    showStudioToast('Could not audition audio preview: ' + err.message);
                }
            }
        });

        // Insert onto Timeline Confirmation Handler
        document.getElementById('daw-inspect-confirm-btn')?.addEventListener('click', async () => {
            if (pendingFilesQueue.length === 0) return;

            const targetTrackSelect = document.getElementById('daw-inspect-target-track');
            const placementSelect = document.getElementById('daw-inspect-placement-pos');
            const placement = placementSelect ? placementSelect.value : 'playhead';
            const shouldSrc = document.getElementById('daw-inspect-src-toggle')?.checked !== false;
            const projectSr = daw.sampleRate || 48000;

            const confirmBtn = document.getElementById('daw-inspect-confirm-btn');
            const originalBtnHtml = confirmBtn ? confirmBtn.innerHTML : '';
            if (confirmBtn) {
                confirmBtn.innerHTML = `<span>Ingesting &amp; Resampling...</span>`;
                confirmBtn.style.pointerEvents = 'none';
            }

            try {
                // High-Precision Sample Rate Conversion (Auto-SRC) check
                for (let i = 0; i < pendingFilesQueue.length; i++) {
                    const item = pendingFilesQueue[i];
                    if (shouldSrc && item.decoded && item.decoded.sampleRate !== projectSr) {
                        try {
                            const resampled = await resampleAudioBuffer(item.decoded, projectSr);
                            item.decoded = resampled;
                            item.peaks = extractWaveformPeaks(resampled, 400);
                        } catch (srcErr) {
                            console.warn('[Auto-SRC] Failed to resample', item.file.name, srcErr);
                        }
                    }
                }

                let baseOffset = 0;
                if (placement === 'playhead') {
                    baseOffset = daw.playhead || 0;
                } else if (placement === 'start') {
                    baseOffset = 0;
                } else if (placement === 'end') {
                    let maxEnd = 0;
                    for (const c of daw.clips) {
                        const ePos = (c.startOffset || 0) + Math.max(0, (c.trimEnd || c.duration || 0) - (c.trimStart || 0));
                        if (ePos > maxEnd) maxEnd = ePos;
                    }
                    baseOffset = maxEnd;
                }

                pushDawHistory(`Import ${pendingFilesQueue.length} Audio File(s)`);

                const isMultiFile = pendingFilesQueue.length > 1;
                const targetVal = targetTrackSelect?.value || 'separate_tracks';

                if (isMultiFile && targetVal === 'separate_tracks') {
                    // Option A: Multi-file to separate dedicated tracks
                    pendingFilesQueue.forEach((item, idx) => {
                        const cleanName = item.file.name.replace(/\.[^/.]+$/, '');
                        const newTrackId = `track_import_${Date.now()}_${idx}`;
                        daw.tracks[newTrackId] = {
                            id: newTrackId,
                            name: cleanName,
                            type: 'audio',
                            channels: item.chCount === 1 ? 'mono' : 'stereo',
                            vol: 1.0,
                            muted: false,
                            solo: false,
                            color: PROJECT_PALETTE[idx % PROJECT_PALETTE.length],
                            showAutomation: false,
                            keyframes: [{ time: 0, val: 1.0 }]
                        };

                        const newClip = {
                            id: `clip-import-${Date.now()}-${idx}`,
                            trackId: newTrackId,
                            name: cleanName,
                            tag: item.ext,
                            startOffset: baseOffset,
                            trimStart: 0,
                            trimEnd: item.decoded.duration,
                            duration: item.decoded.duration,
                            fadeIn: 0,
                            fadeOut: 0,
                            blob: item.file,
                            blobUrl: URL.createObjectURL(item.file),
                            buffer: item.decoded,
                            peaks: item.peaks,
                            color: PROJECT_PALETTE[idx % PROJECT_PALETTE.length]
                        };
                        daw.clips.push(newClip);
                    });
                } else {
                    let chosenTrack = (targetTrackSelect && targetTrackSelect.value && daw.tracks[targetTrackSelect.value])
                        ? targetTrackSelect.value
                        : (daw._recordTrackId && daw.tracks[daw._recordTrackId] ? daw._recordTrackId : Object.keys(daw.tracks)[0]);

                    if (!chosenTrack || !daw.tracks[chosenTrack]) {
                        chosenTrack = addNewEmptyTrack('audio');
                    }

                    let currentOffset = baseOffset;
                    pendingFilesQueue.forEach((item, idx) => {
                        const cleanName = item.file.name.replace(/\.[^/.]+$/, '');
                        const newClip = {
                            id: `clip-import-${Date.now()}-${idx}`,
                            trackId: chosenTrack,
                            name: cleanName,
                            tag: item.ext,
                            startOffset: currentOffset,
                            trimStart: 0,
                            trimEnd: item.decoded.duration,
                            duration: item.decoded.duration,
                            fadeIn: 0,
                            fadeOut: 0,
                            blob: item.file,
                            blobUrl: URL.createObjectURL(item.file),
                            buffer: item.decoded,
                            peaks: item.peaks,
                            color: PROJECT_PALETTE[idx % PROJECT_PALETTE.length]
                        };
                        daw.clips.push(newClip);
                        currentOffset += item.decoded.duration + 0.5; // Stagger sequential clips by half a second
                    });
                }

                recalculateDawDuration();
                renderDawTracks();
                renderDawRuler();
                renderDawClips();

                // Professional DAW Standard: Auto-Fit Timeline to Window upon loading new audio files
                fitTimelineToWindow();

                closeInspectModal();
                showUndoToast(`Imported ${pendingFilesQueue.length} file(s) onto timeline successfully`);
            } catch (err) {
                console.error('Error importing audio files:', err);
                showStudioToast('Import error: ' + err.message);
            } finally {
                if (confirmBtn) {
                    confirmBtn.innerHTML = originalBtnHtml;
                    confirmBtn.style.pointerEvents = 'auto';
                }
            }
        });


        const importHubModal = document.getElementById('daw-audio-import-hub-modal');
        const openImportHub = () => {
            if (importHubModal) {
                importHubModal.style.display = 'flex';
            } else {
                const fileInput = document.getElementById('daw-menu-audio-file-input');
                if (fileInput) fileInput.click();
            }
        };

        const closeImportHub = () => {
            if (importHubModal) importHubModal.style.display = 'none';
        };

        document.getElementById('daw-audio-import-hub-close-btn')?.addEventListener('click', closeImportHub);
        document.getElementById('daw-import-browse-files-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const fileInput = document.getElementById('daw-menu-audio-file-input');
            if (fileInput) fileInput.click();
        });
        document.getElementById('daw-import-dropzone')?.addEventListener('click', (e) => {
            if (e.target.id !== 'daw-import-browse-files-btn') {
                const fileInput = document.getElementById('daw-menu-audio-file-input');
                if (fileInput) fileInput.click();
            }
        });

        // Drop support on the modal dropzone
        const hubDropzone = document.getElementById('daw-import-dropzone');
        if (hubDropzone) {
            ['dragenter', 'dragover'].forEach(name => {
                hubDropzone.addEventListener(name, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    hubDropzone.style.borderColor = '#0a84ff';
                    hubDropzone.style.background = 'rgba(10, 132, 255, 0.1)';
                });
            });
            ['dragleave', 'drop'].forEach(name => {
                hubDropzone.addEventListener(name, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    hubDropzone.style.borderColor = 'rgba(10, 132, 255, 0.4)';
                    hubDropzone.style.background = 'rgba(10, 132, 255, 0.03)';
                });
            });
            hubDropzone.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                if (dt && dt.files && dt.files.length > 0) {
                    closeImportHub();
                    processAudioFilesForImport(dt.files);
                }
            });
        }

        // Explicit Audio Files Processor & Ingestion Inspector Engine
        const processAudioFilesForImport = async (filesList) => {
            const files = Array.from(filesList || []);
            if (files.length === 0) return;

            pendingFilesQueue = [];
            activeFileIndex = 0;

            showStudioToast(`Ingesting & analyzing ${files.length} audio file(s)...`);

            if (!daw.audioCtx) {
                daw.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (daw.audioCtx.state === 'suspended') {
                try { await daw.audioCtx.resume(); } catch (e) {}
            }
            const tempCtx = daw.audioCtx;

            for (let fIdx = 0; fIdx < files.length; fIdx++) {
                const file = files[fIdx];
                try {
                    const ab = await file.arrayBuffer();
                    let decoded = null;
                    try {
                        decoded = await tempCtx.decodeAudioData(ab.slice(0));
                    } catch (decodeErr) {
                        console.warn('[Audio Inspector] Web Audio decode fallback:', decodeErr);
                        decoded = tempCtx.createBuffer(2, Math.max(44100, Math.round(tempCtx.sampleRate * 5)), tempCtx.sampleRate);
                    }

                    // 1. Container / File Extension
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
                        const stride = Math.max(1, Math.floor(data.length / 20000));
                        for (let i = 0; i < data.length; i += stride) {
                            const abs = Math.abs(data[i]);
                            if (abs > maxSample) maxSample = abs;
                        }
                    }
                    const peakDbfs = maxSample > 0 ? (20 * Math.log10(maxSample)).toFixed(1) : '-inf';
                    let headroomLabel = 'Safe Headroom';
                    if (maxSample >= 0.999) {
                        headroomLabel = 'Near 0 dBFS Peak / Clip Risk';
                    } else if (maxSample >= 0.707) {
                        headroomLabel = 'Optimal Studio Headroom (-3 dBFS)';
                    } else if (maxSample < 0.2) {
                        headroomLabel = 'Quiet Level (Consider Gain / Norm)';
                    }

                    // 6. Generate mini waveform peaks
                    const peaks = extractWaveformPeaks(decoded, 400);

                    pendingFilesQueue.push({
                        file,
                        decoded,
                        ext,
                        mime,
                        chCount,
                        chDesc,
                        chBadge,
                        sr,
                        srSub,
                        sizeMB,
                        bitDepthStr,
                        codecDesc,
                        peakDbfs,
                        headroomLabel,
                        peaks
                    });
                } catch (err) {
                    console.error('File decode failed for', file.name, err);
                }
            }

            if (pendingFilesQueue.length === 0) {
                await showStudioAlert('Import Error', 'Could not decode any of the selected audio files.');
                return;
            }

            // Populate Track Selection Dropdown with "Separate Tracks" option if multiple files
            const trackSelect = document.getElementById('daw-inspect-target-track');
            if (trackSelect) {
                trackSelect.innerHTML = '';
                if (pendingFilesQueue.length > 1) {
                    const separateOpt = document.createElement('option');
                    separateOpt.value = 'separate_tracks';
                    separateOpt.textContent = '+ Separate New Track for Each File (Multi-Stem)';
                    separateOpt.selected = true;
                    trackSelect.appendChild(separateOpt);
                }
                const defaultTrack = (daw._targetImportTrackId && daw.tracks[daw._targetImportTrackId])
                    ? daw._targetImportTrackId
                    : (daw._recordTrackId && daw.tracks[daw._recordTrackId] ? daw._recordTrackId : (Object.keys(daw.tracks)[0] || 'host'));
                Object.keys(daw.tracks).forEach(tId => {
                    const t = daw.tracks[tId];
                    const opt = document.createElement('option');
                    opt.value = tId;
                    opt.textContent = `${t.name || tId} (${t.channels ? t.channels.toUpperCase() : 'STEREO'})`;
                    if ((pendingFilesQueue.length === 1 || daw._targetImportTrackId) && tId === defaultTrack) {
                        opt.selected = true;
                        if (pendingFilesQueue.length > 1) {
                            const sepOpt = trackSelect.querySelector('option[value="separate_tracks"]');
                            if (sepOpt) sepOpt.selected = false;
                        }
                    }
                    trackSelect.appendChild(opt);
                });
            }

            // Render Multi Tabs & Active File Details
            renderMultiFileTabs();
            renderInspectorFileDetails(pendingFilesQueue[0]);

            const modalEl = document.getElementById('daw-import-inspect-modal');
            if (modalEl) {
                modalEl.style.display = 'flex';
                modalEl.style.visibility = 'visible';
                modalEl.style.opacity = '1';
            }
        };

        window._openAudioInspectorModal = processAudioFilesForImport;

        // Ingest files when selected from input
        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                await processAudioFilesForImport(e.target.files);
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
            openExportMixdownModal('master');
        });

        document.getElementById('daw-menu-file-export-track')?.addEventListener('click', () => {
            closeAllMenus();
            if (!daw._activeFxTrackId || !daw.tracks[daw._activeFxTrackId]) {
                const firstTr = Object.keys(daw.tracks)[0];
                if (firstTr) daw._activeFxTrackId = firstTr;
            }
            if (!daw._activeFxTrackId || !daw.tracks[daw._activeFxTrackId]) {
                showStudioToast('Please select or create a track to export first');
                return;
            }
            openExportMixdownModal('selected');
        });

        document.getElementById('daw-menu-file-export-stems')?.addEventListener('click', () => {
            closeAllMenus();
            exportAllStemsZipDAW();
        });

        document.getElementById('daw-menu-file-close')?.addEventListener('click', () => {
            closeAllMenus();
            if (daw.isRecording) stopDawRecording();
            stopDawPlayback(true);
            window.location.href = 'https://localfilm.online';
        });

        // ==========================================
        // PROJECT SETTINGS & AUDIO CLOCK CONTROLLER
        // ==========================================
        const projectSettingsModal = document.getElementById('daw-project-settings-modal');
        const settingsNameInput = document.getElementById('daw-settings-project-name');
        const settingsClockReadout = document.getElementById('daw-settings-current-clock-readout');
        const settingsClipsCount = document.getElementById('daw-settings-clips-count');
        const settingsTracksCount = document.getElementById('daw-settings-tracks-count');
        const settingsSampleRateSelect = document.getElementById('daw-settings-sample-rate');
        const settingsBitDepthSelect = document.getElementById('daw-settings-bit-depth');
        const settingsFpsSelect = document.getElementById('daw-settings-fps');
        const settingsPanLawSelect = document.getElementById('daw-settings-pan-law');
        const settingsAdvisoryTitle = document.getElementById('daw-settings-advisory-title');
        const settingsAdvisoryBody = document.getElementById('daw-settings-advisory-body');
        const settingsAdvisoryBox = document.getElementById('daw-settings-advisory-box');
        const settingsSaveBtn = document.getElementById('daw-project-settings-save-btn');
        const settingsCloseBtn = document.getElementById('daw-project-settings-close-btn');
        const settingsCancelBtn = document.getElementById('daw-project-settings-cancel-btn');

        const updateSettingsAdvisoryText = (selectedRateVal) => {
            if (!settingsAdvisoryBody || !settingsAdvisoryTitle || !settingsAdvisoryBox) return;
            const currentSr = daw.sampleRate || 48000;
            const targetSr = parseInt(selectedRateVal, 10) || currentSr;
            const clipCount = daw.clips.length;

            if (targetSr === currentSr) {
                settingsAdvisoryTitle.textContent = 'HARDWARE CLOCK MATCH (NO RESAMPLING REQUIRED)';
                settingsAdvisoryTitle.style.color = '#34d399';
                settingsAdvisoryBox.style.background = 'rgba(52, 211, 153, 0.08)';
                settingsAdvisoryBox.style.borderColor = 'rgba(52, 211, 153, 0.35)';
                settingsAdvisoryBody.innerHTML = `Project is currently clocked at <strong>${currentSr.toLocaleString()} Hz</strong>. Selecting the same rate will maintain existing in-memory buffers bit-for-bit without DSP conversion or audio quality loss.`;
            } else if (targetSr > currentSr) {
                settingsAdvisoryTitle.textContent = 'UPSAMPLING (NYQUIST BANDWIDTH EXPANSION)';
                settingsAdvisoryTitle.style.color = '#0a84ff';
                settingsAdvisoryBox.style.background = 'rgba(10, 132, 255, 0.08)';
                settingsAdvisoryBox.style.borderColor = 'rgba(10, 132, 255, 0.35)';
                const nyqBefore = (currentSr / 2000).toFixed(1);
                const nyqAfter = (targetSr / 2000).toFixed(1);
                const ratio = (targetSr / currentSr).toFixed(2);
                settingsAdvisoryBody.innerHTML = `<strong>Upsampling: ${currentSr.toLocaleString()} Hz &rarr; ${targetSr.toLocaleString()} Hz (+${ratio}x samples)</strong><br>` +
                    `• Nyquist frequency cutoff expands from ${nyqBefore} kHz to ${nyqAfter} kHz.<br>` +
                    `• All ${clipCount} active audio buffer(s) will be resampled using polyphase sinc interpolation.<br>` +
                    `• Pitch and tempo remain exactly 1.0x neutral (no timing drift or speed variation).<br>` +
                    `• Note: Upsampling increases RAM footprint proportionally (~${ratio}x) without synthesizing harmonic detail absent in the original recording.`;
            } else {
                settingsAdvisoryTitle.textContent = 'DOWNSAMPLING (BAND-LIMITED DECIMATION & ANTI-ALIASING)';
                settingsAdvisoryTitle.style.color = '#fbbf24';
                settingsAdvisoryBox.style.background = 'rgba(255, 159, 10, 0.08)';
                settingsAdvisoryBox.style.borderColor = 'rgba(255, 159, 10, 0.35)';
                const nyqTarget = (targetSr / 2000).toFixed(1);
                settingsAdvisoryBody.innerHTML = `<strong>Downsampling: ${currentSr.toLocaleString()} Hz &rarr; ${targetSr.toLocaleString()} Hz</strong><br>` +
                    `• High-frequency content above ${nyqTarget} kHz (new Nyquist limit) will be steep-filtered to prevent inharmonic foldover aliasing distortion.<br>` +
                    `• All ${clipCount} active audio buffer(s) will be resampled via OfflineAudioContext band-limited decimation.<br>` +
                    `• Clip durations and playhead position remain 100% phase-aligned and timing-accurate.<br>` +
                    `• Recommended for standard CD / consumer distribution delivery targets.`;
            }
        };

        const openProjectSettingsModal = () => {
            if (!projectSettingsModal) return;
            const currentTitle = document.getElementById('timeline-target-title')?.textContent?.trim() || 'Current Session';
            if (settingsNameInput) settingsNameInput.value = currentTitle;
            if (settingsClockReadout) settingsClockReadout.textContent = `${(daw.sampleRate || 48000).toLocaleString()} Hz`;
            if (settingsClipsCount) settingsClipsCount.textContent = String(daw.clips.length);
            if (settingsTracksCount) settingsTracksCount.textContent = String(Object.keys(daw.tracks).length);
            if (settingsSampleRateSelect) settingsSampleRateSelect.value = String(daw.sampleRate || 48000);
            if (settingsBitDepthSelect) {
                const bitNum = parseInt(String(daw.bitDepth || '24'), 10) || 24;
                settingsBitDepthSelect.value = String(bitNum);
            }
            if (settingsFpsSelect) settingsFpsSelect.value = String(daw.fps || 24);
            if (settingsPanLawSelect) settingsPanLawSelect.value = daw.panLaw || 'equalpower';

            updateSettingsAdvisoryText(settingsSampleRateSelect?.value || '48000');
            projectSettingsModal.style.display = 'flex';
        };

        const closeProjectSettingsModal = () => {
            if (projectSettingsModal) projectSettingsModal.style.display = 'none';
        };

        window._openProjectSettingsModal = openProjectSettingsModal;

        document.getElementById('daw-menu-file-project-settings')?.addEventListener('click', () => {
            closeAllMenus();
            openProjectSettingsModal();
        });

        settingsCloseBtn?.addEventListener('click', closeProjectSettingsModal);
        settingsCancelBtn?.addEventListener('click', closeProjectSettingsModal);

        settingsSampleRateSelect?.addEventListener('change', (e) => {
            updateSettingsAdvisoryText(e.target.value);
        });

        settingsSaveBtn?.addEventListener('click', async () => {
            const newName = settingsNameInput?.value?.trim() || 'Current Session';
            const targetSr = parseInt(settingsSampleRateSelect?.value || '48000', 10);
            const targetBit = settingsBitDepthSelect?.value || '24';
            const targetFps = parseFloat(settingsFpsSelect?.value || '24');
            const targetPan = settingsPanLawSelect?.value || 'equalpower';
            const currentSr = daw.sampleRate || 48000;

            const originalBtnHtml = settingsSaveBtn.innerHTML;
            settingsSaveBtn.innerHTML = `<span>Resampling Buffers...</span>`;
            settingsSaveBtn.style.pointerEvents = 'none';

            try {
                if (targetSr !== currentSr && daw.clips.length > 0) {
                    showStudioToast(`Resampling ${daw.clips.length} clip(s) to ${targetSr.toLocaleString()} Hz via OfflineAudioContext...`);
                    pushDawHistory(`Change Sample Rate: ${currentSr}Hz &rarr; ${targetSr}Hz`);

                    for (let i = 0; i < daw.clips.length; i++) {
                        const clip = daw.clips[i];
                        if (clip.buffer) {
                            try {
                                const newBuf = await resampleAudioBuffer(clip.buffer, targetSr);
                                clip.buffer = newBuf;
                                clip.duration = newBuf.duration;
                                clip.peaks = extractWaveformPeaks(newBuf, 400);
                            } catch (err) {
                                console.warn('[Project Settings] Failed to resample clip', clip.name, err);
                            }
                        }
                    }
                }

                daw.sampleRate = targetSr;
                daw.bitDepth = `${targetBit}-bit`;
                daw.fps = targetFps;
                daw.panLaw = targetPan;

                // Update Title
                const targetTitleEl = document.getElementById('timeline-target-title');
                if (targetTitleEl) targetTitleEl.textContent = newName;

                // Update Footer Hardware Deck
                const footerEngineText = document.getElementById('daw-footer-engine-text');
                if (footerEngineText) {
                    footerEngineText.textContent = `${targetSr / 1000} kHz • ${targetBit}-bit`;
                }

                recalculateDawDuration();
                renderDawTracks();
                renderDawRuler();
                renderDawClips();
                updateDawPlayhead();

                closeProjectSettingsModal();
                showStudioToast(`Project clock updated: ${targetSr / 1000} kHz • ${targetBit}-bit (${targetFps} fps)`);
            } catch (err) {
                console.error('Failed to apply project settings:', err);
                showStudioToast('Settings error: ' + err.message);
            } finally {
                settingsSaveBtn.innerHTML = originalBtnHtml;
                settingsSaveBtn.style.pointerEvents = 'auto';
            }
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

        document.getElementById('daw-menu-edit-delete-track')?.addEventListener('click', () => {
            closeAllMenus();
            const trId = daw._activeFxTrackId || (daw.tracks && Object.keys(daw.tracks)[0]);
            if (trId && daw.tracks[trId]) {
                deleteTrackPrompt(trId);
            } else {
                showStudioToast('No track selected to delete');
            }
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
            if (typeof window._syncBottomDeckClipInspector === 'function') window._syncBottomDeckClipInspector();
            renderDawClips();
        });

        document.getElementById('daw-menu-edit-history')?.addEventListener('click', () => {
            closeAllMenus();
            openUndoHistoryTimelineModal();
        });

        document.getElementById('daw-menu-edit-combine')?.addEventListener('click', () => {
            closeAllMenus();
            combineSelectedClipsDAW();
        });

        // Edit Menu AudioSuite DSP Handlers
        document.getElementById('daw-menu-edit-normalize')?.addEventListener('click', () => {
            closeAllMenus();
            normalizeSelectedClip();
        });
        document.getElementById('daw-menu-edit-reverse')?.addEventListener('click', () => {
            closeAllMenus();
            reverseSelectedClip();
        });
        document.getElementById('daw-menu-edit-pitch-stretch')?.addEventListener('click', () => {
            closeAllMenus();
            openAudioSuitePitchModal();
        });

        // Tracks Menu Actions
        document.getElementById('daw-menu-tracks-add-batch')?.addEventListener('click', () => {
            closeAllMenus();
            document.getElementById('daw-add-multi-tracks-btn')?.click();
        });

        document.getElementById('daw-menu-tracks-delete')?.addEventListener('click', () => {
            closeAllMenus();
            const trId = daw._activeFxTrackId || (daw.tracks && Object.keys(daw.tracks)[0]);
            if (trId && daw.tracks[trId]) {
                deleteTrackPrompt(trId);
            } else {
                showStudioToast('No track selected to delete');
            }
        });

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
        document.getElementById('daw-menu-tracks-normalize')?.addEventListener('click', () => {
            closeAllMenus();
            const targetId = daw._activeFxTrackId || (daw.tracks && Object.keys(daw.tracks)[0]);
            normalizeTrackDAW(targetId);
        });

        document.getElementById('daw-menu-tracks-merge')?.addEventListener('click', () => {
            closeAllMenus();
            const targetId = daw._activeFxTrackId || (daw.tracks && Object.keys(daw.tracks)[0]);
            openMergeTracksModal(targetId);
        });

        // Waveform & Sound File Color Presentation Engine
        const updateWaveformColorUI = () => {
            const isColor = (daw.waveformColorMode !== 'mono');
            const colorCheck1 = document.getElementById('daw-menu-waveform-color-check');
            const monoCheck1 = document.getElementById('daw-menu-waveform-mono-check');
            const colorCheck2 = document.getElementById('daw-settings-waveform-color-check');
            const monoCheck2 = document.getElementById('daw-settings-waveform-mono-check');

            if (colorCheck1) colorCheck1.style.display = isColor ? 'inline' : 'none';
            if (colorCheck2) colorCheck2.style.display = isColor ? 'inline' : 'none';
            if (monoCheck1) monoCheck1.style.display = !isColor ? 'inline' : 'none';
            if (monoCheck2) monoCheck2.style.display = !isColor ? 'inline' : 'none';

            const toolbarBtn = document.getElementById('timeline-wave-color-btn');
            const toolbarLbl = document.getElementById('timeline-wave-color-label');
            if (toolbarLbl) {
                toolbarLbl.textContent = isColor ? 'WAVE: COLOR' : 'WAVE: MONO';
            }
            if (toolbarBtn) {
                if (isColor) {
                    toolbarBtn.style.color = '#0a84ff';
                    toolbarBtn.style.borderColor = 'rgba(10, 132, 255, 0.4)';
                    toolbarBtn.style.background = 'rgba(10, 132, 255, 0.12)';
                } else {
                    toolbarBtn.style.color = 'rgba(255, 255, 255, 0.75)';
                    toolbarBtn.style.borderColor = 'rgba(255, 255, 255, 0.18)';
                    toolbarBtn.style.background = 'rgba(255, 255, 255, 0.06)';
                }
            }
        };

        const toggleWaveformColorMode = (forceMode = null) => {
            if (forceMode) {
                daw.waveformColorMode = forceMode;
            } else {
                daw.waveformColorMode = (daw.waveformColorMode === 'mono') ? 'color' : 'mono';
            }
            try {
                localStorage.setItem('localfilm_studio_waveform_color', daw.waveformColorMode);
            } catch (e) {}

            const editorModal = document.getElementById('podcast-editor-modal');
            if (editorModal) {
                editorModal.setAttribute('data-wave-color', daw.waveformColorMode);
            }

            updateWaveformColorUI();
            renderDawClips();

            const isColor = (daw.waveformColorMode !== 'mono');
            showStudioToast(isColor ? 'Sound Files & Waveforms: Vivid Studio Colour' : 'Sound Files & Waveforms: Monochrome B&W');
        };

        // Theme Switcher Engine (Obsidian Dark, Cinema Monochrome with Color Waves, Cinema Pure B&W, Matrix Phosphor)
        const applyStudioTheme = (themeName, waveColorMode = null) => {
            if (waveColorMode) {
                daw.waveformColorMode = waveColorMode;
                try {
                    localStorage.setItem('localfilm_studio_waveform_color', waveColorMode);
                } catch (e) {}
            } else if (!daw.waveformColorMode) {
                daw.waveformColorMode = localStorage.getItem('localfilm_studio_waveform_color') || 'color';
            }

            const editorModal = document.getElementById('podcast-editor-modal');
            if (editorModal) {
                editorModal.setAttribute('data-theme', themeName);
                editorModal.setAttribute('data-wave-color', daw.waveformColorMode);
            }
            try {
                localStorage.setItem('localfilm_studio_theme', themeName);
            } catch (e) {}

            const obsCheck1 = document.getElementById('daw-theme-obsidian-check');
            const monoCheck1 = document.getElementById('daw-theme-monochrome-check');
            const monoBwCheck1 = document.getElementById('daw-theme-monochrome-bw-check');
            const matCheck1 = document.getElementById('daw-theme-matrix-check');

            const obsCheck2 = document.getElementById('daw-settings-theme-obsidian-check');
            const monoCheck2 = document.getElementById('daw-settings-theme-monochrome-check');
            const monoBwCheck2 = document.getElementById('daw-settings-theme-monochrome-bw-check');
            const matCheck2 = document.getElementById('daw-settings-theme-matrix-check');

            if (obsCheck1) obsCheck1.style.display = themeName === 'obsidian' ? 'inline' : 'none';
            if (obsCheck2) obsCheck2.style.display = themeName === 'obsidian' ? 'inline' : 'none';
            if (monoCheck1) monoCheck1.style.display = (themeName === 'monochrome') ? 'inline' : 'none';
            if (monoCheck2) monoCheck2.style.display = (themeName === 'monochrome') ? 'inline' : 'none';
            if (monoBwCheck1) monoBwCheck1.style.display = (themeName === 'monochrome-bw') ? 'inline' : 'none';
            if (monoBwCheck2) monoBwCheck2.style.display = (themeName === 'monochrome-bw') ? 'inline' : 'none';
            if (matCheck1) matCheck1.style.display = themeName === 'matrix' ? 'inline' : 'none';
            if (matCheck2) matCheck2.style.display = themeName === 'matrix' ? 'inline' : 'none';

            updateWaveformColorUI();
            renderDawClips();

            let themeLabel = 'Obsidian Dark';
            if (themeName === 'matrix') themeLabel = 'Matrix Green';
            else if (themeName === 'monochrome-bw') themeLabel = 'Cinema Pure B&W (Full Monochrome)';
            else if (themeName === 'monochrome') themeLabel = 'Cinema Monochrome (Color Sound Waves)';
            showStudioToast(`Theme set to ${themeLabel}`);
        };

        // Standalone Master VU Meter Window Toggle & Docking Engine
        const toggleMasterVuWindow = () => {
            const vuWin = document.getElementById('daw-studio-vu-window');
            if (!vuWin) return;
            const isHidden = vuWin.style.display === 'none' || !vuWin.style.display;
            vuWin.style.display = isHidden ? 'flex' : 'none';
            showStudioToast(isHidden ? 'Master VU Meter Shown' : 'Master VU Meter Hidden');
        };

        const toggleMasterVuDock = () => {
            const vuWin = document.getElementById('daw-studio-vu-window');
            const dockBtn = document.getElementById('daw-vu-dock-toggle-btn');
            const menuCheck = document.getElementById('daw-menu-view-vu-dock-check');
            if (!vuWin) return;
            const isCurrentlyDocked = vuWin.classList.contains('is-docked');
            if (isCurrentlyDocked) {
                vuWin.classList.remove('is-docked');
                vuWin.style.position = 'absolute';
                vuWin.style.top = '80px';
                vuWin.style.right = '28px';
                vuWin.style.left = 'auto';
                vuWin.style.bottom = 'auto';
                vuWin.style.width = '94px';
                vuWin.style.minWidth = '94px';
                vuWin.style.height = '340px';
                vuWin.style.minHeight = '200px';
                vuWin.style.borderRadius = '10px';
                vuWin.style.border = '1px solid rgba(10, 132, 255, 0.35)';
                vuWin.style.boxShadow = '0 16px 36px rgba(0,0,0,0.85), 0 0 20px rgba(10, 132, 255, 0.15)';
                if (dockBtn) {
                    dockBtn.textContent = 'DOCK';
                    dockBtn.style.background = 'rgba(255,255,255,0.08)';
                    dockBtn.style.color = '#ffffff';
                }
                if (menuCheck) menuCheck.style.display = 'none';
                showStudioToast('Master VU Meter: Floating Mode (Drag header to reposition)');
            } else {
                vuWin.classList.add('is-docked');
                vuWin.style.position = '';
                vuWin.style.left = '';
                vuWin.style.top = '';
                vuWin.style.right = '';
                vuWin.style.bottom = '';
                vuWin.style.width = '';
                vuWin.style.height = '';
                vuWin.style.borderRadius = '';
                vuWin.style.border = '';
                vuWin.style.boxShadow = '';
                if (dockBtn) {
                    dockBtn.textContent = 'FLOAT';
                    dockBtn.style.background = 'rgba(10, 132, 255, 0.2)';
                    dockBtn.style.color = '#0a84ff';
                }
                if (menuCheck) menuCheck.style.display = 'inline';
                showStudioToast('Master VU Meter: Docked to Right Rail');
            }
        };

        // Reset UI & Window Layout to Standard Defaults
        const resetDawUiLayout = () => {
            // Reset sidebar to default 240px
            const sidebar = document.getElementById('daw-track-headers-sidebar');
            const expandTab = document.getElementById('daw-sidebar-expand-tab');
            const toggleChevron = document.getElementById('daw-sidebar-toggle-chevron');
            if (sidebar) {
                sidebar.classList.remove('daw-track-sidebar-collapsed');
                sidebar.style.width = '240px';
                _lastSidebarWidth = 240;
            }
            if (expandTab) expandTab.style.display = 'none';
            if (toggleChevron) toggleChevron.style.transform = 'rotate(0deg)';

            // Reset track height to standard 74px
            daw.laneHeight = 74;
            const heightLbl = document.getElementById('timeline-track-height-label');
            if (heightLbl) heightLbl.textContent = '74px';

            // Reset zoom to default 20
            daw.zoom = 20;
            const zoomBadge = document.getElementById('timeline-zoom-badge');
            if (zoomBadge) zoomBadge.textContent = '100%';

            // Reset VU meter to docked and visible
            const vuWin = document.getElementById('daw-studio-vu-window');
            if (vuWin) {
                vuWin.style.display = 'flex';
                if (!vuWin.classList.contains('is-docked')) {
                    toggleMasterVuDock();
                }
            }

            // Reset layout mode to standard
            applyLayoutMode('standard');

            renderDawTracks();
            renderDawRuler();
            renderDawClips();
            showStudioToast('DAW UI layout reset to standard studio defaults (Alt+R)');
        };

        // Draggable floating VU meter window (Global Smooth Drag with Screen Clamp)
        const initFloatingVuDraggable = () => {
            const vuWin = document.getElementById('daw-studio-vu-window');
            const vuHeader = document.getElementById('daw-studio-vu-header');
            if (!vuWin || !vuHeader || vuHeader._dragBound) return;
            vuHeader._dragBound = true;

            vuHeader.addEventListener('mousedown', (e) => {
                if (vuWin.classList.contains('is-docked')) return;
                if (e.button !== 0 || e.target.closest('button')) return;
                e.preventDefault();

                const startClientX = e.clientX;
                const startClientY = e.clientY;
                const rect = vuWin.getBoundingClientRect();

                vuWin.style.right = 'auto';
                vuWin.style.bottom = 'auto';
                vuWin.style.left = `${rect.left}px`;
                vuWin.style.top = `${rect.top}px`;
                vuWin.style.zIndex = '9999';

                const onMove = (moveEv) => {
                    const dx = moveEv.clientX - startClientX;
                    const dy = moveEv.clientY - startClientY;
                    const maxLeft = Math.max(10, window.innerWidth - vuWin.offsetWidth - 10);
                    const maxTop = Math.max(38, window.innerHeight - vuWin.offsetHeight - 42);
                    const newLeft = Math.max(10, Math.min(maxLeft, rect.left + dx));
                    const newTop = Math.max(38, Math.min(maxTop, rect.top + dy));
                    vuWin.style.left = `${newLeft}px`;
                    vuWin.style.top = `${newTop}px`;
                };

                const onUp = () => {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                    vuWin.style.zIndex = '120';
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

        // Master VU Loudness Target Selector Engine (v1.8.14)
        const updateVuTargetDisplay = () => {
            const btn = document.getElementById('daw-vu-target-toggle-btn');
            const targetLine = document.getElementById('daw-vu-target-line');
            const complianceBadge = document.getElementById('daw-vu-target-compliance-badge');
            if (!btn) return;

            if (_activeVuTarget === 'stream') {
                btn.textContent = 'TGT: -14';
                btn.title = 'Target: -14 LUFS (Spotify, YouTube, Podcasts)';
                btn.style.color = '#0a84ff';
                btn.style.borderColor = 'rgba(10, 132, 255, 0.4)';
                if (targetLine) {
                    targetLine.style.bottom = '55%';
                    targetLine.style.opacity = '0.85';
                    targetLine.style.background = '#0a84ff';
                    targetLine.style.boxShadow = '0 0 5px #0a84ff';
                }
                if (complianceBadge) complianceBadge.style.display = 'block';
            } else if (_activeVuTarget === 'cinema') {
                btn.textContent = 'TGT: -24';
                btn.title = 'Target: -24 LUFS (Cinema & Broadcast EBU R128)';
                btn.style.color = '#5e5ce6';
                btn.style.borderColor = 'rgba(94, 92, 230, 0.4)';
                if (targetLine) {
                    targetLine.style.bottom = '28%';
                    targetLine.style.opacity = '0.85';
                    targetLine.style.background = '#5e5ce6';
                    targetLine.style.boxShadow = '0 0 5px #5e5ce6';
                }
                if (complianceBadge) complianceBadge.style.display = 'block';
            } else {
                btn.textContent = 'TGT: OFF';
                btn.title = 'Loudness Target Guidelines Disabled';
                btn.style.color = 'rgba(255,255,255,0.4)';
                btn.style.borderColor = 'rgba(255,255,255,0.15)';
                if (targetLine) targetLine.style.opacity = '0';
                if (complianceBadge) complianceBadge.style.display = 'none';
            }
        };

        document.getElementById('daw-vu-target-toggle-btn')?.addEventListener('click', () => {
            if (_activeVuTarget === 'stream') {
                _activeVuTarget = 'cinema';
                showStudioToast('Target set: -24 LUFS (Cinema / EBU R128)');
            } else if (_activeVuTarget === 'cinema') {
                _activeVuTarget = 'off';
                showStudioToast('Loudness Target Guidelines Disabled');
            } else {
                _activeVuTarget = 'stream';
                showStudioToast('Target set: -14 LUFS (Streaming Standard)');
            }
            updateVuTargetDisplay();
        });
        updateVuTargetDisplay();

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
                e.currentTarget.style.background = 'rgba(10, 132, 255, 0.2)';
                e.currentTarget.style.borderColor = 'rgba(10, 132, 255, 0.4)';
                e.currentTarget.style.color = '#0a84ff';

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

        // Effects Menu Actions - AudioSuite Offline DSP
        document.getElementById('daw-menu-fx-normalize')?.addEventListener('click', () => {
            closeAllMenus();
            normalizeSelectedClip();
        });
        document.getElementById('daw-menu-fx-reverse')?.addEventListener('click', () => {
            closeAllMenus();
            reverseSelectedClip();
        });
        document.getElementById('daw-menu-fx-pitch-stretch')?.addEventListener('click', () => {
            closeAllMenus();
            openAudioSuitePitchModal();
        });

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
        let _lastSidebarWidth = 240;

        const toggleSidebarCollapse = (forceState) => {
            const sidebar = document.getElementById('daw-track-headers-sidebar');
            const expandTab = document.getElementById('daw-sidebar-expand-tab');
            const toggleChevron = document.getElementById('daw-sidebar-toggle-chevron');
            if (!sidebar) return;

            const isCurrentlyCollapsed = sidebar.classList.contains('daw-track-sidebar-collapsed');
            const shouldCollapse = (forceState !== undefined) ? forceState : !isCurrentlyCollapsed;

            if (shouldCollapse) {
                const curW = parseInt(sidebar.style.width, 10);
                if (curW > 40) _lastSidebarWidth = curW;
                sidebar.classList.add('daw-track-sidebar-collapsed');
                sidebar.style.width = '0px';
                if (expandTab) expandTab.style.display = 'flex';
                if (toggleChevron) toggleChevron.style.transform = 'rotate(180deg)';
                showStudioToast('Sidebar collapsed (Timeline maximised)');
            } else {
                sidebar.classList.remove('daw-track-sidebar-collapsed');
                sidebar.style.width = `${_lastSidebarWidth || 240}px`;
                if (expandTab) expandTab.style.display = 'none';
                if (toggleChevron) toggleChevron.style.transform = 'rotate(0deg)';
                showStudioToast('Sidebar expanded');
            }
            renderDawTracks();
            renderDawClips();
        };

        // Wire Draggable Splitter for Sidebar / Timeline
        const initSidebarResizer = () => {
            const resizer = document.getElementById('daw-sidebar-resizer');
            const sidebar = document.getElementById('daw-track-headers-sidebar');
            const expandTab = document.getElementById('daw-sidebar-expand-tab');
            const toggleBtn = document.getElementById('daw-sidebar-toggle-btn');
            if (!resizer || !sidebar || resizer._isBound) return;
            resizer._isBound = true;

            let isDragging = false;
            let startX = 0;
            let startWidth = 240;

            resizer.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                isDragging = true;
                startX = e.clientX;
                startWidth = sidebar.offsetWidth;
                resizer.classList.add('is-resizing');
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';

                const onMouseMove = (moveEv) => {
                    if (!isDragging) return;
                    const deltaX = moveEv.clientX - startX;
                    let newWidth = startWidth + deltaX;

                    // Snap to 0px if dragged very small (< 45px)
                    if (newWidth < 45) {
                        toggleSidebarCollapse(true);
                        return;
                    }

                    // Otherwise clamp between 100px and 480px
                    newWidth = Math.max(110, Math.min(500, newWidth));
                    sidebar.classList.remove('daw-track-sidebar-collapsed');
                    sidebar.style.width = `${newWidth}px`;
                    _lastSidebarWidth = newWidth;
                    if (expandTab) expandTab.style.display = 'none';
                    const toggleChevron = document.getElementById('daw-sidebar-toggle-chevron');
                    if (toggleChevron) toggleChevron.style.transform = 'rotate(0deg)';
                };

                const onMouseUp = () => {
                    if (!isDragging) return;
                    isDragging = false;
                    resizer.classList.remove('is-resizing');
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onMouseUp);
                    renderDawTracks();
                    renderDawClips();
                };

                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onMouseUp);
            });

            // Double click resizer to toggle collapse
            resizer.addEventListener('dblclick', () => {
                toggleSidebarCollapse();
            });

            toggleBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleSidebarCollapse();
            });

            expandTab?.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleSidebarCollapse(false);
            });
        };
        initSidebarResizer();

        const applyLayoutMode = (mode) => {
            daw.layoutMode = mode;
            const tag = document.getElementById('daw-layout-status-tag');
            const stdCheck1 = document.getElementById('daw-menu-layout-standard-check');
            const editCheck1 = document.getElementById('daw-menu-layout-editing-check');
            const canvasCheck1 = document.getElementById('daw-menu-layout-canvas-check');

            const stdCheck2 = document.getElementById('daw-settings-layout-standard-check');
            const editCheck2 = document.getElementById('daw-settings-layout-editing-check');
            const canvasCheck2 = document.getElementById('daw-settings-layout-canvas-check');

            const sidebar = document.getElementById('daw-track-headers-sidebar');

            if (mode === 'canvas') {
                if (tag) tag.textContent = 'MAXIMISED CANVAS';
                if (stdCheck1) stdCheck1.style.display = 'none';
                if (stdCheck2) stdCheck2.style.display = 'none';
                if (editCheck1) editCheck1.style.display = 'none';
                if (editCheck2) editCheck2.style.display = 'none';
                if (canvasCheck1) canvasCheck1.style.display = 'inline';
                if (canvasCheck2) canvasCheck2.style.display = 'inline';
                toggleSidebarCollapse(true);
            } else if (mode === 'editing') {
                if (tag) tag.textContent = 'EDITING FOCUS';
                if (stdCheck1) stdCheck1.style.display = 'none';
                if (stdCheck2) stdCheck2.style.display = 'none';
                if (editCheck1) editCheck1.style.display = 'inline';
                if (editCheck2) editCheck2.style.display = 'inline';
                if (canvasCheck1) canvasCheck1.style.display = 'none';
                if (canvasCheck2) canvasCheck2.style.display = 'none';
                if (sidebar) {
                    sidebar.classList.remove('daw-track-sidebar-collapsed');
                    sidebar.style.width = '140px';
                    _lastSidebarWidth = 140;
                    document.getElementById('daw-sidebar-expand-tab')?.style.setProperty('display', 'none');
                }
            } else {
                if (tag) tag.textContent = 'STUDIO MODE';
                if (stdCheck1) stdCheck1.style.display = 'inline';
                if (stdCheck2) stdCheck2.style.display = 'inline';
                if (editCheck1) editCheck1.style.display = 'none';
                if (editCheck2) editCheck2.style.display = 'none';
                if (canvasCheck1) canvasCheck1.style.display = 'none';
                if (canvasCheck2) canvasCheck2.style.display = 'none';
                if (sidebar) {
                    sidebar.classList.remove('daw-track-sidebar-collapsed');
                    sidebar.style.width = '240px';
                    _lastSidebarWidth = 240;
                    document.getElementById('daw-sidebar-expand-tab')?.style.setProperty('display', 'none');
                }
            }
            renderDawTracks();
            renderDawClips();
        };

        // Wire View Dropdown Actions
        const updateWaveformMenuChecks = () => {
            const realCheck1 = document.getElementById('daw-menu-waveform-realistic-check');
            const barsCheck1 = document.getElementById('daw-menu-waveform-bars-check');
            const realCheck2 = document.getElementById('daw-settings-waveform-realistic-check');
            const barsCheck2 = document.getElementById('daw-settings-waveform-bars-check');
            const isReal = (daw.waveformStyle !== 'bars');
            if (realCheck1) realCheck1.style.display = isReal ? 'inline' : 'none';
            if (realCheck2) realCheck2.style.display = isReal ? 'inline' : 'none';
            if (barsCheck1) barsCheck1.style.display = !isReal ? 'inline' : 'none';
            if (barsCheck2) barsCheck2.style.display = !isReal ? 'inline' : 'none';
        };

        document.getElementById('daw-menu-view-waveform-realistic')?.addEventListener('click', () => {
            closeAllMenus();
            daw.waveformStyle = 'realistic';
            updateWaveformMenuChecks();
            renderDawClips();
            showStudioToast('Waveform: Analog Detailed Curves (High Resolution)');
        });

        document.getElementById('daw-menu-view-waveform-bars')?.addEventListener('click', () => {
            closeAllMenus();
            daw.waveformStyle = 'bars';
            updateWaveformMenuChecks();
            renderDawClips();
            showStudioToast('Waveform: Studio Block Bars');
        });

        // Waveform Sound File Color presentation triggers
        document.getElementById('daw-menu-view-waveform-color')?.addEventListener('click', () => {
            toggleWaveformColorMode('color');
        });

        document.getElementById('daw-menu-view-waveform-mono')?.addEventListener('click', () => {
            toggleWaveformColorMode('mono');
        });

        document.getElementById('timeline-wave-color-btn')?.addEventListener('click', () => {
            toggleWaveformColorMode();
        });

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

        document.getElementById('daw-menu-view-vu-dock')?.addEventListener('click', () => {
            closeAllMenus();
            toggleMasterVuDock();
        });

        document.getElementById('daw-menu-view-toggle-sidebar')?.addEventListener('click', () => {
            closeAllMenus();
            toggleSidebarCollapse();
        });

        document.getElementById('daw-menu-view-customize-toolbar')?.addEventListener('click', () => {
            closeAllMenus();
            toggleToolbarCustomizePopover(true);
        });

        document.getElementById('daw-menu-view-reset-ui')?.addEventListener('click', () => {
            closeAllMenus();
            resetDawUiLayout();
        });

        document.getElementById('daw-menu-view-history')?.addEventListener('click', () => {
            closeAllMenus();
            openUndoHistoryTimelineModal();
        });

        document.getElementById('daw-menu-view-zoom-fit')?.addEventListener('click', () => {
            closeAllMenus();
            fitTimelineToWindow();
            showStudioToast(`Fitted session to screen (${Math.round(daw.zoom / 15 * 100)}% zoom)`);
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
            applyStudioTheme('obsidian', 'color');
        });

        document.getElementById('daw-menu-theme-monochrome')?.addEventListener('click', () => {
            closeAllMenus();
            applyStudioTheme('monochrome', 'color');
        });

        document.getElementById('daw-menu-theme-monochrome-bw')?.addEventListener('click', () => {
            closeAllMenus();
            applyStudioTheme('monochrome-bw', 'mono');
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

        // Send Studio Feedback / Discord Dispatch Dialog
        document.getElementById('daw-menu-help-feedback')?.addEventListener('click', () => {
            closeAllMenus();
            const modal = document.getElementById('daw-feedback-modal');
            if (modal) {
                modal.style.display = 'flex';
                setTimeout(() => {
                    document.getElementById('daw-fb-message')?.focus();
                }, 60);
            }
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

        document.getElementById('daw-about-founder-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'daw-about-founder-modal') {
                e.target.style.display = 'none';
            }
        });

        const tabVisionBtn = document.getElementById('daw-about-tab-btn-vision');
        const tabChangelogBtn = document.getElementById('daw-about-tab-btn-changelog');
        const contentVision = document.getElementById('daw-about-content-vision');
        const contentChangelog = document.getElementById('daw-about-content-changelog');

        const switchAboutTab = (tab) => {
            if (tab === 'vision') {
                if (tabVisionBtn) {
                    tabVisionBtn.style.borderBottomColor = '#0a84ff';
                    tabVisionBtn.style.color = '#ffffff';
                }
                if (tabChangelogBtn) {
                    tabChangelogBtn.style.borderBottomColor = 'transparent';
                    tabChangelogBtn.style.color = 'rgba(255,255,255,0.6)';
                }
                if (contentVision) contentVision.style.display = 'flex';
                if (contentChangelog) contentChangelog.style.display = 'none';
            } else {
                if (tabVisionBtn) {
                    tabVisionBtn.style.borderBottomColor = 'transparent';
                    tabVisionBtn.style.color = 'rgba(255,255,255,0.6)';
                }
                if (tabChangelogBtn) {
                    tabChangelogBtn.style.borderBottomColor = '#0a84ff';
                    tabChangelogBtn.style.color = '#ffffff';
                }
                if (contentVision) contentVision.style.display = 'none';
                if (contentChangelog) contentChangelog.style.display = 'flex';
            }
        };

        tabVisionBtn?.addEventListener('click', () => switchAboutTab('vision'));
        tabChangelogBtn?.addEventListener('click', () => switchAboutTab('changelog'));

        // ==========================================
        // 7. MERGE TRACKS MODAL DIALOG ENGINE
        // ==========================================
        document.getElementById('daw-merge-tracks-close-btn')?.addEventListener('click', closeMergeTracksModal);
        document.getElementById('daw-merge-tracks-cancel-btn')?.addEventListener('click', closeMergeTracksModal);
        document.getElementById('daw-merge-tracks-confirm-btn')?.addEventListener('click', executeMergeTracks);
        document.getElementById('daw-merge-select-all')?.addEventListener('click', () => {
            document.querySelectorAll('.daw-merge-track-checkbox').forEach(cb => cb.checked = true);
        });
        document.getElementById('daw-merge-deselect-all')?.addEventListener('click', () => {
            document.querySelectorAll('.daw-merge-track-checkbox').forEach(cb => cb.checked = false);
        });
        document.getElementById('daw-merge-tracks-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'daw-merge-tracks-modal') closeMergeTracksModal();
        });

        // ==========================================
        // 8. LOCAL AUTO-SAVE ENGINE & INTERVAL MANAGER
        // ==========================================
        let _dawAutoSaveIntervalTimer = null;
        let _currentAutoSaveIntervalMs = 300000; // default 5 minutes
        try {
            const savedInterval = localStorage.getItem('localdaw_autosave_interval');
            if (savedInterval !== null) {
                _currentAutoSaveIntervalMs = parseInt(savedInterval, 10);
            }
        } catch (e) {}

        const updateAutoSaveUI = () => {
            const pill = document.getElementById('daw-autosave-indicator-pill');
            const check2m = document.getElementById('daw-settings-autosave-2m-check');
            const check5m = document.getElementById('daw-settings-autosave-5m-check');
            const check10m = document.getElementById('daw-settings-autosave-10m-check');
            const check30m = document.getElementById('daw-settings-autosave-30m-check');
            const checkOff = document.getElementById('daw-settings-autosave-off-check');

            if (check2m) check2m.style.display = (_currentAutoSaveIntervalMs === 120000) ? 'inline' : 'none';
            if (check5m) check5m.style.display = (_currentAutoSaveIntervalMs === 300000) ? 'inline' : 'none';
            if (check10m) check10m.style.display = (_currentAutoSaveIntervalMs === 600000) ? 'inline' : 'none';
            if (check30m) check30m.style.display = (_currentAutoSaveIntervalMs === 1800000) ? 'inline' : 'none';
            if (checkOff) checkOff.style.display = (_currentAutoSaveIntervalMs === 0) ? 'inline' : 'none';

            if (pill) {
                if (_currentAutoSaveIntervalMs === 0) {
                    pill.innerHTML = '<span style="width: 5px; height: 5px; border-radius: 50%; background: #8e8e93; display: inline-block;"></span> <span>Auto-Save: Off</span>';
                    pill.style.borderColor = 'rgba(255,255,255,0.15)';
                    pill.style.color = 'rgba(255,255,255,0.45)';
                    pill.title = 'Local Auto-Save is currently disabled';
                } else {
                    let label = '5m';
                    if (_currentAutoSaveIntervalMs === 120000) label = '2m';
                    else if (_currentAutoSaveIntervalMs === 300000) label = '5m';
                    else if (_currentAutoSaveIntervalMs === 600000) label = '10m';
                    else if (_currentAutoSaveIntervalMs === 1800000) label = '30m';
                    pill.innerHTML = `<span style="width: 5px; height: 5px; border-radius: 50%; background: #34d399; box-shadow: 0 0 6px #34d399; display: inline-block;"></span> <span>Auto-Save: ${label}</span>`;
                    pill.style.borderColor = 'rgba(52, 211, 153, 0.3)';
                    pill.style.color = '#34d399';
                }
            }
        };

        const setAutoSaveInterval = (intervalMs, showToast = true) => {
            _currentAutoSaveIntervalMs = intervalMs;
            try {
                localStorage.setItem('localdaw_autosave_interval', String(intervalMs));
            } catch (e) {}

            if (_dawAutoSaveIntervalTimer) {
                clearInterval(_dawAutoSaveIntervalTimer);
                _dawAutoSaveIntervalTimer = null;
            }

            if (intervalMs > 0) {
                _dawAutoSaveIntervalTimer = setInterval(() => {
                    if (typeof autoSaveDawSession === 'function') {
                        autoSaveDawSession();
                        const pill = document.getElementById('daw-autosave-indicator-pill');
                        if (pill) {
                            const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                            pill.title = `Last auto-saved locally at ${nowStr} (Click to save now)`;
                        }
                    }
                }, intervalMs);
            }

            updateAutoSaveUI();
            if (showToast) {
                if (intervalMs === 0) {
                    showStudioToast('Local Auto-Save: Disabled');
                } else {
                    let durStr = '5 minutes';
                    if (intervalMs === 120000) durStr = '2 minutes';
                    else if (intervalMs === 300000) durStr = '5 minutes';
                    else if (intervalMs === 600000) durStr = '10 minutes';
                    else if (intervalMs === 1800000) durStr = '30 minutes';
                    showStudioToast(`Local Auto-Save Interval: Every ${durStr}`);
                }
            }
        };

        // Wire Auto-Save Interval Menu Options
        document.getElementById('daw-menu-settings-autosave-2m')?.addEventListener('click', () => {
            closeAllMenus();
            setAutoSaveInterval(120000);
        });
        document.getElementById('daw-menu-settings-autosave-5m')?.addEventListener('click', () => {
            closeAllMenus();
            setAutoSaveInterval(300000);
        });
        document.getElementById('daw-menu-settings-autosave-10m')?.addEventListener('click', () => {
            closeAllMenus();
            setAutoSaveInterval(600000);
        });
        document.getElementById('daw-menu-settings-autosave-30m')?.addEventListener('click', () => {
            closeAllMenus();
            setAutoSaveInterval(1800000);
        });
        document.getElementById('daw-menu-settings-autosave-off')?.addEventListener('click', () => {
            closeAllMenus();
            setAutoSaveInterval(0);
        });

        // Wire Manual "Save Project to Local Library Now" & Indicator Pill
        const performManualLocalSave = async () => {
            if (typeof saveProjectToLibrary === 'function') {
                saveProjectToLibrary();
            } else if (typeof autoSaveDawSession === 'function') {
                autoSaveDawSession();
                showStudioToast('Project state saved to local storage');
            }
            const pill = document.getElementById('daw-autosave-indicator-pill');
            if (pill) {
                pill.innerHTML = '<span style="width: 5px; height: 5px; border-radius: 50%; background: #34d399; box-shadow: 0 0 10px #34d399; display: inline-block;"></span> <span style="color: #fff; font-weight: 700;">Saved Just Now!</span>';
                setTimeout(() => { updateAutoSaveUI(); }, 2200);
            }
        };

        document.getElementById('daw-menu-settings-save-now')?.addEventListener('click', () => {
            closeAllMenus();
            performManualLocalSave();
        });

        document.getElementById('daw-autosave-indicator-pill')?.addEventListener('click', () => {
            performManualLocalSave();
        });

        document.getElementById('daw-menu-settings-restore-session')?.addEventListener('click', async () => {
            closeAllMenus();
            if (typeof restoreDawSessionFromStorage === 'function') {
                const restored = await restoreDawSessionFromStorage();
                if (restored) {
                    showStudioToast('Restored last auto-saved session from local storage');
                } else {
                    showStudioToast('No prior auto-saved session found in local storage');
                }
            }
        });

        // Initialize Auto-Save Interval on boot
        setAutoSaveInterval(_currentAutoSaveIntervalMs, false);

        // ==========================================
        // 9. CONSOLIDATED SETTINGS TOP MENU ACTIONS
        // ==========================================
        // Settings -> Workspace Layout
        document.getElementById('daw-menu-settings-layout-standard')?.addEventListener('click', () => {
            closeAllMenus();
            applyLayoutMode('standard');
        });
        document.getElementById('daw-menu-settings-layout-editing')?.addEventListener('click', () => {
            closeAllMenus();
            applyLayoutMode('editing');
        });
        document.getElementById('daw-menu-settings-layout-canvas')?.addEventListener('click', () => {
            closeAllMenus();
            applyLayoutMode('canvas');
        });

        // Settings -> Cinematic Themes
        document.getElementById('daw-menu-settings-theme-obsidian')?.addEventListener('click', () => {
            closeAllMenus();
            applyStudioTheme('obsidian', 'color');
        });
        document.getElementById('daw-menu-settings-theme-monochrome')?.addEventListener('click', () => {
            closeAllMenus();
            applyStudioTheme('monochrome', 'color');
        });
        document.getElementById('daw-menu-settings-theme-monochrome-bw')?.addEventListener('click', () => {
            closeAllMenus();
            applyStudioTheme('monochrome-bw', 'mono');
        });
        document.getElementById('daw-menu-settings-theme-matrix')?.addEventListener('click', () => {
            closeAllMenus();
            applyStudioTheme('matrix');
        });

        // Settings -> Waveform & Audio Presentation
        document.getElementById('daw-menu-settings-waveform-realistic')?.addEventListener('click', () => {
            closeAllMenus();
            daw.waveformStyle = 'realistic';
            updateWaveformMenuChecks();
            renderDawClips();
            showStudioToast('Waveform: Analog Detailed Curves (High Resolution)');
        });
        document.getElementById('daw-menu-settings-waveform-bars')?.addEventListener('click', () => {
            closeAllMenus();
            daw.waveformStyle = 'bars';
            updateWaveformMenuChecks();
            renderDawClips();
            showStudioToast('Waveform: Studio Block Bars');
        });
        document.getElementById('daw-menu-settings-waveform-color')?.addEventListener('click', () => {
            closeAllMenus();
            toggleWaveformColorMode('color');
        });
        document.getElementById('daw-menu-settings-waveform-mono')?.addEventListener('click', () => {
            closeAllMenus();
            toggleWaveformColorMode('mono');
        });

        // Settings -> Workspace & Toolbar UX
        document.getElementById('daw-menu-settings-reset-ui')?.addEventListener('click', () => {
            closeAllMenus();
            resetDawUiLayout();
        });
        document.getElementById('daw-menu-settings-customize-toolbar')?.addEventListener('click', () => {
            closeAllMenus();
            toggleToolbarCustomizePopover(true);
        });
        document.getElementById('daw-menu-settings-vu-meter')?.addEventListener('click', () => {
            closeAllMenus();
            toggleMasterVuWindow();
        });
    };
    setupDawMenuBar();

    // =========================================================================
    // MODULAR TOOLBAR CONFIGURATION MANAGER (CLEAN WORKSPACE SYSTEM)
    // =========================================================================
    const DEFAULT_TOOLBAR_CONFIG = {
        'daw-top-module-timecode': true,
        'daw-top-module-bpm': true,
        'daw-top-module-master-vu': true,
        'daw-top-module-master-vol': true,
        'timeline-open-studio-btn': true,
        'timeline-top-import-btn': true,
        'timeline-fresh-session-btn': true,
        'timeline-render-btn': true,
        'daw-top-secondary-deck': true,
        'daw-top-module-undo-redo': true,
        'daw-top-module-clip-tools': true,
        'daw-top-module-punch': true,
        'daw-top-module-video-adr': true,
        'daw-top-module-mic-select': true,
        'daw-top-module-timeline-modes': true,
        'daw-top-module-view-scales': true,
        'daw-top-module-zoom-nav': true
    };

    function loadToolbarConfig() {
        try {
            const raw = localStorage.getItem('localfilm_daw_toolbar_config');
            if (raw) {
                const parsed = JSON.parse(raw);
                return Object.assign({}, DEFAULT_TOOLBAR_CONFIG, parsed);
            }
        } catch (e) {
            console.warn('[Toolbar Config] Failed to read stored config:', e);
        }
        return Object.assign({}, DEFAULT_TOOLBAR_CONFIG);
    }

    function saveToolbarConfig(cfg) {
        try {
            localStorage.setItem('localfilm_daw_toolbar_config', JSON.stringify(cfg));
        } catch (e) {
            console.warn('[Toolbar Config] Failed to save config:', e);
        }
    }

    function applyToolbarConfig(cfg) {
        if (!cfg) cfg = loadToolbarConfig();

        // Secondary deck master toggle
        const deck2El = document.getElementById('daw-top-secondary-deck');
        const showDeck2 = cfg['daw-top-secondary-deck'] !== false;
        if (deck2El) {
            deck2El.style.display = showDeck2 ? 'flex' : 'none';
        }
        const deck2Cb = document.getElementById('daw-cfg-mod-deck2');
        if (deck2Cb) deck2Cb.checked = showDeck2;

        const subDeckContainer = document.getElementById('daw-secondary-deck-submodules');
        if (subDeckContainer) {
            subDeckContainer.style.opacity = showDeck2 ? '1' : '0.4';
            subDeckContainer.style.pointerEvents = showDeck2 ? 'auto' : 'none';
        }

        // Apply to all registered modules
        Object.keys(cfg).forEach(key => {
            if (key === 'daw-top-secondary-deck') return;
            const el = document.getElementById(key);
            const isVisible = cfg[key] !== false;
            if (el) {
                el.style.display = isVisible ? '' : 'none';
            }
            const cb = document.querySelector(`input[data-mod="${key}"]`);
            if (cb) cb.checked = isVisible;
        });

        saveToolbarConfig(cfg);
    }

    function toggleToolbarCustomizePopover(forceState) {
        const popover = document.getElementById('daw-toolbar-customize-popover');
        if (!popover) return;
        const isCurrentlyOpen = popover.style.display === 'block';
        const nextState = (forceState !== undefined) ? forceState : !isCurrentlyOpen;
        popover.style.display = nextState ? 'block' : 'none';
        if (nextState) {
            const curCfg = loadToolbarConfig();
            applyToolbarConfig(curCfg);
        }
    }

    function initToolbarCustomizer() {
        const cfg = loadToolbarConfig();
        applyToolbarConfig(cfg);

        // Customize Popover Button
        document.getElementById('daw-toolbar-customize-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleToolbarCustomizePopover();
        });

        // Close Button
        document.getElementById('daw-toolbar-customize-close-btn')?.addEventListener('click', () => {
            toggleToolbarCustomizePopover(false);
        });

        // Checkbox changes inside popover
        document.querySelectorAll('#daw-toolbar-customize-popover input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                const modId = cb.getAttribute('data-mod');
                if (!modId) return;
                const curCfg = loadToolbarConfig();
                curCfg[modId] = cb.checked;
                applyToolbarConfig(curCfg);
            });
        });

        // Presets
        document.getElementById('daw-preset-standard-btn')?.addEventListener('click', () => {
            const standardCfg = Object.assign({}, DEFAULT_TOOLBAR_CONFIG);
            applyToolbarConfig(standardCfg);
            showStudioToast('Toolbar: Standard Studio Preset Applied');
        });

        document.getElementById('daw-preset-clean-btn')?.addEventListener('click', () => {
            const cleanCfg = {
                'daw-top-module-timecode': true,
                'daw-top-module-bpm': false,
                'daw-top-module-master-vu': true,
                'daw-top-module-master-vol': true,
                'timeline-open-studio-btn': false,
                'timeline-top-import-btn': true,
                'timeline-fresh-session-btn': false,
                'timeline-render-btn': true,
                'daw-top-secondary-deck': false,
                'daw-top-module-undo-redo': false,
                'daw-top-module-clip-tools': false,
                'daw-top-module-punch': false,
                'daw-top-module-video-adr': false,
                'daw-top-module-mic-select': false,
                'daw-top-module-timeline-modes': false,
                'daw-top-module-view-scales': false,
                'daw-top-module-zoom-nav': true
            };
            applyToolbarConfig(cleanCfg);
            showStudioToast('Toolbar: Clean Minimalist Preset Applied');
        });

        document.getElementById('daw-preset-editing-btn')?.addEventListener('click', () => {
            const editingCfg = {
                'daw-top-module-timecode': true,
                'daw-top-module-bpm': false,
                'daw-top-module-master-vu': true,
                'daw-top-module-master-vol': true,
                'timeline-open-studio-btn': false,
                'timeline-top-import-btn': true,
                'timeline-fresh-session-btn': false,
                'timeline-render-btn': true,
                'daw-top-secondary-deck': true,
                'daw-top-module-undo-redo': true,
                'daw-top-module-clip-tools': true,
                'daw-top-module-punch': true,
                'daw-top-module-video-adr': false,
                'daw-top-module-mic-select': false,
                'daw-top-module-timeline-modes': true,
                'daw-top-module-view-scales': true,
                'daw-top-module-zoom-nav': true
            };
            applyToolbarConfig(editingCfg);
            showStudioToast('Toolbar: Editing Focus Preset Applied');
        });

        // Click outside popover to dismiss
        document.addEventListener('click', (e) => {
            const popover = document.getElementById('daw-toolbar-customize-popover');
            const btn = document.getElementById('daw-toolbar-customize-btn');
            if (popover && popover.style.display === 'block') {
                if (!popover.contains(e.target) && !btn?.contains(e.target)) {
                    popover.style.display = 'none';
                }
            }
        });
    }

    initToolbarCustomizer();

    // Waveform Amplitude Zoom Multiplier
    document.getElementById('timeline-wave-gain-btn')?.addEventListener('click', () => {
        const scales = [1.0, 1.5, 2.0, 3.0];
        const curIdx = scales.indexOf(daw.waveScale || 1.0);
        daw.waveScale = scales[(curIdx + 1) % scales.length];

        const lbl = document.getElementById('timeline-wave-gain-label');
        if (lbl) lbl.textContent = `${daw.waveScale}x`;

        renderDawClips();
    });

    
    // Marquee Drag-to-Select Engine across Timeline Lanes
    const initTimelineMarqueeSelection = () => {
        const lanesContainer = document.getElementById('timeline-lanes-container');
        const marqueeBox = document.getElementById('timeline-marquee-selection-box');
        const viewport = document.getElementById('timeline-scroll-viewport');
        if (!lanesContainer || !marqueeBox || !viewport) return;

        let isMarqueeActive = false;
        let startX = 0;
        let startY = 0;
        let startClientX = 0;
        let startClientY = 0;

        lanesContainer.addEventListener('selectstart', (e) => e.preventDefault());

        lanesContainer.addEventListener('mousedown', (e) => {
            // Ignore right clicks or clicks on existing clips, keyframes, handles, buttons, or scrollbars
            if (e.button !== 0) return;
            if (e.target.closest('.daw-timeline-clip') || 
                e.target.closest('.daw-kf-group') || 
                e.target.closest('.lane-automation-svg') || 
                e.target.closest('.daw-lane-height-resizer') || 
                e.target.closest('button') || 
                e.target.closest('input')) {
                return;
            }

            e.preventDefault();
            window.getSelection()?.removeAllRanges();
            document.body.style.userSelect = 'none';
            document.body.style.webkitUserSelect = 'none';

            const lanesRect = lanesContainer.getBoundingClientRect();
            startX = e.clientX - lanesRect.left;
            startY = e.clientY - lanesRect.top;
            startClientX = e.clientX;
            startClientY = e.clientY;

            let hasMovedEnough = false;

            const onMouseMove = (moveEv) => {
                moveEv.preventDefault();
                window.getSelection()?.removeAllRanges();
                const dist = Math.hypot(moveEv.clientX - startClientX, moveEv.clientY - startClientY);
                if (!hasMovedEnough && dist < 5) return;
                hasMovedEnough = true;
                isMarqueeActive = true;

                const curX = moveEv.clientX - lanesRect.left;
                const curY = moveEv.clientY - lanesRect.top;

                const left = Math.max(0, Math.min(startX, curX));
                const top = Math.max(0, Math.min(startY, curY));
                const width = Math.abs(curX - startX);
                const height = Math.abs(curY - startY);

                marqueeBox.style.display = 'block';
                marqueeBox.style.left = `${left}px`;
                marqueeBox.style.top = `${top}px`;
                marqueeBox.style.width = `${width}px`;
                marqueeBox.style.height = `${height}px`;

                // Calculate overlap with all clips on the timeline
                const marqueeRect = marqueeBox.getBoundingClientRect();
                const isAdditive = moveEv.shiftKey;

                if (!isAdditive && !moveEv._clearedSelection) {
                    if (!daw.selectedClipIds) daw.selectedClipIds = new Set();
                    daw.selectedClipIds.clear();
                    daw.selectedClipId = null;
                    moveEv._clearedSelection = true;
                }

                document.querySelectorAll('.daw-timeline-clip').forEach(clipEl => {
                    const cRect = clipEl.getBoundingClientRect();
                    const clipId = clipEl.getAttribute('data-clip-id');
                    if (!clipId) return;

                    const intersects = !(
                        marqueeRect.right < cRect.left ||
                        marqueeRect.left > cRect.right ||
                        marqueeRect.bottom < cRect.top ||
                        marqueeRect.top > cRect.bottom
                    );

                    if (intersects) {
                        daw.selectedClipIds.add(clipId);
                        daw.selectedClipId = clipId;
                        clipEl.classList.add('is-selected');
                        clipEl.style.border = '2px solid #ffffff';
                        clipEl.style.boxShadow = '0 0 16px rgba(255,255,255,0.6), inset 0 0 8px rgba(255,255,255,0.2)';
                    } else if (!isAdditive) {
                        daw.selectedClipIds.delete(clipId);
                        if (daw.selectedClipId === clipId) daw.selectedClipId = null;
                        clipEl.classList.remove('is-selected');
                        const clipObj = daw.clips.find(c => c.id === clipId);
                        clipEl.style.border = '1px solid ' + ((clipObj && clipObj.color) || 'rgba(255,255,255,0.3)');
                        clipEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.5)';
                    }
                });

                if (typeof updateDawFooter === 'function') {
                    updateDawFooter();
                }
            };

            const onMouseUp = (upEv) => {
                document.body.style.userSelect = '';
                document.body.style.webkitUserSelect = '';
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);

                if (isMarqueeActive) {
                    marqueeBox.style.display = 'none';
                    isMarqueeActive = false;
                    renderDawClips();
                    if (daw.selectedClipIds.size > 0) {
                        showStudioToast(`Selected ${daw.selectedClipIds.size} clip(s)`);
                    }
                } else {
                    // Clicked on empty timeline space without dragging: seek playhead and deselect
                    if (!upEv.shiftKey) {
                        if (!daw.selectedClipIds) daw.selectedClipIds = new Set();
                        daw.selectedClipIds.clear();
                        daw.selectedClipId = null;
                        if (typeof window._syncBottomDeckClipInspector === 'function') window._syncBottomDeckClipInspector();
                        renderDawClips();
                    }
                    seekTimelineFromClientX(upEv.clientX);
                }
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });
    };

    initTimelineMarqueeSelection();

    // Double-click on empty timeline lane area opens the Audio Import Hub directly for that track!
    document.getElementById('timeline-lanes-container')?.addEventListener('dblclick', (e) => {
        if (e.target.closest('.daw-timeline-clip') || e.target.closest('.lane-automation-svg') || e.target.closest('.daw-kf-group') || e.target.closest('button') || e.target.closest('input')) {
            return;
        }
        const targetLane = e.target.closest('.timeline-lane');
        if (targetLane) {
            const trackId = targetLane.getAttribute('data-track-id');
            daw._targetImportTrackId = trackId;
            const trackObj = daw.tracks[trackId];
            const trackName = trackObj ? trackObj.name : trackId;

            // Update destination track selects across both modals
            const inspectTrackSelect = document.getElementById('daw-inspect-target-track');
            if (inspectTrackSelect && trackId) {
                inspectTrackSelect.value = trackId;
            }

            const importHub = document.getElementById('daw-audio-import-hub-modal');
            if (importHub) {
                importHub.style.display = 'flex';
                showStudioToast(`Double-clicked ${trackName} — Select audio file(s) to import onto this track`);
            } else {
                document.getElementById('daw-menu-audio-file-input')?.click();
            }
        } else {
            // Double-click on empty timeline area adds a new track
            addNewEmptyTrack('audio');
        }
    });

    // Timeline Lanes Click-to-Move Playhead & Select Track Lane
    document.getElementById('timeline-lanes-container')?.addEventListener('click', (e) => {
        const laneEl = e.target.closest('.timeline-lane');
        if (laneEl) {
            const trId = laneEl.getAttribute('data-track-id');
            if (trId && daw._activeFxTrackId !== trId) {
                daw._activeFxTrackId = trId;
                renderDawTracks();
                syncActiveTrackToDeck();
                if (typeof renderMixerStrips === 'function') renderMixerStrips();
            }
        }
        if (!e.target.closest('.daw-timeline-clip') && !e.target.closest('.lane-automation-svg') && !e.target.closest('.daw-kf-group') && !e.target.closest('button') && !e.target.closest('input')) {
            seekTimelineFromClientX(e.clientX);
        }
    });

    // Touch tap playhead seeking for mobile
    document.getElementById('timeline-lanes-container')?.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        const laneEl = e.target.closest('.timeline-lane');
        if (laneEl) {
            const trId = laneEl.getAttribute('data-track-id');
            if (trId && daw._activeFxTrackId !== trId) {
                daw._activeFxTrackId = trId;
                renderDawTracks();
                syncActiveTrackToDeck();
                if (typeof renderMixerStrips === 'function') renderMixerStrips();
            }
        }
        if (!e.target.closest('.daw-timeline-clip') && !e.target.closest('.lane-automation-svg') && !e.target.closest('.daw-kf-group') && !e.target.closest('button') && !e.target.closest('input')) {
            seekTimelineFromClientX(touch.clientX);
        }
    }, { passive: true });

    // Bidirectional vertical scroll sync between timeline lanes and track headers sidebar
    const timelineViewport = document.getElementById('timeline-scroll-viewport');
    const headersList = document.getElementById('daw-track-headers-container');
    if (timelineViewport && headersList) {
        let isSyncingFromViewport = false;
        let isSyncingFromHeaders = false;

        timelineViewport.addEventListener('scroll', () => {
            if (isSyncingFromHeaders) return;
            isSyncingFromViewport = true;
            headersList.scrollTop = timelineViewport.scrollTop;
            requestAnimationFrame(() => { isSyncingFromViewport = false; });
        });

        headersList.addEventListener('scroll', () => {
            if (isSyncingFromViewport) return;
            isSyncingFromHeaders = true;
            timelineViewport.scrollTop = headersList.scrollTop;
            requestAnimationFrame(() => { isSyncingFromHeaders = false; });
        });

        // Smooth Zoom (Alt/Ctrl/Cmd + Wheel) & Horizontal Timeline Scrolling (Shift + Wheel / Trackpad deltaX)
        timelineViewport.addEventListener('wheel', (e) => {
            if (e.altKey || e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const rect = timelineViewport.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const scrollLeft = timelineViewport.scrollLeft;
                const timeAtCursor = (scrollLeft + mouseX) / daw.zoom;

                const zoomFactor = e.deltaY < 0 ? 1.15 : (1 / 1.15);
                const newZoom = Math.min(80, Math.max(0.05, daw.zoom * zoomFactor));

                if (newZoom !== daw.zoom) {
                    daw.zoom = newZoom;
                    const badge = document.getElementById('timeline-zoom-badge');
                    if (badge) badge.textContent = `${Math.round(daw.zoom / 15 * 100)}%`;
                    const zoomValEl = document.getElementById('daw-footer-zoom-val');
                    if (zoomValEl) zoomValEl.textContent = `${Math.round(daw.zoom / 15 * 100)}%`;
                    const zoomSlider = document.getElementById('daw-footer-zoom-slider');
                    if (zoomSlider) zoomSlider.value = String(daw.zoom);
                    renderDawTracks();
                    renderDawRuler();
                    renderDawClips();
                    updateDawPlayhead();

                    // Anchor the viewport so timeAtCursor remains directly under the cursor
                    timelineViewport.scrollLeft = Math.max(0, timeAtCursor * daw.zoom - mouseX);
                }
            } else if (e.shiftKey && e.deltaY !== 0) {
                // Shift + Wheel scrolls timeline horizontally
                e.preventDefault();
                timelineViewport.scrollLeft += e.deltaY;
            } else if (Math.abs(e.deltaX) > 0) {
                // Native horizontal trackpad scrolling
                timelineViewport.scrollLeft += e.deltaX;
            }
        }, { passive: false });
    }

    // Global Keyboard Shortcuts for Multi-Track Studio DAW (Undo, Redo, Delete, Spacebar Play/Pause, Loop)
    window.addEventListener('keydown', (e) => {
        const activeEl = document.activeElement;
        const activeTag = activeEl ? activeEl.tagName.toUpperCase() : '';
        const nonTextInputTypes = ['range', 'checkbox', 'radio', 'button', 'color', 'submit', 'reset', 'file'];
        const isTextInput = activeTag === 'INPUT' && !nonTextInputTypes.includes((activeEl.type || '').toLowerCase());
        const isEditingText = isTextInput || activeTag === 'TEXTAREA' || activeEl?.isContentEditable;
        if (isEditingText) return;

        // Proactively un-focus non-text controls (sliders, buttons, selects) on Space so it is never swallowed
        if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
            if (activeEl && activeEl !== document.body && typeof activeEl.blur === 'function') {
                activeEl.blur();
            }
            const editorModal = document.getElementById('podcast-editor-modal');
            const isDawOpen = editorModal && (
                editorModal.style.display === 'flex' ||
                editorModal.style.display === 'block' ||
                (window.getComputedStyle(editorModal).display !== 'none')
            );
            if (isDawOpen) {
                e.preventDefault();
                e.stopPropagation();
                if (daw.isRecording) {
                    stopDawRecording();
                } else {
                    toggleDawPlay();
                }
                return;
            }
        }

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

            // Undo History Timeline Shortcut (Cmd+H or Ctrl+H)
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && (e.key === 'h' || e.key === 'H')) {
                e.preventDefault();
                openUndoHistoryTimelineModal();
                return;
            }

            // Combine / Glue Clips Shortcut (Cmd+G or Ctrl+G)
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && (e.key === 'g' || e.key === 'G')) {
                e.preventDefault();
                combineSelectedClipsDAW();
                return;
            }

            // AudioSuite DSP Offline Processing Shortcuts (Alt+Shift+N, Alt+Shift+R, Alt+Shift+P)
            if (e.altKey && e.shiftKey) {
                if (e.key === 'n' || e.key === 'N') {
                    e.preventDefault();
                    normalizeSelectedClip();
                    return;
                }
                if (e.key === 'r' || e.key === 'R') {
                    e.preventDefault();
                    reverseSelectedClip();
                    return;
                }
                if (e.key === 'p' || e.key === 'P') {
                    e.preventDefault();
                    openAudioSuitePitchModal();
                    return;
                }
            }

            // Project Settings & Hardware Clock Shortcut (Cmd+, or Ctrl+,)
            if ((e.metaKey || e.ctrlKey) && (e.key === ',' || e.code === 'Comma')) {
                e.preventDefault();
                window._openProjectSettingsModal?.();
                return;
            }

            // Save Project to Local Library (Ctrl+S / Cmd+S)
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                if (typeof saveCurrentProjectToLibrary === 'function') {
                    saveCurrentProjectToLibrary();
                }
                return;
            }

            // Save Project As File (.localfilmdaw) (Ctrl+Shift+S / Cmd+Shift+S)
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                if (typeof saveDawProjectFile === 'function') {
                    saveDawProjectFile();
                }
                return;
            }

            // Open Project File (.localfilmdaw) (Ctrl+O / Cmd+O)
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && (e.key === 'o' || e.key === 'O')) {
                e.preventDefault();
                document.getElementById('daw-open-project-file-input')?.click();
                return;
            }

            // Open Recent Projects Library (Ctrl+Alt+O / Cmd+Alt+O)
            if ((e.metaKey || e.ctrlKey) && e.altKey && (e.key === 'o' || e.key === 'O')) {
                e.preventDefault();
                if (typeof openRecentProjectsModal === 'function') {
                    openRecentProjectsModal();
                }
                return;
            }

            // Escape to close active sub-modals (Clip Inspector, FX Rack, Crossfade, Project Settings, Export Modal, Track Properties, Recent Projects, or Toolbar Popover)
            if (e.key === 'Escape') {
                const trackPropModal = document.getElementById('daw-track-properties-modal');
                if (trackPropModal && trackPropModal.style.display !== 'none') {
                    e.preventDefault();
                    trackPropModal.style.display = 'none';
                    return;
                }
                const recentProjModal = document.getElementById('daw-recent-projects-modal');
                if (recentProjModal && recentProjModal.style.display !== 'none') {
                    e.preventDefault();
                    recentProjModal.style.display = 'none';
                    return;
                }
                const tbPopover = document.getElementById('daw-toolbar-customize-popover');
                if (tbPopover && tbPopover.style.display !== 'none') {
                    e.preventDefault();
                    tbPopover.style.display = 'none';
                    return;
                }
                const settingsModal = document.getElementById('daw-project-settings-modal');
                if (settingsModal && settingsModal.style.display !== 'none') {
                    e.preventDefault();
                    settingsModal.style.display = 'none';
                    return;
                }
                const crossfadeModal = document.getElementById('daw-crossfade-modal');
                if (crossfadeModal && crossfadeModal.style.display !== 'none') {
                    e.preventDefault();
                    crossfadeModal.style.display = 'none';
                    return;
                }
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
                const newProjModal = document.getElementById('daw-new-project-modal');
                if (newProjModal && newProjModal.style.display !== 'none') {
                    e.preventDefault();
                    newProjModal.style.display = 'none';
                    return;
                }
                const addTracksModal = document.getElementById('daw-add-tracks-modal');
                if (addTracksModal && addTracksModal.style.display !== 'none') {
                    e.preventDefault();
                    addTracksModal.style.display = 'none';
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

            // Reset UI & Window Layout Shortcut (Alt+R)
            if (e.altKey && (e.key === 'r' || e.key === 'R')) {
                e.preventDefault();
                document.getElementById('daw-menu-view-reset-ui')?.click();
                return;
            }

            // Duplicate Selected Clip (Cmd+D / Ctrl+D)
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === 'd' || e.key === 'D')) {
                e.preventDefault();
                duplicateSelectedClipDAW();
                return;
            }

            // Split Clip at Playhead (Cmd+B / Ctrl+B)
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === 'b' || e.key === 'B')) {
                e.preventDefault();
                splitSelectedClip();
                return;
            }

            // Razor Blade Tool Toggle (B key without modifiers)
            if (!e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'b' || e.key === 'B')) {
                e.preventDefault();
                setDawActiveTool(daw.activeTool === 'blade' ? 'pointer' : 'blade');
                return;
            }

            // Pointer Tool Selector (V or A key without modifiers)
            if (!e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'v' || e.key === 'V' || e.key === 'a' || e.key === 'A')) {
                e.preventDefault();
                setDawActiveTool('pointer');
                return;
            }

            // Split / Cut Clip Shortcut (S key without modifiers)
            if (!e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 's' || e.key === 'S')) {
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

            // Add Multiple Tracks Shortcut (Ctrl+Shift+T / Cmd+Shift+T)
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 't' || e.key === 'T')) {
                e.preventDefault();
                document.getElementById('daw-menu-tracks-add-batch')?.click();
                return;
            }

            // Configure Toolbar Modules Popover Shortcut (T without modifiers)
            if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && (e.key === 't' || e.key === 'T')) {
                e.preventDefault();
                toggleToolbarCustomizePopover();
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

            // Fit Timeline to Screen Shortcut (F without modifiers)
            if (!e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'f' || e.key === 'F')) {
                e.preventDefault();
                fitTimelineToWindow();
                showStudioToast(`Fitted session to screen (${Math.round(daw.zoom / 15 * 100)}% zoom)`);
                return;
            }

            // Crossfade Selected Adjacent Clips Shortcut (X without modifiers)
            if (!e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'x' || e.key === 'X')) {
                const crossfadeBtn = document.getElementById('timeline-crossfade-btn');
                if (crossfadeBtn && !crossfadeBtn.disabled) {
                    e.preventDefault();
                    crossfadeBtn.click();
                    return;
                }
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

            // Delete Selected Track Shortcut (Alt+Delete / Option+Backspace)
            if (e.altKey && (e.key === 'Delete' || e.key === 'Backspace')) {
                const trId = daw._activeFxTrackId || (daw.tracks && Object.keys(daw.tracks)[0]);
                if (trId && daw.tracks[trId]) {
                    e.preventDefault();
                    deleteTrackPrompt(trId);
                    return;
                }
            }

            // Ripple Delete Shortcut (Shift + Delete / Shift + Backspace)
            if (e.shiftKey && (e.key === 'Delete' || e.key === 'Backspace')) {
                if (daw.selectedClipId || (daw.selectedClipIds && daw.selectedClipIds.size > 0)) {
                    e.preventDefault();
                    deleteSelectedClip(true);
                    return;
                }
            }

            // Delete Selected Clip(s) Shortcut (Delete / Backspace), or Active Track if no clips selected
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

            // Toggle Motion Picture Video Preview Monitor Shortcut (Shift+V or P key)
            if (!e.metaKey && !e.ctrlKey && ((e.shiftKey && (e.key === 'v' || e.key === 'V')) || (!e.altKey && !e.shiftKey && (e.key === 'p' || e.key === 'P')))) {
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
    }, true);

    // Initial DAW Render Pass
    recalculateDawDuration();
    renderDawTracks();
    renderDawRuler();

    // Initialize Track Properties Modal, Recent Projects Library, and File Pickers
    if (typeof initTrackPropertiesModal === 'function') {
        initTrackPropertiesModal();
    }
    if (typeof initRecentProjectsModal === 'function') {
        initRecentProjectsModal();
    }

    // Auto-save and exit confirmation on page reload or close
    window.addEventListener('beforeunload', (e) => {
        try {
            if (typeof autoSaveDawSession === 'function') {
                autoSaveDawSession();
            }
        } catch (err) {
            console.warn('[Session] beforeunload autoSave error:', err);
        }
        if (daw && daw.clips && daw.clips.length > 0) {
            e.preventDefault();
            e.returnValue = 'You have an active session in LocalDAW. Your progress is auto-saved locally. Are you sure you want to exit?';
            return e.returnValue;
        }
    });

    // Attempt to restore prior session from local IndexedDB; fallback to demo project if fresh session
    (async () => {
        let restored = false;
        try {
            if (typeof restoreDawSessionFromStorage === 'function') {
                restored = await restoreDawSessionFromStorage();
            }
        } catch (err) {
            console.warn('[Session] IndexedDB restore error:', err);
        }

        if (!restored && daw.clips.length === 0) {
            // Fresh launch boots clean and empty of tracks
        }

        renderDawClips();
        updateDawPlayhead();
        bindFooterControls();
        updateDawFooter();
        await initDawMicSetup();
        if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
            navigator.mediaDevices.addEventListener('devicechange', () => {
                initDawMicSetup();
            });
        }
    })();
    
    // Global Window-Level & Timeline Drag & Drop Ingestion
    window.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
    window.addEventListener('drop', (e) => {
        // Prevent browser from navigating or playing the file directly
        e.preventDefault();
        e.stopPropagation();
    });

    const scrollViewport = document.getElementById('timeline-scroll-viewport') || document.body;
    if (scrollViewport) {
        ['dragenter', 'dragover'].forEach(eventName => {
            scrollViewport.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                scrollViewport.style.outline = '2px dashed #0a84ff';
                scrollViewport.style.outlineOffset = '-4px';
            });
        });
        ['dragleave', 'drop'].forEach(eventName => {
            scrollViewport.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                scrollViewport.style.outline = 'none';
            });
        });
        scrollViewport.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            scrollViewport.style.outline = 'none';

            const dt = e.dataTransfer;
            if (dt && dt.files && dt.files.length > 0) {
                const files = Array.from(dt.files);
                const audioFiles = files.filter(f => f.type.startsWith('audio/') || /\.(wav|mp3|flac|ogg|m4a|aac|aiff|webm)$/i.test(f.name));
                const videoFiles = files.filter(f => f.type.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(f.name));

                if (videoFiles.length > 0) {
                    // Route video files directly to video preview engine & video track!
                    const vFile = videoFiles[0];
                    const videoInput = document.getElementById('daw-video-import-input');
                    if (videoInput) {
                        const dtVideo = new DataTransfer();
                        dtVideo.items.add(vFile);
                        videoInput.files = dtVideo.files;
                        videoInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }

                if (audioFiles.length > 0) {
                    // Call the inspector processor directly with the dropped files!
                    if (typeof processAudioFilesForImport === 'function') {
                        await processAudioFilesForImport(audioFiles);
                    } else if (typeof window._openAudioInspectorModal === 'function') {
                        await window._openAudioInspectorModal(audioFiles);
                    }
                }
            }
        });
    }

    // ═════════════════════════════════════════════════════════════════════════════
    // DOCKED BOTTOM STUDIO DECK ENGINE (Tabs, Resizer, DSP Canvas Sync & Mixer)
    // ═════════════════════════════════════════════════════════════════════════════
    const initBottomStudioDeck = () => {
        const deckEl = document.getElementById('daw-bottom-studio-deck');
        const resizerEl = document.getElementById('daw-bottom-deck-resizer');
        const toggleBtn = document.getElementById('daw-bottom-deck-toggle-btn');
        const popoutBtn = document.getElementById('daw-bottom-deck-popout-btn');
        const tabBtns = document.querySelectorAll('.daw-bottom-deck-tab');
        const panels = document.querySelectorAll('.daw-deck-panel');
        const trackBadge = document.getElementById('daw-bottom-deck-track-badge');

        if (!deckEl) return;

        // Active track synchronizer
        const syncActiveTrackToDeck = () => {
            const activeId = daw._activeFxTrackId || (daw.tracks && Object.keys(daw.tracks)[0]) || null;
            const tr = (daw.tracks && activeId) ? daw.tracks[activeId] : null;

            if (!tr) {
                if (trackBadge) {
                    trackBadge.textContent = 'NO TRACK';
                    trackBadge.style.color = 'rgba(255,255,255,0.4)';
                    trackBadge.style.borderColor = 'rgba(255,255,255,0.15)';
                }
                const eqBtn = document.getElementById('daw-deck-eq-toggle-btn');
                if (eqBtn) {
                    eqBtn.textContent = 'EQ: BYPASS';
                    eqBtn.style.color = 'rgba(255,255,255,0.4)';
                    eqBtn.style.borderColor = 'rgba(255,255,255,0.1)';
                }
                const cmpBtn = document.getElementById('daw-deck-comp-toggle-btn');
                if (cmpBtn) {
                    cmpBtn.textContent = 'CMP: BYPASS';
                    cmpBtn.style.color = 'rgba(255,255,255,0.4)';
                    cmpBtn.style.borderColor = 'rgba(255,255,255,0.1)';
                }
                renderDeckEqCanvas(defaultPluginState());
                renderDeckCompCanvas(defaultPluginState());
                return;
            }

            if (trackBadge && tr) {
                trackBadge.textContent = tr.name || activeId;
                trackBadge.style.color = tr.color || '#0a84ff';
                trackBadge.style.borderColor = (tr.color || '#0a84ff') + '55';
            }

            // Sync DSP Device displays
            if (tr) {
                const pl = tr.plugins || defaultPluginState();
                const eqBtn = document.getElementById('daw-deck-eq-toggle-btn');
                if (eqBtn) {
                    const isEq = !!pl.eq?.enabled;
                    eqBtn.textContent = isEq ? 'EQ: ACTIVE' : 'EQ: BYPASS';
                    eqBtn.style.color = isEq ? '#34d399' : 'rgba(255,255,255,0.4)';
                    eqBtn.style.borderColor = isEq ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.1)';
                }
                const hpfEl = document.getElementById('daw-deck-eq-hpf-val');
                if (hpfEl) hpfEl.textContent = pl.eq?.lowCut ? '80Hz ON' : 'OFF';
                const lowEl = document.getElementById('daw-deck-eq-low-val');
                if (lowEl) lowEl.textContent = `${(pl.eq?.low || 0) > 0 ? '+' : ''}${pl.eq?.low || 0} dB`;
                const midEl = document.getElementById('daw-deck-eq-mid-val');
                if (midEl) midEl.textContent = `${(pl.eq?.mid || 0) > 0 ? '+' : ''}${pl.eq?.mid || 0} dB`;
                const highEl = document.getElementById('daw-deck-eq-high-val');
                if (highEl) highEl.textContent = `${(pl.eq?.high || 0) > 0 ? '+' : ''}${pl.eq?.high || 0} dB`;

                const cmpBtn = document.getElementById('daw-deck-comp-toggle-btn');
                if (cmpBtn) {
                    const isCmp = !!pl.comp?.enabled;
                    cmpBtn.textContent = isCmp ? 'CMP: ACTIVE' : 'CMP: BYPASS';
                    cmpBtn.style.color = isCmp ? '#22d3ee' : 'rgba(255,255,255,0.4)';
                    cmpBtn.style.borderColor = isCmp ? 'rgba(34,211,238,0.4)' : 'rgba(255,255,255,0.1)';
                }
                const thrEl = document.getElementById('daw-deck-comp-thr-val');
                if (thrEl) thrEl.textContent = `${pl.comp?.threshold !== undefined ? pl.comp.threshold : -24}dB`;
                const ratEl = document.getElementById('daw-deck-comp-rat-val');
                if (ratEl) ratEl.textContent = `${pl.comp?.ratio || 3.5}:1`;
                const mdlEl = document.getElementById('daw-deck-comp-model-badge');
                if (mdlEl) mdlEl.textContent = (pl.comp?.model || 'MODERN').toUpperCase();

                // Redraw deck canvases
                renderDeckEqCanvas(pl);
                renderDeckCompCanvas(pl);
            }
        };

        // ─────────────────────────────────────────────────────────────
        // Crisp HiDPI / Retina Canvas Setup Helper
        // ─────────────────────────────────────────────────────────────
        const setupCrispCanvas = (canvas) => {
            if (!canvas) return null;
            const rect = canvas.getBoundingClientRect();
            const w = Math.max(80, Math.floor(rect.width));
            const h = Math.max(50, Math.floor(rect.height));
            const dpr = window.devicePixelRatio || 1;
            const targetW = Math.floor(w * dpr);
            const targetH = Math.floor(h * dpr);
            if (canvas.width !== targetW || canvas.height !== targetH) {
                canvas.width = targetW;
                canvas.height = targetH;
            }
            const ctx = canvas.getContext('2d');
            ctx.resetTransform();
            ctx.scale(dpr, dpr);
            return { ctx, w, h };
        };

        // Wire Deck DSP Toggle Buttons (EQ, Compressor & Model Switcher)
        const bindDeckDspToggleButtons = () => {
            const eqBtn = document.getElementById('daw-deck-eq-toggle-btn');
            if (eqBtn && !eqBtn._bound) {
                eqBtn._bound = true;
                eqBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const activeId = daw._activeFxTrackId || (daw.tracks && Object.keys(daw.tracks)[0]) || 'host';
                    const tr = daw.tracks && daw.tracks[activeId];
                    if (!tr) return;
                    if (!tr.plugins) tr.plugins = defaultPluginState();
                    tr.plugins.eq.enabled = !tr.plugins.eq.enabled;
                    if (typeof rebuildTrackBusFx === 'function') {
                        rebuildTrackBusFx(activeId, tr.plugins);
                    }
                    syncActiveTrackToDeck();
                });
            }

            const cmpBtn = document.getElementById('daw-deck-comp-toggle-btn');
            if (cmpBtn && !cmpBtn._bound) {
                cmpBtn._bound = true;
                cmpBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const activeId = daw._activeFxTrackId || (daw.tracks && Object.keys(daw.tracks)[0]) || 'host';
                    const tr = daw.tracks && daw.tracks[activeId];
                    if (!tr) return;
                    if (!tr.plugins) tr.plugins = defaultPluginState();
                    tr.plugins.comp.enabled = !tr.plugins.comp.enabled;
                    if (typeof rebuildTrackBusFx === 'function') {
                        rebuildTrackBusFx(activeId, tr.plugins);
                    }
                    syncActiveTrackToDeck();
                });
            }

            // Compressor Model Cycler Button (Modern / LA-2A / 1176 / SSL)
            const compModelBtn = document.getElementById('daw-deck-comp-model-badge');
            if (compModelBtn && !compModelBtn._bound) {
                compModelBtn._bound = true;
                compModelBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const activeId = daw._activeFxTrackId || (daw.tracks && Object.keys(daw.tracks)[0]) || 'host';
                    const tr = daw.tracks && daw.tracks[activeId];
                    if (!tr) return;
                    if (!tr.plugins) tr.plugins = defaultPluginState();
                    if (!tr.plugins.comp) tr.plugins.comp = { enabled: true, threshold: -24, ratio: 3.5, attack: 0.003, release: 0.25, model: 'modern' };

                    const currentModel = (tr.plugins.comp.model || 'modern').toLowerCase();
                    let nextModel = 'modern';
                    let label = 'MODERN';
                    let ratio = 3.5;
                    let attack = 0.003;
                    let release = 0.25;

                    if (currentModel === 'modern') {
                        nextModel = 'la2a';
                        label = 'LA-2A (OPTO)';
                        ratio = 4.0;
                        attack = 0.010;
                        release = 0.40;
                    } else if (currentModel === 'la2a') {
                        nextModel = '1176';
                        label = '1176 (FET)';
                        ratio = 8.0;
                        attack = 0.0002;
                        release = 0.05;
                    } else if (currentModel === '1176') {
                        nextModel = 'ssl';
                        label = 'SSL (VCA)';
                        ratio = 4.0;
                        attack = 0.030;
                        release = 0.10;
                    } else {
                        nextModel = 'modern';
                        label = 'MODERN';
                        ratio = 3.5;
                        attack = 0.003;
                        release = 0.25;
                    }

                    tr.plugins.comp.model = nextModel;
                    tr.plugins.comp.ratio = ratio;
                    tr.plugins.comp.attack = attack;
                    tr.plugins.comp.release = release;
                    tr.plugins.comp.enabled = true;

                    compModelBtn.textContent = label;
                    const ratEl = document.getElementById('daw-deck-comp-rat-val');
                    if (ratEl) ratEl.textContent = `${ratio}:1`;

                    if (typeof rebuildTrackBusFx === 'function') {
                        rebuildTrackBusFx(activeId, tr.plugins);
                    }
                    syncActiveTrackToDeck();
                    showStudioToast(`Comp Model: ${label} [${tr.name}]`);
                });
            }
        };
        bindDeckDspToggleButtons();

        // ─────────────────────────────────────────────────────────────
        // 1. Interactive Deck EQ Curve Engine & Live RTA Spectrum
        // ─────────────────────────────────────────────────────────────
        const renderDeckEqCanvas = (pl, analyserNode = null) => {
            const canvas = document.getElementById('daw-deck-eq-canvas');
            if (!canvas) return;
            const setup = setupCrispCanvas(canvas);
            if (!setup) return;
            const { ctx, w, h } = setup;

            const xToFreq = (x) => 20 * Math.pow(1000, Math.max(0, Math.min(w, x)) / w);
            const freqToX = (f) => Math.max(0, Math.min(w, (Math.log10(Math.max(20, Math.min(20000, f)) / 20) / 3) * w));
            const dbToY = (db) => (h / 2) - (db / 16) * (h / 2 - 12);
            const yToDb = (y) => Math.round(((h / 2 - y) / (h / 2 - 12)) * 16);

            ctx.fillStyle = '#030508';
            ctx.fillRect(0, 0, w, h);

            // Reference dB lines (+12, +6, 0, -6, -12 dB)
            [-12, -6, 0, 6, 12].forEach(db => {
                const y = dbToY(db);
                ctx.beginPath();
                ctx.strokeStyle = db === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.06)';
                ctx.setLineDash(db === 0 ? [3, 3] : []);
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
                ctx.font = '7.5px monospace';
                ctx.fillText(`${db > 0 ? '+' : ''}${db}dB`, 4, y - 2);
            });

            // Vertical Frequency guide markers (100Hz, 1kHz, 10kHz)
            [100, 1000, 10000].forEach(f => {
                const x = freqToX(f);
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(255,255,255,0.06)';
                ctx.moveTo(x, 0);
                ctx.lineTo(x, h);
                ctx.stroke();
                ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.font = '7.5px monospace';
                ctx.fillText(f >= 1000 ? `${f / 1000}k` : `${f}Hz`, x + 3, h - 3);
            });

            // Live RTA Spectrum Fill from Web Audio Analyser
            if (analyserNode) {
                try {
                    const fData = new Uint8Array(analyserNode.frequencyBinCount);
                    analyserNode.getByteFrequencyData(fData);
                    ctx.fillStyle = 'rgba(52, 211, 153, 0.16)';
                    ctx.beginPath();
                    ctx.moveTo(0, h);
                    const step = 4;
                    for (let px = 0; px <= w; px += step) {
                        const freq = xToFreq(px);
                        const bin = Math.min(fData.length - 1, Math.round((freq / (analyserNode.context.sampleRate / 2)) * fData.length));
                        const val = fData[bin] || 0;
                        const rtaY = h - (val / 255) * (h * 0.88);
                        ctx.lineTo(px, rtaY);
                    }
                    ctx.lineTo(w, h);
                    ctx.closePath();
                    ctx.fill();

                    // Glowing top stroke for RTA spectrum
                    ctx.strokeStyle = 'rgba(52, 211, 153, 0.4)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                } catch (e) {}
            }

            const lowG = pl?.eq?.low || 0;
            const midG = pl?.eq?.mid || 0;
            const highG = pl?.eq?.high || 0;
            const isCut = !!pl?.eq?.lowCut;
            const isEqOn = !!pl?.eq?.enabled;

            const calcGainAtFreq = (f) => {
                let g = 0;
                if (isCut && f <= 80) {
                    g += Math.max(-28, 16 * Math.log2(f / 80));
                }
                g += lowG / (1 + Math.pow(f / 120, 1.8));
                g += midG * Math.exp(-Math.pow(Math.log2(f / 2500), 2) / (2 * 0.75 * 0.75));
                g += highG / (1 + Math.pow(9000 / f, 1.8));
                return g;
            };

            // EQ Filter Response Curve
            ctx.beginPath();
            const startGain = calcGainAtFreq(20);
            ctx.moveTo(0, dbToY(startGain));

            for (let px = 0; px <= w; px += 3) {
                const f = xToFreq(px);
                const g = calcGainAtFreq(f);
                const y = Math.max(3, Math.min(h - 3, dbToY(g)));
                ctx.lineTo(px, y);
            }

            if (isEqOn) {
                ctx.strokeStyle = '#34d399';
                ctx.lineWidth = 2.2;
                ctx.stroke();

                // Luminous subtle gradient beneath the curve to zero line
                const zeroY = dbToY(0);
                ctx.lineTo(w, zeroY);
                ctx.lineTo(0, zeroY);
                ctx.closePath();
                const grad = ctx.createLinearGradient(0, 0, 0, h);
                grad.addColorStop(0, 'rgba(52, 211, 153, 0.24)');
                grad.addColorStop(0.5, 'rgba(52, 211, 153, 0.05)');
                grad.addColorStop(1, 'rgba(52, 211, 153, 0.24)');
                ctx.fillStyle = grad;
                ctx.fill();
            } else {
                ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)';
                ctx.lineWidth = 1.6;
                ctx.setLineDash([4, 3]);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Four Interactive Control Nodes (HPF, Low, Mid, Air)
            const nodes = [
                { id: 'hpf', x: freqToX(80), y: dbToY(isCut ? -12 : 0), color: isCut ? '#34d399' : '#64748b', label: 'HPF', gain: isCut ? -12 : 0 },
                { id: 'low', x: freqToX(120), y: dbToY(lowG), color: '#0a84ff', label: '120Hz', gain: lowG },
                { id: 'mid', x: freqToX(2500), y: dbToY(midG), color: '#34d399', label: '2.5k', gain: midG },
                { id: 'high', x: freqToX(9000), y: dbToY(highG), color: '#c084fc', label: '9k', gain: highG }
            ];
            canvas._eqNodes = nodes;

            nodes.forEach(node => {
                // Outer ring
                ctx.beginPath();
                ctx.arc(node.x, node.y, 6.5, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fill();
                ctx.strokeStyle = node.color;
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // Center dot
                ctx.beginPath();
                ctx.arc(node.x, node.y, 3.5, 0, Math.PI * 2);
                ctx.fillStyle = node.color;
                ctx.fill();

                // Label pill
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.font = '8px monospace';
                ctx.fillText(node.label, Math.max(4, node.x - 10), Math.max(12, node.y - 9));
            });

            // FabFilter-Style HUD Tooltip on Hover / Drag
            const activeNodeId = canvas._draggingNodeId || canvas._hoveredNodeId;
            const activeNode = activeNodeId ? nodes.find(n => n.id === activeNodeId) : null;
            if (activeNode) {
                const hudText = activeNode.id === 'hpf'
                    ? `HPF: 80Hz (${isCut ? 'ACTIVE -12dB/oct' : 'BYPASS'})`
                    : `${activeNode.label}: ${(activeNode.gain > 0 ? '+' : '') + activeNode.gain.toFixed(1)} dB`;
                ctx.font = 'bold 8.5px monospace';
                const textWidth = ctx.measureText(hudText).width;
                const hudW = textWidth + 12;
                const hudH = 16;
                const hudX = Math.max(6, Math.min(w - hudW - 6, activeNode.x - hudW / 2));
                const hudY = Math.max(6, activeNode.y - 24);

                ctx.fillStyle = 'rgba(3, 5, 9, 0.92)';
                ctx.strokeStyle = activeNode.color;
                ctx.lineWidth = 1;
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(hudX, hudY, hudW, hudH, 3);
                else ctx.rect(hudX, hudY, hudW, hudH);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#ffffff';
                ctx.fillText(hudText, hudX + 6, hudY + 11);
            }

            // Bind mouse dragging on canvas once
            if (!canvas._engineBound) {
                canvas._engineBound = true;
                let draggingNodeId = null;

                canvas.addEventListener('mousedown', (e) => {
                    if (e.button !== 0) return;
                    const rect = canvas.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const clickY = e.clientY - rect.top;

                    const curNodes = canvas._eqNodes || [];
                    let closest = null;
                    let minDist = 24;
                    curNodes.forEach(n => {
                        const d = Math.hypot(n.x - clickX, n.y - clickY);
                        if (d < minDist) { minDist = d; closest = n; }
                    });

                    if (!closest) return;

                    const activeId = daw._activeFxTrackId || (daw.tracks && Object.keys(daw.tracks)[0]) || 'host';
                    const tr = daw.tracks && daw.tracks[activeId];
                    if (!tr) return;
                    if (!tr.plugins) tr.plugins = defaultPluginState();

                    // Auto-enable EQ on user interaction
                    tr.plugins.eq.enabled = true;
                    const eqBtn = document.getElementById('daw-deck-eq-toggle-btn');
                    if (eqBtn) {
                        eqBtn.textContent = 'EQ: ACTIVE';
                        eqBtn.style.color = '#34d399';
                        eqBtn.style.borderColor = 'rgba(52,211,153,0.4)';
                    }

                    if (closest.id === 'hpf') {
                        tr.plugins.eq.lowCut = !tr.plugins.eq.lowCut;
                        const hpfEl = document.getElementById('daw-deck-eq-hpf-val');
                        if (hpfEl) hpfEl.textContent = tr.plugins.eq.lowCut ? '80Hz ON' : 'OFF';
                        if (typeof rebuildTrackBusFx === 'function') rebuildTrackBusFx(activeId, tr.plugins);
                        renderDeckEqCanvas(tr.plugins);
                        return;
                    }

                    draggingNodeId = closest.id;
                    canvas._draggingNodeId = closest.id;

                    const onMove = (moveEv) => {
                        if (!draggingNodeId) return;
                        const mRect = canvas.getBoundingClientRect();
                        const curY = moveEv.clientY - mRect.top;
                        const newDb = Math.max(-15, Math.min(15, yToDb(curY)));

                        tr.plugins.eq.enabled = true;
                        if (draggingNodeId === 'low') {
                            tr.plugins.eq.low = newDb;
                            const el = document.getElementById('daw-deck-eq-low-val');
                            if (el) el.textContent = `${newDb > 0 ? '+' : ''}${newDb} dB`;
                            if (daw.trackBuses && daw.trackBuses[activeId]?.fx?.eqLow) {
                                try { daw.trackBuses[activeId].fx.eqLow.gain.setValueAtTime(newDb, daw.audioCtx.currentTime); } catch (e) {}
                            }
                        } else if (draggingNodeId === 'mid') {
                            tr.plugins.eq.mid = newDb;
                            const el = document.getElementById('daw-deck-eq-mid-val');
                            if (el) el.textContent = `${newDb > 0 ? '+' : ''}${newDb} dB`;
                            if (daw.trackBuses && daw.trackBuses[activeId]?.fx?.eqMid) {
                                try { daw.trackBuses[activeId].fx.eqMid.gain.setValueAtTime(newDb, daw.audioCtx.currentTime); } catch (e) {}
                            }
                        } else if (draggingNodeId === 'high') {
                            tr.plugins.eq.high = newDb;
                            const el = document.getElementById('daw-deck-eq-high-val');
                            if (el) el.textContent = `${newDb > 0 ? '+' : ''}${newDb} dB`;
                            if (daw.trackBuses && daw.trackBuses[activeId]?.fx?.eqHigh) {
                                try { daw.trackBuses[activeId].fx.eqHigh.gain.setValueAtTime(newDb, daw.audioCtx.currentTime); } catch (e) {}
                            }
                        }
                        renderDeckEqCanvas(tr.plugins);
                    };

                    const onUp = () => {
                        draggingNodeId = null;
                        canvas._draggingNodeId = null;
                        window.removeEventListener('mousemove', onMove);
                        window.removeEventListener('mouseup', onUp);
                    };

                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                });

                canvas.addEventListener('mousemove', (e) => {
                    if (draggingNodeId) return;
                    const rect = canvas.getBoundingClientRect();
                    const mouseX = e.clientX - rect.left;
                    const mouseY = e.clientY - rect.top;
                    const curNodes = canvas._eqNodes || [];
                    const hovered = curNodes.find(n => Math.hypot(n.x - mouseX, n.y - mouseY) < 22);
                    canvas.style.cursor = hovered ? 'ns-resize' : 'crosshair';
                    const newHoverId = hovered ? hovered.id : null;
                    if (canvas._hoveredNodeId !== newHoverId) {
                        canvas._hoveredNodeId = newHoverId;
                        const activeId = daw._activeFxTrackId || (daw.tracks && Object.keys(daw.tracks)[0]) || 'host';
                        const tr = daw.tracks && daw.tracks[activeId];
                        renderDeckEqCanvas(tr?.plugins);
                    }
                });

                canvas.addEventListener('mouseleave', () => {
                    if (canvas._hoveredNodeId) {
                        canvas._hoveredNodeId = null;
                        const activeId = daw._activeFxTrackId || (daw.tracks && Object.keys(daw.tracks)[0]) || 'host';
                        const tr = daw.tracks && daw.tracks[activeId];
                        renderDeckEqCanvas(tr?.plugins);
                    }
                });
            }
        };
        window._renderDeckEqCanvas = renderDeckEqCanvas;

        // ─────────────────────────────────────────────────────────────
        // 2. Interactive Dynamics Compressor Curve & Telemetry Ball
        // ─────────────────────────────────────────────────────────────
        const renderDeckCompCanvas = (pl, inputDb = null, grDb = 0) => {
            const canvas = document.getElementById('daw-deck-comp-canvas');
            if (!canvas) return;
            const setup = setupCrispCanvas(canvas);
            if (!setup) return;
            const { ctx, w, h } = setup;

            ctx.fillStyle = '#030508';
            ctx.fillRect(0, 0, w, h);

            [-48, -36, -24, -12, 0].forEach(db => {
                const x = ((db - (-60)) / 60) * w;
                const y = h - ((db - (-60)) / 60) * h;
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(255,255,255,0.06)';
                ctx.moveTo(x, 0); ctx.lineTo(x, h);
                ctx.moveTo(0, y); ctx.lineTo(w, y);
                ctx.stroke();

                ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
                ctx.font = '7.5px monospace';
                ctx.fillText(`${db}dB`, x + 3, h - 3);
            });

            // 1:1 unity line
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.setLineDash([2, 2]);
            ctx.moveTo(0, h);
            ctx.lineTo(w, 0);
            ctx.stroke();
            ctx.setLineDash([]);

            const isCmpOn = !!pl?.comp?.enabled;
            const thresh = pl?.comp?.threshold !== undefined ? pl.comp.threshold : -24;
            const ratio = pl?.comp?.ratio || 3.5;
            const knee = 8;

            const calcOutDb = (inDb) => {
                if (!isCmpOn) return inDb;
                const halfKnee = knee / 2;
                if (inDb < thresh - halfKnee) return inDb;
                if (inDb > thresh + halfKnee) return thresh + (inDb - thresh) / ratio;
                return inDb + ((1 / ratio - 1) * Math.pow(inDb - thresh + halfKnee, 2)) / (2 * knee);
            };

            ctx.beginPath();
            for (let inDb = -60; inDb <= 0; inDb += 1.5) {
                const outDb = calcOutDb(inDb);
                const x = ((inDb - (-60)) / 60) * w;
                const y = h - ((outDb - (-60)) / 60) * h;
                if (inDb === -60) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = isCmpOn ? '#22d3ee' : 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 2.0;
            ctx.stroke();

            // Threshold Knee Node
            const threshX = ((thresh - (-60)) / 60) * w;
            const threshY = h - ((calcOutDb(thresh) - (-60)) / 60) * h;
            ctx.beginPath();
            ctx.arc(threshX, threshY, 6, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fill();
            ctx.strokeStyle = isCmpOn ? '#22d3ee' : '#64748b';
            ctx.lineWidth = 1.6;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(threshX, threshY, 3, 0, Math.PI * 2);
            ctx.fillStyle = isCmpOn ? '#0a84ff' : '#64748b';
            ctx.fill();

            // Live Dynamics Ball & Gain Reduction Trail
            if (typeof inputDb === 'number' && Number.isFinite(inputDb) && inputDb > -60) {
                const clampedIn = Math.max(-60, Math.min(0, inputDb));
                const outDb = calcOutDb(clampedIn);
                const ballX = ((clampedIn - (-60)) / 60) * w;
                const ballY = h - ((outDb - (-60)) / 60) * h;

                // Vertical GR line down to unity
                if (isCmpOn && clampedIn > thresh) {
                    const unityY = h - ((clampedIn - (-60)) / 60) * h;
                    ctx.beginPath();
                    ctx.strokeStyle = 'rgba(255, 69, 58, 0.75)';
                    ctx.lineWidth = 1.8;
                    ctx.moveTo(ballX, unityY);
                    ctx.lineTo(ballX, ballY);
                    ctx.stroke();
                }

                // Pulsing glowing cyan ball
                ctx.beginPath();
                ctx.arc(ballX, ballY, 5, 0, Math.PI * 2);
                ctx.fillStyle = '#22d3ee';
                ctx.shadowColor = '#22d3ee';
                ctx.shadowBlur = 8;
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            // Update GR meters on deck UI
            const grFill = document.getElementById('daw-deck-comp-gr-fill');
            const grVal = document.getElementById('daw-deck-comp-gr-val');
            if (grFill && grVal) {
                const reduction = Math.max(0, grDb);
                grFill.style.width = `${Math.min(100, (reduction / 18) * 100)}%`;
                grVal.textContent = `-${reduction.toFixed(1)} dB`;
            }

            // Bind threshold dragging on compressor canvas once
            if (!canvas._engineBound) {
                canvas._engineBound = true;
                let draggingKnee = false;

                canvas.addEventListener('mousedown', (e) => {
                    if (e.button !== 0) return;
                    const activeId = daw._activeFxTrackId || (daw.tracks && Object.keys(daw.tracks)[0]) || 'host';
                    const tr = daw.tracks && daw.tracks[activeId];
                    if (!tr) return;
                    if (!tr.plugins) tr.plugins = defaultPluginState();

                    draggingKnee = true;
                    tr.plugins.comp.enabled = true;
                    const cmpBtn = document.getElementById('daw-deck-comp-toggle-btn');
                    if (cmpBtn) {
                        cmpBtn.textContent = 'CMP: ACTIVE';
                        cmpBtn.style.color = '#22d3ee';
                        cmpBtn.style.borderColor = 'rgba(34,211,238,0.4)';
                    }

                    const onMove = (moveEv) => {
                        if (!draggingKnee) return;
                        const rect = canvas.getBoundingClientRect();
                        const mouseX = Math.max(0, Math.min(rect.width, moveEv.clientX - rect.left));
                        const mouseY = Math.max(0, Math.min(rect.height, moveEv.clientY - rect.top));

                        const newThresh = Math.round(-60 + (mouseX / rect.width) * 60);
                        const clampedThresh = Math.max(-60, Math.min(0, newThresh));

                        // Ratio from vertical position
                        const yFrac = 1 - (mouseY / rect.height);
                        const newRatio = Math.max(1.1, Math.min(20, Math.round((1 + yFrac * 10) * 10) / 10));

                        tr.plugins.comp.threshold = clampedThresh;
                        tr.plugins.comp.ratio = newRatio;
                        tr.plugins.comp.enabled = true;

                        const thrEl = document.getElementById('daw-deck-comp-thr-val');
                        if (thrEl) thrEl.textContent = `${clampedThresh}dB`;
                        const ratEl = document.getElementById('daw-deck-comp-rat-val');
                        if (ratEl) ratEl.textContent = `${newRatio}:1`;

                        if (daw.trackBuses && daw.trackBuses[activeId]?.fx?.compNode) {
                            try {
                                daw.trackBuses[activeId].fx.compNode.threshold.setValueAtTime(clampedThresh, daw.audioCtx.currentTime);
                                daw.trackBuses[activeId].fx.compNode.ratio.setValueAtTime(newRatio, daw.audioCtx.currentTime);
                            } catch (err) {}
                        }
                        renderDeckCompCanvas(tr.plugins);
                    };

                    const onUp = () => {
                        draggingKnee = false;
                        window.removeEventListener('mousemove', onMove);
                        window.removeEventListener('mouseup', onUp);
                    };

                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                });

                canvas.addEventListener('mousemove', (e) => {
                    if (draggingKnee) return;
                    const rect = canvas.getBoundingClientRect();
                    const mouseX = e.clientX - rect.left;
                    const mouseY = e.clientY - rect.top;
                    const threshX = ((thresh - (-60)) / 60) * rect.width;
                    const threshY = rect.height - ((calcOutDb(thresh) - (-60)) / 60) * rect.height;
                    const isNear = Math.hypot(threshX - mouseX, threshY - mouseY) < 22;
                    canvas.style.cursor = isNear ? 'grab' : 'crosshair';
                });
            }
        };
        window._renderDeckCompCanvas = renderDeckCompCanvas;

        // Render Mixer Console Strips (Tracks + Master Bus Strip with Rotary Pan & Real-Time Sync)
        const renderMixerStrips = () => {
            const container = document.getElementById('daw-deck-mixer-strips-container');
            if (!container || !daw.tracks) return;

            const trackStripsHtml = Object.values(daw.tracks).map(t => {
                const isSelected = (daw._activeFxTrackId === t.id);
                const isMuted = !!t.muted;
                const isSolo = !!t.solo;
                const volVal = t.vol !== undefined ? t.vol : 1.0;
                const volPct = Math.round(volVal * 100);
                const panVal = t.pan !== undefined ? t.pan : 0;
                const panAngle = panVal * 135;
                const panCompact = typeof formatPanCompact === 'function' ? formatPanCompact(panVal) : (panVal === 0 ? 'C' : (panVal < 0 ? `L${Math.round(-panVal * 50)}` : `R${Math.round(panVal * 50)}`));

                return `
                    <div class="daw-mixer-strip" data-track-id="${t.id}" style="width: 88px; min-width: 88px; background: ${isSelected ? 'rgba(10, 132, 255, 0.09)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${isSelected ? 'rgba(10, 132, 255, 0.5)' : 'rgba(255,255,255,0.08)'}; border-radius: 6px; padding: 6px 7px; display: flex; flex-direction: column; justify-content: space-between; align-items: center; user-select: none; cursor: pointer; transition: all 0.15s; flex-shrink: 0; box-shadow: ${isSelected ? '0 0 12px rgba(10, 132, 255, 0.15)' : 'none'};">
                        <div style="width: 100%; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; font-weight: 800; color: #ffffff;" title="${t.name}">
                            ${t.name}
                        </div>
                        <div style="font-size: 8px; font-family: monospace; color: ${t.color || '#0a84ff'}; font-weight: 700;">
                            ${t.channels === 'stereo' ? 'STEREO' : 'MONO'}
                        </div>

                        <!-- Rotary Pan Dial -->
                        <div class="daw-mixer-pan-container" data-track="${t.id}" title="Pan: ${panCompact} (Drag to adjust. Double-click to Center)" style="display: flex; flex-direction: column; align-items: center; gap: 2px; margin: 3px 0; cursor: ns-resize;">
                            <div class="track-pan-dial-knob" data-track="${t.id}" style="width: 22px; height: 22px;">
                                <div class="track-pan-dial-needle" data-track="${t.id}" style="transform: rotate(${panAngle}deg);"></div>
                                <div class="track-pan-dial-center-dot"></div>
                            </div>
                            <span class="track-pan-readout" id="daw-mixer-pan-readout-${t.id}" data-track="${t.id}">${panCompact}</span>
                        </div>

                        <!-- Mini Meter + Vertical Slider Body -->
                        <div style="display: flex; gap: 5px; height: 95px; align-items: center; justify-content: center; width: 100%; margin: 2px 0;">
                            <!-- Tiny Peak VU Bar -->
                            <div style="width: 6px; height: 100%; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end;">
                                <div id="daw-mixer-vu-${t.id}" style="width: 100%; height: 0%; background: linear-gradient(0deg, #30d158 0%, #ff9f0a 75%, #ff453a 100%);"></div>
                            </div>
                            <!-- Vertical Fader -->
                            <input type="range" class="daw-mixer-fader" data-track="${t.id}" min="0" max="1.5" step="0.05" value="${volVal}" orient="vertical" style="writing-mode: bt-lr; -webkit-appearance: slider-vertical; width: 22px; height: 100%; accent-color: ${t.color || '#0a84ff'}; cursor: pointer;">
                        </div>

                        <div class="daw-mixer-vol-pct" style="font-size: 8.5px; font-family: monospace; color: rgba(255,255,255,0.7);">${volPct}%</div>

                        <!-- Mute / Solo Buttons -->
                        <div style="display: flex; gap: 4px; width: 100%; margin-top: 4px;">
                            <button type="button" class="daw-mixer-mute-btn" data-track="${t.id}" style="flex: 1; background: ${isMuted ? '#ff453a' : 'rgba(255,255,255,0.06)'}; border: 1px solid ${isMuted ? '#ff453a' : 'rgba(255,255,255,0.15)'}; color: #fff; font-size: 8.5px; font-weight: 800; padding: 2px 0; border-radius: 3px; cursor: pointer;">M</button>
                            <button type="button" class="daw-mixer-solo-btn" data-track="${t.id}" style="flex: 1; background: ${isSolo ? '#eab308' : 'rgba(255,255,255,0.06)'}; border: 1px solid ${isSolo ? '#eab308' : 'rgba(255,255,255,0.15)'}; color: ${isSolo ? '#000' : '#fff'}; font-size: 8.5px; font-weight: 800; padding: 2px 0; border-radius: 3px; cursor: pointer;">S</button>
                        </div>
                    </div>
                `;
            }).join('');

            // Master Channel Strip
            const curMasterVol = (typeof daw.masterVol === 'number' && Number.isFinite(daw.masterVol)) ? daw.masterVol : 1.0;
            const masterVolPct = Math.round(curMasterVol * 100);

            const masterStripHtml = `
                <div style="width: 1px; height: 100%; background: rgba(255,255,255,0.15); margin: 0 4px; flex-shrink: 0;"></div>
                <div id="daw-mixer-master-strip" style="width: 96px; min-width: 96px; background: rgba(10, 14, 22, 0.95); border: 1px solid rgba(10, 132, 255, 0.45); border-radius: 6px; padding: 6px 8px; display: flex; flex-direction: column; justify-content: space-between; align-items: center; user-select: none; flex-shrink: 0; box-shadow: 0 0 16px rgba(0,0,0,0.8);">
                    <div style="width: 100%; text-align: center; font-size: 10px; font-weight: 800; color: #0a84ff; display: flex; align-items: center; justify-content: center; gap: 4px;">
                        <span style="width: 6px; height: 6px; border-radius: 50%; background: #0a84ff; box-shadow: 0 0 6px #0a84ff;"></span>
                        <span>MASTER</span>
                    </div>
                    <div style="font-size: 8px; font-family: monospace; color: rgba(255,255,255,0.5); font-weight: 700;">
                        STEREO OUT
                    </div>

                    <!-- Master Twin Meter + Vertical Master Fader Body -->
                    <div style="display: flex; gap: 5px; height: 95px; align-items: center; justify-content: center; width: 100%; margin: 2px 0;">
                        <!-- Twin Peak VU Bars (L/R) -->
                        <div style="display: flex; gap: 2px; height: 100%;">
                            <div style="width: 5px; height: 100%; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end;" title="Master Left Peak">
                                <div id="daw-deck-mixer-master-vu-l" style="width: 100%; height: 0%; background: linear-gradient(0deg, #30d158 0%, #ff9f0a 75%, #ff453a 100%);"></div>
                            </div>
                            <div style="width: 5px; height: 100%; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end;" title="Master Right Peak">
                                <div id="daw-deck-mixer-master-vu-r" style="width: 100%; height: 0%; background: linear-gradient(0deg, #30d158 0%, #ff9f0a 75%, #ff453a 100%);"></div>
                            </div>
                        </div>
                        <!-- Vertical Master Fader -->
                        <input type="range" id="daw-deck-mixer-master-fader" min="0" max="1.5" step="0.02" value="${curMasterVol}" orient="vertical" style="writing-mode: bt-lr; -webkit-appearance: slider-vertical; width: 22px; height: 100%; accent-color: #0a84ff; cursor: pointer;">
                    </div>

                    <div id="daw-deck-mixer-master-vol-pct" style="font-size: 8.5px; font-family: monospace; color: #0a84ff; font-weight: 700;">${masterVolPct}%</div>

                    <!-- Master Controls: Mute & Mono -->
                    <div style="display: flex; gap: 4px; width: 100%; margin-top: 4px;">
                        <button type="button" id="daw-deck-mixer-master-mute-btn" style="flex: 1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #fff; font-size: 8px; font-weight: 800; padding: 2px 0; border-radius: 3px; cursor: pointer;" title="Master Output Mute">M</button>
                        <button type="button" id="daw-deck-mixer-master-mono-btn" style="flex: 1.4; background: ${daw._isMasterMono ? 'rgba(10, 132, 255, 0.25)' : 'rgba(255,255,255,0.06)'}; border: 1px solid ${daw._isMasterMono ? 'rgba(10, 132, 255, 0.5)' : 'rgba(255,255,255,0.15)'}; color: ${daw._isMasterMono ? '#0a84ff' : '#fff'}; font-size: 7.5px; font-weight: 800; padding: 2px 0; border-radius: 3px; cursor: pointer;" title="Toggle Stereo / True Mono Downmix">MONO</button>
                    </div>
                </div>
            `;

            let emptyMixerHtml = '';
            if (Object.values(daw.tracks).length === 0) {
                emptyMixerHtml = `
                    <div class="daw-mixer-empty-state" style="width: 130px; min-width: 130px; border: 1px dashed rgba(255,255,255,0.12); border-radius: 6px; padding: 12px 8px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; color: rgba(255,255,255,0.45); cursor: pointer; user-select: none;" title="Double-click here to add an empty track">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true" style="margin-bottom: 6px; opacity: 0.6;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                        <span style="font-size: 10px; font-weight: 800; color: #ffffff; margin-bottom: 2px;">No Tracks</span>
                        <span style="font-size: 8.5px; color: rgba(255,255,255,0.45);">Double-click to add track</span>
                    </div>
                `;
            }

            container.innerHTML = trackStripsHtml + emptyMixerHtml + masterStripHtml;

            // Bind Individual Strip selection & double-click to delete
            container.querySelectorAll('.daw-mixer-strip').forEach(strip => {
                strip.onclick = (e) => {
                    if (e.target.closest('input') || e.target.closest('button') || e.target.closest('.daw-mixer-pan-container')) return;
                    const trId = strip.getAttribute('data-track-id');
                    if (trId) {
                        daw._activeFxTrackId = trId;
                        syncActiveTrackToDeck();
                        renderMixerStrips();
                        renderDawTracks();
                    }
                };
                strip.ondblclick = (e) => {
                    if (e.target.closest('input') || e.target.closest('button') || e.target.closest('.daw-mixer-pan-container')) return;
                    e.stopPropagation();
                    const trId = strip.getAttribute('data-track-id');
                    if (trId) deleteTrackPrompt(trId);
                };
            });

            // Double click on empty space in mixer strips container adds an empty track
            container.ondblclick = (e) => {
                if (e.target.closest('.daw-mixer-strip') || e.target.closest('#daw-mixer-master-strip')) return;
                e.stopPropagation();
                addNewEmptyTrack('audio');
            };

            // Bind Live Faders with Real-Time Audio Modulation
            container.querySelectorAll('.daw-mixer-fader').forEach(slider => {
                slider.oninput = (e) => {
                    const trId = slider.getAttribute('data-track');
                    const val = parseFloat(slider.value) || 0;
                    if (daw.tracks[trId]) {
                        daw.tracks[trId].vol = val;
                        if (typeof updateTrackBusLive === 'function') {
                            updateTrackBusLive(trId);
                        }
                        const pctEl = slider.closest('.daw-mixer-strip')?.querySelector('.daw-mixer-vol-pct');
                        if (pctEl) pctEl.textContent = `${Math.round(val * 100)}%`;
                        const sideSlider = document.querySelector(`.track-vol-slider[data-track="${trId}"]`);
                        if (sideSlider) sideSlider.value = val;
                    }
                };
            });

            // Bind Rotary Pan Dials on Mixer Strips
            container.querySelectorAll('.daw-mixer-pan-container').forEach(panContainer => {
                const trId = panContainer.getAttribute('data-track');
                if (!trId || !daw.tracks[trId]) return;

                const resetPan = () => {
                    pushDawHistory('Center Track Pan');
                    daw.tracks[trId].pan = 0;
                    if (typeof updateTrackBusLive === 'function') updateTrackBusLive(trId);

                    const needle = panContainer.querySelector('.track-pan-dial-needle');
                    if (needle) needle.style.transform = 'rotate(0deg)';
                    const readout = document.getElementById(`daw-mixer-pan-readout-${trId}`);
                    if (readout) readout.textContent = 'C';

                    // Sync left track header pan
                    const sideNeedle = document.querySelector(`.track-pan-dial-needle[data-track="${trId}"]`);
                    if (sideNeedle) sideNeedle.style.transform = 'rotate(0deg)';
                    const sideReadout = document.getElementById(`track-pan-readout-${trId}`);
                    if (sideReadout) sideReadout.textContent = 'C';
                };

                panContainer.ondblclick = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    resetPan();
                };

                panContainer.onmousedown = (e) => {
                    if (e.button !== 0) return;
                    e.stopPropagation();
                    e.preventDefault();

                    const startY = e.clientY;
                    const initialPan = daw.tracks[trId].pan !== undefined ? daw.tracks[trId].pan : 0;
                    const needle = panContainer.querySelector('.track-pan-dial-needle');
                    const readout = document.getElementById(`daw-mixer-pan-readout-${trId}`);

                    const onMove = (moveEv) => {
                        const dy = startY - moveEv.clientY;
                        const sensitivity = moveEv.shiftKey ? 0.002 : 0.008;
                        let newPan = Math.max(-1, Math.min(1, initialPan + dy * sensitivity));

                        // 8% Center Snap
                        if (Math.abs(newPan) < 0.08) newPan = 0;

                        daw.tracks[trId].pan = newPan;
                        if (typeof updateTrackBusLive === 'function') updateTrackBusLive(trId);

                        if (needle) needle.style.transform = `rotate(${newPan * 135}deg)`;
                        const compStr = typeof formatPanCompact === 'function' ? formatPanCompact(newPan) : (newPan === 0 ? 'C' : (newPan < 0 ? `L${Math.round(-newPan * 50)}` : `R${Math.round(newPan * 50)}`));
                        if (readout) readout.textContent = compStr;

                        // Sync sidebar pan
                        const sideNeedle = document.querySelector(`.track-pan-dial-needle[data-track="${trId}"]`);
                        if (sideNeedle) sideNeedle.style.transform = `rotate(${newPan * 135}deg)`;
                        const sideReadout = document.getElementById(`track-pan-readout-${trId}`);
                        if (sideReadout) sideReadout.textContent = compStr;
                    };

                    const onUp = () => {
                        window.removeEventListener('mousemove', onMove);
                        window.removeEventListener('mouseup', onUp);
                    };

                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                };
            });

            // Bind Mute Buttons with Real-Time Audio Isolation
            container.querySelectorAll('.daw-mixer-mute-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const trId = btn.getAttribute('data-track');
                    if (daw.tracks[trId]) {
                        daw.tracks[trId].muted = !daw.tracks[trId].muted;
                        if (typeof refreshAllTrackBusMutes === 'function') {
                            refreshAllTrackBusMutes();
                        }
                        btn.style.background = daw.tracks[trId].muted ? '#ff453a' : 'rgba(255,255,255,0.06)';
                        btn.style.borderColor = daw.tracks[trId].muted ? '#ff453a' : 'rgba(255,255,255,0.15)';
                        // Sync sidebar mute button
                        const sideMute = document.querySelector(`.track-mute-btn[data-track-id="${trId}"]`);
                        if (sideMute) {
                            sideMute.classList.toggle('active', daw.tracks[trId].muted);
                        }
                    }
                };
            });

            // Bind Solo Buttons with Real-Time Audio Isolation
            container.querySelectorAll('.daw-mixer-solo-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const trId = btn.getAttribute('data-track');
                    if (daw.tracks[trId]) {
                        daw.tracks[trId].solo = !daw.tracks[trId].solo;
                        if (typeof refreshAllTrackBusMutes === 'function') {
                            refreshAllTrackBusMutes();
                        }
                        btn.style.background = daw.tracks[trId].solo ? '#eab308' : 'rgba(255,255,255,0.06)';
                        btn.style.borderColor = daw.tracks[trId].solo ? '#eab308' : 'rgba(255,255,255,0.15)';
                        btn.style.color = daw.tracks[trId].solo ? '#000' : '#fff';
                        // Sync sidebar solo button
                        const sideSolo = document.querySelector(`.track-solo-btn[data-track-id="${trId}"]`);
                        if (sideSolo) {
                            sideSolo.classList.toggle('active', daw.tracks[trId].solo);
                        }
                    }
                };
            });

            // Bind Master Fader
            const masterFader = document.getElementById('daw-deck-mixer-master-fader');
            if (masterFader) {
                masterFader.oninput = (e) => {
                    const val = parseFloat(e.target.value) || 1.0;
                    daw.masterVol = val;
                    if (daw.masterGain && daw.audioCtx) {
                        daw.masterGain.gain.setTargetAtTime(val, daw.audioCtx.currentTime, 0.012);
                    }
                    const pctEl = document.getElementById('daw-deck-mixer-master-vol-pct');
                    if (pctEl) pctEl.textContent = `${Math.round(val * 100)}%`;
                    const topMasterSlider = document.getElementById('timeline-master-vol');
                    if (topMasterSlider) topMasterSlider.value = val;
                };
            }

            // Bind Master Mute
            const masterMuteBtn = document.getElementById('daw-deck-mixer-master-mute-btn');
            if (masterMuteBtn) {
                masterMuteBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (!daw.masterGain || !daw.audioCtx) return;
                    daw._isMasterMuted = !daw._isMasterMuted;
                    if (daw._isMasterMuted) {
                        daw._preMuteMasterVol = daw.masterVol || 1.0;
                        daw.masterGain.gain.setTargetAtTime(0, daw.audioCtx.currentTime, 0.01);
                        masterMuteBtn.style.background = '#ff453a';
                        masterMuteBtn.style.borderColor = '#ff453a';
                    } else {
                        const restoreVol = daw._preMuteMasterVol || 1.0;
                        daw.masterGain.gain.setTargetAtTime(restoreVol, daw.audioCtx.currentTime, 0.01);
                        masterMuteBtn.style.background = 'rgba(255,255,255,0.06)';
                        masterMuteBtn.style.borderColor = 'rgba(255,255,255,0.15)';
                    }
                };
            }

            // Bind Master Mono Downmix
            const masterMonoBtn = document.getElementById('daw-deck-mixer-master-mono-btn');
            if (masterMonoBtn) {
                masterMonoBtn.onclick = (e) => {
                    e.stopPropagation();
                    daw._isMasterMono = !daw._isMasterMono;
                    if (daw.masterGain) {
                        try {
                            daw.masterGain.channelCount = daw._isMasterMono ? 1 : 2;
                            daw.masterGain.channelCountMode = 'explicit';
                        } catch (err) {}
                    }
                    masterMonoBtn.style.background = daw._isMasterMono ? 'rgba(10, 132, 255, 0.25)' : 'rgba(255,255,255,0.06)';
                    masterMonoBtn.style.borderColor = daw._isMasterMono ? 'rgba(10, 132, 255, 0.5)' : 'rgba(255,255,255,0.15)';
                    masterMonoBtn.style.color = daw._isMasterMono ? '#0a84ff' : '#fff';
                    showStudioToast(daw._isMasterMono ? 'Master Bus: True Centered Mono' : 'Master Bus: Discrete Stereo');
                };
            }
        };

        // ─────────────────────────────────────────────────────────────
        // 3. Fully Operational Clip Inspector Engine
        // ─────────────────────────────────────────────────────────────
        let _clipAuditionSource = null;

        const renderClipInspector = () => {
            const clipNameEl = document.getElementById('daw-deck-clip-name');
            const clipDurEl = document.getElementById('daw-deck-clip-dur');
            const clipTrackEl = document.getElementById('daw-deck-clip-track-badge');
            const clipFormatEl = document.getElementById('daw-deck-clip-format');
            const clipPeakEl = document.getElementById('daw-deck-clip-peak-badge');
            const placeholder = document.getElementById('daw-deck-clip-wave-placeholder');
            const canvas = document.getElementById('daw-deck-clip-canvas');

            const selectedClip = daw.clips && daw.clips.find(c => c.id === daw.selectedClipId);

            if (!selectedClip) {
                if (clipNameEl) clipNameEl.textContent = 'No Clip Selected';
                if (clipDurEl) clipDurEl.textContent = '0.00s';
                if (clipTrackEl) clipTrackEl.textContent = 'TRACK: ─';
                if (clipFormatEl) clipFormatEl.textContent = '48kHz • Stereo';
                if (clipPeakEl) clipPeakEl.textContent = 'PEAK: -inf dBFS';
                if (placeholder) placeholder.style.display = 'block';
                if (canvas) canvas.style.display = 'none';
                return;
            }

            const activeDur = Math.max(0.01, (selectedClip.trimEnd || selectedClip.duration) - (selectedClip.trimStart || 0));
            const tr = daw.tracks && daw.tracks[selectedClip.trackId];
            if (clipNameEl) clipNameEl.textContent = selectedClip.name || 'Audio Clip';
            if (clipDurEl) clipDurEl.textContent = `${activeDur.toFixed(2)}s`;
            if (clipTrackEl) clipTrackEl.textContent = `TRACK: ${tr?.name || selectedClip.trackId || 'Audio'}`;

            if (selectedClip.buffer) {
                const sr = Math.round(selectedClip.buffer.sampleRate / 1000);
                const chText = selectedClip.buffer.numberOfChannels === 1 ? 'Mono' : 'Stereo';
                if (clipFormatEl) clipFormatEl.textContent = `${sr}kHz • ${chText}`;

                // Calculate Peak dBFS
                let maxP = 0;
                for (let ch = 0; ch < selectedClip.buffer.numberOfChannels; ch++) {
                    const data = selectedClip.buffer.getChannelData(ch);
                    for (let i = 0; i < data.length; i += 200) {
                        const v = Math.abs(data[i]);
                        if (v > maxP) maxP = v;
                    }
                }
                const peakDb = maxP > 0.0001 ? 20 * Math.log10(maxP) : -100;
                if (clipPeakEl) {
                    clipPeakEl.textContent = `PEAK: ${peakDb >= -0.05 ? '0.0' : peakDb.toFixed(1)} dBFS`;
                    clipPeakEl.style.color = peakDb >= -0.1 ? '#ff453a' : '#34d399';
                }
            }

            // Sync Sliders
            const gainSlider = document.getElementById('daw-deck-clip-gain-slider');
            const gainValEl = document.getElementById('daw-deck-clip-gain-val');
            if (gainSlider && gainValEl) {
                const g = selectedClip.gain !== undefined ? selectedClip.gain : 1.0;
                gainSlider.value = g;
                const db = g > 0.001 ? (20 * Math.log10(g)).toFixed(1) : '-inf';
                gainValEl.textContent = `${db >= 0 ? '+' : ''}${db} dB`;
            }

            const fadeInSlider = document.getElementById('daw-deck-clip-fadein-slider');
            const fadeInValEl = document.getElementById('daw-deck-clip-fadein-val');
            if (fadeInSlider && fadeInValEl) {
                const fi = selectedClip.fadeIn || 0;
                fadeInSlider.value = fi;
                fadeInValEl.textContent = `${fi.toFixed(2)}s`;
            }

            const fadeOutSlider = document.getElementById('daw-deck-clip-fadeout-slider');
            const fadeOutValEl = document.getElementById('daw-deck-clip-fadeout-val');
            if (fadeOutSlider && fadeOutValEl) {
                const fo = selectedClip.fadeOut || 0;
                fadeOutSlider.value = fo;
                fadeOutValEl.textContent = `${fo.toFixed(2)}s`;
            }

            // Sync Fade Shape Algorithm Dropdowns
            const fInShapeSelect = document.getElementById('daw-deck-clip-fadein-shape');
            if (fInShapeSelect) fInShapeSelect.value = selectedClip.fadeInShape || 'linear';

            const fOutShapeSelect = document.getElementById('daw-deck-clip-fadeout-shape');
            if (fOutShapeSelect) fOutShapeSelect.value = selectedClip.fadeOutShape || 'linear';

            if (placeholder) placeholder.style.display = 'none';
            if (canvas) {
                canvas.style.display = 'block';
                const setup = setupCrispCanvas(canvas);
                if (!setup) return;
                const { ctx, w, h } = setup;
                ctx.fillStyle = '#030508';
                ctx.fillRect(0, 0, w, h);

                // Zero Crossing Line
                const midY = h / 2;
                ctx.strokeStyle = 'rgba(255,255,255,0.15)';
                ctx.setLineDash([2, 2]);
                ctx.beginPath();
                ctx.moveTo(0, midY); ctx.lineTo(w, midY);
                ctx.stroke();
                ctx.setLineDash([]);

                const peaks = selectedClip.peaks || [];
                if (peaks.length > 0) {
                    const step = 2;
                    const grad = ctx.createLinearGradient(0, 0, 0, h);
                    grad.addColorStop(0, '#38bdf8');
                    grad.addColorStop(0.5, '#0ea5e9');
                    grad.addColorStop(1, '#0284c7');
                    ctx.strokeStyle = grad;
                    ctx.lineWidth = 1.8;
                    ctx.beginPath();
                    for (let x = 0; x < w; x += step) {
                        const idx = Math.floor((x / w) * peaks.length);
                        const p = peaks[idx] || 0.05;
                        const amp = p * (midY - 8);
                        ctx.moveTo(x, midY - amp);
                        ctx.lineTo(x, midY + amp);
                    }
                    ctx.stroke();
                }

                // Dynamic Mathematical Fade In Curve Overlay (Glowing Emerald Green)
                const clipDurSec = Math.max(0.01, (selectedClip.trimEnd || selectedClip.duration) - (selectedClip.trimStart || 0));
                const fIn = selectedClip.fadeIn || 0;
                if (fIn > 0.01) {
                    const fInFrac = Math.min(1.0, fIn / clipDurSec);
                    const fInW = fInFrac * w;
                    const shape = selectedClip.fadeInShape || 'linear';

                    // Soft gradient translucent under-fill
                    ctx.fillStyle = 'rgba(52, 211, 153, 0.12)';
                    ctx.beginPath();
                    ctx.moveTo(0, h);
                    for (let px = 0; px <= fInW; px += 2) {
                        const t = px / fInW;
                        const gain = fadeShapeGain(t, shape, selectedClip.fadeInCurve);
                        const y = h - (gain * h);
                        ctx.lineTo(px, y);
                    }
                    ctx.lineTo(fInW, h);
                    ctx.closePath();
                    ctx.fill();

                    // Glowing curve outline
                    ctx.strokeStyle = '#34d399';
                    ctx.lineWidth = 2.0;
                    ctx.shadowColor = '#34d399';
                    ctx.shadowBlur = 6;
                    ctx.beginPath();
                    for (let px = 0; px <= fInW; px += 2) {
                        const t = px / fInW;
                        const gain = fadeShapeGain(t, shape, selectedClip.fadeInCurve);
                        const y = h - (gain * h);
                        if (px === 0) ctx.moveTo(px, y);
                        else ctx.lineTo(px, y);
                    }
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                }

                // Dynamic Mathematical Fade Out Curve Overlay (Glowing Lavender Purple)
                const fOut = selectedClip.fadeOut || 0;
                if (fOut > 0.01) {
                    const fOutFrac = Math.min(1.0, fOut / clipDurSec);
                    const fOutW = fOutFrac * w;
                    const startX = w - fOutW;
                    const shape = selectedClip.fadeOutShape || 'linear';

                    // Soft gradient translucent under-fill
                    ctx.fillStyle = 'rgba(192, 132, 252, 0.12)';
                    ctx.beginPath();
                    ctx.moveTo(startX, h);
                    for (let px = 0; px <= fOutW; px += 2) {
                        const t = 1 - (px / fOutW);
                        const gain = fadeShapeGain(t, shape, selectedClip.fadeOutCurve);
                        const y = h - (gain * h);
                        ctx.lineTo(startX + px, y);
                    }
                    ctx.lineTo(w, h);
                    ctx.closePath();
                    ctx.fill();

                    // Glowing curve outline
                    ctx.strokeStyle = '#c084fc';
                    ctx.lineWidth = 2.0;
                    ctx.shadowColor = '#c084fc';
                    ctx.shadowBlur = 6;
                    ctx.beginPath();
                    for (let px = 0; px <= fOutW; px += 2) {
                        const t = 1 - (px / fOutW);
                        const gain = fadeShapeGain(t, shape, selectedClip.fadeOutCurve);
                        const y = h - (gain * h);
                        if (px === 0) ctx.moveTo(startX + px, y);
                        else ctx.lineTo(startX + px, y);
                    }
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                }

                // Sync Playhead Scrub line on clip waveform
                window._syncDeckClipScrub = (playheadSec) => {
                    const scrubLine = document.getElementById('daw-deck-clip-scrub-line');
                    if (!scrubLine || !selectedClip) return;
                    const cStart = selectedClip.startOffset || 0;
                    const cDur = (selectedClip.trimEnd || selectedClip.duration) - (selectedClip.trimStart || 0);
                    const cEnd = cStart + cDur;
                    if (playheadSec >= cStart && playheadSec <= cEnd) {
                        const frac = (playheadSec - cStart) / cDur;
                        scrubLine.style.display = 'block';
                        scrubLine.style.left = `${(frac * 100).toFixed(2)}%`;
                    } else {
                        scrubLine.style.display = 'none';
                    }
                };
                window._syncDeckClipScrub(daw.playhead);

                // Click / Scrub to seek playhead directly on waveform
                if (!canvas._scrubBound) {
                    canvas._scrubBound = true;
                    canvas.addEventListener('click', (e) => {
                        const curClip = daw.clips && daw.clips.find(c => c.id === daw.selectedClipId);
                        if (!curClip) return;
                        const rect = canvas.getBoundingClientRect();
                        const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                        const cStart = curClip.startOffset || 0;
                        const cDur = (curClip.trimEnd || curClip.duration) - (curClip.trimStart || 0);
                        daw.playhead = Math.max(0, cStart + frac * cDur);
                        updateDawPlayhead();
                        window._syncDeckClipScrub?.(daw.playhead);
                    });
                }
            }
        };

        window._syncBottomDeckClipInspector = renderClipInspector;

        // Clip Inspector Action Buttons & Sliders
        document.getElementById('daw-deck-clip-normalize-btn')?.addEventListener('click', normalizeSelectedClip);
        document.getElementById('daw-deck-clip-reverse-btn')?.addEventListener('click', reverseSelectedClip);
        document.getElementById('daw-deck-clip-pitch-stretch-btn')?.addEventListener('click', openAudioSuitePitchModal);

        document.getElementById('daw-deck-clip-split-btn')?.addEventListener('click', () => {
            const clip = daw.clips && daw.clips.find(c => c.id === daw.selectedClipId);
            if (!clip) {
                showStudioToast('Select a clip first to split');
                return;
            }
            splitClipAtPlayheadDAW();
        });

        document.getElementById('daw-deck-clip-duplicate-btn')?.addEventListener('click', () => {
            const clip = daw.clips && daw.clips.find(c => c.id === daw.selectedClipId);
            if (!clip) {
                showStudioToast('Select a clip first to duplicate');
                return;
            }
            duplicateSelectedClipDAW();
        });

        // Clip Preview Audition Button
        document.getElementById('daw-deck-clip-play-btn')?.addEventListener('click', () => {
            const clip = daw.clips && daw.clips.find(c => c.id === daw.selectedClipId);
            if (!clip || !clip.buffer) {
                showStudioToast('No audio buffer to preview');
                return;
            }
            if (_clipAuditionSource) {
                try { _clipAuditionSource.stop(); } catch (e) {}
                _clipAuditionSource = null;
                showStudioToast('Preview stopped');
                return;
            }
            try {
                const src = daw.audioCtx.createBufferSource();
                src.buffer = clip.buffer;
                const gain = daw.audioCtx.createGain();
                gain.gain.value = clip.gain || 1.0;
                src.connect(gain);
                gain.connect(daw.audioCtx.destination);
                src.onended = () => { _clipAuditionSource = null; };
                src.start(0, clip.trimStart || 0, (clip.trimEnd || clip.duration) - (clip.trimStart || 0));
                _clipAuditionSource = src;
                showStudioToast(`Auditioning [${clip.name}]`);
            } catch (err) {
                console.error('Preview error:', err);
            }
        });

        // Gain Trim Slider (with Double-Click Reset to 0.0 dB)
        const gainSliderInput = document.getElementById('daw-deck-clip-gain-slider');
        gainSliderInput?.addEventListener('input', (e) => {
            const clip = daw.clips && daw.clips.find(c => c.id === daw.selectedClipId);
            if (!clip) return;
            const val = parseFloat(e.target.value) || 1.0;
            clip.gain = val;
            const valEl = document.getElementById('daw-deck-clip-gain-val');
            if (valEl) {
                const db = val > 0.001 ? (20 * Math.log10(val)).toFixed(1) : '-inf';
                valEl.textContent = `${db >= 0 ? '+' : ''}${db} dB`;
            }
            renderDawClips();
        });

        gainSliderInput?.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            const clip = daw.clips && daw.clips.find(c => c.id === daw.selectedClipId);
            if (!clip) return;
            clip.gain = 1.0;
            gainSliderInput.value = '1.0';
            const valEl = document.getElementById('daw-deck-clip-gain-val');
            if (valEl) valEl.textContent = '0.0 dB';
            renderDawClips();
            if (typeof autoSaveDawSession === 'function') autoSaveDawSession();
            showStudioToast(`Gain reset to 0.0 dB [${clip.name}]`);
        });

        // Fade In Slider & Curve Algorithm
        document.getElementById('daw-deck-clip-fadein-slider')?.addEventListener('input', (e) => {
            const clip = daw.clips && daw.clips.find(c => c.id === daw.selectedClipId);
            if (!clip) return;
            const val = parseFloat(e.target.value) || 0;
            clip.fadeIn = val;
            const valEl = document.getElementById('daw-deck-clip-fadein-val');
            if (valEl) valEl.textContent = `${val.toFixed(2)}s`;
            renderClipInspector();
            renderDawClips();
        });

        document.getElementById('daw-deck-clip-fadein-shape')?.addEventListener('change', (e) => {
            const clip = daw.clips && daw.clips.find(c => c.id === daw.selectedClipId);
            if (!clip) return;
            clip.fadeInShape = e.target.value;
            renderClipInspector();
            renderDawClips();
        });

        // Fade Out Slider & Curve Algorithm
        document.getElementById('daw-deck-clip-fadeout-slider')?.addEventListener('input', (e) => {
            const clip = daw.clips && daw.clips.find(c => c.id === daw.selectedClipId);
            if (!clip) return;
            const val = parseFloat(e.target.value) || 0;
            clip.fadeOut = val;
            const valEl = document.getElementById('daw-deck-clip-fadeout-val');
            if (valEl) valEl.textContent = `${val.toFixed(2)}s`;
            renderClipInspector();
            renderDawClips();
        });

        document.getElementById('daw-deck-clip-fadeout-shape')?.addEventListener('change', (e) => {
            const clip = daw.clips && daw.clips.find(c => c.id === daw.selectedClipId);
            if (!clip) return;
            clip.fadeOutShape = e.target.value;
            renderClipInspector();
            renderDawClips();
        });

        // Tab Switching
        tabBtns.forEach(btn => {
            btn.onclick = () => {
                const tab = btn.getAttribute('data-tab');
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                panels.forEach(p => p.style.display = 'none');
                const target = document.getElementById(`daw-deck-panel-${tab}`);
                if (target) {
                    target.style.display = tab === 'dsp' ? 'flex' : (tab === 'mixer' ? 'flex' : 'flex');
                }

                if (tab === 'dsp') syncActiveTrackToDeck();
                if (tab === 'mixer') renderMixerStrips();
                if (tab === 'clip') renderClipInspector();
            };
        });

        // Toggle Minimize / Expand
        const toggleDeck = () => {
            deckEl.classList.toggle('collapsed');
            const isCol = deckEl.classList.contains('collapsed');
            if (toggleBtn) toggleBtn.textContent = isCol ? '▴' : '▾';
            showStudioToast(isCol ? 'Bottom Deck Minimized' : 'Bottom Deck Expanded');
        };

        if (toggleBtn) toggleBtn.onclick = toggleDeck;

        // Popout Button: opens full floating DSP rack modal
        if (popoutBtn) {
            popoutBtn.onclick = () => {
                const trId = daw._activeFxTrackId || (daw.tracks && Object.keys(daw.tracks)[0]) || 'host';
                openTrackFxModal(trId);
            };
        }

        // Draggable Resizer for Bottom Deck
        if (resizerEl) {
            resizerEl.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const startY = e.clientY;
                const startH = deckEl.clientHeight;

                const onMove = (moveEv) => {
                    const delta = startY - moveEv.clientY;
                    const newH = Math.max(120, Math.min(480, startH + delta));
                    deckEl.style.height = `${newH}px`;
                    syncActiveTrackToDeck();
                };

                const onUp = () => {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                    syncActiveTrackToDeck();
                    renderClipInspector();
                };

                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
            });

            resizerEl.addEventListener('dblclick', toggleDeck);
        }

        // Window resize keeps all deck canvases pin-sharp and invalidates cached timeline viewport width
        window.addEventListener('resize', () => {
            const vp = document.getElementById('timeline-scroll-viewport');
            if (vp) vp._cachedWidth = vp.clientWidth;
            syncActiveTrackToDeck();
            renderClipInspector();
        });

        // Global key shortcut: 'B' toggles Bottom Studio Deck
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
            if (e.key === 'b' || e.key === 'B') {
                if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                    e.preventDefault();
                    toggleDeck();
                }
            }
        });

        // Track Header selection click wiring
        document.querySelectorAll('.daw-track-header').forEach(header => {
            header.addEventListener('click', (e) => {
                // If clicked button, let button handle it
                if (e.target.closest('button') || e.target.closest('input')) return;
                const trId = header.getAttribute('data-track-id');
                if (trId) {
                    daw._activeFxTrackId = trId;
                    renderDawTracks();
                    syncActiveTrackToDeck();
                    if (typeof renderMixerStrips === 'function') renderMixerStrips();
                }
            });
        });

        // Initialize active track sync
        syncActiveTrackToDeck();
    };

    // ─────────────────────────────────────────────────────────────
    // Track & Mixer Strip Right-Click Context Menu Engine
    // ─────────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────
    // Universal DAW Right-Click Context Menu Engine
    // (Clips, Track Lanes, Ruler, Track Headers, Workspace)
    // ─────────────────────────────────────────────────────────────
    const initTrackContextMenu = () => {
        const ctxMenu = document.getElementById('daw-track-context-menu');
        if (!ctxMenu) return;
        const labelEl = document.getElementById('daw-ctx-track-label');
        const badgeEl = document.getElementById('daw-ctx-track-badge');

        const hideMenu = () => {
            if (ctxMenu) ctxMenu.style.display = 'none';
        };

        const renderItems = (title, badge, items, e) => {
            if (labelEl) labelEl.textContent = title;
            if (badgeEl) badgeEl.textContent = badge;

            // Remove previous items (keeping header row)
            while (ctxMenu.children.length > 1) {
                ctxMenu.removeChild(ctxMenu.lastChild);
            }

            // Append new items
            items.forEach(item => {
                if (item.isDivider) {
                    const div = document.createElement('div');
                    div.style.cssText = 'height: 1px; background: rgba(255,255,255,0.08); margin: 4px 0;';
                    ctxMenu.appendChild(div);
                    return;
                }
                if (item.isCustom && typeof item.render === 'function') {
                    item.render(ctxMenu, hideMenu);
                    return;
                }
                const itEl = document.createElement('div');
                itEl.className = 'daw-menu-item';
                itEl.style.cssText = `padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; color: ${item.isDanger ? '#ff453a' : '#ffffff'}; font-size: 11.5px; font-weight: 700; transition: background 0.12s; user-select: none;`;
                itEl.innerHTML = `
                    <span style="display: flex; align-items: center; gap: 7px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">${item.iconSvg || ''}</svg>
                        ${item.label}
                    </span>
                    ${item.shortcut ? `<span class="daw-menu-shortcut" style="color: ${item.isDanger ? 'rgba(255,69,58,0.7)' : 'rgba(255,255,255,0.45)'}; font-size: 9.5px;">${item.shortcut}</span>` : ''}
                `;
                itEl.addEventListener('mouseenter', () => {
                    itEl.style.background = item.isDanger ? 'rgba(255, 69, 58, 0.18)' : 'rgba(10, 132, 255, 0.2)';
                });
                itEl.addEventListener('mouseleave', () => {
                    itEl.style.background = 'transparent';
                });
                itEl.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    hideMenu();
                    item.onClick?.();
                });
                ctxMenu.appendChild(itEl);
            });

            ctxMenu.style.display = 'block';
            const menuW = 240;
            const menuH = ctxMenu.offsetHeight || 220;
            let left = e.clientX + 2;
            let top = e.clientY + 2;

            if (left + menuW > window.innerWidth) left = window.innerWidth - menuW - 10;
            if (top + menuH > window.innerHeight) top = window.innerHeight - menuH - 10;

            ctxMenu.style.left = `${Math.max(10, left)}px`;
            ctxMenu.style.top = `${Math.max(10, top)}px`;
        };

        document.addEventListener('contextmenu', (e) => {
            // Check if right click occurred within the DAW
            const dawContainer = e.target.closest('#daw-root-container') || e.target.closest('#daw-app-shell') || e.target.closest('.daw-fullscreen-container') || e.target.closest('#daw-modal') || e.target.closest('body');
            if (!dawContainer) return;

            // Target 1: Timeline Clip
            const clipEl = e.target.closest('.daw-timeline-clip');
            if (clipEl) {
                e.preventDefault();
                e.stopPropagation();
                const clipId = clipEl.getAttribute('data-clip-id');
                const clip = daw.clips.find(c => c.id === clipId);
                if (!clip) return;

                if (!daw.selectedClipIds) daw.selectedClipIds = new Set();
                if (!daw.selectedClipIds.has(clipId)) {
                    daw.selectedClipIds.clear();
                    daw.selectedClipIds.add(clipId);
                    daw.selectedClipId = clipId;
                    renderDawClips();
                    if (typeof window._syncBottomDeckClipInspector === 'function') window._syncBottomDeckClipInspector();
                }

                const clipTitle = clip.name.length > 20 ? clip.name.slice(0, 19) + '…' : clip.name;
                const items = [
                    {
                        label: 'Split at Playhead',
                        shortcut: 'S',
                        iconSvg: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>',
                        onClick: () => splitClipAtTimestamp(clip.id, daw.playhead)
                    },
                    {
                        label: 'Duplicate Clip',
                        shortcut: 'Ctrl+D',
                        iconSvg: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
                        onClick: () => duplicateSelectedClipDAW()
                    },
                    {
                        label: clip.muted ? 'Unmute Clip' : 'Mute Clip',
                        shortcut: 'M',
                        iconSvg: clip.muted 
                            ? '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>' 
                            : '<path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>',
                        onClick: () => {
                            clip.muted = !clip.muted;
                            renderDawClips();
                            showStudioToast(clip.muted ? `Muted "${clip.name}"` : `Unmuted "${clip.name}"`);
                        }
                    },
                    {
                        label: 'Normalize (0 dBFS)',
                        iconSvg: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
                        onClick: () => normalizeSelectedClip()
                    },
                    {
                        label: 'Reverse Audio',
                        iconSvg: '<polygon points="11 19 2 12 11 5 11 19"/><polygon points="22 19 13 12 22 5 22 19"/>',
                        onClick: () => reverseSelectedClip()
                    },
                    {
                        label: 'Copy Clip',
                        shortcut: 'Ctrl+C',
                        iconSvg: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
                        onClick: () => copySelectedClipsDAW()
                    },
                    {
                        label: 'Export Clip (WAV)',
                        iconSvg: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
                        onClick: () => {
                            if (clip.buffer && typeof audioBufferToWav === 'function') {
                                const wavBlob = audioBufferToWav(clip.buffer);
                                const url = URL.createObjectURL(wavBlob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `${clip.name.replace(/\.[^/.]+$/, "")}.wav`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                                showStudioToast(`Exported "${clip.name}" as WAV`);
                            } else {
                                showStudioToast('Audio buffer not loaded for clip');
                            }
                        }
                    },
                    { isDivider: true },
                    {
                        label: 'Delete Clip',
                        shortcut: 'Del',
                        isDanger: true,
                        iconSvg: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
                        onClick: () => deleteSelectedClip()
                    }
                ];
                renderItems(clipTitle, (clip.tag || 'AUDIO').toUpperCase(), items, e);
                return;
            }

            // Target 2: Track Header or Mixer Strip (Left-Hand Track Area)
            const trackHeader = e.target.closest('.daw-track-header');
            const mixerStrip = e.target.closest('.daw-mixer-strip');
            const trHeaderEl = trackHeader || mixerStrip;
            if (trHeaderEl) {
                e.preventDefault();
                e.stopPropagation();
                const trId = trHeaderEl.getAttribute('data-track-id');
                const track = daw.tracks[trId];
                if (!track) return;

                daw._activeFxTrackId = trId;
                renderDawTracks();
                syncActiveTrackToDeck();
                if (typeof renderMixerStrips === 'function') renderMixerStrips();

                const isArmed = (daw._recordTrackId === trId);

                const items = [
                    // Custom Color Palette Swatch Row
                    {
                        isCustom: true,
                        render: (container, closeFn) => {
                            const paletteWrap = document.createElement('div');
                            paletteWrap.style.cssText = 'padding: 8px 12px 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.08);';
                            
                            const label = document.createElement('div');
                            label.style.cssText = 'font-size: 8.5px; font-weight: 800; color: rgba(255,255,255,0.45); letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 7px; display: flex; align-items: center; justify-content: space-between;';
                            label.innerHTML = '<span>TRACK COLOR</span><span style="font-size: 8px; color: rgba(255,255,255,0.3); font-family: monospace;">HEX PALETTE</span>';
                            paletteWrap.appendChild(label);

                            const row = document.createElement('div');
                            row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 6px;';
                            
                            const SWATCHES = ['#0a84ff', '#30d158', '#5e5ce6', '#ff9f0a', '#40c8e0', '#eb758a', '#8e8e93', '#bf5af2'];
                            SWATCHES.forEach(col => {
                                const dot = document.createElement('button');
                                dot.type = 'button';
                                const isCurrent = (track.color || '').toLowerCase() === col.toLowerCase();
                                dot.style.cssText = `width: 19px; height: 19px; border-radius: 50%; background: ${col}; border: 2px solid ${isCurrent ? '#ffffff' : 'rgba(255,255,255,0.22)'}; cursor: pointer; padding: 0; box-shadow: ${isCurrent ? '0 0 10px ' + col : 'none'}; transition: transform 0.12s, border 0.12s; outline: none; flex-shrink: 0;`;
                                dot.title = `Set Track Color: ${col}`;
                                dot.addEventListener('mouseenter', () => { dot.style.transform = 'scale(1.25)'; });
                                dot.addEventListener('mouseleave', () => { dot.style.transform = 'scale(1)'; });
                                dot.addEventListener('click', (ev) => {
                                    ev.stopPropagation();
                                    pushDawHistory(`Change Color for Track [${track.name}]`);
                                    track.color = col;
                                    renderDawTracks();
                                    renderDawClips();
                                    if (typeof renderMixerStrips === 'function') renderMixerStrips();
                                    if (typeof syncActiveTrackToDeck === 'function') syncActiveTrackToDeck();
                                    closeFn();
                                    showStudioToast(`Updated color for track "${track.name}"`);
                                });
                                row.appendChild(dot);
                            });
                            paletteWrap.appendChild(row);
                            container.appendChild(paletteWrap);
                        }
                    },
                    {
                        label: 'Rename Track...',
                        iconSvg: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
                        onClick: () => {
                            const newName = window.prompt(`Rename Track "${track.name}":`, track.name);
                            if (newName && newName.trim() && newName.trim() !== track.name) {
                                pushDawHistory(`Rename Track [${track.name}] to [${newName.trim()}]`);
                                track.name = newName.trim();
                                renderDawTracks();
                                if (typeof renderMixerStrips === 'function') renderMixerStrips();
                                if (typeof syncActiveTrackToDeck === 'function') syncActiveTrackToDeck();
                                showStudioToast(`Renamed track to "${track.name}"`);
                            }
                        }
                    },
                    { isDivider: true },
                    {
                        label: 'Peak Normalize Track (0 dBFS)',
                        iconSvg: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
                        onClick: () => normalizeTrackDAW(trId)
                    },
                    {
                        label: 'Combine / Merge Tracks...',
                        iconSvg: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.12 15.88"/><path d="M14.47 14.48L20 20"/><path d="M8.12 8.12L12 12"/>',
                        onClick: () => openMergeTracksModal(trId)
                    },
                    {
                        label: 'Duplicate Track',
                        shortcut: 'Ctrl+D',
                        iconSvg: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
                        onClick: () => duplicateTrackDAW(trId)
                    },
                    { isDivider: true },
                    {
                        label: isArmed ? 'Disarm Recording' : 'Arm Track for Recording',
                        shortcut: 'R',
                        iconSvg: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
                        onClick: () => {
                            daw._recordTrackId = isArmed ? null : trId;
                            renderDawTracks();
                            showStudioToast(daw._recordTrackId === trId ? `Track "${track.name}" Armed` : `Track "${track.name}" Disarmed`);
                        }
                    },
                    {
                        label: track.solo ? 'Unsolo Track' : 'Solo Track',
                        shortcut: 'S',
                        iconSvg: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>',
                        onClick: () => {
                            track.solo = !track.solo;
                            renderDawTracks();
                            renderDawClips();
                            if (typeof renderMixerStrips === 'function') renderMixerStrips();
                            showStudioToast(`Track "${track.name}" ${track.solo ? 'Soloed' : 'Unsoloed'}`);
                        }
                    },
                    {
                        label: track.muted ? 'Unmute Track' : 'Mute Track',
                        shortcut: 'M',
                        iconSvg: track.muted 
                            ? '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>' 
                            : '<path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>',
                        onClick: () => {
                            track.muted = !track.muted;
                            renderDawTracks();
                            renderDawClips();
                            if (typeof renderMixerStrips === 'function') renderMixerStrips();
                            showStudioToast(`Track "${track.name}" ${track.muted ? 'Muted' : 'Unmuted'}`);
                        }
                    },
                    { isDivider: true },
                    {
                        label: 'Export Track (WAV)...',
                        shortcut: 'Bounce',
                        iconSvg: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
                        onClick: () => {
                            daw._activeFxTrackId = trId;
                            openExportMixdownModal('selected');
                        }
                    },
                    {
                        label: 'Export Master Mix...',
                        shortcut: 'Ctrl+M',
                        iconSvg: '<polyline points="20 6 9 17 4 12"/>',
                        onClick: () => openExportMixdownModal('master')
                    },
                    {
                        label: 'Export All Stems (.ZIP)...',
                        shortcut: 'Ctrl+Shift+E',
                        iconSvg: '<polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/>',
                        onClick: () => exportAllStemsZipDAW()
                    },
                    {
                        label: 'Track Properties & Settings...',
                        iconSvg: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
                        onClick: () => {
                            if (typeof openTrackPropertiesModal === 'function') openTrackPropertiesModal(trId);
                        }
                    },
                    {
                        label: '+ Add Empty Track',
                        shortcut: 'Ctrl+T',
                        iconSvg: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
                        onClick: () => addNewEmptyTrack('audio')
                    },
                    { isDivider: true },
                    {
                        label: 'Delete Track',
                        shortcut: 'Alt+Del',
                        isDanger: true,
                        iconSvg: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
                        onClick: () => {
                            if (typeof deleteTrackPrompt === 'function') deleteTrackPrompt(trId);
                        }
                    }
                ];
                renderItems(track.name || 'TRACK OPTIONS', (track.channels || 'stereo').toUpperCase(), items, e);
                return;
            }

            // Target 3: Timeline Track Lane (Empty Lane Area)
            const laneEl = e.target.closest('.timeline-lane');
            if (laneEl) {
                e.preventDefault();
                e.stopPropagation();
                const trId = laneEl.getAttribute('data-track-id');
                const track = daw.tracks[trId];
                if (!track) return;

                daw._activeFxTrackId = trId;
                renderDawTracks();
                syncActiveTrackToDeck();

                const isArmed = (daw._recordTrackId === trId);
                const items = [
                    {
                        label: 'Paste at Playhead',
                        shortcut: 'Ctrl+V',
                        iconSvg: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>',
                        onClick: () => {
                            daw._recordTrackId = trId;
                            pasteClipsDAW();
                        }
                    },
                    {
                        label: isArmed ? 'Disarm Recording' : 'Arm Track for Recording',
                        shortcut: 'R',
                        iconSvg: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
                        onClick: () => {
                            daw._recordTrackId = (isArmed ? null : trId);
                            renderDawTracks();
                            showStudioToast(daw._recordTrackId === trId ? `Track "${track.name}" Armed` : `Track "${track.name}" Disarmed`);
                        }
                    },
                    {
                        label: track.solo ? 'Unsolo Track' : 'Solo Track',
                        shortcut: 'S',
                        iconSvg: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>',
                        onClick: () => {
                            track.solo = !track.solo;
                            renderDawTracks();
                            renderDawClips();
                            if (typeof renderMixerStrips === 'function') renderMixerStrips();
                            showStudioToast(`Track "${track.name}" ${track.solo ? 'Soloed' : 'Unsoloed'}`);
                        }
                    },
                    {
                        label: track.muted ? 'Unmute Track' : 'Mute Track',
                        shortcut: 'M',
                        iconSvg: track.muted 
                            ? '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>' 
                            : '<path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>',
                        onClick: () => {
                            track.muted = !track.muted;
                            renderDawTracks();
                            renderDawClips();
                            if (typeof renderMixerStrips === 'function') renderMixerStrips();
                            showStudioToast(`Track "${track.name}" ${track.muted ? 'Muted' : 'Unmuted'}`);
                        }
                    },
                    {
                        label: 'Import Audio to Track...',
                        iconSvg: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
                        onClick: () => {
                            daw._targetImportTrackId = trId;
                            document.getElementById('daw-asset-import-input')?.click();
                        }
                    },
                    {
                        label: 'Track Properties & Color...',
                        iconSvg: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
                        onClick: () => {
                            if (typeof openTrackPropertiesModal === 'function') openTrackPropertiesModal(trId);
                        }
                    },
                    {
                        label: '+ Add Empty Track',
                        shortcut: 'Ctrl+T',
                        iconSvg: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
                        onClick: () => addNewEmptyTrack('audio')
                    },
                    { isDivider: true },
                    {
                        label: 'Delete Track',
                        shortcut: 'Alt+Del',
                        isDanger: true,
                        iconSvg: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
                        onClick: () => {
                            if (typeof deleteTrackPrompt === 'function') deleteTrackPrompt(trId);
                        }
                    }
                ];
                renderItems(track.name || 'TRACK LANE', (track.channels || 'stereo').toUpperCase(), items, e);
                return;
            }

            // Target 4: Timeline Ruler Header
            const rulerEl = e.target.closest('#timeline-ruler');
            if (rulerEl) {
                e.preventDefault();
                e.stopPropagation();
                const rulerRect = rulerEl.getBoundingClientRect();
                const vp = document.getElementById('timeline-scroll-viewport');
                const scrollL = vp ? vp.scrollLeft : 0;
                const clickX = e.clientX - rulerRect.left + scrollL;
                const clickSec = Math.max(0, Math.round((clickX / daw.zoom) * 100) / 100);

                const items = [
                    {
                        label: `Set Playhead (${formatDawSMPTE(clickSec, 24)})`,
                        iconSvg: '<polygon points="5 3 19 12 5 21 5 3"/>',
                        onClick: () => {
                            daw.playhead = clickSec;
                            updateDawPlayhead();
                            playDawScrubGrain(clickSec);
                        }
                    },
                    {
                        label: 'Add Scene Marker Here',
                        shortcut: 'M',
                        iconSvg: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
                        onClick: () => {
                            if (!Array.isArray(daw.markers)) daw.markers = [];
                            daw.markers.push({ time: clickSec, name: `Cue ${daw.markers.length + 1}`, color: '#ff9f0a' });
                            pushDawHistory('Add Scene Marker');
                            renderDawRuler();
                            showStudioToast(`Added Cue Marker at ${formatDawSMPTE(clickSec, 24)}`);
                        }
                    },
                    {
                        label: 'Set In-Point (Punch In)',
                        shortcut: 'I',
                        iconSvg: '<path d="M4 4h4v16H4z"/>',
                        onClick: () => {
                            if (!daw.punch) daw.punch = { isActive: false, inTime: 0, outTime: 10 };
                            daw.punch.inTime = clickSec;
                            if (daw.punch.outTime <= daw.punch.inTime) daw.punch.outTime = daw.punch.inTime + 4;
                            daw.punch.isActive = true;
                            updateDawPunchOverlay();
                            showStudioToast(`Punch-In set to ${formatDawSMPTE(clickSec, 24)}`);
                        }
                    },
                    {
                        label: 'Set Out-Point (Punch Out)',
                        shortcut: 'O',
                        iconSvg: '<path d="M16 4h4v16h-4z"/>',
                        onClick: () => {
                            if (!daw.punch) daw.punch = { isActive: false, inTime: 0, outTime: 10 };
                            daw.punch.outTime = clickSec;
                            if (daw.punch.outTime <= daw.punch.inTime) daw.punch.inTime = Math.max(0, daw.punch.outTime - 4);
                            daw.punch.isActive = true;
                            updateDawPunchOverlay();
                            showStudioToast(`Punch-Out set to ${formatDawSMPTE(clickSec, 24)}`);
                        }
                    },
                    {
                        label: 'Clear Loop / Punch Region',
                        iconSvg: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
                        onClick: () => {
                            if (daw.punch) daw.punch.isActive = false;
                            updateDawPunchOverlay();
                            showStudioToast('Loop / Punch Region cleared');
                        }
                    },
                    { isDivider: true },
                    {
                        label: 'Split All Tracks at Playhead',
                        shortcut: 'Ctrl+B',
                        iconSvg: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>',
                        onClick: () => {
                            let splitCount = 0;
                            [...daw.clips].forEach(c => {
                                const start = c.startOffset;
                                const end = start + ((c.trimEnd || c.duration) - (c.trimStart || 0));
                                if (daw.playhead > start + 0.05 && daw.playhead < end - 0.05) {
                                    if (splitClipAtTimestamp(c.id, daw.playhead)) splitCount++;
                                }
                            });
                            showStudioToast(splitCount > 0 ? `Split ${splitCount} clips across tracks` : 'No clips crossing playhead to split');
                        }
                    },
                    {
                        label: 'Zoom to Fit Timeline',
                        shortcut: 'Shift+Z',
                        iconSvg: '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>',
                        onClick: () => {
                            const vpEl = document.getElementById('timeline-scroll-viewport');
                            if (vpEl && daw.duration > 0) {
                                const availW = vpEl.clientWidth - 40;
                                const newZ = Math.max(10, Math.min(250, availW / daw.duration));
                                daw.zoom = Math.round(newZ);
                                renderDawRuler();
                                renderDawClips();
                                updateDawPlayhead();
                                showStudioToast(`Zoomed to fit (${daw.zoom} px/s)`);
                            }
                        }
                    }
                ];
                renderItems('RULER & TRANSPORT', formatDawSMPTE(clickSec, 24), items, e);
                return;
            }

            // Target 5: Workspace Background / Timeline Viewport
            const viewport = e.target.closest('#timeline-scroll-viewport') || e.target.closest('#timeline-lanes-container') || e.target.closest('#daw-canvas-container');
            if (viewport) {
                e.preventDefault();
                e.stopPropagation();

                const items = [
                    {
                        label: '+ Add Empty Track',
                        shortcut: 'Ctrl+T',
                        iconSvg: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
                        onClick: () => addNewEmptyTrack('audio')
                    },
                    {
                        label: daw.isPlaying ? 'Pause Transport' : 'Play Transport',
                        shortcut: 'Space',
                        iconSvg: daw.isPlaying ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>' : '<polygon points="5 3 19 12 5 21 5 3"/>',
                        onClick: () => {
                            if (daw.isPlaying) stopDawPlayback();
                            else startDawPlayback();
                        }
                    },
                    {
                        label: 'Rewind to Beginning',
                        shortcut: 'Home',
                        iconSvg: '<polygon points="11 19 2 12 11 5 11 19"/><polygon points="22 19 13 12 22 5 22 19"/>',
                        onClick: () => {
                            daw.playhead = 0;
                            updateDawPlayhead();
                            showStudioToast('Rewound to 00:00:00:00');
                        }
                    },
                    {
                        label: 'Select All Clips',
                        shortcut: 'Ctrl+A',
                        iconSvg: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>',
                        onClick: () => {
                            if (!daw.selectedClipIds) daw.selectedClipIds = new Set();
                            daw.clips.forEach(c => daw.selectedClipIds.add(c.id));
                            daw.selectedClipId = daw.clips[0]?.id || null;
                            renderDawClips();
                            showStudioToast(`Selected all ${daw.clips.length} clip(s)`);
                        }
                    },
                    {
                        label: 'Deselect All',
                        shortcut: 'Esc',
                        iconSvg: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
                        onClick: () => {
                            if (daw.selectedClipIds) daw.selectedClipIds.clear();
                            daw.selectedClipId = null;
                            renderDawClips();
                            if (typeof window._syncBottomDeckClipInspector === 'function') window._syncBottomDeckClipInspector();
                        }
                    },
                    { isDivider: true },
                    {
                        label: 'Export Master Mix...',
                        shortcut: 'Ctrl+M',
                        iconSvg: '<polyline points="20 6 9 17 4 12"/>',
                        onClick: () => openExportMixdownModal('master')
                    },
                    {
                        label: 'Export All Stems (.ZIP)...',
                        shortcut: 'Ctrl+Shift+E',
                        iconSvg: '<polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/>',
                        onClick: () => exportAllStemsZipDAW()
                    }
                ];
                renderItems('STUDIO WORKSPACE', 'LOCALDAW', items, e);
                return;
            }

            hideMenu();
        });

        // Hide context menu on outside click or escape
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#daw-track-context-menu')) {
                hideMenu();
            }
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') hideMenu();
        });
    };

    // =========================================================================
    // LOCALDAW STUDIO FEEDBACK & DISCORD WEBHOOK DISPATCH SYSTEM (v1.8.39)
    // =========================================================================
    const initDawFeedbackSystem = () => {
        const feedbackModal = document.getElementById('daw-feedback-modal');
        if (!feedbackModal) return;

        const splashFeedbackBtn = document.getElementById('daw-splash-feedback-btn');
        const menuFeedbackBtn = document.getElementById('daw-menu-help-feedback');
        const closeBtn = document.getElementById('daw-feedback-close-btn');
        const cancelBtn = document.getElementById('daw-feedback-cancel-btn');
        const form = document.getElementById('daw-feedback-form');
        const statusBox = document.getElementById('daw-fb-status');
        const nameInput = document.getElementById('daw-fb-name');
        const contactInput = document.getElementById('daw-fb-contact');
        const messageInput = document.getElementById('daw-fb-message');
        const webhookInput = document.getElementById('daw-fb-webhook-url');
        const diagCheckbox = document.getElementById('daw-fb-include-diag');
        const diagSpecs = document.getElementById('daw-fb-diag-specs');

        // Preload saved values from localStorage
        try {
            if (nameInput && !nameInput.value) {
                nameInput.value = localStorage.getItem('localdaw_fb_name') || '';
            }
            if (contactInput && !contactInput.value) {
                contactInput.value = localStorage.getItem('localdaw_fb_contact') || '';
            }
            if (webhookInput && !webhookInput.value) {
                webhookInput.value = localStorage.getItem('localdaw_discord_webhook') || '';
            }
        } catch (_) {}

        // Hardware diagnostics specs indicator
        const updateDiagDisplay = () => {
            const sr = daw.audioCtx?.sampleRate || daw.sampleRate || 48000;
            const bd = daw.bitDepth || '24-bit';
            if (diagSpecs) {
                diagSpecs.textContent = `${(sr / 1000).toFixed(0)}kHz · ${bd} · 64-Bit Float Engine`;
            }
        };
        updateDiagDisplay();

        // Category selection styling
        const catLabels = feedbackModal.querySelectorAll('.daw-fb-cat-btn');
        catLabels.forEach(label => {
            label.addEventListener('click', () => {
                catLabels.forEach(l => {
                    l.style.background = 'rgba(255,255,255,0.02)';
                    l.style.borderColor = 'rgba(255,255,255,0.1)';
                    l.style.color = 'rgba(255,255,255,0.7)';
                });
                label.style.background = 'rgba(255,255,255,0.1)';
                label.style.borderColor = 'rgba(255,255,255,0.35)';
                label.style.color = '#ffffff';
            });
        });

        const openFeedbackModal = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            updateDiagDisplay();
            feedbackModal.style.display = 'flex';
            if (statusBox) statusBox.style.display = 'none';
            setTimeout(() => {
                if (messageInput) messageInput.focus();
            }, 60);
        };

        const closeFeedbackModal = () => {
            feedbackModal.style.display = 'none';
        };

        splashFeedbackBtn?.addEventListener('click', openFeedbackModal);
        menuFeedbackBtn?.addEventListener('click', (e) => {
            if (typeof window.__closeAllDawMenus === 'function') window.__closeAllDawMenus();
            openFeedbackModal(e);
        });
        closeBtn?.addEventListener('click', closeFeedbackModal);
        cancelBtn?.addEventListener('click', closeFeedbackModal);

        feedbackModal.addEventListener('click', (e) => {
            if (e.target === feedbackModal) {
                closeFeedbackModal();
            }
        });

        // Form submission handling
        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('daw-feedback-submit-btn');
            const catChecked = form.querySelector('input[name="fb_category"]:checked');
            const category = catChecked ? catChecked.value : 'Workflow Suggestion';
            const name = (nameInput?.value || '').trim();
            const contact = (contactInput?.value || '').trim();
            const message = (messageInput?.value || '').trim();
            const webhookUrl = (webhookInput?.value || '').trim();
            const includeDiag = diagCheckbox ? diagCheckbox.checked : true;

            if (!message) {
                if (statusBox) {
                    statusBox.style.display = 'block';
                    statusBox.style.background = 'rgba(255,69,58,0.15)';
                    statusBox.style.border = '1px solid rgba(255,69,58,0.4)';
                    statusBox.style.color = '#f87171';
                    statusBox.textContent = 'Please enter your feedback or workflow notes before dispatching.';
                }
                return;
            }

            // Persist user details for future sessions
            try {
                if (name) localStorage.setItem('localdaw_fb_name', name);
                if (contact) localStorage.setItem('localdaw_fb_contact', contact);
                if (webhookUrl) localStorage.setItem('localdaw_discord_webhook', webhookUrl);
            } catch (_) {}

            // Gather diagnostics string
            let diagInfo = '';
            if (includeDiag) {
                const sr = daw.audioCtx?.sampleRate || daw.sampleRate || 48000;
                const lat = daw.audioCtx?.baseLatency ? `${(daw.audioCtx.baseLatency * 1000).toFixed(1)}ms` : 'N/A';
                const ctxState = daw.audioCtx?.state || 'inactive';
                const trackCount = Object.keys(daw.tracks || {}).length;
                const clipCount = (daw.clips || []).length;
                diagInfo = `Sample Rate: ${sr}Hz | Latency: ${lat} | Context: ${ctxState}\nTracks: ${trackCount} | Clips: ${clipCount} | Res: ${window.innerWidth}x${window.innerHeight}\nUA: ${navigator.userAgent.substring(0, 80)}`;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.6';
                submitBtn.innerHTML = `<span>Dispatching to HQ...</span>`;
            }

            let dispatchedDiscord = false;
            let dispatchedServer = false;

            // 1. Dispatch directly to Discord if webhook provided
            const targetWebhook = webhookUrl || (typeof localStorage !== 'undefined' && localStorage.getItem('localdaw_discord_webhook')) || '';
            if (targetWebhook && targetWebhook.startsWith('https://discord.com/api/webhooks/')) {
                try {
                    const embedPayload = {
                        username: 'LocalDAW Studio Dispatch',
                        avatar_url: 'https://localdaw.com/localdaw-emblem.png',
                        embeds: [{
                            title: `🎙️ LocalDAW Studio Feedback: ${category}`,
                            description: message,
                            color: 0xe5e7eb,
                            fields: [
                                { name: 'Reporter', value: name || 'Anonymous Beta Tester', inline: true },
                                { name: 'Contact / Tag', value: contact || 'Not provided', inline: true },
                                { name: 'DAW Version', value: 'v1.8.39 (Standalone)', inline: true },
                                ...(diagInfo ? [{ name: 'Hardware Audio Diagnostics', value: '```' + diagInfo + '```', inline: false }] : [])
                            ],
                            footer: {
                                text: 'LocalDAW Pro Studio · LocalFilm Ireland',
                                icon_url: 'https://localdaw.com/localdaw-emblem.png'
                            },
                            timestamp: new Date().toISOString()
                        }]
                    };

                    const discordRes = await fetch(targetWebhook, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(embedPayload)
                    });
                    if (discordRes.ok || discordRes.status === 204) {
                        dispatchedDiscord = true;
                    }
                } catch (err) {
                    console.warn('[LocalDAW] Direct Discord webhook dispatch failed (may be CORS or invalid URL):', err);
                }
            }

            // 2. Relay via LocalFilm Studio Backend Endpoint
            try {
                const relayRes = await fetch('/api/feedback/localdaw', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        category,
                        name: name || 'Anonymous Beta Tester',
                        contact,
                        message,
                        diagnostics: diagInfo,
                        webhookUrl: targetWebhook,
                        version: '1.8.39'
                    })
                });
                if (relayRes.ok) {
                    dispatchedServer = true;
                }
            } catch (_) {
                // If on standalone static domain (localdaw.com) without backend proxy, try absolute URL
                try {
                    await fetch('https://localfilm.net/api/feedback/localdaw', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            category,
                            name: name || 'Anonymous Beta Tester',
                            contact,
                            message,
                            diagnostics: diagInfo,
                            webhookUrl: targetWebhook,
                            version: '1.8.42'
                        }),
                        mode: 'no-cors'
                    });
                } catch (__) {}
            }

            if (statusBox) {
                statusBox.style.display = 'block';
                statusBox.style.background = 'rgba(255,255,255,0.06)';
                statusBox.style.border = '1px solid rgba(255,255,255,0.2)';
                statusBox.style.color = '#ffffff';
                statusBox.innerHTML = `✓ Dispatch Successful! Thank you for testing LocalDAW v1.8.42. Your workflow input has been recorded for Alan Joyce & the studio engineering team.`;
            }

            if (messageInput) messageInput.value = '';

            setTimeout(() => {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                    submitBtn.innerHTML = `
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                        Dispatch to Studio HQ
                    `;
                }
                closeFeedbackModal();
            }, 2200);
        });
    };

    // ═════════════════════════════════════════════════════════════════════════════
    // MOBILE DETECTION & TOUCH OPTIMIZATION ENGINE
    // ═════════════════════════════════════════════════════════════════════════════
    const initMobileStudioEngine = () => {
        const checkMobile = () => {
            const isMobile = (
                window.innerWidth <= 768 ||
                (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) ||
                (window.matchMedia && window.matchMedia('(pointer: coarse)').matches && window.innerWidth <= 1024) ||
                /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            );

            if (isMobile) {
                document.body.classList.add('daw-mobile-mode');
                if (daw && daw.laneHeight > 75) daw.laneHeight = 65;
            } else {
                document.body.classList.remove('daw-mobile-mode');
            }
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        window.addEventListener('orientationchange', checkMobile);
    };

    // ═════════════════════════════════════════════════════════════════════════════
    // LOCALSYNTH / EXTERNAL STEM IMPORT ENGINE
    // ═════════════════════════════════════════════════════════════════════════════
    let _importedSynthHashes = new Set();
    const importSynthPayload = async (payload) => {
        try {
            if (!payload || !payload.audioBase64) return;
            const payloadKey = `${payload.name}_${payload.bpm}_${payload.audioBase64.length}`;
            if (_importedSynthHashes.has(payloadKey)) return;
            _importedSynthHashes.add(payloadKey);

            setStudioStatus('Importing LocalSynth Track...', 'busy', true);
            if (!daw.audioCtx) {
                daw.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (daw.audioCtx.state === 'suspended') {
                try { await daw.audioCtx.resume(); } catch (e) {}
            }

            // Decode base64 audio
            const binaryStr = atob(payload.audioBase64);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
            }
            const decodedBuf = await daw.audioCtx.decodeAudioData(bytes.buffer);

            // Sync BPM if present
            if (payload.bpm) {
                daw.bpm = parseInt(payload.bpm, 10) || 128;
                const bpmInput = document.getElementById('daw-bpm-input');
                if (bpmInput) bpmInput.value = daw.bpm;
            }

            const trackId = `track-localsynth-${Date.now()}`;
            const trackName = payload.name || 'LocalSynth Master';

            daw.tracks[trackId] = {
                id: trackId,
                name: `🎹 ${trackName}`,
                type: 'audio',
                channels: decodedBuf.numberOfChannels > 1 ? 'stereo' : 'mono',
                vol: 1.0,
                pan: 0,
                muted: false,
                solo: false,
                color: '#f97316',
                showAutomation: false,
                keyframes: [{ time: 0, val: 1.0 }],
                plugins: defaultPluginState()
            };

            const clipId = `clip-synth-${Date.now()}`;
            const clipDur = decodedBuf.duration;
            const newClip = {
                id: clipId,
                trackId: trackId,
                name: `${trackName} (${payload.patch || 'Synth'})`,
                color: '#f97316',
                startOffset: 0,
                trimStart: 0,
                trimEnd: clipDur,
                duration: clipDur,
                buffer: decodedBuf,
                gain: 1.0,
                fadeIn: 0.005,
                fadeOut: 0.005
            };

            daw.clips.push(newClip);
            recomputeDawDuration();
            renderDawTracks();
            renderDawClips();
            setStudioStatus('LocalSynth Track Imported!', 'ready');
            showStudioToast(`🎹 Imported "${trackName}" (${clipDur.toFixed(1)}s) from LocalSynth!`);
        } catch (e) {
            console.error('[LocalSynth Import Error]', e);
        }
    };

    const checkExternalSynthImport = async () => {
        // 1. Check same-origin localStorage fallback
        try {
            const rawData = localStorage.getItem('localsynth_export_payload');
            if (rawData) {
                localStorage.removeItem('localsynth_export_payload');
                const payload = JSON.parse(rawData);
                await importSynthPayload(payload);
            }
        } catch (e) {}

        // 2. Listen for cross-origin postMessage from LocalSynth window
        window.addEventListener('message', async (event) => {
            if (event.data && event.data.type === 'LOCALSYNTH_STEM_EXPORT') {
                await importSynthPayload(event.data);
            }
        });
    };

    renderDawClips();
    updateDawPlayhead();
    bindFooterControls();
    updateDawFooter();
    initBottomStudioDeck();
    initTrackContextMenu();
    initDawFeedbackSystem();
    initMobileStudioEngine();
    checkExternalSynthImport();
    showStudioToast('LocalDAW v1.8.42 Ready');
}
