import { supabase } from './supabase';
import { normPlate } from './docReader';
import type { DacteParseResult } from './dacteReader';

function textOrNull(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed || null;
}

function numberOrNull(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string') return null;
    const raw = value.trim().replace(/\s/g, '').replace(/^R\$/i, '');
    if (!raw) return null;
    const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

/** Converte o JSON do GPT no mesmo formato do leitor por regras. */
export function dacteFromGpt(raw: unknown, rawText: string): DacteParseResult | null {
    if (!raw || typeof raw !== 'object') return null;
    const row = raw as Record<string, unknown>;
    if (row.isDacte !== true) return null;

    const plates = Array.isArray(row.plates)
        ? row.plates.map((plate) => normPlate(String(plate || ''))).filter(Boolean)
        : [];
    const accessDigits = (textOrNull(row.accessKey) || '').replace(/\D/g, '');
    const date = typeof row.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? row.date : null;
    const parsed: DacteParseResult = {
        isDacte: true,
        cteNumber: textOrNull(row.cteNumber),
        series: textOrNull(row.series),
        accessKey: accessDigits.length === 44 ? accessDigits : null,
        date,
        origin: textOrNull(row.origin),
        destination: textOrNull(row.destination),
        cargoDescription: textOrNull(row.cargoDescription),
        weightKg: numberOrNull(row.weightKg),
        weightLiters: numberOrNull(row.weightLiters),
        freightValue: numberOrNull(row.freightValue),
        tollsValue: numberOrNull(row.tollsValue),
        taxRate: numberOrNull(row.taxRate),
        icmsValue: numberOrNull(row.icmsValue),
        plates,
        driverName: textOrNull(row.driverName),
        driverCpf: (textOrNull(row.driverCpf) || '').replace(/\D/g, '') || null,
        rawText,
    };

    const hasTripData = !!(parsed.cteNumber || parsed.origin || parsed.destination || parsed.freightValue || parsed.driverName);
    return hasTripData ? parsed : null;
}

/** Pede a leitura ao GPT da empresa. Sem chave ou resposta inválida, devolve null. */
export async function interpretDocumentText(text: string, fileName: string): Promise<DacteParseResult | null> {
    try {
        const { data, error } = await supabase.functions.invoke('interpret-document', {
            body: { text: text.slice(0, 20000), fileName },
        });
        if (error || !data || data.use_local) return null;
        return dacteFromGpt(data.parsed, text);
    } catch {
        return null;
    }
}

export async function openaiKeyRequest(body: { action: 'status' | 'save' | 'delete'; apiKey?: string }) {
    const { data, error } = await supabase.functions.invoke('openai-key', { body });
    if (error) {
        let message = 'Não foi possível falar com o servidor da chave.';
        const response = (error as { context?: Response }).context;
        if (response && typeof response.json === 'function') {
            try {
                const payload = await response.json();
                if (payload?.error) message = String(payload.error);
            } catch {
                /* corpo vazio */
            }
        }
        throw new Error(message);
    }
    if (data?.error) throw new Error(String(data.error));
    return data as { configured: boolean; hint: string | null };
}
