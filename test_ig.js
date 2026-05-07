import btch from "btch-downloader";

async function main() {
    const cleanUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    try {
        console.log("Testing BTCH YouTube...");
        const yt = await btch.youtube(cleanUrl);
        console.log(JSON.stringify(yt, null, 2));
    } catch (e) {
        console.error("BTCH fail");
    }
}
main();
