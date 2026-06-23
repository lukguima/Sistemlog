import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { agregadoService } from '../../lib/services';
import { Plus, Pencil, Trash2, UserCheck, UserX, Truck, X, Save } from 'lucide-react';

const makeEmpty = () => ({
    name: '', document: '', phone: '', email: '',
    vehicle_plate: '', vehicle_model: '', status: 'active', notes: '',
});

export default function Agregados() {
    const { user } = useAuth();
    const companyId = (user as any)?.company_id ?? '';

    const [list, setList]         = useState<any[]>([]);
    const [loading, setLoading]   = useState(true);
    const [modal, setModal]       = useState(false);
    const [editing, setEditing]   = useState<any>(null);
    const [form, setForm]         = useState(makeEmpty());
    const [saving, setSaving]     = useState(false);

    const load = async () => {
        setLoading(true);
        try { setList(await agregadoService.getAll(companyId)); }
        catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (companyId) load(); }, [companyId]);

    const openNew = () => { setEditing(null); setForm(makeEmpty()); setModal(true); };
    const openEdit = (a: any) => {
        setEditing(a);
        setForm({
            name: a.name ?? '', document: a.document ?? '',
            phone: a.phone ?? '', email: a.email ?? '',
            vehicle_plate: a.vehicle_plate ?? '', vehicle_model: a.vehicle_model ?? '',
            status: a.status ?? 'active', notes: a.notes ?? '',
        });
        setModal(true);
    };

    const handleSave = async () => {
        if (!form.name.trim()) { alert('Nome é obrigatório.'); return; }
        setSaving(true);
        try {
            if (editing) {
                await agregadoService.update(editing.id, form);
            } else {
                await agregadoService.add({ ...form, company_id: companyId });
            }
            setModal(false);
            load();
        } catch (e: any) {
            alert(`Erro ao salvar: ${e.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir este agregado?')) return;
        try { await agregadoService.remove(id); load(); }
        catch (e: any) { alert(`Erro: ${e.message}`); }
    };

    const toggleStatus = async (a: any) => {
        const ns = a.status === 'active' ? 'inactive' : 'active';
        try { await agregadoService.update(a.id, { status: ns }); load(); }
        catch (e: any) { alert(`Erro: ${e.message}`); }
    };

    const inp = "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20";
    const lbl = "block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5";

    const active   = list.filter(a => a.status === 'active');
    const inactive = list.filter(a => a.status === 'inactive');

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                        <Truck size={20} className="text-violet-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Agregados</h1>
                        <p className="text-xs text-slate-500">Prestadores terceiros de frete</p>
                    </div>
                </div>
                <button onClick={openNew}
                    className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold uppercase px-5 py-2.5 rounded-xl shadow-md shadow-violet-200 transition-all">
                    <Plus size={14} /> Novo Agregado
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Total', value: list.length, color: 'bg-slate-50 text-slate-700' },
                    { label: 'Ativos', value: active.length, color: 'bg-emerald-50 text-emerald-700' },
                    { label: 'Inativos', value: inactive.length, color: 'bg-slate-100 text-slate-500' },
                ].map(k => (
                    <div key={k.label} className={`${k.color} rounded-2xl p-4 border border-black/5`}>
                        <p className="text-xs font-medium uppercase tracking-wide opacity-60 mb-1">{k.label}</p>
                        <p className="text-2xl font-black">{k.value}</p>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="w-8 h-8 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
                    </div>
                ) : list.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                        <Truck size={40} className="mx-auto mb-3 opacity-30" />
                        <p className="font-medium">Nenhum agregado cadastrado</p>
                        <p className="text-sm mt-1">Clique em "Novo Agregado" para começar.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wide">
                                    <th className="text-left px-5 py-3">Nome</th>
                                    <th className="text-left px-4 py-3">Documento</th>
                                    <th className="text-left px-4 py-3">Telefone</th>
                                    <th className="text-left px-4 py-3">Placa / Veículo</th>
                                    <th className="text-center px-4 py-3">Status</th>
                                    <th className="text-right px-4 py-3">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {list.map(a => (
                                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-3">
                                            <p className="font-semibold text-slate-900">{a.name}</p>
                                            {a.email && <p className="text-xs text-slate-400">{a.email}</p>}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{a.document || '—'}</td>
                                        <td className="px-4 py-3 text-slate-600">{a.phone || '—'}</td>
                                        <td className="px-4 py-3">
                                            {a.vehicle_plate
                                                ? <span className="font-mono font-semibold text-slate-800">{a.vehicle_plate}</span>
                                                : <span className="text-slate-300">—</span>}
                                            {a.vehicle_model && <span className="text-xs text-slate-400 ml-2">{a.vehicle_model}</span>}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${a.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {a.status === 'active' ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => toggleStatus(a)}
                                                    title={a.status === 'active' ? 'Inativar' : 'Ativar'}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors">
                                                    {a.status === 'active' ? <UserX size={15} /> : <UserCheck size={15} />}
                                                </button>
                                                <button onClick={() => openEdit(a)}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                                                    <Pencil size={15} />
                                                </button>
                                                <button onClick={() => handleDelete(a.id)}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {modal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-y-auto max-h-[95vh]">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                            <h2 className="text-lg font-bold text-slate-900">
                                {editing ? 'Editar Agregado' : 'Novo Agregado'}
                            </h2>
                            <button onClick={() => setModal(false)}
                                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className={lbl}>Nome *</label>
                                <input className={inp} value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="Nome completo ou razão social" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={lbl}>CPF / CNPJ</label>
                                    <input className={inp} value={form.document}
                                        onChange={e => setForm(f => ({ ...f, document: e.target.value }))}
                                        placeholder="000.000.000-00" />
                                </div>
                                <div>
                                    <label className={lbl}>Telefone</label>
                                    <input className={inp} value={form.phone}
                                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                        placeholder="(00) 00000-0000" />
                                </div>
                            </div>
                            <div>
                                <label className={lbl}>E-mail</label>
                                <input className={inp} type="email" value={form.email}
                                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                    placeholder="email@exemplo.com" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={lbl}>Placa do Caminhão</label>
                                    <input className={`${inp} uppercase`} value={form.vehicle_plate}
                                        onChange={e => setForm(f => ({ ...f, vehicle_plate: e.target.value.toUpperCase() }))}
                                        placeholder="ABC-1234" />
                                </div>
                                <div>
                                    <label className={lbl}>Modelo do Caminhão</label>
                                    <input className={inp} value={form.vehicle_model}
                                        onChange={e => setForm(f => ({ ...f, vehicle_model: e.target.value }))}
                                        placeholder="Scania R450" />
                                </div>
                            </div>
                            <div>
                                <label className={lbl}>Observações</label>
                                <textarea className={inp} rows={2} value={form.notes}
                                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                    placeholder="Informações adicionais..." />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setModal(false)}
                                    className="flex-1 border border-slate-200 rounded-xl py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                                    Cancelar
                                </button>
                                <button onClick={handleSave} disabled={saving}
                                    className="flex-1 bg-violet-600 hover:bg-violet-700 text-white rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                                    <Save size={15} />
                                    {saving ? 'Salvando...' : 'Salvar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
