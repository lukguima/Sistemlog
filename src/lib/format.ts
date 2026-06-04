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
