// ═════════════════════════════════════════════════════════════════════════════
// LocalFilm Studio Dialogs & Single-Line Unified Status System (v1.8.28)
// ═════════════════════════════════════════════════════════════════════════════

let statusTimeoutId = null;

export const setStudioStatus = (message, type = 'info', isBusy = false, duration = null) => {
    const textEl = document.getElementById('daw-status-text');
    const dotEl = document.getElementById('daw-status-dot');
    const spinnerEl = document.getElementById('daw-status-spinner');

    if (statusTimeoutId) {
        clearTimeout(statusTimeoutId);
        statusTimeoutId = null;
    }

    if (textEl) {
        textEl.textContent = message;
        textEl.title = message;
    }

    if (spinnerEl) {
        spinnerEl.style.display = isBusy ? 'inline-block' : 'none';
    }

    if (dotEl) {
        if (isBusy) {
            dotEl.style.display = 'none';
        } else {
            dotEl.style.display = 'inline-block';
            if (type === 'recording') {
                dotEl.style.background = '#ff453a';
                dotEl.style.boxShadow = '0 0 8px #ff453a';
            } else if (type === 'warning' || type === 'error') {
                dotEl.style.background = '#ff9f0a';
                dotEl.style.boxShadow = '0 0 6px #ff9f0a';
            } else if (type === 'playing') {
                dotEl.style.background = '#30d158';
                dotEl.style.boxShadow = '0 0 6px #30d158';
            } else if (type === 'info' || type === 'toast') {
                dotEl.style.background = '#0a84ff';
                dotEl.style.boxShadow = '0 0 6px #0a84ff';
            } else {
                dotEl.style.background = '#30d158';
                dotEl.style.boxShadow = '0 0 6px #30d158';
            }
        }
    }

    if (duration && duration > 0) {
        statusTimeoutId = setTimeout(() => {
            if (textEl) textEl.textContent = 'Ready';
            if (spinnerEl) spinnerEl.style.display = 'none';
            if (dotEl) {
                dotEl.style.display = 'inline-block';
                dotEl.style.background = '#30d158';
                dotEl.style.boxShadow = '0 0 6px #30d158';
            }
            statusTimeoutId = null;
        }, duration);
    }
};

if (typeof window !== 'undefined') {
    window.setStudioStatus = setStudioStatus;
}

export const showStudioToast = (message, duration = 3000) => {
    // Single-line unified status & activity broadcast at bottom
    setStudioStatus(message, 'info', false, duration);

    // Guaranteed ZERO vertical stacking: clear any remnants in studio-toast-container
    const container = document.getElementById('studio-toast-container');
    if (container) {
        container.innerHTML = '';
    }
};

const ensureStudioDialogContainer = () => {
    let overlay = document.getElementById('studio-custom-dialog-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'studio-custom-dialog-overlay';
        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(14px);
            z-index: 999999;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 20px;
        `;
        overlay.innerHTML = `
            <div id="studio-custom-dialog-box" style="
                background: #090c14;
                border: 1px solid rgba(10, 132, 255, 0.35);
                box-shadow: 0 32px 80px rgba(0, 0, 0, 0.95), 0 0 24px rgba(10, 132, 255, 0.12);
                border-radius: 16px;
                width: 100%;
                max-width: 440px;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            ">
                <div style="padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); display: flex; align-items: center; gap: 10px;">
                    <div style="width: 28px; height: 28px; border-radius: 6px; background: rgba(10, 132, 255, 0.15); border: 1px solid rgba(10, 132, 255, 0.3); display: flex; align-items: center; justify-content: center;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a84ff" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    </div>
                    <h4 id="studio-dialog-title" style="margin: 0; font-size: 13.5px; font-weight: 800; color: #fff; letter-spacing: 0.3px;">LocalFilm Studio</h4>
                </div>
                <div style="padding: 20px;">
                    <p id="studio-dialog-body" style="margin: 0 0 14px; font-size: 12.5px; color: rgba(255,255,255,0.85); line-height: 1.5; white-space: pre-line;"></p>
                    <div id="studio-dialog-input-container" style="display: none;">
                        <input id="studio-dialog-input" type="text" style="
                            width: 100%;
                            box-sizing: border-box;
                            background: rgba(0,0,0,0.6);
                            border: 1px solid rgba(10, 132, 255, 0.35);
                            border-radius: 8px;
                            padding: 10px 14px;
                            color: #fff;
                            font-size: 13px;
                            font-weight: 600;
                            outline: none;
                        ">
                    </div>
                </div>
                <div style="padding: 14px 20px; border-top: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.3); display: flex; justify-content: flex-end; gap: 8px;">
                    <button id="studio-dialog-cancel-btn" style="
                        background: rgba(255,255,255,0.06);
                        border: 1px solid rgba(255,255,255,0.16);
                        color: rgba(255,255,255,0.8);
                        padding: 7px 16px;
                        border-radius: 6px;
                        font-size: 11.5px;
                        font-weight: 700;
                        cursor: pointer;
                    ">Cancel</button>
                    <button id="studio-dialog-confirm-btn" style="
                        background: linear-gradient(135deg, #0a84ff 0%, #0066cc 100%);
                        border: 1px solid rgba(10, 132, 255, 0.5);
                        color: #ffffff;
                        padding: 7px 18px;
                        border-radius: 6px;
                        font-size: 11.5px;
                        font-weight: 800;
                        cursor: pointer;
                        box-shadow: 0 0 14px rgba(10, 132, 255, 0.35);
                    ">Confirm</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    return overlay;
};

export const showStudioAlert = (title, message) => {
    return new Promise((resolve) => {
        const overlay = ensureStudioDialogContainer();
        const titleEl = document.getElementById('studio-dialog-title');
        const bodyEl = document.getElementById('studio-dialog-body');
        const inputContainer = document.getElementById('studio-dialog-input-container');
        const cancelBtn = document.getElementById('studio-dialog-cancel-btn');
        const confirmBtn = document.getElementById('studio-dialog-confirm-btn');

        if (titleEl) titleEl.textContent = title;
        if (bodyEl) bodyEl.textContent = message;
        if (inputContainer) inputContainer.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (confirmBtn) {
            confirmBtn.textContent = 'OK';
            confirmBtn.style.background = 'linear-gradient(135deg, #0a84ff 0%, #0066cc 100%)';
        }

        const cleanup = () => {
            overlay.style.display = 'none';
            confirmBtn.onclick = null;
            resolve();
        };

        confirmBtn.onclick = cleanup;
        overlay.style.display = 'flex';
    });
};

export const showStudioConfirm = (title, message, options = {}) => {
    return new Promise((resolve) => {
        const overlay = ensureStudioDialogContainer();
        const titleEl = document.getElementById('studio-dialog-title');
        const bodyEl = document.getElementById('studio-dialog-body');
        const inputContainer = document.getElementById('studio-dialog-input-container');
        const cancelBtn = document.getElementById('studio-dialog-cancel-btn');
        const confirmBtn = document.getElementById('studio-dialog-confirm-btn');

        if (titleEl) titleEl.textContent = title;
        if (bodyEl) bodyEl.textContent = message;
        if (inputContainer) inputContainer.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'block';
        if (confirmBtn) {
            confirmBtn.textContent = options.confirmText || 'Confirm';
            confirmBtn.style.background = options.danger 
                ? 'linear-gradient(135deg, #ff453a 0%, #d70015 100%)'
                : 'linear-gradient(135deg, #30d158 0%, #248a3d 100%)';
        }

        const cleanup = (result) => {
            overlay.style.display = 'none';
            cancelBtn.onclick = null;
            confirmBtn.onclick = null;
            resolve(result);
        };

        cancelBtn.onclick = () => cleanup(false);
        confirmBtn.onclick = () => cleanup(true);
        overlay.style.display = 'flex';
    });
};

export const showStudioPrompt = (title, message, defaultValue = '', placeholder = '') => {
    return new Promise((resolve) => {
        const overlay = ensureStudioDialogContainer();
        const titleEl = document.getElementById('studio-dialog-title');
        const bodyEl = document.getElementById('studio-dialog-body');
        const inputContainer = document.getElementById('studio-dialog-input-container');
        const input = document.getElementById('studio-dialog-input');
        const cancelBtn = document.getElementById('studio-dialog-cancel-btn');
        const confirmBtn = document.getElementById('studio-dialog-confirm-btn');

        if (titleEl) titleEl.textContent = title;
        if (bodyEl) bodyEl.textContent = message;
        if (inputContainer) inputContainer.style.display = 'block';
        if (input) {
            input.value = defaultValue;
            input.placeholder = placeholder;
        }
        if (cancelBtn) cancelBtn.style.display = 'block';
        if (confirmBtn) {
            confirmBtn.textContent = 'Save';
            confirmBtn.style.background = 'linear-gradient(135deg, #0a84ff 0%, #0066cc 100%)';
        }

        const cleanup = (val) => {
            overlay.style.display = 'none';
            cancelBtn.onclick = null;
            confirmBtn.onclick = null;
            if (input) input.onkeydown = null;
            resolve(val);
        };

        cancelBtn.onclick = () => cleanup(null);
        confirmBtn.onclick = () => cleanup(input.value);
        if (input) {
            input.onkeydown = (e) => {
                if (e.key === 'Enter') cleanup(input.value);
                if (e.key === 'Escape') cleanup(null);
            };
        }

        overlay.style.display = 'flex';
        setTimeout(() => input?.focus(), 50);
    });
};
