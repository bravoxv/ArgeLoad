import fetch from 'node-fetch';

async function test() {
    try{
        const url = 'https://www.tiktok.com/@mrbeast/video/7339097970729372974';
        const res = await fetch('https://api.cobalt.tools/', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });
        console.log("Cobalt main:", await res.text());
    }catch(e){console.error(e)}
}
test();
