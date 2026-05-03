import fetch from 'node-fetch';

async function t(url) {
  try {
    const r = await fetch(url);
    console.log(await r.text());
  } catch(e) {}
}

t('https://paxkxdk-downloader.hf.space/api/ytdl?url=https://www.youtube.com/watch?v=jNQXAC9IVRw');
t('https://paxkxdk-downloader.hf.space/api/v2/ytdl?url=https://www.youtube.com/watch?v=jNQXAC9IVRw');
