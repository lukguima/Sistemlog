import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { fixedRouteService, settingsService, agregadoService } from '../../lib/services';
import { useAuth } from '../../context/AuthContext';
import { saveDraft, loadDraft, clearDraftStore } from '../../hooks/usePersistedForm';

const DRAFT_KEY = 'trip';
const makeEmpty = () => ({
    vehicle_id: '', implement_id: '', driver_id: '', cargo_description: '', origin: '', destination: '',
    date: new Date().toISOString().split('T')[0], start_km: '', end_km: '', cte: '',
    weight: '', value: '', tax_rate: '', commission_rate: '', estimated_cost: '',
    advance_value: '', tolls_value: '', insurance_value: '', status: 'pending',
    // Campos de agregado
    driver_type: 'own' as 'own' | 'agregado',
    agregado_id: '',
    agregado_value: '',
});

interface TripModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    vehicles: any[];
    drivers: any[];
    initialData?: any;
}

export default function TripModal({ isOpen, onClose, onSave, vehicles, drivers, initialData }: TripModalProps) {
    const { user } = useAuth();
    const companyId = (user as any)?.company_id;
    const [fixedRoutes, setFixedRoutes] = useState<any[]>([]);
    const [agregados, setAgregados] = useState<any[]>([]);
    const isEditing = !!initialData;
    // Separa cavalos/caminhões (para o campo Veículo) dos implementos
    const trucks = (vehicles || []).filter(v => v.category !== 'implemento');
    const implementos = (vehicles || []).filter(v => v.category === 'implemento');
    const buildEditData = (data: any) => {
        const fmt = (v: any) => (v != null && v !== '') ? Number(v).toFixed(2) : '';
        
        // Se 'value' (tarifa) não existir, tenta extrair do gross_value/peso
        const weight = parseFloat(data?.weight) || 0;
        const gross = parseFloat(data?.gross_value) || 0;
        let tarifa = data?.value;
        if (tarifa == null || tarifa === '') {
            tarifa = (weight > 0) ? (gross / weight) : gross;
        }

        return {
            ...makeEmpty(),
            ...data,
            cte: data?.cte || data?.cte_number || '',
            value: fmt(tarifa),
            weight: fmt(data?.weight),
            tax_rate: fmt(data?.tax_rate),
            commission_rate: fmt(data?.commission_rate),
            estimated_cost: fmt(data?.estimated_cost),
            advance_value: fmt(data?.advance_value),
            tolls_value: fmt(data?.tolls_value || data?.toll_expense),
            insurance_value: fmt(data?.insurance_value || data?.other_expenses),
            start_km: data?.start_km ?? '',
            end_km: data?.end_km ?? '',
            date: data?.date || (data?.created_at ? data.created_at.slice(0, 10) : new Date().toISOString().split('T')[0]),
            driver_type: data?.driver_type ?? 'own',
            agregado_id: data?.agregado_id ?? '',
            agregado_value: data?.agregado_value != null ? String(data.agregado_value) : '',
        };
    };

    const [formData, setFormDataState] = useState(() => {
        if (isEditing) return buildEditData(initialData);
        return { ...makeEmpty(), ...(loadDraft(DRAFT_KEY) || {}) };
    });
    const [loading, setLoading] = useState(false);

    React.useEffect(() => {
        if (!isOpen) return;
        if (isEditing && initialData) {
            setFormDataState(buildEditData(initialData));
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

    useEffect(() => {
        if (isOpen && companyId) {
            fixedRouteService.getFixedRoutes(companyId).then(setFixedRoutes);
            agregadoService.getAll(companyId).then(setAgregados).catch(() => {});
            if (!isEditing) {
                settingsService.getSettings(companyId).then(s => {
                    const commissionDefault = s?.default_commission_rate != null ? String(s.default_commission_rate) : '12';
                    const taxDefault = s?.default_tax_rate != null ? String(s.default_tax_rate) : '6';
                    setFormDataState((prev: ReturnType<typeof makeEmpty>) => ({
                        ...prev,
                        commission_rate: commissionDefault,
                        tax_rate: taxDefault,
                    }));
                }).catch(() => {});
            }
        }
    }, [isOpen, companyId]);

    // Auto-fill value based on fixed routes
    useEffect(() => {
        if (!initialData && formData.origin && formData.destination) {
            const match = fixedRoutes.find(r => 
                r.origin.toLowerCase().trim() === formData.origin.toLowerCase().trim() && 
                r.destination.toLowerCase().trim() === formData.destination.toLowerCase().trim()
            );
            if (match) {
                setFormData({ value: match.freight_value });
            }
        }
    }, [formData.origin, formData.destination, fixedRoutes, initialData]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSave(formData);
            clearDraftStore(DRAFT_KEY);
            setFormDataState(makeEmpty());
            onClose();
        } catch (error) {
            console.error('Error saving trip:', error);
        } finally {
            setLoading(false);
        }
    };

    const labelStyle = "text-[10px] font-black text-[#8B95B1] uppercase tracking-widest ml-1 mb-1.5 block";
    const inputStyle = "w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300 appearance-none";

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-y-auto max-h-[95vh] animate-in zoom-in duration-200 custom-scrollbar border-none">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h2 className="text-xl font-bold text-[#0F172A]">
                        {initialData ? 'Editar Viagem' : 'Nova Viagem'}
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-50 rounded-xl text-slate-400 transition-all">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Toggle Frota Própria / Agregado */}
                    <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                        {(['own', 'agregado'] as const).map(t => (
                            <button key={t} type="button"
                                onClick={() => setFormData({ driver_type: t, vehicle_id: '', implement_id: '', driver_id: '', agregado_id: '', agregado_value: '' })}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${formData.driver_type === t ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                                {t === 'own' ? '🚛 Frota Própria' : '🤝 Agregado'}
                            </button>
                        ))}
                    </div>

                    {/* Seleção de Trecho Fixo (Opcional) */}
                    {!initialData && fixedRoutes.length > 0 && (
                        <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 mb-2">
                            <label className={`${labelStyle} text-blue-600`}>Usar Trecho Fixo (Opcional)</label>
                            <select
                                className={`${inputStyle} border-blue-200 focus:ring-blue-500/30`}
                                onChange={e => {
                                    const routeId = e.target.value;
                                    if (!routeId) return;
                                    const route = fixedRoutes.find(r => r.id === routeId);
                                    if (route) {
                                        setFormData({
                                            origin: route.origin,
                                            destination: route.destination,
                                            value: route.freight_value
                                        });
                                    }
                                }}
                            >
                                <option value="">--- Selecione um trecho para carregar dados ---</option>
                                {fixedRoutes.map(r => (
                                    <option key={r.id} value={r.id}>
                                        {r.origin} → {r.destination} (R$ {parseFloat(r.freight_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                                    </option>
                                ))}
                            </select>
                            <p className="text-[10px] text-blue-500 mt-2 ml-1">
                                Selecionar um trecho preencherá automaticamente Origem, Destino e Valor.
                            </p>
                        </div>
                    )}
                    {/* Veículo e Motorista (frota própria) */}
                    {formData.driver_type === 'own' && (
                        <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className={labelStyle}>Veículo (Cavalo)</label>
                                <select
                                    required
                                    className={inputStyle}
                                    value={formData.vehicle_id}
                                    onChange={e => {
                                        const vId = e.target.value;
                                        const vehicle = trucks.find(v => v.id === vId);
                                        setFormData({ ...formData, vehicle_id: vId, start_km: vehicle?.current_km || '' });
                                    }}
                                >
                                    <option value="">Selecione...</option>
                                    {trucks.map(v => <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className={labelStyle}>Motorista</label>
                                <select
                                    required
                                    className={inputStyle}
                                    value={formData.driver_id}
                                    onChange={e => setFormData({ ...formData, driver_id: e.target.value })}
                                >
                                    <option value="">Selecione...</option>
                                    {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                        </div>
                        {implementos.length > 0 && (
                            <div className="space-y-1">
                                <label className={labelStyle}>Implemento (opcional)</label>
                                <select
                                    className={inputStyle}
                                    value={formData.implement_id}
                                    onChange={e => setFormData({ ...formData, implement_id: e.target.value })}
                                >
                                    <option value="">Sem implemento</option>
                                    {implementos.map(v => (
                                        <option key={v.id} value={v.id}>
                                            {v.plate}{v.implement_type ? ` - ${v.implement_type}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        </>
                    )}

                    {/* Agregado (terceiro) */}
                    {formData.driver_type === 'agregado' && (
                        <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 space-y-3">
                            <div className="space-y-1">
                                <label className={labelStyle}>Agregado *</label>
                                <select
                                    required
                                    className={`${inputStyle} border-violet-200 focus:ring-violet-500/30`}
                                    value={formData.agregado_id}
                                    onChange={e => setFormData({ ...formData, agregado_id: e.target.value })}
                                >
                                    <option value="">Selecione o agregado...</option>
                                    {agregados.filter(a => a.status === 'active').map(a => (
                                        <option key={a.id} value={a.id}>
                                            {a.name}{a.vehicle_plate ? ` — ${a.vehicle_plate}` : ''}
                                        </option>
                                    ))}
                                </select>
                                {agregados.filter(a => a.status === 'active').length === 0 && (
                                    <p className="text-xs text-violet-500 mt-1">Nenhum agregado ativo. Cadastre em Agregados primeiro.</p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <label className={labelStyle}>Valor Repassado ao Agregado (R$)</label>
                                <input
                                    required
                                    type="number"
                                    step="0.01"
                                    className={`${inputStyle} border-violet-200 focus:ring-violet-500/30`}
                                    placeholder="0,00"
                                    value={formData.agregado_value}
                                    onChange={e => setFormData({ ...formData, agregado_value: e.target.value })}
                                />
                            </div>
                            {/* Preview do lucro */}
                            {(() => {
                                const peso   = parseFloat(formData.weight);
                                const tarifa = parseFloat(formData.value);
                                const gross  = (!isNaN(peso) && !isNaN(tarifa) && peso > 0 && tarifa > 0)
                                    ? peso * tarifa : parseFloat(formData.value) || 0;
                                const tax    = parseFloat(formData.tax_rate) || 0;
                                const agrVal = parseFloat(formData.agregado_value) || 0;
                                if (gross <= 0) return null;
                                const netProfit = gross * (1 - tax / 100) - agrVal;
                                const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                                return (
                                    <div className="bg-white rounded-xl border border-violet-100 px-4 py-3 text-xs space-y-1">
                                        <div className="flex justify-between text-slate-500">
                                            <span>Valor do frete</span><span className="font-semibold">{fmt(gross)}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-500">
                                            <span>(-) Impostos ({tax}%)</span><span>{fmt(gross * tax / 100)}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-500">
                                            <span>(-) Repasse ao agregado</span><span>{fmt(agrVal)}</span>
                                        </div>
                                        <div className={`flex justify-between font-bold border-t border-slate-100 pt-1 ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                                            <span>Lucro líquido da empresa</span><span>{fmt(netProfit)}</span>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Descrição da Carga */}
                    <div className="space-y-1">
                        <label className={labelStyle}>Descrição da Carga</label>
                        <input
                            className={inputStyle}
                            placeholder="Ex: Carga de Grãos, Eletrônicos, etc."
                            value={formData.cargo_description}
                            onChange={e => setFormData({ ...formData, cargo_description: e.target.value })}
                        />
                    </div>

                    {/* Origem e Destino */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>Cidade de Origem</label>
                            <input
                                required
                                className={inputStyle}
                                placeholder="Cidade - UF"
                                value={formData.origin}
                                onChange={e => setFormData({ ...formData, origin: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className={labelStyle}>Cidade de Destino</label>
                            <input
                                required
                                className={inputStyle}
                                placeholder="Cidade - UF"
                                value={formData.destination}
                                onChange={e => setFormData({ ...formData, destination: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Data da Viagem e KM Inicial */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>Data da Viagem</label>
                            <input
                                required
                                type="date"
                                className={inputStyle}
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>KM Inicial</label>
                            <input
                                required
                                type="number"
                                className={inputStyle}
                                placeholder="0"
                                value={formData.start_km}
                                onChange={e => setFormData({ ...formData, start_km: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* KM Final, CTE e Peso */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>KM Final</label>
                            <input
                                type="number"
                                className={inputStyle}
                                placeholder="Ex: 151200"
                                value={formData.end_km}
                                onChange={e => setFormData({ ...formData, end_km: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>CTE</label>
                            <input
                                className={inputStyle}
                                placeholder="Núm. Documento"
                                value={formData.cte}
                                onChange={e => setFormData({ ...formData, cte: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>Peso (KG)</label>
                            <input
                                required
                                type="number"
                                className={inputStyle}
                                placeholder="0"
                                value={formData.weight}
                                onChange={e => setFormData({ ...formData, weight: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Financeiro: Valor, Imposto, Comissão */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>Tarifa (R$/kg)</label>
                            <input
                                required
                                type="number"
                                step="0.01"
                                className={inputStyle}
                                placeholder="0,00"
                                value={formData.value}
                                onChange={e => setFormData({ ...formData, value: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>Imposto (%)</label>
                            <input
                                type="number"
                                className={inputStyle}
                                placeholder="12"
                                value={formData.tax_rate}
                                onChange={e => setFormData({ ...formData, tax_rate: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>Comissão (%)</label>
                            <input
                                type="number"
                                className={inputStyle}
                                placeholder="10"
                                value={formData.commission_rate}
                                onChange={e => setFormData({ ...formData, commission_rate: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Custos e Vale */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>Pedágio (R$)</label>
                            <input
                                type="number"
                                step="0.01"
                                className={inputStyle}
                                placeholder="0,00"
                                value={formData.tolls_value}
                                onChange={e => setFormData({ ...formData, tolls_value: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>Seguro da Viagem (R$)</label>
                            <input
                                type="number"
                                step="0.01"
                                className={inputStyle}
                                placeholder="0,00"
                                value={formData.insurance_value}
                                onChange={e => setFormData({ ...formData, insurance_value: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>Custos Estimados (R$)</label>
                            <input
                                type="number"
                                className={inputStyle}
                                placeholder="1200"
                                value={formData.estimated_cost}
                                onChange={e => setFormData({ ...formData, estimated_cost: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>Vale / Adiantamento (R$)</label>
                            <input
                                type="number"
                                className={inputStyle}
                                placeholder="500"
                                value={formData.advance_value}
                                onChange={e => setFormData({ ...formData, advance_value: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Valor Total Bruto previsto */}
                    {(() => {
                        const peso = parseFloat(formData.weight);
                        const tarifa = parseFloat(formData.value);
                        if (!isNaN(peso) && !isNaN(tarifa) && peso > 0 && tarifa > 0) {
                            const total = peso * tarifa;
                            const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                            return (
                                <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-0.5">Valor Total Bruto Previsto</p>
                                        <p className="text-[10px] text-blue-400">{peso.toLocaleString('pt-BR')} kg × {fmt(tarifa)}/kg</p>
                                    </div>
                                    <p className="text-2xl font-black text-blue-700">{fmt(total)}</p>
                                </div>
                            );
                        }
                        return null;
                    })()}

                    {/* Ações */}
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
                            {loading ? 'Salvando...' : 'Salvar Viagem'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
