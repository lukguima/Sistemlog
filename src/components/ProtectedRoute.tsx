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

    // Área Master: SOMENTE role master (não basta estar logado)
    if (requiredRole === 'master') {
        if (role !== 'master') {
            return <Navigate to="/" replace />;
        }
        return <Outlet />;
    }

    // Master autenticado pode entrar nas demais áreas protegidas
    if (role === 'master') {
        return <Outlet />;
    }

    // Admin logístico + funcionários por setor (filtro fino no AdminLayout)
    const allowed = requiredRole === 'admin'
        ? ['admin', 'manager', 'operator']
        : requiredRole ? [requiredRole] : null;

    if (allowed && !allowed.includes(role ?? '')) {
        if (role === 'driver') {
            return <Navigate to="/driver/home" replace />;
        }
        if (role === 'frentista') {
            return <Navigate to="/posto" replace />;
        }
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
}
