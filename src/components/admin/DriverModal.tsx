import React, { useState } from 'react';
import { X } from 'lucide-react';
import { saveDraft, loadDraft, clearDraftStore } from '../../hooks/usePersistedForm';

const DRAFT_KEY = 'driver';
const EMPTY = {
    name: '', email: '', license_number: '', license_expiry: '', phone: '', status: 'available',
    aso_expiry: '', nr20_expiry: '', nr35_expiry: '', mopp_expiry: '',
};

interface DriverModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
    loading?: boolean;
}

export default function DriverModal({ isOpen, onClose, onSave, initialData, loading: externalLoading }: DriverModalProps) {
    const isEditing = !!(initialData && initialData.id);

    const [formData, setFormDataState] = useState<typeof EMPTY>(() => {
        if (isEditing) return { ...EMPTY, ...initialData };
        return { ...EMPTY, ...(loadDraft(DRAFT_KEY) || {}) };
    });
    const [loading, setLoading] = useState(false);

    React.useEffect(() => {
        if (!isOpen) return;
        if (isEditing && initialData) {
            setFormDataState({ ...EMPTY, ...initialData });
        } else if (!isEditing) {
            const draft = loadDraft(DRAFT_KEY);
            setFormDataState({ ...EMPTY, ...(draft || {}) });
        }
    }, [isOpen, initialData?.id]);

    function setFormData(partial: Partial<typeof EMPTY>) {
        setFormDataState((prev: typeof EMPTY) => {
            const next = { ...prev, ...partial };
            if (!isEditing) saveDraft(DRAFT_KEY, next);
            return next;
        });
    }

    if (!isOpen) return null;

    const labelStyle = "text-[10px] font-black text-[#8B95B1] uppercase tracking-widest ml-1 mb-1.5 block";
    const inputStyle = "w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Datas vazias viram null (colunas date não aceitam string vazia)
            const payload: any = {
                ...formData,
                license_expiry: formData.license_expiry || null,
                aso_expiry: formData.aso_expiry || null,
                nr20_expiry: formData.nr20_expiry || null,
                nr35_expiry: formData.nr35_expiry || null,
                mopp_expiry: formData.mopp_expiry || null,
            };
            await onSave(payload);
            clearDraftStore(DRAFT_KEY);
            setFormDataState({ ...EMPTY });
            onClose();
        } catch (error: any) {
            const msg = error?.message || error?.details || JSON.stringify(error);
            console.error('Error saving driver:', msg);
            alert(`Erro ao salvar motorista: ${msg}`);
        } finally {
            setLoading(false);
        }
    };

    const isSubmitting = loading || externalLoading;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-y-auto max-h-[95vh] animate-in zoom-in duration-200 custom-scrollbar border-none text-left">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h2 className="text-xl font-bold text-[#0F172A]">
                        {initialData?.id ? 'Editar Motorista' : 'Novo Motorista'}
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-50 rounded-xl text-slate-400 transition-all">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-4">
                    <div className="space-y-1">
                        <label className={labelStyle}>Nome Completo</label>
                        <input required className={inputStyle} placeholder="Ex: João da Silva"
                            maxLength={100}
                            value={formData.name} onChange={e => setFormData({ name: e.target.value })} />
                    </div>

                    <div className="space-y-1">
                        <label className={labelStyle}>Email (Login do Motorista) - Opcional</label>
                        <input type="email" className={inputStyle} placeholder="joao@exemplo.com"
                            maxLength={150}
                            value={formData.email} onChange={e => setFormData({ email: e.target.value })} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>CNH</label>
                            <input required className={inputStyle} placeholder="123456789"
                                maxLength={20}
                                value={formData.license_number} onChange={e => setFormData({ license_number: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>Vencimento CNH</label>
                            <input required type="date" className={inputStyle}
                                value={formData.license_expiry} onChange={e => setFormData({ license_expiry: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>Telefone</label>
                            <input required className={inputStyle} placeholder="(11) 99999-9999"
                                value={formData.phone} onChange={e => setFormData({ phone: e.target.value })} />
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Documentos de Conformidade</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className={labelStyle}>Venc. ASO</label>
                                <input type="date" className={inputStyle}
                                    value={formData.aso_expiry} onChange={e => setFormData({ aso_expiry: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <label className={labelStyle}>Venc. MOPP</label>
                                <input type="date" className={inputStyle}
                                    value={formData.mopp_expiry} onChange={e => setFormData({ mopp_expiry: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <label className={labelStyle}>Venc. NR20</label>
                                <input type="date" className={inputStyle}
                                    value={formData.nr20_expiry} onChange={e => setFormData({ nr20_expiry: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <label className={labelStyle}>Venc. NR35</label>
                                <input type="date" className={inputStyle}
                                    value={formData.nr35_expiry} onChange={e => setFormData({ nr35_expiry: e.target.value })} />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 px-6 py-3 rounded-xl font-bold text-xs uppercase text-slate-700 border border-slate-200 hover:bg-slate-50 transition-all outline-none">
                            Cancelar
                        </button>
                        <button type="submit" disabled={isSubmitting}
                            className="flex-1 bg-[#2563EB] text-white px-6 py-3 rounded-xl font-bold text-xs uppercase hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50">
                            {isSubmitting ? 'Salvando...' : 'Salvar Motorista'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
