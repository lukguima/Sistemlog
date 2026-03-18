import { useState, useEffect } from 'react';
import { X, Calendar, DollarSign, FileText } from 'lucide-react';
import { generateAdvanceReceipt } from '../../lib/pdfGenerator';

interface Driver {
    id: string;
    name: string;
}

interface AddAdvanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    drivers: Driver[];
    initialData?: any;
}

export default function AddAdvanceModal({ isOpen, onClose, onSave, drivers, initialData }: AddAdvanceModalProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        driver_id: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: ''
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                driver_id: initialData.driver_id || '',
                amount: initialData.amount || '',
                date: initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                description: initialData.description || ''
            });
        } else {
            setFormData({
                driver_id: '',
                amount: '',
                date: new Date().toISOString().split('T')[0],
                description: ''
            });
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const labelStyle = "text-[10px] font-black text-[#8B95B1] uppercase tracking-widest ml-1 mb-1.5 block";
    const inputStyle = "w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300 appearance-none";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.driver_id) {
            alert('Selecione um motorista');
            return;
        }
        setLoading(true);
        try {
            await onSave({
                ...formData,
                amount: parseFloat(formData.amount),
                status: initialData ? initialData.status : 'pending'
            });

            const driver = drivers.find(d => d.id === formData.driver_id);
            if (!initialData) { 
                generateAdvanceReceipt({
                    driverName: driver?.name || 'Motorista',
                    amount: parseFloat(formData.amount),
                    date: formData.date,
                    description: formData.description
                });
            }

            onClose();
        } catch (error: any) {
            console.error('Error saving advance:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-y-auto max-h-[95vh] animate-in zoom-in duration-200 custom-scrollbar border-none">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h2 className="text-xl font-bold text-[#0F172A]">
                        {initialData ? 'Editar Adiantamento' : 'Novo Adiantamento'}
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-50 rounded-xl text-slate-400 transition-all">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-4">
                    <div className="space-y-1">
                        <label className={labelStyle}>Motorista</label>
                        <select
                            required
                            className={inputStyle}
                            value={formData.driver_id}
                            onChange={e => setFormData({ ...formData, driver_id: e.target.value })}
                        >
                            <option value="">Selecione o motorista...</option>
                            {drivers.map(driver => (
                                <option key={driver.id} value={driver.id}>{driver.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>Valor (R$)</label>
                            <div className="relative">
                                <DollarSign size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    required
                                    type="number"
                                    step="0.01"
                                    className={`${inputStyle} pl-10`}
                                    placeholder="0,00"
                                    value={formData.amount}
                                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className={labelStyle}>Data</label>
                            <div className="relative">
                                <Calendar size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    required
                                    type="date"
                                    className={`${inputStyle} pl-10`}
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className={labelStyle}>Observação / Descrição</label>
                        <textarea
                            className={`${inputStyle} h-20 resize-none py-3`}
                            placeholder="Ex: Vale Combustível, Adiantamento para viagem..."
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
                            className="flex-1 bg-[#2563EB] text-white px-6 py-3 rounded-xl font-bold text-xs uppercase hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                'Salvando...'
                            ) : (
                                <>
                                    <FileText size={16} />
                                    {initialData ? 'Salvar' : 'Salvar e Gerar Recibo'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
