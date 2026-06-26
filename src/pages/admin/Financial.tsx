import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    transactionService, accountsPayableService, accountsReceivableService,
    financialCategoryService
} from '../../lib/financial.services';
import {
    Plus, TrendingUp, TrendingDown, Wallet, Clock,
    AlertTriangle, X, Pencil, Trash2, Check
} from 'lucide-react';

const fmt = (v: number) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const fmtDate = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
const today = () => new Date().toISOString().split('T')[0];

const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    paid: 'bg-green-100 text-green-700',
    received: 'bg-green-100 text-green-700',
    overdue: 'bg-red-100 text-red-700',
    cancelled: 'bg-slate-100 text-slate-500',
};
const STATUS_LABELS: Record<string, string> = {
    pending: 'Pendente', paid: 'Pago', received: 'Recebido',
    overdue: 'Vencido', cancelled: 'Cancelado'
};

// ── Modal genérico ──────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <h2 className="text-base font-bold text-slate-800">{title}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X size={18} /></button>
                </div>
                <div className="p-5">{children}</div>
            </div>
        </div>
    );
}

// ── Formulário de Lançamento ─────────────────────────────────────────────────
function TransactionForm({ companyId, categories, initial, onSave, onClose }: any) {
    const [form, setForm] = useState({
        type: initial?.type ?? 'despesa',
        description: initial?.description ?? '',
        amount: initial?.amount ? String(initial.amount) : '',
        competence_date: initial?.competence_date ?? today(),
        payment_date: initial?.payment_date ?? '',
        status: initial?.status ?? 'pending',
        category_id: initial?.category_id ?? '',
        notes: initial?.notes ?? '',
    });
    const [saving, setSaving] = useState(false);

    const cats = categories.filter((c: any) => c.type === form.type);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = { ...form, company_id: companyId, amount: parseFloat(form.amount) || 0, category_id: form.category_id || null, payment_date: form.payment_date || null };
            if (initial?.id) await transactionService.update(initial.id, payload);
            else await transactionService.add(payload);
            onSave();
        } finally { setSaving(false); }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <label className="col-span-2">
                    <span className="text-xs font-medium text-slate-600">Tipo</span>
                    <div className="mt-1 flex rounded-lg border border-slate-200 overflow-hidden">
                        {(['receita', 'despesa'] as const).map(t => (
                            <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t, category_id: '' }))}
                                className={`flex-1 py-2 text-sm font-medium transition-colors ${form.type === t ? (t === 'receita' ? 'bg-green-500 text-white' : 'bg-red-500 text-white') : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                                {t === 'receita' ? '↑ Receita' : '↓ Despesa'}
                            </button>
                        ))}
                    </div>
                </label>
                <label className="col-span-2">
                    <span className="text-xs font-medium text-slate-600">Descrição *</span>
                    <input required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Ex: Pagamento de combustível" />
                </label>
                <label>
                    <span className="text-xs font-medium text-slate-600">Valor (R$) *</span>
                    <input required type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </label>
                <label>
                    <span className="text-xs font-medium text-slate-600">Categoria</span>
                    <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                        <option value="">— Sem categoria —</option>
                        {cats.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </label>
                <label>
                    <span className="text-xs font-medium text-slate-600">Data de Competência *</span>
                    <input required type="date" value={form.competence_date} onChange={e => setForm(f => ({ ...f, competence_date: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </label>
                <label>
                    <span className="text-xs font-medium text-slate-600">Data de Pagamento</span>
                    <input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </label>
                <label className="col-span-2">
                    <span className="text-xs font-medium text-slate-600">Observações</span>
                    <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                        rows={2} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" />
                </label>
            </div>
            <div className="flex gap-2 pt-2">
                <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                    {saving ? 'Salvando...' : 'Salvar'}
                </button>
            </div>
        </form>
    );
}

// ── Formulário Contas a Pagar ────────────────────────────────────────────────
function PayableForm({ companyId, categories, initial, onSave, onClose }: any) {
    const [form, setForm] = useState({
        description: initial?.description ?? '',
        amount: initial?.amount ? String(initial.amount) : '',
        due_date: initial?.due_date ?? today(),
        supplier_name: initial?.supplier_name ?? '',
        category_id: initial?.category_id ?? '',
        notes: initial?.notes ?? '',
        parcelas: '1',
    });
    const [saving, setSaving] = useState(false);
    const despCats = categories.filter((c: any) => c.type === 'despesa');
    const isEdit = !!initial?.id;

    const addMonths = (dateStr: string, months: number): string => {
        const d = new Date(dateStr + 'T12:00:00');
        d.setMonth(d.getMonth() + months);
        return d.toISOString().split('T')[0];
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const base = { company_id: companyId, amount: parseFloat(form.amount) || 0, category_id: form.category_id || null };
            if (isEdit) {
                const payload = { ...base, description: form.description, due_date: form.due_date, supplier_name: form.supplier_name, notes: form.notes };
                await accountsPayableService.update(initial.id, payload);
            } else {
                const n = parseInt(form.parcelas) || 1;
                for (let i = 0; i < n; i++) {
                    const description = n > 1 ? `${form.description} (${i + 1}/${n})` : form.description;
                    const due_date = addMonths(form.due_date, i);
                    await accountsPayableService.add({ ...base, description, due_date, supplier_name: form.supplier_name, notes: form.notes });
                }
            }
            onSave();
        } finally { setSaving(false); }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <label className="col-span-2">
                    <span className="text-xs font-medium text-slate-600">Descrição *</span>
                    <input required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Ex: Parcela do financiamento" />
                </label>
                <label>
                    <span className="text-xs font-medium text-slate-600">Valor (R$) *</span>
                    <input required type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </label>
                <label>
                    <span className="text-xs font-medium text-slate-600">1º Vencimento *</span>
                    <input required type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </label>
                <label>
                    <span className="text-xs font-medium text-slate-600">Fornecedor</span>
                    <input value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Nome do fornecedor" />
                </label>
                <label>
                    <span className="text-xs font-medium text-slate-600">Categoria</span>
                    <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                        <option value="">— Sem categoria —</option>
                        {despCats.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </label>
                {!isEdit && (
                    <label className="col-span-2">
                        <span className="text-xs font-medium text-slate-600">Parcelas</span>
                        <select value={form.parcelas} onChange={e => setForm(f => ({ ...f, parcelas: e.target.value }))}
                            className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                            {Array.from({ length: 24 }, (_, i) => i + 1).map(n => (
                                <option key={n} value={n}>{n}x {n > 1 ? `— vence todo mês a partir do 1º vencimento` : '— à vista'}</option>
                            ))}
                        </select>
                        {parseInt(form.parcelas) > 1 && (
                            <p className="text-[11px] text-slate-400 mt-1">
                                Serão criados {form.parcelas} lançamentos com vencimentos mensais.
                            </p>
                        )}
                    </label>
                )}
                <label className="col-span-2">
                    <span className="text-xs font-medium text-slate-600">Observações</span>
                    <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                        rows={2} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" />
                </label>
            </div>
            <div className="flex gap-2 pt-2">
                <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                    {saving ? 'Salvando...' : parseInt(form.parcelas) > 1 ? `Salvar ${form.parcelas} parcelas` : 'Salvar'}
                </button>
            </div>
        </form>
    );
}

// ── Formulário Contas a Receber ──────────────────────────────────────────────
function ReceivableForm({ companyId, initial, onSave, onClose }: any) {
    const [form, setForm] = useState({
        description: initial?.description ?? '',
        amount: initial?.amount ? String(initial.amount) : '',
        due_date: initial?.due_date ?? today(),
        client_name: initial?.client_name ?? '',
        notes: initial?.notes ?? '',
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = { ...form, company_id: companyId, amount: parseFloat(form.amount) || 0 };
            if (initial?.id) await accountsReceivableService.update(initial.id, payload);
            else await accountsReceivableService.add(payload);
            onSave();
        } finally { setSaving(false); }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <label className="col-span-2">
                    <span className="text-xs font-medium text-slate-600">Descrição *</span>
                    <input required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Ex: Frete cliente ABC" />
                </label>
                <label>
                    <span className="text-xs font-medium text-slate-600">Valor (R$) *</span>
                    <input required type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </label>
                <label>
                    <span className="text-xs font-medium text-slate-600">Vencimento *</span>
                    <input required type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </label>
                <label className="col-span-2">
                    <span className="text-xs font-medium text-slate-600">Cliente</span>
                    <input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Nome do cliente" />
                </label>
                <label className="col-span-2">
                    <span className="text-xs font-medium text-slate-600">Observações</span>
                    <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                        rows={2} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" />
                </label>
            </div>
            <div className="flex gap-2 pt-2">
                <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                    {saving ? 'Salvando...' : 'Salvar'}
                </button>
            </div>
        </form>
    );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function Financial() {
    const { user } = useAuth();
    const companyId = (user as any)?.company_id;
    const [tab, setTab] = useState<'lancamentos' | 'pagar' | 'receber' | 'categorias'>('lancamentos');

    const [transactions, setTransactions] = useState<any[]>([]);
    const [payables, setPayables] = useState<any[]>([]);
    const [receivables, setReceivables] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [modal, setModal] = useState<{ type: 'tx' | 'pay' | 'rec' | 'cat'; item?: any } | null>(null);
    const [catForm, setCatForm] = useState({ name: '', type: 'despesa' as 'receita' | 'despesa' });
    const [filterType, setFilterType] = useState<'all' | 'receita' | 'despesa'>('all');

    const load = async () => {
        if (!companyId) return;
        setLoading(true);
        try {
            const [tx, pay, rec, cats] = await Promise.all([
                transactionService.getAll(companyId),
                accountsPayableService.getAll(companyId),
                accountsReceivableService.getAll(companyId),
                financialCategoryService.getAll(companyId),
            ]);
            setTransactions(tx); setPayables(pay); setReceivables(rec); setCategories(cats);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [companyId]);

    // KPIs
    const totalReceitas = transactions.filter(t => t.type === 'receita').reduce((s, t) => s + Number(t.amount), 0);
    const totalDespesas = transactions.filter(t => t.type === 'despesa').reduce((s, t) => s + Number(t.amount), 0);
    const totalPagar = payables.filter(p => ['pending', 'overdue'].includes(p.status)).reduce((s, p) => s + Number(p.amount), 0);
    const totalReceber = receivables.filter(r => ['pending', 'overdue'].includes(r.status)).reduce((s, r) => s + Number(r.amount), 0);
    const vencidos = payables.filter(p => p.status === 'overdue').length + receivables.filter(r => r.status === 'overdue').length;

    const txFiltered = filterType === 'all' ? transactions : transactions.filter(t => t.type === filterType);

    const handleDeleteTx = async (id: string) => {
        if (!confirm('Excluir este lançamento?')) return;
        await transactionService.remove(id);
        load();
    };
    const handleDeletePay = async (id: string) => {
        if (!confirm('Excluir esta conta?')) return;
        await accountsPayableService.remove(id);
        load();
    };
    const handleDeleteRec = async (id: string) => {
        if (!confirm('Excluir esta conta?')) return;
        await accountsReceivableService.remove(id);
        load();
    };
    const handleMarkPaid = async (id: string) => {
        const item = payables.find(p => p.id === id);
        await accountsPayableService.markPaid(id, today());
        if (item) {
            await transactionService.add({
                company_id: companyId,
                type: 'despesa',
                description: item.description,
                amount: item.amount,
                category_id: item.category_id ?? null,
                competence_date: today(),
                payment_date: today(),
                status: 'paid',
                notes: `Baixado automaticamente de Conta a Pagar`,
            });
        }
        load();
    };
    const handleMarkReceived = async (id: string) => {
        const item = receivables.find(r => r.id === id);
        await accountsReceivableService.markReceived(id, today());
        if (item) {
            await transactionService.add({
                company_id: companyId,
                type: 'receita',
                description: item.description,
                amount: item.amount,
                category_id: null,
                competence_date: today(),
                payment_date: today(),
                status: 'paid',
                notes: `Baixado automaticamente de Conta a Receber`,
            });
        }
        load();
    };
    const handleAddCat = async (e: React.FormEvent) => {
        e.preventDefault();
        await financialCategoryService.add(companyId, catForm);
        setCatForm({ name: '', type: 'despesa' });
        load();
    };
    const handleDeleteCat = async (id: string) => {
        if (!confirm('Excluir esta categoria?')) return;
        await financialCategoryService.remove(id);
        load();
    };
    const handleSeedCats = async () => {
        await financialCategoryService.seedDefaults(companyId);
        load();
    };

    const TABS = [
        { id: 'lancamentos', label: 'Lançamentos' },
        { id: 'pagar', label: `A Pagar${totalPagar > 0 ? ` · ${fmt(totalPagar)}` : ''}` },
        { id: 'receber', label: `A Receber${totalReceber > 0 ? ` · ${fmt(totalReceber)}` : ''}` },
        { id: 'categorias', label: 'Categorias' },
    ] as const;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Financeiro</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Controle de receitas, despesas e contas</p>
                </div>
                {vencidos > 0 && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                        <AlertTriangle size={16} className="text-red-500" />
                        <span className="text-sm font-medium text-red-600">{vencidos} vencido{vencidos > 1 ? 's' : ''}</span>
                    </div>
                )}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Receitas', value: totalReceitas, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
                    { label: 'Total Despesas', value: totalDespesas, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
                    { label: 'A Pagar', value: totalPagar, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
                    { label: 'A Receber', value: totalReceber, icon: Wallet, color: 'text-blue-600', bg: 'bg-blue-50' },
                ].map(k => (
                    <div key={k.label} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                        <div className={`w-9 h-9 ${k.bg} rounded-xl flex items-center justify-center mb-3`}>
                            <k.icon size={18} className={k.color} />
                        </div>
                        <p className="text-xs text-slate-500 font-medium">{k.label}</p>
                        <p className={`text-lg font-bold mt-0.5 ${k.color}`}>{fmt(k.value)}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm">
                <div className="flex border-b border-slate-100 px-1 pt-1 overflow-x-auto">
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
                            {/* ── Lançamentos ── */}
                            {tab === 'lancamentos' && (
                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
                                            {(['all', 'receita', 'despesa'] as const).map(f => (
                                                <button key={f} onClick={() => setFilterType(f)}
                                                    className={`px-3 py-1.5 font-medium transition-colors ${filterType === f ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                                                    {f === 'all' ? 'Todos' : f === 'receita' ? '↑ Receitas' : '↓ Despesas'}
                                                </button>
                                            ))}
                                        </div>
                                        <button onClick={() => setModal({ type: 'tx' })}
                                            className="ml-auto flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
                                            <Plus size={16} /> Novo Lançamento
                                        </button>
                                    </div>
                                    {txFiltered.length === 0 ? (
                                        <div className="py-12 text-center text-slate-400 text-sm">Nenhum lançamento encontrado.</div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-slate-100">
                                                        {['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Status', ''].map(h => (
                                                            <th key={h} className="text-left py-2 px-2 text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {txFiltered.map(tx => (
                                                        <tr key={tx.id} className="border-b border-slate-50 hover:bg-slate-50">
                                                            <td className="py-2.5 px-2 text-slate-500 whitespace-nowrap">{fmtDate(tx.competence_date)}</td>
                                                            <td className="py-2.5 px-2 font-medium text-slate-800">{tx.description}</td>
                                                            <td className="py-2.5 px-2 text-slate-500">{tx.category?.name ?? '—'}</td>
                                                            <td className="py-2.5 px-2">
                                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tx.type === 'receita' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                    {tx.type === 'receita' ? '↑ Receita' : '↓ Despesa'}
                                                                </span>
                                                            </td>
                                                            <td className={`py-2.5 px-2 font-semibold ${tx.type === 'receita' ? 'text-green-700' : 'text-red-700'}`}>
                                                                {tx.type === 'receita' ? '+' : '-'}{fmt(tx.amount)}
                                                            </td>
                                                            <td className="py-2.5 px-2">
                                                                <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[tx.status] ?? ''}`}>
                                                                    {STATUS_LABELS[tx.status] ?? tx.status}
                                                                </span>
                                                            </td>
                                                            <td className="py-2.5 px-2">
                                                                <div className="flex items-center gap-1">
                                                                    <button onClick={() => setModal({ type: 'tx', item: tx })} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Pencil size={14} /></button>
                                                                    <button onClick={() => handleDeleteTx(tx.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
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

                            {/* ── A Pagar ── */}
                            {tab === 'pagar' && (
                                <div className="space-y-3">
                                    <div className="flex justify-end">
                                        <button onClick={() => setModal({ type: 'pay' })}
                                            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
                                            <Plus size={16} /> Nova Conta a Pagar
                                        </button>
                                    </div>
                                    {payables.length === 0 ? (
                                        <div className="py-12 text-center text-slate-400 text-sm">Nenhuma conta a pagar.</div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-slate-100">
                                                        {['Vencimento', 'Descrição', 'Fornecedor', 'Categoria', 'Valor', 'Status', ''].map(h => (
                                                            <th key={h} className="text-left py-2 px-2 text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {payables.map(p => (
                                                        <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                                                            <td className={`py-2.5 px-2 whitespace-nowrap font-medium ${p.status === 'overdue' ? 'text-red-600' : 'text-slate-600'}`}>{fmtDate(p.due_date)}</td>
                                                            <td className="py-2.5 px-2 text-slate-800">{p.description}</td>
                                                            <td className="py-2.5 px-2 text-slate-500">{p.supplier_name ?? '—'}</td>
                                                            <td className="py-2.5 px-2 text-slate-500">{p.category?.name ?? '—'}</td>
                                                            <td className="py-2.5 px-2 font-semibold text-slate-800">{fmt(p.amount)}</td>
                                                            <td className="py-2.5 px-2">
                                                                <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[p.status] ?? ''}`}>{STATUS_LABELS[p.status] ?? p.status}</span>
                                                            </td>
                                                            <td className="py-2.5 px-2">
                                                                <div className="flex items-center gap-1">
                                                                    {['pending', 'overdue'].includes(p.status) && (
                                                                        <button onClick={() => handleMarkPaid(p.id)} title="Marcar como pago"
                                                                            className="p-1.5 rounded-lg hover:bg-green-50 text-green-500"><Check size={14} /></button>
                                                                    )}
                                                                    <button onClick={() => setModal({ type: 'pay', item: p })} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Pencil size={14} /></button>
                                                                    <button onClick={() => handleDeletePay(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
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

                            {/* ── A Receber ── */}
                            {tab === 'receber' && (
                                <div className="space-y-3">
                                    <div className="flex justify-end">
                                        <button onClick={() => setModal({ type: 'rec' })}
                                            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
                                            <Plus size={16} /> Nova Conta a Receber
                                        </button>
                                    </div>
                                    {receivables.length === 0 ? (
                                        <div className="py-12 text-center text-slate-400 text-sm">Nenhuma conta a receber.</div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-slate-100">
                                                        {['Vencimento', 'Descrição', 'Cliente', 'Valor', 'Status', ''].map(h => (
                                                            <th key={h} className="text-left py-2 px-2 text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {receivables.map(r => (
                                                        <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                                                            <td className={`py-2.5 px-2 whitespace-nowrap font-medium ${r.status === 'overdue' ? 'text-red-600' : 'text-slate-600'}`}>{fmtDate(r.due_date)}</td>
                                                            <td className="py-2.5 px-2 text-slate-800">{r.description}</td>
                                                            <td className="py-2.5 px-2 text-slate-500">{r.client_name ?? '—'}</td>
                                                            <td className="py-2.5 px-2 font-semibold text-green-700">{fmt(r.amount)}</td>
                                                            <td className="py-2.5 px-2">
                                                                <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[r.status] ?? ''}`}>{STATUS_LABELS[r.status] ?? r.status}</span>
                                                            </td>
                                                            <td className="py-2.5 px-2">
                                                                <div className="flex items-center gap-1">
                                                                    {['pending', 'overdue'].includes(r.status) && (
                                                                        <button onClick={() => handleMarkReceived(r.id)} title="Marcar como recebido"
                                                                            className="p-1.5 rounded-lg hover:bg-green-50 text-green-500"><Check size={14} /></button>
                                                                    )}
                                                                    <button onClick={() => setModal({ type: 'rec', item: r })} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Pencil size={14} /></button>
                                                                    <button onClick={() => handleDeleteRec(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
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

                            {/* ── Categorias ── */}
                            {tab === 'categorias' && (
                                <div className="space-y-4">
                                    <form onSubmit={handleAddCat} className="flex gap-2 items-end">
                                        <label className="flex-1">
                                            <span className="text-xs font-medium text-slate-600">Nome</span>
                                            <input required value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                                                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Nome da categoria" />
                                        </label>
                                        <label>
                                            <span className="text-xs font-medium text-slate-600">Tipo</span>
                                            <select value={catForm.type} onChange={e => setCatForm(f => ({ ...f, type: e.target.value as any }))}
                                                className="mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                                                <option value="receita">Receita</option>
                                                <option value="despesa">Despesa</option>
                                            </select>
                                        </label>
                                        <button type="submit" className="flex items-center gap-1 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                                            <Plus size={15} /> Adicionar
                                        </button>
                                        {categories.length === 0 && (
                                            <button type="button" onClick={handleSeedCats}
                                                className="flex items-center gap-1 border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm">
                                                Carregar padrões
                                            </button>
                                        )}
                                    </form>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {(['receita', 'despesa'] as const).map(type => (
                                            <div key={type} className={`rounded-xl border p-4 ${type === 'receita' ? 'border-green-100 bg-green-50/40' : 'border-red-100 bg-red-50/40'}`}>
                                                <h3 className={`text-sm font-semibold mb-3 ${type === 'receita' ? 'text-green-700' : 'text-red-700'}`}>
                                                    {type === 'receita' ? '↑ Receitas' : '↓ Despesas'}
                                                </h3>
                                                <div className="space-y-1">
                                                    {categories.filter(c => c.type === type).map(c => (
                                                        <div key={c.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                                                            <span className="text-sm text-slate-700">{c.name}</span>
                                                            <button onClick={() => handleDeleteCat(c.id)} className="p-1 hover:text-red-500 text-slate-300"><X size={14} /></button>
                                                        </div>
                                                    ))}
                                                    {categories.filter(c => c.type === type).length === 0 && (
                                                        <p className="text-xs text-slate-400 py-2">Nenhuma categoria.</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Modals */}
            {modal?.type === 'tx' && (
                <Modal title={modal.item ? 'Editar Lançamento' : 'Novo Lançamento'} onClose={() => setModal(null)}>
                    <TransactionForm companyId={companyId} categories={categories} initial={modal.item}
                        onSave={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
                </Modal>
            )}
            {modal?.type === 'pay' && (
                <Modal title={modal.item ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar'} onClose={() => setModal(null)}>
                    <PayableForm companyId={companyId} categories={categories} initial={modal.item}
                        onSave={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
                </Modal>
            )}
            {modal?.type === 'rec' && (
                <Modal title={modal.item ? 'Editar Conta a Receber' : 'Nova Conta a Receber'} onClose={() => setModal(null)}>
                    <ReceivableForm companyId={companyId} initial={modal.item}
                        onSave={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
                </Modal>
            )}
        </div>
    );
}
