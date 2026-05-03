import { Innertube, UniversalCache } from 'youtubei.js';

async function test() {
  try {
    const yt = await Innertube.create({
      cache: new UniversalCache(false),
      generate_session_locally: true
    });
    
    const info = await yt.getInfo('jNQXAC9IVRw');
    console.log('Title:', info.basic_info.title);
    
    // streaming data
    console.log('Formats array:', info.streaming_data?.formats?.length);
    if(info.streaming_data?.formats?.length) {
      console.log('Stream URL:', info.streaming_data.formats[0].url);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}
test();
