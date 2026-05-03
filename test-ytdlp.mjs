import youtubedl from 'youtube-dl-exec';

async function test() {
  try {
    const raw = await youtubedl('https://twitter.com/i/status/1765039395276329061', { dumpJson: true });
    console.log('Twitter success:', raw.title);
  } catch(e) { console.error('Twitter fail', e.message); }

  try {
    const raw = await youtubedl('https://www.instagram.com/reel/C2_vOqNry4n/', { dumpJson: true });
    console.log('IG success:', raw.title);
  } catch(e) { console.error('IG fail', e.message); }
}
test();
