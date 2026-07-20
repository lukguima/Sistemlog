import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { fleetService, tripService, settingsService } from '../../lib/services';
import {
    DOC_TYPES, analyzePdf, extractPdfText, normPlate, type AnalyzedDoc, type DocTypeKey,
} from '../../lib/docReader';
import {
    isDacteText, parseDacteText, ensureDacteFromFilename, looksLikeDacteFilename,
    matchVehicleByPlate, matchDriver, buildTripValueFields,
    type DacteParseResult,
} from '../../lib/dacteReader';
import {
    UploadCloud, FileText, CheckCircle2, AlertTriangle, Loader2,
    Trash2, ExternalLink, ShieldCheck, Truck,
} from 'lucide-react';

type UploadMode = 'auto' | 'compliance' | 'trip';

interface ReviewItem extends AnalyzedDoc {
    id: string;
    entityId: string;      // veículo ou motorista escolhido
    status: 'pendente' | 'salvando' | 'salvo' | 'erro';
    errorMsg?: string;
}

interface TripImportItem {
    id: string;
    file: File;
    parsed: DacteParseResult;
    cte: string;
    date: string;
    origin: string;
    destination: string;
    cargo_description: string;
    weight: string;
    value: string;          // tarifa (R$/unidade) — save calcula gross
    freight_display: number;
    tax_rate: string;
    tolls_value: string;
    loading_cost: string;
    unloading_cost: string;
    vehicle_id: string;
    implement_id: string;
    driver_id: string;
    start_km: string;
    status: 'pendente' | 'salvando' | 'salvo' | 'erro';
    tripStatus: 'completed' | 'pending';
    errorMsg?: string;
    matchNotes: string[];
    partialRead: boolean;
    pdfPlateHint: string;
    pdfDriverHint: string;
    vehicleMatched: boolean;
    driverMatched: boolean;
}

const fmtDate = (d?: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
const fmtMoney = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Documents() {
    const { user } = useAuth();
    const companyId = (user as any)?.company_id;

    const [vehicles, setVehicles] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [items, setItems] = useState<ReviewItem[]>([]);
    const [tripImports, setTripImports] = useState<TripImportItem[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [reading, setReading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [uploadMode, setUploadMode] = useState<UploadMode>('auto');
    const inputRef = useRef<HTMLInputElement>(null);

    const trucks = vehicles.filter(v => v.category !== 'implemento');
    const implementos = vehicles.filter(v => v.category === 'implemento');

    const loadBase = async () => {
        if (!companyId) return;
        const [vs, ds] = await Promise.all([
            fleetService.getVehicles(companyId),
            fleetService.getDrivers(companyId),
        ]);
        setVehicles(vs || []);
        setDrivers(ds || []);
        const { data: docs } = await supabase
            .from('compliance_documents')
            .select('*')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false })
            .limit(30);
        setHistory(docs || []);
    };

    useEffect(() => { loadBase(); }, [companyId]);

    // ── Vincula o documento analisado a um veículo/motorista ──
    const matchEntity = (a: AnalyzedDoc): string => {
        const def = a.docType ? DOC_TYPES.find(d => d.key === a.docType) : null;
        const ident = a.identifier ? normPlate(a.identifier) : '';

        if (!def || def.entity === 'vehicle') {
            // por placa do nome do arquivo ou do texto do PDF
            const byName = vehicles.find(v => normPlate(v.plate || '') === ident);
            if (byName) return byName.id;
            for (const p of a.platesInText) {
                const v = vehicles.find(vv => normPlate(vv.plate || '') === p);
                if (v) return v.id;
            }
        }
        if (!def || def.entity === 'driver') {
            const nameNorm = (a.identifier || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (nameNorm.length >= 4) {
                const d = drivers.find(dd => {
                    const dn = (dd.name || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    return dn === nameNorm || dn.includes(nameNorm) || nameNorm.includes(dn);
                });
                if (d) return d.id;
            }
        }
        return '';
    };

    const buildTripImport = (file: File, parsed: DacteParseResult, idx: number, partialRead = false): TripImportItem => {
        const { weight, value, gross } = buildTripValueFields(parsed);
        const notes: string[] = [];
        const plate0 = parsed.plates[0] || '';
        const plate1 = parsed.plates[1] || '';

        let vehicle = matchVehicleByPlate(trucks, plate0);
        let implement = matchVehicleByPlate(implementos, plate1);
        // Se a 1ª placa for implemento e a 2ª cavalo, inverte
        if (!vehicle && plate0) {
            const asImpl = matchVehicleByPlate(implementos, plate0);
            const asTruck = plate1 ? matchVehicleByPlate(trucks, plate1) : null;
            if (asTruck) { vehicle = asTruck; implement = asImpl || implement; }
            else if (asImpl) implement = asImpl;
        }
        if (!implement && plate1) {
            implement = matchVehicleByPlate(implementos, plate1) || matchVehicleByPlate(vehicles, plate1);
        }

        const driver = matchDriver(drivers, parsed.driverName, parsed.driverCpf);

        if (partialRead) notes.push('Revise: leitura parcial do PDF');
        if (plate0 && !vehicle) notes.push(`Placa ${plate0} não encontrada na frota`);
        if (plate1 && !implement) notes.push(`Implemento ${plate1} não encontrado na frota`);
        if (parsed.driverName && !driver) notes.push(`Motorista "${parsed.driverName}" não encontrado`);
        if (vehicle) notes.push(`Cavalo: ${vehicle.plate}`);
        if (implement) notes.push(`Implemento: ${implement.plate}`);
        if (driver) notes.push(`Motorista: ${driver.name}`);

        const pdfPlateHint = [plate0, plate1].filter(Boolean).join(' · ');
        const pdfDriverHint = parsed.driverName
            ? `${parsed.driverName}${parsed.driverCpf ? ` (CPF ${parsed.driverCpf})` : ''}`
            : '';

        return {
            id: `dacte-${Date.now()}-${idx}`,
            file,
            parsed,
            cte: parsed.cteNumber || '',
            date: parsed.date || new Date().toISOString().slice(0, 10),
            origin: parsed.origin || '',
            destination: parsed.destination || '',
            cargo_description: parsed.cargoDescription || '',
            weight: weight > 0 ? String(Number(weight.toFixed(3))) : '',
            value: value > 0 ? String(Number(value.toFixed(6))) : '',
            freight_display: gross,
            tax_rate: parsed.taxRate != null ? String(parsed.taxRate) : '',
            tolls_value: parsed.tollsValue != null ? String(parsed.tollsValue) : '',
            loading_cost: '',
            unloading_cost: '',
            vehicle_id: vehicle?.id || '',
            implement_id: implement?.id || '',
            driver_id: driver?.id || '',
            start_km: vehicle?.current_km != null ? String(vehicle.current_km) : '0',
            status: 'pendente',
            tripStatus: 'completed',
            matchNotes: notes,
            partialRead,
            pdfPlateHint,
            pdfDriverHint,
            vehicleMatched: !!vehicle,
            driverMatched: !!driver,
        };
    };

    // ── Recebe os arquivos (input ou drag&drop) ──
    const handleFiles = async (files: FileList | File[]) => {
        const pdfs = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
        if (pdfs.length === 0) return;
        setReading(true);
        try {
            const complianceBatch: ReviewItem[] = [];
            const tripBatch: TripImportItem[] = [];

            for (let i = 0; i < pdfs.length; i++) {
                const file = pdfs[i];
                const text = await extractPdfText(file);
                const nameIsDacte = looksLikeDacteFilename(file.name);

                // Modo Conformidade: nunca tenta viagem
                if (uploadMode === 'compliance') {
                    const a = await analyzePdf(file);
                    complianceBatch.push({
                        ...a,
                        id: `${Date.now()}-${i}`,
                        entityId: matchEntity(a),
                        status: 'pendente',
                    });
                    continue;
                }

                // Modo Viagens: sempre caminho de viagem (mesmo com texto fraco)
                if (uploadMode === 'trip') {
                    const parsed = ensureDacteFromFilename(file.name, parseDacteText(text));
                    const partial = !isDacteText(text) || (!parsed.origin && !parsed.freightValue);
                    tripBatch.push(buildTripImport(file, parsed, i, partial));
                    continue;
                }

                // Automático: DACTe por texto ou nome (força viagem se nome bater)
                if (isDacteText(text) || nameIsDacte) {
                    const parsed = ensureDacteFromFilename(file.name, parseDacteText(text));
                    if (parsed.isDacte) {
                        const partial = !isDacteText(text) || (!parsed.origin && !parsed.freightValue);
                        tripBatch.push(buildTripImport(file, parsed, i, partial));
                        continue;
                    }
                }

                const a = await analyzePdf(file);
                complianceBatch.push({
                    ...a,
                    id: `${Date.now()}-${i}`,
                    entityId: matchEntity(a),
                    status: 'pendente',
                });
            }

            if (complianceBatch.length) setItems(prev => [...prev, ...complianceBatch]);
            if (tripBatch.length) setTripImports(prev => [...prev, ...tripBatch]);
        } finally {
            setReading(false);
        }
    };

    const updateItem = (id: string, partial: Partial<ReviewItem>) => {
        setItems(prev => prev.map(it => it.id === id ? { ...it, ...partial } : it));
    };

    const updateTripImport = (id: string, partial: Partial<TripImportItem>) => {
        setTripImports(prev => prev.map(it => it.id === id ? { ...it, ...partial } : it));
    };

    // ── Confirma e lança viagem a partir do DACTe ──
    const saveTripImport = async (it: TripImportItem) => {
        if (!companyId) return;
        if (!it.origin || !it.destination) {
            updateTripImport(it.id, { status: 'erro', errorMsg: 'Informe origem e destino.' });
            return;
        }
        if (!it.vehicle_id || !it.driver_id) {
            updateTripImport(it.id, { status: 'erro', errorMsg: 'Selecione veículo e motorista.' });
            return;
        }
        if (!it.cte) {
            updateTripImport(it.id, { status: 'erro', errorMsg: 'Informe o número do CT-e.' });
            return;
        }

        const y = parseInt(String(it.date).slice(0, 4), 10);
        if (isNaN(y) || y < 2020 || y > 2099) {
            updateTripImport(it.id, { status: 'erro', errorMsg: 'Data da viagem inválida.' });
            return;
        }

        updateTripImport(it.id, { status: 'salvando', errorMsg: undefined });
        try {
            const toNum = (v: any) => (v === '' || v === null || v === undefined) ? 0 : Number(v) || 0;
            const weight = toNum(it.weight);
            const tarifa = toNum(it.value);
            const gross = weight > 0 && tarifa > 0 ? weight * tarifa : tarifa;

            let commission = 12;
            try {
                const s = await settingsService.getSettings(companyId);
                if (s?.default_commission_rate != null) commission = Number(s.default_commission_rate);
            } catch { /* usa default */ }

            // Viagens históricas: status concluído para não bloquear frota (pending/in_transit)
            // Não chama coupleImplement — importação não altera engate atual.
            if (it.tripStatus === 'pending') {
                const conflicts = await tripService.checkConflicts(it.driver_id, it.vehicle_id, undefined, it.implement_id || null);
                const msgs: string[] = [];
                if (conflicts.driverBusy) msgs.push('Motorista já em viagem ativa.');
                if (conflicts.vehicleBusy) msgs.push('Veículo já em viagem ativa.');
                if (conflicts.implementBusy) msgs.push('Implemento já em viagem ativa.');
                if (msgs.length > 0 && !window.confirm(`Atenção:\n${msgs.join('\n')}\n\nRegistrar mesmo assim?`)) {
                    updateTripImport(it.id, { status: 'pendente' });
                    return;
                }
            }

            await tripService.addTrip({
                company_id: companyId,
                vehicle_id: it.vehicle_id,
                driver_id: it.driver_id,
                implement_id: it.implement_id || null,
                origin: it.origin,
                destination: it.destination,
                cargo_description: it.cargo_description || null,
                cte_number: it.cte,
                weight,
                gross_value: gross,
                tax_rate: toNum(it.tax_rate),
                commission_rate: commission,
                tolls_value: toNum(it.tolls_value),
                insurance_value: 0,
                icms_value: toNum(it.parsed?.icmsValue ?? 0),
                loading_cost: toNum(it.loading_cost),
                unloading_cost: toNum(it.unloading_cost),
                advance_value: 0,
                estimated_cost: 0,
                start_km: toNum(it.start_km),
                end_km: null,
                status: it.tripStatus,
                driver_type: 'own',
                agregado_id: null,
                agregado_value: 0,
                created_at: `${it.date}T12:00:00.000Z`,
            });

            updateTripImport(it.id, { status: 'salvo' });
        } catch (e: any) {
            updateTripImport(it.id, { status: 'erro', errorMsg: e?.message || 'Erro ao lançar viagem.' });
        }
    };

    // ── Confirma e grava um documento ──
    const saveItem = async (it: ReviewItem) => {
        const def = it.docType ? DOC_TYPES.find(d => d.key === it.docType) : null;
        if (!def) { updateItem(it.id, { status: 'erro', errorMsg: 'Escolha o tipo do documento.' }); return; }
        if (!it.entityId) { updateItem(it.id, { status: 'erro', errorMsg: def.entity === 'vehicle' ? 'Escolha o veículo.' : 'Escolha o motorista.' }); return; }
        if (!it.expiry) { updateItem(it.id, { status: 'erro', errorMsg: 'Informe a data de vencimento.' }); return; }

        updateItem(it.id, { status: 'salvando', errorMsg: undefined });
        try {
            // 1. Grava o vencimento no cadastro (alimenta os alertas)
            if (def.entity === 'vehicle') {
                await fleetService.updateVehicle(it.entityId, { [def.column]: it.expiry });
            } else {
                await fleetService.updateDriver(it.entityId, { [def.column]: it.expiry });
            }

            // 2. Sobe o PDF para o storage
            const safeName = it.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const path = `${companyId}/${def.entity}/${it.entityId}/${def.key}-${Date.now()}-${safeName}`;
            const { error: upErr } = await supabase.storage
                .from('compliance-docs')
                .upload(path, it.file, { contentType: 'application/pdf' });
            // upload é secundário — se falhar, o vencimento já está salvo
            const filePath = upErr ? null : path;

            // 3. Registra no histórico
            await supabase.from('compliance_documents').insert([{
                company_id: companyId,
                entity_type: def.entity,
                entity_id: it.entityId,
                doc_type: def.key,
                expiry_date: it.expiry,
                file_path: filePath,
                file_name: it.file.name,
            }]);

            updateItem(it.id, { status: 'salvo', errorMsg: upErr ? 'Vencimento salvo; falha ao anexar PDF.' : undefined });
            loadBase();
        } catch (e: any) {
            updateItem(it.id, { status: 'erro', errorMsg: e?.message || 'Erro ao salvar.' });
        }
    };

    const saveAll = async () => {
        for (const it of items) {
            if (it.status === 'pendente' || it.status === 'erro') {
                // eslint-disable-next-line no-await-in-loop
                await saveItem(it);
            }
        }
    };

    const viewDoc = async (doc: any) => {
        if (!doc.file_path) return;
        const { data } = await supabase.storage.from('compliance-docs').createSignedUrl(doc.file_path, 3600);
        if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    };

    const entityName = (doc: any) => {
        if (doc.entity_type === 'vehicle') return vehicles.find(v => v.id === doc.entity_id)?.plate ?? '—';
        return drivers.find(d => d.id === doc.entity_id)?.name ?? '—';
    };
    const docLabel = (key: string) => DOC_TYPES.find(d => d.key === key)?.label ?? key.toUpperCase();

    const pendingCount = items.filter(i => i.status === 'pendente' || i.status === 'erro').length;
    const pendingTrips = tripImports.filter(i => i.status === 'pendente' || i.status === 'erro').length;

    return (
        <div className="space-y-8 pb-12 font-display">
            <div>
                <h1 className="text-3xl font-black text-slate-900">Central de Documentos</h1>
                <p className="text-slate-500 mt-1 uppercase text-xs font-bold tracking-widest">
                    CIV · CIPP · Aferição · Cronotacógrafo · CNH · ASO · NR20 · NR35 · MOPP · DACTe / CT-e
                </p>
            </div>

            {/* Tipo de upload */}
            <div className="flex flex-wrap gap-2">
                {([
                    { id: 'auto' as const, label: 'Automático', hint: 'Detecta o tipo' },
                    { id: 'compliance' as const, label: 'Conformidade', hint: 'CIV, CNH, ASO…' },
                    { id: 'trip' as const, label: 'Viagens (DACTe)', hint: 'Importar frete' },
                ]).map(m => (
                    <button
                        key={m.id}
                        type="button"
                        onClick={() => setUploadMode(m.id)}
                        className={`px-4 py-2.5 rounded-xl border text-left transition-all ${
                            uploadMode === m.id
                                ? 'border-blue-500 bg-blue-50 text-blue-800 ring-1 ring-blue-200'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                    >
                        <span className="block text-xs font-black uppercase tracking-wide">{m.label}</span>
                        <span className="block text-[10px] opacity-70 mt-0.5">{m.hint}</span>
                    </button>
                ))}
            </div>

            {/* Dropzone */}
            <div
                onClick={() => inputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                className={`cursor-pointer border-2 border-dashed rounded-3xl p-10 text-center transition-all ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50'}`}
            >
                <input ref={inputRef} type="file" accept="application/pdf" multiple className="hidden"
                    onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }} />
                {reading ? (
                    <div className="flex flex-col items-center gap-3 text-blue-600">
                        <Loader2 size={40} className="animate-spin" />
                        <p className="font-bold">Lendo os PDFs...</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3 text-slate-500">
                        <UploadCloud size={40} className="text-blue-500" />
                        <p className="font-black text-slate-700">Arraste os PDFs aqui ou clique para escolher</p>
                        <p className="text-xs max-w-lg">
                            {uploadMode === 'compliance' && 'Somente conformidade: CIV, CIPP, CNH, ASO e demais vencimentos.'}
                            {uploadMode === 'trip' && 'Somente viagens: cada PDF será tratado como DACTe / CT-e para importar frete.'}
                            {uploadMode === 'auto' && (
                                <>
                                    Conformidade (CIV, CNH…) atualiza vencimentos.{' '}
                                    <span className="font-semibold text-slate-600">DACTe / CT-e</span> (pelo conteúdo ou pelo nome do arquivo) importa viagem.
                                </>
                            )}
                        </p>
                    </div>
                )}
            </div>

            {/* Importação de viagens via DACTe */}
            {tripImports.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                <Truck size={18} className="text-indigo-600" /> Importar viagens ({tripImports.length})
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">Revise os dados do DACTe e confirme o lançamento em Viagens.</p>
                        </div>
                        <div className="flex gap-2">
                            {pendingTrips > 0 && (
                                <button
                                    onClick={async () => {
                                        for (const it of tripImports) {
                                            if (it.status === 'pendente' || it.status === 'erro') {
                                                // eslint-disable-next-line no-await-in-loop
                                                await saveTripImport(it);
                                            }
                                        }
                                    }}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2">
                                    <ShieldCheck size={15} /> Lançar todas ({pendingTrips})
                                </button>
                            )}
                            <button onClick={() => setTripImports([])}
                                className="border border-slate-200 text-slate-500 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-50">
                                Limpar
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {tripImports.map(it => (
                            <div key={it.id} className={`bg-white rounded-2xl border p-5 space-y-3 ${
                                it.status === 'salvo' ? 'border-emerald-300 bg-emerald-50/40'
                                : it.status === 'erro' ? 'border-rose-300'
                                : 'border-indigo-200'
                            }`}>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Truck size={18} className="text-indigo-500 shrink-0" />
                                        <div className="min-w-0">
                                            <span className="text-xs font-bold text-slate-700 truncate block" title={it.file.name}>{it.file.name}</span>
                                            <span className="text-[10px] font-black uppercase text-indigo-600">DACTe → Viagem</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {it.status === 'salvo'
                                            ? <span className="flex items-center gap-1 text-emerald-600 text-[10px] font-black uppercase"><CheckCircle2 size={14} /> Lançada</span>
                                            : <span className="flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><AlertTriangle size={11} /> Conferir</span>}
                                        <button onClick={() => setTripImports(prev => prev.filter(p => p.id !== it.id))}
                                            className="p-1 text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button>
                                    </div>
                                </div>

                                {it.partialRead && (
                                    <p className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                                        Revise: leitura parcial do PDF — confira CT-e, frete e datas.
                                    </p>
                                )}

                                {(!it.vehicleMatched || !it.driverMatched) && (it.pdfPlateHint || it.pdfDriverHint) && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                                            <AlertTriangle size={11} className="shrink-0" />
                                            PDF: {[it.pdfPlateHint, it.pdfDriverHint].filter(Boolean).join(' · ')} — não cadastrado
                                        </span>
                                        <Link
                                            to="/admin/fleet"
                                            className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800"
                                        >
                                            Cadastrar na Frota <ExternalLink size={11} />
                                        </Link>
                                    </div>
                                )}

                                {it.matchNotes.length > 0 && (
                                    <p className="text-[10px] text-slate-500 leading-relaxed">{it.matchNotes.join(' · ')}</p>
                                )}

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">CT-e</label>
                                        <input value={it.cte} disabled={it.status === 'salvo'}
                                            onChange={e => updateTripImport(it.id, { cte: e.target.value })}
                                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Data</label>
                                        <input type="date" value={it.date} disabled={it.status === 'salvo'}
                                            onChange={e => updateTripImport(it.id, { date: e.target.value })}
                                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Imposto %</label>
                                        <input type="number" step="0.01" value={it.tax_rate} disabled={it.status === 'salvo'}
                                            onChange={e => updateTripImport(it.id, { tax_rate: e.target.value })}
                                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Status</label>
                                        <select value={it.tripStatus} disabled={it.status === 'salvo'}
                                            onChange={e => updateTripImport(it.id, { tripStatus: e.target.value as 'completed' | 'pending' })}
                                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs">
                                            <option value="completed">Concluída (histórico)</option>
                                            <option value="pending">Pendente</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Origem</label>
                                        <input value={it.origin} disabled={it.status === 'salvo'}
                                            onChange={e => updateTripImport(it.id, { origin: e.target.value })}
                                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Destino</label>
                                        <input value={it.destination} disabled={it.status === 'salvo'}
                                            onChange={e => updateTripImport(it.id, { destination: e.target.value })}
                                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Carga</label>
                                    <input value={it.cargo_description} disabled={it.status === 'salvo'}
                                        onChange={e => updateTripImport(it.id, { cargo_description: e.target.value })}
                                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Cavalo</label>
                                        <select value={it.vehicle_id} disabled={it.status === 'salvo'}
                                            onChange={e => {
                                                const v = trucks.find(t => t.id === e.target.value);
                                                updateTripImport(it.id, {
                                                    vehicle_id: e.target.value,
                                                    start_km: v?.current_km != null ? String(v.current_km) : it.start_km,
                                                });
                                            }}
                                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs">
                                            <option value="">Selecione...</option>
                                            {trucks.map(v => <option key={v.id} value={v.id}>{v.plate}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Implemento</label>
                                        <select value={it.implement_id} disabled={it.status === 'salvo'}
                                            onChange={e => updateTripImport(it.id, { implement_id: e.target.value })}
                                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs">
                                            <option value="">Sem implemento</option>
                                            {implementos.map(v => <option key={v.id} value={v.id}>{v.plate}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Motorista</label>
                                        <select value={it.driver_id} disabled={it.status === 'salvo'}
                                            onChange={e => updateTripImport(it.id, { driver_id: e.target.value })}
                                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs">
                                            <option value="">Selecione...</option>
                                            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Peso</label>
                                        <input type="number" step="0.001" value={it.weight} disabled={it.status === 'salvo'}
                                            onChange={e => updateTripImport(it.id, { weight: e.target.value })}
                                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Pedágio (R$)</label>
                                        <input type="number" step="0.01" value={it.tolls_value} disabled={it.status === 'salvo'}
                                            onChange={e => updateTripImport(it.id, { tolls_value: e.target.value })}
                                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Carregamento (R$)</label>
                                        <input type="number" step="0.01" value={it.loading_cost} disabled={it.status === 'salvo'}
                                            onChange={e => updateTripImport(it.id, { loading_cost: e.target.value })}
                                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Descarga (R$)</label>
                                        <input type="number" step="0.01" value={it.unloading_cost} disabled={it.status === 'salvo'}
                                            onChange={e => updateTripImport(it.id, { unloading_cost: e.target.value })}
                                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                    <div className="md:col-span-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Frete total</label>
                                        <div className="w-full border border-indigo-100 bg-indigo-50 rounded-lg px-2 py-1.5 text-xs font-bold text-indigo-800">
                                            {fmtMoney(
                                                (Number(it.weight) > 0 && Number(it.value) > 0)
                                                    ? Number(it.weight) * Number(it.value)
                                                    : (Number(it.value) || it.freight_display || 0)
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {(it.parsed.icmsValue != null || it.parsed.series) && (
                                    <p className="text-[10px] text-slate-400">
                                        {it.parsed.series ? `Série ${it.parsed.series}` : ''}
                                        {it.parsed.icmsValue != null ? ` · ICMS R$ ${it.parsed.icmsValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
                                        {it.parsed.driverCpf ? ` · CPF ${it.parsed.driverCpf}` : ''}
                                    </p>
                                )}

                                {it.errorMsg && <p className="text-[10px] text-rose-600 font-bold">{it.errorMsg}</p>}

                                {it.status !== 'salvo' && (
                                    <button onClick={() => saveTripImport(it)} disabled={it.status === 'salvando'}
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-xl text-xs font-black uppercase disabled:opacity-50 flex items-center justify-center gap-2">
                                        {it.status === 'salvando' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                        Confirmar e lançar viagem
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Cards de revisão */}
            {items.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-black text-slate-800">Conferência ({items.length})</h2>
                        <div className="flex gap-2">
                            {pendingCount > 0 && (
                                <button onClick={saveAll}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2">
                                    <ShieldCheck size={15} /> Confirmar todos ({pendingCount})
                                </button>
                            )}
                            <button onClick={() => setItems([])}
                                className="border border-slate-200 text-slate-500 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-50">
                                Limpar lista
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {items.map(it => {
                            const def = it.docType ? DOC_TYPES.find(d => d.key === it.docType) : null;
                            const entityList = def?.entity === 'driver' ? drivers : vehicles;
                            const divergent = it.expiryFromName && it.expiryFromText && it.expiryFromName !== it.expiryFromText;
                            return (
                                <div key={it.id} className={`bg-white rounded-2xl border p-5 space-y-3 ${it.status === 'salvo' ? 'border-emerald-300 bg-emerald-50/40' : it.status === 'erro' ? 'border-rose-300' : divergent ? 'border-amber-300' : 'border-slate-200'}`}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <FileText size={18} className="text-blue-500 shrink-0" />
                                            <span className="text-xs font-bold text-slate-700 truncate" title={it.file.name}>{it.file.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {it.status === 'salvo'
                                                ? <span className="flex items-center gap-1 text-emerald-600 text-[10px] font-black uppercase"><CheckCircle2 size={14} /> Salvo</span>
                                                : it.confidence === 'alta' && !divergent
                                                    ? <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Leitura confirmada</span>
                                                    : <span className="flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><AlertTriangle size={11} /> Conferir</span>}
                                            <button onClick={() => setItems(prev => prev.filter(p => p.id !== it.id))}
                                                className="p-1 text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Tipo</label>
                                            <select value={it.docType ?? ''} disabled={it.status === 'salvo'}
                                                onChange={e => updateItem(it.id, { docType: (e.target.value || null) as DocTypeKey | null, entityId: '' })}
                                                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs">
                                                <option value="">Selecione...</option>
                                                {DOC_TYPES.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">
                                                {def?.entity === 'driver' ? 'Motorista' : 'Veículo'}
                                            </label>
                                            <select value={it.entityId} disabled={it.status === 'salvo'}
                                                onChange={e => updateItem(it.id, { entityId: e.target.value })}
                                                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs">
                                                <option value="">Selecione...</option>
                                                {entityList.map((e2: any) => (
                                                    <option key={e2.id} value={e2.id}>
                                                        {def?.entity === 'driver' ? e2.name : `${e2.plate}${e2.category === 'implemento' ? ' (Impl.)' : ''}`}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Vencimento</label>
                                            <input type="date" value={it.expiry ?? ''} disabled={it.status === 'salvo'}
                                                onChange={e => updateItem(it.id, { expiry: e.target.value || null })}
                                                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
                                        </div>
                                    </div>

                                    {divergent && it.status !== 'salvo' && (
                                        <p className="text-[10px] text-amber-600 font-medium">
                                            Nome do arquivo diz {fmtDate(it.expiryFromName)}, conteúdo do PDF diz {fmtDate(it.expiryFromText)} — confira antes de salvar.
                                        </p>
                                    )}
                                    {it.errorMsg && <p className="text-[10px] text-rose-600 font-bold">{it.errorMsg}</p>}

                                    {it.status !== 'salvo' && (
                                        <button onClick={() => saveItem(it)} disabled={it.status === 'salvando'}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-xs font-black uppercase disabled:opacity-50 flex items-center justify-center gap-2">
                                            {it.status === 'salvando' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                            Confirmar e salvar
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Histórico */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100">
                    <h2 className="text-lg font-black text-slate-800">Documentos registrados</h2>
                </div>
                {history.length === 0 ? (
                    <p className="text-center text-slate-400 text-sm py-10">Nenhum documento registrado ainda.</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wide">
                                <th className="text-left px-5 py-3">Documento</th>
                                <th className="text-left px-4 py-3">Vinculado a</th>
                                <th className="text-left px-4 py-3">Vencimento</th>
                                <th className="text-left px-4 py-3">Enviado em</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {history.map(doc => (
                                <tr key={doc.id} className="hover:bg-slate-50">
                                    <td className="px-5 py-3 font-bold text-slate-800">{docLabel(doc.doc_type)}</td>
                                    <td className="px-4 py-3 text-slate-600">{entityName(doc)}</td>
                                    <td className="px-4 py-3 font-semibold">{fmtDate(doc.expiry_date)}</td>
                                    <td className="px-4 py-3 text-slate-400 text-xs">{new Date(doc.created_at).toLocaleDateString('pt-BR')}</td>
                                    <td className="px-4 py-3 text-right">
                                        {doc.file_path && (
                                            <button onClick={() => viewDoc(doc)} title="Abrir PDF"
                                                className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><ExternalLink size={15} /></button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
