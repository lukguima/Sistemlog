import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { fleetService } from '../../lib/services';
import {
    DOC_TYPES, analyzePdf, normPlate, type AnalyzedDoc, type DocTypeKey,
} from '../../lib/docReader';
import {
    UploadCloud, FileText, CheckCircle2, AlertTriangle, Loader2,
    Trash2, ExternalLink, ShieldCheck,
} from 'lucide-react';

interface ReviewItem extends AnalyzedDoc {
    id: string;
    entityId: string;      // veículo ou motorista escolhido
    status: 'pendente' | 'salvando' | 'salvo' | 'erro';
    errorMsg?: string;
}

const fmtDate = (d?: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';

export default function Documents() {
    const { user } = useAuth();
    const companyId = (user as any)?.company_id;

    const [vehicles, setVehicles] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [items, setItems] = useState<ReviewItem[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [reading, setReading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

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
            const nameNorm = (a.identifier || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
            if (nameNorm.length >= 4) {
                const d = drivers.find(dd => {
                    const dn = (dd.name || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
                    return dn === nameNorm || dn.includes(nameNorm) || nameNorm.includes(dn);
                });
                if (d) return d.id;
            }
        }
        return '';
    };

    // ── Recebe os arquivos (input ou drag&drop) ──
    const handleFiles = async (files: FileList | File[]) => {
        const pdfs = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
        if (pdfs.length === 0) return;
        setReading(true);
        try {
            const analyzed = await Promise.all(pdfs.map(f => analyzePdf(f)));
            const newItems: ReviewItem[] = analyzed.map((a, i) => ({
                ...a,
                id: `${Date.now()}-${i}`,
                entityId: matchEntity(a),
                status: 'pendente',
            }));
            setItems(prev => [...prev, ...newItems]);
        } finally {
            setReading(false);
        }
    };

    const updateItem = (id: string, partial: Partial<ReviewItem>) => {
        setItems(prev => prev.map(it => it.id === id ? { ...it, ...partial } : it));
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

    return (
        <div className="space-y-8 pb-12 font-display">
            <div>
                <h1 className="text-3xl font-black text-slate-900">Central de Documentos</h1>
                <p className="text-slate-500 mt-1 uppercase text-xs font-bold tracking-widest">
                    CIV · CIPP · Aferição · Cronotacógrafo · CNH · ASO · NR20 · NR35 · MOPP
                </p>
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
                        <p className="text-xs">O sistema lê o nome do arquivo e o conteúdo, identifica o tipo, o veículo/motorista e o vencimento automaticamente.</p>
                    </div>
                )}
            </div>

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
