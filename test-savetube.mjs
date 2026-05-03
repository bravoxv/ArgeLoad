import fetch from 'node-fetch';

async function test(url) {
  try {
    const res = await fetch(`https://v3.savetube.me/api/res?url=https://www.youtube.com/watch?v=jNQXAC9IVRw`);
    console.log(await res.text());
  } catch(e) { console.log(e); }
}test();
