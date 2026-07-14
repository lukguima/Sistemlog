import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { tripService, fleetService, settlementService } from '../../lib/services';
import { Plus, Search, FileDown, Table as TableIcon, MapPin, Edit2, Trash2 } from 'lucide-react';
import TripModal from '../../components/admin/TripModal';
import FixedRoutesModal from '../../components/admin/FixedRoutesModal';
import { exportToExcel, exportToPDF } from '../../lib/exports';

export default function Trips() {
    const { user, isSubscriptionBlocked } = useAuth();
    const [trips, setTrips] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState<any>({});
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isRoutesModalOpen, setIsRoutesModalOpen] = useState(false);
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 20;

    const companyId = (user as any)?.company_id;

    const fetchTrips = async () => {
        if (!companyId) return;
        try {
            setLoading(true);
            const data = await tripService.getTrips(companyId, startDate, endDate);
            setTrips(data || []);
        } catch (error: any) {
            console.error('Error fetching trips:', error);
            setTrips([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!companyId) return;

        const fetchData = async () => {
            setLoading(true);
            // Buscas independentes: uma falha não derruba as demais
            const [tripsRes, vehiclesRes, driversRes] = await Promise.allSettled([
                tripService.getTrips(companyId, startDate, endDate),
                fleetService.getVehicles(companyId),
                fleetService.getDrivers(companyId)
            ]);
            if (tripsRes.status === 'fulfilled') setTrips(tripsRes.value || []);
            else console.error('Error fetching trips:', tripsRes.reason);
            if (vehiclesRes.status === 'fulfilled') setVehicles(vehiclesRes.value || []);
            else console.error('Error fetching vehicles:', vehiclesRes.reason);
            if (driversRes.status === 'fulfilled') setDrivers(driversRes.value || []);
            else console.error('Error fetching drivers:', driversRes.reason);
            setLoading(false);
        };

        fetchData();
    }, [companyId, startDate, endDate]);

    // Recarrega veículos/motoristas sempre que o modal de viagem abre
    // (garante que um veículo recém-cadastrado na Frota apareça na hora)
    useEffect(() => {
        if (!isModalOpen || !companyId) return;
        Promise.allSettled([
            fleetService.getVehicles(companyId),
            fleetService.getDrivers(companyId),
        ]).then(([v, d]) => {
            if (v.status === 'fulfilled') setVehicles(v.value || []);
            if (d.status === 'fulfilled') setDrivers(d.value || []);
        });
    }, [isModalOpen, companyId]);

    const [simulatedTrip, setSimulatedTrip] = useState<any>(null);

    // Capture simulation intention as soon as component mounts
    useEffect(() => {
        const pendingSim = localStorage.getItem('pending_trip_simulation');
        if (pendingSim) {
            try {
                const data = JSON.parse(pendingSim);
                setSimulatedTrip(data);
                localStorage.removeItem('pending_trip_simulation');
            } catch (e) {
                console.error('Error parsing simulation storage:', e);
                localStorage.removeItem('pending_trip_simulation');
            }
        }
    }, []);

    // Apply simulation when companyId is ready
    useEffect(() => {
        if (simulatedTrip && companyId) {
            const dataToSet = {
                vehicle_id: '',
                driver_id: '',
                origin: simulatedTrip.origin || '', 
                destination: simulatedTrip.destination || '',
                cargo_description: 'Simulação de Frete',
                value: simulatedTrip.gross_value,
                fuel_expense: simulatedTrip.fuel_expense,
                tolls_value: simulatedTrip.toll_expense,
                insurance_value: simulatedTrip.other_expenses,
                weight: simulatedTrip.weight,
                start_km: '',
                end_km: '',
                status: 'pending'
            };

            setModalData(dataToSet);
            setEditingId(null);
            setIsModalOpen(true);
            setSimulatedTrip(null); // Clear intention after applying
        }
    }, [simulatedTrip, companyId]);

    const handleSave = async (data: any) => {
        if (!companyId) return;

        try {
            const { vehicle, driver, agregado, value, cte, date, ...rest } = data;

            const toNum = (v: any) => (v === '' || v === null || v === undefined) ? 0 : Number(v) || 0;
            const isAgregado = rest.driver_type === 'agregado';

            const weight = toNum(rest.weight);
            const tarifa = toNum(value);
            const dataToSave = {
                ...rest,
                gross_value: weight > 0 && tarifa > 0 ? weight * tarifa : tarifa,
                cte_number: cte || '',
                weight: toNum(rest.weight),
                tax_rate: toNum(rest.tax_rate),
                commission_rate: toNum(rest.commission_rate),
                estimated_cost: toNum(rest.estimated_cost),
                advance_value: toNum(rest.advance_value),
                tolls_value: toNum(rest.tolls_value),
                insurance_value: toNum(rest.insurance_value),
                start_km: toNum(rest.start_km),
                end_km: rest.end_km !== '' && rest.end_km != null ? Number(rest.end_km) : null,
                company_id: companyId,
                created_at: date ? `${date}T12:00:00.000Z` : new Date().toISOString(),
                // Campos de agregado
                driver_type: rest.driver_type || 'own',
                agregado_id: isAgregado && rest.agregado_id ? rest.agregado_id : null,
                agregado_value: isAgregado ? toNum(rest.agregado_value) : 0,
                // Para viagens de agregado, não vincula frota própria
                vehicle_id: isAgregado ? null : (rest.vehicle_id || null),
                driver_id:  isAgregado ? null : (rest.driver_id  || null),
                implement_id: isAgregado ? null : (rest.implement_id || null),
            };

            const idParaExcluir = data.id || editingId;

            if (editingId || data.id) {
                if (!isAgregado) {
                    const conflicts = await tripService.checkConflicts(dataToSave.driver_id, dataToSave.vehicle_id, idParaExcluir, dataToSave.implement_id);
                    const msgs: string[] = [];
                    if (conflicts.driverBusy && conflicts.driverTrip?.id !== idParaExcluir)
                        msgs.push(`Motorista já está em outra viagem ativa (${conflicts.driverTrip?.origin} → ${conflicts.driverTrip?.destination}).`);
                    if (conflicts.vehicleBusy && conflicts.vehicleTrip?.id !== idParaExcluir)
                        msgs.push(`Veículo já está em outra viagem ativa (motorista: ${conflicts.vehicleTrip?.driver?.name || '—'}).`);
                    if (conflicts.implementBusy && conflicts.implementTrip?.id !== idParaExcluir)
                        msgs.push(`Implemento já está em outra viagem ativa (cavalo: ${(conflicts.implementTrip as any)?.vehicle?.plate || '—'}).`);
                    if (msgs.length > 0 && !window.confirm(`Atenção:\n${msgs.join('\n')}\n\nDeseja salvar mesmo assim?`)) return;
                }
                await tripService.updateTrip(idParaExcluir, dataToSave);
                if (!isAgregado) await settlementService.recalculateSettlementForTrip(idParaExcluir);
            } else {
                if (!isAgregado) {
                    const conflicts = await tripService.checkConflicts(dataToSave.driver_id, dataToSave.vehicle_id, undefined, dataToSave.implement_id);
                    const msgs: string[] = [];
                    if (conflicts.driverBusy) msgs.push(`Motorista já está em outra viagem ativa (${conflicts.driverTrip?.origin} → ${conflicts.driverTrip?.destination}).`);
                    if (conflicts.vehicleBusy) msgs.push(`Veículo já está em outra viagem ativa (motorista: ${conflicts.vehicleTrip?.driver?.name || '—'}).`);
                    if (conflicts.implementBusy) msgs.push(`Implemento já está em outra viagem ativa (cavalo: ${(conflicts.implementTrip as any)?.vehicle?.plate || '—'}).`);
                    if (msgs.length > 0 && !window.confirm(`Atenção:\n${msgs.join('\n')}\n\nDeseja registrar mesmo assim?`)) return;
                }
                await tripService.addTrip({ ...dataToSave, status: 'pending' });

                // Engate persistente: viagem nova "leva" o acoplamento junto.
                // (Edição de viagem antiga NÃO mexe no engate atual do cavalo.)
                if (!isAgregado && dataToSave.vehicle_id) {
                    try {
                        await fleetService.coupleImplement(companyId, dataToSave.vehicle_id, dataToSave.implement_id || null);
                        const vFresh = await fleetService.getVehicles(companyId);
                        setVehicles(vFresh || []);
                    } catch (e) {
                        console.warn('Não foi possível atualizar o engate (rode PLANO5_ACOPLAR.sql):', e);
                    }
                }
            }
            fetchTrips();
            setIsModalOpen(false);
            setModalData({});
            setEditingId(null);
        } catch (error: any) {
            console.error('Error adding/updating trip:', error);
            const msg = error.message || "Erro ao salvar viagem. Verifique as colunas do banco de dados.";
            alert(`Erro: ${msg}`);
            throw error;
        }
    };

    const handleDeleteTrip = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir esta viagem?")) return;
        try {
            await tripService.deleteTrip(id);
            setTrips(trips.filter(t => t.id !== id));
        } catch (error) {
            console.error('Error deleting trip:', error);
            alert("Erro ao excluir viagem.");
        }
    };

    const handleEditTrip = (trip: any) => {
        setModalData({
            ...trip,
            vehicle_id: trip.vehicle_id,
            driver_id: trip.driver_id
        });
        setEditingId(trip.id);
        setIsModalOpen(true);
    };

    const implementPlate = (id: string) => vehicles.find(v => v.id === id)?.plate || '';

    const filteredTrips = trips.filter(t => {
        const matchesSearch = searchTerm === '' || (
            t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.vehicle?.plate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.driver?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.agregado?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.agregado?.vehicle_plate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.origin?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.destination?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.cte_number?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        const matchesStatus = filterStatus === '' || (t.status?.toLowerCase() === filterStatus);
        return matchesSearch && matchesStatus;
    });

    const totalPages = Math.max(1, Math.ceil(filteredTrips.length / PAGE_SIZE));
    const safePage = Math.min(currentPage, totalPages);
    const paginatedTrips = filteredTrips.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    const handleSetStartDate = (v: string) => { setStartDate(v); setCurrentPage(1); };
    const handleSetEndDate = (v: string) => {
        if (v < startDate) { alert('A data final não pode ser anterior à data inicial.'); return; }
        setEndDate(v); setCurrentPage(1);
    };

    const handleExportPDF = () => {
        const headers = [['Data', 'Caminhão', 'Implemento', 'Motorista', 'Origem', 'Destino', 'Peso', 'CT-e', 'Valor Bruto', 'Status']];
        const data = filteredTrips.map(t => [
            t.created_at ? (() => { const [y,m,d] = t.created_at.slice(0,10).split('-'); return `${d}/${m}/${y}`; })() : '-',
            t.driver_type === 'agregado' ? (t.agregado?.vehicle_plate || '-') : (t.vehicle?.plate || '-'),
            t.implement_id ? (implementPlate(t.implement_id) || '-') : '-',
            t.driver?.name || '-',
            t.origin,
            t.destination,
            `${t.weight} kg`,
            t.cte_number || '-',
            (t.gross_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            t.status
        ]);
        exportToPDF('Relatório de Viagens e Fretes', headers, data, 'viagens_logistica');
    };

    const handleExportExcel = () => {
        const data = filteredTrips.map(t => ({
            Data: t.created_at ? (() => { const [y,m,d] = t.created_at.slice(0,10).split('-'); return `${d}/${m}/${y}`; })() : '-',
            Veiculo: t.vehicle?.plate || '-',
            Motorista: t.driver?.name || '-',
            Origem: t.origin,
            Destino: t.destination,
            Peso: t.weight,
            CT_e: t.cte_number || '-',
            'Valor Bruto (R$)': (t.gross_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            Status: t.status
        }));
        exportToExcel(data, 'viagens_logistica');
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in transition-all">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">Histórico de Viagens</h1>
                    <p className="text-slate-500 dark:text-slate-400">Controle completo de fretes, origens e destinos.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => {
                            setEditingId(null);
                            setModalData({});
                            setIsModalOpen(true);
                        }}
                        disabled={isSubscriptionBlocked}
                        title={isSubscriptionBlocked ? 'Assine para criar novos registros' : undefined}
                        className="btn-primary flex items-center gap-2 py-2 px-4 shadow-lg shadow-primary/20 mr-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus size={20} /> Novo Frete
                    </button>
                    <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                        <TableIcon size={18} className="text-emerald-500" /> Excel
                    </button>
                    <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                        <FileDown size={18} className="text-rose-500" /> PDF
                    </button>
                    <button 
                        onClick={() => setIsRoutesModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors"
                        title="Gerenciar Trechos Fixos"
                    >
                        <MapPin size={18} /> Trechos Fixos
                    </button>
                </div>
            </div>

            <div className="card overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50 dark:bg-slate-800/30">
                    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                        <div className="relative w-full max-w-md">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar por placa, motorista, rota ou CT-e..."
                                className="input-field pl-10 py-2 text-sm"
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            />
                        </div>
                        <select
                            className="input-field py-2 text-sm"
                            value={filterStatus}
                            onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                        >
                            <option value="">Todos os status</option>
                            <option value="pending">Pendente</option>
                            <option value="in_transit">Em Trânsito</option>
                            <option value="completed">Concluído</option>
                            <option value="validated">Validado</option>
                            <option value="paid">Pago</option>
                        </select>
                    </div>
                    <div className="flex gap-2 items-center">
                        <input
                            type="date"
                            className="input-field py-1 px-2 text-xs w-32"
                            value={startDate}
                            onChange={(e) => handleSetStartDate(e.target.value)}
                        />
                        <span className="text-slate-400 text-xs text-center">até</span>
                        <input
                            type="date"
                            className="input-field py-1 px-2 text-xs w-32"
                            value={endDate}
                            onChange={(e) => handleSetEndDate(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 uppercase text-xs font-semibold text-slate-400">
                            <tr>
                                <th className="px-4 py-4">Data</th>
                                <th className="px-4 py-4">Caminhão</th>
                                <th className="px-4 py-4">Motorista</th>
                                <th className="px-4 py-4">Origem/Destino</th>
                                <th className="px-4 py-4">Peso</th>
                                <th className="px-4 py-4">CT-e</th>
                                <th className="px-4 py-4">Valor Bruto</th>
                                <th className="px-4 py-4">Imposto %</th>
                                <th className="px-4 py-4">Comissão %</th>
                                <th className="px-4 py-4">Custos (Est.)</th>
                                <th className="px-4 py-4">Status</th>
                                <th className="px-4 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={12} className="px-6 py-8 text-center text-slate-500">
                                        Carregando viagens...
                                    </td>
                                </tr>
                            ) : paginatedTrips.length > 0 ? (
                                paginatedTrips.map(trip => (
                                    <tr key={trip.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-4 py-4 text-xs font-medium text-slate-500">
                                            {trip.created_at ? (() => { const [y,m,d] = trip.created_at.slice(0,10).split('-'); return `${d}/${m}/${y}`; })() : '-'}
                                        </td>
                                        <td className="px-4 py-4 font-mono text-xs">
                                            {trip.driver_type === 'agregado'
                                                ? <span className="text-violet-500 font-bold">{trip.agregado?.vehicle_plate || '—'}</span>
                                                : (
                                                    <div>
                                                        <span>{trip.vehicle?.plate || '-'}</span>
                                                        {trip.implement_id && implementPlate(trip.implement_id) && (
                                                            <span className="block text-[10px] text-violet-500">+ {implementPlate(trip.implement_id)}</span>
                                                        )}
                                                    </div>
                                                )}
                                        </td>
                                        <td className="px-4 py-4 font-bold text-sm">
                                            {trip.driver_type === 'agregado'
                                                ? <span className="flex items-center gap-1">
                                                    <span className="px-1.5 py-0.5 text-[9px] font-black bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400 rounded uppercase tracking-wide">Agr</span>
                                                    {trip.agregado?.name || '—'}
                                                  </span>
                                                : trip.driver?.name || '-'}
                                        </td>
                                        <td className="px-4 py-4 text-xs">
                                            <div className="flex flex-col gap-1">
                                                <span className="flex items-center gap-1"><MapPin size={12} className="text-primary" /> {trip.origin}</span>
                                                <span className="flex items-center gap-1 text-slate-400"><MapPin size={12} /> {trip.destination}</span>
                                                {(trip.start_km || trip.end_km) && (
                                                    <span className="text-[10px] text-slate-500 font-medium bg-slate-100 dark:bg-slate-800 w-fit px-1.5 rounded">
                                                        Distância: {(Number(trip.end_km) || 0) - (Number(trip.start_km) || 0)} km
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-sm font-bold">{trip.weight} kg</td>
                                        <td className="px-4 py-4 font-mono text-xs">{trip.cte_number || '-'}</td>
                                        <td className="px-4 py-4 text-sm font-medium">{(Number(trip.gross_value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                        <td className="px-4 py-4 text-sm">{trip.tax_rate || 0}%</td>
                                        <td className="px-4 py-4 text-sm">{trip.commission_rate || 0}%</td>
                                        <td className="px-4 py-4 text-sm font-medium text-rose-500">{(Number(trip.estimated_cost) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                        <td className="px-4 py-4">
                                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                                                trip.status?.toLowerCase() === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
                                                trip.status?.toLowerCase() === 'completed' || trip.status?.toLowerCase() === 'validated' ? 'bg-teal-100 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400' :
                                                trip.status?.toLowerCase() === 'in_transit' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' :
                                                'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400'
                                            }`}>
                                                {trip.status?.toLowerCase() === 'pending' ? 'Pendente' :
                                                 trip.status?.toLowerCase() === 'in_transit' ? 'Em Trânsito' :
                                                 trip.status?.toLowerCase() === 'completed' ? 'Concluído' :
                                                 trip.status?.toLowerCase() === 'validated' ? 'Validado' :
                                                 trip.status?.toLowerCase() === 'paid' ? 'Pago' :
                                                 trip.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="flex justify-end gap-2 text-slate-400">
                                                <button onClick={() => handleEditTrip(trip)} className="p-1 hover:text-primary transition-colors"><Edit2 size={16} /></button>
                                                <button onClick={() => handleDeleteTrip(trip.id)} className="p-1 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={12} className="px-6 py-8 text-center text-slate-500">
                                        Nenhuma viagem encontrada.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginação */}
                {totalPages > 1 && (
                    <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/30">
                        <span className="text-xs text-slate-500">
                            {filteredTrips.length} viagens — página {safePage} de {totalPages}
                        </span>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={safePage === 1}
                                className="px-3 py-1 text-xs font-bold rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >‹ Anterior</button>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={safePage === totalPages}
                                className="px-3 py-1 text-xs font-bold rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >Próxima ›</button>
                        </div>
                    </div>
                )}
            </div>
            <TripModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                vehicles={vehicles}
                drivers={drivers}
                initialData={Object.keys(modalData).length > 0 ? modalData : null}
            />
            <FixedRoutesModal
                isOpen={isRoutesModalOpen}
                onClose={() => setIsRoutesModalOpen(false)}
            />
        </div>
    );
}
