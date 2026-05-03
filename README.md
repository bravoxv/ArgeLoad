<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# OmniDownloader - Multi-platform Downloader

Esta aplicación permite descargar videos y audios de múltiples plataformas como YouTube, TikTok, Instagram, Twitter/X, Facebook y más.

## 🚀 Versión Web (Local)

**Requisitos:** Node.js instalado.

1. Instalar dependencias:
   `npm install`
2. Iniciar el servidor y la web:
   `npm run dev`

## 📱 Versión Android (APK)

He automatizado todo el proceso para que puedas generar tu propia App nativa.

### Guía rápida:
1. Asegúrate de tener **Android Studio** instalado.
2. Ejecuta el archivo **`CONSTRUIR_ANDROID.bat`** haciendo doble clic.
3. El script configurará todo automáticamente y abrirá Android Studio.
4. En Android Studio, ve al menú superior: **Build > Build APK(s)**.

### Notas importantes para Android:
- **Backend:** La aplicación móvil necesita conectarse a tu servidor. En `src/App.tsx`, cambia la dirección IP por la de tu PC para que el móvil pueda descargar los archivos.
- **FFmpeg:** El procesamiento de video (como la conversión a MP3) se realiza en el servidor para ahorrar batería y recursos en el teléfono.

---

View your app in AI Studio: https://ai.studio/apps/9fd52492-cdb3-4ef0-bbb8-f05037a80485
