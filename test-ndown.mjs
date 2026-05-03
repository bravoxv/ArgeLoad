import { ndown } from 'nayan-videos-downloader';
async function test() {
  console.log(await ndown('https://www.instagram.com/reel/C2_vOqNry4n/'));
}
test();
