import { useState } from 'react';
import { X, Truck } from 'lucide-react';
import { TRUCK_TYPES, vehicleUsesImplement, type CompanyTruckType, type TruckTypeId } from '../../lib/constants';
import { saveDraft, loadDraft, clearDraftStore } from '../../hooks/usePersistedForm';
import RegisterTruckTypeForm from './RegisterTruckTypeForm';
import React from 'react';

const DRAFT_KEY = 'truck';

const makeEmpty = () => ({
    plate: '', brand: '', model: '', year: new Date().getFullYear(),
    initial_km: 0, current_km: 0, truck_type: '' as string,
    axle_count: 0, tyre_count: 0, maint_oil_interval: 15000, maint_filter_interval: 30000,
    maint_tyre_interval: 60000, last_oil_change_km: 0, last_filter_change_km: 0,
    last_tyre_change_km: 0, insurance_value: 0, document_expiry: '', antt_expiry: '',
    civ_expiry: '', tacografo_expiry: '',
    implement_plate_1: '', implement_plate_2: '',
});

interface AddTruckModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
    companyId?: string;
    customTypes?: CompanyTruckType[];
    onCustomTypeCreated?: (row: CompanyTruckType) => void;
}

export default function AddTruckModal({ isOpen, onClose, onSave, initialData, companyId, customTypes = [], onCustomTypeCreated }: AddTruckModalProps) {
    const isEditing = !!initialData;
    const [formData, setFormDataState] = useState(() => {
        if (isEditing) return { ...makeEmpty(), ...initialData };
        return { ...makeEmpty(), ...(loadDraft(DRAFT_KEY) || {}) };
    });
    const [loading, setLoading] = useState(false);
    const [registerOpen, setRegisterOpen] = useState(false);
    const cavaloTypes = customTypes.filter(t => t.kind === 'cavalo');

    React.useEffect(() => {
        if (!isOpen) return;
        setRegisterOpen(false);
        if (isEditing && initialData) {
            setFormDataState({ ...makeEmpty(), ...initialData });
        } else if (!isEditing) {
            const draft = loadDraft(DRAFT_KEY);
            setFormDataState({ ...makeEmpty(), ...(draft || {}) });
        }
    }, [isOpen, initialData?.id]);

    function setFormData(partial: Partial<ReturnType<typeof makeEmpty>>) {
        setFormDataState((prev: ReturnType<typeof makeEmpty>) => {
            const next = { ...prev, ...partial };
            if (!isEditing) saveDraft(DRAFT_KEY, next);
            return next;
        });
    }

    function applyTruckType(typeId: string) {
        const config = TRUCK_TYPES[typeId as TruckTypeId];
        if (config) {
            setFormData({
                truck_type: typeId,
                axle_count: config.axles,
                tyre_count: config.tyre_count,
                maint_oil_interval: config.default_intervals.oil,
                maint_filter_interval: config.default_intervals.filter,
                maint_tyre_interval: config.default_intervals.tyre,
            });
            return;
        }
        const custom = cavaloTypes.find(t => t.name === typeId);
        const base = custom ? TRUCK_TYPES[custom.layout_key as TruckTypeId] : undefined;
        if (custom && base) {
            setFormData({
                truck_type: custom.name,
                axle_count: base.axles,
                tyre_count: base.tyre_count,
                maint_oil_interval: base.default_intervals.oil,
                maint_filter_interval: base.default_intervals.filter,
                maint_tyre_interval: base.default_intervals.tyre,
            });
        }
    }

    function handleTypeCreated(row: CompanyTruckType) {
        onCustomTypeCreated?.(row);
        if (row.kind !== 'cavalo') {
            alert('Tipo de implemento cadastrado. Ele aparece ao cadastrar um implemento.');
            return;
        }
        const base = TRUCK_TYPES[row.layout_key as TruckTypeId];
        if (!base) return;
        setFormData({
            truck_type: row.name,
            axle_count: base.axles,
            tyre_count: base.tyre_count,
            maint_oil_interval: base.default_intervals.oil,
            maint_filter_interval: base.default_intervals.filter,
            maint_tyre_interval: base.default_intervals.tyre,
        });
    }

    if (!isOpen) return null;

    const standardType = TRUCK_TYPES[formData.truck_type as TruckTypeId];
    const customType = cavaloTypes.find(t => t.name === formData.truck_type);
    const orphanType = formData.truck_type && !standardType && !customType ? formData.truck_type : '';
    const showImplementPlates = vehicleUsesImplement(formData.truck_type, customTypes);

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
                axle_count: Number(formData.axle_count) || 0,
                tyre_count: Number(formData.tyre_count) || 0,
                maint_oil_interval: Number(formData.maint_oil_interval) || 15000,
                maint_filter_interval: Number(formData.maint_filter_interval) || 30000,
                maint_tyre_interval: Number(formData.maint_tyre_interval) || 60000,
                last_oil_change_km: Number(formData.last_oil_change_km) || 0,
                last_filter_change_km: Number(formData.last_filter_change_km) || 0,
                last_tyre_change_km: Number(formData.last_tyre_change_km) || 0,
                insurance_value: Number(formData.insurance_value) || 0,
                document_expiry: formData.document_expiry || null,
                antt_expiry: formData.antt_expiry || null,
                civ_expiry: formData.civ_expiry || null,
                tacografo_expiry: formData.tacografo_expiry || null,
            };

            if (!initialData) {
                if (!dataToSave.current_km) dataToSave.current_km = dataToSave.initial_km;
            }
            await onSave(dataToSave);
            clearDraftStore(DRAFT_KEY);
            setFormDataState(makeEmpty());
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
                        <div className="flex items-center justify-between gap-3">
                            <label className={`${labelStyle} mb-0`}>Tipo de Caminhão</label>
                            <button
                                type="button"
                                onClick={() => setRegisterOpen(open => !open)}
                                className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800"
                            >
                                Cadastrar tipo
                            </button>
                        </div>
                        <select
                            className={inputStyle}
                            value={formData.truck_type}
                            onChange={e => applyTruckType(e.target.value)}
                        >
                            <option value="">Selecione o tipo...</option>
                            {Object.values(TRUCK_TYPES).map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                            {cavaloTypes.map(t => (
                                <option key={t.id} value={t.name}>{t.name}</option>
                            ))}
                            {orphanType && <option value={orphanType}>{orphanType}</option>}
                        </select>
                        {registerOpen && (
                            <RegisterTruckTypeForm
                                companyId={companyId || ''}
                                defaultKind="cavalo"
                                onCreated={handleTypeCreated}
                                onClose={() => setRegisterOpen(false)}
                            />
                        )}
                        {standardType && (
                            <p className="text-[10px] text-blue-600 font-bold uppercase mt-2 flex items-center gap-2 ml-1">
                                <Truck size={12} /> {standardType.description}
                            </p>
                        )}
                        {!standardType && customType && (
                            <p className="text-[10px] text-blue-600 font-bold uppercase mt-2 flex items-center gap-2 ml-1">
                                <Truck size={12} /> Tipo cadastrado · {TRUCK_TYPES[customType.layout_key as TruckTypeId]?.name}
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>Nº de Eixos</label>
                            <input
                                type="number"
                                min={0}
                                className={inputStyle}
                                value={formData.axle_count}
                                onChange={e => setFormData({ axle_count: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>Nº de Pneus</label>
                            <input
                                type="number"
                                min={0}
                                className={inputStyle}
                                value={formData.tyre_count}
                                onChange={e => setFormData({ tyre_count: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                            <label className={labelStyle}>Marca</label>
                            <input
                                className={inputStyle}
                                placeholder="Ex: Scania, Volvo"
                                value={formData.brand}
                                onChange={e => setFormData({ ...formData, brand: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className={labelStyle}>Modelo</label>
                            <input
                                required
                                className={inputStyle}
                                placeholder="Ex: R450"
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
                                min={1950}
                                max={2100}
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
                                min={0}
                                max={9999999}
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
                                min={0}
                                max={999999}
                                value={formData.insurance_value}
                                onChange={e => setFormData({ ...formData, insurance_value: parseFloat(e.target.value) })}
                            />
                        </div>
                    </div>

                    {/* Placas dos Implementos — aparece apenas para tipos que usam cavalo */}
                    {showImplementPlates && (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Placas dos Implementos</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className={labelStyle}>Implemento 1 (Carreta/Reboque)</label>
                                    <input
                                        className={inputStyle}
                                        placeholder="ABC-1234"
                                        maxLength={8}
                                        value={formData.implement_plate_1}
                                        onChange={e => setFormData({ implement_plate_1: e.target.value.toUpperCase() })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelStyle}>Implemento 2 (Opcional)</label>
                                    <input
                                        className={inputStyle}
                                        placeholder="ABC-1234"
                                        maxLength={8}
                                        value={formData.implement_plate_2}
                                        onChange={e => setFormData({ implement_plate_2: e.target.value.toUpperCase() })}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

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
                        <div className="space-y-1">
                            <label className={labelStyle}>Vencimento CIV</label>
                            <input
                                type="date"
                                className={inputStyle}
                                value={formData.civ_expiry}
                                onChange={e => setFormData({ ...formData, civ_expiry: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>Vencimento Cronotacógrafo</label>
                            <input
                                type="date"
                                className={inputStyle}
                                value={formData.tacografo_expiry}
                                onChange={e => setFormData({ ...formData, tacografo_expiry: e.target.value })}
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
                                        min={0} max={999999}
                                        value={formData.maint_oil_interval}
                                        onChange={e => setFormData({ ...formData, maint_oil_interval: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelStyle}>Filtro (Int.)</label>
                                    <input
                                        type="number"
                                        className={inputStyle}
                                        min={0} max={999999}
                                        value={formData.maint_filter_interval}
                                        onChange={e => setFormData({ ...formData, maint_filter_interval: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelStyle}>Pneu (Int.)</label>
                                    <input
                                        type="number"
                                        className={inputStyle}
                                        min={0} max={999999}
                                        value={formData.maint_tyre_interval}
                                        onChange={e => setFormData({ ...formData, maint_tyre_interval: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelStyle}>Último Óleo</label>
                                    <input
                                        type="number"
                                        className={inputStyle}
                                        min={0} max={9999999}
                                        value={formData.last_oil_change_km}
                                        onChange={e => setFormData({ ...formData, last_oil_change_km: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelStyle}>Último Filtro</label>
                                    <input
                                        type="number"
                                        className={inputStyle}
                                        min={0} max={9999999}
                                        value={formData.last_filter_change_km}
                                        onChange={e => setFormData({ ...formData, last_filter_change_km: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelStyle}>Último Pneu</label>
                                    <input
                                        type="number"
                                        className={inputStyle}
                                        min={0} max={9999999}
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
