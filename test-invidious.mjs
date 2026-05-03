import http from 'http';
import https from 'https';

const get = (url) => new Promise((resolve) => {
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => resolve(JSON.parse(body)));
  }).on('error', () => resolve(null));
});

async function run() {
  const instances = [
    'https://vid.priv.au/api/v1/videos/jNQXAC9IVRw',
    'https://invidious.asir.dev/api/v1/videos/jNQXAC9IVRw',
    'https://invidious.nerdvpn.de/api/v1/videos/jNQXAC9IVRw'
  ];
  for (let url of instances) {
    try {
      const data = await get(url);
      if (data && data.formatStreams) {
        console.log('Success with instance:', url);
        console.log('Formats found:', data.formatStreams.length);
        console.log('Sample format:', data.formatStreams[0].url);
        return;
      } else {
        console.log('No formatStreams for', url);
        console.log('Keys:', Object.keys(data || {}));
      }
    } catch(e) {
      console.log('Failed:', url);
    }
  }
}
run();
