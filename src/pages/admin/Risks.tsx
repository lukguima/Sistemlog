import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { aiInsightService, aiChatService, type AiInsight, type AnalysisData, type ProjecaoAnual } from '../../lib/ai.services';
import { ShieldAlert, CheckCircle2, AlertTriangle, XCircle, Info, Trash2, Eye, RefreshCw, X, Sparkles, TrendingDown, TrendingUp, Minus, BarChart2 } from 'lucide-react';

const SEVERITY_MAP = {
    critical: { label: 'Crítico', icon: XCircle, bg: 'bg-rose-50', border: 'border-rose-200', badge: 'bg-rose-100 text-rose-700', icon_color: 'text-rose-500' },
    warning:  { label: 'Atenção', icon: AlertTriangle, bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', icon_color: 'text-amber-500' },
    info:     { label: 'Info', icon: Info, bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', icon_color: 'text-blue-500' },
    success:  { label: 'Positivo', icon: CheckCircle2, bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', icon_color: 'text-emerald-500' },
};

const TYPE_LABELS: Record<string, string> = {
    financeiro: 'Financeiro', frota: 'Frota', cliente: 'Cliente',
    risco: 'Risco', oportunidade: 'Oportunidade',
};

const STATUS_COLORS = {
    ok:      { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: TrendingUp },
    atencao: { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   icon: Minus },
    critico: { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',     icon: TrendingDown },
    info:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',     icon: Info },
};

const RISK_PROMPTS = [
    'analise_financeira',
    'analise_frota',
    'analise_recebimentos',
    'analise_financiamentos',
];

// ── Projeção Anual ────────────────────────────────────────────────────────────

function ProjecaoAnualCard({ proj }: { proj: ProjecaoAnual }) {
    const sc = STATUS_COLORS[proj.status] ?? STATUS_COLORS.info;
    const rows = [
        { label: 'Receita Projetada',       valor: proj.receita,              highlight: false },
        { label: 'Combustível (projetado)',  valor: proj.custos_combustivel,   highlight: false },
        { label: 'Manutenção (projetada)',   valor: proj.custos_manutencao,    highlight: false },
        { label: 'Financiamentos',           valor: proj.custos_financiamentos, highlight: false },
        { label: 'Custos Totais',            valor: proj.custos_totais,        highlight: true  },
        { label: 'Lucro Líquido Projetado',  valor: proj.lucro_liquido,        highlight: true  },
    ];
    return (
        <div className={`rounded-xl border ${sc.border} ${sc.bg} overflow-hidden`}>
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/5 bg-white/60">
                <BarChart2 size={14} className={sc.text} />
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide flex-1">
                    Projeção Anual
                </p>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${sc.bg} ${sc.text} border ${sc.border}`}>
                    Margem {proj.margem}
                </span>
            </div>
            <div className="p-3 pb-2">
                <p className="text-xs text-slate-400 mb-2 italic">{proj.base_calculo}</p>
                <table className="w-full">
                    <tbody>
                        {rows.map((r, i) => (
                            <tr key={i} className={`border-b border-black/5 last:border-0 ${r.highlight ? 'bg-white/50' : ''}`}>
                                <td className={`py-1.5 px-2 text-xs ${r.highlight ? 'font-semibold text-slate-700' : 'text-slate-500'}`}>
                                    {r.label}
                                </td>
                                <td className={`py-1.5 px-2 text-xs font-bold text-right ${r.highlight ? sc.text : 'text-slate-700'}`}>
                                    {r.valor}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ── Componente de análise estruturada (JSON) ──────────────────────────────────

function StructuredAnalysisCard({ data, insight, onRead, onDelete }: {
    data: AnalysisData;
    insight: AiInsight;
    onRead: () => void;
    onDelete: () => void;
}) {
    const s = SEVERITY_MAP[insight.severity] ?? SEVERITY_MAP.info;
    const Icon = s.icon;
    const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    return (
        <div className={`rounded-2xl border shadow-sm ${s.bg} ${s.border} ${insight.is_read ? 'opacity-70' : ''}`}>
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-black/5">
                <Icon size={18} className={`flex-shrink-0 ${s.icon_color}`} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.badge}`}>{s.label}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-white/60 text-slate-600">{TYPE_LABELS[insight.type] ?? insight.type}</span>
                        {!insight.is_read && <span className="w-2 h-2 rounded-full bg-rose-500" />}
                    </div>
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">{fmtDate(insight.created_at)}</span>
                <div className="flex gap-1">
                    {!insight.is_read && (
                        <button onClick={onRead} title="Marcar como lido"
                            className="p-1.5 rounded-lg bg-white/60 hover:bg-white text-slate-400 hover:text-emerald-600">
                            <Eye size={14} />
                        </button>
                    )}
                    <button onClick={onDelete} title="Remover"
                        className="p-1.5 rounded-lg bg-white/60 hover:bg-white text-slate-400 hover:text-rose-600">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            <div className="p-5 space-y-5">
                {/* Resumo */}
                <p className="text-sm font-medium text-slate-700 leading-relaxed">{data.resumo}</p>

                {/* Métricas */}
                {data.metricas?.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {data.metricas.map((m, i) => {
                            const c = STATUS_COLORS[m.status] ?? STATUS_COLORS.info;
                            const MIcon = c.icon;
                            return (
                                <div key={i} className={`${c.bg} border ${c.border} rounded-xl p-3`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-xs text-slate-500 font-medium leading-tight">{m.label}</p>
                                        <MIcon size={12} className={c.text} />
                                    </div>
                                    <p className={`text-base font-bold ${c.text} leading-none`}>{m.valor}</p>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Seções como tabelas */}
                {data.secoes?.map((sec, si) => (
                    <div key={si} className="bg-white/70 rounded-xl border border-black/5 overflow-hidden">
                        <div className="px-4 py-2.5 bg-white/80 border-b border-black/5">
                            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">{sec.titulo}</p>
                        </div>
                        <table className="w-full">
                            <tbody>
                                {sec.linhas?.map((l, li) => (
                                    <tr key={li} className={`border-b border-black/5 last:border-0 ${l.destaque ? 'bg-amber-50/50' : ''}`}>
                                        <td className="px-4 py-2 text-sm text-slate-600">{l.label}</td>
                                        <td className={`px-4 py-2 text-sm font-semibold text-right ${l.destaque ? 'text-amber-700' : 'text-slate-800'}`}>
                                            {l.valor}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}

                {/* Projeção Anual */}
                {data.projecao_anual && <ProjecaoAnualCard proj={data.projecao_anual} />}

                {/* Recomendações */}
                {data.recomendacoes?.length > 0 && (
                    <div className="bg-white/70 rounded-xl border border-black/5 p-4">
                        <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">Recomendações</p>
                        <ol className="space-y-2">
                            {data.recomendacoes.map((r, i) => (
                                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center mt-0.5">
                                        {i + 1}
                                    </span>
                                    {r}
                                </li>
                            ))}
                        </ol>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Componente de insight simples (texto) ─────────────────────────────────────

function InsightCard({ insight, onRead, onDelete }: {
    insight: AiInsight; onRead: () => void; onDelete: () => void;
}) {
    // Se tiver dados estruturados, delega para o componente visual
    const analysisData = insight.source_data as AnalysisData | undefined;
    if (analysisData?.tipo === 'analise') {
        return <StructuredAnalysisCard data={analysisData} insight={insight} onRead={onRead} onDelete={onDelete} />;
    }

    const [expanded, setExpanded] = useState(false);
    const s = SEVERITY_MAP[insight.severity] ?? SEVERITY_MAP.info;
    const Icon = s.icon;
    const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const isLong = insight.content.length > 300;

    return (
        <div className={`rounded-2xl border shadow-sm ${s.bg} ${s.border} ${insight.is_read ? 'opacity-60' : ''}`}>
            <div className="flex items-start gap-3 p-4">
                <Icon size={18} className={`flex-shrink-0 mt-0.5 ${s.icon_color}`} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.badge}`}>{s.label}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-white/60 text-slate-600">{TYPE_LABELS[insight.type] ?? insight.type}</span>
                        {!insight.is_read && <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />}
                        <span className="text-xs text-slate-400 ml-auto">{fmtDate(insight.created_at)}</span>
                    </div>
                    <h3 className="font-semibold text-slate-900 text-sm mb-2">{insight.title}</h3>
                    <p className={`text-sm text-slate-700 leading-relaxed whitespace-pre-line ${!expanded && isLong ? 'line-clamp-4' : ''}`}>
                        {insight.content}
                    </p>
                    {isLong && (
                        <button onClick={() => setExpanded(!expanded)} className="text-xs text-slate-500 underline mt-1.5">
                            {expanded ? 'Ver menos' : 'Ver mais'}
                        </button>
                    )}
                </div>
                <div className="flex gap-1 flex-shrink-0 ml-2">
                    {!insight.is_read && (
                        <button onClick={onRead} className="p-1.5 rounded-lg bg-white/60 hover:bg-white text-slate-400 hover:text-emerald-600">
                            <Eye size={14} />
                        </button>
                    )}
                    <button onClick={onDelete} className="p-1.5 rounded-lg bg-white/60 hover:bg-white text-slate-400 hover:text-rose-600">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function Risks() {
    const { user } = useAuth();
    const companyId = user?.company_id ?? '';
    const userId = user?.id ?? '';

    const [insights, setInsights] = useState<AiInsight[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [filterSeverity, setFilterSeverity] = useState('');
    const [filterType, setFilterType] = useState('');
    const [error, setError] = useState('');
    const [genPromptIndex, setGenPromptIndex] = useState(0);

    const load = useCallback(async () => {
        if (!companyId) return;
        setLoading(true);
        try { setInsights(await aiInsightService.getAll(companyId)); }
        catch (e) { setError(e instanceof Error ? e.message : 'Erro ao carregar'); }
        finally { setLoading(false); }
    }, [companyId]);

    useEffect(() => { load(); }, [load]);

    const generateInsights = async () => {
        setGenerating(true);
        setError('');
        try {
            const prompt = RISK_PROMPTS[genPromptIndex % RISK_PROMPTS.length];
            setGenPromptIndex(i => i + 1);
            await aiChatService.ask(companyId, prompt, userId, undefined, 'analysis');
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erro ao gerar análise');
        } finally {
            setGenerating(false);
        }
    };

    const handleRead = async (id: string) => {
        try { await aiInsightService.markRead(id); await load(); } catch { /* silencioso */ }
    };

    const handleDelete = async (id: string) => {
        try { await aiInsightService.remove(id); await load(); } catch { /* silencioso */ }
    };

    const markAllRead = async () => {
        const unread = insights.filter(i => !i.is_read);
        await Promise.all(unread.map(i => aiInsightService.markRead(i.id)));
        await load();
    };

    const filtered = insights.filter(i => {
        if (filterSeverity && i.severity !== filterSeverity) return false;
        if (filterType && i.type !== filterType) return false;
        return true;
    });

    const unreadCount = insights.filter(i => !i.is_read).length;
    const criticalCount = insights.filter(i => i.severity === 'critical').length;
    const warningCount = insights.filter(i => i.severity === 'warning').length;

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                        <ShieldAlert size={22} className="text-rose-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Riscos & Insights</h1>
                        <p className="text-xs text-slate-500">Análises visuais geradas pelo Gestor IA</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                        <button onClick={markAllRead} className="px-3 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50">
                            Marcar todos como lidos
                        </button>
                    )}
                    <button onClick={generateInsights} disabled={generating}
                        className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-xl hover:bg-rose-700 disabled:opacity-50">
                        {generating ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        {generating ? 'Analisando...' : 'Gerar Análise'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 text-rose-600 rounded-xl text-sm">
                    <ShieldAlert size={16} /> {error}
                    <button onClick={() => setError('')} className="ml-auto"><X size={14} /></button>
                </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Não lidos', value: unreadCount, color: 'text-rose-600', bg: 'bg-rose-50' },
                    { label: 'Críticos', value: criticalCount, color: 'text-rose-600', bg: 'bg-rose-50' },
                    { label: 'Atenção', value: warningCount, color: 'text-amber-600', bg: 'bg-amber-50' },
                ].map(k => (
                    <div key={k.label} className={`${k.bg} rounded-2xl p-4 text-center`}>
                        <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                        <p className="text-xs text-slate-600 mt-0.5">{k.label}</p>
                    </div>
                ))}
            </div>

            {/* Filtros */}
            <div className="flex gap-2 flex-wrap">
                <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200">
                    <option value="">Todas as severidades</option>
                    {Object.entries(SEVERITY_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select value={filterType} onChange={e => setFilterType(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200">
                    <option value="">Todos os tipos</option>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {(filterSeverity || filterType) && (
                    <button onClick={() => { setFilterSeverity(''); setFilterType(''); }}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50">
                        <X size={12} /> Limpar
                    </button>
                )}
            </div>

            {/* Lista */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-2 border-rose-200 border-t-rose-600 rounded-full animate-spin" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
                    <ShieldAlert size={40} className="text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">
                        {insights.length === 0 ? 'Nenhum insight gerado ainda' : 'Nenhum resultado com os filtros aplicados'}
                    </p>
                    {insights.length === 0 && (
                        <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
                            Clique em "Gerar Análise" para que o Gestor IA analise os dados da empresa em formato visual.
                        </p>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {['critical', 'warning', 'info', 'success'].map(sev =>
                        filtered
                            .filter(i => i.severity === sev)
                            .map(i => (
                                <InsightCard key={i.id} insight={i}
                                    onRead={() => handleRead(i.id)}
                                    onDelete={() => handleDelete(i.id)}
                                />
                            ))
                    )}
                </div>
            )}
        </div>
    );
}
