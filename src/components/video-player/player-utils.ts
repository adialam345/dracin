export const handleHlsError = (hls: any, data: any, videoElement: HTMLVideoElement, url: string, errorState: HTMLElement, onReady: () => void) => {
    console.log('[VideoPlayer] HLS Error:', data.type, data.details, data.fatal);

    if (data.fatal) {
        switch (data.type) {
            case hls.constructor.ErrorTypes.NETWORK_ERROR:
                console.log('[VideoPlayer] Network error, attempting recovery...');
                if (!url || url.includes('?url=')) {
                    console.error('[VideoPlayer] Aborting recovery for invalid URL');
                    hls.destroy();
                    if (errorState) errorState.classList.remove('hidden');
                    return;
                }
                setTimeout(() => hls.startLoad(), 1000);
                break;
            case hls.constructor.ErrorTypes.MEDIA_ERROR:
                console.log('[VideoPlayer] Media error, attempting recovery...');
                hls.recoverMediaError();
                break;
            default:
                console.error('[VideoPlayer] Unrecoverable error, trying native fallback...');
                // Try native playback as fallback
                if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
                    console.log('[VideoPlayer] Falling back to native HLS');
                    hls.destroy();
                    videoElement.src = url;
                    videoElement.load();
                    videoElement.onloadedmetadata = onReady;
                } else {
                    if (errorState) errorState.classList.remove('hidden');
                }
                break;
        }
    }
};

export const setupQualityManagement = (videoElement: HTMLVideoElement) => {
    let stallCount = 0;
    let lastStallTime = 0;

    videoElement.addEventListener('waiting', () => {
        // Only active if HLS.js is running
        if (!(window as any).hlsInstance) return;

        const now = Date.now();
        // Reset counter if it's been a while (e.g. 60s) since last stall
        if (now - lastStallTime > 60000) {
            stallCount = 0;
        }
        lastStallTime = now;
        stallCount++;

        console.log(`[VideoPlayer] Buffering detected (Count: ${stallCount})`);

        // If we stall 2 times within a minute, downgrade quality
        if (stallCount >= 2) {
            const hls = (window as any).hlsInstance;
            if (hls.levels && hls.levels.length > 1) {
                // Determine current effective level or cap
                let currentCap = hls.autoLevelCapping;

                // If auto (-1), start from current loadLevel
                if (currentCap === -1) {
                    currentCap = hls.loadLevel;
                    if (currentCap === -1) currentCap = hls.currentLevel;
                }

                // Identify new cap (one level lower)
                // Ensure we don't go below 0
                const newCap = Math.max(0, currentCap - 1);

                if (newCap < currentCap || (hls.autoLevelCapping === -1 && newCap < hls.levels.length - 1)) {
                    console.log(`[VideoPlayer] Unstable connection. Downgrading max quality to Level ${newCap}/${hls.levels.length - 1}`);
                    hls.autoLevelCapping = newCap; // Enforce new max quality

                    // Reset stall count to give the new level a chance to stabilize
                    stallCount = 0;
                }
            }
        }
    });
};
