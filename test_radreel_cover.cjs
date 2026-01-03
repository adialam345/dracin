const https = require('https');

const RADREEL_HEADERS = {
    'Host': 'cdp.wolftv.online',
    'language': '4',
    'User-Agent': 'RadReel/2.7.0 (iPhone; iOS 17.0.3; Scale/3.00)',
    'version-str': '2.7.0',
    'release': 'iOS 17.0.3',
    'country': 'ID',
    'user-token': 'N4gAYsSN7cNoqVsbIg92YYrZQ8jPjgrNrHa7Q+61ITNc2wgryful8ZYNBtXFoVKZ4bqo2BesFhOA092iI/WSNWajH6wmQIfOdZLPh8rejxD6fxO0cq2U+n1ZqzbJoSi4QvKGM6vCh821fvYO71MQoLzSNqDCW/aJLBgdkYXklrMa49WLbAxTkw+0iglllxX4G3ovi7+57qIucQXz3aWE3XPmIzdfp4NaYbQhCMX5bokCw2n6MJYEFAylo9l2PId08/dFRoZja5kh/l827Fv2YUEsjRCJfrQo4RasswkR03TCxB/mO51HFHgbsmIwjcUn5cDa+hr04ZqE5gutrlMwuw==',
    'client-id': '1045'
};

function fetchRadReel(url) {
    return new Promise((resolve) => {
        const req = https.get(url, { headers: RADREEL_HEADERS }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(null);
                }
            });
        });
        req.on('error', (e) => resolve(null));
        req.end();
    });
}

async function test() {
    const detailData = await fetchRadReel('https://cdp.wolftv.online/content/compilations/v2/P8j');

    if (detailData) {
        const keys = Object.keys(detailData).filter(k => k.toLowerCase().includes('cover') || k.toLowerCase().includes('img'));
        console.log('--- DETAIL IMAGES ---');
        keys.forEach(k => console.log(`${k}: ${detailData[k]}`));
    }
}

test();
