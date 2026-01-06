// Test script for GoodShort home feed
import { getGoodShortHome } from './src/services/providers/goodshort';

async function testGoodShortHome() {
    console.log('=== Testing GoodShort Home Feed ===\n');

    const dramas = await getGoodShortHome();

    if (dramas && dramas.length > 0) {
        console.log(`✓ Home feed fetched successfully!`);
        console.log(`  Total dramas: ${dramas.length}`);
        console.log(`\nFirst 5 dramas:`);

        dramas.slice(0, 5).forEach((drama, index) => {
            console.log(`\n${index + 1}. ${drama.title}`);
            console.log(`   ID: ${drama.id}`);
            console.log(`   Source: ${drama.source}`);
            console.log(`   Chapters: ${drama.chapterCount || 'N/A'}`);
        });
    } else {
        console.log('✗ Failed to fetch home feed or no dramas found');
    }
}

testGoodShortHome().catch(console.error);
