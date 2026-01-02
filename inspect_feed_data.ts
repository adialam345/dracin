import { getFlickReelsForYou } from './src/services/providers/dramaflickreels';

async function inspectFeedData() {
    console.log('Fetching feed data...');
    const items = await getFlickReelsForYou();

    if (items.length > 0) {
        console.log(`Found ${items.length} items`);
        console.log('\nFirst item raw data:');
        console.log(JSON.stringify(items[0], null, 2));

        // Check if feed has episode count
        const hasEpisodes = items.filter(i => i.chapterCount && i.chapterCount > 0);
        console.log(`\nItems with episode count: ${hasEpisodes.length}`);

        if (hasEpisodes.length > 0) {
            console.log('\nSample with episodes:');
            console.log(JSON.stringify(hasEpisodes[0], null, 2));
        }
    }
}

inspectFeedData();
