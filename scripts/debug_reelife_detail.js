
import fs from 'fs';

export async function run() {
    try {
        const url = 'https://apikupas.my.id/reelife/anime/42000003530?_t=1767905133972';
        console.log('Fetching:', url);
        const res = await fetch(url);
        const data = await res.json();

        fs.writeFileSync('reelife_detail_response.json', JSON.stringify(data, null, 2), 'utf-8');
        console.log('Saved to reelife_detail_response.json');
    } catch (e) {
        console.error('Error:', e);
    }
}

run();
