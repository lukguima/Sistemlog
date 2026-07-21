import { useState, useEffect } from 'react';
import { 
    TrendingUp, 
    DollarSign, 
    Fuel, 
    BarChart3, 
    ArrowUpRight, 
    ArrowDownRight, 
    Search, 
    Filter, 
    Download, 
    FileText, 
    Loader2, 
    PieChart as PieChartIcon 
} from 'lucide-react';
import { exportToExcel } from '../../lib/exports';
import { 
    ResponsiveContainer, 
    Cell, 
    PieChart, 
    Pie, 
    Tooltip as RechartsTooltip 
} from 'recharts';
import { dashboardService, financeService } from '../../lib/services';
import { useAuth } from '../../context/AuthContext';

export default function Reports() {
    const { user } = useAuth();
    const [performanceData, setPerformanceData] = useState<any[]>([]);
    const [kpis, setKpis] = useState<any>(null);
    const [costDistribution, setCostDistribution] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const companyId = (user as any)?.company_id;

    useEffect(() => {
        if (!companyId) return;
        const loadStats = async () => {
            try {
                const [drivers, kpiData, costs] = await Promise.all([
                    dashboardService.getDriverEfficiency(companyId),
                    financeService.getKpis(companyId),
                    dashboardService.getCostDistribution(companyId)
                ]);
                setPerformanceData(drivers);
                setKpis(kpiData);
                setCostDistribution(costs);
            } catch (error) {
                console.error("Error loading reports:", error);
            } finally {
                setLoading(false);
            }
        };
        loadStats();
    }, [companyId]);

    if (loading) return <div className="flex justify-center items-center h-full"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

    const handleExportExcel = () => {
        const data = performanceData.map(item => ({
            "Veículo": item.truck,
            "Motorista": item.driver,
            "Frete Bruto": item.revenue,
            "Custo Diesel": item.fuelCost,
            "KM/L": item.kmPerLiter,
            "Lucro Líquido": item.profit
        }));
        exportToExcel(data, 'relatorio_performance_logistica');
    };

    const avgKmL = performanceData.length > 0
        ? performanceData.reduce((acc, d) => acc + d.kmPerLiter, 0) / performanceData.length
        : 0;

    const stats = [
        { label: 'Frete Bruto Total', value: `R$ ${(kpis?.grossRevenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, trend: '---', positive: true, icon: <DollarSign size={24} /> },
        { label: 'Lucro Líquido', value: `R$ ${(kpis?.netRevenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, trend: '---', positive: (kpis?.netRevenue || 0) >= 0, icon: <TrendingUp size={24} /> },
        { label: 'Eficiência KM/L', value: `${avgKmL.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KM/L`, trend: '---', positive: true, icon: <Fuel size={24} /> },
        { label: 'Custos Operacionais', value: `R$ ${(kpis?.fuelExpenses + kpis?.maintenanceExpenses || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, trend: '---', icon: <BarChart3 size={24} /> },
    ];

    return (
        <div className="space-y-8 pb-12">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-white">Relatório de Lucratividade e KM/L</h1>
                    <p className="text-slate-400 mt-1">Análise detalhada de lucratividade e eficiência de combustível por motorista e veículo.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="bg-[#161B26] border border-white/5 rounded-xl p-1 flex">
                        <button className="px-4 py-2 text-sm font-bold bg-primary-600 text-white rounded-lg transition-all">30 Dias</button>
                        <button className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-white transition-all">90 Dias</button>
                        <button className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-white transition-all">Personalizado</button>
                    </div>
                    <button className="bg-primary-600 hover:bg-primary-500 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-[0_10px_20px_-5px_rgba(37,99,235,0.4)]">
                        <FileText size={18} />
                        Gerar PDF
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                    <div key={i} className="bg-[#161B26] p-6 rounded-[2rem] border border-white/5 hover:border-primary-500/20 transition-all group group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                            {stat.icon}
                        </div>
                        <p className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4">{stat.label}</p>
                        <h3 className="text-2xl font-black text-white mb-2">{stat.value}</h3>
                        <div className={`flex items-center gap-1.5 text-sm font-bold ${stat.positive !== undefined ? (stat.positive ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-400'}`}>
                            {stat.trend !== '---' && (stat.trend.includes('%') && (stat.positive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />))}
                            {stat.trend}
                            {stat.trend !== '---' && <span className="text-slate-500 ml-1">vs mês ant.</span>}
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Driver Performance Chart/List */}
                <div className="lg:col-span-2 bg-[#161B26] p-8 rounded-[2.5rem] border border-white/5">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-black text-white">Performance por Motorista</h3>
                            <p className="text-sm font-bold text-slate-500 mt-1 uppercase tracking-wider">Top motoristas por lucro líquido</p>
                        </div>
                        <button 
                            onClick={handleExportExcel}
                            className="text-slate-400 hover:text-white transition-colors"
                        >
                            <Download size={20} />
                        </button>
                    </div>

                    <div className="space-y-8">
                        {performanceData.slice(0, 5).map((item, i) => (
                            <div key={i} className="space-y-3">
                                <div className="flex justify-between items-end">
                                    <span className="font-black text-white text-lg">{item.driver} <span className='text-sm text-slate-500 font-medium'>({item.truck})</span></span>
                                    <span className="font-black text-primary-400">R$ {item.profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full transition-all duration-1000"
                                        style={{ width: `${Math.max(5, (item.profit / (performanceData[0]?.profit || 1)) * 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                        {performanceData.length === 0 && <p className="text-slate-500 text-center">Nenhum dado disponível.</p>}
                    </div>
                </div>

                {/* Cost Distribution Chart */}
                <div className="bg-[#161B26] p-8 rounded-[2.5rem] border border-white/5 flex flex-col items-center justify-center text-center">
                    <div className="w-full flex items-center justify-between mb-8">
                        <h3 className="text-xl font-black text-white">Composição de Custos</h3>
                        <PieChartIcon className="text-slate-500" size={20} />
                    </div>

                    {/* Chart Illustration */}
                    <div className="relative w-full h-[250px] mb-4">
                        {costDistribution.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-slate-500 text-sm font-medium">
                                Sem dados.
                            </div>
                        ) : (
                            <>
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie
                                            data={costDistribution}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {costDistribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip
                                            contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                                            itemStyle={{ color: '#fff' }}
                                            formatter={(value: any) => `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-2xl font-black text-white">100%</span>
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Custo Total</span>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="w-full grid grid-cols-2 gap-4 text-left">
                        {costDistribution.map((item, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                                <span className="text-xs font-bold text-slate-400">{item.label} ({item.percentage.toFixed(0)}%)</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-[#161B26] rounded-[2.5rem] border border-white/5 overflow-hidden">
                <div className="p-8 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <h3 className="text-xl font-black text-white">Detalhamento por Operação</h3>
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <input
                                type="text"
                                placeholder="Filtrar veículo ou motorista..."
                                className="bg-[#0B0F17] border border-white/5 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-primary-500 transition-all text-white"
                            />
                        </div>
                        <button className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all">
                            <Filter size={16} />
                            Filtros
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-white/2">
                                <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Veículo / Motorista</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Frete Bruto</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Diesel</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Km/L</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Lucro Líquido</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {performanceData.map((item, i) => (
                                <tr key={i} className="hover:bg-white/2 transition-colors">
                                    <td className="px-8 py-6">
                                        <div className="flex flex-col">
                                            <span className="font-black text-white">{item.truck}</span>
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{item.driver}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 font-bold text-white">R$ {item.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    <td className="px-8 py-6 font-bold text-slate-300">R$ {item.fuelCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    <td className="px-8 py-6">
                                        <span className={`px-3 py-1 text-xs font-black rounded-lg ${item.kmPerLiter > 2.5 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                            {item.kmPerLiter.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KM/L
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 font-black text-primary-400">R$ {item.profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {performanceData.length === 0 && <div className="p-8 text-center text-slate-500">Nenhum registro encontrado.</div>}
                </div>
            </div>
        </div>
    );
}

