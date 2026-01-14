import * as CryptoJS from 'crypto-js';

// 🔑 KEY INI YANG BERHASIL (WEB KEY)
export const SECRET_KEY = 'shortwebapiaesen';

/**
 * Encrypt Data (AES-128-CBC)
 */
export function encryptData(data: any): string {
    try {
        const plainText = typeof data === 'string' ? data : JSON.stringify(data);
        const key = CryptoJS.enc.Utf8.parse(SECRET_KEY);
        const iv = CryptoJS.enc.Utf8.parse(SECRET_KEY); // IV = Key untuk ShortMax

        const encrypted = CryptoJS.AES.encrypt(plainText, key, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });

        return encrypted.toString(); // Return Base64
    } catch (error) {
        console.error('ShortMax Encryption Failed:', error);
        return '';
    }
}

/**
 * Decrypt Data
 */
export function decryptData(encryptedData: string): any {
    try {
        const key = CryptoJS.enc.Utf8.parse(SECRET_KEY);
        const iv = CryptoJS.enc.Utf8.parse(SECRET_KEY);

        // ShortMax Web API returns Base64 string directly
        const decrypted = CryptoJS.AES.decrypt(encryptedData, key, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });

        const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);

        if (!decryptedStr) return null;

        try {
            return JSON.parse(decryptedStr);
        } catch {
            return decryptedStr;
        }
    } catch (error) {
        // console.error('ShortMax Decryption Failed:', error);
        return null;
    }
}

// Wrapper aliases
export const encryptRequestParams = encryptData;

export function decryptResponseData(response: any): any {
    // Jika response langsung string (seperti Web API), coba decrypt
    if (typeof response === 'string') {
        const attempted = decryptData(response);
        if (attempted) return attempted;
    }

    // Jika response object dengan field data/result terenkripsi
    if (response?.data && typeof response.data === 'string') {
        return { ...response, data: decryptData(response.data) };
    }

    return response;
}
