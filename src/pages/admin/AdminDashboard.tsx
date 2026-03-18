import { TrendingUp, Truck, Wrench, Fuel, Download, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, ArrowUpRight, DollarSign, FileText, Disc, Calculator, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { financeService, tripService, dashboardService, maintenanceService } from '../../lib/services';
import { exportToExcel, exportMultipleSheetsToExcel } from '../../lib/exports';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import FreightSimulatorModal from '../../components/admin/FreightSimulatorModal';
import VehicleDetailsModal from '../../components/admin/VehicleDetailsModal';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
    const { user } = useAuth();
    const [trips, setTrips] = useState<any[]>([]);
    const [kpis, setKpis] = useState({ 
        grossRevenue: 0, 
        fuelExpenses: 0, 
        maintenanceExpenses: 0, 
        netRevenue: 0,
        tripTolls: 0,
        tripInsurance: 0,
        fixedInsurance: 0
    });
    const [costDist, setCostDist] = useState<any[]>([]);
    const [truckProfitability, setTruckProfitability] = useState<any[]>([]);
    const [driverEfficiency, setDriverEfficiency] = useState<any[]>([]);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
    const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
    const navigate = useNavigate();

    // Estado do navegador de datas
    const [dateViewMode, setDateViewMode] = useState<'month' | 'year'>('month');
    const [currentDate, setCurrentDate] = useState(new Date());

    const companyId = (user as any)?.company_id;

    useEffect(() => {
        if (!companyId) return;

        const fetchData = async () => {
            try {
                setLoading(true);
                // Calcula range de datas
                const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
                
                if (dateViewMode === 'year') {
                    start.setMonth(0);
                    start.setDate(1);
                    end.setFullYear(currentDate.getFullYear());
                    end.setMonth(11);
                    end.setDate(31);
                }
                const startDate = start.toISOString().split('T')[0];
                const endDate = end.toISOString().split('T')[0];

                const [kpisRes, tripsRes, trucksRes, driversRes, alertsRes, costRes] = await Promise.allSettled([
                    financeService.getKpis(companyId, startDate, endDate),
                    tripService.getTrips(companyId, startDate, endDate),
                    dashboardService.getTruckProfitability(companyId, startDate, endDate),
                    dashboardService.getDriverEfficiency(companyId, startDate, endDate),
                    dashboardService.getSystemAlerts(companyId),
                    dashboardService.getCostDistribution(companyId, startDate, endDate)
                ]);

                if (kpisRes.status === 'fulfilled') setKpis(kpisRes.value);
                else console.error('Error getKpis:', kpisRes.reason);

                if (tripsRes.status === 'fulfilled') setTrips(tripsRes.value.slice(0, 5));
                else console.error('Error getTrips:', tripsRes.reason);

                if (trucksRes.status === 'fulfilled') setTruckProfitability(trucksRes.value.slice(0, 5));
                else console.error('Error getTruckProfitability:', trucksRes.reason);

                if (driversRes.status === 'fulfilled') setDriverEfficiency(driversRes.value.slice(0, 6));
                else console.error('Error getDriverEfficiency:', driversRes.reason);

                if (alertsRes.status === 'fulfilled') setAlerts(alertsRes.value.slice(0, 4));
                else console.error('Error getSystemAlerts:', alertsRes.reason);



                if (costRes.status === 'fulfilled') setCostDist(costRes.value);
                else console.error('Error getCostDistribution:', costRes.reason);

            } catch (error) {
                console.error('Error in dashboard fetch process:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [companyId, currentDate, dateViewMode]);

    // Helpers Navegador de Data
    const handlePrevDate = () => {
        const newDate = new Date(currentDate);
        if (dateViewMode === 'month') newDate.setMonth(newDate.getMonth() - 1);
        else newDate.setFullYear(newDate.getFullYear() - 1);
        setCurrentDate(newDate);
    };

    const handleNextDate = () => {
        const newDate = new Date(currentDate);
        if (dateViewMode === 'month') newDate.setMonth(newDate.getMonth() + 1);
        else newDate.setFullYear(newDate.getFullYear() + 1);
        setCurrentDate(newDate);
    };

    const formatDateDisplay = () => {
        if (dateViewMode === 'year') {
            return `Visão Geral - ${currentDate.getFullYear()}`;
        }
        const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        return `Visão Geral - ${meses[currentDate.getMonth()]} de ${currentDate.getFullYear()}`;
    };

    const exportData = async () => {
        if (!companyId) {
            alert('Erro: ID da empresa não encontrado. Tente fazer login novamente.');
            return;
        }
        try {
            setIsExporting(true);
            const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
            
            if (dateViewMode === 'year') {
                start.setMonth(0);
                start.setDate(1);
                end.setFullYear(currentDate.getFullYear());
                end.setMonth(11);
                end.setDate(31);
            }
            const startDate = start.toISOString().split('T')[0];
            const endDate = end.toISOString().split('T')[0];

            // Busca dados completos para o relatório (sem limites de slice)
            const [tripsFull, fuelFull, maintenanceFull] = await Promise.all([
                tripService.getTrips(companyId, startDate, endDate),
                dashboardService.getTruckProfitability(companyId, startDate, endDate),
                maintenanceService.getMaintenanceHistory(companyId, startDate, endDate)
            ]);

            const summaryData = [
                { "Descrição": "RESUMO FINANCEIRO", "Valor": "" },
                { "Descrição": "Receita Bruta", "Valor": kpis.grossRevenue },
                { "Descrição": "Despesas Totais", "Valor": (kpis.fuelExpenses || 0) + (kpis.maintenanceExpenses || 0) + (kpis.tripTolls || 0) + (kpis.tripInsurance || 0) + (kpis.fixedInsurance || 0) },
                { "Descrição": "Lucro Líquido", "Valor": kpis.netRevenue },
                { "Descrição": "", "Valor": "" },
                { "Descrição": "KPIs DETALHADOS", "Valor": "" },
                { "Descrição": "Custo Diesel", "Valor": kpis.fuelExpenses || 0 },
                { "Descrição": "Custo Manutenção", "Valor": kpis.maintenanceExpenses || 0 },
                { "Descrição": "Pedágios", "Valor": kpis.tripTolls || 0 },
                { "Descrição": "Seguros", "Valor": (kpis.tripInsurance || 0) + (kpis.fixedInsurance || 0) },
            ];

            const tripsData = tripsFull.map(t => ({
                "Data": new Date(t.created_at).toLocaleDateString('pt-BR'),
                "Descrição": t.cargo_description || 'Frete Geral',
                "Origem": t.origin_city,
                "Destino": t.destination_city,
                "Veículo": t.vehicle?.plate || '---',
                "Motorista": t.driver?.name || '---',
                "Valor Bruto": t.gross_value,
                "Pedágio": t.tolls_value || 0,
                "Seguro": t.insurance_value || 0,
                "Peso (Kg)": t.weight || 0,
                "Status": t.status
            }));

            const fuelData = fuelFull.map(f => ({
                "Placa": f.plate,
                "Receita Bruta": f.gross,
                "Despesas Operacionais": f.expenses,
                "Lucro Líquido": f.net
            }));

            const maintenanceData = maintenanceFull.map(m => ({
                "Data": new Date(m.date).toLocaleDateString('pt-BR'),
                "Veículo": m.vehicle?.plate || '---',
                "Tipo": m.type === 'preventive' ? 'Preventiva' : 'Corretiva',
                "Descrição": m.description,
                "Custo": m.cost,
                "KM": m.km || m.current_km
            }));

            const sheets = [
                { name: "Resumo Financeiro", data: summaryData },
                { name: "Fretes e Viagens", data: tripsData },
                { name: "Rentabilidade por Veículo", data: fuelData },
                { name: "Histórico Manutenções", data: maintenanceData }
            ];

            exportMultipleSheetsToExcel(sheets, `Relatorio_Logistica_${formatDateDisplay().replace(/\s/g, '_')}`);
        } catch (error) {
            console.error('Erro ao exportar:', error);
            alert('Erro ao gerar relatório. Tente novamente.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleLaunchTrip = (simData: any) => {
        // Salva os dados da simulação no localStorage para serem pegos na página de Trips
        localStorage.setItem('pending_trip_simulation', JSON.stringify({
            origin_city: '', // Usuário preenche ou podemos inferir se tivermos dados
            destination_city: '',
            gross_value: simData.suggestedFreight,
            distance_km: simData.distance,
            fuel_expense: simData.fuelCost,
            toll_expense: parseFloat(simData.tolls) || 0,
            other_expenses: parseFloat(simData.otherExpenses) || 0,
            weight: simData.weight,
            simulated: true
        }));
        setIsSimulatorOpen(false);
        navigate('/admin/trips');
    };

    const handleOpenVehicleModal = (id: string) => {
        setSelectedVehicleId(id);
        setIsVehicleModalOpen(true);
    };

    return (
        <div className="flex-1 flex flex-col h-screen overflow-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display">
            <main className="flex-1 p-6 md:p-8 overflow-y-auto w-full">

                {/* 1. Header do Dashboard com Navegador de Data */}
                <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-6 mb-8">
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-fit">
                        <div className="flex bg-slate-100 dark:bg-slate-800/80 rounded-lg p-1">
                            <button
                                onClick={() => setDateViewMode('month')}
                                className={`px-4 py-1.5 text-sm font-semibold transition-all rounded-md ${dateViewMode === 'month' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                            >
                                Mensal
                            </button>
                            <button
                                onClick={() => setDateViewMode('year')}
                                className={`px-4 py-1.5 text-sm font-semibold transition-all rounded-md ${dateViewMode === 'year' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                            >
                                Anual
                            </button>
                        </div>

                        <div className="hidden sm:block h-6 w-px bg-slate-200 dark:bg-slate-700"></div>

                        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white shrink-0">
                            {formatDateDisplay()}
                        </h2>

                        <div className="flex gap-1.5 ml-auto sm:ml-2">
                            <button onClick={handlePrevDate} className="w-9 h-9 flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 bg-white dark:bg-surface-dark transition-colors shadow-sm">
                                <ChevronLeft size={18} className="text-slate-600 dark:text-slate-300" />
                            </button>
                            <button onClick={handleNextDate} className="w-9 h-9 flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 bg-white dark:bg-surface-dark transition-colors shadow-sm">
                                <ChevronRight size={18} className="text-slate-600 dark:text-slate-300" />
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-3 self-start lg:self-auto">
                        <button 
                            onClick={() => setIsSimulatorOpen(true)}
                            className="flex items-center justify-center gap-2 px-6 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-blue-600 dark:text-blue-400"
                        >
                            <Calculator size={18} /> Simulador de Frete
                        </button>
                        <button 
                            onClick={exportData}
                            disabled={isExporting}
                            className="btn-primary flex items-center justify-center gap-2 min-w-[160px] disabled:opacity-50"
                        >
                            {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} 
                            {isExporting ? 'Processando...' : 'Exportar Relatório'}
                        </button>
                    </div>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <MetricCard title="Receita Realizada" value={kpis.grossRevenue} icon={<DollarSign className="text-emerald-500" />} isCurrency />
                    <MetricCard title="Lucro Líquido" value={kpis.netRevenue} icon={<TrendingUp className="text-blue-500" />} isCurrency />
                    <MetricCard title="Custo Diesel" value={kpis.fuelExpenses} icon={<Fuel className="text-orange-500" />} isCurrency />
                    <MetricCard title="Custo Manutenção" value={kpis.maintenanceExpenses} icon={<Wrench className="text-rose-500" />} isCurrency />
                </div>

                {/* Main Dashboard Grid: 3 Columns */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    
                    {/* Column 1: Rankings */}
                    <div className="flex flex-col gap-6">
                        {/* Top Veículos por Lucro */}
                        <div className="card overflow-hidden flex flex-col shadow-sm">
                            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-bold flex items-center gap-2">
                                        <TrendingUp size={20} className="text-emerald-500" /> Top Veículos por Lucro
                                    </h2>
                                    <Link to="/admin/fleet" className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center gap-1">
                                        Ver todos <ArrowUpRight size={16} />
                                    </Link>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Faturamento Bruto vs Despesas Operacionais</p>
                            </div>
                            <div className="p-2 flex-1">
                                {loading ? (
                                    <p className="text-center text-slate-400 py-8">Carregando...</p>
                                ) : truckProfitability.length > 0 ? (
                                    <div className="space-y-4 p-4">
                                        {truckProfitability.map((truck, idx) => (
                                            <div key={idx} className="group">
                                                <div className="flex justify-between items-end mb-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${idx === 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                                            {idx + 1}
                                                        </div>
                                                        <button 
                                                            onClick={() => handleOpenVehicleModal(truck.vehicle_id)}
                                                            className="font-bold text-sm hover:text-primary-600 transition-colors"
                                                        >
                                                            {truck.plate}
                                                        </button>
                                                    </div>
                                                    <span className="text-emerald-500 font-bold text-sm">R$ {Math.max(0, truck.net).toLocaleString('pt-BR')}</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-1000"
                                                        style={{ width: `${Math.max(10, Math.min(100, (truck.net / (truckProfitability[0]?.net || 1)) * 100))}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-slate-500">Poucos dados.</div>
                                )}
                            </div>
                        </div>

                        {/* Top Eficiência Caminhões */}
                        <div className="card overflow-hidden flex flex-col shadow-sm">
                            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-bold flex items-center gap-2">
                                        <Fuel size={20} className="text-primary-500" /> Top Eficiência
                                    </h2>
                                    <Link to="/admin/fuel" className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400">
                                        <ArrowUpRight size={16} />
                                    </Link>
                                </div>
                            </div>
                            <div className="flex-1 overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50/50 dark:bg-slate-800/50 text-[10px] uppercase font-bold text-slate-400">
                                        <tr>
                                            <th className="px-4 py-2">Motorista</th>
                                            <th className="px-4 py-2 text-right">Receita</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[13px]">
                                        {loading ? (
                                            <tr><td colSpan={2} className="px-4 py-4 text-center text-slate-400">...</td></tr>
                                        ) : driverEfficiency.length > 0 ? (
                                            driverEfficiency.slice(0, 3).map((d: any, idx: number) => (
                                                <tr key={idx}>
                                                    <td className="px-4 py-3 font-bold truncate max-w-[100px]">{d.driver}</td>
                                                    <td className="px-4 py-3 text-right font-medium">R$ {Math.round(d.revenue || 0).toLocaleString('pt-BR')}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr><td colSpan={2} className="px-4 py-4 text-center text-slate-500 text-xs">Sem dados.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Column 2: Cost Composition (Center) */}
                    <div className="card p-6 md:p-8 flex flex-col items-center shadow-sm bg-white/50 backdrop-blur-sm dark:bg-slate-900/50">
                        <h3 className="text-lg font-bold self-start mb-1 flex items-center gap-2">
                            <TrendingUp size={20} className="text-blue-500" /> Composição de Custos
                        </h3>
                        <p className="text-xs text-slate-500 self-start mb-6">Onde seu dinheiro está aplicado</p>
                        <div className="h-[220px] w-full flex-1">
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie data={costDist} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value">
                                        {costDist.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: any) => `R$ ${value.toLocaleString()}`} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-1 w-full gap-2 mt-4 text-[13px]">
                            {costDist.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span className="font-semibold text-slate-600 dark:text-slate-400">{item.label}</span>
                                    </div>
                                    <span className="font-bold">{item.percentage.toFixed(1)}%</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Column 3: Alerts & Maintenance */}
                    <div className="card flex flex-col border-orange-200 dark:border-orange-900/50 overflow-hidden shadow-sm">
                        <div className="p-5 border-b border-orange-100 dark:border-orange-900/50 flex justify-between items-center bg-orange-50/50 dark:bg-orange-900/10">
                            <h2 className="text-lg font-bold flex items-center gap-2 text-orange-700 dark:text-orange-500">
                                <AlertTriangle size={20} className="animate-pulse" /> Alertas
                            </h2>
                             <Link to="/admin/maintenance" className="text-sm font-medium text-orange-600">
                                <ArrowUpRight size={16} />
                            </Link>
                        </div>
                        <div className="p-5 flex-1 flex flex-col gap-3 overflow-y-auto max-h-[500px]">
                            {loading ? (
                                <p className="text-center text-slate-400 py-8">Carregando...</p>
                            ) : alerts?.length > 0 ? (
                                alerts.map((alert, i) => (
                                    <div key={i} className={`p-3 rounded-xl border flex gap-3 items-start ${alert.severity === 'critical' ? 'bg-red-50/50 border-red-100' : 'bg-orange-50/30 border-orange-100'}`}>
                                        <div className={`mt-0.5 rounded-full p-1.5 shrink-0 ${alert.severity === 'critical' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                                            {alert.type === 'Document' ? <FileText size={14} /> : alert.type === 'Tyre' ? <Disc size={14} /> : <Wrench size={14} />}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-[13px] leading-tight">{alert.title}</h4>
                                            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">{alert.message}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full py-8 text-emerald-500 opacity-80">
                                    <CheckCircle2 size={48} className="mb-3 opacity-50" />
                                    <p className="text-sm font-medium text-center">Tudo em ordem!</p>
                                    <p className="text-xs text-slate-500 mt-1">Sem pendências.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom Section: Full Width Trips */}
                <div className="card flex flex-col shadow-sm mb-8">
                    <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20 rounded-t-xl">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Truck size={20} className="text-primary-500" /> Últimos Fretes
                        </h2>
                        <Link to="/admin/trips" className="text-sm font-medium text-primary-600 flex items-center gap-1">
                            Ver todos <ArrowUpRight size={16} />
                        </Link>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-800/50">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Carga / Rota</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Veículo</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Valor</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
                                {loading ? (
                                    <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400">Carregando...</td></tr>
                                ) : trips.length > 0 ? (
                                    trips.map(f => (
                                        <tr key={f.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-800 dark:text-slate-200">{f.cargo_description || 'Frete Geral'}</div>
                                                <div className="text-xs text-slate-500 mt-0.5">{f.origin_city} → {f.destination_city}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <button 
                                                    onClick={() => handleOpenVehicleModal(f.vehicle_id)}
                                                    className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-bold rounded border border-slate-200 dark:border-slate-700 text-xs hover:bg-white hover:border-primary-500 transition-all cursor-pointer"
                                                >
                                                    {f.vehicle?.plate || '---'}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 font-bold">R$ {(f.gross_value || 0).toLocaleString('pt-BR')}</td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border
                                                    ${(f.status === 'completed' || f.status === 'Concluído' || f.status === 'paid') ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                                        (f.status === 'in_transit' || f.status === 'Em Trânsito') ? 'bg-primary-50 text-primary-600 border-primary-200' : 'bg-orange-50 text-orange-600 border-orange-200'}
                                                `}>
                                                    {f.status === 'paid' ? 'Pago' : f.status === 'completed' ? 'Concluído' : f.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">Nenhum frete recente.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            <FreightSimulatorModal 
                isOpen={isSimulatorOpen} 
                onClose={() => setIsSimulatorOpen(false)}
                onLaunch={handleLaunchTrip}
            />
            <VehicleDetailsModal 
                isOpen={isVehicleModalOpen}
                onClose={() => setIsVehicleModalOpen(false)}
                vehicleId={selectedVehicleId || ''}
            />
        </div>
    );
}

function MetricCard({ title, value, icon, trend, up, isCurrency }: { title: string, value: number, icon: any, trend?: string, up?: boolean, isCurrency?: boolean }) {
    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
            <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-xl text-primary-600 dark:text-primary-400">
                    {icon}
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 text-xs font-bold ${up ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {trend}
                    </div>
                )}
            </div>
            <div className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">{title}</div>
            <div className="text-2xl font-bold tracking-tight">
                {isCurrency && "R$ "} {(value || 0).toLocaleString('pt-BR')}
            </div>
        </div>
    );
}
