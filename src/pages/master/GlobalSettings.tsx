import { useState, useEffect } from 'react';
import {
    Settings, Check, AlertTriangle, Loader2, Copy,
    CheckCircle, Link as LinkIcon, Clock, Info,
    Server, Package, Webhook
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SUBSCRIPTION_PLANS } from '../../lib/constants';
import { KIWIFY_CHECKOUT_URLS } from '../../lib/services';

type SaveState = 'idle' | 'saving' | 'success' | 'error';

const PLAN_IDS = ['basico', 'pro', 'enterprise'] as const;
type PlanId = typeof PLAN_IDS[number];

export default function GlobalSettings() {
    const [checkoutUrls, setCheckoutUrls] = useState<Record<PlanId, string>>({
        basico: KIWIFY_CHECKOUT_URLS['basico'] ?? '',
        pro: KIWIFY_CHECKOUT_URLS['pro'] ?? '',
        enterprise: KIWIFY_CHECKOUT_URLS['enterprise'] ?? '',
    });
    const [urlSaveState, setUrlSaveState] = useState<Record<PlanId, SaveState>>({
        basico: 'idle', pro: 'idle', enterprise: 'idle',
    });

    const [trialDays, setTrialDays] = useState(14);
    const [trialSaveState, setTrialSaveState] = useState<SaveState>('idle');

    const [webhookCopied, setWebhookCopied] = useState(false);
    const [settingsError, setSettingsError] = useState<string | null>(null);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string ?? 'https://<PROJECT>.supabase.co';
    const webhookUrl = `${supabaseUrl}/functions/v1/kiwify-webhook`;

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const { data, error } = await supabase
                    .from('master_settings')
                    .select('key, value');

                if (error) {
                    if (
                        error.code === 'PGRST116' ||
                        error.message?.toLowerCase().includes('does not exist') ||
                        error.message?.toLowerCase().includes('relation') ||
                        (error as any).code === '42P01'
                    ) {
                        return;
                    }
                    setSettingsError('Não foi possível carregar as configurações salvas.');
                    return;
                }

                if (!data) return;

                const map: Record<string, string> = {};
                data.forEach((row: { key: string; value: string }) => {
                    map[row.key] = row.value;
                });

                setCheckoutUrls({
                    basico: map['checkout_url_basico'] ?? KIWIFY_CHECKOUT_URLS['basico'] ?? '',
                    pro: map['checkout_url_pro'] ?? KIWIFY_CHECKOUT_URLS['pro'] ?? '',
                    enterprise: map['checkout_url_enterprise'] ?? KIWIFY_CHECKOUT_URLS['enterprise'] ?? '',
                });

                if (map['trial_days']) {
                    const parsed = parseInt(map['trial_days'], 10);
                    if (!isNaN(parsed)) setTrialDays(parsed);
                }
            } catch {
                // Table may not exist yet — fail silently
            }
        };

        loadSettings();
    }, []);

    const handleSaveUrl = async (planId: PlanId) => {
        setUrlSaveState(prev => ({ ...prev, [planId]: 'saving' }));
        setSettingsError(null);
        try {
            const { error } = await supabase
                .from('master_settings')
                .upsert(
                    { key: `checkout_url_${planId}`, value: checkoutUrls[planId] },
                    { onConflict: 'key' }
                );
            if (error) throw error;
            setUrlSaveState(prev => ({ ...prev, [planId]: 'success' }));
            setTimeout(() => setUrlSaveState(prev => ({ ...prev, [planId]: 'idle' })), 2500);
        } catch (err: any) {
            console.error('Erro ao salvar URL:', err);
            setSettingsError(`Erro ao salvar URL: ${err?.message || err?.code || 'Verifique se a tabela master_settings existe no Supabase.'}`);
            setUrlSaveState(prev => ({ ...prev, [planId]: 'error' }));
            setTimeout(() => setUrlSaveState(prev => ({ ...prev, [planId]: 'idle' })), 3000);
        }
    };

    const handleSaveTrialDays = async () => {
        setTrialSaveState('saving');
        setSettingsError(null);
        try {
            const { error } = await supabase
                .from('master_settings')
                .upsert(
                    { key: 'trial_days', value: String(trialDays) },
                    { onConflict: 'key' }
                );
            if (error) throw error;
            setTrialSaveState('success');
            setTimeout(() => setTrialSaveState('idle'), 2500);
        } catch (err: any) {
            console.error('Erro ao salvar trial_days:', err);
            setSettingsError(`Erro ao salvar trial: ${err?.message || err?.code || 'Verifique se a tabela master_settings existe no Supabase.'}`);
            setTrialSaveState('error');
            setTimeout(() => setTrialSaveState('idle'), 3000);
        }
    };

    const handleCopyWebhook = async () => {
        try {
            await navigator.clipboard.writeText(webhookUrl);
            setWebhookCopied(true);
            setTimeout(() => setWebhookCopied(false), 2000);
        } catch {
            // Clipboard API not available
        }
    };

    const planColors: Record<PlanId, string> = {
        basico: 'text-slate-300 bg-slate-700/50 border-slate-600',
        pro: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/30',
        enterprise: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
    };

    const planBadgeColors: Record<PlanId, string> = {
        basico: 'bg-slate-700 text-slate-300',
        pro: 'bg-indigo-500/20 text-indigo-300',
        enterprise: 'bg-amber-500/20 text-amber-300',
    };

    const SaveButton = ({
        state, onClick, disabled,
    }: { state: SaveState; onClick: () => void; disabled?: boolean }) => (
        <button
            onClick={onClick}
            disabled={disabled || state === 'saving'}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                state === 'success'
                    ? 'bg-emerald-600 text-white'
                    : state === 'error'
                    ? 'bg-rose-600 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50'
            }`}
        >
            {state === 'saving' && <Loader2 size={14} className="animate-spin" />}
            {state === 'success' && <Check size={14} />}
            {state === 'error' && <AlertTriangle size={14} />}
            {state === 'idle' && 'Salvar'}
            {state === 'saving' && 'Salvando…'}
            {state === 'success' && 'Salvo!'}
            {state === 'error' && 'Erro'}
        </button>
    );

    return (
        <div className="min-h-screen bg-[#0B0F17] p-6 md:p-8">
            <div className="max-w-4xl mx-auto space-y-8">

                {/* Header */}
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <Settings size={22} className="text-indigo-400" />
                        <h1 className="text-2xl font-bold text-white tracking-tight">Configurações Globais</h1>
                    </div>
                    <p className="text-slate-400 text-sm">
                        Gerencie planos, URLs de checkout, trial e integrações do sistema.
                    </p>
                </div>

                {settingsError && (
                    <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 text-amber-300 text-sm">
                        <AlertTriangle size={16} className="shrink-0" />
                        {settingsError}
                    </div>
                )}

                {/* ── Section 1: Planos ── */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Package size={16} className="text-slate-400" />
                        <h2 className="text-base font-black text-white">Configurações dos Planos</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {PLAN_IDS.map(planId => {
                            const plan = SUBSCRIPTION_PLANS[planId];
                            return (
                                <div
                                    key={planId}
                                    className={`bg-[#161B26] border rounded-2xl p-5 space-y-4 ${planColors[planId].split(' ').slice(2).join(' ')}`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <span className={`text-[11px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${planBadgeColors[planId]}`}>
                                                {plan.name}
                                            </span>
                                            <p className="text-2xl font-black text-white mt-2">
                                                R$ {plan.price}<span className="text-sm font-medium text-slate-400">/mês</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium mb-2">
                                            {plan.vehicleLimit === Infinity ? 'Veículos ilimitados' : `Até ${plan.vehicleLimit} veículos`}
                                        </p>
                                        <ul className="space-y-1.5">
                                            {plan.features.map((feat, i) => (
                                                <li key={i} className="flex items-center gap-2 text-xs text-slate-400">
                                                    <CheckCircle size={11} className="text-emerald-500 shrink-0" />
                                                    {feat}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex items-start gap-2 bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3">
                        <Info size={14} className="text-slate-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-slate-500">
                            Para alterar preços ou limites, atualize{' '}
                            <code className="bg-slate-700 text-slate-300 px-1 py-0.5 rounded text-[11px]">SUBSCRIPTION_PLANS</code>
                            {' '}em{' '}
                            <code className="bg-slate-700 text-slate-300 px-1 py-0.5 rounded text-[11px]">src/lib/constants.ts</code>.
                        </p>
                    </div>
                </section>

                {/* ── Section 2: URLs de Checkout Kiwify ── */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2">
                        <LinkIcon size={16} className="text-slate-400" />
                        <h2 className="text-base font-black text-white">URLs de Checkout Kiwify</h2>
                    </div>

                    <div className="bg-[#161B26] border border-slate-800 rounded-2xl divide-y divide-slate-800">
                        {PLAN_IDS.map(planId => {
                            const plan = SUBSCRIPTION_PLANS[planId];
                            return (
                                <div key={planId} className="p-5 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${planBadgeColors[planId]}`}>
                                            {plan.name}
                                        </span>
                                        <span className="text-xs text-slate-500">checkout URL</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="url"
                                            value={checkoutUrls[planId]}
                                            onChange={e => setCheckoutUrls(prev => ({ ...prev, [planId]: e.target.value }))}
                                            placeholder="https://pay.kiwify.com.br/..."
                                            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition"
                                        />
                                        <SaveButton
                                            state={urlSaveState[planId]}
                                            onClick={() => handleSaveUrl(planId)}
                                            disabled={!checkoutUrls[planId].trim()}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex items-start gap-2 bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3">
                        <Info size={14} className="text-slate-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-slate-500">
                            Obtenha os links no painel Kiwify:{' '}
                            <span className="text-slate-400 font-medium">Produto → Copiar link de compra</span>.
                            Os valores são salvos na tabela{' '}
                            <code className="bg-slate-700 text-slate-300 px-1 py-0.5 rounded text-[11px]">master_settings</code>.
                        </p>
                    </div>
                </section>

                {/* ── Section 3: Trial ── */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Clock size={16} className="text-slate-400" />
                        <h2 className="text-base font-black text-white">Configurações de Trial</h2>
                    </div>

                    <div className="bg-[#161B26] border border-slate-800 rounded-2xl p-5">
                        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                            <div className="flex-1">
                                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                    Duração do Trial (dias)
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={365}
                                    value={trialDays}
                                    onChange={e => setTrialDays(Number(e.target.value))}
                                    className="w-full sm:w-40 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition font-bold"
                                />
                                <p className="text-xs text-slate-500 mt-1.5">
                                    Novos cadastros recebem {trialDays} {trialDays === 1 ? 'dia' : 'dias'} de acesso gratuito.
                                </p>
                            </div>
                            <SaveButton
                                state={trialSaveState}
                                onClick={handleSaveTrialDays}
                                disabled={trialDays < 1}
                            />
                        </div>
                    </div>
                </section>

                {/* ── Section 4: Webhook Kiwify ── */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Webhook size={16} className="text-slate-400" />
                        <h2 className="text-base font-black text-white">Webhook Kiwify</h2>
                    </div>

                    <div className="bg-[#161B26] border border-slate-800 rounded-2xl p-5 space-y-5">
                        <div>
                            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                URL do Webhook (somente leitura)
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    readOnly
                                    value={webhookUrl}
                                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-300 font-mono outline-none cursor-default select-all"
                                />
                                <button
                                    onClick={handleCopyWebhook}
                                    title="Copiar URL"
                                    className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border ${
                                        webhookCopied
                                            ? 'bg-emerald-600 border-emerald-500 text-white'
                                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                                    }`}
                                >
                                    {webhookCopied ? <Check size={14} /> : <Copy size={14} />}
                                    {webhookCopied ? 'Copiado!' : 'Copiar'}
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                                Configure este URL no painel Kiwify:{' '}
                                <span className="text-slate-400 font-medium">Produto → Configurações → Webhooks</span>.
                            </p>
                        </div>

                        <div className="border-t border-slate-800 pt-5">
                            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                KIWIFY_WEBHOOK_TOKEN
                            </label>
                            <div className="flex items-start gap-3 bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-3">
                                <Info size={15} className="text-slate-500 mt-0.5 shrink-0" />
                                <div className="text-xs text-slate-400 space-y-1">
                                    <p>
                                        O token de verificação do webhook deve ser definido como secret no Supabase:
                                    </p>
                                    <code className="block bg-slate-900 text-emerald-400 px-3 py-2 rounded-lg font-mono text-[11px] mt-2">
                                        supabase secrets set KIWIFY_WEBHOOK_TOKEN=seu_token_aqui
                                    </code>
                                    <p className="text-slate-500 mt-2">
                                        Ou via <span className="text-slate-400 font-medium">Supabase Dashboard → Edge Functions → Secrets</span>.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── Section 5: Informações do Sistema ── */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Server size={16} className="text-slate-400" />
                        <h2 className="text-base font-black text-white">Informações do Sistema</h2>
                    </div>

                    <div className="bg-[#161B26] border border-slate-800 rounded-2xl overflow-hidden">
                        <table className="w-full text-sm">
                            <tbody className="divide-y divide-slate-800">
                                <tr className="hover:bg-slate-800/20 transition-colors">
                                    <td className="px-5 py-3.5 text-slate-500 font-medium w-48">Versão do App</td>
                                    <td className="px-5 py-3.5">
                                        <span className="text-white font-bold font-mono">1.0.0</span>
                                    </td>
                                </tr>
                                <tr className="hover:bg-slate-800/20 transition-colors">
                                    <td className="px-5 py-3.5 text-slate-500 font-medium">Ambiente</td>
                                    <td className="px-5 py-3.5">
                                        <span className="bg-emerald-500/15 text-emerald-400 text-xs font-black px-2.5 py-0.5 rounded-full border border-emerald-500/25 uppercase tracking-wide">
                                            Production
                                        </span>
                                    </td>
                                </tr>
                                <tr className="hover:bg-slate-800/20 transition-colors">
                                    <td className="px-5 py-3.5 text-slate-500 font-medium">Supabase Project URL</td>
                                    <td className="px-5 py-3.5">
                                        <span className="text-slate-300 font-mono text-xs break-all">{supabaseUrl}</span>
                                    </td>
                                </tr>
                                <tr className="hover:bg-slate-800/20 transition-colors">
                                    <td className="px-5 py-3.5 text-slate-500 font-medium">Tabela de settings</td>
                                    <td className="px-5 py-3.5">
                                        <code className="text-slate-300 bg-slate-800 px-2 py-0.5 rounded text-xs font-mono">
                                            master_settings
                                        </code>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

            </div>
        </div>
    );
}
