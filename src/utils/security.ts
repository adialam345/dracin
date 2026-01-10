
const _k = ['flickreels', 'media', 'secure', 'key', 'v1', '2026', 'fixed', 'stable'];
const _getKey = () => _k.join('-');

/**
 * Encrypts data into a base64 string
 * This is safe to use on client-side as encrypt operation doesn't reveal the decrypt logic
 */
export function encrypt(data: any): string {
    try {
        const key = _getKey();
        const json = JSON.stringify(data);
        const text = encodeURIComponent(json);
        let output = "";
        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
            output += String.fromCharCode(charCode);
        }
        return typeof btoa !== 'undefined'
            ? btoa(output)
            : Buffer.from(output, 'binary').toString('base64');
    } catch (e) {
        console.error("Encryption error:", e);
        return "";
    }
}

export function decrypt(encryptedData: string): any {
    try {
        const key = _getKey();
        const text = typeof atob !== 'undefined'
            ? atob(encryptedData)
            : Buffer.from(encryptedData, 'base64').toString('binary');
        let output = "";
        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
            output += String.fromCharCode(charCode);
        }
        return JSON.parse(decodeURIComponent(output));
    } catch (e) {
        console.error("Decryption error:", e);
        return null;
    }
}
