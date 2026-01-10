import { fetchUnifiedDramaData } from './detail/drama';
import { fetchVideoUrl } from './detail/video';

export { fetchUnifiedDramaData, fetchVideoUrl };

export async function fetchUnifiedDetail(source: string, id: string): Promise<any> {
    const { drama } = await fetchUnifiedDramaData(source, id);
    return drama;
}

export async function fetchUnifiedEpisodes(source: string, id: string): Promise<any[]> {
    const { episodes } = await fetchUnifiedDramaData(source, id);
    return episodes;
}
