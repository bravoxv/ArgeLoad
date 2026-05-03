import { tiktokdl } from '@xct007/tiktok-scraper';

async function test() {
    try {
        const res = await tiktokdl('https://www.tiktok.com/@mrbeast/video/7339097970729372974');
        console.log(JSON.stringify(res, null, 2));
    } catch(e) { console.error(e) }
}
test();
