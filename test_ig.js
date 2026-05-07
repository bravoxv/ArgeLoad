import ruhend from "ruhend-scraper";
import fetch from "node-fetch";
import fs from "fs";

async function main() {
    const cleanUrl = 'https://x.com/AcademiaOrbis/status/1787206128076937614';
    try {
        const urlParts = cleanUrl.split('/');
        const tweetId = urlParts[urlParts.length - 1];
        const vxUrl = `https://api.vxtwitter.com/status/${tweetId}`;
        console.log("VX URL:", vxUrl);
        const res = await fetch(vxUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const data = await res.json();
        console.log("VX Data Keys:", Object.keys(data));
        if (data.media_extended) {
            console.log("Media Extended Details:");
            data.media_extended.forEach((m, i) => {
                console.log(`Item ${i}: type=${m.type}, url=${m.url}`);
            });
        }
        fs.writeFileSync("vx_out.json", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("VX failed", e);
    }
}
main();
