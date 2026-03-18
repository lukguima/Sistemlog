import { Search, LifeBuoy, FileText, ExternalLink, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function HelpCenter() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-background-dark font-display relative overflow-hidden">

            {/* Header Background */}
            <div className="absolute top-0 left-0 right-0 h-96 bg-primary-900 overflow-hidden">
                <div className="absolute inset-0 bg-white/5 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px] opacity-10"></div>
            </div>

            <div className="relative z-10 max-w-5xl mx-auto px-6 pt-24 pb-12">
                <div className="text-center mb-12">
                    <Link to="/admin/dashboard" className="inline-flex items-center gap-2 text-primary-300 hover:text-white transition-colors text-sm font-bold mb-8">
                        Voltar ao Dashboard <ArrowRight size={16} />
                    </Link>
                    <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-4">Central de Ajuda</h1>
                    <p className="text-xl text-primary-200 font-medium">Como podemos ajudar sua transportadora hoje?</p>
                </div>

                {/* Global Search (Bloco B) */}
                <div className="max-w-2xl mx-auto relative mb-20 shadow-2xl">
                    <Search size={24} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Digite sua dúvida (Ex: Como cadastrar motorista...)"
                        className="w-full pl-16 pr-6 py-5 rounded-2xl text-lg font-medium border-0 focus:ring-4 focus:ring-primary-500/30 text-slate-900 shadow-xl"
                    />
                    <button className="absolute right-3 top-1/2 -translate-y-1/2 bg-primary text-white px-6 py-2.5 rounded-xl font-bold hover:bg-primary-600 transition-colors">
                        Buscar
                    </button>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Card 1 */}
                    <div className="card p-8 hover:-translate-y-1 transition-transform cursor-pointer group">
                        <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center mb-6 pt-1">
                            <FileText size={28} />
                        </div>
                        <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">Primeiros Passos</h3>
                        <ul className="text-sm text-slate-500 space-y-3">
                            <li className="flex items-center gap-2 hover:text-slate-800 dark:hover:text-slate-300"> <ExternalLink size={14} /> Como criar conta para motoristas</li>
                            <li className="flex items-center gap-2 hover:text-slate-800 dark:hover:text-slate-300"> <ExternalLink size={14} /> Configurando sua Logo (White Label)</li>
                            <li className="flex items-center gap-2 hover:text-slate-800 dark:hover:text-slate-300"> <ExternalLink size={14} /> Primeiros registros de pneus</li>
                        </ul>
                    </div>

                    {/* Card 2 */}
                    <div className="card p-8 hover:-translate-y-1 transition-transform cursor-pointer group">
                        <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center mb-6 pt-1">
                            <LifeBuoy size={28} />
                        </div>
                        <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">Dúvidas Frequentes</h3>
                        <ul className="text-sm text-slate-500 space-y-3">
                            <li className="flex items-center gap-2 hover:text-slate-800 dark:hover:text-slate-300"> <ExternalLink size={14} /> Como o Acerto Financeiro calcula impostos?</li>
                            <li className="flex items-center gap-2 hover:text-slate-800 dark:hover:text-slate-300"> <ExternalLink size={14} /> O odômetro do motorista não bate</li>
                            <li className="flex items-center gap-2 hover:text-slate-800 dark:hover:text-slate-300"> <ExternalLink size={14} /> Alertas de TWI do Pneu (Guia)</li>
                        </ul>
                    </div>

                    {/* Contact Support */}
                    <div className="card p-8 bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0 shadow-xl flex flex-col justify-between">
                        <div>
                            <h3 className="text-2xl font-black mb-2">Não encontrou?</h3>
                            <p className="text-slate-400 text-sm mb-6">Abra um ticket ou acione nosso suporte via WhatsApp. Plano Básico: SLA de 2h.</p>
                        </div>

                        <button className="bg-white text-slate-900 font-bold py-3 rounded-xl w-full hover:bg-slate-100 transition-colors">
                            Abrir Ticket Suporte
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
