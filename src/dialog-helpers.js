/**
 * LocalFilm Audio Network & Podcast Suite v1.6.0
 * High-End Cinematic Retail Layout & Member Spotlight Audio Studio
 */

import * as api from '../api.js';

let currentAudio = null;
let currentSubtrackAudio = null;
let currentPlayingEpisode = null;
let episodesList = [];
let isPlaying = false;
let playbackSpeed = 1.0;
let mediaRecorder = null;
let recordedChunks = [];
let recordingTimer = null;
let recordSeconds = 0;
let selectedFeaturedMembers = [];

// Resilient Clipboard Copy Helper (works across permissions and transient user activation loss)
const copyStudioLinkToClipboard = async (text) => {
    let copied = false;
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            copied = true;
        }
    } catch (clipErr) {
        console.warn('[Podcasts] navigator.clipboard.writeText blocked or failed:', clipErr);
    }

    if (!copied) {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            copied = document.execCommand('copy');
            document.body.removeChild(ta);
        } catch (fallbackErr) {
            console.warn('[Podcasts] execCommand copy fallback failed:', fallbackErr);
        }
    }
    return copied;
};

// Screen WakeLock Manager to prevent mobile devices from sleeping during podcast sessions
let studioWakeLock = null;
const requestStudioWakeLock = async () => {
    try {
        if ('wakeLock' in navigator && !studioWakeLock) {
            studioWakeLock = await navigator.wakeLock.request('screen');
            studioWakeLock.addEventListener('release', () => {
                studioWakeLock = null;
            });
            console.log('[Studio] Screen WakeLock acquired.');
        }
    } catch (e) {
        console.warn('[Studio] Screen WakeLock could not be acquired:', e.message);
    }
};

const releaseStudioWakeLock = async () => {
    try {
        if (studioWakeLock) {
            await studioWakeLock.release();
            studioWakeLock = null;
            console.log('[Studio] Screen WakeLock released.');
        }
    } catch (e) {
        console.warn('[Studio] Screen WakeLock release error:', e.message);
    }
};

// ── Cinematic Studio Modal & Dialog Subsystem (Phase 2 Theming) ──
// Replaces stock white browser alerts/prompts/confirms with dark-cinematic, obsidian-themed modals
