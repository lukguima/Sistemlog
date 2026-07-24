export type AuthMode = 'legacy' | 'dual' | 'cookie';

/** Default cookie = refresh em HttpOnly via BFF. Use VITE_AUTH_MODE=legacy para rollback. */
export const AUTH_MODE: AuthMode = (() => {
    const raw = String(import.meta.env.VITE_AUTH_MODE || 'cookie').toLowerCase();
    if (raw === 'legacy' || raw === 'dual') return raw;
    return 'cookie';
})();

export const usesCookieAuth = AUTH_MODE === 'dual' || AUTH_MODE === 'cookie';
