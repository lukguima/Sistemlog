import { AUTH_MODE, usesCookieAuth } from './authMode';

const AUTH_BASE = (import.meta.env.VITE_AUTH_BFF_URL || '').replace(/\/+$/, '');

function authUrl(path: string) {
    return `${AUTH_BASE}${path}`;
}

export type AuthSessionPayload = {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    expires_at?: number;
    token_type?: string;
    user: {
        id: string;
        email?: string;
        role?: string;
        company_id?: string;
        permissions?: string[];
        app_metadata?: Record<string, unknown>;
    };
};

async function parseError(res: Response) {
    try {
        const j = await res.json();
        return j?.error || res.statusText || 'Erro de autenticação';
    } catch {
        return res.statusText || 'Erro de autenticação';
    }
}

export const authApi = {
    enabled: usesCookieAuth,

    async login(email: string, password: string): Promise<AuthSessionPayload> {
        const res = await fetch(authUrl('/auth/login'), {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        if (!res.ok) throw new Error(await parseError(res));
        return res.json();
    },

    async refresh(): Promise<AuthSessionPayload> {
        const res = await fetch(authUrl('/auth/refresh'), {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error(await parseError(res));
        return res.json();
    },

    async session(): Promise<AuthSessionPayload | null> {
        const res = await fetch(authUrl('/auth/session'), {
            method: 'GET',
            credentials: 'include',
        });
        if (res.status === 401) return null;
        if (!res.ok) throw new Error(await parseError(res));
        return res.json();
    },

    async logout(): Promise<void> {
        try {
            await fetch(authUrl('/auth/logout'), {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: '{}',
            });
        } catch {
            /* ignore network on logout */
        }
    },

    mode: AUTH_MODE,
};
