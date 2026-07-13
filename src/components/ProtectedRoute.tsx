import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
    /** Role exigida para acessar. Se omitido, só verifica autenticação. */
    requiredRole?: 'admin' | 'master' | 'driver' | 'frentista';
}

/**
 * Guard de rota: redireciona para /login se não autenticado,
 * ou para / se o role não corresponder.
 */
export default function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
    const { user, loading } = useAuth();

    // Aguarda carregamento do contexto de auth
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
                <div className="w-10 h-10 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin" />
            </div>
        );
    }

    // Não autenticado → login
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    const role = (user as any)?.role as string | undefined;

    // Master tem acesso a tudo
    if (role === 'master') {
        return <Outlet />;
    }

    // A área administrativa aceita admin e também os funcionários por setor
    // (manager/operator) — o controle fino por setor é feito dentro do AdminLayout.
    const allowed = requiredRole === 'admin'
        ? ['admin', 'manager', 'operator']
        : requiredRole ? [requiredRole] : null;

    if (allowed && !allowed.includes(role ?? '')) {
        // Driver tentando acessar admin → redireciona para área do motorista
        if (role === 'driver') {
            return <Navigate to="/driver/home" replace />;
        }
        // Frentista só acessa o módulo do posto
        if (role === 'frentista') {
            return <Navigate to="/posto" replace />;
        }
        // Qualquer outro caso → página inicial
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
}
