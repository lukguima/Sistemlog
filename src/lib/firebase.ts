import { initializeApp } from 'firebase/app';
import { getAnalytics, logEvent, Analytics } from 'firebase/analytics';

const firebaseConfig = {
    apiKey: 'AIzaSyA3lCW3mFXMJptb6FnrlZOrZc2eDaj6Zgo',
    authDomain: 'sistemlog-34229.firebaseapp.com',
    projectId: 'sistemlog-34229',
    storageBucket: 'sistemlog-34229.firebasestorage.app',
    messagingSenderId: '1034063493924',
    appId: '1:1034063493924:web:f2df9ede2f34b6bdcf91b1',
    measurementId: 'G-0LV3K8KTKK',
};

let analytics: Analytics | null = null;
try {
    const app = initializeApp(firebaseConfig);
    analytics = getAnalytics(app);
} catch {
    // Analytics indisponível (ad blocker, SSR, rede) — não quebra o app
}

const safeLog = (event: string, params?: Record<string, any>) => {
    try {
        if (analytics) logEvent(analytics, event, params);
    } catch {}
};

export const trackSignUp = () => {
    safeLog('sign_up');
    try {
        if (typeof (window as any).fbq === 'function') {
            (window as any).fbq('track', 'CompleteRegistration');
        }
    } catch {}
};

export const trackLogin = () => safeLog('login');

export const trackEvent = (name: string, params?: Record<string, any>) =>
    safeLog(name, params);
