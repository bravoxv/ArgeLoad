import { ttdl, igdl } from 'ruhend-scraper';

async function test() {
    try {
        console.log("TT fetch...");
        const res = await ttdl('https://www.tiktok.com/@mrbeast/video/7339097970729372974');
        console.log(JSON.stringify(res, null, 2));
    } catch(e) { console.error("tt err", e) }
    
    try {
        console.log("Insta fetch...");
        const resIg = await igdl('https://www.instagram.com/reel/C3u2h7tJxwY/');
        console.log(JSON.stringify(resIg, null, 2));
    } catch(e) { console.error("insta err", e) }
}
test();
