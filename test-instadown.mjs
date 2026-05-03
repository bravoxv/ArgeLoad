import insta from 'instagram-url-downloader';

async function test() {
    try {
        const res = await insta('https://www.instagram.com/reel/C3u2h7tJxwY/');
        console.log(JSON.stringify(res, null, 2));
    } catch(e) { console.error(e) }
}
test();
