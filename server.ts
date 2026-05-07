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
          const btch = await btchPromise;
          const yt: any = await btch.youtube(cleanUrl);
          if (yt && (yt.mp4 || yt.mp3)) {
            const formats = [];
            if (yt.mp4) {
              formats.push({
                itag: 137, mimeType: 'video/mp4', qualityLabel: 'Video HD',
                hasVideo: true, hasAudio: true, container: 'mp4', url: yt.mp4
              });
            }
            if (yt.mp3) {
              formats.push({
                itag: 140, mimeType: 'audio/mpeg', qualityLabel: 'Audio MP3',
                hasVideo: false, hasAudio: true, container: 'mp3', url: yt.mp3
              });
            }

            return res.json({
              title: yt.title || "Video de YouTube",
              author: yt.author || "YouTube",
              thumbnail: yt.thumbnail || "",
              platform: 'youtube',
              formats
            });
          }
        } catch (e) {
          console.error("YT BTCH error", e);
        }
      }

      // 2. Ruhend / BTCH for Social Media (Fast Scrapers)
      const ruhend = await ruhendPromise;

      // TikTok
      if (domain.includes('tiktok.com')) {
        try {
          const tt = await ruhend.ttdl(cleanUrl);
          if (tt?.video || (tt?.photo && tt.photo.length > 0)) {
            const formats = [];

            // Add video if exists
            if (tt.video) {
              formats.push({ itag: 137, mimeType: 'video/mp4', qualityLabel: 'Video Original', hasVideo: true, hasAudio: true, container: 'mp4', url: tt.video });
            }

            // Add audio if exists
            if (tt.music) {
              formats.push({ itag: 140, mimeType: 'audio/mpeg', qualityLabel: 'Audio Original', hasVideo: false, hasAudio: true, container: 'mp3', url: tt.music });
            }

            // Greedy check for images in ruhend or btch
            const photos = tt.photo || [];
            if (photos.length === 0) {
              // Try btch as fallback for photos
              try {
                const btch = await btchPromise;
                const tt2 = await btch.ttdl(cleanUrl);
                if (tt2?.video && Array.isArray(tt2.video)) {
                  tt2.video.forEach((v: string) => {
                    if (v.match(/\.(jpg|jpeg|png|webp)/i)) photos.push(v);
                  });
                }
              } catch (e) { }
            }

            if (Array.isArray(photos)) {
              photos.forEach((p: string, i: number) => {
                if (p && typeof p === 'string') {
                  formats.push({ itag: 200 + i, mimeType: 'image/jpeg', qualityLabel: `Imagen ${i + 1}`, hasVideo: false, hasAudio: false, container: 'jpg', url: p });
                }
              });
            }

            return res.json({
              title: tt.title || "Contenido de TikTok",
              author: tt.author || "Usuario de TikTok",
              thumbnail: tt.cover || (photos.length > 0 ? photos[0] : ""),
              platform: 'tiktok',
              formats: formats.filter(f => f.url)
            });
          }
        } catch (e) { }
      }

      // Instagram
      if (domain.includes('instagram.com')) {
        let igDataToProcess = null;
        try {
          const ig = await ruhend.igdl(cleanUrl);
          if (ig?.data?.length > 0) igDataToProcess = ig.data;
        } catch (e) { }

        // Fallback for stories and other links that ruhend fails on
        if (!igDataToProcess) {
          try {
            const btch = await btchPromise;
            const igb = await btch.igdl(cleanUrl);
            if (igb?.result?.length > 0) {
              igDataToProcess = igb.result.map((item: any) => ({
                url: item.url || item.thumbnail || '',
                filename: '' // btch doesn't always provide filename, so rely on extraction
              }));
            }
          } catch (e) { }
        }

        if (igDataToProcess && igDataToProcess.length > 0) {
          const uniqueFormatsMap = new Map();

          igDataToProcess.forEach((item: any) => {
            let fileBaseId = item.url;
            // Check if URL or filename explicitly reveals it's an MP4
            let isVideo = item.url.includes('.mp4') || (item.filename && item.filename.includes('.mp4'));

            try {
              const urlObj = new URL(item.url);
              const tokenInfo = urlObj.searchParams.get('token');
              if (tokenInfo) {
                const payload = JSON.parse(Buffer.from(tokenInfo.split('.')[1], 'base64').toString('utf8'));
                if (payload.filename) {
                  fileBaseId = payload.filename.split('_')[1] || payload.filename;
                  isVideo = isVideo || payload.filename.includes('.mp4');
                }
              } else if (item.filename) {
                fileBaseId = item.filename.split('_')[1] || item.filename;
              } else {
                const urlParts = item.url.split('?')[0].split('/');
                const filename = urlParts[urlParts.length - 1];
                fileBaseId = filename.split('_')[0] || filename;
                isVideo = isVideo || filename.includes('.mp4');
              }
            } catch (e) { }

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
            title: "Publicación de Instagram",
            author: "Usuario de Instagram",
            thumbnail: uniqueFormats[0]?.proxyUrl || "",
            platform: 'instagram',
            formats: uniqueFormats
          });
        }
      }

      // Facebook
      if (domain.includes('facebook.com') || domain.includes('fb.watch')) {
        try {
          const fb = await ruhend.fbdl(cleanUrl);
          if (fb?.hd || fb?.sd) {
            const formats = [];
            if (fb.hd) formats.push({ itag: 137, mimeType: 'video/mp4', qualityLabel: 'Calidad HD', hasVideo: true, hasAudio: true, container: 'mp4', url: fb.hd });
            if (fb.sd) formats.push({ itag: 136, mimeType: 'video/mp4', qualityLabel: 'Calidad Normal', hasVideo: true, hasAudio: true, container: 'mp4', url: fb.sd });
            return res.json({ title: "Video de Facebook", author: "Usuario de Facebook", thumbnail: "", platform: 'facebook', formats });
          }
        } catch (e) { }
      }

      // 3. Twitter, Pinterest, Threads (Using BTCH as it's faster than yt-dlp)
      const btch = await btchPromise;
      if (domain.includes('twitter.com') || domain.includes('x.com')) {
        try {
          const vxUrl = cleanUrl.replace('twitter.com', 'api.vxtwitter.com').replace('x.com', 'api.vxtwitter.com');
          const vxRes = await fetch(vxUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          const data: any = await vxRes.json();
          if (data.media_extended && data.media_extended.length > 0) {
            const formats = data.media_extended.map((m: any, idx: number) => ({
              itag: 137 + idx,
              mimeType: m.type === 'video' || m.type === 'gif' ? 'video/mp4' : 'image/jpeg',
              qualityLabel: m.type === 'video' || m.type === 'gif' ? `Video ${idx + 1}` : `Imagen ${idx + 1}`,
              hasVideo: m.type === 'video' || m.type === 'gif',
              hasAudio: m.type === 'video',
              container: m.type === 'video' || m.type === 'gif' ? 'mp4' : 'jpg',
              url: m.url
            }));
            return res.json({
              title: data.text || "Contenido de Twitter/X",
              author: `${data.user_name} (@${data.user_screen_name})`,
              thumbnail: data.media_extended[0].thumbnail_url || data.media_extended[0].url,
              platform: 'twitter',
              formats
            });
          }
        } catch (e) { }

        // Fallback to btch
        const tw = await btch.twitter(cleanUrl).catch(() => null);
        if (tw?.url && Array.isArray(tw.url)) {
          const formats = tw.url.map((u: any, idx: number) => {
            const urlStr = typeof u === 'string' ? u : (u.hd || u.sd || u.url);
            const isVideo = urlStr.includes('.mp4') || urlStr.includes('video');
            return {
              itag: 137 + idx,
              mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
              qualityLabel: isVideo ? `Video ${idx + 1}` : `Imagen ${idx + 1}`,
              hasVideo: isVideo,
              hasAudio: isVideo,
              container: isVideo ? 'mp4' : 'jpg',
              url: urlStr
            };
          });
          return res.json({
            title: tw.title || "Contenido de Twitter/X",
            thumbnail: tw.thumbnail || "",
            platform: 'twitter',
            formats
          });
        }
      }

      if (domain.includes('threads.net')) {
        const thr = await btch.threads(cleanUrl).catch(() => null);
        if (thr?.result?.length > 0) {
          return res.json({
            title: "Contenido de Threads", thumbnail: thr.result[0].url, platform: 'threads',
            formats: thr.result.map((r: any, idx: number) => {
              const isVideo = r.url.includes('.mp4');
              return {
                itag: 137 + idx,
                mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
                qualityLabel: isVideo ? `Video ${idx + 1}` : `Imagen ${idx + 1}`,
                hasVideo: isVideo,
                hasAudio: isVideo,
                container: isVideo ? 'mp4' : 'jpg',
                url: r.url
              };
            })
          });
        }
      }

      if (domain.includes('pinterest.com') || domain.includes('pin.it')) {
        try {
          const pin = await btch.pinterest(cleanUrl).catch(() => null);
          if (pin && (pin.url || pin.thumbnail)) {
            const formats = [];
            const mediaUrl = pin.url || pin.thumbnail;
            const isVideo = mediaUrl.includes('.mp4');
            formats.push({
              itag: 137,
              mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
              qualityLabel: isVideo ? 'Video Original' : 'Imagen Original',
              hasVideo: isVideo,
              hasAudio: isVideo,
              container: isVideo ? 'mp4' : 'jpg',
              url: mediaUrl
            });
            return res.json({ title: pin.title || "Contenido de Pinterest", thumbnail: pin.thumbnail || pin.url, platform: 'pinterest', formats });
          }
        } catch (e) { }
      }

      // 4. Specialized fallback for Twitch and Kick using yt-dlp
      if (domain.includes('kick.com') || domain.includes('twitch.tv')) {
        try {
          const info: any = await ytdl(cleanUrl, { dumpSingleJson: true, noCheckCertificates: true, noWarnings: true, preferFreeFormats: true });
          if (info && info.formats) {
            const formats = info.formats
              .filter((f: any) => f.url && (f.vcodec !== 'none' || f.acodec !== 'none'))
              .map((f: any, idx: number) => ({
                itag: 137 + idx,
                mimeType: f.ext ? `video/${f.ext}` : 'video/mp4',
                qualityLabel: f.format_note || f.resolution || `Calidad ${idx + 1}`,
                hasVideo: f.vcodec !== 'none',
                hasAudio: f.acodec !== 'none',
                container: f.ext || 'mp4',
                url: f.url
              }));

            return res.json({
              title: info.title || (domain.includes('twitch') ? "Twitch Media" : "Kick Video"),
              author: info.uploader || info.creator || "Creador",
              thumbnail: info.thumbnail || "",
              platform: domain.includes('twitch') ? 'twitch' : 'kick',
              formats
            });
          }
        } catch (e) {
          console.error("Twitch/Kick Error:", e);
        }
      }

      // 5. Direct Link Detection (Extension based)
      const directMatch = cleanUrl.match(/\.(mp4|webm|mp3|m4a|wav|jpg|jpeg|png|gif|webp|mov|mkv)(\?|$)/i);
      if (directMatch) {
        const ext = directMatch[1].toLowerCase();
        const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
        const isAud = ['mp3', 'm4a', 'wav'].includes(ext);
        const title = urlObj.pathname.split('/').pop()?.split('?')[0] || "Archivo Directo";

        const proxyUrl = isImg ? `/api/proxy-image?url=${encodeURIComponent(cleanUrl)}` : undefined;

        return res.json({
          title,
          author: "Enlace Directo",
          thumbnail: proxyUrl || "",
          platform: 'direct',
          formats: [{
            itag: 1000,
            mimeType: isImg ? `image/${ext}` : (isAud ? 'audio/mpeg' : 'video/mp4'),
            qualityLabel: 'Enlace Directo',
            hasVideo: !isImg && !isAud,
            hasAudio: !isImg,
            container: ext,
            url: cleanUrl,
            proxyUrl: proxyUrl
          }]
        });
      }

      // 6. Generic Media Detection (Header based fallback)
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000); // 6s max for external detection

        const headRes = await fetch(cleanUrl, {
          method: 'HEAD',
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
          signal: controller.signal
        }).catch(() => null);

        clearTimeout(timeout);

        if (headRes && headRes.ok) {
          const contentType = headRes.headers.get('content-type') || "";
          if (contentType.startsWith('image/') || contentType.startsWith('video/') || contentType.startsWith('audio/')) {
            const isImg = contentType.startsWith('image/');
            const isVid = contentType.startsWith('video/');
            const isAud = contentType.startsWith('audio/');

            let ext = contentType.split('/')[1]?.split(';')[0] || (isImg ? 'jpg' : isVid ? 'mp4' : 'mp3');
            if (ext === 'mpeg') ext = 'mp3';
            if (ext === 'quicktime') ext = 'mov';
            if (ext === 'x-matroska') ext = 'mkv';

            const proxyUrl = isImg ? `/api/proxy-image?url=${encodeURIComponent(cleanUrl)}` : undefined;

            return res.json({
              title: urlObj.pathname.split('/').pop()?.split('?')[0] || "Archivo Externo",
              author: "Enlace Externo",
              thumbnail: proxyUrl || "",
              platform: 'direct',
              formats: [{
                itag: 1000,
                mimeType: contentType.split(';')[0],
                qualityLabel: 'Enlace Externo',
                hasVideo: isVid,
                hasAudio: isVid || isAud,
                container: ext,
                url: cleanUrl,
                proxyUrl: proxyUrl
              }]
            });
          }
        }
      } catch (e) {
        console.log("Generic detection skipped for:", cleanUrl);
      }

      return res.status(400).json({ error: "Plataforma no soportada. ArgeLoad intentó detectar medios pero no encontró imágenes, videos o audio directo." });

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
        const extLower = String(ext).toLowerCase();
        if (extLower === 'mp3') res.setHeader('Content-Type', 'audio/mpeg');
        else if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extLower)) res.setHeader('Content-Type', 'image/jpeg');
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
    if (!req.file) return res.status(400).send("No se subió ningún archivo");
    const { quality } = req.body;

    // Improved detection
    const isImage = req.file.mimetype.startsWith("image/") || !!(req.file.originalname && req.file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/i));
    const isAudio = !isImage && (req.file.mimetype.startsWith("audio/") || !!(req.file.originalname && req.file.originalname.match(/\.(mp3|wav|m4a)$/i)));

    const ext = isImage ? 'jpg' : (isAudio ? 'mp3' : 'mp4');
    const outputFilename = `out_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
    const outputPath = path.join(__dirname, 'uploads', outputFilename);

    let command = ffmpeg(req.file.path).on("end", () => {
      fs.unlink(req.file!.path, () => { });
      res.json({ success: true, downloadUrl: `/api/studio/download/${outputFilename}` });

      setTimeout(() => {
        if (fs.existsSync(outputPath)) {
          fs.unlink(outputPath, () => { });
        }
      }, 30 * 60 * 1000); // 30 mins
    }).on("error", (err) => {
      console.error(err);
      fs.unlink(req.file!.path, () => { });
      res.status(500).json({ error: "El procesamiento de FFMPEG falló" });
    });

    if (isImage) {
      // Image compression
      command.outputOptions([`-q:v ${quality ? Math.floor(1 + ((100 - quality) / 100) * 30) : 2}`]).toFormat("image2").save(outputPath);
    } else if (isAudio) {
      // Audio compression
      if (quality && Number(quality) < 100) {
        const bitrate = Math.floor(32 + (Number(quality) / 100) * 224); // Scale 32k to 256k
        command = command.outputOptions([`-b:a ${bitrate}k`]);
      }
      command.toFormat("mp3").save(outputPath);
    } else {
      // Video compression
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
      return res.status(404).send("Archivo no encontrado o expirado");
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
