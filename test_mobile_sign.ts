
import crypto from 'crypto';

function generateSign(params, salt) {
    const sortedKeys = Object.keys(params)
        .filter(key => params[key] !== undefined && params[key] !== null)
        .sort();

    // Note: chapter_id is array. Need to know how array is stringified for sign.
    // Usually JSON.stringify or joined by comma.
    // Based on Web API log, chapter_id was single string. 
    // In Mobile DownUrl, it's a list.

    const queryString = sortedKeys
        .map(key => {
            let val = params[key];
            if (Array.isArray(val)) {
                // Guessing: formatted as JSON string? or standard query param repetition?
                // Let's try JSON string first as shown in body
                val = JSON.stringify(val);
            }
            return `${key}=${val}`;
        })
        .join('&');

    const stringToSign = queryString + '&signSalt=' + salt;
    console.log('Using salt:', salt);
    // console.log('String to sign:', stringToSign);

    return crypto.createHash('md5').update(stringToSign).digest('hex').toLowerCase();
}

const mobileBody = {
    "apps_flyer_uid": "1767294896845-4754007",
    // Just first few IDs to keep it short for testing, but sign depends on FULL content.
    // I must copy the exact list.
    "chapter_id": ["42499", "42500", "42501", "42502", "42503", "42504", "42505", "42506", "42507", "42508", "42509", "42510", "42511", "42512", "42513", "42514", "42515", "42516", "42517", "42518", "42519", "42520", "42521", "42522", "42523", "42524", "42525", "42526", "42527", "42528", "42529", "42530", "42531", "42532", "42533", "42534", "42535", "42536", "42537", "42538", "42539", "42540", "42541", "42542", "42543", "42544", "42545", "42546", "42547", "42548", "42549", "42550", "42551", "42552", "42553", "42554", "42555", "42556", "42557", "42558", "42559", "42560", "42561", "42562", "42563", "42564", "42565", "42566", "42567"],
    "countryCode": "IDN",
    "device_brand": "iPhone13,2",
    "device_id": "47540D07-1CB4-40AB-A357-20093F4DD4C6",
    "device_number": "17.0.3",
    "device_sign": "f45efe4251cbbc6f3a96ca17916aaee03af13ba6214e5c22423a39d046ef7cc8",
    "language_id": "6",
    "main_package_id": "100",
    "os": "ios"
};

const TARGET_SIGN = "57599032e4b085e6c08633c7a329fda1";
const WEB_SALT = "nW8GqjbdSYRI";

console.log('--- TEST 1: Web Salt ---');
const sign1 = generateSign(mobileBody, WEB_SALT);
console.log('Result:', sign1);
console.log('Match?', sign1 === TARGET_SIGN);

// Maybe array handling is different?
// Maybe salt is different?
