// Utilitários de formatação numérica para o padrão brasileiro

/** Formata valor monetário: 1000 → R$ 1.000,00 */
export const fmtCurrency = (value: number | string | null | undefined): string => {
    const n = Number(value) || 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

/** Formata quilometragem: 1000 → 1.000 */
export const fmtKm = (value: number | string | null | undefined): string => {
    const n = Number(value) || 0;
    return n.toLocaleString('pt-BR');
};

/** Data civil local, sem converter para UTC. */
export const localIsoDate = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

/**
 * Dia gravado em timestamptz à meia-noite UTC (o dia escolhido no formulário).
 * gte = início desse dia UTC; lt = início do dia UTC seguinte ao último.
 */
const nextCivilDay = (isoDate: string) => {
    const [y, m, d] = isoDate.split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    const ny = next.getUTCFullYear();
    const nm = String(next.getUTCMonth() + 1).padStart(2, '0');
    const nd = String(next.getUTCDate()).padStart(2, '0');
    return `${ny}-${nm}-${nd}`;
};

export const utcCalendarRange = (startDate: string, endDate: string) => ({
    gte: `${startDate}T00:00:00.000Z`,
    lt: `${nextCivilDay(endDate)}T00:00:00.000Z`,
});

/** created_at no calendário de Brasília (UTC−3, sem horário de verão). */
export const saoPauloStart = (isoDate: string) => `${isoDate.slice(0, 10)}T00:00:00.000-03:00`;
export const saoPauloEndExclusive = (isoDate: string) => `${nextCivilDay(isoDate.slice(0, 10))}T00:00:00.000-03:00`;

/** Formata KM/L com 2 casas decimais: 2.45 → 2,45 */
export const fmtKmL = (value: number | string | null | undefined): string => {
    const n = Number(value) || 0;
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/** Formata número com 2 casas decimais: 1000 → 1.000,00 */
export const fmtDecimal = (value: number | string | null | undefined): string => {
    const n = Number(value) || 0;
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
