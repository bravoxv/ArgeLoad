import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ytdl from 'youtube-dl-exec';
import multer from 'multer';
import fs from 'fs';
import { Readable } from 'stream';

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

  // Helper for parallel racing of scrapers - TRUE RACE for speed
  const raceScrapers = async (tasks: Promise<any>[]) => {
    if (tasks.length === 0) return null;
    return new Promise((resolve) => {
      let settledCount = 0;
      let resolved = false;

      tasks.forEach(task => {
        task.then(res => {
          if (!resolved && res && res.formats?.length > 0) {
            resolved = true;
            resolve(res);
          } else {
            settledCount++;
            if (settledCount === tasks.length && !resolved) resolve(null);
          }
        }).catch(() => {
          settledCount++;
          if (settledCount === tasks.length && !resolved) resolve(null);
        });
      });

      // Safety timeout for the race (15s)
      setTimeout(() => { if (!resolved) resolve(null); }, 15000);
    });
  };

  const cobaltScraper = async (cleanUrl: string, vQuality = "1080") => {
    try {
      const cobaltRes = await fetch('https://api.cobalt.tools/api/json', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        body: JSON.stringify({ url: cleanUrl, vQuality })
      });
      const cobaltData: any = await cobaltRes.json();
      if (cobaltData && (cobaltData.url || cobaltData.picker)) {
        const formats = [];
        if (cobaltData.url) {
          const isVideo = cobaltData.url.includes('.mp4') || cobaltData.url.includes('video') || !cobaltData.url.includes('.jpg');
          const fixedUrl = fixMediaUrl(cobaltData.url, cobaltData.url.includes('instagram') ? 'instagram' : (cobaltData.url.includes('twimg') ? 'twitter' : 'generic'), isVideo);
          formats.push({ itag: 2000, mimeType: isVideo ? 'video/mp4' : 'image/jpeg', qualityLabel: 'Original', hasVideo: isVideo, hasAudio: true, container: isVideo ? 'mp4' : 'jpg', url: fixedUrl });
        } else if (cobaltData.picker) {
          cobaltData.picker.forEach((p: any, i: number) => {
            const isVideo = p.type === 'video';
            const fixedUrl = fixMediaUrl(p.url, p.url.includes('instagram') ? 'instagram' : (p.url.includes('twimg') ? 'twitter' : 'generic'), isVideo);
            formats.push({ itag: 2001 + i, mimeType: isVideo ? 'video/mp4' : 'image/jpeg', qualityLabel: `Item ${i + 1}`, hasVideo: isVideo, hasAudio: true, container: isVideo ? 'mp4' : 'jpg', url: fixedUrl });
          });
        }
        return {
          title: "Contenido Detectado",
          author: "Automático (Cobalt)",
          thumbnail: cobaltData.url || (cobaltData.picker ? cobaltData.picker[0].url : ""),
          platform: 'cobalt',
          formats
        };
      }
    } catch (e) { }
    return null;
  };

  // Helper to fix media URLs as requested by the user
  const fixMediaUrl = (url: string, platform: string, isVideo: boolean) => {
    if (!url) return url;
    if (platform === 'instagram' && isVideo && url.includes('cdninstagram.com')) {
      return url.replace(/[a-z0-9-]+\.cdninstagram\.com/i, 'scontent-sea5-1.cdninstagram.com');
    }
    if ((platform === 'twitter' || platform === 'x' || platform === 'direct') && isVideo && url.includes('twimg.com')) {
      return url.replace(/[a-z0-9-]+\.twimg\.com/i, 'video.twimg.com');
    }
    return url;
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
        const result = await raceScrapers([
          (async () => {
            try {
              const yt: any = await btch.youtube(cleanUrl);
              if (yt && (yt.mp4 || yt.mp3)) {
                const formats = [];
                if (yt.mp4) formats.push({ itag: 137, mimeType: 'video/mp4', qualityLabel: 'Video HD', hasVideo: true, hasAudio: true, container: 'mp4', url: yt.mp4 });
                if (yt.mp3) formats.push({ itag: 140, mimeType: 'audio/mpeg', qualityLabel: 'Audio MP3', hasVideo: false, hasAudio: true, container: 'mp3', url: yt.mp3 });
                return { title: yt.title || "YouTube Video", author: yt.author || "YouTube", thumbnail: yt.thumbnail || "", duration: yt.duration, platform: 'youtube', formats };
              }
            } catch (e) { }
            return null;
          })(),
          cobaltScraper(cleanUrl)
        ]);
        if (result) return res.json(result);
      }

      // 2. TikTok
      if (domain.includes('tiktok.com')) {
        const result = await raceScrapers([
          (async () => {
            const tt = await ruhend.ttdl(cleanUrl);
            if (!tt) return null;
            const formats = [];
            if (tt.video) formats.push({ itag: 137, mimeType: 'video/mp4', qualityLabel: 'Video Original', hasVideo: true, hasAudio: true, container: 'mp4', url: tt.video, proxyUrl: `/api/download?url=${encodeURIComponent(tt.video)}&inline=true` });
            if (tt.music) formats.push({ itag: 140, mimeType: 'audio/mpeg', qualityLabel: 'Audio Original', hasVideo: false, hasAudio: true, container: 'mp3', url: tt.music, proxyUrl: `/api/download?url=${encodeURIComponent(tt.music)}&mp3=true&inline=true` });
            (tt.photo || []).forEach((p: string, i: number) => {
              formats.push({ itag: 200 + i, mimeType: 'image/jpeg', qualityLabel: `Imagen ${i + 1}`, hasVideo: false, hasAudio: false, container: 'jpg', url: p, proxyUrl: `/api/proxy-image?url=${encodeURIComponent(p)}` });
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
            return { title: "TikTok Content", author: "TikTok User", thumbnail: formats[0]?.url, duration: (tt as any).duration, platform: 'tiktok', formats };
          })(),
          cobaltScraper(cleanUrl)
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
              const url = item.url;
              const isVideo = url.includes('.mp4') || url.toLowerCase().includes('video') || !url.match(/\.(jpg|jpeg|png|webp|heic)/i);
              return {
                itag: 400 + i,
                mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
                qualityLabel: isVideo ? `Video ${i + 1}` : `Imagen ${i + 1}`,
                hasVideo: isVideo,
                hasAudio: isVideo,
                container: isVideo ? 'mp4' : 'jpg',
                url: fixMediaUrl(url, 'instagram', isVideo),
                proxyUrl: `/api/proxy-image?url=${encodeURIComponent(fixMediaUrl(url, 'instagram', isVideo))}`
              };
            });
            return { title: "Instagram Post", author: "Instagram User", thumbnail: formats[0]?.proxyUrl || formats[0]?.url, platform: 'instagram', formats };
          })(),
          (async () => {
            const ig = await btch.igdl(cleanUrl);
            if (!ig?.result) return null;
            const formats = ig.result.map((item: any, i: number) => {
              const url = item.url || item.thumbnail;
              const isVideo = url.includes('.mp4') || url.toLowerCase().includes('video') || !url.match(/\.(jpg|jpeg|png|webp|heic)/i);
              return {
                itag: 500 + i,
                mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
                qualityLabel: isVideo ? `Video ${i + 1}` : `Imagen ${i + 1}`,
                hasVideo: isVideo,
                hasAudio: isVideo,
                container: isVideo ? 'mp4' : 'jpg',
                url: fixMediaUrl(url, 'instagram', isVideo),
                proxyUrl: `/api/proxy-image?url=${encodeURIComponent(fixMediaUrl(url, 'instagram', isVideo))}`
              };
            });
            return { title: "Instagram Post", author: "Instagram User", thumbnail: formats[0]?.proxyUrl || formats[0]?.url, platform: 'instagram', formats };
          })(),
          cobaltScraper(cleanUrl)
        ]);
        if (result) return res.json(result);
      }

      // 4. Twitter / X
      if (domain.includes('twitter.com') || domain.includes('x.com')) {
        const result = await raceScrapers([
          (async () => {
            try {
              const vxUrl = cleanUrl.replace(/twitter\.com|x\.com/, 'api.vxtwitter.com');
              const vxRes = await fetch(vxUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
              const data: any = await vxRes.json();
              if (data.media_extended) {
                const formats = data.media_extended.map((m: any, i: number) => ({
                  itag: 600 + i, mimeType: m.type === 'video' || m.type === 'gif' ? 'video/mp4' : 'image/jpeg',
                  qualityLabel: m.type === 'video' || m.type === 'gif' ? `Video ${i + 1}` : `Imagen ${i + 1}`,
                  hasVideo: m.type === 'video' || m.type === 'gif', hasAudio: m.type === 'video', container: m.type === 'video' || m.type === 'gif' ? 'mp4' : 'jpg', url: fixMediaUrl(m.url, 'twitter', m.type === 'video' || m.type === 'gif'),
                  proxyUrl: m.type === 'video' || m.type === 'gif' ? `/api/download?url=${encodeURIComponent(fixMediaUrl(m.url, 'twitter', true))}&inline=true` : `/api/proxy-image?url=${encodeURIComponent(m.url)}`
                }));
                return { title: data.text || "Twitter/X Post", author: `${data.user_name} (@${data.user_screen_name})`, thumbnail: data.media_extended[0]?.thumbnail_url || data.media_extended[0]?.url, platform: 'twitter', formats };
              }
            } catch (e) { }
            return null;
          })(),
          cobaltScraper(cleanUrl)
        ]);
        if (result) return res.json(result);
      }

      // 5. Facebook
      if (domain.includes('facebook.com') || domain.includes('fb.watch')) {
        try {
          const fb = await ruhend.fbdl(cleanUrl);
          if (fb?.hd || fb?.sd) {
            const formats = [];
            if (fb.hd) formats.push({ itag: 700, mimeType: 'video/mp4', qualityLabel: 'Calidad HD', hasVideo: true, hasAudio: true, container: 'mp4', url: fb.hd, proxyUrl: `/api/download?url=${encodeURIComponent(fb.hd)}&inline=true` });
            if (fb.sd) formats.push({ itag: 701, mimeType: 'video/mp4', qualityLabel: 'Calidad SD', hasVideo: true, hasAudio: true, container: 'mp4', url: fb.sd, proxyUrl: `/api/download?url=${encodeURIComponent(fb.sd)}&inline=true` });
            return res.json({ title: "Facebook Video", author: "Facebook User", thumbnail: "", platform: 'facebook', formats });
          }
        } catch (e) { }
      }

      // 6. Pinterest
      if (domain.includes('pinterest.com') || domain.includes('pin.it')) {
        try {
          const pinData = await btch.pinterest(cleanUrl);
          if (pinData) {
            const p = pinData as any;
            const formats = [{ itag: 800, mimeType: 'image/jpeg', qualityLabel: 'Original', hasVideo: false, hasAudio: false, container: 'jpg', url: p.url || p.thumbnail, proxyUrl: `/api/proxy-image?url=${encodeURIComponent(p.url || p.thumbnail)}` }];
            return res.json({ title: p.title || "Pinterest Image", author: "Pinterest", thumbnail: p.thumbnail || p.url, platform: 'pinterest', formats });
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
          const sc: any = await btch.soundcloud(cleanUrl);
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
          const threadsData = await btch.threads(cleanUrl);
          if (threadsData) {
            const formats = (threadsData as any).map((item: any, i: number) => ({
              itag: 1300 + i, mimeType: item.type === 'video' ? 'video/mp4' : 'image/jpeg', qualityLabel: item.type === 'video' ? `Video ${i + 1}` : `Imagen ${i + 1}`, hasVideo: item.type === 'video', hasAudio: item.type === 'video', container: item.type === 'video' ? 'mp4' : 'jpg', url: item.url
            }));
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
            const isVideo = cobaltData.url.includes('.mp4') || cobaltData.url.includes('video') || !cobaltData.url.includes('.jpg');
            const fixedUrl = fixMediaUrl(cobaltData.url, cobaltData.url.includes('instagram') ? 'instagram' : (cobaltData.url.includes('twimg') ? 'twitter' : 'generic'), isVideo);
            formats.push({ itag: 2000, mimeType: isVideo ? 'video/mp4' : 'image/jpeg', qualityLabel: 'Original', hasVideo: isVideo, hasAudio: true, container: isVideo ? 'mp4' : 'jpg', url: fixedUrl });
          } else if (cobaltData.picker) {
            cobaltData.picker.forEach((p: any, i: number) => {
              const isVideo = p.type === 'video';
              const fixedUrl = fixMediaUrl(p.url, p.url.includes('instagram') ? 'instagram' : (p.url.includes('twimg') ? 'twitter' : 'generic'), isVideo);
              formats.push({ itag: 2001 + i, mimeType: isVideo ? 'video/mp4' : 'image/jpeg', qualityLabel: `Item ${i + 1}`, hasVideo: isVideo, hasAudio: true, container: isVideo ? 'mp4' : 'jpg', url: fixedUrl });
            });
          }
          return res.json({
            title: "Contenido Detectado",
            author: "Automático",
            thumbnail: cobaltData.url || (cobaltData.picker ? cobaltData.picker[0].url : ""),
            platform: 'cobalt',
            formats
          });
        }
      } catch (e) { }


      // 13. Direct Link Detection (Enhanced)
      const directMatch = cleanUrl.match(/\.(mp4|webm|mp3|m4a|wav|jpg|jpeg|png|gif|webp|mov|mkv)(\?|$)/i);
      if (directMatch || cleanUrl.includes('video_content') || cleanUrl.includes('media')) {
        const extMatch = directMatch ? directMatch[1].toLowerCase() : 'mp4';
        const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extMatch);
        const isAud = ['mp3', 'm4a', 'wav'].includes(extMatch);
        const proxyUrl = isImg ? `/api/proxy-image?url=${encodeURIComponent(cleanUrl)}` : undefined;

        return res.json({
          title: urlObj.pathname.split('/').pop()?.split('?')[0] || "Archivo Directo",
          author: "Vínculo Directo",
          thumbnail: isImg ? proxyUrl : "",
          platform: 'direct',
          formats: [{
            itag: 5000,
            mimeType: isImg ? `image/${extMatch}` : (isAud ? 'audio/mpeg' : 'video/mp4'),
            qualityLabel: 'Calidad Original',
            hasVideo: !isImg && !isAud,
            hasAudio: !isImg,
            container: extMatch,
            url: cleanUrl,
            proxyUrl
          }]
        });
      }

      return res.status(400).json({ error: "Plataforma no soportada. Intenta con un link directo o de una red social conocida." });

    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Analysis Error: " + error.message });
    }
  });

  const progressMap = new Map<string, number>();
  const scaleCache = new Map<string, string>();
  const activeTasks = new Map<string, Promise<string>>();

  // Clean up old cache entries every 30 minutes
  setInterval(() => {
    for (const [key, filePath] of scaleCache.entries()) {
      if (fs.existsSync(filePath)) {
        const age = Date.now() - fs.statSync(filePath).mtimeMs;
        if (age > 30 * 60 * 1000) {
          fs.unlinkSync(filePath);
          scaleCache.delete(key);
        }
      } else {
        scaleCache.delete(key);
      }
    }
  }, 10 * 60 * 1000);

  // Progress API
  app.get("/api/progress/:taskId", (req, res) => {
    const { taskId } = req.params;
    res.json({ progress: progressMap.get(taskId) || 0 });
  });

  // Proxy Download
  app.get(["/api/download", "/api/download/:forcedFilename", "/api/v2/download/:forcedFilename"], async (req, res) => {
    try {
      const { url, ext, title, mp3, start, end, scale, res: resolution, taskId } = req.query;
      if (!url || typeof url !== 'string') return res.status(400).send("Missing URL");

      const tid = typeof taskId === 'string' ? taskId : null;

      // --- CACHE HIT: Serve processed video directly if already processed ---
      if ((scale || resolution) && typeof url === 'string') {
        const cacheKey = `${url}|${scale || 'orig'}|${resolution || 'orig'}`;
        const cachedPath = scaleCache.get(cacheKey);
        if (cachedPath && fs.existsSync(cachedPath)) {
          console.log(`[CACHE HIT] Serving ${scale} for cached video`);
          if (tid) progressMap.set(tid, 100);
          const stat = fs.statSync(cachedPath);
          res.setHeader('Content-Type', 'video/mp4');
          res.setHeader('Content-Length', stat.size);
          res.setHeader('Accept-Ranges', 'bytes');
          const safeName = (title as string || 'ArgeLoad').replace(/[^a-zA-Z0-9._]/g, '_');
          res.setHeader('Content-Disposition', `inline; filename="${safeName}.mp4"`);

          // Support for Range requests (important for browser players and '3 dots' menu)
          const range = req.headers.range;
          if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
            res.status(206);
            res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
            res.setHeader('Content-Length', (end - start) + 1);
            fs.createReadStream(cachedPath, { start, end }).pipe(res);
          } else {
            fs.createReadStream(cachedPath).pipe(res);
          }
          return;
        }
      }

      if (tid) progressMap.set(tid, 0);

      const fetchHeaders: any = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
      if (url.includes('twitter.com') || url.includes('x.com') || url.includes('twimg.com')) {
        fetchHeaders['Referer'] = 'https://x.com/';
        fetchHeaders['Origin'] = 'https://x.com/';
      } else if (url.includes('instagram.com') || url.includes('cdninstagram.com')) {
        fetchHeaders['Referer'] = 'https://instagram.com/';
      }

      const fetchRes = await fetch(url, { headers: fetchHeaders });
      const isInline = req.query.inline === 'true';
      const targetExt = mp3 === 'true' ? 'mp3' : (ext || 'mp4');

      // Sanitizar el título para el nombre del archivo
      let safeTitle = (title as string || 'ArgeLoad_Media')
        .trim()
        .replace(/[/\\?%*:|"<>]/g, '_')
        .replace(/\s+/g, '_');

      let filename = `${safeTitle}.${targetExt}`;

      if (isInline) {
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      }
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

      if (mp3 === 'true') {
        res.setHeader('Content-Type', 'audio/mpeg');
        if (!fetchRes.body) return res.status(500).send("No source body");
        const nodeStream = Readable.fromWeb(fetchRes.body as any);
        let command = ffmpeg(nodeStream)
          .toFormat('mp3')
          .audioBitrate('128k'); // Standard quality, low file size
        if (start) command = command.setStartTime(String(start));
        if (end) {
          const duration = Number(end) - Number(start || 0);
          if (duration > 0) command = command.setDuration(duration);
        }
        command.on('error', (err) => {
          console.error("FFmpeg MP3 Error:", err.message);
          if (tid) progressMap.delete(tid);
          if (!res.headersSent) res.status(500).send("Processing error");
        });
        command.on('end', () => { if (tid) progressMap.delete(tid); });
        return command.pipe(res);
      } else {
        const extLower = String(targetExt).toLowerCase();
        const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(extLower);
        const isAudio = extLower === 'mp3' || mp3 === 'true';

        if (isAudio) res.setHeader('Content-Type', 'audio/mpeg');
        else if (isImage) res.setHeader('Content-Type', 'image/jpeg');
        else res.setHeader('Content-Type', 'video/mp4');

        if (start || end || scale || resolution) {
          if (!fetchRes.body) return res.status(500).send("No source body");
          const nodeStream = Readable.fromWeb(fetchRes.body as any);
          const tempFilename = `proc_${Date.now()}_${Math.random().toString(36).substring(7)}.${isImage ? 'jpg' : (isAudio ? 'mp3' : 'mp4')}`;
          const tempPath = path.join(__dirname, 'uploads', tempFilename);

          let command = ffmpeg(nodeStream);

          let movFlags = '+faststart';
          if ((scale || resolution) && !isImage && !isAudio) {
            // Usar MP4 fragmentado permite hacer streaming instantáneo sin esperar a procesar todo el video
            movFlags = 'frag_keyframe+empty_moov';
          }

          if (isImage) {
            command = command.toFormat('mjpeg').outputOptions(['-vframes', '1']);
          } else if (isAudio) {
            command = command.toFormat('mp3').audioBitrate('128k');
          } else {
            command = command.toFormat('mp4')
              .videoCodec('libx264')
              .audioCodec('aac')
              .outputOptions([
                '-preset', 'ultrafast',
                '-crf', '24', // Balance entre calidad y máxima velocidad
                '-pix_fmt', 'yuv420p',
                '-threads', '0',
                '-movflags', movFlags
              ]);
          }

          if (scale === '16_9') {
            command = command.videoFilters([
              "scale='if(gt(iw/ih,16/9),-2,854)':'if(gt(iw/ih,16/9),480,-2)':force_original_aspect_ratio=increase",
              "crop=854:480",
              "setsar=1"
            ]);
          } else if (scale === '9_16') {
            command = command.videoFilters([
              "scale=480:854:force_original_aspect_ratio=decrease",
              "pad=480:854:(ow-iw)/2:(oh-ih)/2:color=black",
              "setsar=1",
              "scale=trunc(iw/2)*2:trunc(ih/2)*2"
            ]);
          } else if (resolution && !isImage && !isAudio) {
            const h = parseInt(resolution as string);
            if ([480, 720, 1080].includes(h)) {
              command = command.videoFilters(`scale=-2:${h}`);
            }
          }

          if (start && !isImage) command = command.setStartTime(String(start));
          if (end && !isImage) {
            const getSec = (t: string) => {
              const parts = String(t).split(':').reverse();
              return parts.reduce((acc, val, i) => acc + (Number(val) * Math.pow(60, i)), 0);
            };
            const duration = getSec(String(end)) - getSec(String(start || '0'));
            if (duration > 0) command = command.setDuration(duration);
          }

          command.on('progress', (p) => {
            if (tid) {
              if (p.percent) {
                progressMap.set(tid, Math.round(p.percent));
              } else if (p.timemark && req.query.duration) {
                // Estimate percent if duration is known
                const getSec = (t: string) => {
                  const parts = String(t).split(':').reverse();
                  return parts.reduce((acc, val, i) => acc + (Number(val) * Math.pow(60, i)), 0);
                };
                const current = getSec(p.timemark);
                const total = Number(req.query.duration);
                if (total > 0) {
                  const pct = Math.min(99, Math.round((current / total) * 100));
                  progressMap.set(tid, pct);
                }
              } else {
                // Fallback: move slowly based on frames if nothing else is available
                const current = progressMap.get(tid) || 2;
                if (current < 95) progressMap.set(tid, current + 1);
              }
            }
          });

          command.on('error', (err) => {
            console.error("FFmpeg error:", err.message);
            if (tid) progressMap.delete(tid);
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            if (!res.headersSent) res.status(500).send("Processing error");
          });

          // Enviar inmediatamente para que el reproductor empiece o la descarga inicie al instante
          command.on('end', () => { if (tid) progressMap.delete(tid); });
          res.setHeader('Connection', 'keep-alive');
          command.pipe(res, { end: true });
          return;
        }

        if (fetchRes.body) {
          res.setHeader('Content-Length', fetchRes.headers.get('content-length') || '');
          const nodeStream = Readable.fromWeb(fetchRes.body as any);
          nodeStream.on('error', (err) => console.error("Stream Error:", err));
          return nodeStream.pipe(res);
        }
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

      const fetchHeaders: any = { 'User-Agent': 'Mozilla/5.0' };
      if (url.includes('instagram.com') || url.includes('cdninstagram.com') || url.includes('fbcdn.net')) {
        fetchHeaders['Referer'] = 'https://instagram.com/';
      } else if (url.includes('twitter.com') || url.includes('x.com') || url.includes('twimg.com')) {
        fetchHeaders['Referer'] = 'https://x.com/';
      }

      const fetchRes = await fetch(url, { headers: fetchHeaders });
      res.setHeader('Content-Type', fetchRes.headers.get('content-type') || 'image/jpeg');
      if (fetchRes.body) {
        const nodeStream = Readable.fromWeb(fetchRes.body as any);
        return nodeStream.pipe(res);
      }
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

