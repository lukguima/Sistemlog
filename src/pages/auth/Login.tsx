import { useState, useEffect } from 'react';
import { ArrowRight, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

function roleHome(role?: string) {
    if (role === 'master') return '/saas-master';
    if (role === 'driver') return '/driver/home';
    return '/admin/dashboard';
}

export default function Login() {
    const navigate = useNavigate();
    const { login, user, loading: authLoading } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Redireciona usuário já autenticado para a área correta
    useEffect(() => {
        if (!authLoading && user) {
            navigate(roleHome((user as any)?.role), { replace: true });
        }
    }, [user, authLoading, navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { error } = await login(email, password);
            if (error) throw error;
            // Redirecionamento via useEffect acima após user ser atualizado
        } catch (err: any) {
            setError(err.message === 'Invalid login credentials'
                ? 'E-mail ou senha incorretos.'
                : 'Erro ao fazer login. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen font-display bg-[#0B0F17] text-white">
            {/* Header / Top Navigation (Absolute) */}
            <div className="absolute top-0 left-0 right-0 z-50 p-6 flex justify-between items-center pointer-events-none">
                <div className="flex items-center pointer-events-auto">
                    <div className="bg-white rounded-xl p-1.5">
                        <img src="/images/logo.png" alt="SistemLog" className="h-9 object-contain" />
                    </div>
                </div>
                <div className="flex items-center gap-6 pointer-events-auto">
                    <Link to="/" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Voltar para Home</Link>
                </div>
            </div>

            {/* Left Side: Visual Experience */}
            <div className="hidden lg:flex w-[55%] p-12 flex-col justify-end relative overflow-hidden">
                {/* Background Image with Overlay */}
                <div className="absolute inset-0 z-0">
                    <img
                        src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80"
                        alt="Logistics Warehouse"
                        className="w-full h-full object-cover opacity-50"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-[#0B0F17]/40 to-transparent"></div>
                </div>

                {/* Content */}
                <div className="relative z-10 max-w-2xl mb-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                    <h1 className="text-6xl font-black leading-[1.1] mb-6 tracking-tight">
                        Impulsione sua Cadeia de <span className="text-primary-500 italic">Suprimentos</span>
                    </h1>
                    <p className="text-xl text-slate-300 leading-relaxed max-w-xl">
                        Acesse a plataforma mais avançada para gestão de fretes, rastreamento em tempo real e análise preditiva de demanda.
                    </p>
                </div>
            </div>

            {/* Right Side: Login Form */}
            <div className="w-full lg:w-[45%] flex items-center justify-center p-8 sm:p-16 relative">
                <div className="w-full max-w-md space-y-10">
                    <div className="space-y-4">
                        <h2 className="text-4xl font-black tracking-tight">Bem-vindo de volta</h2>
                        <p className="text-slate-400 text-lg">Insira suas credenciais para acessar o painel administrativo.</p>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm font-bold animate-in fade-in">
                            {error}
                        </div>
                    )}

                    <form className="space-y-8" onSubmit={handleLogin}>
                        <div className="space-y-6">
                            <div className="group">
                                <label className="block text-sm font-bold text-slate-400 group-focus-within:text-primary-500 transition-colors mb-3 uppercase tracking-wider">
                                    E-mail Corporativo
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary-500 transition-colors" size={20} />
                                    <input
                                        type="email"
                                        required
                                        className="w-full bg-[#161B26] border border-slate-800 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder-slate-600 transition-all outline-none"
                                        placeholder="exemplo@empresa.com.br"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="group">
                                <div className="flex justify-between items-center mb-3">
                                    <label className="block text-sm font-bold text-slate-400 group-focus-within:text-primary-500 transition-colors uppercase tracking-wider">
                                        Senha
                                    </label>
                                    <a href="#" className="text-xs font-bold text-primary-500 hover:text-primary-400 uppercase tracking-widest">Esqueceu a senha?</a>
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary-500 transition-colors" size={20} />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        className="w-full bg-[#161B26] border border-slate-800 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 rounded-xl py-4 pl-12 pr-12 text-white placeholder-slate-600 transition-all outline-none"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-primary-600 hover:bg-primary-500 text-white w-full py-4 rounded-xl text-lg font-black flex justify-center items-center gap-3 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-[0_10px_40px_-10px_rgba(37,99,235,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="animate-spin" size={24} /> : (
                                <>
                                    Acessar Portal
                                    <ArrowRight size={22} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="pt-8 border-t border-slate-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <p className="text-sm text-slate-500">
                            Ainda não tem conta corporativa? <Link to="/register" className="font-bold text-primary-500 hover:text-primary-400">Cadastrar Empresa</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
