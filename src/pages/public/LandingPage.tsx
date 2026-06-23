import { Link } from 'react-router-dom';
import {
    Truck, BarChart3, ArrowRight, Zap, Globe, Cpu,
    Wrench, Fuel, DollarSign, Users, Shield, CheckCircle,
    Star, ChevronRight, TrendingUp, Clock, MessageCircle
} from 'lucide-react';

const KIWIFY_BASICO = 'https://pay.kiwify.com.br/Xo5neXV';
const KIWIFY_PRO = 'https://pay.kiwify.com.br/9f3rjhC';
const KIWIFY_ENTERPRISE = 'https://pay.kiwify.com.br/itrSZqN';

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-[#0B0F17] text-white flex flex-col font-display overflow-x-hidden">

            {/* Background Blobs */}
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1400px] h-[700px] bg-primary-600/8 blur-[140px] rounded-full pointer-events-none -z-10" />
            <div className="fixed bottom-0 right-0 w-[600px] h-[600px] bg-blue-800/5 blur-[120px] rounded-full pointer-events-none -z-10" />

            {/* ── Navigation ── */}
            <nav className="w-full fixed top-0 z-50 backdrop-blur-md border-b border-white/5 bg-[#0B0F17]/80">
                <div className="max-w-7xl mx-auto px-6 lg:px-12 flex justify-between h-20 items-center">
                    <div className="bg-white rounded-xl p-1.5">
                        <img src="/images/logo.png" alt="SistemLog" className="h-9 object-contain" />
                    </div>

                    <div className="hidden md:flex gap-10 items-center">
                        <a href="#features" className="text-sm font-bold text-slate-400 hover:text-white transition-colors">Funcionalidades</a>
                        <a href="#pricing" className="text-sm font-bold text-slate-400 hover:text-white transition-colors">Preços</a>
                        <a href="#testimonials" className="text-sm font-bold text-slate-400 hover:text-white transition-colors">Depoimentos</a>
                        <a href="#about" className="text-sm font-bold text-slate-400 hover:text-white transition-colors">Sobre Nós</a>
                    </div>

                    <div className="flex gap-4 items-center">
                        <Link to="/login" className="text-sm font-bold text-slate-400 hover:text-white transition-colors hidden sm:block">
                            Entrar
                        </Link>
                        <Link
                            to="/register"
                            className="bg-primary-600 hover:bg-primary-500 text-white px-5 py-2.5 rounded-xl text-sm font-black transition-all shadow-[0_10px_30px_-5px_rgba(37,99,235,0.4)] hover:scale-105"
                        >
                            Começar Grátis
                        </Link>
                    </div>
                </div>
            </nav>

            <main className="flex-1 pt-32">

                {/* ── Hero ── */}
                <section className="px-6 lg:px-12 max-w-7xl mx-auto text-center relative pb-24">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-900/40 border border-primary-500/30 text-primary-400 text-xs font-black uppercase tracking-widest mb-8">
                        <Zap size={12} />
                        Plataforma de Gestão Logística #1
                    </div>

                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter mb-6 leading-[1] max-w-5xl mx-auto">
                        Gerencie sua Frota com{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-blue-400 to-primary-200">
                            Inteligência Total
                        </span>
                    </h1>

                    <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 font-medium leading-relaxed">
                        Do controle de viagens ao acerto financeiro dos motoristas — tudo automatizado em uma única plataforma. Reduza custos, aumente a rentabilidade e tome decisões baseadas em dados reais.
                    </p>

                    <div className="flex flex-col sm:flex-row justify-center gap-4 mb-6">
                        <Link
                            to="/register"
                            className="bg-primary-600 hover:bg-primary-500 text-white text-lg px-10 py-4 rounded-2xl flex items-center justify-center gap-3 transition-all font-black shadow-[0_20px_50px_-10px_rgba(37,99,235,0.5)] group hover:-translate-y-0.5"
                        >
                            Testar Grátis por 7 Dias
                            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <a
                            href="https://wa.me/5563992815404?text=Olá, gostaria de agendar uma demonstração do SistemLog"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-white/5 hover:bg-white/10 border border-white/10 text-white text-lg px-10 py-4 rounded-2xl flex items-center justify-center gap-3 transition-all font-bold"
                        >
                            <MessageCircle size={20} />
                            Falar com Especialista
                        </a>
                    </div>
                    <p className="text-xs text-slate-600 font-bold">Sem cartão de crédito. Cancele quando quiser.</p>

                    {/* Dashboard Preview */}
                    <div className="relative mx-auto max-w-6xl mt-20">
                        <div className="absolute -inset-1 bg-gradient-to-r from-primary-500/30 to-blue-600/20 rounded-[2.5rem] blur-2xl pointer-events-none" />
                        <div className="bg-[#161B26]/80 p-2 rounded-[2rem] border border-white/10 shadow-2xl backdrop-blur-3xl overflow-hidden">
                            <div className="h-8 bg-[#0B0F17]/50 rounded-t-[1.5rem] border-b border-white/5 flex items-center px-6 gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                                <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
                                <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                                <div className="ml-4 text-[10px] font-bold text-slate-600">sistemlog.com.br/admin/dashboard</div>
                            </div>
                            <img
                                src="/images/hero-dashboard.png"
                                alt="SistemLog Dashboard"
                                className="w-full h-auto rounded-b-[1.5rem] opacity-90"
                            />
                        </div>
                    </div>
                </section>

                {/* ── Stats Bar ── */}
                <section className="py-20 border-y border-white/5 bg-white/[0.02]">
                    <div className="max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-2 md:grid-cols-4 gap-10 text-center">
                        {[
                            { value: '+200', label: 'Frotas Gerenciadas', icon: <Truck size={18} /> },
                            { value: '-32%', label: 'Redução de Custos', icon: <TrendingUp size={18} /> },
                            { value: '100%', label: 'Acerto Automatizado', icon: <CheckCircle size={18} /> },
                            { value: '7/7', label: 'Suporte Dedicado', icon: <Clock size={18} /> },
                        ].map((stat, i) => (
                            <div key={i} className="flex flex-col items-center gap-2">
                                <div className="text-primary-400 mb-1">{stat.icon}</div>
                                <div className="text-4xl md:text-5xl font-black text-white tracking-tight">{stat.value}</div>
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── Features ── */}
                <section id="features" className="py-32 px-6 lg:px-12">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center max-w-3xl mx-auto mb-20">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-900/20 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-widest mb-6">
                                <Zap size={12} />
                                Tudo que você precisa
                            </div>
                            <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-6">Controle total em um só lugar</h2>
                            <p className="text-xl text-slate-400 font-medium leading-relaxed">
                                Cada módulo foi projetado para eliminar retrabalho e dar visibilidade real sobre cada R$ da sua operação.
                            </p>
                        </div>

                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[
                                {
                                    icon: <BarChart3 size={28} className="text-primary-400" />,
                                    accent: 'bg-primary-500/10 border-primary-500/20',
                                    title: 'Dashboard em Tempo Real',
                                    desc: 'KPIs recalculados automaticamente: faturamento, despesas, margem e rentabilidade por veículo e por motorista.'
                                },
                                {
                                    icon: <Globe size={28} className="text-emerald-400" />,
                                    accent: 'bg-emerald-500/10 border-emerald-500/20',
                                    title: 'Gestão de Viagens',
                                    desc: 'Registre fretes com origem, destino, carga, pedágio e combustível. Calcule automaticamente o lucro de cada viagem.'
                                },
                                {
                                    icon: <DollarSign size={28} className="text-yellow-400" />,
                                    accent: 'bg-yellow-500/10 border-yellow-500/20',
                                    title: 'Acerto Financeiro',
                                    desc: 'Gere acertos de motoristas com um clique. Comissões, adiantamentos e descontos calculados sem planilha.'
                                },
                                {
                                    icon: <Fuel size={28} className="text-orange-400" />,
                                    accent: 'bg-orange-500/10 border-orange-500/20',
                                    title: 'Controle de Abastecimento',
                                    desc: 'Registre abastecimentos, monitore consumo médio (KM/L) e identifique desvios por veículo e motorista.'
                                },
                                {
                                    icon: <Wrench size={28} className="text-rose-400" />,
                                    accent: 'bg-rose-500/10 border-rose-500/20',
                                    title: 'Manutenção Preventiva',
                                    desc: 'Histórico completo de manutenções preventivas e corretivas, com alertas e custo total por veículo.'
                                },
                                {
                                    icon: <Cpu size={28} className="text-purple-400" />,
                                    accent: 'bg-purple-500/10 border-purple-500/20',
                                    title: 'Monitoramento de Pneus',
                                    desc: 'Visualize o estado de cada pneu da frota com alertas de desgaste e controle de sulco em tempo real.'
                                },
                            ].map((f, i) => (
                                <div key={i} className={`group p-8 rounded-3xl bg-[#161B26] border border-white/5 hover:border-white/10 transition-all hover:bg-[#1C2330]`}>
                                    <div className={`mb-6 w-14 h-14 rounded-2xl ${f.accent} border flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                                        {f.icon}
                                    </div>
                                    <h3 className="text-xl font-black mb-3">{f.title}</h3>
                                    <p className="text-slate-400 leading-relaxed text-sm font-medium">{f.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Product Screenshots ── */}
                <section className="py-32 px-6 lg:px-12 bg-white/[0.02] border-y border-white/5">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center max-w-3xl mx-auto mb-20">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-900/30 border border-primary-500/20 text-primary-400 text-xs font-black uppercase tracking-widest mb-6">
                                <BarChart3 size={12} />
                                Veja o Sistema em Ação
                            </div>
                            <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-6">Interface feita para quem trabalha de verdade</h2>
                            <p className="text-xl text-slate-400 font-medium leading-relaxed">
                                Cada tela foi desenhada para dar visibilidade máxima com o mínimo de cliques.
                            </p>
                        </div>

                        {/* Screenshot 1 — Dashboard */}
                        <div className="grid md:grid-cols-2 gap-12 items-center mb-24">
                            <div>
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-900/20 border border-primary-500/20 text-primary-400 text-xs font-black uppercase tracking-widest mb-5">
                                    <BarChart3 size={11} /> Dashboard Analítico
                                </div>
                                <h3 className="text-3xl md:text-4xl font-black tracking-tighter mb-5 leading-tight">
                                    Tudo que importa em um único painel
                                </h3>
                                <p className="text-slate-400 font-medium leading-relaxed mb-6">
                                    Receita, lucro líquido, custo por veículo, top motoristas e composição de custos — recalculados automaticamente a cada lançamento, sem precisar de planilha.
                                </p>
                                <ul className="space-y-3">
                                    {[
                                        'KPIs financeiros em tempo real',
                                        'Ranking de veículos por lucratividade',
                                        'Gráfico de composição de custos',
                                        'Alertas automáticos de desvios',
                                    ].map((item) => (
                                        <li key={item} className="flex items-center gap-3 text-sm text-slate-300 font-medium">
                                            <div className="w-5 h-5 rounded-full bg-primary-500/20 border border-primary-500/30 flex items-center justify-center flex-shrink-0">
                                                <CheckCircle size={12} className="text-primary-400" />
                                            </div>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="relative">
                                <div className="absolute -inset-2 bg-gradient-to-r from-primary-500/20 to-blue-600/10 rounded-[2rem] blur-2xl pointer-events-none" />
                                <div className="bg-[#161B26]/80 p-2 rounded-[1.5rem] border border-white/10 shadow-2xl backdrop-blur-sm overflow-hidden relative">
                                    <div className="h-7 bg-[#0B0F17]/50 rounded-t-[1rem] border-b border-white/5 flex items-center px-5 gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-[#FF5F57]" />
                                        <div className="w-2 h-2 rounded-full bg-[#FEBC2E]" />
                                        <div className="w-2 h-2 rounded-full bg-[#28C840]" />
                                        <div className="ml-3 text-[9px] font-bold text-slate-600">Dashboard</div>
                                    </div>
                                    <img
                                        src="/images/screenshot-dashboard.png"
                                        alt="Dashboard SistemLog"
                                        className="w-full h-auto rounded-b-[1rem] opacity-95"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Screenshot 2 — Pneus */}
                        <div className="grid md:grid-cols-2 gap-12 items-center">
                            <div className="order-2 md:order-1 relative">
                                <div className="absolute -inset-2 bg-gradient-to-r from-purple-500/15 to-cyan-600/10 rounded-[2rem] blur-2xl pointer-events-none" />
                                <div className="bg-[#161B26]/80 p-2 rounded-[1.5rem] border border-white/10 shadow-2xl backdrop-blur-sm overflow-hidden relative">
                                    <div className="h-7 bg-[#0B0F17]/50 rounded-t-[1rem] border-b border-white/5 flex items-center px-5 gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-[#FF5F57]" />
                                        <div className="w-2 h-2 rounded-full bg-[#FEBC2E]" />
                                        <div className="w-2 h-2 rounded-full bg-[#28C840]" />
                                        <div className="ml-3 text-[9px] font-bold text-slate-600">Gestão de Pneus</div>
                                    </div>
                                    <img
                                        src="/images/screenshot-tires.png"
                                        alt="Gestão Técnica de Pneus SistemLog"
                                        className="w-full h-auto rounded-b-[1rem] opacity-95"
                                    />
                                </div>
                            </div>
                            <div className="order-1 md:order-2">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-900/20 border border-purple-500/20 text-purple-400 text-xs font-black uppercase tracking-widest mb-5">
                                    <Cpu size={11} /> Inspeção 3D de Pneus
                                </div>
                                <h3 className="text-3xl md:text-4xl font-black tracking-tighter mb-5 leading-tight">
                                    Monitoramento técnico que nenhum concorrente tem
                                </h3>
                                <p className="text-slate-400 font-medium leading-relaxed mb-6">
                                    Visualize o estado de cada pneu da frota em uma inspeção visual 3D. Identifique pneus críticos antes que virem uma parada de estrada.
                                </p>
                                <ul className="space-y-3">
                                    {[
                                        'Mapa visual 3D posição a posição',
                                        'Alerta vermelho, amarelo e verde por sulco',
                                        'Histórico de trocas e vida útil estimada',
                                        'Controle de marca, número de série e km',
                                    ].map((item) => (
                                        <li key={item} className="flex items-center gap-3 text-sm text-slate-300 font-medium">
                                            <div className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                                                <CheckCircle size={12} className="text-purple-400" />
                                            </div>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── Why SistemLog ── */}
                <section className="py-20 px-6 lg:px-12 bg-white/[0.02] border-y border-white/5">
                    <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
                        <div>
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-900/30 border border-primary-500/20 text-primary-400 text-xs font-black uppercase tracking-widest mb-6">
                                <Shield size={12} />
                                Por que o SistemLog?
                            </div>
                            <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-8 leading-tight">
                                Pare de perder dinheiro com processos manuais
                            </h2>
                            <div className="space-y-5">
                                {[
                                    'Elimine planilhas e WhatsApp para controle de viagens',
                                    'Saiba exatamente quanto cada motorista custou no mês',
                                    'Identifique quais veículos dão prejuízo antes que seja tarde',
                                    'Acesse tudo do celular, em qualquer lugar',
                                    'Dados seguros com criptografia e backup automático',
                                ].map((item, i) => (
                                    <div key={i} className="flex items-start gap-4">
                                        <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <CheckCircle size={14} className="text-emerald-400" />
                                        </div>
                                        <p className="text-slate-300 font-medium">{item}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { label: 'Receita Controlada', value: 'R$ 1.2M+', sub: 'em fretes gerenciados', color: 'text-primary-400' },
                                { label: 'Economia Média', value: '32%', sub: 'em custos operacionais', color: 'text-emerald-400' },
                                { label: 'Veículos Ativos', value: '1.400+', sub: 'monitorados na plataforma', color: 'text-orange-400' },
                                { label: 'Satisfação', value: '98%', sub: 'dos clientes recomendam', color: 'text-purple-400' },
                            ].map((item, i) => (
                                <div key={i} className="bg-[#161B26] border border-white/5 rounded-3xl p-6">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{item.label}</p>
                                    <p className={`text-3xl font-black ${item.color}`}>{item.value}</p>
                                    <p className="text-xs text-slate-600 font-bold mt-1">{item.sub}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Testimonials ── */}
                <section id="testimonials" className="py-32 px-6 lg:px-12">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center max-w-2xl mx-auto mb-16">
                            <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-4">O que nossos clientes dizem</h2>
                            <p className="text-slate-400 text-lg font-medium">Transportadoras de todo o Brasil já transformaram sua gestão com o SistemLog.</p>
                        </div>

                        <div className="grid md:grid-cols-3 gap-6">
                            {[
                                {
                                    name: 'Carlos Mendes',
                                    role: 'Dono de Transportadora • SP',
                                    text: 'Antes eu controlava tudo no WhatsApp e Excel. Hoje sei exatamente o que cada caminhão gera de lucro. Economizei quase R$4.000 só no primeiro mês.',
                                    stars: 5,
                                },
                                {
                                    name: 'Fernanda Costa',
                                    role: 'Gestora de Frota • MG',
                                    text: 'O acerto automático dos motoristas mudou minha vida. O que levava 2 dias agora faço em 10 minutos. O suporte é excelente e resolve tudo rápido.',
                                    stars: 5,
                                },
                                {
                                    name: 'Ricardo Alves',
                                    role: 'Transportador Autônomo • GO',
                                    text: 'Sistema completo, fácil de usar e barato comparado ao retorno. Consigo ver tudo pelo celular, até de estrada. Recomendo para qualquer transportador.',
                                    stars: 5,
                                },
                            ].map((t, i) => (
                                <div key={i} className="bg-[#161B26] border border-white/5 rounded-3xl p-8 flex flex-col gap-6">
                                    <div className="flex gap-1">
                                        {Array.from({ length: t.stars }).map((_, j) => (
                                            <Star key={j} size={14} className="text-yellow-400 fill-yellow-400" />
                                        ))}
                                    </div>
                                    <p className="text-slate-300 leading-relaxed font-medium flex-1">"{t.text}"</p>
                                    <div>
                                        <p className="font-black text-white text-sm">{t.name}</p>
                                        <p className="text-xs text-slate-500 font-bold mt-0.5">{t.role}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Pricing ── */}
                <section id="pricing" className="py-32 px-6 lg:px-12 bg-white/[0.02] border-y border-white/5">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center max-w-2xl mx-auto mb-16">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-900/30 border border-primary-500/20 text-primary-400 text-xs font-black uppercase tracking-widest mb-6">
                                <DollarSign size={12} />
                                Planos e Preços
                            </div>
                            <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-4">Simples e sem surpresas</h2>
                            <p className="text-slate-400 text-lg font-medium">Escolha o plano que cabe no tamanho da sua operação.</p>
                        </div>

                        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                            {/* Start */}
                            <div className="bg-[#161B26] border border-white/5 rounded-3xl p-8 flex flex-col">
                                <div className="mb-8">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Truck size={18} className="text-slate-400" />
                                        <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Start</span>
                                    </div>
                                    <div className="flex items-end gap-1 mb-2">
                                        <span className="text-slate-400 text-lg font-bold">R$</span>
                                        <span className="text-5xl font-black text-white tracking-tight">197</span>
                                        <span className="text-slate-500 font-bold mb-1">/mês</span>
                                    </div>
                                    <p className="text-sm text-slate-500 font-bold">Até 5 veículos</p>
                                </div>
                                <ul className="space-y-3 mb-10 flex-1">
                                    {['Todos os módulos', 'Dashboard analítico', 'Gestão de viagens', 'Acerto financeiro', 'Suporte por e-mail'].map((item) => (
                                        <li key={item} className="flex items-center gap-3 text-sm text-slate-400 font-medium">
                                            <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                                <a
                                    href={KIWIFY_BASICO}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-black text-center transition-all flex items-center justify-center gap-2 group"
                                >
                                    Assinar Start
                                    <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                                </a>
                            </div>

                            {/* Pro — destaque */}
                            <div className="bg-primary-600 border border-primary-500/50 rounded-3xl p-8 flex flex-col relative overflow-hidden shadow-[0_30px_60px_-10px_rgba(37,99,235,0.4)]">
                                <div className="absolute top-0 right-0 bg-yellow-400 text-[#0B0F17] text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-2xl rounded-tr-3xl">
                                    Mais Popular
                                </div>
                                <div className="mb-8">
                                    <div className="flex items-center gap-2 mb-4">
                                        <TrendingUp size={18} className="text-primary-200" />
                                        <span className="text-sm font-black text-primary-200 uppercase tracking-widest">Pro</span>
                                    </div>
                                    <div className="flex items-end gap-1 mb-2">
                                        <span className="text-primary-200 text-lg font-bold">R$</span>
                                        <span className="text-5xl font-black text-white tracking-tight">297</span>
                                        <span className="text-primary-200 font-bold mb-1">/mês</span>
                                    </div>
                                    <p className="text-sm text-primary-200 font-bold">Até 10 veículos</p>
                                </div>
                                <ul className="space-y-3 mb-10 flex-1">
                                    {['Tudo do Start', 'Relatórios avançados', 'Controle de pneus', 'Abastecimento detalhado', 'Suporte prioritário por WhatsApp', 'Múltiplos usuários'].map((item) => (
                                        <li key={item} className="flex items-center gap-3 text-sm text-primary-100 font-medium">
                                            <CheckCircle size={14} className="text-white flex-shrink-0" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                                <a
                                    href={KIWIFY_PRO}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-3.5 rounded-2xl bg-white text-primary-700 text-sm font-black text-center transition-all hover:bg-primary-50 flex items-center justify-center gap-2 group"
                                >
                                    Assinar Pro
                                    <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                                </a>
                            </div>

                            {/* Enterprise */}
                            <div className="bg-[#161B26] border border-white/5 rounded-3xl p-8 flex flex-col">
                                <div className="mb-8">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Users size={18} className="text-purple-400" />
                                        <span className="text-sm font-black text-purple-400 uppercase tracking-widest">Enterprise</span>
                                    </div>
                                    <div className="flex items-end gap-1 mb-2">
                                        <span className="text-slate-400 text-lg font-bold">R$</span>
                                        <span className="text-5xl font-black text-white tracking-tight">397</span>
                                        <span className="text-slate-500 font-bold mb-1">/mês</span>
                                    </div>
                                    <p className="text-sm text-slate-500 font-bold">Veículos ilimitados</p>
                                </div>
                                <ul className="space-y-3 mb-10 flex-1">
                                    {['Tudo do Pro', 'Veículos ilimitados', 'API de integração', 'Onboarding dedicado', 'SLA garantido', 'Personalização de marca'].map((item) => (
                                        <li key={item} className="flex items-center gap-3 text-sm text-slate-400 font-medium">
                                            <CheckCircle size={14} className="text-purple-400 flex-shrink-0" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                                <a
                                    href={KIWIFY_ENTERPRISE}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-black text-center transition-all flex items-center justify-center gap-2 group"
                                >
                                    Assinar Enterprise
                                    <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                                </a>
                            </div>
                        </div>

                        <p className="text-center text-sm text-slate-600 font-bold mt-8">
                            Todos os planos incluem 7 dias grátis. Cancele sem burocracia.
                        </p>
                    </div>
                </section>

                {/* ── About ── */}
                <section id="about" className="py-32 px-6 lg:px-12">
                    <div className="max-w-4xl mx-auto text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-slate-400 text-xs font-black uppercase tracking-widest mb-8">
                            <Shield size={12} />
                            Nossa Missão
                        </div>
                        <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-8 leading-tight">
                            Feito por quem entende de logística
                        </h2>
                        <p className="text-xl text-slate-400 font-medium leading-relaxed mb-6">
                            O SistemLog nasceu da frustração real de quem tentou gerenciar frota com planilha e não aguentou mais. Nossa plataforma foi construída do zero para o transportador brasileiro, com cada funcionalidade validada na operação real.
                        </p>
                        <p className="text-lg text-slate-500 font-medium leading-relaxed">
                            Segurança de dados bancária, interface pensada para quem está na estrada e suporte humano que realmente resolve — isso é o SistemLog.
                        </p>
                    </div>
                </section>

                {/* ── Final CTA ── */}
                <section className="py-24 px-6 lg:px-12">
                    <div className="max-w-4xl mx-auto">
                        <div className="relative rounded-[2.5rem] bg-gradient-to-br from-primary-600 to-blue-700 p-12 md:p-16 text-center overflow-hidden">
                            <div className="absolute inset-0 bg-[url('/images/grid.svg')] opacity-10 pointer-events-none" />
                            <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />

                            <h2 className="text-3xl md:text-5xl font-black tracking-tighter mb-6 relative">
                                Pronto para transformar sua operação?
                            </h2>
                            <p className="text-primary-200 text-lg font-medium mb-10 max-w-xl mx-auto relative">
                                Comece hoje com 7 dias grátis. Sem compromisso, sem cartão de crédito.
                            </p>
                            <div className="flex flex-col sm:flex-row justify-center gap-4 relative">
                                <Link
                                    to="/register"
                                    className="bg-white text-primary-700 text-lg px-10 py-4 rounded-2xl font-black transition-all hover:bg-primary-50 hover:-translate-y-0.5 shadow-xl flex items-center justify-center gap-2 group"
                                >
                                    Começar Agora — É Grátis
                                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                </Link>
                                <a
                                    href="https://wa.me/5563992815404?text=Olá, gostaria de uma demonstração do SistemLog"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-lg px-10 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
                                >
                                    <MessageCircle size={20} />
                                    Falar no WhatsApp
                                </a>
                            </div>
                        </div>
                    </div>
                </section>

            </main>

            {/* ── Footer ── */}
            <footer className="bg-[#080C13] border-t border-white/5 py-16 px-6 lg:px-12">
                <div className="max-w-7xl mx-auto">
                    <div className="grid md:grid-cols-4 gap-10 mb-12">
                        <div className="md:col-span-2">
                            <div className="bg-white rounded-xl p-1.5 w-fit mb-4">
                                <img src="/images/logo.png" alt="SistemLog" className="h-9 object-contain" />
                            </div>
                            <p className="text-slate-500 text-sm font-medium max-w-xs leading-relaxed">
                                A plataforma de gestão logística que o transportador brasileiro merecia ter.
                            </p>
                        </div>
                        <div>
                            <p className="text-white font-black text-sm mb-4 uppercase tracking-widest">Produto</p>
                            <ul className="space-y-3">
                                {['Funcionalidades', 'Preços', 'Depoimentos', 'Sobre Nós'].map((item) => (
                                    <li key={item}>
                                        <a href={`#${item.toLowerCase().replace(' ', '-')}`} className="text-slate-500 hover:text-white text-sm font-bold transition-colors">{item}</a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <p className="text-white font-black text-sm mb-4 uppercase tracking-widest">Legal</p>
                            <ul className="space-y-3">
                                {['Termos de Uso', 'Política de Privacidade', 'Cookies'].map((item) => (
                                    <li key={item}>
                                        <a href="#" className="text-slate-500 hover:text-white text-sm font-bold transition-colors">{item}</a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                    <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-slate-600 text-sm font-bold">&copy; {new Date().getFullYear()} SistemLog. Todos os direitos reservados.</p>
                        <Link to="/login" className="text-sm font-bold text-slate-500 hover:text-white transition-colors flex items-center gap-1.5">
                            Acessar plataforma <ArrowRight size={14} />
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
