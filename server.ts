import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import fetch from 'node-fetch';
import ytdl from 'youtube-dl-exec';
import multer from 'multer';
import fs from 'fs';

const upload = multer({ dest: 'uploads/' });

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Scraper Engine Logic ---

// Pre-import scrapers for faster access
const ruhendPromise = import('ruhend-scraper');
const btchPromise = import('btch-downloader');

async function startServer() {
  const app = express();
  const PORT = 3000;

  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } else {
    try {
      fs.readdirSync(uploadsDir).forEach(file => {
        fs.unlink(path.join(uploadsDir, file), () => { });
      });
    } catch (e) {
      console.error("Cleanup error", e);
    }
  }

  app.use(cors());
  app.use(express.json());

  // Helper for parallel racing of scrapers
  const raceScrapers = async (tasks: Promise<any>[]) => {
    const results = await Promise.allSettled(tasks);
    // Return the first successful result that has formats
    for (const res of results) {
      if (res.status === 'fulfilled' && res.value && res.value.formats?.length > 0) {
        return res.value;
      }
    }
    return null;
  };

  // API Route to fetch video info
  app.post("/api/info", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    const cleanUrl = url.trim();
    console.log(`ArgeLoad Analyzing: ${cleanUrl}`);

    try {
      const urlObj = new URL(cleanUrl);
      const hostname = urlObj.hostname.toLowerCase();
      const domain = hostname.replace('www.', '');

      const ruhend = await ruhendPromise;
      const btch = await btchPromise;

      // 1. YouTube
      if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
        try {
          const yt: any = await btch.youtube(cleanUrl);
          if (yt && (yt.mp4 || yt.mp3)) {
            const formats = [];
            if (yt.mp4) formats.push({ itag: 137, mimeType: 'video/mp4', qualityLabel: 'Video HD', hasVideo: true, hasAudio: true, container: 'mp4', url: yt.mp4 });
            if (yt.mp3) formats.push({ itag: 140, mimeType: 'audio/mpeg', qualityLabel: 'Audio MP3', hasVideo: false, hasAudio: true, container: 'mp3', url: yt.mp3 });

            return res.json({ title: yt.title || "YouTube Video", author: yt.author || "YouTube", thumbnail: yt.thumbnail || "", platform: 'youtube', formats });
          }
        } catch (e) { }
      }

      // 2. TikTok
      if (domain.includes('tiktok.com')) {
        const result = await raceScrapers([
          (async () => {
            const tt = await ruhend.ttdl(cleanUrl);
            if (!tt) return null;
            const formats = [];
            if (tt.video) formats.push({ itag: 137, mimeType: 'video/mp4', qualityLabel: 'Video Original', hasVideo: true, hasAudio: true, container: 'mp4', url: tt.video });
            if (tt.music) formats.push({ itag: 140, mimeType: 'audio/mpeg', qualityLabel: 'Audio Original', hasVideo: false, hasAudio: true, container: 'mp3', url: tt.music });
            (tt.photo || []).forEach((p: string, i: number) => {
              formats.push({ itag: 200 + i, mimeType: 'image/jpeg', qualityLabel: `Imagen ${i + 1}`, hasVideo: false, hasAudio: false, container: 'jpg', url: p });
            });
            return { title: tt.title, author: tt.author, thumbnail: tt.cover, platform: 'tiktok', formats };
          })(),
          (async () => {
            const tt = await btch.ttdl(cleanUrl);
            if (!tt) return null;
            const formats = (tt.video || []).map((v: string, i: number) => {
              const isImg = v.match(/\.(jpg|jpeg|png|webp)/i);
              return { itag: 300 + i, mimeType: isImg ? 'image/jpeg' : 'video/mp4', qualityLabel: isImg ? `Imagen ${i + 1}` : 'Video', hasVideo: !isImg, hasAudio: !isImg, container: isImg ? 'jpg' : 'mp4', url: v };
            });
            return { title: "TikTok Content", author: "TikTok User", thumbnail: formats[0]?.url, platform: 'tiktok', formats };
          })()
        ]);
        if (result) return res.json(result);
      }

      // 3. Instagram
      if (domain.includes('instagram.com')) {
        const result = await raceScrapers([
          (async () => {
            const ig = await ruhend.igdl(cleanUrl);
            if (!ig?.data) return null;
            const formats = ig.data.map((item: any, i: number) => {
              const isVideo = item.url.includes('.mp4');
              return { itag: 400 + i, mimeType: isVideo ? 'video/mp4' : 'image/jpeg', qualityLabel: isVideo ? `Video ${i + 1}` : `Imagen ${i + 1}`, hasVideo: isVideo, hasAudio: isVideo, container: isVideo ? 'mp4' : 'jpg', url: item.url, proxyUrl: `/api/proxy-image?url=${encodeURIComponent(item.url)}` };
            });
            return { title: "Instagram Post", author: "Instagram User", thumbnail: formats[0]?.proxyUrl || formats[0]?.url, platform: 'instagram', formats };
          })(),
          (async () => {
            const ig = await btch.igdl(cleanUrl);
            if (!ig?.result) return null;
            const formats = ig.result.map((item: any, i: number) => {
              const url = item.url || item.thumbnail;
              const isVideo = url.includes('.mp4');
              return { itag: 500 + i, mimeType: isVideo ? 'video/mp4' : 'image/jpeg', qualityLabel: isVideo ? `Video ${i + 1}` : `Imagen ${i + 1}`, hasVideo: isVideo, hasAudio: isVideo, container: isVideo ? 'mp4' : 'jpg', url: url, proxyUrl: `/api/proxy-image?url=${encodeURIComponent(url)}` };
            });
            return { title: "Instagram Post", author: "Instagram User", thumbnail: formats[0]?.proxyUrl || formats[0]?.url, platform: 'instagram', formats };
          })()
        ]);
        if (result) return res.json(result);
      }

      // 4. Twitter / X
      if (domain.includes('twitter.com') || domain.includes('x.com')) {
        try {
          const vxUrl = cleanUrl.replace(/twitter\.com|x\.com/, 'api.vxtwitter.com');
          const vxRes = await fetch(vxUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          const data: any = await vxRes.json();
          if (data.media_extended) {
            const formats = data.media_extended.map((m: any, i: number) => ({
              itag: 600 + i, mimeType: m.type === 'video' || m.type === 'gif' ? 'video/mp4' : 'image/jpeg',
              qualityLabel: m.type === 'video' || m.type === 'gif' ? `Video ${i + 1}` : `Imagen ${i + 1}`,
              hasVideo: m.type === 'video' || m.type === 'gif', hasAudio: m.type === 'video', container: m.type === 'video' || m.type === 'gif' ? 'mp4' : 'jpg', url: m.url
            }));
            return res.json({ title: data.text || "Twitter/X Post", author: `${data.user_name} (@${data.user_screen_name})`, thumbnail: data.media_extended[0]?.thumbnail_url || data.media_extended[0]?.url, platform: 'twitter', formats });
          }
        } catch (e) { }
      }

      // 5. Facebook
      if (domain.includes('facebook.com') || domain.includes('fb.watch')) {
        try {
          const fb = await ruhend.fbdl(cleanUrl);
          if (fb?.hd || fb?.sd) {
            const formats = [];
            if (fb.hd) formats.push({ itag: 700, mimeType: 'video/mp4', qualityLabel: 'Calidad HD', hasVideo: true, hasAudio: true, container: 'mp4', url: fb.hd });
            if (fb.sd) formats.push({ itag: 701, mimeType: 'video/mp4', qualityLabel: 'Calidad SD', hasVideo: true, hasAudio: true, container: 'mp4', url: fb.sd });
            return res.json({ title: "Facebook Video", author: "Facebook User", thumbnail: "", platform: 'facebook', formats });
          }
        } catch (e) { }
      }

      // 6. Pinterest
      if (domain.includes('pinterest.com') || domain.includes('pin.it')) {
        try {
          const pin = await btch.pinterest(cleanUrl);
          if (pin && (pin.url || pin.thumbnail)) {
            const mediaUrl = pin.url || pin.thumbnail;
            const isVideo = mediaUrl.includes('.mp4');
            return res.json({
              title: pin.title || "Pinterest Post", thumbnail: pin.thumbnail || pin.url, platform: 'pinterest',
              formats: [{ itag: 800, mimeType: isVideo ? 'video/mp4' : 'image/jpeg', qualityLabel: isVideo ? 'Video Original' : 'Imagen Original', hasVideo: isVideo, hasAudio: isVideo, container: isVideo ? 'mp4' : 'jpg', url: mediaUrl }]
            });
          }
        } catch (e) { }
      }

      // 7. NEW: Reddit
      if (domain.includes('reddit.com')) {
        try {
          const info: any = await ytdl(cleanUrl, { dumpSingleJson: true, noCheckCertificates: true });
          if (info && info.formats) {
            const formats = info.formats.filter((f: any) => f.url && f.vcodec !== 'none').map((f: any, i: number) => ({
              itag: 900 + i, mimeType: 'video/mp4', qualityLabel: f.format_note || 'Video', hasVideo: true, hasAudio: true, container: 'mp4', url: f.url
            }));
            return res.json({ title: info.title || "Reddit Post", author: info.uploader || "Reddit", thumbnail: info.thumbnail, platform: 'reddit', formats });
          }
        } catch (e) { }
      }

      // 8. NEW: LinkedIn
      if (domain.includes('linkedin.com')) {
        try {
          const li = await ruhend.linkedindl(cleanUrl);
          if (li?.data) {
            return res.json({
              title: "LinkedIn Video", author: "LinkedIn User", thumbnail: "", platform: 'linkedin',
              formats: [{ itag: 1000, mimeType: 'video/mp4', qualityLabel: 'Video Original', hasVideo: true, hasAudio: true, container: 'mp4', url: li.data }]
            });
          }
        } catch (e) { }
      }

      // 9. NEW: SoundCloud
      if (domain.includes('soundcloud.com')) {
        try {
          const sc = await btch.soundcloud(cleanUrl);
          if (sc?.download) {
            return res.json({
              title: sc.title || "SoundCloud Track", author: "SoundCloud Artist", thumbnail: sc.thumb || "", platform: 'soundcloud',
              formats: [{ itag: 1100, mimeType: 'audio/mpeg', qualityLabel: 'Audio MP3', hasVideo: false, hasAudio: true, container: 'mp3', url: sc.download }]
            });
          }
        } catch (e) { }
      }

      // 10. NEW: Snapchat
      if (domain.includes('snapchat.com')) {
        try {
          const snap = await ruhend.snapdl(cleanUrl);
          if (snap?.data) {
            return res.json({
              title: "Snapchat Story", author: "Snapchat User", thumbnail: "", platform: 'snapchat',
              formats: [{ itag: 1200, mimeType: 'video/mp4', qualityLabel: 'Video Original', hasVideo: true, hasAudio: true, container: 'mp4', url: snap.data }]
            });
          }
        } catch (e) { }
      }

      // 11. Threads
      if (domain.includes('threads.net')) {
        try {
          const thr = await btch.threads(cleanUrl);
          if (thr?.result) {
            const formats = thr.result.map((r: any, i: number) => {
              const isVideo = r.url.includes('.mp4');
              return { itag: 1300 + i, mimeType: isVideo ? 'video/mp4' : 'image/jpeg', qualityLabel: isVideo ? `Video ${i + 1}` : `Imagen ${i + 1}`, hasVideo: isVideo, hasAudio: isVideo, container: isVideo ? 'mp4' : 'jpg', url: r.url };
            });
            return res.json({ title: "Threads Post", author: "Threads User", thumbnail: formats[0]?.url, platform: 'threads', formats });
          }
        } catch (e) { }
      }

      // 12. Generic Fallback (Cobalt API for speed and reliability)
      try {
        console.log("Using Cobalt Fallback...");
        const cobaltRes = await fetch('https://api.cobalt.tools/api/json', {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
          body: JSON.stringify({ url: cleanUrl })
        });
        const cobaltData: any = await cobaltRes.json();
        if (cobaltData && (cobaltData.url || cobaltData.picker)) {
          const formats = [];
          if (cobaltData.url) {
            formats.push({ itag: 2000, mimeType: 'video/mp4', qualityLabel: 'Original', hasVideo: true, hasAudio: true, container: 'mp4', url: cobaltData.url });
          } else if (cobaltData.picker) {
            cobaltData.picker.forEach((p: any, i: number) => {
              formats.push({ itag: 2001 + i, mimeType: p.type === 'video' ? 'video/mp4' : 'image/jpeg', qualityLabel: `Item ${i + 1}`, hasVideo: p.type === 'video', hasAudio: true, container: p.type === 'video' ? 'mp4' : 'jpg', url: p.url });
            });
          }
          return res.json({ title: "Media Extracted", author: "Cobalt", thumbnail: formats[0]?.url, platform: 'cobalt', formats });
        }
      } catch (e) { }


      // 13. Direct Link Detection (Extension based)
      const directMatch = cleanUrl.match(/\.(mp4|webm|mp3|m4a|wav|jpg|jpeg|png|gif|webp|mov|mkv)(\?|$)/i);
      if (directMatch) {
        const ext = directMatch[1].toLowerCase();
        const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
        const isAud = ['mp3', 'm4a', 'wav'].includes(ext);
        const proxyUrl = isImg ? `/api/proxy-image?url=${encodeURIComponent(cleanUrl)}` : undefined;

        return res.json({
          title: urlObj.pathname.split('/').pop()?.split('?')[0] || "Direct File",
          author: "Direct Link", thumbnail: proxyUrl || "", platform: 'direct',
          formats: [{ itag: 5000, mimeType: isImg ? `image/${ext}` : (isAud ? 'audio/mpeg' : 'video/mp4'), qualityLabel: 'Direct Link', hasVideo: !isImg && !isAud, hasAudio: !isImg, container: ext, url: cleanUrl, proxyUrl }]
        });
      }

      return res.status(400).json({ error: "Plataforma no soportada. Intenta con un link directo o de una red social conocida." });

    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Analysis Error: " + error.message });
    }
  });

  // Proxy Download
  app.get(["/api/download", "/api/download/:forcedFilename"], async (req, res) => {
    try {
      const { url, ext, title, mp3, start, end, scale } = req.query;
      if (!url || typeof url !== 'string') return res.status(400).send("Missing URL");

      const fetchHeaders: any = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
      if (url.includes('twitter.com') || url.includes('x.com') || url.includes('twimg.com')) {
        fetchHeaders['Referer'] = 'https://twitter.com/';
        fetchHeaders['Origin'] = 'https://twitter.com/';
      }

      const fetchRes = await fetch(url, { headers: fetchHeaders });
      const targetExt = mp3 === 'true' ? 'mp3' : (ext || 'mp4');
      let filename = `${(title as string || 'video').replace(/[^a-zA-Z0-9]/g, '_')}.${targetExt}`;

      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      if (mp3 === 'true') {
        res.setHeader('Content-Type', 'audio/mpeg');
        let command = ffmpeg(fetchRes.body).toFormat('mp3');
        if (start) command = command.setStartTime(String(start));
        if (end) {
          const duration = Number(end) - Number(start || 0);
          if (duration > 0) command = command.setDuration(duration);
        }
        return command.pipe(res);
      } else {
        const extLower = String(targetExt).toLowerCase();
        if (extLower === 'mp3') res.setHeader('Content-Type', 'audio/mpeg');
        else if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extLower)) res.setHeader('Content-Type', 'image/jpeg');
        else res.setHeader('Content-Type', 'video/mp4');

        if (start || end || scale) {
          let command = ffmpeg(fetchRes.body).toFormat('mp4').outputOptions(['-preset', 'ultrafast', '-crf', '28', '-movflags', 'frag_keyframe+empty_moov']);
          if (scale === '16_9') command = command.videoFilters("crop='trunc(min(iw,ih*16/9)/2)*2':'trunc(min(ih,iw*9/16)/2)*2'");
          else if (scale === '9_16') command = command.videoFilters("scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black");
          if (start) command = command.setStartTime(String(start));
          if (end) {
            const getSec = (t: string) => t.split(':').reverse().reduce((acc, val, i) => acc + (Number(val) * Math.pow(60, i)), 0);
            const duration = getSec(String(end)) - getSec(String(start || '0'));
            if (duration > 0) command = command.setDuration(duration);
          }
          return command.pipe(res);
        }

        if (fetchRes.body) return fetchRes.body.pipe(res);
      }
    } catch (error: any) {
      res.status(500).send("Server Error: " + error.message);
    }
  });

  // Proxy Image
  app.get("/api/proxy-image", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url || typeof url !== 'string') return res.status(400).send("Missing URL");
      const fetchRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://instagram.com/' } });
      res.setHeader('Content-Type', fetchRes.headers.get('content-type') || 'image/jpeg');
      if (fetchRes.body) return fetchRes.body.pipe(res);
    } catch (e) { res.status(500).send("Error"); }
  });

  // Vite + Final Middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
}

startServer();

