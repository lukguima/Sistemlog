import { Fuel as FuelIcon, Clock, CheckCircle2, Loader2, Edit2, Trash2, Plus, Droplets } from 'lucide-react';
import { useState, useEffect } from 'react';
import { driverService, fleetService, supplierService } from '../../lib/services';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import FuelModal from '../../components/admin/FuelModal.tsx';

export default function Fuel() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState<any[]>([]);
    const [stats, setStats] = useState({ totalLiters: 0, totalValue: 0, count: 0, totalArlaLiters: 0, totalArlaValue: 0 });
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [kmPerLiterMap, setKmPerLiterMap] = useState<Record<string, number | null>>({});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const loadData = async () => {
        if (!user?.company_id) return;
        try {
            setLoading(true);
            const [fuelData, vehiclesData, driversData, suppliersData] = await Promise.all([
                driverService.getFuelRecords(user.company_id, startDate, endDate),
                fleetService.getVehicles(user.company_id),
                fleetService.getDrivers(user.company_id),
                supplierService.getSuppliers(user.company_id)
            ]);
            // Calcula KM/L por registro: ordena por veículo + odômetro, pega delta entre consecutivos
            const sorted = [...(fuelData || [])].sort((a: any, b: any) =>
                a.vehicle_id === b.vehicle_id
                    ? (Number(a.odometer) || 0) - (Number(b.odometer) || 0)
                    : 0
            );
            const kmPerLiterMap: Record<string, number | null> = {};
            for (let i = 0; i < sorted.length; i++) {
                const r = sorted[i];
                const prev = i > 0 && sorted[i - 1].vehicle_id === r.vehicle_id ? sorted[i - 1] : null;
                const kmDelta = prev && Number(r.odometer) > Number(prev.odometer)
                    ? Number(r.odometer) - Number(prev.odometer) : null;
                const liters = Number(r.liters) || 0;
                kmPerLiterMap[r.id] = kmDelta !== null && liters > 0 ? kmDelta / liters : null;
            }
            setKmPerLiterMap(kmPerLiterMap);
            setRecords(fuelData || []);
            setVehicles(vehiclesData || []);
            setDrivers(driversData || []);
            setSuppliers((suppliersData || []).filter((s: any) => s.category === 'Combustível'));

            const totalLiters = (fuelData || []).reduce((acc: number, r: any) => acc + (Number(r.liters) || 0), 0);
            const totalValue = (fuelData || []).reduce((acc: number, r: any) => acc + (Number(r.total_value) || 0), 0);
            const totalArlaLiters = (fuelData || []).reduce((acc: number, r: any) => acc + (Number(r.arla_liters) || 0), 0);
            const totalArlaValue = (fuelData || []).reduce((acc: number, r: any) => acc + (Number(r.arla_value) || 0), 0);

            setStats({ totalLiters, totalValue, count: (fuelData || []).length, totalArlaLiters, totalArlaValue });
        } catch (error) {
            console.error('Erro ao carregar abastecimentos:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.company_id) loadData();
    }, [user, startDate, endDate]);

    const handleSave = async (data: any) => {
        if (!user?.company_id) return;
        try {
            const { date, km_reading, arla_price_per_liter: _arlaPpl, ...rest } = data;
            const toUuid = (v: any) => (v === '' || v == null) ? null : v;
            const toNum  = (v: any) => (v === '' || v == null) ? null : Number(v) || null;
            const payload = {
                ...rest,
                vehicle_id:      toUuid(rest.vehicle_id),
                driver_id:       toUuid(rest.driver_id),
                supplier_id:     toUuid(rest.supplier_id),
                odometer:        km_reading ? Number(km_reading) : null,
                liters:          toNum(rest.liters),
                price_per_liter: toNum(rest.price_per_liter),
                total_value:     toNum(rest.total_value),
                arla_liters:     toNum(rest.arla_liters),
                arla_value:      toNum(rest.arla_value),
                created_at:      date ? new Date(date).toISOString() : new Date().toISOString()
            };

            if (editingRecord) {
                await driverService.updateFuelRecord(editingRecord.id, payload);
            } else {
                await driverService.addFuelRecord({ ...payload, company_id: user.company_id });
            }
            loadData();
            setIsModalOpen(false);
            setEditingRecord(null);
        } catch (error: any) {
            console.error('Erro ao salvar abastecimento:', error);
            alert(`Erro ao salvar abastecimento: ${error.message || 'Erro desconhecido'}`);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este registro de abastecimento?')) return;
        try {
            await driverService.deleteFuelRecord(id);
            setRecords(records.filter(r => r.id !== id));
        } catch (error) {
            console.error('Erro ao excluir abastecimento:', error);
            alert('Erro ao excluir abastecimento.');
        }
    };

    if (loading && records.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-primary-500" size={40} />
            </div>
        );
    }

    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    return (
        <div className="space-y-8 pb-12 font-display">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-slate-900">Gestão de Abastecimentos</h1>
                    <p className="text-slate-500 mt-1 uppercase text-xs font-bold tracking-widest">Controle de consumo e gastos com combustível</p>
                </div>
                <button
                    onClick={() => { setEditingRecord(null); setIsModalOpen(true); }}
                    className="bg-primary-500 text-black px-6 py-3 rounded-2xl font-black text-xs uppercase hover:bg-primary-600 transition-all flex items-center gap-2 shadow-lg shadow-primary-500/20"
                >
                    <Plus size={18} /> Novo Registro
                </button>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm min-w-0">
                    <div className="flex justify-between items-start mb-3">
                        <div className="p-2.5 bg-primary-50 rounded-2xl text-primary-600"><FuelIcon size={18} /></div>
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Litros Diesel</p>
                    <h3 className="text-xl font-black text-slate-900 truncate">{stats.totalLiters.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L</h3>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm min-w-0">
                    <div className="flex justify-between items-start mb-3">
                        <div className="p-2.5 bg-emerald-50 rounded-2xl text-emerald-600"><CheckCircle2 size={18} /></div>
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Custo Diesel</p>
                    <h3 className="text-xl font-black text-slate-900 truncate">{fmt(stats.totalValue)}</h3>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-teal-200 shadow-sm min-w-0">
                    <div className="flex justify-between items-start mb-3">
                        <div className="p-2.5 bg-teal-50 rounded-2xl text-teal-600"><Droplets size={18} /></div>
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Litros ARLA</p>
                    <h3 className="text-xl font-black text-slate-900 truncate">{stats.totalArlaLiters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L</h3>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-teal-200 shadow-sm min-w-0">
                    <div className="flex justify-between items-start mb-3">
                        <div className="p-2.5 bg-teal-50 rounded-2xl text-teal-600"><Droplets size={18} /></div>
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Custo ARLA</p>
                    <h3 className="text-xl font-black text-slate-900 truncate">{fmt(stats.totalArlaValue)}</h3>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm min-w-0">
                    <div className="flex justify-between items-start mb-3">
                        <div className="p-2.5 bg-amber-50 rounded-2xl text-amber-600"><Clock size={18} /></div>
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Registros</p>
                    <h3 className="text-xl font-black text-slate-900">{stats.count.toString().padStart(2, '0')}</h3>
                </div>
            </div>

            {/* Custo total combustível */}
            {(stats.totalValue + stats.totalArlaValue) > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-600">Custo Total Combustível (Diesel + ARLA)</span>
                    <span className="text-xl font-black text-slate-900">{fmt(stats.totalValue + stats.totalArlaValue)}</span>
                </div>
            )}

            <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-xl">
                <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-white">
                    <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                        <FuelIcon className="text-primary-500" size={24} />
                        Histórico de Abastecimento
                    </h3>
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
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-white">
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Veículo</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Motorista</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Diesel (L)</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Diesel</th>
                                <th className="px-6 py-4 text-[10px] font-black text-teal-400 uppercase tracking-widest">ARLA (L)</th>
                                <th className="px-6 py-4 text-[10px] font-black text-teal-400 uppercase tracking-widest">Valor ARLA</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Total Diesel+ARLA</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {records.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-8 py-12 text-center text-slate-500 font-bold uppercase text-xs tracking-widest">
                                        Nenhum abastecimento registrado
                                    </td>
                                </tr>
                            ) : (
                                records.map((r) => (
                                    <tr key={r.id} className="hover:bg-slate-50/10 transition-colors group">
                                        <td className="px-6 py-5 text-slate-500 text-sm">
                                            {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                        </td>
                                        <td className="px-6 py-5 font-black text-slate-900">
                                            <div className="flex flex-col gap-1">
                                                <span className="bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 uppercase font-mono text-sm w-fit">
                                                    {r.vehicle?.plate || '---'}
                                                </span>
                                                {kmPerLiterMap[r.id] !== null && kmPerLiterMap[r.id] !== undefined ? (
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md w-fit ${kmPerLiterMap[r.id]! >= 2.5 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                                                        {kmPerLiterMap[r.id]!.toFixed(2)} km/L
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-slate-300 ml-1">— km/L</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 font-bold text-slate-700 text-sm">{r.driver?.name || '---'}</td>
                                        <td className="px-6 py-5 font-bold text-slate-900 text-sm">{Number(r.liters).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L</td>
                                        <td className="px-6 py-5 font-bold text-primary-600 text-sm">{fmt(Number(r.total_value) || 0)}</td>
                                        <td className="px-6 py-5 text-sm">
                                            {r.arla_liters ? (
                                                <span className="font-bold text-teal-700">{Number(r.arla_liters).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L</span>
                                            ) : (
                                                <span className="text-slate-300">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 text-sm">
                                            {r.arla_value ? (
                                                <span className="font-bold text-teal-600">{fmt(Number(r.arla_value))}</span>
                                            ) : (
                                                <span className="text-slate-300">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 text-sm">
                                            <span className="font-black text-slate-900">{fmt((Number(r.total_value) || 0) + (Number(r.arla_value) || 0))}</span>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => { setEditingRecord(r); setIsModalOpen(true); }}
                                                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-colors"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(r.id)}
                                                    className="p-2 hover:bg-rose-500/10 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <FuelModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingRecord(null); }}
                onSave={handleSave}
                vehicles={vehicles}
                drivers={drivers}
                suppliers={suppliers}
                initialData={editingRecord}
            />
        </div>
    );
}
