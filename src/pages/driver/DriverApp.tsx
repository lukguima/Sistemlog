import {
    Truck,
    Camera,
    MapPin,
    CheckCircle2,
    AlertCircle,
    History,
    User,
    LogOut,
    Fuel,
    Navigation,
    Plus
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { tripService, fleetService, dashboardService } from '../../lib/services';
import { useNavigate, Link } from 'react-router-dom';

export default function DriverApp() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [activeTrip, setActiveTrip] = useState<any>(null);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchInitialData = async () => {
        if (!user?.email) return;
        setLoading(true);
        try {
            const driver = await fleetService.getDriverByEmail(user.email);
            if (driver) {
                const [trip, systemAlerts] = await Promise.all([
                    tripService.getActiveTrip(driver.id),
                    dashboardService.getSystemAlerts(driver.company_id)
                ]);
                setActiveTrip(trip);
                // Filtrar alertas críticos ou relevantes para este veículo se possível
                setAlerts(systemAlerts.slice(0, 2));
            }
        } catch (error) {
            console.error('Error fetching initial data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, [user?.email]);

    const handleFinishTrip = async () => {
        if (!activeTrip) return;
        if (!confirm("Confirmar entrega da carga e finalizar viagem?")) return;

        try {
            await tripService.finishTrip(activeTrip.id);
            alert("Viagem finalizada com sucesso!");
            fetchInitialData();
        } catch (error) {
            console.error('Error finishing trip:', error);
            alert("Erro ao finalizar viagem.");
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-[#0B0F17] text-white flex flex-col font-display max-w-md mx-auto relative overflow-hidden">
            {/* Background Glows */}
            <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-64 h-64 bg-primary-600/20 blur-[100px] rounded-full"></div>

            {/* Header */}
            <header className="px-6 pt-8 pb-4 flex justify-between items-center relative z-10">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-600 to-indigo-600 p-[2px]">
                        <div className="w-full h-full rounded-[14px] bg-[#161B26] flex items-center justify-center">
                            <Truck size={24} className="text-white" />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-lg font-black tracking-tight leading-none">LogiDriver</h2>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${activeTrip ? 'text-rose-500 animate-pulse' : 'text-slate-500'}`}>
                            {activeTrip ? '● Em Viagem' : '○ Disponível'}
                        </span>
                    </div>
                </div>
                <button onClick={handleLogout} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
                    <LogOut size={20} className="text-rose-500" />
                </button>
            </header>

            <main className="flex-1 px-6 pt-6 pb-24 space-y-8 relative z-10 overflow-y-auto">
                {/* Active Trip Card */}
                {loading ? (
                    <div className="bg-[#161B26] p-12 rounded-[2.5rem] border border-white/10 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                    </div>
                ) : activeTrip ? (
                    <div className="bg-[#161B26] p-6 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <Navigation size={64} />
                        </div>

                        <div className="flex items-start justify-between mb-6">
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Caminhão Atual</p>
                                <h3 className="text-2xl font-black text-white italic">{activeTrip.vehicle?.plate || 'S/ Placa'}</h3>
                            </div>
                            <div className="bg-primary-600/10 text-primary-400 px-3 py-1 rounded-lg text-xs font-black border border-primary-500/20">
                                KM: {(activeTrip.vehicle?.last_km || 0).toLocaleString('pt-BR')}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                    <MapPin size={16} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase">Origem</p>
                                    <p className="text-sm font-bold text-white">{activeTrip.origin}</p>
                                </div>
                            </div>
                            <div className="w-0.5 h-6 bg-slate-800 ml-4"></div>
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-primary-500/10 flex items-center justify-center text-primary-500">
                                    <Navigation size={16} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase">Destino</p>
                                    <p className="text-sm font-bold text-white">{activeTrip.destination}</p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleFinishTrip}
                            className="w-full mt-8 bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-3xl font-black transition-all flex items-center justify-center gap-2 shadow-[0_10px_20px_-5px_rgba(16,185,129,0.3)]"
                        >
                            <CheckCircle2 size={20} />
                            Confirmar Entrega
                        </button>
                    </div>
                ) : (
                    <div className="bg-[#161B26] p-8 rounded-[2.5rem] border border-white/10 text-center space-y-4">
                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-500">
                            <Truck size={32} />
                        </div>
                        <div>
                            <h3 className="font-black text-lg">Sem Viagens Ativas</h3>
                            <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest">Aguarde novas atribuições do despacho</p>
                        </div>
                    </div>
                )}

                {/* Quick Actions Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <Link
                        to="/driver/refuel"
                        className="bg-[#161B26] p-5 rounded-[2rem] border border-white/5 flex flex-col items-center gap-3 transition-all hover:border-primary-500/30 text-center"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 font-bold italic">
                            <Fuel size={24} />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest text-white">Abastecer</span>
                    </Link>
                    {/* Canhoto — funcionalidade em breve */}
                    <div className="bg-[#161B26] p-5 rounded-[2rem] border border-white/5 flex flex-col items-center gap-3 opacity-50 cursor-not-allowed select-none">
                        <div className="w-12 h-12 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-500">
                            <Camera size={24} />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest">Em breve</span>
                    </div>
                    {/* Pneus — visualização via link correto da área de pneus */}
                    <div className="bg-[#161B26] p-5 rounded-[2rem] border border-white/5 flex flex-col items-center gap-3 opacity-50 cursor-not-allowed select-none">
                        <div className="w-12 h-12 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-500 font-bold italic">
                            3D
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest">Pneus</span>
                    </div>
                    {/* Histórico de viagens — em desenvolvimento */}
                    <div className="bg-[#161B26] p-5 rounded-[2rem] border border-white/5 flex flex-col items-center gap-3 opacity-50 cursor-not-allowed select-none">
                        <div className="w-12 h-12 rounded-2xl bg-slate-500/10 flex items-center justify-center text-slate-400">
                            <History size={24} />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest">Histórico</span>
                    </div>
                </div>

                {/* Notifications/Alerts */}
                {alerts.length > 0 ? (
                    alerts.map((alert, i) => (
                        <div key={i} className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-3xl flex items-start gap-4">
                            <AlertCircle className="text-rose-500 mt-1" size={20} />
                            <div>
                                <p className="font-black text-rose-400 text-sm italic underline">{alert.title}</p>
                                <p className="text-xs text-rose-200/70 mt-1 font-medium italic">{alert.message}</p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-3xl flex items-start gap-4">
                        <CheckCircle2 className="text-emerald-500 mt-1" size={20} />
                        <div>
                            <p className="font-black text-emerald-400 text-sm italic">SEM ALERTAS</p>
                            <p className="text-xs text-emerald-200/70 mt-1 font-medium italic">Veículo em perfeitas condições.</p>
                        </div>
                    </div>
                )}
            </main>

            {/* Sticky Bottom Navigation */}
            <nav className="fixed bottom-6 left-6 right-6 h-20 bg-[#161B26]/80 backdrop-blur-2xl px-8 flex items-center justify-between rounded-[2rem] border border-white/10 shadow-2xl z-50">
                {/* Home — já está aqui */}
                <button className="text-primary-500" title="Início">
                    <Truck size={24} />
                </button>
                {/* Localização — placeholder visual */}
                <button className="text-slate-500 opacity-40 cursor-not-allowed" title="Em breve" disabled>
                    <MapPin size={24} />
                </button>
                {/* Ação principal: registrar abastecimento */}
                <button
                    onClick={() => navigate('/driver/refuel')}
                    className="w-14 h-14 bg-primary-600 rounded-2xl -mt-16 flex items-center justify-center shadow-xl shadow-primary-500/40 border-4 border-[#0B0F17] hover:bg-primary-500 transition-colors"
                    title="Registrar Abastecimento"
                >
                    <Plus size={24} />
                </button>
                {/* Histórico — placeholder visual */}
                <button className="text-slate-500 opacity-40 cursor-not-allowed" title="Em breve" disabled>
                    <History size={24} />
                </button>
                {/* Sair */}
                <button onClick={handleLogout} className="text-slate-500 hover:text-rose-400 transition-colors" title="Sair">
                    <User size={24} />
                </button>
            </nav>
        </div>
    );
}
