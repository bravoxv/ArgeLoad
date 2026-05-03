import ytdl from 'youtube-dl-exec';

async function test() {
    try {
        console.log("TT fetch...");
        const res = await ytdl('https://www.tiktok.com/@mrbeast/video/7339097970729372974', {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            addHeader: ['referer:tiktok.com', 'user-agent:Mozilla/5.0']
        });
        console.log(JSON.stringify(res, null, 2));
    } catch(e) { console.error("tt err", e) }
    
    try {
        console.log("Insta fetch...");
        const res = await ytdl('https://www.instagram.com/reel/C3u2h7tJxwY/', {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            addHeader: ['referer:instagram.com', 'user-agent:Mozilla/5.0']
        });
        console.log("IG RES", res.title, res.formats?.map(f => f.url));
    } catch(e) { console.error("insta err", e) }
}
test();
