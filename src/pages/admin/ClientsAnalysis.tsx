import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { clientService } from '../../lib/services';
import ClientModal from '../../components/admin/ClientModal';
import {
    Users, TrendingUp, TrendingDown, BarChart3, MapPin, Search,
    ChevronUp, ChevronDown, Plus, Edit2, Trash2, Phone, Mail, UserPlus
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

interface ClientStats {
    key: string;
    label: string;
    destination: string;
    tripCount: number;
    totalRevenue: number;
    avgRevenue: number;
    lastTrip: string;
    status: 'ativo' | 'inativo';
    revenueShare: number;
    fromClient: boolean;
}

type SortKey = 'totalRevenue' | 'tripCount' | 'avgRevenue' | 'lastTrip';
type TabId = 'cadastro' | 'analise';

const PERIOD_OPTIONS = [
    { label: '30 dias', value: 30 },
    { label: '60 dias', value: 60 },
    { label: '90 dias', value: 90 },
    { label: '6 meses', value: 180 },
    { label: '12 meses', value: 365 },
];

export default function ClientsAnalysis() {
    const { user, isSubscriptionBlocked } = useAuth();
    const companyId = user?.company_id ?? '';

    const [tab, setTab] = useState<TabId>('cadastro');
    const [stats, setStats] = useState<ClientStats[]>([]);
    const [registry, setRegistry] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingRegistry, setLoadingRegistry] = useState(true);
    const [period, setPeriod] = useState(90);
    const [search, setSearch] = useState('');
    const [registrySearch, setRegistrySearch] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('totalRevenue');
    const [sortAsc, setSortAsc] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<any>(null);
    const [prefillDestination, setPrefillDestination] = useState<string | undefined>();
    const [tableMissing, setTableMissing] = useState(false);

    const loadRegistry = useCallback(async () => {
        if (!companyId) return;
        setLoadingRegistry(true);
        try {
            const data = await clientService.getClients(companyId);
            setRegistry(data);
            setTableMissing(false);
        } catch (e: any) {
            console.error(e);
            const msg = String(e?.message || e?.code || '');
            if (msg.includes('clients') || msg.includes('42P01') || msg.includes('schema cache')) {
                setTableMissing(true);
            }
            setRegistry([]);
        } finally {
            setLoadingRegistry(false);
        }
    }, [companyId]);

    const loadAnalysis = useCallback(async () => {
        if (!companyId) return;
        setLoading(true);
        try {
            const since = new Date();
            since.setDate(since.getDate() - period);
            const sinceStr = since.toISOString().split('T')[0];

            let trips: any[] | null = null;
            let error: any = null;

            const withClient = await supabase
                .from('trips')
                .select('destination, gross_value, status, created_at, client_id, client:clients(name)')
                .eq('company_id', companyId)
                .gte('created_at', `${sinceStr}T00:00:00`)
                .in('status', ['completed', 'paid']);

            if (withClient.error) {
                const fallback = await supabase
                    .from('trips')
                    .select('destination, gross_value, status, created_at')
                    .eq('company_id', companyId)
                    .gte('created_at', `${sinceStr}T00:00:00`)
                    .in('status', ['completed', 'paid']);
                trips = fallback.data;
                error = fallback.error;
            } else {
                trips = withClient.data;
            }

            if (error) throw error;

            const map = new Map<string, { label: string; destination: string; trips: number; revenue: number; lastTrip: string; fromClient: boolean }>();
            for (const t of (trips ?? [])) {
                const clientName = (t as any).client?.name;
                const dest = (t.destination ?? '—').trim();
                const fromClient = !!(t.client_id && clientName);
                const label = fromClient ? String(clientName).trim() : dest.toUpperCase();
                const key = fromClient ? `c:${t.client_id}` : `d:${dest.toUpperCase()}`;
                const cur = map.get(key) ?? { label, destination: dest.toUpperCase(), trips: 0, revenue: 0, lastTrip: '', fromClient };
                cur.trips += 1;
                cur.revenue += Number(t.gross_value) || 0;
                if (!cur.lastTrip || t.created_at > cur.lastTrip) cur.lastTrip = t.created_at;
                map.set(key, cur);
            }

            const totalRev = [...map.values()].reduce((s, v) => s + v.revenue, 0);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const next: ClientStats[] = [...map.entries()].map(([key, v]) => ({
                key,
                label: v.label,
                destination: v.destination,
                tripCount: v.trips,
                totalRevenue: v.revenue,
                avgRevenue: v.trips > 0 ? v.revenue / v.trips : 0,
                lastTrip: v.lastTrip,
                status: new Date(v.lastTrip) >= thirtyDaysAgo ? 'ativo' : 'inativo',
                revenueShare: totalRev > 0 ? (v.revenue / totalRev) * 100 : 0,
                fromClient: v.fromClient,
            }));

            setStats(next);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [companyId, period]);

    useEffect(() => { loadRegistry(); }, [loadRegistry]);
    useEffect(() => { loadAnalysis(); }, [loadAnalysis]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortAsc(!sortAsc);
        else { setSortKey(key); setSortAsc(false); }
    };

    const filteredStats = stats
        .filter(c => !search || c.label.toLowerCase().includes(search.toLowerCase()) || c.destination.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
            const mult = sortAsc ? 1 : -1;
            if (sortKey === 'lastTrip') return mult * (a.lastTrip < b.lastTrip ? -1 : 1);
            return mult * ((a[sortKey] as number) - (b[sortKey] as number));
        });

    const filteredRegistry = registry.filter(c => {
        const q = registrySearch.toLowerCase();
        if (!q) return true;
        return (
            (c.name || '').toLowerCase().includes(q) ||
            (c.document || '').includes(registrySearch) ||
            (c.default_destination || '').toLowerCase().includes(q)
        );
    });

    const top5 = [...stats].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 5);
    const totalRev = stats.reduce((s, c) => s + c.totalRevenue, 0);
    const activeCount = stats.filter(c => c.status === 'ativo').length;

    const SortIcon = ({ k }: { k: SortKey }) => sortKey === k
        ? (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
        : null;

    const fmtDate = (iso: string) => iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—';

    const openNew = (dest?: string) => {
        setEditingClient(null);
        setPrefillDestination(dest);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir este cliente? Viagens vinculadas ficam sem cliente (destino permanece).')) return;
        try {
            await clientService.deleteClient(id);
            loadRegistry();
            loadAnalysis();
        } catch (e: any) {
            alert(e?.message || 'Erro ao excluir cliente.');
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center">
                        <Users size={22} className="text-cyan-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Clientes</h1>
                        <p className="text-xs text-slate-500">Cadastro e faturamento por cliente/destino</p>
                    </div>
                </div>
                {tab === 'analise' ? (
                    <select value={period} onChange={e => setPeriod(Number(e.target.value))}
                        className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200">
                        {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                ) : (
                    <button
                        type="button"
                        onClick={() => openNew()}
                        disabled={isSubscriptionBlocked || tableMissing}
                        className="bg-cyan-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-cyan-700 disabled:opacity-50"
                    >
                        <Plus size={18} /> Novo Cliente
                    </button>
                )}
            </div>

            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
                {([
                    { id: 'cadastro' as const, label: 'Cadastro' },
                    { id: 'analise' as const, label: 'Análise' },
                ]).map(t => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setTab(t.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                            tab === t.id ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tableMissing && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-2xl px-4 py-3">
                    Tabela <code className="font-mono">clients</code> não encontrada. Execute o script{' '}
                    <strong>ADD_CLIENTS_TABLE.sql</strong> no SQL Editor do Supabase para liberar o cadastro.
                    A análise por destino continua funcionando.
                </div>
            )}

            {tab === 'cadastro' && (
                <div className="space-y-4">
                    <div className="relative max-w-sm">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={registrySearch}
                            onChange={e => setRegistrySearch(e.target.value)}
                            placeholder="Buscar nome, documento ou destino..."
                            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-200 bg-white"
                        />
                    </div>

                    {loadingRegistry ? (
                        <div className="flex justify-center py-12">
                            <div className="w-8 h-8 border-2 border-cyan-200 border-t-cyan-600 rounded-full animate-spin" />
                        </div>
                    ) : filteredRegistry.length === 0 ? (
                        <div className="bg-white border border-slate-100 rounded-2xl text-center py-14 text-slate-400">
                            <Users size={36} className="mx-auto mb-2 opacity-40" />
                            <p className="text-sm font-medium text-slate-600">Nenhum cliente cadastrado</p>
                            <p className="text-xs mt-1">Cadastre para selecionar na Nova Viagem.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredRegistry.map(c => (
                                <div key={c.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm group hover:border-cyan-200 transition-colors">
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-bold text-slate-900 truncate">{c.name}</h3>
                                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${c.active === false ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-600'}`}>
                                                    {c.active === false ? 'Inativo' : 'Ativo'}
                                                </span>
                                            </div>
                                            {c.document && <p className="text-xs text-slate-500 mt-1 font-mono">{c.document}</p>}
                                            {c.default_destination && (
                                                <p className="text-xs text-cyan-700 mt-2 flex items-center gap-1">
                                                    <MapPin size={12} /> {c.default_destination}
                                                </p>
                                            )}
                                            <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                                                {c.phone && <span className="flex items-center gap-1"><Phone size={11} /> {c.phone}</span>}
                                                {c.email && <span className="flex items-center gap-1"><Mail size={11} /> {c.email}</span>}
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            <button
                                                type="button"
                                                onClick={() => { setEditingClient(c); setPrefillDestination(undefined); setIsModalOpen(true); }}
                                                className="p-2 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-50"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(c.id)}
                                                className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {tab === 'analise' && (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: 'Total de Clientes', value: stats.length, sub: `${activeCount} ativos`, icon: Users, color: 'bg-cyan-50 text-cyan-600' },
                            { label: 'Faturamento Total', value: fmt(totalRev), sub: 'período selecionado', icon: BarChart3, color: 'bg-emerald-50 text-emerald-600' },
                            { label: 'Ticket Médio', value: fmt(stats.length > 0 ? totalRev / Math.max(1, stats.reduce((s, c) => s + c.tripCount, 0)) : 0), sub: 'por viagem', icon: TrendingUp, color: 'bg-blue-50 text-blue-600' },
                            { label: 'Clientes Inativos', value: stats.length - activeCount, sub: 'sem viagem há 30d', icon: TrendingDown, color: 'bg-amber-50 text-amber-600' },
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

                    {top5.length > 0 && (
                        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                            <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                <BarChart3 size={18} className="text-slate-400" /> Top 5 por Faturamento
                            </h2>
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={top5} layout="vertical" margin={{ left: 20, right: 40 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="label" type="category" width={120} tick={{ fontSize: 12 }} />
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

                    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-slate-100 flex items-center gap-3">
                            <div className="relative flex-1 max-w-xs">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input value={search} onChange={e => setSearch(e.target.value)}
                                    placeholder="Buscar cliente ou destino..."
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-200" />
                            </div>
                            <span className="text-xs text-slate-400">{filteredStats.length} registros</span>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-12">
                                <div className="w-8 h-8 border-2 border-cyan-200 border-t-cyan-600 rounded-full animate-spin" />
                            </div>
                        ) : filteredStats.length === 0 ? (
                            <div className="text-center py-12 text-slate-400">
                                <MapPin size={36} className="mx-auto mb-2 opacity-40" />
                                <p className="text-sm">Nenhum destino/cliente encontrado no período.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide">
                                            <th className="text-left px-5 py-3">Cliente / Destino</th>
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
                                            <th className="text-right px-4 py-3">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredStats.map((c, idx) => (
                                            <tr key={c.key} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs flex items-center justify-center font-medium">{idx + 1}</span>
                                                        <div>
                                                            <p className="font-medium text-slate-900">{c.label}</p>
                                                            <p className="text-xs text-slate-400 flex items-center gap-1">
                                                                <MapPin size={10} />
                                                                {c.fromClient ? `Cliente · ${c.destination}` : `${c.tripCount} viagem${c.tripCount !== 1 ? 's' : ''} (destino)`}
                                                            </p>
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
                                                <td className="px-4 py-3 text-right">
                                                    {!c.fromClient && !tableMissing && (
                                                        <button
                                                            type="button"
                                                            title="Criar cliente a partir deste destino"
                                                            onClick={() => openNew(c.destination)}
                                                            className="inline-flex items-center gap-1 text-xs font-bold text-cyan-600 hover:text-cyan-800"
                                                        >
                                                            <UserPlus size={14} /> Cadastrar
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            <ClientModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingClient(null); setPrefillDestination(undefined); }}
                onSave={() => { loadRegistry(); loadAnalysis(); setTab('cadastro'); }}
                client={editingClient}
                defaultDestinationPrefill={prefillDestination}
            />
        </div>
    );
}
