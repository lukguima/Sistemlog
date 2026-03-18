import { useState, useEffect } from 'react';
import { X, TrendingUp, DollarSign, Fuel, Wrench, Calendar, Truck, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { dashboardService } from '../../lib/services';
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
    const companyId = (user as any)?.company_id;

    useEffect(() => {
        if (isOpen && vehicleId) {
            if (companyId) {
                fetchAnalytics();
            } else {
                setLoading(false);
            }
        }
    }, [isOpen, vehicleId, companyId]);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            const res = await dashboardService.getVehicleAnalytics(companyId, vehicleId);
            setData(res);
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
        custo: (t.tolls_value || 0) + (t.fuel_expense || 0)
    })).reverse() : [];

    const efficiencyData = data?.history?.fuels ? data.history.fuels.map((f: any) => ({
        name: new Date(f.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        kmPerLiter: f.liters > 0 ? (Number(f.km_reading) / Number(f.liters)) : 0
    })).reverse() : [];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900">
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

                <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-4">
                            <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin"></div>
                            <p className="text-sm font-bold text-slate-400 animate-pulse">Consolidando dados operacionais...</p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            
                            {/* KPI Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <DetailKPI 
                                    label="Receita Bruta" 
                                    value={`R$ ${(data?.stats?.totalGross || 0).toLocaleString('pt-BR')}`}
                                    percent="+12%" 
                                    up
                                    icon={<DollarSign size={18} className="text-blue-500" />}
                                />
                                <DetailKPI 
                                    label="Lucro Líquido" 
                                    value={`R$ ${(data?.stats?.netProfit || 0).toLocaleString('pt-BR')}`}
                                    percent="+8.4%" 
                                    up
                                    icon={<TrendingUp size={18} className="text-emerald-500" />}
                                />
                                <DetailKPI 
                                    label="Consumo Médio" 
                                    value={`${(data?.stats?.avgKmPerLiter || 0).toFixed(2)} KM/L`}
                                    percent="-2.1%" 
                                    icon={<Fuel size={18} className="text-orange-500" />}
                                />
                                <DetailKPI 
                                    label="Custo Manutenção" 
                                    value={`R$ ${(data?.stats?.totalMaint || 0).toLocaleString('pt-BR')}`}
                                    percent="+5.4%" 
                                    icon={<Wrench size={18} className="text-rose-500" />}
                                />
                            </div>

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
                                                        {trip.origin_city} ➔ {trip.destination_city}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-black text-sm text-slate-900 dark:text-white">R$ {trip.gross_value.toLocaleString('pt-BR')}</div>
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
                                                    <div className="text-right font-black text-xs">R$ {m.cost.toLocaleString('pt-BR')}</div>
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

function DetailKPI({ label, value, percent, icon, up }: { label: string, value: string, percent: string, icon: any, up?: boolean }) {
    return (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col gap-3 group hover:border-primary-300 transition-all">
            <div className="flex justify-between items-start">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-700 rounded-2xl group-hover:bg-primary-50 dark:group-hover:bg-primary-900/30 transition-colors">
                    {icon}
                </div>
                <div className={`p-1.5 rounded-xl text-[9px] font-black flex items-center gap-1 ${up ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                    {up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                    {percent}
                </div>
            </div>
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
                <div className="text-xl font-black text-slate-800 dark:text-white mt-0.5 tracking-tight">{value}</div>
            </div>
        </div>
    );
}
