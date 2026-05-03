import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.omnidownloader.app',
  appName: 'OmniDownloader',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
