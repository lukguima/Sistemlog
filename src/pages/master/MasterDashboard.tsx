import { useState, useEffect, useCallback } from 'react';
import {
    Building2, TrendingUp, TrendingDown, Users, AlertCircle,
    DollarSign, Loader2, ShieldOff, ShieldCheck, Clock,
    CalendarDays, RefreshCw, Ban, CheckCircle, ChevronDown, Link as LinkIcon
} from 'lucide-react';
import { masterService, KIWIFY_CHECKOUT_URLS } from '../../lib/services';
import { SUBSCRIPTION_PLANS } from '../../lib/constants';
import { supabase } from '../../lib/supabase';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
    trial:    { label: 'Trial',    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' },
    active:   { label: 'Ativo',   color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' },
    overdue:  { label: 'Atraso',  color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400' },
    canceled: { label: 'Cancelado',color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
    blocked:  { label: 'Bloqueado',color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400' },
};

const PLAN_LABEL: Record<string, string> = {
    trial:     'Trial',
    basico:    'Básico',
    pro:       'Pro',
    enterprise:'Enterprise',
};

export default function MasterDashboard() {
    const [companies, setCompanies]   = useState<any[]>([]);
    const [kpis, setKpis]             = useState<any>(null);
    const [loading, setLoading]       = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [blockModal, setBlockModal] = useState<{ companyId: string; name: string } | null>(null);
    const [blockReason, setBlockReason] = useState('');
    const [extendModal, setExtendModal] = useState<{ companyId: string; name: string } | null>(null);
    const [extendDays, setExtendDays] = useState(30);
    const [urlModal, setUrlModal]     = useState<{ companyId: string; name: string } | null>(null);
    const [customUrl, setCustomUrl]   = useState('');
    const [planModal, setPlanModal]   = useState<{ companyId: string; name: string; currentPlan: string } | null>(null);
    const [selectedPlan, setSelectedPlan] = useState('pro');
    const [filterStatus, setFilterStatus] = useState<string>('all');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [companiesData, kpisData] = await Promise.all([
                masterService.getAllCompaniesWithSubscriptions(),
                masterService.getMasterKpis(),
            ]);
            setCompanies(companiesData);
            setKpis(kpisData);
        } catch (err: any) {
            console.error('Erro ao buscar dados master:', err?.message ?? err?.code ?? JSON.stringify(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Real-time: escutar mudanças em subscriptions
    useEffect(() => {
        const channel = supabase
            .channel('master-subscriptions')
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

    const handleChangePlan = async () => {
        if (!planModal) return;
        setActionLoading(planModal.companyId);
        try {
            await masterService.changePlan(planModal.companyId, selectedPlan);
            setPlanModal(null);
            await fetchData();
        } catch (err) { console.error(err); }
        finally { setActionLoading(null); }
    };

    const handleSetUrl = async () => {
        if (!urlModal) return;
        setActionLoading(urlModal.companyId);
        try {
            await masterService.setCheckoutUrl(urlModal.companyId, customUrl);
            setUrlModal(null);
            setCustomUrl('');
            await fetchData();
        } catch (err) { console.error(err); }
        finally { setActionLoading(null); }
    };

    const filtered = companies.filter(c => {
        if (filterStatus === 'all') return true;
        return c.subscription?.status === filterStatus;
    });

    const fmtDate = (d: string | null) =>
        d ? new Date(d).toLocaleDateString('pt-BR') : '—';

    const fmtMRR = (n: number) =>
        n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 font-display">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-1">Painel Master — SistemLog</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Controle total de assinaturas, cobranças e empresas.</p>
                </div>
                <button onClick={fetchData} disabled={loading} className="flex items-center gap-2 px-4 py-2 text-sm font-bold border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50">
                    <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    Atualizar
                </button>
            </div>

            {loading && !kpis ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
            ) : (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="card p-6">
                            <div className="flex justify-between items-start mb-3">
                                <div className="bg-emerald-500/10 p-2 rounded-lg"><DollarSign size={20} className="text-emerald-600" /></div>
                                <span className="text-xs font-bold text-emerald-500 flex items-center gap-1"><TrendingUp size={13} /> MRR</span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium">MRR Ativo</p>
                            <p className="text-2xl font-black mt-1">{fmtMRR(kpis?.totalMRR || 0)}</p>
                        </div>

                        <div className="card p-6">
                            <div className="flex justify-between items-start mb-3">
                                <div className="bg-rose-500/10 p-2 rounded-lg"><AlertCircle size={20} className="text-rose-500" /></div>
                                <span className="text-xs font-bold text-rose-500">{kpis?.overdueCount || 0} empresa{kpis?.overdueCount !== 1 ? 's' : ''}</span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium">Em Atraso</p>
                            <p className="text-2xl font-black mt-1 text-rose-500">{fmtMRR(kpis?.overdueValue || 0)}</p>
                        </div>

                        <div className="card p-6">
                            <div className="flex justify-between items-start mb-3">
                                <div className="bg-primary/10 p-2 rounded-lg"><Building2 size={20} className="text-primary" /></div>
                            </div>
                            <p className="text-xs text-slate-500 font-medium">Empresas Ativas</p>
                            <p className="text-2xl font-black mt-1">{kpis?.activeCount || 0}</p>
                        </div>

                        <div className="card p-6">
                            <div className="flex justify-between items-start mb-3">
                                <div className="bg-amber-500/10 p-2 rounded-lg"><Clock size={20} className="text-amber-500" /></div>
                                <span className="text-xs font-bold text-slate-400 flex items-center gap-1"><TrendingDown size={13} /> churn</span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium">Trial / Cancelados</p>
                            <p className="text-2xl font-black mt-1">{(kpis?.trialCount || 0)} / {(kpis?.canceledCount || 0)}</p>
                        </div>
                    </div>

                    {/* Tabela de empresas */}
                    <div className="card overflow-hidden">
                        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/30">
                            <h2 className="text-base font-black">Empresas Cadastradas</h2>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">Filtrar:</span>
                                <div className="relative">
                                    <select
                                        value={filterStatus}
                                        onChange={e => setFilterStatus(e.target.value)}
                                        className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold pr-7 outline-none focus:ring-2 focus:ring-primary/30"
                                    >
                                        <option value="all">Todos ({companies.length})</option>
                                        <option value="trial">Trial ({kpis?.trialCount || 0})</option>
                                        <option value="active">Ativo ({kpis?.activeCount || 0})</option>
                                        <option value="overdue">Atraso ({kpis?.overdueCount || 0})</option>
                                        <option value="blocked">Bloqueado</option>
                                        <option value="canceled">Cancelado ({kpis?.canceledCount || 0})</option>
                                    </select>
                                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-5 py-4">Empresa</th>
                                        <th className="px-5 py-4">Plano</th>
                                        <th className="px-5 py-4">Status</th>
                                        <th className="px-5 py-4">MRR</th>
                                        <th className="px-5 py-4">Vencimento</th>
                                        <th className="px-5 py-4">Atraso desde</th>
                                        <th className="px-5 py-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                    {filtered.length === 0 ? (
                                        <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">Nenhuma empresa encontrada.</td></tr>
                                    ) : filtered.map(company => {
                                        const sub    = company.subscription;
                                        const status = sub?.status ?? 'trial';
                                        const badge  = STATUS_LABEL[status] ?? STATUS_LABEL['trial'];
                                        const isProcessing = actionLoading === company.id;

                                        return (
                                            <tr key={company.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                                <td className="px-5 py-4">
                                                    <p className="font-bold text-slate-900 dark:text-white">{company.name}</p>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">{sub?.kiwify_customer_email || company.adminEmail || 'email não vinculado'}</p>
                                                    {company.adminPhone && (
                                                        <p className="text-[10px] text-slate-500 mt-0.5">{company.adminPhone}</p>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                                        {PLAN_LABEL[sub?.plan ?? 'trial'] ?? sub?.plan ?? '—'}
                                                    </span>
                                                    {sub?.vehicle_limit != null && (
                                                        <p className="text-[9px] text-slate-400 mt-0.5">até {sub.vehicle_limit} veíc.</p>
                                                    )}
                                                    {sub?.vehicle_limit == null && sub?.plan === 'enterprise' && (
                                                        <p className="text-[9px] text-slate-400 mt-0.5">ilimitado</p>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className={`px-2 py-1 text-[10px] font-black uppercase rounded-full ${badge.color}`}>
                                                        {badge.label}
                                                    </span>
                                                    {status === 'blocked' && sub?.block_reason && (
                                                        <p className="text-[9px] text-orange-500 mt-1 max-w-[120px] truncate" title={sub.block_reason}>{sub.block_reason}</p>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 font-bold text-sm">
                                                    {sub?.mrr ? fmtMRR(sub.mrr) : '—'}
                                                </td>
                                                <td className="px-5 py-4 text-xs text-slate-500">
                                                    <div className="flex items-center gap-1">
                                                        <CalendarDays size={12} />
                                                        {fmtDate(sub?.current_period_end ?? sub?.trial_ends_at)}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-xs">
                                                    {sub?.overdue_since
                                                        ? <span className="text-rose-500 font-bold">{fmtDate(sub.overdue_since)}</span>
                                                        : <span className="text-slate-300">—</span>
                                                    }
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex justify-end gap-1 flex-wrap">
                                                        {isProcessing ? (
                                                            <Loader2 size={16} className="animate-spin text-slate-400" />
                                                        ) : (
                                                            <>
                                                                {/* Bloquear / Desbloquear */}
                                                                {status === 'blocked' ? (
                                                                    <button
                                                                        onClick={() => handleUnblock(company.id)}
                                                                        title="Desbloquear empresa"
                                                                        className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/10 dark:hover:bg-emerald-900/30 text-emerald-600 transition-colors"
                                                                    >
                                                                        <ShieldCheck size={15} />
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => setBlockModal({ companyId: company.id, name: company.name })}
                                                                        title="Bloquear empresa"
                                                                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/10 dark:hover:bg-rose-900/30 text-rose-500 transition-colors"
                                                                    >
                                                                        <ShieldOff size={15} />
                                                                    </button>
                                                                )}

                                                                {/* Estender assinatura */}
                                                                <button
                                                                    onClick={() => { setExtendModal({ companyId: company.id, name: company.name }); setExtendDays(30); }}
                                                                    title="Estender assinatura"
                                                                    className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/10 dark:hover:bg-blue-900/30 text-blue-500 transition-colors"
                                                                >
                                                                    <CalendarDays size={15} />
                                                                </button>

                                                                {/* Configurar URL Kiwify */}
                                                                <button
                                                                    onClick={() => { setUrlModal({ companyId: company.id, name: company.name }); const p = sub?.plan ?? 'pro'; setCustomUrl(sub?.checkout_url || KIWIFY_CHECKOUT_URLS[p] || KIWIFY_CHECKOUT_URLS['pro'] || ''); }}
                                                                    title="Configurar link de pagamento"
                                                                    className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/10 dark:hover:bg-amber-900/30 text-amber-600 transition-colors"
                                                                >
                                                                    <LinkIcon size={15} />
                                                                </button>

                                                                {/* Alterar plano */}
                                                                <button
                                                                    onClick={() => { setPlanModal({ companyId: company.id, name: company.name, currentPlan: sub?.plan ?? 'trial' }); setSelectedPlan(sub?.plan ?? 'pro'); }}
                                                                    title="Alterar plano"
                                                                    className="p-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/10 dark:hover:bg-purple-900/30 text-purple-600 transition-colors"
                                                                >
                                                                    <Users size={15} />
                                                                </button>

                                                                {/* Ativar manualmente */}
                                                                {(status === 'overdue' || status === 'canceled') && (
                                                                    <button
                                                                        onClick={() => handleUnblock(company.id)}
                                                                        title="Ativar manualmente"
                                                                        className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors"
                                                                    >
                                                                        <CheckCircle size={15} />
                                                                    </button>
                                                                )}
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
                    </div>

                    {/* Legenda de ações */}
                    <div className="flex flex-wrap gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                        <span className="flex items-center gap-1"><ShieldOff size={12} className="text-rose-400" /> Bloquear</span>
                        <span className="flex items-center gap-1"><ShieldCheck size={12} className="text-emerald-500" /> Desbloquear</span>
                        <span className="flex items-center gap-1"><CalendarDays size={12} className="text-blue-400" /> Estender período</span>
                        <span className="flex items-center gap-1"><LinkIcon size={12} className="text-amber-500" /> Link de pagamento</span>
                        <span className="flex items-center gap-1"><CheckCircle size={12} className="text-emerald-500" /> Ativar manualmente</span>
                        <span className="flex items-center gap-1"><Users size={12} className="text-purple-500" /> Alterar plano</span>
                    </div>
                </>
            )}

            {/* ── Modal: Bloquear empresa ── */}
            {blockModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center"><Ban size={20} className="text-rose-500" /></div>
                            <div>
                                <h3 className="font-black text-slate-900 dark:text-white">Bloquear Empresa</h3>
                                <p className="text-xs text-slate-400">{blockModal.name}</p>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Motivo (opcional)</label>
                            <textarea
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                                rows={3}
                                placeholder="Ex: Pagamento em atraso há 30 dias..."
                                value={blockReason}
                                onChange={e => setBlockReason(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setBlockModal(null)} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors">Cancelar</button>
                            <button onClick={handleBlock} disabled={!!actionLoading} className="flex-1 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-sm transition-colors disabled:opacity-50">Bloquear</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: Estender assinatura ── */}
            {extendModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center"><CalendarDays size={20} className="text-blue-500" /></div>
                            <div>
                                <h3 className="font-black text-slate-900 dark:text-white">Estender Assinatura</h3>
                                <p className="text-xs text-slate-400">{extendModal.name}</p>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Dias a adicionar</label>
                            <input
                                type="number"
                                min={1}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-black outline-none focus:ring-2 focus:ring-primary/50"
                                value={extendDays}
                                onChange={e => setExtendDays(Number(e.target.value))}
                            />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setExtendModal(null)} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors">Cancelar</button>
                            <button onClick={handleExtend} disabled={!!actionLoading} className="flex-1 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-black text-sm transition-colors disabled:opacity-50">Estender</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: Alterar plano ── */}
            {planModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center"><Users size={20} className="text-purple-600" /></div>
                            <div>
                                <h3 className="font-black text-slate-900 dark:text-white">Alterar Plano</h3>
                                <p className="text-xs text-slate-400">{planModal.name} · atual: <span className="capitalize font-bold text-slate-600">{planModal.currentPlan}</span></p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {(Object.values(SUBSCRIPTION_PLANS) as typeof SUBSCRIPTION_PLANS[keyof typeof SUBSCRIPTION_PLANS][]).map(plan => (
                                <label
                                    key={plan.id}
                                    className={`flex items-center justify-between gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                        selectedPlan === plan.id
                                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/10'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <input type="radio" name="plan" value={plan.id} checked={selectedPlan === plan.id} onChange={() => setSelectedPlan(plan.id)} className="accent-purple-600" />
                                        <div>
                                            <p className="font-black text-sm text-slate-900 dark:text-white">{plan.name}</p>
                                            <p className="text-[10px] text-slate-400">
                                                {plan.vehicleLimit === Infinity ? 'Ilimitado' : `Até ${plan.vehicleLimit} veículos`}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-sm font-black text-slate-700 dark:text-slate-300">
                                        R$ {plan.price}/mês
                                    </span>
                                </label>
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setPlanModal(null)} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors">Cancelar</button>
                            <button onClick={handleChangePlan} disabled={!!actionLoading || selectedPlan === planModal.currentPlan} className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-sm transition-colors disabled:opacity-50">Aplicar Plano</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: Configurar link de pagamento ── */}
            {urlModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center"><LinkIcon size={20} className="text-amber-500" /></div>
                            <div>
                                <h3 className="font-black text-slate-900 dark:text-white">Link de Pagamento Kiwify</h3>
                                <p className="text-xs text-slate-400">{urlModal.name}</p>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block">URL do Checkout Kiwify</label>
                            <input
                                type="url"
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="https://pay.kiwify.com.br/..."
                                value={customUrl}
                                onChange={e => setCustomUrl(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setUrlModal(null)} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors">Cancelar</button>
                            <button onClick={handleSetUrl} disabled={!!actionLoading || !customUrl} className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-sm transition-colors disabled:opacity-50">Salvar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
