import ytdl from 'youtube-dl-exec';

async function test() {
    try {
        console.log("TT fetch...");
        const res = await ytdl('https://x.com/SpaceX/status/1768276722880098327', {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true
        });
        console.log("TWITTER RES", res.title);
    } catch(e) { console.error("tt err", e) }
}
test();
