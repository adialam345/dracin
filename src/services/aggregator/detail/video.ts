import { Providers, dramaDetailsCache, episodeDetailsCache } from '../common';
import { fetchCached, withCache, API_BASE } from '../../utils';

export async function fetchVideoUrl(source: string, bookId: string, episodeId: string): Promise<string> {
    const {
        Dramabox, Netshort, Melolo, RadReel, FlickReels, Flick, DramaWave,
        DramaDash, ShortMax, StarShort, FreeShort, HiShort, GoodShort,
        DotDrama, StardustTV, ReelLife, Meloshort, Vigloo
    } = Providers;

    try {
        let videoUrl = '';

        if (source === 'dramabox') {
            const allEpisodeLinks = await fetchCached(API_BASE + '/dramabox/allepisode?bookId=' + bookId);
            if (!allEpisodeLinks) return '';

            let items: any[] = [];
            if (Array.isArray(allEpisodeLinks)) items = allEpisodeLinks;
            else if (allEpisodeLinks.data && Array.isArray(allEpisodeLinks.data)) items = allEpisodeLinks.data;
            else if (allEpisodeLinks.data && allEpisodeLinks.data.chapterList) items = allEpisodeLinks.data.chapterList;

            const linkData = items.find((ep: any) => String(ep.chapterId) === String(episodeId));

            if (linkData && linkData.cdnList && linkData.cdnList.length > 0) {
                const defaultCdn = linkData.cdnList.find((cdn: any) => cdn.isDefault === 1) || linkData.cdnList[0];
                if (defaultCdn) {
                    if (defaultCdn.videoPathList && Array.isArray(defaultCdn.videoPathList) && defaultCdn.videoPathList.length > 0) {
                        const video720 = defaultCdn.videoPathList.find((v: any) => v.quality === 720);
                        const video1080 = defaultCdn.videoPathList.find((v: any) => v.quality === 1080);
                        const anyVideo = defaultCdn.videoPathList[0];
                        videoUrl = (video720 || video1080 || anyVideo)?.videoPath || '';
                    }
                    else if (defaultCdn.videoPath) {
                        videoUrl = defaultCdn.videoPath;
                    }
                }
            }
        } else if (source === 'melolo') {
            const data = await fetchCached(API_BASE + '/melolo/stream?bookId=' + bookId + '&videoId=' + episodeId);
            if (!data) return '';
            videoUrl = data.data?.main_url || '';
            if (videoUrl && videoUrl.startsWith('http://')) {
                videoUrl = videoUrl.replace('http://', 'https://');
            }
        } else if (source === 'netshort') {
            const data = await fetchCached(API_BASE + '/netshort/allepisode?shortPlayId=' + bookId);
            if (!data) return '';
            const ep = (data.shortPlayEpisodeInfos || []).find((e: any) => e.episodeId === episodeId);
            videoUrl = ep?.playVoucher || '';

            if (ep && ep.subtitleList && Array.isArray(ep.subtitleList) && ep.subtitleList.length > 0) {
                return JSON.stringify({
                    videoUrl: videoUrl,
                    subtitles: ep.subtitleList.map((sub: any) => ({
                        label: sub.subtitleLanguage === 'id_ID' ? 'Indonesia' : sub.subtitleLanguage,
                        lang: sub.subtitleLanguage || 'id-ID',
                        url: sub.url
                    }))
                });
            }
        } else if (source === 'radreel') {
            if (episodeId === '0') {
                const cached = dramaDetailsCache.get('radreel_' + bookId);
                if (cached && cached.raw?.videoUrl) return cached.raw.videoUrl;
            }

            const parts = bookId.split('_');
            const fakeId = parts[0];
            const url = 'https://cdp.wolftv.online/content/state_res/episodic_movie/movies/' + fakeId;
            const data = await RadReel.fetchRadReel(url);

            if (data && Array.isArray(data)) {
                const ep = data.find((e: any) => e.videoFakeId === episodeId);
                if (ep) {
                    if (ep.videoUrl) videoUrl = ep.videoUrl;
                    else {
                        const videoDetailUrl = 'https://cdp.wolftv.online/content/movie/v5/' + ep.videoFakeId + '?compilationsId=' + ep.compilationsId + '&episodicDramaId=' + (ep.id) + '&videoFakeId=' + ep.videoFakeId;
                        const detailData = await RadReel.fetchRadReel(videoDetailUrl);

                        if (detailData) {
                            let list = [];
                            if (Array.isArray(detailData.videoFiles)) list = detailData.videoFiles;
                            else if (detailData.definitionList) list = detailData.definitionList;
                            else if (detailData.videoFiles?.definitionList) list = detailData.videoFiles.definitionList;

                            if (list.length > 0) {
                                const target = list.find((d: any) => d.definition === 'SD') || list[0];
                                videoUrl = target.videoUrl || target.url || target.videoUri || '';
                                if (videoUrl.includes('wsvideo.wolftv.online')) {
                                    videoUrl = videoUrl.replace('wsvideo.wolftv.online', 'cfvideo.wolftv.online');
                                }
                            }
                        }
                    }
                }
            }
        } else if (source === 'dramawave') {
            let dwDetail = await DramaWave.getDramaWaveDetail(bookId);
            let episodes = dwDetail.episodes;

            if (episodes.length === 0) {
                const cached = dramaDetailsCache.get('dramawave_' + bookId);
                if (cached && cached.raw) {
                    episodes = [{
                        id: bookId,
                        raw: cached.raw
                    }];
                }
            }

            const episode = episodes.find(e => String(e.id) === String(episodeId));

            if (episode && episode.raw) {
                videoUrl = episode.raw.h264_m3u8 ||
                    episode.raw.h265_m3u8 ||
                    episode.raw.external_audio_h264_m3u8 ||
                    episode.raw.external_audio_h265_m3u8 ||
                    episode.raw.video_url ||
                    episode.raw.videoUrl ||
                    '';

                if (episode.raw.vtt_list && Array.isArray(episode.raw.vtt_list)) {
                    return JSON.stringify({
                        videoUrl: videoUrl,
                        subtitles: episode.raw.vtt_list.map((sub: any) => ({
                            label: sub.display_name,
                            lang: sub.language,
                            url: sub.vtt
                        }))
                    });
                } else if (episode.raw.subtitle_list && Array.isArray(episode.raw.subtitle_list)) {
                    return JSON.stringify({
                        videoUrl: videoUrl,
                        subtitles: episode.raw.subtitle_list.map((sub: any) => ({
                            label: sub.display_name,
                            lang: sub.language,
                            url: sub.subtitle
                        }))
                    });
                }
            }
        } else if (source === 'dramaflickreels') {
            const cachedEps = episodeDetailsCache.get('dramaflickreels_' + bookId);
            let foundInCache = false;

            if (cachedEps) {
                const ep = cachedEps.find(e => String(e.id) === String(episodeId));
                if (ep && ep.raw && ep.raw.hls_url) {
                    videoUrl = ep.raw.hls_url;
                    foundInCache = true;
                }
            }

            if (!foundInCache) {
                videoUrl = await FlickReels.getFlickReelsVideoUrl(bookId, episodeId);
            }
        } else if (source === 'flickreels') {
            const cachedEps = episodeDetailsCache.get('flickreels_' + bookId);
            if (cachedEps) {
                const ep = cachedEps.find(e => String(e.id) === String(episodeId));
                if (ep && ep.raw && ep.raw.hls_url) {
                    videoUrl = ep.raw.hls_url;
                }
            }
        } else if (source === 'dramadash') {
            const { episodes } = await DramaDash.getDramaDashDetail(bookId);
            const ep = episodes.find(e => String(e.id) === String(episodeId));
            if (ep && ep.raw && ep.raw.videoUrl) {
                videoUrl = ep.raw.videoUrl;
                if (ep.raw.subtitles && Array.isArray(ep.raw.subtitles)) {
                    return JSON.stringify({
                        videoUrl: videoUrl,
                        subtitles: ep.raw.subtitles.map((sub: any) => ({
                            label: sub.languageDisplayName || sub.language,
                            lang: sub.language,
                            url: sub.url
                        }))
                    });
                }
            }
        } else if (source === 'shortmax') {
            const parts = episodeId.split('_');
            const episodeNum = parts.length > 1 ? parseInt(parts[parts.length - 1]) : 1;

            videoUrl = await withCache(`sm_video_${bookId}_${episodeNum}`, () => ShortMax.getShortMaxVideoUrl(bookId, episodeNum), 45 * 60 * 1000);

            if (!videoUrl) {
                const result = await ShortMax.getShortMaxDetail(bookId);
                if (result && result.episodes) {
                    const ep = result.episodes.find(e => String(e.id) === String(episodeId));
                    if (ep && ep.raw && ep.raw.videoUrl) {
                        videoUrl = ep.raw.videoUrl;
                    }
                }
            }
        } else if (source === 'starshort') {
            videoUrl = await StarShort.getStarShortVideoUrl(bookId, episodeId);
        } else if (source === 'freeshort') {
            const parts = episodeId.split('_');
            const episodeNum = parts.length > 1 ? parseInt(parts[parts.length - 1]) : 1;
            videoUrl = await FreeShort.getFreeShortVideoUrl(bookId, episodeNum);
        } else if (source === 'hishort') {
            videoUrl = await HiShort.getHiShortVideoUrl(episodeId);
        } else if (source === 'goodshort') {
            videoUrl = await GoodShort.getGoodShortVideoUrl(bookId, episodeId);
        } else if (source === 'dotdrama') {
            videoUrl = await DotDrama.getDotDramaVideoUrl(bookId, episodeId);
        } else if (source === 'stardusttv') {
            videoUrl = await StardustTV.getStardustTVVideoUrl(bookId, episodeId);
        } else if (source === 'reelife') {
            videoUrl = await ReelLife.getReelLifeVideoUrl(bookId, parseInt(episodeId) || 1);
        } else if (source === 'meloshort') {
            videoUrl = await Meloshort.getMeloshortVideoUrl(bookId, parseInt(episodeId) || 1);
        } else if (source === 'vigloo') {
            videoUrl = await Vigloo.getViglooVideoUrl(bookId, parseInt(episodeId) || 1);
        }

        console.log('[Aggregator] Video URL for ' + source + '/' + bookId + '/' + episodeId + ': ' + (videoUrl ? 'FOUND' : 'NOT FOUND'));
        return videoUrl;

    } catch (e) {
        console.error('Error fetching video URL:', e);
    }
    return '';
}
