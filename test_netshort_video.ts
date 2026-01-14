import * as Netshort from './src/services/providers/netshort.ts';

async function test() {
    console.log('Testing Netshort Video URL...');
    const url = await Netshort.getNetshortVideoUrl('2009476343208890370', '2');
    console.log('Result:', url);
}

test().catch(console.error);
