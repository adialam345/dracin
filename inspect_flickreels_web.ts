
async function findJs(id) {
    const url = `https://pages.farsunpteltd.com/?playlet_id=${id}&package_id=1`;
    try {
        const res = await fetch(url);
        const text = await res.text();
        const lines = text.split('\n');
        lines.forEach(line => {
            if (line.includes('<script')) {
                console.log(line.trim());
            }
        });
    } catch (e) {
        console.error(e);
    }
}

findJs('4793');
