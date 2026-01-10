/**
 * Handle SRT to VTT conversion
 */
export async function handleSRT(response: Response): Promise<Response> {
    const srtText = await response.text();
    const vttText = convertSrtToVtt(srtText);

    return new Response(vttText, {
        status: 200,
        headers: {
            'Content-Type': 'text/vtt',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=31536000'
        }
    });
}

/**
 * Handle VTT/WebVTT subtitles (pass through with CORS)
 */
export async function handleVTT(response: Response): Promise<Response> {
    const vttText = await response.text();

    return new Response(vttText, {
        status: 200,
        headers: {
            'Content-Type': 'text/vtt',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=31536000'
        }
    });
}

/**
 * Convert SRT format to VTT format
 */
function convertSrtToVtt(srt: string): string {
    // Add WEBVTT header
    let vtt = 'WEBVTT\n\n';

    // Replace comma with dot in timestamps (SRT uses comma, VTT uses dot)
    // SRT format: 00:00:01,000 --> 00:00:04,000
    // VTT format: 00:00:01.000 --> 00:00:04.000
    vtt += srt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');

    return vtt;
}

/**
 * Check if URL is SRT subtitle
 */
export function isSRTSubtitle(urlStr: string, contentType: string): boolean {
    return urlStr.endsWith('.srt') || contentType.includes('srt');
}

/**
 * Check if URL is VTT subtitle
 */
export function isVTTSubtitle(urlStr: string, contentType: string): boolean {
    return urlStr.endsWith('.vtt') ||
        urlStr.endsWith('.webvtt') ||
        contentType.includes('vtt') ||
        contentType.includes('text/plain');
}

/**
 * Check if URL is any subtitle format
 */
export function isSubtitle(urlStr: string, contentType: string): boolean {
    return isSRTSubtitle(urlStr, contentType) || isVTTSubtitle(urlStr, contentType);
}
