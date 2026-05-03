import tt from '@xct007/tiktok-scraper';
import insta from 'instagram-url-downloader';

async function test() {
    try {
        console.log("TT fetch...");
        const res = await tt.Tiktok('https://www.tiktok.com/@mrbeast/video/7339097970729372974');
        console.log(JSON.stringify(res, null, 2));
    } catch(e) { console.error("tt err", e) }
    
    try {
        console.log("Insta fetch...");
        const res = await insta.default('https://www.instagram.com/reel/C3u2h7tJxwY/');
        console.log(JSON.stringify(res, null, 2));
    } catch(e) { console.error("insta err", e) }
}
test();
