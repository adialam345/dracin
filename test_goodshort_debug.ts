// Debug script for GoodShort home feed
import { getGoodShortHome } from './src/services/providers/goodshort';

async function debugGoodShortHome() {
    console.log('=== Debugging GoodShort Home Feed ===\n');

    // Test direct API call
    const url = `https://api-akm.goodreels.com/hwycclientreels/home/index?timestamp=${Date.now()}`;
    const body = {
        "pageNo": 1,
        "vipBookEnable": false,
        "channelType": 1,
        "pageSize": 30,
        "channelId": "-1",
        "index": ""
    };

    const headers = {
        "Host": "api-akm.goodreels.com",
        "channelCode": "GSASA00001",
        "deviceId": "3d53f928d1aa4dbc9d50347e95f180ee",
        "bigdataSession": "FB7F81F0-9FAC-4673-A273-D36937AD368E",
        "platform": "IOS",
        "Accept": "*/*",
        "apn": "2",
        "Content-Type": "application/json",
        "User-Agent": "GoodShort/2.4.1 (iPhone; iOS 17.0.3; Scale/3.00)",
        "pname": "com.newreading.goodreels",
        "localTime": "2026-01-05 20:45:58.016 +0700",
        "Cookie": 'RT="z=1&dm=api-akm.goodreels.com&si=cc888172-3aac-457a-8298-920eb1607219&ss=mk14veb5&sl=1&tt=11u&rl=1&ld=3e7"',
        "brand": "apple",
        "Accept-Language": "id-ID;q=1",
        "lqa": "0",
        "p": "186",
        "currentLanguage": "in",
        "model": "iPhone 12",
        "ramSize": "3840163840",
        "afid": "1767615583636-3539281",
        "os": "17.0.3",
        "Authorization": "Bearer ZXlKMGVYQWlPaUpLVjFRaUxDSmhiR2NpT2lKSVV6STFOaUo5LmV5SnlaV2RwYzNSbGNsUjVjR1VpT2lKVVJVMVFJaXdpZFhObGNrbGtJam94T0RRME9URXpOVFI5LkpuV0cwWmNfMmczZGVwWDF4YWZvc19VdXk1QnlneG10TXBGNVhCbHVjSmM=",
        "sign": "tOATxkCi6oxWiTVKRrC4d60dSRAbZK/sl/EY8wmd4t6sJDqG+VvkunmKqiajMUvq3gC/wyHbosWT3HWyCiKVUMWJFUZH9HYWRcT6kmepBJPHZt2y7myeZCedGl6B66PgoWAmwet/U2SrtHofMqzOZ5Ux5nXuzfAW8eF6fCTlHmYkPaxWGZsjEGKESkU2pUWxMu8X/ab6TBj7EbgutFmHbwvno/qx5DMJu9p1HPqtrZJwUzDcZ6NwDu2sULzvT98+3slwd7mNe4S/VrmhMSl1Zdrx0j1OZiNuq5TS6MK9/MJImJDYAnRLhg8q4tJ8JifzgParjR/yfx8Bg6VRDlCNPw==",
        "gender": "UNKNOWN",
        "sysModel": "iPhone13,2",
        "appVersion": "204010",
        "romSize": "63870980096",
        "language": "in",
        "timeZone": "+0700",
        "userId": "184491354"
    };

    console.log('Making direct API call...');
    console.log('URL:', url);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });

        console.log('Status:', response.status);
        console.log('Status Text:', response.statusText);

        const data = await response.json();
        console.log('\nResponse structure:');
        console.log('- success:', data.success);
        console.log('- status:', data.status);
        console.log('- message:', data.message);
        console.log('- data exists:', !!data.data);

        if (data.data) {
            console.log('- data.records exists:', !!data.data.records);
            console.log('- data.records length:', data.data.records?.length || 0);

            if (data.data.records && data.data.records.length > 0) {
                console.log('\nFirst record structure:');
                const firstRecord = data.data.records[0];
                console.log('- Type:', firstRecord.type);
                console.log('- Items:', firstRecord.items?.length || 0);
                console.log('- Has ID:', !!firstRecord.id);
                console.log('- Has cover:', !!firstRecord.cover);
            }
        }

        console.log('\n--- Now testing via provider function ---');
        const dramas = await getGoodShortHome();
        console.log('Dramas returned:', dramas.length);

    } catch (error) {
        console.error('Error:', error);
    }
}

debugGoodShortHome().catch(console.error);
