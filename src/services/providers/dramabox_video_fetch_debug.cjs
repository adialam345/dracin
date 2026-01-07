
const https = require('https');

const API_BASE = 'https://api.sansekai.my.id/api';
const PROXY_URL = 'https://vercel-proxy-adialam345s-projects.vercel.app/api';
const bookId = '41000122409';
const episodeId = '602077368'; // From previous debug

async function fetchEpisodes() {
    const targetUrl = `${API_BASE}/dramabox/allepisode?bookId=${bookId}`;
    const encodedUrl = encodeURIComponent(targetUrl);
    const fullUrl = `${PROXY_URL}?url=${encodedUrl}`;

    console.log('Fetching from:', fullUrl);

    return new Promise((resolve, reject) => {
        https.get(fullUrl, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    console.log('Status:', res.statusCode);
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    console.error('Parse error:', e);
                    resolve(null);
                }
            });
        }).on('error', reject);
    });
}

async function simulateFetchVideoUrl() {
    const allEpisodeLinks = await fetchEpisodes();
    if (!allEpisodeLinks) {
        console.log('Failed to fetch data');
        return;
    }

    let items = [];
    if (Array.isArray(allEpisodeLinks)) items = allEpisodeLinks;
    else if (allEpisodeLinks.data && Array.isArray(allEpisodeLinks.data)) items = allEpisodeLinks.data;
    else if (allEpisodeLinks.data && allEpisodeLinks.data.chapterList) items = allEpisodeLinks.data.chapterList;
    else {
        console.log('Could not determine list structure. Keys:', Object.keys(allEpisodeLinks));
        if (allEpisodeLinks.data) console.log('Data keys:', Object.keys(allEpisodeLinks.data));
    }

    console.log('Items found:', items.length);

    // Debug the find
    const linkData = items.find((ep) => {
        const match = String(ep.chapterId) === String(episodeId);
        if (match) console.log('Match found for', episodeId);
        return match;
    });

    if (linkData) {
        console.log('Link data found.');
        if (linkData.cdnList && linkData.cdnList.length > 0) {
            console.log('CDN List found. Length:', linkData.cdnList.length);
            const defaultCdn = linkData.cdnList.find((cdn) => cdn.isDefault === 1) || linkData.cdnList[0];

            if (defaultCdn) {
                console.log('Default CDN selected.');
                if (defaultCdn.videoPathList && Array.isArray(defaultCdn.videoPathList) && defaultCdn.videoPathList.length > 0) {
                    console.log('Using videoPathList');
                    // ... logic ...
                } else if (defaultCdn.videoPath) {
                    console.log('Using direct videoPath:', defaultCdn.videoPath);
                } else {
                    console.log('No video path found in CDN object. Keys:', Object.keys(defaultCdn));
                }
            } else {
                console.log('No default CDN found?');
            }
        } else {
            console.log('No cdnList');
        }
    } else {
        console.log('Episode not found in list. First 3 IDs:', items.slice(0, 3).map(i => i.chapterId));
    }
}

simulateFetchVideoUrl();
