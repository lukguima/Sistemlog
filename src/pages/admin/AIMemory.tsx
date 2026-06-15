import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { aiMemoryService, type AiMemory } from '../../lib/ai.services';
import { Brain, Plus, Trash2, Star, Tag, Filter, X, AlertCircle } from 'lucide-react';

const CATEGORIES = [
    { value: 'decisao', label: 'Decisão', color: 'bg-blue-100 text-blue-700' },
    { value: 'alerta', label: 'Alerta', color: 'bg-amber-100 text-amber-700' },
    { value: 'oportunidade', label: 'Oportunidade', color: 'bg-emerald-100 text-emerald-700' },
    { value: 'meta', label: 'Meta', color: 'bg-purple-100 text-purple-700' },
    { value: 'evento', label: 'Evento', color: 'bg-slate-100 text-slate-700' },
];

const catInfo = (value: string) => CATEGORIES.find(c => c.value === value) ?? CATEGORIES[4];

function ImportanceStars({ value }: { value: number }) {
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} size={12} className={i <= value ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'} />
            ))}
        </div>
    );
}

interface MemoryFormData { category: string; title: string; description: string; importance: number; tagInput: string; }

const emptyForm = (): MemoryFormData => ({ category: 'decisao', title: '', description: '', importance: 3, tagInput: '' });

export default function AIMemory() {
    const { user } = useAuth();
    const companyId = user?.company_id ?? '';

    const [memories, setMemories] = useState<AiMemory[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterCat, setFilterCat] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<MemoryFormData>(emptyForm());
    const [tags, setTags] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        if (!companyId) return;
        setLoading(true);
        try { setMemories(await aiMemoryService.getAll(companyId)); }
        catch (e) { setError(e instanceof Error ? e.message : 'Erro ao carregar'); }
        finally { setLoading(false); }
    }, [companyId]);

    useEffect(() => { load(); }, [load]);

    const handleSave = async () => {
        if (!form.title.trim() || !form.description.trim()) return;
        setSaving(true);
        try {
            await aiMemoryService.add(companyId, {
                category: form.category,
                title: form.title.trim(),
                description: form.description.trim(),
                importance: form.importance,
                tags,
            });
            setShowForm(false);
            setForm(emptyForm());
            setTags([]);
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erro ao salvar');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Remover este registro da memória?')) return;
        try { await aiMemoryService.remove(id); await load(); }
        catch (e) { setError(e instanceof Error ? e.message : 'Erro'); }
    };

    const addTag = () => {
        const t = form.tagInput.trim().toLowerCase();
        if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
        setForm(prev => ({ ...prev, tagInput: '' }));
    };

    const filtered = filterCat ? memories.filter(m => m.category === filterCat) : memories;

    const grouped = filtered.reduce<Record<string, AiMemory[]>>((acc, m) => {
        const month = new Date(m.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        if (!acc[month]) acc[month] = [];
        acc[month].push(m);
        return acc;
    }, {});

    const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                        <Brain size={22} className="text-purple-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Memória Empresarial</h1>
                        <p className="text-xs text-slate-500">Decisões, alertas e marcos da empresa</p>
                    </div>
                </div>
                <button onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm rounded-xl hover:bg-purple-700">
                    <Plus size={16} /> Registrar
                </button>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 text-rose-600 rounded-xl text-sm">
                    <AlertCircle size={16} /> {error}
                    <button onClick={() => setError('')} className="ml-auto"><X size={14} /></button>
                </div>
            )}

            {/* Filtro */}
            <div className="flex items-center gap-2 flex-wrap">
                <Filter size={14} className="text-slate-400" />
                <button onClick={() => setFilterCat('')}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${!filterCat ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    Todos ({memories.length})
                </button>
                {CATEGORIES.map(c => {
                    const count = memories.filter(m => m.category === c.value).length;
                    if (count === 0) return null;
                    return (
                        <button key={c.value} onClick={() => setFilterCat(c.value)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterCat === c.value ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                            {c.label} ({count})
                        </button>
                    );
                })}
            </div>

            {/* Timeline */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
                    <Brain size={40} className="text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">Nenhum registro encontrado</p>
                    <p className="text-sm text-slate-400 mt-1">Registre decisões e eventos importantes da empresa.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {Object.entries(grouped).map(([month, items]) => (
                        <div key={month}>
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{month}</span>
                                <div className="flex-1 h-px bg-slate-100" />
                            </div>
                            <div className="space-y-3">
                                {items.map(m => {
                                    const cat = catInfo(m.category);
                                    return (
                                        <div key={m.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow group">
                                            <div className="flex items-start gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cat.color}`}>{cat.label}</span>
                                                        <ImportanceStars value={m.importance} />
                                                        <span className="text-xs text-slate-400 ml-auto">{fmtDate(m.created_at)}</span>
                                                    </div>
                                                    <h3 className="font-semibold text-slate-900 text-sm mb-1">{m.title}</h3>
                                                    <p className="text-sm text-slate-600 leading-relaxed">{m.description}</p>
                                                    {m.tags.length > 0 && (
                                                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                                                            <Tag size={11} className="text-slate-400" />
                                                            {m.tags.map(t => (
                                                                <span key={t} className="px-2 py-0.5 bg-slate-50 text-slate-500 rounded-full text-xs">{t}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <button onClick={() => handleDelete(m.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all flex-shrink-0">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal Novo Registro */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <h2 className="text-lg font-bold text-slate-900">Novo Registro</h2>
                            <button onClick={() => { setShowForm(false); setForm(emptyForm()); setTags([]); }} className="p-1 hover:bg-slate-100 rounded-lg"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Categoria</label>
                                    <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300">
                                        {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Importância</label>
                                    <select value={form.importance} onChange={e => setForm(p => ({ ...p, importance: Number(e.target.value) }))}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300">
                                        {[1, 2, 3, 4, 5].map(i => <option key={i} value={i}>{i} {i === 5 ? '(Crítico)' : i === 1 ? '(Baixa)' : ''}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Título</label>
                                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                                    placeholder="Ex: Decisão de comprar novo caminhão"
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Descrição</label>
                                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                                    rows={3} placeholder="Descreva os detalhes, contexto e motivação..."
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Tags</label>
                                <div className="flex gap-2">
                                    <input value={form.tagInput} onChange={e => setForm(p => ({ ...p, tagInput: e.target.value }))}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                                        placeholder="Digite e pressione Enter"
                                        className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                                    <button onClick={addTag} className="px-3 py-2 bg-slate-100 rounded-lg text-sm hover:bg-slate-200">+</button>
                                </div>
                                {tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {tags.map(t => (
                                            <span key={t} className="flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs">
                                                {t} <button onClick={() => setTags(prev => prev.filter(x => x !== t))}><X size={10} /></button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-3 p-6 border-t border-slate-100">
                            <button onClick={() => { setShowForm(false); setForm(emptyForm()); setTags([]); }}
                                className="flex-1 py-2 border border-slate-200 rounded-xl text-sm hover:bg-slate-50">Cancelar</button>
                            <button onClick={handleSave} disabled={saving || !form.title.trim() || !form.description.trim()}
                                className="flex-1 py-2 bg-purple-600 text-white rounded-xl text-sm hover:bg-purple-700 disabled:opacity-50">
                                {saving ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
