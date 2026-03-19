import React, { useState } from 'react';
import { X } from 'lucide-react';
import { usePersistedForm } from '../../hooks/usePersistedForm';

interface DriverModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
    loading?: boolean;
}

export default function DriverModal({ isOpen, onClose, onSave, initialData, loading: externalLoading }: DriverModalProps) {
    const isEditing = !!(initialData && initialData.id);
    const initialState = {
        name: initialData?.name || '',
        email: initialData?.email || '',
        license_number: initialData?.license_number || '',
        license_expiry: initialData?.license_expiry || '',
        phone: initialData?.phone || '',
        status: initialData?.status || 'available'
    };
    const { formData, setFormData, clearDraft } = usePersistedForm('driver', initialState, isEditing);
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const labelStyle = "text-[10px] font-black text-[#8B95B1] uppercase tracking-widest ml-1 mb-1.5 block";
    const inputStyle = "w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSave(formData);
            clearDraft();
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
                        <input
                            required
                            className={inputStyle}
                            placeholder="Ex: João da Silva"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div className="space-y-1">
                        <label className={labelStyle}>Email (Login do Motorista) - Opcional</label>
                        <input
                            type="email"
                            className={inputStyle}
                            placeholder="joao@exemplo.com"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>CNH</label>
                            <input
                                required
                                className={inputStyle}
                                placeholder="123456789"
                                value={formData.license_number}
                                onChange={e => setFormData({ ...formData, license_number: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>Vencimento CNH</label>
                            <input
                                required
                                type="date"
                                className={inputStyle}
                                value={formData.license_expiry}
                                onChange={e => setFormData({ ...formData, license_expiry: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>Telefone</label>
                            <input
                                required
                                className={inputStyle}
                                placeholder="(11) 99999-9999"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
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
                            disabled={isSubmitting}
                            className="flex-1 bg-[#2563EB] text-white px-6 py-3 rounded-xl font-bold text-xs uppercase hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50"
                        >
                            {isSubmitting ? 'Salvando...' : 'Salvar Motorista'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
