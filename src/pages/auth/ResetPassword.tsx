import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { usesCookieAuth } from '../../lib/authMode';
import { authApi } from '../../lib/authApi';

async function establishSessionFromUrl() {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const errDesc = url.searchParams.get('error_description') || url.searchParams.get('error');
    if (errDesc) {
        throw new Error(decodeURIComponent(errDesc.replace(/\+/g, ' ')));
    }

    if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        return;
    }

    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (!access_token || !refresh_token) {
        throw new Error('Link inválido ou expirado. Peça um novo e-mail de recuperação.');
    }

    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw error;

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
            /* updateUser ainda funciona com a sessão em memória */
        }
    }
}

export default function ResetPassword() {
    const navigate = useNavigate();
    const [phase, setPhase] = useState<'loading' | 'form' | 'done' | 'error'>('loading');
    const [message, setMessage] = useState('Validando o link de recuperação…');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data: existing } = await supabase.auth.getSession();
                if (!existing.session) {
                    await establishSessionFromUrl();
                }
                window.history.replaceState({}, document.title, '/auth/reset-password');
                if (cancelled) return;
                setPhase('form');
                setMessage('');
            } catch (e: any) {
                if (cancelled) return;
                setPhase('error');
                setMessage(e?.message || 'Não foi possível abrir o link de recuperação.');
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');
        if (password.length < 6) {
            setMessage('A senha precisa ter pelo menos 6 caracteres.');
            return;
        }
        if (password !== confirm) {
            setMessage('As senhas não coincidem.');
            return;
        }
        setSaving(true);
        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            await supabase.auth.signOut().catch(() => {});
            setPhase('done');
            setMessage('Senha alterada. Você já pode entrar com a nova senha.');
            setTimeout(() => navigate('/login?reset=1', { replace: true }), 1800);
        } catch (e: any) {
            setMessage(e?.message || 'Não foi possível salvar a nova senha.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0B0F17] flex items-center justify-center p-4 text-white">
            <div className="max-w-md w-full bg-[#161B26] border border-slate-800 rounded-3xl p-8 space-y-5">
                {phase === 'loading' && (
                    <div className="text-center space-y-3">
                        <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mx-auto" />
                        <p className="text-sm text-slate-400">{message}</p>
                    </div>
                )}

                {phase === 'error' && (
                    <div className="text-center space-y-4">
                        <div className="w-14 h-14 rounded-full bg-rose-500/15 text-rose-400 flex items-center justify-center mx-auto">
                            <AlertCircle size={28} />
                        </div>
                        <h1 className="text-xl font-bold">Link inválido</h1>
                        <p className="text-sm text-slate-400">{message}</p>
                        <Link to="/login" className="inline-block px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-bold">
                            Voltar ao login
                        </Link>
                    </div>
                )}

                {phase === 'done' && (
                    <div className="text-center space-y-4">
                        <div className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto">
                            <CheckCircle2 size={28} />
                        </div>
                        <h1 className="text-xl font-bold">Senha atualizada</h1>
                        <p className="text-sm text-slate-400">{message}</p>
                    </div>
                )}

                {phase === 'form' && (
                    <>
                        <div className="space-y-2">
                            <h1 className="text-2xl font-black">Nova senha</h1>
                            <p className="text-sm text-slate-400">Defina a senha que será usada para entrar no sistema.</p>
                        </div>
                        {message && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm font-bold">
                                {message}
                            </div>
                        )}
                        <form className="space-y-4" onSubmit={handleSave}>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nova senha</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        minLength={6}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="w-full bg-[#0B0F17] border border-slate-800 focus:border-primary-500 rounded-xl py-3.5 pl-11 pr-12 outline-none"
                                        placeholder="Mínimo 6 caracteres"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(v => !v)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Confirmar senha</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        minLength={6}
                                        value={confirm}
                                        onChange={e => setConfirm(e.target.value)}
                                        className="w-full bg-[#0B0F17] border border-slate-800 focus:border-primary-500 rounded-xl py-3.5 pl-11 pr-4 outline-none"
                                        placeholder="Repita a senha"
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full bg-primary-600 hover:bg-primary-500 py-3.5 rounded-xl font-black disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader2 className="animate-spin" size={20} /> : 'Salvar nova senha'}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
