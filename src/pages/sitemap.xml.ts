import { fetchAggregatedHome } from '../services/aggregator/home';
import { fetchAggregatedCategory } from '../services/aggregator/category';

export async function GET() {
    const { forYou, trending, latest } = await fetchAggregatedHome();

    // Also fetch some from categories to be more comprehensive
    const vipDramas = await fetchAggregatedCategory('vip');

    // Deduplicate dramas
    const allDramas = [...forYou, ...trending, ...latest, ...vipDramas];
    const uniqueDramasMap = new Map();

    allDramas.forEach(drama => {
        const key = `${drama.source}-${drama.id}`;
        if (!uniqueDramasMap.has(key)) {
            uniqueDramasMap.set(key, drama);
        }
    });

    const uniqueDramas = Array.from(uniqueDramasMap.values());
    const baseUrl = 'https://nontonin.site';

    // Standard categories
    const categories = ['trending', 'terbaru', 'vip'];

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Static Pages -->
  <url>
    <loc>${baseUrl}/</loc>
    <priority>1.0</priority>
    <changefreq>daily</changefreq>
  </url>
  <url>
    <loc>${baseUrl}/info</loc>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${baseUrl}/donasi</loc>
    <priority>0.3</priority>
  </url>

  <!-- Category Pages -->
  ${categories.map(cat => `
  <url>
    <loc>${baseUrl}/category/${cat}</loc>
    <priority>0.7</priority>
    <changefreq>daily</changefreq>
  </url>`).join('')}
  
  <!-- Drama Pages -->
  ${uniqueDramas.map(drama => `
  <url>
    <loc>${baseUrl}/movie/${drama.source || 'dramabox'}/${drama.id}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('')}
</urlset>`.trim();

    return new Response(sitemap, {
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, max-age=3600, s-maxage=3600'
        }
    });
}
