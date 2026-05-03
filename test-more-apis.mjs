import fetch from 'node-fetch';

async function test(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }});
    const text = await res.text();
    console.log(url.substring(0, 30), text.substring(0, 100));
  } catch(e) {
    console.log(url.substring(0, 30), 'Fail');
  }
}

const apis = [
  'https://api.vreden.my.id/api/ytmp4?url=https://www.youtube.com/watch?v=jNQXAC9IVRw',
  'https://api.giftedtech.my.id/api/download/dlmp4?url=https://www.youtube.com/watch?v=jNQXAC9IVRw',
  'https://api.dreaded.site/api/ytdl/video?url=https://youtu.be/jNQXAC9IVRw',
  'https://api.popcat.xyz/ytmp4?url=https://www.youtube.com/watch?v=jNQXAC9IVRw'
];
apis.forEach(test);
