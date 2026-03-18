import { Link } from 'react-router-dom';
import { CheckCircle2, Truck, Wallet, Shield } from 'lucide-react';

export default function Welcome() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4 font-display">
            <div className="max-w-xl w-full bg-white dark:bg-slate-800 rounded-[2rem] shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="h-48 bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center relative">
                    <div className="absolute inset-0 bg-white/10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px] opacity-20"></div>
                    <div className="bg-white p-4 rounded-2xl shadow-lg relative z-10 animate-bounce">
                        <Truck size={48} className="text-primary-600" />
                    </div>
                </div>

                <div className="p-8 md:p-12 text-center space-y-6">
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Conta Ativada com Sucesso!</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-lg leading-relaxed">
                        Bem-vindo(a) ao SistemLog! O seu ambiente está pronto. Explore o sistema e configure sua frota para começar a operar.
                    </p>

                    <div className="space-y-4 text-left py-6">
                        <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-700">
                            <Wallet className="text-emerald-500 shrink-0 mt-1" />
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200">Painéis de Acerto Prontos</h3>
                                <p className="text-sm text-slate-500">Fluxos de pagamento comissionado já liberados.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-700">
                            <Shield className="text-blue-500 shrink-0 mt-1" />
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200">Suporte Prioritário</h3>
                                <p className="text-sm text-slate-500">Seu plano básico inclui tickets respondidos em até 2h.</p>
                            </div>
                        </div>
                    </div>

                    <Link to="/admin/dashboard" className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
                        <CheckCircle2 size={24} />
                        Acessar Meu Painel Administrativo
                    </Link>
                </div>
            </div>
        </div>
    )
}
