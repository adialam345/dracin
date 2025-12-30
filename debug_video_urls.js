
const API_BASE = 'https://api.sansekai.my.id/api';

async function fetchVideoUrl(source, bookId, episodeId) {
    try {
        console.log(`Testing ${source} for book ${bookId} ep ${episodeId}...`);
        if (source === 'dramabox') {
            const response = await fetch(`${API_BASE}/dramabox/allepisode?bookId=${bookId}`);
            const allEpisodeLinks = await response.json();
            const linkData = allEpisodeLinks.find((ep) => ep.chapterId === episodeId);
            if (linkData && linkData.cdnList && linkData.cdnList.length > 0) {
                const defaultCdn = linkData.cdnList.find((cdn) => cdn.isDefault === 1) || linkData.cdnList[0];
                if (defaultCdn && defaultCdn.videoPathList) {
                    const video720 = defaultCdn.videoPathList.find((v) => v.quality === 720);
                    const anyVideo = defaultCdn.videoPathList[0];
                    return (video720 || anyVideo)?.videoPath || '';
                }
            }
        } else if (source === 'melolo') {
            const url = `${API_BASE}/melolo/stream?bookId=${bookId}&videoId=${episodeId}`;
            console.log('Melolo Stream URL:', url);
            const response = await fetch(url);
            const data = await response.json();
            return data.data?.main_url || '';
        } else if (source === 'netshort') {
            const url = `${API_BASE}/netshort/allepisode?shortPlayId=${bookId}`;
            console.log('Netshort Allepisode URL:', url);
            const response = await fetch(url);
            const data = await response.json();
            const ep = (data.shortPlayEpisodeInfos || []).find((e) => e.episodeId === episodeId);
            return ep?.playVoucher || '';
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
    return '';
}

async function run() {
    const nsId = '1897859953880399874';
    const nsEpId = '1897859953930731521';

    const mlId = '7341229572660136961';
    const mlEpId = '7341230015322786818';

    const nsUrl = await fetchVideoUrl('netshort', nsId, nsEpId);
    console.log('NS Video URL:', nsUrl ? 'OK' : 'EMPTY');

    const mlUrl = await fetchVideoUrl('melolo', mlId, mlEpId);
    console.log('ML Video URL:', mlUrl ? 'OK' : 'EMPTY');
    if (mlUrl) console.log('ML Sample:', mlUrl.substring(0, 100));
}

run();
