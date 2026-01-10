import type { APIRoute } from 'astro';
import { fetchAggregatedHome } from '../services/aggregator/home';

export const GET: APIRoute = async () => {
    const siteUrl = 'https://nontonin.site'; // Sesuaikan dengan domain asli
    let urls = [
        { loc: `${siteUrl}/`, priority: '1.0', changefreq: 'daily' },
        { loc: `${siteUrl}/search`, priority: '0.8', changefreq: 'daily' },
        // Tambahkan halaman statis penting lainnya
    ];

    try {
        // Ambil data dinamis dari aggregator (Trending & Latest) untuk dijadikan sitemap
        const feed = await fetchAggregatedHome();
        const allDramas = [
            ...feed.trending,
            ...feed.latest,
            ...feed.forYou
        ];

        // Hapus duplikat berdasarkan ID
        const uniqueDramas = new Map();
        allDramas.forEach(drama => {
            const uniqueId = `${drama.source}-${drama.id}`;
            if (!uniqueDramas.has(uniqueId)) {
                uniqueDramas.set(uniqueId, drama);
            }
        });

        uniqueDramas.forEach(drama => {
            urls.push({
                loc: `${siteUrl}/movie/${drama.source}/${drama.id}`,
                priority: '0.7',
                changefreq: 'weekly'
            });
        });

    } catch (e) {
        console.error('Error generating dynamics sitemap:', e);
    }

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls.map(url => `
  <url>
    <loc>${url.loc}</loc>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join('')}
</urlset>`;

    return new Response(sitemap, {
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, max-age=3600' // Cache 1 jam
        }
    });
};
