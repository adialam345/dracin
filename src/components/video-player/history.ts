export const saveWatchHistory = (videoElement: HTMLVideoElement, episodes: any[]) => {
    try {
        const title = videoElement.getAttribute('data-title');
        const poster = videoElement.getAttribute('poster');
        const currentEpisodeId = videoElement.getAttribute('data-episode-id');
        const source = videoElement.getAttribute('data-source');
        const bookId = videoElement.getAttribute('data-book-id');

        // Find current episode index/number for display
        const currentEp = episodes.find(e => e.id == currentEpisodeId);
        const episodeLabel = currentEp ? `Episode ${currentEp.index + 1}` : 'Lanjutkan Menonton';

        // 1. Save Last Watched (Global)
        const historyData = {
            source,
            bookId,
            episodeId: currentEpisodeId,
            title,
            poster,
            label: episodeLabel,
            timestamp: Date.now()
        };

        localStorage.setItem('dramaku_last_watched', JSON.stringify(historyData));

        // 2. Save to Watched List (Per Book)
        const watchedKey = `watched:${source}:${bookId}`;
        let watchedList = [];
        try {
            watchedList = JSON.parse(localStorage.getItem(watchedKey) || '[]');
        } catch (e) { watchedList = []; }

        if (currentEpisodeId && !watchedList.includes(currentEpisodeId)) {
            watchedList.push(currentEpisodeId);
            localStorage.setItem(watchedKey, JSON.stringify(watchedList));

            // Dispatch event so UI can update immediately
            window.dispatchEvent(new CustomEvent('watched-episode-added', {
                detail: { source, bookId, episodeId: currentEpisodeId }
            }));
        }

        console.log('[VideoPlayer] Saved history:', historyData);

        // Dispatch event so other components (like ContinueWatching) can update immediately
        window.dispatchEvent(new CustomEvent('history-updated', { detail: historyData }));
    } catch (e) {
        console.error('Failed to save watch history:', e);
    }
};
