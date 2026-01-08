
import fs from 'fs';

export async function run() {
    try {
        const url = 'https://apikupas.my.id/reelife/search/pewaris?_t=1767905075822';
        console.log('Fetching:', url);
        const res = await fetch(url);
        const data = await res.json();

        fs.writeFileSync('reelife_search_response.json', JSON.stringify(data, null, 2), 'utf-8');
        console.log('Saved to reelife_search_response.json');
    } catch (e) {
        console.error('Error:', e);
    }
}

run();
