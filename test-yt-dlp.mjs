import youtubedl from 'youtube-dl-exec';

youtubedl('https://www.youtube.com/watch?v=jNQXAC9IVRw', {
  dumpJson: true,
  noWarnings: true,
  noCheckCertificate: true,
  preferFreeFormats: true,
  youtubeSkipDashManifest: true
})
.then(output => console.log('Success:', Object.keys(output)))
.catch(err => console.error('Error:', err.message));
