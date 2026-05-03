import fetch from 'node-fetch';

async function test() {
    const url = 'https://www.tiktok.com/@tiktok/video/7184252516752706859';
    const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`);
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2));
}
test();
