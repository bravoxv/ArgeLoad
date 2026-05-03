import { Downloader } from '@tobyg74/tiktok-api-dl';

async function test() {
    try{
        console.log("TT:");
        const tt = await Downloader('https://www.tiktok.com/@mrbeast/video/7339097970729372974', { version: "v1" });
        console.log("TT res", JSON.stringify(tt, null, 2));
    } catch(e) {
        console.error("TT Error:", e);
    }
}
test();
