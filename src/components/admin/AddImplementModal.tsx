import { useState, useEffect } from 'react';
import { X, Container } from 'lucide-react';
import { IMPLEMENT_TYPE_OPTIONS } from '../../lib/constants';

interface AddImplementModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
}

const makeEmpty = () => ({
    plate: '',
    implement_type: '',
    model: '',
    year: new Date().getFullYear(),
    axle_count: 0,
    tyre_count: 0,
    insurance_value: 0,
    document_expiry: '',
    antt_expiry: '',
});

export default function AddImplementModal({ isOpen, onClose, onSave, initialData }: AddImplementModalProps) {
    const isEditing = !!initialData;
    const [formData, setFormData] = useState(makeEmpty());
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isEditing && initialData) {
            setFormData({ ...makeEmpty(), ...initialData });
        } else {
            setFormData(makeEmpty());
        }
    }, [isOpen, initialData?.id]);

    if (!isOpen) return null;

    const labelStyle = "text-[10px] font-black text-[#8B95B1] uppercase tracking-widest ml-1 mb-1.5 block";
    const inputStyle = "w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300 appearance-none";

    const set = (partial: Partial<ReturnType<typeof makeEmpty>>) => setFormData(prev => ({ ...prev, ...partial }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.plate.trim()) { alert('Informe a placa do implemento.'); return; }
        if (!formData.implement_type) { alert('Selecione o tipo do implemento.'); return; }
        setLoading(true);
        try {
            const payload = {
                category: 'implemento',
                plate: formData.plate.toUpperCase().trim(),
                implement_type: formData.implement_type,
                model: formData.model || formData.implement_type,
                year: Number(formData.year) || new Date().getFullYear(),
                axle_count: Number(formData.axle_count) || 0,
                tyre_count: Number(formData.tyre_count) || 0,
                insurance_value: Number(formData.insurance_value) || 0,
                document_expiry: formData.document_expiry || null,
                antt_expiry: formData.antt_expiry || null,
            };
            await onSave(payload);
            setFormData(makeEmpty());
            onClose();
        } catch (error: any) {
            console.error('Error saving implement:', error);
            alert(`Erro ao salvar implemento: ${error.message || 'Erro desconhecido'}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-y-auto max-h-[95vh] animate-in zoom-in duration-200 custom-scrollbar border-none">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-3">
                        <div className="p-2 bg-violet-50 text-violet-600 rounded-xl">
                            <Container size={20} />
                        </div>
                        {isEditing ? 'Editar Implemento' : 'Novo Implemento'}
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-50 rounded-xl text-slate-400 transition-all">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>Placa *</label>
                            <input required className={`${inputStyle} font-mono uppercase`} placeholder="ABC-1D23"
                                value={formData.plate} onChange={e => set({ plate: e.target.value.toUpperCase() })} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>Tipo *</label>
                            <select required className={inputStyle}
                                value={formData.implement_type} onChange={e => set({ implement_type: e.target.value })}>
                                <option value="">Selecione...</option>
                                {IMPLEMENT_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>Modelo / Descrição</label>
                            <input className={inputStyle} placeholder="Ex: Randon 3 eixos"
                                value={formData.model} onChange={e => set({ model: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>Ano</label>
                            <input type="number" className={inputStyle}
                                value={formData.year} onChange={e => set({ year: Number(e.target.value) })} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>Nº de Eixos</label>
                            <input type="number" min={0} className={inputStyle}
                                value={formData.axle_count} onChange={e => set({ axle_count: Number(e.target.value) })} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>Nº de Pneus</label>
                            <input type="number" min={0} className={inputStyle}
                                value={formData.tyre_count} onChange={e => set({ tyre_count: Number(e.target.value) })} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>Venc. Documento (CRLV)</label>
                            <input type="date" className={inputStyle}
                                value={formData.document_expiry || ''} onChange={e => set({ document_expiry: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>Venc. ANTT</label>
                            <input type="date" className={inputStyle}
                                value={formData.antt_expiry || ''} onChange={e => set({ antt_expiry: e.target.value })} />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className={labelStyle}>Valor do Seguro (R$/ano)</label>
                        <input type="number" step="0.01" min={0} className={inputStyle} placeholder="0,00"
                            value={formData.insurance_value} onChange={e => set({ insurance_value: Number(e.target.value) })} />
                    </div>

                    <div className="flex gap-4 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 px-6 py-3 rounded-xl font-bold text-xs uppercase text-slate-700 border border-slate-200 hover:bg-slate-50 transition-all outline-none">
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading}
                            className="flex-1 bg-violet-600 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase hover:bg-violet-700 transition-all shadow-lg shadow-violet-500/25 disabled:opacity-50">
                            {loading ? 'Salvando...' : isEditing ? 'Salvar' : 'Cadastrar Implemento'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
