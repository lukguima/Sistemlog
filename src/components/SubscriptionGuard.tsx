import { AlertTriangle, CreditCard, Clock, Ban, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { KIWIFY_CHECKOUT_URLS } from '../lib/services';

const STATUS_LABELS: Record<string, string> = {
    overdue:       'Pagamento em Atraso',
    canceled:      'Assinatura Cancelada',
    blocked:       'Acesso Bloqueado',
    trial_expired: 'Período de Teste Encerrado',
};

const STATUS_DESCRIPTIONS: Record<string, string> = {
    overdue:       'Identificamos um atraso no pagamento da sua assinatura. Para continuar usando o sistema, regularize o pagamento clicando no botão abaixo.',
    canceled:      'Sua assinatura foi cancelada. Para reativar o acesso completo, assine novamente.',
    blocked:       'O acesso à sua conta foi suspenso pelo administrador. Entre em contato com o suporte.',
    trial_expired: 'Seu período gratuito de 7 dias foi encerrado. Assine um plano para continuar com acesso completo ao sistema.',
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

    // ── Overlay de bloqueio total ──
    if (isSubscriptionBlocked) {
        const isTrialExpired = subscription.status === 'trial' &&
            !!subscription.trial_ends_at &&
            new Date(subscription.trial_ends_at) < new Date();

        const status   = isTrialExpired ? 'trial_expired' : subscription.status as string;
        const title    = STATUS_LABELS[status]    ?? 'Acesso Restrito';
        const desc     = STATUS_DESCRIPTIONS[status] ?? STATUS_DESCRIPTIONS['blocked'];
        const isBlocked = status === 'blocked';

        return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/95 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 p-10 max-w-lg w-full mx-4 text-center space-y-6">
                    {/* Ícone */}
                    <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center ${isBlocked ? 'bg-slate-100 dark:bg-slate-800' : 'bg-rose-100 dark:bg-rose-900/20'}`}>
                        {isBlocked
                            ? <Ban size={36} className="text-slate-500" />
                            : <AlertTriangle size={36} className="text-rose-500 animate-pulse" />
                        }
                    </div>

                    {/* Texto */}
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{title}</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{desc}</p>

                        {subscription.block_reason && (
                            <p className="mt-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-600 dark:text-slate-400 italic">
                                Motivo: {subscription.block_reason}
                            </p>
                        )}

                        {subscription.overdue_since && (
                            <p className="mt-3 text-xs text-rose-500 font-bold">
                                Em atraso desde {new Date(subscription.overdue_since).toLocaleDateString('pt-BR')}
                            </p>
                        )}
                    </div>

                    {/* Botão de pagamento */}
                    {!isBlocked && (
                        <a
                            href={checkoutUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 px-8 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 text-sm"
                        >
                            <CreditCard size={18} />
                            Regularizar Pagamento via Kiwify
                            <ExternalLink size={14} />
                        </a>
                    )}

                    <p className="text-xs text-slate-400">
                        Após o pagamento, o acesso é liberado automaticamente em até 5 minutos.
                        <br />Dúvidas? Entre em contato com o suporte.
                    </p>
                </div>
            </div>
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
