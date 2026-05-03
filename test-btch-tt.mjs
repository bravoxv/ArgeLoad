import * as btch from 'btch-downloader';
async function test() {
  const ttdl = await btch.ttdl('https://www.tiktok.com/@tiktok/video/7279761168128363822');
  console.log('ttdl keys:', Object.keys(ttdl));
} test();
