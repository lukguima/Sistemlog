import { Wrench, Clock, CheckCircle2, AlertTriangle, Loader2, Edit2, Trash2, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { maintenanceService, fleetService, supplierService } from '../../lib/services';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import MaintenanceModal from '../../components/admin/MaintenanceModal';

export default function Maintenance() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<any[]>([]);
    const [stats, setStats] = useState({ critical: 0, upcoming: 0, completed: 0 });
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMaintenance, setEditingMaintenance] = useState<any>(null);
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPlate, setFilterPlate] = useState('');
    const [filterType, setFilterType] = useState('');

    const loadData = async () => {
        if (!user?.company_id) return;
        try {
            setLoading(true);
            const [maintData, vehiclesData, suppliersData] = await Promise.all([
                maintenanceService.getMaintenanceHistory(user.company_id, startDate, endDate),
                fleetService.getVehicles(user.company_id),
                supplierService.getSuppliers(user.company_id)
            ]);
            setHistory(maintData || []);
            setVehicles(vehiclesData || []);
            setSuppliers((suppliersData || []).filter((s: any) => ['Manutenção', 'Peças', 'Outros'].includes(s.category)));

            // Calcular estatísticas
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            const completedThisMonth = (maintData || []).filter(
                (m: any) => new Date(m.date) >= startOfMonth && new Date(m.date) <= now
            ).length;

            // Manutenções com data futura = agendadas/pendentes
            const upcomingCount = (maintData || []).filter(
                (m: any) => m.date && new Date(m.date) > now
            ).length;

            // Alertas = corretivas (problema real) ou mecânicas/elétricas
            const criticalCount = (maintData || []).filter(
                (m: any) => m.type === 'corrective' || m.type === 'mechanical' || m.type === 'electrical'
            ).length;

            setStats({
                critical: criticalCount,
                upcoming: upcomingCount,
                completed: completedThisMonth
            });
        } catch (error) {
            console.error('Erro ao carregar manutenções:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.company_id) {
            loadData();
        }
    }, [user, startDate, endDate]);

    const handleSave = async (data: any) => {
        if (!user?.company_id) return;
        try {
            if (editingMaintenance) {
                await maintenanceService.updateMaintenance(editingMaintenance.id, data);
            } else {
                await maintenanceService.addMaintenance({ ...data, company_id: user.company_id });
            }
            loadData();
            setIsModalOpen(false);
            setEditingMaintenance(null);
        } catch (error: any) {
            console.error('Erro ao salvar manutenção:', error);
            alert(`Erro ao salvar manutenção: ${error.message || 'Erro desconhecido'}`);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este registro?')) return;
        try {
            await maintenanceService.deleteMaintenance(id);
            setHistory(history.filter(m => m.id !== id));
        } catch (error) {
            console.error('Erro ao excluir manutenção:', error);
            alert('Erro ao excluir manutenção.');
        }
    };

    const openEditModal = (maintenance: any) => {
        setEditingMaintenance(maintenance);
        setIsModalOpen(true);
    };

    if (loading && history.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-primary-500" size={40} />
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-12 font-display">
            <div>
                <h1 className="text-3xl font-black text-slate-900">Gestão de Manutenções</h1>
                <p className="text-slate-500 mt-1 uppercase text-xs font-bold tracking-widest">Controle preventivo e corretivo da frota</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-rose-50 rounded-2xl text-rose-600">
                            <AlertTriangle size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase">Alertas</p>
                            <h3 className="text-2xl font-black text-slate-900">{stats.critical.toString().padStart(2, '0')}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-amber-50 rounded-2xl text-amber-600">
                            <Clock size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase">Agendadas</p>
                            <h3 className="text-2xl font-black text-slate-900">{stats.upcoming.toString().padStart(2, '0')}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
                            <CheckCircle2 size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase">Concluídas (Mês)</p>
                            <h3 className="text-2xl font-black text-slate-900">{stats.completed.toString().padStart(2, '0')}</h3>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-xl">
                <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-white">
                    <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                        <Wrench className="text-primary-500" size={24} />
                        Histórico de Manutenção
                    </h3>
                    <div className="flex flex-col md:flex-row gap-3 items-center flex-wrap">
                        <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar descrição, oficina, observações..."
                                className="bg-slate-50 border border-slate-200 text-slate-900 rounded-lg pl-7 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/50 w-56"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Placa..."
                                className="bg-slate-50 border border-slate-200 text-slate-900 rounded-lg pl-7 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/50 w-28"
                                value={filterPlate}
                                onChange={(e) => setFilterPlate(e.target.value)}
                            />
                        </div>
                        <select
                            className="bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                        >
                            <option value="">Todos os tipos</option>
                            <option value="preventive">Preventiva</option>
                            <option value="corrective">Corretiva</option>
                            <option value="oil">Óleo</option>
                            <option value="tyres">Pneus</option>
                            <option value="mechanical">Mecânica</option>
                            <option value="electrical">Elétrica</option>
                        </select>
                        <div className="flex gap-2 items-center">
                            <input
                                type="date"
                                className="bg-white border border-slate-200 text-slate-900 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-tighter">até</span>
                            <input
                                type="date"
                                className="bg-white border border-slate-200 text-slate-900 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={() => {
                                setEditingMaintenance(null);
                                setIsModalOpen(true);
                            }}
                            className="bg-primary-500 text-black px-6 py-2 rounded-xl font-black text-[10px] uppercase hover:bg-primary-600 transition-colors whitespace-nowrap"
                        >
                            Nova Manutenção
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-white">
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Veículo</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">KM</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Custo</th>
                                <th className="px-8 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {(() => {
                                const filtered = history.filter(m => {
                                    const matchesPlate = (m.vehicle?.plate || '').toLowerCase().includes(filterPlate.toLowerCase());
                                    const matchesType = filterType === '' || m.type === filterType;
                                    const matchesSearch = searchTerm === '' || (
                                        (m.vehicle?.plate || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        (m.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        (m.workshop || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        (m.notes || '').toLowerCase().includes(searchTerm.toLowerCase())
                                    );
                                    return matchesPlate && matchesType && matchesSearch;
                                });
                                if (filtered.length === 0) return (
                                    <tr>
                                        <td colSpan={6} className="px-8 py-12 text-center text-slate-500 font-bold uppercase text-xs tracking-widest">
                                            Nenhuma manutenção encontrada
                                        </td>
                                    </tr>
                                );
                                return filtered.map((m) => (
                                    <tr key={m.id} className="hover:bg-slate-50/10 transition-colors group">
                                        <td className="px-8 py-6 font-black text-slate-900">{m.vehicle?.plate || 'N/A'}</td>
                                        <td className="px-8 py-6 font-bold text-slate-700">{Number(m.km).toLocaleString('pt-BR')} km</td>
                                        <td className="px-8 py-6 text-slate-500 text-sm">
                                            {format(new Date(m.date), "dd/MM/yyyy", { locale: ptBR })}
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase bg-primary-500/10 text-primary-500`}>
                                                {m.type === 'preventive' ? 'Preventiva' :
                                                    m.type === 'corrective' ? 'Corretiva' :
                                                        m.type === 'oil' ? 'Óleo' :
                                                            m.type === 'tyres' ? 'Pneus' :
                                                                m.type === 'mechanical' ? 'Mecânica' :
                                                                    m.type === 'electrical' ? 'Elétrica' : m.type}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 font-bold text-emerald-500">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(m.cost)}
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => openEditModal(m)}
                                                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-colors"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(m.id)}
                                                    className="p-2 hover:bg-rose-500/10 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ));
                            })()}
                        </tbody>
                    </table>
                </div>
            </div>

            <MaintenanceModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                vehicles={vehicles}
                suppliers={suppliers}
                initialData={editingMaintenance}
                companyId={user?.company_id}
            />
        </div>
    );
}

