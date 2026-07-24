/**
 * Auth BFF — cookies HttpOnly para refresh token.
 * Front em modo cookie usa este BFF para login/refresh/session/logout.
 */
import { createServer } from 'node:http';
import { createClient } from '@supabase/supabase-js';

const PORT = Number(process.env.AUTH_BFF_PORT || process.env.PORT || 8787);
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const APP_ORIGIN = process.env.APP_ORIGIN || '*';
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'sl_refresh';
const COOKIE_SECURE = String(process.env.AUTH_COOKIE_SECURE || 'true').toLowerCase() !== 'false';
const COOKIE_SAMESITE = process.env.AUTH_COOKIE_SAMESITE || 'Lax';
const COOKIE_MAX_AGE = Number(process.env.AUTH_COOKIE_MAX_AGE || 60 * 60 * 24 * 7); // 7d

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[auth-bff] SUPABASE_URL e SUPABASE_ANON_KEY (ou VITE_*) são obrigatórios');
    process.exit(1);
}

function supabaseAnon() {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

function parseCookies(header = '') {
    const out = {};
    for (const part of header.split(';')) {
        const i = part.indexOf('=');
        if (i === -1) continue;
        const k = part.slice(0, i).trim();
        const v = part.slice(i + 1).trim();
        if (k) out[k] = decodeURIComponent(v);
    }
    return out;
}

function cookieFlags() {
    const parts = [`Path=/`, `HttpOnly`, `SameSite=${COOKIE_SAMESITE}`, `Max-Age=${COOKIE_MAX_AGE}`];
    if (COOKIE_SECURE) parts.push('Secure');
    return parts.join('; ');
}

function setRefreshCookie(res, refreshToken) {
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(refreshToken)}; ${cookieFlags()}`);
}

function clearRefreshCookie(res) {
    const parts = [`Path=/`, `HttpOnly`, `SameSite=${COOKIE_SAMESITE}`, `Max-Age=0`];
    if (COOKIE_SECURE) parts.push('Secure');
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; ${parts.join('; ')}`);
}

function corsHeaders(req) {
    const origin = req.headers.origin || '';
    const allow =
        APP_ORIGIN === '*'
            ? (origin || '*')
            : APP_ORIGIN.split(',').map((s) => s.trim()).includes(origin)
                ? origin
                : APP_ORIGIN.split(',')[0].trim();

    const headers = {
        'Access-Control-Allow-Origin': allow,
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Vary': 'Origin',
    };
    return headers;
}

function sendJson(res, status, body, extraHeaders = {}) {
    const payload = JSON.stringify(body);
    const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(payload),
        ...extraHeaders,
    };
    // Preserva Set-Cookie se já foi definido via setRefreshCookie/clearRefreshCookie
    const existingCookie = res.getHeader('Set-Cookie');
    if (existingCookie && !headers['Set-Cookie']) {
        headers['Set-Cookie'] = existingCookie;
    }
    res.writeHead(status, headers);
    res.end(payload);
}

async function readJson(req) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    if (!chunks.length) return {};
    try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
        return null;
    }
}

function publicUser(user) {
    if (!user) return null;
    const app = user.app_metadata || {};
    return {
        id: user.id,
        email: user.email,
        role: app.role,
        company_id: app.company_id,
        permissions: Array.isArray(app.permissions) ? app.permissions : [],
        app_metadata: {
            role: app.role,
            company_id: app.company_id,
            permissions: app.permissions,
        },
    };
}

const server = createServer(async (req, res) => {
    const cors = corsHeaders(req);
    if (req.method === 'OPTIONS') {
        res.writeHead(204, cors);
        res.end();
        return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    try {
        if (req.method === 'GET' && (path === '/auth/health' || path === '/health')) {
            sendJson(res, 200, { ok: true, service: 'auth-bff' }, cors);
            return;
        }

        if (req.method === 'POST' && path === '/auth/login') {
            const body = await readJson(req);
            if (!body) {
                sendJson(res, 400, { error: 'JSON inválido' }, cors);
                return;
            }
            const email = String(body.email || '').trim();
            const password = String(body.password || '');
            if (!email || !password) {
                sendJson(res, 400, { error: 'E-mail e senha são obrigatórios' }, cors);
                return;
            }

            const sb = supabaseAnon();
            const { data, error } = await sb.auth.signInWithPassword({ email, password });
            if (error || !data.session) {
                sendJson(res, 401, { error: 'E-mail ou senha inválidos.' }, cors);
                return;
            }

            setRefreshCookie(res, data.session.refresh_token);
            sendJson(res, 200, {
                access_token: data.session.access_token,
                expires_in: data.session.expires_in,
                expires_at: data.session.expires_at,
                token_type: data.session.token_type,
                user: publicUser(data.user),
                // dual: front sincroniza memória; durável fica no cookie HttpOnly
                refresh_token: data.session.refresh_token,
            }, cors);
            return;
        }

        if (req.method === 'POST' && path === '/auth/refresh') {
            const cookies = parseCookies(req.headers.cookie || '');
            const fromCookie = cookies[COOKIE_NAME];
            const body = (await readJson(req)) || {};
            const refresh = fromCookie || body.refresh_token;
            if (!refresh) {
                sendJson(res, 401, { error: 'Sessão expirada' }, cors);
                return;
            }

            const sb = supabaseAnon();
            const { data, error } = await sb.auth.refreshSession({ refresh_token: refresh });
            if (error || !data.session) {
                clearRefreshCookie(res);
                sendJson(res, 401, { error: 'Sessão expirada' }, cors);
                return;
            }

            setRefreshCookie(res, data.session.refresh_token);
            sendJson(res, 200, {
                access_token: data.session.access_token,
                expires_in: data.session.expires_in,
                expires_at: data.session.expires_at,
                token_type: data.session.token_type,
                user: publicUser(data.user ?? data.session.user),
                refresh_token: data.session.refresh_token,
            }, cors);
            return;
        }

        if (req.method === 'GET' && path === '/auth/session') {
            const cookies = parseCookies(req.headers.cookie || '');
            const refresh = cookies[COOKIE_NAME];
            if (!refresh) {
                sendJson(res, 401, { error: 'Não autenticado' }, cors);
                return;
            }

            const sb = supabaseAnon();
            const { data, error } = await sb.auth.refreshSession({ refresh_token: refresh });
            if (error || !data.session) {
                clearRefreshCookie(res);
                sendJson(res, 401, { error: 'Não autenticado' }, cors);
                return;
            }

            setRefreshCookie(res, data.session.refresh_token);
            sendJson(res, 200, {
                access_token: data.session.access_token,
                expires_in: data.session.expires_in,
                expires_at: data.session.expires_at,
                token_type: data.session.token_type,
                user: publicUser(data.user ?? data.session.user),
                refresh_token: data.session.refresh_token,
            }, cors);
            return;
        }

        if (req.method === 'POST' && path === '/auth/logout') {
            clearRefreshCookie(res);
            sendJson(res, 200, { ok: true }, cors);
            return;
        }

        sendJson(res, 404, { error: 'Not found' }, cors);
    } catch (err) {
        console.error('[auth-bff]', err);
        sendJson(res, 500, { error: 'Erro interno' }, cors);
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`[auth-bff] listening on :${PORT} (cookie=${COOKIE_NAME}, secure=${COOKIE_SECURE})`);
});
