// ============================================================
// Leitor de DACTe / CT-e para importação de viagens históricas
// Isolado do leitor de conformidade (docReader.ts).
// ============================================================
import { extractPdfText, normPlate } from './docReader';

export interface DacteParseResult {
    isDacte: boolean;
    cteNumber: string | null;
    series: string | null;
    accessKey: string | null;
    date: string | null; // YYYY-MM-DD
    origin: string | null;
    destination: string | null;
    cargoDescription: string | null;
    weightKg: number | null;
    weightLiters: number | null;
    freightValue: number | null;
    tollsValue: number | null;
    taxRate: number | null;      // alíquota %
    icmsValue: number | null;    // valor R$ (conferência)
    plates: string[];            // normalizadas, ordem do PDF
    driverName: string | null;
    driverCpf: string | null;
    rawText: string;
}

const stripAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const norm = (s: string) => stripAccents(s).toUpperCase().replace(/\s+/g, ' ');

/** Converte "16.051,00" ou "16051,00" → number */
export function parseBrMoney(s: string): number | null {
    const cleaned = s.replace(/[R$\s]/gi, '').trim();
    if (!cleaned) return null;
    // 16.051,00 → 16051.00 | 7,00 → 7.00 | 40740.6600 → 40740.66
    if (/\d+\.\d{3},\d{2}/.test(cleaned) || /^\d{1,3}(\.\d{3})+,\d+$/.test(cleaned)) {
        const n = Number(cleaned.replace(/\./g, '').replace(',', '.'));
        return Number.isFinite(n) ? n : null;
    }
    if (cleaned.includes(',')) {
        const n = Number(cleaned.replace(/\./g, '').replace(',', '.'));
        return Number.isFinite(n) ? n : null;
    }
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
}

export function isDacteText(text: string): boolean {
    const t = norm(text);
    return /\bDACTE\b/.test(t)
        || /DOCUMENTO AUXILIAR DO\s+CONHECIMENTO DE TRANSPORTE/.test(t)
        || /\bCT-?E\b/.test(t) && /CHAVE DE ACESSO/.test(t);
}

function parseDateBr(s: string): string | null {
    const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return null;
    return `${m[3]}-${m[2]}-${m[1]}`;
}

function extractCteNumber(t: string): string | null {
    // "CT-E Nº DOCUMENTO: 4200" ou "Nº DOCUMENTO: 4200"
    let m = t.match(/N[ºO°]?\s*DOCUMENTO\s*[:.]?\s*(\d{1,9})/i);
    if (m) return m[1];
    // Bloco SÉRIE ... NÚMERO — no texto linear: "SÉRIE 002 4200 NÚMERO"
    m = t.match(/S[ÉE]RIE\s+(\d{1,3})\s+(\d{1,9})\s+N[ÚU]MERO/i);
    if (m) return m[2];
    // Chave de acesso: posições 26-34 = número do CT-e (9 dígitos)
    m = t.match(/\b(\d{44})\b/);
    if (m) {
        const num = m[1].slice(25, 34).replace(/^0+/, '');
        return num || null;
    }
    return null;
}

function extractSeries(t: string): string | null {
    const m = t.match(/S[ÉE]RIE\s*[:.]?\s*(\d{1,3})/i);
    return m ? m[1] : null;
}

function extractMoneyAfter(t: string, labelRe: RegExp): number | null {
    const m = t.match(labelRe);
    if (!m) return null;
    const window = t.slice(m.index! + m[0].length, m.index! + m[0].length + 40);
    const money = window.match(/R\$\s*([\d.]+,\d{2})/i) || window.match(/([\d.]+,\d{2})/);
    return money ? parseBrMoney(money[1]) : null;
}

function extractTaxRate(t: string): number | null {
    const n = norm(t);
    const idx = n.indexOf('ALIQUOTA DO ICMS');
    const window = idx >= 0 ? n.slice(idx, idx + 160) : n;
    // Preferência: percentual perto de BASE DE CALCULO / após alíquota
    const m = window.match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*%/);
    if (m) return parseBrMoney(m[1]);
    // Fallback: "7,00 %" no documento
    const all = [...n.matchAll(/(\d{1,2}[.,]\d{2})\s*%/g)].map(x => parseBrMoney(x[1]));
    const valid = all.find(v => v != null && v > 0 && v <= 40);
    return valid ?? null;
}

function extractIcmsValue(t: string): number | null {
    const n = norm(t);
    const idx = n.indexOf('VALOR DO ICMS');
    if (idx >= 0) {
        // Busca no texto original numa janela aproximada (acentos podem deslocar ±10)
        const start = Math.max(0, idx - 5);
        const window = t.slice(start, start + 100);
        const money = window.match(/R\$\s*([\d.]+,\d{2})/i) || window.match(/([\d.]+,\d{2})/);
        if (money) return parseBrMoney(money[1]);
    }
    // Componente da prestação: "ICMS   R$ 1.123,57"
    const m = t.match(/\bICMS\s+R\$\s*([\d.]+,\d{2})/i);
    return m ? parseBrMoney(m[1]) : null;
}

function extractOriginDest(t: string): { origin: string | null; destination: string | null } {
    // Preferência: bloco com códigos IBGE imediatamente antes do rótulo de prestação
    // (evita o "ORIGEM DA PRESTAÇÃO - DATA/HORA" do canhoto no topo do DACTe)
    const block = t.match(
        /([A-Za-zÀ-ú]+(?:\s+[A-Za-zÀ-ú]+)?)\s*-\s*([A-Z]{2})\s*-\s*\d{7}\s+([A-Za-zÀ-ú]+(?:\s+[A-Za-zÀ-ú]+)?)\s*-\s*([A-Z]{2})\s*-\s*\d{7}\s+ORIGEM\s+DA\s+PRESTA[ÇC][ÃA]O\s+DESTINO/i
    );
    if (block) {
        const NOISE = /^(ELETR[OÔ]NICO|DOCUMENTO|AUXILIAR|CONHECIMENTO|TRANSPORTE)/i;
        let originCity = block[1].trim();
        const ow = originCity.split(/\s+/);
        if (ow.length > 1 && NOISE.test(ow[0])) originCity = ow[ow.length - 1];
        return {
            origin: `${originCity} - ${block[2]}`,
            destination: `${block[3].trim()} - ${block[4]}`,
        };
    }

    // Fallback: todos os "Cidade - UF - IBGE" do documento
    const pairs = [...t.matchAll(/([A-Za-zÀ-ú]+(?:\s+[A-Za-zÀ-ú]+)?)\s*-\s*([A-Z]{2})\s*-\s*\d{7}/g)];
    const NOISE = /^(ELETR[OÔ]NICO|DOCUMENTO|AUXILIAR|CONHECIMENTO|TRANSPORTE|RODOVI[AÁ]RIO|MODAL|DACTE)/i;
    const cities = pairs.map(p => {
        const words = p[1].trim().split(/\s+/);
        if (words.length > 1 && NOISE.test(words[0])) {
            return { city: words[words.length - 1], uf: p[2] };
        }
        return { city: p[1].trim(), uf: p[2] };
    }).filter(c => !NOISE.test(c.city.split(/\s+/)[0]));

    if (cities.length >= 2) {
        const a = cities[0];
        const b = cities[1];
        return { origin: `${a.city} - ${a.uf}`, destination: `${b.city} - ${b.uf}` };
    }
    return { origin: null, destination: null };
}

function extractCargo(t: string): string | null {
    // "VALOR TOTAL DA CARGA OLEO DIESEL A S10   R$ 263.829,37"
    const m = t.match(/VALOR TOTAL DA CARGA\s+([A-Z0-9À-ú][A-Z0-9À-ú\s\/-]{2,50}?)\s+R\$/i);
    if (m) return m[1].replace(/\s+/g, ' ').trim();
    const m2 = t.match(/OLEO\s+DIESEL[A-Z0-9\s]*/i) || t.match(/ÓLEO\s+DIESEL[A-Z0-9\s]*/i);
    return m2 ? m2[0].replace(/\s+/g, ' ').trim() : null;
}

function extractWeightKg(t: string): number | null {
    const m = t.match(/PESO\s+BRUTO\s+([\d.]+(?:,\d+)?)\s*KG/i);
    return m ? parseBrMoney(m[1]) : null;
}

function extractWeightLiters(t: string): number | null {
    const m = t.match(/GRANEL\s+([\d.]+(?:,\d+)?)\s*LITROS/i);
    return m ? parseBrMoney(m[1]) : null;
}

function extractPlatesFromObs(t: string): string[] {
    // "VEÍCULOS RHA-1I14/PR , SEN-4G35/PR"
    const obsIdx = norm(t).indexOf('VEICULOS');
    const window = obsIdx >= 0 ? t.slice(obsIdx, obsIdx + 120) : t;
    const found = window.match(/[A-Z]{3}-?\d[A-Z0-9]\d{2}/gi) || [];
    const plates: string[] = [];
    for (const p of found) {
        const n = normPlate(p);
        if (n && !plates.includes(n)) plates.push(n);
    }
    return plates;
}

function extractDriver(t: string): { name: string | null; cpf: string | null } {
    const m = t.match(/MOTORISTA\s+([A-Za-zÀ-ú\s.]+?)\s*,?\s*CPF\s*[:.]?\s*(\d{11}|\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i);
    if (m) {
        return {
            name: m[1].replace(/\s+/g, ' ').trim(),
            cpf: m[2].replace(/\D/g, ''),
        };
    }
    const m2 = t.match(/MOTORISTA\s+([A-Za-zÀ-ú\s.]{5,60}?)(?:\s*;|\s*INFORMA|\s*RNTRC)/i);
    return { name: m2 ? m2[1].replace(/\s+/g, ' ').trim() : null, cpf: null };
}

function extractDate(t: string): string | null {
    // Protocolo: "141260191848939 - 02/07/2026 16:33:34"
    const proto = t.match(/PROTOCOLO[^\d]*\d+\s*-\s*(\d{2}\/\d{2}\/\d{4})/i);
    if (proto) return parseDateBr(proto[1]);
    // "02/07/2026 16:29:00 MODELO"
    const em = t.match(/(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}:\d{2}\s+MODELO/i);
    if (em) return parseDateBr(em[1]);
    return null;
}

/** Parseia texto já extraído de um DACTe */
export function parseDacteText(rawText: string): DacteParseResult {
    const empty: DacteParseResult = {
        isDacte: false,
        cteNumber: null,
        series: null,
        accessKey: null,
        date: null,
        origin: null,
        destination: null,
        cargoDescription: null,
        weightKg: null,
        weightLiters: null,
        freightValue: null,
        tollsValue: null,
        taxRate: null,
        icmsValue: null,
        plates: [],
        driverName: null,
        driverCpf: null,
        rawText,
    };

    if (!isDacteText(rawText)) return empty;

    const { origin, destination } = extractOriginDest(rawText);
    const { name: driverName, cpf: driverCpf } = extractDriver(rawText);
    const accessKey = (rawText.match(/\b(\d{44})\b/) || [])[1] || null;

    const freightValue =
        extractMoneyAfter(rawText, /VALOR TOTAL DO SERVI[ÇC]O/i)
        ?? extractMoneyAfter(rawText, /FRETE\s+VALOR/i)
        ?? extractMoneyAfter(rawText, /VALOR TOTAL A RECEBER/i);

    return {
        isDacte: true,
        cteNumber: extractCteNumber(rawText),
        series: extractSeries(rawText),
        accessKey,
        date: extractDate(rawText),
        origin,
        destination,
        cargoDescription: extractCargo(rawText),
        weightKg: extractWeightKg(rawText),
        weightLiters: extractWeightLiters(rawText),
        freightValue,
        tollsValue: extractMoneyAfter(rawText, /PED[ÁA]GIO/i),
        taxRate: extractTaxRate(rawText),
        icmsValue: extractIcmsValue(rawText),
        plates: extractPlatesFromObs(rawText),
        driverName,
        driverCpf,
        rawText,
    };
}

/** Lê o PDF e retorna o parse DACTe (isDacte=false se não for CT-e) */
export async function analyzeDactePdf(file: File): Promise<DacteParseResult> {
    const text = await extractPdfText(file);
    return parseDacteText(text);
}

/** Match de placa em lista de veículos */
export function matchVehicleByPlate(vehicles: any[], plateNorm: string): any | null {
    if (!plateNorm) return null;
    return vehicles.find(v => normPlate(v.plate || '') === plateNorm) || null;
}

/** Match de motorista por nome ou CPF */
export function matchDriver(drivers: any[], name: string | null, cpf: string | null): any | null {
    if (cpf) {
        const digits = cpf.replace(/\D/g, '');
        const byCpf = drivers.find(d => String(d.cpf || '').replace(/\D/g, '') === digits);
        if (byCpf) return byCpf;
    }
    if (!name || name.length < 4) return null;
    const nameNorm = norm(name);
    return drivers.find(d => {
        const dn = norm(d.name || '');
        return dn === nameNorm || dn.includes(nameNorm) || nameNorm.includes(dn);
    }) || null;
}

/**
 * Monta tarifa + peso para o save de viagem:
 * gross = weight * tarifa quando ambos > 0.
 * Usa kg se disponível; senão litros; senão só o frete (peso 0).
 */
export function buildTripValueFields(parsed: DacteParseResult): { weight: number; value: number; gross: number } {
    const frete = parsed.freightValue || 0;
    const kg = parsed.weightKg || 0;
    const liters = parsed.weightLiters || 0;
    const weight = kg > 0 ? kg : liters;
    if (weight > 0 && frete > 0) {
        return { weight, value: frete / weight, gross: frete };
    }
    return { weight: 0, value: frete, gross: frete };
}
