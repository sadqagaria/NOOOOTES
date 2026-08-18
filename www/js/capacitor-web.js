// Browser-only compatibility shim. Native Android uses the bundled Capacitor entrypoint instead.
export const Capacitor = { isNativePlatform: () => false };
export const LocalNotifications = {
  async checkPermissions(){ return { display: 'denied' }; },
  async requestPermissions(){ return { display: 'denied' }; },
  async schedule(){ return {}; },
  async cancel(){ return {}; }
};
