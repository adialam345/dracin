import { getShortMaxForYou } from './src/services/providers/shortmax.ts';

console.log("🚀 Testing ShortMax Implementation...");

try {
    const results = await getShortMaxForYou();

    if (results.length > 0) {
        console.log(`\n✅ SUKSES! Berhasil dapat ${results.length} data.`);
        console.log("Contoh data pertama:");
        console.log(JSON.stringify(results[0], null, 2));
    } else {
        console.log("\n⚠️ Response kosong (tapi tidak error).");
    }
} catch (e) {
    console.error("\n❌ ERROR:", e);
}
