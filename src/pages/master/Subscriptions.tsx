import { useState, useEffect, useCallback } from 'react';
import {
    DollarSign, TrendingUp, TrendingDown, BarChart2,
    Clock, Loader2, ShieldOff, ShieldCheck, CalendarDays,
    RefreshCw, Settings, X, AlertCircle, CheckCircle2, Ban
} from 'lucide-react';
import { masterService } from '../../lib/services';
import { supabase } from '../../lib/supabase';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
    trial:    { label: 'Trial',     color: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
    active:   { label: 'Ativo',    color: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
    overdue:  { label: 'Atraso',   color: 'bg-rose-500/20 text-rose-400 border border-rose-500/30' },
    canceled: { label: 'Cancelado', color: 'bg-slate-500/20 text-slate-400 border border-slate-500/30' },
    blocked:  { label: 'Bloqueado', color: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' },
};

const PLAN_LABEL: Record<string, string> = {
    trial:      'Trial',
    basico:     'Básico',
    pro:        'Pro',
    enterprise: 'Enterprise',
};

const PLAN_COLOR: Record<string, string> = {
    trial:      'bg-slate-500/20 text-slate-400',
    basico:     'bg-sky-500/20 text-sky-400',
    pro:        'bg-violet-500/20 text-violet-400',
    enterprise: 'bg-amber-500/20 text-amber-400',
};

const PLAN_CONFIGS = [
    { id: 'basico',     name: 'Básico',     price: 197, vehicleLimit: '5 veículos',    accentBorder: 'border-sky-500/40',    accentBg: 'bg-sky-500/10',    accentText: 'text-sky-400' },
    { id: 'pro',        name: 'Pro',        price: 297, vehicleLimit: '10 veículos',   accentBorder: 'border-violet-500/40', accentBg: 'bg-violet-500/10', accentText: 'text-violet-400' },
    { id: 'enterprise', name: 'Enterprise', price: 397, vehicleLimit: 'Ilimitado',     accentBorder: 'border-amber-500/40',  accentBg: 'bg-amber-500/10',  accentText: 'text-amber-400' },
];

const STATUS_ORDER: Record<string, number> = {
    overdue: 0,
    blocked: 1,
    active:  2,
    trial:   3,
    canceled: 4,
};

export default function Subscriptions() {
    const [companies, setCompanies]         = useState<any[]>([]);
    const [kpis, setKpis]                   = useState<any>(null);
    const [loading, setLoading]             = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const [blockModal, setBlockModal]   = useState<{ companyId: string; name: string } | null>(null);
    const [blockReason, setBlockReason] = useState('');

    const [extendModal, setExtendModal] = useState<{ companyId: string; name: string } | null>(null);
    const [extendDays, setExtendDays]   = useState(30);

    const [kiwifyModal, setKiwifyModal]     = useState<{ plan: string; name: string } | null>(null);
    const [kiwifyUrl, setKiwifyUrl]         = useState('');
    const [kiwifySaving, setKiwifySaving]   = useState(false);
    const [kiwifySaved, setKiwifySaved]     = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [companiesData, kpisData] = await Promise.all([
                masterService.getAllCompaniesWithSubscriptions(),
                masterService.getMasterKpis(),
            ]);
            setCompanies(companiesData);
            setKpis(kpisData);
        } catch (err) {
            console.error('Erro ao buscar assinaturas:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        const channel = supabase
            .channel('subscriptions-page-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => {
                fetchData();
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchData]);

    const handleBlock = async () => {
        if (!blockModal) return;
        setActionLoading(blockModal.companyId);
        try {
            await masterService.blockCompany(blockModal.companyId, blockReason);
            setBlockModal(null);
            setBlockReason('');
            await fetchData();
        } catch (err) { console.error(err); }
        finally { setActionLoading(null); }
    };

    const handleUnblock = async (companyId: string) => {
        setActionLoading(companyId);
        try {
            await masterService.unblockCompany(companyId);
            await fetchData();
        } catch (err) { console.error(err); }
        finally { setActionLoading(null); }
    };

    const handleExtend = async () => {
        if (!extendModal) return;
        setActionLoading(extendModal.companyId);
        try {
            await masterService.extendSubscription(extendModal.companyId, extendDays);
            setExtendModal(null);
            await fetchData();
        } catch (err) { console.error(err); }
        finally { setActionLoading(null); }
    };

    const handleSaveKiwifyUrl = async () => {
        if (!kiwifyModal || !kiwifyUrl) return;
        setKiwifySaving(true);
        setKiwifySaved(false);
        try {
            await supabase
                .from('master_settings')
                .upsert({ key: `checkout_url_${kiwifyModal.plan}`, value: kiwifyUrl });
            setKiwifySaved(true);
        } catch (err) {
            console.error(err);
        } finally {
            setKiwifySaving(false);
        }
    };

    const fmtDate = (d: string | null | undefined) =>
        d ? new Date(d).toLocaleDateString('pt-BR') : '—';

    const fmtMRR = (n: number) =>
        n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const getPlanStats = (planId: string) => {
        const planCompanies = companies.filter(c => c.subscription?.plan === planId);
        const activeCount  = planCompanies.filter(c => c.subscription?.status === 'active').length;
        const overdueCount = planCompanies.filter(c => c.subscription?.status === 'overdue').length;
        const mrr = planCompanies
            .filter(c => c.subscription?.status === 'active')
            .reduce((sum, c) => sum + (c.subscription?.mrr || 0), 0);
        return { total: planCompanies.length, activeCount, overdueCount, mrr };
    };

    const sortedCompanies = [...companies].sort((a, b) => {
        const sa = STATUS_ORDER[a.subscription?.status ?? 'trial'] ?? 99;
        const sb = STATUS_ORDER[b.subscription?.status ?? 'trial'] ?? 99;
        return sa - sb;
    });

    return (
        <div className="min-h-screen bg-[#0B0F17] text-white p-6 md:p-8 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                            <BarChart2 size={20} className="text-emerald-400" />
                        </div>
                        Assinaturas & Planos
                    </h1>
                    <p className="text-slate-400 text-sm mt-1 ml-12">
                        Visão consolidada de receita, planos e status de todas as empresas.
                    </p>
                </div>
                <button
                    onClick={fetchData}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-[#161B26] border border-white/10 rounded-xl hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Atualizar
                </button>
            </div>

            {loading && !kpis ? (
                <div className="flex items-center justify-center py-32">
                    <Loader2 size={36} className="text-emerald-400 animate-spin" />
                </div>
            ) : (
                <>
                    {/* KPI Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-[#161B26] border border-white/10 rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-3">
                                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                                    <DollarSign size={18} className="text-emerald-400" />
                                </div>
                                <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1 uppercase tracking-widest">
                                    <TrendingUp size={11} /> MRR
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium uppercase tracking-widest">MRR Ativo</p>
                            <p className="text-2xl font-black mt-1 text-emerald-400">{fmtMRR(kpis?.totalMRR || 0)}</p>
                        </div>

                        <div className="bg-[#161B26] border border-white/10 rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-3">
                                <div className="w-9 h-9 rounded-xl bg-rose-500/20 flex items-center justify-center">
                                    <AlertCircle size={18} className="text-rose-400" />
                                </div>
                                <span className="text-[10px] font-black text-rose-400 flex items-center gap-1 uppercase tracking-widest">
                                    <TrendingDown size={11} /> Risco
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium uppercase tracking-widest">MRR em Atraso</p>
                            <p className="text-2xl font-black mt-1 text-rose-400">{fmtMRR(kpis?.overdueValue || 0)}</p>
                        </div>

                        <div className="bg-[#161B26] border border-white/10 rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-3">
                                <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                    <BarChart2 size={18} className="text-blue-400" />
                                </div>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium uppercase tracking-widest">Total Assinaturas</p>
                            <p className="text-2xl font-black mt-1">{companies.length}</p>
                            <p className="text-[10px] text-slate-500 mt-1">{kpis?.activeCount || 0} ativas · {kpis?.overdueCount || 0} em atraso</p>
                        </div>

                        <div className="bg-[#161B26] border border-white/10 rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-3">
                                <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center">
                                    <Clock size={18} className="text-amber-400" />
                                </div>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium uppercase tracking-widest">Trial Ativos</p>
                            <p className="text-2xl font-black mt-1 text-amber-400">{kpis?.trialCount || 0}</p>
                            <p className="text-[10px] text-slate-500 mt-1">{kpis?.canceledCount || 0} cancelados</p>
                        </div>
                    </div>

                    {/* Per-Plan Stats */}
                    <div>
                        <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Por Plano</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {PLAN_CONFIGS.map(plan => {
                                const stats = getPlanStats(plan.id);
                                return (
                                    <div
                                        key={plan.id}
                                        className={`bg-[#161B26] border rounded-2xl p-5 space-y-4 ${plan.accentBorder}`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black ${plan.accentBg} ${plan.accentText}`}>
                                                    {plan.name}
                                                </div>
                                                <p className={`text-xl font-black mt-2 ${plan.accentText}`}>
                                                    R$ {plan.price}<span className="text-sm font-bold text-slate-500">/mês</span>
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setKiwifyModal({ plan: plan.id, name: plan.name });
                                                    setKiwifyUrl('');
                                                    setKiwifySaved(false);
                                                }}
                                                title="Configurar URL Kiwify"
                                                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                                            >
                                                <Settings size={15} />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3 text-center">
                                            <div className="bg-[#0B0F17] rounded-xl p-3">
                                                <p className="text-lg font-black text-white">{stats.total}</p>
                                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Total</p>
                                            </div>
                                            <div className="bg-emerald-500/10 rounded-xl p-3">
                                                <p className="text-lg font-black text-emerald-400">{stats.activeCount}</p>
                                                <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5">Ativas</p>
                                            </div>
                                            <div className="bg-rose-500/10 rounded-xl p-3">
                                                <p className="text-lg font-black text-rose-400">{stats.overdueCount}</p>
                                                <p className="text-[9px] font-bold text-rose-600 uppercase tracking-widest mt-0.5">Atraso</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-1 border-t border-white/5">
                                            <div>
                                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">MRR deste plano</p>
                                                <p className="text-base font-black text-white mt-0.5">{fmtMRR(stats.mrr)}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Limite</p>
                                                <p className="text-xs font-bold text-slate-300 mt-0.5">{plan.vehicleLimit}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Subscriptions Table */}
                    <div>
                        <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Todas as Assinaturas</h2>
                        <div className="bg-[#161B26] border border-white/10 rounded-2xl overflow-hidden">
                            {sortedCompanies.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-3">
                                    <BarChart2 size={36} className="text-slate-700" />
                                    <p className="text-slate-500">Nenhuma assinatura encontrada.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="border-b border-white/10 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            <tr>
                                                <th className="px-5 py-4">Empresa</th>
                                                <th className="px-5 py-4">Plano</th>
                                                <th className="px-5 py-4">Status</th>
                                                <th className="px-5 py-4">MRR</th>
                                                <th className="px-5 py-4">Vencimento</th>
                                                <th className="px-5 py-4">Kiwify Email</th>
                                                <th className="px-5 py-4 text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {sortedCompanies.map(company => {
                                                const sub = company.subscription;
                                                const status = sub?.status ?? 'trial';
                                                const badge = STATUS_LABEL[status] ?? STATUS_LABEL['trial'];
                                                const planKey = sub?.plan ?? 'trial';
                                                const planColor = PLAN_COLOR[planKey] ?? PLAN_COLOR['trial'];
                                                const isProcessing = actionLoading === company.id;

                                                return (
                                                    <tr key={company.id} className="hover:bg-white/[0.02] transition-colors">
                                                        <td className="px-5 py-4">
                                                            <p className="font-bold text-white">{company.name}</p>
                                                            <p className="text-[10px] text-slate-600 mt-0.5">{company.id.slice(0, 8)}…</p>
                                                        </td>
                                                        <td className="px-5 py-4">
                                                            <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-full ${planColor}`}>
                                                                {PLAN_LABEL[planKey] ?? planKey}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-4">
                                                            <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-full ${badge.color}`}>
                                                                {badge.label}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-4 font-bold text-sm">
                                                            {sub?.mrr ? fmtMRR(sub.mrr) : '—'}
                                                        </td>
                                                        <td className="px-5 py-4 text-xs text-slate-400">
                                                            <div className="flex items-center gap-1">
                                                                <CalendarDays size={11} className="text-slate-600" />
                                                                {fmtDate(sub?.current_period_end ?? sub?.trial_ends_at)}
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-4 text-xs text-slate-500">
                                                            {sub?.kiwify_customer_email || '—'}
                                                        </td>
                                                        <td className="px-5 py-4">
                                                            <div className="flex justify-end gap-1.5">
                                                                {isProcessing ? (
                                                                    <Loader2 size={15} className="animate-spin text-slate-400" />
                                                                ) : (
                                                                    <>
                                                                        {status === 'blocked' ? (
                                                                            <button
                                                                                onClick={() => handleUnblock(company.id)}
                                                                                title="Desbloquear"
                                                                                className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                                                                            >
                                                                                <ShieldCheck size={13} />
                                                                            </button>
                                                                        ) : (
                                                                            <button
                                                                                onClick={() => setBlockModal({ companyId: company.id, name: company.name })}
                                                                                title="Bloquear"
                                                                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                                                                            >
                                                                                <ShieldOff size={13} />
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            onClick={() => {
                                                                                setExtendModal({ companyId: company.id, name: company.name });
                                                                                setExtendDays(30);
                                                                            }}
                                                                            title="Estender assinatura"
                                                                            className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors"
                                                                        >
                                                                            <CalendarDays size={13} />
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Modal: Bloquear */}
            {blockModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#161B26] border border-white/10 rounded-2xl p-7 w-full max-w-md shadow-2xl space-y-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
                                    <Ban size={18} className="text-rose-400" />
                                </div>
                                <div>
                                    <h3 className="font-black text-white">Bloquear Empresa</h3>
                                    <p className="text-xs text-slate-500">{blockModal.name}</p>
                                </div>
                            </div>
                            <button onClick={() => setBlockModal(null)} className="text-slate-500 hover:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Motivo (opcional)</label>
                            <textarea
                                className="w-full bg-[#0B0F17] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-rose-500/30 resize-none"
                                rows={3}
                                placeholder="Ex: Pagamento em atraso há 30 dias..."
                                value={blockReason}
                                onChange={e => setBlockReason(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setBlockModal(null)}
                                className="flex-1 py-3 rounded-xl border border-white/10 font-bold text-sm text-slate-300 hover:bg-white/5 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleBlock}
                                disabled={!!actionLoading}
                                className="flex-1 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-sm transition-colors disabled:opacity-50"
                            >
                                Bloquear
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Estender */}
            {extendModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#161B26] border border-white/10 rounded-2xl p-7 w-full max-w-md shadow-2xl space-y-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                    <CalendarDays size={18} className="text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="font-black text-white">Estender Assinatura</h3>
                                    <p className="text-xs text-slate-500">{extendModal.name}</p>
                                </div>
                            </div>
                            <button onClick={() => setExtendModal(null)} className="text-slate-500 hover:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Dias a adicionar</label>
                            <input
                                type="number"
                                min={1}
                                className="w-full bg-[#0B0F17] border border-white/10 rounded-xl px-4 py-3 text-sm font-black text-white outline-none focus:ring-2 focus:ring-blue-500/30"
                                value={extendDays}
                                onChange={e => setExtendDays(Number(e.target.value))}
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setExtendModal(null)}
                                className="flex-1 py-3 rounded-xl border border-white/10 font-bold text-sm text-slate-300 hover:bg-white/5 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleExtend}
                                disabled={!!actionLoading}
                                className="flex-1 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-black text-sm transition-colors disabled:opacity-50"
                            >
                                Estender
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Configurar URL Kiwify por Plano */}
            {kiwifyModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#161B26] border border-white/10 rounded-2xl p-7 w-full max-w-md shadow-2xl space-y-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                                    <Settings size={18} className="text-violet-400" />
                                </div>
                                <div>
                                    <h3 className="font-black text-white">Configurar URL Kiwify</h3>
                                    <p className="text-xs text-slate-500">Plano {kiwifyModal.name}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setKiwifyModal(null); setKiwifySaved(false); }}
                                className="text-slate-500 hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                                URL do Checkout Kiwify — {kiwifyModal.name}
                            </label>
                            <input
                                type="url"
                                className="w-full bg-[#0B0F17] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-violet-500/30"
                                placeholder="https://pay.kiwify.com.br/..."
                                value={kiwifyUrl}
                                onChange={e => { setKiwifyUrl(e.target.value); setKiwifySaved(false); }}
                            />
                        </div>

                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex items-start gap-2.5">
                            <AlertCircle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-amber-300 leading-relaxed">
                                Após salvar, atualize <code className="font-mono bg-amber-500/20 px-1 rounded">KIWIFY_CHECKOUT_URLS</code> em <code className="font-mono bg-amber-500/20 px-1 rounded">services.ts</code> para sincronizar com o código local.
                            </p>
                        </div>

                        {kiwifySaved && (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 flex items-center gap-2.5">
                                <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                                <p className="text-xs text-emerald-300">URL salva no banco com sucesso.</p>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setKiwifyModal(null); setKiwifySaved(false); }}
                                className="flex-1 py-3 rounded-xl border border-white/10 font-bold text-sm text-slate-300 hover:bg-white/5 transition-colors"
                            >
                                Fechar
                            </button>
                            <button
                                onClick={handleSaveKiwifyUrl}
                                disabled={kiwifySaving || !kiwifyUrl}
                                className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-black text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {kiwifySaving && <Loader2 size={14} className="animate-spin" />}
                                Salvar URL
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
