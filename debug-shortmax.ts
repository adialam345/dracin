
async function run() {
    const ID = 799690; // Known code from search
    const SHORT_ID = 9960; // Known ID from search
    const TOKEN = '14dcdd925122153afdb1e6e51d6c496e42d38c4149b9974d83eb5b8cb2eef8bb';
    const headers = { 'Authorization': `Bearer ${TOKEN}` };

    const urls = [
        `https://sapimu.au/shortmax/api/v1/detail/${ID}`,
        `https://sapimu.au/shortmax/api/v1/detail/${SHORT_ID}`,
        `https://sapimu.au/shortmax/api/v1/drama/${ID}`,
        `https://sapimu.au/shortmax/api/v1/drama/${SHORT_ID}`,
        `https://sapimu.au/shortmax/api/v1/play/${ID}`,
        `https://sapimu.au/shortmax/api/v1/play/${ID}?lang=id`
    ];

    for (const url of urls) {
        console.log(`Probing ${url}...`);
        try {
            const res = await fetch(url, { headers });
            if (res.ok) {
                const txt = await res.text();
                // Check if JSON
                try {
                    const json = JSON.parse(txt);
                    console.log(`SUCCESS [${res.status}]:`, JSON.stringify(json).substring(0, 100));
                } catch (e) {
                    console.log(`SUCCESS [${res.status}] (Text):`, txt.substring(0, 50));
                }
            } else {
                console.log(`FAILED [${res.status}]`);
            }
        } catch (e) { console.log("Error", e.message); }
    }
}
run();
