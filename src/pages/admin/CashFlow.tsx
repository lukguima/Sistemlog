import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { cashFlowService } from '../../lib/financial.services';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Wallet, ChevronLeft, ChevronRight } from 'lucide-react';

const fmt = (v: number) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const fmtK = (v: number) => {
    if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
    return `R$ ${v.toFixed(0)}`;
};

export default function CashFlow() {
    const { user } = useAuth();
    const companyId = (user as any)?.company_id;
    const [year, setYear] = useState(new Date().getFullYear());
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        if (!companyId) return;
        setLoading(true);
        try {
            const res = await cashFlowService.getMonthly(companyId, year);
            setData(res);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [companyId, year]);

    const totalReceitas = data.reduce((s, m) => s + m.receitas, 0);
    const totalDespesas = data.reduce((s, m) => s + m.despesas, 0);
    const saldoAcumulado = totalReceitas - totalDespesas;
    const melhorMes = data.reduce((best, m) => m.saldo > (best?.saldo ?? -Infinity) ? m : best, null as any);
    const piorMes = data.reduce((worst, m) => m.saldo < (worst?.saldo ?? Infinity) ? m : worst, null as any);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload?.length) return null;
        return (
            <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
                <p className="font-semibold text-slate-700 mb-2">{label}</p>
                {payload.map((p: any) => (
                    <p key={p.name} style={{ color: p.color }} className="font-medium">
                        {p.name}: {fmt(p.value)}
                    </p>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Fluxo de Caixa</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Receitas vs despesas por mês</p>
                </div>
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
                    <button onClick={() => setYear(y => y - 1)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500"><ChevronLeft size={16} /></button>
                    <span className="text-sm font-semibold text-slate-700 w-10 text-center">{year}</span>
                    <button onClick={() => setYear(y => y + 1)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500"><ChevronRight size={16} /></button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center">
                            <TrendingUp size={18} className="text-green-600" />
                        </div>
                        <p className="text-sm text-slate-500 font-medium">Total Receitas {year}</p>
                    </div>
                    <p className="text-2xl font-bold text-green-700">{fmt(totalReceitas)}</p>
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center">
                            <TrendingDown size={18} className="text-red-600" />
                        </div>
                        <p className="text-sm text-slate-500 font-medium">Total Despesas {year}</p>
                    </div>
                    <p className="text-2xl font-bold text-red-700">{fmt(totalDespesas)}</p>
                </div>
                <div className={`border rounded-2xl p-5 shadow-sm ${saldoAcumulado >= 0 ? 'bg-white border-slate-100' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-3 mb-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${saldoAcumulado >= 0 ? 'bg-blue-50' : 'bg-red-100'}`}>
                            <Wallet size={18} className={saldoAcumulado >= 0 ? 'text-blue-600' : 'text-red-600'} />
                        </div>
                        <p className="text-sm text-slate-500 font-medium">Saldo do Ano</p>
                    </div>
                    <p className={`text-2xl font-bold ${saldoAcumulado >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{fmt(saldoAcumulado)}</p>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <h2 className="text-base font-semibold text-slate-800 mb-4">Receitas × Despesas por Mês</h2>
                {loading ? (
                    <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Carregando...</div>
                ) : (
                    <ResponsiveContainer width="100%" height={280}>
                        <ComposedChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                            <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                            <Tooltip content={<CustomTooltip />} />
                            <ReferenceLine y={0} stroke="#e2e8f0" />
                            <Bar dataKey="receitas" name="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={36} />
                            <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={36} />
                            <Line type="monotone" dataKey="saldo" name="Saldo" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Tabela mensal */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100">
                    <h2 className="text-base font-semibold text-slate-800">Detalhamento Mensal</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50">
                                {['Mês', 'Receitas', 'Despesas', 'Saldo', 'Margem'].map(h => (
                                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.map(m => {
                                const margem = m.receitas > 0 ? ((m.saldo / m.receitas) * 100) : 0;
                                const isBest = melhorMes?.month === m.month;
                                const isWorst = piorMes?.month === m.month && m.saldo < 0;
                                return (
                                    <tr key={m.month} className={`border-b border-slate-50 ${isBest ? 'bg-green-50/50' : isWorst ? 'bg-red-50/50' : 'hover:bg-slate-50'}`}>
                                        <td className="py-3 px-4 font-medium text-slate-700 capitalize">
                                            {m.label} {isBest && <span className="ml-1 text-xs text-green-600 font-normal">↑ melhor</span>}
                                            {isWorst && <span className="ml-1 text-xs text-red-600 font-normal">↓ pior</span>}
                                        </td>
                                        <td className="py-3 px-4 text-green-700 font-medium">{fmt(m.receitas)}</td>
                                        <td className="py-3 px-4 text-red-600 font-medium">{fmt(m.despesas)}</td>
                                        <td className={`py-3 px-4 font-semibold ${m.saldo >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{fmt(m.saldo)}</td>
                                        <td className={`py-3 px-4 font-medium ${margem >= 20 ? 'text-green-600' : margem >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                                            {margem.toFixed(1)}%
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="bg-slate-50 border-t-2 border-slate-200">
                                <td className="py-3 px-4 font-bold text-slate-800">Total</td>
                                <td className="py-3 px-4 font-bold text-green-700">{fmt(totalReceitas)}</td>
                                <td className="py-3 px-4 font-bold text-red-600">{fmt(totalDespesas)}</td>
                                <td className={`py-3 px-4 font-bold ${saldoAcumulado >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{fmt(saldoAcumulado)}</td>
                                <td className={`py-3 px-4 font-bold ${totalReceitas > 0 && (saldoAcumulado / totalReceitas) >= 0.2 ? 'text-green-600' : 'text-yellow-600'}`}>
                                    {totalReceitas > 0 ? ((saldoAcumulado / totalReceitas) * 100).toFixed(1) : '0.0'}%
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
