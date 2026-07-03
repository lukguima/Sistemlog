import { AlertTriangle, CreditCard, Clock, Ban, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { KIWIFY_CHECKOUT_URLS } from '../lib/services';

const STATUS_LABELS: Record<string, string> = {
    overdue:       'Pagamento em Atraso',
    canceled:      'Assinatura Cancelada',
    blocked:       'Acesso Bloqueado',
    trial_expired: 'Período de Teste Encerrado',
};


export function SubscriptionGuard({ children }: { children: React.ReactNode }) {
    const { subscription, isSubscriptionBlocked, isSubscriptionWarning, user } = useAuth();

    // Master nunca é bloqueado
    if ((user as any)?.role === 'master') return <>{children}</>;

    // Sem subscription ainda = carregando ou trial sem registro → deixa passar
    if (!subscription) return <>{children}</>;

    const planKey = (subscription.plan || 'pro').toLowerCase();
    const checkoutUrl = subscription.checkout_url
        || KIWIFY_CHECKOUT_URLS[planKey]
        || KIWIFY_CHECKOUT_URLS['pro']
        || 'https://pay.kiwify.com.br/9f3rjhC';

    // ── Banner de restrição (sem bloqueio total — acesso somente leitura) ──
    if (isSubscriptionBlocked) {
        const isTrialExpired = subscription.status === 'trial' &&
            !!subscription.trial_ends_at &&
            new Date(subscription.trial_ends_at) < new Date();

        const status    = isTrialExpired ? 'trial_expired' : subscription.status as string;
        const title     = STATUS_LABELS[status]    ?? 'Acesso Restrito';
        const isAdminBlocked = status === 'blocked';

        return (
            <>
                <div className="fixed top-0 left-0 right-0 z-[9998] bg-rose-600 text-white px-4 py-2.5 flex items-center justify-between gap-4 text-xs font-bold shadow-lg">
                    <div className="flex items-center gap-2 min-w-0">
                        {isAdminBlocked ? <Ban size={14} /> : <AlertTriangle size={14} />}
                        <span className="truncate">
                            {title}
                            {subscription.block_reason ? ` — ${subscription.block_reason}` : ' — Visualização disponível. Novos lançamentos estão bloqueados.'}
                        </span>
                    </div>
                    {!isAdminBlocked && (
                        <a
                            href={checkoutUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-white text-rose-600 px-3 py-1 rounded-lg hover:bg-rose-50 transition-colors whitespace-nowrap flex items-center gap-1 shrink-0"
                        >
                            <CreditCard size={12} /> Regularizar <ExternalLink size={11} />
                        </a>
                    )}
                </div>
                {children}
            </>
        );
    }

    // ── Banner de aviso (trial expirando ou vencimento próximo) ──
    const showTrialBanner = subscription.status === 'trial' && subscription.trial_ends_at;
    const trialDaysLeft = showTrialBanner
        ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at!).getTime() - Date.now()) / 86400000))
        : 0;

    const showWarningBanner = isSubscriptionWarning && subscription.current_period_end;
    const warningDaysLeft = showWarningBanner
        ? Math.max(0, Math.ceil((new Date(subscription.current_period_end!).getTime() - Date.now()) / 86400000))
        : 0;

    return (
        <>
            {/* Banner trial — mostrado durante todo o período de 7 dias */}
            {showTrialBanner && trialDaysLeft > 0 && (
                <div className="fixed top-0 left-0 right-0 z-[9998] bg-amber-500 text-white px-4 py-2 flex items-center justify-between gap-4 text-xs font-bold shadow-lg">
                    <div className="flex items-center gap-2">
                        <Clock size={14} />
                        <span>Período de demonstração: {trialDaysLeft} dia{trialDaysLeft !== 1 ? 's' : ''} restante{trialDaysLeft !== 1 ? 's' : ''}. Assine agora para não perder o acesso.</span>
                    </div>
                    <a
                        href={checkoutUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white text-amber-600 px-3 py-1 rounded-lg hover:bg-amber-50 transition-colors whitespace-nowrap flex items-center gap-1"
                    >
                        Assinar <ExternalLink size={12} />
                    </a>
                </div>
            )}

            {/* Banner vencimento próximo */}
            {showWarningBanner && (
                <div className="fixed top-0 left-0 right-0 z-[9998] bg-orange-500 text-white px-4 py-2 flex items-center justify-between gap-4 text-xs font-bold shadow-lg">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={14} />
                        <span>Sua assinatura vence em {warningDaysLeft} dia{warningDaysLeft !== 1 ? 's' : ''} ({new Date(subscription.current_period_end!).toLocaleDateString('pt-BR')}). Renove para evitar interrupção.</span>
                    </div>
                    <a
                        href={checkoutUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white text-orange-600 px-3 py-1 rounded-lg hover:bg-orange-50 transition-colors whitespace-nowrap flex items-center gap-1"
                    >
                        Renovar <ExternalLink size={12} />
                    </a>
                </div>
            )}

            {children}
        </>
    );
}
