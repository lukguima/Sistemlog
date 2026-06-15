import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { financingService } from '../../lib/financial.services';
import { fleetService } from '../../lib/services';
import { Plus, X, Pencil, Trash2, Check, ChevronDown, ChevronUp, CreditCard } from 'lucide-react';

const fmt = (v: number) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const fmtDate = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
const today = () => new Date().toISOString().split('T')[0];

const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    paid: 'bg-green-100 text-green-700',
    overdue: 'bg-red-100 text-red-700',
    active: 'bg-blue-100 text-blue-700',
    paid_off: 'bg-green-100 text-green-700',
    cancelled: 'bg-slate-100 text-slate-500',
};
const STATUS_LABELS: Record<string, string> = {
    pending: 'Pendente', paid: 'Pago', overdue: 'Vencida',
    active: 'Ativo', paid_off: 'Quitado', cancelled: 'Cancelado'
};

function Modal({ title, onClose, children }: any) {
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

function FinancingForm({ companyId, vehicles, initial, onSave, onClose }: any) {
    const [form, setForm] = useState({
        description: initial?.description ?? '',
        vehicle_id: initial?.vehicle_id ?? '',
        bank_name: initial?.bank_name ?? '',
        total_amount: initial?.total_amount ? String(initial.total_amount) : '',
        down_payment: initial?.down_payment ? String(initial.down_payment) : '0',
        interest_rate: initial?.interest_rate ? String(initial.interest_rate) : '0',
        installments: initial?.installments ? String(initial.installments) : '',
        installment_value: initial?.installment_value ? String(initial.installment_value) : '',
        start_date: initial?.start_date ?? today(),
        notes: initial?.notes ?? '',
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                ...form,
                company_id: companyId,
                vehicle_id: form.vehicle_id || null,
                total_amount: parseFloat(form.total_amount) || 0,
                down_payment: parseFloat(form.down_payment) || 0,
                interest_rate: parseFloat(form.interest_rate) || 0,
                installments: parseInt(form.installments) || 0,
                installment_value: parseFloat(form.installment_value) || 0,
            };
            if (initial?.id) {
                await financingService.update(initial.id, payload);
            } else {
                const created = await financingService.add(payload);
                await financingService.generateInstallments(
                    created.id, companyId, form.start_date,
                    parseInt(form.installments), parseFloat(form.installment_value)
                );
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
                        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Ex: Financiamento Volvo FH 460" />
                </label>
                <label>
                    <span className="text-xs font-medium text-slate-600">Veículo</span>
                    <select value={form.vehicle_id} onChange={e => setForm(f => ({ ...f, vehicle_id: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                        <option value="">— Sem vínculo —</option>
                        {vehicles.map((v: any) => <option key={v.id} value={v.id}>{v.plate} — {v.model ?? ''}</option>)}
                    </select>
                </label>
                <label>
                    <span className="text-xs font-medium text-slate-600">Banco/Financiadora</span>
                    <input value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Ex: Banco do Brasil" />
                </label>
                <label>
                    <span className="text-xs font-medium text-slate-600">Valor Total (R$) *</span>
                    <input required type="number" step="0.01" min="0" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </label>
                <label>
                    <span className="text-xs font-medium text-slate-600">Entrada (R$)</span>
                    <input type="number" step="0.01" min="0" value={form.down_payment} onChange={e => setForm(f => ({ ...f, down_payment: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </label>
                <label>
                    <span className="text-xs font-medium text-slate-600">Parcelas *</span>
                    <input required type="number" min="1" value={form.installments} onChange={e => setForm(f => ({ ...f, installments: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Ex: 60" />
                </label>
                <label>
                    <span className="text-xs font-medium text-slate-600">Valor da Parcela (R$) *</span>
                    <input required type="number" step="0.01" min="0" value={form.installment_value} onChange={e => setForm(f => ({ ...f, installment_value: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </label>
                <label>
                    <span className="text-xs font-medium text-slate-600">Taxa de Juros (% a.m.)</span>
                    <input type="number" step="0.01" min="0" value={form.interest_rate} onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </label>
                <label>
                    <span className="text-xs font-medium text-slate-600">1ª Parcela *</span>
                    <input required type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
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
                    {saving ? 'Salvando...' : initial?.id ? 'Salvar' : 'Cadastrar e Gerar Parcelas'}
                </button>
            </div>
        </form>
    );
}

function InstallmentsPanel({ financing }: { financing: any }) {
    const [installments, setInstallments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const data = await financingService.getInstallments(financing.id);
            setInstallments(data);
        } finally { setLoading(false); }
    };

    const handlePay = async (id: string) => {
        await financingService.markInstallmentPaid(id, today());
        load();
    };

    useEffect(() => { load(); }, [financing.id]);

    const paid = installments.filter(i => i.status === 'paid').length;
    const overdue = installments.filter(i => i.status === 'overdue').length;
    const remaining = installments.filter(i => ['pending', 'overdue'].includes(i.status)).reduce((s, i) => s + Number(i.amount), 0);

    return (
        <div className="mt-3 border border-slate-100 rounded-xl overflow-hidden">
            <div className="flex items-center gap-4 bg-slate-50 px-4 py-3 text-xs text-slate-500 font-medium border-b border-slate-100">
                <span>{paid}/{installments.length} pagas</span>
                {overdue > 0 && <span className="text-red-600 font-semibold">{overdue} vencida{overdue > 1 ? 's' : ''}</span>}
                <span className="ml-auto">Saldo restante: <strong className="text-slate-700">{fmt(remaining)}</strong></span>
            </div>
            {loading ? (
                <div className="py-8 text-center text-slate-400 text-sm">Carregando parcelas...</div>
            ) : (
                <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white">
                            <tr className="border-b border-slate-100">
                                {['Nº', 'Vencimento', 'Valor', 'Status', ''].map(h => (
                                    <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-slate-500">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {installments.map(inst => (
                                <tr key={inst.id} className="border-b border-slate-50 hover:bg-slate-50">
                                    <td className="py-2 px-3 text-slate-500 font-medium">{inst.number}</td>
                                    <td className={`py-2 px-3 ${inst.status === 'overdue' ? 'text-red-600 font-medium' : 'text-slate-600'}`}>{fmtDate(inst.due_date)}</td>
                                    <td className="py-2 px-3 font-medium text-slate-700">{fmt(inst.amount)}</td>
                                    <td className="py-2 px-3">
                                        <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[inst.status]}`}>{STATUS_LABELS[inst.status]}</span>
                                    </td>
                                    <td className="py-2 px-3">
                                        {['pending', 'overdue'].includes(inst.status) && (
                                            <button onClick={() => handlePay(inst.id)} title="Marcar como paga"
                                                className="p-1 rounded-lg hover:bg-green-50 text-green-500"><Check size={14} /></button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default function Financings() {
    const { user } = useAuth();
    const companyId = (user as any)?.company_id;
    const [financings, setFinancings] = useState<any[]>([]);
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<{ item?: any } | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);

    const load = async () => {
        if (!companyId) return;
        setLoading(true);
        try {
            const [fins, vehs] = await Promise.all([
                financingService.getAll(companyId),
                fleetService.getVehicles(companyId),
            ]);
            setFinancings(fins); setVehicles(vehs);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [companyId]);

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir este financiamento e todas as parcelas?')) return;
        await financingService.remove(id);
        load();
    };

    const totalMensal = financings.filter(f => f.status === 'active')
        .reduce((s, f) => s + Number(f.installment_value), 0);
    const totalDivida = financings.filter(f => f.status === 'active')
        .reduce((s, f) => s + Number(f.total_amount), 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Financiamentos</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Controle de parcelas e comprometimento financeiro</p>
                </div>
                <button onClick={() => setModal({})}
                    className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
                    <Plus size={16} /> Novo Financiamento
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                            <CreditCard size={18} className="text-blue-600" />
                        </div>
                        <p className="text-sm text-slate-500 font-medium">Financiamentos Ativos</p>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">{financings.filter(f => f.status === 'active').length}</p>
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                    <p className="text-xs text-slate-500 font-medium mb-1">Compromisso Mensal</p>
                    <p className="text-2xl font-bold text-red-600">{fmt(totalMensal)}</p>
                    <p className="text-xs text-slate-400 mt-1">soma das parcelas mensais</p>
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                    <p className="text-xs text-slate-500 font-medium mb-1">Dívida Total Ativa</p>
                    <p className="text-2xl font-bold text-slate-700">{fmt(totalDivida)}</p>
                    <p className="text-xs text-slate-400 mt-1">valor total financiado</p>
                </div>
            </div>

            {/* Lista */}
            <div className="space-y-3">
                {loading ? (
                    <div className="py-16 text-center text-slate-400 text-sm">Carregando...</div>
                ) : financings.length === 0 ? (
                    <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center text-slate-400 text-sm shadow-sm">
                        Nenhum financiamento cadastrado.
                    </div>
                ) : financings.map(f => (
                    <div key={f.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                        <div className="p-4 flex items-center gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold text-slate-800">{f.description}</p>
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[f.status]}`}>{STATUS_LABELS[f.status]}</span>
                                    {f.vehicle && (
                                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{f.vehicle.plate}</span>
                                    )}
                                </div>
                                <div className="flex gap-4 mt-1.5 text-xs text-slate-500 flex-wrap">
                                    {f.bank_name && <span>{f.bank_name}</span>}
                                    <span>{f.installments}x de <strong className="text-slate-700">{fmt(f.installment_value)}</strong></span>
                                    <span>Total: <strong className="text-slate-700">{fmt(f.total_amount)}</strong></span>
                                    <span>1ª parcela: {fmtDate(f.start_date)}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button onClick={() => setExpanded(expanded === f.id ? null : f.id)}
                                    className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 px-2 py-1 rounded-lg hover:bg-primary-50">
                                    Parcelas {expanded === f.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                                <button onClick={() => setModal({ item: f })} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Pencil size={14} /></button>
                                <button onClick={() => handleDelete(f.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
                            </div>
                        </div>
                        {expanded === f.id && (
                            <div className="px-4 pb-4">
                                <InstallmentsPanel financing={f} />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {modal && (
                <Modal title={modal.item ? 'Editar Financiamento' : 'Novo Financiamento'} onClose={() => setModal(null)}>
                    <FinancingForm companyId={companyId} vehicles={vehicles} initial={modal.item}
                        onSave={() => { setModal(null); load(); }} onClose={() => setModal(null)} />
                </Modal>
            )}
        </div>
    );
}
