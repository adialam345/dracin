
const API_BASE = 'https://api.sansekai.my.id/api';

async function run() {
    const nsId = '1897859953880399874';
    const nsEpId = '1897859953930731521';
    const mlId = '7341229572660136961';
    const mlEpId = '7341230015322786818';

    try {
        const r1 = await fetch(`${API_BASE}/netshort/allepisode?shortPlayId=${nsId}`);
        const d1 = await r1.json();
        const ep1 = d1.shortPlayEpisodeInfos.find(e => e.episodeId === nsEpId);
        console.log('NETSHORT EP FOUND?', !!ep1);
        if (ep1) console.log('NETSHORT URL STARTS WITH:', ep1.playVoucher.substring(0, 30));

        const r2 = await fetch(`${API_BASE}/melolo/stream?bookId=${mlId}&videoId=${mlEpId}`);
        const d2 = await r2.json();
        const url2 = d2.data?.main_url;
        console.log('MELOLO URL FOUND?', !!url2);
        if (url2) console.log('MELOLO URL STARTS WITH:', url2.substring(0, 30));
    } catch (e) {
        console.log('ERROR:', e.message);
    }
}
run();
