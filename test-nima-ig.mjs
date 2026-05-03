import ig from '@mrnima/instagram-downloader';

ig.igdl('https://www.instagram.com/reel/C3u2h7tJxwY/').then(r => {
   console.log(r);
   process.exit(0);
}).catch(e => {
   console.error(e);
   process.exit(0);
});
