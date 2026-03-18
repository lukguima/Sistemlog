import { Fuel, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fleetService, tripService } from '../../lib/services';

export default function DriverHome() {
    const { user } = useAuth();
    const [driverInfo, setDriverInfo] = useState<any>(null);
    const [trips, setTrips] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const email = user?.email;

    useEffect(() => {
        if (!email) return;

        const fetchData = async () => {
            try {
                const driver = await fleetService.getDriverByEmail(email);
                setDriverInfo(driver);

                if (driver?.company_id) {
                    const allTrips = await tripService.getTrips(driver.company_id);
                    // Filtrar apenas as deste motorista
                    setTrips(allTrips.filter((t: any) => t.driver_id === driver.id));
                }
            } catch (error) {
                console.error('Error fetching driver home data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [email]);

    const vehicle = driverInfo?.vehicle;
    const driverNameInitials = driverInfo?.name ? driverInfo.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : '??';

    return (
        <div className="bg-slate-100 dark:bg-slate-900 min-h-screen pb-20 font-display">
            {/* App Header (Mobile Like) */}
            <header className="bg-primary text-white p-6 rounded-b-[2.5rem] shadow-md relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                <div className="relative z-10">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-xl font-bold tracking-tight">SistemLog Driver</h1>
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                            <span className="font-bold">{driverNameInitials}</span>
                        </div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
                        <div className="flex items-center gap-3 mb-2">
                            <Truck size={20} className="text-primary-100" />
                            <p className="text-sm font-semibold text-primary-50">Caminhão Atual</p>
                        </div>
                        <p className="text-2xl font-black font-mono">{vehicle?.plate || 'S/ Veículo'}</p>
                        <p className="text-sm text-primary-100 mt-1">KM Registrado: {vehicle?.last_km?.toLocaleString('pt-BR') || '0'} km</p>
                    </div>
                </div>
            </header>

            <main className="p-6 space-y-4 -mt-4 relative z-10">
                <h2 className="text-slate-800 dark:text-slate-200 font-bold mb-4 ml-2">Ações Rápidas</h2>

                <div className="grid grid-cols-2 gap-4">
                    {/* Botão Novo Abastecimento */}
                    <Link to="/driver/refuel" className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-3 text-center active:scale-95 transition-transform">
                        <div className="w-14 h-14 bg-orange-100 dark:bg-orange-500/10 text-orange-500 rounded-full flex items-center justify-center">
                            <Fuel size={28} />
                        </div>
                        <span className="font-bold text-sm text-slate-700 dark:text-slate-200">Abastecer</span>
                    </Link>

                    {/* Inspeção de Pneus */}
                    <button className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-3 text-center active:scale-95 transition-transform">
                        <div className="w-14 h-14 bg-blue-100 dark:bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center">
                            <span className="font-black text-xl">3D</span>
                        </div>
                        <span className="font-bold text-sm text-slate-700 dark:text-slate-200">Inspeção Pneus</span>
                    </button>
                </div>

                <div className="mt-8">
                    <h2 className="text-slate-800 dark:text-slate-200 font-bold mb-4 ml-2">Suas Viagens (Acerto)</h2>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
                        {loading ? (
                            <p className="text-sm text-slate-500 text-center py-4">Carregando...</p>
                        ) : trips.length > 0 ? (
                            trips.map(trip => (
                                <div key={trip.id} className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 last:border-0 pb-3 last:pb-0">
                                    <div>
                                        <p className="font-bold text-sm">Carga: {trip.cargo_description || 'Geral'}</p>
                                        <p className="text-xs text-slate-500">ID: {trip.id.split('-')[0]}...</p>
                                    </div>
                                    <span className={`px-2 py-1 text-[10px] font-bold rounded ${trip.status === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400'}`}>
                                        {trip.status === 'paid' ? 'LIQUIDADO' : 'AGUARD. ACERTO'}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-slate-500 text-center py-4">Nenhuma viagem registrada.</p>
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}
