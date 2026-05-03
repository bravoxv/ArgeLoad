import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.omnidownloader.app',
  appName: 'OmniDownloader',
  webDir: 'dist', // Asegura que Capacitor use la carpeta de compilación de Vite
  server: {
    androidScheme: 'https',
    cleartext: true // Permite conexiones HTTP (necesario para el servidor local)
  }
};

export default config;
