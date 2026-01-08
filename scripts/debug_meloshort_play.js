
import fs from 'fs';

export async function run() {
    try {
        const url = 'https://apikupas.my.id/meloshort/episode/68c38fe32d059c053dc285d8%7C68c38fe42d059c053dc285d9?_t=1767911488679';
        console.log('Fetching:', url);
        const res = await fetch(url);
        const data = await res.json();

        fs.writeFileSync('meloshort_play_response.json', JSON.stringify(data, null, 2), 'utf-8');
        console.log('Saved to meloshort_play_response.json');
    } catch (e) {
        console.error('Error:', e);
    }
}

run();
