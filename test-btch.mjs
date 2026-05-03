import { ttdl, igdl } from 'btch-downloader';

async function test() {
    try {
        console.log("TT fetch...");
        const res = await ttdl('https://www.tiktok.com/@tiktok/video/7184252516752706859');
        console.log(JSON.stringify(res, null, 2));
    } catch(e) { console.error("tt err", e) }
    try {
        console.log("IG fetch...");
        const resIg = await igdl('https://www.instagram.com/reel/C2-e2n6oPPA/');
        console.log(JSON.stringify(resIg, null, 2));
    } catch(e) { console.error("ig err", e) }
}
test();
