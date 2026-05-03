import { Download, Film, Music, Loader2, Video, Image as ImageIcon, Clipboard, X } from "lucide-react";
import React, { useState, useEffect } from "react";

// CONFIGURACIÓN PARA ANDROID:
// 1. Abre la terminal y escribe 'ipconfig'
// 2. Busca 'IPv4 Address' (ej. 192.168.1.15)
// 3. Ponla aquí abajo:
const SERVER_IP = "192.168.0.10";
// En un celular o emulador, localhost o 127.0.0.1 referencian al propio dispositivo, no a tu PC.
// Por eso forzamos a que siempre use directamente la IP local de tu PC:
const API_BASE_URL = `http://${SERVER_IP}:3000`;

interface Format {
  itag: number;
  mimeType: string;
  qualityLabel: string;
  bitrate: number;
  audioBitrate?: number;
  hasVideo: boolean;
  hasAudio: boolean;
  contentLength?: string;
  container: string;
  url: string;
}

interface VideoInfo {
  title: string;
  description: string;
  thumbnail: string;
  author: string;
  duration: string;
  platform: string;
  formats: Format[];
}

export default function App() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [convertToMp3, setConvertToMp3] = useState(false);

  useEffect(() => {
    let interval: any;
    if (loading) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev < 50) return prev + Math.floor(Math.random() * 10) + 5;
          if (prev < 80) return prev + Math.floor(Math.random() * 5) + 2;
          if (prev < 90) return prev + Math.floor(Math.random() * 2);
          return prev;
        });
      }, 500);
    } else if (info) {
      setProgress(100);
    } else {
      setProgress(0);
    }
    return () => clearInterval(interval);
  }, [loading, info]);

  const formatBytes = (bytes: string | number | undefined) => {
    let b = typeof bytes === 'string' ? parseInt(bytes, 10) : Number(bytes);
    if (isNaN(b) || b === 0) return "Desconocido";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error al analizar");
      setInfo(data);
    } catch (err: any) {
      setError(`Error de conexión: Verifica que el servidor esté en ${API_BASE_URL}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
    } catch (err) {
      console.error("Error al pegar", err);
    }
  };

  const handleDownload = (format: Format) => {
    if (!info) return;
    const downloadUrl = `${API_BASE_URL}/api/download?url=${encodeURIComponent(format.url)}&ext=${format.container}&proxy=true&title=${encodeURIComponent(info.title)}${convertToMp3 ? '&mp3=true' : ''}`;
    window.open(downloadUrl, '_system');
  };

  const videoFormats = info?.formats.filter((f) => f.hasVideo && f.hasAudio) || [];
  const videoOnlyFormats = info?.formats.filter((f) => f.hasVideo && !f.hasAudio) || [];

  const uniqueVideoFormats = Array.from(
    new Map([...videoFormats, ...videoOnlyFormats].sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0)).map((item) => [`${item.qualityLabel}-${item.container}`, item])).values()
  ).filter((f) => f.qualityLabel !== 'Audio Only' && f.qualityLabel != null);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 p-4 font-sans">
      <main className="max-w-md mx-auto py-8">

        <header className="flex flex-col items-center text-center space-y-4 mb-8">
          <div className="p-4 bg-indigo-500/10 rounded-3xl border border-indigo-500/20 shadow-inner">
            <Download className="w-12 h-12 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-white">OmniDown</h1>
            <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest mt-1">Mobile Downloader</p>
          </div>
        </header>

        <form onSubmit={handleAnalyze} className="space-y-4 mb-10">
          <div className="relative bg-neutral-900 rounded-3xl border border-white/5 shadow-2xl overflow-hidden focus-within:ring-2 ring-indigo-500/50 transition-all">
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Pega el link aquí..."
              className="w-full bg-transparent px-6 py-5 text-white placeholder-neutral-600 focus:outline-none text-base"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
              {url && <button type="button" onClick={() => setUrl("")} className="p-2 text-neutral-500 hover:text-white"><X size={22} /></button>}
              <button type="button" onClick={handlePaste} className="p-2 text-indigo-400 active:scale-90 transition-transform"><Clipboard size={22} /></button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black rounded-3xl transition-all shadow-xl shadow-indigo-600/20 active:scale-[0.98]"
          >
            {loading ? <Loader2 className="animate-spin mx-auto w-6 h-6" /> : "ANALIZAR CONTENIDO"}
          </button>
        </form>

        {loading && (
          <div className="mb-10 animate-pulse">
            <div className="h-3 w-full bg-neutral-900 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 transition-all duration-300 shadow-[0_0_15px_rgba(99,102,241,0.5)]" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-[10px] text-center text-neutral-500 mt-3 font-black tracking-widest uppercase">Procesando calidad: {progress}%</p>
          </div>
        )}

        {error && <div className="p-5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-3xl text-xs font-bold text-center mb-8 animate-bounce">{error}</div>}

        {info && !loading && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
            <div className="rounded-[2.5rem] overflow-hidden border border-white/10 aspect-video relative shadow-2xl group">
              <img src={info.thumbnail} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent flex flex-col justify-end p-6">
                <h2 className="font-black text-lg text-white leading-tight mb-1">{info.title}</h2>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-indigo-600 rounded-md text-[9px] font-black uppercase">{info.platform}</span>
                  <p className="text-[11px] text-neutral-400 font-medium truncate">{info.author}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              <h3 className="text-[11px] font-black text-neutral-600 uppercase tracking-[0.3em] px-2 mb-1">Opciones Disponibles</h3>

              <div className="flex items-center gap-3 p-5 bg-neutral-900/50 rounded-3xl border border-white/5 mb-2">
                <input type="checkbox" id="mp3" checked={convertToMp3} onChange={(e) => setConvertToMp3(e.target.checked)} className="w-6 h-6 rounded-lg accent-indigo-500" />
                <label htmlFor="mp3" className="text-sm text-neutral-300 font-bold italic">Modo MP3 de alta fidelidad</label>
              </div>

              {uniqueVideoFormats.map((f, i) => (
                <button key={i} onClick={() => handleDownload(f)} className="w-full flex items-center justify-between p-5 bg-neutral-900 border border-white/5 rounded-[2rem] active:scale-95 transition-all hover:bg-neutral-800/80">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center">
                      <Film className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-black text-white">{f.qualityLabel}</p>
                      <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-tighter">{f.container} • {formatBytes(f.contentLength)}</p>
                    </div>
                  </div>
                  <div className="bg-white/5 p-3 rounded-full">
                    <Download className="w-5 h-5 text-indigo-400" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
