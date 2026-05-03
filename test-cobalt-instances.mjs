import fetch from 'node-fetch';

async function test(host) {
  try {
    const res = await fetch(`https://${host}/`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: 'https://vimeo.com/712396349' })
    });
    console.log(host, await res.text());
  } catch(e) {}
}

const instances = [
  'co.wuk.sh', 'cobalt.catgirl.party', 'cobalt.q0.o-o.studio', 'cobalt.kellerstadt.de'
];
for (let i of instances) {
  await test(i);
}
