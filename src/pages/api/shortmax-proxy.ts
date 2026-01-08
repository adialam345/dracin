
import type { APIRoute } from 'astro';
import crypto from 'node:crypto';

export const GET: APIRoute = async ({ request, url }) => {
    const targetUrl = url.searchParams.get('url');
    const type = url.searchParams.get('type'); // 'm3u8' or 'ts'

    if (!targetUrl) {
        return new Response('Missing URL', { status: 400 });
    }

    try {
        if (type === 'm3u8') {
            const response = await fetch(targetUrl);
            if (!response.ok) return new Response('Failed to fetch M3U8', { status: 502 });

            const originalM3u8 = await response.text();

            // Get the base URL of the M3U8 to resolve relative paths
            const m3u8Base = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

            // Rewrite TS lines
            const lines = originalM3u8.split('\n');
            const newLines = lines
                .filter(line => !line.startsWith('#EXT-X-KEY')) // Remove encryption key definition (since we decrypt at proxy)
                .map(line => {
                const l = line.trim();
                // Check if it is a segment line (not starting with #)
                if (l && !l.startsWith('#')) {
                    // It's a segment URL
                    // Resolve absolute URL
                    const segUrl = l.startsWith('http') ? l : m3u8Base + l;
                    // Point to our proxy
                    const proxyUrl = new URL(request.url); // Current proxy URL
                    proxyUrl.searchParams.set('url', segUrl);
                    proxyUrl.searchParams.set('type', 'ts');
                    return proxyUrl.toString();
                }
                return line;
            });

            return new Response(newLines.join('\n'), {
                headers: {
                    'Content-Type': 'application/vnd.apple.mpegurl',
                    'Access-Control-Allow-Origin': '*'
                }
            });

        } else if (type === 'ts') {
            const response = await fetch(targetUrl);
            if (!response.ok) return new Response('Failed to fetch Segment', { status: 502 });

            const arrayBuffer = await response.arrayBuffer();
            const decryptedBuffer = await decryptTs(arrayBuffer);

            return new Response(decryptedBuffer, {
                headers: {
                    'Content-Type': 'video/mp2t',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        return new Response('Invalid Type', { status: 400 });

    } catch (e) {
        console.error('[ShortMaxProxy] Error:', e);
        return new Response('Internal Server Error', { status: 500 });
    }
};

async function decryptTs(arrayBuffer: ArrayBuffer): Promise<ArrayBuffer> {
    try {
        const buf = new Uint8Array(arrayBuffer);

        // Header check (first 24 bytes)
        const header = new TextDecoder().decode(buf.slice(0, 24));
        if (!header.startsWith('shortmax')) {
            return arrayBuffer;
        }

        const keyOffset = parseInt(header.slice(16, 20));
        const dataOffset = parseInt(header.slice(20, 24));

        if (isNaN(keyOffset) || isNaN(dataOffset)) return arrayBuffer;

        const key = buf.slice(keyOffset, keyOffset + 16);
        const iv = new TextEncoder().encode('shortmax00000000');

        const encData = buf.slice(1024, dataOffset + 1024);

        // Decrypt using Web Crypto API (supported in Node 15+) or Node Crypto
        const decrypted = await decryptAES_CBC(key, iv, encData);

        // Reconstruct: Decrypted Data + Remainder
        // Remainder starts at dataOffset + 1024
        const remainder = buf.slice(dataOffset + 1024);

        const result = new Uint8Array(decrypted.byteLength + remainder.length);
        result.set(new Uint8Array(decrypted), 0);
        result.set(remainder, decrypted.byteLength);

        return result.buffer;

    } catch (e) {
        console.error('[ShortMaxProxy] Decryption error:', e);
        return arrayBuffer;
    }
}

async function decryptAES_CBC(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Promise<ArrayBuffer> {
    // Check if we are in environment with standard Web Crypto (Node 19+) or use 'crypto' module
    // Astro usually has globalThis.crypto
    if (globalThis.crypto && globalThis.crypto.subtle) {
        try {
            const cryptoKey = await globalThis.crypto.subtle.importKey(
                'raw',
                key as any,
                { name: 'AES-CBC' },
                false,
                ['decrypt']
            );
            return await globalThis.crypto.subtle.decrypt(
                { name: 'AES-CBC', iv: iv as any },
                cryptoKey,
                data as any
            );
        } catch (e) {
            // Fallback or error
            throw e;
        }
    } else {
        // Node.js legacy crypto
        const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
        decipher.setAutoPadding(false);

        const b1 = decipher.update(data);
        const b2 = decipher.final();
        const resultBuffer = Buffer.concat([b1, b2]);

        // Return underlying ArrayBuffer properly sliced
        return resultBuffer.buffer.slice(
            resultBuffer.byteOffset,
            resultBuffer.byteOffset + resultBuffer.byteLength
        ) as ArrayBuffer;
    }
}
