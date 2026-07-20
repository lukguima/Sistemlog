import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { SubscriptionGuard } from '../SubscriptionGuard';
import { useState, useEffect } from 'react';
import { settingsService } from '../../lib/services';
import { canAccessRoute } from '../../lib/permissions';
import {
    LayoutDashboard,
    Truck,
    CircleDollarSign,
    Users,
    Settings as SettingsIcon,
    LogOut,
    Menu,
    X,
    Disc,
    Wrench,
    Fuel,
    Banknote,
    TrendingUp,
    FileBarChart2,
    BarChart3,
    CreditCard,
    Calculator,
    BookOpen,
    Bot,
    Brain,
    ShieldAlert,
    PieChart,
    Users2,
    Handshake
} from 'lucide-react';

export default function AdminLayout() {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [logoUrl, setLogoUrl] = useState<string>('/images/logo.png');

    useEffect(() => {
        if (user?.company_id) {
            settingsService.getSettings(user.company_id).then(s => {
                if (s?.logo_url) setLogoUrl(s.logo_url);
            }).catch(() => {});
        }
    }, [user?.company_id]);

    const navigation = [
        { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
        { name: 'Painel Executivo', href: '/admin/executive', icon: PieChart },
        { name: 'Viagens', href: '/admin/trips', icon: Truck },
        { name: 'Acerto', href: '/admin/settlement', icon: CircleDollarSign },
        { name: 'Agregados', href: '/admin/agregados', icon: Handshake },
        { name: 'Frota', href: '/admin/fleet', icon: Users },
        { name: 'Documentos', href: '/admin/documents', icon: FileBarChart2 },
        { name: 'Manutenção', href: '/admin/maintenance', icon: Wrench },
        { name: 'Abastecimento', href: '/admin/fuel', icon: Fuel },
        { name: 'Pneus', href: '/admin/tyre-check', icon: Disc },
        { name: 'Fornecedores', href: '/admin/suppliers', icon: Users },
        { name: 'Financeiro', href: '/admin/financial', icon: Banknote },
        { name: 'Fluxo de Caixa', href: '/admin/cash-flow', icon: TrendingUp },
        { name: 'DRE', href: '/admin/dre', icon: FileBarChart2 },
        { name: 'Rentabilidade', href: '/admin/vehicle-profitability', icon: BarChart3 },
        { name: 'Clientes', href: '/admin/clients-analysis', icon: Users2 },
        { name: 'Financiamentos', href: '/admin/financings', icon: CreditCard },
        { name: 'Simulador', href: '/admin/simulator', icon: Calculator },
        { name: 'Contabilidade', href: '/admin/accounting', icon: BookOpen },
        { name: 'Gestor IA', href: '/admin/ai-manager', icon: Bot },
        { name: 'Memória IA', href: '/admin/ai-memory', icon: Brain },
        { name: 'Riscos', href: '/admin/risks', icon: ShieldAlert },
        { name: 'Configurações', href: '/admin/settings', icon: SettingsIcon },
    ];

    // Filtra o menu pelos setores permitidos do usuário (admin/master veem tudo)
    const role = (user as any)?.role as string | undefined;
    const permissions = (user as any)?.permissions as string[] | undefined;
    const visibleNavigation = navigation.filter(item => canAccessRoute(role, permissions, item.href));

    // Guard: se acessar uma rota de setor não permitido (via URL direta),
    // redireciona para a primeira página visível.
    const dashboardAllowed = canAccessRoute(role, permissions, '/admin/dashboard');
    const fallbackRoute = dashboardAllowed
        ? '/admin/dashboard'
        : (visibleNavigation[0]?.href ?? '/admin/dashboard');

    useEffect(() => {
        if (!user) return;
        const path = location.pathname;
        if (!canAccessRoute(role, permissions, path)) {
            navigate(fallbackRoute, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname, role, JSON.stringify(permissions)]);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-white text-slate-900 flex transition-colors">
            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-50">
                <div className="flex items-center">
                    <img src={logoUrl} alt="SistemLog" className="h-8 object-contain" />
                </div>
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2">
                    {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Sidebar */}
                <aside className={`
                    fixed lg:sticky top-0 left-0 h-screen w-64 bg-white border-r border-slate-200 flex flex-col z-40
                    transition-transform duration-300 ease-in-out
                    ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}>
                    <div className="h-16 flex items-center px-6 border-b border-slate-200 lg:flex hidden">
                    <img src={logoUrl} alt="SistemLog" className="h-9 object-contain" />
                </div>

                <nav className="flex-1 overflow-y-auto w-full py-4 px-3 space-y-1 mt-16 lg:mt-0">
                    {visibleNavigation.map((item) => {
                        const isActive = location.pathname.startsWith(item.href);
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                onClick={() => setIsSidebarOpen(false)}
                                className={`
                                    flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all duration-200
                                    ${isActive
                                        ? 'bg-primary-50 text-primary-600'
                                        : 'text-slate-600 hover:bg-slate-100'}
                                `}
                            >
                                <Icon size={20} className={isActive ? "text-primary-500" : ""} />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-200">
                    <div className="flex items-center gap-3 mb-4 px-2">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-500 font-bold uppercase">
                            {user?.email?.charAt(0) || 'U'}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-bold truncate text-slate-900">{user?.email}</p>
                            <p className="text-xs text-slate-500 truncate">Administrador</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                        <LogOut size={20} />
                        Sair
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-w-0 overflow-y-auto mt-16 lg:mt-0">
                <SubscriptionGuard>
                    <div className="p-4 lg:p-8">
                        <Outlet />
                    </div>
                </SubscriptionGuard>
            </main>

            {/* Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}
        </div>
    );
}
