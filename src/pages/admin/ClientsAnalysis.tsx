import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Users, TrendingUp, TrendingDown, BarChart3, MapPin, Search, ChevronUp, ChevronDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

interface ClientStats {
    destination: string;
    tripCount: number;
    totalRevenue: number;
    avgRevenue: number;
    lastTrip: string;
    status: 'ativo' | 'inativo';
    revenueShare: number;
}

type SortKey = 'totalRevenue' | 'tripCount' | 'avgRevenue' | 'lastTrip';

const PERIOD_OPTIONS = [
    { label: '30 dias', value: 30 },
    { label: '60 dias', value: 60 },
    { label: '90 dias', value: 90 },
    { label: '6 meses', value: 180 },
    { label: '12 meses', value: 365 },
];

export default function ClientsAnalysis() {
    const { user } = useAuth();
    const companyId = user?.company_id ?? '';

    const [clients, setClients] = useState<ClientStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState(90);
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('totalRevenue');
    const [sortAsc, setSortAsc] = useState(false);

    const load = useCallback(async () => {
        if (!companyId) return;
        setLoading(true);
        try {
            const since = new Date();
            since.setDate(since.getDate() - period);
            const sinceStr = since.toISOString().split('T')[0];

            const { data: trips, error } = await supabase
                .from('trips')
                .select('destination, gross_value, status, created_at')
                .eq('company_id', companyId)
                .gte('created_at', `${sinceStr}T00:00:00`)
                .in('status', ['finalizada', 'completed', 'concluida']);

            if (error) throw error;

            const map = new Map<string, { trips: number; revenue: number; lastTrip: string }>();
            for (const t of (trips ?? [])) {
                const key = (t.destination ?? '—').trim().toUpperCase();
                const cur = map.get(key) ?? { trips: 0, revenue: 0, lastTrip: '' };
                cur.trips += 1;
                cur.revenue += Number(t.gross_value) || 0;
                if (!cur.lastTrip || t.created_at > cur.lastTrip) cur.lastTrip = t.created_at;
                map.set(key, cur);
            }

            const totalRev = [...map.values()].reduce((s, v) => s + v.revenue, 0);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const stats: ClientStats[] = [...map.entries()].map(([destination, v]) => ({
                destination,
                tripCount: v.trips,
                totalRevenue: v.revenue,
                avgRevenue: v.trips > 0 ? v.revenue / v.trips : 0,
                lastTrip: v.lastTrip,
                status: new Date(v.lastTrip) >= thirtyDaysAgo ? 'ativo' : 'inativo',
                revenueShare: totalRev > 0 ? (v.revenue / totalRev) * 100 : 0,
            }));

            setClients(stats);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [companyId, period]);

    useEffect(() => { load(); }, [load]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortAsc(!sortAsc);
        else { setSortKey(key); setSortAsc(false); }
    };

    const filtered = clients
        .filter(c => !search || c.destination.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
            const mult = sortAsc ? 1 : -1;
            if (sortKey === 'lastTrip') return mult * (a.lastTrip < b.lastTrip ? -1 : 1);
            return mult * ((a[sortKey] as number) - (b[sortKey] as number));
        });

    const top5 = [...clients].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 5);
    const totalRev = clients.reduce((s, c) => s + c.totalRevenue, 0);
    const activeCount = clients.filter(c => c.status === 'ativo').length;

    const SortIcon = ({ k }: { k: SortKey }) => sortKey === k
        ? (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
        : null;

    const fmtDate = (iso: string) => iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—';

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center">
                        <Users size={22} className="text-cyan-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Análise de Clientes</h1>
                        <p className="text-xs text-slate-500">Faturamento por destino/cliente · Viagens concluídas</p>
                    </div>
                </div>
                <select value={period} onChange={e => setPeriod(Number(e.target.value))}
                    className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200">
                    {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total de Clientes', value: clients.length, sub: `${activeCount} ativos`, icon: Users, color: 'bg-cyan-50 text-cyan-600' },
                    { label: 'Faturamento Total', value: fmt(totalRev), sub: 'período selecionado', icon: BarChart3, color: 'bg-emerald-50 text-emerald-600' },
                    { label: 'Ticket Médio', value: fmt(clients.length > 0 ? totalRev / clients.reduce((s, c) => s + c.tripCount, 0) : 0), sub: 'por viagem', icon: TrendingUp, color: 'bg-blue-50 text-blue-600' },
                    { label: 'Clientes Inativos', value: clients.length - activeCount, sub: 'sem viagem há 30d', icon: TrendingDown, color: 'bg-amber-50 text-amber-600' },
                ].map(k => (
                    <div key={k.label} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{k.label}</p>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${k.color}`}>
                                <k.icon size={16} />
                            </div>
                        </div>
                        <p className="text-xl font-bold text-slate-900">{k.value}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{k.sub}</p>
                    </div>
                ))}
            </div>

            {/* Gráfico Top 5 */}
            {top5.length > 0 && (
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                    <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                        <BarChart3 size={18} className="text-slate-400" /> Top 5 Clientes por Faturamento
                    </h2>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={top5} layout="vertical" margin={{ left: 20, right: 40 }}>
                            <XAxis type="number" hide />
                            <YAxis dataKey="destination" type="category" width={120} tick={{ fontSize: 12 }} />
                            <Tooltip formatter={(v: number | undefined) => fmt(v ?? 0)} />
                            <Bar dataKey="totalRevenue" radius={[0, 6, 6, 0]}>
                                {top5.map((_, i) => (
                                    <Cell key={i} fill={['#3b82f6', '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b'][i % 5]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Tabela */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center gap-3">
                    <div className="relative flex-1 max-w-xs">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar destino..."
                            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-200" />
                    </div>
                    <span className="text-xs text-slate-400">{filtered.length} registros</span>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="w-8 h-8 border-2 border-cyan-200 border-t-cyan-600 rounded-full animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <MapPin size={36} className="mx-auto mb-2 opacity-40" />
                        <p className="text-sm">Nenhum destino encontrado no período.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide">
                                    <th className="text-left px-5 py-3">Destino / Cliente</th>
                                    <th className="text-right px-4 py-3 cursor-pointer hover:text-slate-900" onClick={() => handleSort('tripCount')}>
                                        <span className="flex items-center justify-end gap-1">Viagens <SortIcon k="tripCount" /></span>
                                    </th>
                                    <th className="text-right px-4 py-3 cursor-pointer hover:text-slate-900" onClick={() => handleSort('totalRevenue')}>
                                        <span className="flex items-center justify-end gap-1">Faturamento <SortIcon k="totalRevenue" /></span>
                                    </th>
                                    <th className="text-right px-4 py-3 cursor-pointer hover:text-slate-900" onClick={() => handleSort('avgRevenue')}>
                                        <span className="flex items-center justify-end gap-1">Ticket Médio <SortIcon k="avgRevenue" /></span>
                                    </th>
                                    <th className="text-right px-4 py-3">Participação</th>
                                    <th className="text-right px-4 py-3 cursor-pointer hover:text-slate-900" onClick={() => handleSort('lastTrip')}>
                                        <span className="flex items-center justify-end gap-1">Última Viagem <SortIcon k="lastTrip" /></span>
                                    </th>
                                    <th className="text-center px-4 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filtered.map((c, idx) => (
                                    <tr key={c.destination} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs flex items-center justify-center font-medium">{idx + 1}</span>
                                                <div>
                                                    <p className="font-medium text-slate-900">{c.destination}</p>
                                                    <p className="text-xs text-slate-400 flex items-center gap-1"><MapPin size={10} /> {c.tripCount} viagem{c.tripCount !== 1 ? 's' : ''}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-slate-800">{c.tripCount}</td>
                                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmt(c.totalRevenue)}</td>
                                        <td className="px-4 py-3 text-right text-slate-700">{fmt(c.avgRevenue)}</td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${Math.min(100, c.revenueShare)}%` }} />
                                                </div>
                                                <span className="text-xs text-slate-500 w-10 text-right">{fmtPct(c.revenueShare)}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-500 text-xs">{fmtDate(c.lastTrip)}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${c.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {c.status === 'ativo' ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
