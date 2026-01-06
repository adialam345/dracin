// Test script for GoodShort provider
import { getGoodShortDetail, getGoodShortVideoUrl } from './src/services/providers/goodshort';

async function testGoodShort() {
    console.log('=== Testing GoodShort Provider ===\n');

    // Test with the book ID from the user's example
    const bookId = '31001223187';

    console.log(`1. Testing getGoodShortDetail for book ID: ${bookId}`);
    const detail = await getGoodShortDetail(bookId);

    if (detail) {
        console.log('\n✓ Detail fetched successfully!');
        console.log(`  Title: ${detail.drama.title}`);
        console.log(`  Description: ${detail.drama.description.substring(0, 100)}...`);
        console.log(`  Episodes: ${detail.episodes.length}`);

        if (detail.episodes.length > 0) {
            const firstEp = detail.episodes[0];
            console.log(`\n  First Episode:`);
            console.log(`    ID: ${firstEp.id}`);
            console.log(`    Name: ${firstEp.name}`);
            console.log(`    Unlock: ${firstEp.unlock}`);
            console.log(`    Has m3u8Path: ${!!firstEp.raw.m3u8Path}`);

            if (firstEp.raw.m3u8Path) {
                console.log(`\n2. Testing getGoodShortVideoUrl for episode ${firstEp.id}`);
                const videoUrl = await getGoodShortVideoUrl(bookId, firstEp.id);

                if (videoUrl) {
                    console.log('\n✓ Video URL fetched successfully!');
                    console.log(`  URL: ${videoUrl.substring(0, 100)}...`);
                } else {
                    console.log('\n✗ Failed to fetch video URL');
                }
            }
        }
    } else {
        console.log('\n✗ Failed to fetch detail');
    }
}

testGoodShort().catch(console.error);
