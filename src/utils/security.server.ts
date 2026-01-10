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

        // Advanced Base64 Cleanup
        let cleaned = cipher
            .replace(/-/g, '+')
            .replace(/_/g, '/')
            .replace(/ /g, '+'); // Fix potential spaces from copy-paste or URL decoding

        // Add padding if missing
        while (cleaned.length % 4) {
            cleaned += '=';
        }

        const input = Buffer.from(cleaned, 'base64').toString('binary');

        // Simple XOR Decrypt
        let output = "";
        for (let i = 0; i < input.length; i++) {
            const charCode = input.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
            output += String.fromCharCode(charCode);
        }

        // Light garbage detection - only reject obvious binary/null garbage
        const hasNullBytes = output.includes('\x00');
        if (hasNullBytes) {
            console.warn('[Decrypt] Null bytes detected, rejecting');
            return null;
        }

        try {
            return JSON.parse(decodeURIComponent(output));
        } catch (e) {
            try {
                return decodeURIComponent(output);
            } catch (e2) {
                // If output looks like http..., return it
                if (output.startsWith('http')) return output;

                // Try reading directly from cleaned base64 just in case it wasn't encrypted but just encoded
                try {
                    const directInfo = Buffer.from(cleaned, 'base64').toString('utf-8');
                    if (directInfo.includes('http')) {
                        // might be JSON
                        if (directInfo.startsWith('{')) return JSON.parse(directInfo);
                        if (directInfo.startsWith('http')) return directInfo;
                    }
                } catch (e3) { }

                return output;
            }
        }
    } catch (e) {
        console.error("Decryption error:", e);
        return null; // Return null on fatal error
    }
}
