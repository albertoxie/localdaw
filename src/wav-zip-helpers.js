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
const ensureStudioDialogContainer = () => {
    let overlay = document.getElementById('studio-custom-dialog-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'studio-custom-dialog-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.88);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            z-index: 999999;
            display: none;
            align-items: center;
            justify-content: center;
            padding: clamp(16px, 3vw, 28px);
            opacity: 0;
            transition: opacity 0.2s ease;
        `;
        overlay.innerHTML = `
            <div id="studio-custom-dialog-box" style="
                background: #0d111a;
                border: 1px solid rgba(255, 255, 255, 0.14);
                border-radius: 18px;
                width: 100%;
                max-width: 460px;
                padding: 26px 28px;
                box-shadow: 0 32px 80px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(255, 255, 255, 0.05);
                transform: scale(0.96);
                transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                color: #ffffff;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                box-sizing: border-box;
            ">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
                    <div id="studio-dialog-icon-wrap" style="width: 32px; height: 32px; border-radius: 8px; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.15); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <svg id="studio-dialog-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                    </div>
                    <div>
                        <div style="font-size: 10px; font-weight: 800; letter-spacing: 0.8px; color: rgba(255, 255, 255, 0.5); text-transform: uppercase;">LOCALFILM STUDIO</div>
                        <h3 id="studio-dialog-title" style="margin: 0; font-size: 15px; font-weight: 800; color: #ffffff; letter-spacing: -0.2px;">Studio Notice</h3>
                    </div>
                </div>

                <div id="studio-dialog-body" style="font-size: 13px; line-height: 1.55; color: #cbd5e1; margin-bottom: 18px; white-space: pre-line; word-break: break-word;"></div>

                <div id="studio-dialog-input-container" style="display: none; margin-bottom: 18px;">
                    <input id="studio-dialog-input" type="text" style="
                        width: 100%;
                        background: rgba(0, 0, 0, 0.55);
                        border: 1px solid rgba(255, 255, 255, 0.2);
                        border-radius: 9px;
                        padding: 10px 14px;
                        color: #ffffff;
                        font-size: 13px;
                        outline: none;
                        box-sizing: border-box;
                        transition: border-color 0.15s;
                    " placeholder="">
                </div>

                <div id="studio-dialog-actions" style="display: flex; align-items: center; justify-content: flex-end; gap: 10px;">
                    <button id="studio-dialog-cancel-btn" type="button" style="
                        background: rgba(255, 255, 255, 0.06);
                        border: 1px solid rgba(255, 255, 255, 0.14);
                        color: rgba(255, 255, 255, 0.8);
                        font-size: 12.5px;
                        font-weight: 700;
                        padding: 9px 18px;
                        border-radius: 9px;
                        cursor: pointer;
                        transition: all 0.15s;
                    ">Cancel</button>
                    <button id="studio-dialog-confirm-btn" type="button" style="
                        background: linear-gradient(135deg, rgba(56, 189, 248, 0.9) 0%, rgba(14, 165, 233, 0.95) 100%);
                        border: 1px solid rgba(56, 189, 248, 0.5);
                        color: #ffffff;
                        font-size: 12.5px;
                        font-weight: 800;
                        padding: 9px 20px;
                        border-radius: 9px;
                        cursor: pointer;
                        box-shadow: 0 0 16px rgba(56, 189, 248, 0.25);
                        transition: all 0.15s;
                    ">Confirm</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    return overlay;
};

// Studio Toast System (Single-line unified status broadcast at bottom)
const showStudioToast = (message, duration = 3000) => {
    if (typeof window !== 'undefined' && typeof window.setStudioStatus === 'function') {
        window.setStudioStatus(message, 'info', false, duration);
    } else {
        const textEl = document.getElementById('daw-status-text');
        if (textEl) {
            textEl.textContent = message;
            setTimeout(() => { if (textEl.textContent === message) textEl.textContent = 'Ready'; }, duration);
        }
    }
    const container = document.getElementById('studio-toast-container');
    if (container) {
        container.innerHTML = '';
    }
};

// Studio Alert Modal
const showStudioAlert = (title, message) => {
    return new Promise((resolve) => {
        const overlay = ensureStudioDialogContainer();
        const box = document.getElementById('studio-custom-dialog-box');
        const titleEl = document.getElementById('studio-dialog-title');
        const bodyEl = document.getElementById('studio-dialog-body');
        const inputContainer = document.getElementById('studio-dialog-input-container');
        const cancelBtn = document.getElementById('studio-dialog-cancel-btn');
        const confirmBtn = document.getElementById('studio-dialog-confirm-btn');

        titleEl.textContent = title || 'Studio Notice';
        bodyEl.textContent = message || '';
        inputContainer.style.display = 'none';
        cancelBtn.style.display = 'none';
        confirmBtn.textContent = 'Got It';
        confirmBtn.style.background = 'linear-gradient(135deg, rgba(56, 189, 248, 0.9) 0%, rgba(14, 165, 233, 0.95) 100%)';
        confirmBtn.style.borderColor = 'rgba(56, 189, 248, 0.5)';

        const closeDialog = () => {
            overlay.style.opacity = '0';
            box.style.transform = 'scale(0.96)';
            setTimeout(() => {
                overlay.style.display = 'none';
                confirmBtn.onclick = null;
                cancelBtn.onclick = null;
                document.removeEventListener('keydown', keyHandler);
                resolve();
            }, 180);
        };

        const keyHandler = (e) => {
            if (e.key === 'Escape' || e.key === 'Enter') {
                e.preventDefault();
                closeDialog();
            }
        };

        confirmBtn.onclick = closeDialog;
        document.addEventListener('keydown', keyHandler);

        overlay.style.display = 'flex';
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            box.style.transform = 'scale(1)';
            confirmBtn.focus();
        });
    });
};

// Studio Confirm Modal
const showStudioConfirm = (title, message, options = {}) => {
    return new Promise((resolve) => {
        const overlay = ensureStudioDialogContainer();
        const box = document.getElementById('studio-custom-dialog-box');
        const titleEl = document.getElementById('studio-dialog-title');
        const bodyEl = document.getElementById('studio-dialog-body');
        const inputContainer = document.getElementById('studio-dialog-input-container');
        const cancelBtn = document.getElementById('studio-dialog-cancel-btn');
        const confirmBtn = document.getElementById('studio-dialog-confirm-btn');

        titleEl.textContent = title || 'Confirm Action';
        bodyEl.textContent = message || '';
        inputContainer.style.display = 'none';
        cancelBtn.style.display = 'inline-block';
        cancelBtn.textContent = options.cancelText || 'Cancel';
        confirmBtn.textContent = options.confirmText || 'Confirm';

        if (options.danger) {
            confirmBtn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
            confirmBtn.style.borderColor = 'rgba(239, 68, 68, 0.6)';
            confirmBtn.style.boxShadow = '0 0 16px rgba(239, 68, 68, 0.35)';
        } else {
            confirmBtn.style.background = 'linear-gradient(135deg, rgba(56, 189, 248, 0.9) 0%, rgba(14, 165, 233, 0.95) 100%)';
            confirmBtn.style.borderColor = 'rgba(56, 189, 248, 0.5)';
            confirmBtn.style.boxShadow = '0 0 16px rgba(56, 189, 248, 0.25)';
        }

        const closeDialog = (val) => {
            overlay.style.opacity = '0';
            box.style.transform = 'scale(0.96)';
            setTimeout(() => {
                overlay.style.display = 'none';
                confirmBtn.onclick = null;
                cancelBtn.onclick = null;
                document.removeEventListener('keydown', keyHandler);
                resolve(val);
            }, 180);
        };

        const keyHandler = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeDialog(false);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                closeDialog(true);
            }
        };

        confirmBtn.onclick = () => closeDialog(true);
        cancelBtn.onclick = () => closeDialog(false);
        document.addEventListener('keydown', keyHandler);

        overlay.style.display = 'flex';
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            box.style.transform = 'scale(1)';
            confirmBtn.focus();
        });
    });
};

// Studio Prompt Modal
const showStudioPrompt = (title, message, defaultValue = '', placeholder = '') => {
    return new Promise((resolve) => {
        const overlay = ensureStudioDialogContainer();
        const box = document.getElementById('studio-custom-dialog-box');
        const titleEl = document.getElementById('studio-dialog-title');
        const bodyEl = document.getElementById('studio-dialog-body');
        const inputContainer = document.getElementById('studio-dialog-input-container');
        const inputEl = document.getElementById('studio-dialog-input');
        const cancelBtn = document.getElementById('studio-dialog-cancel-btn');
        const confirmBtn = document.getElementById('studio-dialog-confirm-btn');

        titleEl.textContent = title || 'Enter Details';
        bodyEl.textContent = message || '';
        inputContainer.style.display = 'block';
        inputEl.value = defaultValue || '';
        inputEl.placeholder = placeholder || '';
        cancelBtn.style.display = 'inline-block';
        cancelBtn.textContent = 'Cancel';
        confirmBtn.textContent = 'Save';
        confirmBtn.style.background = 'linear-gradient(135deg, rgba(56, 189, 248, 0.9) 0%, rgba(14, 165, 233, 0.95) 100%)';
        confirmBtn.style.borderColor = 'rgba(56, 189, 248, 0.5)';
        confirmBtn.style.boxShadow = '0 0 16px rgba(56, 189, 248, 0.25)';

        const closeDialog = (val) => {
            overlay.style.opacity = '0';
            box.style.transform = 'scale(0.96)';
            setTimeout(() => {
                overlay.style.display = 'none';
                confirmBtn.onclick = null;
                cancelBtn.onclick = null;
                document.removeEventListener('keydown', keyHandler);
                resolve(val);
            }, 180);
        };

        const keyHandler = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeDialog(null);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                closeDialog(inputEl.value);
            }
        };

        confirmBtn.onclick = () => closeDialog(inputEl.value);
        cancelBtn.onclick = () => closeDialog(null);
        document.addEventListener('keydown', keyHandler);

        overlay.style.display = 'flex';
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            box.style.transform = 'scale(1)';
            inputEl.focus();
            inputEl.select();
        });
    });
};

export async function renderPodcastNetworkPage() {
    document.title = "LF TV & Podcasts | Film Industry On-Set Talks & Audio Network | LocalFilm Ireland";
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = "description";
        document.head.appendChild(metaDesc);
    }
    metaDesc.content = "Stream & download LocalFilm Ireland's self-hosted podcast network. On-set talks, technical masterclasses, and Irish film industry breakdowns across 32 counties.";

    const urlParams = new URLSearchParams(window.location.search);
    const guestSession = urlParams.get('guest_session');
    const guestName = urlParams.get('guest_name');

    const appEl = document.getElementById('app');
    if (!appEl) return;

    let currentUser = window.currentUser || null;
    if (!currentUser) {
        try {
            currentUser = JSON.parse(localStorage.getItem('user') || localStorage.getItem('currentUser') || '{}');
        } catch (e) {}
    }
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
    const userRole = currentUser?.role || currentUser?.profile?.role || window.currentRole || localStorage.getItem('user_role') || '';
    const isSuperAdmin = userRole === 'super_admin' || currentUser?.is_super_admin === true || currentUser?.is_superadmin === true || window.isSuperAdmin === true;
    const canManagePodcasts = isSuperAdmin || ['super_admin', 'admin'].includes(userRole);
    const isAdmin = canManagePodcasts;
    window._isSuperAdminUser = canManagePodcasts;

    // FEATURE 3: Remote Guest Studio Mode when guest_session parameter is in URL
    if (guestSession) {
        renderRemoteGuestStudioPage(appEl, guestSession, guestName || 'Guest');
        return;
    }

    appEl.innerHTML = `
        <div class="podcast-retail-container" style="background: #07080c; color: #f5f6f8; min-height: 100vh; padding-bottom: 140px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            
            <!-- Global Header Bar -->
            <header role="banner" style="background: rgba(8, 10, 15, 0.96); backdrop-filter: blur(24px); border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding: 14px 28px; position: sticky; top: 0; z-index: 100;">
                <div style="max-width: 1440px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
                    
                    <!-- Brand & Breadcrumb -->
                    <div style="display: flex; align-items: center; gap: 14px;">
                        <a href="/" style="color: rgba(255, 255, 255, 0.6); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; font-weight: 700; font-size: 12.5px; padding: 6px 12px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.08)'; this.style.color='#ffffff';" onmouseout="this.style.background='rgba(255,255,255,0.04)'; this.style.color='rgba(255, 255, 255, 0.6)';">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                            Back to Platform
                        </a>
                        <span style="color: rgba(255, 255, 255, 0.2); font-weight: 300;">/</span>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(16, 185, 129, 0.15) 100%); border: 1px solid rgba(56, 189, 248, 0.35); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 12px rgba(56, 189, 248, 0.2);">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>
                            </div>
                            <div>
                                <span style="font-weight: 900; font-size: 15px; letter-spacing: 0.5px; color: #ffffff; display: block; line-height: 1.2;">LOCALFILM AUDIO NETWORK</span>
                                <span style="font-size: 10.5px; font-weight: 700; letter-spacing: 0.6px; color: #38bdf8; text-transform: uppercase;">Production Radio &amp; Studio Suite</span>
                            </div>
                        </div>
                    </div>

                    <!-- Header Quick Actions Strip -->
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <button id="podcast-analytics-btn" title="View Network Analytics" style="height: 36px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); color: rgba(255, 255, 255, 0.9); padding: 0 14px; border-radius: 8px; font-size: 12.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; transition: all 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.1)';" onmouseout="this.style.background='rgba(255,255,255,0.05)';">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                            Analytics
                        </button>

                        <a href="/podcasts/rss.xml" target="_blank" title="iTunes/Spotify Compliant RSS Feed" style="height: 36px; box-sizing: border-box; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); color: #fbbf24; padding: 0 14px; border-radius: 8px; font-size: 12.5px; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 7px; transition: all 0.15s;" onmouseover="this.style.background='rgba(245, 158, 11, 0.16)';" onmouseout="this.style.background='rgba(245, 158, 11, 0.08)';">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 11a9 9 0 0 1 9 9"></path><path d="M4 4a16 16 0 0 1 16 16"></path><circle cx="5" cy="19" r="1"></circle></svg>
                            RSS Feed
                        </a>

                        ${isAdmin ? `
                        <button id="podcast-blog-script-btn" title="Convert Community Notice / Article to Audio Script" style="height: 36px; background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.35); color: #c084fc; padding: 0 14px; border-radius: 8px; font-size: 12.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s;" onmouseover="this.style.background='rgba(168, 85, 247, 0.2)';" onmouseout="this.style.background='rgba(168, 85, 247, 0.1)';">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                            Blog to Script
                        </button>

                        <button id="podcast-recorder-btn" title="Open Presenter Live Recording Studio &amp; Remote Co-Host Room" style="height: 36px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.5); color: #f87171; padding: 0 14px; border-radius: 8px; font-size: 12.5px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; transition: all 0.15s; box-shadow: 0 0 12px rgba(239, 68, 68, 0.2);" onmouseover="this.style.background='#ef4444'; this.style.color='#ffffff';" onmouseout="this.style.background='rgba(239, 68, 68, 0.15)'; this.style.color='#f87171';">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                            Live Studio &amp; Co-Hosts
                        </button>

                        <button id="podcast-open-daw-btn" title="Open Timeline DAW Multi-Track Audio Editor" style="height: 36px; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8; padding: 0 14px; border-radius: 8px; font-size: 12.5px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; transition: all 0.15s; box-shadow: 0 0 12px rgba(56, 189, 248, 0.15);" onmouseover="this.style.background='rgba(56, 189, 248, 0.25)';" onmouseout="this.style.background='rgba(56, 189, 248, 0.15)';">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                            Timeline DAW
                        </button>

                        <button id="podcast-admin-upload-btn" title="Publish New Episode to Network and RSS" style="height: 36px; background: #10b981; color: #ffffff; border: 1px solid #059669; padding: 0 16px; border-radius: 8px; font-size: 12.5px; font-weight: 900; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; transition: all 0.15s; box-shadow: 0 2px 10px rgba(16, 185, 129, 0.35);" onmouseover="this.style.background='#059669';" onmouseout="this.style.background='#10b981';">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            Publish Episode
                        </button>
                        ` : ''}
                    </div>
                </div>
            </header>

            <!-- Featured Episode Hero Showcase -->
            <section style="max-width: 1440px; margin: 24px auto 0; padding: 0 36px;">
                <div id="featured-episode-hero" style="background: linear-gradient(135deg, rgba(20, 24, 38, 0.95) 0%, rgba(9, 11, 16, 0.99) 100%); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; padding: 32px 36px; position: relative; overflow: hidden; box-shadow: 0 24px 50px rgba(0,0,0,0.6);">
                    <div style="text-align: center; color: rgba(255,255,255,0.4); padding: 36px 0;">
                        Loading featured episode...
                    </div>
                </div>
            </section>

            <!-- Listen Anywhere Retail Badges Bar -->
            <section style="max-width: 1440px; margin: 20px auto 0; padding: 0 36px;">
                <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 14px; padding: 12px 22px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px;">
                    <div style="display: flex; align-items: center; gap: 9px;">
                        <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 6px #38bdf8;"></span>
                        <span style="font-size: 11.5px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; color: rgba(255, 255, 255, 0.75);">LISTEN ON ANY PLAYER</span>
                    </div>

                    <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 10px;">
                        <a href="/podcasts/rss.xml" target="_blank" style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 7px; padding: 5px 12px; color: #ffffff; text-decoration: none; font-size: 11.5px; font-weight: 700; display: flex; align-items: center; gap: 6px; transition: all 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.08)';" onmouseout="this.style.background='rgba(255,255,255,0.04)';">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 11a9 9 0 0 1 9 9"></path><path d="M4 4a16 16 0 0 1 16 16"></path><circle cx="5" cy="19" r="1"></circle></svg>
                            Apple Podcasts
                        </a>
                        <a href="/podcasts/rss.xml" target="_blank" style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 7px; padding: 5px 12px; color: #ffffff; text-decoration: none; font-size: 11.5px; font-weight: 700; display: flex; align-items: center; gap: 6px; transition: all 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.08)';" onmouseout="this.style.background='rgba(255,255,255,0.04)';">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
                            Spotify (RSS)
                        </a>
                        <a href="/podcasts/rss.xml" target="_blank" style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 7px; padding: 5px 12px; color: #ffffff; text-decoration: none; font-size: 11.5px; font-weight: 700; display: flex; align-items: center; gap: 6px; transition: all 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.08)';" onmouseout="this.style.background='rgba(255,255,255,0.04)';">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
                            Pocket Casts
                        </a>
                        <a href="/podcasts/rss.xml" target="_blank" style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 7px; padding: 5px 12px; color: #ffffff; text-decoration: none; font-size: 11.5px; font-weight: 700; display: flex; align-items: center; gap: 6px; transition: all 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.08)';" onmouseout="this.style.background='rgba(255,255,255,0.04)';">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Direct MP3
                        </a>
                    </div>
                </div>
            </section>

            <!-- LocalFilm Audio Creator Suite Showcase (Interactive Studio Tools Deck) -->
            ${canManagePodcasts ? `
            <section style="max-width: 1440px; margin: 28px auto 0; padding: 0 36px;">
                <div style="background: linear-gradient(180deg, rgba(14, 18, 28, 0.9) 0%, rgba(8, 10, 15, 0.98) 100%); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px; padding: 22px 28px; position: relative; overflow: hidden; box-shadow: 0 16px 40px rgba(0,0,0,0.6);">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; flex-wrap: wrap; gap: 12px;">
                        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                            <span style="font-size: 10px; font-weight: 900; letter-spacing: 1.2px; text-transform: uppercase; color: #38bdf8; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.25); padding: 3px 10px; border-radius: 6px;">CREATOR PRODUCTION DOCK</span>
                            <span style="font-size: 13.5px; font-weight: 800; color: #ffffff; letter-spacing: -0.2px;">Broadcast Tools &amp; Distribution Suite</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.4);">4 Integrated Studio Engines</span>
                            ${isAdmin ? `
                                <button id="suite-launch-publisher-btn" style="background: rgba(255,255,255,0.06); color: #ffffff; border: 1px solid rgba(255,255,255,0.15); padding: 6px 14px; border-radius: 8px; font-weight: 800; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.12)';" onmouseout="this.style.background='rgba(255,255,255,0.06)';">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
                                    All Studio Tools
                                </button>
                            ` : ''}
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;">
                        
                        <!-- Tool Card 1: Multi-Track DAW Editor (Cyan Theme) -->
                        <div id="suite-tool-daw-card" style="background: rgba(56, 189, 248, 0.03); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 14px; padding: 18px; display: flex; flex-direction: column; justify-content: space-between; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#38bdf8'; this.style.background='rgba(56, 189, 248, 0.07)'; this.style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='rgba(56, 189, 248, 0.2)'; this.style.background='rgba(56, 189, 248, 0.03)'; this.style.transform='translateY(0)';">
                            <div>
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                                    <div style="width: 36px; height: 36px; border-radius: 9px; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.3); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 12px rgba(56, 189, 248, 0.2);">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line></svg>
                                    </div>
                                    <span style="font-size: 10px; font-weight: 800; color: #38bdf8; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); padding: 2px 7px; border-radius: 4px; letter-spacing: 0.5px;">TIMELINE DAW</span>
                                </div>
                                <h3 style="font-size: 15px; font-weight: 800; color: #ffffff; margin: 0 0 5px; display: flex; align-items: center; gap: 6px;">
                                    Multi-Track Studio DAW
                                </h3>
                                <p style="font-size: 12px; line-height: 1.45; color: rgba(255, 255, 255, 0.6); margin: 0;">Multi-lane audio sequencing, split &amp; trim editing, live ducking fader, and waveform display.</p>
                            </div>
                            <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid rgba(56, 189, 248, 0.12); display: flex; align-items: center; justify-content: space-between;">
                                <span style="font-size: 11px; font-weight: 700; color: rgba(255, 255, 255, 0.4);">Non-destructive</span>
                                <span style="font-size: 11px; font-weight: 800; color: #38bdf8; display: flex; align-items: center; gap: 4px;">Launch DAW &rarr;</span>
                            </div>
                        </div>

                        <!-- Tool Card 2: Remote Co-Host & Studio Mic (Crimson Theme) -->
                        <div id="suite-tool-recorder-card" style="background: rgba(239, 68, 68, 0.03); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 14px; padding: 18px; display: flex; flex-direction: column; justify-content: space-between; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#ef4444'; this.style.background='rgba(239, 68, 68, 0.07)'; this.style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='rgba(239, 68, 68, 0.2)'; this.style.background='rgba(239, 68, 68, 0.03)'; this.style.transform='translateY(0)';">
                            <div>
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                                    <div style="width: 36px; height: 36px; border-radius: 9px; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 12px rgba(239, 68, 68, 0.2);">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line></svg>
                                    </div>
                                    <span style="font-size: 10px; font-weight: 800; color: #f87171; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); padding: 2px 7px; border-radius: 4px; letter-spacing: 0.5px;">LIVE + 7 GUESTS</span>
                                </div>
                                <h3 style="font-size: 15px; font-weight: 800; color: #ffffff; margin: 0 0 5px;">
                                    Recorder &amp; Co-Host Studio
                                </h3>
                                <p style="font-size: 12px; line-height: 1.45; color: rgba(255, 255, 255, 0.6); margin: 0;">Multi-mic hardware capture with live VU metering, calibrated DSP rack, &amp; 1-click remote guest links.</p>
                            </div>
                            <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid rgba(239, 68, 68, 0.12); display: flex; align-items: center; justify-content: space-between;">
                                <span style="font-size: 11px; font-weight: 700; color: rgba(255, 255, 255, 0.4);">Zero-latency WebRTC</span>
                                <span style="font-size: 11px; font-weight: 800; color: #f87171; display: flex; align-items: center; gap: 4px;">Open Studio &rarr;</span>
                            </div>
                        </div>

                        <!-- Tool Card 3: AI Blog-to-Script Studio (Violet Theme) -->
                        <div id="suite-tool-script-card" style="background: rgba(168, 85, 247, 0.03); border: 1px solid rgba(168, 85, 247, 0.2); border-radius: 14px; padding: 18px; display: flex; flex-direction: column; justify-content: space-between; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#a855f7'; this.style.background='rgba(168, 85, 247, 0.07)'; this.style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='rgba(168, 85, 247, 0.2)'; this.style.background='rgba(168, 85, 247, 0.03)'; this.style.transform='translateY(0)';">
                            <div>
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                                    <div style="width: 36px; height: 36px; border-radius: 9px; background: rgba(168, 85, 247, 0.12); border: 1px solid rgba(168, 85, 247, 0.3); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 12px rgba(168, 85, 247, 0.2);">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c084fc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                                    </div>
                                    <span style="font-size: 10px; font-weight: 800; color: #c084fc; background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.3); padding: 2px 7px; border-radius: 4px; letter-spacing: 0.5px;">AI ASSISTANT</span>
                                </div>
                                <h3 style="font-size: 15px; font-weight: 800; color: #ffffff; margin: 0 0 5px;">
                                    Blog to Radio Script
                                </h3>
                                <p style="font-size: 12px; line-height: 1.45; color: rgba(255, 255, 255, 0.6); margin: 0;">Convert articles, production notices, &amp; forum posts into natural 2-host radio scripts with intro cues.</p>
                            </div>
                            <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid rgba(168, 85, 247, 0.12); display: flex; align-items: center; justify-content: space-between;">
                                <span style="font-size: 11px; font-weight: 700; color: rgba(255, 255, 255, 0.4);">Instant Outline</span>
                                <span style="font-size: 11px; font-weight: 800; color: #c084fc; display: flex; align-items: center; gap: 4px;">Generate &rarr;</span>
                            </div>
                        </div>

                        <!-- Tool Card 4: Publisher & Distribution Engine (Emerald Theme) -->
                        <div id="suite-tool-publisher-card" style="background: rgba(16, 185, 129, 0.03); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 14px; padding: 18px; display: flex; flex-direction: column; justify-content: space-between; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#10b981'; this.style.background='rgba(16, 185, 129, 0.07)'; this.style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='rgba(16, 185, 129, 0.2)'; this.style.background='rgba(16, 185, 129, 0.03)'; this.style.transform='translateY(0)';">
                            <div>
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                                    <div style="width: 36px; height: 36px; border-radius: 9px; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 12px rgba(16, 185, 129, 0.2);">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11a9 9 0 0 1 9 9"></path><path d="M4 4a16 16 0 0 1 16 16"></path><circle cx="5" cy="19" r="1"></circle></svg>
                                    </div>
                                    <span style="font-size: 10px; font-weight: 800; color: #34d399; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); padding: 2px 7px; border-radius: 4px; letter-spacing: 0.5px;">APPLE + SPOTIFY RSS</span>
                                </div>
                                <h3 style="font-size: 15px; font-weight: 800; color: #ffffff; margin: 0 0 5px;">
                                    Publish &amp; RSS Syndicate
                                </h3>
                                <p style="font-size: 12px; line-height: 1.45; color: rgba(255, 255, 255, 0.6); margin: 0;">1400x1400 artwork engine, ID3 tagger, chapters generator, and compliant XML RSS feed syndication.</p>
                            </div>
                            <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid rgba(16, 185, 129, 0.12); display: flex; align-items: center; justify-content: space-between;">
                                <span style="font-size: 11px; font-weight: 700; color: rgba(255, 255, 255, 0.4);">32 County Hubs</span>
                                <span style="font-size: 11px; font-weight: 800; color: #34d399; display: flex; align-items: center; gap: 4px;">Publish Show &rarr;</span>
                            </div>
                        </div>

                    </div>
                </div>
            </section>
            ` : ''}

            <!-- Episodes Grid & Filter Bar -->
            <section style="max-width: 1440px; margin: 32px auto 0; padding: 0 36px;">
                <div style="display: flex; flex-direction: column; gap: 20px; margin-bottom: 28px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 24px;">
                    
                    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
                        <div>
                            <span style="font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: rgba(255, 255, 255, 0.4);">RETAIL EPISODE ARCHIVE</span>
                            <h2 style="font-size: 28px; font-weight: 900; margin: 4px 0 0; color: #ffffff; letter-spacing: -0.5px;">All Shows &amp; Masterclasses</h2>
                        </div>
                        
                        <div id="podcast-counter-badge" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 800; color: #ffffff;">
                            Loading Archive...
                        </div>
                    </div>

                    <!-- Filter & Sort Controls Row -->
                    <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 16px 20px;">
                        
                        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px; flex: 1; min-width: 280px;">
                            <!-- Search Input -->
                            <div style="position: relative; flex: 1; min-width: 220px;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2" style="position: absolute; left: 14px; top: 12px; pointer-events: none;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                <input type="text" id="podcast-search-input" placeholder="Search episode, guest, or topic..." style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 10px; padding: 9px 14px 9px 36px; color: #ffffff; font-size: 13px; width: 100%; outline: none; transition: border-color 0.2s;">
                            </div>

                            <!-- Season Dropdown Filter -->
                            <select id="podcast-season-filter" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 10px; padding: 9px 14px; color: #ffffff; font-size: 13px; outline: none; cursor: pointer;">
                                <option value="all">All Seasons &amp; Series</option>
                                <option value="4">Series 4 (2024)</option>
                                <option value="3">Series 3</option>
                                <option value="2">Series 2</option>
                                <option value="1">Series 1 (2020-2022)</option>
                            </select>

                            <!-- County Hub Dropdown Filter -->
                            <select id="podcast-hub-filter" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 10px; padding: 9px 14px; color: #ffffff; font-size: 13px; outline: none; cursor: pointer;">
                                <option value="all">All 32 County Hubs</option>
                                <option value="Antrim">Antrim Hub</option>
                                <option value="Armagh">Armagh Hub</option>
                                <option value="Carlow">Carlow Hub</option>
                                <option value="Cavan">Cavan Hub</option>
                                <option value="Clare">Clare Hub</option>
                                <option value="Cork">Cork Hub</option>
                                <option value="Derry">Derry Hub</option>
                                <option value="Donegal">Donegal Hub</option>
                                <option value="Down">Down Hub</option>
                                <option value="Fermanagh">Fermanagh Hub</option>
                                <option value="Galway">Galway Hub</option>
                                <option value="Kerry">Kerry Hub</option>
                                <option value="Kildare">Kildare Hub</option>
                                <option value="Kilkenny">Kilkenny Hub</option>
                                <option value="Laois">Laois Hub</option>
                                <option value="Leitrim">Leitrim Hub</option>
                                <option value="Limerick">Limerick Hub</option>
                                <option value="Longford">Longford Hub</option>
                                <option value="Louth">Louth Hub</option>
                                <option value="Mayo">Mayo Hub</option>
                                <option value="Meath">Meath Hub</option>
                                <option value="Monaghan">Monaghan Hub</option>
                                <option value="Offaly">Offaly Hub</option>
                                <option value="Roscommon">Roscommon Hub</option>
                                <option value="Sligo">Sligo Hub</option>
                                <option value="Tipperary">Tipperary Hub</option>
                                <option value="Tyrone">Tyrone Hub</option>
                                <option value="Waterford">Waterford Hub</option>
                                <option value="Westmeath">Westmeath Hub</option>
                                <option value="Wexford">Wexford Hub</option>
                                <option value="Wicklow">Wicklow Hub</option>
                            </select>

                            <!-- Sort Dropdown -->
                            <select id="podcast-sort-filter" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 10px; padding: 9px 14px; color: #ffffff; font-size: 13px; outline: none; cursor: pointer;">
                                <option value="newest">Sort: Newest First</option>
                                <option value="oldest">Sort: Oldest First</option>
                                <option value="listens">Sort: Most Listened</option>
                                <option value="duration_long">Sort: Longest Duration</option>
                                <option value="duration_short">Sort: Shortest Duration</option>
                            </select>
                        </div>

                        <!-- View Layout Toggle Mode -->
                        <div style="display: flex; align-items: center; gap: 4px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 3px;">
                            <button id="podcast-view-grid-btn" title="Grid View" style="background: rgba(255,255,255,0.15); border: none; color: #ffffff; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                                Grid
                            </button>
                            <button id="podcast-view-list-btn" title="Compact List View" style="background: transparent; border: none; color: rgba(255,255,255,0.5); padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                                List
                            </button>
                        </div>

                    </div>
                </div>

                <!-- Episodes Main Container -->
                <div id="podcast-episodes-container">
                    <div style="text-align: center; padding: 64px; color: rgba(255, 255, 255, 0.4);">
                        Loading episodes archive...
                    </div>
                </div>

                <!-- Batch Pagination Load More Container -->
                <div id="podcast-load-more-container" style="text-align: center; margin-top: 40px; display: none;">
                    <button id="podcast-load-more-btn" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.2); color: #ffffff; padding: 14px 32px; border-radius: 12px; font-weight: 900; font-size: 14px; cursor: pointer; transition: background 0.2s, transform 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.15)'; this.style.transform='scale(1.02)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'; this.style.transform='scale(1)'">
                        ⚡ Load More Shows
                    </button>
                </div>
            </section>

            <!-- Sticky Retail Player Bar -->
            <div id="podcast-player-bar" style="position: fixed; bottom: 0; left: 0; right: 0; background: rgba(9, 11, 16, 0.96); backdrop-filter: blur(24px); border-top: 1px solid rgba(255, 255, 255, 0.12); padding: 16px 36px; z-index: 1000; display: none; box-shadow: 0 -12px 32px rgba(0,0,0,0.6);">
                <div style="max-width: 1440px; margin: 0 auto; display: grid; grid-template-columns: 320px 1fr 340px; align-items: center; gap: 32px;">
                    
                    <div style="display: flex; align-items: center; gap: 16px; min-width: 0;">
                        <div id="player-thumb-box" style="width: 54px; height: 54px; border-radius: 10px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                            <img id="player-thumb-img" src="/assets/podcast_cover_01.jpg" alt="Episode Cover Art" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                        <div style="min-width: 0;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div id="player-episode-title" style="font-weight: 700; font-size: 14px; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">No track selected</div>
                            </div>
                            <div id="player-episode-meta" style="font-size: 12px; color: rgba(255, 255, 255, 0.5); margin-top: 2px;">Select an episode to play</div>
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                        <div style="display: flex; align-items: center; gap: 20px;">
                            <button id="player-skip-back" title="Rewind 15 seconds" style="background: none; border: none; color: rgba(255, 255, 255, 0.6); cursor: pointer; padding: 6px; display: flex; align-items: center;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
                            </button>
                            <button id="player-play-pause-btn" style="width: 44px; height: 44px; border-radius: 50%; background: #ffffff; color: #07080c; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform 0.15s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                                <svg id="player-icon-play" width="18" height="18" viewBox="0 0 24 24" fill="#07080c" stroke="none" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                <svg id="player-icon-pause" width="18" height="18" viewBox="0 0 24 24" fill="#07080c" stroke="none" style="display: none;" aria-hidden="true"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                            </button>
                            <button id="player-skip-forward" title="Forward 15 seconds" style="background: none; border: none; color: rgba(255, 255, 255, 0.6); cursor: pointer; padding: 6px; display: flex; align-items: center;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"></path></svg>
                            </button>
                        </div>

                        <div style="display: flex; align-items: center; gap: 14px; width: 100%;">
                            <span id="player-current-time" style="font-size: 11px; font-weight: 700; color: rgba(255, 255, 255, 0.5); width: 45px; text-align: right; font-mono: true;">00:00</span>
                            <input type="range" id="player-seek-slider" min="0" max="100" value="0" style="flex: 1; accent-color: #ffffff; cursor: pointer; height: 4px;">
                            <span id="player-total-duration" style="font-size: 11px; font-weight: 700; color: rgba(255, 255, 255, 0.5); width: 45px; font-mono: true;">00:00</span>
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
                        <button id="player-queue-toggle-btn" title="View Offline Playlist Queue" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); color: #ffffff; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><polyline points="3 6 4 7 6 5"></polyline></svg>
                            Up Next (<span id="player-queue-count">0</span>)
                        </button>

                        <button id="player-audiogram-btn" title="Generate Social Audiogram Share Card" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); color: #ffffff; padding: 6px 10px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                            📸 Share Card
                        </button>
                        <button id="player-speed-btn" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); color: #ffffff; padding: 6px 10px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">
                            1.0x
                        </button>
                        <a id="player-download-btn" href="#" download target="_blank" style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); color: #ffffff; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; text-decoration: none; display: flex; align-items: center; gap: 6px;">
                            Download MP3
                        </a>
                    </div>
                </div>
            </div>

            <!-- Offline Queue / Playlist Manager Modal -->
            <div id="podcast-queue-modal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(16px); z-index: 2200; display: none; align-items: center; justify-content: center; padding: 24px;">
                <div style="background: #0c0e15; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 24px; width: 100%; max-width: 680px; max-height: 85vh; overflow-y: auto; padding: 36px; position: relative; box-shadow: 0 32px 64px rgba(0,0,0,0.9);">
                    <button id="podcast-queue-close-btn" style="position: absolute; top: 20px; right: 20px; background: rgba(255, 255, 255, 0.08); border: none; color: #ffffff; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>

                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
                        <div>
                            <h2 style="font-size: 24px; font-weight: 900; margin: 0 0 4px; color: #ffffff;">Up Next / Offline Queue</h2>
                            <p style="font-size: 13px; color: rgba(255, 255, 255, 0.5); margin: 0;">Save masterclasses for low-signal on-set filming &amp; continuous playback</p>
                        </div>
                        <button id="queue-clear-all-btn" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">
                            Clear Queue
                        </button>
                    </div>

                    <div id="podcast-queue-items-container" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px;">
                        <!-- Queued items rendered dynamically -->
                    </div>

                    <div style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: flex-end;">
                        <button id="queue-batch-download-btn" style="background: #ffffff; color: #06070a; border: none; padding: 12px 20px; border-radius: 10px; font-weight: 800; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Batch Download All Queued MP3s
                        </button>
                    </div>
                </div>
            </div>

            <!-- Show Notes & Embed Modal -->
            <div id="podcast-notes-modal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(16px); z-index: 2000; display: none; align-items: center; justify-content: center; padding: 24px;">
                <div style="background: #0c0e15; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 20px; width: 100%; max-width: 720px; max-height: 85vh; overflow-y: auto; padding: 36px; position: relative; box-shadow: 0 32px 64px rgba(0,0,0,0.8);">
                    <button id="podcast-notes-close-btn" style="position: absolute; top: 20px; right: 20px; background: rgba(255, 255, 255, 0.08); border: none; color: #ffffff; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                    <div id="podcast-notes-content"></div>
                </div>
            </div>

            <!-- Analytics Modal -->
            <div id="podcast-analytics-modal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(16px); z-index: 2000; display: none; align-items: center; justify-content: center; padding: 24px;">
                <div style="background: #0c0e15; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 20px; width: 100%; max-width: 600px; padding: 36px; position: relative; box-shadow: 0 32px 64px rgba(0,0,0,0.8);">
                    <button id="podcast-analytics-close-btn" style="position: absolute; top: 20px; right: 20px; background: rgba(255, 255, 255, 0.08); border: none; color: #ffffff; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                    <h2 style="font-size: 24px; font-weight: 900; margin: 0 0 6px; color: #ffffff;">Podcast Analytics &amp; Listener Trends</h2>
                    <p style="font-size: 13px; color: rgba(255, 255, 255, 0.5); margin: 0 0 24px;">Real-time stats across 32 Irish county hubs</p>
                    <div id="podcast-analytics-content">Loading stats...</div>
                </div>
            </div>

            <!-- FEATURE 4: Social Audiogram Generator Modal -->
            <div id="podcast-audiogram-modal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.88); backdrop-filter: blur(16px); z-index: 2200; display: none; align-items: center; justify-content: center; padding: 24px;">
                <div style="background: #0c0e15; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 24px; width: 100%; max-width: 760px; padding: 36px; position: relative; text-align: center; box-shadow: 0 32px 64px rgba(0,0,0,0.9);">
                    <button id="podcast-audiogram-close-btn" style="position: absolute; top: 20px; right: 20px; background: rgba(255, 255, 255, 0.08); border: none; color: #ffffff; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>

                    <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); padding: 4px 14px; border-radius: 20px; margin-bottom: 12px;">
                        <span style="font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: rgba(255,255,255,0.8);">VIRAL SOCIAL GENERATOR</span>
                    </div>

                    <h2 style="font-size: 24px; font-weight: 900; margin: 0 0 6px; color: #ffffff;">Social Waveform Audiogram Card</h2>
                    <p style="font-size: 13px; color: rgba(255, 255, 255, 0.5); margin: 0 0 24px;">High-res 1200x630 share card with animated waveform for WhatsApp &amp; Socials</p>

                    <div style="background: #000000; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 16px; overflow: hidden; display: flex; justify-content: center; margin-bottom: 20px;">
                        <canvas id="audiogram-canvas" width="1200" height="630" style="width: 100%; max-width: 680px; height: auto; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); display: block;"></canvas>
                    </div>

                    <div style="display: flex; align-items: center; justify-content: center; gap: 16px;">
                        <button id="audiogram-download-btn" style="background: #ffffff; color: #06070a; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 900; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Download Social Share Card (PNG)
                        </button>
                    </div>
                </div>
            </div>

            <!-- FEATURE 2: Blog to Podcast Script Modal -->
            <div id="podcast-blog-script-modal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.88); backdrop-filter: blur(16px); z-index: 2100; display: none; align-items: center; justify-content: center; padding: 24px;">
                <div style="background: #0c0e15; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 24px; width: 100%; max-width: 680px; max-height: 85vh; overflow-y: auto; padding: 36px; position: relative; box-shadow: 0 32px 64px rgba(0,0,0,0.8);">
                    <button id="podcast-blog-script-close-btn" style="position: absolute; top: 20px; right: 20px; background: rgba(255, 255, 255, 0.08); border: none; color: #ffffff; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>

                    <h2 style="font-size: 24px; font-weight: 900; margin: 0 0 6px; color: #ffffff;">🪄 Convert Blog / Notice to Podcast Script</h2>
                    <p style="font-size: 13px; color: rgba(255, 255, 255, 0.5); margin: 0 0 24px;">Repurpose community notices and member blogs into structured podcast scripts.</p>

                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        <div>
                            <label style="display: block; font-size: 12px; font-weight: 700; color: rgba(255, 255, 255, 0.7); margin-bottom: 6px;">Select Recent Community Notice or Member Blog</label>
                            <select id="blog-script-post-select" style="width: 100%; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; padding: 10px 14px; color: #ffffff; font-size: 13px;">
                                <option value="">Loading recent community notices...</option>
                            </select>
                        </div>
                        <div>
                            <label style="display: block; font-size: 12px; font-weight: 700; color: rgba(255, 255, 255, 0.7); margin-bottom: 6px;">Source Article / Notice Text</label>
                            <textarea id="blog-script-source" rows="5" placeholder="Select a notice from above or paste article text here..." style="width: 100%; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; padding: 12px; color: #ffffff; font-size: 13px; font-family: inherit;"></textarea>
                        </div>
                        <button id="generate-script-btn" style="background: #ffffff; color: #06070a; border: none; padding: 12px; border-radius: 10px; font-weight: 900; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m19 11-8-8-8.5 8.5a2.12 2.12 0 0 0 0 3L6 18l1.5 1.5L19 11z"/><path d="m19 11 3-3-3-3-3 3"/><line x1="2" y1="2" x2="6" y2="6"/></svg>
                            <span>Generate Podcast Script Draft</span>
                        </button>
                        <div id="blog-script-result-box" style="display: none; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 16px;">
                            <label style="display: block; font-size: 12px; font-weight: 700; color: #ffffff; margin-bottom: 6px;">Generated Studio Script &amp; Show Notes:</label>
                            <textarea id="blog-script-result" rows="8" style="width: 100%; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 12px; color: #ffffff; font-size: 12px; font-family: monospace;"></textarea>
                            <button id="use-generated-script-btn" style="margin-top: 12px; background: #ffffff; color: #06070a; border: none; padding: 12px 16px; border-radius: 8px; font-weight: 900; font-size: 13px; cursor: pointer; width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                Transfer Draft to Episode Publisher
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Studio Recorder Modal -->
            <div id="podcast-recorder-modal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.92); backdrop-filter: blur(20px); z-index: 2000; display: none; align-items: center; justify-content: center; padding: clamp(12px, 3vw, 24px); padding-bottom: max(clamp(12px, 3vw, 24px), env(safe-area-inset-bottom, 24px));">
                <div style="background: #090b10; border: 1px solid rgba(255, 255, 255, 0.14); border-radius: clamp(16px, 3vw, 24px); width: 100%; max-width: 780px; max-height: 90vh; max-height: 90dvh; overflow-y: auto; padding: clamp(18px, 4vw, 32px); position: relative; text-align: left; box-shadow: 0 32px 80px rgba(0,0,0,0.95);">
                    <button id="podcast-recorder-close-btn" style="position: absolute; top: 20px; right: 20px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); color: #ffffff; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.18)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>

                    <!-- Studio Branding & Status Header -->
                    <div style="text-align: center; margin-bottom: 22px;">
                        <img src="/logo.png" alt="LocalFilm Ireland Logo" style="height: 40px; width: auto; object-fit: contain; margin-bottom: 12px; filter: drop-shadow(0 2px 12px rgba(0,0,0,0.8));">

                        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px;">
                            <div style="display: inline-flex; align-items: center; gap: 7px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15); padding: 4px 12px; border-radius: 20px;">
                                <span style="font-size: 10px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; color: rgba(255,255,255,0.85);">LOCALFILM BROADCAST STUDIO RECORDER</span>
                            </div>
                            <!-- Live ON-AIR / STANDBY Indicator -->
                            <div id="studio-onair-indicator" style="display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 20px;">
                                <span id="studio-onair-dot" style="width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,0.4); display: inline-block;"></span>
                                <span id="studio-onair-text" style="font-size: 10px; font-weight: 900; letter-spacing: 1px; color: rgba(255,255,255,0.7); text-transform: uppercase;">STANDBY</span>
                            </div>
                        </div>

                        <h2 style="font-size: 24px; font-weight: 900; margin: 0 0 6px; color: #ffffff; letter-spacing: -0.5px;">Studio Recording &amp; Multi-Track Suite</h2>
                        <p style="font-size: 13px; color: rgba(255, 255, 255, 0.55); margin: 0;">Isolated presenter vocals, real-time noise reduction DSP, remote co-host synchronization &amp; broadcast soundboard</p>
                    </div>

                    <!-- Microphone Hardware & Real-Time Noise Reduction DSP Console -->
                    <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.09); border-radius: 16px; padding: 18px 20px; margin-bottom: 20px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
                            <label for="recorder-mic-select" style="font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.85); text-transform: uppercase; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 6px;">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                                Host Recording Microphone Device
                            </label>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <button type="button" id="recorder-mic-refresh-btn" title="Refresh available microphone hardware list" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #ffffff; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
                                    Scan Devices
                                </button>
                                <span id="recorder-mic-status-badge" style="font-size: 11px; color: #10b981; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); padding: 2px 8px; border-radius: 6px; font-weight: 700;">Ready</span>
                            </div>
                        </div>

                        <select id="recorder-mic-select" style="width: 100%; background: #07080c; border: 1px solid rgba(255, 255, 255, 0.15); color: #ffffff; padding: 9px 12px; border-radius: 8px; font-size: 12px; outline: none; margin-bottom: 10px; cursor: pointer;">
                            <option value="">Detecting Audio Devices (AirPods, Studio Mics)...</option>
                        </select>

                        <!-- Precision Live Stereo VU Meter with Calibrated dB Scales & True Clip Indicator -->
                        <div style="margin-bottom: 16px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 10px 12px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <span style="font-size: 10px; font-weight: 800; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.6px;">Microphone Input VU Level</span>
                                    <span style="font-size: 9px; color: #10b981; background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.25); padding: 1px 5px; border-radius: 4px; font-weight: 700;">Broadcast Calibrated</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span id="studio-vu-db-readout" style="font-size: 11px; font-weight: 800; font-family: monospace; color: #10b981; min-width: 50px; text-align: right;">-∞ dB</span>
                                    <span id="studio-vu-clip-badge" title="Flashes when audio exceeds 0dB and enters digital clipping" style="font-size: 9px; font-weight: 800; color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 1px 7px; border-radius: 4px; font-family: monospace; letter-spacing: 0.5px; transition: all 0.15s;">CLIP 0dB</span>
                                </div>
                            </div>
                            <div style="height: 10px; width: 100%; background: #05070a; border: 1px solid rgba(255,255,255,0.1); border-radius: 5px; overflow: hidden; position: relative; box-shadow: inset 0 1px 3px rgba(0,0,0,0.8);">
                                <!-- Safe broadcast target tick markers -->
                                <div style="position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: rgba(16,185,129,0.3); z-index: 2;" title="-24dB Optimum Voice Floor"></div>
                                <div style="position: absolute; left: 75%; top: 0; bottom: 0; width: 1px; background: rgba(245,158,11,0.35); z-index: 2;" title="-12dB Target Broadcast Peak"></div>
                                <div style="position: absolute; left: 87.5%; top: 0; bottom: 0; width: 1px; background: rgba(239,68,68,0.4); z-index: 2;" title="-6dB Headroom Warning"></div>
                                <div id="recorder-mic-level-meter" style="width: 0%; height: 100%; background: linear-gradient(90deg, #10b981 0%, #34d399 50%, #06b6d4 70%, #f59e0b 86%, #ef4444 100%); transition: width 0.04s linear; border-radius: 4px;"></div>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 9px; font-weight: 700; color: rgba(255,255,255,0.4); margin-top: 4px; font-family: monospace;">
                                <span>-48dB (Floor)</span>
                                <span>-36dB</span>
                                <span style="color: #34d399;">-24dB (Good)</span>
                                <span style="color: #f59e0b;">-12dB (Target)</span>
                                <span style="color: #fb923c;">-6dB</span>
                                <span style="color: #f87171;">0dB (Clip)</span>
                            </div>
                        </div>

                        <!-- Real-Time Zero-Latency DSP Processing Rack (Sidechain Gate, HVAC, Compressor, De-Esser, 3-Band EQ & Live Audition Monitor) -->
                        <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 14px 16px; margin-bottom: 20px;">
                            <!-- Header Action Bar with Live Headphone Monitor & A/B Compare -->
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 10px;">
                                <div style="display: inline-flex; align-items: center; gap: 8px;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
                                    <span style="font-size: 11px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.6px;">Live Noise Reduction DSP &amp; Vocal Shaping</span>
                                    <span style="font-size: 9px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #10b981; padding: 1px 6px; border-radius: 4px; font-weight: 700;">Zero-Latency Web Audio</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                    <!-- Live Headphone Monitor (Audition / Sidetone) -->
                                    <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 3px 8px;" title="Wear headphones to listen to live microphone processing without feedback">
                                        <button type="button" id="studio-dsp-monitor-btn" title="Toggle Live Headphone Auditioning (Hear DSP in real time)" style="background: transparent; border: none; color: rgba(255,255,255,0.65); font-size: 10px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; padding: 0;">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
                                            <span id="studio-dsp-monitor-text">🎧 Hear Live: OFF</span>
                                        </button>
                                        <input type="range" id="studio-dsp-monitor-vol" min="0" max="100" value="75" title="Headphone Audition Volume" style="width: 48px; height: 3px; accent-color: #10b981; cursor: pointer;">
                                        <span id="studio-dsp-monitor-vol-badge" style="font-size: 9px; font-family: monospace; color: rgba(255,255,255,0.6); min-width: 24px;">75%</span>
                                    </div>
                                    <!-- A/B Instant Bypass Toggle -->
                                    <button type="button" id="studio-dsp-ab-btn" title="1-Click A/B Compare: Instant bypass of all DSP to hear raw microphone vs processed sound" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #ffffff; padding: 4px 9px; border-radius: 8px; font-size: 10px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                                        <span id="studio-dsp-ab-dot" style="width: 6px; height: 6px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
                                        <span id="studio-dsp-ab-text">DSP: ACTIVE</span>
                                    </button>
                                </div>
                            </div>

                            <!-- Processing Modules Grid -->
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px;">
                                <!-- 1. HVAC Low-Cut / De-Rumble -->
                                <div style="background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 9px 11px;">
                                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                                        <span style="font-size: 11px; font-weight: 700; color: #ffffff;">HVAC De-Rumble</span>
                                        <span id="studio-hvac-badge" style="font-size: 9px; color: #10b981; font-weight: 800;">80Hz Std</span>
                                    </div>
                                    <div style="display: flex; gap: 4px;">
                                        <button type="button" id="studio-hvac-off" data-hvac="off" style="flex: 1; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); font-size: 9px; font-weight: 700; padding: 4px 2px; border-radius: 4px; cursor: pointer;">Off</button>
                                        <button type="button" id="studio-hvac-80" data-hvac="80" style="flex: 1; background: rgba(16,185,129,0.22); border: 1px solid rgba(16,185,129,0.5); color: #ffffff; font-size: 9px; font-weight: 800; padding: 4px 2px; border-radius: 4px; cursor: pointer;">80Hz Std</button>
                                        <button type="button" id="studio-hvac-130" data-hvac="130" style="flex: 1; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); font-size: 9px; font-weight: 700; padding: 4px 2px; border-radius: 4px; cursor: pointer;">130Hz Heavy</button>
                                    </div>
                                </div>

                                <!-- 2. Dynamic Speech Noise Gate (Pre-Gate Sidechain Detector) -->
                                <div style="background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 9px 11px;">
                                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                                        <div style="display: flex; align-items: center; gap: 5px;">
                                            <span style="font-size: 11px; font-weight: 700; color: #ffffff;">Speech Noise Gate</span>
                                            <span id="studio-noise-gate-db-val" style="font-size: 9px; font-family: monospace; color: rgba(255,255,255,0.5);">-∞</span>
                                        </div>
                                        <span id="studio-noise-gate-indicator" style="font-size: 9px; font-weight: 800; padding: 1px 5px; border-radius: 4px; border: 1px solid rgba(16,185,129,0.3); background: rgba(16,185,129,0.15); color: #10b981; font-family: monospace;">GATE: OPEN</span>
                                    </div>
                                    <div style="display: flex; gap: 4px; margin-bottom: 5px;">
                                        <button type="button" id="studio-gate-thresh-gentle" data-thresh="-52" style="flex: 1; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); font-size: 9px; font-weight: 700; padding: 3px 2px; border-radius: 4px; cursor: pointer;">-52dB</button>
                                        <button type="button" id="studio-gate-thresh-standard" data-thresh="-42" style="flex: 1; background: rgba(16,185,129,0.22); border: 1px solid rgba(16,185,129,0.5); color: #ffffff; font-size: 9px; font-weight: 800; padding: 3px 2px; border-radius: 4px; cursor: pointer;">-42dB Std</button>
                                        <button type="button" id="studio-gate-thresh-tight" data-thresh="-34" style="flex: 1; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); font-size: 9px; font-weight: 700; padding: 3px 2px; border-radius: 4px; cursor: pointer;">-34dB</button>
                                        <button type="button" id="studio-gate-thresh-bypass" data-thresh="off" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.5); font-size: 9px; font-weight: 700; padding: 3px 5px; border-radius: 4px; cursor: pointer;">Off</button>
                                    </div>
                                    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 9px; color: rgba(255,255,255,0.45);">
                                        <span>Floor:</span>
                                        <div style="display: inline-flex; gap: 3px;">
                                            <button type="button" id="studio-gate-floor-natural" style="background: rgba(16,185,129,0.18); border: 1px solid rgba(16,185,129,0.4); color: #ffffff; font-size: 8px; padding: 1px 4px; border-radius: 3px; cursor: pointer; font-weight: 800;">Natural (-14dB)</button>
                                            <button type="button" id="studio-gate-floor-silence" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); font-size: 8px; padding: 1px 4px; border-radius: 3px; cursor: pointer; font-weight: 700;">Silence (-28dB)</button>
                                        </div>
                                    </div>
                                </div>

                                <!-- 3. Broadcast Vocal Compressor / Leveler -->
                                <div style="background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 9px 11px;">
                                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                                        <span style="font-size: 11px; font-weight: 700; color: #ffffff;">Vocal Compressor</span>
                                        <span id="studio-comp-badge" style="font-size: 9px; color: #10b981; font-weight: 800;">Leveler</span>
                                    </div>
                                    <div style="display: flex; gap: 4px;">
                                        <button type="button" id="studio-comp-leveler" data-comp="leveler" style="flex: 1; background: rgba(16,185,129,0.22); border: 1px solid rgba(16,185,129,0.5); color: #ffffff; font-size: 9px; font-weight: 800; padding: 4px 2px; border-radius: 4px; cursor: pointer;">Leveler</button>
                                        <button type="button" id="studio-comp-punch" data-comp="punch" style="flex: 1; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); font-size: 9px; font-weight: 700; padding: 4px 2px; border-radius: 4px; cursor: pointer;">Punch</button>
                                        <button type="button" id="studio-comp-limit" data-comp="limit" style="flex: 1; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); font-size: 9px; font-weight: 700; padding: 4px 2px; border-radius: 4px; cursor: pointer;">Limiter</button>
                                        <button type="button" id="studio-comp-off" data-comp="off" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.5); font-size: 9px; font-weight: 700; padding: 4px 5px; border-radius: 4px; cursor: pointer;">Off</button>
                                    </div>
                                </div>

                                <!-- 4. Vocal De-Esser (Sibilance Reducer) -->
                                <div style="background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 9px 11px; display: flex; align-items: center; justify-content: space-between;">
                                    <div>
                                        <div style="font-size: 11px; font-weight: 700; color: #ffffff;">Vocal De-Esser</div>
                                        <div style="font-size: 9px; color: rgba(255,255,255,0.5);">Cuts harsh 6.8kHz 'S'/'T' sounds</div>
                                    </div>
                                    <button type="button" id="studio-deesser-btn" title="Toggle Vocal De-Esser Sibilance Reducer" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15); color: rgba(255,255,255,0.5); padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                                        <span id="studio-deesser-dot" style="width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.4); display: inline-block;"></span>
                                        <span id="studio-deesser-text">BYPASS</span>
                                    </button>
                                </div>
                            </div>

                            <!-- 5. Broadcast Vocal EQ Suite with Live Trims -->
                            <div style="background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 9px 12px; margin-top: 10px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; flex-wrap: wrap; gap: 6px;">
                                    <span style="font-size: 11px; font-weight: 700; color: #ffffff;">Broadcast Vocal EQ &amp; Tone Shaper</span>
                                    <select id="studio-dsp-eq-select" style="background: #0c0e15; border: 1px solid rgba(255,255,255,0.2); color: #ffffff; padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; cursor: pointer; outline: none;">
                                        <option value="warm" selected>Warmth &amp; Body (+3dB 200Hz, +1dB 10kHz)</option>
                                        <option value="presence">Radio Presence &amp; Intelligibility (+3.5dB 2.8kHz speech boost)</option>
                                        <option value="clarity">Crisp Vocal Air &amp; Polish (-1dB mud, +4.5dB 12kHz)</option>
                                        <option value="baritone">Deep Baritone Radio Voice (+4dB 150Hz)</option>
                                        <option value="bright">Bright &amp; Clear Podcast Voice (-2dB 300Hz, +3dB 4.5kHz)</option>
                                        <option value="flat">Broadcast Flat (Neutral bypass)</option>
                                    </select>
                                </div>
                                <div style="display: flex; align-items: center; gap: 12px; font-size: 9px; color: rgba(255,255,255,0.6); flex-wrap: wrap;">
                                    <div style="display: flex; align-items: center; gap: 5px;">
                                        <span>Low:</span>
                                        <input type="range" id="studio-eq-low-trim" min="-6" max="6" step="0.5" value="2" style="width: 50px; height: 3px; accent-color: #10b981; cursor: pointer;">
                                        <span id="studio-eq-low-val" style="min-width: 24px; font-family: monospace;">+2dB</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 5px;">
                                        <span>Mid:</span>
                                        <input type="range" id="studio-eq-mid-trim" min="-6" max="6" step="0.5" value="1" style="width: 50px; height: 3px; accent-color: #06b6d4; cursor: pointer;">
                                        <span id="studio-eq-mid-val" style="min-width: 24px; font-family: monospace;">+1dB</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 5px;">
                                        <span>Air:</span>
                                        <input type="range" id="studio-eq-high-trim" min="-6" max="6" step="0.5" value="1" style="width: 50px; height: 3px; accent-color: #8b5cf6; cursor: pointer;">
                                        <span id="studio-eq-high-val" style="min-width: 24px; font-family: monospace;">+1dB</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Cinema Broadcast OLED Timecode Deck & Recording Controls -->
                    <div style="background: radial-gradient(circle at 50% 20%, rgba(20, 24, 34, 0.9) 0%, rgba(8, 10, 15, 0.98) 100%); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 18px; padding: 24px; text-align: center; margin-bottom: 20px; box-shadow: inset 0 2px 10px rgba(0,0,0,0.8), 0 8px 30px rgba(0,0,0,0.5);">
                        <!-- Digital Studio OLED Clock with running hundredths -->
                        <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 12px;">
                            <span id="record-beacon-dot" style="width: 10px; height: 10px; border-radius: 50%; background: rgba(255,255,255,0.25); display: inline-block; transition: all 0.3s;"></span>
                            <div id="record-timer-display" style="font-size: clamp(38px, 8vw, 54px); font-weight: 900; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #ffffff; letter-spacing: 2px; text-shadow: 0 0 20px rgba(255,255,255,0.3);">00:00:00.00</div>
                        </div>

                        <!-- Live Oscilloscope Waveform Display -->
                        <div style="display: flex; justify-content: center; margin-bottom: 18px;">
                            <canvas id="studio-host-waveform-canvas" width="460" height="44" style="width: 100%; max-width: 460px; height: 44px; border-radius: 8px; background: rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.08); display: none;" aria-label="Live voice oscilloscope waveform display"></canvas>
                        </div>

                        <!-- Tactile Glowing Action Buttons -->
                        <div style="display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap;">
                            <button id="record-start-btn" style="background: #ffffff; color: #06070a; border: none; padding: 13px 28px; border-radius: 12px; font-weight: 900; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 0 20px rgba(255,255,255,0.2); transition: all 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" aria-hidden="true"><circle cx="12" cy="12" r="9"/></svg>
                                <span>Start Recording</span>
                            </button>

                            <button id="record-pause-btn" disabled style="background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.4); border: 1px solid rgba(255, 255, 255, 0.14); padding: 13px 22px; border-radius: 12px; font-weight: 800; font-size: 14px; cursor: not-allowed; display: inline-flex; align-items: center; gap: 7px; transition: all 0.2s;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                                <span id="record-pause-btn-text">Pause / Talk</span>
                            </button>

                            <button id="record-stop-btn" disabled style="background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.4); border: 1px solid rgba(255, 255, 255, 0.14); padding: 13px 26px; border-radius: 12px; font-weight: 800; font-size: 14px; cursor: not-allowed; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s;">
                                <rect x="6" y="6" width="12" height="12" fill="currentColor"></rect>
                                <span>Stop &amp; Save Take</span>
                            </button>
                        </div>
                    </div>

                    <!-- Collapsible Presenter Broadcast Soundboard Drawer (SFX Pads) -->
                    <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.09); border-radius: 16px; margin-bottom: 20px; overflow: hidden;">
                        <button type="button" id="studio-soundboard-toggle-btn" style="width: 100%; background: none; border: none; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; text-align: left;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                                <span style="font-size: 13px; font-weight: 800; color: #ffffff;">Broadcast Soundboard (SFX)</span>
                                <span style="font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); padding: 2px 7px; border-radius: 10px;">6 Built-In + Custom</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 11px; color: rgba(255,255,255,0.5);">Recorded into live take</span>
                                <svg id="studio-soundboard-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transition: transform 0.25s;" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
                            </div>
                        </button>

                        <div id="studio-soundboard-content" style="display: none; padding: 0 20px 18px; border-top: 1px solid rgba(255,255,255,0.06);">
                            <div style="font-size: 11px; color: rgba(255,255,255,0.6); margin: 12px 0 10px;">
                                Trigger audio stingers &amp; sound effects in real time. Effects play through presenter headphones and mix directly into the active recording take!
                            </div>

                            <!-- Built-In Production SFX Pads Grid -->
                            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; margin-bottom: 12px;">
                                <button type="button" class="studio-sfx-pad" data-sfx="slate" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; padding: 10px 8px; color: #ffffff; cursor: pointer; text-align: center; transition: all 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.12)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                                    <div style="display: flex; justify-content: center; margin-bottom: 5px;">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 4h16v16H4z"/><path d="M4 8h16"/><line x1="8" y1="4" x2="6" y2="8"/><line x1="14" y1="4" x2="12" y2="8"/><line x1="20" y1="4" x2="18" y2="8"/></svg>
                                    </div>
                                    <div style="font-size: 11px; font-weight: 800;">Cinema Slate</div>
                                    <div style="font-size: 9px; color: rgba(255,255,255,0.5);">Clapper Snap</div>
                                </button>

                                <button type="button" class="studio-sfx-pad" data-sfx="chime" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; padding: 10px 8px; color: #ffffff; cursor: pointer; text-align: center; transition: all 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.12)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                                    <div style="display: flex; justify-content: center; margin-bottom: 5px;">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                                    </div>
                                    <div style="font-size: 11px; font-weight: 800;">On-Air Chime</div>
                                    <div style="font-size: 9px; color: rgba(255,255,255,0.5);">Broadcast Bell</div>
                                </button>

                                <button type="button" class="studio-sfx-pad" data-sfx="rimshot" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; padding: 10px 8px; color: #ffffff; cursor: pointer; text-align: center; transition: all 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.12)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                                    <div style="display: flex; justify-content: center; margin-bottom: 5px;">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><ellipse cx="12" cy="8" rx="9" ry="4"/><path d="M3 8v8c0 2.21 4.03 4 9 4s9-1.79 9-4V8"/></svg>
                                    </div>
                                    <div style="font-size: 11px; font-weight: 800;">Rimshot</div>
                                    <div style="font-size: 9px; color: rgba(255,255,255,0.5);">Snare Crack</div>
                                </button>

                                <button type="button" class="studio-sfx-pad" data-sfx="applause" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; padding: 10px 8px; color: #ffffff; cursor: pointer; text-align: center; transition: all 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.12)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                                    <div style="display: flex; justify-content: center; margin-bottom: 5px;">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                                    </div>
                                    <div style="font-size: 11px; font-weight: 800;">Applause</div>
                                    <div style="font-size: 9px; color: rgba(255,255,255,0.5);">Studio Crowd</div>
                                </button>

                                <button type="button" class="studio-sfx-pad" data-sfx="subdrop" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; padding: 10px 8px; color: #ffffff; cursor: pointer; text-align: center; transition: all 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.12)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                                    <div style="display: flex; justify-content: center; margin-bottom: 5px;">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                                    </div>
                                    <div style="font-size: 11px; font-weight: 800;">Sub Drop</div>
                                    <div style="font-size: 9px; color: rgba(255,255,255,0.5);">Cinema Impact</div>
                                </button>

                                <button type="button" class="studio-sfx-pad" data-sfx="stinger" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; padding: 10px 8px; color: #ffffff; cursor: pointer; text-align: center; transition: all 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.12)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                                    <div style="display: flex; justify-content: center; margin-bottom: 5px;">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4.93 19.07a10 10 0 0 1 0-14.14"/><path d="M7.76 16.24a6 6 0 0 1 0-8.48"/><circle cx="12" cy="12" r="2"/></svg>
                                    </div>
                                    <div style="font-size: 11px; font-weight: 800;">News Stinger</div>
                                    <div style="font-size: 9px; color: rgba(255,255,255,0.5);">Brass Urgency</div>
                                </button>
                            </div>

                            <!-- Custom Loaded SFX Pads Container -->
                            <div id="studio-custom-sfx-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; margin-bottom: 12px;"></div>

                            <!-- Soundboard Bottom Bar: Upload Custom + SFX Volume Slider -->
                            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 8px 12px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <button type="button" id="studio-custom-sfx-btn" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: #ffffff; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                        + Load Custom SFX Clip
                                    </button>
                                    <input type="file" id="studio-custom-sfx-file" accept="audio/*" style="display: none;">
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <label for="studio-soundboard-vol" style="font-size: 10px; font-weight: 800; color: rgba(255,255,255,0.7); text-transform: uppercase;">SFX Vol</label>
                                    <input type="range" id="studio-soundboard-vol" min="0" max="100" value="75" style="width: 80px; accent-color: #ffffff; cursor: pointer;">
                                    <span id="studio-soundboard-vol-val" style="font-size: 10px; font-weight: 800; color: #ffffff; min-width: 28px;">75%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Collapsible Studio Teleprompter & Rundown Drawer -->
                    <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.09); border-radius: 16px; margin-bottom: 20px; overflow: hidden;">
                        <button type="button" id="studio-rundown-toggle-btn" style="width: 100%; background: none; border: none; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; text-align: left;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                <span style="font-size: 13px; font-weight: 800; color: #ffffff;">Interview Rundown &amp; Teleprompter</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 11px; color: rgba(255,255,255,0.5);">Show notes &amp; talking points</span>
                                <svg id="studio-rundown-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transition: transform 0.25s;" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
                            </div>
                        </button>

                        <div id="studio-rundown-content" style="display: none; padding: 0 20px 18px; border-top: 1px solid rgba(255,255,255,0.06);">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin: 12px 0 8px; flex-wrap: wrap; gap: 6px;">
                                <span style="font-size: 11px; color: rgba(255,255,255,0.5);">Keep your interview rundown in view while recording:</span>
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <button type="button" id="studio-teleprompter-size-down" title="Decrease font size" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #ffffff; padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: 800; cursor: pointer;">A-</button>
                                    <button type="button" id="studio-teleprompter-size-up" title="Increase font size" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #ffffff; padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: 800; cursor: pointer;">A+</button>
                                    <button type="button" id="studio-teleprompter-scroll-btn" title="Toggle slow auto-scroll" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #ffffff; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>
                                        <span id="studio-teleprompter-scroll-text">Auto-Scroll</span>
                                    </button>
                                </div>
                            </div>
                            <textarea id="studio-rundown-textarea" rows="6" placeholder="Paste your interview questions, discussion points, or guest bio here to read comfortably while speaking..." style="width: 100%; background: #07080c; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; padding: 12px; color: #ffffff; font-size: 14px; line-height: 1.6; resize: vertical; outline: none;"></textarea>
                        </div>
                    </div>

                    <!-- Audio Levels & Monitor Mixer Panel -->
                    <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 20px; margin-bottom: 24px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                                <span style="font-size: 13px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">STUDIO MONITOR &amp; AUDIO MIXER</span>
                            </div>
                            <span style="font-size: 11px; color: rgba(255,255,255,0.5);">Real-time fader gain, remote monitor &amp; master mix controls</span>
                        </div>

                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px;">
                            <!-- Host Mic Gain Slider -->
                            <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 10px; padding: 12px 14px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <label for="studio-mix-host-gain" style="font-size: 11px; font-weight: 800; color: #10b981; text-transform: uppercase; letter-spacing: 0.5px;">Host Mic Gain</label>
                                    <span id="studio-mix-host-gain-val" style="font-size: 11px; font-weight: 800; color: #10b981; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); padding: 1px 6px; border-radius: 4px;">100%</span>
                                </div>
                                <input type="range" id="studio-mix-host-gain" min="0" max="200" value="100" title="Adjust host microphone sensitivity and recorded input volume" style="width: 100%; accent-color: #10b981; cursor: pointer;">
                            </div>

                            <!-- Guest Monitor Volume Slider -->
                            <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 10px; padding: 12px 14px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <label for="studio-mix-guest-vol" style="font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px;">Guest Monitor Vol</label>
                                    <span id="studio-mix-guest-vol-val" style="font-size: 11px; font-weight: 800; color: #38bdf8; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); padding: 1px 6px; border-radius: 4px;">100%</span>
                                </div>
                                <input type="range" id="studio-mix-guest-vol" min="0" max="100" value="100" title="Adjust remote co-hosts listening volume in your studio headphones" style="width: 100%; accent-color: #38bdf8; cursor: pointer;">
                            </div>

                            <!-- Subtrack / Bed Ducking Slider -->
                            <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 10px; padding: 12px 14px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <label for="studio-mix-subtrack-vol" style="font-size: 11px; font-weight: 800; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.5px;">Music Bed Ducking</label>
                                    <span id="studio-mix-subtrack-vol-val" style="font-size: 11px; font-weight: 800; color: #f59e0b; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); padding: 1px 6px; border-radius: 4px;">30%</span>
                                </div>
                                <input type="range" id="studio-mix-subtrack-vol" min="0" max="100" value="30" title="Set background music & ambient audio bed level while speaking" style="width: 100%; accent-color: #f59e0b; cursor: pointer;">
                            </div>

                            <!-- Take Audition Volume Slider -->
                            <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(168, 85, 247, 0.2); border-radius: 10px; padding: 12px 14px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <label for="studio-mix-take-vol" style="font-size: 11px; font-weight: 800; color: #a855f7; text-transform: uppercase; letter-spacing: 0.5px;">Take Audition Vol</label>
                                    <span id="studio-mix-take-vol-val" style="font-size: 11px; font-weight: 800; color: #a855f7; background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.3); padding: 1px 6px; border-radius: 4px;">100%</span>
                                </div>
                                <input type="range" id="studio-mix-take-vol" min="0" max="100" value="100" title="Listening level for take inventory preview playback" style="width: 100%; accent-color: #a855f7; cursor: pointer;">
                            </div>
                        </div>

                        <!-- Auto-Level RMS Stems Balancing Toggle -->
                        <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 10px; padding: 10px 14px; margin-top: 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="width: 28px; height: 28px; border-radius: 6px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                                </div>
                                <div>
                                    <div style="font-size: 11px; font-weight: 800; color: #10b981; letter-spacing: 0.5px; text-transform: uppercase;">Auto-Level Stems (Loudness Alignment)</div>
                                    <div style="font-size: 10px; color: rgba(255,255,255,0.5);">Automatically balances presenter and co-host vocal loudness across isolated takes in master mixdown</div>
                                </div>
                            </div>
                            <label style="position: relative; display: inline-flex; align-items: center; cursor: pointer; gap: 8px;">
                                <span style="font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.7);">RMS Balancing</span>
                                <input type="checkbox" id="studio-mix-autolevel" checked style="accent-color: #10b981; width: 18px; height: 18px; cursor: pointer;">
                            </label>
                        </div>
                    </div>

                    <!-- Remote Co-Hosts Master Studio Panel -->
                    <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 20px; margin-bottom: 24px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <span style="font-size: 13px; font-weight: 800; color: #ffffff;">CONNECTED REMOTE CO-HOSTS</span>
                                <span id="remote-guests-count-badge" title="Supports up to 4 simultaneous remote co-hosts with isolated multi-track recording" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.8);">0/4 Connected</span>
                                <!-- LiveKit room connection status dot -->
                                <span id="studio-livekit-status" style="display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.5); background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 8px;">
                                    <span id="studio-livekit-dot" style="width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,0.2); display: inline-block; transition: background 0.3s;"></span>
                                    <span id="studio-livekit-label">Studio Offline</span>
                                </span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <!-- Talk while paused indicator -->
                                <span id="studio-talk-indicator" style="display: none; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); padding: 3px 10px; border-radius: 8px;">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                                    Talk Enabled
                                </span>
                                <button id="generate-guest-link-btn" title="Manage and copy remote invite links for co-hosts (up to 4 supported)" style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.28) 0%, rgba(5, 150, 105, 0.45) 100%); border: 1px solid #10b981; color: #ffffff; padding: 7px 14px; border-radius: 9px; font-size: 12px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; box-shadow: 0 0 16px rgba(16, 185, 129, 0.35); transition: all 0.2s;">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                    <span>Copy Guest Studio Link</span>
                                    <span id="studio-invite-count-badge" style="background: rgba(0,0,0,0.45); border: 1px solid rgba(16,185,129,0.5); color: #34d399; font-size: 10px; font-weight: 800; padding: 1px 6px; border-radius: 10px; margin-left: 2px;">0/4</span>
                                </button>
                            </div>
                        </div>

                        <div id="remote-guests-list-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px;">
                            <div id="remote-guests-empty-placeholder" data-empty="true" style="color: rgba(255,255,255,0.4); font-size: 12px; font-style: italic; padding: 12px 0;">
                                No remote co-hosts connected yet (room accommodates up to 4 co-hosts). Click "Copy Guest Studio Link" to invite co-hosts!
                            </div>
                        </div>

                        <!-- Hidden audio element for playing guest LiveKit audio -->
                        <div id="studio-remote-audio-elements" style="display:none;" aria-hidden="true"></div>
                    </div>

                    <!-- Top & Tail (Intro / Outro Bumpers) Suite -->
                    <div style="background: linear-gradient(180deg, rgba(245, 158, 11, 0.05) 0%, rgba(15, 23, 42, 0.7) 100%); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 18px; padding: 22px; margin-bottom: 24px; box-shadow: 0 12px 36px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06);">
                        <!-- Header with Color Identity & Purpose -->
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); display: flex; align-items: center; justify-content: center; color: #f59e0b;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                                </div>
                                <div>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <h3 style="font-size: 14px; font-weight: 800; color: #ffffff; margin: 0; letter-spacing: 0.3px;">TOP &amp; TAIL BROADCAST BUMPERS</h3>
                                        <span style="font-size: 9px; font-weight: 800; color: #f59e0b; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.35); padding: 1px 7px; border-radius: 6px; letter-spacing: 0.5px; text-transform: uppercase;">Automated Audio Stitcher</span>
                                    </div>
                                    <p style="font-size: 11px; color: rgba(255,255,255,0.6); margin: 2px 0 0;">Prepend signature opener music &amp; append outro resolve beds before &amp; after any vocal take</p>
                                </div>
                            </div>
                            <div id="studio-bumper-status-pill" style="font-size: 11px; font-weight: 700; color: #34d399; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 10px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px;">
                                <span style="width: 6px; height: 6px; border-radius: 50%; background: #10b981; box-shadow: 0 0 6px #10b981;"></span>
                                Ready to Stitch
                            </div>
                        </div>

                        <!-- Dynamic Audio Sequence Flowbar -->
                        <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 10px 14px; margin-bottom: 18px; display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
                            <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 800; color: #f59e0b; background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.3); padding: 5px 12px; border-radius: 8px; flex: 1 1 180px; justify-content: center;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
                                <span id="flow-top-label" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Intro: Irish Strings</span>
                            </div>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
                            <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 800; color: #10b981; background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.3); padding: 5px 12px; border-radius: 8px; flex: 1.5 1 220px; justify-content: center;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
                                <span id="flow-take-label" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Active Vocal Take (Main Speech)</span>
                            </div>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
                            <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 800; color: #a78bfa; background: rgba(139,92,246,0.12); border: 1px solid rgba(139,92,246,0.3); padding: 5px 12px; border-radius: 8px; flex: 1 1 180px; justify-content: center;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><rect x="9" y="9" width="6" height="6"/></svg>
                                <span id="flow-tail-label" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Outro: Piano Resolve</span>
                            </div>
                        </div>

                        <!-- Two Bumper Columns (Intro / Outro) -->
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 20px;">
                            <!-- Top Bumper (Intro / Opener) Card -->
                            <div style="background: rgba(245, 158, 11, 0.04); border: 1px solid rgba(245, 158, 11, 0.28); border-radius: 14px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; gap: 12px;">
                                <div>
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                        <div style="display: flex; align-items: center; gap: 6px;">
                                            <span style="width: 7px; height: 7px; border-radius: 50%; background: #f59e0b; box-shadow: 0 0 6px #f59e0b;"></span>
                                            <label for="studio-top-bumper-select" style="font-size: 11px; font-weight: 800; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.6px;">Intro Bumper (Opener)</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 6px;">
                                            <button type="button" id="studio-top-upload-btn" title="Upload custom audio file from your device" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: #ffffff; padding: 4px 9px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.16)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">
                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                                Choose File
                                            </button>
                                            <button id="studio-top-preview-btn" title="Preview Intro bumper audio" style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.35); color: #f59e0b; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; transition: all 0.2s;">
                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                                <span id="studio-top-preview-text">Preview</span>
                                            </button>
                                        </div>
                                    </div>
                                    <select id="studio-top-bumper-select" style="width: 100%; background: #080b11; border: 1px solid rgba(245, 158, 11, 0.3); color: #ffffff; padding: 9px 12px; border-radius: 8px; font-size: 12px; outline: none; cursor: pointer;">
                                        <option value="strings" selected>Irish Cinematic Strings (Swell &amp; Harp)</option>
                                        <option value="drone">Dramatic Broadcast Drone (Deep Sub &amp; Chime)</option>
                                        <option value="folk">Warm Acoustic Folk (Fingerstyle Chime)</option>
                                        <option value="slate">Studio Slate Beep (1kHz Broadcast Countdown)</option>
                                        <option value="custom">📁 Custom Audio File Upload (.wav, .mp3, .m4a)...</option>
                                        <option value="none">None (Skip Intro Bumper)</option>
                                    </select>
                                    <input type="file" id="studio-top-file-input" accept="audio/*" style="display: none;">
                                    <div id="studio-top-file-status" style="display: none; margin-top: 8px; font-size: 11px; color: #f59e0b; align-items: center; gap: 6px; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); padding: 5px 10px; border-radius: 6px;"></div>
                                </div>
                                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: rgba(255,255,255,0.6); padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.06);">
                                    <span>Intro Volume Trim</span>
                                    <span id="studio-top-vol-label" style="font-weight: 700; color: #f59e0b;">80%</span>
                                </div>
                            </div>

                            <!-- Tail Bumper (Outro / Closer) Card -->
                            <div style="background: rgba(139, 92, 246, 0.04); border: 1px solid rgba(139, 92, 246, 0.28); border-radius: 14px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; gap: 12px;">
                                <div>
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                        <div style="display: flex; align-items: center; gap: 6px;">
                                            <span style="width: 7px; height: 7px; border-radius: 50%; background: #a78bfa; box-shadow: 0 0 6px #a78bfa;"></span>
                                            <label for="studio-tail-bumper-select" style="font-size: 11px; font-weight: 800; color: #a78bfa; text-transform: uppercase; letter-spacing: 0.6px;">Outro Bumper (Closer)</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 6px;">
                                            <button type="button" id="studio-tail-upload-btn" title="Upload custom audio file from your device" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: #ffffff; padding: 4px 9px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.16)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">
                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                                Choose File
                                            </button>
                                            <button id="studio-tail-preview-btn" title="Preview Outro bumper audio" style="background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.35); color: #a78bfa; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; transition: all 0.2s;">
                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                                <span id="studio-tail-preview-text">Preview</span>
                                            </button>
                                        </div>
                                    </div>
                                    <select id="studio-tail-bumper-select" style="width: 100%; background: #080b11; border: 1px solid rgba(139, 92, 246, 0.3); color: #ffffff; padding: 9px 12px; border-radius: 8px; font-size: 12px; outline: none; cursor: pointer;">
                                        <option value="piano" selected>Fade Out Piano Resolve (Major 9th Piano)</option>
                                        <option value="tech">Modern Tech Resolve (Pitch Drop &amp; Whoosh)</option>
                                        <option value="bell">LocalFilm Signature Bell (Warm Chime Tail)</option>
                                        <option value="folk_outro">Warm Acoustic Outro (Folk Strum Fade)</option>
                                        <option value="custom">📁 Custom Audio File Upload (.wav, .mp3, .m4a)...</option>
                                        <option value="none">None (Skip Outro Bumper)</option>
                                    </select>
                                    <input type="file" id="studio-tail-file-input" accept="audio/*" style="display: none;">
                                    <div id="studio-tail-file-status" style="display: none; margin-top: 8px; font-size: 11px; color: #a78bfa; align-items: center; gap: 6px; background: rgba(139, 92, 246, 0.12); border: 1px solid rgba(139, 92, 246, 0.3); padding: 5px 10px; border-radius: 6px;"></div>
                                </div>
                                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: rgba(255,255,255,0.6); padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.06);">
                                    <span>Outro Volume Trim</span>
                                    <span id="studio-tail-vol-label" style="font-weight: 700; color: #a78bfa;">80%</span>
                                </div>
                            </div>
                        </div>

                        <!-- Footer Action Bar with Clear, Aligned CTA -->
                        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px 16px;">
                            <div style="display: flex; align-items: center; gap: 8px; min-width: 220px; flex: 1;">
                                <label for="studio-stitch-target-select" style="font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap;">Target Take:</label>
                                <select id="studio-stitch-target-select" style="background: #080b11; border: 1px solid rgba(255,255,255,0.15); color: #ffffff; padding: 6px 10px; border-radius: 6px; font-size: 12px; outline: none; width: 100%; max-width: 320px; cursor: pointer;">
                                    <option value="active">Active Take / Latest Recording</option>
                                </select>
                            </div>

                            <button id="studio-stitch-btn" title="Stitch your selected Top & Tail bumpers seamlessly onto the active take" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 60%, #b45309 100%); color: #ffffff; border: 1px solid rgba(245, 158, 11, 0.6); padding: 11px 22px; border-radius: 10px; font-size: 12px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 18px rgba(245, 158, 11, 0.4); transition: all 0.2s;" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 24px rgba(245, 158, 11, 0.55)'" onmouseout="this.style.transform='none';this.style.boxShadow='0 4px 18px rgba(245, 158, 11, 0.4)'">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="12" y1="8" x2="12" y2="16"/></svg>
                                Stitch Top &amp; Tail to Active Take
                            </button>
                        </div>
                    </div>

                    <!-- Audio Scratchpad / Multi-Track Stems Inventory Manager -->
                    <div style="background: linear-gradient(180deg, rgba(6, 182, 212, 0.04) 0%, rgba(15, 23, 42, 0.7) 100%); border: 1px solid rgba(6, 182, 212, 0.25); border-radius: 18px; padding: 22px; margin-bottom: 24px; box-shadow: 0 12px 36px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06);">
                        <!-- Header with Color Identity & Aligned Action CTAs -->
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 14px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(6, 182, 212, 0.15); border: 1px solid rgba(6, 182, 212, 0.4); display: flex; align-items: center; justify-content: center; color: #06b6d4;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                                </div>
                                <div>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <h3 style="font-size: 15px; font-weight: 800; margin: 0; color: #ffffff; letter-spacing: 0.3px;">MULTI-TRACK STEMS &amp; MASTER MIXDOWN</h3>
                                        <span id="take-count-badge" style="font-size: 10px; font-weight: 800; color: #06b6d4; background: rgba(6, 182, 212, 0.15); border: 1px solid rgba(6, 182, 212, 0.35); padding: 1px 8px; border-radius: 6px;">0 Stems Ready</span>
                                    </div>
                                    <p style="font-size: 11px; color: rgba(255,255,255,0.6); margin: 2px 0 0;">Isolated presenter vocals, remote co-host tracks &amp; synchronized master mixdown (Studio WAV)</p>
                                </div>
                            </div>

                            <!-- Aligned Action Group with Clear Primary CTA -->
                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <button id="take-open-timeline-btn" onclick="window._openTimelineEditor()" style="background: linear-gradient(135deg, rgba(6, 182, 212, 0.25) 0%, rgba(14, 165, 233, 0.45) 100%); border: 1px solid #06b6d4; color: #ffffff; padding: 7px 14px; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 0 14px rgba(6, 182, 212, 0.35); transition: all 0.2s;" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 0 20px rgba(6, 182, 212, 0.6)'" onmouseout="this.style.transform='none';this.style.boxShadow='0 0 14px rgba(6, 182, 212, 0.35)'">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>
                                    Open Timeline DAW
                                </button>
                                <button id="take-import-stem-btn" onclick="document.getElementById('take-import-stem-file').click()" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.2); color: #ffffff; padding: 7px 12px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.16)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                    Import Stem
                                </button>
                                <input type="file" id="take-import-stem-file" accept="audio/*" style="display: none;">
                                <button id="take-download-master-btn" onclick="window._downloadMasterMix()" style="display: none; background: linear-gradient(135deg, rgba(16, 185, 129, 0.28) 0%, rgba(5, 150, 105, 0.45) 100%); border: 1px solid #10b981; color: #ffffff; padding: 7px 13px; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer; align-items: center; gap: 6px; box-shadow: 0 0 14px rgba(16, 185, 129, 0.35);">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
                                    Download Master Mix
                                </button>
                                <button id="take-download-all-btn" onclick="window._downloadAllTakes()" style="display: none; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: #ffffff; padding: 7px 12px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer; align-items: center; gap: 6px;">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                    Download All Stems (.ZIP)
                                </button>
                                <button id="take-clear-all-btn" onclick="window._clearAllTakes()" style="display: none; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.18); color: rgba(255,255,255,0.85); padding: 7px 11px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer; align-items: center; gap: 5px; transition: all 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.2)';this.style.borderColor='rgba(239,68,68,0.4)';this.style.color='#fca5a5';" onmouseout="this.style.background='rgba(255,255,255,0.06)';this.style.borderColor='rgba(255,255,255,0.18)';this.style.color='rgba(255,255,255,0.85)';">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    Clear All
                                </button>
                            </div>
                        </div>

                        <!-- Take Inventory List (Empty State & Active Items) -->
                        <div id="podcast-take-inventory-list" style="display: flex; flex-direction: column; gap: 10px; max-height: 320px; overflow-y: auto;">
                            <!-- Clever, Dynamic 3-Track Blueprint Empty State -->
                            <div style="background: rgba(0,0,0,0.35); border: 1px dashed rgba(6, 182, 212, 0.25); border-radius: 14px; padding: 22px 18px; text-align: center;">
                                <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap;">
                                    <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 800; color: #10b981; display: inline-flex; align-items: center; gap: 5px;">
                                        <span style="width: 6px; height: 6px; border-radius: 50%; background: #10b981;"></span>
                                        Track 1: Presenter Vocal
                                    </div>
                                    <div style="background: rgba(6, 182, 212, 0.12); border: 1px solid rgba(6, 182, 212, 0.3); padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 800; color: #06b6d4; display: inline-flex; align-items: center; gap: 5px;">
                                        <span style="width: 6px; height: 6px; border-radius: 50%; background: #06b6d4;"></span>
                                        Track 2: Remote Co-Hosts (Up to 4)
                                    </div>
                                    <div style="background: rgba(139, 92, 246, 0.12); border: 1px solid rgba(139, 92, 246, 0.3); padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 800; color: #a78bfa; display: inline-flex; align-items: center; gap: 5px;">
                                        <span style="width: 6px; height: 6px; border-radius: 50%; background: #a78bfa;"></span>
                                        Track 3: Synchronized Master Mix
                                    </div>
                                </div>
                                <div style="font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 4px;">Studio Multi-Track Pipeline Ready</div>
                                <div style="font-size: 12px; color: rgba(255,255,255,0.5); max-width: 480px; margin: 0 auto 16px;">Hit "Start Recording" to capture your vocal stem, invite remote co-hosts, or import external stems to arrange in the Timeline DAW.</div>
                                <div style="display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap;">
                                    <button onclick="const b=document.getElementById('record-start-btn');if(b)b.scrollIntoView({behavior:'smooth'});" style="background: #ffffff; color: #06070a; border: none; padding: 8px 16px; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="10"/></svg>
                                        Start Vocal Recording
                                    </button>
                                    <button onclick="document.getElementById('take-import-stem-file').click()" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: #ffffff; padding: 8px 16px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                        Import Audio File (.WAV / .MP3)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Themed Remote Co-Host Invitations & Link Management Modal -->
            <div id="studio-guest-invites-modal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(14px); z-index: 2500; display: none; align-items: center; justify-content: center; padding: 20px;">
                <div style="background: #0b0f17; border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 20px; width: 100%; max-width: 620px; max-height: 90vh; overflow-y: auto; padding: 28px; position: relative; box-shadow: 0 25px 60px rgba(0,0,0,0.9), 0 0 35px rgba(16, 185, 129, 0.15);">
                    <!-- Header with Logo and Close -->
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 16px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <img src="/logo.png" alt="LocalFilm Ireland" style="height: 30px; width: auto; object-fit: contain; filter: drop-shadow(0 0 8px rgba(16,185,129,0.3));">
                            <div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <h3 style="font-size: 16px; font-weight: 800; color: #ffffff; margin: 0;">Co-Host Studio Invitations</h3>
                                    <span id="invites-capacity-badge" style="font-size: 10px; font-weight: 800; color: #10b981; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.4); padding: 2px 8px; border-radius: 6px; letter-spacing: 0.5px;">0/4 INVITED</span>
                                </div>
                                <p style="font-size: 11px; color: rgba(255,255,255,0.6); margin: 3px 0 0;">Each invitation link is single-use, protected with cryptographic token, and valid for 5 hours.</p>
                            </div>
                        </div>
                        <button id="close-guest-invites-modal-btn" type="button" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #ffffff; width: 32px; height: 32px; border-radius: 8px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center;">×</button>
                    </div>

                    <!-- Instant Auto-Copy Banner (Shown when link generated or copied) -->
                    <div id="invites-feedback-banner" style="display: none; background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; border-radius: 10px; padding: 10px 14px; margin-bottom: 18px; color: #34d399; font-size: 12px; font-weight: 700; align-items: center; gap: 8px; box-shadow: 0 0 14px rgba(16, 185, 129, 0.2);">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                        <span id="invites-feedback-text">Invite link auto-copied to clipboard! Send to your co-host.</span>
                    </div>

                    <!-- Add New Invite Form (Visible when < 4 invites) -->
                    <div id="invites-create-section" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 16px; margin-bottom: 20px;">
                        <label for="invites-guest-name-input" style="display: block; font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Invite New Co-Host</label>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <input type="text" id="invites-guest-name-input" value="Guest" placeholder="Co-Host Name (e.g. Guest, Sarah)" style="flex: 1 1 200px; background: #07080c; border: 1px solid rgba(255,255,255,0.2); color: #ffffff; padding: 10px 14px; border-radius: 10px; font-size: 13px; font-weight: 600; outline: none;">
                            <button type="button" id="invites-submit-btn" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: none; color: #ffffff; padding: 10px 18px; border-radius: 10px; font-size: 12px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 0 16px rgba(16,185,129,0.35); white-space: nowrap;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                Generate &amp; Auto-Copy Link
                            </button>
                        </div>
                    </div>

                    <!-- Capacity Reached Banner (Visible when >= 4 invites) -->
                    <div id="invites-max-banner" style="display: none; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 14px; padding: 14px 16px; margin-bottom: 20px;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <span style="color: #f59e0b; font-size: 12px; font-weight: 900; letter-spacing: 0.5px;">🔒 MAXIMUM 4 CO-HOSTS INVITED</span>
                        </div>
                        <p style="font-size: 11px; color: rgba(255,255,255,0.7); margin: 0; line-height: 1.5;">All 4 remote co-host slots have been allocated for this recording session. You can copy any of the active links below if a co-host lost theirs, or revoke a slot to invite someone else.</p>
                    </div>

                    <!-- Active Invitation Links List -->
                    <div>
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                            <span style="font-size: 12px; font-weight: 800; color: rgba(255,255,255,0.9); text-transform: uppercase; letter-spacing: 0.5px;">Active Invitation Links (Valid 5 Hours)</span>
                            <span id="invites-valid-countdown" style="font-size: 11px; color: rgba(255,255,255,0.5);">5 hours session TTL</span>
                        </div>
                        <div id="invites-active-list" style="display: flex; flex-direction: column; gap: 10px;">
                            <div id="invites-empty-placeholder" style="color: rgba(255,255,255,0.4); font-size: 12px; font-style: italic; padding: 12px; text-align: center; border: 1px dashed rgba(255,255,255,0.1); border-radius: 10px;">
                                No co-host invitations generated yet. Click &quot;Generate &amp; Auto-Copy Link&quot; above to invite up to 4 co-hosts.
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Upload / Edit Episode Modal — Epic Cinema-Grade Broadcast Master Publisher -->
            <div id="podcast-upload-modal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.88); backdrop-filter: blur(16px); z-index: 2000; display: none; align-items: center; justify-content: center; padding: clamp(12px, 3vw, 24px);">
                <div style="background: linear-gradient(180deg, #0e121b 0%, #07090e 100%); border: 1px solid rgba(255, 255, 255, 0.16); border-radius: 24px; width: 100%; max-width: 820px; max-height: 90vh; overflow-y: auto; padding: clamp(20px, 4vw, 36px); position: relative; box-shadow: 0 32px 80px rgba(0,0,0,0.95);">
                    <button id="podcast-upload-close-btn" style="position: absolute; top: 20px; right: 20px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255,255,255,0.15); color: #ffffff; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.18)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>

                    <!-- Epic Branding Header with LocalFilm Official Logo -->
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; gap: 16px; flex-wrap: wrap; padding-bottom: 18px; border-bottom: 1px solid rgba(255,255,255,0.08);">
                        <div style="display: flex; align-items: center; gap: 14px;">
                            <img src="/logo.png" alt="LocalFilm" style="width: 44px; height: 44px; object-fit: contain; filter: drop-shadow(0 0 14px rgba(16, 185, 129, 0.45)); border-radius: 10px; background: rgba(255,255,255,0.03); padding: 2px; border: 1px solid rgba(255,255,255,0.1);">
                            <div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <h2 id="up-modal-title" style="font-size: 22px; font-weight: 900; margin: 0; color: #ffffff; letter-spacing: -0.3px;">Publish Episode</h2>
                                    <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #34d399; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); padding: 2px 7px; border-radius: 6px;">● RSS 2.0 Feed Ready</span>
                                </div>
                                <p style="font-size: 12px; color: rgba(255, 255, 255, 0.55); margin: 3px 0 0;">Broadcast Master Suite · Audio Encoding &amp; Community Distribution</p>
                            </div>
                        </div>
                        <button id="up-ai-optimize-btn" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.2); color: #ffffff; padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
                            AI Optimize Metadata
                        </button>
                    </div>

                    <form id="podcast-upload-form" style="display: flex; flex-direction: column; gap: 20px;">
                        
                        <!-- SECTION 1: Episode Details & Identity (Emerald #10b981 Theme) -->
                        <div style="background: rgba(16, 185, 129, 0.03); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 16px; padding: 18px;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
                                <span style="font-size: 11px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #34d399; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); padding: 2px 7px; border-radius: 6px;">1. Episode Identity</span>
                                <span style="font-size: 12px; font-weight: 700; color: #ffffff;">Metadata &amp; Show Numbering</span>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 12px;">
                                <div>
                                    <label style="display: block; font-size: 12px; font-weight: 700; color: rgba(255, 255, 255, 0.8); margin-bottom: 6px;">Episode Title *</label>
                                    <input type="text" id="up-title" required placeholder="e.g. On-Set Lighting &amp; Camera Optics with HOD Ken Keogh" style="width: 100%; background: #07090e; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 10px 14px; color: #ffffff; font-size: 13px;">
                                </div>
                                <div>
                                    <label style="display: block; font-size: 12px; font-weight: 700; color: rgba(255, 255, 255, 0.8); margin-bottom: 6px;">Subtitle / Tagline</label>
                                    <input type="text" id="up-subtitle" placeholder="e.g. Technical breakdown of RAW file dispatch &amp; ARRI LUT calibration" style="width: 100%; background: #07090e; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 10px 14px; color: #ffffff; font-size: 13px;">
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                                    <div>
                                        <label style="display: block; font-size: 12px; font-weight: 700; color: rgba(255, 255, 255, 0.7); margin-bottom: 6px;">Duration (Sec)</label>
                                        <input type="number" id="up-duration" value="1200" style="width: 100%; background: #07090e; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 9px 12px; color: #ffffff; font-size: 13px;">
                                    </div>
                                    <div>
                                        <label style="display: block; font-size: 12px; font-weight: 700; color: rgba(255, 255, 255, 0.7); margin-bottom: 6px;">Season #</label>
                                        <input type="number" id="up-season" value="1" style="width: 100%; background: #07090e; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 9px 12px; color: #ffffff; font-size: 13px;">
                                    </div>
                                    <div>
                                        <label style="display: block; font-size: 12px; font-weight: 700; color: rgba(255, 255, 255, 0.7); margin-bottom: 6px;">Episode #</label>
                                        <input type="number" id="up-episode" value="1" style="width: 100%; background: #07090e; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 9px 12px; color: #ffffff; font-size: 13px;">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- SECTION 2: Cinematic Cover Artwork Studio (Cyan #06b6d4 Theme) -->
                        <div style="background: rgba(6, 182, 212, 0.03); border: 1px solid rgba(6, 182, 212, 0.25); border-radius: 16px; padding: 18px;">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span style="font-size: 11px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #22d3ee; background: rgba(6, 182, 212, 0.15); border: 1px solid rgba(6, 182, 212, 0.3); padding: 2px 7px; border-radius: 6px;">2. Cover Artwork Studio</span>
                                    <span style="font-size: 12px; font-weight: 700; color: #ffffff;">Auto-Converts to 1400x1400 Square JPEG</span>
                                </div>
                                <span id="up-cover-status" style="font-size: 11px; color: #22d3ee; font-weight: 700; display: none;">✓ Saved</span>
                            </div>
                            <div style="display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap;">
                                <!-- Live 1:1 Image Preview Frame -->
                                <div id="up-cover-preview-frame" style="width: 130px; height: 130px; border-radius: 14px; background: #04060a; border: 2px solid rgba(6, 182, 212, 0.35); overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative; flex-shrink: 0; box-shadow: 0 0 16px rgba(6, 182, 212, 0.2);">
                                    <img id="up-cover-preview-img" src="/assets/podcast_cover_01.jpg" alt="Cover Preview" style="width: 100%; height: 100%; object-fit: cover;">
                                    <div id="up-cover-empty-placeholder" style="display: none; flex-direction: column; align-items: center; justify-content: center; color: rgba(255,255,255,0.4); text-align: center; padding: 10px;">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                        <span style="font-size: 10px; margin-top: 4px; font-weight: 700;">No Photo</span>
                                    </div>
                                </div>

                                <!-- Upload Actions & Quick Presets -->
                                <div style="flex: 1 1 300px; display: flex; flex-direction: column; gap: 10px;">
                                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                        <input type="file" id="up-cover-file" accept="image/*,.heic" style="display: none;">
                                        <button type="button" id="up-cover-upload-btn" style="background: linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(14, 116, 144, 0.35) 100%); border: 1px solid #06b6d4; color: #ffffff; padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 0 12px rgba(6, 182, 212, 0.25); transition: all 0.2s;">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                            Upload Photo from Device
                                        </button>
                                        <button type="button" id="up-cover-use-logo-btn" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.18); color: #ffffff; padding: 7px 12px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                                            Use LocalFilm Logo
                                        </button>
                                    </div>
                                    
                                    <!-- 1-Click Preset Artwork Selector -->
                                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                        <span style="font-size: 11px; color: rgba(255,255,255,0.5); font-weight: 700;">1-Click Presets:</span>
                                        <button type="button" class="up-cover-preset-btn" data-preset="/assets/podcast_cover_01.jpg" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #ffffff; padding: 3px 8px; border-radius: 6px; font-size: 11px; cursor: pointer;">Cine Lens</button>
                                        <button type="button" class="up-cover-preset-btn" data-preset="/assets/podcast_cover_02.jpg" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #ffffff; padding: 3px 8px; border-radius: 6px; font-size: 11px; cursor: pointer;">Film Reel</button>
                                        <button type="button" class="up-cover-preset-btn" data-preset="/assets/podcast_cover_03.jpg" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #ffffff; padding: 3px 8px; border-radius: 6px; font-size: 11px; cursor: pointer;">Studio Clapper</button>
                                    </div>

                                    <div>
                                        <input type="text" id="up-cover-art" placeholder="/assets/podcast_cover_01.jpg or /uploads/..." style="width: 100%; background: #07090e; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 8px 12px; color: #ffffff; font-size: 12px;">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- SECTION 3: Master Audio Track & Multi-Track Ingestion (Violet #8b5cf6 Theme) -->
                        <div style="background: rgba(139, 92, 246, 0.03); border: 1px solid rgba(139, 92, 246, 0.25); border-radius: 16px; padding: 18px;">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span style="font-size: 11px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #a78bfa; background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.3); padding: 2px 7px; border-radius: 6px;">3. Master Audio Track</span>
                                    <span style="font-size: 12px; font-weight: 700; color: #ffffff;">Studio WAV or MP3</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <button type="button" id="up-open-timeline-btn" style="background: rgba(139, 92, 246, 0.18); border: 1px solid #8b5cf6; color: #ffffff; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
                                        Edit on Timeline DAW
                                    </button>
                                </div>
                            </div>

                            <!-- Quick Take Ingestion from Studio Take Inventory -->
                            <div id="up-quick-takes-container" style="display: none; margin-bottom: 12px;"></div>

                            <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                                <input type="text" id="up-audio-url" required placeholder="https://... or /uploads/..." style="flex: 1; background: #07090e; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 10px 14px; color: #ffffff; font-size: 13px;">
                                <input type="file" id="up-audio-file" accept="audio/*" style="display: none;">
                                <button type="button" id="up-audio-upload-btn" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.2); color: #ffffff; padding: 0 16px; border-radius: 8px; font-size: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line></svg>
                                    Upload MP3/WAV
                                </button>
                            </div>

                            <!-- Inline Audio Player Audition Bar -->
                            <audio id="up-audio-preview-player" controls style="width: 100%; height: 36px; display: none; margin-top: 6px; border-radius: 8px;"></audio>
                        </div>

                        <!-- SECTION 4: Bumpers & Background Ducking Mixer (Amber #f59e0b Theme) -->
                        <div style="background: rgba(245, 158, 11, 0.03); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 16px; padding: 18px;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
                                <span style="font-size: 11px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #fbbf24; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); padding: 2px 7px; border-radius: 6px;">4. Broadcast Bumpers &amp; Score</span>
                                <span style="font-size: 12px; font-weight: 700; color: #ffffff;">Intro/Outro Music Beds &amp; Ambient Ducking</span>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                                <div>
                                    <label style="display: block; font-size: 12px; font-weight: 700; color: rgba(255, 255, 255, 0.7); margin-bottom: 6px;">Intro Audio Bumper</label>
                                    <select id="up-intro-bumper" style="width: 100%; background: #07090e; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 10px 14px; color: #ffffff; font-size: 12px;">
                                        <option value="cinematic_intro" selected>LocalFilm Cinematic Opener</option>
                                        <option value="broadcast_intro">Radio Broadcast Opener</option>
                                        <option value="none">None</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="display: block; font-size: 12px; font-weight: 700; color: rgba(255, 255, 255, 0.7); margin-bottom: 6px;">Outro Audio Bumper</label>
                                    <select id="up-outro-bumper" style="width: 100%; background: #07090e; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 10px 14px; color: #ffffff; font-size: 12px;">
                                        <option value="broadcast_outro" selected>LocalFilm Sign-off Outro</option>
                                        <option value="sting_clapper">On-Set Slate Sting</option>
                                        <option value="none">None</option>
                                    </select>
                                </div>
                            </div>

                            <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 12px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                                    <label style="font-size: 12px; font-weight: 700; color: #ffffff; display: flex; align-items: center; gap: 6px;">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
                                        Background Ambient Bed &amp; Ducking
                                    </label>
                                    <span id="up-subtrack-vol-val" style="font-size: 11px; font-weight: 800; color: #fbbf24; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); padding: 2px 7px; border-radius: 4px;">20% Vol</span>
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: center;">
                                    <select id="up-subtrack-preset" style="width: 100%; background: #07090e; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 8px 12px; color: #ffffff; font-size: 12px;">
                                        <option value="">No Subtrack (Voice Only)</option>
                                        <option value="https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=podcast-ambient-116199.mp3">Ambient Film Score Preset</option>
                                        <option value="https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a14e9f.mp3?filename=cinematic-atmosphere-10499.mp3">Celtic Whistle &amp; Harp Preset</option>
                                        <option value="https://cdn.pixabay.com/download/audio/2022/10/14/audio_993a40c953.mp3?filename=technology-podcast-intro-123491.mp3">Lofi Set Atmosphere Preset</option>
                                        <option value="custom">Custom Subtrack URL...</option>
                                    </select>
                                    <input type="range" id="up-subtrack-volume" min="0" max="1" step="0.05" value="0.20" style="width: 100%; accent-color: #fbbf24; cursor: pointer;">
                                </div>
                                <input type="text" id="up-subtrack-custom" placeholder="https://domain.com/background-audio.mp3" style="display: none; width: 100%; margin-top: 8px; background: #07090e; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 8px 12px; color: #ffffff; font-size: 12px;">
                            </div>
                        </div>

                        <!-- SECTION 5: Spotlight Creators & Show Notes (Rose #f43f5e Theme) -->
                        <div style="background: rgba(244, 63, 94, 0.03); border: 1px solid rgba(244, 63, 94, 0.25); border-radius: 16px; padding: 18px;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
                                <span style="font-size: 11px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #fb7185; background: rgba(244, 63, 94, 0.15); border: 1px solid rgba(244, 63, 94, 0.3); padding: 2px 7px; border-radius: 6px;">5. Spotlight &amp; Show Notes</span>
                                <span style="font-size: 12px; font-weight: 700; color: #ffffff;">Tagged Community Cast/Crew &amp; Timestamps</span>
                            </div>

                            <div style="margin-bottom: 14px;">
                                <label style="display: block; font-size: 12px; font-weight: 700; color: rgba(255, 255, 255, 0.8); margin-bottom: 6px;">Featured Community Members (Spotlight Promotion)</label>
                                <input type="text" id="up-member-search" placeholder="Type member name to tag (e.g. Alan Joyce, Garvin Burke)..." style="width: 100%; background: #07090e; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 10px 14px; color: #ffffff; font-size: 13px;">
                                <div id="member-search-results" style="display: none; background: #121622; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; max-height: 160px; overflow-y: auto; margin-top: 4px;"></div>
                                <div id="selected-members-badges" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;"></div>
                            </div>

                            <div>
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                                    <label style="font-size: 12px; font-weight: 700; color: rgba(255, 255, 255, 0.8);">Description &amp; Show Notes</label>
                                    <div style="display: flex; gap: 6px;">
                                        <button type="button" id="up-insert-timestamps-btn" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #ffffff; padding: 2px 7px; border-radius: 4px; font-size: 10px; cursor: pointer;">+ Timestamps</button>
                                        <button type="button" id="up-insert-credits-btn" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #ffffff; padding: 2px 7px; border-radius: 4px; font-size: 10px; cursor: pointer;">+ Credits</button>
                                    </div>
                                </div>
                                <textarea id="up-description" rows="4" placeholder="Full summary, timestamps, guest links, HOD credits..." style="width: 100%; background: #07090e; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 10px 14px; color: #ffffff; font-size: 13px; font-family: inherit; line-height: 1.5;"></textarea>
                            </div>
                        </div>

                        <!-- SECTION 6: Publish Action -->
                        <button type="submit" id="up-submit-btn" style="width: 100%; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; border: none; padding: 15px; border-radius: 12px; font-weight: 900; font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 0 24px rgba(16, 185, 129, 0.35); transition: all 0.2s;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                            Publish Episode to RSS Feed &amp; Community
                        </button>
                    </form>
                </div>
            </div>

            <!-- Interactive Multi-Track Timeline DAW & Audio Editor Modal -->
            <div id="podcast-editor-modal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.92); backdrop-filter: blur(18px); z-index: 2150; display: none; align-items: center; justify-content: center; padding: clamp(8px, 1.5vw, 20px);">
                <div style="background: #080a10; border: 1px solid rgba(255, 255, 255, 0.16); border-radius: 20px; width: 96vw; max-width: 1480px; max-height: 94vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 32px 80px rgba(0,0,0,0.95); position: relative;">
                    
                    <!-- Desktop DAW Top Menu Bar (Tier 0: Professional Desktop Menu Hierarchy) -->
                    <div id="daw-desktop-menu-bar" style="background: #06080e; border-bottom: 1px solid rgba(255,255,255,0.08); padding: 2px 10px; display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.78); user-select: none; z-index: 100; position: relative;">
                        <!-- Menu Items with Dropdowns -->
                        <div class="daw-menu-group" style="position: relative;">
                            <button type="button" class="daw-menu-bar-btn" data-menu="file" style="background: none; border: none; color: inherit; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; transition: background 0.12s, color 0.12s;">
                                File <span style="font-size: 8px; opacity: 0.6;">▾</span>
                            </button>
                            <div id="daw-menu-dropdown-file" class="daw-menu-dropdown" style="display: none; position: absolute; top: calc(100% + 2px); left: 0; background: #0c0f17; border: 1px solid rgba(255,255,255,0.14); border-radius: 6px; min-width: 210px; box-shadow: 0 16px 36px rgba(0,0,0,0.92); z-index: 3100; padding: 4px 0;">
                                <div class="daw-menu-item" id="daw-menu-file-new" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>New Recording Project</span>
                                    <span style="font-size: 9.5px; color: rgba(255,255,255,0.4); font-family: monospace;">Alt+N</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-file-import" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Import Audio File...</span>
                                    <span style="font-size: 9.5px; color: rgba(255,255,255,0.4); font-family: monospace;">Ctrl+I</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-file-import-video" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #38bdf8; font-size: 11.5px; font-weight: 700; transition: background 0.12s;">
                                    <span>🎬 Import Film Video Track...</span>
                                    <span style="font-size: 9.5px; color: rgba(56,189,248,0.7); font-family: monospace;">V</span>
                                </div>
                                <div style="height: 1px; background: rgba(255,255,255,0.08); margin: 3px 0;"></div>
                                <div class="daw-menu-item" id="daw-menu-file-render" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #34d399; font-size: 11.5px; font-weight: 700; transition: background 0.12s;">
                                    <span>Render Master Mix</span>
                                    <span style="font-size: 9.5px; color: rgba(52,211,153,0.7); font-family: monospace;">Ctrl+M</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-file-export-stems" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #38bdf8; font-size: 11.5px; font-weight: 700; transition: background 0.12s;">
                                    <span>Export All Stems as ZIP</span>
                                    <span style="font-size: 9.5px; color: rgba(56,189,248,0.7); font-family: monospace;">Ctrl+Shift+E</span>
                                </div>
                                <div style="height: 1px; background: rgba(255,255,255,0.08); margin: 3px 0;"></div>
                                <div class="daw-menu-item" id="daw-menu-file-close" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #f87171; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Close DAW</span>
                                    <span style="font-size: 9.5px; color: rgba(248,113,113,0.7); font-family: monospace;">Esc</span>
                                </div>
                            </div>
                        </div>

                        <div class="daw-menu-group" style="position: relative;">
                            <button type="button" class="daw-menu-bar-btn" data-menu="edit" style="background: none; border: none; color: inherit; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; transition: background 0.12s, color 0.12s;">
                                Edit <span style="font-size: 8px; opacity: 0.6;">▾</span>
                            </button>
                            <div id="daw-menu-dropdown-edit" class="daw-menu-dropdown" style="display: none; position: absolute; top: calc(100% + 2px); left: 0; background: #0c0f17; border: 1px solid rgba(255,255,255,0.14); border-radius: 6px; min-width: 210px; box-shadow: 0 16px 36px rgba(0,0,0,0.92); z-index: 3100; padding: 4px 0;">
                                <div class="daw-menu-item" id="daw-menu-edit-undo" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Undo</span>
                                    <span style="font-size: 9.5px; color: rgba(255,255,255,0.4); font-family: monospace;">Ctrl+Z</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-edit-redo" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Redo</span>
                                    <span style="font-size: 9.5px; color: rgba(255,255,255,0.4); font-family: monospace;">Ctrl+Y</span>
                                </div>
                                <div style="height: 1px; background: rgba(255,255,255,0.08); margin: 3px 0;"></div>
                                <div class="daw-menu-item" id="daw-menu-edit-cut" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Cut Clip(s)</span>
                                    <span style="font-size: 9.5px; color: rgba(255,255,255,0.4); font-family: monospace;">Ctrl+X</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-edit-copy" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Copy Clip(s)</span>
                                    <span style="font-size: 9.5px; color: rgba(255,255,255,0.4); font-family: monospace;">Ctrl+C</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-edit-paste" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Paste at Playhead</span>
                                    <span style="font-size: 9.5px; color: rgba(255,255,255,0.4); font-family: monospace;">Ctrl+V</span>
                                </div>
                                <div style="height: 1px; background: rgba(255,255,255,0.08); margin: 3px 0;"></div>
                                <div class="daw-menu-item" id="daw-menu-edit-split" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Split at Playhead</span>
                                    <span style="font-size: 9.5px; color: rgba(255,255,255,0.4); font-family: monospace;">S / B</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-edit-duplicate" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Duplicate Clip</span>
                                    <span style="font-size: 9.5px; color: rgba(255,255,255,0.4); font-family: monospace;">Ctrl+D</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-edit-delete" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Delete Selected</span>
                                    <span style="font-size: 9.5px; color: rgba(255,255,255,0.4); font-family: monospace;">Del</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-edit-ripple-delete" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #f87171; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Ripple Delete (Close Gap)</span>
                                    <span style="font-size: 9.5px; color: rgba(248,113,113,0.7); font-family: monospace;">Shift+Del</span>
                                </div>
                                <div style="height: 1px; background: rgba(255,255,255,0.08); margin: 3px 0;"></div>
                                <div class="daw-menu-item" id="daw-menu-edit-select-all" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Select All Clips</span>
                                    <span style="font-size: 9.5px; color: rgba(255,255,255,0.4); font-family: monospace;">Ctrl+A</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-edit-deselect" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Deselect All</span>
                                    <span style="font-size: 9.5px; color: rgba(255,255,255,0.4); font-family: monospace;">Esc</span>
                                </div>
                            </div>
                        </div>

                        <div class="daw-menu-group" style="position: relative;">
                            <button type="button" class="daw-menu-bar-btn" data-menu="tracks" style="background: none; border: none; color: inherit; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; transition: background 0.12s, color 0.12s;">
                                Tracks <span style="font-size: 8px; opacity: 0.6;">▾</span>
                            </button>
                            <div id="daw-menu-dropdown-tracks" class="daw-menu-dropdown" style="display: none; position: absolute; top: calc(100% + 2px); left: 0; background: #0c0f17; border: 1px solid rgba(255,255,255,0.14); border-radius: 6px; min-width: 220px; box-shadow: 0 16px 36px rgba(0,0,0,0.92); z-index: 3100; padding: 4px 0;">
                                <div class="daw-menu-item" id="daw-menu-tracks-add-audio" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #34d399; font-size: 11.5px; transition: background 0.12s;">
                                    <span>+ Add Audio Track</span>
                                    <span style="font-size: 9.5px; color: rgba(255,255,255,0.4); font-family: monospace;">Ctrl+T</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-tracks-add-music" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fbbf24; font-size: 11.5px; transition: background 0.12s;">
                                    <span>+ Add Music / SFX Track</span>
                                    <span style="font-size: 9.5px; color: rgba(255,255,255,0.4); font-family: monospace;">Alt+T</span>
                                </div>
                                <div style="height: 1px; background: rgba(255,255,255,0.08); margin: 3px 0;"></div>
                                <div class="daw-menu-item" id="daw-menu-tracks-mute-all" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Mute All Tracks</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-tracks-unmute-all" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Unmute All Tracks</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-tracks-clear-solo" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Clear Solos</span>
                                </div>
                                <div style="height: 1px; background: rgba(255,255,255,0.08); margin: 3px 0;"></div>
                                <div class="daw-menu-item" id="daw-menu-tracks-toggle-automation" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #38bdf8; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Toggle Automation Curves</span>
                                    <span style="font-size: 9.5px; color: rgba(255,255,255,0.4); font-family: monospace;">A</span>
                                </div>
                            </div>
                        </div>

                        <div class="daw-menu-group" style="position: relative;">
                            <button type="button" class="daw-menu-bar-btn" data-menu="effects" style="background: none; border: none; color: inherit; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; transition: background 0.12s, color 0.12s;">
                                Effects <span style="font-size: 8px; opacity: 0.6;">▾</span>
                            </button>
                            <div id="daw-menu-dropdown-effects" class="daw-menu-dropdown" style="display: none; position: absolute; top: calc(100% + 2px); left: 0; background: #0c0f17; border: 1px solid rgba(255,255,255,0.14); border-radius: 6px; min-width: 230px; box-shadow: 0 16px 36px rgba(0,0,0,0.92); z-index: 3100; padding: 4px 0;">
                                <div class="daw-menu-item" id="daw-menu-fx-open-rack" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #38bdf8; font-size: 11.5px; font-weight: 700; transition: background 0.12s;">
                                    <span>Open Track DSP FX Rack (10 Plugins)...</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-fx-plugins-dir" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #34d399; font-size: 11.5px; font-weight: 700; transition: background 0.12s;">
                                    <span>Browse Audio Plugins Directory...</span>
                                    <span style="font-size: 9.5px; color: rgba(52,211,153,0.7); font-family: monospace;">Ctrl+Alt+P</span>
                                </div>
                                <div style="height: 1px; background: rgba(255,255,255,0.08); margin: 3px 0;"></div>
                                <div class="daw-menu-item" id="daw-menu-fx-preset-la2a" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Model: Teletronix LA-2A (Opto Warmth)</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-fx-preset-1176" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Model: UREI 1176LN (FET Punch Peak)</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-fx-preset-ssl" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Model: SSL G-Master Bus (Mix Glue)</span>
                                </div>
                                <div style="height: 1px; background: rgba(255,255,255,0.08); margin: 3px 0;"></div>
                                <div class="daw-menu-item" id="daw-menu-fx-dehum-50" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Restoration: 50Hz De-Hum (Ireland / EU)</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-fx-dehum-60" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Restoration: 60Hz De-Hum (US Ground)</span>
                                </div>
                                <div style="height: 1px; background: rgba(255,255,255,0.08); margin: 3px 0;"></div>
                                <div class="daw-menu-item" id="daw-menu-fx-preset-polish" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Preset: Broadcast Vocal Polish</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-fx-preset-radio" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Preset: Radio Punch &amp; Tape Warmth</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-fx-preset-space" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Preset: Studio Reverb &amp; Spatial Wide</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-fx-preset-podcast-clean" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Preset: Clean Dialogue (Gate + De-Esser)</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-fx-preset-master-brickwall" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Preset: Master Maximizer &amp; Limiter</span>
                                </div>
                                <div style="height: 1px; background: rgba(255,255,255,0.08); margin: 3px 0;"></div>
                                <div class="daw-menu-item" id="daw-menu-fx-reset" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #f87171; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Bypass / Reset All Plugins</span>
                                </div>
                            </div>
                        </div>

                        <div class="daw-menu-group" style="position: relative;">
                            <button type="button" class="daw-menu-bar-btn" data-menu="view" style="background: none; border: none; color: inherit; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; transition: background 0.12s, color 0.12s;">
                                View <span style="font-size: 8px; opacity: 0.6;">▾</span>
                            </button>
                            <div id="daw-menu-dropdown-view" class="daw-menu-dropdown" style="display: none; position: absolute; top: calc(100% + 2px); left: 0; background: #0c0f17; border: 1px solid rgba(255,255,255,0.14); border-radius: 6px; min-width: 250px; box-shadow: 0 16px 36px rgba(0,0,0,0.92); z-index: 3100; padding: 4px 0;">
                                <div class="daw-menu-item" id="daw-menu-view-fullscreen" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #38bdf8; font-size: 11.5px; font-weight: 700; transition: background 0.12s;">
                                    <span>Toggle Fullscreen DAW</span>
                                    <span style="font-size: 9.5px; color: rgba(56,189,248,0.7); font-family: monospace;">F11</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-view-vu-meter" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #10b981; font-size: 11.5px; font-weight: 700; transition: background 0.12s;">
                                    <span>Master VU Meter Window</span>
                                    <span style="font-size: 9.5px; color: rgba(16,185,129,0.7); font-family: monospace;">F8</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-view-toggle-sidebar" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Collapse / Expand Track Sidebar</span>
                                    <span style="font-size: 9.5px; color: rgba(255,255,255,0.4); font-family: monospace;">Alt+S</span>
                                </div>
                                <div style="height: 1px; background: rgba(255,255,255,0.08); margin: 3px 0;"></div>
                                <div class="daw-menu-item" id="daw-menu-layout-standard" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Layout: Standard Studio</span>
                                    <span id="daw-menu-layout-standard-check" style="color: #10b981;">✓</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-layout-editing" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Layout: Editing Focus</span>
                                    <span id="daw-menu-layout-editing-check" style="display: none; color: #10b981;">✓</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-layout-canvas" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Layout: Maximised Canvas</span>
                                    <span id="daw-menu-layout-canvas-check" style="display: none; color: #10b981;">✓</span>
                                </div>
                                <div style="height: 1px; background: rgba(255,255,255,0.08); margin: 3px 0;"></div>
                                <div class="daw-menu-item" id="daw-menu-view-height-56" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Track Height: Compact (56px)</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-view-height-74" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Track Height: Standard (74px)</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-view-height-110" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Track Height: Expanded (110px)</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-view-height-160" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Track Height: Jumbo Waveform (160px)</span>
                                </div>
                                <div style="height: 1px; background: rgba(255,255,255,0.08); margin: 3px 0;"></div>
                                <div class="daw-menu-item" id="daw-menu-theme-obsidian" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Theme: Obsidian Dark (Default)</span>
                                    <span id="daw-theme-obsidian-check" style="color: #10b981;">✓</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-theme-monochrome" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Theme: Cinema Monochrome B&amp;W</span>
                                    <span id="daw-theme-monochrome-check" style="display: none; color: #10b981;">✓</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-theme-matrix" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #00ff66; font-size: 11.5px; font-weight: 700; transition: background 0.12s;">
                                    <span>Theme: Matrix Phosphor Green</span>
                                    <span id="daw-theme-matrix-check" style="display: none; color: #00ff66;">✓</span>
                                </div>
                                <div style="height: 1px; background: rgba(255,255,255,0.08); margin: 3px 0;"></div>
                                <div class="daw-menu-item" id="daw-menu-view-snap-cycle" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Toggle Magnetic Snap</span>
                                    <span style="font-size: 9.5px; color: rgba(255,255,255,0.4); font-family: monospace;">F9</span>
                                </div>
                            </div>
                        </div>

                        <div class="daw-menu-group" style="position: relative;">
                            <button type="button" class="daw-menu-bar-btn" data-menu="transport" style="background: none; border: none; color: inherit; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; transition: background 0.12s, color 0.12s;">
                                Transport <span style="font-size: 8px; opacity: 0.6;">▾</span>
                            </button>
                            <div id="daw-menu-dropdown-transport" class="daw-menu-dropdown" style="display: none; position: absolute; top: calc(100% + 2px); left: 0; background: #0c0f17; border: 1px solid rgba(255,255,255,0.14); border-radius: 6px; min-width: 210px; box-shadow: 0 16px 36px rgba(0,0,0,0.92); z-index: 3100; padding: 4px 0;">
                                <div class="daw-menu-item" id="daw-menu-trans-play" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Play / Pause</span>
                                    <span style="font-size: 9.5px; color: rgba(255,255,255,0.4); font-family: monospace;">Space</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-trans-stop" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Stop &amp; Rewind</span>
                                    <span style="font-size: 9.5px; color: rgba(255,255,255,0.4); font-family: monospace;">Num 0</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-trans-record" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #f87171; font-size: 11.5px; font-weight: 700; transition: background 0.12s;">
                                    <span>Record Overdub</span>
                                    <span style="font-size: 9.5px; color: rgba(248,113,113,0.7); font-family: monospace;">R</span>
                                </div>
                                <div class="daw-menu-item" id="daw-menu-trans-loop" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>Toggle Cycle Loop</span>
                                    <span style="font-size: 9.5px; color: rgba(255,255,255,0.4); font-family: monospace;">L</span>
                                </div>
                            </div>
                        </div>

                        <div class="daw-menu-group" style="position: relative;">
                            <button type="button" class="daw-menu-bar-btn" data-menu="help" style="background: none; border: none; color: inherit; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; transition: background 0.12s, color 0.12s;">
                                Help <span style="font-size: 8px; opacity: 0.6;">▾</span>
                            </button>
                            <div id="daw-menu-dropdown-help" class="daw-menu-dropdown" style="display: none; position: absolute; top: calc(100% + 2px); left: 0; background: #0c0f17; border: 1px solid rgba(255,255,255,0.14); border-radius: 6px; min-width: 220px; box-shadow: 0 16px 36px rgba(0,0,0,0.92); z-index: 3100; padding: 4px 0;">
                                <div class="daw-menu-item" id="daw-menu-help-shortcuts" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #38bdf8; font-size: 11.5px; font-weight: 700; transition: background 0.12s;">
                                    <span>Keyboard Shortcuts Guide...</span>
                                    <span style="font-size: 9.5px; color: rgba(56,189,248,0.7); font-family: monospace;">?</span>
                                </div>
                                <div style="height: 1px; background: rgba(255,255,255,0.08); margin: 3px 0;"></div>
                                <div class="daw-menu-item" id="daw-menu-help-about" style="padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #fff; font-size: 11.5px; transition: background 0.12s;">
                                    <span>About LocalFilm Studio DAW</span>
                                </div>
                            </div>
                        </div>

                        <!-- Right Quick Layout Indicator -->
                        <div style="margin-left: auto; display: flex; align-items: center; gap: 8px; font-size: 10px; color: rgba(255,255,255,0.5);">
                            <span id="daw-layout-status-tag" style="padding: 1px 6px; background: rgba(255,255,255,0.06); border-radius: 3px; border: 1px solid rgba(255,255,255,0.1);">STUDIO MODE</span>
                        </div>
                    </div>

                    <!-- Hidden File Input for Import Audio File -->
                    <input type="file" id="daw-menu-audio-file-input" accept="audio/*" style="display: none;">
                    <!-- Hidden File Input for Import Film Video File -->
                    <input type="file" id="daw-video-import-input" accept="video/mp4,video/webm,video/quicktime,video/*" style="display: none;">

                    <!-- Top Studio Control Deck (Tier 1: Master Transport & Playback / Record) -->
                    <div style="background: #0b0e16; border-bottom: 1px solid rgba(255,255,255,0.08); padding: 7px 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-shrink: 0; overflow-x: auto; scrollbar-width: none;">
                        <!-- Left Session Branding & Target -->
                        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <div style="width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 10px #10b981;"></div>
                                <h3 id="timeline-modal-title" style="font-size: 12px; font-weight: 800; color: #ffffff; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap;">Multi-Track Studio DAW</h3>
                            </div>
                            <span id="timeline-target-title" style="font-size: 11px; color: rgba(255,255,255,0.65); background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 2px 7px; border-radius: 5px; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Episode Master</span>
                        </div>

                        <!-- Center Master Transport Deck (All Strictly 32px Height) -->
                        <div style="display: flex; align-items: center; gap: 5px; flex-shrink: 0;">
                            <!-- Timecode Clock & SMPTE / Standard Mode Switcher -->
                            <div style="height: 32px; box-sizing: border-box; background: #000000; border: 1px solid rgba(255,255,255,0.18); border-radius: 6px; padding: 0 6px; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;">
                                <div id="timeline-timecode-display" style="font-family: monospace; font-size: 11.5px; font-weight: 800; color: #34d399; letter-spacing: 0.5px;">
                                    00:00:00:00
                                </div>
                                <button id="daw-timecode-mode-btn" title="Toggle Timecode Format: SMPTE Film Frames (HH:MM:SS:FF) vs Standard Time (MM:SS.ms)" style="background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); color: #38bdf8; font-size: 9px; font-weight: 800; padding: 2px 5px; border-radius: 3px; cursor: pointer; text-transform: uppercase;">
                                    SMPTE
                                </button>
                                <select id="daw-fps-select" title="Cinema Frame Rate (SMPTE Sync)" style="background: #090d16; border: 1px solid rgba(255,255,255,0.16); color: #38bdf8; font-size: 9.5px; font-weight: 800; border-radius: 3px; padding: 1px 3px; outline: none; cursor: pointer;">
                                    <option value="24" selected>24 fps (Cinema)</option>
                                    <option value="23.976">23.98 fps (Film NTSC)</option>
                                    <option value="25">25 fps (PAL / Europe)</option>
                                    <option value="29.97">29.97 fps (NTSC)</option>
                                    <option value="30">30 fps (Broadcast)</option>
                                </select>
                            </div>

                            <!-- Musical BPM Tempo & Audible Metronome Toggle -->
                            <div style="height: 32px; box-sizing: border-box; background: #000000; border: 1px solid rgba(255,255,255,0.18); border-radius: 6px; padding: 0 6px; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;">
                                <span style="font-size: 9px; font-weight: 800; color: rgba(255,255,255,0.6); text-transform: uppercase;">BPM</span>
                                <input type="number" id="daw-bpm-input" min="20" max="300" step="1" value="120" title="Project Tempo in Beats Per Minute (20 - 300 BPM)" style="width: 44px; height: 20px; box-sizing: border-box; background: #090d16; border: 1px solid rgba(255,255,255,0.2); color: #34d399; font-size: 11px; font-weight: 800; font-family: monospace; border-radius: 3px; text-align: center; outline: none;">
                                <button id="timeline-metronome-btn" title="Toggle Audible Metronome Click Track (K) during playback &amp; recording" style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.16); color: rgba(255, 255, 255, 0.7); font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 3px; cursor: pointer; display: inline-flex; align-items: center; gap: 3px; transition: all 0.15s;">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                                    <span id="timeline-metronome-label">CLICK: OFF</span>
                                </button>
                            </div>

                            <!-- Rewind Button -->
                            <button id="timeline-rewind-btn" title="Rewind to 00:00" style="height: 32px; width: 32px; box-sizing: border-box; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.16); color: #ffffff; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.15s;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polygon points="11 19 2 12 11 5 11 19"/><polygon points="22 19 13 12 22 5 22 19"/></svg>
                            </button>

                            <!-- Play / Pause Button -->
                            <button id="timeline-play-btn" title="Play / Pause Audio Tracks in Real Time (Spacebar)" style="height: 32px; box-sizing: border-box; background: #ffffff; color: #06070a; border: none; padding: 0 14px; border-radius: 6px; font-size: 12px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0; white-space: nowrap; transition: transform 0.1s, opacity 0.15s;">
                                <svg id="timeline-play-btn-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                <span id="timeline-play-btn-text">Play</span>
                            </button>

                            <!-- Stop Button -->
                            <button id="timeline-stop-btn" title="Stop Playback &amp; Recording" style="height: 32px; width: 32px; box-sizing: border-box; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.16); color: #ffffff; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.15s;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12"/></svg>
                            </button>

                            <!-- Studio Record / Overdub Button -->
                            <button id="timeline-record-btn" title="Record Voice-Over / Overdub onto Selected Track with Simultaneous Playback (R)" style="height: 32px; box-sizing: border-box; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.45); color: #f87171; padding: 0 12px; border-radius: 6px; font-size: 12px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0; white-space: nowrap; transition: all 0.2s;">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="10"/></svg>
                                <span id="timeline-record-btn-text">Record</span>
                            </button>

                            <!-- Cycle / Loop Button -->
                            <button id="timeline-loop-btn" title="Toggle Cycle / Loop Playback (L)" style="height: 32px; width: 32px; box-sizing: border-box; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.16); color: #ffffff; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                            </button>

                            <!-- Master Output Peak VU Meter & LUFS Integrated Badge -->
                            <div id="daw-master-vu-container" title="Master Output Peak Level (dBFS) &amp; Integrated Loudness (LUFS)" style="height: 32px; width: 110px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; gap: 2px; background: rgba(0,0,0,0.65); border: 1px solid rgba(255,255,255,0.18); border-radius: 6px; padding: 2px 6px; flex-shrink: 0;">
                                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 7.5px; font-family: monospace; color: rgba(255,255,255,0.6); line-height: 1;">
                                    <span>OUT <span id="daw-master-vu-db">-48dB</span></span>
                                    <span id="daw-master-lufs-badge" style="color: #38bdf8; font-weight: 700;">-∞ LUFS</span>
                                </div>
                                <div style="width: 100%; height: 5px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; position: relative;">
                                    <div id="daw-master-vu-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #10b981 0%, #10b981 65%, #eab308 85%, #ef4444 100%); transition: width 0.05s ease-out;"></div>
                                </div>
                            </div>

                            <!-- Master Output Volume Fader -->
                            <div style="height: 32px; box-sizing: border-box; display: flex; align-items: center; gap: 4px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.16); border-radius: 6px; padding: 0 6px; flex-shrink: 0;" title="Master Output Volume">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                                <input type="range" id="daw-master-vol-slider" min="0" max="1.5" step="0.05" value="1.0" style="width: 38px; height: 4px; accent-color: #10b981; cursor: pointer;">
                                <span id="daw-master-vol-readout" style="font-size: 9px; font-family: monospace; color: rgba(255,255,255,0.7); width: 24px; text-align: right;">100%</span>
                            </div>
                        </div>

                        <!-- Right Primary Action & Close Button (Uniform 32px height, monochrome stroke icons) -->
                        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0; margin-left: auto;">
                            <!-- Live Presenter & Co-Host Studio CTA -->
                            <button id="timeline-open-studio-btn" title="Open Presenter Live Recording Studio &amp; Remote Co-Host Room" style="height: 32px; box-sizing: border-box; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171; padding: 0 11px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; flex-shrink: 0; transition: all 0.15s;" onmouseover="this.style.background='rgba(239, 68, 68, 0.22)';" onmouseout="this.style.background='rgba(239, 68, 68, 0.12)';">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                                Co-Host Studio
                            </button>
                            <!-- Fresh DAW Recording Session Button -->
                            <button id="timeline-fresh-session-btn" title="Start a Fresh Clean Timeline Project for New Recording" style="height: 32px; box-sizing: border-box; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.16); color: #ffffff; padding: 0 11px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; flex-shrink: 0; transition: all 0.15s;" onmouseover="this.style.background='rgba(255, 255, 255, 0.14)';" onmouseout="this.style.background='rgba(255, 255, 255, 0.08)';">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                                New Recording
                            </button>
                            <!-- Render Master Mix CTA -->
                            <button id="timeline-render-btn" title="Render all tracks, keyframe curves and trims into a Master Mix" style="height: 32px; box-sizing: border-box; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; border: 1px solid rgba(16,185,129,0.5); padding: 0 13px; border-radius: 6px; font-size: 11px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 0 14px rgba(16,185,129,0.3); white-space: nowrap; flex-shrink: 0; transition: opacity 0.15s;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                                Render Mix
                            </button>
                            <!-- Fullscreen Canvas Toggle Button (100% Display Real Estate) -->
                            <button id="daw-fullscreen-btn" title="Toggle Fullscreen DAW Studio (Maximise Screen Estate)" style="height: 32px; width: 32px; box-sizing: border-box; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255,255,255,0.16); color: #ffffff; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s;" onmouseover="this.style.background='rgba(56, 189, 248, 0.2)'; this.style.borderColor='#38bdf8';" onmouseout="this.style.background='rgba(255, 255, 255, 0.08)'; this.style.borderColor='rgba(255,255,255,0.16)';">
                                <svg id="daw-fullscreen-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                            </button>
                            <!-- Close Modal Button -->
                            <button id="podcast-editor-close-btn" title="Close Studio DAW (Esc)" style="height: 32px; width: 32px; box-sizing: border-box; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255,255,255,0.16); color: #ffffff; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.15s;" onmouseover="this.style.background='rgba(239, 68, 68, 0.2)'; this.style.borderColor='#ef4444';" onmouseout="this.style.background='rgba(255, 255, 255, 0.08)'; this.style.borderColor='rgba(255,255,255,0.16)';">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                    </div>

                    <!-- Secondary Control Deck (Tier 2: Clip Tools, Voice-Over Audio Input, Snapping & Zoom) -->
                    <div style="background: #070910; border-bottom: 1px solid rgba(255,255,255,0.08); padding: 5px 14px; display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-shrink: 0; overflow-x: auto; scrollbar-width: none;">
                        <!-- Left: Clip Editing Actions (All Strictly 28px Height, white-space: nowrap) -->
                        <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                            <button id="timeline-undo-btn" title="Undo Last Action (Ctrl+Z / Cmd+Z)" disabled style="height: 28px; box-sizing: border-box; background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.16); color: #ffffff; padding: 0 8px; border-radius: 5px; font-size: 11px; font-weight: 700; cursor: not-allowed; opacity: 0.45; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; transition: all 0.15s;">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
                                Undo
                            </button>

                            <button id="timeline-redo-btn" title="Redo Action (Ctrl+Y / Cmd+Shift+Z)" disabled style="height: 28px; box-sizing: border-box; background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.16); color: #ffffff; padding: 0 8px; border-radius: 5px; font-size: 11px; font-weight: 700; cursor: not-allowed; opacity: 0.45; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; transition: all 0.15s;">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>
                                Redo
                            </button>

                            <div style="width: 1px; height: 16px; background: rgba(255,255,255,0.12); margin: 0 2px;"></div>

                            <button id="timeline-cut-btn" title="Split Selected Clip at Playhead (S or B)" style="height: 28px; box-sizing: border-box; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.18); color: #ffffff; padding: 0 9px; border-radius: 5px; font-size: 11px; font-weight: 750; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; transition: background 0.15s;">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>
                                Split Clip
                            </button>

                            <button id="timeline-edit-btn" title="Inspect, Rename, Color &amp; Tag Selected Clip (or Double-Click Clip)" style="height: 28px; box-sizing: border-box; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.18); color: #ffffff; padding: 0 9px; border-radius: 5px; font-size: 11px; font-weight: 750; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; transition: background 0.15s;">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                Edit Clip
                            </button>

                            <button id="timeline-delete-btn" title="Delete Selected Clip(s) (Delete / Backspace)" style="height: 28px; box-sizing: border-box; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; padding: 0 8px; border-radius: 5px; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; transition: background 0.15s;">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                Delete
                            </button>

                            <div style="width: 1px; height: 16px; background: rgba(255,255,255,0.12); margin: 0 2px;"></div>

                            <!-- Punch Region In / Out Locator Buttons -->
                            <button id="timeline-punch-in-btn" title="Set Punch-In Region Start at Playhead (I)" style="height: 28px; box-sizing: border-box; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.35); color: #38bdf8; padding: 0 7px; border-radius: 5px; font-size: 11px; font-weight: 750; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; transition: all 0.15s;">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="15 18 9 12 15 6"/><line x1="19" y1="6" x2="19" y2="18"/></svg>
                                In [I]
                            </button>
                            <button id="timeline-punch-out-btn" title="Set Punch-Out Region End at Playhead (O)" style="height: 28px; box-sizing: border-box; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.35); color: #38bdf8; padding: 0 7px; border-radius: 5px; font-size: 11px; font-weight: 750; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; transition: all 0.15s;">
                                Out [O]
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="9 18 15 12 9 6"/><line x1="5" y1="6" x2="5" y2="18"/></svg>
                            </button>
                            <button id="timeline-punch-clear-btn" title="Clear Punch / Cycle Selection Region" style="height: 28px; box-sizing: border-box; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.15); color: rgba(255,255,255,0.7); padding: 0 6px; border-radius: 5px; font-size: 10.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; transition: all 0.15s;">
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                Clear
                            </button>

                            <div style="width: 1px; height: 16px; background: rgba(255,255,255,0.12); margin: 0 2px;"></div>

                            <!-- Film Marker Tool Button -->
                            <button id="timeline-add-marker-btn" title="Drop Scene / Cue Marker at Playhead (M)" style="height: 28px; box-sizing: border-box; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.35); color: #fbbf24; padding: 0 8px; border-radius: 5px; font-size: 11px; font-weight: 750; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; transition: background 0.15s;">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                + Marker
                            </button>

                            <!-- Video Track Preview Toggle Button -->
                            <button id="timeline-video-toggle-btn" title="Toggle Motion Picture Video Track Preview Monitor (V)" style="height: 28px; box-sizing: border-box; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.35); color: #38bdf8; padding: 0 8px; border-radius: 5px; font-size: 11px; font-weight: 750; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; transition: background 0.15s;">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
                                Video
                            </button>

                            <!-- ADR Cue & Teleprompter Toggle Button -->
                            <button id="timeline-adr-toggle-btn" title="Toggle ADR Dialogue Cue &amp; 3-Beep Teleprompter System" style="height: 28px; box-sizing: border-box; background: rgba(168, 85, 247, 0.12); border: 1px solid rgba(168, 85, 247, 0.35); color: #c084fc; padding: 0 8px; border-radius: 5px; font-size: 11px; font-weight: 750; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; transition: background 0.15s;">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
                                ADR Booth
                            </button>
                        </div>

                        <!-- Center: Voice-Over / Mic Input & Target Track Selector (Strictly 28px Height) -->
                        <div style="display: flex; align-items: center; gap: 6px; background: rgba(0,0,0,0.55); border: 1px solid rgba(255,255,255,0.12); border-radius: 5px; padding: 0 7px; height: 28px; box-sizing: border-box; flex-shrink: 0;" title="Select Microphone and Destination Track for Overdub Recording">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                            <select id="daw-record-mic-select" title="Microphone Input Device" style="background: none; border: none; color: #ffffff; font-size: 11px; font-weight: 600; cursor: pointer; outline: none; max-width: 125px; text-overflow: ellipsis; white-space: nowrap;">
                                <option value="">Detecting Mic...</option>
                            </select>

                            <div style="width: 1px; height: 14px; background: rgba(255,255,255,0.15);"></div>

                            <span style="font-size: 9.5px; font-weight: 800; color: rgba(255,255,255,0.5); letter-spacing: 0.5px;">INTO:</span>
                            <select id="daw-record-track-select" title="Target Destination Track (or Auto-Create New Track)" style="background: none; border: none; color: #38bdf8; font-size: 11px; font-weight: 750; cursor: pointer; outline: none; max-width: 140px; text-overflow: ellipsis; white-space: nowrap;">
                                <option value="__new__">✨ + New Track (Auto)</option>
                                <option value="host">Presenter (Host)</option>
                            </select>

                            <!-- Live Mini Mic Level Meter -->
                            <div id="daw-rec-mic-level-container" title="Microphone Input Activity" style="width: 26px; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; display: flex; align-items: center; flex-shrink: 0;">
                                <div id="daw-rec-mic-level-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #10b981 0%, #34d399 70%, #ef4444 100%); transition: width 0.05s ease-out;"></div>
                            </div>
                        </div>

                        <!-- Right: Snapping, Scrubbing Audio Toggle, Heights & Zoom Controls (All Strictly 28px Height, white-space: nowrap) -->
                        <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                            <!-- Audio Scrubbing Toggle Button -->
                            <button id="timeline-scrub-toggle-btn" title="Toggle Audible Playhead Scrubbing (Listen while dragging playhead)" style="height: 28px; box-sizing: border-box; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #34d399; padding: 0 8px; border-radius: 5px; font-size: 11px; font-weight: 750; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; transition: all 0.15s;">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                                <span id="timeline-scrub-label">Scrub: ON</span>
                            </button>

                            <!-- Magnetic Snap Button -->
                            <button id="timeline-snap-btn" title="Toggle Magnetic Snapping (Grid &amp; Clip Edges)" style="height: 28px; box-sizing: border-box; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); color: #38bdf8; padding: 0 8px; border-radius: 5px; font-size: 11px; font-weight: 750; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; transition: all 0.15s;">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="3" x2="8" y2="3"/><line x1="16" y1="3" x2="20" y2="3"/></svg>
                                <span id="timeline-snap-label">Snap: All</span>
                            </button>

                            <!-- Ripple Edit Mode Toggle Button -->
                            <button id="timeline-ripple-toggle-btn" title="Toggle Ripple Editing Mode (Automatically shifts subsequent clips to close gaps on delete/cut)" style="height: 28px; box-sizing: border-box; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.16); color: rgba(255, 255, 255, 0.75); padding: 0 8px; border-radius: 5px; font-size: 11px; font-weight: 750; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; transition: all 0.15s;">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M11 17l-5-5 5-5"/><path d="M18 17l-5-5 5-5"/></svg>
                                <span id="timeline-ripple-label">Ripple: OFF</span>
                            </button>

                            <!-- Track Height Expander -->
                            <button id="timeline-track-height-btn" title="Cycle Track Height (Compact 56px / Normal 74px / Expanded 110px / Giant 160px)" style="height: 28px; box-sizing: border-box; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.16); color: #ffffff; padding: 0 8px; border-radius: 5px; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; transition: all 0.15s;">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="7 15 12 20 17 15"/><polyline points="7 9 12 4 17 9"/></svg>
                                <span id="timeline-track-height-label">74px</span>
                            </button>

                            <!-- Waveform Amplitude Zoom -->
                            <button id="timeline-wave-gain-btn" title="Visual Waveform Amplitude Zoom (1x, 1.5x, 2x, 3x)" style="height: 28px; box-sizing: border-box; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.16); color: #ffffff; padding: 0 8px; border-radius: 5px; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; transition: all 0.15s;">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 12h2l3-6 4 12 3-8 2 4 2-2h4"/></svg>
                                <span id="timeline-wave-gain-label">1x</span>
                            </button>

                            <!-- Horizontal Zoom Control -->
                            <div style="height: 28px; box-sizing: border-box; display: inline-flex; align-items: center; gap: 2px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.16); border-radius: 5px; padding: 0 5px; white-space: nowrap;">
                                <button id="timeline-zoom-out-btn" title="Zoom Out (-)" style="background: none; border: none; color: #fff; cursor: pointer; font-size: 12px; font-weight: 800; padding: 0 4px; line-height: 1;">−</button>
                                <span id="timeline-zoom-badge" style="font-size: 10px; color: rgba(255,255,255,0.7); font-family: monospace;">100%</span>
                                <button id="timeline-zoom-in-btn" title="Zoom In (+)" style="background: none; border: none; color: #fff; cursor: pointer; font-size: 12px; font-weight: 800; padding: 0 4px; line-height: 1;">+</button>
                            </div>
                        </div>
                    </div>


                    <!-- DAW Workspace (Split Pane: Left Track Controls, Right Scrollable Timeline Lanes) -->
                    <div class="daw-workspace-container" style="flex: 1; display: flex; min-height: 380px; max-height: calc(92vh - 120px); overflow: hidden; position: relative;">
                        <!-- Left Fixed Track Headers -->
                        <div id="daw-track-headers-sidebar" style="width: 240px; flex-shrink: 0; background: #0c0e15; border-right: 1px solid rgba(255,255,255,0.12); display: flex; flex-direction: column; z-index: 10; transition: width 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
                            <!-- Ruler Spacer Header (Exact 36px Height match) -->
                            <div style="height: 36px; border-bottom: 2px solid rgba(56,189,248,0.35); display: flex; align-items: center; justify-content: space-between; padding: 0 12px; font-size: 10px; font-weight: 800; color: rgba(255,255,255,0.6); text-transform: uppercase; background: #0c1017; box-sizing: border-box;">
                                <span style="display: flex; align-items: center; gap: 5px;">
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
                                    Tracks &amp; Mix
                                </span>
                                <span id="daw-track-count-badge" style="background: rgba(56,189,248,0.15); border: 1px solid rgba(56,189,248,0.3); padding: 1px 6px; border-radius: 4px; color: #38bdf8; font-size: 9px; font-family: monospace;">5 Tracks</span>
                            </div>
                            <!-- Dynamic Track Headers Container -->
                            <div id="daw-track-headers-container" style="flex: 1; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column;"></div>
                            <!-- Bottom Actions: Add Audio & Music/SFX Tracks -->
                            <div style="padding: 8px 10px; border-top: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.35); display: flex; flex-direction: column; gap: 6px;">
                                <button id="daw-add-audio-track-btn" style="background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.3); color: #34d399; font-size: 10.5px; font-weight: 700; padding: 5px 8px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 5px; justify-content: center; transition: all 0.15s;">
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                    Add Audio Track
                                </button>
                                <button id="daw-add-music-track-btn" style="background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.3); color: #fbbf24; font-size: 10.5px; font-weight: 700; padding: 5px 8px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 5px; justify-content: center; transition: all 0.15s;">
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                    Add Music / SFX Track
                                </button>
                            </div>
                        </div>

                        <!-- Right Horizontally Scrollable Lanes Viewport -->
                        <div id="timeline-scroll-viewport" style="flex: 1; overflow-x: auto; overflow-y: auto; position: relative; background: #06070a; cursor: text;">
                            <!-- Time Ruler Header (Studio Standard Timeline with High-Contrast Ticks) -->
                            <div id="timeline-ruler" style="height: 36px; border-bottom: 2px solid rgba(56,189,248,0.35); position: sticky; top: 0; background: linear-gradient(180deg, #111622 0%, #0a0d14 100%); min-width: 1400px; cursor: pointer; user-select: none; z-index: 45; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.5);"></div>

                            <!-- Lanes Container -->
                            <div id="timeline-lanes-container" style="position: relative; min-width: 1400px;">
                                <!-- Punch In/Out Cycle Region Shading Overlay across all lanes -->
                                <div id="daw-punch-region-overlay" style="position: absolute; top: 0; bottom: 0; left: 0; width: 0; background: rgba(56, 189, 248, 0.08); border-left: 2px solid #38bdf8; border-right: 2px solid #38bdf8; z-index: 22; display: none; pointer-events: none; box-shadow: inset 0 0 20px rgba(56,189,248,0.15);"></div>

                                <!-- Magnetic Snap Guideline -->
                                <div id="timeline-snap-guide" style="position: absolute; top: 0; bottom: 0; width: 1.5px; background: #38bdf8; box-shadow: 0 0 10px #38bdf8; z-index: 48; display: none; pointer-events: none;"></div>

                                <!-- Vertical Playhead Needle Line spanning all track lanes -->
                                <div id="timeline-playhead" style="position: absolute; top: 0; bottom: 0; left: 0; width: 2px; background: #ef4444; z-index: 55; pointer-events: none; transform: translateX(0px); box-shadow: 0 0 10px rgba(239, 68, 68, 0.9);">
                                    <div style="position: absolute; top: 0; left: -4px; width: 10px; height: 10px; border-radius: 50%; background: #ef4444; box-shadow: 0 0 8px #ef4444;"></div>
                                </div>

                                <!-- Dynamically Rendered Track Lanes Container -->
                                <div id="daw-track-lanes-container" style="display: flex; flex-direction: column;"></div>
                            </div>
                        </div>

                        <!-- FILM SOUND DESIGN: Floating Draggable Motion Picture Sync Monitor -->
                        <div id="daw-video-preview-window" style="position: absolute; bottom: 16px; right: 20px; width: 340px; background: #070911; border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 12px; z-index: 110; display: none; flex-direction: column; overflow: hidden; box-shadow: 0 16px 40px rgba(0,0,0,0.95), 0 0 20px rgba(56, 189, 248, 0.2);">
                            <!-- Video Header Bar (Draggable) -->
                            <div id="daw-video-preview-header" style="padding: 6px 10px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: space-between; cursor: move; user-select: none;">
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <span style="background: rgba(56, 189, 248, 0.18); border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8; font-size: 8.5px; font-weight: 800; padding: 1px 4px; border-radius: 3px; text-transform: uppercase;">VIDEO SYNC</span>
                                    <span id="daw-video-title-label" style="font-size: 11px; font-weight: 800; color: #ffffff; white-space: nowrap; max-width: 140px; overflow: hidden; text-overflow: ellipsis;">Picture Track</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 4px;">
                                    <span id="daw-video-fps-badge" style="font-size: 9px; font-family: monospace; color: #38bdf8; background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.3); padding: 1px 4px; border-radius: 3px;">24 FPS</span>
                                    <button id="daw-video-close-btn" title="Hide Video Preview" style="background: none; border: none; color: rgba(255,255,255,0.5); font-size: 14px; font-weight: 800; cursor: pointer; line-height: 1; padding: 0 4px;">&times;</button>
                                </div>
                            </div>
                            <!-- Video Player Canvas / Element Container -->
                            <div style="position: relative; width: 100%; aspect-ratio: 16/9; background: #000000; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                                <video id="daw-video-element" style="width: 100%; height: 100%; object-fit: contain; pointer-events: none;" preload="auto" playsinline></video>
                                <!-- On-Screen SMPTE Timecode Burn-In Overlay -->
                                <div id="daw-video-tc-overlay" style="position: absolute; bottom: 8px; right: 10px; background: rgba(0,0,0,0.75); border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 4px; padding: 2px 7px; font-family: monospace; font-size: 11px; font-weight: 900; color: #38bdf8; letter-spacing: 0.5px; pointer-events: none; text-shadow: 0 0 6px rgba(0,0,0,0.9);">
                                    00:00:00:00
                                </div>
                            </div>
                            <!-- Video Quick Shuttling Controls -->
                            <div style="padding: 5px 8px; background: rgba(0,0,0,0.5); border-top: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between; font-size: 10px;">
                                <div style="display: flex; align-items: center; gap: 4px;">
                                    <button id="daw-video-prev-frame-btn" title="Step Back 1 Frame (Left Arrow)" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #ffffff; padding: 2px 6px; border-radius: 4px; cursor: pointer;">◀ -1F</button>
                                    <button id="daw-video-next-frame-btn" title="Step Forward 1 Frame (Right Arrow)" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #ffffff; padding: 2px 6px; border-radius: 4px; cursor: pointer;">+1F ▶</button>
                                </div>
                                <label for="daw-video-import-input" style="background: rgba(56,189,248,0.12); border: 1px solid rgba(56,189,248,0.3); color: #38bdf8; padding: 2px 8px; border-radius: 4px; cursor: pointer; font-weight: 700;">
                                    Choose MP4/WebM...
                                </label>
                            </div>
                        </div>

                        <!-- FILM ADR TELEPROMPTER & CUE STREAMER HUD -->
                        <div id="daw-adr-hud-container" style="position: absolute; top: 12px; left: 260px; right: 24px; max-width: 680px; margin: 0 auto; background: rgba(7, 10, 18, 0.92); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 10px; padding: 8px 14px; z-index: 105; display: none; flex-direction: column; gap: 6px; box-shadow: 0 12px 32px rgba(0,0,0,0.9), 0 0 16px rgba(245, 158, 11, 0.15); backdrop-filter: blur(12px);">
                            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                                <div style="display: flex; align-items: center; gap: 7px;">
                                    <span style="background: rgba(245, 158, 11, 0.2); border: 1px solid rgba(245, 158, 11, 0.4); color: #fbbf24; font-size: 9px; font-weight: 900; padding: 1px 5px; border-radius: 3px; text-transform: uppercase;">ADR CUE</span>
                                    <span id="daw-adr-countdown-badge" style="font-size: 10.5px; font-weight: 900; font-family: monospace; padding: 1px 7px; border-radius: 4px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: #ffffff;">STANDBY</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <button id="daw-adr-toggle-beeps-btn" title="Toggle 3-Beep Audio Countdown" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #34d399; font-size: 9.5px; font-weight: 700; padding: 2px 7px; border-radius: 4px; cursor: pointer;">Beeps: ON</button>
                                    <button id="daw-adr-edit-prompt-btn" title="Edit Script Line" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #ffffff; font-size: 9.5px; font-weight: 700; padding: 2px 7px; border-radius: 4px; cursor: pointer;">Edit Script</button>
                                    <button id="daw-adr-close-hud-btn" style="background: none; border: none; color: rgba(255,255,255,0.5); font-size: 14px; font-weight: 800; cursor: pointer; line-height: 1; padding: 0 4px;">&times;</button>
                                </div>
                            </div>
                            <!-- Dialogue Prompt Text -->
                            <div id="daw-adr-prompt-text" style="font-size: 13.5px; font-weight: 800; color: #ffffff; text-align: center; text-shadow: 0 1px 4px rgba(0,0,0,0.9); line-height: 1.4; padding: 2px 4px;">
                                "Listen to me Alan, the camera is rolling and we need the line now!"
                            </div>
                            <!-- Streamer Progress Bar -->
                            <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; position: relative;">
                                <div id="daw-adr-streamer-bar" style="width: 0%; height: 100%; background: #f59e0b; transition: width 0.05s linear;"></div>
                            </div>
                        </div>

                    </div>

                    <!-- Clip Inspector / Properties Floating Window (Compact & Non-Blocking) -->
                    <div id="daw-clip-properties-modal" style="position: absolute; top: 76px; left: 24px; width: 440px; max-width: calc(100% - 48px); background: #080a12; border: 1px solid rgba(52, 211, 153, 0.4); border-radius: 12px; z-index: 125; display: none; flex-direction: column; overflow: hidden; box-shadow: 0 16px 48px rgba(0,0,0,0.95), 0 0 20px rgba(52, 211, 153, 0.15);">
                        <!-- Clip Modal Header (Draggable) -->
                        <div id="daw-clip-modal-header" style="padding: 6px 12px; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: space-between; cursor: move; user-select: none;">
                            <div style="display: flex; align-items: center; gap: 7px;">
                                <span style="background: rgba(52, 211, 153, 0.18); border: 1px solid rgba(52, 211, 153, 0.4); color: #34d399; font-size: 9px; font-weight: 800; padding: 1px 5px; border-radius: 3px; text-transform: uppercase;">CLIP</span>
                                <h4 style="font-size: 11.5px; font-weight: 800; color: #ffffff; margin: 0; white-space: nowrap;">Clip Inspector &amp; Properties</h4>
                            </div>
                            <button id="daw-clip-modal-close-btn" title="Close Clip Inspector (Esc)" style="background: none; border: none; color: rgba(255,255,255,0.55); font-size: 15px; font-weight: 800; cursor: pointer; line-height: 1; padding: 0 4px;">&times;</button>
                        </div>
                        <div style="padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; max-height: calc(100vh - 180px); overflow-y: auto; scrollbar-width: thin;">
                            <!-- Clip Label / Name -->
                            <div>
                                <label style="display: block; font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: rgba(255,255,255,0.6); margin-bottom: 4px;">Clip Label / Take Name</label>
                                <input id="daw-edit-clip-name" type="text" style="width: 100%; box-sizing: border-box; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.18); border-radius: 6px; padding: 6px 10px; color: #ffffff; font-size: 12px; font-weight: 600; outline: none;">
                            </div>
                            <!-- Track Assignment & Start Offset Grid -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                <div>
                                    <label style="display: block; font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: rgba(255,255,255,0.6); margin-bottom: 4px;">Track Assignment</label>
                                    <select id="daw-edit-clip-track" style="width: 100%; box-sizing: border-box; background: #161b26; border: 1px solid rgba(255,255,255,0.18); border-radius: 6px; padding: 6px 8px; color: #ffffff; font-size: 11px; font-weight: 600; outline: none;"></select>
                                </div>
                                <div>
                                    <label style="display: block; font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: rgba(255,255,255,0.6); margin-bottom: 4px;">Start Offset (Seconds)</label>
                                    <input id="daw-edit-clip-start" type="number" step="0.1" min="0" style="width: 100%; box-sizing: border-box; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.18); border-radius: 6px; padding: 6px 10px; color: #ffffff; font-size: 11px; font-weight: 600; outline: none;">
                                </div>
                            </div>
                            <!-- Clip Gain Envelope & 1-Click Peak Normalization -->
                            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <label style="font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: rgba(255,255,255,0.6); margin: 0;">Clip Gain &amp; Level Envelope</label>
                                    <button type="button" id="daw-edit-clip-normalize-btn" title="Normalize audio buffer peak to 0 dBFS (100% full scale)" style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #34d399; font-size: 9px; font-weight: 800; padding: 2px 7px; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.15s;">
                                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                                        Normalize Peak (0 dBFS)
                                    </button>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <input type="range" id="daw-edit-clip-gain-slider" min="0" max="2.0" step="0.02" value="1.0" style="flex: 1; accent-color: #34d399; cursor: pointer;">
                                    <span id="daw-edit-clip-gain-readout" style="font-size: 10.5px; font-family: monospace; font-weight: 800; color: #34d399; min-width: 42px; text-align: right;">1.00x</span>
                                </div>
                            </div>
                            <!-- Semantic Tag Chip Selection -->
                            <div>
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                    <label style="font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: rgba(255,255,255,0.6); margin: 0;">Semantic Clip Tag</label>
                                    <span style="font-size: 8.5px; color: rgba(255,255,255,0.4);">Click chip or type</span>
                                </div>
                                <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 5px;" id="daw-tag-chips-container">
                                    <span class="daw-tag-chip" data-tag="Vocal" style="font-size: 9px; font-weight: 700; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #34d399; padding: 2px 6px; border-radius: 4px; cursor: pointer;">Vocal</span>
                                    <span class="daw-tag-chip" data-tag="Interview" style="font-size: 9px; font-weight: 700; background: rgba(6,182,212,0.15); border: 1px solid rgba(6,182,212,0.3); color: #22d3ee; padding: 2px 6px; border-radius: 4px; cursor: pointer;">Interview</span>
                                    <span class="daw-tag-chip" data-tag="Intro Bumper" style="font-size: 9px; font-weight: 700; background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.3); color: #fbbf24; padding: 2px 6px; border-radius: 4px; cursor: pointer;">Intro Bumper</span>
                                    <span class="daw-tag-chip" data-tag="Outro Bumper" style="font-size: 9px; font-weight: 700; background: rgba(244,63,94,0.15); border: 1px solid rgba(244,63,94,0.3); color: #fb7185; padding: 2px 6px; border-radius: 4px; cursor: pointer;">Outro Bumper</span>
                                    <span class="daw-tag-chip" data-tag="Music Bed" style="font-size: 9px; font-weight: 700; background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.3); color: #c084fc; padding: 2px 6px; border-radius: 4px; cursor: pointer;">Music Bed</span>
                                    <span class="daw-tag-chip" data-tag="Punchline" style="font-size: 9px; font-weight: 700; background: rgba(236,72,153,0.15); border: 1px solid rgba(236,72,153,0.3); color: #f472b6; padding: 2px 6px; border-radius: 4px; cursor: pointer;">Punchline</span>
                                    <span class="daw-tag-chip" data-tag="Clean Cut" style="font-size: 9px; font-weight: 700; background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.3); color: #60a5fa; padding: 2px 6px; border-radius: 4px; cursor: pointer;">Clean Cut</span>
                                    <span class="daw-tag-chip" data-tag="SFX" style="font-size: 9px; font-weight: 700; background: rgba(100,116,139,0.2); border: 1px solid rgba(100,116,139,0.35); color: #94a3b8; padding: 2px 6px; border-radius: 4px; cursor: pointer;">SFX</span>
                                </div>
                                <input id="daw-edit-clip-tag" type="text" placeholder="e.g. Vocal, Part 2, Punchline" style="width: 100%; box-sizing: border-box; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.18); border-radius: 6px; padding: 5px 8px; color: #ffffff; font-size: 11px; outline: none;">
                            </div>
                            <!-- Radiant Color Swatches -->
                            <div>
                                <label style="display: block; font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: rgba(255,255,255,0.6); margin-bottom: 5px;">Clip Theme Color</label>
                                <div id="daw-color-palette" style="display: flex; gap: 6px; flex-wrap: wrap;">
                                    <button type="button" class="daw-color-swatch" data-color="#10b981" title="Emerald Green" style="width: 24px; height: 24px; border-radius: 5px; background: #10b981; border: 2px solid transparent; cursor: pointer;"></button>
                                    <button type="button" class="daw-color-swatch" data-color="#06b6d4" title="Sky Cyan" style="width: 24px; height: 24px; border-radius: 5px; background: #06b6d4; border: 2px solid transparent; cursor: pointer;"></button>
                                    <button type="button" class="daw-color-swatch" data-color="#8b5cf6" title="Royal Violet" style="width: 24px; height: 24px; border-radius: 5px; background: #8b5cf6; border: 2px solid transparent; cursor: pointer;"></button>
                                    <button type="button" class="daw-color-swatch" data-color="#f59e0b" title="Sunset Amber" style="width: 24px; height: 24px; border-radius: 5px; background: #f59e0b; border: 2px solid transparent; cursor: pointer;"></button>
                                    <button type="button" class="daw-color-swatch" data-color="#f43f5e" title="Rose Crimson" style="width: 24px; height: 24px; border-radius: 5px; background: #f43f5e; border: 2px solid transparent; cursor: pointer;"></button>
                                    <button type="button" class="daw-color-swatch" data-color="#ec4899" title="Electric Pink" style="width: 24px; height: 24px; border-radius: 5px; background: #ec4899; border: 2px solid transparent; cursor: pointer;"></button>
                                    <button type="button" class="daw-color-swatch" data-color="#3b82f6" title="Sapphire Blue" style="width: 24px; height: 24px; border-radius: 5px; background: #3b82f6; border: 2px solid transparent; cursor: pointer;"></button>
                                    <button type="button" class="daw-color-swatch" data-color="#64748b" title="Slate Graphite" style="width: 24px; height: 24px; border-radius: 5px; background: #64748b; border: 2px solid transparent; cursor: pointer;"></button>
                                </div>
                            </div>
                        </div>
                        <div style="padding: 10px 14px; border-top: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: space-between;">
                            <button id="daw-clip-modal-cancel-btn" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 5px 12px; border-radius: 5px; font-size: 11px; font-weight: 700; cursor: pointer;">Cancel</button>
                            <button id="daw-clip-modal-save-btn" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: none; color: #fff; padding: 5px 16px; border-radius: 5px; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 5px; box-shadow: 0 0 10px rgba(16,185,129,0.35);">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                                Save Properties
                            </button>
                        </div>
                    </div>

                    <!-- Track Open-Source Web Audio FX Plugins Rack Floating Window (Compact & Non-Intrusive) -->
                    <!-- Track Open-Source Web Audio FX Plugins Rack Floating Window (Compact & Non-Intrusive) -->
                    <div id="daw-track-fx-modal" style="position: absolute; top: 76px; right: 18px; width: 450px; max-width: calc(100% - 36px); max-height: calc(100% - 90px); background: #080a12; border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 12px; z-index: 120; display: none; flex-direction: column; overflow: hidden; box-shadow: 0 16px 48px rgba(0,0,0,0.95), 0 0 20px rgba(56, 189, 248, 0.15);">
                        <!-- FX Header (Compact 34px) -->
                        <div id="daw-track-fx-header" style="padding: 6px 12px; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: space-between; cursor: move; user-select: none;">
                            <div style="display: flex; align-items: center; gap: 7px;">
                                <span style="background: rgba(56, 189, 248, 0.18); border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8; font-size: 9px; font-weight: 800; padding: 1px 5px; border-radius: 3px; text-transform: uppercase;">DSP RACK</span>
                                <h4 id="daw-fx-track-title" style="margin: 0; font-size: 11.5px; font-weight: 800; color: #ffffff; white-space: nowrap; max-width: 150px; overflow: hidden; text-overflow: ellipsis;">Track Plugins</h4>
                            </div>
                            <!-- Live DSP Stereo Mini VU Meter -->
                            <div id="daw-dsp-vu-meter-bar" style="display: flex; align-items: center; gap: 4px; background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; padding: 2px 6px;" title="Live DSP Audition Peak Meter">
                                <span style="font-size: 8px; font-family: monospace; color: rgba(255,255,255,0.5);">DSP</span>
                                <div style="width: 44px; height: 5px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
                                    <div id="daw-dsp-vu-fill" style="width: 0%; height: 100%; background: linear-gradient(90deg, #10b981 0%, #38bdf8 70%, #ef4444 100%); transition: width 0.05s ease-out;"></div>
                                </div>
                                <span id="daw-dsp-vu-db" style="font-size: 8px; font-family: monospace; color: #38bdf8; min-width: 28px; text-align: right;">-∞dB</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 3px;">
                                <button class="daw-fx-preset-btn" data-preset="la2a" title="Vintage LA-2A Optical Leveler" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #fbbf24; font-size: 8.5px; font-weight: 700; padding: 2px 4px; border-radius: 3px; cursor: pointer;">LA-2A</button>
                                <button class="daw-fx-preset-btn" data-preset="1176" title="Fast FET Peak Limiter" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #38bdf8; font-size: 8.5px; font-weight: 700; padding: 2px 4px; border-radius: 3px; cursor: pointer;">1176</button>
                                <button class="daw-fx-preset-btn" data-preset="ssl" title="SSL Bus Glue Compressor" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #34d399; font-size: 8.5px; font-weight: 700; padding: 2px 4px; border-radius: 3px; cursor: pointer;">SSL</button>
                                <button class="daw-fx-preset-btn" data-preset="reset" title="Bypass Reset" style="background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.25); color: #f87171; font-size: 8.5px; font-weight: 700; padding: 2px 4px; border-radius: 3px; cursor: pointer;">Reset</button>
                                <button id="daw-track-fx-close-btn" title="Close FX Rack" style="background: none; border: none; color: rgba(255,255,255,0.55); font-size: 15px; font-weight: 800; cursor: pointer; line-height: 1; padding: 0 4px; margin-left: 2px;">&times;</button>
                            </div>
                        </div>

                        <!-- FX Body: 10 Open-Source Web Audio Native DSP Plugins Rack (Streamlined & Compact) -->
                        <div style="flex: 1; overflow-y: auto; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; scrollbar-width: thin;">
                            <!-- 1. Parametric Broadcast EQ & Electrical De-Hum Suite -->
                            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 6px 8px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                                    <div style="display: flex; align-items: center; gap: 5px;">
                                        <span style="width: 6px; height: 6px; border-radius: 50%; background: #34d399;"></span>
                                        <span style="font-size: 10px; font-weight: 800; color: #ffffff;">1. Broadcast EQ &amp; Noise De-Hum</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 6px;">
                                        <button id="daw-fx-dehum-btn" type="button" title="Cycle Ground De-Hum: OFF / 50Hz (EU/Ireland) / 60Hz (US)" style="padding: 1px 5px; border-radius: 3px; font-size: 8px; font-weight: 800; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.18); color: rgba(255,255,255,0.8); cursor: pointer;">DE-HUM: OFF</button>
                                        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 9px; font-weight: 700; color: #34d399;">
                                            <input type="checkbox" id="daw-fx-eq-enable" style="cursor: pointer; accent-color: #10b981; margin: 0;"> ON
                                        </label>
                                    </div>
                                </div>
                                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
                                    <div>
                                        <label style="display: block; font-size: 8px; font-weight: 700; color: rgba(255,255,255,0.5); margin-bottom: 2px;">80Hz LowCut</label>
                                        <button id="daw-fx-eq-lowcut" type="button" style="width: 100%; padding: 2px 4px; border-radius: 3px; font-size: 8.5px; font-weight: 700; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #fff; cursor: pointer;">OFF</button>
                                    </div>
                                    <div>
                                        <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 700; color: rgba(255,255,255,0.5); margin-bottom: 1px;">
                                            <span>Bass (120Hz)</span><span id="daw-fx-eq-low-val">0dB</span>
                                        </div>
                                        <input id="daw-fx-eq-low" type="range" min="-12" max="12" step="1" value="0" style="width: 100%; height: 3px; accent-color: #34d399; cursor: pointer;">
                                    </div>
                                    <div>
                                        <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 700; color: rgba(255,255,255,0.5); margin-bottom: 1px;">
                                            <span>Mid (2.5k)</span><span id="daw-fx-eq-mid-val">0dB</span>
                                        </div>
                                        <input id="daw-fx-eq-mid" type="range" min="-12" max="12" step="1" value="0" style="width: 100%; height: 3px; accent-color: #34d399; cursor: pointer;">
                                    </div>
                                    <div>
                                        <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 700; color: rgba(255,255,255,0.5); margin-bottom: 1px;">
                                            <span>Air (9kHz)</span><span id="daw-fx-eq-high-val">0dB</span>
                                        </div>
                                        <input id="daw-fx-eq-high" type="range" min="-12" max="12" step="1" value="0" style="width: 100%; height: 3px; accent-color: #34d399; cursor: pointer;">
                                    </div>
                                </div>
                            </div>

                            <!-- 2. Dynamics Compressor & Vintage Modeling -->
                            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 6px 8px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                                    <div style="display: flex; align-items: center; gap: 5px;">
                                        <span style="width: 6px; height: 6px; border-radius: 50%; background: #22d3ee;"></span>
                                        <span style="font-size: 10px; font-weight: 800; color: #ffffff;">2. Dynamics Compressor &amp; Leveler</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 5px;">
                                        <select id="daw-fx-comp-model" title="Compressor Characteristic Circuit" style="background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.18); border-radius: 3px; color: #22d3ee; font-size: 8.5px; font-weight: 700; padding: 1px 3px; outline: none; cursor: pointer;">
                                            <option value="modern" selected>Modern Clean</option>
                                            <option value="la2a">LA-2A (Opto Soft)</option>
                                            <option value="1176">1176 (FET Punch)</option>
                                            <option value="ssl">SSL (Bus Glue)</option>
                                        </select>
                                        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 9px; font-weight: 700; color: #22d3ee;">
                                            <input type="checkbox" id="daw-fx-comp-enable" style="cursor: pointer; accent-color: #06b6d4; margin: 0;"> ON
                                        </label>
                                    </div>
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                    <div>
                                        <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 700; color: rgba(255,255,255,0.5); margin-bottom: 1px;">
                                            <span>Threshold</span><span id="daw-fx-comp-thresh-val">-24dB</span>
                                        </div>
                                        <input id="daw-fx-comp-thresh" type="range" min="-48" max="0" step="1" value="-24" style="width: 100%; height: 3px; accent-color: #06b6d4; cursor: pointer;">
                                    </div>
                                    <div>
                                        <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 700; color: rgba(255,255,255,0.5); margin-bottom: 1px;">
                                            <span>Ratio</span><span id="daw-fx-comp-ratio-val">3.5:1</span>
                                        </div>
                                        <input id="daw-fx-comp-ratio" type="range" min="1.5" max="12" step="0.5" value="3.5" style="width: 100%; height: 3px; accent-color: #06b6d4; cursor: pointer;">
                                    </div>
                                </div>
                            </div>

                            <!-- 3. Studio Space Reverb -->
                            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 6px 8px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                                    <div style="display: flex; align-items: center; gap: 5px;">
                                        <span style="width: 6px; height: 6px; border-radius: 50%; background: #c084fc;"></span>
                                        <span style="font-size: 10px; font-weight: 800; color: #ffffff;">3. Space &amp; Ambience Reverb</span>
                                    </div>
                                    <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 9px; font-weight: 700; color: #c084fc;">
                                        <input type="checkbox" id="daw-fx-reverb-enable" style="cursor: pointer; accent-color: #8b5cf6; margin: 0;"> ON
                                    </label>
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                    <div>
                                        <label style="display: block; font-size: 8px; font-weight: 700; color: rgba(255,255,255,0.5); margin-bottom: 2px;">Model</label>
                                        <select id="daw-fx-reverb-type" style="width: 100%; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.15); border-radius: 3px; padding: 2px 4px; color: #fff; font-size: 9px; outline: none;">
                                            <option value="booth">Vocal Booth</option>
                                            <option value="studio">Studio Room</option>
                                            <option value="plate">Plate</option>
                                            <option value="hall">Broadcast Hall</option>
                                        </select>
                                    </div>
                                    <div>
                                        <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 700; color: rgba(255,255,255,0.5); margin-bottom: 1px;">
                                            <span>Wet Mix</span><span id="daw-fx-reverb-wet-val">20%</span>
                                        </div>
                                        <input id="daw-fx-reverb-wet" type="range" min="0" max="60" step="5" value="20" style="width: 100%; height: 3px; accent-color: #c084fc; cursor: pointer;">
                                    </div>
                                </div>
                            </div>

                            <!-- 4. Analog Tape Warmth -->
                            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 6px 8px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                                    <div style="display: flex; align-items: center; gap: 5px;">
                                        <span style="width: 6px; height: 6px; border-radius: 50%; background: #fbbf24;"></span>
                                        <span style="font-size: 10px; font-weight: 800; color: #ffffff;">4. Analog Tape Saturation</span>
                                    </div>
                                    <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 9px; font-weight: 700; color: #fbbf24;">
                                        <input type="checkbox" id="daw-fx-warmth-enable" style="cursor: pointer; accent-color: #f59e0b; margin: 0;"> ON
                                    </label>
                                </div>
                                <div>
                                    <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 700; color: rgba(255,255,255,0.5); margin-bottom: 1px;">
                                        <span>Drive</span><span id="daw-fx-warmth-val">25%</span>
                                    </div>
                                    <input id="daw-fx-warmth" type="range" min="0" max="100" step="5" value="25" style="width: 100%; height: 3px; accent-color: #f59e0b; cursor: pointer;">
                                </div>
                            </div>

                            <!-- 5. Stereo Echo Delay -->
                            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 6px 8px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                                    <div style="display: flex; align-items: center; gap: 5px;">
                                        <span style="width: 6px; height: 6px; border-radius: 50%; background: #38bdf8;"></span>
                                        <span style="font-size: 10px; font-weight: 800; color: #ffffff;">5. Stereo Echo Delay</span>
                                    </div>
                                    <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 9px; font-weight: 700; color: #38bdf8;">
                                        <input type="checkbox" id="daw-fx-delay-enable" style="cursor: pointer; accent-color: #0284c7; margin: 0;"> ON
                                    </label>
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px;">
                                    <div>
                                        <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 700; color: rgba(255,255,255,0.5); margin-bottom: 1px;">
                                            <span>Time</span><span id="daw-fx-delay-time-val">250ms</span>
                                        </div>
                                        <input id="daw-fx-delay-time" type="range" min="50" max="800" step="25" value="250" style="width: 100%; height: 3px; accent-color: #38bdf8; cursor: pointer;">
                                    </div>
                                    <div>
                                        <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 700; color: rgba(255,255,255,0.5); margin-bottom: 1px;">
                                            <span>Feedback</span><span id="daw-fx-delay-feedback-val">30%</span>
                                        </div>
                                        <input id="daw-fx-delay-feedback" type="range" min="0" max="75" step="5" value="30" style="width: 100%; height: 3px; accent-color: #38bdf8; cursor: pointer;">
                                    </div>
                                    <div>
                                        <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 700; color: rgba(255,255,255,0.5); margin-bottom: 1px;">
                                            <span>Wet Mix</span><span id="daw-fx-delay-mix-val">20%</span>
                                        </div>
                                        <input id="daw-fx-delay-mix" type="range" min="0" max="60" step="5" value="20" style="width: 100%; height: 3px; accent-color: #38bdf8; cursor: pointer;">
                                    </div>
                                </div>
                            </div>

                            <!-- 6. Vocal De-Esser -->
                            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 6px 8px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                                    <div style="display: flex; align-items: center; gap: 5px;">
                                        <span style="width: 6px; height: 6px; border-radius: 50%; background: #f43f5e;"></span>
                                        <span style="font-size: 10px; font-weight: 800; color: #ffffff;">6. Dynamic Vocal De-Esser</span>
                                    </div>
                                    <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 9px; font-weight: 700; color: #f43f5e;">
                                        <input type="checkbox" id="daw-fx-deesser-enable" style="cursor: pointer; accent-color: #e11d48; margin: 0;"> ON
                                    </label>
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                    <div>
                                        <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 700; color: rgba(255,255,255,0.5); margin-bottom: 1px;">
                                            <span>Cut</span><span id="daw-fx-deesser-reduction-val">-6dB</span>
                                        </div>
                                        <input id="daw-fx-deesser-reduction" type="range" min="-18" max="0" step="1" value="-6" style="width: 100%; height: 3px; accent-color: #f43f5e; cursor: pointer;">
                                    </div>
                                    <div>
                                        <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 700; color: rgba(255,255,255,0.5); margin-bottom: 1px;">
                                            <span>Freq</span><span id="daw-fx-deesser-freq-val">6500Hz</span>
                                        </div>
                                        <input id="daw-fx-deesser-freq" type="range" min="4500" max="8500" step="250" value="6500" style="width: 100%; height: 3px; accent-color: #f43f5e; cursor: pointer;">
                                    </div>
                                </div>
                            </div>

                            <!-- 7. Noise Gate / Expander -->
                            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 6px 8px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                                    <div style="display: flex; align-items: center; gap: 5px;">
                                        <span style="width: 6px; height: 6px; border-radius: 50%; background: #10b981;"></span>
                                        <span style="font-size: 10px; font-weight: 800; color: #ffffff;">7. Studio Noise Gate</span>
                                    </div>
                                    <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 9px; font-weight: 700; color: #10b981;">
                                        <input type="checkbox" id="daw-fx-gate-enable" style="cursor: pointer; accent-color: #059669; margin: 0;"> ON
                                    </label>
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                    <div>
                                        <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 700; color: rgba(255,255,255,0.5); margin-bottom: 1px;">
                                            <span>Threshold</span><span id="daw-fx-gate-thresh-val">-42dB</span>
                                        </div>
                                        <input id="daw-fx-gate-thresh" type="range" min="-60" max="-18" step="1" value="-42" style="width: 100%; height: 3px; accent-color: #10b981; cursor: pointer;">
                                    </div>
                                    <div>
                                        <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 700; color: rgba(255,255,255,0.5); margin-bottom: 1px;">
                                            <span>Attenuation</span><span id="daw-fx-gate-reduction-val">-24dB</span>
                                        </div>
                                        <input id="daw-fx-gate-reduction" type="range" min="-40" max="-6" step="2" value="-24" style="width: 100%; height: 3px; accent-color: #10b981; cursor: pointer;">
                                    </div>
                                </div>
                            </div>

                            <!-- 8. Chorus & Spatial Modulation -->
                            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 6px 8px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                                    <div style="display: flex; align-items: center; gap: 5px;">
                                        <span style="width: 6px; height: 6px; border-radius: 50%; background: #a855f7;"></span>
                                        <span style="font-size: 10px; font-weight: 800; color: #ffffff;">8. Chorus &amp; Spatial Ensemble</span>
                                    </div>
                                    <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 9px; font-weight: 700; color: #a855f7;">
                                        <input type="checkbox" id="daw-fx-chorus-enable" style="cursor: pointer; accent-color: #9333ea; margin: 0;"> ON
                                    </label>
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                    <div>
                                        <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 700; color: rgba(255,255,255,0.5); margin-bottom: 1px;">
                                            <span>Rate</span><span id="daw-fx-chorus-rate-val">1.2Hz</span>
                                        </div>
                                        <input id="daw-fx-chorus-rate" type="range" min="0.2" max="5.0" step="0.2" value="1.2" style="width: 100%; height: 3px; accent-color: #a855f7; cursor: pointer;">
                                    </div>
                                    <div>
                                        <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 700; color: rgba(255,255,255,0.5); margin-bottom: 1px;">
                                            <span>Mix</span><span id="daw-fx-chorus-mix-val">25%</span>
                                        </div>
                                        <input id="daw-fx-chorus-mix" type="range" min="0" max="60" step="5" value="25" style="width: 100%; height: 3px; accent-color: #a855f7; cursor: pointer;">
                                    </div>
                                </div>
                            </div>

                            <!-- 9. Stereo Widener -->
                            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 6px 8px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                                    <div style="display: flex; align-items: center; gap: 5px;">
                                        <span style="width: 6px; height: 6px; border-radius: 50%; background: #06b6d4;"></span>
                                        <span style="font-size: 10px; font-weight: 800; color: #ffffff;">9. Stereo Acoustic Widener</span>
                                    </div>
                                    <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 9px; font-weight: 700; color: #06b6d4;">
                                        <input type="checkbox" id="daw-fx-widener-enable" style="cursor: pointer; accent-color: #0891b2; margin: 0;"> ON
                                    </label>
                                </div>
                                <div>
                                    <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 700; color: rgba(255,255,255,0.5); margin-bottom: 1px;">
                                        <span>Width</span><span id="daw-fx-widener-width-val">130%</span>
                                    </div>
                                    <input id="daw-fx-widener-width" type="range" min="50" max="200" step="5" value="130" style="width: 100%; height: 3px; accent-color: #06b6d4; cursor: pointer;">
                                </div>
                            </div>

                            <!-- 10. Broadcast Peak Limiter -->
                            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 6px 8px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                                    <div style="display: flex; align-items: center; gap: 5px;">
                                        <span style="width: 6px; height: 6px; border-radius: 50%; background: #f97316;"></span>
                                        <span style="font-size: 10px; font-weight: 800; color: #ffffff;">10. Peak Limiter (-0.5 dBFS)</span>
                                    </div>
                                    <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 9px; font-weight: 700; color: #f97316;">
                                        <input type="checkbox" id="daw-fx-limiter-enable" style="cursor: pointer; accent-color: #ea580c; margin: 0;"> ON
                                    </label>
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                    <div>
                                        <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 700; color: rgba(255,255,255,0.5); margin-bottom: 1px;">
                                            <span>Ceiling</span><span id="daw-fx-limiter-ceiling-val">-0.5dB</span>
                                        </div>
                                        <input id="daw-fx-limiter-ceiling" type="range" min="-3.0" max="0.0" step="0.1" value="-0.5" style="width: 100%; height: 3px; accent-color: #f97316; cursor: pointer;">
                                    </div>
                                    <div>
                                        <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 700; color: rgba(255,255,255,0.5); margin-bottom: 1px;">
                                            <span>Gain</span><span id="daw-fx-limiter-gain-val">+2.0dB</span>
                                        </div>
                                        <input id="daw-fx-limiter-gain" type="range" min="0" max="10" step="0.5" value="2.0" style="width: 100%; height: 3px; accent-color: #f97316; cursor: pointer;">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- FX Footer (Compact 38px) -->
                        <div style="padding: 6px 10px; border-top: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: space-between;">
                            <span style="font-size: 9px; color: rgba(255,255,255,0.45);">10 Native Web Audio Plugins</span>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <button id="daw-fx-audition-btn" type="button" title="Audition / Preview effect in real-time" style="background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8; padding: 4px 10px; border-radius: 5px; font-size: 10px; font-weight: 750; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.15s;">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                    <span id="daw-fx-audition-btn-text">Audition</span>
                                </button>
                                <button id="daw-track-fx-save-btn" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: 1px solid rgba(16,185,129,0.5); color: #fff; padding: 4px 12px; border-radius: 5px; font-size: 10px; font-weight: 800; cursor: pointer; box-shadow: 0 0 8px rgba(16,185,129,0.3);">
                                    Apply Rack
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Dockable & Floating Studio Master VU Meter Window (v1.7.8) -->
                    <div id="daw-studio-vu-window" style="position: absolute; top: 76px; right: 480px; width: 140px; background: #080a12; border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 10px; z-index: 122; display: none; flex-direction: column; overflow: hidden; box-shadow: 0 16px 40px rgba(0,0,0,0.95), 0 0 16px rgba(16, 185, 129, 0.15);">
                        <!-- VU Header (Draggable) -->
                        <div id="daw-studio-vu-header" style="padding: 5px 8px; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: space-between; cursor: move; user-select: none;">
                            <div style="display: flex; align-items: center; gap: 5px;">
                                <span style="background: rgba(16, 185, 129, 0.18); border: 1px solid rgba(16, 185, 129, 0.4); color: #34d399; font-size: 8.5px; font-weight: 800; padding: 1px 4px; border-radius: 3px; text-transform: uppercase;">VU</span>
                                <span style="font-size: 10px; font-weight: 800; color: #ffffff;">Master Out</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 3px;">
                                <button id="daw-vu-dock-toggle-btn" title="Toggle Docked / Floating Mode" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.18); color: #ffffff; font-size: 8px; font-weight: 800; padding: 1px 4px; border-radius: 3px; cursor: pointer;">DOCK</button>
                                <button id="daw-vu-window-close-btn" title="Close VU Window (F8)" style="background: none; border: none; color: rgba(255,255,255,0.55); font-size: 13px; font-weight: 800; cursor: pointer; line-height: 1; padding: 0 2px;">&times;</button>
                            </div>
                        </div>
                        <!-- Stereo Meter Dual Vertical Columns -->
                        <div style="padding: 10px 8px; display: flex; flex-direction: column; gap: 8px; background: #05070d;">
                            <!-- Numeric dB Readouts & Peak Alert -->
                            <div style="display: flex; justify-content: space-between; font-family: monospace; font-size: 9px; font-weight: 700; color: #38bdf8;">
                                <span>L: <span id="daw-vu-db-l">-∞</span></span>
                                <span id="daw-vu-clip-badge" style="color: #ef4444; opacity: 0; font-weight: 900; transition: opacity 0.1s;">CLIP</span>
                                <span>R: <span id="daw-vu-db-r">-∞</span></span>
                            </div>
                            <!-- Twin High-Resolution Meter Bars with dB Graticule -->
                            <div style="display: flex; align-items: stretch; justify-content: center; gap: 10px; height: 160px;">
                                <!-- Left Channel Bar -->
                                <div style="display: flex; flex-direction: column; align-items: center; gap: 3px;">
                                    <div style="width: 14px; height: 100%; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; position: relative; display: flex; flex-direction: column; justify-content: flex-end;">
                                        <div id="daw-vu-bar-l" style="width: 100%; height: 0%; background: linear-gradient(0deg, #10b981 0%, #10b981 65%, #eab308 85%, #ef4444 100%); transition: height 0.04s ease-out;"></div>
                                    </div>
                                    <span style="font-size: 8px; font-weight: 800; color: rgba(255,255,255,0.6);">L</span>
                                </div>
                                <!-- Center dB Scale Markings -->
                                <div style="display: flex; flex-direction: column; justify-content: space-between; font-family: monospace; font-size: 7.5px; color: rgba(255,255,255,0.45); padding: 2px 0;">
                                    <span style="color: #ef4444;">0dB</span>
                                    <span style="color: #eab308;">-3</span>
                                    <span>-6</span>
                                    <span>-12</span>
                                    <span>-18</span>
                                    <span>-24</span>
                                    <span>-36</span>
                                    <span>-48</span>
                                </div>
                                <!-- Right Channel Bar -->
                                <div style="display: flex; flex-direction: column; align-items: center; gap: 3px;">
                                    <div style="width: 14px; height: 100%; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; position: relative; display: flex; flex-direction: column; justify-content: flex-end;">
                                        <div id="daw-vu-bar-r" style="width: 100%; height: 0%; background: linear-gradient(0deg, #10b981 0%, #10b981 65%, #eab308 85%, #ef4444 100%); transition: height 0.04s ease-out;"></div>
                                    </div>
                                    <span style="font-size: 8px; font-weight: 800; color: rgba(255,255,255,0.6);">R</span>
                                </div>
                            </div>
                            <!-- Integrated LUFS & Target Standard -->
                            <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 6px; display: flex; flex-direction: column; gap: 2px; text-align: center;">
                                <div style="font-size: 8px; color: rgba(255,255,255,0.5); font-weight: 700;">EBU R128 TARGET</div>
                                <div id="daw-vu-lufs-window-badge" style="font-family: monospace; font-size: 11px; font-weight: 800; color: #34d399;">-16.0 LUFS</div>
                            </div>
                        </div>
                    </div>

                    <!-- LocalFilm Studio Audio Plugins Directory Drawer Modal (v1.7.8) -->
                    <div id="daw-plugins-directory-modal" style="position: absolute; inset: 0; background: rgba(0,0,0,0.88); backdrop-filter: blur(14px); z-index: 3150; display: none; align-items: center; justify-content: center; padding: 20px;">
                        <div style="background: #090c14; border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 16px; width: 100%; max-width: 780px; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,0.95);">
                            <!-- Directory Header -->
                            <div style="padding: 12px 18px; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.02); display: flex; align-items: center; justify-content: space-between;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                                    <h4 style="font-size: 13px; font-weight: 800; color: #ffffff; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">LocalFilm Studio — Open-Source Plugins Directory</h4>
                                </div>
                                <button id="daw-plugins-dir-close-btn" style="background: none; border: none; color: rgba(255,255,255,0.5); font-size: 18px; cursor: pointer; line-height: 1;">&times;</button>
                            </div>
                            <!-- Directory Category Chips -->
                            <div style="padding: 8px 18px; border-bottom: 1px solid rgba(255,255,255,0.06); background: rgba(0,0,0,0.4); display: flex; gap: 6px; overflow-x: auto;">
                                <button class="daw-plugin-filter-btn" data-cat="all" style="background: rgba(56, 189, 248, 0.2); border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8; font-size: 9.5px; font-weight: 800; padding: 3px 8px; border-radius: 4px; cursor: pointer;">All Plugins (12)</button>
                                <button class="daw-plugin-filter-btn" data-cat="dynamics" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #fff; font-size: 9.5px; font-weight: 700; padding: 3px 8px; border-radius: 4px; cursor: pointer;">Dynamics &amp; Levelers</button>
                                <button class="daw-plugin-filter-btn" data-cat="eq" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #fff; font-size: 9.5px; font-weight: 700; padding: 3px 8px; border-radius: 4px; cursor: pointer;">EQ &amp; Tone</button>
                                <button class="daw-plugin-filter-btn" data-cat="restoration" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #fff; font-size: 9.5px; font-weight: 700; padding: 3px 8px; border-radius: 4px; cursor: pointer;">Noise &amp; De-Hum</button>
                                <button class="daw-plugin-filter-btn" data-cat="space" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #fff; font-size: 9.5px; font-weight: 700; padding: 3px 8px; border-radius: 4px; cursor: pointer;">Time &amp; Space</button>
                            </div>
                            <!-- Plugin Grid Cards -->
                            <div id="daw-plugins-dir-grid" style="padding: 16px 18px; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px;">
                                <!-- Teletronix LA-2A -->
                                <div class="daw-plugin-card" data-cat="dynamics" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; justify-content: space-between;">
                                    <div>
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                            <span style="font-size: 8px; font-weight: 800; color: #fbbf24; background: rgba(245,158,11,0.15); padding: 1px 4px; border-radius: 3px;">OPTO LEVELER</span>
                                            <span style="font-size: 8px; color: rgba(255,255,255,0.4);">Open Audio</span>
                                        </div>
                                        <h5 style="margin: 0 0 3px 0; font-size: 11.5px; color: #fff; font-weight: 800;">Teletronix LA-2A</h5>
                                        <p style="margin: 0 0 8px 0; font-size: 9.5px; color: rgba(255,255,255,0.6); line-height: 1.3;">Frequency-dependent optical tube compressor modeling with signature natural release curve.</p>
                                    </div>
                                    <button class="daw-plugin-insert-btn" data-plugin="la2a" style="background: rgba(245,158,11,0.18); border: 1px solid rgba(245,158,11,0.4); color: #fbbf24; padding: 4px 8px; border-radius: 4px; font-size: 9.5px; font-weight: 800; cursor: pointer;">Insert on Active Track</button>
                                </div>
                                <!-- UREI 1176LN -->
                                <div class="daw-plugin-card" data-cat="dynamics" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; justify-content: space-between;">
                                    <div>
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                            <span style="font-size: 8px; font-weight: 800; color: #38bdf8; background: rgba(56,189,248,0.15); padding: 1px 4px; border-radius: 3px;">FET PEAK LIMITER</span>
                                            <span style="font-size: 8px; color: rgba(255,255,255,0.4);">Open Audio</span>
                                        </div>
                                        <h5 style="margin: 0 0 3px 0; font-size: 11.5px; color: #fff; font-weight: 800;">UREI 1176LN FET</h5>
                                        <p style="margin: 0 0 8px 0; font-size: 9.5px; color: rgba(255,255,255,0.6); line-height: 1.3;">Lightning-fast 20-microsecond FET peak attack for punchy broadcast vocal presence.</p>
                                    </div>
                                    <button class="daw-plugin-insert-btn" data-plugin="1176" style="background: rgba(56,189,248,0.18); border: 1px solid rgba(56,189,248,0.4); color: #38bdf8; padding: 4px 8px; border-radius: 4px; font-size: 9.5px; font-weight: 800; cursor: pointer;">Insert on Active Track</button>
                                </div>
                                <!-- SSL G-Master Bus -->
                                <div class="daw-plugin-card" data-cat="dynamics" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; justify-content: space-between;">
                                    <div>
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                            <span style="font-size: 8px; font-weight: 800; color: #34d399; background: rgba(52,211,153,0.15); padding: 1px 4px; border-radius: 3px;">BUS GLUE</span>
                                            <span style="font-size: 8px; color: rgba(255,255,255,0.4);">Open Audio</span>
                                        </div>
                                        <h5 style="margin: 0 0 3px 0; font-size: 11.5px; color: #fff; font-weight: 800;">SSL G-Master Bus</h5>
                                        <p style="margin: 0 0 8px 0; font-size: 9.5px; color: rgba(255,255,255,0.6); line-height: 1.3;">Legendary 4:1 VCA mix bus glue compressor unifying multiple spoken takes into one cohesive sound.</p>
                                    </div>
                                    <button class="daw-plugin-insert-btn" data-plugin="ssl" style="background: rgba(52,211,153,0.18); border: 1px solid rgba(52,211,153,0.4); color: #34d399; padding: 4px 8px; border-radius: 4px; font-size: 9.5px; font-weight: 800; cursor: pointer;">Insert on Active Track</button>
                                </div>
                                <!-- 50Hz / 60Hz Ground De-Hum -->
                                <div class="daw-plugin-card" data-cat="restoration" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; justify-content: space-between;">
                                    <div>
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                            <span style="font-size: 8px; font-weight: 800; color: #f87171; background: rgba(239,68,68,0.15); padding: 1px 4px; border-radius: 3px;">GROUND NOTCH</span>
                                            <span style="font-size: 8px; color: rgba(255,255,255,0.4);">DSP Filter</span>
                                        </div>
                                        <h5 style="margin: 0 0 3px 0; font-size: 11.5px; color: #fff; font-weight: 800;">50/60Hz De-Hum Filter</h5>
                                        <p style="margin: 0 0 8px 0; font-size: 9.5px; color: rgba(255,255,255,0.6); line-height: 1.3;">High-Q sharp electrical ground loop hum eliminator (50Hz Ireland/Europe &amp; 60Hz US mains).</p>
                                    </div>
                                    <button class="daw-plugin-insert-btn" data-plugin="dehum50" style="background: rgba(239,68,68,0.18); border: 1px solid rgba(239,68,68,0.4); color: #f87171; padding: 4px 8px; border-radius: 4px; font-size: 9.5px; font-weight: 800; cursor: pointer;">Insert 50Hz De-Hum</button>
                                </div>
                                <!-- 4-Band Broadcast EQ -->
                                <div class="daw-plugin-card" data-cat="eq" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; justify-content: space-between;">
                                    <div>
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                            <span style="font-size: 8px; font-weight: 800; color: #34d399; background: rgba(52,211,153,0.15); padding: 1px 4px; border-radius: 3px;">PARAMETRIC</span>
                                            <span style="font-size: 8px; color: rgba(255,255,255,0.4);">Native EQ</span>
                                        </div>
                                        <h5 style="margin: 0 0 3px 0; font-size: 11.5px; color: #fff; font-weight: 800;">4-Band Studio EQ</h5>
                                        <p style="margin: 0 0 8px 0; font-size: 9.5px; color: rgba(255,255,255,0.6); line-height: 1.3;">80Hz highpass cut, 120Hz bass body shelf, 2.5kHz dialogue presence, and 9kHz air shimmer.</p>
                                    </div>
                                    <button class="daw-plugin-insert-btn" data-plugin="eq" style="background: rgba(52,211,153,0.18); border: 1px solid rgba(52,211,153,0.4); color: #34d399; padding: 4px 8px; border-radius: 4px; font-size: 9.5px; font-weight: 800; cursor: pointer;">Open EQ Rack</button>
                                </div>
                                <!-- Dynamic Vocal De-Esser -->
                                <div class="daw-plugin-card" data-cat="restoration" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; justify-content: space-between;">
                                    <div>
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                            <span style="font-size: 8px; font-weight: 800; color: #f43f5e; background: rgba(244,63,94,0.15); padding: 1px 4px; border-radius: 3px;">SIBILANCE</span>
                                            <span style="font-size: 8px; color: rgba(255,255,255,0.4);">Precision Cut</span>
                                        </div>
                                        <h5 style="margin: 0 0 3px 0; font-size: 11.5px; color: #fff; font-weight: 800;">Precision De-Esser</h5>
                                        <p style="margin: 0 0 8px 0; font-size: 9.5px; color: rgba(255,255,255,0.6); line-height: 1.3;">Targeted sibilance notch filter taming harsh 'S' and 'T' consonants between 4.5kHz and 8.5kHz.</p>
                                    </div>
                                    <button class="daw-plugin-insert-btn" data-plugin="deesser" style="background: rgba(244,63,94,0.18); border: 1px solid rgba(244,63,94,0.4); color: #f43f5e; padding: 4px 8px; border-radius: 4px; font-size: 9.5px; font-weight: 800; cursor: pointer;">Open De-Esser</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <!-- Keyboard Shortcuts & DAW Guide Modal -->
                    <div id="daw-shortcuts-help-modal" style="position: absolute; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(14px); z-index: 3200; display: none; align-items: center; justify-content: center; padding: 20px;">
                        <div style="background: #0d111a; border: 1px solid rgba(255,255,255,0.18); border-radius: 16px; width: 100%; max-width: 580px; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,0.95);">
                            <div style="padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.02); display: flex; align-items: center; justify-content: space-between;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="8" x2="6" y2="8"/><line x1="10" y1="8" x2="10" y2="8"/><line x1="14" y1="8" x2="14" y2="8"/><line x1="18" y1="8" x2="18" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                                    <h4 style="font-size: 13px; font-weight: 800; color: #ffffff; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">LocalFilm Studio DAW — Keyboard Shortcuts</h4>
                                </div>
                                <button id="daw-shortcuts-help-close-btn" style="background: none; border: none; color: rgba(255,255,255,0.5); font-size: 18px; cursor: pointer; line-height: 1;">&times;</button>
                            </div>
                            <div style="padding: 16px 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; font-size: 11.5px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                                    <span style="color: rgba(255,255,255,0.85);">Play / Pause Transport</span>
                                    <kbd style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 7px; font-family: monospace; font-size: 10px; color: #38bdf8;">Space</kbd>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                                    <span style="color: rgba(255,255,255,0.85);">Record Overdub on Armed Track</span>
                                    <kbd style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 7px; font-family: monospace; font-size: 10px; color: #f87171;">R</kbd>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                                    <span style="color: rgba(255,255,255,0.85);">Split Clip at Current Playhead</span>
                                    <kbd style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 7px; font-family: monospace; font-size: 10px; color: #34d399;">S / B</kbd>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                                    <span style="color: rgba(255,255,255,0.85);">Delete Selected Clip(s)</span>
                                    <kbd style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 7px; font-family: monospace; font-size: 10px; color: #fff;">Delete / Backspace</kbd>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                                    <span style="color: rgba(255,255,255,0.85);">Undo Last Timeline Action</span>
                                    <kbd style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 7px; font-family: monospace; font-size: 10px; color: #fff;">Ctrl+Z / Cmd+Z</kbd>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                                    <span style="color: rgba(255,255,255,0.85);">Redo Timeline Action</span>
                                    <kbd style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 7px; font-family: monospace; font-size: 10px; color: #fff;">Ctrl+Y / Cmd+Shift+Z</kbd>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                                    <span style="color: rgba(255,255,255,0.85);">Toggle Cycle / Loop Mode</span>
                                    <kbd style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 7px; font-family: monospace; font-size: 10px; color: #fff;">L</kbd>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                                    <span style="color: rgba(255,255,255,0.85);">Zoom In / Zoom Out Timeline</span>
                                    <kbd style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 7px; font-family: monospace; font-size: 10px; color: #fff;">+ / − (or Alt+Wheel)</kbd>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                                    <span style="color: rgba(255,255,255,0.85);">Fade In / Out Curve Adjustment</span>
                                    <span style="color: rgba(255,255,255,0.5); font-size: 10.5px;">Drag Top Corner Handles</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                                    <span style="color: rgba(255,255,255,0.85);">Cut Selected Clip(s)</span>
                                    <kbd style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 7px; font-family: monospace; font-size: 10px; color: #fff;">Ctrl+X / Cmd+X</kbd>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                                    <span style="color: rgba(255,255,255,0.85);">Copy Selected Clip(s)</span>
                                    <kbd style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 7px; font-family: monospace; font-size: 10px; color: #fff;">Ctrl+C / Cmd+C</kbd>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                                    <span style="color: rgba(255,255,255,0.85);">Paste at Playhead</span>
                                    <kbd style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 7px; font-family: monospace; font-size: 10px; color: #34d399;">Ctrl+V / Cmd+V</kbd>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                                    <span style="color: rgba(255,255,255,0.85);">Ripple Delete (Close Gap)</span>
                                    <kbd style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 7px; font-family: monospace; font-size: 10px; color: #f87171;">Shift+Delete</kbd>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                                    <span style="color: rgba(255,255,255,0.85);">Toggle Metronome Click Track</span>
                                    <kbd style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 7px; font-family: monospace; font-size: 10px; color: #34d399;">K</kbd>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                                    <span style="color: rgba(255,255,255,0.85);">Punch In / Punch Out Markers</span>
                                    <kbd style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 7px; font-family: monospace; font-size: 10px; color: #38bdf8;">I / O</kbd>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                                    <span style="color: rgba(255,255,255,0.85);">Slip Edit Audio Inside Clip</span>
                                    <span style="color: rgba(255,255,255,0.5); font-size: 10.5px;">Alt + Drag Clip</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                                    <span style="color: rgba(255,255,255,0.85);">Exclusive Track Solo</span>
                                    <span style="color: rgba(255,255,255,0.5); font-size: 10.5px;">Ctrl / Cmd + Click [S]</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                                    <span style="color: rgba(255,255,255,0.85);">2D Clip Drag &amp; Track Transfer</span>
                                    <span style="color: rgba(255,255,255,0.5); font-size: 10.5px;">Click &amp; Drag Clip Up/Down</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0;">
                                    <span style="color: rgba(255,255,255,0.85);">Inspect Clip / Rename Take</span>
                                    <span style="color: rgba(255,255,255,0.5); font-size: 10.5px;">Double-Click Clip</span>
                                </div>
                            </div>
                            <div style="padding: 12px 18px; border-top: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3); display: flex; justify-content: flex-end;">
                                <button id="daw-shortcuts-help-ok-btn" style="background: linear-gradient(135deg, #38bdf8 0%, #0284c7 100%); border: none; color: #fff; padding: 6px 18px; border-radius: 6px; font-size: 11.5px; font-weight: 800; cursor: pointer;">Got It</button>
                            </div>
                        </div>
                    </div>

                    <!-- Master Mixdown Studio Export Options & Progress Modal (v1.7.3) -->
                    <div id="daw-export-mixdown-modal" style="position: absolute; inset: 0; background: rgba(0,0,0,0.88); backdrop-filter: blur(16px); z-index: 3200; display: none; align-items: center; justify-content: center; padding: 20px;">
                        <div style="background: #090c14; border: 1px solid rgba(255,255,255,0.18); border-radius: 18px; width: 100%; max-width: 540px; box-shadow: 0 32px 80px rgba(0,0,0,0.95); display: flex; flex-direction: column; overflow: hidden; position: relative;">
                            <!-- Header -->
                            <div style="padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.02); display: flex; align-items: center; justify-content: space-between;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.35); display: flex; align-items: center; justify-content: center;">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.2" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                                    </div>
                                    <div>
                                        <h4 style="font-size: 14px; font-weight: 800; color: #ffffff; margin: 0; letter-spacing: 0.3px;">Export Master Audio Mixdown</h4>
                                        <span style="font-size: 10.5px; color: rgba(255,255,255,0.55);">Studio Broadcast Offline AudioContext Engine</span>
                                    </div>
                                </div>
                                <button id="daw-export-modal-close-btn" style="background: none; border: none; color: rgba(255,255,255,0.5); font-size: 20px; cursor: pointer; line-height: 1; padding: 2px 6px;">&times;</button>
                            </div>

                            <!-- Options Body -->
                            <div id="daw-export-modal-form" style="padding: 20px; display: flex; flex-direction: column; gap: 16px; font-size: 12px;">
                                <!-- Mix Name -->
                                <div>
                                    <label style="display: block; font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.7); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Master File Name</label>
                                    <input type="text" id="daw-export-name-input" value="Master Episode Mixdown" style="width: 100%; box-sizing: border-box; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.18); border-radius: 8px; padding: 9px 12px; color: #ffffff; font-size: 13px; font-weight: 600; outline: none; transition: border 0.15s;">
                                </div>

                                <!-- Export Format & Quality -->
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                    <div>
                                        <label style="display: block; font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.7); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Format</label>
                                        <select id="daw-export-format-select" style="width: 100%; box-sizing: border-box; background: #0e121d; border: 1px solid rgba(255,255,255,0.18); border-radius: 8px; padding: 9px 10px; color: #ffffff; font-size: 12px; font-weight: 700; outline: none; cursor: pointer;">
                                            <option value="wav_441" selected>WAV 16-bit · 44.1kHz (Cinema & Podcast)</option>
                                            <option value="wav_480">WAV 16-bit · 48.0kHz (Film Sound SMPTE)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style="display: block; font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.7); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Ceiling Normalization</label>
                                        <select id="daw-export-norm-select" style="width: 100%; box-sizing: border-box; background: #0e121d; border: 1px solid rgba(255,255,255,0.18); border-radius: 8px; padding: 9px 10px; color: #ffffff; font-size: 12px; font-weight: 700; outline: none; cursor: pointer;">
                                            <option value="on" selected>On (-0.5 dBFS Broadcast Safe)</option>
                                            <option value="off">Bypass (Raw Bus Master Gain)</option>
                                        </select>
                                    </div>
                                </div>

                                <!-- Export Range (Full Timeline vs Punch In/Out Region) -->
                                <div>
                                    <label style="display: block; font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.7); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Export Timeline Range</label>
                                    <select id="daw-export-range-select" style="width: 100%; box-sizing: border-box; background: #0e121d; border: 1px solid rgba(255,255,255,0.18); border-radius: 8px; padding: 9px 10px; color: #ffffff; font-size: 12px; font-weight: 700; outline: none; cursor: pointer;">
                                        <option value="full" selected>Full Timeline Project (00:00 to End)</option>
                                        <option value="punch">Active In / Out Punch Region Only</option>
                                    </select>
                                </div>

                                <!-- Post-Render Actions -->
                                <div>
                                    <label style="display: block; font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.7); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Destination & Workflow</label>
                                    <div style="display: flex; flex-direction: column; gap: 8px;">
                                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: rgba(255,255,255,0.85); font-size: 12px;">
                                            <input type="checkbox" id="daw-export-save-takes" checked style="accent-color: #10b981; width: 15px; height: 15px; cursor: pointer;">
                                            <span>Save into Session Take Inventory</span>
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: rgba(255,255,255,0.85); font-size: 12px;">
                                            <input type="checkbox" id="daw-export-open-publisher" checked style="accent-color: #10b981; width: 15px; height: 15px; cursor: pointer;">
                                            <span>Transfer audio & open Episode Publisher</span>
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: rgba(255,255,255,0.85); font-size: 12px;">
                                            <input type="checkbox" id="daw-export-auto-download" checked style="accent-color: #10b981; width: 15px; height: 15px; cursor: pointer;">
                                            <span>Trigger instant studio WAV file download</span>
                                        </label>
                                    </div>
                                </div>

                                <!-- Timeline Summary Pill -->
                                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: rgba(255,255,255,0.7);">
                                    <span id="daw-export-summary-dur">Duration: 00:00</span>
                                    <span id="daw-export-summary-clips">Clips: 0</span>
                                    <span id="daw-export-summary-tracks">Tracks: 0</span>
                                </div>
                            </div>

                            <!-- Rendering Progress HUD (Shown during OfflineAudioContext render) -->
                            <div id="daw-export-progress-hud" style="display: none; padding: 36px 24px; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 14px;">
                                <div style="width: 48px; height: 48px; border-radius: 50%; border: 3px solid rgba(16,185,129,0.2); border-top-color: #10b981; animation: spin 0.8s linear infinite;"></div>
                                <div>
                                    <h5 id="daw-export-progress-title" style="margin: 0 0 4px; font-size: 14px; font-weight: 800; color: #ffffff;">Synthesizing Multi-Track Mixdown...</h5>
                                    <span id="daw-export-progress-sub" style="font-size: 11.5px; color: rgba(255,255,255,0.6);">Computing Web Audio DSP FX chains & volume curves</span>
                                </div>
                                <div style="width: 100%; max-width: 380px; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden; margin-top: 6px;">
                                    <div id="daw-export-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #10b981 0%, #34d399 100%); transition: width 0.15s ease;"></div>
                                </div>
                                <span id="daw-export-progress-percent" style="font-size: 11px; font-family: monospace; font-weight: 700; color: #10b981;">0%</span>
                            </div>

                            <!-- Footer -->
                            <div id="daw-export-modal-footer" style="padding: 14px 20px; border-top: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                                <button id="daw-export-cancel-btn" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.16); color: #ffffff; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">Cancel</button>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <button id="daw-export-stems-btn" type="button" style="background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 750; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; transition: all 0.15s;" title="Render and export each active track separately as a bundled .ZIP archive">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/></svg>
                                        Stems (.ZIP)
                                    </button>
                                    <button id="daw-export-confirm-btn" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: 1px solid rgba(16,185,129,0.5); color: #ffffff; padding: 8px 18px; border-radius: 8px; font-size: 12px; font-weight: 800; cursor: pointer; box-shadow: 0 0 16px rgba(16,185,129,0.35); display: inline-flex; align-items: center; gap: 6px;">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                                        Render Master WAV
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <!-- Audio Ingestion Specs & Metadata Inspector Modal (v1.7.9) -->
                    <div id="daw-import-inspect-modal" style="position: absolute; inset: 0; background: rgba(0,0,0,0.88); backdrop-filter: blur(16px); z-index: 3200; display: none; align-items: center; justify-content: center; padding: 20px;">
                        <div style="background: #090c14; border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 18px; width: 100%; max-width: 580px; box-shadow: 0 32px 80px rgba(0,0,0,0.95), 0 0 24px rgba(56, 189, 248, 0.15); display: flex; flex-direction: column; overflow: hidden; position: relative;">
                            <!-- Header -->
                            <div style="padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.02); display: flex; align-items: center; justify-content: space-between;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(56,189,248,0.15); border: 1px solid rgba(56,189,248,0.35); display: flex; align-items: center; justify-content: center;">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                                    </div>
                                    <div>
                                        <h4 style="font-size: 14px; font-weight: 800; color: #ffffff; margin: 0; letter-spacing: 0.3px;">Audio Ingestion &amp; File Specs Inspector</h4>
                                        <span style="font-size: 10.5px; color: rgba(255,255,255,0.55);">Verify audio container, sample rate, bit depth &amp; channels before timeline placement</span>
                                    </div>
                                </div>
                                <button id="daw-import-inspect-close-btn" style="background: none; border: none; color: rgba(255,255,255,0.5); font-size: 20px; cursor: pointer; line-height: 1; padding: 2px 6px;">&times;</button>
                            </div>

                            <!-- Body -->
                            <div style="padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px;">
                                <!-- File Name & Type Hero Pill -->
                                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                                    <div style="min-width: 0; flex: 1;">
                                        <div style="font-size: 9.5px; font-weight: 800; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">FILE NAME</div>
                                        <div id="daw-inspect-filename" style="font-size: 13px; font-weight: 800; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">audio_track.wav</div>
                                    </div>
                                    <div style="display: flex; gap: 6px; flex-shrink: 0;">
                                        <span id="daw-inspect-badge-format" style="background: rgba(56,189,248,0.18); border: 1px solid rgba(56,189,248,0.4); color: #38bdf8; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 5px; font-family: monospace;">WAV</span>
                                        <span id="daw-inspect-badge-channels" style="background: rgba(52,211,153,0.18); border: 1px solid rgba(52,211,153,0.4); color: #34d399; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 5px; font-family: monospace;">STEREO</span>
                                    </div>
                                </div>

                                <!-- Technical Audio Specs Grid (2x3 Grid) -->
                                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                                    <!-- Sample Rate -->
                                    <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 12px;">
                                        <div style="font-size: 9px; font-weight: 800; color: rgba(255,255,255,0.45); text-transform: uppercase; margin-bottom: 3px;">SAMPLE RATE</div>
                                        <div id="daw-inspect-samplerate" style="font-size: 13px; font-weight: 800; color: #38bdf8; font-family: monospace;">44,100 Hz</div>
                                        <div id="daw-inspect-sr-sub" style="font-size: 9px; color: rgba(255,255,255,0.4); margin-top: 2px;">Standard Broadcast</div>
                                    </div>

                                    <!-- Duration -->
                                    <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 12px;">
                                        <div style="font-size: 9px; font-weight: 800; color: rgba(255,255,255,0.45); text-transform: uppercase; margin-bottom: 3px;">DURATION</div>
                                        <div id="daw-inspect-duration" style="font-size: 13px; font-weight: 800; color: #34d399; font-family: monospace;">00:00.00</div>
                                        <div id="daw-inspect-dur-samples" style="font-size: 9px; color: rgba(255,255,255,0.4); margin-top: 2px;">0 samples</div>
                                    </div>

                                    <!-- File Size -->
                                    <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 12px;">
                                        <div style="font-size: 9px; font-weight: 800; color: rgba(255,255,255,0.45); text-transform: uppercase; margin-bottom: 3px;">FILE SIZE</div>
                                        <div id="daw-inspect-filesize" style="font-size: 13px; font-weight: 800; color: #fbbf24; font-family: monospace;">0.00 MB</div>
                                        <div id="daw-inspect-mime" style="font-size: 9px; color: rgba(255,255,255,0.4); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">audio/wav</div>
                                    </div>

                                    <!-- Channel Layout -->
                                    <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 12px;">
                                        <div style="font-size: 9px; font-weight: 800; color: rgba(255,255,255,0.45); text-transform: uppercase; margin-bottom: 3px;">CHANNELS</div>
                                        <div id="daw-inspect-channels-desc" style="font-size: 13px; font-weight: 800; color: #ffffff; font-family: monospace;">2 (L / R Stereo)</div>
                                        <div style="font-size: 9px; color: rgba(255,255,255,0.4); margin-top: 2px;">Interleaved Web Audio</div>
                                    </div>

                                    <!-- Peak Level -->
                                    <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 12px;">
                                        <div style="font-size: 9px; font-weight: 800; color: rgba(255,255,255,0.45); text-transform: uppercase; margin-bottom: 3px;">PEAK AMPLITUDE</div>
                                        <div id="daw-inspect-peak" style="font-size: 13px; font-weight: 800; color: #a78bfa; font-family: monospace;">-0.0 dBFS</div>
                                        <div id="daw-inspect-headroom" style="font-size: 9px; color: rgba(255,255,255,0.4); margin-top: 2px;">Safe Headroom</div>
                                    </div>

                                    <!-- Estimated Bitrate / Bit Depth -->
                                    <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 12px;">
                                        <div style="font-size: 9px; font-weight: 800; color: rgba(255,255,255,0.45); text-transform: uppercase; margin-bottom: 3px;">BIT DEPTH / BITRATE</div>
                                        <div id="daw-inspect-bitdepth" style="font-size: 13px; font-weight: 800; color: #38bdf8; font-family: monospace;">16-bit / 1411 kbps</div>
                                        <div id="daw-inspect-codec" style="font-size: 9px; color: rgba(255,255,255,0.4); margin-top: 2px;">PCM Uncompressed</div>
                                    </div>
                                </div>

                                <!-- Audio Waveform Quick Preview Bar -->
                                <div style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;">
                                    <div style="display: flex; align-items: center; justify-content: space-between;">
                                        <span style="font-size: 10px; font-weight: 800; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 0.5px;">WAVEFORM PREVIEW &amp; AUDITION</span>
                                        <button id="daw-inspect-play-btn" type="button" style="background: rgba(56,189,248,0.18); border: 1px solid rgba(56,189,248,0.4); color: #38bdf8; padding: 3px 10px; border-radius: 5px; font-size: 10.5px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                                            <span>▶ Play Preview</span>
                                        </button>
                                    </div>
                                    <div id="daw-inspect-waveform-preview" style="height: 38px; display: flex; align-items: center; gap: 2px; padding: 0 4px; overflow: hidden; background: rgba(255,255,255,0.02); border-radius: 6px;"></div>
                                </div>

                                <!-- Placement Configuration Options -->
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px 14px;">
                                    <div>
                                        <label for="daw-inspect-target-track" style="display: block; font-size: 10.5px; font-weight: 800; color: rgba(255,255,255,0.7); margin-bottom: 5px;">DESTINATION TRACK</label>
                                        <select id="daw-inspect-target-track" style="width: 100%; background: #000000; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: #ffffff; padding: 6px 10px; font-size: 11.5px; font-weight: 600; outline: none;"></select>
                                    </div>
                                    <div>
                                        <label for="daw-inspect-placement-pos" style="display: block; font-size: 10.5px; font-weight: 800; color: rgba(255,255,255,0.7); margin-bottom: 5px;">TIMELINE POSITION</label>
                                        <select id="daw-inspect-placement-pos" style="width: 100%; background: #000000; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: #ffffff; padding: 6px 10px; font-size: 11.5px; font-weight: 600; outline: none;">
                                            <option value="playhead">At Current Playhead</option>
                                            <option value="start">At Project Start (00:00)</option>
                                            <option value="end">At End of Existing Clips</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <!-- Footer -->
                            <div style="padding: 14px 20px; border-top: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: space-between;">
                                <button id="daw-inspect-cancel-btn" type="button" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.18); color: rgba(255,255,255,0.8); padding: 8px 16px; border-radius: 8px; font-size: 11.5px; font-weight: 700; cursor: pointer;">Cancel</button>
                                <button id="daw-inspect-confirm-btn" type="button" style="background: linear-gradient(135deg, #38bdf8 0%, #0284c7 100%); border: 1px solid rgba(56,189,248,0.5); color: #ffffff; padding: 8px 20px; border-radius: 8px; font-size: 12px; font-weight: 800; cursor: pointer; box-shadow: 0 0 16px rgba(56,189,248,0.35); display: inline-flex; align-items: center; gap: 6px;">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                                    Insert onto Timeline
                                </button>
                            </div>
                        </div>
                    </div>
                    <!-- About Alan Joyce & LocalFilm Founder Vision Modal -->
                    <div id="daw-about-founder-modal" style="position: absolute; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(14px); z-index: 3200; display: none; align-items: center; justify-content: center; padding: 20px;">
                        <div style="background: #0d111a; border: 1px solid rgba(255,255,255,0.18); border-radius: 16px; width: 100%; max-width: 620px; max-height: 88vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,0.95);">
                            <!-- Header -->
                            <div style="padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.02); display: flex; align-items: center; justify-content: space-between;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%); border: 1px solid rgba(56, 189, 248, 0.35); display: flex; align-items: center; justify-content: center;">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                                    </div>
                                    <div>
                                        <h4 style="font-size: 13.5px; font-weight: 800; color: #ffffff; margin: 0; letter-spacing: 0.3px;">About Alan Joyce &amp; LocalFilm</h4>
                                        <span style="font-size: 10.5px; color: #38bdf8; font-weight: 600;">Founder of localfilm.online • Community-Driven Film &amp; Audio Infrastructure</span>
                                    </div>
                                </div>
                                <button id="daw-about-founder-close-btn" style="background: none; border: none; color: rgba(255,255,255,0.5); font-size: 20px; font-weight: 800; cursor: pointer; line-height: 1; padding: 0 4px;">&times;</button>
                            </div>
                            <!-- Story & Mission Body -->
                            <div style="flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; font-size: 12.5px; line-height: 1.6; color: rgba(255,255,255,0.85);">
                                <div style="background: rgba(56, 189, 248, 0.04); border: 1px solid rgba(56, 189, 248, 0.18); border-radius: 10px; padding: 14px 16px;">
                                    <h5 style="margin: 0 0 6px; font-size: 12px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px;">A Platform Built by Creators, for Creators</h5>
                                    <p style="margin: 0;"><strong>Alan Joyce</strong> founded <span style="color: #ffffff;">localfilm.online</span> and the LocalFilm Network with a clear conviction: in an era of centralized media monopolies and escalating paywalls, independent film and audio storytellers across Ireland's 32 counties need sovereign, high-fidelity creative infrastructure that puts craft and community first.</p>
                                </div>

                                <div>
                                    <h5 style="margin: 0 0 6px; font-size: 12px; font-weight: 800; color: #34d399; text-transform: uppercase; letter-spacing: 0.5px;">Why Community &amp; Giving Back Matters</h5>
                                    <p style="margin: 0 0 10px;">In our fast-paced, hyper-connected yet often isolating modern world, genuine creative communities are rare and vital. Giving back isn't merely an ideal—it is the bedrock of sustainability. LocalFilm was built to bridge Dublin and the regional hubs, from Galway to Wicklow, Cork, Derry, and Donegal, democratizing access to professional studio tools so that no voice is excluded by budget or geography.</p>
                                    <p style="margin: 0;">Mentorship, shared tools, collaborative audio mixing, and community feedback give emerging directors, sound designers, and independent podcasters the confidence to tell authentic stories that reflect their roots.</p>
                                </div>

                                <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                    <div>
                                        <span style="display: block; font-size: 9.5px; font-weight: 700; color: rgba(255,255,255,0.5); text-transform: uppercase;">Audio Technology</span>
                                        <span style="font-size: 11.5px; font-weight: 700; color: #ffffff;">LocalFilm Studio DAW v1.6.50</span>
                                        <p style="margin: 2px 0 0; font-size: 10.5px; color: rgba(255,255,255,0.6);">Native Web Audio DSP Suite with 10 Open-Source Plugins</p>
                                    </div>
                                    <div>
                                        <span style="display: block; font-size: 9.5px; font-weight: 700; color: rgba(255,255,255,0.5); text-transform: uppercase;">Founder &amp; Architect</span>
                                        <span style="font-size: 11.5px; font-weight: 700; color: #ffffff;">Alan Joyce</span>
                                        <p style="margin: 2px 0 0; font-size: 10.5px; color: rgba(255,255,255,0.6);"><a href="https://localfilm.online" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; text-decoration: none;">localfilm.online</a></p>
                                    </div>
                                </div>
                            </div>
                            <!-- Footer -->
                            <div style="padding: 12px 20px; border-top: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: space-between;">
                                <span style="font-size: 10.5px; color: rgba(255,255,255,0.5);">LocalFilm Ireland • Empowering Creative Voices</span>
                                <button id="daw-about-founder-ok-btn" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: none; color: #fff; padding: 6px 20px; border-radius: 6px; font-size: 11.5px; font-weight: 800; cursor: pointer; box-shadow: 0 0 12px rgba(16, 185, 129, 0.35);">Close</button>
                            </div>
                        </div>
                    </div>

        </div>
    `;

    await loadEpisodes();
    setupEventListeners(isAdmin);
}

// ── Shared Helper to resolve authoritative LiveKit WebSocket URL ──────────────
const resolveLiveKitWsUrl = (serverWsUrl) => {
    try {
        const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const localWsUrl = `${wsProto}//${window.location.host}/livekit`;
        if (!serverWsUrl) return localWsUrl;
        const parsed = new URL(serverWsUrl);
        if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
            if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                parsed.hostname = window.location.hostname;
                parsed.port = window.location.port;
                parsed.protocol = wsProto;
                return parsed.toString();
            }
        }
        return serverWsUrl;
    } catch (e) {
        const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${wsProto}//${window.location.host}/livekit`;
    }
};

// FEATURE 3: Remote Guest Recorder View & Live Studio Connectivity
function renderRemoteGuestStudioPage(container, sessionId, guestName) {
    const safeGuestName = (guestName || 'Co-Host').trim();
    const cleanGuestTag = safeGuestName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'guest';

    const renderGuestAccessDeniedScreen = (title, message, isExpired = false) => {
        releaseStudioWakeLock();
        if (typeof pingInterval !== 'undefined' && pingInterval) clearInterval(pingInterval);
        if (typeof currentGuestStream !== 'undefined' && currentGuestStream) {
            try { currentGuestStream.getTracks().forEach(t => t.stop()); } catch (e) {}
        }
        if (typeof guestLKRoom !== 'undefined' && guestLKRoom) {
            try { guestLKRoom.disconnect(); } catch (e) {}
        }
        container.innerHTML = `
            <div style="background: #07080c; color: #ffffff; min-height: 100vh; min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: clamp(12px, 3vw, 24px); padding-bottom: max(clamp(12px, 3vw, 24px), env(safe-area-inset-bottom, 24px)); font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
                <div style="background: #0c0e15; border: 1px solid rgba(255,255,255,0.15); border-radius: clamp(16px, 3vw, 24px); max-width: 520px; width: 100%; padding: clamp(20px, 4vw, 36px); text-align: center; box-shadow: 0 32px 64px rgba(0,0,0,0.9);">
                    <div style="width: 54px; height: 54px; border-radius: 50%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                    </div>
                    <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 20px; margin-bottom: 16px;">
                        <span style="font-size: 10px; font-weight: 900; letter-spacing: 1px; color: #ffffff; text-transform: uppercase;">LOCALFILM STUDIO SECURITY</span>
                    </div>
                    <h1 style="font-size: 22px; font-weight: 900; margin: 0 0 10px; letter-spacing: -0.5px; color: #ffffff;">${title}</h1>
                    <p style="font-size: 13px; color: rgba(255,255,255,0.65); line-height: 1.6; margin: 0 0 28px;">${message}</p>
                    <div style="display: flex; flex-direction: column; gap: 12px; align-items: center;">
                        <a href="/podcasts" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: #ffffff; color: #07080c; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-size: 13px; font-weight: 800; width: 100%; max-width: 320px; transition: transform 0.2s;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                            Return to LocalFilm Podcasts Archive
                        </a>
                    </div>
                </div>
            </div>
        `;
    };

    container.innerHTML = `
        <div style="background: #07080c; color: #ffffff; min-height: 100vh; min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: clamp(12px, 3vw, 24px); padding-bottom: max(clamp(12px, 3vw, 24px), env(safe-area-inset-bottom, 24px)); font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
            <div style="background: #0c0e15; border: 1px solid rgba(255,255,255,0.15); border-radius: clamp(16px, 3vw, 24px); max-width: 640px; width: 100%; padding: clamp(20px, 4vw, 36px); text-align: center; box-shadow: 0 32px 64px rgba(0,0,0,0.9);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 8px;">
                    <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); padding: 5px 14px; border-radius: 20px;">
                        <span style="width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px #10b981; display: inline-block;"></span>
                        <span style="font-size: 11px; font-weight: 900; letter-spacing: 1px; color: #10b981; text-transform: uppercase;">LOCALFILM REMOTE GUEST STUDIO</span>
                    </div>
                    <span id="guest-conn-status-badge" title="Live status of your connection to the studio control room" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); padding: 5px 12px; border-radius: 8px; font-size: 11px; font-weight: 800; color: #ffffff; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;">
                        <span style="width: 7px; height: 7px; border-radius: 50%; background: #ffffff;"></span>
                        Connecting...
                    </span>
                </div>

                <div style="text-align: center; margin-bottom: 18px;">
                    <img src="/logo.png" alt="LocalFilm Ireland Logo" style="height: 44px; width: auto; object-fit: contain; margin-bottom: 12px; filter: drop-shadow(0 2px 12px rgba(0,0,0,0.8));">
                    <h1 style="font-size: 26px; font-weight: 900; margin: 0 0 6px; letter-spacing: -0.5px;">Welcome, ${safeGuestName}!</h1>
                    <p style="font-size: 13px; color: rgba(255,255,255,0.6); margin: 0;">Connected to presenter live broadcast room. Your isolated track will auto-record synchronously.</p>
                </div>

                <!-- Sleek Monochrome Waiting Room Banner -->
                <div id="guest-waiting-room-banner" style="display: none; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 16px; padding: 18px 20px; text-align: left; margin-bottom: 20px; box-shadow: 0 8px 24px rgba(0,0,0,0.5);">
                    <div style="display: flex; align-items: flex-start; gap: 14px;">
                        <div style="width: 36px; height: 36px; border-radius: 50%; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.25); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                        </div>
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
                                <span style="font-size: 13px; font-weight: 900; color: #ffffff; letter-spacing: 0.5px; text-transform: uppercase;">Studio Waiting Room</span>
                                <span style="font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.7); display: inline-flex; align-items: center; gap: 6px;">
                                    <span style="width: 6px; height: 6px; border-radius: 50%; background: #ffffff; box-shadow: 0 0 6px rgba(255,255,255,0.8);"></span>
                                    Awaiting Presenter
                                </span>
                            </div>
                            <div style="font-size: 12px; color: rgba(255,255,255,0.75); line-height: 1.5;">
                                The presenter has not opened the live recording studio yet. You can test your microphone and adjust headphones below. You will be automatically admitted into the live session as soon as the presenter enters!
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Headphone & Acoustic Advisory Banner -->
                <div id="guest-headphone-advisory-banner" style="display: none; background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 14px; padding: 14px 18px; margin-bottom: 20px; text-align: left; position: relative;">
                    <div style="display: flex; align-items: flex-start; gap: 12px;">
                        <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.4); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" aria-hidden="true"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-size: 12px; font-weight: 800; color: #38bdf8; letter-spacing: 0.5px; text-transform: uppercase;">Acoustic Notice: Headphones Recommended</div>
                            <div style="font-size: 11px; color: rgba(255,255,255,0.75); line-height: 1.4; margin-top: 2px;">
                                Plug in headphones or AirPods to prevent audio feedback between your speakers and microphone.
                            </div>
                        </div>
                        <button id="dismiss-headphone-advisory-btn" style="background: none; border: none; color: rgba(255,255,255,0.5); cursor: pointer; padding: 2px 6px; font-size: 16px; line-height: 1;" title="Dismiss advisory">&times;</button>
                    </div>
                </div>

                <!-- Color-Coded High-Contrast 1-2-3 Step Guest Guide -->
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 18px 20px; text-align: left; margin-bottom: 20px;">
                    <div style="font-size: 11px; font-weight: 900; letter-spacing: 0.5px; color: rgba(255,255,255,0.7); text-transform: uppercase; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                        3-Step Guest Studio Guide
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px;">
                        <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.25); border-top: 2px solid #10b981; border-radius: 12px; padding: 12px 14px;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                <span style="width: 20px; height: 20px; border-radius: 50%; background: #10b981; color: #07080c; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900;">1</span>
                                <span style="font-size: 12px; font-weight: 800; color: #10b981;">Mic Check</span>
                            </div>
                            <div style="font-size: 11px; color: rgba(255,255,255,0.7); line-height: 1.4;">Select input below &amp; speak to verify your voice level meter bounces.</div>
                        </div>
                        <div style="background: rgba(56, 189, 248, 0.05); border: 1px solid rgba(56, 189, 248, 0.25); border-top: 2px solid #38bdf8; border-radius: 12px; padding: 12px 14px;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                <span style="width: 20px; height: 20px; border-radius: 50%; background: #38bdf8; color: #07080c; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900;">2</span>
                                <span style="font-size: 12px; font-weight: 800; color: #38bdf8;">Headphones</span>
                            </div>
                            <div style="font-size: 11px; color: rgba(255,255,255,0.7); line-height: 1.4;">Wear headphones or AirPods to eliminate echo and acoustic feedback.</div>
                        </div>
                        <div style="background: rgba(168, 85, 247, 0.05); border: 1px solid rgba(168, 85, 247, 0.25); border-top: 2px solid #a855f7; border-radius: 12px; padding: 12px 14px;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                <span style="width: 20px; height: 20px; border-radius: 50%; background: #a855f7; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900;">3</span>
                                <span style="font-size: 12px; font-weight: 800; color: #c084fc;">Auto-Sync Rec</span>
                            </div>
                            <div style="font-size: 11px; color: rgba(255,255,255,0.7); line-height: 1.4;">When the presenter clicks Record, your mic captures in sync. Cough Mute anytime.</div>
                        </div>
                    </div>
                </div>

                <!-- High-Visibility RED Armed & On-Air Status Banner -->
                <div id="guest-arm-banner" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.5); box-shadow: 0 0 24px rgba(239, 68, 68, 0.25); border-radius: 14px; padding: 14px 18px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; transition: all 0.3s ease;">
                    <div style="display: flex; align-items: center; gap: 10px; text-align: left;">
                        <span id="guest-arm-dot" style="width: 10px; height: 10px; border-radius: 50%; background: #ef4444; box-shadow: 0 0 10px #ef4444; display: inline-block; flex-shrink: 0;"></span>
                        <div>
                            <div id="guest-arm-title" style="font-size: 12px; font-weight: 900; letter-spacing: 0.5px; color: #ef4444; text-transform: uppercase;">RECORDING ARMED · STANDBY FOR HOST</div>
                            <div id="guest-arm-sub" style="font-size: 11px; color: rgba(255,255,255,0.7); font-weight: 600; margin-top: 2px;">Your mic is armed. When the presenter starts, your track records automatically.</div>
                        </div>
                    </div>
                    <span id="guest-arm-badge" style="background: rgba(239, 68, 68, 0.25); border: 1px solid rgba(239, 68, 68, 0.6); color: #ef4444; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 6px; white-space: nowrap;">ARMED</span>
                </div>

                <!-- Microphone Device Selector & Bidirectional VU Equalizers -->
                <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 20px; text-align: left; margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                        <label for="guest-mic-select" style="font-size: 12px; font-weight: 800; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 6px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                            Choose Microphone Device
                        </label>
                        <span id="guest-mic-type-badge" style="font-size: 10px; color: #10b981; background: rgba(16, 185, 129, 0.12); padding: 2px 6px; border-radius: 4px; font-weight: 700;">Hardware Input</span>
                    </div>

                    <select id="guest-mic-select" title="Select your hardware microphone (AirPods, USB audio interface, or built-in mic)" style="width: 100%; background: #07080c; border: 1px solid rgba(255, 255, 255, 0.15); color: #ffffff; padding: 10px 14px; border-radius: 10px; font-size: 13px; outline: none; margin-bottom: 16px; cursor: pointer;">
                        <option value="">Detecting Audio Devices (AirPods, USB Mics)...</option>
                    </select>

                    <!-- My Voice Level Meter -->
                    <div style="margin-bottom: 14px;">
                        <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.7); margin-bottom: 5px;">
                            <span style="color: #10b981;">My Microphone Voice Level</span>
                            <span id="guest-mic-level-label">Speaking Level: 0%</span>
                        </div>
                        <div style="height: 8px; width: 100%; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden;">
                            <div id="guest-mic-level-meter" style="width: 0%; height: 100%; background: linear-gradient(90deg, #10b981 0%, #34d399 70%, #f59e0b 90%, #ef4444 100%); transition: width 0.05s ease-out; border-radius: 4px;"></div>
                        </div>
                    </div>

                    <!-- Presenter Voice Level Meter (Return Audio) -->
                    <div style="margin-bottom: 16px;">
                        <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.7); margin-bottom: 5px;">
                            <span style="color: #38bdf8;">Presenter Audio (Live Studio Return)</span>
                            <span id="host-speaking-label">Listening for Presenter...</span>
                        </div>
                        <div style="height: 8px; width: 100%; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden;">
                            <div id="host-speaking-meter" style="width: 0%; height: 100%; background: linear-gradient(90deg, #38bdf8 0%, #60a5fa 70%, #818cf8 100%); transition: width 0.05s ease-out; border-radius: 4px;"></div>
                        </div>
                    </div>

                    <!-- Guest Cough / Privacy Mute Button -->
                    <button id="guest-cough-mute-btn" data-muted="0" title="Mute your microphone if you need to cough or need privacy. The presenter will see you have muted yourself." style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; padding: 10px 18px; border-radius: 10px; font-size: 12px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; transition: all 0.2s;">
                        <svg id="guest-cough-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                        <span id="guest-cough-label">Microphone Live (Click for Cough Mute)</span>
                    </button>
                </div>

                <!-- Guest Synchronized Recording Box -->
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 24px; margin-bottom: 20px;">
                    <div id="guest-timer" style="font-size: 40px; font-weight: 900; font-family: monospace; margin-bottom: 10px; color: #ffffff;">00:00:00</div>
                    <div style="display: flex; justify-content: center; margin-bottom: 16px;">
                        <canvas id="guest-waveform-canvas" width="400" height="40" style="width: 100%; max-width: 400px; height: 40px; border-radius: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); display: none;" aria-label="Guest microphone live voice waveform display"></canvas>
                    </div>
                    <button id="guest-record-btn" title="Manual capture control (auto-records when presenter starts recording)" style="background: #ffffff; color: #07080c; border: none; padding: 12px 28px; border-radius: 10px; font-weight: 900; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#07080c" aria-hidden="true"><circle cx="12" cy="12" r="10"/></svg>
                        Start Guest Recording
                    </button>
                    <div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 10px;">
                        Presenter controls start, pause, and stop automatically for both tracks.
                    </div>
                </div>

                <!-- Emergency Offline Stem Safety Banner (Shows if spotty network delays upload) -->
                <div id="guest-offline-safety-banner" style="display: none; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 14px; padding: 16px 18px; margin-bottom: 20px; text-align: left; box-shadow: 0 8px 24px rgba(0,0,0,0.4);">
                    <div style="display: flex; align-items: flex-start; gap: 12px;">
                        <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(245, 158, 11, 0.18); border: 1px solid rgba(245, 158, 11, 0.5); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-size: 12px; font-weight: 900; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                                Network Hiccup · Vocal Take Safely Preserved
                            </div>
                            <div style="font-size: 11px; color: rgba(255,255,255,0.8); line-height: 1.4; margin-bottom: 12px;">
                                Your isolated vocal track was recorded in full on this device. You can download the raw audio stem directly to your phone or computer right now so no audio is ever lost:
                            </div>
                            <a id="guest-offline-download-link" href="#" download="guest-vocal-stem.webm" style="display: inline-flex; align-items: center; gap: 6px; background: #f59e0b; color: #07080c; font-size: 11px; font-weight: 800; padding: 7px 16px; border-radius: 8px; text-decoration: none; transition: opacity 0.2s;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                Save Vocal Take to Device
                            </a>
                        </div>
                    </div>
                </div>

                <a href="/podcasts" id="guest-exit-link" style="color: rgba(255,255,255,0.5); text-decoration: none; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                    Return to LocalFilm Podcasts Archive
                </a>
            </div>
        </div>
    `;

    const btn = document.getElementById('guest-record-btn');
    const timer = document.getElementById('guest-timer');
    const guestMicSelect = document.getElementById('guest-mic-select');
    const guestLevelMeter = document.getElementById('guest-mic-level-meter');
    const connBadge = document.getElementById('guest-conn-status-badge');
    const coughMuteBtn = document.getElementById('guest-cough-mute-btn');
    let isGuestSelfMuted = false;
    let isGuestArmed = true;
    let currentGuestVoiceLevel = 0;

    let preferredGuestMicId = localStorage.getItem('localfilm_preferred_guest_mic_id') || '';
    let preferredGuestMicLabel = localStorage.getItem('localfilm_preferred_guest_mic_label') || '';
    let guestLKTrack = null;

    let rec = null;
    let chunks = [];
    let sec = 0;
    let timerInt = null;
    let currentGuestStream = null;
    let audioCtx = null;
    let analyser = null;
    let pingInterval = null;
    let isPublishingGuestMic = false;

    // ── Reusable Helper: Reliably publish guest mic to LiveKit studio room ────
    const publishGuestMicToLiveKit = async () => {
        if (!guestLKRoom || guestLKRoom.state !== 'connected') return;
        if (!currentGuestStream) return;
        const tracks = currentGuestStream.getAudioTracks();
        if (tracks.length === 0 || tracks[0].readyState !== 'live') return;

        if (isPublishingGuestMic) return;
        isPublishingGuestMic = true;

        try {
            const { LocalAudioTrack } = await import('livekit-client');
            if (guestLKTrack) {
                try {
                    await guestLKRoom.localParticipant.unpublishTrack(guestLKTrack);
                    guestLKTrack.stop();
                } catch (unpubErr) {}
                guestLKTrack = null;
            }
            tracks[0].enabled = !isGuestSelfMuted;
            guestLKTrack = new LocalAudioTrack(tracks[0]);
            await guestLKRoom.localParticipant.publishTrack(guestLKTrack);
            console.log('[Guest LK] Cleanly published guest mic track to LiveKit room');
        } catch (err) {
            console.warn('[Guest LK] Failed to publish guest mic track:', err.message);
        } finally {
            isPublishingGuestMic = false;
        }
    };

    // Stable guest identity stored per session
    const guestSessionKey = `podcast_guest_id_${sessionId}`;
    let guestId = sessionStorage.getItem(guestSessionKey);
    if (!guestId) {
        guestId = `g_${Math.random().toString(36).substring(2, 9)}`;
        sessionStorage.setItem(guestSessionKey, guestId);
    }
    const cleanGuestName = (guestName || 'Remote Guest').replace(/[^a-zA-Z0-9_-]/g, '_');
    const guestIdentity = `guest_${cleanGuestName}_${guestId}`;

    const urlParams = new URLSearchParams(window.location.search);
    const inviteToken = urlParams.get('invite_token') || sessionStorage.getItem(`podcast_invite_token_${sessionId}`) || '';
    if (inviteToken) {
        sessionStorage.setItem(`podcast_invite_token_${sessionId}`, inviteToken);
    }
    let isWaitingForPresenter = false;
    let isManualGuestRecording = false;
    let lastKnownHostRecState = 'idle';

    // ── Unlock Web Audio AudioContexts on any user interaction ────────────
    const unlockAudioContexts = () => {
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
        if (hostCtx && hostCtx.state === 'suspended') {
            hostCtx.resume().catch(() => {});
        }
    };
    ['click', 'keydown', 'touchstart'].forEach(evt => window.addEventListener(evt, unlockAudioContexts, { passive: true }));

    // ── Mobile Screen WakeLock for Guest Studio ───────────────────────────
    requestStudioWakeLock();
    const handleGuestVisibility = () => {
        if (document.visibilityState === 'visible') {
            requestStudioWakeLock();
        }
    };
    document.addEventListener('visibilitychange', handleGuestVisibility);

    // ── Leave session beacon on window close or navigation ──────────────────
    const leaveSessionBeacon = () => {
        releaseStudioWakeLock();
        try {
            document.removeEventListener('visibilitychange', handleGuestVisibility);
        } catch (e) {}
        try {
            const payload = JSON.stringify({ session_id: sessionId, guest_id: guestId });
            if (navigator.sendBeacon) {
                navigator.sendBeacon('/api/podcasts/guest-session/leave', new Blob([payload], { type: 'application/json' }));
            } else {
                fetch('/api/podcasts/guest-session/leave', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: payload,
                    keepalive: true
                }).catch(() => {});
            }
        } catch (e) {}
    };
    window.addEventListener('beforeunload', leaveSessionBeacon);
    const exitLink = document.getElementById('guest-exit-link');
    if (exitLink) exitLink.addEventListener('click', leaveSessionBeacon);

    // ── Register guest with backend session ─────────────────────────────────
    const registerGuestSession = async () => {
        try {
            const selectedMicLabel = guestMicSelect?.options[guestMicSelect.selectedIndex]?.text || 'Default Microphone';
            const res = await fetch('/api/podcasts/guest-session/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    guest_id: guestId,
                    guest_name: guestName,
                    invite_token: inviteToken,
                    device_label: selectedMicLabel
                })
            });

            if (res.status === 403) {
                const data = await res.json().catch(() => ({}));
                renderGuestAccessDeniedScreen('Invitation Link Already Used', data.error || 'This guest link has already been claimed by another device or participant. Guest links are single-use for security.', false);
                return false;
            }

            if (res.status === 410) {
                const data = await res.json().catch(() => ({}));
                renderGuestAccessDeniedScreen('Studio Link Expired', data.error || 'This guest invitation link has expired after 5 hours. Please contact the presenter for a new link.', true);
                return false;
            }

            if (res.status === 404) {
                const data = await res.json().catch(() => ({}));
                renderGuestAccessDeniedScreen('Studio Session Not Found', data.error || 'The requested recording studio session does not exist or has already ended.', false);
                return false;
            }

            const data = await res.json();
            const waitingBanner = document.getElementById('guest-waiting-room-banner');
            if (data.success) {
                if (data.waiting_room || !data.presenter_open) {
                    isWaitingForPresenter = true;
                    if (waitingBanner) waitingBanner.style.display = 'block';
                    if (connBadge) {
                        connBadge.innerHTML = '<span style="width: 7px; height: 7px; border-radius: 50%; background: #ffffff; box-shadow: 0 0 6px rgba(255,255,255,0.7); display: inline-block;"></span> Studio Waiting Room';
                        connBadge.style.color = 'rgba(255,255,255,0.85)';
                    }
                    setGuestArmVisual('standby');
                    return true;
                } else {
                    isWaitingForPresenter = false;
                    if (waitingBanner) waitingBanner.style.display = 'none';
                    if (data.armed !== undefined) {
                        isGuestArmed = data.armed;
                        setGuestArmVisual(isGuestArmed ? 'armed' : 'standby');
                    }
                    if (connBadge) {
                        connBadge.innerHTML = '<span style="width: 7px; height: 7px; border-radius: 50%; background: #ffffff; box-shadow: 0 0 6px rgba(255,255,255,0.8); display: inline-block;"></span> Connected to Studio Room';
                        connBadge.style.color = '#ffffff';
                    }
                    return true;
                }
            }
            return false;
        } catch (err) {
            if (connBadge) {
                connBadge.innerHTML = '<span style="width: 7px; height: 7px; border-radius: 50%; background: #ffffff; opacity: 0.6; display: inline-block;"></span> Auto-Reconnecting...';
            }
            return false;
        }
    };

    let lastGuestRtt = 0;
    // ── Heartbeat ping loop & server sync (Dual-Signal Fallback) ───────────
    const startPingLoop = () => {
        if (pingInterval) clearInterval(pingInterval);
        pingInterval = setInterval(async () => {
            try {
                const selectedMicLabel = guestMicSelect?.options[guestMicSelect.selectedIndex]?.text || 'Default Microphone';
                const pingStart = performance.now();
                const res = await fetch('/api/podcasts/guest-session/signal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session_id: sessionId,
                        guest_id: guestId,
                        action: 'ping',
                        device_label: selectedMicLabel,
                        self_muted: isGuestSelfMuted,
                        level: currentGuestVoiceLevel,
                        rtt: lastGuestRtt
                    })
                });

                if (res.status === 410) {
                    renderGuestAccessDeniedScreen('Studio Link Expired', 'This studio session has expired after 5 hours.', true);
                    return;
                }
                if (res.status === 404) {
                    renderGuestAccessDeniedScreen('Studio Session Ended', 'The studio recording session has concluded.', false);
                    return;
                }

                lastGuestRtt = Math.round(performance.now() - pingStart);
                const data = await res.json();
                const waitingBanner = document.getElementById('guest-waiting-room-banner');
                if (data.success) {
                    const rttStr = lastGuestRtt > 0 ? ` (${lastGuestRtt}ms)` : '';
                    if (data.presenter_open) {
                        if (isWaitingForPresenter) {
                            isWaitingForPresenter = false;
                            if (waitingBanner) waitingBanner.style.display = 'none';
                            if (connBadge) {
                                connBadge.innerHTML = `<span style="width: 7px; height: 7px; border-radius: 50%; background: #ffffff; box-shadow: 0 0 6px rgba(255,255,255,0.8); display: inline-block;"></span> Connected to Studio Room${rttStr}`;
                            }
                            await registerGuestSession();
                            if (!guestLKRoom || guestLKRoom.state === 'disconnected') {
                                await connectGuestToLiveKit();
                            }
                        } else if (connBadge && connBadge.textContent.includes('Reconnecting')) {
                            connBadge.innerHTML = `<span style="width: 7px; height: 7px; border-radius: 50%; background: #ffffff; box-shadow: 0 0 6px rgba(255,255,255,0.8); display: inline-block;"></span> Connected to Studio Room${rttStr}`;
                        }
                    } else {
                        // Presenter stepped out or not open yet
                        isWaitingForPresenter = true;
                        if (waitingBanner) waitingBanner.style.display = 'block';
                        if (connBadge) {
                            connBadge.innerHTML = '<span style="width: 7px; height: 7px; border-radius: 50%; background: #ffffff; box-shadow: 0 0 6px rgba(255,255,255,0.7); display: inline-block;"></span> Studio Waiting Room';
                        }
                    }

                    if (data.armed !== undefined && data.armed !== isGuestArmed && !isManualGuestRecording) {
                        isGuestArmed = data.armed;
                        if (!rec || rec.state === 'inactive') {
                            setGuestArmVisual(isGuestArmed ? 'armed' : 'standby');
                        }
                    }
                    // Remote Host Recording State sync via HTTP fallback
                    if (data.recording_state === 'recording' && (!rec || rec.state === 'inactive') && isGuestArmed && !isWaitingForPresenter) {
                        isManualGuestRecording = false;
                        lastKnownHostRecState = 'recording';
                        startGuestRecording();
                    } else if (data.recording_state === 'paused' && rec && rec.state === 'recording') {
                        pauseGuestRecording();
                    } else if (data.recording_state === 'recording' && rec && rec.state === 'paused') {
                        resumeGuestRecording();
                    } else if (data.recording_state === 'idle' && rec && rec.state !== 'inactive') {
                        if (!isManualGuestRecording || lastKnownHostRecState === 'recording') {
                            stopGuestRecording();
                            isManualGuestRecording = false;
                        }
                    }
                    if (data.recording_state) {
                        lastKnownHostRecState = data.recording_state;
                    }
                }
            } catch (err) {
                if (connBadge) {
                    connBadge.innerHTML = '<span style="width: 7px; height: 7px; border-radius: 50%; background: #ffffff; opacity: 0.6; display: inline-block;"></span> Auto-Reconnecting...';
                }
            }
        }, 2500);
    };

    const getAudioMediaDevices = () => {
        if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
            return navigator.mediaDevices;
        }
        const legacyGetUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
        if (legacyGetUserMedia) {
            return {
                getUserMedia: (constraints) => new Promise((resolve, reject) => legacyGetUserMedia.call(navigator, constraints, resolve, reject)),
                enumerateDevices: async () => []
            };
        }
        return null;
    };

    // ── Enumerate guest microphones (Preserves Active & User Preference) ──
    const enumerateGuestMics = async (selectedIdToKeep) => {
        const md = getAudioMediaDevices();
        if (!md || !md.enumerateDevices) return;
        try {
            const devices = await md.enumerateDevices();
            const audioInputs = devices.filter(d => d.kind === 'audioinput');
            if (guestMicSelect && audioInputs.length > 0) {
                const targetId = selectedIdToKeep || preferredGuestMicId || guestMicSelect.value;
                guestMicSelect.innerHTML = audioInputs.map(d => `
                    <option value="${d.deviceId}">${d.label || `Microphone ${d.deviceId.substring(0, 5)}`}</option>
                `).join('');

                const matchingOption = audioInputs.find(d => d.deviceId === targetId);
                if (matchingOption) {
                    guestMicSelect.value = targetId;
                } else if (preferredGuestMicLabel) {
                    const labelMatch = audioInputs.find(d => d.label && (
                        d.label.toLowerCase() === preferredGuestMicLabel.toLowerCase() ||
                        d.label.toLowerCase().includes(preferredGuestMicLabel.toLowerCase()) ||
                        preferredGuestMicLabel.toLowerCase().includes(d.label.toLowerCase())
                    ));
                    if (labelMatch) {
                        guestMicSelect.value = labelMatch.deviceId;
                        preferredGuestMicId = labelMatch.deviceId;
                        localStorage.setItem('localfilm_preferred_guest_mic_id', preferredGuestMicId);
                    }
                } else {
                    guestMicSelect.value = audioInputs[0].deviceId;
                }
            }

            // Headphone & acoustic feedback check based on device labels
            const hasHeadphones = devices.some(d => {
                const label = (d.label || '').toLowerCase();
                return label.includes('headphone') || label.includes('airpod') || label.includes('buds') || label.includes('earphone') || label.includes('bluetooth') || label.includes('headset') || label.includes('bose') || label.includes('wh-') || label.includes('wf-');
            });
            const advBanner = document.getElementById('guest-headphone-advisory-banner');
            if (advBanner && !sessionStorage.getItem('localfilm_dismiss_headphone_adv')) {
                advBanner.style.display = hasHeadphones ? 'none' : 'block';
            }
        } catch (e) {}
    };

    const dismissAdvBtn = document.getElementById('dismiss-headphone-advisory-btn');
    if (dismissAdvBtn) {
        dismissAdvBtn.onclick = () => {
            const advBanner = document.getElementById('guest-headphone-advisory-banner');
            if (advBanner) advBanner.style.display = 'none';
            sessionStorage.setItem('localfilm_dismiss_headphone_adv', '1');
        };
    }

    // ── Visual Helper for prominent RED Armed & Live Recording states ───────
    const setGuestArmVisual = (state) => {
        const banner = document.getElementById('guest-arm-banner');
        const dot = document.getElementById('guest-arm-dot');
        const title = document.getElementById('guest-arm-title');
        const sub = document.getElementById('guest-arm-sub');
        const badge = document.getElementById('guest-arm-badge');
        if (!banner || !title) return;

        if (state === 'recording') {
            banner.style.background = 'rgba(239, 68, 68, 0.22)';
            banner.style.borderColor = '#ef4444';
            banner.style.boxShadow = '0 0 28px rgba(239, 68, 68, 0.35)';
            if (dot) { dot.style.background = '#ef4444'; dot.style.boxShadow = '0 0 12px #ef4444'; }
            title.textContent = '🔴 ON-AIR RECORDING · BROADCASTING TO PRESENTER';
            title.style.color = '#ef4444';
            if (sub) { sub.textContent = 'Studio recording in progress. Your high-definition isolated vocal take is capturing in real time.'; sub.style.color = '#ffffff'; }
            if (badge) { badge.textContent = 'LIVE ON-AIR'; badge.style.background = '#ef4444'; badge.style.borderColor = '#ef4444'; badge.style.color = '#ffffff'; }
        } else if (state === 'paused') {
            banner.style.background = 'rgba(245, 158, 11, 0.15)';
            banner.style.borderColor = 'rgba(245, 158, 11, 0.5)';
            banner.style.boxShadow = '0 0 20px rgba(245, 158, 11, 0.25)';
            if (dot) { dot.style.background = '#f59e0b'; dot.style.boxShadow = '0 0 10px #f59e0b'; }
            title.textContent = '🟡 RECORDING PAUSED BY PRESENTER';
            title.style.color = '#f59e0b';
            if (sub) { sub.textContent = 'The studio recording is temporarily paused. Your microphone remains live for discussion.'; sub.style.color = 'rgba(255,255,255,0.8)'; }
            if (badge) { badge.textContent = 'PAUSED'; badge.style.background = 'rgba(245, 158, 11, 0.25)'; badge.style.borderColor = 'rgba(245, 158, 11, 0.6)'; badge.style.color = '#f59e0b'; }
        } else if (state === 'saving') {
            banner.style.background = 'rgba(255, 255, 255, 0.08)';
            banner.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            banner.style.boxShadow = '0 0 20px rgba(255,255,255,0.15)';
            if (dot) { dot.style.background = '#ffffff'; dot.style.boxShadow = '0 0 8px #ffffff'; }
            title.textContent = '⏳ SYNCING VOCAL TAKE TO PRESENTER...';
            title.style.color = '#ffffff';
            if (sub) { sub.textContent = 'Sending your isolated broadcast track to the studio master mix.'; sub.style.color = 'rgba(255,255,255,0.7)'; }
            if (badge) { badge.textContent = 'SYNCING'; badge.style.background = 'rgba(255,255,255,0.15)'; badge.style.borderColor = 'rgba(255,255,255,0.3)'; badge.style.color = '#ffffff'; }
        } else if (state === 'synced') {
            banner.style.background = 'rgba(255, 255, 255, 0.05)';
            banner.style.borderColor = 'rgba(255, 255, 255, 0.25)';
            banner.style.boxShadow = 'none';
            if (dot) { dot.style.background = '#ffffff'; dot.style.boxShadow = '0 0 8px #ffffff'; }
            title.textContent = '✅ TAKE SAVED · RECORDING ARMED FOR NEXT TAKE';
            title.style.color = '#ffffff';
            if (sub) { sub.textContent = 'Your vocal track is secured in the presenter take inventory. Ready for next take.'; sub.style.color = 'rgba(255,255,255,0.7)'; }
            if (badge) { badge.textContent = 'SAVED'; badge.style.background = 'rgba(255,255,255,0.15)'; badge.style.borderColor = 'rgba(255,255,255,0.3)'; badge.style.color = '#ffffff'; }
        } else if (state === 'armed') {
            banner.style.background = 'rgba(239, 68, 68, 0.15)';
            banner.style.borderColor = 'rgba(239, 68, 68, 0.5)';
            banner.style.boxShadow = '0 0 24px rgba(239, 68, 68, 0.25)';
            if (dot) { dot.style.background = '#ef4444'; dot.style.boxShadow = '0 0 10px #ef4444'; }
            title.textContent = 'RECORDING ARMED · STANDBY FOR PRESENTER';
            title.style.color = '#ef4444';
            if (sub) { sub.textContent = 'The presenter has armed your microphone. When the presenter clicks Record, your audio will synchronize automatically.'; sub.style.color = 'rgba(255,255,255,0.7)'; }
            if (badge) { badge.textContent = 'ARMED'; badge.style.background = 'rgba(239,68,68,0.25)'; badge.style.borderColor = 'rgba(239,68,68,0.6)'; badge.style.color = '#ef4444'; }
        } else {
            // Standby / Disarmed
            banner.style.background = 'rgba(255, 255, 255, 0.03)';
            banner.style.borderColor = 'rgba(255, 255, 255, 0.12)';
            banner.style.boxShadow = 'none';
            if (dot) { dot.style.background = 'rgba(255,255,255,0.3)'; dot.style.boxShadow = 'none'; }
            title.textContent = 'STANDBY / DISARMED';
            title.style.color = 'rgba(255,255,255,0.6)';
            if (sub) { sub.textContent = 'Presenter is setting up the studio. Stand by.'; sub.style.color = 'rgba(255,255,255,0.4)'; }
            if (badge) { badge.textContent = 'STANDBY'; badge.style.background = 'rgba(255,255,255,0.06)'; badge.style.borderColor = 'rgba(255,255,255,0.15)'; badge.style.color = '#ffffff'; }
        }
    };

    // ── Initialize Microphone Stream & Level Visualizer (Sticky Hardware Selection) ──
    const initGuestStream = async (requestedDeviceId) => {
        const md = getAudioMediaDevices();
        if (!md) {
            await showStudioAlert(
                'Microphone Access Restricted',
                'Browsers require accessing via http://localhost:3005 or HTTPS to enable microphone hardware.\n\nPlease open the link using http://localhost:3005 or enable HTTPS.'
            );
            return;
        }
        try {
            const targetDeviceId = requestedDeviceId || preferredGuestMicId || (guestMicSelect ? guestMicSelect.value : '');

            if (currentGuestStream) {
                currentGuestStream.getTracks().forEach(t => t.stop());
            }

            const baseAudioOpts = {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            };

            let stream = null;
            if (targetDeviceId) {
                try {
                    stream = await md.getUserMedia({
                        audio: { deviceId: { exact: targetDeviceId }, ...baseAudioOpts }
                    });
                } catch (exactErr) {
                    console.warn('[Guest Mic] Exact constraint failed, attempting ideal fallback:', exactErr.message);
                    try {
                        stream = await md.getUserMedia({
                            audio: { deviceId: { ideal: targetDeviceId }, ...baseAudioOpts }
                        });
                    } catch (idealErr) {
                        console.warn('[Guest Mic] Ideal constraint failed, falling back to default:', idealErr.message);
                        stream = await md.getUserMedia({ audio: baseAudioOpts });
                    }
                }
            } else {
                stream = await md.getUserMedia({ audio: baseAudioOpts });
            }

            currentGuestStream = stream;

            const activeTrack = currentGuestStream.getAudioTracks()[0];
            if (activeTrack) {
                const settings = activeTrack.getSettings ? activeTrack.getSettings() : {};
                const activeId = settings.deviceId || targetDeviceId;
                if (activeId) {
                    preferredGuestMicId = activeId;
                    localStorage.setItem('localfilm_preferred_guest_mic_id', activeId);
                }
                if (activeTrack.label) {
                    preferredGuestMicLabel = activeTrack.label;
                    localStorage.setItem('localfilm_preferred_guest_mic_label', activeTrack.label);
                }

                activeTrack.onended = async () => {
                    console.warn('[Guest Mic] Active microphone track ended / disconnected.');
                    await enumerateGuestMics();
                };
            }

            // Sync dropdown list and firmly lock selection
            await enumerateGuestMics(preferredGuestMicId);
            if (guestMicSelect && preferredGuestMicId) {
                guestMicSelect.value = preferredGuestMicId;
            }

            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') {
                audioCtx.resume().catch(() => {});
            }
            const src = audioCtx.createMediaStreamSource(currentGuestStream);
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64;
            src.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const micLevelLabel = document.getElementById('guest-mic-level-label');

            let lastDataSend = 0;
            const updateMeter = () => {
                if (!analyser) return;
                analyser.getByteFrequencyData(dataArray);

                // Speech band weighted sensitivity (bins 0-10 cover ~80Hz to 3.5kHz)
                let speechSum = 0;
                let peak = 0;
                const vocalBins = Math.min(10, dataArray.length);
                for (let i = 0; i < vocalBins; i++) {
                    speechSum += dataArray[i];
                    if (dataArray[i] > peak) peak = dataArray[i];
                }
                const speechAvg = speechSum / vocalBins;
                const speechVal = (speechAvg * 0.6) + (peak * 0.4);
                const pct = isGuestSelfMuted ? 0 : Math.min(100, Math.round((speechVal / 128) * 100));

                currentGuestVoiceLevel = pct;
                if (guestLevelMeter) guestLevelMeter.style.width = `${pct}%`;
                if (micLevelLabel) {
                    micLevelLabel.textContent = isGuestSelfMuted ? 'Muted (Cough Guard)' : `Speaking Level: ${pct}%`;
                    micLevelLabel.style.color = isGuestSelfMuted ? '#f59e0b' : (pct > 5 ? '#ffffff' : 'rgba(255,255,255,0.6)');
                }

                // Ultra-Fast Real-Time UDP DataChannel Broadcast to Presenter Studio (~30ms / 33fps)
                const now = performance.now();
                if (now - lastDataSend >= 30 && guestLKRoom && guestLKRoom.state === 'connected') {
                    lastDataSend = now;
                    try {
                        const levelPayload = JSON.stringify({
                            type: 'guest_level',
                            identity: guestIdentity,
                            guest_name: guestName,
                            level: pct,
                            muted: isGuestSelfMuted
                        });
                        guestLKRoom.localParticipant.publishData(
                            new TextEncoder().encode(levelPayload),
                            { reliable: false }
                        );
                    } catch (e) {}
                }

                requestAnimationFrame(updateMeter);
            };
            updateMeter();

            // Reliably publish / re-publish guest mic track to LiveKit room
            await publishGuestMicToLiveKit();
        } catch (err) {
            console.warn('[Guest Studio] Mic access issue:', err.message);
        }
    };

    // ── Guest Cough / Privacy Mute Button Handler ───────────────────────────
    if (coughMuteBtn) {
        coughMuteBtn.addEventListener('click', async () => {
            isGuestSelfMuted = !isGuestSelfMuted;
            coughMuteBtn.setAttribute('data-muted', isGuestSelfMuted ? '1' : '0');
            const label = document.getElementById('guest-cough-label');

            if (isGuestSelfMuted) {
                coughMuteBtn.style.background = 'rgba(239, 68, 68, 0.22)';
                coughMuteBtn.style.borderColor = '#ef4444';
                coughMuteBtn.style.color = '#ef4444';
                coughMuteBtn.style.boxShadow = '0 0 16px rgba(239, 68, 68, 0.3)';
                if (label) label.textContent = 'Cough / Privacy Muted (Click to Unmute)';
            } else {
                coughMuteBtn.style.background = 'rgba(16, 185, 129, 0.08)';
                coughMuteBtn.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                coughMuteBtn.style.color = '#34d399';
                coughMuteBtn.style.boxShadow = 'none';
                if (label) label.textContent = 'Microphone Live (Click for Cough Mute)';
            }

            // Mute / unmute local tracks
            if (currentGuestStream) {
                currentGuestStream.getAudioTracks().forEach(t => { t.enabled = !isGuestSelfMuted; });
            }
            if (guestLKTrack && guestLKTrack.mediaStreamTrack) {
                guestLKTrack.mediaStreamTrack.enabled = !isGuestSelfMuted;
            }

            // Notify LiveKit room & host
            if (guestLKRoom && guestLKRoom.state === 'connected') {
                try {
                    const msg = JSON.stringify({
                        type: 'guest_mute_status',
                        identity: guestIdentity,
                        muted: isGuestSelfMuted,
                        guest_name: guestName
                    });
                    guestLKRoom.localParticipant.publishData(new TextEncoder().encode(msg), { reliable: true });

                    // Broadcast zeroed level immediately on mute
                    const zeroLevelMsg = JSON.stringify({
                        type: 'guest_level',
                        identity: guestIdentity,
                        guest_name: guestName,
                        level: isGuestSelfMuted ? 0 : currentGuestVoiceLevel,
                        muted: isGuestSelfMuted
                    });
                    guestLKRoom.localParticipant.publishData(new TextEncoder().encode(zeroLevelMsg), { reliable: false });
                } catch (e) {}
            }

            // Send signal to backend
            fetch('/api/podcasts/guest-session/signal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    guest_id: guestId,
                    action: isGuestSelfMuted ? 'cough_muted' : 'unmuted',
                    device_label: guestMicSelect?.options[guestMicSelect.selectedIndex]?.text || 'Microphone'
                })
            }).catch(() => {});
        });
    }

    if (guestMicSelect) {
        guestMicSelect.addEventListener('change', async (e) => {
            const chosenId = e.target.value;
            preferredGuestMicId = chosenId;
            localStorage.setItem('localfilm_preferred_guest_mic_id', chosenId);
            const chosenOption = e.target.options[e.target.selectedIndex];
            if (chosenOption && chosenOption.text) {
                preferredGuestMicLabel = chosenOption.text;
                localStorage.setItem('localfilm_preferred_guest_mic_label', chosenOption.text);
            }
            await initGuestStream(chosenId);
            const selectedMicLabel = chosenOption?.text || 'Microphone';
            fetch('/api/podcasts/guest-session/signal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    guest_id: guestId,
                    action: 'ping',
                    device_label: selectedMicLabel
                })
            }).catch(() => {});
        });
    }

    // Shield against Bluetooth / AirPods audio profile auto-switching interrupting stream
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
        navigator.mediaDevices.addEventListener('devicechange', async () => {
            const activeTracks = currentGuestStream ? currentGuestStream.getAudioTracks() : [];
            const isStreamActive = activeTracks.some(t => t.readyState === 'live');
            await enumerateGuestMics(preferredGuestMicId);
            if (!isStreamActive && preferredGuestMicId) {
                await initGuestStream(preferredGuestMicId);
            }
        });
    }

    // ── LiveKit Guest Studio State ─────────────────────────────────────────
    let guestLKRoom = null;
    let hostCtx = null;
    let hostAnalyser = null;
    const hostAudioEls = [];

    const setGuestLKBadge = (state) => {
        if (!connBadge) return;
        const states = {
            offline: {
                html: '<span style="width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,0.3); display: inline-block;"></span> Studio Offline',
                color: 'rgba(255,255,255,0.6)',
                bg: 'rgba(255,255,255,0.06)',
                border: 'rgba(255,255,255,0.15)'
            },
            waiting: {
                html: '<span style="width: 7px; height: 7px; border-radius: 50%; background: #ffffff; box-shadow: 0 0 6px rgba(255,255,255,0.7); display: inline-block;"></span> Studio Waiting Room',
                color: '#ffffff',
                bg: 'rgba(255,255,255,0.08)',
                border: 'rgba(255,255,255,0.2)'
            },
            connecting: {
                html: '<span style="width: 7px; height: 7px; border-radius: 50%; background: #f59e0b; box-shadow: 0 0 6px #f59e0b; display: inline-block;"></span> Connecting to Studio…',
                color: '#f59e0b',
                bg: 'rgba(245, 158, 11, 0.12)',
                border: 'rgba(245, 158, 11, 0.35)'
            },
            connected: {
                html: '<span style="width: 7px; height: 7px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px #10b981; display: inline-block;"></span> Connected to Studio Room',
                color: '#10b981',
                bg: 'rgba(16, 185, 129, 0.12)',
                border: 'rgba(16, 185, 129, 0.4)'
            },
            reconnecting: {
                html: '<span style="width: 7px; height: 7px; border-radius: 50%; background: #f59e0b; opacity: 0.8; display: inline-block;"></span> Reconnecting…',
                color: '#f59e0b',
                bg: 'rgba(245, 158, 11, 0.12)',
                border: 'rgba(245, 158, 11, 0.35)'
            },
            recording: {
                html: '<span style="width: 7px; height: 7px; border-radius: 50%; background: #ef4444; box-shadow: 0 0 10px #ef4444; display: inline-block;"></span> On-Air Recording',
                color: '#ef4444',
                bg: 'rgba(239, 68, 68, 0.18)',
                border: 'rgba(239, 68, 68, 0.5)'
            }
        };
        const s = states[state] || states.offline;
        connBadge.innerHTML = s.html;
        connBadge.style.color = s.color;
        connBadge.style.background = s.bg;
        connBadge.style.borderColor = s.border;
    };

    // ── Connect Guest to LiveKit Podcast Room ───────────────────────────────
    const connectGuestToLiveKit = async () => {
        try {
            const { Room, RoomEvent, Track } = await import('livekit-client');
            const res = await fetch('/api/livekit/podcast-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    room_name: `podcast-studio-${sessionId}`,
                    identity: guestIdentity,
                    guest_name: guestName,
                    is_guest: true
                })
            });
            if (!res.ok) return;
            const { token: lkToken, wsUrl } = await res.json();

            setGuestLKBadge('connecting');

            guestLKRoom = new Room({ adaptiveStream: true, dynacast: true });

            guestLKRoom
                .on(RoomEvent.Connected, async () => {
                    setGuestLKBadge('connected');
                    await publishGuestMicToLiveKit();
                })
                .on(RoomEvent.Reconnecting, () => setGuestLKBadge('reconnecting'))
                .on(RoomEvent.Reconnected, async () => {
                    setGuestLKBadge('connected');
                    await publishGuestMicToLiveKit();
                })
                .on(RoomEvent.Disconnected, () => {
                    setGuestLKBadge('offline');
                    hostAudioEls.forEach(el => el.remove());
                    hostAudioEls.length = 0;
                    setTimeout(() => {
                        if (!guestLKRoom || guestLKRoom.state === 'disconnected') connectGuestToLiveKit();
                    }, 4000);
                })
                .on(RoomEvent.TrackSubscribed, (track) => {
                    if (track.kind === Track.Kind.Audio) {
                        const audioEl = track.attach();
                        audioEl.style.display = 'none';
                        audioEl.setAttribute('aria-hidden', 'true');
                        document.body.appendChild(audioEl);
                        hostAudioEls.push(audioEl);
                        audioEl.play().catch(() => {});

                        // Connect Web Audio Analyser to incoming presenter voice track
                        try {
                            hostCtx = new (window.AudioContext || window.webkitAudioContext)();
                            if (hostCtx.state === 'suspended') {
                                hostCtx.resume().catch(() => {});
                            }
                            const hostStream = new MediaStream([track.mediaStreamTrack]);
                            const hostSrc = hostCtx.createMediaStreamSource(hostStream);
                            hostAnalyser = hostCtx.createAnalyser();
                            hostAnalyser.fftSize = 64;
                            hostSrc.connect(hostAnalyser);

                            const hostData = new Uint8Array(hostAnalyser.frequencyBinCount);
                            const hostMeter = document.getElementById('host-speaking-meter');
                            const hostLabel = document.getElementById('host-speaking-label');

                            const updateHostVU = () => {
                                if (!hostAnalyser) return;
                                hostAnalyser.getByteFrequencyData(hostData);

                                // Speech band sensitivity for presenter audio
                                let speechSum = 0;
                                let peak = 0;
                                const vocalBins = Math.min(10, hostData.length);
                                for (let i = 0; i < vocalBins; i++) {
                                    speechSum += hostData[i];
                                    if (hostData[i] > peak) peak = hostData[i];
                                }
                                const speechAvg = speechSum / vocalBins;
                                const speechVal = (speechAvg * 0.6) + (peak * 0.4);
                                const pct = Math.min(100, Math.round((speechVal / 128) * 100));

                                if (hostMeter) hostMeter.style.width = `${pct}%`;
                                if (hostLabel) {
                                    hostLabel.textContent = pct > 4 ? `Presenter Voice: ${pct}%` : 'Listening for Presenter...';
                                    hostLabel.style.color = pct > 4 ? '#ffffff' : 'rgba(255,255,255,0.6)';
                                }
                                requestAnimationFrame(updateHostVU);
                            };
                            updateHostVU();
                        } catch (e) {
                            console.warn('[Guest Studio] Host audio analyser error:', e.message);
                        }
                    }
                })
                .on(RoomEvent.TrackUnsubscribed, (track) => {
                    track.detach();
                })
                .on(RoomEvent.DataReceived, (payload) => {
                    try {
                        const msg = JSON.parse(new TextDecoder().decode(payload));

                        // Ultra-Fast Real-Time Presenter Level Broadcast (<15ms latency)
                        if (msg.type === 'host_level' && typeof msg.level === 'number') {
                            const hostMeter = document.getElementById('host-speaking-meter');
                            const hostLabel = document.getElementById('host-speaking-label');
                            if (hostMeter) hostMeter.style.width = `${msg.level}%`;
                            if (hostLabel) {
                                hostLabel.textContent = msg.level > 4 ? `Presenter Voice: ${msg.level}%` : 'Listening for Presenter...';
                                hostLabel.style.color = msg.level > 4 ? '#ffffff' : 'rgba(255,255,255,0.6)';
                            }
                        }

                        // Studio Synchronized Remote Recording Commands
                        if (msg.type === 'studio_start_recording') {
                            isManualGuestRecording = false;
                            lastKnownHostRecState = 'recording';
                            startGuestRecording();
                        } else if (msg.type === 'studio_pause_recording') {
                            pauseGuestRecording();
                        } else if (msg.type === 'studio_resume_recording') {
                            resumeGuestRecording();
                        } else if (msg.type === 'studio_stop_recording') {
                            isManualGuestRecording = false;
                            lastKnownHostRecState = 'idle';
                            stopGuestRecording();
                        } else if (msg.type === 'arm') {
                            isGuestArmed = (msg.armed !== false);
                            if (!rec || rec.state === 'inactive') {
                                setGuestArmVisual(isGuestArmed ? 'armed' : 'standby');
                            }
                        } else if (msg.type === 'unmute_request') {
                            if (isGuestSelfMuted && coughMuteBtn) {
                                coughMuteBtn.click();
                            }
                        }
                    } catch (e) {}
                });

            const finalWsUrl = resolveLiveKitWsUrl(wsUrl);
            await guestLKRoom.connect(finalWsUrl, lkToken);

            // Publish guest mic audio track to LiveKit room for monitoring
            await publishGuestMicToLiveKit();
        } catch (err) {
            console.warn('[Guest LK] Connection failed:', err.message);
            setGuestLKBadge('offline');
        }
    };

    // ── Synchronized Guest Recording Methods ────────────────────────────────
    const startGuestRecording = async (isManual = false) => {
        if (!isGuestArmed && !isManual) return;
        if (rec && rec.state === 'recording') return;

        try {
            if (!currentGuestStream) await initGuestStream(preferredGuestMicId);
            if (!currentGuestStream || !(currentGuestStream instanceof MediaStream)) {
                console.warn('[Guest Studio] Cannot start recording — no active microphone stream.');
                return;
            }

            const supportedMime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac']
                .find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';

            rec = new MediaRecorder(currentGuestStream, supportedMime ? { mimeType: supportedMime } : undefined);
            chunks = [];
            rec.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) chunks.push(e.data);
            };

            rec.onstop = async () => {
                isManualGuestRecording = false;
                setGuestArmVisual('saving');
                const blob = new Blob(chunks, { type: supportedMime || 'audio/webm' });
                const blobUrl = URL.createObjectURL(blob);
                const durStr = (() => {
                    const m = Math.floor(sec / 60).toString().padStart(2, '0');
                    const s = (sec % 60).toString().padStart(2, '0');
                    return `${m}:${s}`;
                })();

                const ext = (supportedMime && supportedMime.includes('mp4')) ? 'mp4' : 'webm';
                let uploadedSuccessfully = false;
                let uploadData = null;

                // Resilient 3-attempt upload retry loop for spotty mobile networks
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        const form = new FormData();
                        form.append('audio', blob, `guest-take-${cleanGuestName}-${Date.now()}.${ext}`);
                        form.append('guest_name', guestName);
                        form.append('session_id', sessionId);
                        form.append('duration', durStr);

                        const uploadRes = await fetch('/api/podcasts/upload-guest-audio', {
                            method: 'POST',
                            body: form
                        });
                        if (uploadRes.ok) {
                            uploadData = await uploadRes.json();
                            if (uploadData && uploadData.success) {
                                uploadedSuccessfully = true;
                                break;
                            }
                        }
                    } catch (uploadErr) {
                        console.warn(`[Guest Studio] Upload attempt ${attempt}/3 failed:`, uploadErr.message);
                        if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
                    }
                }

                const offlineBanner = document.getElementById('guest-offline-safety-banner');
                const offlineLink = document.getElementById('guest-offline-download-link');

                if (uploadedSuccessfully && uploadData) {
                    if (offlineBanner) offlineBanner.style.display = 'none';
                    if (guestLKRoom && guestLKRoom.state === 'connected') {
                        const msg = JSON.stringify({
                            type: 'guest_recording_done',
                            guest_name: guestName,
                            take_url: uploadData.url || blobUrl,
                            duration: durStr,
                            duration_seconds: sec
                        });
                        await guestLKRoom.localParticipant.publishData(new TextEncoder().encode(msg), { reliable: true });
                    }
                } else {
                    // Spotty connection fallback: Display safety banner so co-host can download take directly
                    if (offlineBanner && offlineLink) {
                        offlineLink.href = blobUrl;
                        offlineLink.download = `guest-take-${cleanGuestName}-${Date.now()}.${ext}`;
                        offlineBanner.style.display = 'block';
                    }
                    if (guestLKRoom && guestLKRoom.state === 'connected') {
                        const msg = JSON.stringify({
                            type: 'guest_recording_done',
                            guest_name: guestName,
                            take_url: blobUrl,
                            duration: durStr,
                            duration_seconds: sec
                        });
                        await guestLKRoom.localParticipant.publishData(new TextEncoder().encode(msg), { reliable: true });
                    }
                }

                btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="#07080c" aria-hidden="true"><circle cx="12" cy="12" r="10"/></svg> Start Guest Recording`;
                btn.style.background = '#ffffff';
                btn.style.color = '#07080c';
                btn.style.border = 'none';
                setGuestLKBadge('connected');
                setGuestArmVisual('synced');

                const gWaveCanvas = document.getElementById('guest-waveform-canvas');
                if (gWaveCanvas) stopWaveformAnimation(gWaveCanvas);
            };

            rec.start(1000);
            setGuestLKBadge('recording');
            setGuestArmVisual('recording');
            btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12"/></svg> Stop Guest Take`;
            btn.style.background = 'rgba(239,68,68,0.2)';
            btn.style.color = '#ef4444';
            btn.style.border = '1px solid rgba(239,68,68,0.4)';

            const gWaveCanvas = document.getElementById('guest-waveform-canvas');
            if (gWaveCanvas && analyser) {
                startWaveformAnimation(gWaveCanvas, analyser);
            }

            sec = 0;
            if (timerInt) clearInterval(timerInt);
            timerInt = setInterval(() => {
                sec++;
                const m = Math.floor(sec / 60).toString().padStart(2, '0');
                const s = (sec % 60).toString().padStart(2, '0');
                if (timer) timer.textContent = `00:${m}:${s}`;
            }, 1000);
        } catch (err) {
            console.warn('[Guest Studio] Start recording error:', err.message);
        }
    };

    const pauseGuestRecording = () => {
        if (rec && rec.state === 'recording') {
            rec.pause();
            setGuestArmVisual('paused');
        }
    };

    const resumeGuestRecording = () => {
        if (rec && rec.state === 'paused') {
            rec.resume();
            setGuestArmVisual('recording');
        }
    };

    const stopGuestRecording = () => {
        if (timerInt) {
            clearInterval(timerInt);
            timerInt = null;
        }
        if (rec && rec.state !== 'inactive') {
            rec.stop();
        }
        rec = null;
    };

    // Manual Guest Record Button Click (Toggle)
    btn.onclick = () => {
        if (!rec || rec.state === 'inactive') {
            isManualGuestRecording = true;
            isGuestArmed = true;
            startGuestRecording(true);
        } else {
            isManualGuestRecording = false;
            stopGuestRecording();
        }
    };

    // Auto-initialize Hardware & Connections
    enumerateGuestMics(preferredGuestMicId).then(() => initGuestStream(preferredGuestMicId));
    registerGuestSession().then(async (joined) => {
        if (joined) {
            startPingLoop();
            if (!isWaitingForPresenter) {
                await connectGuestToLiveKit();
            }
        }
    });
}


let visibleCount = 12;
let currentViewMode = localStorage.getItem('podcast_view_mode') || 'grid';

async function loadEpisodes() {
    try {
        const res = await fetch('/api/podcasts?limit=500');
        const data = await res.json();

        if (data.success && data.episodes.length > 0) {
            episodesList = data.episodes;
            renderFeaturedHero(episodesList[0]);
            applyFiltersAndRender();
        }
    } catch (e) {
        console.error('[Podcasts UI] Error loading episodes:', e);
    }
}

function applyFiltersAndRender() {
    const searchInput = document.getElementById('podcast-search-input');
    const seasonSelect = document.getElementById('podcast-season-filter');
    const hubSelect = document.getElementById('podcast-hub-filter');
    const sortSelect = document.getElementById('podcast-sort-filter');
    const container = document.getElementById('podcast-episodes-container');
    const counterBadge = document.getElementById('podcast-counter-badge');
    const loadMoreContainer = document.getElementById('podcast-load-more-container');
    const loadMoreBtn = document.getElementById('podcast-load-more-btn');

    if (!container) return;

    let list = [...episodesList];

    // 1. Search Filter
    const queryStr = searchInput ? searchInput.value.trim().toLowerCase() : '';
    if (queryStr) {
        list = list.filter(ep => 
            (ep.title && ep.title.toLowerCase().includes(queryStr)) ||
            (ep.description && ep.description.toLowerCase().includes(queryStr)) ||
            (ep.subtitle && ep.subtitle.toLowerCase().includes(queryStr)) ||
            (ep.episode_number && ep.episode_number.toString().includes(queryStr))
        );
    }

    // 2. Season Filter
    const seasonVal = seasonSelect ? seasonSelect.value : 'all';
    if (seasonVal !== 'all') {
        const sNum = parseInt(seasonVal, 10);
        list = list.filter(ep => (ep.season_number || 1) === sNum);
    }

    // 3. County Hub Filter
    const hubVal = hubSelect ? hubSelect.value : 'all';
    if (hubVal !== 'all') {
        const hubLower = hubVal.toLowerCase();
        list = list.filter(ep => {
            if (ep.county_hub && ep.county_hub.toLowerCase().includes(hubLower)) return true;
            if (ep.hub && ep.hub.toLowerCase().includes(hubLower)) return true;
            if (ep.title && ep.title.toLowerCase().includes(hubLower)) return true;
            if (ep.description && ep.description.toLowerCase().includes(hubLower)) return true;
            if (ep.featured_members && Array.isArray(ep.featured_members)) {
                return ep.featured_members.some(m => m.hub && m.hub.toLowerCase().includes(hubLower));
            }
            return false;
        });
    }

    // 4. Sort Filter
    const sortVal = sortSelect ? sortSelect.value : 'newest';
    if (sortVal === 'newest') {
        list.sort((a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0));
    } else if (sortVal === 'oldest') {
        list.sort((a, b) => new Date(a.published_at || 0) - new Date(b.published_at || 0));
    } else if (sortVal === 'listens') {
        list.sort((a, b) => (b.listens_count || 0) - (a.listens_count || 0));
    } else if (sortVal === 'duration_long') {
        list.sort((a, b) => (b.duration_seconds || 0) - (a.duration_seconds || 0));
    } else if (sortVal === 'duration_short') {
        list.sort((a, b) => (a.duration_seconds || 0) - (b.duration_seconds || 0));
    }

    // Update Counter Badge
    const totalMatching = list.length;
    const currentlyDisplayed = Math.min(visibleCount, totalMatching);
    if (counterBadge) {
        counterBadge.textContent = `Showing ${currentlyDisplayed} of ${totalMatching} Shows`;
    }

    const slicedList = list.slice(0, visibleCount);

    if (slicedList.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 64px 20px; color: rgba(255, 255, 255, 0.4); background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); border-radius: 20px;">
                <p style="font-size: 16px; font-weight: 700; margin-bottom: 6px; color: #ffffff;">No podcast episodes found matching your filter.</p>
                <p style="font-size: 13px; margin: 0;">Try clearing your search query or selecting a different hub or season filter.</p>
            </div>
        `;
        if (loadMoreContainer) loadMoreContainer.style.display = 'none';
        return;
    }

    if (currentViewMode === 'grid') {
        renderEpisodesGrid(slicedList, container);
    } else {
        renderEpisodesListView(slicedList, container);
    }

    // Handle Load More Button Visibility
    if (loadMoreContainer && loadMoreBtn) {
        if (currentlyDisplayed < totalMatching) {
            loadMoreContainer.style.display = 'block';
            const remaining = totalMatching - currentlyDisplayed;
            loadMoreBtn.textContent = `⚡ Load More Shows (${remaining} Remaining)`;
        } else {
            loadMoreContainer.style.display = 'none';
        }
    }
}

// OFFLINE QUEUE / PLAYLIST MANAGER HELPERS
function getOfflineQueue() {
    try {
        return JSON.parse(localStorage.getItem('podcast_offline_queue') || '[]');
    } catch (e) {
        return [];
    }
}

function saveOfflineQueue(queue) {
    localStorage.setItem('podcast_offline_queue', JSON.stringify(queue));
    updateQueueBadge();
}

function addToQueue(ep) {
    let queue = getOfflineQueue();
    if (!queue.some(x => x.id === ep.id)) {
        queue.push(ep);
        saveOfflineQueue(queue);
        showStudioToast(`Added "${ep.title}" to Up Next queue`);
    } else {
        showStudioToast(`"${ep.title}" is already in your queue`);
    }
}

function removeFromQueue(epId) {
    let queue = getOfflineQueue();
    queue = queue.filter(x => x.id !== epId);
    saveOfflineQueue(queue);
    renderQueueModalContent();
}

function clearQueue() {
    saveOfflineQueue([]);
    renderQueueModalContent();
}

function moveQueueItem(index, direction) {
    let queue = getOfflineQueue();
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= queue.length) return;
    const temp = queue[index];
    queue[index] = queue[targetIndex];
    queue[targetIndex] = temp;
    saveOfflineQueue(queue);
    renderQueueModalContent();
}

function updateQueueBadge() {
    const queue = getOfflineQueue();
    const badge = document.getElementById('player-queue-count');
    if (badge) badge.textContent = queue.length;
}

function renderQueueModalContent() {
    const container = document.getElementById('podcast-queue-items-container');
    if (!container) return;

    const queue = getOfflineQueue();
    if (queue.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); border-radius: 16px;">
                <p style="font-size: 14px; font-weight: 700; margin-bottom: 4px; color: #ffffff;">Your Up Next queue is currently empty.</p>
                <p style="font-size: 12px; margin: 0;">Click "+ Queue" on any episode card to save it for continuous playback or low-signal on-set filming.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = queue.map((ep, idx) => {
        const durationMins = ep.duration_seconds ? Math.floor(ep.duration_seconds / 60) + ' Mins' : '20 Mins';
        const coverArt = ep.cover_art_url || '/assets/podcast_cover_01.jpg';

        return `
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 14px;">
                <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
                    <span style="font-size: 12px; font-weight: 900; color: rgba(255,255,255,0.4); width: 20px;">#${idx + 1}</span>
                    <img src="${coverArt}" onerror="this.onerror=null; this.src='/assets/podcast_cover_01.jpg';" alt="${ep.title}" style="width: 44px; height: 44px; border-radius: 8px; object-fit: cover; flex-shrink: 0;">
                    <div style="min-width: 0;">
                        <div style="font-size: 13px; font-weight: 800; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${ep.title}</div>
                        <div style="font-size: 11px; color: rgba(255,255,255,0.5);">${durationMins} · Season ${ep.season_number || 1} Ep ${ep.episode_number || 1}</div>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                    <button class="queue-play-now-btn" data-episode-id="${ep.id}" style="background: #ffffff; color: #06070a; border: none; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 900; cursor: pointer;">Play Now</button>
                    <button class="queue-up-btn" data-index="${idx}" ${idx === 0 ? 'disabled style="opacity:0.3; cursor:default;"' : ''} style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #fff; padding: 4px 8px; border-radius: 6px; cursor: pointer;">▲</button>
                    <button class="queue-down-btn" data-index="${idx}" ${idx === queue.length - 1 ? 'disabled style="opacity:0.3; cursor:default;"' : ''} style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #fff; padding: 4px 8px; border-radius: 6px; cursor: pointer;">▼</button>
                    <a href="${ep.audio_url}" download target="_blank" title="Download MP3" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 5px 8px; border-radius: 6px; font-size: 11px; text-decoration: none;">💾</a>
                    <button class="queue-remove-btn" data-episode-id="${ep.id}" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; padding: 4px 8px; border-radius: 6px; cursor: pointer;">✕</button>
                </div>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.queue-play-now-btn').forEach(btn => {
        btn.onclick = () => {
            const epId = btn.getAttribute('data-episode-id');
            const queue = getOfflineQueue();
            const ep = queue.find(x => x.id === epId);
            if (ep) {
                document.getElementById('podcast-queue-modal').style.display = 'none';
                playEpisode(ep);
            }
        };
    });

    container.querySelectorAll('.queue-up-btn').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.getAttribute('data-index'), 10);
            moveQueueItem(idx, -1);
        };
    });

    container.querySelectorAll('.queue-down-btn').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.getAttribute('data-index'), 10);
            moveQueueItem(idx, 1);
        };
    });

    container.querySelectorAll('.queue-remove-btn').forEach(btn => {
        btn.onclick = () => {
            const epId = btn.getAttribute('data-episode-id');
            removeFromQueue(epId);
        };
    });
}

function renderFeaturedHero(ep) {
    const heroEl = document.getElementById('featured-episode-hero');
    if (!heroEl || !ep) return;

    const durationMins = ep.duration_seconds ? Math.floor(ep.duration_seconds / 60) + ' Mins' : '25 Mins';
    const pubDate = ep.published_at ? new Date(ep.published_at).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Latest Release';
    const sizeMb = ep.audio_size_bytes ? (ep.audio_size_bytes / 1048576).toFixed(1) + ' MB' : '24.5 MB';
    const coverArt = ep.cover_art_url || '/assets/podcast_cover_01.jpg';

    // FEATURE 1: Render Featured Guest Badges
    const featuredMembers = ep.featured_members || [
        { id: "00000000-0000-0000-0000-000000000001", name: "Alan Joyce", hub: "Kildare Hub", role: "Producer & Business Director", avatar_url: "/assets/alan_joyce_avatar.jpg" }
    ];

    const featuredMembersHTML = featuredMembers.length > 0 ? `
        <div style="margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px;">
            <span style="font-size: 11px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: rgba(255,255,255,0.5); display: block; margin-bottom: 10px;">
                🌟 FEATURED COMMUNITY MEMBERS IN THIS EPISODE
            </span>
            <div style="display: flex; flex-wrap: wrap; gap: 12px;">
                ${featuredMembers.map(m => `
                    <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 6px 12px; display: flex; align-items: center; gap: 10px;">
                        <img src="${m.avatar_url || '/assets/alan_joyce_avatar.jpg'}" onerror="this.onerror=null; this.src='/assets/alan_joyce_avatar.jpg';" alt="${m.name}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;">
                        <div>
                            <div style="font-size: 12px; font-weight: 800; color: #ffffff;">${m.name}</div>
                            <div style="font-size: 10px; color: rgba(255,255,255,0.5);">${m.role} · ${m.hub}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    ` : '';

    heroEl.innerHTML = `
        <div style="position: absolute; right: -80px; top: -80px; width: 450px; height: 450px; background: radial-gradient(circle, rgba(255, 255, 255, 0.05) 0%, rgba(0, 0, 0, 0) 70%); pointer-events: none;"></div>
        
        <div style="display: grid; grid-template-columns: 280px 1fr; gap: 48px; align-items: center; position: relative; z-index: 2;">
            
            <div style="width: 280px; height: 280px; border-radius: 20px; overflow: hidden; border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 24px 48px rgba(0,0,0,0.8); flex-shrink: 0; position: relative; background: #0c0e15;">
                <img src="${coverArt}" onerror="this.onerror=null; this.src='/assets/podcast_cover_01.jpg';" alt="${ep.title} Cover Art" style="width: 100%; height: 100%; object-fit: cover; display: block;">
                <div style="position: absolute; inset: 0; background: linear-gradient(to top, rgba(6,7,10,0.7) 0%, rgba(0,0,0,0) 60%);"></div>
                <div style="position: absolute; bottom: 16px; left: 16px; right: 16px; display: flex; align-items: center; justify-content: space-between;">
                    <span style="background: rgba(0,0,0,0.75); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.25); color: #ffffff; font-size: 11px; font-weight: 900; padding: 4px 10px; border-radius: 6px; letter-spacing: 1px;">FEATURED SHOW</span>
                    <span style="font-size: 12px; font-weight: 800; color: #ffffff;">${durationMins}</span>
                </div>
            </div>

            <div>
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                    <span style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.18); color: #ffffff; font-size: 11px; font-weight: 900; padding: 4px 12px; border-radius: 20px; letter-spacing: 1px;">
                        SEASON ${ep.season_number || 1} · EPISODE ${ep.episode_number || 1}
                    </span>
                    <time datetime="${ep.published_at}" style="font-size: 13px; color: rgba(255, 255, 255, 0.5); font-weight: 600;">${pubDate}</time>
                </div>

                <h1 style="font-size: 34px; font-weight: 900; margin: 0 0 12px; line-height: 1.18; color: #ffffff; letter-spacing: -0.5px;">
                    ${ep.title}
                </h1>
                
                <p style="font-size: 15px; line-height: 1.6; color: rgba(255, 255, 255, 0.7); margin: 0 0 20px; max-width: 780px;">
                    ${ep.description || ep.subtitle || ''}
                </p>

                ${featuredMembersHTML}

                <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 14px; margin-top: 24px;">
                    <button id="hero-play-btn" data-episode-id="${ep.id}" style="background: #ffffff; color: #06070a; border: none; padding: 14px 28px; border-radius: 12px; font-weight: 900; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: transform 0.15s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#06070a" stroke="none" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        STREAM EPISODE
                    </button>

                    <button id="hero-queue-btn" data-episode-id="${ep.id}" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.18); color: #ffffff; padding: 14px 20px; border-radius: 12px; font-weight: 700; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                        + Add to Queue
                    </button>

                    <a href="${ep.audio_url}" download target="_blank" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.18); color: #ffffff; padding: 14px 22px; border-radius: 12px; font-weight: 700; font-size: 14px; text-decoration: none; display: flex; align-items: center; gap: 10px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Download MP3 (${sizeMb})
                    </a>

                    <button class="hero-notes-btn" data-episode-id="${ep.id}" style="background: none; border: 1px solid rgba(255, 255, 255, 0.12); color: rgba(255, 255, 255, 0.8); padding: 14px 20px; border-radius: 12px; font-weight: 600; font-size: 13px; cursor: pointer;">
                        Show Notes &amp; Embed
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('hero-play-btn')?.addEventListener('click', () => playEpisode(ep));
    document.getElementById('hero-queue-btn')?.addEventListener('click', () => addToQueue(ep));
    document.querySelector('.hero-notes-btn')?.addEventListener('click', () => openShowNotesModal(ep));
}

function renderEpisodesGrid(episodes, container) {
    const gridContainer = container || document.getElementById('podcast-episodes-container');
    if (!gridContainer) return;

    gridContainer.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 28px;">
            ${episodes.map((ep, idx) => {
                const durationMins = ep.duration_seconds ? Math.floor(ep.duration_seconds / 60) + ' Mins' : '20 Mins';
                const pubDate = ep.published_at ? new Date(ep.published_at).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
                const coverArt = ep.cover_art_url || `/assets/podcast_cover_0${(idx % 3) + 1}.jpg`;
                const epNumStr = (ep.episode_number || (idx + 1)).toString().padStart(2, '0');

                return `
                    <article class="podcast-episode-card" style="background: rgba(13, 16, 24, 0.85); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px; padding: 24px; display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden; transition: transform 0.2s, border-color 0.2s;" onmouseover="this.style.borderColor='rgba(255,255,255,0.25)'; this.style.transform='translateY(-4px)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.08)'; this.style.transform='translateY(0)'">
                        
                        <div style="position: absolute; right: 16px; top: -10px; font-size: 72px; font-weight: 900; color: rgba(255, 255, 255, 0.03); pointer-events: none; user-select: none;">
                            #${epNumStr}
                        </div>

                        <div>
                            <div style="display: flex; gap: 16px; margin-bottom: 16px; align-items: center;">
                                <div style="width: 80px; height: 80px; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.15); flex-shrink: 0; background: #0c0e15;">
                                    <img src="${coverArt}" onerror="this.onerror=null; this.src='/assets/podcast_cover_01.jpg';" alt="${ep.title} Cover Art" style="width: 100%; height: 100%; object-fit: cover; display: block;">
                                </div>
                                <div style="min-width: 0;">
                                    <div style="font-size: 11px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: rgba(255, 255, 255, 0.5); margin-bottom: 4px;">
                                        SEASON ${ep.season_number || 1} · EP ${ep.episode_number || 1}
                                    </div>
                                    <time datetime="${ep.published_at}" style="font-size: 12px; color: rgba(255, 255, 255, 0.4); font-weight: 500;">${pubDate}</time>
                                </div>
                            </div>

                            <h3 style="font-size: 18px; font-weight: 800; margin: 0 0 10px; color: #ffffff; line-height: 1.35;">
                                ${ep.title}
                            </h3>
                            <p style="font-size: 13px; line-height: 1.5; color: rgba(255, 255, 255, 0.6); margin: 0 0 20px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">
                                ${ep.description || ep.subtitle || ''}
                            </p>
                        </div>

                        <div style="border-top: 1px solid rgba(255, 255, 255, 0.06); padding-top: 18px; margin-top: 12px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px;">
                            <span style="font-size: 12px; font-weight: 700; color: rgba(255, 255, 255, 0.5);">${durationMins}</span>
                            
                            <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 6px;">
                                <button class="podcast-card-queue-btn" data-episode-id="${ep.id}" title="Add to Offline Queue" style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); color: #ffffff; padding: 7px 10px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                                    + Queue
                                </button>

                                <button class="podcast-notes-btn" data-episode-id="${ep.id}" title="Show Notes" style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); color: #ffffff; width: 34px; height: 34px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                </button>

                                <button class="podcast-card-audiogram-btn" data-episode-id="${ep.id}" title="Social Waveform Share Card" style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); color: #ffffff; width: 34px; height: 34px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line></svg>
                                </button>

                                <button class="podcast-card-trim-btn" data-episode-id="${ep.id}" title="Magic Audio Trimmer" style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); color: #ffffff; width: 34px; height: 34px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.47" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line></svg>
                                </button>

                                <button class="podcast-card-guest-btn" data-episode-id="${ep.id}" title="Remote Guest Studio Link" style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); color: #ffffff; width: 34px; height: 34px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                                </button>

                                ${window._isSuperAdminUser ? `
                                <button class="podcast-card-edit-btn" data-episode-id="${ep.id}" title="Edit Episode" style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); color: #ffffff; width: 34px; height: 34px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                </button>

                                <button class="podcast-card-delete-btn" data-episode-id="${ep.id}" title="Delete Episode" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; width: 34px; height: 34px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                                ` : ''}

                                <a href="${ep.audio_url}" download target="_blank" title="Download Episode MP3" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); color: #ffffff; padding: 7px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; text-decoration: none; display: flex; align-items: center; gap: 6px;">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                    Download
                                </a>

                                <button class="podcast-play-btn" data-episode-id="${ep.id}" style="background: #ffffff; color: #06070a; border: none; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 900; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#06070a" stroke="none" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                    Play
                                </button>
                            </div>
                        </div>
                    </article>
                `;
            }).join('')}
        </div>
    `;

    attachCardEventListeners();
}

function renderEpisodesListView(episodes, container) {
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
            ${episodes.map((ep, idx) => {
                const durationMins = ep.duration_seconds ? Math.floor(ep.duration_seconds / 60) + ' Mins' : '20 Mins';
                const pubDate = ep.published_at ? new Date(ep.published_at).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
                const coverArt = ep.cover_art_url || `/assets/podcast_cover_0${(idx % 3) + 1}.jpg`;
                const epNumStr = (ep.episode_number || (idx + 1)).toString().padStart(2, '0');

                return `
                    <article class="podcast-episode-row" style="background: rgba(13, 16, 24, 0.85); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 14px 20px; display: grid; grid-template-columns: 56px 1fr 120px auto; align-items: center; gap: 20px; transition: background 0.2s, border-color 0.2s;" onmouseover="this.style.borderColor='rgba(255,255,255,0.2)'; this.style.background='rgba(20,24,36,0.95)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.08)'; this.style.background='rgba(13,16,24,0.85)'">
                        
                        <!-- Cover Thumb -->
                        <div style="width: 56px; height: 56px; border-radius: 10px; overflow: hidden; border: 1px solid rgba(255,255,255,0.15); flex-shrink: 0; background: #0c0e15;">
                            <img src="${coverArt}" onerror="this.onerror=null; this.src='/assets/podcast_cover_01.jpg';" alt="${ep.title} Cover" style="width: 100%; height: 100%; object-fit: cover; display: block;">
                        </div>

                        <!-- Title & Meta -->
                        <div style="min-width: 0;">
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
                                <span style="font-size: 11px; font-weight: 900; letter-spacing: 0.5px; color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); padding: 2px 8px; border-radius: 6px;">
                                    S${ep.season_number || 1} E${epNumStr}
                                </span>
                                <time datetime="${ep.published_at}" style="font-size: 12px; color: rgba(255, 255, 255, 0.4); font-weight: 500;">${pubDate}</time>
                            </div>
                            <h3 style="font-size: 15px; font-weight: 800; margin: 0; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${ep.title}
                            </h3>
                            <div style="font-size: 12px; color: rgba(255,255,255,0.5); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;">
                                ${ep.subtitle || ep.description || ''}
                            </div>
                        </div>

                        <!-- Duration -->
                        <div style="font-size: 13px; font-weight: 700; color: rgba(255, 255, 255, 0.6); text-align: right;">
                            ${durationMins}
                        </div>

                        <!-- Actions -->
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <button class="podcast-card-queue-btn" data-episode-id="${ep.id}" title="Add to Offline Queue" style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); color: #ffffff; padding: 7px 10px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                                + Queue
                            </button>

                            <button class="podcast-notes-btn" data-episode-id="${ep.id}" title="Show Notes" style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); color: #ffffff; width: 34px; height: 34px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                            </button>

                            <button class="podcast-card-audiogram-btn" data-episode-id="${ep.id}" title="Social Waveform Share Card" style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); color: #ffffff; width: 34px; height: 34px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line></svg>
                            </button>

                            <button class="podcast-card-trim-btn" data-episode-id="${ep.id}" title="Magic Audio Trimmer" style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); color: #ffffff; width: 34px; height: 34px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.47" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line></svg>
                            </button>

                            <button class="podcast-card-guest-btn" data-episode-id="${ep.id}" title="Remote Guest Studio Link" style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); color: #ffffff; width: 34px; height: 34px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                            </button>

                            ${window._isSuperAdminUser ? `
                            <button class="podcast-card-edit-btn" data-episode-id="${ep.id}" title="Edit Episode" style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); color: #ffffff; width: 34px; height: 34px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>

                            <button class="podcast-card-delete-btn" data-episode-id="${ep.id}" title="Delete Episode" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; width: 34px; height: 34px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                            ` : ''}

                            <a href="${ep.audio_url}" download target="_blank" title="Download Episode MP3" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); color: #ffffff; padding: 7px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; text-decoration: none; display: flex; align-items: center; gap: 6px;">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                Download
                            </a>

                            <button class="podcast-play-btn" data-episode-id="${ep.id}" style="background: #ffffff; color: #06070a; border: none; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 900; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="#06070a" stroke="none" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                Play
                            </button>
                        </div>
                    </article>
                `;
            }).join('')}
        </div>
    `;

    attachCardEventListeners();
}

function attachCardEventListeners() {
    document.querySelectorAll('.podcast-play-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const epId = e.currentTarget.getAttribute('data-episode-id');
            const ep = episodesList.find(x => x.id === epId);
            if (ep) playEpisode(ep);
        });
    });

    document.querySelectorAll('.podcast-card-queue-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const epId = e.currentTarget.getAttribute('data-episode-id');
            const ep = episodesList.find(x => x.id === epId);
            if (ep) addToQueue(ep);
        });
    });

    document.querySelectorAll('.podcast-notes-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const epId = e.currentTarget.getAttribute('data-episode-id');
            const ep = episodesList.find(x => x.id === epId);
            if (ep) openShowNotesModal(ep);
        });
    });

    document.querySelectorAll('.podcast-card-audiogram-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const epId = e.currentTarget.getAttribute('data-episode-id');
            const ep = episodesList.find(x => x.id === epId);
            if (ep) generateSocialAudiogramCard(ep);
        });
    });

    document.querySelectorAll('.podcast-card-trim-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const epId = e.currentTarget.getAttribute('data-episode-id');
            const ep = episodesList.find(x => x.id === epId);
            if (ep) openAudioTrimmerModal(ep);
        });
    });

    document.querySelectorAll('.podcast-card-guest-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const epId = e.currentTarget.getAttribute('data-episode-id');
            const ep = episodesList.find(x => x.id === epId);
            const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
            const guestName = await showStudioPrompt(
                'Remote Guest Studio Invite',
                `Enter Guest / Co-Host Name for recording session (${ep ? ep.title : ''}):`,
                'Guest',
                'Guest Name'
            );
            if (!guestName || !guestName.trim()) return;

            const sid = window._activeStudioSessionId || localStorage.getItem('localfilm_active_studio_session_id') || `session-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
            window._activeStudioSessionId = sid;
            localStorage.setItem('localfilm_active_studio_session_id', sid);

            try {
                const res = await fetch('/api/podcasts/guest-token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ guest_name: guestName.trim(), session_id: sid })
                });
                const data = await res.json();
                if (data.success) {
                    const finalSid = data.session_id || sid;
                    window._activeStudioSessionId = finalSid;
                    localStorage.setItem('localfilm_active_studio_session_id', finalSid);

                    const isNotLiveDomain = window.location.hostname !== 'localfilm.online' && window.location.hostname !== 'www.localfilm.online';
                    const inviteParam = data.invite_token ? `&invite_token=${encodeURIComponent(data.invite_token)}` : '';
                    const finalLink = (isNotLiveDomain || !data.guest_link)
                        ? `${window.location.origin}/podcasts?guest_session=${finalSid}&guest_name=${encodeURIComponent(guestName.trim())}${inviteParam}`
                        : `${data.guest_link}${data.guest_link.includes('invite_token') ? '' : inviteParam}`;

                    const copied = await copyStudioLinkToClipboard(finalLink);
                    if (copied) {
                        await showStudioAlert(
                            'Studio Link Copied',
                            `Remote Guest Studio link created and copied to your clipboard:\n\n${finalLink}\n\nSend this link to ${guestName.trim()} to begin remote broadcast recording!`
                        );
                    } else {
                        await showStudioPrompt(
                            'Remote Guest Studio Link',
                            `Remote Guest Studio link created! Please copy this link manually and send to ${guestName.trim()}:`,
                            finalLink
                        );
                    }
                } else {
                    await showStudioAlert('Guest Link Error', 'Failed to generate guest link: ' + (data.error || 'Server error'));
                }
            } catch (err) {
                await showStudioAlert('Network Error', 'Network error while requesting guest link: ' + err.message);
            }
        });
    });

    document.querySelectorAll('.podcast-card-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const epId = e.currentTarget.getAttribute('data-episode-id');
            const ep = episodesList.find(x => x.id === epId);
            if (!ep) return;

            window._editingEpisodeId = ep.id;
            const titleEl = document.getElementById('up-modal-title');
            const submitEl = document.getElementById('up-submit-btn');
            if (titleEl) titleEl.textContent = `Edit Episode #${ep.episode_number || 1}`;
            if (submitEl) submitEl.textContent = `Save Changes`;

            document.getElementById('up-title').value = ep.title || '';
            document.getElementById('up-subtitle').value = ep.subtitle || '';
            document.getElementById('up-description').value = ep.description || ep.show_notes || '';
            document.getElementById('up-cover-art').value = ep.cover_art_url || '';
            document.getElementById('up-audio-url').value = ep.audio_url || '';
            document.getElementById('up-duration').value = ep.duration_seconds || 1200;
            document.getElementById('up-season').value = ep.season_number || 1;
            document.getElementById('up-episode').value = ep.episode_number || 1;
            document.getElementById('up-intro-bumper').value = ep.intro_bumper || 'cinematic_intro';
            document.getElementById('up-outro-bumper').value = ep.outro_bumper || 'broadcast_outro';

            const subtrackPresetSelect = document.getElementById('up-subtrack-preset');
            const subtrackCustomInput = document.getElementById('up-subtrack-custom');
            const subtrackVolSlider = document.getElementById('up-subtrack-volume');
            const subtrackVolVal = document.getElementById('up-subtrack-vol-val');

            if (ep.subtrack_url) {
                const knownPresets = [
                    "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=podcast-ambient-116199.mp3",
                    "https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a14e9f.mp3?filename=cinematic-atmosphere-10499.mp3",
                    "https://cdn.pixabay.com/download/audio/2022/10/14/audio_993a40c953.mp3?filename=technology-podcast-intro-123491.mp3"
                ];
                if (knownPresets.includes(ep.subtrack_url)) {
                    if (subtrackPresetSelect) subtrackPresetSelect.value = ep.subtrack_url;
                    if (subtrackCustomInput) subtrackCustomInput.style.display = 'none';
                } else {
                    if (subtrackPresetSelect) subtrackPresetSelect.value = 'custom';
                    if (subtrackCustomInput) {
                        subtrackCustomInput.value = ep.subtrack_url;
                        subtrackCustomInput.style.display = 'block';
                    }
                }
            } else {
                if (subtrackPresetSelect) subtrackPresetSelect.value = '';
                if (subtrackCustomInput) subtrackCustomInput.style.display = 'none';
            }
            const volVal = ep.subtrack_volume !== undefined && ep.subtrack_volume !== null ? parseFloat(ep.subtrack_volume) : 0.20;
            if (subtrackVolSlider) subtrackVolSlider.value = volVal;
            if (subtrackVolVal) subtrackVolVal.textContent = `${Math.round(volVal * 100)}% Vol`;

            const uploadModal = document.getElementById('podcast-upload-modal');
            if (uploadModal) uploadModal.style.display = 'flex';
        });
    });

    document.querySelectorAll('.podcast-card-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const epId = e.currentTarget.getAttribute('data-episode-id');
            const ep = episodesList.find(x => x.id === epId);
            if (!ep) return;

            const ok = await showStudioConfirm(
                'Delete Podcast Episode',
                `Are you sure you want to permanently delete "${ep.title}"?\n\nThis will remove the episode from the RSS feed and platform distribution.`,
                { confirmText: 'Delete Episode', danger: true }
            );
            if (ok) {
                const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
                try {
                    const res = await fetch(`/api/podcasts/episodes/${ep.id}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    const data = await res.json();
                    if (data.success) {
                        showStudioToast('Episode deleted successfully');
                        await loadEpisodes();
                    } else {
                        await showStudioAlert('Delete Failed', 'Delete failed: ' + (data.error || 'Server error'));
                    }
                } catch (err) {
                    await showStudioAlert('Network Error', 'Network error deleting episode: ' + err.message);
                }
            }
        });
    });
}

function playEpisode(ep) {
    currentPlayingEpisode = ep;
    const playerBar = document.getElementById('podcast-player-bar');
    if (!playerBar) return;

    playerBar.style.display = 'block';

    const titleEl = document.getElementById('player-episode-title');
    const metaEl = document.getElementById('player-episode-meta');
    const thumbImg = document.getElementById('player-thumb-img');
    const downloadBtn = document.getElementById('player-download-btn');

    if (titleEl) titleEl.textContent = ep.title;
    if (metaEl) metaEl.textContent = `Season ${ep.season_number || 1} · Episode ${ep.episode_number || 1}`;
    if (thumbImg) {
        thumbImg.src = ep.cover_art_url || '/assets/podcast_cover_01.jpg';
        thumbImg.onerror = () => { thumbImg.src = '/assets/podcast_cover_01.jpg'; };
    }
    if (downloadBtn) downloadBtn.href = ep.audio_url;

    if (currentAudio) {
        currentAudio.pause();
    }
    if (currentSubtrackAudio) {
        currentSubtrackAudio.pause();
        currentSubtrackAudio = null;
    }

    currentAudio = new Audio(ep.audio_url);
    currentAudio.playbackRate = playbackSpeed;

    if (ep.subtrack_url) {
        currentSubtrackAudio = new Audio(ep.subtrack_url);
        currentSubtrackAudio.volume = ep.subtrack_volume !== undefined && ep.subtrack_volume !== null ? parseFloat(ep.subtrack_volume) : 0.20;
        currentSubtrackAudio.playbackRate = playbackSpeed;
    }

    currentAudio.play().then(() => {
        isPlaying = true;
        if (currentSubtrackAudio) {
            currentSubtrackAudio.play().catch(err => console.warn('[Subtrack Player] Dual playback notice:', err));
        }
        updatePlayPauseUI();
        logListenCount(ep.id);
    }).catch(err => {
        console.error('[Audio Player] Playback error:', err);
    });

    currentAudio.addEventListener('timeupdate', updateAudioProgress);
    currentAudio.addEventListener('ended', () => {
        isPlaying = false;
        if (currentSubtrackAudio) {
            currentSubtrackAudio.pause();
        }
        updatePlayPauseUI();

        // Autoplay next queued episode if queue is not empty
        let queue = getOfflineQueue();
        if (queue.length > 0) {
            const nextEp = queue.shift();
            saveOfflineQueue(queue);
            playEpisode(nextEp);
        }
    });
}

function updatePlayPauseUI() {
    const playIcon = document.getElementById('player-icon-play');
    const pauseIcon = document.getElementById('player-icon-pause');
    if (!playIcon || !pauseIcon) return;

    if (isPlaying) {
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
    } else {
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
    }
}

function updateAudioProgress() {
    if (!currentAudio) return;
    const currentTimeEl = document.getElementById('player-current-time');
    const totalTimeEl = document.getElementById('player-total-duration');
    const slider = document.getElementById('player-seek-slider');

    if (currentTimeEl) currentTimeEl.textContent = formatTime(currentAudio.currentTime);
    if (totalTimeEl && currentAudio.duration) totalTimeEl.textContent = formatTime(currentAudio.duration);
    if (slider && currentAudio.duration) {
        slider.value = (currentAudio.currentTime / currentAudio.duration) * 100;
    }
}

function formatTime(secs) {
    if (!secs || isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function renderInteractiveShowNotes(text) {
    if (!text) return 'No extra show notes provided.';
    return text.replace(/\b(?:(\d{1,2}):)?(\d{2}):(\d{2})\b/g, (match, h, m, s) => {
        const hours = h ? parseInt(h, 10) : 0;
        const mins = parseInt(m, 10);
        const secs = parseInt(s, 10);
        const totalSeconds = hours * 3600 + mins * 60 + secs;
        return `<button class="timestamp-seek-btn" data-seconds="${totalSeconds}" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: #ffffff; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; margin: 2px 4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> ${match}</button>`;
    });
}

function openShowNotesModal(ep) {
    const modal = document.getElementById('podcast-notes-modal');
    const content = document.getElementById('podcast-notes-content');
    if (!modal || !content || !ep) return;

    const baseUrl = window.location.origin;
    const embedCode = `<iframe src="${baseUrl}/podcasts/embed/${ep.slug}" width="100%" height="160" frameborder="0" scrolling="no"></iframe>`;

    const notesHTML = renderInteractiveShowNotes(ep.show_notes || ep.description || '');

    content.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <span style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); color: #ffffff; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 6px;">
                SEASON ${ep.season_number || 1} · EPISODE ${ep.episode_number || 1}
            </span>
            <time datetime="${ep.published_at}" style="font-size: 13px; color: rgba(255, 255, 255, 0.5);">${ep.published_at ? new Date(ep.published_at).toLocaleDateString('en-IE') : ''}</time>
        </div>

        <h2 style="font-size: 24px; font-weight: 900; margin: 0 0 16px; color: #ffffff; line-height: 1.3;">${ep.title}</h2>
        
        <p style="font-size: 14px; line-height: 1.6; color: rgba(255, 255, 255, 0.7); margin: 0 0 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 16px;">
            ${ep.description || ''}
        </p>

        <h4 style="font-size: 13px; font-weight: 800; color: #ffffff; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.5px;">SHOW NOTES &amp; INTERACTIVE TIMESTAMPS</h4>
        <div style="font-size: 14px; line-height: 1.6; color: rgba(255, 255, 255, 0.8); white-space: pre-line; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            ${notesHTML}
        </div>

        <h4 style="font-size: 13px; font-weight: 800; color: #ffffff; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.5px;">EMBED WIDGET CODE</h4>
        <div style="background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 12px; margin-bottom: 24px; position: relative;">
            <code style="font-size: 11px; color: rgba(255,255,255,0.7); word-break: break-all;">${embedCode.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>
            <button onclick="navigator.clipboard.writeText('${embedCode.replace(/'/g, "\\'")}'); if (typeof window.showStudioToast === 'function') { window.showStudioToast('Embed code copied to clipboard!'); } else { alert('Embed code copied!'); }" style="margin-top: 8px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">
                Copy Embed HTML
            </button>
        </div>

        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 28px;">
            <button id="modal-generate-audiogram-btn" style="background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.25); color: #ffffff; padding: 12px 18px; border-radius: 10px; font-weight: 800; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                📸 Generate Social Audiogram Share Card
            </button>
            <button id="modal-open-trimmer-btn" style="background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.25); color: #ffffff; padding: 12px 18px; border-radius: 10px; font-weight: 800; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                ✂️ Magic Audio Trimmer
            </button>
            <a href="${ep.audio_url}" download target="_blank" style="background: #ffffff; color: #06070a; border: none; padding: 12px 18px; border-radius: 10px; font-weight: 800; font-size: 13px; text-decoration: none; display: flex; align-items: center; gap: 8px;">
                Download Episode MP3
            </a>
        </div>

        <!-- Audience Discussion & Member Comments -->
        <div style="border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 20px;">
            <h4 style="font-size: 14px; font-weight: 900; color: #ffffff; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                Audience &amp; Member Discussion (<span id="notes-comments-count">0</span>)
            </h4>

            <div id="podcast-comments-list" style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; max-height: 240px; overflow-y: auto;">
                <div style="font-size: 12px; color: rgba(255,255,255,0.4);">Loading discussion comments...</div>
            </div>

            <form id="podcast-comment-form" style="display: flex; gap: 10px;">
                <input type="text" id="podcast-comment-input" required placeholder="Add to the on-set discussion or leave a note..." style="flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 10px 14px; color: #ffffff; font-size: 13px;">
                <button type="submit" style="background: #ffffff; color: #06070a; border: none; padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 800; cursor: pointer; white-space: nowrap;">
                    Post Comment
                </button>
            </form>
        </div>
    `;

    document.getElementById('modal-generate-audiogram-btn')?.addEventListener('click', () => {
        modal.style.display = 'none';
        generateSocialAudiogramCard(ep);
    });

    document.getElementById('modal-open-trimmer-btn')?.addEventListener('click', () => {
        modal.style.display = 'none';
        openAudioTrimmerModal(ep);
    });

    const commentForm = document.getElementById('podcast-comment-form');
    if (commentForm) {
        commentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('podcast-comment-input');
            if (!input || !input.value.trim()) return;

            const text = input.value.trim();
            input.value = '';

            try {
                const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
                const res = await fetch(`/api/podcasts/episodes/${ep.id}/comments`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : ''
                    },
                    body: JSON.stringify({ comment_text: text })
                });
                const data = await res.json();
                if (data.success) {
                    await loadEpisodeComments(ep.id);
                }
            } catch (err) {
                console.error('[Podcasts Comments] Post error:', err);
            }
        });
    }

    modal.style.display = 'flex';
    loadEpisodeComments(ep.id);

    modal.querySelectorAll('.timestamp-seek-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const seconds = parseFloat(e.currentTarget.getAttribute('data-seconds'));
            if (currentPlayingEpisode && currentPlayingEpisode.id === ep.id && currentAudio) {
                currentAudio.currentTime = seconds;
                if (currentSubtrackAudio) currentSubtrackAudio.currentTime = seconds;
                if (!isPlaying) {
                    currentAudio.play();
                    if (currentSubtrackAudio) currentSubtrackAudio.play().catch(()=>{});
                    isPlaying = true;
                    updatePlayPauseUI();
                }
            } else {
                playEpisode(ep);
                setTimeout(() => {
                    if (currentAudio) {
                        currentAudio.currentTime = seconds;
                        if (currentSubtrackAudio) currentSubtrackAudio.currentTime = seconds;
                    }
                }, 300);
            }
        });
    });
}

async function loadEpisodeComments(episodeId) {
    const listEl = document.getElementById('podcast-comments-list');
    const countEl = document.getElementById('notes-comments-count');
    if (!listEl) return;

    try {
        const res = await fetch(`/api/podcasts/episodes/${episodeId}/comments`);
        const data = await res.json();
        if (data.success && data.comments) {
            if (countEl) countEl.textContent = data.comments.length;
            listEl.innerHTML = data.comments.map(c => `
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px 14px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                        <div style="font-size: 13px; font-weight: 800; color: #ffffff;">${c.user_name || 'Irish Film Member'}</div>
                        <time style="font-size: 11px; color: rgba(255,255,255,0.4);">${c.created_at ? new Date(c.created_at).toLocaleDateString('en-IE') : ''}</time>
                    </div>
                    <div style="font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.5;">${c.comment_text}</div>
                </div>
            `).join('');
        }
    } catch (e) {
        listEl.innerHTML = '<div style="font-size: 12px; color: rgba(255,255,255,0.4);">No comments yet. Be the first to join the conversation!</div>';
    }
}

function openAudioTrimmerModal(ep) {
    const modal = document.getElementById('podcast-editor-modal');
    if (!modal || !ep) return;

    window._trimmingEpisode = ep;
    const titleEl = document.getElementById('trimmer-episode-title');
    const startInput = document.getElementById('trim-start-input');
    const endInput = document.getElementById('trim-end-input');

    if (titleEl) titleEl.textContent = `${ep.title} (Current Duration: ${ep.duration_seconds || 1200}s)`;
    if (startInput) startInput.value = 0;
    if (endInput) endInput.value = ep.duration_seconds || 1200;

    modal.style.display = 'flex';
}

// FEATURE 4: Social Audiogram Canvas Visualizer Generator
function generateSocialAudiogramCard(ep) {
    const modal = document.getElementById('podcast-audiogram-modal');
    const canvas = document.getElementById('audiogram-canvas');
    if (!modal || !canvas) return;

    modal.style.display = 'flex';
    const ctx = canvas.getContext('2d');

    // Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 1200, 630);
    bgGrad.addColorStop(0, '#0a0d14');
    bgGrad.addColorStop(0.5, '#121724');
    bgGrad.addColorStop(1, '#05070a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1200, 630);

    // Radial Ambient Flare
    const radial = ctx.createRadialGradient(950, 150, 0, 950, 150, 500);
    radial.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    radial.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, 1200, 630);

    // Header Branding
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '800 20px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('LOCALFILM AUDIO NETWORK', 70, 70);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 16px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(`SEASON ${ep.season_number || 1} · EPISODE ${ep.episode_number || 1}`, 70, 100);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 38px -apple-system, BlinkMacSystemFont, sans-serif';
    const titleText = ep.title.length > 40 ? ep.title.substring(0, 38) + '...' : ep.title;
    ctx.fillText(titleText, 70, 170);

    // Subtitle / Description
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '500 20px -apple-system, BlinkMacSystemFont, sans-serif';
    const subText = ep.subtitle || (ep.description ? ep.description.substring(0, 60) + '...' : 'Irish Film Industry On-Set Breakdown');
    ctx.fillText(subText, 70, 210);

    // Simulated Waveform Bars
    ctx.fillStyle = '#ffffff';
    const barCount = 48;
    const startX = 70;
    const startY = 360;
    for (let i = 0; i < barCount; i++) {
        const h = 20 + Math.sin(i * 0.4) * 50 + Math.random() * 30;
        ctx.fillStyle = i % 2 === 0 ? '#ffffff' : 'rgba(255,255,255,0.4)';
        ctx.fillRect(startX + i * 16, startY - h / 2, 8, h);
    }

    // Featured Guest Badges
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '700 16px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('FEATURED ON LOCALFILM.ONLINE:', 70, 480);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 22px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('Alan Joyce (Kildare Hub)  ·  Garvin Burke (Kilkenny Hub)', 70, 520);

    // Footer Watermark
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '600 16px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('Stream & Download Free across 32 Irish Counties at localfilm.online/podcasts', 70, 570);

    // Cover Art Box on right side
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = ep.cover_art_url || '/assets/podcast_cover_01.jpg';
    img.onload = () => {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(840, 70, 290, 290, 20);
        ctx.clip();
        ctx.drawImage(img, 840, 70, 290, 290);
        ctx.restore();
    };

    // Download PNG Action
    document.getElementById('audiogram-download-btn').onclick = () => {
        const dataUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `localfilm-podcast-audiogram-${ep.slug || 'episode'}.png`;
        a.click();
    };
}

async function loadAnalytics() {
    const modal = document.getElementById('podcast-analytics-modal');
    const content = document.getElementById('podcast-analytics-content');
    if (!modal || !content) return;

    modal.style.display = 'flex';
    try {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
        const res = await fetch('/api/podcasts/analytics', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success) {
            const a = data.analytics;
            content.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
                    <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 20px;">
                        <span style="font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.5); text-transform: uppercase;">TOTAL STREAMS</span>
                        <div style="font-size: 32px; font-weight: 900; color: #ffffff; margin-top: 4px;">${a.total_listens}</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 20px;">
                        <span style="font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.5); text-transform: uppercase;">COMPLETION RATE</span>
                        <div style="font-size: 32px; font-weight: 900; color: #ffffff; margin-top: 4px;">${a.completion_rate}</div>
                    </div>
                </div>

                <h4 style="font-size: 13px; font-weight: 800; color: #ffffff; margin: 0 0 12px; text-transform: uppercase;">TOP LISTENING COUNTY HUBS</h4>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${a.top_hubs.map(h => `
                        <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); padding: 12px 16px; border-radius: 10px;">
                            <span style="font-size: 14px; font-weight: 700; color: #ffffff;">${h.name}</span>
                            <span style="font-size: 13px; font-weight: 800; color: rgba(255,255,255,0.7);">${h.listens} listens</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    } catch (e) {
        content.textContent = 'Error loading analytics metrics';
    }
}

async function logListenCount(epId) {
    try {
        await fetch(`/api/podcasts/episodes/${epId}/listen`, { method: 'POST' });
    } catch (e) {
        console.error('Listen count log error:', e);
    }
}

async function loadRecentPostsForScriptConverter() {
    const select = document.getElementById('blog-script-post-select');
    if (!select) return;

    select.innerHTML = '<option value="">-- Select a Recent Community Notice or Member Article --</option><option value="custom">✏️ Custom Paste / Write Raw Text</option>';

    try {
        const res = await fetch('/api/podcasts/posts/recent');
        const data = await res.json();

        if (data.success && data.posts.length > 0) {
            window._recentCommunityPosts = data.posts;
            data.posts.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                const authorTag = p.author_name ? ` by ${p.author_name}` : '';
                opt.textContent = `[${p.category || 'Notice'}] ${p.title}${authorTag}`;
                select.appendChild(opt);
            });
        }
    } catch (e) {
        console.warn('Error loading recent posts for script converter:', e);
    }
}

function setupEventListeners(isAdmin) {
    const searchInput = document.getElementById('podcast-search-input');
    const seasonSelect = document.getElementById('podcast-season-filter');
    const sortSelect = document.getElementById('podcast-sort-filter');
    const gridBtn = document.getElementById('podcast-view-grid-btn');
    const listBtn = document.getElementById('podcast-view-list-btn');
    const loadMoreBtn = document.getElementById('podcast-load-more-btn');

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            visibleCount = 12;
            applyFiltersAndRender();
        });
    }

    if (seasonSelect) {
        seasonSelect.addEventListener('change', () => {
            visibleCount = 12;
            applyFiltersAndRender();
        });
    }

    const hubSelect = document.getElementById('podcast-hub-filter');
    if (hubSelect) {
        hubSelect.addEventListener('change', () => {
            visibleCount = 12;
            applyFiltersAndRender();
        });
    }

    updateQueueBadge();

    document.getElementById('player-queue-toggle-btn')?.addEventListener('click', () => {
        renderQueueModalContent();
        const modal = document.getElementById('podcast-queue-modal');
        if (modal) modal.style.display = 'flex';
    });

    document.getElementById('podcast-queue-close-btn')?.addEventListener('click', () => {
        const modal = document.getElementById('podcast-queue-modal');
        if (modal) modal.style.display = 'none';
    });

    document.getElementById('queue-clear-all-btn')?.addEventListener('click', async () => {
        const ok = await showStudioConfirm(
            'Clear Queue',
            'Clear all queued podcast shows from your offline playlist?',
            { confirmText: 'Clear Queue', danger: true }
        );
        if (ok) {
            clearQueue();
            showStudioToast('Offline playlist cleared');
        }
    });

    document.getElementById('queue-batch-download-btn')?.addEventListener('click', async () => {
        const queue = getOfflineQueue();
        if (queue.length === 0) {
            await showStudioAlert('Queue Empty', 'Your offline podcast queue is currently empty.');
            return;
        }
        showStudioToast(`Starting download of ${queue.length} podcast episode MP3s...`);
        queue.forEach((ep, i) => {
            setTimeout(() => {
                const a = document.createElement('a');
                a.href = ep.audio_url;
                a.download = `${ep.slug || 'podcast-episode'}.mp3`;
                a.target = '_blank';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }, i * 600);
        });
    });

    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            visibleCount = 12;
            applyFiltersAndRender();
        });
    }

    if (gridBtn && listBtn) {
        // Set initial active state based on currentViewMode
        if (currentViewMode === 'list') {
            listBtn.style.background = 'rgba(255,255,255,0.15)';
            listBtn.style.color = '#ffffff';
            gridBtn.style.background = 'transparent';
            gridBtn.style.color = 'rgba(255,255,255,0.5)';
        } else {
            gridBtn.style.background = 'rgba(255,255,255,0.15)';
            gridBtn.style.color = '#ffffff';
            listBtn.style.background = 'transparent';
            listBtn.style.color = 'rgba(255,255,255,0.5)';
        }

        gridBtn.addEventListener('click', () => {
            currentViewMode = 'grid';
            localStorage.setItem('podcast_view_mode', 'grid');
            gridBtn.style.background = 'rgba(255,255,255,0.15)';
            gridBtn.style.color = '#ffffff';
            listBtn.style.background = 'transparent';
            listBtn.style.color = 'rgba(255,255,255,0.5)';
            applyFiltersAndRender();
        });

        listBtn.addEventListener('click', () => {
            currentViewMode = 'list';
            localStorage.setItem('podcast_view_mode', 'list');
            listBtn.style.background = 'rgba(255,255,255,0.15)';
            listBtn.style.color = '#ffffff';
            gridBtn.style.background = 'transparent';
            gridBtn.style.color = 'rgba(255,255,255,0.5)';
            applyFiltersAndRender();
        });
    }

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            visibleCount += 12;
            applyFiltersAndRender();
        });
    }

    const playPauseBtn = document.getElementById('player-play-pause-btn');
    if (playPauseBtn) {
        playPauseBtn.addEventListener('click', () => {
            if (!currentAudio) return;
            if (isPlaying) {
                currentAudio.pause();
                if (currentSubtrackAudio) currentSubtrackAudio.pause();
                isPlaying = false;
            } else {
                currentAudio.play();
                if (currentSubtrackAudio) currentSubtrackAudio.play().catch(()=>{});
                isPlaying = true;
            }
            updatePlayPauseUI();
        });
    }

    const slider = document.getElementById('player-seek-slider');
    if (slider) {
        slider.addEventListener('input', () => {
            if (currentAudio && currentAudio.duration) {
                const targetTime = (slider.value / 100) * currentAudio.duration;
                currentAudio.currentTime = targetTime;
                if (currentSubtrackAudio) currentSubtrackAudio.currentTime = targetTime;
            }
        });
    }

    const speedBtn = document.getElementById('player-speed-btn');
    if (speedBtn) {
        const speeds = [1.0, 1.25, 1.5, 2.0];
        speedBtn.addEventListener('click', () => {
            let nextIndex = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
            playbackSpeed = speeds[nextIndex];
            speedBtn.textContent = `${playbackSpeed}x`;
            if (currentAudio) currentAudio.playbackRate = playbackSpeed;
            if (currentSubtrackAudio) currentSubtrackAudio.playbackRate = playbackSpeed;
        });
    }

    const skipBackBtn = document.getElementById('player-skip-back');
    if (skipBackBtn) {
        skipBackBtn.addEventListener('click', () => {
            if (currentAudio) {
                const newTime = Math.max(0, currentAudio.currentTime - 15);
                currentAudio.currentTime = newTime;
                if (currentSubtrackAudio) currentSubtrackAudio.currentTime = newTime;
            }
        });
    }

    const skipForwardBtn = document.getElementById('player-skip-forward');
    if (skipForwardBtn) {
        skipForwardBtn.addEventListener('click', () => {
            if (currentAudio && currentAudio.duration) {
                const newTime = Math.min(currentAudio.duration, currentAudio.currentTime + 15);
                currentAudio.currentTime = newTime;
                if (currentSubtrackAudio) currentSubtrackAudio.currentTime = newTime;
            }
        });
    }

    document.getElementById('player-audiogram-btn')?.addEventListener('click', () => {
        if (currentPlayingEpisode) generateSocialAudiogramCard(currentPlayingEpisode);
    });
    document.getElementById('podcast-analytics-btn')?.addEventListener('click', loadAnalytics);
    document.getElementById('podcast-analytics-close-btn')?.addEventListener('click', () => {
        document.getElementById('podcast-analytics-modal').style.display = 'none';
    });

    document.getElementById('podcast-notes-close-btn')?.addEventListener('click', () => {
        document.getElementById('podcast-notes-modal').style.display = 'none';
    });

    document.getElementById('podcast-audiogram-close-btn')?.addEventListener('click', () => {
        document.getElementById('podcast-audiogram-modal').style.display = 'none';
    });

    document.getElementById('podcast-blog-script-close-btn')?.addEventListener('click', () => {
        document.getElementById('podcast-blog-script-modal').style.display = 'none';
    });

    // ═════════════════════════════════════════════════════════════════════════════
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

    