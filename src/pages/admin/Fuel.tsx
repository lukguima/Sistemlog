import { Fuel as FuelIcon, Clock, CheckCircle2, Loader2, Edit2, Trash2, Plus, Droplets, Search, FileDown } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { driverService, fleetService, supplierService, isFuelDupOdometerError, isDieselFuel, fuelTypeLabel, normalizeFuelType } from '../../lib/services';
import { useAuth } from '../../context/AuthContext';
import { exportToExcel, exportToPDF } from '../../lib/exports';

import FuelModal from '../../components/admin/FuelModal.tsx';

const fmtDateBr = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
};

export default function Fuel() {
    const { user, isSubscriptionBlocked } = useAuth();
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState<any[]>([]);
    const [stats, setStats] = useState({ totalLiters: 0, totalValue: 0, count: 0, totalArlaLiters: 0, totalArlaValue: 0, gasLiters: 0, gasValue: 0, ethanolLiters: 0, ethanolValue: 0 });
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [kmPerLiterMap, setKmPerLiterMap] = useState<Record<string, number | null>>({});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterPlate, setFilterPlate] = useState('');
    const [filterDriver, setFilterDriver] = useState('');
    const [highlightId, setHighlightId] = useState<string | null>(null);

    const openExistingFuel = async (existingId: string, createdAt?: string) => {
        try {
            const full = await driverService.getFuelRecordById(existingId);
            const day = (createdAt || full.created_at || '').slice(0, 10);
            if (day) {
                if (day < startDate) setStartDate(day);
                if (day > endDate) setEndDate(day);
            }
            setFilterPlate('');
            setFilterDriver('');
            setHighlightId(existingId);
            setEditingRecord(full);
            setIsModalOpen(true);
        } catch (e) {
            console.error('Erro ao abrir abastecimento existente:', e);
            alert('Não foi possível abrir o lançamento existente.');
        }
    };

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

            const period = fuelData || [];
            const vehicleIds = [...new Set(period.map((r: any) => r.vehicle_id).filter(Boolean))] as string[];
            const odometers = await driverService.getFuelOdometersForVehicles(user.company_id, vehicleIds);

            const sorted = [...odometers].sort((a: any, b: any) => {
                if (a.vehicle_id !== b.vehicle_id) return String(a.vehicle_id).localeCompare(String(b.vehicle_id));
                return (Number(a.odometer) || 0) - (Number(b.odometer) || 0);
            });
            const dieselSorted = sorted.filter((r: any) => isDieselFuel(r.fuel_type) && Number(r.liters) > 0);
            const prevById: Record<string, number | null> = {};
            for (let i = 0; i < dieselSorted.length; i++) {
                const r = dieselSorted[i];
                const prev = i > 0 && dieselSorted[i - 1].vehicle_id === r.vehicle_id ? dieselSorted[i - 1] : null;
                prevById[r.id] = prev ? Number(prev.odometer) : null;
            }
            const kmMap: Record<string, number | null> = {};
            for (const r of period) {
                const prevOdo = prevById[r.id];
                const liters = Number(r.liters) || 0;
                const cur = Number(r.odometer) || 0;
                kmMap[r.id] = prevOdo != null && cur > prevOdo && liters > 0
                    ? (cur - prevOdo) / liters
                    : null;
            }
            setKmPerLiterMap(kmMap);
            setRecords(period);
            setVehicles((vehiclesData || []).filter((v: any) => v.category !== 'implemento'));
            setDrivers(driversData || []);
            setSuppliers((suppliersData || []).filter((s: any) => s.category === 'Combustível'));

            const dieselRows = period.filter((r: any) => isDieselFuel(r.fuel_type));
            const totalLiters = dieselRows.reduce((acc: number, r: any) => acc + (Number(r.liters) || 0), 0);
            const totalValue = dieselRows.reduce((acc: number, r: any) => acc + (Number(r.total_value) || 0), 0);
            const totalArlaLiters = dieselRows.reduce((acc: number, r: any) => acc + (Number(r.arla_liters) || 0), 0);
            const totalArlaValue = dieselRows.reduce((acc: number, r: any) => acc + (Number(r.arla_value) || 0), 0);
            const sumKind = (kind: 'gasolina' | 'etanol') => period.filter((r: any) => normalizeFuelType(r.fuel_type) === kind);
            const gas = sumKind('gasolina');
            const ethanol = sumKind('etanol');

            setStats({
                totalLiters,
                totalValue,
                count: period.length,
                totalArlaLiters,
                totalArlaValue,
                gasLiters: gas.reduce((acc: number, r: any) => acc + (Number(r.liters) || 0), 0),
                gasValue: gas.reduce((acc: number, r: any) => acc + (Number(r.total_value) || 0), 0),
                ethanolLiters: ethanol.reduce((acc: number, r: any) => acc + (Number(r.liters) || 0), 0),
                ethanolValue: ethanol.reduce((acc: number, r: any) => acc + (Number(r.total_value) || 0), 0),
            });
        } catch (error) {
            console.error('Erro ao carregar abastecimentos:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.company_id) loadData();
    }, [user, startDate, endDate]);

    const filteredRecords = useMemo(() => {
        const plateQ = filterPlate.toLowerCase();
        const driverQ = filterDriver.toLowerCase();
        return records.filter(r => {
            const plate = (r.vehicle?.plate || '').toLowerCase();
            const driver = (r.driver?.name || '').toLowerCase();
            return plate.includes(plateQ) && driver.includes(driverQ);
        });
    }, [records, filterPlate, filterDriver]);

    const dieselBySupplier = useMemo(() => {
        const map = new Map<string, { key: string; name: string; liters: number; value: number; count: number }>();
        for (const r of records) {
            if (!isDieselFuel(r.fuel_type)) continue;
            const id = r.supplier_id || '';
            const key = id || '__none__';
            const name = !id
                ? 'Sem fornecedor'
                : (suppliers.find(s => s.id === id)?.name || 'Fornecedor removido');
            const cur = map.get(key) || { key, name, liters: 0, value: 0, count: 0 };
            cur.liters += Number(r.liters) || 0;
            cur.value += Number(r.total_value) || 0;
            cur.count += 1;
            map.set(key, cur);
        }
        return [...map.values()].sort((a, b) => b.liters - a.liters);
    }, [records, suppliers]);

    const handleExportSupplier = (format: 'pdf' | 'excel') => {
        if (dieselBySupplier.length === 0) {
            alert('Nenhum abastecimento no período.');
            return;
        }
        const fmtMoney = (v: number) =>
            new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
        const fileName = `diesel_por_fornecedor_${startDate}_${endDate}`;
        if (format === 'excel') {
            exportToExcel(dieselBySupplier.map(row => ({
                Fornecedor: row.name,
                'Litros diesel': row.liters,
                'Valor diesel': row.value,
                Lançamentos: row.count,
            })), fileName);
            return;
        }
        const headers = [['Fornecedor', 'Litros diesel', 'Valor diesel', 'Lançamentos']];
        let totL = 0, totV = 0, totC = 0;
        const rows = dieselBySupplier.map(row => {
            totL += row.liters;
            totV += row.value;
            totC += row.count;
            return [
                row.name,
                row.liters.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
                fmtMoney(row.value),
                String(row.count),
            ];
        });
        rows.push(['TOTAL', totL.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), fmtMoney(totV), String(totC)]);
        exportToPDF(`Diesel por fornecedor — ${fmtDateBr(startDate)} a ${fmtDateBr(endDate)}`, headers, rows, fileName);
    };

    const handleExportHistory = (format: 'pdf' | 'excel') => {
        if (filteredRecords.length === 0) {
            alert('Nenhum abastecimento no filtro.');
            return;
        }
        const fmtMoney = (v: number) =>
            new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
        const fileName = `abastecimentos_${startDate}_${endDate}`;
        let totLiters = 0, totFuelV = 0, totArlaL = 0, totArlaV = 0, totAll = 0;

        const mapped = filteredRecords.map((r: any) => {
            const kind = normalizeFuelType(r.fuel_type);
            const liters = Number(r.liters) || 0;
            const fuelV = Number(r.total_value) || 0;
            const arlaL = kind === 'diesel' ? (Number(r.arla_liters) || 0) : 0;
            const arlaV = kind === 'diesel' ? (Number(r.arla_value) || 0) : 0;
            const total = fuelV + arlaV;
            totLiters += liters;
            totFuelV += fuelV;
            totArlaL += arlaL;
            totArlaV += arlaV;
            totAll += total;
            return {
                date: fmtDateBr(r.created_at),
                plate: r.vehicle?.plate || '---',
                odometer: r.odometer != null ? Number(r.odometer) : null,
                driver: r.driver?.name || '---',
                type: fuelTypeLabel(r.fuel_type),
                liters,
                fuelV,
                arlaL,
                arlaV,
                total,
            };
        });

        if (format === 'excel') {
            exportToExcel([
                ...mapped.map(r => ({
                    Data: r.date,
                    Veículo: r.plate,
                    Hodômetro: r.odometer ?? '—',
                    Motorista: r.driver,
                    Tipo: r.type,
                    Litros: r.liters,
                    Valor: r.fuelV,
                    'ARLA (L)': r.arlaL || '—',
                    'Valor ARLA': r.arlaV || '—',
                    Total: r.total,
                })),
                {
                    Data: 'TOTAL',
                    Veículo: '',
                    Hodômetro: '',
                    Motorista: '',
                    Tipo: '',
                    Litros: totLiters,
                    Valor: totFuelV,
                    'ARLA (L)': totArlaL,
                    'Valor ARLA': totArlaV,
                    Total: totAll,
                },
            ], fileName);
            return;
        }

        const headers = [['Data', 'Veículo', 'Hodômetro', 'Motorista', 'Tipo', 'Litros', 'Valor', 'ARLA (L)', 'Valor ARLA', 'Total']];
        const rows = mapped.map(r => [
            r.date,
            r.plate,
            r.odometer != null ? r.odometer.toLocaleString('pt-BR') : '—',
            r.driver,
            r.type,
            r.liters.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
            fmtMoney(r.fuelV),
            r.arlaL ? r.arlaL.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—',
            r.arlaV ? fmtMoney(r.arlaV) : '—',
            fmtMoney(r.total),
        ]);
        rows.push([
            'TOTAL',
            '',
            '',
            '',
            '',
            totLiters.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
            fmtMoney(totFuelV),
            totArlaL.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
            fmtMoney(totArlaV),
            fmtMoney(totAll),
        ]);
        const title = `Abastecimentos — ${fmtDateBr(startDate)} a ${fmtDateBr(endDate)}`;
        exportToPDF(title, headers, rows, fileName);
    };

    const handleSave = async (data: any) => {
        if (!user?.company_id) return;
        try {
            const { date, km_reading, arla_price_per_liter: _arlaPpl, ...rest } = data;
            const toUuid = (v: any) => (v === '' || v == null) ? null : v;
            const toNum = (v: any) => {
                if (v === '' || v == null) return null;
                const n = Number(v);
                return Number.isFinite(n) ? n : null;
            };
            const payload = {
                ...rest,
                vehicle_id:      toUuid(rest.vehicle_id),
                driver_id:       toUuid(rest.driver_id),
                supplier_id:     toUuid(rest.supplier_id),
                odometer:        km_reading ? Number(km_reading) : null,
                liters:          toNum(rest.liters) ?? 0,
                price_per_liter: toNum(rest.price_per_liter) ?? 0,
                total_value:     toNum(rest.total_value) ?? 0,
                arla_liters:     toNum(rest.arla_liters),
                arla_value:      toNum(rest.arla_value),
                created_at:      date ? `${date}T12:00:00.000Z` : new Date().toISOString()
            };

            if (editingRecord) {
                await driverService.updateFuelRecord(editingRecord.id, payload);
            } else {
                await driverService.addFuelRecord({ ...payload, company_id: user.company_id });
            }
            loadData();
            setIsModalOpen(false);
            setEditingRecord(null);
            setHighlightId(null);
        } catch (error: any) {
            console.error('Erro ao salvar abastecimento:', error);
            if (isFuelDupOdometerError(error)) {
                const open = confirm(
                    `${error.message}\n\nDeseja abrir o lançamento existente para revisar/editar?`
                );
                if (open) {
                    await openExistingFuel(error.existing.id, error.existing.created_at);
                }
                return;
            }
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
            <div className="flex justify-between items-end gap-3 flex-wrap">
                <div>
                    <h1 className="text-3xl font-black text-slate-900">Gestão de Abastecimentos</h1>
                    <p className="text-slate-500 mt-1 uppercase text-xs font-bold tracking-widest">Controle de consumo e gastos com combustível</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => handleExportHistory('pdf')}
                        className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-black uppercase hover:bg-slate-50 transition-colors"
                    >
                        <FileDown size={18} className="text-rose-500" /> PDF
                    </button>
                    <button
                        onClick={() => handleExportHistory('excel')}
                        className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-black uppercase hover:bg-slate-50 transition-colors"
                    >
                        <FileDown size={18} className="text-emerald-600" /> Excel
                    </button>
                    <button
                        onClick={() => { setEditingRecord(null); setIsModalOpen(true); }}
                        disabled={isSubscriptionBlocked}
                        title={isSubscriptionBlocked ? 'Assine para criar novos registros' : undefined}
                        className="bg-primary-500 text-black px-6 py-3 rounded-2xl font-black text-xs uppercase hover:bg-primary-600 transition-all flex items-center gap-2 shadow-lg shadow-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus size={18} /> Novo Registro
                    </button>
                </div>
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
                    <h3 className="text-base font-black text-slate-900 truncate">{fmt(stats.totalValue)}</h3>
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
                    <h3 className="text-base font-black text-slate-900 truncate">{fmt(stats.totalArlaValue)}</h3>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-amber-200 shadow-sm min-w-0">
                    <div className="flex justify-between items-start mb-3">
                        <div className="p-2.5 bg-amber-50 rounded-2xl text-amber-600"><FuelIcon size={18} /></div>
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Gasolina</p>
                    <h3 className="text-xl font-black text-slate-900 truncate">{stats.gasLiters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L</h3>
                    <p className="text-xs font-bold text-slate-500 mt-1">{fmt(stats.gasValue)}</p>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-lime-200 shadow-sm min-w-0">
                    <div className="flex justify-between items-start mb-3">
                        <div className="p-2.5 bg-lime-50 rounded-2xl text-lime-700"><FuelIcon size={18} /></div>
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Etanol</p>
                    <h3 className="text-xl font-black text-slate-900 truncate">{stats.ethanolLiters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L</h3>
                    <p className="text-xs font-bold text-slate-500 mt-1">{fmt(stats.ethanolValue)}</p>
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
            {(stats.totalValue + stats.totalArlaValue + stats.gasValue + stats.ethanolValue) > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-600">Custo Total Combustível</span>
                    <span className="text-xl font-black text-slate-900">{fmt(stats.totalValue + stats.totalArlaValue + stats.gasValue + stats.ethanolValue)}</span>
                </div>
            )}

            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h3 className="text-lg font-black text-slate-900">Diesel por fornecedor</h3>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                            {fmtDateBr(startDate)} a {fmtDateBr(endDate)}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => handleExportSupplier('pdf')}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-black uppercase hover:bg-slate-50"
                        >
                            <FileDown size={16} className="text-rose-500" /> PDF
                        </button>
                        <button
                            type="button"
                            onClick={() => handleExportSupplier('excel')}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-black uppercase hover:bg-slate-50"
                        >
                            <FileDown size={16} className="text-emerald-600" /> Excel
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <th className="px-6 py-3">Fornecedor</th>
                                <th className="px-6 py-3">Litros diesel</th>
                                <th className="px-6 py-3">Valor diesel</th>
                                <th className="px-6 py-3">Lançamentos</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dieselBySupplier.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">
                                        Nenhum abastecimento no período
                                    </td>
                                </tr>
                            ) : dieselBySupplier.map(row => (
                                <tr key={row.key} className="border-t border-slate-100">
                                    <td className="px-6 py-4 font-bold text-slate-900">{row.name}</td>
                                    <td className="px-6 py-4 font-bold text-slate-700">{row.liters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L</td>
                                    <td className="px-6 py-4 font-bold text-slate-700">{fmt(row.value)}</td>
                                    <td className="px-6 py-4 font-bold text-slate-700">{row.count}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-xl">
                <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-white">
                    <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                        <FuelIcon className="text-primary-500" size={24} />
                        Histórico de Abastecimento
                    </h3>
                    <div className="flex flex-wrap gap-2 items-center">
                        <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Placa..."
                                className="bg-slate-50 border border-slate-200 text-slate-900 rounded-lg pl-7 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/50 w-28"
                                value={filterPlate}
                                onChange={e => setFilterPlate(e.target.value)}
                            />
                        </div>
                        <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Motorista..."
                                className="bg-slate-50 border border-slate-200 text-slate-900 rounded-lg pl-7 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/50 w-36"
                                value={filterDriver}
                                onChange={e => setFilterDriver(e.target.value)}
                            />
                        </div>
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
                        <button
                            type="button"
                            onClick={() => handleExportHistory('pdf')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase hover:bg-slate-50 transition-colors"
                        >
                            <FileDown size={14} className="text-rose-500" /> PDF
                        </button>
                        <button
                            type="button"
                            onClick={() => handleExportHistory('excel')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase hover:bg-slate-50 transition-colors"
                        >
                            <FileDown size={14} className="text-emerald-600" /> Excel
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-white">
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Veículo</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Hodômetro</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Motorista</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Litros</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor</th>
                                <th className="px-6 py-4 text-[10px] font-black text-teal-400 uppercase tracking-widest">ARLA (L)</th>
                                <th className="px-6 py-4 text-[10px] font-black text-teal-400 uppercase tracking-widest">Valor ARLA</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Total</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="px-8 py-12 text-center text-slate-500 font-bold uppercase text-xs tracking-widest">
                                        Nenhum abastecimento encontrado
                                    </td>
                                </tr>
                            ) : filteredRecords.map((r: any) => (
                                <tr
                                    key={r.id}
                                    className={`hover:bg-slate-50/10 transition-colors group ${highlightId === r.id ? 'bg-amber-50 ring-1 ring-inset ring-amber-200' : ''}`}
                                >
                                    <td className="px-6 py-5 text-slate-500 text-sm">
                                        {fmtDateBr(r.created_at)}
                                    </td>
                                    <td className="px-6 py-5 font-black text-slate-900">
                                        <div className="flex flex-col gap-1">
                                            <span className="bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 uppercase font-mono text-sm w-fit">
                                                {r.vehicle?.plate || '---'}
                                            </span>
                                            {isDieselFuel(r.fuel_type) && (
                                                kmPerLiterMap[r.id] != null ? (
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md w-fit ${kmPerLiterMap[r.id]! >= 2.5 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                                                        {kmPerLiterMap[r.id]!.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km/L
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-slate-300 ml-1">— km/L</span>
                                                )
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 font-mono text-sm font-bold text-slate-800">
                                        {r.odometer != null
                                            ? `${Number(r.odometer).toLocaleString('pt-BR')} km`
                                            : <span className="text-slate-300">—</span>}
                                    </td>
                                    <td className="px-6 py-5 font-bold text-slate-700 text-sm">{r.driver?.name || '---'}</td>
                                    <td className="px-6 py-5 text-sm">
                                        <span className="font-black uppercase text-[10px] tracking-widest text-slate-600">{fuelTypeLabel(r.fuel_type)}</span>
                                    </td>
                                    <td className="px-6 py-5 font-bold text-slate-900 text-sm">{Number(r.liters || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L</td>
                                    <td className="px-6 py-5 font-bold text-primary-600 text-sm">{fmt(Number(r.total_value) || 0)}</td>
                                    <td className="px-6 py-5 text-sm">
                                        {isDieselFuel(r.fuel_type) && r.arla_liters ? (
                                            <span className="font-bold text-teal-700">{Number(r.arla_liters).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L</span>
                                        ) : (
                                            <span className="text-slate-300">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-5 text-sm">
                                        {isDieselFuel(r.fuel_type) && r.arla_value ? (
                                            <span className="font-bold text-teal-600">{fmt(Number(r.arla_value))}</span>
                                        ) : (
                                            <span className="text-slate-300">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-5 text-sm">
                                        <span className="font-black text-slate-900">{fmt((Number(r.total_value) || 0) + (isDieselFuel(r.fuel_type) ? (Number(r.arla_value) || 0) : 0))}</span>
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
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <FuelModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingRecord(null); setHighlightId(null); }}
                onSave={handleSave}
                vehicles={vehicles}
                drivers={drivers}
                suppliers={suppliers}
                initialData={editingRecord}
            />
        </div>
    );
}
