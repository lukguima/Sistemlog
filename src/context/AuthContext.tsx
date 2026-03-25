import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { masterService } from '../lib/services';
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
    user: (User & { company_id?: string; role?: string }) | null;
    loading: boolean;
    subscription: Subscription | null;
    isSubscriptionBlocked: boolean;
    isSubscriptionWarning: boolean; // próximos 7 dias do vencimento
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
    login: async () => ({ error: null }),
    logout: async () => {},
    refreshSubscription: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [subscription, setSubscription] = useState<Subscription | null>(null);

    const login = async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        return { data, error };
    };

    const logout = async () => {
        await supabase.auth.signOut();
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

            let finalUser: any = {
                ...sessionUser,
                company_id: metadataCompanyId,
                role: metadataRole,
            };

            // Fallback: busca do banco se app_metadata ainda não foi populado pelo trigger
            if (!metadataCompanyId || !metadataRole) {
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('company_id, role')
                    .eq('id', sessionUser.id)
                    .single();

                if (!error && profile) {
                    finalUser.company_id = finalUser.company_id || profile.company_id;
                    finalUser.role       = finalUser.role       || profile.role;
                }
            }

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
        supabase.auth.getSession().then(({ data: { session } }) => {
            fetchProfile(session?.user ?? null);
        });

        const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
            fetchProfile(session?.user ?? null);
        });

        return () => authSub.unsubscribe();
    }, []);

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

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            subscription,
            isSubscriptionBlocked,
            isSubscriptionWarning,
            login,
            logout,
            refreshSubscription,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
