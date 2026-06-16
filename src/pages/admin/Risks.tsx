import React, { useState, useEffect, useCallback } from 'react';
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
    'Faça uma análise financeira completa e organizada da empresa. Use seções com títulos (## Título), bullet points e destaque os valores em negrito. Inclua: situação do caixa, contas a pagar/receber, margem estimada e principais riscos financeiros.',
    'Analise a frota e os custos operacionais de forma organizada. Use seções separadas para: rentabilidade por veículo, custos de combustível, manutenção e pneus. Destaque os caminhões problemáticos e os mais lucrativos.',
    'Avalie o risco de inadimplência e oportunidades de receita. Estruture sua análise em: recebíveis em atraso, clientes mais importantes, viagens pendentes e potencial de faturamento.',
    'Analise os financiamentos ativos e o comprometimento de caixa. Inclua: parcelas dos próximos 90 dias, relação dívida/receita, e recomendações para gestão da dívida.',
];

function renderMarkdown(text: string) {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (line.startsWith('## ')) {
            elements.push(<h3 key={i} className="font-bold text-slate-800 text-sm mt-3 mb-1">{line.slice(3)}</h3>);
        } else if (line.startsWith('### ')) {
            elements.push(<h4 key={i} className="font-semibold text-slate-700 text-sm mt-2 mb-0.5">{line.slice(4)}</h4>);
        } else if (line.startsWith('- ') || line.startsWith('• ')) {
            const content = line.slice(2);
            elements.push(
                <div key={i} className="flex gap-1.5 text-sm text-slate-700 leading-relaxed">
                    <span className="text-slate-400 flex-shrink-0 mt-0.5">•</span>
                    <span dangerouslySetInnerHTML={{ __html: content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                </div>
            );
        } else if (/^\d+\. /.test(line)) {
            const content = line.replace(/^\d+\. /, '');
            elements.push(
                <div key={i} className="flex gap-1.5 text-sm text-slate-700 leading-relaxed">
                    <span className="text-slate-400 flex-shrink-0 text-xs mt-0.5">{line.match(/^\d+/)![0]}.</span>
                    <span dangerouslySetInnerHTML={{ __html: content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                </div>
            );
        } else if (line.trim() === '') {
            elements.push(<div key={i} className="h-1.5" />);
        } else {
            elements.push(
                <p key={i} className="text-sm text-slate-700 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            );
        }
        i++;
    }
    return elements;
}

function InsightCard({ insight, onRead, onDelete }: { insight: AiInsight; onRead: () => void; onDelete: () => void }) {
    const [expanded, setExpanded] = useState(false);
    const s = SEVERITY_MAP[insight.severity] ?? SEVERITY_MAP.info;
    const Icon = s.icon;
    const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const isLong = insight.content.length > 400;

    return (
        <div className={`rounded-2xl border shadow-sm transition-all ${s.bg} ${s.border} ${insight.is_read ? 'opacity-60' : ''}`}>
            {/* Header */}
            <div className="flex items-start gap-3 p-4 pb-3">
                <Icon size={20} className={`flex-shrink-0 mt-0.5 ${s.icon_color}`} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.badge}`}>{s.label}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-white/60 text-slate-600">{TYPE_LABELS[insight.type] ?? insight.type}</span>
                        {!insight.is_read && <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" title="Não lido" />}
                        <span className="text-xs text-slate-400 ml-auto">{fmtDate(insight.created_at)}</span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm leading-snug">{insight.title}</h3>
                </div>
                <div className="flex gap-1 flex-shrink-0 ml-2">
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
            {/* Body */}
            <div className={`px-4 pb-4 ${!expanded && isLong ? 'max-h-64 overflow-hidden relative' : ''}`}>
                <div className="space-y-0.5">
                    {renderMarkdown(insight.content)}
                </div>
                {!expanded && isLong && (
                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-current to-transparent opacity-20 rounded-b-2xl pointer-events-none" />
                )}
            </div>
            {isLong && (
                <div className="px-4 pb-3">
                    <button onClick={() => setExpanded(!expanded)}
                        className="text-xs font-medium text-slate-500 hover:text-slate-700 underline">
                        {expanded ? 'Ver menos ▲' : 'Ver análise completa ▼'}
                    </button>
                </div>
            )}
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
