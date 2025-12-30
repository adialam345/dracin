
const API_BASE = 'https://api.sansekai.my.id/api';

async function run() {
    const nsId = '1897859953880399874';
    const nsEpId = '1897859953930731521';
    const mlId = '7341229572660136961';
    const mlEpId = '7341230015322786818';

    try {
        console.log('--- NetShort ---');
        const r1 = await fetch(`${API_BASE}/netshort/allepisode?shortPlayId=${nsId}`);
        const d1 = await r1.json();
        const ep1 = d1.shortPlayEpisodeInfos.find(e => e.episodeId === nsEpId);
        if (ep1) {
            console.log('NS URL:', ep1.playVoucher);
        }

        console.log('\n--- Melolo ---');
        const r2 = await fetch(`${API_BASE}/melolo/stream?bookId=${mlId}&videoId=${mlEpId}`);
        const d2 = await r2.json();
        if (d2.data) {
            console.log('ML Main URL:', d2.data.main_url);
            console.log('ML Backup URL:', d2.data.backup_url);
        }
    } catch (e) {
        console.log('ERROR:', e.message);
    }
}
run();
