import { useState, useEffect } from 'react';
import { Droplet, Truck, Gauge, Send, CheckCircle2, LogOut, Loader2, Search, User, Lock } from 'lucide-react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { fleetService, driverService } from '../../lib/services';
import { useNavigate } from 'react-router-dom';

type FuelKind = 'diesel' | 'arla';
type Tab = 'abastecer' | 'preco';

function adminProbeClient() {
    const memory = new Map<string, string>();
    return createClient(
        import.meta.env.VITE_SUPABASE_URL as string,
        import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: false,
                detectSessionInUrl: false,
                storageKey: 'posto-admin-probe',
                storage: {
                    getItem: (key) => memory.get(key) ?? null,
                    setItem: (key, value) => { memory.set(key, value); },
                    removeItem: (key) => { memory.delete(key); },
                },
            },
        },
    );
}

export default function PostoRefuel() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const companyId = (user as any)?.company_id;

    const [tab, setTab] = useState<Tab>('abastecer');
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    const [search, setSearch] = useState('');
    const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
    const [lastKm, setLastKm] = useState<number>(0);

    const [driverId, setDriverId] = useState('');
    const [kind, setKind] = useState<FuelKind>('diesel');
    const [litros, setLitros] = useState<number | ''>('');
    const [km, setKm] = useState<number | ''>('');
    const [errorKm, setErrorKm] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    const [adminClient, setAdminClient] = useState<SupabaseClient | null>(null);
    const [adminPassword, setAdminPassword] = useState('');
    const [unlocking, setUnlocking] = useState(false);
    const [unlockError, setUnlockError] = useState<string | null>(null);
    const [dieselPrice, setDieselPrice] = useState('');
    const [arlaPrice, setArlaPrice] = useState('');
    const [savingPrice, setSavingPrice] = useState(false);
    const [priceSaved, setPriceSaved] = useState(false);

    useEffect(() => {
        const load = async () => {
            if (!companyId) return;
            try {
                const [vs, ds] = await Promise.all([
                    fleetService.getVehiclesForFuel(companyId),
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
        if (kind === 'diesel' && val <= lastKm) {
            setErrorKm(`Odômetro deve ser maior que o último registro (${lastKm} km).`);
        } else {
            setErrorKm(null);
        }
    };

    const reset = () => {
        setSelectedVehicle(null);
        setKm(''); setLitros(''); setDriverId(''); setKind('diesel');
        setErrorKm(null); setLastKm(0); setSearch('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedVehicle || !companyId || errorKm) return;
        if (typeof km !== 'number' || typeof litros !== 'number' || litros <= 0) {
            alert('Preencha litros e odômetro.');
            return;
        }
        setSaving(true);
        try {
            await driverService.registerPostoFuel({
                vehicle_id: selectedVehicle.id,
                driver_id: driverId || null,
                odometer: km,
                liters: litros,
                kind,
            });
            setSuccess(true);
            setTimeout(() => { setSuccess(false); reset(); }, 2000);
        } catch (error: any) {
            alert(error?.message || 'Erro ao registrar abastecimento.');
        } finally {
            setSaving(false);
        }
    };

    const unlockPrices = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!adminPassword.trim()) return;
        setUnlocking(true);
        setUnlockError(null);
        const probe = adminProbeClient();
        try {
            const { data: admins, error: listErr } = await supabase
                .from('profiles')
                .select('email, role, company_id')
                .eq('role', 'admin')
                .eq('company_id', companyId);
            if (listErr) throw listErr;
            const emails = (admins || []).map((a: any) => String(a.email || '').trim()).filter(Boolean);
            if (emails.length === 0) {
                setUnlockError('Nenhum administrador encontrado nesta empresa.');
                return;
            }
            let signed: SupabaseClient | null = null;
            for (const email of emails) {
                const { error } = await probe.auth.signInWithPassword({ email, password: adminPassword });
                if (!error) {
                    signed = probe;
                    break;
                }
            }
            if (!signed) {
                setUnlockError('Senha de administrador inválida.');
                return;
            }
            const { data: prices, error: priceErr } = await signed
                .from('posto_prices')
                .select('diesel_price, arla_price')
                .eq('company_id', companyId)
                .maybeSingle();
            if (priceErr) {
                await signed.auth.signOut();
                setUnlockError('Senha correta, mas a tabela de preços ainda não existe. Rode o SQL FIX_POSTO_AGREGADOS_FRETE no Supabase.');
                return;
            }
            setDieselPrice(prices?.diesel_price != null ? String(prices.diesel_price) : '');
            setArlaPrice(prices?.arla_price != null ? String(prices.arla_price) : '');
            setAdminClient(signed);
            setAdminPassword('');
        } catch (err: any) {
            setUnlockError(err?.message || 'Não foi possível conferir a senha.');
        } finally {
            setUnlocking(false);
        }
    };

    const savePrices = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!adminClient || !companyId) return;
        const diesel = dieselPrice === '' ? null : Number(dieselPrice);
        const arla = arlaPrice === '' ? null : Number(arlaPrice);
        if ((diesel != null && (!Number.isFinite(diesel) || diesel < 0)) || (arla != null && (!Number.isFinite(arla) || arla < 0))) {
            alert('Informe um preço válido.');
            return;
        }
        setSavingPrice(true);
        setPriceSaved(false);
        try {
            const { error } = await adminClient.from('posto_prices').upsert({
                company_id: companyId,
                diesel_price: diesel,
                arla_price: arla,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'company_id' });
            if (error) throw error;
            setPriceSaved(true);
        } catch (err: any) {
            alert(err?.message || 'Erro ao salvar o preço. Rode o SQL FIX_POSTO_AGREGADOS_FRETE no Supabase.');
        } finally {
            setSavingPrice(false);
        }
    };

    const handleLogout = async () => {
        try { await adminClient?.auth.signOut(); } catch { /* sessão do admin é só desta aba */ }
        await logout();
        navigate('/login');
    };

    const filtered = vehicles.filter(v => {
        const q = search.toLowerCase().trim();
        if (!q) return true;
        return (v.plate || '').toLowerCase().includes(q) || (v.model || '').toLowerCase().includes(q);
    });

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
            <header className="bg-slate-900 text-white p-4 sticky top-0 z-10 shadow-lg">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Droplet size={22} className="text-primary-400" />
                        <h1 className="font-black text-lg">Posto — Abastecimento</h1>
                    </div>
                    <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-white transition-colors" title="Sair">
                        <LogOut size={20} />
                    </button>
                </div>
                <div className="flex gap-2 mt-3">
                    <button
                        type="button"
                        onClick={() => setTab('abastecer')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase ${tab === 'abastecer' ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-300'}`}
                    >
                        Abastecer
                    </button>
                    <button
                        type="button"
                        onClick={() => setTab('preco')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 ${tab === 'preco' ? 'bg-white text-slate-900' : 'bg-slate-800 text-slate-300'}`}
                    >
                        <Lock size={12} /> Preço do litro
                    </button>
                </div>
            </header>

            {tab === 'preco' ? (
                <div className="p-4 max-w-lg mx-auto">
                    {!adminClient ? (
                        <form onSubmit={unlockPrices} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                            <p className="text-sm font-bold text-slate-700">Aba do administrador</p>
                            <p className="text-xs text-slate-500">O frentista não altera o preço. Use a senha do administrador desta empresa.</p>
                            <input
                                type="password"
                                value={adminPassword}
                                onChange={e => setAdminPassword(e.target.value)}
                                placeholder="Senha do administrador"
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-4 text-slate-900 outline-none focus:ring-2 focus:ring-primary-500/20"
                                autoComplete="current-password"
                            />
                            {unlockError && <p className="text-red-500 text-xs font-bold">{unlockError}</p>}
                            <button
                                type="submit"
                                disabled={unlocking || !adminPassword}
                                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black disabled:opacity-50"
                            >
                                {unlocking ? 'Conferindo...' : 'Entrar'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={savePrices} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                            <p className="text-sm font-bold text-slate-700">Preço usado em todo lançamento do posto</p>
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase mb-2">Diesel (R$/L)</label>
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    step="0.001"
                                    min="0"
                                    value={dieselPrice}
                                    onChange={e => { setDieselPrice(e.target.value); setPriceSaved(false); }}
                                    placeholder="0,000"
                                    className="w-full bg-white border border-slate-200 rounded-2xl py-4 px-4 text-2xl font-mono font-black text-slate-900 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase mb-2">ARLA (R$/L)</label>
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    step="0.001"
                                    min="0"
                                    value={arlaPrice}
                                    onChange={e => { setArlaPrice(e.target.value); setPriceSaved(false); }}
                                    placeholder="0,000"
                                    className="w-full bg-white border border-slate-200 rounded-2xl py-4 px-4 text-2xl font-mono font-black text-slate-900 outline-none"
                                />
                            </div>
                            {priceSaved && <p className="text-emerald-600 text-xs font-bold">Preço salvo.</p>}
                            <button
                                type="submit"
                                disabled={savingPrice}
                                className="w-full bg-primary-600 text-white py-4 rounded-2xl font-black disabled:opacity-50"
                            >
                                {savingPrice ? 'Salvando...' : 'Salvar preços'}
                            </button>
                        </form>
                    )}
                </div>
            ) : loadingData ? (
                <div className="flex items-center justify-center py-24 text-slate-400">
                    <Loader2 size={32} className="animate-spin" />
                </div>
            ) : !selectedVehicle ? (
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
                                    <p className="text-xs text-slate-400 truncate">
                                        {v.model || 'Veículo'}
                                        {v.agregado_id ? ' · Agregado' : ''}
                                    </p>
                                </div>
                            </button>
                        ))}
                        {filtered.length === 0 && (
                            <p className="text-center text-slate-400 py-8 col-span-full">Nenhum veículo encontrado.</p>
                        )}
                    </div>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="p-4 space-y-5 max-w-lg mx-auto">
                    <div className="bg-white rounded-2xl p-4 flex items-center justify-between border border-slate-200">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-primary-50 rounded-xl">
                                <Truck size={24} className="text-primary-600" />
                            </div>
                            <div>
                                <p className="font-black text-xl text-slate-900 font-mono">{selectedVehicle.plate}</p>
                                <p className="text-xs text-slate-400">
                                    Último: {lastKm.toLocaleString('pt-BR')} km
                                    {selectedVehicle.agregado_id ? ' · Agregado' : ''}
                                </p>
                            </div>
                        </div>
                        <button type="button" onClick={reset} className="text-xs font-bold text-primary-600 hover:underline">
                            Trocar
                        </button>
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

                    <div>
                        <label className="block text-sm font-black text-slate-700 mb-2">Combustível</label>
                        <div className="grid grid-cols-2 gap-2">
                            {(['diesel', 'arla'] as FuelKind[]).map(option => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => {
                                        setKind(option);
                                        if (option === 'arla') setErrorKm(null);
                                        else if (typeof km === 'number' && km <= lastKm) {
                                            setErrorKm(`Odômetro deve ser maior que o último registro (${lastKm} km).`);
                                        }
                                    }}
                                    className={`py-4 rounded-2xl text-sm font-black uppercase border ${kind === option ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200'}`}
                                >
                                    {option === 'diesel' ? 'Diesel' : 'ARLA'}
                                </button>
                            ))}
                        </div>
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
                            onChange={e => setLitros(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="0,00"
                            className="w-full bg-white border border-slate-200 rounded-2xl py-4 px-4 text-2xl font-mono font-black text-slate-900 outline-none focus:ring-2 focus:ring-primary-500/20"
                        />
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
                            placeholder={kind === 'diesel' ? `Maior que ${lastKm}` : 'Km atual'}
                            className={`w-full bg-white border rounded-2xl py-4 px-4 text-2xl font-mono font-black text-slate-900 outline-none ${errorKm ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200 focus:ring-2 focus:ring-primary-500/20'}`}
                        />
                        {errorKm && <p className="text-red-500 text-xs font-bold mt-2">{errorKm}</p>}
                    </div>

                    <button
                        type="submit"
                        disabled={saving || !!errorKm || typeof km !== 'number' || typeof litros !== 'number' || litros <= 0}
                        className="w-full bg-primary-600 hover:bg-primary-700 text-white py-5 rounded-2xl text-lg font-black flex items-center justify-center gap-2 shadow-lg shadow-primary-500/30 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
                    >
                        {saving ? <Loader2 size={24} className="animate-spin" /> : <><Send size={22} /> Registrar Abastecimento</>}
                    </button>
                </form>
            )}
        </div>
    );
}
