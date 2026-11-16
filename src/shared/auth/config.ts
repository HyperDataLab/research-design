export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);
export const authMode: 'firebase' | 'dev' | 'unconfigured' = firebaseConfigured
  ? 'firebase'
  : import.meta.env.DEV && import.meta.env.MODE !== 'test'
    ? 'dev'
    : 'unconfigured';
export const workerUrl: string = import.meta.env.VITE_WORKER_URL || '/api';
/** Other lab systems (PRD D53). Empty means not configured: the screen offers the file import only. */
export const bankUrl: string = (import.meta.env.VITE_BANK_API_URL ?? '').replace(/\/$/, '');
export const paperlabUrl: string = (import.meta.env.VITE_PAPERLAB_API_URL ?? '').replace(/\/$/, '');

export const allowedDomain = 'hyperdatalab.org';
