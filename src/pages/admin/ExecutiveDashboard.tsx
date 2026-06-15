import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dreService, accountsPayableService, accountsReceivableService, financingService, vehicleProfitabilityService } from '../../lib/financial.services';
import { aiInsightService, type AiInsight } from '../../lib/ai.services';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import {
    LayoutDashboard, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
    Truck, DollarSign, CreditCard, BarChart3, Bot, ChevronRight,
    RefreshCw, ShieldAlert, Calendar, Banknote
} from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
const today = () => new Date();
const isoDate = (d: Date) => d.toISOString().split('T')[0];
const firstDayOfMonth = () => { const d = today(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };
const lastDayOfMonth = () => { const d = today(); return isoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };
const daysFromNow = (days: number) => { const d = today(); d.setDate(d.getDate() + days); return isoDate(d); };

function HealthBadge({ score }: { score: number }) {
    const { label, color, bg } =
        score >= 80 ? { label: 'Saudável', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' } :
        score >= 55 ? { label: 'Atenção', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' } :
        { label: 'Crítico', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' };
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${bg} ${color}`}>
            <span className={`w-2 h-2 rounded-full ${score >= 80 ? 'bg-emerald-500' : score >= 55 ? 'bg-amber-500' : 'bg-rose-500'} animate-pulse`} />
            {label} · {score}/100
        </span>
    );
}

function KpiCard({ icon: Icon, label, value, sub, color = 'blue', trend }: {
    icon: React.ElementType; label: string; value: string; sub?: string;
    color?: string; trend?: 'up' | 'down' | 'neutral';
}) {
    const colors: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-emerald-50 text-emerald-600',
        red: 'bg-rose-50 text-rose-600',
        amber: 'bg-amber-50 text-amber-600',
        purple: 'bg-purple-50 text-purple-600',
        indigo: 'bg-indigo-50 text-indigo-600',
    };
    return (
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colors[color] ?? colors.blue}`}>
                    <Icon size={18} />
                </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 leading-tight">{value}</p>
            {sub && (
                <p className={`text-xs mt-1 flex items-center gap-1 ${trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-rose-600' : 'text-slate-500'}`}>
                    {trend === 'up' && <TrendingUp size={11} />}
                    {trend === 'down' && <TrendingDown size={11} />}
                    {sub}
                </p>
            )}
        </div>
    );
}

function RiskHorizon({ days, payables }: { days: number; payables: any[] }) {
    const cutoff = daysFromNow(days);
    const todayStr = isoDate(today());
    const items = payables.filter(p => !p.paid && p.due_date <= cutoff);
    const overdue = items.filter(p => p.due_date < todayStr);
    const total = items.reduce((s: number, p: any) => s + Number(p.amount), 0);
    const color = overdue.length > 0 ? 'border-rose-200 bg-rose-50' : total > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50';
    const textColor = overdue.length > 0 ? 'text-rose-700' : total > 0 ? 'text-amber-700' : 'text-emerald-700';
    return (
        <div className={`rounded-2xl border p-4 text-center ${color}`}>
            <p className="text-xs font-medium text-slate-500 mb-1">{days} dias</p>
            <p className={`text-lg font-bold ${textColor}`}>{fmt(total)}</p>
            <p className="text-xs text-slate-500 mt-0.5">{items.length} título{items.length !== 1 ? 's' : ''}</p>
            {overdue.length > 0 && <p className="text-xs text-rose-600 font-medium mt-1">{overdue.length} vencido{overdue.length !== 1 ? 's' : ''}</p>}
        </div>
    );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExecutiveDashboard() {
    const { user } = useAuth();
    const companyId = user?.company_id ?? '';

    const [dre, setDre] = useState<any>(null);
    const [payables, setPayables] = useState<any[]>([]);
    const [receivables, setReceivables] = useState<any[]>([]);
    const [monthlyFinancing, setMonthlyFinancing] = useState(0);
    const [totalDebt, setTotalDebt] = useState(0);
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [insights, setInsights] = useState<AiInsight[]>([]);
    const [tripsCount, setTripsCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState('');

    const load = useCallback(async () => {
        if (!companyId) return;
        setLoading(true);
        try {
            const start = firstDayOfMonth();
            const end = lastDayOfMonth();

            const [dreData, pData, rData, mCommit, finsData, vProfit, insData, tripsData] = await Promise.all([
                dreService.get(companyId, start, end),
                accountsPayableService.getAll(companyId),
                accountsReceivableService.getAll(companyId),
                financingService.getMonthlyCommitment(companyId),
                financingService.getAll(companyId),
                vehicleProfitabilityService.get(companyId, start, end),
                aiInsightService.getAll(companyId),
                supabase.from('trips').select('id', { count: 'exact', head: true })
                    .eq('company_id', companyId)
                    .gte('created_at', `${start}T00:00:00`)
                    .lte('created_at', `${end}T23:59:59`),
            ]);

            setDre(dreData);
            setPayables(pData);
            setReceivables(rData);
            setMonthlyFinancing(mCommit);
            const debt = (finsData as any[]).filter(f => f.status === 'ativo').reduce((s: number, f: any) => s + Number(f.remaining_balance ?? 0), 0);
            setTotalDebt(debt);
            setVehicles(vProfit);
            setInsights(insData);
            setTripsCount(tripsData.count ?? 0);
            setLastUpdated(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    useEffect(() => { load(); }, [load]);

    // ── Cálculos derivados ────────────────────────────────────────────────────
    const totalPayables = payables.filter(p => !p.paid).reduce((s: number, p: any) => s + Number(p.amount), 0);
    const totalReceivables = receivables.filter(r => !r.received).reduce((s: number, r: any) => s + Number(r.amount), 0);
    const overduePayables = payables.filter(p => !p.paid && p.due_date < isoDate(today()));
    const overduePayablesAmt = overduePayables.reduce((s: number, p: any) => s + Number(p.amount), 0);

    const cashPosition = totalReceivables - totalPayables;

    const vehiclesAlert = vehicles.filter(v => (v.status === 'prejuizo' || v.status === 'atencao') && v.trips > 0);
    const vehiclesProfit = vehicles.filter(v => v.status === 'lucrativo');

    // Escore de saúde (0-100)
    const healthScore = (() => {
        if (!dre) return 50;
        let score = 100;
        if (dre.margem < 0) score -= 30;
        else if (dre.margem < 10) score -= 15;
        else if (dre.margem < 20) score -= 5;
        if (overduePayables.length > 0) score -= Math.min(20, overduePayables.length * 5);
        if (vehiclesAlert.filter(v => v.status === 'prejuizo').length > 0) score -= 10;
        if (cashPosition < 0) score -= 15;
        if (monthlyFinancing > 0 && dre.receitaBruta > 0 && (monthlyFinancing / dre.receitaBruta) > 0.35) score -= 10;
        return Math.max(0, Math.min(100, score));
    })();

    const criticalInsights = insights.filter(i => !i.is_read && (i.severity === 'critical' || i.severity === 'warning')).slice(0, 3);
    const topInsight = insights.find(i => !i.is_read && i.severity === 'critical') ?? insights.find(i => !i.is_read) ?? null;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <div className="w-10 h-10 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                <p className="text-sm text-slate-400">Carregando painel executivo...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                        <LayoutDashboard size={22} className="text-slate-700" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Painel Executivo</h1>
                        <p className="text-xs text-slate-500">Visão consolidada · Atualizado às {lastUpdated}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <HealthBadge score={healthScore} />
                    <button onClick={load} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <RefreshCw size={16} className="text-slate-500" />
                    </button>
                </div>
            </div>

            {/* Alerta crítico da IA */}
            {topInsight && (
                <Link to="/admin/risks"
                    className={`flex items-center gap-3 p-4 rounded-2xl border text-sm cursor-pointer transition-shadow hover:shadow-md ${
                        topInsight.severity === 'critical' ? 'bg-rose-50 border-rose-200 text-rose-800' :
                        'bg-amber-50 border-amber-200 text-amber-800'
                    }`}>
                    <Bot size={18} className="flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <span className="font-semibold">IA: </span>
                        <span className="truncate">{topInsight.title}</span>
                    </div>
                    <ChevronRight size={16} className="flex-shrink-0" />
                </Link>
            )}

            {/* KPIs principais */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    icon={Banknote}
                    label="Faturamento do Mês"
                    value={fmt(dre?.receitaBruta ?? 0)}
                    sub={`${tripsCount} viagens no período`}
                    color="blue"
                />
                <KpiCard
                    icon={dre?.resultadoLiquido >= 0 ? TrendingUp : TrendingDown}
                    label="Resultado Líquido"
                    value={fmt(dre?.resultadoLiquido ?? 0)}
                    sub={`Margem ${fmtPct(dre?.margem ?? 0)}`}
                    color={dre?.resultadoLiquido >= 0 ? 'green' : 'red'}
                    trend={dre?.resultadoLiquido >= 0 ? 'up' : 'down'}
                />
                <KpiCard
                    icon={DollarSign}
                    label="Posição de Caixa"
                    value={fmt(cashPosition)}
                    sub={cashPosition >= 0 ? 'Recebíveis > Obrigações' : 'Obrigações > Recebíveis'}
                    color={cashPosition >= 0 ? 'green' : 'red'}
                    trend={cashPosition >= 0 ? 'up' : 'down'}
                />
                <KpiCard
                    icon={CreditCard}
                    label="Endividamento Total"
                    value={fmt(totalDebt)}
                    sub={`R$ ${monthlyFinancing.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}/mês de parcelas`}
                    color="purple"
                />
            </div>

            {/* Linha 2 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard icon={AlertTriangle} label="A Pagar (aberto)" value={fmt(totalPayables)}
                    sub={overduePayables.length > 0 ? `${overduePayables.length} vencido(s): ${fmt(overduePayablesAmt)}` : 'Sem vencidos'}
                    color={overduePayables.length > 0 ? 'red' : 'amber'} />
                <KpiCard icon={CheckCircle2} label="A Receber (aberto)" value={fmt(totalReceivables)}
                    sub={`${receivables.filter(r => !r.received).length} título(s) em aberto`}
                    color="green" />
                <KpiCard icon={BarChart3} label="Margem Líquida" value={`${(dre?.margem ?? 0).toFixed(1)}%`}
                    sub={dre?.margem >= 20 ? 'Saudável (>20%)' : dre?.margem >= 10 ? 'Atenção (10-20%)' : 'Crítico (<10%)'}
                    color={dre?.margem >= 20 ? 'green' : dre?.margem >= 10 ? 'amber' : 'red'}
                    trend={dre?.margem >= 10 ? 'up' : 'down'} />
                <KpiCard icon={Truck} label="Caminhões Ativos" value={`${vehiclesProfit.length + vehiclesAlert.length}`}
                    sub={`${vehiclesProfit.length} lucrativos · ${vehiclesAlert.length} em atenção`}
                    color={vehiclesAlert.filter(v => v.status === 'prejuizo').length > 0 ? 'red' : 'indigo'} />
            </div>

            {/* Horizonte de Risco + Frota */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Risco por horizonte */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                            <Calendar size={18} className="text-slate-400" /> Obrigações por Horizonte
                        </h2>
                        <Link to="/admin/financial" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                            Ver detalhes <ChevronRight size={12} />
                        </Link>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <RiskHorizon days={7} payables={payables} />
                        <RiskHorizon days={15} payables={payables} />
                        <RiskHorizon days={30} payables={payables} />
                    </div>
                    {overduePayables.length > 0 && (
                        <div className="mt-3 p-3 bg-rose-50 rounded-xl text-xs text-rose-700">
                            <strong>{overduePayables.length} conta{overduePayables.length > 1 ? 's' : ''} vencida{overduePayables.length > 1 ? 's' : ''}</strong> — Total: {fmt(overduePayablesAmt)}
                        </div>
                    )}
                </div>

                {/* Caminhões em Atenção */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                            <Truck size={18} className="text-slate-400" /> Caminhões em Atenção
                        </h2>
                        <Link to="/admin/vehicle-profitability" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                            Análise completa <ChevronRight size={12} />
                        </Link>
                    </div>
                    {vehiclesAlert.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <CheckCircle2 size={32} className="text-emerald-400 mb-2" />
                            <p className="text-sm font-medium text-slate-700">Frota saudável</p>
                            <p className="text-xs text-slate-400">Todos os veículos com margem positiva</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {vehiclesAlert.slice(0, 5).map(v => (
                                <div key={v.vehicle_id} className={`flex items-center justify-between p-3 rounded-xl ${v.status === 'prejuizo' ? 'bg-rose-50' : 'bg-amber-50'}`}>
                                    <div className="flex items-center gap-2">
                                        <Truck size={14} className={v.status === 'prejuizo' ? 'text-rose-500' : 'text-amber-500'} />
                                        <span className="text-sm font-medium text-slate-800">{v.plate}</span>
                                        <span className="text-xs text-slate-500">{v.model}</span>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-sm font-bold ${v.status === 'prejuizo' ? 'text-rose-700' : 'text-amber-700'}`}>{fmt(v.profit)}</p>
                                        <p className="text-xs text-slate-500">{v.margin?.toFixed(1)}% margem</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* DRE Resumido + Insights IA */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* DRE compacto */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                            <BarChart3 size={18} className="text-slate-400" /> DRE do Mês
                        </h2>
                        <Link to="/admin/dre" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                            DRE completo <ChevronRight size={12} />
                        </Link>
                    </div>
                    {dre && (
                        <table className="w-full text-sm">
                            <tbody>
                                {[
                                    { label: 'Receita Bruta', value: dre.receitaBruta, bold: true, positive: true },
                                    { label: '  Fretes', value: dre.receitaFretes, sub: true },
                                    { label: '  Outros', value: dre.receitasExtras, sub: true },
                                    { label: 'Custos Operacionais', value: -dre.custosOperacionais },
                                    { label: 'Lucro Bruto', value: dre.lucroBruto, bold: true },
                                    { label: 'Despesas Totais', value: -dre.despesasTotais },
                                    { label: 'Resultado Líquido', value: dre.resultadoLiquido, bold: true, highlight: true },
                                ].map(row => (
                                    <tr key={row.label} className={row.highlight ? 'bg-slate-50 rounded-lg' : ''}>
                                        <td className={`py-1.5 ${row.sub ? 'pl-4 text-slate-500' : row.bold ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                                            {row.label}
                                        </td>
                                        <td className={`py-1.5 text-right ${row.bold ? 'font-semibold' : ''} ${
                                            row.value >= 0 ? 'text-slate-800' : 'text-rose-600'
                                        }`}>
                                            {fmt(row.value)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Alertas IA */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                            <ShieldAlert size={18} className="text-slate-400" /> Alertas do Gestor IA
                        </h2>
                        <Link to="/admin/risks" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                            Ver todos <ChevronRight size={12} />
                        </Link>
                    </div>
                    {criticalInsights.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <CheckCircle2 size={32} className="text-emerald-400 mb-2" />
                            <p className="text-sm font-medium text-slate-700">Nenhum alerta ativo</p>
                            <p className="text-xs text-slate-400">Use o Gestor IA para gerar análises automáticas</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {criticalInsights.map(i => (
                                <div key={i.id} className={`p-3 rounded-xl border text-sm ${
                                    i.severity === 'critical' ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'
                                }`}>
                                    <p className={`font-medium text-sm mb-0.5 ${i.severity === 'critical' ? 'text-rose-800' : 'text-amber-800'}`}>{i.title}</p>
                                    <p className="text-xs text-slate-600 line-clamp-2">{i.content}</p>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
                        <Link to="/admin/ai-manager"
                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-sm hover:bg-indigo-100 transition-colors">
                            <Bot size={15} /> Perguntar ao Gestor IA
                        </Link>
                    </div>
                </div>
            </div>

            {/* Atalhos */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Financeiro', href: '/admin/financial', icon: Banknote, color: 'text-blue-600 bg-blue-50 hover:bg-blue-100' },
                    { label: 'Fluxo de Caixa', href: '/admin/cash-flow', icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' },
                    { label: 'Rentabilidade', href: '/admin/vehicle-profitability', icon: BarChart3, color: 'text-purple-600 bg-purple-50 hover:bg-purple-100' },
                    { label: 'Financiamentos', href: '/admin/financings', icon: CreditCard, color: 'text-amber-600 bg-amber-50 hover:bg-amber-100' },
                ].map(s => (
                    <Link key={s.href} to={s.href}
                        className={`flex items-center gap-3 p-3 rounded-xl font-medium text-sm transition-colors ${s.color}`}>
                        <s.icon size={18} />
                        {s.label}
                        <ChevronRight size={14} className="ml-auto" />
                    </Link>
                ))}
            </div>
        </div>
    );
}
