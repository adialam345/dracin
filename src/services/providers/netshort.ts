import { fetchCached, API_BASE } from '../utils';
import { normalizeAny, type UnifiedDrama } from '../adapter';

export async function getNetshortTrending(): Promise<UnifiedDrama[]> {
    const data = await fetchCached('https://dramabos.asia/api/netshort/api/drama/discover?lang=id_ID');
    return extractList(data);
}

export async function getNetshortForYou(): Promise<UnifiedDrama[]> {
    // Netshort doesn't seem to have a separate For You, use discover
    const data = await fetchCached('https://dramabos.asia/api/netshort/api/drama/discover?lang=id_ID');
    return extractList(data);
}

export async function searchNetshort(query: string): Promise<UnifiedDrama[]> {
    const data = await fetchCached(`https://dramabos.asia/api/netshort/api/drama/find?q=${encodeURIComponent(query)}&lang=id_ID`);
    return extractList(data);
}

export async function getNetshortDetail(id: string): Promise<{ drama: any, episodes: any[] }> {
    const url = `https://dramabos.asia/api/netshort/api/drama/info/${id}?lang=id_ID`;
    console.log('[Netshort] Fetching detail for ID:', id);

    const response = await fetchCached(url);
    console.log('[Netshort] Response received:', response ? 'YES' : 'NO');

    if (!response) {
        console.error('[Netshort] No response from API');
        return { drama: null, episodes: [] };
    }

    if (!response.success) {
        console.error('[Netshort] API returned success=false');
        return { drama: null, episodes: [] };
    }

    if (!response.data) {
        console.error('[Netshort] No data in response');
        return { drama: null, episodes: [] };
    }

    const data = response.data;
    const info = data.dramaInfo || {};

    console.log('[Netshort] Drama name:', data.name || info.shortPlayName);
    console.log('[Netshort] Episodes count:', data.result ? data.result.length : 0);

    // Use fields matching normalizeNetshort where possible
    const dramaInfo = {
        id: id,
        title: data.name || info.shortPlayName || 'Netshort Drama',
        cover: info.shortPlayCover || data.cover || info.cover || '',
        description: info.shotIntroduce || data.desc || info.desc || '',
        chapterCount: info.totalEpisode || data.totalNum || (data.result ? data.result.length : 0),
        source: 'netshort',
        raw: data
    };

    const episodes = (data.result || []).map((ep: any, idx: number) => {
        const epNo = ep.episodeNo || ep.episode_no || (idx + 1);
        console.log(`[Netshort] Episode ${idx}: epNo=${epNo}, id=${ep.id}`);
        return {
            id: String(epNo),
            name: `Episode ${epNo}`,
            index: idx,
            unlock: true
        };
    });

    console.log('[Netshort] Total episodes mapped:', episodes.length);
    if (episodes.length > 0) {
        console.log('[Netshort] First episode ID:', episodes[0].id);
    }

    return { drama: dramaInfo, episodes };
}

export async function getNetshortVideoUrl(dramaId: string, episodeId: string): Promise<string> {
    const url = `https://dramabos.asia/api/netshort/api/drama/view/${dramaId}/ep/${episodeId}?lang=id_ID`;
    console.log('[Netshort Video] Fetching video for drama:', dramaId, 'episode:', episodeId);
    console.log('[Netshort Video] URL:', url);

    const response = await fetchCached(url);
    console.log('[Netshort Video] Response received:', response ? 'YES' : 'NO');

    if (!response || !response.success || !response.data) {
        console.error('[Netshort Video] Invalid response');
        return '';
    }

    const data = response.data;
    console.log('[Netshort Video] Video URL:', data.videoUrl ? 'FOUND' : 'NOT FOUND');

    if (data.videoUrl) {
        if (data.subtitles && Array.isArray(data.subtitles) && data.subtitles.length > 0) {
            console.log('[Netshort Video] Subtitles found:', data.subtitles.length);
            return JSON.stringify({
                videoUrl: data.videoUrl,
                subtitles: data.subtitles.map((sub: any) => ({
                    label: sub.langName || sub.language || sub.lang || 'Sub',
                    lang: sub.language || sub.lang || 'id',
                    url: sub.url
                }))
            });
        }
        console.log('[Netshort Video] Returning video URL (no subtitles)');
        return data.videoUrl;
    }

    console.error('[Netshort Video] No video URL in response data');
    return '';
}

function extractList(data: any): UnifiedDrama[] {
    if (!data || !data.success) return [];
    let items: any[] = [];

    if (data.data?.dataList) items = data.data.dataList; // Discover
    else if (Array.isArray(data.data)) items = data.data; // Search
    else if (data.data?.list) items = data.data.list;

    return items.map(item => normalizeAny(item, 'netshort')).filter(i => i.id);
}
