import React, { useState } from 'react';
import { X } from 'lucide-react';
import { clientService } from '../../lib/services';
import { useAuth } from '../../context/AuthContext';
import { saveDraft, loadDraft, clearDraftStore } from '../../hooks/usePersistedForm';

const DRAFT_KEY = 'client';

interface ClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    client?: any;
    /** Prefill ao criar a partir de um destino da análise */
    defaultDestinationPrefill?: string;
}

const EMPTY = {
    name: '',
    document: '',
    phone: '',
    email: '',
    default_destination: '',
    notes: '',
    active: true,
};

export default function ClientModal({ isOpen, onClose, onSave, client, defaultDestinationPrefill }: ClientModalProps) {
    const { user } = useAuth();
    const isEditing = !!client;

    const [formData, setFormDataState] = useState(() => {
        if (isEditing) return { ...EMPTY, ...client };
        return { ...EMPTY, ...(loadDraft(DRAFT_KEY) || {}) };
    });
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    React.useEffect(() => {
        if (!isOpen) return;
        setErrorMsg('');
        if (isEditing && client) {
            setFormDataState({ ...EMPTY, ...client, active: client.active !== false });
        } else {
            const draft = loadDraft(DRAFT_KEY);
            setFormDataState({
                ...EMPTY,
                ...(draft || {}),
                ...(defaultDestinationPrefill
                    ? {
                        default_destination: defaultDestinationPrefill,
                        name: (draft as any)?.name || defaultDestinationPrefill,
                    }
                    : {}),
            });
        }
    }, [isOpen, client?.id, defaultDestinationPrefill]);

    function setFormData(partial: Partial<typeof EMPTY>) {
        setFormDataState((prev: typeof EMPTY) => {
            const next = { ...prev, ...partial };
            if (!isEditing) saveDraft(DRAFT_KEY, next);
            return next;
        });
    }

    if (!isOpen) return null;

    const labelStyle = 'text-[10px] font-black text-[#8B95B1] uppercase tracking-widest ml-1 mb-1.5 block';
    const inputStyle = 'w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all placeholder:text-slate-300 appearance-none';

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formData.name.trim()) {
            setErrorMsg('Informe o nome do cliente.');
            return;
        }
        try {
            setLoading(true);
            setErrorMsg('');
            const payload = {
                name: formData.name.trim(),
                document: formData.document.trim() || null,
                phone: formData.phone.trim() || null,
                email: formData.email.trim() || null,
                default_destination: formData.default_destination.trim() || null,
                notes: formData.notes.trim() || null,
                active: formData.active !== false,
                company_id: (user as any)?.company_id,
            };
            if (client) {
                await clientService.updateClient(client.id, payload);
            } else {
                await clientService.addClient(payload);
                clearDraftStore(DRAFT_KEY);
                setFormDataState({ ...EMPTY });
            }
            onSave();
            onClose();
        } catch (error: any) {
            console.error('Error saving client:', error);
            const msg = error?.message || error?.details || 'Erro ao salvar. Confirme se rodou ADD_CLIENTS_TABLE.sql no Supabase.';
            setErrorMsg(msg);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-y-auto max-h-[95vh] animate-in zoom-in duration-200 custom-scrollbar border-none text-left">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h2 className="text-xl font-bold text-[#0F172A]">
                        {isEditing ? 'Editar Cliente' : 'Novo Cliente'}
                    </h2>
                    <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-50 rounded-xl text-slate-400 transition-all">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {errorMsg && (
                        <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
                            {errorMsg}
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className={labelStyle}>Nome / Razão Social *</label>
                        <input
                            required
                            className={inputStyle}
                            placeholder="Ex: Transportes Silva Ltda"
                            value={formData.name}
                            onChange={e => setFormData({ name: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>CNPJ / CPF</label>
                            <input
                                className={inputStyle}
                                placeholder="00.000.000/0000-00"
                                value={formData.document}
                                onChange={e => setFormData({ document: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>Telefone</label>
                            <input
                                className={inputStyle}
                                placeholder="(00) 00000-0000"
                                value={formData.phone}
                                onChange={e => setFormData({ phone: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className={labelStyle}>E-mail</label>
                        <input
                            type="email"
                            className={inputStyle}
                            placeholder="contato@empresa.com"
                            value={formData.email}
                            onChange={e => setFormData({ email: e.target.value })}
                        />
                    </div>

                    <div className="space-y-1">
                        <label className={labelStyle}>Destino padrão</label>
                        <input
                            className={inputStyle}
                            placeholder="Cidade - UF (sugerido na Nova Viagem)"
                            value={formData.default_destination}
                            onChange={e => setFormData({ default_destination: e.target.value })}
                        />
                        <p className="text-[10px] text-slate-400 ml-1">Ao selecionar este cliente na viagem, o destino pode ser preenchido automaticamente.</p>
                    </div>

                    <div className="space-y-1">
                        <label className={labelStyle}>Observações</label>
                        <textarea
                            className={`${inputStyle} min-h-[80px] resize-y`}
                            placeholder="Opcional"
                            value={formData.notes}
                            onChange={e => setFormData({ notes: e.target.value })}
                        />
                    </div>

                    {isEditing && (
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer ml-1">
                            <input
                                type="checkbox"
                                checked={formData.active !== false}
                                onChange={e => setFormData({ active: e.target.checked })}
                                className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                            />
                            Cliente ativo
                        </label>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-3 rounded-xl bg-cyan-600 text-white font-bold text-sm hover:bg-cyan-700 disabled:opacity-50"
                        >
                            {loading ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
