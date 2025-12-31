const https = require('https');

const FAKE_ID = '2YPj';
const COMPILATIONS_ID = '345';
const EPISODIC_DRAMA_ID = '26365';

const URL = `https://cdp.wolftv.online/content/movie/v5/${FAKE_ID}?compilationsId=${COMPILATIONS_ID}&episodicDramaId=${EPISODIC_DRAMA_ID}&videoFakeId=${FAKE_ID}`;

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

https.get(URL, { headers: HEADERS }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.videoFiles && json.videoFiles.length > 0) {
                console.log('VideoFile Item Keys:', Object.keys(json.videoFiles[0]));
                console.log('VideoFile Item Values:', JSON.stringify(json.videoFiles[0], null, 2));
            }
        } catch (e) {
            console.log('Error parsing JSON:', e.message);
        }
    });
});
