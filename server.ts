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

  app.use(cors());
  app.use(express.json());


  // API Route to fetch video info
  app.post("/api/info", async (req, res) => {
    try {
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      console.log(`Extracting: ${url}`);

      // If TikTok, Instagram, Pinterest, Kick, or Twitch, use yt-dlp explicitly
      if (url.includes('tiktok.com') || url.includes('instagram.com') || url.includes('pinterest.com') || url.includes('kick.com') || url.includes('twitch.tv')) {
        try {
          const info = await ytdl(url, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            geoBypass: true,
            addHeader: [
              'referer:https://kick.com/',
              'origin:https://kick.com/',
              'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
              'accept-language: es-ES,es;q=0.9,en;q=0.8',
              'accept: application/json, text/plain, */*'
            ]
          });

          const platformMap = {
            'tiktok.com': 'tiktok',
            'instagram.com': 'instagram',
            'pinterest.com': 'pinterest',
            'kick.com': 'kick',
            'twitch.tv': 'twitch'
          };

          const platform = Object.keys(platformMap).find(key => url.includes(key)) || 'unknown';

          const platformName = platformMap[platform as keyof typeof platformMap] || 'unknown';

          let finalFormats = [];
          if (info.formats && info.formats.length > 0) {
            finalFormats = info.formats.map((f: any) => ({
              itag: 137,
              mimeType: f.ext ? `video/${f.ext}` : 'video/mp4',
              qualityLabel: f.format_note || 'Original',
              hasVideo: true,
              hasAudio: true,
              container: f.ext || 'mp4',
              url: f.url || info.url
            }));
          } else if (platformName === 'pinterest' && info.thumbnail) {
            finalFormats = [{
              itag: 137,
              mimeType: 'image/jpeg',
              qualityLabel: 'Original',
              hasVideo: false,
              hasAudio: false,
              container: 'jpg',
              url: info.thumbnail
            }];
          } else {
            finalFormats = [{
              itag: 137,
              mimeType: 'video/mp4',
              qualityLabel: 'Original',
              hasVideo: true,
              hasAudio: true,
              container: 'mp4',
              url: info.url
            }];
          }

          const result = {
            title: info.title,
            author: info.uploader || "Desconocido",
            thumbnail: info.thumbnail,
            platform: platformName,
            formats: finalFormats
          };
          return res.json(result);
        } catch (e: any) {
          console.error("yt-dlp error:", e);
          return res.status(400).json({ error: "No se pudo extraer el enlace: " + e.message });
        }
      }

      // Existing logic for other platforms
      let info: any = null;
      let platform = 'unknown';
      let formats: any[] = [];
      let baseData = { title: "Media content", author: "Unknown", thumbnail: "", duration: "Unknown" };

      // direct link detection before platform specific parsing
      const isDirectMedia = url.match(/\.(mp4|webm|mp3|m4a|wav|jpg|jpeg|png|gif|webp|mov|mkv)(\?|$)/i) ||
        url.includes('video.twimg.com') ||
        url.includes('pbs.twimg.com/media') ||
        url.match(/format=(jpg|jpeg|png|gif|webp|mp4)/i) ||
        url.includes('instagram.com/v/');

      if (isDirectMedia && !url.includes('/status/') && !url.includes('/p/') && !url.includes('/reel/')) {
        platform = 'direct';
        const urlObj = new URL(url);
        let extMatch = urlObj.pathname.match(/\.(mp4|webm|mp3|m4a|wav|jpg|jpeg|png|gif|webp|mov|mkv)$/i)
          || url.match(/format=(jpg|jpeg|png|gif|webp|mp4)/i);
        let ext = extMatch ? extMatch[1].toLowerCase() : 'unknown';

        let isVideo = ['mp4', 'webm', 'mov', 'mkv'].includes(ext);
        let isAudio = ['mp3', 'm4a', 'wav'].includes(ext);
        let isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);

        // guess extension if not found in pathname
        if (ext === 'unknown') {
          if (url.includes('video.twimg.com')) { isVideo = true; ext = 'mp4'; }
          else if (url.includes('pbs.twimg.com')) { isImage = true; ext = 'jpg'; }
          else isVideo = true; // default guess or do a HEAD request
        }

        let originalFilename = urlObj.pathname.split('/').pop() || "Direct_Media";
        // if no extension in filename but we know the ext, append it so the title naturally has it 
        if (!originalFilename.includes('.') && ext !== 'unknown') {
          originalFilename += `.${ext}`;
        }

        info = { status: true, title: originalFilename };
        baseData.title = originalFilename;

        if (isImage) {
          formats.push({ itag: 1000, mimeType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, qualityLabel: 'Original', hasVideo: false, hasAudio: false, container: ext, url: url });
        } else if (isAudio) {
          formats.push({ itag: 140, mimeType: `audio/${ext}`, qualityLabel: 'Audio', hasVideo: false, hasAudio: true, container: ext, url: url });
        } else {
          formats.push({ itag: 137, mimeType: `video/${ext}`, qualityLabel: 'Video', hasVideo: true, hasAudio: true, container: ext, url: url });
        }
      }
      else if (url.includes('youtube.com') || url.includes('youtu.be')) {
        platform = 'youtube';
        const yt = await import('btch-downloader').then(m => m.youtube(url)).catch(() => null);
        if (yt && yt.status) {
          info = yt;
          baseData.title = yt.title || "Video de YouTube";
          baseData.author = yt.author || "Desconocido";
          baseData.thumbnail = yt.thumbnail || "";

          if (yt.mp4) formats.push({ itag: 137, mimeType: 'video/mp4', qualityLabel: '1080p', bitrate: 5000000, hasVideo: true, hasAudio: true, container: 'mp4', url: yt.mp4 });
          if (yt.mp3) formats.push({ itag: 140, mimeType: 'audio/mpeg', qualityLabel: 'Solo Audio', audioBitrate: 128, hasVideo: false, hasAudio: true, container: 'mp3', url: yt.mp3 });
        }
      } else if (url.includes('instagram.com')) {
        platform = 'instagram';
        const ig = await import('btch-downloader').then(m => m.igdl(url)).catch(() => null);
        if (ig && ig.status && ig.result && ig.result.length > 0) {
          info = ig;
          baseData.title = "Reel/Post de Instagram";
          baseData.thumbnail = ig.result[0].thumbnail || "";
          ig.result.forEach((res: any) => {
            if (res.url) {
              formats.push({ itag: 137, mimeType: 'video/mp4', qualityLabel: 'HD', bitrate: 3000000, hasVideo: true, hasAudio: true, container: 'mp4', url: res.url });
            }
          });
        }
      } else if (url.includes('tiktok.com')) {
        platform = 'tiktok';
        const tt = await import('btch-downloader').then(m => m.ttdl(url)).catch(() => null);
        if (tt && tt.status) {
          info = tt;
          baseData.title = tt.title || "Video de TikTok";
          baseData.thumbnail = tt.thumbnail || "";

          if (tt.video && tt.video.length > 0) {
            tt.video.forEach((v: string) => {
              formats.push({ itag: 137, mimeType: 'video/mp4', qualityLabel: 'HD', bitrate: 3000000, hasVideo: true, hasAudio: true, container: 'mp4', url: v });
            });
          }
          if (tt.audio && tt.audio.length > 0) {
            tt.audio.forEach((a: string) => {
              formats.push({ itag: 140, mimeType: 'audio/mpeg', qualityLabel: 'Solo Audio', audioBitrate: 128, hasVideo: false, hasAudio: true, container: 'mp3', url: a });
            });
          }
        }
      } else if (url.includes('twitter.com') || url.includes('x.com')) {
        platform = 'twitter';
        const tw = await import('btch-downloader').then(m => m.twitter(url)).catch(() => null);
        if (tw && tw.status && tw.url && tw.url.length > 0) {
          info = tw;
          baseData.title = tw.title || "Video de Twitter/X";
          baseData.thumbnail = tw.thumbnail || "";
          tw.url.forEach((u: any) => {
            formats.push({ itag: 137, mimeType: 'video/mp4', qualityLabel: 'HD', bitrate: 2000000, hasVideo: true, hasAudio: true, container: 'mp4', url: u.hd || u.sd || u.url });
          });
        }
      } else if (url.includes('facebook.com') || url.includes('fb.watch')) {
        platform = 'facebook';
        const fb = await import('btch-downloader').then(m => m.fbdown(url)).catch(() => null);
        if (fb && fb.status) {
          info = fb;
          baseData.title = "Video de Facebook";
          if (fb.HD) formats.push({ itag: 137, mimeType: 'video/mp4', qualityLabel: 'HD', bitrate: 3000000, hasVideo: true, hasAudio: true, container: 'mp4', url: fb.HD });
          if (fb.Normal_video) formats.push({ itag: 136, mimeType: 'video/mp4', qualityLabel: 'SD', bitrate: 1000000, hasVideo: true, hasAudio: true, container: 'mp4', url: fb.Normal_video });
        }
      }

      if (!info || formats.length === 0) {
        return res.status(400).json({ error: "No se pudo extraer el enlace. Puede que la plataforma estÃ© bloqueando o que sea una red no soportada aÃºn." });
      }

      // Fetch actual file sizes
      const fetchSize = async (url: string) => {
        try {
          const headRes = await fetch(url, { method: 'HEAD' });
          const len = headRes.headers.get('content-length');
          if (len) return parseInt(len, 10);
        } catch (e) {
          // Ignore
        }
        return undefined;
      };

      const validFormats = formats.filter(f => f.url);
      for (const format of validFormats) {
        const size = await fetchSize(format.url);
        if (size) {
          format.contentLength = size;
        }
      }

      const result = {
        ...baseData,
        platform: platform,
        formats: validFormats,
      };

      return res.json(result);

    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch video information. " + error.message });
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
      res.json({ success: true, downloadUrl: `${req.protocol}://${req.get('host')}/api/studio/download/${outputFilename}` });
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
    res.download(filePath, `argeload_local_edit.${filePath.split('.').pop()}`, (err) => {
      fs.unlink(filePath, () => { });
    });
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
