import { Download, Film, Music, Loader2, Video, ImageIcon, ClipboardIcon, X, History, Sparkles, Globe, Smartphone, Search, CheckCircle2 } from "lucide-react";
import { Clipboard as CapacitorClipboard } from '@capacitor/clipboard';
import { Capacitor } from '@capacitor/core';
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// CONFIGURACIÓN PARA ANDROID:
const API_BASE_URL = "https://omnidown-backend.onrender.com";

interface Format {
  itag: number;
  mimeType: string;
  qualityLabel: string;
  bitrate?: number;
  hasVideo: boolean;
  hasAudio: boolean;
  container: string;
  url: string;
  proxyUrl?: string;
  contentLength?: string;
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

const SUPPORTED_PLATFORMS = [
  { name: 'YouTube', icon: 'youtube', color: 'bg-red-500' },
  { name: 'TikTok', icon: 'tiktok', color: 'bg-neutral-800' },
  { name: 'Instagram', icon: 'instagram', color: 'bg-pink-500' },
  { name: 'Facebook', icon: 'facebook', color: 'bg-blue-600' },
  { name: 'Twitter/X', icon: 'twitter', color: 'bg-sky-500' },
  { name: 'Reddit', icon: 'reddit', color: 'bg-orange-600' },
  { name: 'LinkedIn', icon: 'linkedin', color: 'bg-blue-700' },
  { name: 'SoundCloud', icon: 'soundcloud', color: 'bg-orange-500' },
  { name: 'Pinterest', icon: 'pinterest', color: 'bg-red-600' },
  { name: 'Snapchat', icon: 'snapchat', color: 'bg-yellow-400' },
  { name: 'Threads', icon: 'threads', color: 'bg-neutral-900' },
  { name: 'Direct', icon: 'globe', color: 'bg-emerald-500' }
];

export default function App() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Listo para analizar");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [tab, setTab] = useState<'web' | 'history'>('web');
  const [history, setHistory] = useState<DownloadItem[]>([]);
  const [videoScale, setVideoScale] = useState<'original' | '16_9' | '9_16'>('original');

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

  const resolveImageUrl = (url: string | undefined): string => {
    if (!url) return '/placeholder.png';
    if (url.startsWith('/api/proxy-image')) return `${API_BASE_URL}${url}`;
    if (url.includes('instagram.com') || url.includes('fbcdn.net') || url.includes('twimg.com')) return `${API_BASE_URL}/api/proxy-image?url=${encodeURIComponent(url)}`;
    if (url.startsWith('http')) return url;
    return `${API_BASE_URL}${url}`;
  };

  const formatBytes = (bytes: string | number | undefined) => {
    let b = typeof bytes === 'string' ? parseInt(bytes, 10) : Number(bytes);
    if (isNaN(b) || !b) return "";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return " • " + parseFloat((b / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleAnalyze = async (e?: React.FormEvent, customUrl?: string) => {
    e?.preventDefault();
    const targetUrl = customUrl || url;
    if (!targetUrl) return;

    setLoading(true);
    setError(null);
    setInfo(null);
    setProgress(10);
    setStatus("Inicializando motor...");

    try {
      setTimeout(() => { setStatus("Contactando plataforma..."); setProgress(40); }, 800);
      setTimeout(() => { setStatus("Extrayendo medios..."); setProgress(70); }, 1500);

      const response = await fetch(`${API_BASE_URL}/api/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error al analizar");

      setInfo(data);
      setProgress(100);
      setStatus("¡Análisis completado!");
    } catch (err: any) {
      setError(err.message || "Error de conexión");
      setStatus("Error en el análisis");
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

      if (text?.trim()) {
        setUrl(text.trim());
        if (text.trim().startsWith('http')) {
          handleAnalyze(undefined, text.trim());
        }
      }
    } catch (err) {
      console.error("Paste fail", err);
    }
  };

  const handleDownload = (format: Format, isMp3: boolean) => {
    if (!info) return;

    const safeTitle = info.title.replace(/[^a-zA-Z0-9]/g, "_") || 'video';
    const targetExt = isMp3 ? 'mp3' : format.container || 'mp4';
    const finalFilename = `${safeTitle}.${targetExt}`;

    let downloadUrl = `${API_BASE_URL}/api/download/${encodeURIComponent(finalFilename)}?url=${encodeURIComponent(format.url)}&ext=${targetExt}&title=${encodeURIComponent(info.title)}`;
    if (isMp3) downloadUrl += `&mp3=true`;
    else if (format.hasVideo && videoScale !== 'original') downloadUrl += `&scale=${videoScale}`;

    addToHistory(info.title, downloadUrl, info.platform, info.thumbnail);
    window.open(downloadUrl, '_system');
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 p-4 font-sans selection:bg-sky-500/30">
      <main className="max-w-md mx-auto py-8">

        {/* Header Section */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center text-center space-y-4 mb-8"
        >
          <div className="relative group">
            <div className="absolute inset-0 bg-sky-500 blur-3xl opacity-20 group-hover:opacity-40 transition-opacity" />
            <img
              src="/logo_bxv_v2.png"
              alt="ArgeLoad"
              className="w-24 h-24 object-contain relative z-10 animate-float pointer-events-none drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]"
            />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-white text-glow mb-1">
              ArgeLoad
            </h1>
            <div className="flex items-center justify-center gap-2 text-neutral-500 font-bold uppercase tracking-[0.2em] text-[10px]">
              <Sparkles size={12} className="text-sky-400" />
              <span>Omnidownloader v3.5</span>
            </div>
          </div>
        </motion.header>

        {/* Tabs */}
        <div className="flex w-full bg-neutral-900/50 backdrop-blur-md border border-white/5 rounded-3xl p-1.5 mb-8">
          <button
            onClick={() => setTab('web')}
            className={`flex-1 py-3 text-[10px] items-center justify-center gap-2 flex font-black rounded-[1.25rem] transition-all ${tab === 'web' ? 'bg-sky-600 shadow-lg shadow-sky-600/20 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            <Globe size={14} /> EXPLORAR
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex-1 py-3 text-[10px] items-center justify-center gap-2 flex font-black rounded-[1.25rem] transition-all ${tab === 'history' ? 'bg-indigo-600 shadow-lg shadow-indigo-600/20 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            <History size={14} /> HISTORIAL
          </button>
        </div>

        <AnimatePresence mode="wait">
          {tab === 'web' ? (
            <motion.div
              key="web"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              {/* Input Form */}
              <form onSubmit={handleAnalyze} className="space-y-3">
                <div className="relative group">
                  <div className="absolute inset-0 bg-indigo-500/5 blur-xl group-focus-within:bg-indigo-500/10 transition-all rounded-3xl" />
                  <input
                    type="url"
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Pega el link aquí..."
                    className="w-full bg-neutral-900 border border-white/5 rounded-3xl pl-6 pr-24 py-5 text-white placeholder-neutral-600 focus:outline-none focus:ring-2 ring-sky-500/40 transition-all relative z-10 text-sm font-medium"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1 z-20">
                    {url && <button type="button" onClick={() => setUrl("")} className="p-2 text-neutral-500 hover:text-white"><X size={20} /></button>}
                    <button type="button" onClick={handlePaste} className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-2xl hover:bg-indigo-500/20 active:scale-90 transition-all">
                      <ClipboardIcon size={20} />
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading || !url}
                  className="w-full py-5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 disabled:opacity-30 text-white font-black rounded-3xl transition-all shadow-xl shadow-sky-600/10 active:scale-[0.98] flex items-center justify-center gap-3 text-sm tracking-wider"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : <><Search size={20} /> ANALIZAR CONTENIDO</>}
                </button>
              </form>

              {/* Progress & Status */}
              <AnimatePresence>
                {loading && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-neutral-900/50 border border-white/5 p-4 rounded-3xl">
                      <div className="h-2 w-full bg-neutral-800 rounded-full overflow-hidden mb-3">
                        <motion.div
                          className="h-full bg-sky-500 shadow-[0_0_10px_rgba(56,189,248,0.5)]"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-center text-sky-400 font-black tracking-widest uppercase">
                        {status} • {progress}%
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-3xl text-xs font-bold text-center"
                >
                  {error}
                </motion.div>
              )}

              {/* Analysis Result */}
              {info && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Media Preview Card */}
                  <div className="glass-card rounded-[2.5rem] overflow-hidden relative group">
                    <div className="aspect-video relative overflow-hidden">
                      <img
                        src={resolveImageUrl(info.thumbnail)}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent opacity-60" />
                    </div>
                    <div className="p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase text-white shadow-lg ${SUPPORTED_PLATFORMS.find(p => p.name.toLowerCase().includes(info.platform))?.color || 'bg-indigo-600'}`}>
                          {info.platform}
                        </span>
                        <p className="text-[11px] text-neutral-400 font-bold truncate">{info.author}</p>
                      </div>
                      <h2 className="font-black text-lg text-white leading-tight">{info.title}</h2>
                    </div>
                  </div>

                  {/* Options */}
                  <div className="grid gap-3">
                    {/* Audio Extract */}
                    <div className="bg-neutral-900 border border-white/5 p-4 rounded-3xl">
                      <h3 className="text-[10px] font-black text-neutral-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Music size={12} className="text-indigo-400" /> EXTRAER SONIDO
                      </h3>
                      <button
                        onClick={() => handleDownload(info.formats[0], true)}
                        className="w-full flex items-center justify-between p-4 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-2xl transition-all font-black text-xs uppercase"
                      >
                        Descargar MP3 <Download size={16} />
                      </button>
                    </div>

                    {/* Quality Formats */}
                    <div className="space-y-2">
                      <h3 className="text-[10px] font-black text-neutral-600 uppercase tracking-widest px-2 flex items-center gap-2">
                        <Video size={12} className="text-sky-400" /> CALIDADES DISPONIBLES
                      </h3>

                      {info.formats.filter(f => f.hasVideo).map((f, i) => (
                        <button
                          key={i}
                          onClick={() => handleDownload(f, false)}
                          className="w-full flex items-center justify-between p-4 bg-neutral-900/50 border border-white/5 rounded-3xl hover:bg-neutral-800/80 hover:border-white/10 active:scale-95 transition-all group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-sky-500/10 rounded-xl flex items-center justify-center text-sky-400 group-hover:bg-sky-500 group-hover:text-white transition-colors">
                              <Film size={20} />
                            </div>
                            <div className="text-left">
                              <p className="text-xs font-black text-white">{f.qualityLabel}</p>
                              <p className="text-[9px] text-neutral-500 font-bold uppercase">{f.container}{formatBytes(f.contentLength)}</p>
                            </div>
                          </div>
                          <Download size={18} className="text-neutral-600 group-hover:text-white transition-colors" />
                        </button>
                      ))}
                    </div>

                    {/* Images if available */}
                    {info.formats.filter(f => f.mimeType.startsWith('image')).length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-[10px] font-black text-neutral-600 uppercase tracking-widest px-2 flex items-center gap-2">
                          <ImageIcon size={12} className="text-pink-400" /> GALERÍA IMÁGENES
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                          {info.formats.filter(f => f.mimeType.startsWith('image')).map((f, i) => (
                            <button
                              key={i}
                              onClick={() => handleDownload(f, false)}
                              className="aspect-square bg-neutral-900 rounded-3xl border border-white/5 overflow-hidden relative group active:scale-95 transition-transform"
                            >
                              <img src={resolveImageUrl(f.proxyUrl || f.url)} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Download className="text-white" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Supported Platforms Grid */}
              {!info && !loading && (
                <div className="pt-4">
                  <h3 className="text-[9px] font-black text-neutral-700 uppercase tracking-[0.3em] text-center mb-6">
                    OPTIMIZADO PARA 30+ PLATAFORMAS
                  </h3>
                  <div className="grid grid-cols-4 gap-4">
                    {SUPPORTED_PLATFORMS.slice(0, 8).map((p, i) => (
                      <div key={i} className="flex flex-col items-center gap-2 opacity-40 hover:opacity-100 transition-opacity cursor-default">
                        <div className={`w-10 h-10 ${p.color} rounded-2xl flex items-center justify-center text-white shadow-lg`}>
                          <Globe size={18} />
                        </div>
                        <span className="text-[8px] font-black text-neutral-500 uppercase">{p.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center px-2">
                <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">REGISTRO LOCAL</h3>
                {history.length > 0 && (
                  <button onClick={() => { setHistory([]); localStorage.removeItem('omni_history'); }} className="text-[9px] font-black text-red-500/50 hover:text-red-400">BORRAR TODO</button>
                )}
              </div>

              {history.length === 0 ? (
                <div className="py-20 bg-neutral-900/30 border border-dashed border-white/5 rounded-[2.5rem] flex flex-col items-center">
                  <History className="text-neutral-800 mb-4" size={48} />
                  <p className="text-xs font-bold text-neutral-600">No hay descargas recientes</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <motion.div
                      layout
                      key={item.id}
                      className="bg-neutral-900/80 border border-white/5 p-3 rounded-3xl flex gap-4 items-center"
                    >
                      <img src={resolveImageUrl(item.thumbnail)} className="w-14 h-14 object-cover rounded-2xl border border-white/5 shadow-lg" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-white truncate">{item.title}</p>
                        <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-tighter">
                          {item.platform} • {new Date(item.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => window.open(item.url, '_system')}
                        className="p-3.5 bg-sky-500/10 text-sky-400 rounded-[1.25rem] hover:bg-sky-500 hover:text-white transition-all shadow-lg"
                      >
                        <Download size={18} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <footer className="mt-12 text-center text-[9px] font-bold text-neutral-600 uppercase tracking-widest space-y-2">
          <p>© 2026 ArgeLoad Media Suite</p>
          <div className="flex justify-center gap-4 text-neutral-800">
            <span>v3.5.0-stable</span>
            <span>•</span>
            <span>Powered by Gemini 3.5</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

