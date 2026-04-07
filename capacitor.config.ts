import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gktapp.mobile',
  appName: 'GKTApp',
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
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '652723815945-q5m6hss5p6a6s6udi8puoqu0daqklk5c.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;