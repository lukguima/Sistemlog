import React from 'react';
import { X } from 'lucide-react';
import { supplierService } from '../../lib/services';
import { useAuth } from '../../context/AuthContext';
import { usePersistedForm } from '../../hooks/usePersistedForm';

interface SupplierModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    supplier?: any;
}

export default function SupplierModal({ isOpen, onClose, onSave, supplier }: SupplierModalProps) {
    const { user } = useAuth();
    const isEditing = !!supplier;

    const initialState = {
        name: supplier?.name || '',
        category: supplier?.category || 'Outros',
        document: supplier?.document || '',
        phone: supplier?.phone || '',
        email: supplier?.email || '',
        address: supplier?.address || '',
        city: supplier?.city || '',
        state: supplier?.state || '',
        company_id: (user as any)?.company_id
    };

    const { formData, setFormData, clearDraft } = usePersistedForm(
        'supplier',
        initialState,
        isEditing
    );

    const [loading, setLoading] = React.useState(false);

    if (!isOpen) return null;

    const labelStyle = "text-[10px] font-black text-[#8B95B1] uppercase tracking-widest ml-1 mb-1.5 block";
    const inputStyle = "w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300 appearance-none";

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        try {
            setLoading(true);
            if (supplier) {
                await supplierService.updateSupplier(supplier.id, { ...formData, company_id: (user as any)?.company_id });
            } else {
                await supplierService.addSupplier({ ...formData, company_id: (user as any)?.company_id });
                clearDraft();
            }
            onSave();
            onClose();
        } catch (error) {
            console.error('Error saving supplier:', error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-y-auto max-h-[95vh] animate-in zoom-in duration-200 custom-scrollbar border-none text-left">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h2 className="text-xl font-bold text-[#0F172A]">
                        {supplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-50 rounded-xl text-slate-400 transition-all">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-4">
                    <div className="space-y-1">
                        <label className={labelStyle}>Nome da Empresa / Fantasia</label>
                        <input
                            required
                            className={inputStyle}
                            placeholder="Ex: Posto do Caminhoneiro"
                            value={formData.name}
                            onChange={e => setFormData({ name: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>Categoria</label>
                            <select
                                required
                                className={inputStyle}
                                value={formData.category}
                                onChange={e => setFormData({ category: e.target.value })}
                            >
                                <option value="">Selecione...</option>
                                <option value="Combustível">Combustível</option>
                                <option value="Manutenção">Manutenção</option>
                                <option value="Peças">Peças</option>
                                <option value="Outros">Outros</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>CNPJ / CPF</label>
                            <input
                                className={inputStyle}
                                placeholder="00.000.000/0001-00"
                                value={formData.document}
                                onChange={e => setFormData({ document: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>Telefone</label>
                            <input
                                type="text"
                                className={inputStyle}
                                value={formData.phone}
                                onChange={e => setFormData({ phone: e.target.value })}
                                placeholder="(00) 00000-0000"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>E-mail</label>
                            <input
                                type="email"
                                className={inputStyle}
                                value={formData.email}
                                onChange={e => setFormData({ email: e.target.value })}
                                placeholder="contato@fornecedor.com"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className={labelStyle}>Endereço Completo</label>
                        <input
                            type="text"
                            className={inputStyle}
                            value={formData.address}
                            onChange={e => setFormData({ address: e.target.value })}
                            placeholder="Rua, Número, Bairro..."
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>Cidade</label>
                            <input
                                type="text"
                                className={inputStyle}
                                value={formData.city}
                                onChange={e => setFormData({ city: e.target.value })}
                                placeholder="Ex: São Paulo"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>Estado (UF)</label>
                            <input
                                type="text"
                                className={inputStyle}
                                value={formData.state}
                                onChange={e => setFormData({ state: e.target.value.toUpperCase() })}
                                maxLength={2}
                                placeholder="UF"
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
                            disabled={loading}
                            className="flex-1 bg-[#2563EB] text-white px-6 py-3 rounded-xl font-bold text-xs uppercase hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50"
                        >
                            {loading ? 'Salvando...' : supplier ? 'Atualizar' : 'Cadastrar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
