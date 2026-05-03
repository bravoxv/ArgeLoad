import { Download, Film, Music, Loader2, Video, Image as ImageIcon, Clipboard, X } from "lucide-react";
import React, { useState, useEffect } from "react";

// CONFIGURACIÓN PARA ANDROID:
// 1. Abre la terminal y escribe 'ipconfig'
// 2. Busca 'IPv4 Address' (ej. 192.168.1.15)
// 3. Ponla aquí abajo:
const API_BASE_URL = "https://omnidown-backend.onrender.com";

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
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [clicks, setClicks] = useState(0);
  const [tab, setTab] = useState<'web' | 'local'>('web');
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [quality, setQuality] = useState(60);

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

  useEffect(() => {
    const checkClipboard = async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text && (text.startsWith("http://") || text.startsWith("https://")) && text !== url) {
          setUrl(text);
        }
      } catch (err) { }
    };
    window.addEventListener("focus", checkClipboard);
    return () => window.removeEventListener("focus", checkClipboard);
  }, [url]);

  useEffect(() => {
    // Autostart analysis when a valid URL is set and we're not already doing it
    if (url && (url.startsWith("http://") || url.startsWith("https://")) && !info && !loading && !error) {
      document.getElementById("analyze-btn")?.click();
    }
  }, [url, info, loading, error]);

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

  const handleDownload = (format: Format, isMp3: boolean) => {
    if (!info) return;
    let downloadUrl = `${API_BASE_URL}/api/download?url=${encodeURIComponent(format.url)}&ext=${format.container}&proxy=true&title=${encodeURIComponent(info.title)}`;
    if (isMp3) downloadUrl += `&mp3=true`;
    window.open(downloadUrl, '_system');
  };

  const handleLocalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localFile) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', localFile);
      formData.append('quality', String(quality));
      if (startTime) formData.append('start', startTime);
      if (endTime) formData.append('end', endTime);

      const response = await fetch(`${API_BASE_URL}/api/studio`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Fallo en el servidor al procesar el archivo local");

      let finalDownloadUrl = data.downloadUrl;
      if (finalDownloadUrl.startsWith('/')) {
        finalDownloadUrl = `${API_BASE_URL}${finalDownloadUrl}`;
      }

      window.open(finalDownloadUrl, '_system');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const videoFormats = info?.formats.filter((f) => f.hasVideo && f.hasAudio) || [];
  const imageFormats = info?.formats.filter((f) => !f.hasVideo && !f.hasAudio && f.mimeType.startsWith('image')) || [];

  const uniqueVideoFormats = Array.from(
    new Map([...videoFormats].sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0)).map((item) => [`${item.qualityLabel}-${item.container}`, item])).values()
  ).filter((f) => f.qualityLabel !== 'Audio Only' && f.qualityLabel != null);

  const uniqueImageFormats = Array.from(
    new Map([...imageFormats].map((item) => [`${item.qualityLabel}-${item.container}`, item])).values()
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 p-4 font-sans">
      <main className="max-w-md mx-auto py-8">

        <header className="flex flex-col items-center text-center space-y-4 mb-8">
          <img src="/logo_bxv_v2.png" alt="BXV Logo" className="w-28 h-28 object-contain mix-blend-screen pointer-events-none drop-shadow-2xl" />
          <div>
            <h1 onClick={() => setClicks(c => c + 1)} className="text-4xl font-black tracking-tighter text-white select-none relative cursor-pointer">
              ArgeLoad
              {clicks >= 3 && <span className="absolute -top-4 -right-10 text-3xl animate-bounce">🇦🇷</span>}
            </h1>
            <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest mt-1">Suite Media Local y en la Nube</p>
          </div>
        </header>

        <div className="flex w-full bg-neutral-900 border border-white/5 rounded-3xl p-1 mb-8">
          <button onClick={() => setTab('web')} className={`flex-1 py-3 text-sm font-black rounded-2xl transition-all ${tab === 'web' ? 'bg-sky-600 shadow-lg text-white' : 'text-neutral-500 hover:text-white'}`}>Descargar Link</button>
          <button onClick={() => setTab('local')} className={`flex-1 py-3 text-sm font-black rounded-2xl transition-all ${tab === 'local' ? 'bg-sky-600 shadow-lg text-white' : 'text-neutral-500 hover:text-white'}`}>Herramientas Locales</button>
        </div>

        {loading && (
          <div className="mb-10 animate-pulse">
            <div className="h-3 w-full bg-neutral-900 rounded-full overflow-hidden">
              <div className="h-full bg-sky-500 transition-all duration-300 shadow-[0_0_15px_rgba(56,189,248,0.5)]" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-[10px] text-center text-neutral-500 mt-3 font-black tracking-widest uppercase">
              {tab === 'web' ? 'Procesando calidad: ' : 'Comprimiendo archivo, por favor espera... '}
              {progress}%
            </p>
          </div>
        )}

        {error && <div className="p-5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-3xl text-xs font-bold text-center mb-8 animate-bounce">{error}</div>}

        {tab === 'web' && (
          <div className="animate-in fade-in slide-in-from-bottom-5 duration-700">
            <form onSubmit={handleAnalyze} className="space-y-4 mb-10">
              <div className="relative bg-neutral-900 rounded-3xl border border-white/5 shadow-2xl overflow-hidden focus-within:ring-2 ring-indigo-500/50 transition-all">
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Pega el link aquí..."
                  className="w-full bg-transparent pl-6 pr-24 py-5 text-white placeholder-neutral-600 focus:outline-none text-base"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                  {url && <button type="button" onClick={() => setUrl("")} className="p-2 text-neutral-500 hover:text-white"><X size={22} /></button>}
                  <button type="button" onClick={handlePaste} className="p-2 text-indigo-400 active:scale-90 transition-transform"><Clipboard size={22} /></button>
                </div>
              </div>
              <button
                id="analyze-btn"
                type="submit"
                disabled={loading}
                className="w-full py-5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-black rounded-3xl transition-all shadow-xl shadow-sky-600/20 active:scale-[0.98]"
              >
                {loading ? <Loader2 className="animate-spin mx-auto w-6 h-6" /> : "ANALIZAR CONTENIDO"}
              </button>
            </form>


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
                  <div className="grid gap-3">
                    <div className="bg-neutral-900 border border-white/5 p-4 rounded-3xl mb-2">
                      <h3 className="text-[11px] font-black text-neutral-600 uppercase tracking-[0.3em] px-2 mb-2">Solo Audio</h3>
                      {uniqueVideoFormats.length > 0 ? (
                        <button onClick={() => handleDownload(uniqueVideoFormats[0], true)} className="w-full flex items-center justify-center p-4 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-2xl transition-all font-black text-sm uppercase tracking-wider">
                          <Music className="w-5 h-5 mr-3" />
                          Descargar como MP3
                        </button>
                      ) : (
                        <p className="text-xs text-neutral-500 text-center font-bold">No hay audio disponible.</p>
                      )}
                    </div>

                    {uniqueVideoFormats.length > 0 && <h3 className="text-[11px] font-black text-neutral-600 uppercase tracking-[0.3em] px-2 mt-4 mb-1">Formatos de Video Original</h3>}

                    {uniqueVideoFormats.map((f, i) => (
                      <button key={i} onClick={() => handleDownload(f, false)} className="w-full flex items-center justify-between p-5 bg-neutral-900 border border-white/5 rounded-[2rem] active:scale-95 transition-all hover:bg-neutral-800/80">
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

                    {uniqueImageFormats.length > 0 && <h3 className="text-[11px] font-black text-neutral-600 uppercase tracking-[0.3em] px-2 mt-5 mb-1 text-sky-400">Colección de Imágenes</h3>}

                    <div className="grid grid-cols-2 gap-3">
                      {uniqueImageFormats.map((f, i) => (
                        <button key={`img-${i}`} onClick={() => handleDownload(f, false)} className="w-full flex flex-col items-center justify-center p-4 bg-sky-900/10 border border-sky-500/20 rounded-[1.5rem] active:scale-95 transition-all hover:bg-sky-900/40 relative overflow-hidden group">
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-all z-0"></div>
                          <ImageIcon className="w-8 h-8 text-sky-400 mb-2 z-10" />
                          <p className="text-xs font-black text-white z-10">{f.qualityLabel}</p>
                          <p className="text-[9px] text-sky-200/50 font-bold uppercase z-10">{f.container}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'local' && (
          <form onSubmit={handleLocalSubmit} className="space-y-4 mb-10 animate-in fade-in slide-in-from-bottom-5 duration-700">
            <div className="p-6 bg-neutral-900 border border-white/5 rounded-3xl space-y-5 shadow-2xl">
              <div>
                <h3 className="text-[11px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-2">1. Selecciona Archivo</h3>
                <input type="file" onChange={(e) => setLocalFile(e.target.files ? e.target.files[0] : null)} className="w-full text-sm text-neutral-400 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-sky-500/10 file:text-sky-400 focus:outline-none hover:file:bg-sky-500/20 cursor-pointer transition-all" />
              </div>

              <div>
                <h3 className="text-[11px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-2 flex justify-between">
                  <span>2. Calidad de Compresión</span>
                  <span className="text-sky-400">{quality}%</span>
                </h3>
                <input type="range" min="10" max="100" value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full accent-sky-500 h-2 bg-black/40 rounded-full appearance-none cursor-pointer" />
                <p className="text-[9px] text-neutral-600 text-center font-bold mt-1">Bajar calidad reducirá increíblemente el tamaño del archivo.</p>
              </div>

              <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                <h3 className="text-[11px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-3">3. Recortar Video (Opcional)</h3>
                <div className="flex gap-2">
                  <input type="text" placeholder="Inicio (Ej: 0:10)" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-1/2 bg-black/50 p-4 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all font-medium" />
                  <input type="text" placeholder="Fin (Ej: 1:05)" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-1/2 bg-black/50 p-4 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all font-medium" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !localFile}
                className="w-full py-5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-black rounded-2xl transition-all shadow-xl shadow-sky-600/20 active:scale-[0.98]"
              >
                {loading ? <Loader2 className="animate-spin mx-auto w-6 h-6" /> : "PROCESAR ARCHIVO LOCAL"}
              </button>
            </div>
          </form>
        )}

      </main>
    </div>
  );
}
