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
