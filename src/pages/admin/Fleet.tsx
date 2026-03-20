import { useState, useEffect } from 'react';
import { Truck, Users, Plus, Search, MoreVertical, Edit2, Trash2, Calendar, Download, FileText, Loader2, AlertTriangle, X, Zap, Star, Building2 } from 'lucide-react';

const KIWIFY_BASICO = 'https://pay.kiwify.com.br/Xo5neXV';
const KIWIFY_PRO = 'https://pay.kiwify.com.br/9f3rjhC';
const KIWIFY_ENTERPRISE = 'https://pay.kiwify.com.br/itrSZqN';

const PLAN_LIMITS: Record<string, number | null> = {
    trial: 3,
    basico: 5,
    pro: 20,
    enterprise: null,
};

function getVehicleLimit(subscription: any): number | null {
    if (!subscription) return PLAN_LIMITS['trial'] as number;
    // vehicle_limit explícito no banco tem prioridade
    if (subscription.vehicle_limit !== undefined && subscription.vehicle_limit !== null) return subscription.vehicle_limit;
    // null = ilimitado (enterprise), undefined/desconhecido = 3
    const planLimit = PLAN_LIMITS[subscription.plan];
    return planLimit !== undefined ? planLimit : 3;
}
import { exportToExcel, exportToPDF } from '../../lib/exports';
import { useAuth } from '../../context/AuthContext';
import { fleetService, tripService, maintenanceService, driverService } from '../../lib/services';
import { supabase } from '../../lib/supabase';
import AddTruckModal from '../../components/admin/AddTruckModal';
import DriverModal from '../../components/admin/DriverModal';

export default function Fleet() {
    const { user, subscription } = useAuth();
    const [activeTab, setActiveTab] = useState<'vehicles' | 'drivers'>('vehicles');
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isTruckModalOpen, setIsTruckModalOpen] = useState(false);
    const [modalData, setModalData] = useState<any>({});
    const [editingId, setEditingId] = useState<string | null>(null);
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [isExporting, setIsExporting] = useState(false);
    const [showLimitModal, setShowLimitModal] = useState(false);

    const companyId = (user as any)?.company_id;
    const vehicleLimit = getVehicleLimit(subscription);
    const atVehicleLimit = vehicleLimit !== null && vehicles.length >= vehicleLimit;

    const fetchData = async () => {
        let targetCompanyId = companyId;

        if (!targetCompanyId && user?.id) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('company_id')
                .eq('id', user.id)
                .single();
            targetCompanyId = profile?.company_id;
        }

        if (!targetCompanyId) {
            setLoading(false);
            return;
        }

        try {
            const [vData, dData] = await Promise.all([
                fleetService.getVehicles(targetCompanyId),
                fleetService.getDrivers(targetCompanyId)
            ]);
            setVehicles(vData || []);
            setDrivers(dData || []);
        } catch (error) {
            console.error('Error fetching fleet data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [companyId, user?.id]);



    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir?")) return;
        try {
            if (activeTab === 'vehicles') {
                await fleetService.deleteVehicle(id);
                setVehicles(vehicles.filter(v => v.id !== id));
            } else {
                await fleetService.deleteDriver(id);
                setDrivers(drivers.filter(d => d.id !== id));
            }
        } catch (error) {
            console.error('Error deleting:', error);
        }
    };

    const openEditDriver = (driver: any) => {
        setModalData(driver);
        setEditingId(driver.id);
        setIsModalOpen(true);
    };

    const openEditVehicle = (vehicle: any) => {
        setModalData(vehicle);
        setEditingId(vehicle.id);
        setIsTruckModalOpen(true);
    };

    const handleExport = async (type: 'excel' | 'pdf') => {
        if (!companyId) {
            alert("ID da empresa não encontrado.");
            return;
        }
        setIsExporting(true);
        
        try {
            // Buscar dados do período
            const [trips, fuels, maintenances] = await Promise.all([
                tripService.getTrips(companyId, startDate, endDate),
                driverService.getFuelRecords(companyId, startDate, endDate),
                maintenanceService.getMaintenanceHistory(companyId, startDate, endDate)
            ]);

            if (activeTab === 'vehicles') {
                const exportData = vehicles.map(v => {
                    const vehicleTrips = trips.filter(t => t.vehicle_id === v.id);
                    const vehicleFuels = fuels.filter(f => f.vehicle_id === v.id);
                    const vehicleMaints = maintenances.filter(m => m.vehicle_id === v.id);
                    
                    const gross = vehicleTrips.reduce((acc, t) => acc + (Number(t.gross_value) || 0), 0);
                    const tolls = vehicleTrips.reduce((acc, t) => acc + (Number(t.tolls_value) || 0), 0);
                    const fuelCost = vehicleFuels.reduce((acc, f) => acc + (Number(f.total_value) || 0), 0);
                    const maintCost = vehicleMaints.reduce((acc, m) => acc + (Number(m.cost) || 0), 0);
                    const net = gross - (tolls + fuelCost + maintCost);

                    return {
                        'Placa': v.plate,
                        'Modelo': v.model || '---',
                        'Marca': v.brand || '---',
                        'Receita Bruta': gross,
                        'Combustível (R$)': fuelCost,
                        'Manutenção (R$)': maintCost,
                        'Pedágios (R$)': tolls,
                        'Resultado Líquido': net,
                        'KM Atual': v.current_km || 0
                    };
                });

                if (type === 'excel') {
                    exportToExcel(exportData, `Relatorio_Frota_Veiculos_${startDate}_${endDate}`);
                } else {
                    const headers = [['Placa', 'Modelo', 'Receita Bruta', 'Combustível', 'Manutenção', 'Resultado']];
                    const body = exportData.map(v => [
                        v.Placa, 
                        v.Modelo, 
                        v['Receita Bruta'].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                        v['Combustível (R$)'].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                        v['Manutenção (R$)'].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                        v['Resultado Líquido'].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                    ]);
                    exportToPDF('Relatório de Frota - Veículos', headers, body, `Relatorio_Frota_Veiculos_${startDate}_${endDate}`);
                }
            } else {
                const exportData = drivers.map(d => {
                    const driverTrips = trips.filter(t => t.driver_id === d.id);
                    const driverFuels = fuels.filter(f => f.driver_id === d.id);
                    
                    const gross = driverTrips.reduce((acc, t) => acc + (Number(t.gross_value) || 0), 0);
                    const tolls = driverTrips.reduce((acc, t) => acc + (Number(t.tolls_value) || 0), 0);
                    const fuelCost = driverFuels.reduce((acc, f) => acc + (Number(f.total_value) || 0), 0);
                    const net = gross - (tolls + fuelCost);

                    return {
                        'Nome': d.name,
                        'Total Viagens': driverTrips.length,
                        'Receita Bruta': gross,
                        'Combustível (R$)': fuelCost,
                        'Resultado Gerado': net,
                        'Status': d.status === 'active' ? 'Ativo' : 'Inativo'
                    };
                });

                if (type === 'excel') {
                    exportToExcel(exportData, `Relatorio_Frota_Motoristas_${startDate}_${endDate}`);
                } else {
                    const headers = [['Nome', 'Viagens', 'Receita Bruta', 'Combustível', 'Resultado', 'Status']];
                    const body = exportData.map(d => [
                        d.Nome,
                        d['Total Viagens'].toString(),
                        d['Receita Bruta'].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                        d['Combustível (R$)'].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                        d['Resultado Gerado'].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                        d.Status
                    ]);
                    exportToPDF('Relatório de Frota - Motoristas', headers, body, `Relatorio_Frota_Motoristas_${startDate}_${endDate}`);
                }
            }
            
            alert(`Relatório ${type.toUpperCase()} gerado com sucesso!`);
        } catch (error) {
            console.error('Erro ao exportar:', error);
            alert('Ocorreu um erro ao gerar o relatório.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <>
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in transition-all">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Frota e Motoristas</h1>
                    <p className="text-slate-500 dark:text-slate-400">Gerencie veículos, motoristas e acompanhe o status da sua operação.</p>
                </div>
                {activeTab === 'vehicles' && subscription?.vehicle_limit !== null && subscription?.vehicle_limit !== undefined && (
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 ${vehicles.length >= subscription.vehicle_limit ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                        {vehicles.length >= (subscription.vehicle_limit ?? Infinity) && <AlertTriangle size={12} />}
                        {vehicles.length}/{subscription.vehicle_limit} veículos
                    </span>
                )}
                <button
                    onClick={() => {
                        if (activeTab === 'vehicles' && atVehicleLimit) {
                            setShowLimitModal(true);
                            return;
                        }
                        setEditingId(null);
                        setModalData({});
                        if (activeTab === 'vehicles') {
                            setIsTruckModalOpen(true);
                        } else {
                            setIsModalOpen(true);
                        }
                    }}
                    className="btn-primary flex items-center gap-2 py-2 px-4 shadow-lg shadow-primary/20"
                >
                    <Plus size={20} />
                    Cadastrar {activeTab === 'vehicles' ? 'Veículo' : 'Motorista'}
                </button>
            </div>

            <div className="flex border-b border-slate-200 dark:border-slate-800">
                <button
                    onClick={() => setActiveTab('vehicles')}
                    className={`px-6 py-3 text-sm font-bold transition-colors border-b-2 ${activeTab === 'vehicles' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    <div className="flex items-center gap-2">
                        <Truck size={18} /> Veículos
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('drivers')}
                    className={`px-6 py-3 text-sm font-bold transition-colors border-b-2 ${activeTab === 'drivers' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    <div className="flex items-center gap-2">
                        <Users size={18} /> Motoristas
                    </div>
                </button>
            </div>

            <div className="card overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 justify-between bg-slate-50 dark:bg-slate-800/30 items-center">
                    <div className="relative flex-1 max-w-md w-full">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" placeholder="Buscar..." className="input-field pl-10 py-2 text-sm" />
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                            <Calendar size={14} className="text-slate-400 ml-1" />
                            <input 
                                type="date" 
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-transparent border-none text-[10px] font-bold focus:ring-0 p-0 w-24"
                            />
                            <span className="text-slate-300">|</span>
                            <input 
                                type="date" 
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-transparent border-none text-[10px] font-bold focus:ring-0 p-0 w-24"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => handleExport('excel')}
                                disabled={isExporting}
                                className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 rounded-xl text-xs font-bold transition-all border border-emerald-100 dark:border-emerald-800"
                            >
                                {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                Excel
                            </button>
                            <button 
                                onClick={() => handleExport('pdf')}
                                disabled={isExporting}
                                className="flex items-center gap-2 px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400 rounded-xl text-xs font-bold transition-all border border-rose-100 dark:border-rose-800"
                            >
                                {isExporting ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                                PDF
                            </button>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 uppercase text-xs font-semibold text-slate-400">
                            {activeTab === 'vehicles' ? (
                                <tr>
                                    <th className="px-6 py-4">Placa</th>
                                    <th className="px-6 py-4">Modelo/Ano</th>
                                    <th className="px-6 py-4">KM Atual</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Ações</th>
                                </tr>
                            ) : (
                                <tr>
                                    <th className="px-6 py-4">Nome / Email</th>
                                    <th className="px-6 py-4">CNH</th>
                                    <th className="px-6 py-4">Telefone</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Ações</th>
                                </tr>
                            )}
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                                        Carregando dados...
                                    </td>
                                </tr>
                            ) : activeTab === 'vehicles' ? (
                                vehicles.length > 0 ? (
                                    vehicles.map(v => (
                                        <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-white uppercase">{v.plate}</td>
                                            <td className="px-6 py-4">
                                                <span className="font-medium text-slate-700 dark:text-slate-300">{v.model}</span>
                                                <span className="block text-xs text-slate-500">{v.year}</span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium">{(v.current_km || 0).toLocaleString()} km</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${v.status?.toLowerCase() === 'active' || v.status === 'Ativo' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400'}`}>
                                                    {v.status?.toLowerCase() === 'active' ? 'Ativo' : v.status === 'maintenance' ? 'Em Manutenção' : v.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2 text-slate-400">
                                                    <button onClick={() => openEditVehicle(v)} className="p-1 hover:text-primary transition-colors"><Edit2 size={16} /></button>
                                                    <button onClick={() => handleDelete(v.id)} className="p-1 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
                                                    <button className="p-1 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"><MoreVertical size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Nenhum veículo cadastrado.</td>
                                    </tr>
                                )
                            ) : (
                                drivers.length > 0 ? (
                                    drivers.map(d => (
                                        <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <span className="font-bold text-slate-900 dark:text-white block">{d.name}</span>
                                                <span className="text-xs text-slate-500">{d.email || 'Sem email'}</span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-400">{d.license_number}</td>
                                            <td className="px-6 py-4 text-sm font-medium">{d.phone}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${d.status?.toLowerCase() === 'disponível' || d.status?.toLowerCase() === 'available' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'}`}>
                                                    {d.status?.toLowerCase() === 'available' ? 'Disponível' : d.status?.toLowerCase() === 'busy' ? 'Ocupado' : d.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2 text-slate-400">
                                                    <button onClick={() => openEditDriver(d)} className="p-1 hover:text-primary transition-colors"><Edit2 size={16} /></button>
                                                    <button onClick={() => handleDelete(d.id)} className="p-1 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
                                                    <button className="p-1 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"><MoreVertical size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Nenhum motorista cadastrado.</td>
                                    </tr>
                                )
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Modal de Cadastro de Caminhão Especializado */}
            <AddTruckModal
                isOpen={isTruckModalOpen}
                onClose={() => {
                    setIsTruckModalOpen(false);
                    setEditingId(null);
                    setModalData({});
                }}
                onSave={async (data) => {
                    let targetCompanyId = companyId;

                    // Fallback: Tenta buscar do banco se não estiver no contexto
                    if (!targetCompanyId && user?.id) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('company_id')
                            .eq('id', user.id)
                            .single();
                        targetCompanyId = profile?.company_id;
                    }

                    if (!targetCompanyId) throw new Error("ID da empresa não encontrado. Por favor, faça logout e login novamente.");

                    if (editingId) {
                        await fleetService.updateVehicle(editingId, data);
                    } else {
                        await fleetService.addVehicle({ ...data, company_id: targetCompanyId, status: 'active' });
                    }
                    await fetchData();
                    setIsTruckModalOpen(false);
                    setEditingId(null);
                    setModalData({});
                }}
                initialData={editingId ? modalData : undefined}
            />

            {/* Modal de Cadastro de Motorista Padronizado */}
            <DriverModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingId(null);
                    setModalData({});
                }}
                onSave={async (data) => {
                    let targetCompanyId = companyId;

                    if (!targetCompanyId && user?.id) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('company_id')
                            .eq('id', user.id)
                            .single();
                        targetCompanyId = profile?.company_id;
                    }

                    if (!targetCompanyId) throw new Error("ID da empresa não encontrado.");

                    if (editingId) {
                        await fleetService.updateDriver(editingId, data);
                    } else {
                        await fleetService.addDriver({
                            ...data,
                            company_id: targetCompanyId,
                            status: 'available'
                        });
                    }
                    await fetchData();
                }}
                initialData={editingId ? modalData : undefined}
            />
        </div>

        {/* Modal de Limite de Veículos */}

        {showLimitModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-t-2xl p-6 text-white relative">
                        <button onClick={() => setShowLimitModal(false)} className="absolute top-4 right-4 text-white/70 hover:text-white">
                            <X size={20} />
                        </button>
                        <div className="flex items-center gap-3 mb-1">
                            <AlertTriangle size={24} />
                            <h2 className="text-xl font-bold">Limite do plano atingido</h2>
                        </div>
                        <p className="text-white/80 text-sm">
                            Seu plano <strong>{subscription?.plan === 'basico' ? 'Básico' : subscription?.plan === 'trial' ? 'Trial' : subscription?.plan}</strong> permite até <strong>{vehicleLimit} veículos</strong>. Faça upgrade para continuar crescendo.
                        </p>
                    </div>

                    {/* Planos */}
                    <div className="p-6 grid grid-cols-3 gap-3">
                        {/* Básico */}
                        <div className={`rounded-xl border-2 p-4 text-center flex flex-col gap-2 ${subscription?.plan === 'basico' ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                            <Truck size={22} className="mx-auto text-blue-500" />
                            <p className="font-bold text-sm text-slate-800">Básico</p>
                            <p className="text-2xl font-extrabold text-blue-600">5</p>
                            <p className="text-xs text-slate-500">veículos</p>
                            {subscription?.plan !== 'basico' && (
                                <a href={KIWIFY_BASICO} target="_blank" rel="noopener noreferrer"
                                    className="mt-1 text-xs bg-blue-600 text-white rounded-lg py-1.5 font-semibold hover:bg-blue-700 transition-colors">
                                    Assinar
                                </a>
                            )}
                            {subscription?.plan === 'basico' && <span className="text-xs text-blue-600 font-semibold mt-1">Plano atual</span>}
                        </div>

                        {/* Pro */}
                        <div className={`rounded-xl border-2 p-4 text-center flex flex-col gap-2 relative ${subscription?.plan === 'pro' ? 'border-purple-500 bg-purple-50' : 'border-purple-300 bg-purple-50/40'}`}>
                            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">POPULAR</span>
                            <Star size={22} className="mx-auto text-purple-500" />
                            <p className="font-bold text-sm text-slate-800">Pro</p>
                            <p className="text-2xl font-extrabold text-purple-600">20</p>
                            <p className="text-xs text-slate-500">veículos</p>
                            {subscription?.plan !== 'pro' && (
                                <a href={KIWIFY_PRO} target="_blank" rel="noopener noreferrer"
                                    className="mt-1 text-xs bg-purple-600 text-white rounded-lg py-1.5 font-semibold hover:bg-purple-700 transition-colors">
                                    Fazer Upgrade
                                </a>
                            )}
                            {subscription?.plan === 'pro' && <span className="text-xs text-purple-600 font-semibold mt-1">Plano atual</span>}
                        </div>

                        {/* Enterprise */}
                        <div className={`rounded-xl border-2 p-4 text-center flex flex-col gap-2 ${subscription?.plan === 'enterprise' ? 'border-slate-700 bg-slate-50' : 'border-slate-200'}`}>
                            <Building2 size={22} className="mx-auto text-slate-700" />
                            <p className="font-bold text-sm text-slate-800">Enterprise</p>
                            <p className="text-2xl font-extrabold text-slate-700">∞</p>
                            <p className="text-xs text-slate-500">ilimitado</p>
                            {subscription?.plan !== 'enterprise' && (
                                <a href={KIWIFY_ENTERPRISE} target="_blank" rel="noopener noreferrer"
                                    className="mt-1 text-xs bg-slate-800 text-white rounded-lg py-1.5 font-semibold hover:bg-slate-900 transition-colors">
                                    Fazer Upgrade
                                </a>
                            )}
                            {subscription?.plan === 'enterprise' && <span className="text-xs text-slate-700 font-semibold mt-1">Plano atual</span>}
                        </div>
                    </div>

                    <div className="px-6 pb-6 flex items-center gap-2 text-xs text-slate-500">
                        <Zap size={14} className="text-amber-500 shrink-0" />
                        Após o pagamento, seu acesso é liberado automaticamente em minutos.
                    </div>
                </div>
            </div>
        )}
        </>
    );
}

