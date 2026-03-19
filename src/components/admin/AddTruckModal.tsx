import { useState, useEffect } from 'react';
import { X, Truck } from 'lucide-react';
import { TRUCK_TYPES, type TruckTypeId } from '../../lib/constants';

interface AddTruckModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
}

export default function AddTruckModal({ isOpen, onClose, onSave, initialData }: AddTruckModalProps) {
    const [formData, setFormData] = useState({
        plate: '',
        model: '',
        year: new Date().getFullYear(),
        initial_km: 0,
        current_km: 0,
        truck_type: '' as TruckTypeId | '',
        axle_count: 0,
        maint_oil_interval: 15000,
        maint_filter_interval: 30000,
        maint_tyre_interval: 60000,
        last_oil_change_km: 0,
        last_filter_change_km: 0,
        last_tyre_change_km: 0,
        insurance_value: 0,
        document_expiry: '',
        antt_expiry: '',
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData({
                plate: initialData.plate || '',
                model: initialData.model || '',
                year: initialData.year || new Date().getFullYear(),
                initial_km: initialData.initial_km || 0,
                current_km: initialData.current_km || 0,
                truck_type: initialData.truck_type || '',
                axle_count: initialData.axle_count || 0,
                maint_oil_interval: initialData.maint_oil_interval || 15000,
                maint_filter_interval: initialData.maint_filter_interval || 30000,
                maint_tyre_interval: initialData.maint_tyre_interval || 60000,
                last_oil_change_km: initialData.last_oil_change_km || 0,
                last_filter_change_km: initialData.last_filter_change_km || 0,
                last_tyre_change_km: initialData.last_tyre_change_km || 0,
                insurance_value: initialData.insurance_value || 0,
                document_expiry: initialData.document_expiry || '',
                antt_expiry: initialData.antt_expiry || '',
            });
        } else {
            setFormData({
                plate: '',
                model: '',
                year: new Date().getFullYear(),
                initial_km: 0,
                current_km: 0,
                truck_type: '',
                axle_count: 0,
                maint_oil_interval: 15000,
                maint_filter_interval: 30000,
                maint_tyre_interval: 60000,
                last_oil_change_km: 0,
                last_filter_change_km: 0,
                last_tyre_change_km: 0,
                insurance_value: 0,
                document_expiry: '',
                antt_expiry: '',
            });
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const labelStyle = "text-[10px] font-black text-[#8B95B1] uppercase tracking-widest ml-1 mb-1.5 block";
    const inputStyle = "w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300 appearance-none";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const dataToSave = {
                ...formData,
                year: Number(formData.year) || new Date().getFullYear(),
                initial_km: Number(formData.initial_km) || 0,
                current_km: Number(formData.current_km) || 0,
                maint_oil_interval: Number(formData.maint_oil_interval) || 15000,
                maint_filter_interval: Number(formData.maint_filter_interval) || 30000,
                maint_tyre_interval: Number(formData.maint_tyre_interval) || 60000,
                last_oil_change_km: Number(formData.last_oil_change_km) || 0,
                last_filter_change_km: Number(formData.last_filter_change_km) || 0,
                last_tyre_change_km: Number(formData.last_tyre_change_km) || 0,
                insurance_value: Number(formData.insurance_value) || 0,
                document_expiry: formData.document_expiry || null,
                antt_expiry: formData.antt_expiry || null,
            };

            if (!initialData) {
                if (!dataToSave.current_km) dataToSave.current_km = dataToSave.initial_km;
            }
            await onSave(dataToSave);
            onClose();
        } catch (error: any) {
            console.error('Error saving truck:', error);
            const msg = error.message || error.details || "Erro desconhecido ao salvar veículo.";
            alert(`Erro ao salvar veículo: ${msg}\n\nCertifique-se de executar o script FIX_VEHICLES_COLUMNS.sql no Supabase.`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-y-auto max-h-[95vh] animate-in zoom-in duration-200 custom-scrollbar border-none">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h2 className="text-xl font-bold text-[#0F172A]">
                        {initialData ? 'Editar Veículo' : 'Novo Veículo'}
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-50 rounded-xl text-slate-400 transition-all">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-1">
                        <label className={labelStyle}>Tipo de Caminhão</label>
                        <select
                            className={inputStyle}
                            value={formData.truck_type}
                            onChange={e => {
                                const typeId = e.target.value as TruckTypeId;
                                const config = TRUCK_TYPES[typeId];
                                if (config) {
                                    setFormData({
                                        ...formData,
                                        truck_type: typeId,
                                        axle_count: config.axles,
                                        maint_oil_interval: config.default_intervals.oil,
                                        maint_filter_interval: config.default_intervals.filter,
                                        maint_tyre_interval: config.default_intervals.tyre,
                                    });
                                }
                            }}
                        >
                            <option value="">Selecione o tipo...</option>
                            {Object.values(TRUCK_TYPES).map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                        {formData.truck_type && (
                            <p className="text-[10px] text-blue-600 font-bold uppercase mt-2 flex items-center gap-2 ml-1">
                                <Truck size={12} /> {TRUCK_TYPES[formData.truck_type as TruckTypeId]?.description}
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>Placa</label>
                            <input
                                required
                                className={inputStyle}
                                placeholder="ABC-1234"
                                value={formData.plate}
                                onChange={e => setFormData({ ...formData, plate: e.target.value.toUpperCase() })}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className={labelStyle}>Modelo</label>
                            <input
                                required
                                className={inputStyle}
                                placeholder="Ex: Scania R450"
                                value={formData.model}
                                onChange={e => setFormData({ ...formData, model: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>Ano</label>
                            <input
                                required
                                type="number"
                                className={inputStyle}
                                placeholder="2023"
                                value={formData.year}
                                onChange={e => setFormData({ ...formData, year: parseInt(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>{initialData ? 'KM Atual' : 'KM Inicial'}</label>
                            <input
                                required
                                type="number"
                                className={inputStyle}
                                placeholder="0"
                                value={initialData ? formData.current_km : formData.initial_km}
                                onChange={e => {
                                    const val = parseInt(e.target.value);
                                    if (initialData) {
                                        setFormData({ ...formData, current_km: val });
                                    } else {
                                        setFormData({ ...formData, initial_km: val });
                                    }
                                }}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>Seguro Fixo (R$)</label>
                            <input
                                type="number"
                                className={inputStyle}
                                placeholder="0,00"
                                value={formData.insurance_value}
                                onChange={e => setFormData({ ...formData, insurance_value: parseFloat(e.target.value) })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>Vencimento CRLV/Licenciamento</label>
                            <input
                                type="date"
                                className={inputStyle}
                                value={formData.document_expiry}
                                onChange={e => setFormData({ ...formData, document_expiry: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>Vencimento ANTT</label>
                            <input
                                type="date"
                                className={inputStyle}
                                value={formData.antt_expiry}
                                onChange={e => setFormData({ ...formData, antt_expiry: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="p-6 bg-blue-50/50 rounded-[1.5rem] border border-blue-100/50 space-y-4">
                        <div>
                            <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest ml-1 mb-4">Intervalos e Histórico (KM)</p>
                            <div className="grid grid-cols-3 gap-x-4 gap-y-4">
                                <div className="space-y-1">
                                    <label className={labelStyle}>Óleo (Int.)</label>
                                    <input
                                        type="number"
                                        className={inputStyle}
                                        value={formData.maint_oil_interval}
                                        onChange={e => setFormData({ ...formData, maint_oil_interval: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelStyle}>Filtro (Int.)</label>
                                    <input
                                        type="number"
                                        className={inputStyle}
                                        value={formData.maint_filter_interval}
                                        onChange={e => setFormData({ ...formData, maint_filter_interval: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelStyle}>Pneu (Int.)</label>
                                    <input
                                        type="number"
                                        className={inputStyle}
                                        value={formData.maint_tyre_interval}
                                        onChange={e => setFormData({ ...formData, maint_tyre_interval: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelStyle}>Último Óleo</label>
                                    <input
                                        type="number"
                                        className={inputStyle}
                                        value={formData.last_oil_change_km}
                                        onChange={e => setFormData({ ...formData, last_oil_change_km: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelStyle}>Último Filtro</label>
                                    <input
                                        type="number"
                                        className={inputStyle}
                                        value={formData.last_filter_change_km}
                                        onChange={e => setFormData({ ...formData, last_filter_change_km: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelStyle}>Último Pneu</label>
                                    <input
                                        type="number"
                                        className={inputStyle}
                                        value={formData.last_tyre_change_km}
                                        onChange={e => setFormData({ ...formData, last_tyre_change_km: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>
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
                            {loading ? 'Salvando...' : 'Salvar Veículo'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
