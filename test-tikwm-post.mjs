import fetch from 'node-fetch';

async function test() {
    const url = 'https://www.tiktok.com/@mrbeast/video/7339097970729372974';
    
    // POST request to tikwm
    const f1 = await fetch('https://www.tikwm.com/api/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Accept': 'application/json'
        },
        body: new URLSearchParams({
            url: url,
            count: 12,
            cursor: 0,
            web: 1,
            hd: 1
        })
    });
    console.log("tikwm", await f1.json());
}
test();
