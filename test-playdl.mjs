import play from 'play-dl';

async function test() {
  try {
    const video = await play.video_info('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    console.log('Success:', video.video_details.title);
    console.log('Formats:', video.format.length);
  } catch (err) {
    console.error('Error:', err.message);
  }
}
test();
