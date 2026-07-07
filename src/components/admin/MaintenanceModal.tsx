import React, { useState, useEffect } from 'react';
import { X, Settings, Plus, Pencil, Trash2, Check, ChevronLeft } from 'lucide-react';
import { saveDraft, loadDraft, clearDraftStore } from '../../hooks/usePersistedForm';
import { preventiveTypesService } from '../../lib/services';

const DRAFT_KEY = 'maintenance';
const makeEmpty = () => ({
    vehicle_id: '', supplier_id: '', type: 'preventive',
    date: new Date().toISOString().split('T')[0], km: 0, cost: 0,
    description: '', workshop: '', notes: '', preventive_type: '',
    next_maintenance_km: 0, maintenance_interval: 0,
    next_maintenance_date: '', maintenance_interval_months: 12
});

const FALLBACK_TYPES = [
    { id: 'fb-oleo', value: 'oleo', name: 'Troca de Óleo', control_type: 'km', default_interval: 10000 },
    { id: 'fb-filtros', value: 'filtros', name: 'Filtros', control_type: 'km', default_interval: 10000 },
    { id: 'fb-freios', value: 'freios', name: 'Freios', control_type: 'km', default_interval: 50000 },
    { id: 'fb-correias', value: 'correias', name: 'Correias', control_type: 'km', default_interval: 80000 },
    { id: 'fb-revisao', value: 'revisao_geral', name: 'Revisão Geral', control_type: 'km', default_interval: 20000 },
    { id: 'fb-taco', value: 'tacografo', name: 'Aferição de Tacógrafo', control_type: 'date', default_interval: 24 },
];

function slugify(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
}

interface PreventiveType {
    id: string;
    value: string;
    name: string;
    control_type: string;
    default_interval: number;
}

interface MaintenanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    vehicles: any[];
    suppliers: any[];
    initialData?: any;
    companyId?: string;
}

export default function MaintenanceModal({ isOpen, onClose, onSave, vehicles, suppliers, initialData, companyId }: MaintenanceModalProps) {
    const isEditing = !!initialData;
    const [formData, setFormDataState] = useState(() => {
        if (isEditing) return { ...makeEmpty(), ...initialData, date: initialData?.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0] };
        return { ...makeEmpty(), ...(loadDraft(DRAFT_KEY) || {}) };
    });
    const [loading, setLoading] = useState(false);

    // Preventive types state
    const [preventiveTypes, setPreventiveTypes] = useState<PreventiveType[]>([]);
    const [typesLoading, setTypesLoading] = useState(false);
    const [showManage, setShowManage] = useState(false);

    // New type form
    const [newType, setNewType] = useState({ name: '', control_type: 'km', default_interval: 10000 });
    const [addingType, setAddingType] = useState(false);

    // Editing type inline
    const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
    const [editingTypeData, setEditingTypeData] = useState({ name: '', control_type: 'km', default_interval: 0 });

    React.useEffect(() => {
        if (!isOpen) return;
        if (isEditing && initialData) {
            setFormDataState({ ...makeEmpty(), ...initialData, date: initialData?.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0] });
        } else if (!isEditing) {
            const draft = loadDraft(DRAFT_KEY);
            setFormDataState({ ...makeEmpty(), ...(draft || {}) });
        }
    }, [isOpen, initialData?.id]);

    // Load preventive types when modal opens
    useEffect(() => {
        if (!isOpen || !companyId) return;
        loadTypes();
    }, [isOpen, companyId]);

    async function loadTypes() {
        if (!companyId) return;
        setTypesLoading(true);
        try {
            let types = await preventiveTypesService.getTypes(companyId);
            if (types.length === 0) {
                // Seed defaults on first use
                await preventiveTypesService.seedDefaults(companyId);
                types = await preventiveTypesService.getTypes(companyId);
            }
            setPreventiveTypes(types.length > 0 ? types : FALLBACK_TYPES);
        } catch {
            setPreventiveTypes(FALLBACK_TYPES);
        } finally {
            setTypesLoading(false);
        }
    }

    function setFormData(partial: Partial<ReturnType<typeof makeEmpty>>) {
        setFormDataState((prev: ReturnType<typeof makeEmpty>) => {
            const next = { ...prev, ...partial };
            if (!isEditing) saveDraft(DRAFT_KEY, next);
            return next;
        });
    }

    async function handleAddType() {
        if (!newType.name.trim() || !companyId) return;
        setAddingType(true);
        try {
            const value = slugify(newType.name);
            await preventiveTypesService.addType(companyId, {
                name: newType.name.trim(),
                value,
                control_type: newType.control_type,
                default_interval: Number(newType.default_interval),
            });
            setNewType({ name: '', control_type: 'km', default_interval: 10000 });
            await loadTypes();
        } catch (err) {
            console.error('Erro ao adicionar tipo:', err);
        } finally {
            setAddingType(false);
        }
    }

    async function handleDeleteType(id: string) {
        if (!confirm('Excluir este item?')) return;
        try {
            await preventiveTypesService.deleteType(id);
            setPreventiveTypes(prev => prev.filter(t => t.id !== id));
            // Clear selection if the deleted type was selected
            if (formData.preventive_type) {
                const deleted = preventiveTypes.find(t => t.id === id);
                if (deleted && deleted.value === formData.preventive_type) {
                    setFormData({ preventive_type: '' });
                }
            }
        } catch (err) {
            console.error('Erro ao excluir tipo:', err);
        }
    }

    function startEditType(type: PreventiveType) {
        setEditingTypeId(type.id);
        setEditingTypeData({ name: type.name, control_type: type.control_type, default_interval: type.default_interval });
    }

    async function handleSaveEditType() {
        if (!editingTypeId || !editingTypeData.name.trim()) return;
        try {
            const updated = await preventiveTypesService.updateType(editingTypeId, {
                name: editingTypeData.name.trim(),
                control_type: editingTypeData.control_type,
                default_interval: Number(editingTypeData.default_interval),
            });
            setPreventiveTypes(prev => prev.map(t => t.id === editingTypeId ? { ...t, ...updated } : t));
            setEditingTypeId(null);
        } catch (err) {
            console.error('Erro ao salvar tipo:', err);
        }
    }

    if (!isOpen) return null;

    const labelStyle = "text-[10px] font-black text-[#8B95B1] uppercase tracking-widest ml-1 mb-1.5 block";
    const inputStyle = "w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300 appearance-none";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSave(formData);
            clearDraftStore(DRAFT_KEY);
            setFormDataState(makeEmpty());
            setShowManage(false);
            onClose();
        } catch (error) {
            console.error('Error saving maintenance:', error);
        } finally {
            setLoading(false);
        }
    };

    const activeTypes = preventiveTypes.length > 0 ? preventiveTypes : FALLBACK_TYPES;
    const selectedType = activeTypes.find(t => t.value === formData.preventive_type);
    const isDateBased = selectedType?.control_type === 'date';

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-y-auto max-h-[95vh] animate-in zoom-in duration-200 custom-scrollbar border-none">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h2 className="text-xl font-bold text-[#0F172A]">
                        {initialData ? 'Editar Manutenção' : 'Nova Manutenção'}
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-50 rounded-xl text-slate-400 transition-all">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>Veículo</label>
                            <select
                                required
                                className={inputStyle}
                                value={formData.vehicle_id}
                                onChange={e => {
                                    const vId = e.target.value;
                                    const vehicle = vehicles.find(v => v.id === vId);
                                    setFormData({
                                        ...formData,
                                        vehicle_id: vId,
                                        km: vehicle?.current_km || 0
                                    });
                                }}
                            >
                                <option value="">Selecione o Veículo</option>
                                <optgroup label="Caminhões">
                                    {vehicles.filter(v => v.category !== 'implemento').map(v => (
                                        <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>
                                    ))}
                                </optgroup>
                                {vehicles.some(v => v.category === 'implemento') && (
                                    <optgroup label="Implementos">
                                        {vehicles.filter(v => v.category === 'implemento').map(v => (
                                            <option key={v.id} value={v.id}>{v.plate} - {v.implement_type || v.model}</option>
                                        ))}
                                    </optgroup>
                                )}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>Tipo de Manutenção</label>
                            <select
                                required
                                className={inputStyle}
                                value={formData.type}
                                onChange={e => setFormData({ ...formData, type: e.target.value })}
                            >
                                <option value="preventive">Preventiva</option>
                                <option value="corrective">Corretiva</option>
                                <option value="oil">Troca de Óleo</option>
                                <option value="tyres">Pneus</option>
                                <option value="mechanical">Mecânica Geral</option>
                                <option value="electrical">Elétrica</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>Data da Manutenção</label>
                            <input
                                required
                                type="date"
                                className={inputStyle}
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>Oficina / Fornecedor</label>
                            <select
                                required
                                className={inputStyle}
                                value={formData.supplier_id}
                                onChange={e => {
                                    const sId = e.target.value;
                                    const supplier = suppliers.find(s => s.id === sId);
                                    setFormData({
                                        ...formData,
                                        supplier_id: sId,
                                        workshop: supplier ? supplier.name : ''
                                    });
                                }}
                            >
                                <option value="">Selecione Fornecedor</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.category})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {formData.type === 'preventive' && (
                        <div className="p-6 bg-blue-50/50 rounded-[1.5rem] border border-blue-100/50 space-y-4 animate-in slide-in-from-top-2 duration-300">
                            <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest ml-1">Controle de Preventiva</p>

                            {!showManage ? (
                                <>
                                    {/* Item select + manage button */}
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-[10px] font-black text-[#8B95B1] uppercase tracking-widest ml-1">Item</label>
                                            <button
                                                type="button"
                                                onClick={() => setShowManage(true)}
                                                className="flex items-center gap-1 text-[10px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-700 transition-colors"
                                            >
                                                <Settings size={12} />
                                                Gerenciar
                                            </button>
                                        </div>
                                        <select
                                            className={inputStyle}
                                            value={formData.preventive_type}
                                            disabled={typesLoading}
                                            onChange={e => {
                                                const val = e.target.value;
                                                const type = activeTypes.find(t => t.value === val);
                                                if (type?.control_type === 'date') {
                                                    const base = formData.date || new Date().toISOString().split('T')[0];
                                                    const next = new Date(base);
                                                    next.setMonth(next.getMonth() + (type.default_interval || 12));
                                                    setFormData({
                                                        ...formData,
                                                        preventive_type: val,
                                                        maintenance_interval_months: type.default_interval || 12,
                                                        next_maintenance_date: next.toISOString().split('T')[0]
                                                    });
                                                } else {
                                                    setFormData({
                                                        ...formData,
                                                        preventive_type: val,
                                                        maintenance_interval: type?.default_interval || 0,
                                                        next_maintenance_km: formData.km + (type?.default_interval || 0)
                                                    });
                                                }
                                            }}
                                        >
                                            <option value="">Selecione...</option>
                                            {activeTypes.map(t => (
                                                <option key={t.id} value={t.value}>{t.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Interval fields */}
                                    {formData.preventive_type && (
                                        <div className="grid grid-cols-2 gap-4">
                                            {isDateBased ? (
                                                <>
                                                    <div className="space-y-1">
                                                        <label className={labelStyle}>Intervalo (Meses)</label>
                                                        <input
                                                            type="number"
                                                            className={inputStyle}
                                                            placeholder="12"
                                                            min={1}
                                                            max={120}
                                                            value={formData.maintenance_interval_months}
                                                            onChange={e => {
                                                                const months = Number(e.target.value);
                                                                const base = formData.date || new Date().toISOString().split('T')[0];
                                                                const next = new Date(base);
                                                                next.setMonth(next.getMonth() + months);
                                                                setFormData({
                                                                    ...formData,
                                                                    maintenance_interval_months: months,
                                                                    next_maintenance_date: next.toISOString().split('T')[0]
                                                                });
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className={labelStyle}>Próxima Aferição</label>
                                                        <input
                                                            type="date"
                                                            className={`${inputStyle} font-bold text-blue-600`}
                                                            value={formData.next_maintenance_date}
                                                            onChange={e => setFormData({ ...formData, next_maintenance_date: e.target.value })}
                                                        />
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="space-y-1">
                                                        <label className={labelStyle}>Intervalo (KM)</label>
                                                        <input
                                                            type="number"
                                                            className={inputStyle}
                                                            placeholder="10000"
                                                            min={0}
                                                            max={999999}
                                                            value={formData.maintenance_interval}
                                                            onChange={e => {
                                                                const interval = Number(e.target.value);
                                                                setFormData({
                                                                    ...formData,
                                                                    maintenance_interval: interval,
                                                                    next_maintenance_km: formData.km + interval
                                                                });
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className={labelStyle}>Próxima Manut.</label>
                                                        <input
                                                            type="number"
                                                            className={`${inputStyle} font-bold text-blue-600`}
                                                            min={0}
                                                            max={9999999}
                                                            value={formData.next_maintenance_km}
                                                            onChange={e => setFormData({ ...formData, next_maintenance_km: Number(e.target.value) })}
                                                        />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : (
                                /* Manage panel */
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <button
                                            type="button"
                                            onClick={() => { setShowManage(false); setEditingTypeId(null); }}
                                            className="flex items-center gap-1 text-[10px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-700 transition-colors"
                                        >
                                            <ChevronLeft size={12} />
                                            Voltar
                                        </button>
                                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Gerenciar Itens</span>
                                    </div>

                                    {/* List of types */}
                                    <div className="space-y-2">
                                        {activeTypes.map(type => (
                                            <div key={type.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                                {editingTypeId === type.id ? (
                                                    /* Inline edit row */
                                                    <div className="p-3 space-y-2">
                                                        <input
                                                            type="text"
                                                            className="w-full border border-blue-300 rounded-lg px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                                            value={editingTypeData.name}
                                                            onChange={e => setEditingTypeData(p => ({ ...p, name: e.target.value }))}
                                                            placeholder="Nome do item"
                                                        />
                                                        <div className="flex gap-2">
                                                            <select
                                                                className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 focus:outline-none"
                                                                value={editingTypeData.control_type}
                                                                onChange={e => setEditingTypeData(p => ({ ...p, control_type: e.target.value }))}
                                                            >
                                                                <option value="km">Por KM</option>
                                                                <option value="date">Por Data</option>
                                                            </select>
                                                            <input
                                                                type="number"
                                                                className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 focus:outline-none"
                                                                value={editingTypeData.default_interval}
                                                                onChange={e => setEditingTypeData(p => ({ ...p, default_interval: Number(e.target.value) }))}
                                                                placeholder={editingTypeData.control_type === 'km' ? 'Intervalo KM' : 'Intervalo Meses'}
                                                            />
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={handleSaveEditType}
                                                                className="flex-1 bg-blue-600 text-white rounded-lg py-1.5 text-xs font-black flex items-center justify-center gap-1 hover:bg-blue-700 transition-colors"
                                                            >
                                                                <Check size={12} /> Salvar
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingTypeId(null)}
                                                                className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-1.5 text-xs font-black hover:bg-slate-50 transition-colors"
                                                            >
                                                                Cancelar
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    /* Normal row */
                                                    <div className="flex items-center gap-3 px-3 py-2.5">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold text-slate-800 truncate">{type.name}</p>
                                                            <p className="text-[10px] text-slate-400 font-medium">
                                                                {type.control_type === 'km'
                                                                    ? `Por KM · padrão ${Number(type.default_interval).toLocaleString('pt-BR')} km`
                                                                    : `Por Data · padrão ${type.default_interval} meses`}
                                                            </p>
                                                        </div>
                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${type.control_type === 'km' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                                                            {type.control_type === 'km' ? 'KM' : 'DATA'}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => startEditType(type)}
                                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        >
                                                            <Pencil size={13} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteType(type.id)}
                                                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Add new type form */}
                                    <div className="bg-white rounded-xl border border-dashed border-blue-200 p-4 space-y-3">
                                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1">
                                            <Plus size={12} /> Novo Item
                                        </p>
                                        <input
                                            type="text"
                                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-300"
                                            placeholder="Nome do item (ex: Troca de Filtro de Ar)"
                                            value={newType.name}
                                            onChange={e => setNewType(p => ({ ...p, name: e.target.value }))}
                                        />
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className={labelStyle}>Controle</label>
                                                <select
                                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none appearance-none"
                                                    value={newType.control_type}
                                                    onChange={e => setNewType(p => ({ ...p, control_type: e.target.value }))}
                                                >
                                                    <option value="km">Por KM</option>
                                                    <option value="date">Por Data</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className={labelStyle}>{newType.control_type === 'km' ? 'Intervalo KM' : 'Intervalo Meses'}</label>
                                                <input
                                                    type="number"
                                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none"
                                                    placeholder={newType.control_type === 'km' ? '10000' : '12'}
                                                    min={1}
                                                    value={newType.default_interval}
                                                    onChange={e => setNewType(p => ({ ...p, default_interval: Number(e.target.value) }))}
                                                />
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleAddType}
                                            disabled={addingType || !newType.name.trim()}
                                            className="w-full bg-blue-600 text-white rounded-xl py-2.5 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors disabled:opacity-50"
                                        >
                                            <Plus size={14} />
                                            {addingType ? 'Adicionando...' : 'Adicionar Item'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>KM Atual</label>
                            <input
                                required
                                type="number"
                                className={inputStyle}
                                placeholder="0"
                                min={0}
                                max={9999999}
                                value={formData.km}
                                onChange={e => setFormData({ ...formData, km: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>Custo (R$)</label>
                            <input
                                required
                                type="number"
                                step="0.01"
                                className={inputStyle}
                                placeholder="0,00"
                                min={0}
                                max={9999999}
                                value={formData.cost}
                                onChange={e => setFormData({ ...formData, cost: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className={labelStyle}>Descrição / Observação</label>
                        <textarea
                            className={`${inputStyle} h-20 resize-none py-3`}
                            placeholder="Descreva o que foi feito..."
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    {!showManage && (
                        <div className="flex gap-4 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-6 py-3 rounded-xl font-bold text-xs uppercase text-slate-700 border border-slate-200 hover:bg-slate-50 transition-all outline-none"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 bg-[#2563EB] text-white px-6 py-3 rounded-xl font-bold text-xs uppercase hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50"
                            >
                                {loading ? 'Salvando...' : 'Salvar Manutenção'}
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
