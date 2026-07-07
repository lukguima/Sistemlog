import { useState, useEffect } from 'react';
import { Droplet, Truck, Gauge, Send, CheckCircle2, LogOut, Loader2, Search, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { fleetService, driverService } from '../../lib/services';
import { useNavigate } from 'react-router-dom';

export default function PostoRefuel() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const companyId = (user as any)?.company_id;

    const [vehicles, setVehicles] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    const [search, setSearch] = useState('');
    const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
    const [lastKm, setLastKm] = useState<number>(0);

    const [km, setKm] = useState<number | ''>('');
    const [litros, setLitros] = useState<number | ''>('');
    const [valor, setValor] = useState<number | ''>('');
    const [driverId, setDriverId] = useState('');
    const [errorKm, setErrorKm] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const load = async () => {
            if (!companyId) return;
            try {
                const [vs, ds] = await Promise.all([
                    fleetService.getVehicles(companyId),
                    fleetService.getDrivers(companyId),
                ]);
                setVehicles(vs || []);
                setDrivers(ds || []);
            } catch (e) {
                console.error('Erro ao carregar dados do posto:', e);
            } finally {
                setLoadingData(false);
            }
        };
        load();
    }, [companyId]);

    const selectVehicle = async (v: any) => {
        setSelectedVehicle(v);
        try {
            const last = await driverService.getLastFuelRecord(v.id);
            const base = last?.odometer || v.current_km || v.last_km || 0;
            setLastKm(Number(base) || 0);
        } catch {
            setLastKm(Number(v.current_km) || 0);
        }
    };

    const handleKmChange = (val: number) => {
        setKm(val);
        if (val <= lastKm) {
            setErrorKm(`Odômetro deve ser maior que o último registro (${lastKm} km).`);
        } else {
            setErrorKm(null);
        }
    };

    const reset = () => {
        setSelectedVehicle(null);
        setKm(''); setLitros(''); setValor(''); setDriverId('');
        setErrorKm(null); setLastKm(0); setSearch('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedVehicle || !companyId || errorKm) return;
        if (typeof km !== 'number' || typeof litros !== 'number') {
            alert('Preencha odômetro e litros.');
            return;
        }
        setSaving(true);
        try {
            await driverService.addFuelRecord({
                vehicle_id: selectedVehicle.id,
                driver_id: driverId || null,
                odometer: km,
                liters: litros,
                total_value: typeof valor === 'number' ? valor : 0,
                company_id: companyId,
                fuel_type: 'Diesel S10',
            });
            setSuccess(true);
            setTimeout(() => { setSuccess(false); reset(); }, 2000);
        } catch (error: any) {
            alert(error?.message || 'Erro ao registrar abastecimento.');
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const filtered = vehicles.filter(v => {
        const q = search.toLowerCase().trim();
        if (!q) return true;
        return (v.plate || '').toLowerCase().includes(q) || (v.model || '').toLowerCase().includes(q);
    });

    // Tela de sucesso
    if (success) {
        return (
            <div className="min-h-screen bg-emerald-500 flex flex-col items-center justify-center p-6 text-white">
                <CheckCircle2 size={96} className="mb-6 animate-in zoom-in duration-300" />
                <h1 className="text-3xl font-black text-center">Abastecimento Registrado!</h1>
                <p className="text-emerald-50 mt-2 text-center">Pode liberar o próximo caminhão.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 font-display">
            {/* Header */}
            <header className="bg-slate-900 text-white p-4 sticky top-0 z-10 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-2">
                    <Droplet size={22} className="text-primary-400" />
                    <h1 className="font-black text-lg">Posto — Abastecimento</h1>
                </div>
                <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-white transition-colors" title="Sair">
                    <LogOut size={20} />
                </button>
            </header>

            {loadingData ? (
                <div className="flex items-center justify-center py-24 text-slate-400">
                    <Loader2 size={32} className="animate-spin" />
                </div>
            ) : !selectedVehicle ? (
                /* ── Passo 1: escolher o veículo ── */
                <div className="p-4 space-y-4">
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Selecione o caminhão</p>
                    <div className="relative">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar por placa ou modelo..."
                            className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-900 outline-none focus:ring-2 focus:ring-primary-500/20"
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {filtered.map(v => (
                            <button
                                key={v.id}
                                onClick={() => selectVehicle(v)}
                                className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 text-left hover:border-primary-400 hover:shadow-md transition-all active:scale-[0.98]"
                            >
                                <div className="p-3 bg-primary-50 rounded-xl">
                                    <Truck size={24} className="text-primary-600" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-black text-lg text-slate-900 font-mono">{v.plate}</p>
                                    <p className="text-xs text-slate-400 truncate">{v.model || 'Veículo'}</p>
                                </div>
                            </button>
                        ))}
                        {filtered.length === 0 && (
                            <p className="text-center text-slate-400 py-8 col-span-full">Nenhum veículo encontrado.</p>
                        )}
                    </div>
                </div>
            ) : (
                /* ── Passo 2: lançar o abastecimento ── */
                <form onSubmit={handleSubmit} className="p-4 space-y-5 max-w-lg mx-auto">
                    <div className="bg-white rounded-2xl p-4 flex items-center justify-between border border-slate-200">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-primary-50 rounded-xl">
                                <Truck size={24} className="text-primary-600" />
                            </div>
                            <div>
                                <p className="font-black text-xl text-slate-900 font-mono">{selectedVehicle.plate}</p>
                                <p className="text-xs text-slate-400">Último: {lastKm.toLocaleString('pt-BR')} km</p>
                            </div>
                        </div>
                        <button type="button" onClick={reset} className="text-xs font-bold text-primary-600 hover:underline">
                            Trocar
                        </button>
                    </div>

                    <div>
                        <label className="block text-sm font-black text-slate-700 mb-2 flex items-center gap-2">
                            <Gauge size={16} /> Odômetro Atual (km)
                        </label>
                        <input
                            type="number"
                            inputMode="numeric"
                            required
                            value={km}
                            onChange={e => handleKmChange(Number(e.target.value))}
                            placeholder={`Maior que ${lastKm}`}
                            className={`w-full bg-white border rounded-2xl py-4 px-4 text-2xl font-mono font-black text-slate-900 outline-none ${errorKm ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200 focus:ring-2 focus:ring-primary-500/20'}`}
                        />
                        {errorKm && <p className="text-red-500 text-xs font-bold mt-2">{errorKm}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-black text-slate-700 mb-2 flex items-center gap-2">
                            <Droplet size={16} /> Litros
                        </label>
                        <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            required
                            value={litros}
                            onChange={e => setLitros(Number(e.target.value))}
                            placeholder="0,00"
                            className="w-full bg-white border border-slate-200 rounded-2xl py-4 px-4 text-2xl font-mono font-black text-slate-900 outline-none focus:ring-2 focus:ring-primary-500/20"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-black text-slate-500 mb-2">Valor Total (R$) — opcional</label>
                        <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={valor}
                            onChange={e => setValor(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="Deixe vazio se for do tanque interno"
                            className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 px-4 text-lg font-mono text-slate-900 outline-none focus:ring-2 focus:ring-primary-500/20"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-black text-slate-500 mb-2 flex items-center gap-2">
                            <User size={16} /> Motorista — opcional
                        </label>
                        <select
                            value={driverId}
                            onChange={e => setDriverId(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 px-4 text-slate-900 outline-none focus:ring-2 focus:ring-primary-500/20"
                        >
                            <option value="">Não informar</option>
                            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>

                    <button
                        type="submit"
                        disabled={saving || !!errorKm || !km || !litros}
                        className="w-full bg-primary-600 hover:bg-primary-700 text-white py-5 rounded-2xl text-lg font-black flex items-center justify-center gap-2 shadow-lg shadow-primary-500/30 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
                    >
                        {saving ? <Loader2 size={24} className="animate-spin" /> : <><Send size={22} /> Registrar Abastecimento</>}
                    </button>
                </form>
            )}
        </div>
    );
}
