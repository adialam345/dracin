
import fs from 'fs';

export async function run() {
    try {
        const url = 'https://apikupas.my.id/meloshort/anime/68fb4fdbcfb66cb496173e98?_t=1767910788280';
        console.log('Fetching:', url);
        const res = await fetch(url);
        const data = await res.json();

        fs.writeFileSync('meloshort_detail_response.json', JSON.stringify(data, null, 2), 'utf-8');
        console.log('Saved to meloshort_detail_response.json');
    } catch (e) {
        console.error('Error:', e);
    }
}

run();
