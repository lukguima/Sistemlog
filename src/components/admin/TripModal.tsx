import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { fixedRouteService, settingsService, agregadoService, tripService, clientService } from '../../lib/services';
import { useAuth } from '../../context/AuthContext';
import { saveDraft, loadDraft, clearDraftStore } from '../../hooks/usePersistedForm';

const DRAFT_KEY = 'trip';
const makeEmpty = () => ({
    vehicle_id: '', implement_id: '', driver_id: '', cargo_description: '', origin: '', destination: '',
    client_id: '',
    date: new Date().toISOString().split('T')[0], start_km: '', end_km: '', cte: '',
    weight: '', value: '', freight_total: '', icms_value: '',
    tax_rate: '', commission_rate: '', estimated_cost: '',
    advance_value: '', tolls_value: '', insurance_value: '',
    loading_cost: '', unloading_cost: '', status: 'pending',
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
    const [recentPairs, setRecentPairs] = useState<{ origin: string; destination: string; count: number }[]>([]);
    const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [routePick, setRoutePick] = useState('');
    const [agregados, setAgregados] = useState<any[]>([]);
    const isEditing = !!initialData;
    // Separa cavalos/caminhões (para o campo Veículo) dos implementos
    const trucks = (vehicles || []).filter(v => v.category !== 'implemento');
    const implementos = (vehicles || []).filter(v => v.category === 'implemento');
    const buildEditData = (data: any) => {
        const fmt = (v: any) => (v != null && v !== '') ? Number(v).toFixed(2) : '';

        // Reconstrói tarifa (R$/kg) ou frete total a partir do gross_value
        const weight = parseFloat(data?.weight) || 0;
        const gross = parseFloat(data?.gross_value) || 0;
        let tarifa = data?.value;
        let freightTotal = data?.freight_total;
        if ((tarifa == null || tarifa === '') && (freightTotal == null || freightTotal === '')) {
            if (weight > 0 && gross > 0) {
                tarifa = gross / weight;
                freightTotal = '';
            } else if (gross > 0) {
                tarifa = '';
                freightTotal = gross;
            }
        }

        return {
            ...makeEmpty(),
            ...data,
            cte: data?.cte || data?.cte_number || '',
            value: tarifa !== '' && tarifa != null ? fmt(tarifa) : '',
            freight_total: freightTotal !== '' && freightTotal != null ? fmt(freightTotal) : '',
            icms_value: fmt(data?.icms_value),
            weight: fmt(data?.weight),
            tax_rate: fmt(data?.tax_rate),
            commission_rate: fmt(data?.commission_rate),
            estimated_cost: fmt(data?.estimated_cost),
            advance_value: fmt(data?.advance_value),
            tolls_value: fmt(data?.tolls_value || data?.toll_expense),
            insurance_value: fmt(data?.insurance_value || data?.other_expenses),
            loading_cost: fmt(data?.loading_cost),
            unloading_cost: fmt(data?.unloading_cost),
            start_km: data?.start_km ?? '',
            end_km: data?.end_km ?? '',
            client_id: data?.client_id ?? '',
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

    // Liga/desliga do imposto: desligado grava tax_rate = 0
    const [taxOn, setTaxOn] = useState(true);
    const lastTaxRef = React.useRef<string>('');

    React.useEffect(() => {
        if (!isOpen) return;
        if (isEditing && initialData) {
            const d = buildEditData(initialData);
            setFormDataState(d);
            setTaxOn(parseFloat(d.tax_rate) !== 0);
        } else if (!isEditing) {
            const draft = loadDraft(DRAFT_KEY);
            const d = { ...makeEmpty(), ...(draft || {}) };
            setFormDataState(d);
            setTaxOn(parseFloat(d.tax_rate) !== 0 || d.tax_rate === '');
        }
    }, [isOpen, initialData?.id]);

    const toggleTax = () => {
        if (taxOn) {
            lastTaxRef.current = formData.tax_rate;
            setFormData({ tax_rate: '0' });
            setTaxOn(false);
        } else {
            setFormData({ tax_rate: lastTaxRef.current && parseFloat(lastTaxRef.current) !== 0 ? lastTaxRef.current : '' });
            setTaxOn(true);
        }
    };

    function setFormData(partial: Partial<ReturnType<typeof makeEmpty>>) {
        setFormDataState((prev: ReturnType<typeof makeEmpty>) => {
            const next = { ...prev, ...partial };
            if (!isEditing) saveDraft(DRAFT_KEY, next);
            return next;
        });
    }

    useEffect(() => {
        if (isOpen && companyId) {
            fixedRouteService.getFixedRoutes(companyId).then(setFixedRoutes).catch(() => setFixedRoutes([]));
            tripService.getRecentRoutePairs(companyId).then(setRecentPairs).catch(() => setRecentPairs([]));
            tripService.getCitySuggestions(companyId).then(setCitySuggestions).catch(() => setCitySuggestions([]));
            clientService.getClients(companyId, { activeOnly: true }).then(setClients).catch(() => setClients([]));
            setRoutePick('');
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

    const routeOptions = useMemo(() => {
        const opts: { key: string; label: string; origin: string; destination: string; freight_value?: number | string; kind: 'fixed' | 'recent' }[] = [];
        const seen = new Set<string>();
        for (const r of fixedRoutes) {
            const origin = String(r.origin || '').trim();
            const destination = String(r.destination || '').trim();
            if (!origin || !destination) continue;
            const norm = `${origin.toLowerCase()}→${destination.toLowerCase()}`;
            seen.add(norm);
            const val = parseFloat(String(r.freight_value));
            opts.push({
                key: `fixed:${r.id}`,
                label: `${origin} → ${destination}${Number.isFinite(val) ? ` (R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})` : ''} · Fixo`,
                origin,
                destination,
                freight_value: r.freight_value,
                kind: 'fixed',
            });
        }
        for (const p of recentPairs) {
            const norm = `${p.origin.toLowerCase()}→${p.destination.toLowerCase()}`;
            if (seen.has(norm)) continue;
            seen.add(norm);
            opts.push({
                key: `recent:${norm}`,
                label: `${p.origin} → ${p.destination} · Usado ${p.count}x`,
                origin: p.origin,
                destination: p.destination,
                kind: 'recent',
            });
        }
        return opts;
    }, [fixedRoutes, recentPairs]);

    // Auto-fill value based on fixed routes
    useEffect(() => {
        if (!initialData && formData.origin && formData.destination) {
            const match = fixedRoutes.find(r => 
                r.origin.toLowerCase().trim() === formData.origin.toLowerCase().trim() && 
                r.destination.toLowerCase().trim() === formData.destination.toLowerCase().trim()
            );
            if (match) {
                setFormData({ value: match.freight_value, freight_total: '' });
            }
        }
    }, [formData.origin, formData.destination, fixedRoutes, initialData]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const tarifa = parseFloat(formData.value) || 0;
        const freteTotal = parseFloat(formData.freight_total) || 0;
        if (tarifa <= 0 && freteTotal <= 0) {
            alert('Informe a Tarifa (R$/kg) ou o Frete total (R$).');
            return;
        }
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

                    {/* Seleção de Trecho (fixos + recentes) */}
                    {!initialData && (
                        <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 mb-2">
                            <label className={`${labelStyle} text-blue-600`}>Usar Trecho (Opcional)</label>
                            <select
                                className={`${inputStyle} border-blue-200 focus:ring-blue-500/30`}
                                value={routePick}
                                onChange={e => {
                                    const key = e.target.value;
                                    setRoutePick(key);
                                    if (!key) return;
                                    const route = routeOptions.find(r => r.key === key);
                                    if (route) {
                                        setFormData({
                                            origin: route.origin,
                                            destination: route.destination,
                                            ...(route.kind === 'fixed' && route.freight_value != null
                                                ? { value: String(route.freight_value), freight_total: '' }
                                                : {}),
                                        });
                                    }
                                }}
                            >
                                <option value="">--- Selecione um trecho para carregar origem e destino ---</option>
                                {routeOptions.map(r => (
                                    <option key={r.key} value={r.key}>{r.label}</option>
                                ))}
                            </select>
                            <p className="text-[10px] text-blue-500 mt-2 ml-1">
                                {routeOptions.length > 0
                                    ? 'Trechos fixos preenchem também o valor. Rotas recentes vêm das viagens já lançadas.'
                                    : 'Nenhum trecho ainda — digite as cidades abaixo ou cadastre em Trechos Fixos na tela de Viagens.'}
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
                                        // Pré-carrega o implemento engatado no cavalo (engate persistente)
                                        setFormData({
                                            ...formData,
                                            vehicle_id: vId,
                                            start_km: vehicle?.current_km || '',
                                            implement_id: (vehicle as any)?.current_implement_id || '',
                                        });
                                    }}
                                >
                                    <option value="">Selecione...</option>
                                    {trucks.length === 0 && (
                                        <option value="" disabled>Nenhum caminhão encontrado — cadastre na Frota</option>
                                    )}
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
                            <div className="space-y-1 bg-violet-50/60 border border-violet-100 rounded-xl p-3">
                                <label className={labelStyle}>🔗 Implemento Acoplado</label>
                                <select
                                    className={inputStyle}
                                    value={formData.implement_id}
                                    onChange={e => setFormData({ ...formData, implement_id: e.target.value })}
                                >
                                    <option value="">Sem implemento (desacoplado)</option>
                                    {implementos.map(v => (
                                        <option key={v.id} value={v.id}>
                                            {v.plate}{v.implement_type ? ` - ${v.implement_type}` : ''}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-violet-500 ml-1">
                                    Pré-carregado com o engate atual do cavalo. Trocar aqui acopla o novo implemento ao salvar a viagem.
                                </p>
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
                                const freteTotal = parseFloat(formData.freight_total);
                                const gross  = (!isNaN(freteTotal) && freteTotal > 0)
                                    ? freteTotal
                                    : ((!isNaN(peso) && !isNaN(tarifa) && peso > 0 && tarifa > 0)
                                        ? peso * tarifa : parseFloat(formData.value) || 0);
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

                    {/* Cliente (opcional) */}
                    <div className="space-y-1">
                        <label className={labelStyle}>Cliente</label>
                        <select
                            className={inputStyle}
                            value={formData.client_id || ''}
                            onChange={e => {
                                const clientId = e.target.value;
                                const client = clients.find((c: any) => c.id === clientId);
                                const next: Partial<ReturnType<typeof makeEmpty>> = { client_id: clientId };
                                if (client?.default_destination) {
                                    next.destination = client.default_destination;
                                }
                                setFormData(next);
                            }}
                        >
                            <option value="">— Sem cliente (opcional) —</option>
                            {clients.map((c: any) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}{c.default_destination ? ` · ${c.default_destination}` : ''}
                                </option>
                            ))}
                        </select>
                        {clients.length === 0 && (
                            <p className="text-[10px] text-slate-400 ml-1">
                                Cadastre clientes em Clientes → Cadastro (e rode ADD_CLIENTS_TABLE.sql se ainda não rodou).
                            </p>
                        )}
                    </div>

                    {/* Origem e Destino */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>Cidade de Origem</label>
                            <input
                                required
                                list="trip-city-suggestions"
                                className={inputStyle}
                                placeholder="Cidade - UF"
                                value={formData.origin}
                                onChange={e => setFormData({ origin: e.target.value })}
                                autoComplete="off"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className={labelStyle}>Cidade de Destino</label>
                            <input
                                required
                                list="trip-city-suggestions"
                                className={inputStyle}
                                placeholder="Cidade - UF"
                                value={formData.destination}
                                onChange={e => setFormData({ destination: e.target.value })}
                                autoComplete="off"
                            />
                        </div>
                        <datalist id="trip-city-suggestions">
                            {citySuggestions.map(city => (
                                <option key={city} value={city} />
                            ))}
                        </datalist>
                    </div>

                    {/* Data da Viagem e KM Inicial */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>Data da Viagem</label>
                            <input
                                required
                                type="date"
                                min="2020-01-01"
                                max="2099-12-31"
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

                    {/* Financeiro: Tarifa / Frete total, Imposto, Comissão, ICMS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>Tarifa (R$/kg)</label>
                            <input
                                type="number"
                                step="0.01"
                                className={inputStyle}
                                placeholder="0,00"
                                value={formData.value}
                                onChange={e => setFormData({
                                    value: e.target.value,
                                    freight_total: e.target.value ? '' : formData.freight_total,
                                })}
                            />
                            <p className="text-[10px] text-slate-400 ml-1">Deixe vazio se usar frete total.</p>
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>Frete total (R$)</label>
                            <input
                                type="number"
                                step="0.01"
                                className={inputStyle}
                                placeholder="0,00"
                                value={formData.freight_total}
                                onChange={e => setFormData({
                                    freight_total: e.target.value,
                                    value: e.target.value ? '' : formData.value,
                                })}
                            />
                            <p className="text-[10px] text-slate-400 ml-1">Use quando a empresa não cobra por kg.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center justify-between pr-1">
                                <label className={labelStyle}>Imposto (%)</label>
                                <button
                                    type="button"
                                    onClick={toggleTax}
                                    title={taxOn ? 'Desligar imposto nesta viagem' : 'Ligar imposto'}
                                    className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${taxOn ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${taxOn ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                </button>
                            </div>
                            <input
                                type="number"
                                disabled={!taxOn}
                                className={`${inputStyle} ${!taxOn ? 'opacity-50 bg-slate-50' : ''}`}
                                placeholder="12"
                                value={taxOn ? formData.tax_rate : '0'}
                                onChange={e => setFormData({ ...formData, tax_rate: e.target.value })}
                            />
                            {!taxOn && (
                                <p className="text-[10px] text-slate-400 ml-1">Sem imposto nesta viagem.</p>
                            )}
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>ICMS/ISS (R$)</label>
                            <input
                                type="number"
                                step="0.01"
                                className={inputStyle}
                                placeholder="0,00"
                                value={formData.icms_value}
                                onChange={e => setFormData({ ...formData, icms_value: e.target.value })}
                            />
                            <p className="text-[10px] text-slate-400 ml-1">Separado do imposto %.</p>
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
                            <label className={labelStyle}>Carregamento (R$)</label>
                            <input
                                type="number"
                                step="0.01"
                                className={inputStyle}
                                placeholder="0,00"
                                value={formData.loading_cost}
                                onChange={e => setFormData({ ...formData, loading_cost: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>Descarga (R$)</label>
                            <input
                                type="number"
                                step="0.01"
                                className={inputStyle}
                                placeholder="0,00"
                                value={formData.unloading_cost}
                                onChange={e => setFormData({ ...formData, unloading_cost: e.target.value })}
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
                        const freteTotal = parseFloat(formData.freight_total);
                        const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                        if (!isNaN(freteTotal) && freteTotal > 0) {
                            return (
                                <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-0.5">Valor Total Bruto Previsto</p>
                                        <p className="text-[10px] text-blue-400">Frete total informado</p>
                                    </div>
                                    <p className="text-2xl font-black text-blue-700">{fmt(freteTotal)}</p>
                                </div>
                            );
                        }
                        if (!isNaN(peso) && !isNaN(tarifa) && peso > 0 && tarifa > 0) {
                            const total = peso * tarifa;
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
