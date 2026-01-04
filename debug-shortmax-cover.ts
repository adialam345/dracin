
async function run() {
    const ID = 799690; // "Runaway Young Master" Code
    // Or users 777580
    const TARGET = 777580;
    const TOKEN = '14dcdd925122153afdb1e6e51d6c496e42d38c4149b9974d83eb5b8cb2eef8bb';
    const url = `https://sapimu.au/shortmax/api/v1/play/${TARGET}?lang=id&ep=1`;

    console.log("Fetching Full Play Data...");
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
    const json = await res.json();

    // Check keys in data
    if (json.data) {
        console.log("Keys:", Object.keys(json.data));
        console.log("Cover Field:", json.data.cover);
        console.log("Poster Field:", json.data.poster);
        console.log("Img Field:", json.data.img);
        console.log("Image Field:", json.data.image);
    } else {
        console.log("No data");
    }
}
run();
