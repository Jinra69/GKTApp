import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.graylite.gktnlcc',
  appName: 'GKT',
  webDir: 'www',
  android: {
    allowMixedContent: true,
  },
  server: {
    cleartext: true,
    allowNavigation: [
      'project.graylite.com'
    ]
  },
  plugins: {
    SocialLogin: {                    // ← GANTI: dari GoogleAuth ke SocialLogin
      google: {
        webClientId: '652723815945-q5m6hss5p6a6s6udi8puoqu0daqklk5c.apps.googleusercontent.com',
      }
    },
  },
};

export default config;