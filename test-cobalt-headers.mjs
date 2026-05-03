import fetch from 'node-fetch';

async function test() {
  const res = await fetch('https://api.cobalt.tools/', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Origin': 'https://cobalt.tools',
      'Referer': 'https://cobalt.tools/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    },
    body: JSON.stringify({ url: 'https://vimeo.com/712396349' })
  });
  console.log(await res.text());
}
test();
