import { X } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { saveDraft, loadDraft, clearDraftStore } from '../../hooks/usePersistedForm';
import { driverService } from '../../lib/services';

const DRAFT_KEY = 'fuel';
const makeEmpty = () => ({
    vehicle_id: '', driver_id: '', supplier_id: '', km_reading: '',
    liters: '', price_per_liter: '', total_value: '', fuel_type: 'Diesel',
    location: '', date: new Date().toISOString().split('T')[0],
    arla_liters: '', arla_price_per_liter: '', arla_value: ''
});

interface FuelModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => void;
    vehicles: any[];
    drivers: any[];
    suppliers: any[];
    initialData?: any;
}

export default function FuelModal({ isOpen, onClose, onSave, vehicles, drivers, suppliers, initialData }: FuelModalProps) {
    const isEditing = !!initialData;
    const [formData, setFormDataState] = useState(() => {
        if (isEditing) {
            const arlaL = Number(initialData?.arla_liters) || 0;
            const arlaV = Number(initialData?.arla_value) || 0;
            const arlaPpl = arlaL > 0 ? (arlaV / arlaL).toFixed(3) : '';
            return {
                ...makeEmpty(),
                vehicle_id: initialData?.vehicle_id || '',
                driver_id: initialData?.driver_id || '',
                supplier_id: initialData?.supplier_id || '',
                km_reading: (initialData?.km_reading || initialData?.odometer)?.toString() || '',
                liters: initialData?.liters?.toString() || '',
                price_per_liter: initialData?.price_per_liter?.toString() || '',
                total_value: initialData?.total_value?.toString() || '',
                fuel_type: initialData?.fuel_type || 'Diesel',
                location: initialData?.location || '',
                date: initialData?.created_at ? initialData.created_at.slice(0, 10) : new Date().toISOString().split('T')[0],
                arla_liters: initialData?.arla_liters?.toString() || '',
                arla_price_per_liter: arlaPpl,
                arla_value: initialData?.arla_value?.toString() || '',
            };
        }
        return { ...makeEmpty(), ...(loadDraft(DRAFT_KEY) || {}) };
    });
    const [loading, setLoading] = useState(false);
    const [prevKm, setPrevKm] = useState<number | null>(null);

    // Busca KM do abastecimento anterior ao trocar veículo ou ao abrir modal
    useEffect(() => {
        const vehicleId = formData.vehicle_id;
        if (!vehicleId) { setPrevKm(null); return; }
        const excludeId = isEditing ? initialData?.id : undefined;
        const fetch = excludeId
            ? driverService.getPreviousFuelRecord(vehicleId, excludeId)
            : driverService.getLastFuelRecord(vehicleId);
        fetch.then(rec => setPrevKm(rec?.odometer ? Number(rec.odometer) : null)).catch(() => setPrevKm(null));
    }, [formData.vehicle_id, isOpen]);

    React.useEffect(() => {
        if (!isOpen) return;
        if (isEditing && initialData) {
            setFormDataState({
                ...makeEmpty(),
                vehicle_id: initialData?.vehicle_id || '',
                driver_id: initialData?.driver_id || '',
                supplier_id: initialData?.supplier_id || '',
                km_reading: (initialData?.km_reading || initialData?.odometer)?.toString() || '',
                liters: initialData?.liters?.toString() || '',
                price_per_liter: initialData?.price_per_liter?.toString() || '',
                total_value: initialData?.total_value?.toString() || '',
                fuel_type: initialData?.fuel_type || 'Diesel',
                location: initialData?.location || '',
                date: initialData?.created_at ? initialData.created_at.slice(0, 10) : new Date().toISOString().split('T')[0],
                arla_liters: initialData?.arla_liters?.toString() || '',
                arla_value: initialData?.arla_value?.toString() || '',
            });
        } else if (!isEditing) {
            const draft = loadDraft(DRAFT_KEY);
            setFormDataState({ ...makeEmpty(), ...(draft || {}) });
        }
    }, [isOpen, initialData?.id]);

    React.useEffect(() => {
        if (!isOpen || !isEditing || !initialData) return;
        const arlaL = Number(initialData?.arla_liters) || 0;
        const arlaV = Number(initialData?.arla_value) || 0;
        setFormDataState((prev: ReturnType<typeof makeEmpty>) => ({
            ...prev,
            arla_price_per_liter: arlaL > 0 ? (arlaV / arlaL).toFixed(3) : '',
        }));
    }, [isOpen, initialData?.id]);

    function setFormData(partial: Partial<ReturnType<typeof makeEmpty>>) {
        setFormDataState((prev: ReturnType<typeof makeEmpty>) => {
            const next = { ...prev, ...partial };
            if (!isEditing) saveDraft(DRAFT_KEY, next);
            return next;
        });
    }

    // Auto-calcula valor total do diesel
    useEffect(() => {
        const liters = parseFloat(formData.liters);
        const price = parseFloat(formData.price_per_liter);
        if (!isNaN(liters) && !isNaN(price)) {
            setFormData({ total_value: (liters * price).toFixed(2) });
        }
    }, [formData.liters, formData.price_per_liter]);

    // Auto-calcula valor total do ARLA
    useEffect(() => {
        const liters = parseFloat(formData.arla_liters);
        const price = parseFloat(formData.arla_price_per_liter);
        if (!isNaN(liters) && !isNaN(price) && liters > 0 && price > 0) {
            setFormData({ arla_value: (liters * price).toFixed(2) });
        }
    }, [formData.arla_liters, formData.arla_price_per_liter]);

    if (!isOpen) return null;

    const labelStyle = "text-[10px] font-black text-[#8B95B1] uppercase tracking-widest ml-1 mb-1.5 block";
    const inputStyle = "w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300 appearance-none";

    const arlaLitersSuggestion = formData.liters ? (parseFloat(formData.liters) * 0.05).toFixed(1) : null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            onSave(formData);
            clearDraftStore(DRAFT_KEY);
            setFormDataState(makeEmpty());
            onClose();
        } catch (error) {
            console.error('Error saving fuel record:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-y-auto max-h-[95vh] animate-in zoom-in duration-200 custom-scrollbar border-none">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h2 className="text-xl font-bold text-[#0F172A]">
                        {initialData ? 'Editar Abastecimento' : 'Novo Abastecimento'}
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
                                value={formData.vehicle_id}
                                onChange={(e) => {
                                    const vId = e.target.value;
                                    const vehicle = vehicles.find(v => v.id === vId);
                                    setFormData({ vehicle_id: vId, km_reading: vehicle?.current_km?.toString() || '' });
                                }}
                                className={inputStyle}
                            >
                                <option value="">Selecionar Veículo</option>
                                {vehicles.map(v => (
                                    <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className={labelStyle}>Motorista</label>
                            <select
                                required
                                value={formData.driver_id}
                                onChange={(e) => setFormData({ driver_id: e.target.value })}
                                className={inputStyle}
                            >
                                <option value="">Selecionar Motorista</option>
                                {drivers.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className={labelStyle}>Fornecedor (Posto)</label>
                            <select
                                value={formData.supplier_id}
                                onChange={(e) => setFormData({ supplier_id: e.target.value })}
                                className={inputStyle}
                            >
                                <option value="">Selecionar Fornecedor</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className={labelStyle}>Data</label>
                            <input
                                type="date"
                                required
                                value={formData.date}
                                onChange={(e) => setFormData({ date: e.target.value })}
                                className={inputStyle}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>Cidade/Local</label>
                            <input
                                required
                                className={inputStyle}
                                placeholder="Ex: Posto Graal, São Paulo"
                                value={formData.location}
                                onChange={e => setFormData({ location: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>KM Atual</label>
                            <input
                                required
                                type="number"
                                className={inputStyle}
                                placeholder="0"
                                min={0}
                                max={999999999}
                                value={formData.km_reading}
                                onChange={e => setFormData({ km_reading: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Diesel */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>Litros Diesel</label>
                            <input
                                required
                                type="number"
                                step="0.01"
                                className={inputStyle}
                                placeholder="0,00"
                                min={0}
                                max={99999}
                                value={formData.liters}
                                onChange={e => setFormData({ liters: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>Preço/Litro Diesel (R$)</label>
                            <input
                                required
                                type="number"
                                step="0.001"
                                className={inputStyle}
                                placeholder="0,000"
                                min={0}
                                max={999}
                                value={formData.price_per_liter}
                                onChange={e => setFormData({ price_per_liter: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>Valor Total Diesel (R$)</label>
                            <input
                                required
                                type="number"
                                step="0.01"
                                className={`${inputStyle} bg-slate-50 font-bold border-blue-100 text-blue-600 cursor-not-allowed`}
                                placeholder="Calculado..."
                                value={formData.total_value}
                                onChange={e => setFormData({ total_value: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* ARLA 32 */}
                    <div className="bg-teal-50/60 border border-teal-100 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black text-teal-700 uppercase tracking-widest">ARLA 32 (Opcional)</p>
                            {arlaLitersSuggestion && (
                                <button
                                    type="button"
                                    onClick={() => setFormData({ arla_liters: arlaLitersSuggestion })}
                                    className="text-[10px] font-bold text-teal-600 bg-teal-100 hover:bg-teal-200 px-2.5 py-1 rounded-lg transition-colors"
                                >
                                    Sugerir {arlaLitersSuggestion} L (5% do diesel)
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <label className={`${labelStyle} text-teal-600`}>Litros de ARLA 32</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className={`${inputStyle} focus:ring-teal-500/20`}
                                    placeholder="Ex: 5,00"
                                    min={0}
                                    max={9999}
                                    value={formData.arla_liters}
                                    onChange={e => setFormData({ arla_liters: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className={`${labelStyle} text-teal-600`}>Preço/Litro ARLA (R$)</label>
                                <input
                                    type="number"
                                    step="0.001"
                                    className={`${inputStyle} focus:ring-teal-500/20`}
                                    placeholder="0,000"
                                    min={0}
                                    max={999}
                                    value={formData.arla_price_per_liter}
                                    onChange={e => setFormData({ arla_price_per_liter: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className={`${labelStyle} text-teal-600`}>Total ARLA (R$)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    readOnly
                                    className={`${inputStyle} bg-teal-50 font-bold border-teal-100 text-teal-700 cursor-not-allowed focus:ring-teal-500/20`}
                                    placeholder="Calculado..."
                                    value={formData.arla_value}
                                />
                            </div>
                        </div>
                        <p className="text-[10px] text-teal-500 ml-1">
                            Consumo médio: ~5% do diesel. Para {formData.liters ? `${formData.liters} L de diesel → ~${arlaLitersSuggestion} L de ARLA` : '100 L de diesel → ~5 L de ARLA'}.
                        </p>
                    </div>

                    {/* Resumo de totais + KM/L */}
                    {(() => {
                        const diesel  = parseFloat(formData.total_value) || 0;
                        const arla    = parseFloat(formData.arla_value)  || 0;
                        const total   = diesel + arla;
                        const kmAtual = parseFloat(formData.km_reading)  || 0;
                        const liters  = parseFloat(formData.liters)      || 0;
                        const kmRod   = prevKm !== null && kmAtual > prevKm ? kmAtual - prevKm : null;
                        const kmL     = kmRod !== null && liters > 0 ? kmRod / liters : null;
                        if (total === 0 && kmL === null) return null;
                        const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                        return (
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-slate-100 rounded-xl px-4 py-3">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total ARLA</p>
                                    <p className="text-lg font-black text-teal-600">{fmt(arla)}</p>
                                </div>
                                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Diesel + ARLA</p>
                                    <p className="text-lg font-black text-blue-700">{fmt(total)}</p>
                                </div>
                                <div className={`rounded-xl px-4 py-3 border ${kmL === null ? 'bg-slate-50 border-slate-200' : kmL >= 2.5 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                        KM/L {prevKm !== null ? `(${prevKm.toLocaleString()} → ${kmAtual.toLocaleString()})` : ''}
                                    </p>
                                    {kmL !== null
                                        ? <p className={`text-lg font-black ${kmL >= 2.5 ? 'text-emerald-600' : 'text-rose-600'}`}>{kmL.toFixed(2)} km/L</p>
                                        : <p className="text-sm text-slate-400">{prevKm === null ? 'Aguardando KM anterior' : 'Informe KM e litros'}</p>
                                    }
                                </div>
                            </div>
                        );
                    })()}

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
                            {loading ? 'Salvando...' : 'Salvar Abastecimento'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
