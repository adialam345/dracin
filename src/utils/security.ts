export const SECRET_KEY = "flickreels-media-secure-key-v1-2026";

/**
 * Encrypts data into a base64 string
 */
export function encrypt(data: any): string {
    try {
        const json = JSON.stringify(data);
        const text = encodeURIComponent(json); // Ensure ASCII
        let output = "";
        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
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

/**
 * Decrypts a base64 string back to data
 */
export function decrypt(cipher: string): any {
    try {
        if (!cipher) return null;
        // Fix common base64 transfer issues (spaces instead of pluses) and allow URL-safe chars
        const safeCipher = cipher.replace(/ /g, '+').replace(/-/g, '+').replace(/_/g, '/');

        const input = typeof atob !== 'undefined'
            ? atob(safeCipher)
            : Buffer.from(safeCipher, 'base64').toString('binary');

        let output = "";
        for (let i = 0; i < input.length; i++) {
            const charCode = input.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
            output += String.fromCharCode(charCode);
        }
        return JSON.parse(decodeURIComponent(output));
    } catch (e) {
        console.error("Decryption error:", e);
        return null;
    }
}
