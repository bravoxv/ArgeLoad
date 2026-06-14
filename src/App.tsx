import { ExternalLink, Film, Music, Loader2, Video, ImageIcon, ClipboardIcon, X, History, Sparkles, Globe, Smartphone, Monitor, Search, CheckCircle2 } from "lucide-react";
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

  const [view, setView] = useState<'home' | 'download'>('home');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<{ format: Format; isMp3: boolean } | null>(null);

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

  const resolveMediaUrl = (url: string | undefined): string => {
    if (!url) return '/placeholder.png';
    if (url.startsWith('/api/')) return `${API_BASE_URL}${url}`;
    if (url.includes('instagram.com') || url.includes('fbcdn.net')) return `${API_BASE_URL}/api/proxy-image?url=${encodeURIComponent(url)}`;
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
    setProgress(15);
    setStatus("Analizando enlace...");

    const statusInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev;
        if (prev >= 70) return prev + 1;
        if (prev >= 40) return prev + 2;
        return prev + 5;
      });
    }, 400);

    try {
      const response = await fetch(`${API_BASE_URL}/api/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error al analizar");

      clearInterval(statusInterval);
      setInfo(data);
      setProgress(100);
      setStatus("¡Análisis completado!");
    } catch (err: any) {
      clearInterval(statusInterval);
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

  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

  const handleDownloadClick = (format: Format, isMp3: boolean) => {
    setSelectedFormat({ format, isMp3 });
    setVideoScale('original');
    setView('download');
  };

  const generatePreviewUrl = () => {
    if (!selectedFormat || !info) return "";
    const { format } = selectedFormat;

    // Si no hay escala elegida, usamos el original
    if (videoScale === 'original') {
      return resolveMediaUrl(format.proxyUrl || format.url);
    }

    const safeTitle = (info.title).replace(/[^a-zA-Z0-9]/g, "_");
    let url = `${API_BASE_URL}/api/v2/download/${safeTitle}.mp4?url=${encodeURIComponent(format.url)}&ext=mp4&inline=true`;
    if (videoScale !== 'original') url += `&scale=${videoScale}`;
    if (currentTaskId) url += `&taskId=${currentTaskId}`;
    return url;
  };

  const executeFinalDownload = () => {
    if (!info || !selectedFormat) return;
    const { format, isMp3 } = selectedFormat;

    const safeTitle = info.title.replace(/[^a-zA-Z0-9]/g, "_") || 'video';
    const targetExt = isMp3 ? 'mp3' : format.container || 'mp4';
    const finalFilename = `${safeTitle}.${targetExt}`;

    let downloadUrl = `${API_BASE_URL}/api/v2/download/${encodeURIComponent(finalFilename)}?url=${encodeURIComponent(format.url)}&ext=${targetExt}&title=${encodeURIComponent(info.title)}&inline=true`;

    if (isMp3) {
      downloadUrl += `&mp3=true`;
    } else if (format.hasVideo && videoScale !== 'original') {
      const taskId = `task_${Date.now()}`;
      setCurrentTaskId(taskId);
      downloadUrl += `&scale=${videoScale}&taskId=${taskId}`;
    }

    addToHistory(info.title, downloadUrl, info.platform, info.thumbnail);
    // Cambiamos setIsFullscreen(true) por abrir en el navegador
    window.open(downloadUrl, '_system');
  };

  const executeDirectDownload = () => {
    if (!info || !selectedFormat) return;
    const { format, isMp3 } = selectedFormat;

    const safeTitle = info.title.replace(/[^a-zA-Z0-9]/g, "_") || 'video';
    const targetExt = isMp3 ? 'mp3' : format.container || 'mp4';
    const finalFilename = `${safeTitle}.${targetExt}`;

    let downloadUrl = `${API_BASE_URL}/api/v2/download/${encodeURIComponent(finalFilename)}?url=${encodeURIComponent(format.url)}&ext=${targetExt}&title=${encodeURIComponent(info.title)}&inline=false`;

    if (isMp3) {
      downloadUrl += `&mp3=true`;
    } else if (format.hasVideo && videoScale !== 'original') {
      downloadUrl += `&scale=${videoScale}`;
    }

    addToHistory(info.title, downloadUrl, info.platform, info.thumbnail);
    window.open(downloadUrl, '_system');
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 p-4 font-sans selection:bg-sky-500/30">
      <main className="max-w-md mx-auto py-8">
        <AnimatePresence mode="wait">
          {view === 'download' && selectedFormat ? (
            <motion.div
              key="download-view"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="space-y-6"
            >
              <button
                onClick={() => setView('home')}
                className="flex items-center gap-2 text-neutral-500 hover:text-white font-bold text-xs uppercase tracking-widest mb-4"
              >
                <X size={16} /> Volver al Inicio
              </button>

              <div className="glass-card rounded-[2.5rem] overflow-hidden p-6 text-center space-y-6">
                <div className={`mx-auto relative group bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10 transition-all duration-700 ease-in-out flex items-center justify-center ${videoScale === '9_16' ? 'w-[64%] aspect-[9/16]' : 'w-full aspect-video'}`}>
                  <div className="absolute inset-0 bg-sky-500 blur-2xl opacity-10 animate-pulse pointer-events-none" />

                  {!selectedFormat.isMp3 && (selectedFormat.format.hasVideo || selectedFormat.format.mimeType.includes('video')) ? (
                    <video
                      key={generatePreviewUrl()}
                      src={generatePreviewUrl()}
                      controls
                      autoPlay
                      muted
                      playsInline
                      className={`w-full h-full transition-all duration-700 ease-in-out ${videoScale === '16_9' ? 'object-cover' : videoScale === '9_16' ? 'object-contain' : 'object-contain'}`}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-4">
                      <img
                        src={resolveMediaUrl(info?.thumbnail)}
                        className={`w-full h-full transition-all duration-700 ease-in-out ${videoScale === '16_9' ? 'object-cover' : videoScale === '9_16' ? 'object-contain' : 'object-contain'}`}
                      />
                    </div>
                  )}
                  <div className="absolute -bottom-2 -right-2 bg-sky-600 p-2 rounded-xl z-20 shadow-lg">
                    {selectedFormat.isMp3 ? <Music size={16} /> : <Film size={16} />}
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-black text-white leading-tight mb-2 line-clamp-2">{info?.title}</h2>
                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-[0.2em]">{info?.platform} • {selectedFormat.isMp3 ? 'Audio MP3' : (selectedFormat.format.qualityLabel || 'Video')}</p>
                </div>

                <div className="bg-white/5 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Contenido Preparado</span>
                  </div>
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-tighter">
                    {formatBytes(selectedFormat.format.contentLength)}
                  </span>
                </div>

                {/* Aspect Ratio Options for Videos */}
                {!selectedFormat.isMp3 && (selectedFormat.format.hasVideo || selectedFormat.format.mimeType.includes('video')) && (
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest text-left px-2">Ajustar Relación de Aspecto (Solo Video)</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'original', label: 'Original', icon: <Film size={14} /> },
                        { id: '16_9', label: '16:9 Cine', icon: <Monitor size={14} /> },
                        { id: '9_16', label: '9:16 Reel', icon: <Smartphone size={14} /> }
                      ].map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => setVideoScale(opt.id as any)}
                          className={`py-3 px-1 rounded-2xl transition-all flex flex-col items-center gap-1 border ${videoScale === opt.id ? 'bg-sky-600 border-sky-400 text-white shadow-lg' : 'bg-white/5 border-white/5 text-neutral-500 hover:bg-white/10'}`}
                        >
                          {opt.icon}
                          <span className="text-[8px] font-black uppercase tracking-tighter">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={executeFinalDownload}
                    disabled={loadingPreview}
                    className={`w-full py-5 bg-sky-600/10 hover:bg-sky-600/20 text-sky-400 font-black rounded-3xl transition-all border border-sky-500/20 active:scale-95 flex items-center justify-center gap-3 text-xs tracking-[0.1em] ${loadingPreview ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                  >
                    {loadingPreview ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <Monitor size={16} />
                    )}
                    {loadingPreview ? 'PROCESANDO...' : 'REPRODUCIR EN NAVEGADOR'}
                  </button>

                  <button
                    onClick={executeDirectDownload}
                    disabled={loadingPreview}
                    className={`w-full py-6 bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white font-black rounded-3xl transition-all shadow-2xl shadow-emerald-600/30 active:scale-95 flex items-center justify-center gap-4 text-sm tracking-[0.2em] ${loadingPreview ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                  >
                    {loadingPreview ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <Film size={20} className={videoScale !== 'original' ? "animate-bounce" : ""} />
                    )}
                    {loadingPreview ? 'ESPERANDO PROCESAMIENTO...' : 'DESCARGAR Y GUARDAR'}
                  </button>
                </div>

                <p className="text-[9px] text-neutral-600 font-bold italic tracking-wide">
                  Tu archivo tendrá el nombre automático: <br />
                  <span className="text-neutral-400 not-italic">{(info?.title || 'video').replace(/[^a-zA-Z0-9]/g, "_")}.{selectedFormat.isMp3 ? 'mp3' : selectedFormat.format.container}</span>
                </p>
              </div>

              <div className="p-6 bg-indigo-500/5 rounded-[2rem] border border-indigo-500/10">
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3 text-center">Protección ArgeLoad</h4>
                <p className="text-[10px] text-neutral-500 text-center leading-relaxed font-medium">
                  El archivo se sirve directamente desde nuestros servidores optimizados para garantizar la máxima velocidad y seguridad en tu descarga.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="main-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Header Section */}
              <header className="flex flex-col items-center text-center space-y-4 mb-8">
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
              </header>

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
                    key="web-tab"
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
                      <div className="p-5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-3xl text-xs font-bold text-center">
                        {error}
                      </div>
                    )}

                    {info && !loading && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                      >
                        <div className="glass-card rounded-[2.5rem] overflow-hidden relative group">
                          <div className="aspect-video relative overflow-hidden bg-black">
                            {info.formats.some(f => f.hasVideo) ? (
                              <video
                                src={resolveMediaUrl(info.formats.find(f => f.hasVideo)?.proxyUrl || info.formats.find(f => f.hasVideo)?.url)}
                                muted
                                loop
                                autoPlay
                                playsInline
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <img src={resolveMediaUrl(info.thumbnail)} className="w-full h-full object-cover" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent opacity-60" />
                          </div>
                          <div className="p-6">
                            <h2 className="font-black text-lg text-white leading-tight mb-3">{info.title}</h2>
                            <div className="flex gap-2">
                              <span className="px-2 py-1 bg-sky-600 rounded-lg text-[9px] font-black uppercase text-white">{info.platform}</span>
                              <p className="text-[11px] text-neutral-400 font-bold truncate">{info.author}</p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-6">
                          {/* Botones de Descarga Side-by-Side */}
                          <div className="grid grid-cols-2 gap-4">
                            {/* MP3 Column */}
                            <div className="relative group">
                              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 blur-xl opacity-50 transition-opacity" />
                              <div className="relative bg-neutral-900 border border-white/10 p-4 rounded-[2.5rem] shadow-2xl h-full flex flex-col justify-between">
                                <div className="flex items-center gap-2 mb-3 px-1">
                                  <div className="w-8 h-8 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                                    <Music size={16} className="text-indigo-400" />
                                  </div>
                                  <h3 className="text-[9px] font-black text-white uppercase tracking-widest">Audio</h3>
                                </div>
                                <button
                                  onClick={() => handleDownloadClick(info.formats[0], true)}
                                  className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl transition-all font-black text-[10px] uppercase flex flex-col items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95"
                                >
                                  <Music size={18} />
                                  <span>PREVISUALIZAR MP3</span>
                                </button>
                              </div>
                            </div>

                            {/* Video Column */}
                            <div className="relative group">
                              <div className="absolute inset-0 bg-gradient-to-r from-sky-600/20 to-indigo-600/20 blur-xl opacity-50 transition-opacity" />
                              <div className="relative bg-neutral-900 border border-white/10 p-4 rounded-[2.5rem] shadow-2xl h-full flex flex-col justify-between">
                                <div className="flex items-center gap-2 mb-3 px-1">
                                  <div className="w-8 h-8 bg-sky-500/10 rounded-xl flex items-center justify-center">
                                    <Video size={16} className="text-sky-400" />
                                  </div>
                                  <h3 className="text-[9px] font-black text-white uppercase tracking-widest">Video</h3>
                                </div>
                                <button
                                  onClick={() => handleDownloadClick(info.formats.find(f => f.hasVideo) || info.formats[0], false)}
                                  className="w-full py-4 bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-2xl transition-all font-black text-[10px] uppercase flex flex-col items-center justify-center gap-2 shadow-lg shadow-sky-600/20 active:scale-95"
                                >
                                  <Video size={18} />
                                  <span>PREVISUALIZAR MP4</span>
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Seccion de Calidades Detalladas (opcional) */}
                          {info.formats.filter(f => f.hasVideo).length > 1 && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between px-4">
                                <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Otras Calidades</h3>
                                <div className="h-px flex-1 bg-white/5 mx-4" />
                              </div>
                              <div className="grid gap-2">
                                {info.formats.filter(f => f.hasVideo).slice(1).map((f, i) => (
                                  <button
                                    key={i}
                                    onClick={() => handleDownloadClick(f, false)}
                                    className="group w-full flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-[2rem] hover:bg-white/10 active:bg-sky-600/20 transition-all border-l-4 border-l-transparent hover:border-l-sky-500"
                                  >
                                    <div className="flex items-center gap-4">
                                      <div className="w-10 h-10 bg-sky-500/10 rounded-2xl flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
                                        <Film size={20} />
                                      </div>
                                      <div className="text-left">
                                        <p className="text-xs font-black text-white group-hover:text-sky-400 transition-colors uppercase tracking-tight">{f.qualityLabel}</p>
                                        <p className="text-[9px] text-neutral-500 font-bold uppercase">{f.container}{formatBytes(f.contentLength)}</p>
                                      </div>
                                    </div>
                                    <div className="p-2 bg-white/5 rounded-xl text-neutral-500 group-hover:text-white group-hover:bg-sky-500 transition-all">
                                      <ExternalLink size={18} />
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {info.formats.filter(f => f.mimeType.startsWith('image')).length > 0 && (
                            <div className="space-y-3">
                              <h3 className="text-[10px] font-black text-neutral-600 uppercase tracking-widest px-2">IMÁGENES</h3>
                              <div className="grid grid-cols-2 gap-3">
                                {info.formats.filter(f => f.mimeType.startsWith('image')).map((f, i) => (
                                  <button key={i} onClick={() => handleDownloadClick(f, false)} className="aspect-square bg-neutral-900 rounded-3xl border border-white/5 overflow-hidden group">
                                    <img src={resolveMediaUrl(f.proxyUrl || f.url)} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {!info && !loading && (
                      <div className="pt-4 grid grid-cols-4 gap-4">
                        {SUPPORTED_PLATFORMS.slice(0, 8).map((p, i) => (
                          <div key={i} className="flex flex-col items-center gap-2 opacity-40">
                            <div className={`w-10 h-10 ${p.color} rounded-2xl flex items-center justify-center text-white`}>
                              <Globe size={18} />
                            </div>
                            <span className="text-[8px] font-black text-neutral-500 uppercase">{p.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="history-tab"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-4"
                  >
                    <div className="flex justify-between items-center px-2">
                      <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">REGISTRO LOCAL</h3>
                      <button onClick={() => { setHistory([]); localStorage.removeItem('omni_history'); }} className="text-[9px] font-black text-red-500/50">BORRAR TODO</button>
                    </div>
                    {history.length === 0 ? (
                      <div className="py-20 flex flex-col items-center opacity-20">
                        <History size={48} />
                        <p className="text-xs font-bold mt-4">Historial vacío</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {history.map(item => (
                          <div key={item.id} className="bg-neutral-900/80 border border-white/5 p-3 rounded-2xl flex gap-4 items-center">
                            <img src={resolveMediaUrl(item.thumbnail)} className="w-12 h-12 object-cover rounded-xl" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-black text-white truncate">{item.title}</p>
                              <p className="text-[9px] text-neutral-500 font-bold uppercase">{item.platform}</p>
                            </div>
                            <button onClick={() => window.open(item.url, '_system')} className="p-3 bg-sky-500/10 text-sky-400 rounded-xl">
                              <ExternalLink size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="mt-12 text-center text-[9px] font-bold text-neutral-600 uppercase tracking-widest space-y-2">
          <p>© 2026 ArgeLoad Media Suite</p>
          <div className="flex justify-center gap-4 text-neutral-800">
            <span>v3.6.0-stable</span>
            <span>•</span>
            <span>Gold Edition</span>
          </div>
        </footer>
      </main>

      {/* Fullscreen Player Overlay eliminado para usar el navegador del sistema */}
    </div>
  );
}

