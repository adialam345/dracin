/**
 * Server-Only Security Module
 * This file should NEVER be imported in client-side code!
 * It contains the secret key and decrypt function.
 */

// Use a FIXED key to prevent decryption errors between server restarts/builds
export const SECRET_KEY = "flickreels-media-secure-key-v1-2026-fixed-stable";

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

        // Handle URL encoding anomalies
        let cleaned = cipher.replace(/ /g, '+');

        const input = Buffer.from(cleaned, 'base64').toString('binary');

        // Simple XOR Decrypt
        let output = "";
        for (let i = 0; i < input.length; i++) {
            const charCode = input.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
            output += String.fromCharCode(charCode);
        }

        try {
            return JSON.parse(decodeURIComponent(output));
        } catch (e) {
            // Try raw decode
            try {
                return decodeURIComponent(output);
            } catch (e2) {
                // If output looks like http..., return it
                if (output.startsWith('http')) return output;

                // Debug: maybe cipher IS the base64 url?
                try {
                    const directBase64 = Buffer.from(cipher, 'base64').toString('ascii');
                    if (directBase64.startsWith('http')) return directBase64;
                } catch (e3) { }

                return output;
            }
        }
    } catch (e) {
        console.error("Decryption error:", e);
        return null; // Return null on fatal error
    }
}
