
async function scanJs() {
    const url = `https://pages.farsunpteltd.com/zhangshi.js`;
    console.log('Fetching:', url);
    try {
        const res = await fetch(url);
        if (!res.ok) {
            console.log('Failed to fetch JS:', res.status);
            return;
        }
        const text = await res.text();
        console.log('JS Length:', text.length);

        // Search for potential keys/salts
        // Common variable names: AppKey, Secret, Sign, Salt
        const keywords = ['Sign', 'md5', 'MD5', 'secret', 'key', 'salt', 'app_id'];

        // Naive search for string literals that look like keys (32 chars hex)
        const hex32 = text.match(/["']([a-f0-9]{32})["']/g);
        if (hex32) {
            console.log('Potential 32-char hex keys:', [...new Set(hex32)]); // dedup
        }

        // Search for "Sign" assignment
        const signContext = text.match(/.{50}Sign.{50}/g);
        if (signContext) {
            console.log('\nContext for "Sign":');
            signContext.slice(0, 5).forEach(c => console.log('...', c, '...'));
        }
    } catch (e) {
        console.error(e);
    }
}

scanJs();
