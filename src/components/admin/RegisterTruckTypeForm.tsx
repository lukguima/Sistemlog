import { useState } from 'react';
import { IMPLEMENT_TYPE_OPTIONS, TRUCK_TYPES, TRAILER_TRUCK_TYPES, type CompanyTruckTypeKind, type TruckTypeId } from '../../lib/constants';
import { fleetService } from '../../lib/services';

interface RegisterTruckTypeFormProps {
    companyId: string;
    defaultKind: CompanyTruckTypeKind;
    onCreated: (row: any) => void;
    onClose: () => void;
}

export default function RegisterTruckTypeForm({ companyId, defaultKind, onCreated, onClose }: RegisterTruckTypeFormProps) {
    const [name, setName] = useState('');
    const [kind, setKind] = useState<CompanyTruckTypeKind>(defaultKind);
    const [layoutKey, setLayoutKey] = useState<TruckTypeId>('TRUCK');
    const [usesImplement, setUsesImplement] = useState(false);
    const [saving, setSaving] = useState(false);

    const labelStyle = "text-[10px] font-black text-[#8B95B1] uppercase tracking-widest ml-1 mb-1.5 block";
    const inputStyle = "w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300 appearance-none";

    function changeLayout(next: TruckTypeId) {
        setLayoutKey(next);
        setUsesImplement((TRAILER_TRUCK_TYPES as string[]).includes(next));
    }

    async function save() {
        const trimmed = name.trim();
        if (!trimmed) {
            alert('Informe o nome do tipo.');
            return;
        }
        if (!companyId) {
            alert('Empresa não identificada. Faça logout e login novamente.');
            return;
        }
        if (kind === 'cavalo') {
            const clash = Object.values(TRUCK_TYPES).some(t =>
                t.id.toLowerCase() === trimmed.toLowerCase() || t.name.toLowerCase() === trimmed.toLowerCase()
            );
            if (clash) {
                alert('Esse nome já existe na lista padrão.');
                return;
            }
        } else if (IMPLEMENT_TYPE_OPTIONS.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
            alert('Esse nome já existe na lista padrão.');
            return;
        }

        setSaving(true);
        try {
            const row = await fleetService.addCompanyTruckType({
                company_id: companyId,
                name: trimmed,
                kind,
                layout_key: layoutKey,
                uses_implement: kind === 'cavalo' && usesImplement,
            });
            onCreated(row);
            onClose();
        } catch (error: any) {
            alert(error?.message || 'Erro ao cadastrar o tipo. Rode o script FIX_TRUCK_TYPES.sql no Supabase.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div
            className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3"
            onKeyDown={e => {
                if (e.key === 'Enter') e.preventDefault();
            }}
        >
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Novo tipo</p>
            <div className="space-y-1">
                <label className={labelStyle}>Nome</label>
                <input
                    className={inputStyle}
                    placeholder="Ex: Tritrem, Carreta 5 eixos"
                    value={name}
                    onChange={e => setName(e.target.value)}
                />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                    <label className={labelStyle}>Uso</label>
                    <select
                        className={inputStyle}
                        value={kind}
                        onChange={e => setKind(e.target.value as CompanyTruckTypeKind)}
                    >
                        <option value="cavalo">Caminhão / Cavalo</option>
                        <option value="implemento">Implemento</option>
                    </select>
                </div>
                <div className="space-y-1">
                    <label className={labelStyle}>Desenho na inspeção 3D</label>
                    <select
                        className={inputStyle}
                        value={layoutKey}
                        onChange={e => changeLayout(e.target.value as TruckTypeId)}
                    >
                        {Object.values(TRUCK_TYPES).map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                </div>
            </div>
            {kind === 'cavalo' && (
                <label className="flex items-center gap-2 text-sm text-slate-700 ml-1">
                    <input
                        type="checkbox"
                        checked={usesImplement}
                        onChange={e => setUsesImplement(e.target.checked)}
                    />
                    Usa carreta / implemento
                </label>
            )}
            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2.5 rounded-xl font-bold text-xs uppercase text-slate-700 border border-slate-200 hover:bg-white transition-all"
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="flex-1 bg-[#2563EB] text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                    {saving ? 'Salvando...' : 'Salvar tipo'}
                </button>
            </div>
        </div>
    );
}
