import { Download, Film, Music, Loader2, ArrowRight, Video, Image as ImageIcon, Clipboard, X } from "lucide-react";
import React, { useState, useEffect } from "react";

// IMPORTANTE: Cambia esto por la IP de tu servidor (ej. http://192.168.1.50:3000)
// o la URL de tu backend en la nube (ej. https://mi-backend.render.com)
const API_BASE_URL = "http://CAMBIA_POR_TU_IP:3000";

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
    let interval: NodeJS.Timeout;
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
      if (!response.ok) throw new Error(data.error || "Error al analizar el link");
      setInfo(data);
    } catch (err: any) {
      setError("Error de conexión: Asegúrate de que el servidor esté encendido y la IP sea correcta. " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      // En Android/Capacitor, navigator.clipboard funciona si el permiso está concedido
      const text = await navigator.clipboard.readText();
      setUrl(text);
    } catch (err) {
      console.error("Error al pegar:", err);
    }
  };

  const handleClear = () => {
    setUrl("");
    setInfo(null);
    setError(null);
  };

  const handleDownload = async (format: Format) => {
    if (!info) return;
    // Abrir el link en el navegador del sistema para que gestione la descarga nativamente
    const downloadUrl = `${API_BASE_URL}/api/download?url=${encodeURIComponent(format.url)}&ext=${format.container}&proxy=true&title=${encodeURIComponent(info.title)}${convertToMp3 ? '&mp3=true' : ''}`;
    window.open(downloadUrl, '_system');
  };

  const videoFormats = info?.formats.filter((f) => f.hasVideo && f.hasAudio) || [];
  const videoOnlyFormats = info?.formats.filter((f) => f.hasVideo && !f.hasAudio) || [];
  const audioFormats = info?.formats.filter((f) => !f.hasVideo && f.hasAudio) || [];
  
  const uniqueVideoFormats = Array.from(
    new Map([...videoFormats, ...videoOnlyFormats].sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0)).map((item) => [`${item.qualityLabel}-${item.container}`, item])).values()
  ).filter((f) => f.qualityLabel !== 'Audio Only' && f.qualityLabel != null);

  const uniqueAudioFormats = Array.from(
    new Map(audioFormats.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0)).map((item) => [`${item.audioBitrate}-${item.container}`, item])).values()
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 px-4 py-8">
      <main className="max-w-md mx-auto">
        
        <header className="flex flex-col items-center text-center space-y-4 mb-8">
          <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
            <Download className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-br from-white to-neutral-400 bg-clip-text text-transparent">
            OmniDownloader Mobile
          </h1>
          <p className="text-neutral-400 text-sm">Descarga videos y audios directamente a tu galería.</p>
        </header>

        <div className="w-full mb-8">
          <form onSubmit={handleAnalyze} className="flex flex-col gap-2">
            <div className="relative bg-neutral-900 rounded-xl ring-1 ring-white/10 overflow-hidden focus-within:ring-indigo-500/50">
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Pega el enlace aquí..."
                className="w-full bg-transparent border-none px-4 py-4 text-white placeholder-neutral-500 focus:outline-none"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                {url && <button type="button" onClick={handleClear} className="p-2 text-neutral-400"><X className="w-5 h-5"/></button>}
                <button type="button" onClick={handlePaste} className="p-2 text-neutral-400"><Clipboard className="w-5 h-5"/></button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Analizar Video"}
            </button>
          </form>

          {loading && (
            <div className="mt-4">
              <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-[10px] text-center text-neutral-500 mt-2 uppercase tracking-widest font-bold">Procesando... {progress}%</p>
            </div>
          )}

          {error && <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs text-center">{error}</div>}
        </div>

        {info && !loading && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl relative aspect-video">
              <img src={info.thumbnail} className="w-full h-full object-cover" />
              <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-md p-2 rounded-lg">
                <p className="text-xs font-bold truncate">{info.title}</p>
                <p className="text-[10px] text-neutral-300">{info.author} • {info.platform}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-neutral-900/50 border border-white/5 rounded-xl">
              <input type="checkbox" id="mp3" checked={convertToMp3} onChange={(e) => setConvertToMp3(e.target.checked)} className="h-5 w-5 rounded border-neutral-700 bg-neutral-800 text-indigo-600" />
              <label htmlFor="mp3" className="text-sm font-medium text-neutral-300">Modo Solo Audio (MP3)</label>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2"><Film className="w-3 h-3"/> Calidades Disponibles</h3>
              <div className="grid gap-2">
                {uniqueVideoFormats.map((f, i) => (
                  <button key={i} onClick={() => handleDownload(f)} className="flex items-center justify-between p-4 bg-neutral-900 border border-white/5 rounded-xl active:bg-neutral-800">
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-black text-indigo-400">{f.qualityLabel.replace('p','')}</span>
                      <div className="text-left">
                        <p className="text-xs font-bold uppercase">{f.container}</p>
                        <p className="text-[10px] text-neutral-500 font-mono">{formatBytes(f.contentLength)}</p>
                      </div>
                    </div>
                    <Download className="w-5 h-5 text-neutral-400" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
