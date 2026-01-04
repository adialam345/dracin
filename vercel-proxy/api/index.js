
const https = require('https');
const url = require('url');

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,DELETE,PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const targetUrl = req.query.url;

    if (!targetUrl) {
        res.status(400).json({ error: 'Missing url parameter' });
        return;
    }

    console.log(`Proxying: ${targetUrl}`);

    try {
        const parsedUrl = new URL(targetUrl);
        const options = {
            hostname: parsedUrl.hostname,
            port: 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: req.method,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://sansekai.my.id/',
                'Origin': 'https://sansekai.my.id',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
            }
        };

        const proxyReq = https.request(options, (proxyRes) => {
            res.status(proxyRes.statusCode);

            // Forward headers
            Object.keys(proxyRes.headers).forEach(key => {
                res.setHeader(key, proxyRes.headers[key]);
            });

            // Set CORS again just in case upstream overwrites it
            res.setHeader('Access-Control-Allow-Origin', '*');

            proxyRes.pipe(res);
        });

        proxyReq.on('error', (e) => {
            console.error('Request error:', e);
            res.status(500).json({ error: e.message });
        });

        // Loop request body if any (for POSTs)
        if (req.body) {
            // simplified for GET mostly
        }

        proxyReq.end();

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
