import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';
import {
    LayoutDashboard,
    Globe,
    LogOut,
    Menu,
    X,
    Users,
    Zap,
    Settings
} from 'lucide-react';

export default function MasterLayout() {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const navigation = [
        { name: 'Master Dashboard', href: '/saas-master', icon: LayoutDashboard },
        { name: 'Empresas Clientes', href: '/saas-master/customers', icon: Globe },
        { name: 'Planos & Assinaturas', href: '/saas-master/subscriptions', icon: Zap },
        { name: 'Usuários Master', href: '/saas-master/users', icon: Users },
        { name: 'Configurações Global', href: '/saas-master/settings', icon: Settings },
    ];

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-[#0B0F17] text-white flex transition-colors font-display">
            {/* Sidebar Master */}
            <aside className={`
                fixed lg:sticky top-0 left-0 h-screen w-72 bg-[#161B26] border-r border-white/10 flex flex-col z-40
                transition-transform duration-300 ease-in-out
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                <div className="h-24 flex items-center gap-3 px-8 border-b border-white/5">
                    <div className="bg-white rounded-xl p-1.5">
                        <img src="/images/logo.png" alt="SistemLog" className="h-9 object-contain" />
                    </div>
                    <span className="text-[10px] font-black text-primary-500 uppercase tracking-widest self-end mb-1">Master Panel</span>
                </div>

                <nav className="flex-1 overflow-y-auto w-full py-8 px-4 space-y-2">
                    {navigation.map((item) => {
                        const isActive = location.pathname === item.href;
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                onClick={() => setIsSidebarOpen(false)}
                                className={`
                                    flex items-center gap-4 px-4 py-3.5 rounded-2xl font-bold transition-all duration-300
                                    ${isActive
                                        ? 'bg-primary-600 text-white shadow-xl shadow-primary-600/20'
                                        : 'text-slate-500 hover:text-white hover:bg-white/5'}
                                `}
                            >
                                <Icon size={20} className={isActive ? "text-white" : "text-slate-600"} />
                                <span className="text-sm">{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-6 border-t border-white/5 bg-black/20">
                    <div className="flex items-center gap-3 mb-6 px-2">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0 text-white font-black">
                            M
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-xs font-black truncate text-white">{user?.email}</p>
                            <p className="text-[10px] font-bold text-primary-500 uppercase tracking-widest">Global Master</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-rose-500 hover:bg-rose-500/10 transition-colors text-sm"
                    >
                        <LogOut size={18} />
                        Logout Master
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 bg-[#0B0F17] relative">
                <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-primary-600/5 blur-[150px] pointer-events-none"></div>

                {/* Mobile Header */}
                <header className="lg:hidden h-20 bg-[#161B26] border-b border-white/10 flex items-center justify-between px-6 z-50 sticky top-0">
                    <div className="flex items-center">
                        <div className="bg-white rounded-lg p-1">
                            <img src="/images/logo.png" alt="SistemLog" className="h-7 object-contain" />
                        </div>
                    </div>
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </header>

                <div className="flex-1 p-4 md:p-8 lg:p-12 overflow-y-auto relative z-10 w-full max-w-[1600px] mx-auto">
                    <Outlet />
                </div>
            </main>

            {/* Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}
        </div>
    );
}

