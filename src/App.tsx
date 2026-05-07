import { Download, Film, Music, Loader2, Video, Image as ImageIcon, Clipboard as ClipboardIcon, X } from "lucide-react";
import { Clipboard as CapacitorClipboard } from '@capacitor/clipboard';
import { Capacitor } from '@capacitor/core';
import React, { useState, useEffect } from "react";

// CONFIGURACIÓN PARA ANDROID:
// 1. Abre la terminal y escribe 'ipconfig'
// 2. Busca 'IPv4 Address' (ej. 192.168.1.15)
// 3. Ponla aquí abajo:
// IMPORTANTE: Si estás probando LOCALMENTE, cambia esto a tu IP o "http://localhost:3000"
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
  thumbnail: string;
  author: string;
  platform: string;
  formats: Format[];
}

interface DownloadItem {
  id: string;
  title: string;
  url: string;
  platform: string;
  thumbnail: string;
  timestamp: number;
}

export default function App() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [clicks, setClicks] = useState(0);
  const [tab, setTab] = useState<'web' | 'history'>('web');
  const [history, setHistory] = useState<DownloadItem[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('omni_history');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const addToHistory = (title: string, downloadUrl: string, platform: string, thumb: string) => {
    const newItem: DownloadItem = {
      id: Date.now().toString(),
      title,
      url: downloadUrl,
      platform,
      thumbnail: thumb,
      timestamp: Date.now()
    };
    const newHistory = [newItem, ...history].slice(0, 50);
    setHistory(newHistory);
    localStorage.setItem('omni_history', JSON.stringify(newHistory));
  };

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

  // Removed automatic clipboard check on focus to prevent security blocks and annoying prompts
  // Now we rely on the manual paste button and manual input which trigger handleAnalyze correctly

  const resolveImageUrl = (url: string | undefined): string => {
    if (!url) return '/placeholder.png';
    if (url.startsWith('/api/proxy-image')) return `${API_BASE_URL}${url}`;
    if (url.includes('instagram.com') || url.includes('fbcdn.net')) return `${API_BASE_URL}/api/proxy-image?url=${encodeURIComponent(url)}`;
    if (url.startsWith('http')) return url;
    return `${API_BASE_URL}${url}`;
  };

  const formatBytes = (bytes: string | number | undefined) => {
    let b = typeof bytes === 'string' ? parseInt(bytes, 10) : Number(bytes);
    if (isNaN(b) || b === 0) return "Desconocido";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e?.preventDefault();
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

      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : { error: "El servidor no respondió correctamente" };
      } catch (e) {
        data = { error: "El servidor envió una respuesta inválida (no es JSON)" };
      }

      if (!response.ok) throw new Error(data.error || "Error al analizar");
      setInfo(data);
    } catch (err: any) {
      setError(err.message || "Error de conexiÃ³n");
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      let text = "";
      if (Capacitor.isNativePlatform()) {
        const result = await CapacitorClipboard.read();
        text = result.value;
      } else {
        text = await navigator.clipboard.readText();
      }

      const cleanText = text?.trim() || "";
      if (cleanText) {
        setUrl(cleanText);
        // If it looks like a URL, trigger analysis immediately after state update
        if (cleanText.startsWith('http')) {
          setLoading(true);
          // Small delay to ensure state is updated or just call it with the value
          const response = await fetch(`${API_BASE_URL}/api/info`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: cleanText }),
          });

          const text = await response.text();
          let data;
          try {
            data = text ? JSON.parse(text) : { error: "Sin respuesta del servidor" };
          } catch (e) {
            data = { error: "Respuesta no válida del servidor" };
          }

          if (!response.ok) throw new Error(data.error || "Error al analizar");
          setInfo(data);
          setLoading(false);
          setError(null);
        }
      }
    } catch (err: any) {
      console.error("Error al pegar", err);
      // Fallback: Si falla el acceso directo, al menos no rompemos la UI
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (format: Format, isMp3: boolean) => {
    if (!info) return;
    let downloadUrl = `${API_BASE_URL}/api/download?url=${encodeURIComponent(format.url)}&ext=${format.container}&proxy=true&title=${encodeURIComponent(info.title)}`;
    if (isMp3) downloadUrl += `&mp3=true`;

    addToHistory(info.title, downloadUrl, info.platform, info.thumbnail);

    // Trigger download in system browser
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.target = '_system';
    link.click();
  };

  const videoFormats = info?.formats.filter((f) => f.hasVideo) || [];
  const audioFormats = info?.formats.filter((f) => !f.hasVideo && f.hasAudio) || [];
  const imageFormats = info?.formats.filter((f) => f.mimeType.startsWith('image')) || [];

  const uniqueVideoFormats = Array.from(
    new Map([...videoFormats].sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0)).map((item) => [`${item.qualityLabel}-${item.container}`, item])).values()
  ).filter((f) => f.qualityLabel != null);

  const uniqueImageFormats = Array.from(
    new Map([...imageFormats].map((item) => [`${item.url}`, item])).values()
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

        <div className="flex w-full bg-neutral-900 border border-white/5 rounded-3xl p-1 mb-8 overflow-hidden">
          <button onClick={() => setTab('web')} className={`flex-1 py-3 text-[10px] font-black rounded-2xl transition-all ${tab === 'web' ? 'bg-sky-600 shadow-lg text-white' : 'text-neutral-500 hover:text-white'}`}>DESCARGAR</button>
          <button onClick={() => setTab('history')} className={`flex-1 py-3 text-[10px] font-black rounded-2xl transition-all ${tab === 'history' ? 'bg-sky-600 shadow-lg text-white' : 'text-neutral-500 hover:text-white'}`}>HISTORIAL</button>
        </div>

        {loading && (
          <div className="mb-10 animate-pulse">
            <div className="h-3 w-full bg-neutral-900 rounded-full overflow-hidden">
              <div className="h-full bg-sky-500 transition-all duration-300 shadow-[0_0_15px_rgba(56,189,248,0.5)]" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-[10px] text-center text-neutral-500 mt-3 font-black tracking-widest uppercase">
              Procesando... {progress}%
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
                  <button type="button" onClick={handlePaste} className="p-2 text-indigo-400 active:scale-90 transition-transform"><ClipboardIcon size={22} /></button>
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
                  <img
                    src={resolveImageUrl((info as any).proxyThumbnail || info.thumbnail)}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
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
                      <h3 className="text-[11px] font-black text-neutral-600 uppercase tracking-[0.3em] px-2 mb-2">Extracción de MP3</h3>
                      {(uniqueVideoFormats.length > 0 || audioFormats.length > 0) ? (
                        <button onClick={() => handleDownload(audioFormats[0] || uniqueVideoFormats[0], true)} className="w-full flex items-center justify-center p-4 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-2xl transition-all font-black text-sm uppercase tracking-wider">
                          <Music className="w-5 h-5 mr-3" />
                          Descargar como MP3
                        </button>
                      ) : (
                        <p className="text-xs text-neutral-500 text-center font-bold">No hay audio disponible.</p>
                      )}
                    </div>

                    {uniqueVideoFormats.length > 0 && <h3 className="text-[11px] font-black text-neutral-600 uppercase tracking-[0.3em] px-2 mt-4 mb-1 text-sky-400">Archivos de Video</h3>}

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

                    {uniqueImageFormats.length > 0 && (
                      <div className="mt-5">
                        <div className="flex justify-between items-center px-2 mb-3">
                          <h3 className="text-[11px] font-black text-neutral-600 uppercase tracking-[0.3em] text-sky-400">Colección ({uniqueImageFormats.length})</h3>
                          <button
                            onClick={() => {
                              if (window.confirm(`¿Quieres descargar las ${uniqueImageFormats.length} imágenes de la colección?`)) {
                                uniqueImageFormats.forEach((f, idx) => {
                                  setTimeout(() => handleDownload(f, false), idx * 800);
                                });
                              }
                            }}
                            className="bg-sky-600/20 hover:bg-sky-600 text-sky-400 hover:text-white px-3 py-1 rounded-lg text-[9px] font-black transition-all"
                          >
                            DESCARGAR TODO
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {uniqueImageFormats.map((f, i) => (
                            <button key={`img-${i}`} onClick={() => handleDownload(f, false)} className="w-full aspect-square bg-sky-900/10 border border-sky-500/20 rounded-[1.5rem] active:scale-95 transition-all hover:bg-sky-900/40 relative overflow-hidden group">
                              <img
                                src={resolveImageUrl((f as any).proxyUrl || f.url)}
                                className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform"
                                loading="lazy"
                              />
                              <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 text-center backdrop-blur-sm">
                                <p className="text-[10px] font-black text-white">IMAGEN {i + 1}</p>
                              </div>
                              <div className="absolute top-2 right-2 bg-sky-500 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                <Download size={14} className="text-white" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {tab === 'history' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-5 duration-700">
            <div className="flex justify-between items-center mb-4 px-2">
              <h3 className="text-[11px] font-black text-neutral-500 uppercase tracking-[0.2em]">Registro de Descargas</h3>
              <button onClick={() => { setHistory([]); localStorage.removeItem('omni_history'); }} className="text-[9px] font-black text-red-500/50 hover:text-red-400">BORRAR TODO</button>
            </div>
            {history.length === 0 ? (
              <div className="text-center py-20 bg-neutral-900/50 border border-dashed border-white/5 rounded-[2rem]">
                <Download className="mx-auto w-10 h-10 text-neutral-800 mb-4" />
                <p className="text-sm font-bold text-neutral-600">No hay descargas recientes</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <div key={item.id} className="bg-neutral-900 border border-white/5 p-3 rounded-2xl flex gap-4 items-center">
                    <img src={item.thumbnail || '/placeholder.png'} className="w-12 h-12 object-cover rounded-xl" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-white truncate">{item.title}</p>
                      <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-tighter">{item.platform} • {new Date(item.timestamp).toLocaleDateString()}</p>
                    </div>
                    <button onClick={() => window.open(item.url, '_system')} className="p-3 bg-sky-500/10 rounded-full text-sky-400 active:scale-90 transition-transform">
                      <Download size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
