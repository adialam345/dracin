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

        // VALIDATION: Detect garbage output before returning
        // Garbage typically has high-entropy characters, control chars, or non-ASCII
        const isGarbage = (str: string): boolean => {
            // Check for suspicious control characters or binary garbage
            const suspiciousChars = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/;
            if (suspiciousChars.test(str)) return true;

            // Check for high concentration of special characters (likely garbage)
            const specialChars = str.match(/[^a-zA-Z0-9\s\-_./:?=&%#@+,;'"()[\]{}~!$*\\|<>^`]/g) || [];
            if (specialChars.length > str.length * 0.3) return true;

            // If string doesn't start with http or { and has weird chars, it's garbage
            if (!str.startsWith('http') && !str.startsWith('{') && !str.startsWith('"http')) {
                const printable = str.match(/[a-zA-Z0-9]/g) || [];
                if (printable.length < str.length * 0.5) return true;
            }

            return false;
        };

        try {
            return JSON.parse(decodeURIComponent(output));
        } catch (e) {
            try {
                const decoded = decodeURIComponent(output);
                // Validate decoded output
                if (isGarbage(decoded)) {
                    console.warn('[Decrypt] Garbage detected after decode, rejecting');
                    return null;
                }
                return decoded;
            } catch (e2) {
                // If output looks like http..., validate and return it
                if (output.startsWith('http')) {
                    // Extra validation for URL-like output
                    try {
                        const testUrl = new URL(output);
                        // Check hostname is reasonable
                        if (!/^[a-z0-9.-]+$/i.test(testUrl.hostname)) {
                            console.warn('[Decrypt] Invalid hostname in decrypted URL');
                            return null;
                        }
                        return output;
                    } catch (urlErr) {
                        console.warn('[Decrypt] Decrypted output looks like URL but is malformed');
                        return null;
                    }
                }

                // Try reading directly from cleaned base64 just in case it wasn't encrypted but just encoded
                try {
                    const directInfo = Buffer.from(cleaned, 'base64').toString('utf-8');
                    if (directInfo.includes('http')) {
                        // might be JSON
                        if (directInfo.startsWith('{')) return JSON.parse(directInfo);
                        if (directInfo.startsWith('http')) {
                            // Validate the URL
                            try {
                                new URL(directInfo);
                                return directInfo;
                            } catch { return null; }
                        }
                    }
                } catch (e3) { }

                // Final garbage check before returning raw output
                if (isGarbage(output)) {
                    console.warn('[Decrypt] Final output is garbage, rejecting');
                    return null;
                }

                return output;
            }
        }
    } catch (e) {
        console.error("Decryption error:", e);
        return null; // Return null on fatal error
    }
}
