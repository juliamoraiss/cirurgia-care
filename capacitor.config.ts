import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lovable.medsystem',
  appName: 'medsystem',
  webDir: 'dist',
  server: {
    url: 'https://4acdf001-5ce9-4858-b746-f16af6b614e1.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};

export default config;
