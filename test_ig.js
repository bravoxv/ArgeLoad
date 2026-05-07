import btch from "btch-downloader";
import fs from "fs";

async function main() {
    const cleanUrl = 'https://www.instagram.com/stories/cristiano/3362145347209706399/';
    try {
        const igb = await btch.igdl(cleanUrl);
        console.log("BTCH Data length:", igb?.result?.length);
        fs.writeFileSync("ig_out.json", JSON.stringify(igb, null, 2));
    } catch (e) {
        console.error("BTCH failed", e);
    }
}
main();
