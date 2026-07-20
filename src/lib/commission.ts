// ============================================================
// Comissão do motorista — base configurável por empresa
// ============================================================
import { DEFAULT_COMMISSION_RATE } from './constants';

export type CommissionBase = 'gross' | 'net_tax' | 'net_all';

export const COMMISSION_BASE_OPTIONS: { id: CommissionBase; label: string; hint: string }[] = [
    {
        id: 'gross',
        label: 'Valor bruto',
        hint: 'Comissão % sobre o frete bruto, sem descontar despesas.',
    },
    {
        id: 'net_tax',
        label: 'Líquido (somente imposto %)',
        hint: 'Comissão % sobre frete após descontar só o imposto padrão. (padrão atual)',
    },
    {
        id: 'net_all',
        label: 'Líquido (todas as despesas)',
        hint: 'Desconta imposto %, ICMS, pedágio, seguro e custos estimados antes da comissão.',
    },
];

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function normalizeCommissionBase(v: unknown): CommissionBase {
    if (v === 'gross' || v === 'net_all' || v === 'net_tax') return v;
    return 'net_tax';
}

/** Despesas em R$ usadas no modo net_all (e nos painéis financeiros). */
export function tripExpenseBreakdown(trip: any) {
    const gross = Number(trip?.gross_value) || 0;
    const taxRate = Number(trip?.tax_rate) || 0;
    const taxAmount = round2(gross * taxRate / 100);
    const icms = Number(trip?.icms_value) || 0;
    const tolls = Number(trip?.tolls_value) || 0;
    const insurance = Number(trip?.insurance_value) || 0;
    const estimated = Number(trip?.estimated_cost) || 0;
    return { gross, taxRate, taxAmount, icms, tolls, insurance, estimated };
}

export function calcTripCommissionBase(trip: any, baseMode: CommissionBase = 'net_tax'): number {
    const { gross, taxAmount, icms, tolls, insurance, estimated } = tripExpenseBreakdown(trip);
    if (baseMode === 'gross') return round2(Math.max(0, gross));
    if (baseMode === 'net_all') {
        return round2(Math.max(0, gross - taxAmount - icms - tolls - insurance - estimated));
    }
    // net_tax (default / legado)
    return round2(Math.max(0, gross - taxAmount));
}

export function calcTripCommission(
    trip: any,
    baseMode: CommissionBase = 'net_tax',
    defaultRate: number = DEFAULT_COMMISSION_RATE,
): { base: number; commission: number; rate: number; expenses: ReturnType<typeof tripExpenseBreakdown> } {
    const expenses = tripExpenseBreakdown(trip);
    const rate = Number(trip?.commission_rate) || defaultRate;
    const base = calcTripCommissionBase(trip, baseMode);
    const commission = round2(base * rate / 100);
    return { base, commission, rate, expenses };
}
