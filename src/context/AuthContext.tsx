import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { masterService } from '../lib/services';
import { hasSectorAccess, type SectorKey } from '../lib/permissions';
import { authApi } from '../lib/authApi';
import { usesCookieAuth } from '../lib/authMode';
import type { User } from '@supabase/supabase-js';

export interface Subscription {
    id: string;
    company_id: string;
    plan: string;
    status: 'trial' | 'active' | 'overdue' | 'canceled' | 'blocked';
    trial_ends_at: string | null;
    current_period_end: string | null;
    overdue_since: string | null;
    blocked_at: string | null;
    checkout_url: string | null;
    block_reason: string | null;
    mrr: number;
    vehicle_limit: number | null;  // null = ilimitado (enterprise)
}

interface AuthContextType {
    user: (User & { company_id?: string; role?: string; permissions?: string[] }) | null;
    loading: boolean;
    subscription: Subscription | null;
    isSubscriptionBlocked: boolean;
    isSubscriptionWarning: boolean; // próximos 7 dias do vencimento
    permissions: string[];
    hasAccess: (sector: SectorKey) => boolean;
    login: (email: string, password: string) => Promise<{ error: any }>;
    logout: () => Promise<void>;
    refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    subscription: null,
    isSubscriptionBlocked: false,
    isSubscriptionWarning: false,
    permissions: [],
    hasAccess: () => true,
    login: async () => ({ error: null }),
    logout: async () => {},
    refreshSubscription: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

    const applyCookieSession = async (payload: {
        access_token: string;
        refresh_token?: string;
    }) => {
        const { data, error } = await supabase.auth.setSession({
            access_token: payload.access_token,
            refresh_token: payload.refresh_token || 'cookie-managed',
        });
        if (error) throw error;
        return data;
    };

    const login = async (email: string, password: string) => {
        if (!usesCookieAuth) {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            return { data, error };
        }
        try {
            const session = await authApi.login(email, password);
            const data = await applyCookieSession(session);
            return { data, error: null };
        } catch (err: any) {
            return { data: null, error: { message: err?.message || 'E-mail ou senha inválidos.' } };
        }
    };

    const logout = async () => {
        if (usesCookieAuth) {
            await authApi.logout();
        }
        await supabase.auth.signOut({ scope: 'local' });
        setSubscription(null);
    };

    const fetchSubscription = async (companyId: string) => {
        try {
            // Dispara expiração de trials/assinaturas vencidas (sem depender de cron)
            try { await supabase.rpc('expire_subscriptions'); } catch { /* silencioso */ }
            const sub = await masterService.getCompanySubscription(companyId);
            setSubscription(sub ?? null);
        } catch (err) {
            console.error('Erro ao buscar assinatura:', err);
        }
    };

    const refreshSubscription = async () => {
        const companyId = (user as any)?.company_id;
        if (companyId) await fetchSubscription(companyId);
    };

    const fetchProfile = async (sessionUser: User | null) => {
        if (!sessionUser) {
            setUser(null);
            setSubscription(null);
            setLoading(false);
            return;
        }

        try {
            // Prioridade: app_metadata (trigger server-side, não manipulável) > profiles DB
            // user_metadata é ignorado intencionalmente — pode ser alterado pelo próprio usuário via API client
            const appMeta = (sessionUser as any).app_metadata || {};

            const metadataCompanyId = appMeta.company_id;
            const metadataRole      = appMeta.role;
            const metadataPerms     = Array.isArray(appMeta.permissions) ? appMeta.permissions : undefined;

            let finalUser: any = {
                ...sessionUser,
                company_id: metadataCompanyId,
                role: metadataRole,
                permissions: metadataPerms,
            };

            // Fallback: busca do banco se app_metadata ainda não foi populado pelo trigger
            if (!metadataCompanyId || !metadataRole || metadataPerms === undefined) {
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('company_id, role, permissions')
                    .eq('id', sessionUser.id)
                    .single();

                if (!error && profile) {
                    finalUser.company_id = finalUser.company_id || profile.company_id;
                    finalUser.role       = finalUser.role       || profile.role;
                    if (finalUser.permissions === undefined) {
                        finalUser.permissions = Array.isArray((profile as any).permissions)
                            ? (profile as any).permissions
                            : [];
                    }
                }
            }

            if (!Array.isArray(finalUser.permissions)) finalUser.permissions = [];

            // company_id ausente = trigger sync_user_claims não executou ainda

            setUser(finalUser);

            // Buscar assinatura (não master)
            if (finalUser.company_id && finalUser.role !== 'master') {
                await fetchSubscription(finalUser.company_id);
            }
        } catch (err) {
            console.error('Erro no AuthContext:', err);
            setUser(sessionUser);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let cancelled = false;

        const boot = async () => {
            if (usesCookieAuth) {
                try {
                    // Memória vazia após F5 → restaura via cookie HttpOnly
                    const { data: { session: mem } } = await supabase.auth.getSession();
                    if (!mem) {
                        const restored = await authApi.session();
                        if (restored && !cancelled) {
                            await applyCookieSession(restored);
                        }
                    }
                } catch {
                    /* sem cookie = não autenticado */
                }
            }

            if (cancelled) return;
            const { data: { session } } = await supabase.auth.getSession();
            fetchProfile(session?.user ?? null);
        };

        boot();

        const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
            fetchProfile(session?.user ?? null);
        });

        return () => {
            cancelled = true;
            authSub.unsubscribe();
        };
    }, []);

    // Refresh via BFF quando cookie auth está ativo (autoRefreshToken desligado)
    useEffect(() => {
        if (!usesCookieAuth) return;
        if (refreshTimer.current) clearInterval(refreshTimer.current);

        refreshTimer.current = setInterval(async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;
                const next = await authApi.refresh();
                await applyCookieSession(next);
            } catch {
                await supabase.auth.signOut({ scope: 'local' });
                setUser(null);
                setSubscription(null);
            }
        }, 10 * 60 * 1000); // 10 min

        return () => {
            if (refreshTimer.current) clearInterval(refreshTimer.current);
        };
    }, [user?.id]);

    // Real-time: atualiza subscription ao detectar mudança no Supabase
    useEffect(() => {
        const companyId = (user as any)?.company_id;
        if (!companyId || (user as any)?.role === 'master') return;

        const channel = supabase
            .channel(`subscription-${companyId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'subscriptions',
                    filter: `company_id=eq.${companyId}`,
                },
                (payload) => {
                    setSubscription(payload.new as Subscription);
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [(user as any)?.company_id]);

    // Fallback: re-busca a subscription quando o usuário volta para a aba
    useEffect(() => {
        const companyId = (user as any)?.company_id;
        if (!companyId || (user as any)?.role === 'master') return;
        const handleFocus = () => fetchSubscription(companyId);
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [(user as any)?.company_id]);

    // Verificação de status
    const BLOCKED_STATUSES = ['overdue', 'canceled', 'blocked'];

    // Trial expirado = bloqueado (verificação no cliente; o SQL também atualiza via cron)
    const isTrialExpired = !!subscription &&
        subscription.status === 'trial' &&
        !!subscription.trial_ends_at &&
        new Date(subscription.trial_ends_at) < new Date();

    const isSubscriptionBlocked = !!subscription && (
        BLOCKED_STATUSES.includes(subscription.status) || isTrialExpired
    );

    const isSubscriptionWarning = (() => {
        if (!subscription || subscription.status !== 'active') return false;
        if (!subscription.current_period_end) return false;
        const daysLeft = (new Date(subscription.current_period_end).getTime() - Date.now()) / 86400000;
        return daysLeft <= 7;
    })();

    const permissions: string[] = Array.isArray((user as any)?.permissions) ? (user as any).permissions : [];
    const role = (user as any)?.role as string | undefined;
    const hasAccess = (sector: SectorKey) => hasSectorAccess(role, permissions, sector);

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            subscription,
            isSubscriptionBlocked,
            isSubscriptionWarning,
            permissions,
            hasAccess,
            login,
            logout,
            refreshSubscription,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
