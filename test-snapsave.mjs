import { snapsave } from 'snapsave-media-downloader';

async function test() {
    try{
        console.log("TT:");
        const tt = await snapsave('https://www.tiktok.com/@mrbeast/video/7339097970729372974');
        console.log("TT res", JSON.stringify(tt, null, 2));
    } catch(e) {
        console.error("TT Error:", e);
    }
    try{
        console.log("IG:");
        const ig = await snapsave('https://www.instagram.com/reel/C3u2h7tJxwY/');
        console.log("IG res", JSON.stringify(ig, null, 2));
    } catch(e) {
        console.error("IG Error:", e);
    }
}
test();
