const https = require('https');

const HEADERS = {
    'Host': 'cdp.wolftv.online',
    'language': '4',
    'User-Agent': 'RadReel/2.7.0 (iPhone; iOS 17.0.3; Scale/3.00)',
    'version-str': '2.7.0',
    'release': 'iOS 17.0.3',
    'country': 'ID',
    'user-token': 'N4gAYsSN7cNoqVsbIg92YYrZQ8jPjgrNrHa7Q+61ITNc2wgryful8ZYNBtXFoVKZ4bqo2BesFhOA092iI/WSNWajH6wmQIfOdZLPh8rejxD6fxO0cq2U+n1ZqzbJoSi4QvKGM6vCh821fvYO71MQoLzSNqDCW/aJLBgdkYXklrMa49WLbAxTkw+0iglllxX4G3ovi7+57qIucQXz3aWE3XPmIzdfp4NaYbQhCMX5bokCw2n6MJYEFAylo9l2PId08/dFRoZja5kh/l827Fv2YUEsjRCJfrQo4RasswkR03TCxB/mO51HFHgbsmIwjcUn5cDa+hr04ZqE5gutrlMwuw==',
    'client-id': '1045'
};

const BASE_URL = 'https://cdp.wolftv.online';

// Known working IDs (from previous logs)
const COMPILATION_ID = '1079'; // Kebaran Api Kemuliaan
const COMPILATION_FAKE_ID = 'xBq';
const EPISODIC_DRAMA_ID = '81722'; // From recommend list for ID 1079

const ENDPOINTS_TO_TEST = [
    // Variation 1: Compilation focused
    `/content/compilations/v2/${COMPILATION_FAKE_ID}/episodes`,
    `/content/compilations/v2/${COMPILATION_FAKE_ID}/list`,
    `/cdp/server_api/compilations/detail?compilationsId=${COMPILATION_ID}`,
    `/cdp/server_api/compilations/get_compilation_detail?compilationId=${COMPILATION_ID}`,

    // Variation 2: Episodic Drama focused
    `/content/episodic_drama/v2/list?compilationsId=${COMPILATION_ID}`,
    `/content/episodic_drama/v2/list?episodicDramaId=${EPISODIC_DRAMA_ID}`,
    `/content/episodic_drama/v2/${EPISODIC_DRAMA_ID}`,
    `/cdp/server_api/episodic_drama/detail?id=${EPISODIC_DRAMA_ID}`,
    `/cdp/server_api/episodic_drama/list?compilationId=${COMPILATION_ID}`,
    `/cdp/server_api/episodic_drama/list?compilationsId=${COMPILATION_ID}`,

    // Variation 3: Movie/Video focused
    `/content/movie/v5/list?compilationsId=${COMPILATION_ID}`,
    `/cdp/server_api/video/list?compilationId=${COMPILATION_ID}`
];

function fetchUrl(path) {
    return new Promise((resolve) => {
        const url = BASE_URL + path;
        console.log(`\nTesting: ${path}`);
        https.get(url, { headers: HEADERS }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`Status: ${res.statusCode}`);
                if (res.statusCode === 200) {
                    try {
                        const json = JSON.parse(data);
                        const keys = Object.keys(json);
                        console.log('Result Keys:', keys);
                        // Check if it looks like a list
                        if (JSON.stringify(json).length < 500) {
                            console.log('Preview:', JSON.stringify(json));
                        } else {
                            console.log('Preview (Truncated):', JSON.stringify(json).substring(0, 200) + '...');
                            // Look for array fields
                            keys.forEach(k => {
                                if (Array.isArray(json[k])) {
                                    console.log(`FOUND ARRAY: ${k} (Length: ${json[k].length})`);
                                    // Print first item keys
                                    if (json[k].length > 0) {
                                        console.log(`Sample Item in ${k}:`, Object.keys(json[k][0]));
                                    }
                                }
                            });
                        }
                    } catch (e) {
                        console.log('Not valid JSON');
                    }
                } else {
                    console.log('Failed');
                }
                resolve();
            });
        }).on('error', (e) => {
            console.error('Error:', e.message);
            resolve();
        });
    });
}

async function run() {
    for (const path of ENDPOINTS_TO_TEST) {
        await fetchUrl(path);
        // small delay
        await new Promise(r => setTimeout(r, 500));
    }
}

run();
