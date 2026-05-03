import https from 'https';

const fetchUrl = (url) => new Promise((resolve) => {
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => resolve({ url, data: body }));
  }).on('error', () => resolve({ url, data: null }));
});

async function run() {
  const apis = [
    'https://aemt.me/youtube?url=https://www.youtube.com/watch?v=jNQXAC9IVRw',
    'https://api.shinoa.xyz/api/download/youtube?url=https://www.youtube.com/watch?v=jNQXAC9IVRw',
    'https://api.dorratz.com/v2/yt-play?url=https://www.youtube.com/watch?v=jNQXAC9IVRw'
  ];
  for(let u of apis) {
    const res = await fetchUrl(u);
    console.log(u.substring(0,30), res.data ? res.data.substring(0, 100) : 'null');
  }
}
run();
