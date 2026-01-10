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
        const textBuffer = Buffer.from(text, 'utf8');
        const keyBuffer = Buffer.from(SECRET_KEY, 'utf8');
        const output = Buffer.alloc(textBuffer.length);

        for (let i = 0; i < textBuffer.length; i++) {
            output[i] = textBuffer[i] ^ keyBuffer[i % keyBuffer.length];
        }

        return output.toString('base64');
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
        const inputBuffer = Buffer.from(cipher, 'base64');
        const keyBuffer = Buffer.from(SECRET_KEY, 'utf8');
        const output = Buffer.alloc(inputBuffer.length);

        for (let i = 0; i < inputBuffer.length; i++) {
            output[i] = inputBuffer[i] ^ keyBuffer[i % keyBuffer.length];
        }

        const decodedText = output.toString('utf8');
        return JSON.parse(decodeURIComponent(decodedText));
    } catch (e) {
        console.error("Decryption error:", e);
        return null;
    }
}
