import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { aiChatService, type AiMessage } from '../../lib/ai.services';
import { Bot, Send, Sparkles, RefreshCw, MessageSquare, ChevronRight, AlertCircle } from 'lucide-react';

const SUGGESTED_QUESTIONS = [
    'Como está a saúde financeira da empresa no último mês?',
    'Quais veículos apresentam maior custo operacional?',
    'Tenho contas a vencer nos próximos 7 dias?',
    'Qual é a margem de lucro média das viagens?',
    'Quais riscos devo atentar agora?',
    'Análise os financiamentos ativos e diga se são sustentáveis.',
    'Quais motoristas mais geraram receita?',
    'Faça um resumo executivo do mês.',
];

function TypingDots() {
    return (
        <div className="flex items-center gap-1 px-4 py-3">
            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
    );
}

function MessageBubble({ msg }: { msg: AiMessage }) {
    const isUser = msg.role === 'user';
    return (
        <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-primary-100 text-primary-600' : 'bg-indigo-100 text-indigo-600'}`}>
                {isUser ? <span className="text-xs font-bold">EU</span> : <Bot size={16} />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                isUser
                    ? 'bg-primary-600 text-white rounded-tr-sm'
                    : 'bg-slate-100 text-slate-800 rounded-tl-sm'
            }`}>
                {msg.content}
            </div>
        </div>
    );
}

export default function AIManager() {
    const { user } = useAuth();
    const companyId = user?.company_id ?? '';
    const userId = user?.id ?? '';

    const [messages, setMessages] = useState<AiMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | undefined>();
    const [error, setError] = useState('');
    const [pastSessions, setPastSessions] = useState<{ session_id: string; content: string; created_at: string }[]>([]);
    const [showSessions, setShowSessions] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

    const loadSessions = useCallback(async () => {
        if (!companyId) return;
        try { setPastSessions(await aiChatService.getSessions(companyId)); } catch { /* silencioso */ }
    }, [companyId]);

    useEffect(() => { loadSessions(); }, [loadSessions]);

    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim() || loading || !companyId) return;
        const userMsg: AiMessage = { role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);
        setError('');
        try {
            const res = await aiChatService.ask(companyId, text, userId, sessionId);
            setSessionId(res.sessionId);
            setMessages(prev => [...prev, { role: 'assistant', content: res.answer }]);
            await loadSessions();
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Erro ao contactar o Gestor IA.';
            setError(msg);
            setMessages(prev => prev.slice(0, -1));
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    }, [companyId, userId, sessionId, loading, loadSessions]);

    const loadSession = async (sid: string) => {
        if (!companyId) return;
        try {
            const history = await aiChatService.getHistory(companyId, sid);
            setMessages(history);
            setSessionId(sid);
            setShowSessions(false);
        } catch { /* silencioso */ }
    };

    const newSession = () => {
        setMessages([]);
        setSessionId(undefined);
        setError('');
        setShowSessions(false);
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col gap-4 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                        <Bot size={22} className="text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Gestor IA</h1>
                        <p className="text-xs text-slate-500">Powered by GPT-4o · Dados em tempo real</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => { setShowSessions(!showSessions); loadSessions(); }}
                        className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
                        <MessageSquare size={16} /> Histórico
                    </button>
                    <button onClick={newSession}
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                        <RefreshCw size={16} /> Nova Conversa
                    </button>
                </div>
            </div>

            {/* Sessions Panel */}
            {showSessions && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 max-h-52 overflow-y-auto shadow-sm">
                    <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Conversas Anteriores</p>
                    {pastSessions.length === 0 ? (
                        <p className="text-sm text-slate-400">Nenhuma conversa salva ainda.</p>
                    ) : (
                        <div className="space-y-1">
                            {pastSessions.map(s => (
                                <button key={s.session_id} onClick={() => loadSession(s.session_id)}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 text-left">
                                    <MessageSquare size={14} className="text-slate-400 flex-shrink-0" />
                                    <span className="flex-1 text-sm text-slate-700 truncate">{s.content}</span>
                                    <span className="text-xs text-slate-400 flex-shrink-0">{fmtDate(s.created_at)}</span>
                                    <ChevronRight size={14} className="text-slate-400" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Chat Area */}
            <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-sm">
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center py-12 gap-6">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
                                <Sparkles size={32} className="text-indigo-500" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-slate-800 mb-1">Olá! Sou o seu Gestor IA</h2>
                                <p className="text-sm text-slate-500 max-w-sm">
                                    Analiso os dados reais da sua empresa e respondo perguntas sobre finanças, frota, motoristas e muito mais.
                                </p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                                {SUGGESTED_QUESTIONS.slice(0, 4).map((q) => (
                                    <button key={q} onClick={() => sendMessage(q)}
                                        className="text-left px-4 py-3 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl text-sm text-slate-600 border border-slate-100 transition-colors">
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
                    {loading && (
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                                <Bot size={16} />
                            </div>
                            <div className="bg-slate-100 rounded-2xl rounded-tl-sm">
                                <TypingDots />
                            </div>
                        </div>
                    )}
                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-rose-50 text-rose-600 rounded-xl text-sm">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}
                    <div ref={endRef} />
                </div>

                {/* Sugestões rápidas (após primeira mensagem) */}
                {messages.length > 0 && messages.length < 3 && (
                    <div className="px-4 pb-2 flex gap-2 flex-wrap">
                        {SUGGESTED_QUESTIONS.slice(4).map((q) => (
                            <button key={q} onClick={() => sendMessage(q)} disabled={loading}
                                className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 rounded-full text-slate-600 transition-colors disabled:opacity-50">
                                {q}
                            </button>
                        ))}
                    </div>
                )}

                {/* Input */}
                <div className="border-t border-slate-100 p-4 flex items-end gap-3">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Pergunte algo sobre sua empresa... (Enter para enviar)"
                        rows={1}
                        disabled={loading}
                        className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50 max-h-32"
                        style={{ minHeight: '44px' }}
                    />
                    <button
                        onClick={() => sendMessage(input)}
                        disabled={!input.trim() || loading}
                        className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
