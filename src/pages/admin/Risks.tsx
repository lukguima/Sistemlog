import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { aiInsightService, aiChatService, type AiInsight } from '../../lib/ai.services';
import { ShieldAlert, CheckCircle2, AlertTriangle, XCircle, Info, Trash2, Eye, RefreshCw, X, Sparkles } from 'lucide-react';

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

const RISK_PROMPTS = [
    'Analise os riscos financeiros atuais da empresa: contas vencidas, fluxo de caixa negativo e margens baixas.',
    'Identifique riscos operacionais na frota: veículos com alto custo de manutenção ou parados.',
    'Analise os riscos de inadimplência e recebíveis em atraso.',
    'Avalie se os financiamentos ativos comprometem a saúde financeira da empresa.',
];

function InsightCard({ insight, onRead, onDelete }: { insight: AiInsight; onRead: () => void; onDelete: () => void }) {
    const [expanded, setExpanded] = useState(false);
    const s = SEVERITY_MAP[insight.severity] ?? SEVERITY_MAP.info;
    const Icon = s.icon;
    const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    return (
        <div className={`rounded-2xl border p-4 shadow-sm transition-all ${s.bg} ${s.border} ${insight.is_read ? 'opacity-60' : ''}`}>
            <div className="flex items-start gap-3">
                <Icon size={20} className={`flex-shrink-0 mt-0.5 ${s.icon_color}`} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.badge}`}>{s.label}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-white/60 text-slate-600">{TYPE_LABELS[insight.type] ?? insight.type}</span>
                        {!insight.is_read && <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" title="Não lido" />}
                        <span className="text-xs text-slate-400 ml-auto">{fmtDate(insight.created_at)}</span>
                    </div>
                    <h3 className="font-semibold text-slate-900 text-sm mb-1">{insight.title}</h3>
                    <p className={`text-sm text-slate-700 leading-relaxed ${!expanded && insight.content.length > 180 ? 'line-clamp-3' : ''}`}>
                        {insight.content}
                    </p>
                    {insight.content.length > 180 && (
                        <button onClick={() => setExpanded(!expanded)} className="text-xs text-slate-500 underline mt-1">
                            {expanded ? 'Ver menos' : 'Ver mais'}
                        </button>
                    )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                    {!insight.is_read && (
                        <button onClick={onRead} title="Marcar como lido"
                            className="p-1.5 rounded-lg bg-white/60 hover:bg-white text-slate-500 hover:text-emerald-600 transition-colors">
                            <Eye size={14} />
                        </button>
                    )}
                    <button onClick={onDelete} title="Remover"
                        className="p-1.5 rounded-lg bg-white/60 hover:bg-white text-slate-500 hover:text-rose-600 transition-colors">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}

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
            await aiChatService.ask(companyId, prompt, userId);
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erro ao gerar análise');
        } finally {
            setGenerating(false);
        }
    };

    const handleRead = async (id: string) => {
        try { await aiInsightService.markRead(id); await load(); }
        catch { /* silencioso */ }
    };

    const handleDelete = async (id: string) => {
        try { await aiInsightService.remove(id); await load(); }
        catch { /* silencioso */ }
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
                        <p className="text-xs text-slate-500">Análises automáticas geradas pelo Gestor IA</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                        <button onClick={markAllRead} className="px-3 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50">
                            Marcar todos como lidos
                        </button>
                    )}
                    <button onClick={generateInsights} disabled={generating}
                        className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white text-sm rounded-xl hover:bg-rose-700 disabled:opacity-50">
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
            <div className="grid grid-cols-3 gap-4">
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
                            Clique em "Gerar Análise" para que o Gestor IA analise os riscos da sua empresa.
                        </p>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {/* Críticos primeiro */}
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
