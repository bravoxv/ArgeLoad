import * as btch from 'btch-downloader';

async function test() {
  try {
     console.log('Twitter:', await btch.twitter('https://twitter.com/i/status/1765039395276329061'));
  } catch(e){}
  
  try {
     console.log('FB:', await btch.fbdown('https://www.facebook.com/watch/?v=952402139626354'));
  } catch(e){}

}
test();
