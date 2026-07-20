import { useState, useEffect } from 'react';
import { X, TrendingUp, DollarSign, Fuel, Wrench, Calendar, Truck, Activity, ArrowRightLeft } from 'lucide-react';
import { dashboardService, conjuntoHistoryService } from '../../lib/services';
import { useAuth } from '../../context/AuthContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

interface VehicleDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    vehicleId: string;
}

export default function VehicleDetailsModal({ isOpen, onClose, vehicleId }: VehicleDetailsModalProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>(null);
    const [conjuntoHistory, setConjuntoHistory] = useState<any[]>([]);
    const companyId = (user as any)?.company_id;

    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const defaultEnd = now.toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(defaultStart);
    const [endDate, setEndDate] = useState(defaultEnd);
    const [period, setPeriod] = useState<'month' | 'quarter' | 'year' | 'all' | 'custom'>('month');

    function applyPreset(preset: 'month' | 'quarter' | 'year' | 'all') {
        const d = new Date();
        let s = '';
        let e = d.toISOString().split('T')[0];
        if (preset === 'month') {
            s = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
        } else if (preset === 'quarter') {
            const q = Math.floor(d.getMonth() / 3);
            s = new Date(d.getFullYear(), q * 3, 1).toISOString().split('T')[0];
        } else if (preset === 'year') {
            s = new Date(d.getFullYear(), 0, 1).toISOString().split('T')[0];
        } else {
            s = '';
            e = '';
        }
        setPeriod(preset);
        setStartDate(s);
        setEndDate(e);
    }

    useEffect(() => {
        if (isOpen && vehicleId && companyId) {
            fetchAnalytics();
        }
    }, [isOpen, vehicleId, companyId, startDate, endDate]);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            const [res, history] = await Promise.all([
                dashboardService.getVehicleAnalytics(companyId, vehicleId, startDate || undefined, endDate || undefined),
                conjuntoHistoryService.getHistory(vehicleId).catch(() => [])
            ]);
            setData(res);
            setConjuntoHistory(history);
        } catch (error) {
            console.error('Erro ao buscar análise do veículo:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    // Formatar dados para o gráfico de evolução
    const chartData = data?.history?.trips ? data.history.trips.map((t: any) => ({
        name: new Date(t.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        valor: t.gross_value || 0,
        custo: (t.tolls_value || 0) + (t.loading_cost || 0) + (t.unloading_cost || 0) + (t.fuel_expense || 0)
    })).reverse() : [];

    const efficiencyData = (() => {
        if (!data?.history?.fuels?.length) return [];
        const sorted = [...data.history.fuels].sort((a: any, b: any) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        return sorted.map((f: any, i: number) => {
            const prev = i > 0 ? sorted[i - 1] : null;
            const kmDelta = prev && Number(f.odometer) > Number(prev.odometer)
                ? Number(f.odometer) - Number(prev.odometer) : null;
            const liters = Number(f.liters) || 0;
            return {
                name: new Date(f.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                kmPerLiter: kmDelta !== null && liters > 0 ? parseFloat((kmDelta / liters).toFixed(2)) : 0
            };
        });
    })();

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-primary-600 flex items-center justify-center text-white shadow-lg shadow-primary-500/20">
                                <Truck size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                                    {data?.vehicle?.plate || '---'}
                                    <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] uppercase tracking-wider rounded-lg font-bold">Ativo</span>
                                </h2>
                                <p className="text-xs text-slate-500 font-medium">Análise de Performance e Rentabilidade</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Seletor de período */}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        {(['month', 'quarter', 'year', 'all'] as const).map(p => (
                            <button
                                key={p}
                                onClick={() => applyPreset(p)}
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${period === p ? 'bg-primary-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'}`}
                            >
                                {p === 'month' ? 'Mês Atual' : p === 'quarter' ? 'Trimestre' : p === 'year' ? 'Ano' : 'Todo Período'}
                            </button>
                        ))}
                        <div className="flex items-center gap-1 ml-2">
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => { setStartDate(e.target.value); setPeriod('custom'); }}
                                className="text-[10px] font-bold border border-slate-200 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                            />
                            <span className="text-[10px] text-slate-400 font-bold">até</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => { setEndDate(e.target.value); setPeriod('custom'); }}
                                className="text-[10px] font-bold border border-slate-200 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                            />
                        </div>
                        {period === 'all' && <span className="text-[10px] text-slate-400 italic">histórico completo</span>}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-4">
                            <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin"></div>
                            <p className="text-sm font-bold text-slate-400 animate-pulse">Consolidando dados operacionais...</p>
                        </div>
                    ) : (
                        <div className="space-y-8">

                            {/* KPI Grid — 4 cards principais */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <DetailKPI
                                    label="Faturamento Bruto"
                                    value={(data?.stats?.totalGross || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    icon={<DollarSign size={18} className="text-blue-500" />}
                                />
                                <DetailKPI
                                    label="Resultado Líquido"
                                    value={(data?.stats?.netProfit || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    icon={<TrendingUp size={18} className="text-emerald-500" />}
                                    up={(data?.stats?.netProfit || 0) >= 0}
                                />
                                <DetailKPI
                                    label="Consumo Médio"
                                    value={`${(data?.stats?.avgKmPerLiter || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KM/L`}
                                    icon={<Fuel size={18} className="text-orange-500" />}
                                />
                                <DetailKPI
                                    label="Custo Manutenção"
                                    value={(data?.stats?.totalMaint || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    icon={<Wrench size={18} className="text-rose-500" />}
                                />
                            </div>

                            {/* Tabela de Resultado Detalhado */}
                            {(() => {
                                const s = data?.stats || {};
                                const gross = s.totalGross || 0;
                                const pct = (v: number) => gross > 0 ? ((v / gross) * 100).toFixed(1) + '%' : '—';
                                const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                                const rows = [
                                    { label: 'Combustível + ARLA', value: (s.totalFuel || 0) + (s.totalArla || 0), color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/10' },
                                    { label: 'Comissão Motorista', value: s.totalCommission || 0, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/10' },
                                    { label: 'Manutenção', value: s.totalMaint || 0, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/10' },
                                    { label: 'Imposto', value: s.totalTax || 0, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/10' },
                                    { label: 'ICMS', value: s.totalIcms || 0, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/10' },
                                    { label: 'Pedágio', value: s.totalTolls || 0, color: 'text-slate-600', bg: '' },
                                    { label: 'Seguro viagem', value: s.totalInsurance || 0, color: 'text-slate-600', bg: '' },
                                    { label: 'Carregamento', value: s.totalLoading || 0, color: 'text-slate-600', bg: '' },
                                    { label: 'Descarga', value: s.totalUnloading || 0, color: 'text-slate-600', bg: '' },
                                ];
                                return (
                                    <div className="card rounded-3xl overflow-hidden border border-slate-100 dark:border-slate-800">
                                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 flex items-center gap-2">
                                            <Activity size={16} className="text-primary-500" />
                                            <span className="font-black text-sm text-slate-800 dark:text-white">Resultado Detalhado</span>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest ml-1">— histórico completo</span>
                                        </div>
                                        <table className="w-full text-sm">
                                            <tbody>
                                                {/* Faturamento */}
                                                <tr className="border-b border-slate-100 dark:border-slate-800 bg-emerald-50 dark:bg-emerald-900/10">
                                                    <td className="px-6 py-3 font-black text-slate-800 dark:text-white">Faturamento Bruto</td>
                                                    <td className="px-6 py-3 text-right font-black text-slate-800 dark:text-white">{fmt(gross)}</td>
                                                    <td className="px-6 py-3 text-right">
                                                        <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-black rounded-lg">100%</span>
                                                    </td>
                                                </tr>
                                                {/* Linhas de custo */}
                                                {rows.map(r => (
                                                    <tr key={r.label} className={`border-b border-slate-100 dark:border-slate-800 ${r.bg}`}>
                                                        <td className="px-6 py-3 text-slate-600 dark:text-slate-400 font-medium">{r.label}</td>
                                                        <td className={`px-6 py-3 text-right font-bold ${r.color}`}>{r.value > 0 ? `- ${fmt(r.value)}` : fmt(0)}</td>
                                                        <td className="px-6 py-3 text-right">
                                                            <span className="text-[10px] font-bold text-slate-400">{pct(r.value)}</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {/* Resultado */}
                                                <tr className={(s.netProfit || 0) >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/10' : 'bg-rose-50 dark:bg-rose-900/10'}>
                                                    <td className="px-6 py-4 font-black text-slate-800 dark:text-white">Resultado Líquido</td>
                                                    <td className={`px-6 py-4 text-right font-black text-lg ${(s.netProfit || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        {fmt(s.netProfit || 0)}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className={`px-2 py-0.5 text-[10px] font-black rounded-lg ${(s.netProfit || 0) >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'}`}>
                                                            {pct(s.netProfit || 0)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })()}

                            {/* Charts Section */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="card p-6 bg-slate-50/50 dark:bg-slate-800/20 border-none shadow-none rounded-3xl">
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <h3 className="font-bold text-slate-800 dark:text-slate-200">Rentabilidade de Viagens</h3>
                                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Histórico Recente</p>
                                        </div>
                                        <Activity size={20} className="text-primary-500 opacity-20" />
                                    </div>
                                    <div className="h-[200px] w-full">
                                        <ResponsiveContainer width="100%" height={200}>
                                            <AreaChart data={chartData}>
                                                <defs>
                                                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                                                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                                                <Tooltip 
                                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                    itemStyle={{ fontWeight: 800, fontSize: '12px' }}
                                                />
                                                <Area type="monotone" dataKey="valor" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="card p-6 bg-slate-50/50 dark:bg-slate-800/20 border-none shadow-none rounded-3xl">
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <h3 className="font-bold text-slate-800 dark:text-slate-200">Eficiência de Consumo</h3>
                                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">KM/L por Abastecimento</p>
                                        </div>
                                        <Fuel size={20} className="text-orange-500 opacity-20" />
                                    </div>
                                    <div className="h-[200px] w-full">
                                        <ResponsiveContainer width="100%" height={200}>
                                            <LineChart data={efficiencyData}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                                                <Tooltip 
                                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                />
                                                <Line type="monotone" dataKey="kmPerLiter" stroke="#f97316" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Histórico de Conjunto */}
                            {conjuntoHistory.length > 0 && (
                                <div>
                                    <h3 className="font-black text-sm text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                        <ArrowRightLeft size={18} className="text-amber-500" /> Histórico de Conjunto
                                    </h3>
                                    <div className="relative pl-5">
                                        {/* Linha vertical da timeline */}
                                        <div className="absolute left-1.5 top-2 bottom-2 w-0.5 bg-slate-200 dark:bg-slate-700 rounded-full" />

                                        <div className="space-y-3">
                                            {conjuntoHistory.map((h: any) => {
                                                const fmtDate = (ts: string) => {
                                                    const [y, m, d] = ts.slice(0, 10).split('-');
                                                    return `${d}/${m}/${y}`;
                                                };
                                                const isCurrent = !h.ended_at;
                                                return (
                                                    <div key={h.id} className="relative flex items-start gap-3">
                                                        {/* Dot */}
                                                        <div className={`absolute -left-3.5 mt-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${isCurrent ? 'bg-amber-400' : 'bg-slate-300'}`} />
                                                        <div className={`flex-1 p-3 rounded-2xl border text-xs ${isCurrent ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'}`}>
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className={`font-black text-[10px] uppercase tracking-widest ${isCurrent ? 'text-amber-600' : 'text-slate-400'}`}>
                                                                    {isCurrent ? 'Atual' : `Encerrado em ${fmtDate(h.ended_at)}`}
                                                                </span>
                                                                <span className="text-slate-400 font-bold text-[10px]">
                                                                    desde {fmtDate(h.started_at)}
                                                                </span>
                                                            </div>
                                                            <div className="flex gap-4 mt-1">
                                                                <div>
                                                                    <span className="text-slate-400 text-[10px] uppercase font-bold">Implemento 1</span>
                                                                    <p className="font-black font-mono text-slate-800 dark:text-white">{h.implement_plate_1 || '—'}</p>
                                                                </div>
                                                                {h.implement_plate_2 && (
                                                                    <div>
                                                                        <span className="text-slate-400 text-[10px] uppercase font-bold">Implemento 2</span>
                                                                        <p className="font-black font-mono text-slate-800 dark:text-white">{h.implement_plate_2}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {h.notes && <p className="mt-1 text-slate-500 italic text-[11px]">{h.notes}</p>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Tables Section */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                
                                {/* Recent Trips */}
                                <div>
                                    <h3 className="font-black text-sm text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                        <Calendar size={18} className="text-primary-500" /> Últimas Viagens
                                    </h3>
                                    <div className="space-y-3">
                                        {data?.history?.trips?.length > 0 ? data.history.trips.map((trip: any) => (
                                            <div key={trip.id} className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center justify-between group hover:border-primary-200 transition-all shadow-sm">
                                                <div>
                                                    <div className="font-bold text-xs text-slate-800 dark:text-slate-200">{trip.cargo_description || 'Frete Geral'}</div>
                                                    <div className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-tighter">
                                                        {trip.origin} ➔ {trip.destination}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-black text-sm text-slate-900 dark:text-white">{(trip.gross_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                                                    <span className="text-[9px] font-bold text-slate-400 italic">{new Date(trip.created_at).toLocaleDateString('pt-BR')}</span>
                                                </div>
                                            </div>
                                        )) : <p className="text-xs text-slate-400 italic">Nenhum registro encontrado.</p>}
                                    </div>
                                </div>

                                {/* Maintenances */}
                                <div className="space-y-8">
                                    <div>
                                        <h3 className="font-black text-sm text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                            <Wrench size={18} className="text-rose-500" /> Manutenções Recentes
                                        </h3>
                                        <div className="space-y-3">
                                            {data?.history?.maintenances?.length > 0 ? data.history.maintenances.map((m: any) => (
                                                <div key={m.id} className="p-3 bg-red-50/30 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center text-rose-600">
                                                            <Wrench size={14} />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-xs">{m.description}</div>
                                                            <div className="text-[10px] text-rose-500 font-bold uppercase">{m.type === 'preventive' ? 'Preventiva' : 'Corretiva'}</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right font-black text-xs">{(m.cost || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                                                </div>
                                            )) : <p className="text-xs text-slate-400 italic text-center py-4">Sem manutenções no período.</p>}
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-800/20">
                    <button 
                        onClick={onClose}
                        className="px-8 py-2.5 rounded-2xl text-sm font-black text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}

function DetailKPI({ label, value, icon, up }: { label: string, value: string, icon: any, up?: boolean }) {
    return (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col gap-3 group hover:border-primary-300 transition-all">
            <div className="p-2.5 bg-slate-50 dark:bg-slate-700 rounded-2xl group-hover:bg-primary-50 dark:group-hover:bg-primary-900/30 transition-colors w-fit">
                {icon}
            </div>
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
                <div className={`text-xl font-black mt-0.5 tracking-tight ${up === false ? 'text-rose-600' : 'text-slate-800 dark:text-white'}`}>{value}</div>
            </div>
        </div>
    );
}
