/**
 * Server-Only Security Module
 * This file should NEVER be imported in client-side code!
 * It contains the secret key and decrypt function.
 */

// Use environment variable in production, fallback for dev
export const SECRET_KEY = import.meta.env.ENCRYPTION_KEY || "flickreels-media-secure-key-v1-2026";

/**
 * Encrypts data into a base64 string (Server-side)
 */
export function encrypt(data: any): string {
    try {
        const json = JSON.stringify(data);
        const text = encodeURIComponent(json);
        let output = "";
        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
            output += String.fromCharCode(charCode);
        }
        return Buffer.from(output, 'binary').toString('base64');
    } catch (e) {
        console.error("Encryption error:", e);
        return "";
    }
}

/**
 * Decrypts a base64 string back to data (Server-only!)
 */
export function decrypt(cipher: string): any {
    try {
        if (!cipher) return null;
        const input = Buffer.from(cipher, 'base64').toString('binary');

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
