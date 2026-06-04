import {
    Users,
    Activity,
    ExternalLink,
    MoreVertical,
    TrendingUp,
    Shield,
    Smartphone,
    Search,
    Filter,
    Plus,
    Calendar,
    ArrowUpRight,
    ArrowDownRight
} from 'lucide-react';

export default function MasterDashboard() {
    const stats = [
        { label: 'Total de Clientes', value: '142', trend: '+12', positive: true, icon: <Users size={20} /> },
        { label: 'MRR (Mensal)', value: 'R$ 84.500', trend: '+8.4%', positive: true, icon: <TrendingUp size={20} /> },
        { label: 'Assinaturas Ativas', value: '128', trend: '90.1%', positive: true, icon: <Activity size={20} /> },
        { label: 'Acessos Mobile', value: '1.240', trend: '+24%', positive: true, icon: <Smartphone size={20} /> },
    ];

    const customers = [
        { name: 'TransTransportes Ltda', owner: 'Carlos Eduardo', plan: 'Enterprise', status: 'Ativo', renewal: '12/10/2024', revenue: 'R$ 4.500' },
        { name: 'LogiExpress Brasil', owner: 'Amanda Silveira', plan: 'Pro', status: 'Ativo', renewal: '15/10/2024', revenue: 'R$ 2.200' },
        { name: 'Rapidão Transportes', owner: 'Marcos Paulo', plan: 'Basic', status: 'Teste', renewal: '20/09/2024', revenue: 'R$ 0' },
        { name: 'Frota Global S.A', owner: 'Roberto Justos', plan: 'Enterprise', status: 'Vencido', renewal: '05/09/2024', revenue: 'R$ 8.900' },
        { name: 'EcoLogistics', owner: 'Fernanda Lima', plan: 'Pro', status: 'Ativo', renewal: '28/10/2024', revenue: 'R$ 2.200' },
    ];

    return (
        <div className="w-full text-white space-y-8 font-display">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <Shield className="text-primary-500" size={32} />
                        Painel Master <span className="text-slate-500 font-medium">| Gestão SaaS</span>
                    </h1>
                    <p className="text-slate-400 mt-1">Visão geral do ecossistema LogiProfit, assinaturas e saúde da plataforma.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button className="bg-white/5 hover:bg-white/10 text-white px-5 py-2.5 rounded-xl font-bold border border-white/5 transition-all text-sm">
                        Exportar Logs
                    </button>
                    <button className="bg-primary-600 hover:bg-primary-500 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-[0_10px_20px_-5px_rgba(37,99,235,0.4)] text-sm">
                        <Plus size={18} />
                        Novo Cliente
                    </button>
                </div>
            </div>

            {/* KPI Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                    <div key={i} className="bg-[#161B26] p-6 rounded-[2rem] border border-white/5 relative overflow-hidden group">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-10 h-10 bg-primary-500/10 rounded-xl flex items-center justify-center text-primary-500">
                                {stat.icon}
                            </div>
                            <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${stat.positive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                {stat.positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                {stat.trend}
                            </div>
                        </div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
                        <h3 className="text-2xl font-black text-white">{stat.value}</h3>

                        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-primary-600/5 blur-3xl rounded-full group-hover:bg-primary-600/10 transition-all"></div>
                    </div>
                ))}
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

                {/* Customers Table */}
                <div className="xl:col-span-2 bg-[#161B26] rounded-[2.5rem] border border-white/5 overflow-hidden">
                    <div className="p-8 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <h3 className="text-xl font-black text-white">Gestão de Empresas Clientes</h3>
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                <input
                                    type="text"
                                    placeholder="Buscar empresa..."
                                    className="bg-[#0B0F17] border border-white/5 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-primary-500 transition-all"
                                />
                            </div>
                            <button className="bg-white/5 text-slate-400 p-2 rounded-xl border border-white/5">
                                <Filter size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-white/2">
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Empresa / Owner</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Plano</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Status</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Receita</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Renovação</th>
                                    <th className="px-8 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {customers.map((c, i) => (
                                    <tr key={i} className="hover:bg-white/2 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="font-black text-white flex items-center gap-2">
                                                    {c.name}
                                                    <ExternalLink size={12} className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" />
                                                </span>
                                                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{c.owner}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter ${c.plan === 'Enterprise' ? 'bg-primary-500/10 text-primary-400' :
                                                c.plan === 'Pro' ? 'bg-indigo-500/10 text-indigo-400' :
                                                    'bg-slate-500/10 text-slate-400'
                                                }`}>
                                                {c.plan}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${c.status === 'Ativo' ? 'bg-emerald-500' :
                                                    c.status === 'Teste' ? 'bg-sky-500' :
                                                        'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                                                    }`}></div>
                                                <span className="text-xs font-bold text-white">{c.status}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 font-black text-white">{c.revenue}</td>
                                        <td className="px-8 py-6 font-bold text-slate-400 text-sm">{c.renewal}</td>
                                        <td className="px-8 py-6 text-right">
                                            <button className="p-2 text-slate-600 hover:text-white transition-colors">
                                                <MoreVertical size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right Sidebar: Quick Actions & Log */}
                <div className="space-y-8">
                    {/* Platform Health */}
                    <div className="bg-[#161B26] p-8 rounded-[2.5rem] border border-white/5">
                        <h4 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] mb-6">Saúde do Sistema</h4>
                        <div className="space-y-6">
                            {[
                                { label: 'Servidores API', status: 'Online', uptime: '99.99%', color: 'bg-emerald-500' },
                                { label: 'Banco de Dados', status: 'Online', uptime: '100%', color: 'bg-emerald-500' },
                                { label: 'Serviço de Imagens', status: 'Warning', uptime: '98.5%', color: 'bg-amber-500' },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-white text-sm">{item.label}</p>
                                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{item.uptime} Uptime</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-400">{item.status}</span>
                                        <div className={`w-2 h-2 rounded-full ${item.color}`}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Subscription Activity */}
                    <div className="bg-[#161B26] p-8 rounded-[2.5rem] border border-white/5">
                        <h4 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] mb-6 flex items-center justify-between">
                            Atividade Recente
                            <Calendar size={14} className="text-primary-500" />
                        </h4>
                        <div className="relative border-l border-white/5 ml-2 pl-6 space-y-8">
                            {[
                                { user: 'Carlos E.', action: 'Nova Assinatura', time: 'Há 5 min', detail: 'Plano Enterprise' },
                                { user: 'Amanda S.', action: 'Upgrade de Plano', time: 'Há 2h', detail: 'Basic -> Pro' },
                                { user: 'System', action: 'Renovação Falhou', time: 'Há 4h', detail: 'Frota Global S.A' },
                            ].map((log, i) => (
                                <div key={i} className="relative">
                                    <div className="absolute -left-[31px] top-1 w-2.5 h-2.5 bg-[#161B26] border-2 border-primary-500 rounded-full"></div>
                                    <p className="text-xs text-white">
                                        <span className="font-black">{log.user}</span> • {log.action}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{log.time} - {log.detail}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quick Settings */}
                    <div className="bg-gradient-to-br from-primary-600 to-primary-800 p-8 rounded-[2.5rem] text-white">
                        <h4 className="font-black text-lg mb-2 italic">Dica do Sistema</h4>
                        <p className="text-primary-100 text-sm font-medium leading-relaxed">
                            3 empresas estão com faturas vencidas há mais de 5 dias. Deseja enviar um alerta automático de cobrança?
                        </p>
                        <button className="mt-6 w-full bg-white text-primary-700 font-black py-3 rounded-xl hover:bg-primary-50 transition-colors shadow-lg">
                            Enviar Alertas
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

