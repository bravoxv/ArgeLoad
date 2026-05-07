import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { youtube } from 'btch-downloader';
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


  // Pre-import scrapers for faster access
  // @ts-ignore
  const playPromise = import('play-dl');
  // @ts-ignore
  const ruhendPromise = import('ruhend-scraper');
  const btchPromise = import('btch-downloader');

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

      // 1. YouTube (play-dl is very fast)
      if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
        try {
          const play = await playPromise;
          const info: any = await play.video_info(cleanUrl);
          const formats = info.format.filter((f: any) => f.hasVideo && f.hasAudio).map((f: any) => ({
            itag: f.itag,
            mimeType: f.mime_type || f.mimeType || 'video/mp4',
            qualityLabel: f.qualityLabel || '720p',
            hasVideo: true,
            hasAudio: true,
            container: 'mp4',
            url: f.url,
            contentLength: f.contentLength
          }));

          const audio = info.format.filter((f: any) => !f.hasVideo && f.hasAudio).sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0];
          if (audio) {
            formats.push({
              itag: 140, mimeType: 'audio/mp4', qualityLabel: 'Audio Alta Calidad',
              hasVideo: false, hasAudio: true, container: 'mp3',
              url: audio.url, contentLength: audio.contentLength
            });
          }

          return res.json({
            title: info.video_details.title,
            author: info.video_details.channel?.name || "YouTube User",
            thumbnail: info.video_details.thumbnails.pop()?.url || "",
            platform: 'youtube',
            formats
          });
        } catch (e) { console.error("YT Fast error", e); }
      }

      // 2. Ruhend / BTCH for Social Media (Fast Scrapers)
      const ruhend = await ruhendPromise;

      // TikTok
      if (domain.includes('tiktok.com')) {
        try {
          const tt = await ruhend.ttdl(cleanUrl);
          if (tt?.video) {
            return res.json({
              title: tt.title || "TikTok Video",
              author: tt.author || "TikTok User",
              thumbnail: tt.cover || "",
              platform: 'tiktok',
              formats: [
                { itag: 137, mimeType: 'video/mp4', qualityLabel: 'HD No Watermark', hasVideo: true, hasAudio: true, container: 'mp4', url: tt.video },
                { itag: 140, mimeType: 'audio/mpeg', qualityLabel: 'Audio Original', hasVideo: false, hasAudio: true, container: 'mp3', url: tt.music }
              ].filter(f => f.url)
            });
          }
        } catch (e) { }
      }

      // Instagram
      if (domain.includes('instagram.com')) {
        try {
          const ig = await ruhend.igdl(cleanUrl);
          if (ig?.data?.length > 0) {
            const uniqueFormatsMap = new Map();

            ig.data.forEach((item: any) => {
              const urlParts = item.url.split('?')[0].split('/');
              const filename = urlParts[urlParts.length - 1];
              // Universal ID for Instagram media - usually the part before the first underscore
              const fileBaseId = filename.split('_')[0] || filename;

              const isVideo = item.url.includes('.mp4') || item.url.includes('.mov') || item.url.includes('.m4v');

              // Priority: If we don't have this ID, or if we have it as a video but found an image version
              if (!uniqueFormatsMap.has(fileBaseId) || (uniqueFormatsMap.get(fileBaseId).hasVideo && !isVideo)) {
                uniqueFormatsMap.set(fileBaseId, {
                  mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
                  hasVideo: isVideo,
                  hasAudio: isVideo,
                  container: isVideo ? 'mp4' : 'jpg',
                  url: item.url
                });
              }
            });

            const uniqueFormats = Array.from(uniqueFormatsMap.values()).map((f: any, idx: number) => ({
              itag: 137 + idx,
              ...f,
              qualityLabel: f.hasVideo ? `Video ${idx + 1}` : `Imagen ${idx + 1}`,
              proxyUrl: `/api/proxy-image?url=${encodeURIComponent(f.url)}`
            }));

            return res.json({
              title: "Instagram Media",
              author: "Instagram User",
              thumbnail: uniqueFormats[0]?.proxyUrl || "",
              platform: 'instagram',
              formats: uniqueFormats
            });
          }
        } catch (e) { }
      }

      // Facebook
      if (domain.includes('facebook.com') || domain.includes('fb.watch')) {
        try {
          const fb = await ruhend.fbdl(cleanUrl);
          if (fb?.hd || fb?.sd) {
            const formats = [];
            if (fb.hd) formats.push({ itag: 137, mimeType: 'video/mp4', qualityLabel: 'HD Quality', hasVideo: true, hasAudio: true, container: 'mp4', url: fb.hd });
            if (fb.sd) formats.push({ itag: 136, mimeType: 'video/mp4', qualityLabel: 'SD Quality', hasVideo: true, hasAudio: true, container: 'mp4', url: fb.sd });
            return res.json({ title: "Facebook Video", author: "Facebook User", thumbnail: "", platform: 'facebook', formats });
          }
        } catch (e) { }
      }

      // 3. Twitter, Pinterest, Threads (Using BTCH as it's faster than yt-dlp)
      const btch = await btchPromise;
      if (domain.includes('twitter.com') || domain.includes('x.com')) {
        const tw = await btch.twitter(cleanUrl).catch(() => null);
        if (tw?.url?.length > 0) {
          return res.json({
            title: tw.title || "Twitter Video", thumbnail: tw.thumbnail || "", platform: 'twitter',
            formats: tw.url.map((u: any) => ({ itag: 137, mimeType: 'video/mp4', qualityLabel: 'HD', hasVideo: true, hasAudio: true, container: 'mp4', url: u.hd || u.sd || u.url }))
          });
        }
      }

      if (domain.includes('threads.net')) {
        const thr = await btch.threads(cleanUrl).catch(() => null);
        if (thr?.result?.length > 0) {
          return res.json({
            title: "Threads Media", thumbnail: thr.result[0].url, platform: 'threads',
            formats: thr.result.map((r: any, idx: number) => {
              const isVideo = r.url.includes('.mp4');
              return { itag: 137 + idx, mimeType: isVideo ? 'video/mp4' : 'image/jpeg', qualityLabel: isVideo ? 'Video' : 'Imagen', hasVideo: isVideo, hasAudio: isVideo, container: isVideo ? 'mp4' : 'jpg', url: r.url };
            })
          });
        }
      }

      // 4. Fallback to yt-dlp only if others fail or for specialized sites
      if (domain.includes('kick.com') || domain.includes('twitch.tv') || domain.includes('pinterest.com')) {
        const info: any = await ytdl(cleanUrl, { dumpSingleJson: true, noCheckCertificates: true, noWarnings: true, preferFreeFormats: true });
        if (info?.formats) {
          const formats = info.formats.filter((f: any) => f.url && (f.vcodec !== 'none' || f.acodec !== 'none')).map((f: any) => ({
            itag: 137, mimeType: f.ext ? `video/${f.ext}` : 'video/mp4', qualityLabel: f.format_note || f.resolution || 'Original',
            hasVideo: f.vcodec !== 'none', hasAudio: f.acodec !== 'none', container: f.ext || 'mp4', url: f.url
          }));
          return res.json({ title: info.title || "Extracted", author: info.uploader || "Unknown", thumbnail: info.thumbnail || "", platform: domain.split('.')[0], formats });
        }
      }

      // 5. Direct Link Detection
      if (cleanUrl.match(/\.(mp4|webm|mp3|m4a|wav|jpg|jpeg|png|gif|webp|mov|mkv)(\?|$)/i)) {
        const ext = cleanUrl.match(/\.(mp4|webm|mp3|m4a|wav|jpg|jpeg|png|gif|webp|mov|mkv)/i)?.[1].toLowerCase() || 'mp4';
        const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
        return res.json({
          title: urlObj.pathname.split('/').pop() || "Direct File", author: "Direct Link", thumbnail: isImg ? cleanUrl : "", platform: 'direct',
          formats: [{ itag: 1000, mimeType: isImg ? `image/${ext}` : (['mp3', 'm4a'].includes(ext) ? 'audio/mpeg' : 'video/mp4'), qualityLabel: 'Direct Link', hasVideo: !isImg && !['mp3', 'm4a'].includes(ext), hasAudio: !isImg, container: ext, url: cleanUrl }]
        });
      }

      return res.status(400).json({ error: "Plataforma no soportada o enlace no vÃ¡lido para anÃ¡lisis rÃ¡pido." });

    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Error de anÃ¡lisis: " + error.message });
    }
  });

  // API Route to proxy the download - since btch-downloader gives us direct links, we'll just redirect to them!
  app.get("/api/download", async (req, res) => {
    try {
      const { url, ext, proxy, title, mp3, start, end } = req.query;

      if (!url || typeof url !== 'string') {
        return res.status(400).send("Missing required parameters");
      }

      // Always proxy to control headers and avoid CORS/403
      const fetchHeaders: any = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      };

      if (url.includes('twitter.com') || url.includes('x.com') || url.includes('twimg.com')) {
        fetchHeaders['Referer'] = 'https://twitter.com/';
        fetchHeaders['Origin'] = 'https://twitter.com/';
      }

      const fetchRes = await fetch(url, { headers: fetchHeaders });

      let targetExt = mp3 === 'true' ? 'mp3' : ext;
      let filename = `video_omni_download.${targetExt}`;
      if (title && typeof title === 'string') {
        let safeTitle = title.replace(/[^a-zA-Z0-9.\-_ ()]/g, "").trim().replace(/\s+/g, "_") || 'video';
        // Avoid double extension like file.mp4.mp4
        if (safeTitle.endsWith(`.${targetExt}`)) {
          filename = safeTitle;
        } else {
          filename = `${safeTitle}.${targetExt}`;
        }
      }

      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      if (mp3 === 'true') {
        res.setHeader('Content-Type', 'audio/mpeg');
        let command = ffmpeg(fetchRes.body)
          .inputFormat(ext === 'mp4' ? 'mp4' : ext) // Handle simple case
          .toFormat('mp3')
          .on('error', (err) => {
            console.error("FFMPEG error:", err);
          });

        if (start) {
          command = command.setStartTime(String(start));
        }
        if (end) {
          const duration = Number(end) - Number(start || 0);
          if (duration > 0) {
            command = command.setDuration(duration);
          }
        }

        return command.pipe(res);
      } else {
        if (ext === 'mp3') res.setHeader('Content-Type', 'audio/mpeg');
        else res.setHeader('Content-Type', 'video/mp4');

        if (start || end) {
          let command = ffmpeg(fetchRes.body)
            .inputFormat(ext === 'mp4' ? 'mp4' : ext)
            .toFormat(ext === 'mp4' ? 'mp4' : ext)
            .outputOptions(['-movflags', 'frag_keyframe+empty_moov']) // Crucial for mp4 streaming output
            .on('error', (err) => console.error("FFMPEG video trim error:", err));

          if (start) command = command.setStartTime(String(start));

          if (end) {
            // Convert text to total seconds for subtraction
            const getSec = (t: string) => {
              let parts = t.toString().split(':').reverse();
              return parts.reduce((acc, val, i) => acc + (Number(val) * Math.pow(60, i)), 0);
            };
            const duration = getSec(String(end)) - getSec(String(start || '0'));
            if (duration > 0) command = command.setDuration(duration);
          }

          return command.pipe(res);
        }

        if (fetchRes.body) {
          return fetchRes.body.pipe(res);
        }
      }
    } catch (error: any) {
      console.error(error);
      res.status(500).send("Internal Server Error: " + error.message);
    }
  });

  // API Route to proxy images
  app.get("/api/proxy-image", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url || typeof url !== 'string') {
        return res.status(400).send("Missing required parameters");
      }

      const fetchHeaders: any = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://twitter.com/',
        'Origin': 'https://twitter.com/'
      };

      const fetchRes = await fetch(url, { headers: fetchHeaders });
      res.setHeader('Content-Type', fetchRes.headers.get('content-type') || 'image/jpeg');
      if (fetchRes.body) {
        return fetchRes.body.pipe(res);
      }
    } catch (error: any) {
      console.error(error);
      res.status(500).send("Internal Server Error");
    }
  });


  app.post("/api/studio", upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).send("No file uploaded");
    const { start, end, quality } = req.body;
    const isImage = req.file.mimetype.startsWith("image/");
    const ext = isImage ? 'jpg' : 'mp4';
    const outputFilename = `out_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
    const outputPath = path.join(__dirname, 'uploads', outputFilename);

    let command = ffmpeg(req.file.path).on("end", () => {
      fs.unlink(req.file!.path, () => { });
      res.json({ success: true, downloadUrl: `/api/studio/download/${outputFilename}` });

      // Clean up the file after 30 minutes to save space instead of doing it on download
      setTimeout(() => {
        if (fs.existsSync(outputPath)) {
          fs.unlink(outputPath, () => { });
        }
      }, 30 * 60 * 1000); // 30 mins
    }).on("error", (err) => {
      console.error(err);
      fs.unlink(req.file!.path, () => { });
      res.status(500).json({ error: "FFMPEG processing failed" });
    });

    if (isImage) {
      command.outputOptions([`-q:v ${quality ? Math.floor(100 / quality * 3) : 2}`]).toFormat("image2").save(outputPath);
    } else {
      if (start) command = command.setStartTime(String(start));
      if (end) {
        const getSec = (t: string) => t.split(':').reverse().reduce((acc, val, i) => acc + (Number(val) * Math.pow(60, i)), 0);
        const duration = getSec(String(end)) - getSec(String(start || '0'));
        if (duration > 0) command = command.setDuration(duration);
      }

      if (quality && Number(quality) < 100) {
        const crf = Math.floor(18 + ((100 - Number(quality)) / 100) * 33);
        command = command.outputOptions(['-c:v libx264', `-crf ${crf}`, '-preset ultrafast']);
      } else {
        command = command.outputOptions(['-c copy']);
      }
      command.toFormat("mp4").save(outputPath);
    }
  });

  app.get("/api/studio/download/:filename", (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send("File not found or expired");
    }
    // Remove fs.unlink to avoid Android Download Manager failing the request when it restarts it.
    res.download(filePath, `argeload_local_edit.${filePath.split('.').pop()}`);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
