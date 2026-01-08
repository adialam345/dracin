
import fs from 'fs';

export async function run() {
    try {
        const url = 'https://apikupas.my.id/reelife/home?_t=1767904804553';
        console.log('Fetching:', url);
        const res = await fetch(url);
        const data = await res.json();

        fs.writeFileSync('reelife_response.json', JSON.stringify(data, null, 2), 'utf-8');
        console.log('Saved to reelife_response.json');
    } catch (e) {
        console.error('Error:', e);
    }
}

run();
