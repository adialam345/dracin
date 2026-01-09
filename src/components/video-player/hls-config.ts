export const createDecryptLoader = (Hls: any) => {
    return class DecryptLoader extends Hls.DefaultConfig.loader {
        constructor(config: any) {
            super(config);
        }

        load(context: any, config: any, callbacks: any) {
            // @ts-ignore
            const onSuccess = callbacks.onSuccess;
            // @ts-ignore
            callbacks.onSuccess = async (response: any, stats: any, ctx: any) => {
                // Only decrypt fragments (media segments), not playlists/manifests
                if (ctx.frag) {
                    response.data = await this.decryptTs(response.data);
                }
                onSuccess(response, stats, ctx);
            };
            // @ts-ignore
            super.load(context, config, callbacks);
        }

        async decryptTs(arrayBuffer: ArrayBuffer) {
            try {
                const buf = new Uint8Array(arrayBuffer);
                // Header check (first 24 bytes)
                const header = new TextDecoder().decode(buf.slice(0, 24));
                if (!header.startsWith('shortmax')) return arrayBuffer;

                const keyOffset = parseInt(header.slice(16, 20));
                const dataOffset = parseInt(header.slice(20, 24));

                if (isNaN(keyOffset) || isNaN(dataOffset)) return arrayBuffer;

                const key = buf.slice(keyOffset, keyOffset + 16);
                const iv = new TextEncoder().encode('shortmax00000000');

                // Encrypted data starts at 1024
                const encData = buf.slice(1024, dataOffset + 1024);

                const cryptoKey = await window.crypto.subtle.importKey('raw', key, 'AES-CBC', false, ['decrypt']);
                const dec = await window.crypto.subtle.decrypt({ name: 'AES-CBC', iv }, cryptoKey, encData);

                // Reconstruct: Decrypted Data + Remainder
                const result = new Uint8Array(dec.byteLength + (buf.length - dataOffset - 1024));
                result.set(new Uint8Array(dec), 0);
                result.set(buf.slice(dataOffset + 1024), dec.byteLength);

                return result.buffer;
            } catch (e) {
                console.error('Decryption error:', e);
                return arrayBuffer;
            }
        }
    }
};

export const getHlsConfig = (DecryptLoaderClass: any) => ({
    // Custom Loader for Decryption
    loader: DecryptLoaderClass,

    // Core settings
    enableWorker: true,
    lowLatencyMode: false,

    // Buffer settings - Aggressive buffering to prevent "stuck" playback
    maxBufferLength: 60,        // Start buffering 60s ahead
    maxMaxBufferLength: 600,    // Allow up to 10 mins buffered ahead
    maxBufferSize: 0,           // 0 = Auto/Unlimited

    // Buffer "Hole" tolerance
    maxBufferHole: 2.0,

    // Loading timeouts
    manifestLoadingTimeOut: 30000,
    manifestLoadingMaxRetry: 10,
    manifestLoadingRetryDelay: 1000,

    levelLoadingTimeOut: 30000,
    levelLoadingMaxRetry: 10,

    fragLoadingTimeOut: 40000,
    fragLoadingMaxRetry: 20,
    fragLoadingRetryDelay: 1000,

    // Start level
    startLevel: -1,

    // Network Config
    abrEwmaDefaultEstimate: 400000,
    abrBandWidthFactor: 0.8,
    abrBandWidthUpFactor: 0.7,
    abrMaxWithRealBitrate: false,

    // Cleanup old segments
    backBufferLength: 90,

    // XHR setup
    xhrSetup: function (xhr: any) {
        xhr.withCredentials = false;
    },

    // Debug
    debug: false
});
