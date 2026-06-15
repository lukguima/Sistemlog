import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { vehicleProfitabilityService } from '../../lib/financial.services';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, AlertTriangle, Truck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const fmt = (v: number) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const fmtK = (v: number) => `R$ ${(v / 1000).toFixed(1)}k`;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    lucrativo: { label: 'Lucrativo', color: 'text-green-700', bg: 'bg-green-100', icon: TrendingUp },
    atencao: { label: 'Atenção', color: 'text-yellow-700', bg: 'bg-yellow-100', icon: AlertTriangle },
    prejuizo: { label: 'Prejuízo', color: 'text-red-700', bg: 'bg-red-100', icon: TrendingDown },
    inativo: { label: 'Sem viagens', color: 'text-slate-500', bg: 'bg-slate-100', icon: Truck },
};

const BAR_COLORS: Record<string, string> = {
    lucrativo: '#22c55e', atencao: '#f59e0b', prejuizo: '#ef4444', inativo: '#94a3b8'
};

export default function VehicleProfitability() {
    const { user } = useAuth();
    const companyId = (user as any)?.company_id;

    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const navigateMonth = (dir: number) => {
        setMonth(m => {
            const nm = m + dir;
            if (nm < 1) { setYear(y => y - 1); return 12; }
            if (nm > 12) { setYear(y => y + 1); return 1; }
            return nm;
        });
    };

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    const periodLabel = new Date(year, month - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

    const load = async () => {
        if (!companyId) return;
        setLoading(true);
        try {
            const res = await vehicleProfitabilityService.get(companyId, startDate, endDate);
            setVehicles(res);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [companyId, month, year]);

    const totalReceita = vehicles.reduce((s, v) => s + v.receita, 0);
    const totalLucro = vehicles.reduce((s, v) => s + v.lucro, 0);
    const totalCusto = vehicles.reduce((s, v) => s + v.totalCusto, 0);
    const margemGeral = totalReceita > 0 ? (totalLucro / totalReceita) * 100 : 0;

    const chartData = vehicles
        .filter(v => v.receita > 0 || v.lucro !== 0)
        .map(v => ({ name: v.plate, lucro: v.lucro, receita: v.receita, status: v.status }));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Rentabilidade por Caminhão</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Receita, custo e lucro por veículo</p>
                </div>
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
                    <button onClick={() => navigateMonth(-1)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500"><ChevronLeft size={16} /></button>
                    <span className="text-sm font-semibold text-slate-700 capitalize min-w-[130px] text-center">{periodLabel}</span>
                    <button onClick={() => navigateMonth(1)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500"><ChevronRight size={16} /></button>
                </div>
            </div>

            {/* KPIs gerais */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Receita Total', value: fmt(totalReceita), color: 'text-green-700', bg: 'bg-green-50' },
                    { label: 'Custo Total', value: fmt(totalCusto), color: 'text-red-600', bg: 'bg-red-50' },
                    { label: 'Lucro Total', value: fmt(totalLucro), color: totalLucro >= 0 ? 'text-blue-700' : 'text-red-700', bg: totalLucro >= 0 ? 'bg-blue-50' : 'bg-red-50' },
                    { label: 'Margem Geral', value: `${margemGeral.toFixed(1)}%`, color: margemGeral >= 15 ? 'text-green-700' : margemGeral >= 0 ? 'text-yellow-600' : 'text-red-600', bg: 'bg-slate-50' },
                ].map(k => (
                    <div key={k.label} className={`${k.bg} rounded-2xl p-4 border border-transparent`}>
                        <p className="text-xs text-slate-500 font-medium mb-1">{k.label}</p>
                        <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                    </div>
                ))}
            </div>

            {/* Gráfico */}
            {chartData.length > 0 && (
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                    <h2 className="text-base font-semibold text-slate-800 mb-4">Lucro por Veículo</h2>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                            <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                            <Tooltip formatter={(v: any) => fmt(v)} />
                            <Bar dataKey="lucro" name="Lucro" radius={[6, 6, 0, 0]} maxBarSize={48}>
                                {chartData.map((entry, i) => (
                                    <Cell key={i} fill={BAR_COLORS[entry.status] ?? '#94a3b8'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                    <div className="flex gap-4 mt-3 justify-center">
                        {Object.entries(BAR_COLORS).map(([k, c]) => (
                            <div key={k} className="flex items-center gap-1.5 text-xs text-slate-500">
                                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: c }} />
                                {STATUS_CONFIG[k]?.label}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tabela detalhada */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100">
                    <h2 className="text-base font-semibold text-slate-800">Detalhamento por Veículo</h2>
                </div>
                {loading ? (
                    <div className="py-16 text-center text-slate-400 text-sm">Carregando...</div>
                ) : vehicles.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 text-sm">Nenhum veículo encontrado.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50">
                                    {['Veículo', 'Viagens', 'Receita', 'Combustível', 'Manutenção', 'Financiamento', 'Total Custo', 'Lucro', 'Margem', 'Status'].map(h => (
                                        <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {vehicles.map(v => {
                                    const cfg = STATUS_CONFIG[v.status];
                                    const Icon = cfg?.icon;
                                    return (
                                        <tr key={v.id} className="border-b border-slate-50 hover:bg-slate-50">
                                            <td className="py-3 px-3">
                                                <div>
                                                    <p className="font-semibold text-slate-800">{v.plate}</p>
                                                    <p className="text-xs text-slate-400">{v.model ?? '—'}</p>
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 text-slate-600">{v.viagens}</td>
                                            <td className="py-3 px-3 font-medium text-green-700">{fmt(v.receita)}</td>
                                            <td className="py-3 px-3 text-slate-600">{fmt(v.combustivel)}</td>
                                            <td className="py-3 px-3 text-slate-600">{fmt(v.manutencao)}</td>
                                            <td className="py-3 px-3 text-slate-600">{fmt(v.financiamento)}</td>
                                            <td className="py-3 px-3 font-medium text-red-600">{fmt(v.totalCusto)}</td>
                                            <td className={`py-3 px-3 font-bold ${v.lucro >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{fmt(v.lucro)}</td>
                                            <td className={`py-3 px-3 font-medium ${v.margem >= 15 ? 'text-green-600' : v.margem >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                {v.margem.toFixed(1)}%
                                            </td>
                                            <td className="py-3 px-3">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg?.bg} ${cfg?.color}`}>
                                                    {Icon && <Icon size={11} />}
                                                    {cfg?.label}
                                                </span>
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
    );
}
