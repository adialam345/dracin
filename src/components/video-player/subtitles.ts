
export const addSubtitleTracks = (videoElement: HTMLVideoElement, source: string, VPS_PROXY: string) => {
    // We assume window.pendingSubtitles is available or passed in. 
    // Since window.pendingSubtitles is a bit hacky, let's look at it from window if needed, 
    // but ideally we pass it as arg. For now, accessing window as in original code.
    const pendingSubtitles = (window as any).pendingSubtitles;

    if (!pendingSubtitles || !Array.isArray(pendingSubtitles)) {
        console.log('[VideoPlayer] No pending subtitles to add');
        return;
    }

    console.log('[VideoPlayer] Adding', pendingSubtitles.length, 'subtitle tracks');

    // Clear old tracks
    const oldTracks = videoElement.querySelectorAll('track');
    oldTracks.forEach(t => t.remove());

    let defaultSet = false;
    pendingSubtitles.forEach((sub: any) => {
        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.label = sub.label;
        track.srclang = sub.lang;

        // Use proxy for SRT conversion (DramaWave/FreeShort) OR if non-VTT
        const isSrt = sub.url.includes('.srt');
        if (isSrt || source === 'dramawave' || source === 'freeshort' || source === 'shorttime') {
            track.src = VPS_PROXY + '?url=' + encodeURIComponent(sub.url) + '&_t=' + Math.random();
        } else if (source === 'netshort') {
            // NetShort: Use VPS proxy for SSL compatibility
            track.src = VPS_PROXY + '?url=' + encodeURIComponent(sub.url);
        } else {
            track.src = sub.url;
        }

        // Auto-select ID
        const isIndonesian = sub.lang === 'id-ID' ||
            sub.lang === 'id_ID' ||
            sub.lang === 'id' ||
            sub.label.toLowerCase().includes('indonesia') ||
            sub.label.toLowerCase().includes('indo');

        if (!defaultSet && isIndonesian) {
            track.default = true;
            defaultSet = true;
            console.log('[VideoPlayer] Auto-selecting External Subtitle:', sub.label);
        }
        videoElement.appendChild(track);

        // Force track to show if it is default (needed for some browsers)
        if (track.default) {
            // Some browsers require a small delay after appending
            setTimeout(() => {
                if (track.track) track.track.mode = 'showing';
            }, 100);
        }
    });

    // Clear pending subtitles
    (window as any).pendingSubtitles = null;
};
