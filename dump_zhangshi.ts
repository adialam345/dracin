
async function dumpJs() {
    const url = `https://pages.farsunpteltd.com/zhangshi.js`;
    console.log('Fetching:', url);
    const res = await fetch(url);
    const text = await res.text();
    console.log('--- START zhangshi.js ---');
    console.log(text);
    console.log('--- END zhangshi.js ---');
}

dumpJs();
