
import { saveWatchHistory } from './history';
import { getHlsConfig, createDecryptLoader } from './hls-config';
import { getProxyUrl, shouldUseFallback, VPS_PROXY } from './proxy-utils';
import { addSubtitleTracks } from './subtitles';
import { handleHlsError, setupQualityManagement } from './player-utils';

export async function initPlayer() {
    if ((window as any).isInitializingPlayer) {
        console.log('[VideoPlayer] Already initializing, skipping...');
        return;
    }
    (window as any).isInitializingPlayer = true;
    console.log('[VideoPlayer] Initializing...');

    try {
        const videoElement = document.getElementById('video-player') as HTMLVideoElement;
        const loader = document.getElementById('player-loader');
        const errorState = document.getElementById('player-error');
        const episodeDataScript = document.getElementById('episode-data');

        if (!videoElement) {
            // Silently return if we're not on a page with a video player
            (window as any).isInitializingPlayer = false;
            return;
        }

        // State
        const episodes = JSON.parse(episodeDataScript?.textContent || '[]');
        let currentEpisodeId = videoElement.getAttribute('data-episode-id');
        const source = videoElement.getAttribute('data-source') || '';
        const bookId = videoElement.getAttribute('data-book-id');
        let videoUrl = videoElement.getAttribute('data-video-url');
        let currentFetchController: AbortController | null = null;

        videoElement.addEventListener('play', () => saveWatchHistory(videoElement, episodes));
        videoElement.addEventListener('timeupdate', () => { /* Optional: Save every 30s */ });

        setupQualityManagement(videoElement);

        // Helper to find next episode ID
        const getNextEpisodeId = (currentId: string | null) => {
            const idx = episodes.findIndex((e: any) => e.id === currentId);
            if (idx !== -1 && idx < episodes.length - 1) {
                return episodes[idx + 1].id;
            }
            return null;
        };

        // Log device and browser info for debugging
        console.log('[VideoPlayer] Device Info:', {
            userAgent: navigator.userAgent,
            isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
            isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent),
            isAndroid: /Android/.test(navigator.userAgent),
            isChrome: /Chrome/.test(navigator.userAgent),
            canPlayHLS: videoElement.canPlayType('application/vnd.apple.mpegurl'),
            hlsJsSupported: typeof (window as any).MediaSource !== 'undefined',
            source: source
        });

        // Helper to decode response/payload
        const processPayload = (rawPayload: any) => {
            if (!rawPayload) return null;
            try {
                if (typeof rawPayload === 'object') return rawPayload;
                return JSON.parse(rawPayload);
            } catch (e) {
                if (typeof rawPayload === 'string' && rawPayload.startsWith('http')) {
                    return { videoUrl: rawPayload };
                }
                return null;
            }
        };

        // Load and Play Video Logic
        const loadAndPlay = async (payloadRaw: any, isAutoNext = false) => {
            // Decrypt/Parse payload
            let data = processPayload(payloadRaw);
            if (!data) {
                console.error('[VideoPlayer] Invalid payload');
                return;
            }

            let url = data.videoUrl;

            if (!url) {
                console.error('[VideoPlayer] Empty video URL from payload');
                if (loader) loader.style.display = 'none';
                if (errorState) errorState.classList.remove('hidden');
                return;
            }

            // Handle errors in payload
            if (data.error === 'webplayer') {
                console.log('[VideoPlayer] Redirecting to web player:', data.redirectUrl);
                if (loader) loader.style.display = 'none';
                if (errorState) {
                    const h3 = errorState.querySelector('h3');
                    if (h3) h3.textContent = '🌐 Buka di Web Player';
                    const p = errorState.querySelector('p');
                    if (p) p.textContent = data.message || 'Drama ini hanya tersedia di FlickReels Web Player';
                    const btn = errorState.querySelector('button');
                    if (btn) {
                        btn.textContent = 'Buka FlickReels';
                        btn.onclick = () => window.open(data.redirectUrl, '_blank');
                    }
                    errorState.classList.remove('hidden');
                }
                return;
            }

            if (data.error === 'premium') {
                console.error('[VideoPlayer] Premium episode:', data.message);
                if (loader) loader.style.display = 'none';
                if (errorState) {
                    const h3 = errorState.querySelector('h3');
                    if (h3) h3.textContent = '🔒 Episode Premium';
                    const p = errorState.querySelector('p');
                    if (p) p.textContent = data.message || 'Episode ini memerlukan akun premium';
                    errorState.classList.remove('hidden');
                }
                return;
            }

            if (data.subtitles) {
                (window as any).pendingSubtitles = data.subtitles;
            }

            if (url && typeof url === 'string' && url.trim().startsWith('{')) {
                try {
                    const innerData = JSON.parse(url);
                    if (innerData.videoUrl) {
                        url = innerData.videoUrl;
                        if (innerData.subtitles && Array.isArray(innerData.subtitles)) {
                            (window as any).pendingSubtitles = innerData.subtitles;
                            console.log('[VideoPlayer] Found subtitles in inner JSON:', innerData.subtitles.length);
                        }
                    }
                } catch (e) { /* ignore */ }
            }

            // --- PROXY LOGIC ---
            const finalUrl = getProxyUrl(url, source);
            if (!finalUrl) {
                if (loader) loader.style.display = 'none';
                if (errorState) errorState.classList.remove('hidden');
                return;
            }
            url = finalUrl;
            // -------------------

            const decodedUrl = decodeURIComponent(url);
            const isHLS = (decodedUrl.includes('.m3u8') || decodedUrl.includes('playlist.m3u8') ||
                source === 'shortmax' ||
                source === 'dramawave' ||
                source === 'dramaflickreels' ||
                source === 'freeshort' ||
                source === 'hishort' ||
                source === 'starshort' ||
                source === 'dramadash') && !decodedUrl.includes('.mp4');

            if (loader) {
                loader.style.display = 'flex';
                loader.style.opacity = '1';
            }

            const onReady = () => {
                videoElement.classList.remove('opacity-0');
                if (loader) {
                    loader.style.opacity = '0';
                    setTimeout(() => loader.style.display = 'none', 500);
                }
                videoElement.play().catch(e => console.log('Autoplay blocked:', e));
            };

            if (isHLS) {
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
                const isAndroid = /Android/.test(navigator.userAgent);

                // ShortMax Server-Side Proxy Decryption Override
                if (source === 'shortmax') {
                    console.log('[VideoPlayer] ShortMax detected. Using Server-Side Proxy for decryption.');
                    const proxyUrl = new URL('/api/shortmax-proxy', window.location.origin);
                    proxyUrl.searchParams.set('url', url);
                    proxyUrl.searchParams.set('type', 'm3u8');
                    url = proxyUrl.toString();
                }

                const requiresCustomHLS = false;
                const useNativeHLS = (isIOS || isSafari || (isAndroid && videoElement.canPlayType('application/vnd.apple.mpegurl'))) && !requiresCustomHLS;

                if (useNativeHLS) {
                    console.log('[VideoPlayer] Using Native HLS Player');
                    videoElement.src = url;

                    if ((window as any).pendingSubtitles && Array.isArray((window as any).pendingSubtitles)) {
                        addSubtitleTracks(videoElement, source, VPS_PROXY);
                    }

                    videoElement.onloadedmetadata = onReady;

                } else if (typeof (window as any).MediaSource !== 'undefined') {
                    console.log('[VideoPlayer] Using HLS.js Player');

                    if ((window as any).hlsInstance) {
                        (window as any).hlsInstance.destroy();
                    }

                    const Hls = (await import('hls.js')).default;
                    if (!Hls.isSupported()) {
                        console.error('[VideoPlayer] Hls.js reported not supported despite MediaSource presence');
                        return;
                    }

                    // Use factory to create DecryptLoader class with current Hls base
                    const DecryptLoader = createDecryptLoader(Hls);
                    const hlsConfig = getHlsConfig(DecryptLoader);
                    const hls = new Hls(hlsConfig);
                    (window as any).hlsInstance = hls;

                    hls.loadSource(url);
                    hls.attachMedia(videoElement);
                    hls.on(Hls.Events.MANIFEST_PARSED, (event: any, data: any) => {
                        console.log('[VideoPlayer] HLS Manifest parsed, levels:', data.levels.length);

                        if (hls.audioTracks && hls.audioTracks.length > 0) {
                            const idTrack = hls.audioTracks.findIndex((t: any) =>
                                (t.lang && (t.lang.toLowerCase() === 'id' || t.lang.toLowerCase().includes('indo'))) ||
                                (t.name && t.name.toLowerCase().includes('indo'))
                            );
                            if (idTrack !== -1) {
                                console.log('[VideoPlayer] Auto-selecting Audio:', hls.audioTracks[idTrack].name);
                                hls.audioTrack = idTrack;
                            }
                        }

                        if ((window as any).pendingSubtitles && Array.isArray((window as any).pendingSubtitles)) {
                            addSubtitleTracks(videoElement, source, VPS_PROXY);
                        }

                        if (hls.subtitleTracks && hls.subtitleTracks.length > 0) {
                            const idSub = hls.subtitleTracks.findIndex((t: any) =>
                                (t.lang && (t.lang.toLowerCase() === 'id' || t.lang.toLowerCase().includes('indo'))) ||
                                (t.name && t.name.toLowerCase().includes('indo'))
                            );
                            if (idSub !== -1) {
                                console.log('[VideoPlayer] Auto-selecting HLS Subtitle:', hls.subtitleTracks[idSub].name);
                                hls.subtitleTrack = idSub;
                            }
                        }

                        onReady();
                    });

                    hls.on(Hls.Events.ERROR, (event: any, data: any) => handleHlsError(hls, data, videoElement, url, errorState!, onReady));

                } else {
                    console.error('[VideoPlayer] No HLS support available');
                    if (loader) loader.style.display = 'none';
                    if (errorState) {
                        const h3 = errorState.querySelector('h3');
                        if (h3) h3.textContent = 'Browser Tidak Didukung';
                        const p = errorState.querySelector('p');
                        if (p) p.textContent = 'Browser Anda tidak mendukung pemutaran video HLS.';
                        errorState.classList.remove('hidden');
                    }
                }
            } else {
                if ((source === 'netshort' && shouldUseFallback(url, source)) && !url.includes(VPS_PROXY)) {
                    url = VPS_PROXY + '?url=' + encodeURIComponent(url);
                }

                videoElement.src = url;
                addSubtitleTracks(videoElement, source, VPS_PROXY);
                videoElement.load();
                videoElement.onloadeddata = onReady;
            }
        };

        // Initialize First Video
        if (videoUrl && videoUrl !== '') {
            console.log('[VideoPlayer] Using provided initial video URL');
            // Decrypt Data Attribute first
            try {
                const { decrypt } = await import('../../utils/security');
                const decrypted = decrypt(videoUrl);
                if (decrypted && decrypted.videoUrl) {
                    loadAndPlay({ videoUrl: decrypted.videoUrl }); // Wrap as object for consistent processing
                } else {
                    // Fallback if not encrypted or valid JSON
                    loadAndPlay({ videoUrl: videoUrl });
                }
            } catch (e) {
                console.error('[VideoPlayer] Initial video decryption failed:', e);
                loadAndPlay({ videoUrl: videoUrl });
            }
        } else if (source && bookId && currentEpisodeId) {
            console.log(`[VideoPlayer] No initial URL, fetching for: ${source}/${bookId}/${currentEpisodeId}`);
            try {
                const fetchUrl = `/api/video-stream?source=${source}&bookId=${bookId}&episodeId=${currentEpisodeId}`;
                const res = await fetch(fetchUrl);
                const data = await res.json();
                loadAndPlay(data);
            } catch (e) {
                console.error('[VideoPlayer] Failed to fetch initial video URL:', e);
                if (loader) loader.style.display = 'none';
                if (errorState) errorState.classList.remove('hidden');
            }
        } else {
            console.warn('[VideoPlayer] Missing required metadata to load video', { source, bookId, currentEpisodeId });
            if (loader) loader.style.display = 'none';
        }

        videoElement.onended = async () => {
            const nextId = getNextEpisodeId(currentEpisodeId);
            if (nextId) {
                console.log('[VideoPlayer] Video ended. Next episode:', nextId);

                const isFullscreen = document.fullscreenElement || (videoElement as any).webkitDisplayingFullscreen;
                if (isFullscreen) {
                    console.log('[VideoPlayer] In Fullscreen. Seamless transition...');

                    if (currentFetchController) currentFetchController.abort();
                    currentFetchController = new AbortController();

                    try {
                        if (loader) {
                            loader.style.display = 'flex';
                            loader.style.opacity = '1';
                        }

                        const nextUrl = `/api/video-stream?source=${source}&bookId=${bookId}&episodeId=${nextId}`;
                        const res = await fetch(nextUrl, { signal: currentFetchController.signal });
                        const data = await res.json();

                        if (data.videoUrl) {
                            videoElement.setAttribute('data-episode-id', nextId);
                            currentEpisodeId = nextId;
                            loadAndPlay(data, true);

                            window.history.replaceState(null, '', `/watch/${source}/${bookId}/${nextId}`);
                        }
                    } catch (e) { console.error(e); }
                    return; // Stay in player
                }

                // Existing Logic: Redirect to next page
                window.location.href = `/watch/${source}/${bookId}/${nextId}?autoplay=1`;
            } else {
                // Exit fullscreen if no next episode
                if (document.exitFullscreen) document.exitFullscreen();
            }
        };

        // Listen for external URL updates (e.g. from Episode List click)
        window.addEventListener('change-video', async (e: any) => {
            const { videoUrl: newUrlRaw, episodeId: newEpId, title: newTitle } = e.detail;
            console.log('[VideoPlayer] Change Video Event:', newEpId);

            videoElement.setAttribute('data-episode-id', newEpId);
            currentEpisodeId = newEpId;
            if (newTitle) videoElement.setAttribute('data-title', newTitle);

            if (currentFetchController) currentFetchController.abort();
            loadAndPlay({ videoUrl: newUrlRaw });
        });

    } catch (e) {
        console.error('[VideoPlayer] Critical Init Error:', e);
    } finally {
        (window as any).isInitializingPlayer = false;
    }
}
