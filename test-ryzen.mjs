import https from 'https';

const get = (url) => new Promise((resolve) => {
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => resolve(body));
  }).on('error', () => resolve(null));
});

async function run() {
  const url1 = 'https://api.ryzendesu.vip/api/downloader/ytmp4?url=https://www.youtube.com/watch?v=jNQXAC9IVRw';
  const url2 = 'https://api.siputzx.my.id/api/d/ytmp4?url=https://www.youtube.com/watch?v=jNQXAC9IVRw';
  
  console.log(await get(url1));
  console.log(await get(url2));
}
run();
