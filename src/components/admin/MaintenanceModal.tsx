import React, { useState } from 'react';
import { X } from 'lucide-react';
import { saveDraft, loadDraft, clearDraftStore } from '../../hooks/usePersistedForm';

const DRAFT_KEY = 'maintenance';
const makeEmpty = () => ({
    vehicle_id: '', supplier_id: '', type: 'preventive',
    date: new Date().toISOString().split('T')[0], km: 0, cost: 0,
    description: '', workshop: '', notes: '', preventive_type: '',
    next_maintenance_km: 0, maintenance_interval: 0
});

interface MaintenanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    vehicles: any[];
    suppliers: any[];
    initialData?: any;
}

export default function MaintenanceModal({ isOpen, onClose, onSave, vehicles, suppliers, initialData }: MaintenanceModalProps) {
    const isEditing = !!initialData;
    const [formData, setFormDataState] = useState(() => {
        if (isEditing) return { ...makeEmpty(), ...initialData, date: initialData?.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0] };
        return { ...makeEmpty(), ...(loadDraft(DRAFT_KEY) || {}) };
    });
    const [loading, setLoading] = useState(false);

    React.useEffect(() => {
        if (isEditing && initialData) setFormDataState({ ...makeEmpty(), ...initialData, date: initialData?.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0] });
    }, [initialData?.id]);

    function setFormData(partial: Partial<ReturnType<typeof makeEmpty>>) {
        setFormDataState((prev: ReturnType<typeof makeEmpty>) => {
            const next = { ...prev, ...partial };
            if (!isEditing) saveDraft(DRAFT_KEY, next);
            return next;
        });
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
            onClose();
        } catch (error) {
            console.error('Error saving maintenance:', error);
        } finally {
            setLoading(false);
        }
    };

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
                                {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>)}
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
                        <div className="p-8 bg-blue-50/50 rounded-[1.5rem] border border-blue-100/50 space-y-6 animate-in slide-in-from-top-2 duration-300">
                            <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest ml-1">Controle de Preventiva</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <label className={labelStyle}>Item</label>
                                    <select
                                        className={inputStyle}
                                        value={formData.preventive_type}
                                        onChange={e => setFormData({ ...formData, preventive_type: e.target.value })}
                                    >
                                        <option value="">Selecione...</option>
                                        <option value="oleo">Troca de Óleo</option>
                                        <option value="filtros">Filtros</option>
                                        <option value="freios">Freios</option>
                                        <option value="correias">Correias</option>
                                        <option value="revisao_geral">Revisão Geral</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className={labelStyle}>Intervalo (KM)</label>
                                    <input
                                        type="number"
                                        className={inputStyle}
                                        placeholder="10000"
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
                                        className={`${inputStyle} bg-white-50 font-bold text-blue-600`}
                                        value={formData.next_maintenance_km}
                                        onChange={e => setFormData({ ...formData, next_maintenance_km: Number(e.target.value) })}
                                    />
                                </div>
                            </div>
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
                </form>
            </div>
        </div>
    );
}
