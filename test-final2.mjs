import * as tt from '@xct007/tiktok-scraper';
import qs from 'querystring';

console.log(tt);

import insta from 'instagram-url-downloader';

async function test() {
    try {
        console.log("Insta fetch...");
        const res = await (new insta.default()).download('https://www.instagram.com/reel/C3u2h7tJxwY/');
        console.log(JSON.stringify(res, null, 2));
    } catch(e) { console.error("insta err", e) }
}
test();
