import { initializeApp } from 'firebase/app';
import { getAnalytics, logEvent } from 'firebase/analytics';

const firebaseConfig = {
    apiKey: 'AIzaSyA3lCW3mFXMJptb6FnrlZOrZc2eDaj6Zgo',
    authDomain: 'sistemlog-34229.firebaseapp.com',
    projectId: 'sistemlog-34229',
    storageBucket: 'sistemlog-34229.firebasestorage.app',
    messagingSenderId: '1034063493924',
    appId: '1:1034063493924:web:f2df9ede2f34b6bdcf91b1',
    measurementId: 'G-0LV3K8KTKK',
};

const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);

// Evento: usuário completou o cadastro (Firebase + Meta Pixel)
export const trackSignUp = () => {
    logEvent(analytics, 'sign_up');
    if (typeof (window as any).fbq === 'function') {
        (window as any).fbq('track', 'CompleteRegistration');
    }
};

// Evento: usuário fez login
export const trackLogin = () => logEvent(analytics, 'login');

// Evento genérico para anúncios
export const trackEvent = (name: string, params?: Record<string, any>) =>
    logEvent(analytics, name, params);
