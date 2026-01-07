
const https = require('https');

const API_BASE = 'https://api.sansekai.my.id/api';
const PROXY_URL = 'https://vercel-proxy-adialam345s-projects.vercel.app/api';
const bookId = '41000122409';
const episodeId = '602077368';

async function fetchEpisodes() {
    const targetUrl = `${API_BASE}/dramabox/allepisode?bookId=${bookId}`;
    const encodedUrl = encodeURIComponent(targetUrl);
    const fullUrl = `${PROXY_URL}?url=${encodedUrl}`;

    return new Promise((resolve, reject) => {
        https.get(fullUrl, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', reject);
    });
}

async function simulateFetchVideoUrl() {
    const allEpisodeLinks = await fetchEpisodes();
    let items = [];
    if (Array.isArray(allEpisodeLinks)) items = allEpisodeLinks;
    else if (allEpisodeLinks.data && Array.isArray(allEpisodeLinks.data)) items = allEpisodeLinks.data;
    else if (allEpisodeLinks.data && allEpisodeLinks.data.chapterList) items = allEpisodeLinks.data.chapterList;

    const linkData = items.find((ep) => String(ep.chapterId) === String(episodeId));

    if (linkData) {
        const defaultCdn = linkData.cdnList.find((cdn) => cdn.isDefault === 1) || linkData.cdnList[0];

        if (defaultCdn) {
            if (defaultCdn.videoPathList && defaultCdn.videoPathList.length > 0) {
                console.log('VideoPathList found:');
                defaultCdn.videoPathList.forEach(v => {
                    console.log(`- Q: ${v.quality}, Path: ${v.videoPath ? 'Present (' + v.videoPath.substring(0, 20) + '...)' : 'MISSING'}`);
                });
            } else {
                console.log('No videoPathList');
            }
        }
    }
}

simulateFetchVideoUrl();
