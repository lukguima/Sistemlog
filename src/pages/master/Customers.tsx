import { useState, useEffect, useCallback } from 'react';
import {
    Building2, Search, Loader2, ShieldOff, ShieldCheck,
    CalendarDays, RefreshCw, Ban, CheckCircle, Users,
    Link as LinkIcon, ChevronDown, X
} from 'lucide-react';
import { masterService, KIWIFY_CHECKOUT_URLS } from '../../lib/services';
import { SUBSCRIPTION_PLANS } from '../../lib/constants';
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
    trial:      'bg-slate-500/20 text-slate-400 border border-slate-500/30',
    basico:     'bg-sky-500/20 text-sky-400 border border-sky-500/30',
    pro:        'bg-violet-500/20 text-violet-400 border border-violet-500/30',
    enterprise: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
};

const STATUS_FILTERS = [
    { value: 'all',      label: 'Todos' },
    { value: 'trial',    label: 'Trial' },
    { value: 'active',   label: 'Ativo' },
    { value: 'overdue',  label: 'Atraso' },
    { value: 'blocked',  label: 'Bloqueado' },
    { value: 'canceled', label: 'Cancelado' },
];

export default function Customers() {
    const [companies, setCompanies]         = useState<any[]>([]);
    const [loading, setLoading]             = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [search, setSearch]               = useState('');
    const [filterStatus, setFilterStatus]   = useState('all');

    const [blockModal, setBlockModal]   = useState<{ companyId: string; name: string } | null>(null);
    const [blockReason, setBlockReason] = useState('');

    const [extendModal, setExtendModal] = useState<{ companyId: string; name: string } | null>(null);
    const [extendDays, setExtendDays]   = useState(30);

    const [urlModal, setUrlModal]     = useState<{ companyId: string; name: string } | null>(null);
    const [customUrl, setCustomUrl]   = useState('');

    const [planModal, setPlanModal]       = useState<{ companyId: string; name: string; currentPlan: string } | null>(null);
    const [selectedPlan, setSelectedPlan] = useState('pro');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await masterService.getAllCompaniesWithSubscriptions();
            setCompanies(data);
        } catch (err) {
            console.error('Erro ao buscar empresas:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        const channel = supabase
            .channel('customers-subscriptions-rt')
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

    const handleActivate = async (companyId: string) => {
        setActionLoading(companyId);
        try {
            await masterService.unblockCompany(companyId);
            await fetchData();
        } catch (err) { console.error(err); }
        finally { setActionLoading(null); }
    };

    const filtered = companies.filter(c => {
        const sub = c.subscription;
        const matchesStatus = filterStatus === 'all' || sub?.status === filterStatus;
        const q = search.toLowerCase();
        const matchesSearch =
            !q ||
            c.name?.toLowerCase().includes(q) ||
            sub?.kiwify_customer_email?.toLowerCase().includes(q);
        return matchesStatus && matchesSearch;
    });

    const fmtDate = (d: string | null | undefined) =>
        d ? new Date(d).toLocaleDateString('pt-BR') : '—';

    const fmtMRR = (n: number) =>
        n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const statusCounts = companies.reduce<Record<string, number>>((acc, c) => {
        const s = c.subscription?.status ?? 'trial';
        acc[s] = (acc[s] || 0) + 1;
        return acc;
    }, {});

    return (
        <div className="min-h-screen bg-[#0B0F17] text-white p-6 md:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-violet-500/20 flex items-center justify-center">
                            <Building2 size={20} className="text-violet-400" />
                        </div>
                        Gestão de Empresas
                    </h1>
                    <p className="text-slate-400 text-sm mt-1 ml-12">
                        Gerencie clientes, planos e acessos da plataforma.
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

            {/* Search + Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Buscar por nome ou e-mail..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-[#161B26] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-violet-500/40"
                    />
                </div>
                <div className="relative">
                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        className="appearance-none bg-[#161B26] border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold pr-9 text-white outline-none focus:ring-2 focus:ring-violet-500/40 cursor-pointer"
                    >
                        {STATUS_FILTERS.map(f => (
                            <option key={f.value} value={f.value}>
                                {f.label}{f.value !== 'all' && statusCounts[f.value] ? ` (${statusCounts[f.value]})` : f.value === 'all' ? ` (${companies.length})` : ''}
                            </option>
                        ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
            </div>

            {/* Table */}
            <div className="bg-[#161B26] rounded-2xl border border-white/10 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <Loader2 size={32} className="text-violet-400 animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3">
                        <Building2 size={40} className="text-slate-600" />
                        <p className="text-slate-500 font-medium">
                            {search || filterStatus !== 'all' ? 'Nenhuma empresa encontrada para este filtro.' : 'Nenhuma empresa cadastrada ainda.'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-white/10 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                <tr>
                                    <th className="px-5 py-4">Empresa</th>
                                    <th className="px-5 py-4">Plano</th>
                                    <th className="px-5 py-4">Status</th>
                                    <th className="px-5 py-4">Veículos</th>
                                    <th className="px-5 py-4">MRR</th>
                                    <th className="px-5 py-4">Cadastro</th>
                                    <th className="px-5 py-4">Vencimento</th>
                                    <th className="px-5 py-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filtered.map(company => {
                                    const sub = company.subscription;
                                    const status = sub?.status ?? 'trial';
                                    const badge = STATUS_LABEL[status] ?? STATUS_LABEL['trial'];
                                    const planKey = sub?.plan ?? 'trial';
                                    const planBadge = PLAN_COLOR[planKey] ?? PLAN_COLOR['trial'];
                                    const isProcessing = actionLoading === company.id;

                                    return (
                                        <tr
                                            key={company.id}
                                            className="hover:bg-white/[0.02] transition-colors"
                                        >
                                            <td className="px-5 py-4">
                                                <p className="font-bold text-white">{company.name}</p>
                                                <p className="text-[11px] text-slate-500 mt-0.5">
                                                    {sub?.kiwify_customer_email || company.adminEmail || '—'}
                                                </p>
                                                {company.adminPhone && (
                                                    <p className="text-[11px] text-slate-600 mt-0.5">
                                                        {company.adminPhone}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-full ${planBadge}`}>
                                                    {PLAN_LABEL[planKey] ?? planKey}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-full ${badge.color}`}>
                                                    {badge.label}
                                                </span>
                                                {status === 'blocked' && sub?.block_reason && (
                                                    <p
                                                        className="text-[9px] text-orange-400 mt-1 max-w-[130px] truncate"
                                                        title={sub.block_reason}
                                                    >
                                                        {sub.block_reason}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-slate-400 text-xs">
                                                {sub?.vehicle_limit != null
                                                    ? (sub.vehicle_limit === 0 ? 'Ilimitado' : `Até ${sub.vehicle_limit}`)
                                                    : (planKey === 'enterprise' ? 'Ilimitado' : '—')}
                                            </td>
                                            <td className="px-5 py-4 font-bold text-sm">
                                                {sub?.mrr ? fmtMRR(sub.mrr) : '—'}
                                            </td>
                                            <td className="px-5 py-4 text-xs text-slate-500">
                                                {fmtDate(company.created_at)}
                                            </td>
                                            <td className="px-5 py-4 text-xs text-slate-400">
                                                <div className="flex items-center gap-1">
                                                    <CalendarDays size={11} className="text-slate-600" />
                                                    {fmtDate(sub?.current_period_end ?? sub?.trial_ends_at)}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex justify-end gap-1.5 flex-wrap">
                                                    {isProcessing ? (
                                                        <Loader2 size={16} className="animate-spin text-slate-400" />
                                                    ) : (
                                                        <>
                                                            {status === 'blocked' ? (
                                                                <button
                                                                    onClick={() => handleUnblock(company.id)}
                                                                    title="Desbloquear empresa"
                                                                    className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                                                                >
                                                                    <ShieldCheck size={14} />
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => setBlockModal({ companyId: company.id, name: company.name })}
                                                                    title="Bloquear empresa"
                                                                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                                                                >
                                                                    <ShieldOff size={14} />
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
                                                                <CalendarDays size={14} />
                                                            </button>

                                                            <button
                                                                onClick={() => {
                                                                    setUrlModal({ companyId: company.id, name: company.name });
                                                                    setCustomUrl(sub?.checkout_url || KIWIFY_CHECKOUT_URLS[planKey] || KIWIFY_CHECKOUT_URLS['pro'] || '');
                                                                }}
                                                                title="Configurar link de pagamento"
                                                                className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition-colors"
                                                            >
                                                                <LinkIcon size={14} />
                                                            </button>

                                                            <button
                                                                onClick={() => {
                                                                    setPlanModal({ companyId: company.id, name: company.name, currentPlan: planKey });
                                                                    setSelectedPlan(planKey === 'trial' ? 'basico' : planKey);
                                                                }}
                                                                title="Alterar plano"
                                                                className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 transition-colors"
                                                            >
                                                                <Users size={14} />
                                                            </button>

                                                            {(status === 'overdue' || status === 'canceled') && (
                                                                <button
                                                                    onClick={() => handleActivate(company.id)}
                                                                    title="Ativar manualmente"
                                                                    className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                                                                >
                                                                    <CheckCircle size={14} />
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
                )}
            </div>

            {/* Legend */}
            {!loading && filtered.length > 0 && (
                <div className="flex flex-wrap gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">
                    <span className="flex items-center gap-1.5"><ShieldOff size={11} className="text-rose-400" /> Bloquear</span>
                    <span className="flex items-center gap-1.5"><ShieldCheck size={11} className="text-emerald-400" /> Desbloquear</span>
                    <span className="flex items-center gap-1.5"><CalendarDays size={11} className="text-blue-400" /> Estender</span>
                    <span className="flex items-center gap-1.5"><LinkIcon size={11} className="text-amber-400" /> Link Kiwify</span>
                    <span className="flex items-center gap-1.5"><Users size={11} className="text-purple-400" /> Alterar Plano</span>
                    <span className="flex items-center gap-1.5"><CheckCircle size={11} className="text-emerald-400" /> Ativar</span>
                </div>
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

            {/* Modal: Alterar Plano */}
            {planModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#161B26] border border-white/10 rounded-2xl p-7 w-full max-w-md shadow-2xl space-y-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                    <Users size={18} className="text-purple-400" />
                                </div>
                                <div>
                                    <h3 className="font-black text-white">Alterar Plano</h3>
                                    <p className="text-xs text-slate-500">
                                        {planModal.name} · atual:{' '}
                                        <span className="capitalize font-bold text-slate-300">{planModal.currentPlan}</span>
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setPlanModal(null)} className="text-slate-500 hover:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="space-y-2">
                            {(Object.values(SUBSCRIPTION_PLANS) as typeof SUBSCRIPTION_PLANS[keyof typeof SUBSCRIPTION_PLANS][]).map(plan => (
                                <label
                                    key={plan.id}
                                    className={`flex items-center justify-between gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                        selectedPlan === plan.id
                                            ? 'border-purple-500 bg-purple-500/10'
                                            : 'border-white/10 hover:border-white/20'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="radio"
                                            name="plan"
                                            value={plan.id}
                                            checked={selectedPlan === plan.id}
                                            onChange={() => setSelectedPlan(plan.id)}
                                            className="accent-purple-500"
                                        />
                                        <div>
                                            <p className="font-black text-sm text-white">{plan.name}</p>
                                            <p className="text-[10px] text-slate-500">
                                                {plan.vehicleLimit === Infinity ? 'Ilimitado' : `Até ${plan.vehicleLimit} veículos`}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-sm font-black text-slate-300">
                                        R$ {plan.price}/mês
                                    </span>
                                </label>
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setPlanModal(null)}
                                className="flex-1 py-3 rounded-xl border border-white/10 font-bold text-sm text-slate-300 hover:bg-white/5 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleChangePlan}
                                disabled={!!actionLoading || selectedPlan === planModal.currentPlan}
                                className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-sm transition-colors disabled:opacity-50"
                            >
                                Aplicar Plano
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Configurar URL Kiwify */}
            {urlModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#161B26] border border-white/10 rounded-2xl p-7 w-full max-w-md shadow-2xl space-y-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                                    <LinkIcon size={18} className="text-amber-400" />
                                </div>
                                <div>
                                    <h3 className="font-black text-white">Link de Pagamento Kiwify</h3>
                                    <p className="text-xs text-slate-500">{urlModal.name}</p>
                                </div>
                            </div>
                            <button onClick={() => setUrlModal(null)} className="text-slate-500 hover:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">URL do Checkout Kiwify</label>
                            <input
                                type="url"
                                className="w-full bg-[#0B0F17] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-amber-500/30"
                                placeholder="https://pay.kiwify.com.br/..."
                                value={customUrl}
                                onChange={e => setCustomUrl(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setUrlModal(null)}
                                className="flex-1 py-3 rounded-xl border border-white/10 font-bold text-sm text-slate-300 hover:bg-white/5 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSetUrl}
                                disabled={!!actionLoading || !customUrl}
                                className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-sm transition-colors disabled:opacity-50"
                            >
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
