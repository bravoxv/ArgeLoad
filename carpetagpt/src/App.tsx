import { Download, Film, Music, Loader2, Video, Image as ImageIcon, Clipboard, X, Link as LinkIcon, ShieldCheck } from "lucide-react";
import React, { useMemo, useState, useEffect } from "react";

interface Format {
  itag: number;
  mimeType: string;
  qualityLabel: string;
  bitrate?: number;
  audioBitrate?: number;
  hasVideo: boolean;
  hasAudio: boolean;
  contentLength?: string;
  container: string;
  url: string;
}

interface VideoInfo {
  title: string;
  description?: string;
  thumbnail: string;
  author: string;
  duration?: string;
  platform: string;
  formats: Format[];
}

const SUPPORTED_PLATFORMS = ["YouTube", "TikTok", "Instagram", "X/Twitter", "Facebook", "Pinterest", "Twitch", "Kick"];

export default function App() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [convertToMp3, setConvertToMp3] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (loading) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress((prev) => {
          // Slow down progress as it approaches 90%
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

    if (isNaN(b) || b === 0) {
      return "Desconocido"; 
    }
    
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDuration = (duration?: string) => {
    const seconds = Number(duration);
    if (!duration || duration === "Unknown" || Number.isNaN(seconds)) return "HD";

    return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
  };

  const formatQuality = (qualityLabel?: string) => {
    if (!qualityLabel) return "HD";
    const match = qualityLabel.match(/(\d{3,4})p?/i);
    return match ? match[1] : qualityLabel;
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    if (!/^https?:\/\/\S+\.\S+/i.test(trimmedUrl)) {
      setError("Pega una URL valida que comience con http:// o https://.");
      return;
    }

    setLoading(true);
    setError(null);
    setInfo(null);
    setUrl(trimmedUrl);

    try {
      const response = await fetch("/api/info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: trimmedUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze link");
      }

      setInfo(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text.trim());
    } catch (err) {
      console.error("Failed to read clipboard:", err);
      alert("No se pudo acceder al portapapeles automaticamente. Usa Ctrl+V en PC o pega manualmente en movil.");
    }
  };

  const handleClear = () => {
    setUrl("");
    setInfo(null);
    setError(null);
  };

  const handleDownload = async (format: Format) => {
    if (!info) return;

    // Always act as a backend proxy to ensure headers (referer/origin) for sites like Twitter/X are handled correctly.
    const downloadUrl = `/api/download?url=${encodeURIComponent(format.url)}&ext=${format.container}&proxy=true&title=${encodeURIComponent(info.title)}${convertToMp3 ? '&mp3=true' : ''}`;
    window.open(downloadUrl, '_blank');
  };

  const { uniqueVideoFormats, uniqueAudioFormats, uniqueImageFormats } = useMemo(() => {
    const videoFormats = info?.formats.filter((f) => f.hasVideo && f.hasAudio) || [];
    const videoOnlyFormats = info?.formats.filter((f) => f.hasVideo && !f.hasAudio) || [];
    const audioFormats = info?.formats.filter((f) => !f.hasVideo && f.hasAudio) || [];
    const imageFormats = info?.formats.filter((f) => !f.hasVideo && !f.hasAudio && f.mimeType?.startsWith('image/')) || [];

    return {
      uniqueVideoFormats: Array.from(
        new Map(
          [...videoFormats, ...videoOnlyFormats]
            .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
            .map((item) => [`${item.qualityLabel}-${item.container}`, item])
        ).values()
      ).filter((f) => f.qualityLabel !== 'Audio Only' && f.qualityLabel != null),
      uniqueAudioFormats: Array.from(
        new Map(
          audioFormats
            .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))
            .map((item) => [`${item.audioBitrate}-${item.container}`, item])
        ).values()
      ),
      uniqueImageFormats: Array.from(
        new Map(
          imageFormats.map((item) => [item.container, item])
        ).values()
      ),
    };
  }, [info]);


  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 selection:bg-emerald-500/30">
      

      <main className="max-w-5xl mx-auto px-6 py-10 md:py-14">
        
        {/* Header Section */}
        <div className="w-full min-h-20 bg-neutral-900 border border-neutral-800 rounded-lg flex items-center justify-center text-neutral-500 font-mono text-sm mb-10">
            Espacio publicitario
        </div>
        <header className="flex flex-col items-center justify-center text-center space-y-4 mb-10">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 rounded-lg mb-2 border border-emerald-500/20">
            <Download className="w-8 h-8 text-emerald-300" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-br from-white to-neutral-300 bg-clip-text text-transparent">
            OmniDownloader
          </h1>
          <p className="text-neutral-400 max-w-xl text-lg">
            Descarga y comprime videos y audios en alta calidad al instante. Optimizado para YouTube y otras redes.
          </p>
          <div className="flex flex-wrap justify-center gap-2 max-w-3xl">
            {SUPPORTED_PLATFORMS.map((platform) => (
              <span key={platform} className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-neutral-300">
                {platform}
              </span>
            ))}
          </div>
        </header>

        {/* Search Input */}
        <div className="w-full max-w-2xl mx-auto mb-12 relative">
          <form onSubmit={handleAnalyze} className="relative flex flex-col sm:flex-row items-center shadow-xl shadow-black/50 rounded-lg ring-1 ring-white/10 overflow-hidden focus-within:ring-emerald-500/50 focus-within:ring-2 transition-all bg-neutral-900">
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Pega el enlace aqui (YouTube, Instagram, TikTok...)"
              className="w-full bg-transparent border-none px-6 py-5 text-lg text-white placeholder-neutral-500 focus:outline-none"
            />
            {url && (
              <button
                type="button"
                onClick={handleClear}
                className="p-3 text-neutral-400 hover:text-red-400 transition-colors"
                title="Limpiar enlace"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={handlePaste}
              className="p-3 text-neutral-400 hover:text-emerald-300 transition-colors"
              title="Pegar enlace"
            >
              <Clipboard className="w-5 h-5" />
            </button>
            <div className="w-full sm:w-auto p-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-8 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Analizar"}
              </button>
            </div>
          </form>

          {loading && (
            <div className="absolute -bottom-6 w-full animate-in fade-in duration-300">
              <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-300 ease-out" 
                  style={{ width: `${progress}%` }} 
                />
              </div>
              <p className="text-xs text-center text-neutral-400 mt-2 font-mono">
                Analizando contenido... {progress}%
              </p>
            </div>
          )}

          {error && (
            <div className="mt-8 p-4 bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg text-sm text-center">
              {error}
            </div>
          )}
        </div>

        {!info && !loading && (
          <div className="grid gap-3 sm:grid-cols-2 mb-12">
            <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-neutral-900/60 p-4">
              <LinkIcon className="mt-0.5 h-5 w-5 text-emerald-300" />
              <div>
                <p className="text-sm font-medium text-white">Enlaces limpios</p>
                <p className="text-sm text-neutral-400">Valida la URL antes de enviarla al servidor.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-neutral-900/60 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-cyan-300" />
              <div>
                <p className="text-sm font-medium text-white">Descarga con proxy</p>
                <p className="text-sm text-neutral-400">Mejor manejo de cabeceras para redes que bloquean descargas directas.</p>
              </div>
            </div>
          </div>
        )}

        <div className="w-full min-h-20 bg-neutral-900 border border-neutral-800 rounded-lg flex items-center justify-center text-neutral-500 font-mono text-sm mb-12">
            Espacio publicitario
        </div>

        {/* Results Section */}
        {info && !loading && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Thumbnail and Info */}
            <div className="lg:col-span-5 space-y-6">
              <div className="rounded-lg overflow-hidden ring-1 ring-white/10 shadow-2xl relative aspect-video bg-neutral-900 object-cover">
                {info.thumbnail ? (
                  <img src={info.thumbnail} alt={info.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-neutral-500">
                    <Video className="h-10 w-10" />
                  </div>
                )}
                <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-md px-2 py-1 rounded-md text-xs font-mono">
                  {formatDuration(info.duration)}
                </div>
              </div>
              <div>
                <h2 className="text-xl font-semibold leading-tight mb-2 text-white line-clamp-2">{info.title}</h2>
                <div className="flex items-center gap-2 text-sm text-neutral-400">
                  <span className="font-medium text-neutral-300">{info.author}</span>
                  <span>-</span>
                  <span className="capitalize">{info.platform}</span>
                </div>
              </div>

              {/* Compression Toggle */}
              <div className="flex items-center gap-3 p-4 bg-neutral-900/50 border border-white/5 rounded-lg">
                  <input
                    type="checkbox"
                    id="convertToMp3"
                    checked={convertToMp3}
                    onChange={(e) => setConvertToMp3(e.target.checked)}
                    className="h-5 w-5 rounded border-neutral-700 bg-neutral-800 text-emerald-600 focus:ring-emerald-500 checked:bg-emerald-600"
                  />
                  <label htmlFor="convertToMp3" className="text-sm font-medium text-neutral-300">
                    Convertir a MP3
                  </label>
              </div>
            </div>

            {/* Downloads List */}
            <div className="lg:col-span-7 space-y-8">
              
              {/* Video Downloads */}
              {uniqueVideoFormats.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                    <Film className="w-4 h-4" /> Formatos de Video
                  </h3>
                  <div className="grid gap-3">
                    {uniqueVideoFormats.map((format, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-neutral-900/50 border border-white/5 hover:bg-neutral-900 rounded-lg transition-all gap-4 sm:gap-2">
                        <div className="flex items-center gap-4">
                          <span className="text-lg font-bold text-white w-14 text-center">
                            {formatQuality(format.qualityLabel)}{/\d/.test(formatQuality(format.qualityLabel)) && <span className="text-xs text-neutral-500">p</span>}
                          </span>
                          <div className="flex flex-col">
                            <span className="text-sm text-neutral-300 uppercase font-medium">Video {format.container}</span>
                            <span className="text-xs text-neutral-500 font-mono flex items-center gap-1.5">
                              {formatBytes(format.contentLength || format.bitrate)} 
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleDownload(format)}
                          className="w-full sm:w-auto px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors ring-1 ring-white/10"
                        >
                          Descargar <Download className="w-4 h-4 text-neutral-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Audio Downloads */}
              {uniqueAudioFormats.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                    <Music className="w-4 h-4" /> Formatos de Audio
                  </h3>
                  <div className="grid gap-3">
                    {uniqueAudioFormats.map((format, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-neutral-900/50 border border-white/5 hover:bg-neutral-900 rounded-lg transition-all gap-4 sm:gap-2">
                        <div className="flex items-center gap-4">
                          <span className="text-lg font-bold text-white w-14 text-center">
                            {format.audioBitrate || 128}<span className="text-xs text-neutral-500">k</span>
                          </span>
                          <div className="flex flex-col">
                            <span className="text-sm text-neutral-300 uppercase font-medium">Audio {format.container || 'mp3'}</span>
                            <span className="text-xs text-neutral-500 font-mono">
                              {formatBytes(format.contentLength || format.audioBitrate)}
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleDownload(format)}
                          className="w-full sm:w-auto px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors ring-1 ring-white/10"
                        >
                          Descargar <Download className="w-4 h-4 text-neutral-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Image Downloads */}
              {uniqueImageFormats.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" /> Formatos de Imagen
                  </h3>
                  <div className="grid gap-3">
                    {uniqueImageFormats.map((format, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-neutral-900/50 border border-white/5 hover:bg-neutral-900 rounded-lg transition-all gap-4 sm:gap-2">
                        <div className="flex items-center gap-4">
                          <span className="text-lg font-bold text-white w-14 text-center">
                            {format.qualityLabel || 'Img'}<span className="text-xs text-neutral-500">.</span>
                          </span>
                          <div className="flex flex-col">
                            <span className="text-sm text-neutral-300 uppercase font-medium">Imagen {format.container || 'jpg'}</span>
                            <span className="text-xs text-neutral-500 font-mono">
                              {formatBytes(format.contentLength)}
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleDownload(format)}
                          className="w-full sm:w-auto px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors ring-1 ring-white/10"
                        >
                          Descargar <Download className="w-4 h-4 text-neutral-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
        
        <div className="w-full min-h-20 bg-neutral-900 border border-neutral-800 rounded-lg flex items-center justify-center text-neutral-500 font-mono text-sm mt-12">
            Espacio publicitario
        </div>
      </main>
    </div>
  );
}
