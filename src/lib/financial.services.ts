import { supabase } from './supabase';

// ─── Categorias ───────────────────────────────────────────────────────────────

export const financialCategoryService = {
    async getAll(companyId: string) {
        const { data, error } = await supabase
            .from('financial_categories')
            .select('*')
            .eq('company_id', companyId)
            .order('type')
            .order('name');
        if (error) throw error;
        return data ?? [];
    },
    async add(companyId: string, payload: { name: string; type: 'receita' | 'despesa' }) {
        const { data, error } = await supabase
            .from('financial_categories')
            .insert([{ ...payload, company_id: companyId }])
            .select().single();
        if (error) throw error;
        return data;
    },
    async update(id: string, payload: { name: string; type: 'receita' | 'despesa' }) {
        const { data, error } = await supabase
            .from('financial_categories')
            .update(payload).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },
    async remove(id: string) {
        const { error } = await supabase.from('financial_categories').delete().eq('id', id);
        if (error) throw error;
    },
    async seedDefaults(companyId: string) {
        const defaults = [
            { name: 'Frete', type: 'receita' },
            { name: 'Outros Serviços', type: 'receita' },
            { name: 'Combustível', type: 'despesa' },
            { name: 'Manutenção', type: 'despesa' },
            { name: 'Pneus', type: 'despesa' },
            { name: 'Salários/Comissões', type: 'despesa' },
            { name: 'Financiamento', type: 'despesa' },
            { name: 'Impostos', type: 'despesa' },
            { name: 'Administrativo', type: 'despesa' },
            { name: 'Pedágio', type: 'despesa' },
        ];
        const { error } = await supabase
            .from('financial_categories')
            .insert(defaults.map(d => ({ ...d, company_id: companyId })));
        if (error) throw error;
    }
};

// ─── Centros de Custo ─────────────────────────────────────────────────────────

export const costCenterService = {
    async getAll(companyId: string) {
        const { data, error } = await supabase
            .from('cost_centers')
            .select('*')
            .eq('company_id', companyId)
            .order('name');
        if (error) throw error;
        return data ?? [];
    },
    async add(companyId: string, name: string) {
        const { data, error } = await supabase
            .from('cost_centers')
            .insert([{ name, company_id: companyId }])
            .select().single();
        if (error) throw error;
        return data;
    },
    async remove(id: string) {
        const { error } = await supabase.from('cost_centers').delete().eq('id', id);
        if (error) throw error;
    }
};

// ─── Lançamentos ──────────────────────────────────────────────────────────────

export const transactionService = {
    async getAll(companyId: string, startDate?: string, endDate?: string) {
        let q = supabase
            .from('financial_transactions')
            .select(`*, category:financial_categories(name,type), cost_center:cost_centers(name), vehicle:vehicles(plate), driver:drivers(name)`)
            .eq('company_id', companyId)
            .order('competence_date', { ascending: false });
        if (startDate) q = q.gte('competence_date', startDate);
        if (endDate) q = q.lte('competence_date', endDate);
        const { data, error } = await q;
        if (error) throw error;
        return data ?? [];
    },
    async add(payload: any) {
        const { data, error } = await supabase
            .from('financial_transactions')
            .insert([payload]).select().single();
        if (error) throw error;
        return data;
    },
    async update(id: string, payload: any) {
        const { data, error } = await supabase
            .from('financial_transactions')
            .update(payload).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },
    async remove(id: string) {
        const { error } = await supabase.from('financial_transactions').delete().eq('id', id);
        if (error) throw error;
    },
    async markPaid(id: string, paymentDate: string) {
        const { data, error } = await supabase
            .from('financial_transactions')
            .update({ status: 'paid', payment_date: paymentDate })
            .eq('id', id).select().single();
        if (error) throw error;
        return data;
    }
};

// ─── Contas a Pagar ───────────────────────────────────────────────────────────

export const accountsPayableService = {
    async getAll(companyId: string, status?: string) {
        let q = supabase
            .from('accounts_payable')
            .select(`*, category:financial_categories(name), vehicle:vehicles(plate)`)
            .eq('company_id', companyId)
            .order('due_date', { ascending: true });
        if (status) q = q.eq('status', status);
        const { data, error } = await q;
        if (error) throw error;
        // Auto-mark overdue
        const today = new Date().toISOString().split('T')[0];
        return (data ?? []).map((r: any) => ({
            ...r,
            status: r.status === 'pending' && r.due_date < today ? 'overdue' : r.status
        }));
    },
    async add(payload: any) {
        const { data, error } = await supabase
            .from('accounts_payable')
            .insert([payload]).select().single();
        if (error) throw error;
        return data;
    },
    async update(id: string, payload: any) {
        const { data, error } = await supabase
            .from('accounts_payable')
            .update(payload).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },
    async markPaid(id: string, paidDate: string) {
        const { data, error } = await supabase
            .from('accounts_payable')
            .update({ status: 'paid', paid_date: paidDate })
            .eq('id', id).select().single();
        if (error) throw error;
        return data;
    },
    async remove(id: string) {
        const { error } = await supabase.from('accounts_payable').delete().eq('id', id);
        if (error) throw error;
    }
};

// ─── Contas a Receber ─────────────────────────────────────────────────────────

export const accountsReceivableService = {
    async getAll(companyId: string, status?: string) {
        let q = supabase
            .from('accounts_receivable')
            .select(`*, trip:trips(origin,destination)`)
            .eq('company_id', companyId)
            .order('due_date', { ascending: true });
        if (status) q = q.eq('status', status);
        const { data, error } = await q;
        if (error) throw error;
        const today = new Date().toISOString().split('T')[0];
        return (data ?? []).map((r: any) => ({
            ...r,
            status: r.status === 'pending' && r.due_date < today ? 'overdue' : r.status
        }));
    },
    async add(payload: any) {
        const { data, error } = await supabase
            .from('accounts_receivable')
            .insert([payload]).select().single();
        if (error) throw error;
        return data;
    },
    async update(id: string, payload: any) {
        const { data, error } = await supabase
            .from('accounts_receivable')
            .update(payload).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },
    async markReceived(id: string, receivedDate: string) {
        const { data, error } = await supabase
            .from('accounts_receivable')
            .update({ status: 'received', received_date: receivedDate })
            .eq('id', id).select().single();
        if (error) throw error;
        return data;
    },
    async remove(id: string) {
        const { error } = await supabase.from('accounts_receivable').delete().eq('id', id);
        if (error) throw error;
    }
};

// ─── Fluxo de Caixa ───────────────────────────────────────────────────────────

export const cashFlowService = {
    async getMonthly(companyId: string, year: number) {
        const start = `${year}-01-01`;
        const end = `${year}-12-31`;

        const [txRes, fuelRes, maintRes, tripsRes] = await Promise.all([
            supabase.from('financial_transactions')
                .select('type, amount, competence_date, status')
                .eq('company_id', companyId)
                .gte('competence_date', start).lte('competence_date', end),
            supabase.from('fuel_records')
                .select('total_cost, date')
                .eq('company_id', companyId)
                .gte('date', start).lte('date', end),
            supabase.from('maintenance')
                .select('cost, date')
                .eq('company_id', companyId)
                .gte('date', start).lte('date', end),
            supabase.from('trips')
                .select('gross_value, created_at, status')
                .eq('company_id', companyId)
                .gte('created_at', `${start}T00:00:00`)
                .lte('created_at', `${end}T23:59:59`)
                .eq('status', 'completed')
        ]);

        const months = Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            label: new Date(year, i, 1).toLocaleString('pt-BR', { month: 'short' }).replace('.', ''),
            receitas: 0,
            despesas: 0,
            saldo: 0
        }));

        // Receitas de fretes
        (tripsRes.data ?? []).forEach((t: any) => {
            const m = new Date(t.created_at).getMonth();
            months[m].receitas += Number(t.gross_value) || 0;
        });

        // Transações manuais
        (txRes.data ?? []).forEach((t: any) => {
            const m = new Date(t.competence_date + 'T12:00:00').getMonth();
            if (t.type === 'receita') months[m].receitas += Number(t.amount) || 0;
            else months[m].despesas += Number(t.amount) || 0;
        });

        // Combustível
        (fuelRes.data ?? []).forEach((f: any) => {
            const m = new Date(f.date + 'T12:00:00').getMonth();
            months[m].despesas += Number(f.total_cost) || 0;
        });

        // Manutenção
        (maintRes.data ?? []).forEach((m: any) => {
            const idx = new Date(m.date + 'T12:00:00').getMonth();
            months[idx].despesas += Number(m.cost) || 0;
        });

        months.forEach(m => { m.saldo = m.receitas - m.despesas; });
        return months;
    }
};

// ─── DRE Gerencial ────────────────────────────────────────────────────────────

export const dreService = {
    async get(companyId: string, startDate: string, endDate: string) {
        const [tripsRes, fuelRes, maintRes, txRes, advRes] = await Promise.all([
            supabase.from('trips').select('gross_value, status')
                .eq('company_id', companyId)
                .gte('created_at', `${startDate}T00:00:00`)
                .lte('created_at', `${endDate}T23:59:59`)
                .eq('status', 'completed'),
            supabase.from('fuel_records').select('total_cost')
                .eq('company_id', companyId)
                .gte('date', startDate).lte('date', endDate),
            supabase.from('maintenance').select('cost')
                .eq('company_id', companyId)
                .gte('date', startDate).lte('date', endDate),
            supabase.from('financial_transactions')
                .select('type, amount, category:financial_categories(name)')
                .eq('company_id', companyId)
                .gte('competence_date', startDate).lte('competence_date', endDate),
            supabase.from('driver_advances').select('amount')
                .eq('company_id', companyId)
                .gte('created_at', `${startDate}T00:00:00`)
                .lte('created_at', `${endDate}T23:59:59`)
        ]);

        const receitaFretes = (tripsRes.data ?? []).reduce((s: number, t: any) => s + (Number(t.gross_value) || 0), 0);
        const combustivel = (fuelRes.data ?? []).reduce((s: number, f: any) => s + (Number(f.total_cost) || 0), 0);
        const manutencao = (maintRes.data ?? []).reduce((s: number, m: any) => s + (Number(m.cost) || 0), 0);
        const adiantamentos = (advRes.data ?? []).reduce((s: number, a: any) => s + (Number(a.amount) || 0), 0);

        let receitasExtras = 0, despesasAdmin = 0, impostos = 0, financiamentos = 0, outrasDesp = 0;
        (txRes.data ?? []).forEach((t: any) => {
            const cat = t.category?.name?.toLowerCase() ?? '';
            if (t.type === 'receita') { receitasExtras += Number(t.amount) || 0; return; }
            const v = Number(t.amount) || 0;
            if (cat.includes('imposto') || cat.includes('tax')) impostos += v;
            else if (cat.includes('financiamento') || cat.includes('parcela')) financiamentos += v;
            else if (cat.includes('admin') || cat.includes('salário')) despesasAdmin += v;
            else outrasDesp += v;
        });

        const receitaBruta = receitaFretes + receitasExtras;
        const custosOperacionais = combustivel + manutencao + adiantamentos;
        const lucroBruto = receitaBruta - custosOperacionais;
        const despesasTotais = despesasAdmin + impostos + financiamentos + outrasDesp;
        const resultadoLiquido = lucroBruto - despesasTotais;
        const margem = receitaBruta > 0 ? (resultadoLiquido / receitaBruta) * 100 : 0;

        return {
            receitaFretes, receitasExtras, receitaBruta,
            combustivel, manutencao, adiantamentos, custosOperacionais,
            lucroBruto,
            despesasAdmin, impostos, financiamentos, outrasDesp, despesasTotais,
            resultadoLiquido, margem
        };
    }
};

// ─── Financiamentos ───────────────────────────────────────────────────────────

export const financingService = {
    async getAll(companyId: string) {
        const { data, error } = await supabase
            .from('financings')
            .select('*, vehicle:vehicles(plate, model)')
            .eq('company_id', companyId)
            .order('start_date', { ascending: false });
        if (error) throw error;
        return data ?? [];
    },
    async add(payload: any) {
        const { data, error } = await supabase
            .from('financings').insert([payload]).select().single();
        if (error) throw error;
        return data;
    },
    async update(id: string, payload: any) {
        const { data, error } = await supabase
            .from('financings').update(payload).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },
    async remove(id: string) {
        const { error } = await supabase.from('financings').delete().eq('id', id);
        if (error) throw error;
    },
    async generateInstallments(financingId: string, companyId: string, startDate: string, installments: number, value: number) {
        const rows = Array.from({ length: installments }, (_, i) => {
            const d = new Date(startDate + 'T12:00:00');
            d.setMonth(d.getMonth() + i);
            return {
                financing_id: financingId,
                company_id: companyId,
                number: i + 1,
                due_date: d.toISOString().split('T')[0],
                amount: value,
                status: 'pending'
            };
        });
        const { error } = await supabase.from('financing_installments').insert(rows);
        if (error) throw error;
    },
    async getInstallments(financingId: string) {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('financing_installments')
            .select('*')
            .eq('financing_id', financingId)
            .order('number');
        if (error) throw error;
        return (data ?? []).map((r: any) => ({
            ...r,
            status: r.status === 'pending' && r.due_date < today ? 'overdue' : r.status
        }));
    },
    async markInstallmentPaid(id: string, paidDate: string) {
        const { error } = await supabase
            .from('financing_installments')
            .update({ status: 'paid', paid_date: paidDate }).eq('id', id);
        if (error) throw error;
    },
    async getMonthlyCommitment(companyId: string) {
        const today = new Date().toISOString().split('T')[0];
        const firstOfMonth = today.substring(0, 7) + '-01';
        const lastOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('financing_installments')
            .select('amount, financings!inner(company_id)')
            .eq('financings.company_id', companyId)
            .gte('due_date', firstOfMonth).lte('due_date', lastOfMonth)
            .in('status', ['pending', 'overdue']);
        if (error) return 0;
        return (data ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0);
    }
};

// ─── Rentabilidade por Caminhão ───────────────────────────────────────────────

export const vehicleProfitabilityService = {
    async get(companyId: string, startDate: string, endDate: string) {
        const [vehiclesRes, tripsRes, fuelRes, maintRes, financingsRes] = await Promise.all([
            supabase.from('vehicles').select('id, plate, model, brand').eq('company_id', companyId).eq('status', 'active'),
            supabase.from('trips').select('vehicle_id, gross_value, status')
                .eq('company_id', companyId)
                .gte('created_at', `${startDate}T00:00:00`)
                .lte('created_at', `${endDate}T23:59:59`)
                .eq('status', 'completed'),
            supabase.from('fuel_records').select('vehicle_id, total_cost, liters, odometer')
                .eq('company_id', companyId)
                .gte('date', startDate).lte('date', endDate),
            supabase.from('maintenance').select('vehicle_id, cost')
                .eq('company_id', companyId)
                .gte('date', startDate).lte('date', endDate),
            supabase.from('financings').select('vehicle_id, installment_value').eq('company_id', companyId).eq('status', 'active')
        ]);

        const vehicles = vehiclesRes.data ?? [];
        const trips = tripsRes.data ?? [];
        const fuels = fuelRes.data ?? [];
        const maints = maintRes.data ?? [];
        const fins = financingsRes.data ?? [];

        return vehicles.map((v: any) => {
            const vTrips = trips.filter((t: any) => t.vehicle_id === v.id);
            const vFuels = fuels.filter((f: any) => f.vehicle_id === v.id);
            const vMaints = maints.filter((m: any) => m.vehicle_id === v.id);
            const vFins = fins.filter((f: any) => f.vehicle_id === v.id);

            const receita = vTrips.reduce((s: number, t: any) => s + Number(t.gross_value || 0), 0);
            const combustivel = vFuels.reduce((s: number, f: any) => s + Number(f.total_cost || 0), 0);
            const manutencao = vMaints.reduce((s: number, m: any) => s + Number(m.cost || 0), 0);
            const financiamento = vFins.reduce((s: number, f: any) => s + Number(f.installment_value || 0), 0);
            const totalCusto = combustivel + manutencao + financiamento;
            const lucro = receita - totalCusto;
            const margem = receita > 0 ? (lucro / receita) * 100 : 0;
            const status = receita === 0 ? 'inativo' : margem >= 15 ? 'lucrativo' : margem >= 0 ? 'atencao' : 'prejuizo';

            return { ...v, receita, combustivel, manutencao, financiamento, totalCusto, lucro, margem, status, viagens: vTrips.length };
        }).sort((a: any, b: any) => b.lucro - a.lucro);
    }
};

// ─── Simulador de Investimentos ───────────────────────────────────────────────

export const simulationService = {
    async getAll(companyId: string) {
        const { data, error } = await supabase
            .from('investment_simulations')
            .select('*')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data ?? [];
    },
    async save(companyId: string, payload: {
        type: string; title: string; params: any; result: any; recommendation: string;
    }) {
        const { data, error } = await supabase
            .from('investment_simulations')
            .insert([{ ...payload, company_id: companyId, saved: true }])
            .select().single();
        if (error) throw error;
        return data;
    },
    async remove(id: string) {
        const { error } = await supabase.from('investment_simulations').delete().eq('id', id);
        if (error) throw error;
    },

    // Cálculos de simulação (sem persistência — só retorno)
    simulateTruck(params: {
        truckPrice: number; downPayment: number; installments: number;
        interestRate: number; expectedRevenuePerMonth: number;
        fuelCostPerMonth: number; maintenanceCostPerMonth: number;
        driverCostPerMonth: number; otherCostsPerMonth: number;
    }) {
        const financed = params.truckPrice - params.downPayment;
        const rate = params.interestRate / 100;
        const installmentValue = rate > 0
            ? (financed * rate * Math.pow(1 + rate, params.installments)) / (Math.pow(1 + rate, params.installments) - 1)
            : financed / params.installments;

        const totalMonthlyCost = params.fuelCostPerMonth + params.maintenanceCostPerMonth
            + params.driverCostPerMonth + params.otherCostsPerMonth + installmentValue;
        const monthlyProfit = params.expectedRevenuePerMonth - totalMonthlyCost;
        const breakEvenMonths = monthlyProfit > 0 ? Math.ceil(params.downPayment / monthlyProfit) : null;
        const annualROI = params.truckPrice > 0 ? ((monthlyProfit * 12) / params.truckPrice) * 100 : 0;
        const margin = params.expectedRevenuePerMonth > 0 ? (monthlyProfit / params.expectedRevenuePerMonth) * 100 : 0;
        const minRevenue = totalMonthlyCost;
        const viable = monthlyProfit > 0 && margin >= 10;

        const recommendation = viable
            ? `✅ VIÁVEL. O caminhão gera lucro estimado de ${fmtCurrency(monthlyProfit)}/mês com margem de ${margin.toFixed(1)}%. ROI anual de ${annualROI.toFixed(1)}%. Ponto de equilíbrio da entrada em ${breakEvenMonths ?? '—'} meses. Receita mínima necessária: ${fmtCurrency(minRevenue)}/mês.`
            : margin >= 0
            ? `⚠️ ATENÇÃO. O caminhão gera lucro baixo (${fmtCurrency(monthlyProfit)}/mês, margem ${margin.toFixed(1)}%). Verifique se a receita esperada é realista ou negocie melhores condições de financiamento.`
            : `❌ INVIÁVEL. Com os números informados, o caminhão geraria prejuízo de ${fmtCurrency(Math.abs(monthlyProfit))}/mês. A receita mínima necessária para viabilidade é ${fmtCurrency(minRevenue)}/mês.`;

        return { installmentValue, totalMonthlyCost, monthlyProfit, breakEvenMonths, annualROI, margin, minRevenue, viable, recommendation };
    },

    simulateDriver(params: {
        monthlySalary: number; commission: number; benefits: number;
        expectedExtraRevenue: number; currentCapacityUsed: number;
    }) {
        const totalCost = params.monthlySalary + params.commission + params.benefits;
        const netGain = params.expectedExtraRevenue - totalCost;
        const viable = netGain > 0;
        const breakEven = params.expectedExtraRevenue > 0
            ? (totalCost / params.expectedExtraRevenue) * 100 : 0;

        const recommendation = viable
            ? `✅ VIÁVEL. Contratar o motorista geraria ganho líquido de ${fmtCurrency(netGain)}/mês. Com a frota em ${params.currentCapacityUsed}% de capacidade, há espaço para crescimento.`
            : `❌ INVIÁVEL. O custo do motorista (${fmtCurrency(totalCost)}/mês) supera a receita adicional esperada (${fmtCurrency(params.expectedExtraRevenue)}/mês). Reavalie a demanda antes de contratar.`;

        return { totalCost, netGain, breakEven, viable, recommendation };
    },

    simulateFreight(params: {
        freightValue: number; distanceKm: number; fuelConsumption: number;
        fuelPrice: number; tollCost: number; driverCommission: number;
        otherCosts: number; taxRate: number;
    }) {
        const fuelCost = (params.distanceKm / params.fuelConsumption) * params.fuelPrice;
        const netFreight = params.freightValue * (1 - params.taxRate / 100);
        const commission = netFreight * (params.driverCommission / 100);
        const totalCost = fuelCost + params.tollCost + commission + params.otherCosts;
        const profit = netFreight - totalCost;
        const margin = netFreight > 0 ? (profit / netFreight) * 100 : 0;
        const revenuePerKm = params.distanceKm > 0 ? params.freightValue / params.distanceKm : 0;
        const costPerKm = params.distanceKm > 0 ? totalCost / params.distanceKm : 0;
        const viable = margin >= 15;

        const recommendation = viable
            ? `✅ VIÁVEL. Margem de ${margin.toFixed(1)}% — acima do mínimo recomendado (15%). Receita/km: ${fmtCurrency(revenuePerKm)}. Custo/km: ${fmtCurrency(costPerKm)}. Lucro por viagem: ${fmtCurrency(profit)}.`
            : margin >= 0
            ? `⚠️ MARGEM BAIXA (${margin.toFixed(1)}%). O frete cobre os custos mas com pouca sobra. Negocie um valor maior ou reduza custos antes de aceitar.`
            : `❌ PREJUÍZO. Com os valores informados, esta rota gera perda de ${fmtCurrency(Math.abs(profit))} por viagem. Não aceitar sem renegociação.`;

        return { fuelCost, netFreight, commission, totalCost, profit, margin, revenuePerKm, costPerKm, viable, recommendation };
    }
};

function fmtCurrency(v: number) {
    return `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

// ─── Central Contábil ─────────────────────────────────────────────────────────

export const accountingDocumentService = {
    async getAll(companyId: string) {
        const { data, error } = await supabase
            .from('accounting_documents')
            .select('*')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data ?? [];
    },
    async add(payload: any) {
        const { data, error } = await supabase
            .from('accounting_documents').insert([payload]).select().single();
        if (error) throw error;
        return data;
    },
    async update(id: string, payload: any) {
        const { data, error } = await supabase
            .from('accounting_documents').update(payload).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },
    async remove(id: string) {
        const { error } = await supabase.from('accounting_documents').delete().eq('id', id);
        if (error) throw error;
    }
};

export const taxObligationService = {
    async getAll(companyId: string) {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('tax_obligations')
            .select('*')
            .eq('company_id', companyId)
            .order('due_date', { ascending: true });
        if (error) throw error;
        return (data ?? []).map((r: any) => ({
            ...r,
            status: r.status === 'pending' && r.due_date < today ? 'overdue' : r.status
        }));
    },
    async add(payload: any) {
        const { data, error } = await supabase
            .from('tax_obligations').insert([payload]).select().single();
        if (error) throw error;
        return data;
    },
    async update(id: string, payload: any) {
        const { data, error } = await supabase
            .from('tax_obligations').update(payload).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },
    async markPaid(id: string) {
        const { error } = await supabase
            .from('tax_obligations')
            .update({ status: 'paid', paid_date: new Date().toISOString().split('T')[0] })
            .eq('id', id);
        if (error) throw error;
    },
    async remove(id: string) {
        const { error } = await supabase.from('tax_obligations').delete().eq('id', id);
        if (error) throw error;
    }
};
