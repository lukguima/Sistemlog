import { useState, useEffect } from 'react';
import { FileText, Download, Search, Users, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { tripService, fleetService, settlementService, settingsService } from '../../lib/services';
import { useAuth } from '../../context/AuthContext';
import { generateDriverPaymentReceipt, exportToExcel } from '../../lib/exports';
import { DEFAULT_COMMISSION_RATE } from '../../lib/constants';
import { calcTripCommission, normalizeCommissionBase, type CommissionBase } from '../../lib/commission';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface DriverProduction {
    driverId: string;
    driverName: string;
    driverCpf: string;
    trips: any[];
    advances: any[];
    totalGross: number;
    totalCommission: number;
    totalAdvances: number;
    totalNet: number;
    tripCount: number;
}

export default function DriverReport() {
    const { user } = useAuth();
    const companyId = (user as any)?.company_id;

    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const [startDate, setStartDate] = useState(firstOfMonth.toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
    const [selectedDriver, setSelectedDriver] = useState('');

    const [drivers, setDrivers] = useState<any[]>([]);
    const [companyName, setCompanyName] = useState('');
    const [production, setProduction] = useState<DriverProduction[]>([]);
    const [loading, setLoading] = useState(false);
    const [generated, setGenerated] = useState(false);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [commissionBase, setCommissionBase] = useState<CommissionBase>('net_tax');

    useEffect(() => {
        if (!companyId) return;
        fleetService.getDrivers(companyId).then(setDrivers).catch(() => {});
        settingsService.getCompanyProfile(companyId)
            .then(p => setCompanyName(p?.name || p?.company_name || 'Empresa'))
            .catch(() => {});
        settingsService.getSettings(companyId)
            .then(s => setCommissionBase(normalizeCommissionBase(s?.commission_base)))
            .catch(() => {});
    }, [companyId]);

    const handleGenerate = async () => {
        if (!companyId) return;
        setLoading(true);
        try {
            const [trips, advances] = await Promise.all([
                tripService.getTrips(companyId, startDate, endDate),
                settlementService.getAdvances(companyId, 'pending'),
            ]);

            const byDriver: Record<string, DriverProduction> = {};

            trips?.forEach(trip => {
                if (!trip.driver_id) return;
                if (selectedDriver && trip.driver_id !== selectedDriver) return;

                const driverInfo = drivers.find(d => d.id === trip.driver_id);

                if (!byDriver[trip.driver_id]) {
                    byDriver[trip.driver_id] = {
                        driverId: trip.driver_id,
                        driverName: trip.driver?.name || driverInfo?.name || 'Sem Nome',
                        driverCpf: driverInfo?.cpf || '',
                        trips: [],
                        advances: [],
                        totalGross: 0,
                        totalCommission: 0,
                        totalAdvances: 0,
                        totalNet: 0,
                        tripCount: 0,
                    };
                }

                const { commission: commissionValue, rate } = calcTripCommission(trip, commissionBase, DEFAULT_COMMISSION_RATE);
                const gross = Number(trip.gross_value) || 0;
                const advance = Number(trip.advance_value) || 0;

                byDriver[trip.driver_id].trips.push({ ...trip, commissionValue, commissionRate: rate });
                byDriver[trip.driver_id].totalGross += gross;
                byDriver[trip.driver_id].totalCommission += commissionValue;
                byDriver[trip.driver_id].totalAdvances += advance;
                byDriver[trip.driver_id].tripCount++;
            });

            // Pending advances (extra, not trip-level)
            advances?.forEach(adv => {
                if (!byDriver[adv.driver_id]) return;
                byDriver[adv.driver_id].advances.push(adv);
                byDriver[adv.driver_id].totalAdvances += Number(adv.amount) || 0;
            });

            Object.values(byDriver).forEach(d => {
                d.totalGross = round2(d.totalGross);
                d.totalCommission = round2(d.totalCommission);
                d.totalAdvances = round2(d.totalAdvances);
                d.totalNet = round2(Math.max(0, d.totalCommission - d.totalAdvances));
            });

            const result = Object.values(byDriver).sort((a, b) => b.totalGross - a.totalGross);
            setProduction(result);
            setExpanded(new Set(result.map(d => d.driverId)));
            setGenerated(true);
        } finally {
            setLoading(false);
        }
    };

    const handleGeneratePdf = (driver: DriverProduction) => {
        const period = `${new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR')}`;
        generateDriverPaymentReceipt({
            companyName,
            driverName: driver.driverName,
            driverCpf: driver.driverCpf,
            period,
            trips: driver.trips.map(t => ({
                date: new Date(t.created_at).toLocaleDateString('pt-BR'),
                cte: t.cte_number || t.cte || '',
                origin: t.origin || '-',
                destination: t.destination || '-',
                vehicle: t.vehicle?.plate || '-',
                grossValue: Number(t.gross_value) || 0,
                commissionRate: t.commissionRate,
                commissionValue: t.commissionValue,
                advance: Number(t.advance_value) || 0,
                net: round2(t.commissionValue - (Number(t.advance_value) || 0)),
            })),
            advances: driver.advances,
            summary: {
                totalGross: driver.totalGross,
                totalCommission: driver.totalCommission,
                totalAdvances: driver.totalAdvances,
                totalNet: driver.totalNet,
            },
        });
    };

    const handleExportExcel = () => {
        const rows: any[] = [];
        production.forEach(driver => {
            driver.trips.forEach(t => {
                rows.push({
                    'Motorista': driver.driverName,
                    'Data': new Date(t.created_at).toLocaleDateString('pt-BR'),
                    'CTE': t.cte_number || '-',
                    'Origem': t.origin || '-',
                    'Destino': t.destination || '-',
                    'Veículo': t.vehicle?.plate || '-',
                    'Frete Bruto (R$)': Number(t.gross_value) || 0,
                    'Taxa Comissão (%)': t.commissionRate,
                    'Comissão (R$)': t.commissionValue,
                    'Vale/Adiant. (R$)': Number(t.advance_value) || 0,
                    'Status': t.status,
                });
            });
        });
        exportToExcel(rows, `producao_motoristas_${startDate}_${endDate}`);
    };

    const toggleExpand = (driverId: string) => {
        setExpanded(prev => {
            const next = new Set(prev);
            next.has(driverId) ? next.delete(driverId) : next.add(driverId);
            return next;
        });
    };

    const statusLabel = (s: string) =>
        s === 'paid' ? 'Pago' : s === 'completed' ? 'Finalizado' : s === 'in_transit' ? 'Em Viagem' : s === 'validated' ? 'Validado' : s || '-';
    const statusClass = (s: string) =>
        s === 'paid' ? 'bg-emerald-100 text-emerald-700' : s === 'completed' ? 'bg-blue-100 text-blue-700' : s === 'in_transit' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600';

    const totalGrossAll = production.reduce((s, d) => s + d.totalGross, 0);
    const totalNetAll = production.reduce((s, d) => s + d.totalNet, 0);

    const labelStyle = "text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1";
    const inputStyle = "input-field";

    return (
        <div className="space-y-6 pb-12">
            <div>
                <h1 className="text-2xl font-black text-slate-900">Produção de Motoristas</h1>
                <p className="text-slate-500 text-sm mt-1">Visualize a produção por motorista no período e gere recibos de pagamento em PDF.</p>
            </div>

            {/* Filters */}
            <div className="card p-5">
                <div className="flex flex-wrap gap-4 items-end">
                    <div>
                        <label className={labelStyle}>Motorista</label>
                        <select className={inputStyle} value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)}>
                            <option value="">Todos os Motoristas</option>
                            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelStyle}>Data Início</label>
                        <input type="date" className={inputStyle} value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div>
                        <label className={labelStyle}>Data Fim</label>
                        <input type="date" className={inputStyle} value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    <button onClick={handleGenerate} disabled={loading} className="btn-primary flex items-center gap-2 px-6 py-2.5">
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                        Gerar Relatório
                    </button>
                    {production.length > 0 && (
                        <button onClick={handleExportExcel} className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                            <Download size={16} /> Exportar Excel
                        </button>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            {production.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Motoristas', value: String(production.length) },
                        { label: 'Total de Viagens', value: String(production.reduce((s, d) => s + d.tripCount, 0)) },
                        { label: 'Frete Bruto Total', value: fmt(totalGrossAll) },
                        { label: 'Total a Pagar', value: fmt(totalNetAll), highlight: true },
                    ].map((stat, i) => (
                        <div key={i} className={`card p-5 ${stat.highlight ? 'border-emerald-200 bg-emerald-50/30' : ''}`}>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{stat.label}</p>
                            <p className={`text-2xl font-black ${stat.highlight ? 'text-emerald-600' : 'text-slate-900'}`}>{stat.value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Per-driver sections */}
            {production.map(driver => (
                <div key={driver.driverId} className="card overflow-hidden">
                    <div
                        className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 transition-colors select-none"
                        onClick={() => toggleExpand(driver.driverId)}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center text-primary-600 font-black text-lg uppercase shrink-0">
                                {driver.driverName[0]}
                            </div>
                            <div>
                                <p className="font-black text-slate-900">{driver.driverName}</p>
                                {driver.driverCpf && <p className="text-xs text-slate-400">CPF: {driver.driverCpf}</p>}
                                <p className="text-xs text-slate-400">{driver.tripCount} viagem(ns) no período</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-6 md:gap-4">
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Frete Bruto</p>
                                <p className="font-bold text-slate-700">{fmt(driver.totalGross)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comissão</p>
                                <p className="font-bold text-blue-600">{fmt(driver.totalCommission)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descontos</p>
                                <p className="font-bold text-rose-500">- {fmt(driver.totalAdvances)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Líquido</p>
                                <p className="font-black text-emerald-600 text-xl">{fmt(driver.totalNet)}</p>
                            </div>
                            <button
                                onClick={e => { e.stopPropagation(); handleGeneratePdf(driver); }}
                                className="btn-primary flex items-center gap-2 px-4 py-2 text-sm shrink-0"
                            >
                                <FileText size={15} /> Gerar Recibo PDF
                            </button>
                            {expanded.has(driver.driverId) ? <ChevronUp size={18} className="text-slate-400 shrink-0" /> : <ChevronDown size={18} className="text-slate-400 shrink-0" />}
                        </div>
                    </div>

                    {expanded.has(driver.driverId) && (
                        <div className="border-t border-slate-100">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <tr>
                                            <th className="px-5 py-3">Data</th>
                                            <th className="px-5 py-3">CTE</th>
                                            <th className="px-5 py-3">Origem → Destino</th>
                                            <th className="px-5 py-3">Veículo</th>
                                            <th className="px-5 py-3 text-right">Frete Bruto</th>
                                            <th className="px-5 py-3 text-right">Comissão</th>
                                            <th className="px-5 py-3 text-right">Vale/Adiant.</th>
                                            <th className="px-5 py-3 text-right">Líq. Viagem</th>
                                            <th className="px-5 py-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {driver.trips.map((t, i) => {
                                            const advance = Number(t.advance_value) || 0;
                                            const tripNet = round2(t.commissionValue - advance);
                                            return (
                                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-5 py-3 text-sm text-slate-500 whitespace-nowrap">{new Date(t.created_at).toLocaleDateString('pt-BR')}</td>
                                                    <td className="px-5 py-3 text-sm font-mono text-slate-600 whitespace-nowrap">{t.cte_number || '-'}</td>
                                                    <td className="px-5 py-3 text-sm font-medium">{t.origin || '-'} → {t.destination || '-'}</td>
                                                    <td className="px-5 py-3 text-sm font-mono text-slate-600">{t.vehicle?.plate || '-'}</td>
                                                    <td className="px-5 py-3 text-sm font-bold text-right">{fmt(Number(t.gross_value) || 0)}</td>
                                                    <td className="px-5 py-3 text-sm text-right whitespace-nowrap">
                                                        <span className="text-blue-600 font-bold">{fmt(t.commissionValue)}</span>
                                                        <span className="text-slate-400 text-xs ml-1">({t.commissionRate}%)</span>
                                                    </td>
                                                    <td className="px-5 py-3 text-sm font-bold text-right text-rose-500">{advance > 0 ? `- ${fmt(advance)}` : '-'}</td>
                                                    <td className="px-5 py-3 text-sm font-black text-right text-emerald-600">{fmt(Math.max(0, tripNet))}</td>
                                                    <td className="px-5 py-3">
                                                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${statusClass(t.status)}`}>
                                                            {statusLabel(t.status)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {driver.advances.length > 0 && (
                                <div className="p-4 bg-rose-50/40 border-t border-rose-100">
                                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-2">Vales / Adiantamentos Pendentes</p>
                                    <div className="flex flex-wrap gap-3">
                                        {driver.advances.map((adv, i) => (
                                            <div key={i} className="bg-white border border-rose-100 rounded-xl px-3 py-2 text-sm flex items-center gap-2">
                                                <span className="text-slate-600">{adv.description || 'Vale'}</span>
                                                <span className="font-black text-rose-500">- {fmt(Number(adv.amount))}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}

            {generated && production.length === 0 && !loading && (
                <div className="card p-12 text-center">
                    <Users size={40} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-slate-500 font-medium">Nenhuma viagem encontrada no período selecionado.</p>
                </div>
            )}

            {!generated && !loading && (
                <div className="card p-12 text-center">
                    <Search size={40} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-slate-500 font-medium">Selecione os filtros e clique em "Gerar Relatório" para visualizar a produção.</p>
                </div>
            )}
        </div>
    );
}
