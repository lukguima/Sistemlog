import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dreService } from '../../lib/financial.services';
import { FileText, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

const fmt = (v: number) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

function DRELine({ label, value, indent = 0, bold = false, color = 'text-slate-700', separator = false }: any) {
    return (
        <>
            {separator && <tr><td colSpan={3}><div className="border-t border-slate-200 my-1" /></td></tr>}
            <tr className={`${bold ? 'bg-slate-50' : 'hover:bg-slate-50/50'}`}>
                <td className={`py-2.5 text-sm ${bold ? 'font-bold' : 'font-medium'} ${color}`} style={{ paddingLeft: `${16 + indent * 20}px` }}>
                    {indent > 0 && <span className="text-slate-300 mr-1">{'└'}</span>}
                    {label}
                </td>
                <td className={`py-2.5 text-sm text-right pr-4 ${bold ? 'font-bold' : ''} ${color}`}>
                    {value !== null ? fmt(Math.abs(value)) : '—'}
                </td>
                <td className="py-2.5 text-right pr-4 w-20">
                    {value !== null && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${value >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {value >= 0 ? '+' : '-'}
                        </span>
                    )}
                </td>
            </tr>
        </>
    );
}

export default function DRE() {
    const { user } = useAuth();
    const companyId = (user as any)?.company_id;

    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [dre, setDre] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const navigateMonth = (dir: number) => {
        setMonth(m => {
            const nm = m + dir;
            if (nm < 1) { setYear(y => y - 1); return 12; }
            if (nm > 12) { setYear(y => y + 1); return 1; }
            return nm;
        });
    };

    const periodLabel = new Date(year, month - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const load = async () => {
        if (!companyId) return;
        setLoading(true);
        try {
            const res = await dreService.get(companyId, startDate, endDate);
            setDre(res);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [companyId, month, year]);

    const saudeColor = dre?.margem >= 15 ? 'text-green-600' : dre?.margem >= 5 ? 'text-yellow-600' : 'text-red-600';
    const saudeBg = dre?.margem >= 15 ? 'bg-green-50 border-green-200' : dre?.margem >= 5 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';
    const saudeLabel = dre?.margem >= 15 ? 'Saudável' : dre?.margem >= 5 ? 'Atenção' : 'Crítico';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">DRE Gerencial</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Demonstração do resultado do exercício</p>
                </div>
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
                    <button onClick={() => navigateMonth(-1)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500"><ChevronLeft size={16} /></button>
                    <span className="text-sm font-semibold text-slate-700 capitalize min-w-[130px] text-center">{periodLabel}</span>
                    <button onClick={() => navigateMonth(1)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500"><ChevronRight size={16} /></button>
                </div>
            </div>

            {loading ? (
                <div className="py-20 text-center text-slate-400">Carregando...</div>
            ) : dre && (
                <>
                    {/* Resumo saúde */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: 'Receita Bruta', value: dre.receitaBruta, color: 'text-green-700', bg: 'bg-green-50' },
                            { label: 'Custos Operacionais', value: -dre.custosOperacionais, color: 'text-orange-700', bg: 'bg-orange-50' },
                            { label: 'Resultado Líquido', value: dre.resultadoLiquido, color: dre.resultadoLiquido >= 0 ? 'text-blue-700' : 'text-red-700', bg: dre.resultadoLiquido >= 0 ? 'bg-blue-50' : 'bg-red-50' },
                            { label: `Margem (${saudeLabel})`, value: null, color: saudeColor, bg: saudeBg.split(' ')[0], extra: `${dre.margem.toFixed(1)}%` },
                        ].map(k => (
                            <div key={k.label} className={`${k.bg} border ${saudeBg.includes(k.bg) && k.extra ? saudeBg : 'border-transparent'} rounded-2xl p-4`}>
                                <p className="text-xs text-slate-500 font-medium mb-1">{k.label}</p>
                                <p className={`text-xl font-bold ${k.color}`}>{k.extra ?? fmt(k.value ?? 0)}</p>
                            </div>
                        ))}
                    </div>

                    {/* Tabela DRE */}
                    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                        <div className="flex items-center gap-3 p-5 border-b border-slate-100">
                            <FileText size={18} className="text-slate-500" />
                            <h2 className="text-base font-semibold text-slate-800 capitalize">DRE — {periodLabel}</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50">
                                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500">Descrição</th>
                                        <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500">Valor</th>
                                        <th className="w-20 py-3 px-4"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <DRELine label="(+) RECEITA BRUTA" value={dre.receitaBruta} bold color="text-slate-800" />
                                    <DRELine label="Fretes realizados" value={dre.receitaFretes} indent={1} color="text-slate-600" />
                                    {dre.receitasExtras > 0 && <DRELine label="Outras receitas" value={dre.receitasExtras} indent={1} color="text-slate-600" />}

                                    <DRELine label="(-) CUSTOS OPERACIONAIS" value={-dre.custosOperacionais} bold color="text-red-700" separator />
                                    <DRELine label="Combustível" value={-dre.combustivel} indent={1} color="text-slate-600" />
                                    <DRELine label="Manutenção" value={-dre.manutencao} indent={1} color="text-slate-600" />
                                    {dre.adiantamentos > 0 && <DRELine label="Comissões / Adiantamentos" value={-dre.adiantamentos} indent={1} color="text-slate-600" />}

                                    <DRELine label="= LUCRO BRUTO OPERACIONAL" value={dre.lucroBruto} bold color={dre.lucroBruto >= 0 ? 'text-blue-700' : 'text-red-700'} separator />

                                    <DRELine label="(-) DESPESAS DIVERSAS" value={-dre.despesasTotais} bold color="text-red-700" separator />
                                    {dre.despesasAdmin > 0 && <DRELine label="Administrativo / Salários" value={-dre.despesasAdmin} indent={1} color="text-slate-600" />}
                                    {dre.impostos > 0 && <DRELine label="Impostos" value={-dre.impostos} indent={1} color="text-slate-600" />}
                                    {dre.financiamentos > 0 && <DRELine label="Financiamentos" value={-dre.financiamentos} indent={1} color="text-slate-600" />}
                                    {dre.outrasDesp > 0 && <DRELine label="Outras despesas" value={-dre.outrasDesp} indent={1} color="text-slate-600" />}

                                    <tr className="border-t-2 border-slate-300 bg-slate-50">
                                        <td className="py-4 px-4 text-base font-bold text-slate-900">= RESULTADO LÍQUIDO</td>
                                        <td className={`py-4 px-4 text-right text-base font-bold ${dre.resultadoLiquido >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                            {fmt(dre.resultadoLiquido)}
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            <span className={`text-sm font-semibold ${saudeColor}`}>{dre.margem.toFixed(1)}%</span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Alerta se prejuízo */}
                    {dre.resultadoLiquido < 0 && (
                        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4">
                            <AlertTriangle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-red-700">Resultado negativo neste período</p>
                                <p className="text-sm text-red-600 mt-0.5">
                                    As despesas superaram as receitas em {fmt(Math.abs(dre.resultadoLiquido))}. Revise os custos operacionais e despesas para os próximos meses.
                                </p>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
