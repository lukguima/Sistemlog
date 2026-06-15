import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { accountingDocumentService, taxObligationService } from '../../lib/financial.services';
import { Plus, X, Pencil, Trash2, Check, FileText, AlertTriangle, Clock } from 'lucide-react';

const fmtDate = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
const fmt = (v: number) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().split('T')[0];

const DOC_STATUS: Record<string, { label: string; cls: string }> = {
    pending:   { label: 'Pendente',  cls: 'bg-yellow-100 text-yellow-700' },
    sent:      { label: 'Enviado',   cls: 'bg-blue-100 text-blue-700' },
    validated: { label: 'Validado',  cls: 'bg-indigo-100 text-indigo-700' },
    paid:      { label: 'Pago',      cls: 'bg-green-100 text-green-700' },
    rejected:  { label: 'Rejeitado', cls: 'bg-red-100 text-red-700' },
};

const TAX_STATUS: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Pendente', cls: 'bg-yellow-100 text-yellow-700' },
    paid:    { label: 'Pago',     cls: 'bg-green-100 text-green-700' },
    overdue: { label: 'Vencida',  cls: 'bg-red-100 text-red-700' },
    cancelled: { label: 'Cancelado', cls: 'bg-slate-100 text-slate-500' },
};

const DOC_TYPES = ['nf', 'boleto', 'contrato', 'declaracao', 'outro'];
const DOC_TYPE_LABELS: Record<string, string> = {
    nf: 'Nota Fiscal', boleto: 'Boleto', contrato: 'Contrato',
    declaracao: 'Declaração', outro: 'Outro'
};

function Modal({ title, onClose, children }: any) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <h2 className="text-base font-bold text-slate-800">{title}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X size={18} /></button>
                </div>
                <div className="p-5">{children}</div>
            </div>
        </div>
    );
}

function DocForm({ companyId, initial, onSave, onClose }: any) {
    const [form, setForm] = useState({
        type: initial?.type ?? 'nf',
        description: initial?.description ?? '',
        period: initial?.period ?? new Date().toISOString().substring(0, 7),
        due_date: initial?.due_date ?? '',
        status: initial?.status ?? 'pending',
        observations: initial?.observations ?? '',
        accountant_note: initial?.accountant_note ?? '',
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setSaving(true);
        try {
            const payload = { ...form, company_id: companyId, due_date: form.due_date || null };
            if (initial?.id) await accountingDocumentService.update(initial.id, payload);
            else await accountingDocumentService.add(payload);
            onSave();
        } finally { setSaving(false); }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <label>
                <span className="text-xs font-medium text-slate-600">Tipo</span>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    {DOC_TYPES.map(t => <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>)}
                </select>
            </label>
            <label>
                <span className="text-xs font-medium text-slate-600">Descrição *</span>
                <input required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Ex: NF de abastecimento Jan/2026" />
            </label>
            <div className="grid grid-cols-2 gap-3">
                <label>
                    <span className="text-xs font-medium text-slate-600">Período</span>
                    <input type="month" value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </label>
                <label>
                    <span className="text-xs font-medium text-slate-600">Prazo</span>
                    <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </label>
            </div>
            <label>
                <span className="text-xs font-medium text-slate-600">Status</span>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    {Object.entries(DOC_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
            </label>
            <label>
                <span className="text-xs font-medium text-slate-600">Observações</span>
                <textarea value={form.observations} onChange={e => setForm(f => ({ ...f, observations: e.target.value }))}
                    rows={2} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" />
            </label>
            <label>
                <span className="text-xs font-medium text-slate-600">Nota do Contador</span>
                <textarea value={form.accountant_note} onChange={e => setForm(f => ({ ...f, accountant_note: e.target.value }))}
                    rows={2} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Preenchido pelo contador..." />
            </label>
            <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                    {saving ? 'Salvando...' : 'Salvar'}
                </button>
            </div>
        </form>
    );
}

function TaxForm({ companyId, initial, onSave, onClose }: any) {
    const [form, setForm] = useState({
        name: initial?.name ?? '',
        description: initial?.description ?? '',
        due_date: initial?.due_date ?? today(),
        amount: initial?.amount ? String(initial.amount) : '',
        notes: initial?.notes ?? '',
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setSaving(true);
        try {
            const payload = { ...form, company_id: companyId, amount: parseFloat(form.amount) || null };
            if (initial?.id) await taxObligationService.update(initial.id, payload);
            else await taxObligationService.add(payload);
            onSave();
        } finally { setSaving(false); }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <label>
                <span className="text-xs font-medium text-slate-600">Obrigação *</span>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Ex: DAS, DCTF, SPED..." />
            </label>
            <label>
                <span className="text-xs font-medium text-slate-600">Descrição</span>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </label>
            <div className="grid grid-cols-2 gap-3">
                <label>
                    <span className="text-xs font-medium text-slate-600">Vencimento *</span>
                    <input required type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </label>
                <label>
                    <span className="text-xs font-medium text-slate-600">Valor (R$)</span>
                    <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </label>
            </div>
            <label>
                <span className="text-xs font-medium text-slate-600">Notas</span>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={2} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" />
            </label>
            <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                    {saving ? 'Salvando...' : 'Salvar'}
                </button>
            </div>
        </form>
    );
}

export default function Accounting() {
    const { user } = useAuth();
    const companyId = (user as any)?.company_id;
    const [tab, setTab] = useState<'docs' | 'taxes'>('docs');
    const [docs, setDocs] = useState<any[]>([]);
    const [taxes, setTaxes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<{ type: 'doc' | 'tax'; item?: any } | null>(null);

    const load = async () => {
        if (!companyId) return;
        setLoading(true);
        try {
            const [d, t] = await Promise.all([
                accountingDocumentService.getAll(companyId),
                taxObligationService.getAll(companyId),
            ]);
            setDocs(d); setTaxes(t);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [companyId]);

    const pendingDocs = docs.filter(d => d.status === 'pending').length;
    const overdueTaxes = taxes.filter(t => t.status === 'overdue').length;
    const pendingTaxes = taxes.filter(t => ['pending', 'overdue'].includes(t.status));
    const totalTaxPending = pendingTaxes.reduce((s, t) => s + Number(t.amount || 0), 0);

    const handleDeleteDoc = async (id: string) => {
        if (!confirm('Excluir documento?')) return;
        await accountingDocumentService.remove(id);
        load();
    };
    const handleDeleteTax = async (id: string) => {
        if (!confirm('Excluir obrigação?')) return;
        await taxObligationService.remove(id);
        load();
    };
    const handleMarkTaxPaid = async (id: string) => {
        await taxObligationService.markPaid(id);
        load();
    };

    const TABS = [
        { id: 'docs', label: `Documentos${pendingDocs > 0 ? ` · ${pendingDocs} pendentes` : ''}` },
        { id: 'taxes', label: `Obrigações Fiscais${overdueTaxes > 0 ? ` · ${overdueTaxes} vencidas` : ''}` },
    ] as const;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Central Contábil</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Documentos, impostos e obrigações fiscais</p>
                </div>
                {overdueTaxes > 0 && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                        <AlertTriangle size={16} className="text-red-500" />
                        <span className="text-sm font-medium text-red-600">{overdueTaxes} obrigação{overdueTaxes > 1 ? 'ões' : ''} vencida{overdueTaxes > 1 ? 's' : ''}</span>
                    </div>
                )}
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Documentos', value: docs.length, color: 'text-slate-800', bg: 'bg-slate-50', icon: FileText },
                    { label: 'Docs Pendentes', value: pendingDocs, color: 'text-yellow-700', bg: 'bg-yellow-50', icon: Clock },
                    { label: 'Impostos Vencidos', value: overdueTaxes, color: 'text-red-700', bg: 'bg-red-50', icon: AlertTriangle },
                    { label: 'Total a Pagar (impostos)', value: null, extra: fmt(totalTaxPending), color: 'text-orange-700', bg: 'bg-orange-50', icon: FileText },
                ].map(k => (
                    <div key={k.label} className={`${k.bg} rounded-2xl p-4`}>
                        <p className="text-xs text-slate-500 font-medium mb-1">{k.label}</p>
                        <p className={`text-xl font-bold ${k.color}`}>{k.extra ?? k.value}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm">
                <div className="flex border-b border-slate-100 px-1 pt-1">
                    {TABS.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={`px-4 py-2.5 text-sm font-medium rounded-t-xl whitespace-nowrap transition-colors ${tab === t.id ? 'bg-primary-50 text-primary-600 border-b-2 border-primary-500' : 'text-slate-500 hover:text-slate-700'}`}>
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="p-4">
                    {loading ? (
                        <div className="py-16 text-center text-slate-400 text-sm">Carregando...</div>
                    ) : (
                        <>
                            {/* ── Documentos ── */}
                            {tab === 'docs' && (
                                <div className="space-y-3">
                                    <div className="flex justify-end">
                                        <button onClick={() => setModal({ type: 'doc' })}
                                            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
                                            <Plus size={16} /> Novo Documento
                                        </button>
                                    </div>
                                    {docs.length === 0 ? (
                                        <div className="py-12 text-center text-slate-400 text-sm">Nenhum documento cadastrado.</div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-slate-100">
                                                        {['Tipo', 'Descrição', 'Período', 'Prazo', 'Status', 'Nota Contador', ''].map(h => (
                                                            <th key={h} className="text-left py-2 px-2 text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {docs.map(d => (
                                                        <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50">
                                                            <td className="py-2.5 px-2">
                                                                <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">{DOC_TYPE_LABELS[d.type] ?? d.type}</span>
                                                            </td>
                                                            <td className="py-2.5 px-2 font-medium text-slate-800">{d.description}</td>
                                                            <td className="py-2.5 px-2 text-slate-500">{d.period ?? '—'}</td>
                                                            <td className="py-2.5 px-2 text-slate-500">{fmtDate(d.due_date)}</td>
                                                            <td className="py-2.5 px-2">
                                                                <span className={`px-2 py-0.5 rounded-full text-xs ${DOC_STATUS[d.status]?.cls}`}>{DOC_STATUS[d.status]?.label}</span>
                                                            </td>
                                                            <td className="py-2.5 px-2 text-slate-400 text-xs max-w-[160px] truncate">{d.accountant_note ?? '—'}</td>
                                                            <td className="py-2.5 px-2">
                                                                <div className="flex items-center gap-1">
                                                                    <button onClick={() => setModal({ type: 'doc', item: d })} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Pencil size={14} /></button>
                                                                    <button onClick={() => handleDeleteDoc(d.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── Obrigações Fiscais ── */}
                            {tab === 'taxes' && (
                                <div className="space-y-3">
                                    <div className="flex justify-end">
                                        <button onClick={() => setModal({ type: 'tax' })}
                                            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
                                            <Plus size={16} /> Nova Obrigação
                                        </button>
                                    </div>
                                    {taxes.length === 0 ? (
                                        <div className="py-12 text-center text-slate-400 text-sm">Nenhuma obrigação fiscal cadastrada.</div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-slate-100">
                                                        {['Obrigação', 'Descrição', 'Vencimento', 'Valor', 'Status', ''].map(h => (
                                                            <th key={h} className="text-left py-2 px-2 text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {taxes.map(t => (
                                                        <tr key={t.id} className={`border-b border-slate-50 hover:bg-slate-50 ${t.status === 'overdue' ? 'bg-red-50/30' : ''}`}>
                                                            <td className="py-2.5 px-2 font-semibold text-slate-800">{t.name}</td>
                                                            <td className="py-2.5 px-2 text-slate-500">{t.description ?? '—'}</td>
                                                            <td className={`py-2.5 px-2 font-medium whitespace-nowrap ${t.status === 'overdue' ? 'text-red-600' : 'text-slate-600'}`}>{fmtDate(t.due_date)}</td>
                                                            <td className="py-2.5 px-2 font-medium text-slate-700">{t.amount ? fmt(t.amount) : '—'}</td>
                                                            <td className="py-2.5 px-2">
                                                                <span className={`px-2 py-0.5 rounded-full text-xs ${TAX_STATUS[t.status]?.cls}`}>{TAX_STATUS[t.status]?.label}</span>
                                                            </td>
                                                            <td className="py-2.5 px-2">
                                                                <div className="flex items-center gap-1">
                                                                    {['pending', 'overdue'].includes(t.status) && (
                                                                        <button onClick={() => handleMarkTaxPaid(t.id)} title="Marcar como pago"
                                                                            className="p-1.5 rounded-lg hover:bg-green-50 text-green-500"><Check size={14} /></button>
                                                                    )}
                                                                    <button onClick={() => setModal({ type: 'tax', item: t })} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Pencil size={14} /></button>
                                                                    <button onClick={() => handleDeleteTax(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {modal?.type === 'doc' && (
                <Modal title={modal.item ? 'Editar Documento' : 'Novo Documento'} onClose={() => setModal(null)}>
                    <DocForm companyId={companyId} initial={modal.item}
                        onSave={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
                </Modal>
            )}
            {modal?.type === 'tax' && (
                <Modal title={modal.item ? 'Editar Obrigação' : 'Nova Obrigação Fiscal'} onClose={() => setModal(null)}>
                    <TaxForm companyId={companyId} initial={modal.item}
                        onSave={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
                </Modal>
            )}
        </div>
    );
}
