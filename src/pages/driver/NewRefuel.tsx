import { useState, useEffect } from 'react';
import { Camera, Send, Droplet, ArrowLeft, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fleetService, driverService } from '../../lib/services';

export default function NewRefuel() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [lastKm, setLastKm] = useState(0);
    const [vehicleId, setVehicleId] = useState<string | null>(null);

    const [km, setKm] = useState<number | ''>('');
    const [litros, setLitros] = useState<number | ''>('');
    const [valor, setValor] = useState<number | ''>('');
    const [errorKm, setErrorKm] = useState<string | null>(null);

    useEffect(() => {
        const initData = async () => {
            if (!user?.email) return;
            try {
                const driver = await fleetService.getDriverByEmail(user.email);
                if (driver?.vehicle_id) {
                    setVehicleId(driver.vehicle_id);
                    const lastRecord = await driverService.getLastFuelRecord(driver.vehicle_id);
                    const kmBase = lastRecord?.km_reading || driver.vehicle?.last_km || 0;
                    setLastKm(kmBase);
                }
            } catch (error) {
                console.error('Error initializing refuel data:', error);
            }
        };

        initData();
    }, [user?.email]);

    const handleKmChange = (val: number) => {
        setKm(val);
        if (val <= lastKm) {
            setErrorKm(`Odômetro inválido. Último registro: ${lastKm} km.`);
        } else {
            setErrorKm(null);
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const companyId = (user as any)?.company_id;

        if (errorKm || !vehicleId || !companyId || !user?.email || typeof km !== 'number' || typeof litros !== 'number' || typeof valor !== 'number') {
            alert("Verifique os dados antes de continuar.");
            return;
        }

        try {
            const driver = await fleetService.getDriverByEmail(user.email);
            if (!driver) throw new Error("Motorista não encontrado.");

            await driverService.addFuelRecord({
                vehicle_id: vehicleId,
                driver_id: driver.id,
                odometer: km,
                liters: litros,
                total_value: valor,
                company_id: companyId,
                fuel_type: 'Diesel S10'
            });

            alert("Abastecimento registrado com sucesso!");
            navigate('/driver/home');
        } catch (error: any) {
            console.error('Error saving fuel record:', error);
            if (error?.code === 'FUEL_DUP_ODOMETER') {
                alert(error.message || 'Já existe abastecimento com este hodômetro.');
            } else {
                alert(error?.message || 'Erro ao salvar abastecimento.');
            }
        }
    }

    return (
        <div className="bg-slate-50 dark:bg-slate-900 min-h-screen font-display">
            <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 sticky top-0 z-10 flex items-center justify-between">
                <Link to="/driver/home" className="p-2 -ml-2 text-slate-600 dark:text-slate-300">
                    <ArrowLeft size={24} />
                </Link>
                <h1 className="font-bold text-lg">Novo Abastecimento</h1>
                <div className="w-8"></div>
            </header>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                        KM Odômetro Atual
                    </label>
                    <input
                        type="number"
                        className={`input-field text-lg font-mono ${errorKm ? 'border-red-500 ring-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                        placeholder={`Ex: ${lastKm + 500}`}
                        value={km}
                        onChange={e => handleKmChange(Number(e.target.value))}
                        required
                    />
                    {errorKm ? (
                        <p className="text-red-500 text-xs font-bold mt-2 flex items-center gap-1">
                            <AlertCircle size={14} /> {errorKm}
                        </p>
                    ) : (
                        <p className="text-xs text-slate-500 mt-2">O KM atual deve ser superior a {lastKm}.</p>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            Litros Inseridos
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                step="0.01"
                                className="input-field pl-10"
                                placeholder="0.00"
                                value={litros}
                                onChange={e => setLitros(Number(e.target.value))}
                                required
                            />
                            <Droplet size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            Valor Total (R$)
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                step="0.01"
                                className="input-field pl-4"
                                placeholder="0.00"
                                value={valor}
                                onChange={e => setValor(Number(e.target.value))}
                                required
                            />
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                        Foto da Nota/Comprovante
                    </label>
                    <button type="button" className="w-full h-32 border-2 border-dashed border-primary-300 dark:border-primary-900/50 bg-primary-50 dark:bg-primary-900/10 rounded-xl flex flex-col items-center justify-center text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/20 transition-colors">
                        <Camera size={32} className="mb-2" />
                        <span className="font-bold text-sm">Abrir Câmera</span>
                        <span className="text-[10px] opacity-70">Compressão Automática Ativa</span>
                    </button>
                </div>

                <button
                    type="submit"
                    disabled={!!errorKm || !km || !valor || !litros}
                    className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2 mt-8 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/30"
                >
                    <Send size={20} />
                    Registrar Abastecimento
                </button>
            </form>
        </div>
    );
}
