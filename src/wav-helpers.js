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

    // Quick Takes Ingestion Chips in Publisher Modal
    const renderPublisherQuickTakes = () => {
        const container = document.getElementById('up-quick-takes-container');
        if (!container) return;
        const takes = (window._podcastTakeInventory || []).filter(t => !isTakeDeleted(t));
        if (takes.length === 0) {
            container.style.display = 'none';
            return;
        }
        container.style.display = 'block';
        container.innerHTML = `
            <div style="font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.6); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
                Insert Track from Take Inventory:
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                ${takes.map(take => `
                    <button type="button" class="quick-take-chip" data-url="${take.blobUrl}" data-duration="${take.durationSeconds || ''}" style="background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.35); color: #c4b5fd; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; transition: all 0.15s;" onmouseover="this.style.background='rgba(139, 92, 246, 0.3)'" onmouseout="this.style.background='rgba(139, 92, 246, 0.15)'">
                        <span>🎵 ${take.name} (${take.duration || 'WAV'})</span>
                    </button>
                `).join('')}
            </div>
        `;
        container.querySelectorAll('.quick-take-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const url = chip.getAttribute('data-url');
                const dur = chip.getAttribute('data-duration');
                const audioInput = document.getElementById('up-audio-url');
                const durInput = document.getElementById('up-duration');
                if (audioInput) {
                    audioInput.value = url;
                    audioInput.dispatchEvent(new Event('input'));
                }
                if (dur && durInput) {
                    durInput.value = dur;
                }
            });
        });
    };

    document.getElementById('suite-launch-publisher-btn')?.addEventListener('click', () => {
        const modal = document.getElementById('podcast-upload-modal');
        if (modal) {
            modal.style.display = 'flex';
            renderPublisherQuickTakes();
        }
    });

    // Wire Interactive Studio Tools Deck Click Launchers
    document.getElementById('podcast-open-daw-btn')?.addEventListener('click', () => {
        if (typeof window._openTimelineEditor === 'function') {
            window._openTimelineEditor({ isFresh: false });
        }
    });

    document.getElementById('suite-tool-daw-card')?.addEventListener('click', () => {
        if (typeof window._openTimelineEditor === 'function') {
            window._openTimelineEditor();
        }
    });

    document.getElementById('suite-tool-recorder-card')?.addEventListener('click', () => {
        const recBtn = document.getElementById('podcast-recorder-btn');
        if (recBtn) recBtn.click();
    });

    document.getElementById('suite-tool-script-card')?.addEventListener('click', () => {
        const scriptBtn = document.getElementById('podcast-blog-script-btn');
        if (scriptBtn) scriptBtn.click();
    });

    document.getElementById('suite-tool-publisher-card')?.addEventListener('click', () => {
        const uploadBtn = document.getElementById('podcast-admin-upload-btn') || document.getElementById('suite-launch-publisher-btn');
        if (uploadBtn) uploadBtn.click();
    });

    // Publisher Cover Artwork Preset & Image Upload Handlers
    window._setPublisherCoverPreset = (url) => {
        const coverInput = document.getElementById('up-cover-art');
        const previewImg = document.getElementById('up-cover-preview-img');
        if (coverInput) coverInput.value = url;
        if (previewImg) previewImg.src = url;
    };

    document.getElementById('up-cover-upload-btn')?.addEventListener('click', () => {
        document.getElementById('up-cover-file')?.click();
    });

    document.getElementById('up-cover-file')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
        const uploadBtn = document.getElementById('up-cover-upload-btn');
        const previewImg = document.getElementById('up-cover-preview-img');
        const coverInput = document.getElementById('up-cover-art');

        const originalBtnText = uploadBtn ? uploadBtn.innerHTML : '';
        if (uploadBtn) uploadBtn.innerHTML = '<span>⏳ Uploading...</span>';

        try {
            const formData = new FormData();
            formData.append('cover_image', file);
            const res = await fetch('/api/podcasts/upload-image', {
                method: 'POST',
                headers: { 'Authorization': token ? `Bearer ${token}` : '' },
                body: formData
            });
            const data = await res.json();
            if (data.success && data.url) {
                if (coverInput) coverInput.value = data.url;
                if (previewImg) previewImg.src = data.url;
            } else {
                await showStudioAlert('Artwork Upload Error', 'Cover artwork upload failed: ' + (data.error || 'Server error'));
            }
        } catch (err) {
            await showStudioAlert('Network Error', 'Network error uploading cover artwork: ' + err.message);
        } finally {
            if (uploadBtn) uploadBtn.innerHTML = originalBtnText;
        }
    });

    // Publisher Audio File Upload & Preview Player Handlers
    document.getElementById('up-audio-upload-btn')?.addEventListener('click', () => {
        document.getElementById('up-audio-file')?.click();
    });

    document.getElementById('up-audio-file')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
        const uploadAudioBtn = document.getElementById('up-audio-upload-btn');
        const audioInput = document.getElementById('up-audio-url');
        const durInput = document.getElementById('up-duration');

        const originalBtnText = uploadAudioBtn ? uploadAudioBtn.innerHTML : '';
        if (uploadAudioBtn) uploadAudioBtn.innerHTML = '<span>⏳ Uploading...</span>';

        try {
            const formData = new FormData();
            formData.append('audio_file', file);
            const res = await fetch('/api/podcasts/upload-audio', {
                method: 'POST',
                headers: { 'Authorization': token ? `Bearer ${token}` : '' },
                body: formData
            });
            const data = await res.json();
            if (data.success && data.url) {
                if (audioInput) {
                    audioInput.value = data.url;
                    audioInput.dispatchEvent(new Event('input'));
                }
                try {
                    const tempAudio = new Audio(data.url);
                    tempAudio.onloadedmetadata = () => {
                        if (durInput && tempAudio.duration) {
                            durInput.value = Math.round(tempAudio.duration);
                        }
                    };
                } catch (e) {}
            } else {
                await showStudioAlert('Audio Upload Error', 'Audio file upload failed: ' + (data.error || 'Server error'));
            }
        } catch (err) {
            await showStudioAlert('Network Error', 'Network error uploading audio file: ' + err.message);
        } finally {
            if (uploadAudioBtn) uploadAudioBtn.innerHTML = originalBtnText;
        }
    });

    const audioUrlInput = document.getElementById('up-audio-url');
    const audioPreviewPlayer = document.getElementById('up-audio-preview-player');
    const audioPreviewSource = document.getElementById('up-audio-preview-source');
    if (audioUrlInput) {
        audioUrlInput.addEventListener('input', () => {
            const val = audioUrlInput.value.trim();
            if (val && audioPreviewPlayer && audioPreviewSource) {
                audioPreviewSource.src = val;
                audioPreviewPlayer.load();
                audioPreviewPlayer.style.display = 'block';
            } else if (audioPreviewPlayer) {
                audioPreviewPlayer.style.display = 'none';
            }
        });
    }

    // Launch Timeline DAW from Publisher Master Audio Section
    document.getElementById('up-open-timeline-btn')?.addEventListener('click', () => {
        const audioUrl = document.getElementById('up-audio-url')?.value;
        const epTitle = document.getElementById('up-title')?.value || 'Episode Master';
        const dur = parseInt(document.getElementById('up-duration')?.value || '60', 10);
        window._openTimelineEditor({ title: epTitle, blobUrl: audioUrl, durationSeconds: dur });
    });

    // Snippet Inserters for Episode Description
    document.getElementById('up-insert-timestamps-btn')?.addEventListener('click', () => {
        const desc = document.getElementById('up-description');
        if (!desc) return;
        const snippet = "\n\n### Episode Timeline & Chapters\n00:00 - Introduction & On-Set Context\n05:15 - Technical Breakdown\n15:30 - Discussion & Analysis\n28:00 - Key Takeaways & Credits\n";
        desc.value = (desc.value || '') + snippet;
        desc.focus();
    });

    document.getElementById('up-insert-credits-btn')?.addEventListener('click', () => {
        const desc = document.getElementById('up-description');
        if (!desc) return;
        const snippet = "\n\n### Production Credits\n- Produced by: LocalFilm Ireland Community\n- Sound Engineered at: LocalFilm Studio Suite\n- Broadcast across 32 Irish Counties\n";
        desc.value = (desc.value || '') + snippet;
        desc.focus();
    });

    const uploadBtn = document.getElementById('podcast-admin-upload-btn');
    const uploadModal = document.getElementById('podcast-upload-modal');
    const uploadClose = document.getElementById('podcast-upload-close-btn');
    const uploadForm = document.getElementById('podcast-upload-form');
    const aiOptBtn = document.getElementById('up-ai-optimize-btn');

    const recorderBtn = document.getElementById('podcast-recorder-btn');
    const recorderModal = document.getElementById('podcast-recorder-modal');
    const recorderClose = document.getElementById('podcast-recorder-close-btn');

    const blogScriptBtn = document.getElementById('podcast-blog-script-btn');
    const blogScriptModal = document.getElementById('podcast-blog-script-modal');

    if (blogScriptBtn && blogScriptModal) {
        blogScriptBtn.addEventListener('click', async () => {
            blogScriptModal.style.display = 'flex';
            await loadRecentPostsForScriptConverter();
        });
    }

    const postSelect = document.getElementById('blog-script-post-select');
    if (postSelect) {
        postSelect.addEventListener('change', (e) => {
            const selectedId = e.target.value;
            const sourceTextarea = document.getElementById('blog-script-source');
            if (!sourceTextarea) return;

            if (selectedId && selectedId !== 'custom' && window._recentCommunityPosts) {
                const post = window._recentCommunityPosts.find(p => p.id.toString() === selectedId.toString());
                if (post) {
                    sourceTextarea.value = `${post.title}\n\n${post.content || ''}`;
                }
            } else if (selectedId === 'custom') {
                sourceTextarea.value = '';
                sourceTextarea.focus();
            }
        });
    }

    if (uploadBtn && uploadModal) {
        uploadBtn.addEventListener('click', () => {
            window._editingEpisodeId = null;
            const titleEl = document.getElementById('up-modal-title');
            const submitEl = document.getElementById('up-submit-btn');
            if (titleEl) titleEl.textContent = 'Publish Episode';
            if (submitEl) submitEl.textContent = 'Publish Episode to RSS Feed';
            if (uploadForm) uploadForm.reset();
            selectedFeaturedMembers = [];
            renderSelectedMemberBadges();
            uploadModal.style.display = 'flex';
        });
    }

    if (uploadClose && uploadModal) {
        uploadClose.addEventListener('click', () => {
            uploadModal.style.display = 'none';
            window._editingEpisodeId = null;
        });
    }

    // Studio Recorder Session and Polling State
    let currentSessionId = window._activeStudioSessionId || localStorage.getItem('localfilm_active_studio_session_id') || null;
    let hostGuestPollInterval = null;


    // ─── Remote Guest Invitations Modal & Link Manager (Max 4 Co-Hosts) ───────
    let cachedSessionInvitations = [];

    const renderInvitesList = (invitations) => {
        cachedSessionInvitations = Array.isArray(invitations) ? invitations : [];
        const count = cachedSessionInvitations.length;

        const capacityBadge = document.getElementById('invites-capacity-badge');
        if (capacityBadge) capacityBadge.textContent = `${count}/4 INVITED`;

        const studioCountBadge = document.getElementById('studio-invite-count-badge');
        if (studioCountBadge) studioCountBadge.textContent = `${count}/4`;

        const createSec = document.getElementById('invites-create-section');
        const maxBanner = document.getElementById('invites-max-banner');
        const nameInput = document.getElementById('invites-guest-name-input');

        if (count >= 4) {
            if (createSec) createSec.style.display = 'none';
            if (maxBanner) maxBanner.style.display = 'block';
        } else {
            if (createSec) createSec.style.display = 'block';
            if (maxBanner) maxBanner.style.display = 'none';
            if (nameInput) nameInput.value = count === 0 ? 'Guest' : `Guest ${count + 1}`;
        }

        const activeListEl = document.getElementById('invites-active-list');
        if (!activeListEl) return;

        if (count === 0) {
            activeListEl.innerHTML = `
                <div id="invites-empty-placeholder" style="color: rgba(255,255,255,0.4); font-size: 12px; font-style: italic; padding: 16px; text-align: center; border: 1px dashed rgba(255,255,255,0.1); border-radius: 10px;">
                    No co-host invitations generated yet. Click &quot;Generate &amp; Auto-Copy Link&quot; above to invite up to 4 co-hosts.
                </div>
            `;
            return;
        }

        activeListEl.innerHTML = cachedSessionInvitations.map((inv, idx) => {
            const guestLabel = inv.guest_name || `Guest ${idx + 1}`;
            const token = inv.token || '';
            const remainingHours = inv.expires_at ? Math.max(0, Math.round((new Date(inv.expires_at).getTime() - Date.now()) / (1000 * 60 * 60))) : 5;
            const ttlText = remainingHours > 0 ? `~${remainingHours}h remaining` : 'Expiring soon';

            return `
            <div class="invite-slot-card" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 10px; font-weight: 800; color: #10b981; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.35); padding: 1px 7px; border-radius: 5px; letter-spacing: 0.5px;">SLOT ${idx + 1}</span>
                        <span style="font-size: 13px; font-weight: 800; color: #ffffff;">${guestLabel}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 11px; color: rgba(255,255,255,0.45);">${ttlText}</span>
                        <button type="button" onclick="window._revokeGuestInvite('${token}')" title="Revoke this invitation to free up a slot" style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 6px; cursor: pointer; transition: all 0.2s;">
                            Revoke Slot
                        </button>
                    </div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <input type="text" readonly value="${inv.guest_link}" onclick="this.select(); window._copyInviteLink('${inv.guest_link}')" style="flex: 1; background: #07080c; border: 1px solid rgba(255,255,255,0.15); color: #34d399; font-size: 11px; font-family: monospace; padding: 8px 10px; border-radius: 8px; cursor: pointer; outline: none;" title="Click to auto-copy link">
                    <button type="button" onclick="window._copyInviteLink('${inv.guest_link}', this)" style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.35) 100%); border: 1px solid #10b981; color: #ffffff; padding: 7px 12px; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; box-shadow: 0 0 10px rgba(16,185,129,0.2);">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        <span>Copy Link</span>
                    </button>
                </div>
            </div>
            `;
        }).join('');
    };

    window._copyInviteLink = async (link, btnEl) => {
        const copied = await copyStudioLinkToClipboard(link);
        const banner = document.getElementById('invites-feedback-banner');
        const bannerText = document.getElementById('invites-feedback-text');
        if (banner) {
            if (bannerText) bannerText.textContent = '✓ Link auto-copied to clipboard! Send to your co-host.';
            banner.style.display = 'flex';
            setTimeout(() => { if (banner) banner.style.display = 'none'; }, 4000);
        }
        if (btnEl) {
            const origHtml = btnEl.innerHTML;
            btnEl.innerHTML = '<span>✓ Copied!</span>';
            btnEl.style.background = '#10b981';
            btnEl.style.color = '#000000';
            setTimeout(() => {
                btnEl.innerHTML = origHtml;
                btnEl.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.35) 100%)';
                btnEl.style.color = '#ffffff';
            }, 2000);
        }
    };

    window._revokeGuestInvite = async (token) => {
        const ok = await showStudioConfirm(
            'Revoke Studio Invitation',
            'Are you sure you want to revoke this invitation slot? The co-host will no longer be able to enter the studio with this link.',
            { confirmText: 'Revoke Slot', danger: true }
        );
        if (!ok) return;
        const sid = currentSessionId || window._activeStudioSessionId;
        if (!sid) return;
        try {
            const res = await fetch('/api/podcasts/guest-session/revoke-invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sid, invite_token: token })
            });
            const data = await res.json();
            if (data.success) {
                renderInvitesList(data.invitations || []);
                showStudioToast('Studio invitation revoked');
            } else {
                await showStudioAlert('Revocation Failed', data.error || 'Server error');
            }
        } catch (e) {
            await showStudioAlert('Network Error', 'Error revoking invitation: ' + e.message);
        }
    };

    const openGuestInvitesModal = async () => {
        if (!currentSessionId) {
            currentSessionId = window._activeStudioSessionId || localStorage.getItem('localfilm_active_studio_session_id') || `session-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
        }
        window._activeStudioSessionId = currentSessionId;
        localStorage.setItem('localfilm_active_studio_session_id', currentSessionId);

        const modal = document.getElementById('studio-guest-invites-modal');
        if (modal) modal.style.display = 'flex';

        // Connect host to LiveKit room and start background polling if not already started
        startHostGuestPolling(currentSessionId);
        if (!hostLKRoom || hostLKRoom.state !== 'connected') {
            connectHostToLiveKit(currentSessionId).catch(() => {});
        }

        // Fetch latest session invitations from status endpoint
        try {
            const res = await fetch(`/api/podcasts/guest-session/status/${currentSessionId}`);
            if (res.ok) {
                const data = await res.json();
                if (data.success && Array.isArray(data.invitations)) {
                    renderInvitesList(data.invitations);
                    return;
                }
            }
        } catch (e) {}

        renderInvitesList(cachedSessionInvitations);
    };

    document.getElementById('generate-guest-link-btn')?.addEventListener('click', openGuestInvitesModal);

    document.getElementById('close-guest-invites-modal-btn')?.addEventListener('click', () => {
        const modal = document.getElementById('studio-guest-invites-modal');
        if (modal) modal.style.display = 'none';
    });

    document.getElementById('studio-guest-invites-modal')?.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'studio-guest-invites-modal') {
            e.target.style.display = 'none';
        }
    });

    document.getElementById('invites-submit-btn')?.addEventListener('click', async () => {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
        const nameInput = document.getElementById('invites-guest-name-input');
        let guestName = (nameInput?.value || '').trim();
        if (!guestName) {
            guestName = cachedSessionInvitations.length === 0 ? 'Guest' : `Guest ${cachedSessionInvitations.length + 1}`;
        }

        if (!currentSessionId) {
            currentSessionId = window._activeStudioSessionId || localStorage.getItem('localfilm_active_studio_session_id') || `session-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
        }
        window._activeStudioSessionId = currentSessionId;
        localStorage.setItem('localfilm_active_studio_session_id', currentSessionId);

        const submitBtn = document.getElementById('invites-submit-btn');
        const origSubmitHtml = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span>⏳ Generating Link...</span>';
        }

        try {
            const res = await fetch('/api/podcasts/guest-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ guest_name: guestName, session_id: currentSessionId })
            });
            const data = await res.json();
            if (data.success) {
                if (data.session_id) {
                    currentSessionId = data.session_id;
                    window._activeStudioSessionId = data.session_id;
                    localStorage.setItem('localfilm_active_studio_session_id', data.session_id);
                }

                const isNotLiveDomain = window.location.hostname !== 'localfilm.online' && window.location.hostname !== 'www.localfilm.online';
                const inviteParam = data.invite_token ? `&invite_token=${encodeURIComponent(data.invite_token)}` : '';
                const finalLink = (isNotLiveDomain || !data.guest_link)
                    ? `${window.location.origin}/podcasts?guest_session=${currentSessionId}&guest_name=${encodeURIComponent(guestName)}${inviteParam}`
                    : `${data.guest_link}${data.guest_link.includes('invite_token') ? '' : inviteParam}`;

                // Auto-copy to clipboard immediately
                await copyStudioLinkToClipboard(finalLink);

                // Show instant feedback banner
                const banner = document.getElementById('invites-feedback-banner');
                const bannerText = document.getElementById('invites-feedback-text');
                if (banner) {
                    if (bannerText) bannerText.textContent = `✓ Link for ${guestName} auto-copied to clipboard! Send to your co-host.`;
                    banner.style.display = 'flex';
                    setTimeout(() => { if (banner) banner.style.display = 'none'; }, 4000);
                }

                if (Array.isArray(data.invitations)) {
                    renderInvitesList(data.invitations);
                }

                startHostGuestPolling(currentSessionId);
                if (!hostLKRoom || hostLKRoom.state !== 'connected') {
                    await connectHostToLiveKit(currentSessionId);
                }
            } else if (data.max_reached) {
                if (Array.isArray(data.invitations)) renderInvitesList(data.invitations);
                await showStudioAlert('Invitation Limit Reached', data.message || 'All 4 co-host guest invitation slots have already been allocated for this studio session.');
            } else {
                await showStudioAlert('Guest Invitation Error', 'Failed to generate guest link: ' + (data.error || 'Server error'));
            }
        } catch (e) {
            await showStudioAlert('Network Error', 'Network error while generating guest link: ' + e.message);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = origSubmitHtml;
            }
        }
    });

    // FEATURE 2: Blog to Script Generator

    document.getElementById('generate-script-btn')?.addEventListener('click', async () => {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
        const textVal = document.getElementById('blog-script-source')?.value || '';
        const selectVal = document.getElementById('blog-script-post-select')?.value || '';
        const generateBtn = document.getElementById('generate-script-btn');

        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.innerHTML = '<span>⏳ Generating Podcast Script...</span>';
        }

        try {
            const res = await fetch('/api/podcasts/blog-to-script', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ 
                    source_id: (selectVal && selectVal !== 'custom') ? selectVal : null,
                    text_content: textVal 
                })
            });
            const data = await res.json();
            if (data.success) {
                document.getElementById('blog-script-result').value = `${data.script_text}\n\n${data.show_notes}`;
                document.getElementById('blog-script-result-box').style.display = 'block';
                window._generatedPodcastScript = data;
            } else {
                await showStudioAlert('Script Generation Error', 'Script generation failed: ' + (data.error || 'Unknown error'));
            }
        } catch (e) {
            await showStudioAlert('Network Error', 'Network error generating podcast script draft');
        } finally {
            if (generateBtn) {
                generateBtn.disabled = false;
                generateBtn.innerHTML = '<span>🪄 Generate Podcast Script Draft</span>';
            }
        }
    });

    document.getElementById('use-generated-script-btn')?.addEventListener('click', () => {
        if (window._generatedPodcastScript) {
            document.getElementById('up-title').value = window._generatedPodcastScript.script_title || '';
            document.getElementById('up-subtitle').value = window._generatedPodcastScript.script_subtitle || '';
            document.getElementById('up-description').value = window._generatedPodcastScript.show_notes || window._generatedPodcastScript.script_text || '';
            if (blogScriptModal) blogScriptModal.style.display = 'none';
            if (uploadModal) uploadModal.style.display = 'flex';
        }
    });

    // FEATURE 1: Member Search Selector
    const memberSearchInput = document.getElementById('up-member-search');
    const memberResultsBox = document.getElementById('member-search-results');
    const selectedBadgesBox = document.getElementById('selected-members-badges');

    if (memberSearchInput) {
        memberSearchInput.addEventListener('input', async (e) => {
            const q = e.target.value.trim();
            if (q.length < 2) {
                if (memberResultsBox) memberResultsBox.style.display = 'none';
                return;
            }
            try {
                const res = await fetch(`/api/podcasts/members/search?q=${encodeURIComponent(q)}`);
                const data = await res.json();
                if (data.success && data.members.length > 0 && memberResultsBox) {
                    memberResultsBox.innerHTML = data.members.map(m => `
                        <div class="member-search-item" data-id="${m.id}" data-name="${m.name}" data-hub="${m.hub}" data-role="${m.role}" data-avatar="${m.avatar_url || ''}" style="padding: 8px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.06);" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='transparent'">
                            <div style="font-size: 13px; font-weight: 700; color: #fff;">${m.name} <span style="font-size: 11px; font-weight: 400; color: rgba(255,255,255,0.5);">(${m.hub})</span></div>
                            <div style="font-size: 11px; color: rgba(255,255,255,0.6);">${m.role}</div>
                        </div>
                    `).join('');
                    memberResultsBox.style.display = 'block';

                    memberResultsBox.querySelectorAll('.member-search-item').forEach(item => {
                        item.addEventListener('click', () => {
                            const id = item.getAttribute('data-id');
                            const name = item.getAttribute('data-name');
                            const hub = item.getAttribute('data-hub');
                            const role = item.getAttribute('data-role');
                            const avatar_url = item.getAttribute('data-avatar');

                            if (!selectedFeaturedMembers.find(x => x.id === id)) {
                                selectedFeaturedMembers.push({ id, name, hub, role, avatar_url });
                                renderSelectedMemberBadges();
                            }
                            memberResultsBox.style.display = 'none';
                            memberSearchInput.value = '';
                        });
                    });
                }
            } catch (err) {}
        });
    }

    function renderSelectedMemberBadges() {
        if (!selectedBadgesBox) return;
        selectedBadgesBox.innerHTML = selectedFeaturedMembers.map((m, idx) => `
            <span style="background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.25); color: #fff; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
                ${m.name} (${m.hub})
                <button type="button" onclick="window._removeMemberBadge(${idx})" style="background: none; border: none; color: #fff; cursor: pointer; font-size: 14px; line-height: 1;">×</button>
            </span>
        `).join('');
    }

    window._removeMemberBadge = (idx) => {
        selectedFeaturedMembers.splice(idx, 1);
        renderSelectedMemberBadges();
    };

    // ─── Studio Recorder Multi-Track & Take Inventory State ─────────────────────
    window._podcastTakeInventory = window._podcastTakeInventory || [];

    // Persistent sets for pruned / deleted takes (backed by localStorage so reloads never resurrect them)
    window._deletedTakeIds = window._deletedTakeIds || new Set();
    window._deletedTakeUrls = window._deletedTakeUrls || new Set();
    window._deletedTakeFiles = window._deletedTakeFiles || new Set();

    const loadDeletedTakes = () => {
        try {
            const storedIds = JSON.parse(localStorage.getItem('localfilm_deleted_take_ids') || '[]');
            const storedUrls = JSON.parse(localStorage.getItem('localfilm_deleted_take_urls') || '[]');
            const storedFiles = JSON.parse(localStorage.getItem('localfilm_deleted_take_files') || '[]');
            if (Array.isArray(storedIds)) storedIds.forEach(id => window._deletedTakeIds.add(id));
            if (Array.isArray(storedUrls)) storedUrls.forEach(u => window._deletedTakeUrls.add(u));
            if (Array.isArray(storedFiles)) storedFiles.forEach(f => window._deletedTakeFiles.add(f));
        } catch (e) {
            console.warn('[Take Inventory] Error reading deleted takes from localStorage:', e);
        }
    };
    loadDeletedTakes();

    const saveDeletedTakes = () => {
        try {
            localStorage.setItem('localfilm_deleted_take_ids', JSON.stringify(Array.from(window._deletedTakeIds)));
            localStorage.setItem('localfilm_deleted_take_urls', JSON.stringify(Array.from(window._deletedTakeUrls)));
            localStorage.setItem('localfilm_deleted_take_files', JSON.stringify(Array.from(window._deletedTakeFiles)));
        } catch (e) {
            console.warn('[Take Inventory] Error saving deleted takes to localStorage:', e);
        }
    };

    const isTakeDeleted = (take) => {
        if (!take) return false;
        loadDeletedTakes();
        if (take.id && window._deletedTakeIds.has(take.id)) return true;
        if (take.url && window._deletedTakeUrls.has(take.url)) return true;
        if (take.blobUrl && window._deletedTakeUrls.has(take.blobUrl)) return true;
        const urlToCheck = take.url || take.blobUrl;
        if (urlToCheck && typeof urlToCheck === 'string') {
            const filename = urlToCheck.split('/').pop().split('?')[0];
            if (filename && window._deletedTakeFiles.has(filename)) return true;
            for (const dUrl of window._deletedTakeUrls) {
                if (dUrl && typeof dUrl === 'string' && (dUrl.includes(urlToCheck) || urlToCheck.includes(dUrl))) {
                    return true;
                }
            }
        }
        return false;
    };

    // Filter take inventory on startup against deleted items
    window._podcastTakeInventory = (window._podcastTakeInventory || []).filter(t => !isTakeDeleted(t));
    let hostAudioCtx = null;
    let hostAnalyser = null;
    let hostGainNode = null;
    let hostDestNode = null;
    let currentHostStream = null;
    let preferredHostMicId = localStorage.getItem('localfilm_preferred_host_mic_id') || '';
    let preferredHostMicLabel = localStorage.getItem('localfilm_preferred_host_mic_label') || '';
    let isPaused = false;
    let customTopBuffer = null;
    let customTailBuffer = null;
    let _activePreviewAudio = null;
    let _activePreviewType = null;

    // Real-Time Noise Reduction DSP & Soundboard state
    let hostHighpassNode = null;
    let hostDeEsserNode = null;
    let hostEqLowNode = null;
    let hostEqMidNode = null;
    let hostEqHighNode = null;
    let hostGateGainNode = null;
    let hostCompressorNode = null;
    let hostPreGateAnalyser = null;
    let hostMonitorGainNode = null;
    let hostSoundboardGainNode = null;

    let isHighpassMode = '80'; // 'off', '80', '130'
    let isDeEsserEnabled = false;
    let isNoiseGateEnabled = true;
    let noiseGateThreshold = -42; // dB
    let noiseGateFloor = 0.08; // -22dB natural ducking
    let lastSpeechTime = 0;
    let compressorPreset = 'leveler'; // 'leveler', 'punch', 'limit', 'off'
    let eqPreset = 'warm';
    let isHostMonitorEnabled = false;
    let hostMonitorVolume = 0.75;
    let isDspBypassed = false;
    let currentMeterPct = 0;
    let lastClipTime = 0;
    let topBumperVolume = 0.8;
    let tailBumperVolume = 0.8;
    let customSoundboardClips = [];
    let recordStartTime = 0;
    let totalRecordedMs = 0;
    let recordTimerAnimationId = null;
    let autoScrollInterval = null;

    // LiveKit Host Studio state
    let hostLKRoom = null;         // LiveKit Room instance
    let hostLKTrack = null;        // Published LocalAudioTrack
    const guestAudioEls = {};      // { identity: HTMLAudioElement }
    const guestMutedState = {};    // { identity: boolean }

    const micSelectEl = document.getElementById('recorder-mic-select');
    const micLevelMeterEl = document.getElementById('recorder-mic-level-meter');
    const micBadgeEl = document.getElementById('recorder-mic-status-badge');
    const pauseRecBtn = document.getElementById('record-pause-btn');
    const takeInventoryListEl = document.getElementById('podcast-take-inventory-list');
    const takeCountBadgeEl = document.getElementById('take-count-badge');
    const remoteGuestsContainer = document.getElementById('remote-guests-list-container');
    const remoteGuestsCountBadge = document.getElementById('remote-guests-count-badge');
    const studioLKDot = document.getElementById('studio-livekit-dot');
    const studioLKLabel = document.getElementById('studio-livekit-label');
    const studioTalkIndicator = document.getElementById('studio-talk-indicator');
    const remoteAudioEl = document.getElementById('studio-remote-audio-elements');

    // ─── LiveKit Room Status Helper ───────────────────────────────────────────
    const setStudioLKStatus = (state) => {
        if (!studioLKDot || !studioLKLabel) return;
        const statusEl = document.getElementById('studio-livekit-status');
        const states = {
            offline:       { dot: 'rgba(255,255,255,0.2)', label: 'Studio Offline', color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)', shadow: 'none' },
            connecting:    { dot: '#f59e0b', label: 'Connecting…', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', shadow: '0 0 6px #f59e0b' },
            connected:     { dot: '#10b981', label: 'Studio Live', color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.4)', shadow: '0 0 8px rgba(16,185,129,0.6)' },
            reconnecting:  { dot: '#f59e0b', label: 'Reconnecting…', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', shadow: '0 0 6px #f59e0b' },
            disconnected:  { dot: 'rgba(255,255,255,0.2)', label: 'Studio Offline', color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)', shadow: 'none' },
        };
        const s = states[state] || states.offline;
        studioLKDot.style.background = s.dot;
        studioLKDot.style.boxShadow = s.shadow || 'none';
        studioLKLabel.textContent = s.label;
        if (statusEl) {
            statusEl.style.color = s.color;
            statusEl.style.background = s.bg;
            statusEl.style.borderColor = s.border;
        }
        if (studioTalkIndicator) {
            studioTalkIndicator.style.display = state === 'connected' ? 'inline-flex' : 'none';
        }
    };

    // ─── Render / Update Guest Card in Remote Co-Hosts Panel ─────────────────
    const renderGuestCard = (identity, name, muted = false, deviceLabel = '', isArmed = true, isSelfMuted = false, rtt = 0) => {
        if (!remoteGuestsContainer) return;
        let displayName = (name || '').trim();
        // If name looks like composite identity "guest_JOHN_g_abc", extract "JOHN"
        if (displayName.startsWith('guest_')) {
            const parts = displayName.split('_');
            if (parts.length >= 2 && parts[1]) displayName = parts[1];
        }
        const normName = displayName.toLowerCase().trim();
        const cleanId = (identity || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_');

        const formatPingBadge = (val) => {
            if (!val || val <= 0) return '● Online';
            if (val < 80) return `🟢 ${val}ms · Strong`;
            if (val < 180) return `🟡 ${val}ms · Cellular`;
            return `🟠 ${val}ms · High Latency`;
        };

        // Multi-tier Deduplication:
        // 1. By ID matching
        // 2. By data-clean-id, data-alt-id, or data-raw-identity
        // 3. By normalized guest name
        const existing = document.getElementById(`guest-card-${cleanId}`) ||
            Array.from(remoteGuestsContainer.querySelectorAll('[id^="guest-card-"]')).find(card => {
                const cName = (card.getAttribute('data-guest-name') || '').toLowerCase().trim();
                const cId = card.getAttribute('data-clean-id') || '';
                const altId = card.getAttribute('data-alt-id') || '';
                const rawId = card.getAttribute('data-raw-identity') || '';
                if (normName && cName && (normName === cName || normName.includes(cName) || cName.includes(normName))) return true;
                if (cleanId && cId && (cleanId === cId || cleanId.includes(cId) || cId.includes(cleanId))) return true;
                if (cleanId && altId && (cleanId === altId || cleanId.includes(altId) || altId.includes(cleanId))) return true;
                if (identity && rawId && (identity === rawId || identity.includes(rawId) || rawId.includes(identity))) return true;
                return false;
            });

        if (existing) {
            // Update secondary identifiers for cross-system routing
            if (cleanId) existing.setAttribute('data-alt-id', cleanId);
            if (identity) existing.setAttribute('data-raw-identity', identity);
            if (normName && !existing.getAttribute('data-guest-name')) existing.setAttribute('data-guest-name', normName);
            if (deviceLabel) {
                const devEl = existing.querySelector(`[id^="guest-card-device-"]`);
                if (devEl) devEl.textContent = deviceLabel;
            }
            if (rtt !== undefined && rtt !== null) {
                const pingEl = existing.querySelector(`[id^="guest-ping-badge-"]`);
                if (pingEl) {
                    pingEl.textContent = formatPingBadge(rtt);
                    if (rtt > 180) {
                        pingEl.style.color = '#f59e0b';
                        pingEl.style.borderColor = 'rgba(245, 158, 11, 0.4)';
                        pingEl.style.background = 'rgba(245, 158, 11, 0.12)';
                    } else if (rtt > 0) {
                        pingEl.style.color = '#10b981';
                        pingEl.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                        pingEl.style.background = 'rgba(16, 185, 129, 0.12)';
                    }
                }
            }
            if (isArmed !== undefined) {
                const armBtn = existing.querySelector(`[id^="guest-arm-btn-"]`);
                if (armBtn) {
                    armBtn.setAttribute('data-armed', isArmed ? '1' : '0');
                    armBtn.textContent = isArmed ? '● Armed' : 'Standby';
                    armBtn.style.background = isArmed ? 'rgba(239,68,68,0.22)' : 'rgba(255,255,255,0.08)';
                    armBtn.style.color = isArmed ? '#ef4444' : 'rgba(255,255,255,0.7)';
                    armBtn.style.border = isArmed ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.15)';
                    armBtn.style.boxShadow = isArmed ? '0 0 10px rgba(239,68,68,0.35)' : 'none';
                }
            }
            if (isSelfMuted !== undefined) {
                const badge = existing.querySelector(`[id^="guest-card-selfmute-"]`);
                const reqBtn = existing.querySelector(`[id^="guest-unmute-req-btn-"]`);
                if (badge) badge.style.display = isSelfMuted ? 'inline-flex' : 'none';
                if (reqBtn) reqBtn.style.display = isSelfMuted ? 'inline-block' : 'none';
            }

            // Prune any duplicate sibling cards for the same co-host
            const duplicates = Array.from(remoteGuestsContainer.querySelectorAll('[id^="guest-card-"]')).filter(c => c !== existing && (
                (normName && (c.getAttribute('data-guest-name') || '').toLowerCase().trim() === normName) ||
                (cleanId && c.getAttribute('data-clean-id') === cleanId)
            ));
            duplicates.forEach(d => d.remove());

            if (remoteGuestsCountBadge) {
                const count = remoteGuestsContainer.querySelectorAll('[id^="guest-card-"]').length;
                remoteGuestsCountBadge.textContent = `${count}/4 Connected`;
            }
            return;
        }

        const initial = (displayName || 'G').charAt(0).toUpperCase();
        const card = document.createElement('div');
        card.id = `guest-card-${cleanId}`;
        card.setAttribute('data-guest-name', normName);
        card.setAttribute('data-clean-id', cleanId);
        card.setAttribute('data-alt-id', cleanId);
        card.setAttribute('data-raw-identity', identity || '');
        card.style.cssText = 'background: rgba(16, 185, 129, 0.03); border: 1px solid rgba(16, 185, 129, 0.22); border-radius: 12px; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px;';
        card.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 30px; height: 30px; border-radius: 50%; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; color: #10b981; flex-shrink: 0;">${initial}</div>
                <div style="min-width: 0; flex: 1;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                        <div style="font-size: 12px; font-weight: 800; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${displayName || 'Remote Guest'}</div>
                        <span id="guest-ping-badge-${cleanId}" style="font-size: 9px; font-weight: 700; color: #10b981; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); padding: 1px 6px; border-radius: 4px; white-space: nowrap;">${formatPingBadge(rtt)}</span>
                    </div>
                    <div id="guest-card-device-${cleanId}" style="font-size: 10px; color: rgba(255,255,255,0.5); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${deviceLabel || 'Microphone Ready'}</div>
                </div>
                <span style="width: 7px; height: 7px; border-radius: 50%; background: #10b981; flex-shrink: 0; box-shadow: 0 0 6px #10b981;" title="Connected"></span>
            </div>

            <!-- Live VU Equalizer for Remote Guest -->
            <div style="display: flex; flex-direction: column; gap: 4px; background: rgba(0,0,0,0.3); padding: 6px 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06);">
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 9px; font-weight: 800; letter-spacing: 0.5px; color: rgba(255,255,255,0.6);">
                    <span style="color: #10b981;">GUEST MIC SIGNAL</span>
                    <span id="guest-card-selfmute-${cleanId}" style="display: ${isSelfMuted ? 'inline-flex' : 'none'}; color: #ef4444; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); padding: 1px 6px; border-radius: 4px; font-weight: 900; font-size: 9px; letter-spacing: 0.5px;">MUTED BY GUEST</span>
                </div>
                <div style="height: 6px; width: 100%; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden;">
                    <div id="guest-meter-bar-${cleanId}" style="width: 0%; height: 100%; background: linear-gradient(90deg, #10b981 0%, #34d399 75%, #f59e0b 92%, #ef4444 100%); transition: width 0.05s ease-out; border-radius: 3px;"></div>
                </div>
            </div>

            <div style="display: flex; gap: 6px;">
                <button onclick="window._studioMuteGuest('${cleanId}')" id="guest-mute-btn-${cleanId}" title="Mute/unmute remote guest audio in your studio monitors" style="flex: 1; background: ${muted ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255,255,255,0.08)'}; border: 1px solid ${muted ? '#f59e0b' : 'rgba(255,255,255,0.15)'}; color: ${muted ? '#f59e0b' : '#ffffff'}; padding: 5px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.2s;">
                    ${muted ? 'Unmute' : 'Mute'}
                </button>
                <button onclick="window._studioRequestUnmuteGuest('${cleanId}')" id="guest-unmute-req-btn-${cleanId}" title="Request guest to unmute their cough microphone" style="display: ${isSelfMuted ? 'inline-block' : 'none'}; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); color: #f59e0b; padding: 5px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.2s;">
                    Ask Unmute
                </button>
                <button onclick="window._studioArmGuest('${cleanId}')" id="guest-arm-btn-${cleanId}" data-armed="${isArmed ? '1' : '0'}" title="Arm/disarm guest for multi-track synchronized recording" style="flex: 1; background: ${isArmed ? 'rgba(239,68,68,0.22)' : 'rgba(255,255,255,0.08)'}; color: ${isArmed ? '#ef4444' : 'rgba(255,255,255,0.7)'}; border: ${isArmed ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.15)'}; box-shadow: ${isArmed ? '0 0 10px rgba(239,68,68,0.35)' : 'none'}; padding: 5px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; cursor: pointer; transition: all 0.2s;">
                    ${isArmed ? '● Armed' : 'Standby'}
                </button>
            </div>
        `;

        const placeholder = remoteGuestsContainer.querySelector('#remote-guests-empty-placeholder, [data-empty]');
        if (placeholder) placeholder.remove();

        remoteGuestsContainer.appendChild(card);
        if (remoteGuestsCountBadge) {
            const count = remoteGuestsContainer.querySelectorAll('[id^="guest-card-"]').length;
            remoteGuestsCountBadge.textContent = `${count}/4 Connected`;
        }
    };

    const removeGuestCard = (identity) => {
        const cleanId = (identity || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_');
        const normName = (identity || '').toLowerCase().trim();

        // Safety Guard: Do not prune if participant is still connected to LiveKit room
        if (hostLKRoom && hostLKRoom.remoteParticipants) {
            const stillInLk = Array.from(hostLKRoom.remoteParticipants.values()).some(p => {
                const pClean = (p.identity || '').replace(/[^a-zA-Z0-9_-]/g, '_');
                const pNorm = (p.name || '').toLowerCase().trim();
                return pClean === cleanId || (normName && pNorm === normName);
            });
            if (stillInLk) {
                console.log(`[Host Studio] Skipping removeGuestCard for ${identity} — participant active in LiveKit room.`);
                return;
            }
        }

        const card = document.getElementById(`guest-card-${cleanId}`) ||
            Array.from(remoteGuestsContainer?.querySelectorAll('[id^="guest-card-"]') || []).find(c => {
                const cName = (c.getAttribute('data-guest-name') || '').toLowerCase().trim();
                const cId = c.getAttribute('data-clean-id') || '';
                const altId = c.getAttribute('data-alt-id') || '';
                return (normName && cName === normName) || (cleanId && (cleanId === cId || cleanId === altId));
            });
        if (card) card.remove();
        const count = remoteGuestsContainer ? remoteGuestsContainer.querySelectorAll('[id^="guest-card-"]').length : 0;
        if (remoteGuestsCountBadge) {
            remoteGuestsCountBadge.textContent = `${count}/4 Connected`;
        }
        if (count === 0 && remoteGuestsContainer && !remoteGuestsContainer.querySelector('[id^="guest-card-"]')) {
            remoteGuestsContainer.innerHTML = `<div id="remote-guests-empty-placeholder" data-empty="true" style="color: rgba(255,255,255,0.4); font-size: 12px; font-style: italic; padding: 12px 0;">No remote co-hosts connected yet (room accommodates up to 4 co-hosts). Click "Copy Guest Studio Link" to invite co-hosts!</div>`;
        }
    };

    // Mute/unmute a guest's audio locally (host-side only)
    window._studioMuteGuest = (identity) => {
        let card = document.getElementById(`guest-card-${identity}`);
        if (!card && remoteGuestsContainer) {
            card = Array.from(remoteGuestsContainer.querySelectorAll('[id^="guest-card-"]')).find(c => {
                const cId = c.getAttribute('data-clean-id');
                const altId = c.getAttribute('data-alt-id');
                const rawId = c.getAttribute('data-raw-identity');
                return cId === identity || altId === identity || rawId === identity || c.id === `guest-card-${identity}`;
            });
        }
        const btn = card ? card.querySelector(`[id^="guest-mute-btn-"]`) : document.getElementById(`guest-mute-btn-${identity}`);

        // Find all audio elements matching this guest
        const matchedAudioEls = [];
        Object.entries(guestAudioEls).forEach(([k, el]) => {
            if (k === identity || k.includes(identity) || identity.includes(k) || (card && (k === card.getAttribute('data-raw-identity') || k === card.getAttribute('data-clean-id')))) {
                matchedAudioEls.push(el);
            }
        });

        // Also check if remoteAudioEl has any audio tags
        if (matchedAudioEls.length === 0 && remoteAudioEl) {
            const els = remoteAudioEl.querySelectorAll('audio');
            els.forEach(el => matchedAudioEls.push(el));
        }

        const currentlyMuted = guestMutedState[identity] || (btn && btn.textContent.trim().toLowerCase() === 'unmute');
        const nextMuteState = !currentlyMuted;
        guestMutedState[identity] = nextMuteState;

        matchedAudioEls.forEach(el => {
            el.muted = nextMuteState;
        });

        if (btn) {
            btn.textContent = nextMuteState ? 'Unmute' : 'Mute';
            btn.style.background = nextMuteState ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.08)';
            btn.style.borderColor = nextMuteState ? '#f59e0b' : 'rgba(255, 255, 255, 0.15)';
            btn.style.color = nextMuteState ? '#f59e0b' : '#ffffff';
        }

        // Send host_mute_guest to backend so state is synchronized
        if (currentSessionId) {
            fetch('/api/podcasts/guest-session/signal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: currentSessionId,
                    guest_id: identity,
                    action: 'host_mute_guest',
                    muted: nextMuteState
                })
            }).catch(() => {});
        }
    };

    // Request guest to unmute from host side
    window._studioRequestUnmuteGuest = (identity) => {
        let card = document.getElementById(`guest-card-${identity}`);
        if (!card && remoteGuestsContainer) {
            card = Array.from(remoteGuestsContainer.querySelectorAll('[id^="guest-card-"]')).find(c => {
                const cId = c.getAttribute('data-clean-id');
                const altId = c.getAttribute('data-alt-id');
                const rawId = c.getAttribute('data-raw-identity');
                return cId === identity || altId === identity || rawId === identity || c.id === `guest-card-${identity}`;
            });
        }
        const rawId = card ? card.getAttribute('data-raw-identity') : identity;
        if (hostLKRoom) {
            const msg = JSON.stringify({ type: 'unmute_request', target: rawId });
            hostLKRoom.localParticipant.publishData(new TextEncoder().encode(msg), { reliable: true });
        }
        if (currentSessionId) {
            fetch('/api/podcasts/guest-session/signal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: currentSessionId,
                    guest_id: identity,
                    action: 'request_unmute'
                })
            }).catch(() => {});
        }
        const reqBtn = card ? card.querySelector('[id^="guest-unmute-req-btn-"]') : document.getElementById(`guest-unmute-req-btn-${identity}`);
        if (reqBtn) {
            reqBtn.textContent = 'Asked!';
            setTimeout(() => { if (reqBtn) reqBtn.textContent = 'Ask Unmute'; }, 3000);
        }
    };

    // Arm/disarm guest via LiveKit data channel message & backend signal
    window._studioArmGuest = (identity) => {
        let card = document.getElementById(`guest-card-${identity}`);
        if (!card && remoteGuestsContainer) {
            card = Array.from(remoteGuestsContainer.querySelectorAll('[id^="guest-card-"]')).find(c => {
                const cId = c.getAttribute('data-clean-id');
                const altId = c.getAttribute('data-alt-id');
                const rawId = c.getAttribute('data-raw-identity');
                return cId === identity || altId === identity || rawId === identity || c.id === `guest-card-${identity}`;
            });
        }
        const btn = card ? card.querySelector(`[id^="guest-arm-btn-"]`) : document.getElementById(`guest-arm-btn-${identity}`);
        const isArmed = btn && btn.getAttribute('data-armed') === '1';
        const nextArmedState = !isArmed;
        if (btn) {
            btn.setAttribute('data-armed', nextArmedState ? '1' : '0');
            btn.textContent = nextArmedState ? '● Armed' : 'Standby';
            btn.style.background = nextArmedState ? 'rgba(239,68,68,0.22)' : 'rgba(255,255,255,0.08)';
            btn.style.color = nextArmedState ? '#ef4444' : 'rgba(255,255,255,0.7)';
            btn.style.border = nextArmedState ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.15)';
            btn.style.boxShadow = nextArmedState ? '0 0 10px rgba(239,68,68,0.35)' : 'none';
        }
        const cardGuestName = card ? card.getAttribute('data-guest-name') : '';
        const rawId = card ? card.getAttribute('data-raw-identity') : '';
        const cleanId = card ? card.getAttribute('data-clean-id') : '';
        const altId = card ? card.getAttribute('data-alt-id') : '';
        if (hostLKRoom) {
            const msg = JSON.stringify({ type: 'arm', target: rawId || identity, armed: nextArmedState });
            hostLKRoom.localParticipant.publishData(new TextEncoder().encode(msg), { reliable: true });
        }
        if (currentSessionId) {
            fetch('/api/podcasts/guest-session/signal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: currentSessionId,
                    guest_id: altId || cleanId || rawId || identity,
                    name: cardGuestName,
                    action: 'toggle_arm',
                    armed: nextArmedState
                })
            }).catch(() => {});
        }
    };

    // ─── Dual-Sync: HTTP Signaling Polling with Ghost Card Cleanup ────────────
    const startHostGuestPolling = (sessionId) => {
        if (hostGuestPollInterval) clearInterval(hostGuestPollInterval);
        const sid = sessionId || currentSessionId;
        const sendHostPing = () => {
            if (!sid) return;
            fetch('/api/podcasts/guest-session/signal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sid,
                    is_host: true,
                    action: 'host_ping'
                })
            }).catch(() => {});
        };
        sendHostPing();
        const poll = async () => {
            if (!currentSessionId) return;
            sendHostPing();
            try {
                const res = await fetch(`/api/podcasts/guest-session/status/${sid || currentSessionId}`);
                if (!res.ok) return;
                const data = await res.json();
                if (data.success) {
                    if (Array.isArray(data.completed_takes) && data.completed_takes.length > 0) {
                        window._podcastTakeInventory = window._podcastTakeInventory || [];
                        loadDeletedTakes();
                        let inventoryUpdated = false;
                        data.completed_takes.forEach(take => {
                            if (isTakeDeleted(take)) return;
                            const takeFilename = (take.url || '').split('/').pop().split('?')[0];
                            const existing = window._podcastTakeInventory.find(t => 
                                (take.id && t.id === take.id) ||
                                (take.url && (t.blobUrl === take.url || (t.blobUrl && t.blobUrl.includes(take.url)))) ||
                                (takeFilename && t.blobUrl && t.blobUrl.endsWith(takeFilename))
                            );
                            if (!existing) {
                                const guestNameLabel = take.guest_name || 'Remote Guest';
                                const guestTake = {
                                    id: take.id || `take-guest-${Date.now()}`,
                                    stemType: 'guest',
                                    guestName: guestNameLabel,
                                    name: `Co-Host Stem — ${guestNameLabel} (Isolated)`,
                                    duration: take.duration || '—',
                                    durationSeconds: 0,
                                    blobUrl: take.url,
                                    micName: `Remote Mic: ${guestNameLabel}`,
                                };
                                window._podcastTakeInventory.unshift(guestTake);
                                window._sessionGuestTakes = window._sessionGuestTakes || [];
                                window._sessionGuestTakes.push(guestTake);
                                inventoryUpdated = true;
                                if (window._lastHostRecordedTake) {
                                    mixMultiTrackSession(window._lastHostRecordedTake, window._sessionGuestTakes);
                                }
                            }
                        });
                        if (inventoryUpdated) {
                            renderTakeInventory();
                        }
                    }

                    if (Array.isArray(data.invitations)) {
                        const inviteCount = data.invitations.length;
                        const studioCountBadge = document.getElementById('studio-invite-count-badge');
                        if (studioCountBadge) studioCountBadge.textContent = `${inviteCount}/4`;
                        const invitesModal = document.getElementById('studio-guest-invites-modal');
                        if (invitesModal && invitesModal.style.display === 'flex' && typeof renderInvitesList === 'function') {
                            if (JSON.stringify(data.invitations) !== JSON.stringify(cachedSessionInvitations)) {
                                renderInvitesList(data.invitations);
                            }
                        }
                    }

                    if (Array.isArray(data.guests)) {
                    const activeGuests = data.guests.filter(g => g.connected !== false);
                    const activeKeys = new Set();

                    activeGuests.forEach(g => {
                        const cleanId = (g.id || g.name || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_');
                        const norm = (g.name || '').toLowerCase().trim();
                        activeKeys.add(cleanId);
                        if (norm) activeKeys.add(norm);
                        renderGuestCard(g.id || g.name, g.name, false, g.device_label, g.armed !== false, g.self_muted, g.rtt || 0);

                        // Dual-pipeline VU meter fallback: update from g.level if LiveKit Web Audio loop is not actively reporting
                        if (typeof g.level === 'number') {
                            const bar = document.getElementById(`guest-meter-bar-${cleanId}`) ||
                                remoteGuestsContainer?.querySelector(`[data-clean-id="${cleanId}"] [id^="guest-meter-bar-"]`) ||
                                remoteGuestsContainer?.querySelector(`[data-alt-id="${cleanId}"] [id^="guest-meter-bar-"]`);
                            if (bar && (!bar.dataset.lkActive || Date.now() - Number(bar.dataset.lkActive) > 2000)) {
                                bar.style.width = `${Math.min(100, Math.max(0, g.level))}%`;
                            }
                        }
                    });

                    // Prune stale ghost cards
                    if (remoteGuestsContainer) {
                        const existingCards = remoteGuestsContainer.querySelectorAll('[id^="guest-card-"]');
                        existingCards.forEach(card => {
                            const cardName = card.getAttribute('data-guest-name');
                            const cardId = card.getAttribute('data-clean-id') || card.id.replace('guest-card-', '');
                            const altId = card.getAttribute('data-alt-id') || '';
                            const rawId = card.getAttribute('data-raw-identity') || '';
                            const inLk = hostLKRoom && hostLKRoom.remoteParticipants &&
                                Array.from(hostLKRoom.remoteParticipants.values()).some(p =>
                                    p.identity.includes(cardId) || (altId && p.identity.includes(altId)) || (rawId && p.identity.includes(rawId)) || (p.name && p.name.toLowerCase().trim() === cardName)
                                );
                            const isActiveInHttp = activeKeys.has(cardId) || (altId && activeKeys.has(altId)) || (rawId && activeKeys.has(rawId)) || activeKeys.has(cardName);
                            if (!isActiveInHttp && !inLk) {
                                card.remove();
                            }
                        });
                        const count = remoteGuestsContainer.querySelectorAll('[id^="guest-card-"]').length;
                        if (remoteGuestsCountBadge) {
                            remoteGuestsCountBadge.textContent = `${count}/4 Connected`;
                        }
                        if (count === 0 && !remoteGuestsContainer.querySelector('[id^="guest-card-"]')) {
                            remoteGuestsContainer.innerHTML = `<div id="remote-guests-empty-placeholder" data-empty="true" style="color: rgba(255,255,255,0.4); font-size: 12px; font-style: italic; padding: 12px 0;">No remote co-hosts connected yet (room accommodates up to 4 co-hosts). Click "Copy Guest Studio Link" to invite co-hosts!</div>`;
                        }
                    }
                }
            }
            } catch (e) {}
        };
        poll();
        const scheduleNextPoll = () => {
            if (hostGuestPollInterval === false) return;
            const isLkActive = hostLKRoom && hostLKRoom.state === 'connected' && hostLKRoom.remoteParticipants && hostLKRoom.remoteParticipants.size > 0;
            const delay = isLkActive ? 6000 : 2500;
            hostGuestPollInterval = setTimeout(async () => {
                await poll();
                scheduleNextPoll();
            }, delay);
        };
        scheduleNextPoll();
    };

    const stopHostGuestPolling = () => {
        if (hostGuestPollInterval) {
            clearTimeout(hostGuestPollInterval);
            clearInterval(hostGuestPollInterval);
            hostGuestPollInterval = false;
        }
        if (currentSessionId) {
            fetch('/api/podcasts/guest-session/signal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: currentSessionId,
                    is_host: true,
                    action: 'host_leave'
                }),
                keepalive: true
            }).catch(() => {});
        }
    };

    // Notify backend if host closes window while in studio session
    window.addEventListener('beforeunload', () => {
        if (currentSessionId && hostGuestPollInterval) {
            try {
                const payload = JSON.stringify({
                    session_id: currentSessionId,
                    is_host: true,
                    action: 'host_leave'
                });
                if (navigator.sendBeacon) {
                    navigator.sendBeacon('/api/podcasts/guest-session/signal', new Blob([payload], { type: 'application/json' }));
                }
            } catch (e) {}
        }
    });

    // ─── Connect Host to LiveKit Podcast Studio Room ──────────────────────────
    const connectHostToLiveKit = async (sessionId) => {
        try {
            const { Room, RoomEvent, Track } = await import('livekit-client');
            const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
            const res = await fetch('/api/livekit/podcast-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ room_name: `podcast-studio-${sessionId}`, can_publish: true })
            });
            if (!res.ok) throw new Error('Could not get LiveKit token');
            const { token: lkToken, wsUrl } = await res.json();

            setStudioLKStatus('connecting');

            hostLKRoom = new Room({ adaptiveStream: true, dynacast: true });

            // ── Room Events ──────────────────────────────────────────────────
            hostLKRoom
                .on(RoomEvent.Connected, () => {
                    setStudioLKStatus('connected');
                    if (hostLKRoom && hostLKRoom.remoteParticipants) {
                        hostLKRoom.remoteParticipants.forEach((p) => {
                            renderGuestCard(p.identity, p.name || p.identity);
                        });
                    }
                })
                .on(RoomEvent.Reconnecting, () => setStudioLKStatus('reconnecting'))
                .on(RoomEvent.Reconnected, () => setStudioLKStatus('connected'))
                .on(RoomEvent.Disconnected, () => {
                    setStudioLKStatus('disconnected');
                    Object.values(guestAudioEls).forEach(el => el.remove());
                    Object.keys(guestAudioEls).forEach(k => delete guestAudioEls[k]);
                })
                .on(RoomEvent.ParticipantConnected, (participant) => {
                    renderGuestCard(participant.identity, participant.name || participant.identity);
                })
                .on(RoomEvent.ParticipantDisconnected, (participant) => {
                    removeGuestCard(participant.identity);
                    const el = guestAudioEls[participant.identity];
                    if (el) { el.remove(); delete guestAudioEls[participant.identity]; }
                })
                .on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
                    if (track.kind === Track.Kind.Audio) {
                        const audioEl = track.attach();
                        audioEl.style.display = 'none';
                        audioEl.setAttribute('aria-hidden', 'true');
                        const guestVolSlider = document.getElementById('studio-mix-guest-vol');
                        if (guestVolSlider) audioEl.volume = parseFloat(guestVolSlider.value) / 100;
                        guestAudioEls[participant.identity] = audioEl;
                        guestMutedState[participant.identity] = false;
                        if (remoteAudioEl) remoteAudioEl.appendChild(audioEl);
                        audioEl.play().catch(() => {});
                        renderGuestCard(participant.identity, participant.name || participant.identity);

                        // Attach Web Audio Analyser to incoming guest track to power 60fps VU meter
                        if (track.mediaStreamTrack) {
                            try {
                                const cleanId = (participant.identity || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_');
                                const stream = new MediaStream([track.mediaStreamTrack]);
                                const gAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
                                if (gAudioCtx.state === 'suspended') {
                                    gAudioCtx.resume().catch(() => {});
                                }
                                const gSrc = gAudioCtx.createMediaStreamSource(stream);
                                const gAnalyser = gAudioCtx.createAnalyser();
                                gAnalyser.fftSize = 64;
                                gSrc.connect(gAnalyser);
                                const dataArr = new Uint8Array(gAnalyser.frequencyBinCount);

                                let staleFrames = 0;
                                const updateGuestMeter = () => {
                                    const cardEl = document.getElementById(`guest-card-${cleanId}`) ||
                                        remoteGuestsContainer?.querySelector(`[data-raw-identity="${participant.identity}"]`) ||
                                        remoteGuestsContainer?.querySelector(`[data-clean-id="${cleanId}"]`) ||
                                        remoteGuestsContainer?.querySelector(`[data-alt-id="${cleanId}"]`);
                                    if (!cardEl) {
                                        staleFrames++;
                                        if (staleFrames > 120) {
                                            try { gAudioCtx.close(); } catch(e) {}
                                            return;
                                        }
                                        requestAnimationFrame(updateGuestMeter);
                                        return;
                                    }
                                    staleFrames = 0;
                                    gAnalyser.getByteFrequencyData(dataArr);

                                    // Speech band weighted sensitivity (bins 0-10 cover ~80Hz to 3.5kHz)
                                    let speechSum = 0;
                                    let peak = 0;
                                    const vocalBins = Math.min(10, dataArr.length);
                                    for (let i = 0; i < vocalBins; i++) {
                                        speechSum += dataArr[i];
                                        if (dataArr[i] > peak) peak = dataArr[i];
                                    }
                                    const speechAvg = speechSum / vocalBins;
                                    const speechVal = (speechAvg * 0.6) + (peak * 0.4);
                                    const pct = Math.min(100, Math.round((speechVal / 128) * 100));

                                    const bar = cardEl.querySelector('[id^="guest-meter-bar-"]') || document.getElementById(`guest-meter-bar-${cleanId}`);
                                    if (bar) {
                                        // Prefer ultra-fast direct UDP DataChannel; only update from WebRTC track analyser if DataChannel not reporting
                                        const lastDataChan = Number(bar.dataset.lkDataReceived || 0);
                                        if (!lastDataChan || (Date.now() - lastDataChan > 600)) {
                                            bar.dataset.lkActive = Date.now();
                                            bar.style.width = `${pct}%`;
                                        }
                                    }
                                    requestAnimationFrame(updateGuestMeter);
                                };
                                requestAnimationFrame(updateGuestMeter);
                            } catch(err) {
                                console.warn('[Host Studio] Could not attach guest audio analyser:', err.message);
                            }
                        }
                    }
                })
                .on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
                    const el = guestAudioEls[participant.identity];
                    if (el) { track.detach(el); }
                })
                .on(RoomEvent.DataReceived, (payload, participant) => {
                    try {
                        const msg = JSON.parse(new TextDecoder().decode(payload));
                        const rawId = participant?.identity || msg.identity || '';
                        const cleanId = (rawId || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_');
                        const gName = (msg.guest_name || participant?.name || '').toLowerCase().trim();

                        // Ultra-Fast Real-Time Guest Voice Level (<15ms latency direct UDP DataChannel)
                        if (msg.type === 'guest_level') {
                            const levelPct = Math.min(100, Math.max(0, msg.level || 0));
                            const card = document.getElementById(`guest-card-${cleanId}`) ||
                                Array.from(remoteGuestsContainer?.querySelectorAll('[id^="guest-card-"]') || []).find(c => {
                                    const cId = c.getAttribute('data-clean-id') || '';
                                    const altId = c.getAttribute('data-alt-id') || '';
                                    const rId = c.getAttribute('data-raw-identity') || '';
                                    const cName = (c.getAttribute('data-guest-name') || '').toLowerCase().trim();
                                    return cId === cleanId || altId === cleanId || rId === rawId || (gName && cName === gName);
                                });
                            if (card) {
                                const bar = card.querySelector('[id^="guest-meter-bar-"]') || document.getElementById(`guest-meter-bar-${cleanId}`);
                                if (bar) {
                                    bar.dataset.lkActive = Date.now();
                                    bar.dataset.lkDataReceived = Date.now();
                                    bar.style.width = `${levelPct}%`;
                                }
                                if (msg.muted !== undefined) {
                                    const badge = card.querySelector('[id^="guest-card-selfmute-"]');
                                    const reqBtn = card.querySelector('[id^="guest-unmute-req-btn-"]');
                                    if (badge) badge.style.display = msg.muted ? 'inline-flex' : 'none';
                                    if (reqBtn) reqBtn.style.display = msg.muted ? 'inline-block' : 'none';
                                }
                            }
                        }

                        if (msg.type === 'guest_mute_status') {
                            const card = document.getElementById(`guest-card-${cleanId}`) ||
                                Array.from(remoteGuestsContainer?.querySelectorAll('[id^="guest-card-"]') || []).find(c => {
                                    const cId = c.getAttribute('data-clean-id') || '';
                                    const altId = c.getAttribute('data-alt-id') || '';
                                    const rId = c.getAttribute('data-raw-identity') || '';
                                    const cName = (c.getAttribute('data-guest-name') || '').toLowerCase().trim();
                                    return cId === cleanId || altId === cleanId || rId === rawId || (gName && cName === gName);
                                });
                            if (card) {
                                const badge = card.querySelector('[id^="guest-card-selfmute-"]');
                                const reqBtn = card.querySelector('[id^="guest-unmute-req-btn-"]');
                                if (badge) badge.style.display = msg.muted ? 'inline-flex' : 'none';
                                if (reqBtn) reqBtn.style.display = msg.muted ? 'inline-block' : 'none';
                            }
                        }
                        if (msg.type === 'guest_recording_done' && msg.take_url) {
                            if (isTakeDeleted({ id: msg.take_id, url: msg.take_url, blobUrl: msg.take_url })) {
                                console.log('[LiveKit DataChannel] Skipping deleted take:', msg.take_url);
                                return;
                            }
                            const filename = (msg.take_url || '').split('/').pop().split('?')[0];
                            const existing = (window._podcastTakeInventory || []).find(t => 
                                (t.blobUrl && (t.blobUrl === msg.take_url || (filename && t.blobUrl.endsWith(filename))))
                            );
                            if (existing) return;

                            const guestNameLabel = msg.guest_name || participant?.name || 'Remote Guest';
                            const guestTake = {
                                id: `take-guest-${Date.now()}-${participant?.identity || Math.random().toString(36).substring(2, 7)}`,
                                stemType: 'guest',
                                guestName: guestNameLabel,
                                name: `Co-Host Stem — ${guestNameLabel} (Isolated)`,
                                duration: msg.duration || '—',
                                durationSeconds: msg.duration_seconds || 0,
                                blobUrl: msg.take_url,
                                micName: `Remote Mic: ${guestNameLabel}`,
                            };
                            window._podcastTakeInventory.unshift(guestTake);
                            renderTakeInventory();

                            // Accumulate guest takes for the current recording session
                            window._sessionGuestTakes = window._sessionGuestTakes || [];
                            window._sessionGuestTakes.push(guestTake);

                            // Synthesize automatic master multi-track mix if host has a recorded take
                            if (window._lastHostRecordedTake) {
                                mixMultiTrackSession(window._lastHostRecordedTake, window._sessionGuestTakes);
                            }
                        }
                    } catch (e) {}
                });

            const finalWsUrl = resolveLiveKitWsUrl(wsUrl);
            await hostLKRoom.connect(finalWsUrl, lkToken);

            if (hostLKRoom.remoteParticipants) {
                hostLKRoom.remoteParticipants.forEach((p) => {
                    renderGuestCard(p.identity, p.name || p.identity);
                });
            }

            // Publish host mic as LiveKit track (monitoring track — separate from MediaRecorder)
            if (currentHostStream) {
                const audioTracks = currentHostStream.getAudioTracks();
                if (audioTracks.length > 0) {
                    const { LocalAudioTrack } = await import('livekit-client');
                    hostLKTrack = new LocalAudioTrack(audioTracks[0]);
                    await hostLKRoom.localParticipant.publishTrack(hostLKTrack);
                }
            }

        } catch (err) {
            console.warn('[Studio LiveKit] Connection failed:', err.message);
            setStudioLKStatus('disconnected');
        }
    };

    // ─── Disconnect Host from LiveKit Room ───────────────────────────────────
    const disconnectHostFromLiveKit = async () => {
        stopHostGuestPolling();
        if (hostLKTrack) { await hostLKRoom?.localParticipant?.unpublishTrack(hostLKTrack); hostLKTrack = null; }
        if (hostLKRoom) { await hostLKRoom.disconnect(); hostLKRoom = null; }
        Object.values(guestAudioEls).forEach(el => el.remove());
        Object.keys(guestAudioEls).forEach(k => delete guestAudioEls[k]);
        setStudioLKStatus('offline');
    };

    // ─── Web Audio Bumper Synthesizer & WAV Encoder ─────────────────────────
    const generateBumperBuffer = async (audioCtx, type) => {
        const sampleRate = audioCtx.sampleRate || 44100;
        let duration = 3.5;
        if (type === 'strings') duration = 4.0;
        if (type === 'bell') duration = 4.5;
        if (type === 'slate') duration = 3.2;

        const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, Math.floor(sampleRate * duration), sampleRate);

        if (type === 'strings') {
            [146.83, 220.0, 293.66, 369.99].forEach((freq, idx) => {
                const osc = offlineCtx.createOscillator();
                const gain = offlineCtx.createGain();
                osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
                osc.frequency.setValueAtTime(freq, 0);

                const filter = offlineCtx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(600, 0);
                filter.frequency.linearRampToValueAtTime(1400, 1.8);
                filter.frequency.linearRampToValueAtTime(400, duration);

                gain.gain.setValueAtTime(0.0001, 0);
                gain.gain.linearRampToValueAtTime(0.08, 1.2);
                gain.gain.linearRampToValueAtTime(0.1, 2.0);
                gain.gain.exponentialRampToValueAtTime(0.0001, duration);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(offlineCtx.destination);
                osc.start(0);
                osc.stop(duration);
            });
        } else if (type === 'drone') {
            [55.0, 110.0, 164.81].forEach((freq, idx) => {
                const osc = offlineCtx.createOscillator();
                const gain = offlineCtx.createGain();
                osc.type = idx === 0 ? 'sine' : 'triangle';
                osc.frequency.setValueAtTime(freq, 0);

                gain.gain.setValueAtTime(0.0001, 0);
                gain.gain.linearRampToValueAtTime(0.12 / (idx + 1), 0.6);
                gain.gain.exponentialRampToValueAtTime(0.0001, duration);

                osc.connect(gain);
                gain.connect(offlineCtx.destination);
                osc.start(0);
                osc.stop(duration);
            });
            const chime = offlineCtx.createOscillator();
            const chimeGain = offlineCtx.createGain();
            chime.type = 'sine';
            chime.frequency.setValueAtTime(880, 0.8);
            chimeGain.gain.setValueAtTime(0.0001, 0);
            chimeGain.gain.setValueAtTime(0.07, 0.85);
            chimeGain.gain.exponentialRampToValueAtTime(0.0001, duration);
            chime.connect(chimeGain);
            chimeGain.connect(offlineCtx.destination);
            chime.start(0.8);
            chime.stop(duration);
        } else if (type === 'folk') {
            const notes = [
                { f: 146.83, t: 0.0 },
                { f: 220.00, t: 0.35 },
                { f: 293.66, t: 0.70 },
                { f: 369.99, t: 1.05 },
                { f: 440.00, t: 1.40 },
            ];
            notes.forEach(n => {
                const osc = offlineCtx.createOscillator();
                const gain = offlineCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(n.f, n.t);

                gain.gain.setValueAtTime(0.0001, 0);
                gain.gain.setValueAtTime(0.12, n.t);
                gain.gain.exponentialRampToValueAtTime(0.0001, Math.min(duration, n.t + 2.0));

                osc.connect(gain);
                gain.connect(offlineCtx.destination);
                osc.start(n.t);
                osc.stop(duration);
            });
        } else if (type === 'slate') {
            [0.0, 0.8, 1.6].forEach(time => {
                const beep = offlineCtx.createOscillator();
                const bgain = offlineCtx.createGain();
                beep.frequency.setValueAtTime(1000, time);
                bgain.gain.setValueAtTime(0.0001, 0);
                bgain.gain.setValueAtTime(0.15, time);
                bgain.gain.setValueAtTime(0.15, time + 0.1);
                bgain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
                beep.connect(bgain);
                bgain.connect(offlineCtx.destination);
                beep.start(time);
                beep.stop(time + 0.15);
            });
            const lock = offlineCtx.createOscillator();
            const lgain = offlineCtx.createGain();
            lock.frequency.setValueAtTime(1500, 2.4);
            lgain.gain.setValueAtTime(0.0001, 0);
            lgain.gain.setValueAtTime(0.15, 2.4);
            lgain.gain.setValueAtTime(0.15, 2.9);
            lgain.gain.exponentialRampToValueAtTime(0.0001, 3.1);
            lock.connect(lgain);
            lgain.connect(offlineCtx.destination);
            lock.start(2.4);
            lock.stop(3.15);
        } else if (type === 'piano') {
            [130.81, 196.00, 293.66, 329.63, 493.88].forEach(freq => {
                const osc = offlineCtx.createOscillator();
                const gain = offlineCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, 0);

                gain.gain.setValueAtTime(0.0001, 0);
                gain.gain.setValueAtTime(0.09, 0.05);
                gain.gain.exponentialRampToValueAtTime(0.0001, duration);

                osc.connect(gain);
                gain.connect(offlineCtx.destination);
                osc.start(0);
                osc.stop(duration);
            });
        } else if (type === 'tech') {
            const osc = offlineCtx.createOscillator();
            const gain = offlineCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(520, 0);
            osc.frequency.exponentialRampToValueAtTime(110, 2.0);

            gain.gain.setValueAtTime(0.0001, 0);
            gain.gain.linearRampToValueAtTime(0.15, 0.1);
            gain.gain.exponentialRampToValueAtTime(0.0001, duration);

            osc.connect(gain);
            gain.connect(offlineCtx.destination);
            osc.start(0);
            osc.stop(duration);
        } else if (type === 'bell') {
            [587.33, 880.00, 1318.51, 1760.00].forEach((freq, idx) => {
                const bell = offlineCtx.createOscillator();
                const bgain = offlineCtx.createGain();
                bell.type = 'sine';
                bell.frequency.setValueAtTime(freq, 0);

                bgain.gain.setValueAtTime(0.0001, 0);
                bgain.gain.setValueAtTime(0.12 / (idx + 1), 0.02);
                bgain.gain.exponentialRampToValueAtTime(0.0001, duration);

                bell.connect(bgain);
                bgain.connect(offlineCtx.destination);
                bell.start(0);
                bell.stop(duration);
            });
        } else if (type === 'folk_outro') {
            [146.83, 220.00, 293.66, 440.00].forEach(freq => {
                const osc = offlineCtx.createOscillator();
                const gain = offlineCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, 0);

                gain.gain.setValueAtTime(0.0001, 0);
                gain.gain.setValueAtTime(0.1, 0.08);
                gain.gain.exponentialRampToValueAtTime(0.0001, duration);

                osc.connect(gain);
                gain.connect(offlineCtx.destination);
                osc.start(0);
                osc.stop(duration);
            });
        }

        return await offlineCtx.startRendering();
    };

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
    