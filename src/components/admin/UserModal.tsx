import { X, User, ShieldCheck } from 'lucide-react';
import { useState, useEffect } from 'react';
import { SECTORS, PERMISSION_PRESETS, type SectorKey } from '../../lib/permissions';

interface UserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
}

export default function UserModal({ isOpen, onClose, onSave, initialData }: UserModalProps) {
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        role: 'operator',
        active: true,
        permissions: [] as SectorKey[],
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData({
                full_name: initialData.full_name || '',
                email: initialData.email || '',
                role: initialData.role || 'operator',
                active: initialData.active ?? true,
                permissions: Array.isArray(initialData.permissions) ? initialData.permissions : [],
            });
        } else {
            setFormData({
                full_name: '',
                email: '',
                role: 'operator',
                active: true,
                permissions: [],
            });
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const labelStyle = "text-[10px] font-black text-[#8B95B1] uppercase tracking-widest ml-1 mb-1.5 block";
    const inputStyle = "w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300 appearance-none";

    const isFullAccess = formData.role === 'admin';

    const toggleSector = (key: SectorKey) => {
        setFormData(prev => ({
            ...prev,
            permissions: prev.permissions.includes(key)
                ? prev.permissions.filter(p => p !== key)
                : [...prev.permissions, key],
        }));
    };

    const applyPreset = (perms: SectorKey[]) => {
        setFormData(prev => ({ ...prev, permissions: perms }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFullAccess && formData.permissions.length === 0) {
            alert('Selecione ao menos um setor para o funcionário ou escolha "Administrador (acesso total)".');
            return;
        }
        setLoading(true);
        try {
            // Admin ignora permissions; funcionário salva a lista de setores
            const payload = {
                full_name: formData.full_name,
                email: formData.email,
                role: formData.role,
                active: formData.active,
                permissions: isFullAccess ? [] : formData.permissions,
            };
            await onSave(payload);
            onClose();
        } catch (error) {
            console.error('Error saving user:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-y-auto max-h-[95vh] custom-scrollbar animate-in zoom-in duration-200 border-none">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                            <User size={20} />
                        </div>
                        {initialData ? 'Editar Usuário' : 'Convidar Usuário'}
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-50 rounded-xl text-slate-400 transition-all">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>Nome Completo</label>
                            <input
                                required
                                className={inputStyle}
                                placeholder="Ex: João Silva"
                                value={formData.full_name}
                                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className={labelStyle}>E-mail de Acesso</label>
                            <input
                                required
                                type="email"
                                className={inputStyle}
                                placeholder="email@empresa.com"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                disabled={!!initialData}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className={labelStyle}>Nível de Acesso</label>
                            <select
                                required
                                className={inputStyle}
                                value={isFullAccess ? 'admin' : 'operator'}
                                onChange={e => setFormData({ ...formData, role: e.target.value })}
                            >
                                <option value="admin">Administrador (acesso total)</option>
                                <option value="operator">Funcionário (acesso por setor)</option>
                            </select>
                        </div>

                        {/* Setores — só para funcionário */}
                        {!isFullAccess && (
                            <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck size={15} className="text-blue-600" />
                                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Setores permitidos</span>
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                    {PERMISSION_PRESETS.map(preset => (
                                        <button
                                            key={preset.label}
                                            type="button"
                                            onClick={() => applyPreset(preset.permissions)}
                                            className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="space-y-2">
                                    {SECTORS.map(sector => {
                                        const checked = formData.permissions.includes(sector.key);
                                        return (
                                            <label
                                                key={sector.key}
                                                className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border ${checked ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => toggleSector(sector.key)}
                                                    className="mt-0.5 w-4 h-4 rounded accent-blue-600"
                                                />
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-slate-800">{sector.label}</p>
                                                    <p className="text-[10px] text-slate-400 leading-tight">{sector.description}</p>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl cursor-pointer" onClick={() => setFormData({...formData, active: !formData.active})}>
                            <div className={`w-10 h-6 rounded-full flex items-center px-1 transition-colors ${formData.active ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${formData.active ? 'translate-x-4' : 'translate-x-0'}`}></div>
                            </div>
                            <span className="text-xs font-bold text-slate-700">Acesso Ativo</span>
                        </div>
                    </div>

                    {!initialData && (
                        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 italic">
                            <p className="text-[10px] text-blue-700 leading-relaxed font-medium">
                                * Um convite será enviado para o e-mail informado com as instruções de primeiro acesso e senha.
                            </p>
                        </div>
                    )}

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
                            {loading ? 'Processando...' : initialData ? 'Salvar' : 'Enviar Convite'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
