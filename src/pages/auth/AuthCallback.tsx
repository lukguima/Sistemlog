import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { usesCookieAuth } from '../../lib/authMode';
import { authApi } from '../../lib/authApi';

/**
 * Destino do emailRedirectTo do signUp / confirmação de e-mail.
 * Consome tokens da URL (hash ou ?code=) e manda o usuário para o login.
 */
export default function AuthCallback() {
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
    const [message, setMessage] = useState('Confirmando seu e-mail…');

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            try {
                const url = new URL(window.location.href);
                const code = url.searchParams.get('code');
                const errDesc = url.searchParams.get('error_description') || url.searchParams.get('error');

                if (errDesc) {
                    throw new Error(decodeURIComponent(errDesc.replace(/\+/g, ' ')));
                }

                if (code) {
                    const { error } = await supabase.auth.exchangeCodeForSession(code);
                    if (error) throw error;
                } else {
                    // Fluxo implícito: tokens no hash (#access_token=...&refresh_token=...)
                    const hash = window.location.hash.replace(/^#/, '');
                    const params = new URLSearchParams(hash);
                    const access_token = params.get('access_token');
                    const refresh_token = params.get('refresh_token');
                    if (access_token && refresh_token) {
                        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
                        if (error) throw error;

                        // Cookie mode: grava refresh no BFF para sessão durável
                        if (usesCookieAuth && authApi.enabled) {
                            try {
                                await fetch(
                                    `${(import.meta.env.VITE_AUTH_BFF_URL || '').replace(/\/+$/, '')}/auth/refresh`,
                                    {
                                        method: 'POST',
                                        credentials: 'include',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ refresh_token }),
                                    }
                                );
                            } catch {
                                /* login manual ainda funciona após confirmação */
                            }
                        }
                    }
                }

                // Limpa tokens da barra de endereço
                window.history.replaceState({}, document.title, '/auth/callback');

                if (cancelled) return;
                setStatus('ok');
                setMessage('E-mail confirmado! Você já pode entrar na sua conta.');
                setTimeout(() => navigate('/login?confirmed=1', { replace: true }), 1800);
            } catch (e: any) {
                if (cancelled) return;
                setStatus('error');
                setMessage(e?.message || 'Não foi possível confirmar o e-mail. Tente fazer login ou peça um novo link.');
            }
        };

        run();
        return () => { cancelled = true; };
    }, [navigate]);

    return (
        <div className="min-h-screen bg-[#0B0F17] flex items-center justify-center p-4 text-white">
            <div className="max-w-md w-full bg-[#161B26] border border-slate-800 rounded-3xl p-8 text-center space-y-4">
                {status === 'loading' && (
                    <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mx-auto" />
                )}
                {status === 'ok' && (
                    <div className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto">
                        <CheckCircle2 size={28} />
                    </div>
                )}
                {status === 'error' && (
                    <div className="w-14 h-14 rounded-full bg-rose-500/15 text-rose-400 flex items-center justify-center mx-auto">
                        <AlertCircle size={28} />
                    </div>
                )}
                <h1 className="text-xl font-bold">
                    {status === 'loading' ? 'Validando…' : status === 'ok' ? 'Tudo certo' : 'Falha na confirmação'}
                </h1>
                <p className="text-sm text-slate-400">{message}</p>
                {status !== 'loading' && (
                    <Link
                        to="/login"
                        className="inline-block mt-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-bold transition-colors"
                    >
                        Ir para o login
                    </Link>
                )}
            </div>
        </div>
    );
}
