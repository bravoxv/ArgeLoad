import { youtubedl, youtubedlv2 } from '@bochilteam/scraper';

async function test() {
  try {
    const res = await youtubedl('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    console.log('Success (v1):', Object.keys(res));
  } catch (e) {
    console.error('v1 Failed', e.message);
  }
}
test();
