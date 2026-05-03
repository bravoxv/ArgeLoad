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
    'https://pipedapi.kavin.rocks/streams/jNQXAC9IVRw',
    'https://api.piped.projectsegfau.lt/streams/jNQXAC9IVRw',
    'https://pipedapi.in.projectsegfau.lt/streams/jNQXAC9IVRw'
  ];
  for (let url of instances) {
    try {
      const data = await get(url);
      if (data && data.videoStreams) {
        console.log('Success with instance:', url);
        console.log('Title:', data.title);
        console.log('Audio streams:', data.audioStreams?.length);
        console.log('Video streams:', data.videoStreams?.length);
        return;
      }
    } catch(e) { }
  }
}
run();
