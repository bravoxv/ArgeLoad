import * as btch from 'btch-downloader';

async function test() {
  console.log('Twitter AIO:', await btch.aio('https://twitter.com/elonmusk/status/1765039395276329061'));
  console.log('FB AIO:', await btch.aio('https://www.facebook.com/watch/?v=952402139626354'));
  console.log('IG AIO:', await btch.aio('https://www.instagram.com/reel/C2_vOqNry4n/?igsh=YzljYTk1ODg3Zg=='));
}
test();
