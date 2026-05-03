import fetch from 'node-fetch';

async function test() {
    try{
        const url = 'https://www.tiktok.com/@mrbeast/video/7339097970729372974';
        const res = await fetch('https://cobalt.qiaoxi.macoq.com/api/json', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });
        console.log("Cobalt 1:", await res.json());
    }catch(e){console.error(e)}
    try{
        const url = 'https://www.instagram.com/reel/C3u2h7tJxwY/';
        const res = await fetch('https://api.cobalt.tools/api/json', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0'
            },
            body: JSON.stringify({ url })
        });
        console.log("Cobalt api:", await res.json());
    }catch(e){console.error(e)}
}
test();
