import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function Register() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        company_name: '',
        phone: '',
        fleet_size: '',
        password: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const companyId = crypto.randomUUID();

            const { data, error: signUpError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        nome: formData.full_name,
                        company_name: formData.company_name,
                        company_id: companyId,
                        role: 'admin',
                        phone: formData.phone,
                        fleet_size: formData.fleet_size
                    }
                }
            });

            if (signUpError) throw signUpError;

            // Supabase retorna identities vazio quando o e-mail já está cadastrado
            if (data?.user?.identities?.length === 0) {
                setError('Este e-mail já está cadastrado. Faça login ou use outro e-mail.');
                return;
            }

            setSuccess(true);
            setTimeout(() => navigate('/login'), 6000);

        } catch (err: any) {
            const msg = err?.message || '';
            if (msg.includes('already registered') || msg.includes('User already registered')) {
                setError('Este e-mail já está cadastrado. Faça login ou use outro e-mail.');
            } else if (msg.includes('Password should be at least')) {
                setError('A senha deve ter pelo menos 6 caracteres.');
            } else if (msg.includes('invalid')) {
                setError('E-mail inválido. Verifique e tente novamente.');
            } else {
                setError(msg || 'Erro ao cadastrar. Tente novamente.');
            }
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-background-dark flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white dark:bg-surface-dark p-8 rounded-3xl shadow-2xl text-center animate-in zoom-in duration-300">
                    <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 size={40} />
                    </div>
                    <h2 className="text-3xl font-bold mb-4 dark:text-white">Verifique seu E-mail!</h2>
                    <p className="text-slate-600 dark:text-slate-400 mb-2">
                        Enviamos um link de confirmação para:
                    </p>
                    <p className="font-bold text-primary mb-6">{formData.email}</p>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">
                        Clique no link do e-mail para ativar sua conta. Verifique também a pasta de spam.
                    </p>
                    <Link to="/login" className="btn-primary w-full py-3 inline-block">
                        Ir para Login
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-background-dark flex flex-col md:flex-row">
            {/* Esquerda: Branding/Info */}
            <div className="hidden md:flex md:w-1/2 bg-primary p-12 flex-col justify-between text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-600 to-secondary opacity-50"></div>
                <div className="relative z-10">
                    <div className="flex items-center mb-12">
                        <img src="/images/logo.png" alt="SistemLog" className="h-10 object-contain brightness-0 invert" />
                    </div>
                    <h1 className="text-5xl font-extrabold leading-tight mb-6">
                        Comece sua revolução <br /> logística hoje.
                    </h1>
                    <p className="text-xl text-primary-100 max-w-md">
                        7 dias de acesso total para transformar sua gestão de frotas e pneus.
                    </p>
                </div>

                <div className="relative z-10 space-y-6">
                    {[
                        'Relatórios em tempo real',
                        'App exclusivo para motoristas',
                        'Gestão 3D de Pneus',
                        'Acertos automatizados'
                    ].map((text, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <CheckCircle2 size={24} className="text-primary-300" />
                            <span className="font-medium text-lg">{text}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Direita: Formulário */}
            <div className="flex-1 flex items-center justify-center p-8 bg-white dark:bg-background-dark">
                <div className="max-w-md w-full">
                    <div className="md:hidden flex items-center mb-8">
                        <img src="/images/logo.png" alt="SistemLog" className="h-9 object-contain" />
                    </div>

                    <h2 className="text-3xl font-bold mb-2 dark:text-white">Crie sua Conta Grátis</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-8">
                        Preencha os dados abaixo para iniciar sua jornada.
                    </p>

                    {error && (
                        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl p-4 mb-6 text-sm">
                            <AlertCircle size={18} className="shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Nome Completo</label>
                            <input
                                required
                                type="text"
                                className="input-field"
                                placeholder="Seu nome"
                                value={formData.full_name}
                                onChange={e => { setError(''); setFormData({ ...formData, full_name: e.target.value }); }}
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase block mb-1">E-mail Corporativo</label>
                            <input
                                required
                                type="email"
                                className="input-field"
                                placeholder="email@suaempresa.com"
                                value={formData.email}
                                onChange={e => { setError(''); setFormData({ ...formData, email: e.target.value }); }}
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Senha</label>
                            <div className="relative">
                                <input
                                    required
                                    type={showPassword ? "text" : "password"}
                                    className="input-field pr-10"
                                    placeholder="Mínimo 6 caracteres"
                                    minLength={6}
                                    value={formData.password}
                                    onChange={e => { setError(''); setFormData({ ...formData, password: e.target.value }); }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Empresa</label>
                                <input
                                    required
                                    type="text"
                                    className="input-field"
                                    placeholder="Nome da empresa"
                                    value={formData.company_name}
                                    onChange={e => setFormData({ ...formData, company_name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase block mb-1">WhatsApp</label>
                                <input
                                    required
                                    type="tel"
                                    className="input-field"
                                    placeholder="(00) 00000-0000"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Tamanho da Frota</label>
                            <select
                                required
                                className="input-field"
                                value={formData.fleet_size}
                                onChange={e => setFormData({ ...formData, fleet_size: e.target.value })}
                            >
                                <option value="">Selecione...</option>
                                <option value="1-5">1 a 5 veículos</option>
                                <option value="6-20">6 a 20 veículos</option>
                                <option value="21-100">21 a 100 veículos</option>
                                <option value="100+">Mais de 100 veículos</option>
                            </select>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full btn-primary py-4 text-lg mt-6 shadow-xl shadow-primary/20 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" size={24} /> : (
                                <>
                                    Criar Conta e Acessar
                                    <ArrowRight size={20} />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
                        Já tem uma conta? <Link to="/login" className="text-primary font-bold hover:underline">Fazer login</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
