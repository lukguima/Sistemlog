// ============================================================
// Leitor automático de documentos de conformidade (PDF)
// Estratégia dupla:
//   1. Nome do arquivo (convenção "YYYY MM DD - TIPO - PLACA/NOME")
//   2. Texto do PDF (pdfjs) — busca datas perto de palavras-chave
// Quando as duas fontes concordam => confiança alta.
// ============================================================
import * as pdfjs from 'pdfjs-dist';
// @ts-ignore — worker via URL (Vite)
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
// @ts-ignore — pasta de fontes padrão (Vite)
import liberationRegularUrl from 'pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

const STANDARD_FONT_DATA_URL = String(liberationRegularUrl).replace(/LiberationSans-Regular\.ttf(\?.*)?$/i, '');

export type DocTypeKey =
    | 'crlv' | 'antt' | 'civ' | 'tacografo' | 'cipp' | 'afericao'
    | 'cnh' | 'aso' | 'nr20' | 'nr35' | 'mopp';

export interface DocTypeDef {
    key: DocTypeKey;
    label: string;
    entity: 'vehicle' | 'driver';
    column: string; // coluna de vencimento na tabela
}

export const DOC_TYPES: DocTypeDef[] = [
    { key: 'crlv',      label: 'CRLV / Licenciamento', entity: 'vehicle', column: 'document_expiry' },
    { key: 'antt',      label: 'ANTT',                 entity: 'vehicle', column: 'antt_expiry' },
    { key: 'civ',       label: 'CIV',                  entity: 'vehicle', column: 'civ_expiry' },
    { key: 'tacografo', label: 'Cronotacógrafo',       entity: 'vehicle', column: 'tacografo_expiry' },
    { key: 'cipp',      label: 'CIPP',                 entity: 'vehicle', column: 'cipp_expiry' },
    { key: 'afericao',  label: 'Aferição (Tanque)',    entity: 'vehicle', column: 'afericao_expiry' },
    { key: 'cnh',       label: 'CNH',                  entity: 'driver',  column: 'license_expiry' },
    { key: 'aso',       label: 'ASO',                  entity: 'driver',  column: 'aso_expiry' },
    { key: 'nr20',      label: 'NR20',                 entity: 'driver',  column: 'nr20_expiry' },
    { key: 'nr35',      label: 'NR35',                 entity: 'driver',  column: 'nr35_expiry' },
    { key: 'mopp',      label: 'MOPP',                 entity: 'driver',  column: 'mopp_expiry' },
];

const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = (s: string) => stripAccents(s).toUpperCase();

// normaliza placa: remove hífen/espaços — "SEE-1G93" == "SEE1G93"
export const normPlate = (s: string) => norm(s).replace(/[^A-Z0-9]/g, '');

const PLATE_RE = /[A-Z]{3}-?\s?\d[A-Z0-9]\d{2}/;

const MONTHS: Record<string, string> = {
    JAN: '01', FEV: '02', MAR: '03', ABR: '04', MAI: '05', JUN: '06',
    JUL: '07', AGO: '08', SET: '09', OUT: '10', NOV: '11', DEZ: '12',
};

/** Detecta o tipo de documento a partir de um texto (nome do arquivo ou conteúdo) */
export function detectDocType(text: string): DocTypeKey | null {
    const t = norm(text).replace(/\s+/g, ' ');
    if (/\bAFERICAO\b|VEICULO TANQUE RODOVIARIO/.test(t)) return 'afericao';
    if (/\bCIPP\b|TRANSPORTE DE PRODUTOS PERIGOSOS/.test(t) && !/MOPP|CONDUTORES/.test(t)) return 'cipp';
    if (/CRONOTACOGRAFO|TACOGRAFO/.test(t)) return 'tacografo';
    if (/\bCIV\b|INSPECAO VEICULAR/.test(t)) return 'civ';
    if (/\bNR\s?-?\s?20\b/.test(t)) return 'nr20';
    if (/\bNR\s?-?\s?35\b/.test(t)) return 'nr35';
    if (/\bMOPP\b/.test(t)) return 'mopp';
    if (/\bASO\b|ATESTADO DE SAUDE OCUPACIONAL/.test(t)) return 'aso';
    if (/\bCNH\b|CARTEIRA NACIONAL DE HABILITACAO/.test(t)) return 'cnh';
    if (/\bANTT\b/.test(t)) return 'antt';
    if (/\bCRLV\b|LICENCIAMENTO/.test(t)) return 'crlv';
    return null;
}

/** Extrai a primeira data válida de um trecho de texto (dd/mm/aaaa, dd/mm/aa, dd/MMM/aa) */
function parseDateToken(s: string): string | null {
    let m = s.match(/(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    m = s.match(/(\d{2})[\/\-.]([A-Z]{3})[\/\-.](\d{2,4})/);
    if (m && MONTHS[m[2]]) {
        const year = m[3].length === 2 ? `20${m[3]}` : m[3];
        return `${year}-${MONTHS[m[2]]}-${m[1]}`;
    }
    m = s.match(/(\d{2})[\/\-.](\d{2})[\/\-.](\d{2})(?!\d)/);
    if (m) return `20${m[3]}-${m[2]}-${m[1]}`;
    return null;
}

const EXPIRY_KEYWORDS = [
    'VALIDO ATE', 'VALIDA ATE', 'VALIDADE ATE', 'COM VALIDADE ATE',
    'DATA DE VENCIMENTO', 'VENCIMENTO', 'VALIDADE',
];

/** Procura a data de vencimento no texto do PDF, perto das palavras-chave */
export function findExpiryInText(rawText: string): string | null {
    const t = norm(rawText).replace(/\s+/g, ' ');
    for (const kw of EXPIRY_KEYWORDS) {
        let idx = 0;
        while ((idx = t.indexOf(kw, idx)) !== -1) {
            const window = t.slice(idx + kw.length, idx + kw.length + 60);
            const d = parseDateToken(window);
            if (d) return d;
            idx += kw.length;
        }
    }
    return null;
}

/** Extrai placas encontradas no texto do PDF */
export function findPlatesInText(rawText: string): string[] {
    const t = norm(rawText);
    const found = t.match(new RegExp(PLATE_RE.source, 'g')) || [];
    return Array.from(new Set(found.map(normPlate)));
}

export interface FilenameParse {
    expiry: string | null;      // YYYY-MM-DD do prefixo do nome
    docType: DocTypeKey | null;
    identifier: string | null;  // placa ou nome
}

/** Interpreta o padrão "YYYY MM DD - TIPO - PLACA/NOME - extra.pdf" */
export function parseFilename(fileName: string): FilenameParse {
    const base = fileName.replace(/\.pdf$/i, '').trim();
    const result: FilenameParse = { expiry: null, docType: null, identifier: null };

    const dateMatch = base.match(/^(\d{4})[ ._-]+(\d{2})[ ._-]+(\d{2})/);
    if (dateMatch) result.expiry = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;

    const parts = base.split(/\s*-\s*/).map(p => p.trim()).filter(Boolean);
    // parts[0] pode ser a data; procura o tipo e o identificador nos demais
    for (const p of parts) {
        if (!result.docType) {
            const dt = detectDocType(p);
            if (dt) { result.docType = dt; continue; }
        }
    }
    // identificador: primeira parte que parece placa; senão, a parte mais longa não-numérica após o tipo
    for (const p of parts.slice(1)) {
        if (PLATE_RE.test(norm(p))) { result.identifier = p; break; }
    }
    if (!result.identifier) {
        const candidates = parts.slice(1).filter(p => !detectDocType(p) && !/^\d+$/.test(p) && p.length >= 4);
        if (candidates.length) result.identifier = candidates.sort((a, b) => b.length - a.length)[0];
    }
    return result;
}

function pageTextFromContent(content: { items: unknown[] }): string {
    let out = '';
    for (const raw of content.items) {
        const it = raw as { str?: string; hasEOL?: boolean };
        if (typeof it.str !== 'string') continue;
        out += it.str;
        if (it.hasEOL) out += '\n';
        else if (it.str) out += ' ';
    }
    return out;
}

async function readPdfPages(data: Uint8Array, opts: Record<string, unknown> = {}): Promise<string> {
    const pdf = await pdfjs.getDocument({
        data: data.slice(),
        useSystemFonts: true,
        standardFontDataUrl: STANDARD_FONT_DATA_URL,
        ...opts,
    }).promise;
    let text = '';
    const maxPages = Math.min(pdf.numPages, 5);
    for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += pageTextFromContent(content) + '\n';
    }
    return text;
}

/** Extrai o texto completo de um PDF (todas as páginas) */
export async function extractPdfText(file: File): Promise<string> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    try {
        return await readPdfPages(bytes);
    } catch (e) {
        console.warn('Falha ao extrair texto do PDF (worker); tentando na thread principal:', e);
        try {
            const prev = pdfjs.GlobalWorkerOptions.workerSrc;
            // Força fallback sem worker quando o worker falha no browser
            (pdfjs.GlobalWorkerOptions as { workerSrc: string }).workerSrc = '';
            const text = await readPdfPages(bytes, { disableWorker: true });
            pdfjs.GlobalWorkerOptions.workerSrc = prev;
            return text;
        } catch (e2) {
            console.warn('Falha ao extrair texto do PDF:', e2);
            return '';
        }
    }
}

export interface AnalyzedDoc {
    file: File;
    docType: DocTypeKey | null;
    expiry: string | null;          // decisão final
    expiryFromName: string | null;
    expiryFromText: string | null;
    identifier: string | null;      // placa/nome do arquivo
    platesInText: string[];
    confidence: 'alta' | 'media' | 'baixa';
}

/** Análise completa de um arquivo: nome + conteúdo, com cruzamento */
export async function analyzePdf(file: File): Promise<AnalyzedDoc> {
    const fromName = parseFilename(file.name);
    const text = await extractPdfText(file);

    const typeFromText = detectDocType(text);
    const expiryFromText = findExpiryInText(text);
    const platesInText = findPlatesInText(text);

    const docType = fromName.docType ?? typeFromText;
    // Prioridade da data: quando nome e texto concordam, qualquer um serve;
    // quando divergem, o NOME do arquivo prevalece (convenção do usuário),
    // mas a confiança cai para revisão manual.
    let expiry = fromName.expiry ?? expiryFromText;
    let confidence: AnalyzedDoc['confidence'] = 'baixa';

    if (fromName.expiry && expiryFromText) {
        confidence = fromName.expiry === expiryFromText ? 'alta' : 'media';
        expiry = fromName.expiry;
    } else if (fromName.expiry || expiryFromText) {
        confidence = 'media';
    }
    if (!docType) confidence = 'baixa';

    return {
        file,
        docType,
        expiry,
        expiryFromName: fromName.expiry,
        expiryFromText,
        identifier: fromName.identifier,
        platesInText,
        confidence,
    };
}
