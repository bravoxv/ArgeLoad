import ruhend from "ruhend-scraper";
import fs from "fs";

async function main() {
    const cleanUrl = 'https://www.instagram.com/p/DX96hKcFf6a/?img_index=1';
    try {
        const ig = await ruhend.igdl(cleanUrl);
        console.log("IG Data length:", ig?.data?.length);
        fs.writeFileSync("ig_out.json", JSON.stringify(ig, null, 2));
    } catch (e) {
        console.error(e);
    }
}
main();
