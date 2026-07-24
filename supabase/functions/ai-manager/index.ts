import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildCors, corsPreflight } from '../_shared/cors.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const AI_ALLOWED_ROLES = new Set(['admin', 'master', 'manager', 'operator']);

serve(async (req) => {
    const corsHeaders = buildCors(req);
    const json = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
            status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    if (req.method === 'OPTIONS') return corsPreflight(req);
    if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

    try {
        // 1) JWT obrigatório — sem confiar só no body
        const authHeader = req.headers.get('Authorization') ?? '';
        if (!authHeader.startsWith('Bearer ')) {
            return json({ error: 'Não autenticado.' }, 401);
        }

        const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: authHeader } },
        });
        const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
        if (callerErr || !caller) return json({ error: 'Sessão inválida.' }, 401);

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        const { data: callerProfile } = await supabase
            .from('profiles')
            .select('role, company_id')
            .eq('id', caller.id)
            .single();

        const callerRole = String(
            callerProfile?.role ?? (caller.app_metadata as Record<string, unknown>)?.role ?? ''
        );
        const callerCompany = String(
            callerProfile?.company_id
                ?? (caller.app_metadata as Record<string, unknown>)?.company_id
                ?? ''
        );

        if (!AI_ALLOWED_ROLES.has(callerRole)) {
            return json({ error: 'Sem permissão para o Gestor IA.' }, 403);
        }

        let body: Record<string, unknown>;
        try {
            body = await req.json();
        } catch {
            return json({ error: 'JSON inválido.' }, 400);
        }

        const question = String(body.question ?? '').trim();
        const sessionId = body.sessionId as string | undefined;
        const mode = body.mode as string | undefined;
        const requestedCompany = String(body.companyId ?? '').trim();

        // companyId do body só vale se for a empresa do usuário (master pode escolher outra)
        const companyId = callerRole === 'master'
            ? (requestedCompany || callerCompany)
            : callerCompany;

        if (!companyId || !question) {
            return json({ error: 'companyId e question são obrigatórios' }, 400);
        }
        if (callerRole !== 'master' && requestedCompany && requestedCompany !== callerCompany) {
            return json({ error: 'Empresa não autorizada.' }, 403);
        }

        // userId sempre do JWT — ignora spoofing no body
        const userId = caller.id;
        const sid = sessionId ?? crypto.randomUUID();
        const today = new Date();
        const fmtDate = (d: Date) => d.toISOString().split('T')[0];

        // Janelas de tempo
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
        const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
        const lastOfMonth = fmtDate(new Date(today.getFullYear(), today.getMonth() + 1, 0));
        const nextNinetyDays = fmtDate(new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000));
        const yearStart = `${today.getFullYear()}-01-01`;

        // Buscar todos os dados em paralelo
        const [
            tripsAllRes, tripsMonthRes, tripsYearRes,
            vehiclesRes, driversRes,
            fuelRes, maintenanceRes,
            txRes, payableRes, receivableRes,
            financingsRes, installmentsRes,
            advancesRes, memoryRes, insightsRes,
        ] = await Promise.all([
            // Viagens últimos 90 dias (para análise de clientes/rentabilidade)
            supabase.from('trips').select('id,origin,destination,gross_value,status,created_at,vehicle_id,driver_id')
                .eq('company_id', companyId)
                .gte('created_at', fmtDate(ninetyDaysAgo))
                .order('created_at', { ascending: false })
                .limit(200),
            // Viagens do mês atual
            supabase.from('trips').select('gross_value,status,created_at')
                .eq('company_id', companyId)
                .gte('created_at', `${firstOfMonth}T00:00:00`)
                .lte('created_at', `${lastOfMonth}T23:59:59`),
            // Viagens do ano inteiro (para média mensal e projeção anual)
            supabase.from('trips').select('gross_value,status,created_at')
                .eq('company_id', companyId)
                .gte('created_at', `${yearStart}T00:00:00`)
                .order('created_at', { ascending: true })
                .limit(1000),
            // Frota completa
            supabase.from('vehicles').select('id,plate,model,brand,year,status').eq('company_id', companyId),
            supabase.from('drivers').select('id,name,status,license_category').eq('company_id', companyId),
            // Abastecimento últimos 90 dias
            supabase.from('fuel_records').select('vehicle_id,liters,total_value,created_at')
                .eq('company_id', companyId)
                .gte('created_at', fmtDate(ninetyDaysAgo))
                .limit(300),
            // Manutenção últimos 90 dias (inclui pneus por categoria)
            supabase.from('maintenance').select('vehicle_id,description,cost,status,created_at')
                .eq('company_id', companyId)
                .gte('created_at', fmtDate(ninetyDaysAgo))
                .limit(200),
            // Lançamentos financeiros mês atual
            supabase.from('financial_transactions')
                .select('description,amount,type,created_at')
                .eq('company_id', companyId)
                .gte('created_at', `${firstOfMonth}T00:00:00`)
                .lte('created_at', `${lastOfMonth}T23:59:59`)
                .limit(100),
            // Contas a pagar em aberto
            supabase.from('accounts_payable').select('description,amount,due_date,status')
                .eq('company_id', companyId)
                .neq('status', 'paid')
                .order('due_date', { ascending: true })
                .limit(50),
            // Contas a receber em aberto
            supabase.from('accounts_receivable').select('description,amount,due_date,status')
                .eq('company_id', companyId)
                .neq('status', 'received')
                .order('due_date', { ascending: true })
                .limit(50),
            // Financiamentos ativos
            supabase.from('financings').select('id,description,total_amount,installment_value,status,start_date')
                .eq('company_id', companyId)
                .eq('status', 'active'),
            // Parcelas dos próximos 90 dias
            supabase.from('financing_installments')
                .select('amount,due_date,status,financing_id')
                .gte('due_date', fmtDate(today))
                .lte('due_date', nextNinetyDays)
                .in('status', ['pending', 'overdue'])
                .limit(50),
            // Acertos/adiantamentos de motoristas (últimos 90 dias)
            supabase.from('driver_advances')
                .select('driver_id,amount,type,description,date,status')
                .eq('company_id', companyId)
                .gte('date', fmtDate(ninetyDaysAgo))
                .limit(100),
            // Memória IA da empresa
            supabase.from('ai_business_memory')
                .select('category,title,description,importance,created_at')
                .eq('company_id', companyId)
                .order('importance', { ascending: false })
                .limit(10),
            // Insights recentes
            supabase.from('ai_insights')
                .select('title,severity,type,created_at')
                .eq('company_id', companyId)
                .order('created_at', { ascending: false })
                .limit(5),
        ]);

        const allTrips     = tripsAllRes.data ?? [];
        const monthTrips   = tripsMonthRes.data ?? [];
        const yearTrips    = tripsYearRes.data ?? [];
        const vehicles     = vehiclesRes.data ?? [];
        const drivers      = driversRes.data ?? [];
        const fuel         = fuelRes.data ?? [];
        const maintenance  = maintenanceRes.data ?? [];
        const transactions = txRes.data ?? [];
        const payables     = payableRes.data ?? [];
        const receivables  = receivableRes.data ?? [];
        const financings   = financingsRes.data ?? [];
        const installments = installmentsRes.data ?? [];
        const advances     = advancesRes.data ?? [];
        const memories     = memoryRes.data ?? [];

        // ── FROTA ──────────────────────────────────────────────────────────────
        const activeVehicles = vehicles.filter(v => v.status === 'active');
        const activeDrivers  = drivers.filter(d => d.status === 'active');

        // ── VIAGENS ────────────────────────────────────────────────────────────
        const completedTrips30 = allTrips.filter(t =>
            ['completed', 'paid'].includes(t.status) &&
            new Date(t.created_at) >= thirtyDaysAgo
        );
        const completedTrips90 = allTrips.filter(t => ['completed', 'paid'].includes(t.status));
        const pendingTrips = allTrips.filter(t => ['pending', 'in_transit'].includes(t.status));
        // Receita realizada (viagens fechadas)
        const monthRevenue = completedTrips30.reduce((s, t) => s + Number(t.gross_value || 0), 0);
        const revenue90 = completedTrips90.reduce((s, t) => s + Number(t.gross_value || 0), 0);
        // Receita pendente (viagens em andamento — não finalizadas no sistema)
        const pendingRevenue = pendingTrips.reduce((s, t) => s + Number(t.gross_value || 0), 0);
        // Receita do mês criadas (inclui pendentes)
        const monthAllRevenue = monthTrips.reduce((s, t) => s + Number(t.gross_value || 0), 0);

        // Top 5 destinos/clientes por receita (90 dias)
        const destMap = new Map<string, { trips: number; revenue: number }>();
        for (const t of allTrips.filter(t => ['completed', 'paid'].includes(t.status))) {
            const key = (t.destination ?? '—').trim().toUpperCase();
            const cur = destMap.get(key) ?? { trips: 0, revenue: 0 };
            cur.trips += 1;
            cur.revenue += Number(t.gross_value || 0);
            destMap.set(key, cur);
        }
        const topClients = [...destMap.entries()]
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .slice(0, 5)
            .map(([dest, s]) => `  ${dest}: ${s.trips} viagens, R$${s.revenue.toFixed(0)}`);

        // ── ABASTECIMENTO ──────────────────────────────────────────────────────
        const totalFuel30 = fuel
            .filter(f => new Date(f.created_at) >= thirtyDaysAgo)
            .reduce((s, f) => s + Number(f.total_value || 0), 0);
        const totalLiters30 = fuel
            .filter(f => new Date(f.created_at) >= thirtyDaysAgo)
            .reduce((s, f) => s + Number(f.liters || 0), 0);

        // ── MANUTENÇÃO ─────────────────────────────────────────────────────────
        const totalMaint30 = maintenance
            .filter(m => new Date(m.created_at) >= thirtyDaysAgo)
            .reduce((s, m) => s + Number(m.cost || 0), 0);
        const tireMaint = maintenance.filter(m =>
            (m.description ?? '').toLowerCase().includes('pneu')
        );
        const totalTires90 = tireMaint.reduce((s, m) => s + Number(m.cost || 0), 0);

        // ── RENTABILIDADE POR VEÍCULO (top 5 + piores 3) ──────────────────────
        const vProfit = activeVehicles.map(v => {
            const vTrips = allTrips.filter(t => t.vehicle_id === v.id && ['completed', 'paid'].includes(t.status));
            const vFuel  = fuel.filter(f => f.vehicle_id === v.id);
            const vMaint = maintenance.filter(m => m.vehicle_id === v.id);
            const rec = vTrips.reduce((s, t) => s + Number(t.gross_value || 0), 0);
            const comb = vFuel.reduce((s, f) => s + Number(f.total_value || 0), 0);
            const man  = vMaint.reduce((s, m) => s + Number(m.cost || 0), 0);
            const fin  = financings.filter(f => (f as any).vehicle_id === v.id)
                .reduce((s, f) => s + Number(f.installment_value || 0), 0);
            const custo = comb + man + fin;
            const lucro = rec - custo;
            const margem = rec > 0 ? (lucro / rec) * 100 : 0;
            return { plate: v.plate, model: v.model, viagens: vTrips.length, rec, custo, lucro, margem };
        }).sort((a, b) => b.rec - a.rec);
        const topVehicles    = vProfit.slice(0, 5).map(v =>
            `  ${v.plate} (${v.model}): ${v.viagens} viagens, receita R$${v.rec.toFixed(0)}, lucro R$${v.lucro.toFixed(0)}, margem ${v.margem.toFixed(1)}%`);
        const bottomVehicles = [...vProfit].sort((a, b) => a.margem - b.margem).slice(0, 3).map(v =>
            `  ${v.plate}: margem ${v.margem.toFixed(1)}%, custo R$${v.custo.toFixed(0)}`);

        // ── DRE ÚLTIMOS 30 DIAS ────────────────────────────────────────────────
        const txReceitas = transactions.filter(t => t.type === 'receita').reduce((s, t) => s + Number(t.amount || 0), 0);
        const txDespesas = transactions.filter(t => t.type === 'despesa').reduce((s, t) => s + Number(t.amount || 0), 0);
        const receitaBruta = monthRevenue + txReceitas;
        const custosOp = totalFuel30 + totalMaint30;
        const resultadoEst = receitaBruta - custosOp - txDespesas;
        const margemEst = receitaBruta > 0 ? (resultadoEst / receitaBruta) * 100 : 0;

        // ── FINANCEIRO ─────────────────────────────────────────────────────────
        const totalPayables   = payables.reduce((s, p) => s + Number(p.amount || 0), 0);
        const totalReceivables = receivables.reduce((s, r) => s + Number(r.amount || 0), 0);
        const overduePayables = payables.filter(p =>
            p.due_date < fmtDate(today) && p.status !== 'paid'
        );
        const overdueReceivables = receivables.filter(r =>
            r.due_date < fmtDate(today)
        );
        const monthlyFinancing = financings.reduce((s, f) => s + Number(f.installment_value || 0), 0);
        const installmentsNext30 = installments
            .filter(i => i.due_date <= fmtDate(new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)))
            .reduce((s, i) => s + Number(i.amount || 0), 0);

        // ── PROJEÇÃO ANUAL ─────────────────────────────────────────────────────
        // Agrupa viagens do ano por mês (usa created_at — independente de status)
        const revenueByMonth: Record<string, number> = {};
        const tripsByMonth: Record<string, number> = {};
        for (const t of yearTrips) {
            const ym = t.created_at.substring(0, 7);
            revenueByMonth[ym] = (revenueByMonth[ym] ?? 0) + Number(t.gross_value || 0);
            tripsByMonth[ym]   = (tripsByMonth[ym]   ?? 0) + 1;
        }
        const currentYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const pastMonths = Object.keys(revenueByMonth).filter(m => m < currentYM).sort();
        const avgMonthlyRevenue = pastMonths.length > 0
            ? pastMonths.reduce((s, m) => s + revenueByMonth[m], 0) / pastMonths.length
            : (monthAllRevenue > 0 ? monthAllRevenue : pendingRevenue / Math.max(1, today.getMonth() + 1));
        const avgMonthlyTrips = pastMonths.length > 0
            ? pastMonths.reduce((s, m) => s + (tripsByMonth[m] ?? 0), 0) / pastMonths.length
            : yearTrips.length / Math.max(1, today.getMonth() + 1);
        const yearRevenueSoFar = Object.values(revenueByMonth).reduce((s, v) => s + v, 0);
        const monthsElapsed  = today.getMonth() + 1;
        const monthsRemaining = 12 - monthsElapsed;
        const projectedAnnualRevenue  = yearRevenueSoFar + (avgMonthlyRevenue * monthsRemaining);
        const projectedAnnualFuel     = totalFuel30 * 12;
        const projectedAnnualMaint    = totalMaint30 * 12;
        const projectedAnnualFinancing = monthlyFinancing * 12;
        const projectedAnnualCosts    = projectedAnnualFuel + projectedAnnualMaint + projectedAnnualFinancing;
        const projectedAnnualNet      = projectedAnnualRevenue - projectedAnnualCosts;
        const projectedMargin = projectedAnnualRevenue > 0
            ? (projectedAnnualNet / projectedAnnualRevenue) * 100 : 0;
        const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        const monthlyBreakdown = pastMonths.length > 0
            ? pastMonths.map(m => {
                const mm = parseInt(m.split('-')[1]) - 1;
                return `  ${MONTHS_PT[mm]}: R$${revenueByMonth[m].toFixed(0)} (${tripsByMonth[m]} viagens)`;
              }).join('\n')
            : '  Sem histórico de meses anteriores neste ano';

        // ── ACERTOS / ADIANTAMENTOS ────────────────────────────────────────────
        const totalAdvances = advances.reduce((s, a) => s + Number(a.amount || 0), 0);
        const advByDriver = new Map<string, number>();
        for (const a of advances) {
            advByDriver.set(a.driver_id, (advByDriver.get(a.driver_id) ?? 0) + Number(a.amount || 0));
        }

        // ── MEMÓRIA ────────────────────────────────────────────────────────────
        const memoryLines = memories.map(m =>
            `  [${m.category.toUpperCase()}] ${m.title}: ${m.description}`
        );

        // ── CONTEXTO COMPLETO ──────────────────────────────────────────────────
        const contextData = `
DADOS COMPLETOS DA EMPRESA (${fmtDate(ninetyDaysAgo)} a ${fmtDate(today)}):

═══ FROTA ═══
- Veículos cadastrados: ${vehicles.length} (ativos: ${activeVehicles.length}, inativos: ${vehicles.length - activeVehicles.length})
- Motoristas cadastrados: ${drivers.length} (ativos: ${activeDrivers.length})

═══ VIAGENS ═══
- Viagens concluídas/pagas (últimos 30 dias): ${completedTrips30.length}
- Viagens concluídas/pagas (últimos 90 dias): ${completedTrips90.length}
- Viagens em andamento (pendentes/em_trânsito): ${pendingTrips.length}
- RECEITA REALIZADA - últimos 30 dias (status: completed/paid): R$ ${monthRevenue.toFixed(2)}
- RECEITA REALIZADA - últimos 90 dias: R$ ${revenue90.toFixed(2)}
- RECEITA PENDENTE (viagens não finalizadas no sistema): R$ ${pendingRevenue.toFixed(2)}
- Faturamento total do período (realizados + pendentes): R$ ${(revenue90 + pendingRevenue).toFixed(2)}
- Ticket médio (viagens concluídas 30d): R$ ${completedTrips30.length > 0 ? (monthRevenue / completedTrips30.length).toFixed(2) : 'N/D - nenhuma viagem concluída no período'}
${pendingRevenue > 0 ? `ATENÇÃO: Há R$ ${pendingRevenue.toFixed(2)} em viagens não finalizadas. Ao concluí-las no sistema, essa receita será realizada.` : ''}

TOP 5 CLIENTES/DESTINOS (90 dias, por receita):
${topClients.length > 0 ? topClients.join('\n') : '  Nenhuma viagem concluída neste período'}

═══ ABASTECIMENTO ═══
- Custo combustível (30 dias): R$ ${totalFuel30.toFixed(2)}
- Litros abastecidos (30 dias): ${totalLiters30.toFixed(0)} L
- Preço médio por litro: R$ ${totalLiters30 > 0 ? (totalFuel30 / totalLiters30).toFixed(3) : '0.000'}

═══ MANUTENÇÃO ═══
- Custo total manutenção (30 dias): R$ ${totalMaint30.toFixed(2)}
- Gastos com pneus (90 dias): R$ ${totalTires90.toFixed(2)} (${tireMaint.length} registros)

═══ RENTABILIDADE POR CAMINHÃO (90 dias) ═══
Top 5 veículos por receita:
${topVehicles.length > 0 ? topVehicles.join('\n') : '  Sem dados'}

Veículos com menor margem (atenção):
${bottomVehicles.length > 0 ? bottomVehicles.join('\n') : '  Todos com margem positiva'}

═══ HISTÓRICO MENSAL DE FATURAMENTO (${today.getFullYear()}) ═══
Faturamento por mês (viagens cadastradas — todos os status):
${monthlyBreakdown}
- Mês atual (${MONTHS_PT[today.getMonth()]}): R$ ${(revenueByMonth[currentYM] ?? 0).toFixed(2)} até hoje
- Média mensal dos meses anteriores: R$ ${avgMonthlyRevenue.toFixed(2)} (${avgMonthlyTrips.toFixed(0)} viagens/mês)
- Meses com dados: ${pastMonths.length} | Meses restantes no ano: ${monthsRemaining}

═══ PROJEÇÃO ANUAL (${today.getFullYear()}) ═══
- Faturamento acumulado no ano: R$ ${yearRevenueSoFar.toFixed(2)}
- PROJEÇÃO RECEITA ANUAL: R$ ${projectedAnnualRevenue.toFixed(2)}
  (baseado na média de R$${avgMonthlyRevenue.toFixed(0)}/mês × ${monthsRemaining} meses restantes)
- PROJEÇÃO CUSTO COMBUSTÍVEL ANUAL: R$ ${projectedAnnualFuel.toFixed(2)}
  (média 30d: R$${totalFuel30.toFixed(0)} × 12 meses)
- PROJEÇÃO CUSTO MANUTENÇÃO ANUAL: R$ ${projectedAnnualMaint.toFixed(2)}
  (média 30d: R$${totalMaint30.toFixed(0)} × 12 meses)
- PROJEÇÃO FINANCIAMENTOS ANUAL: R$ ${projectedAnnualFinancing.toFixed(2)}
  (parcela mensal: R$${monthlyFinancing.toFixed(0)} × 12 meses)
- PROJEÇÃO CUSTOS TOTAIS: R$ ${projectedAnnualCosts.toFixed(2)}
- PROJEÇÃO LUCRO LÍQUIDO ANUAL: R$ ${projectedAnnualNet.toFixed(2)}
- MARGEM PROJETADA: ${projectedMargin.toFixed(1)}%

═══ DRE ESTIMADO (últimos 30 dias) ═══
- Receita de fretes realizados: R$ ${monthRevenue.toFixed(2)}
- Receita pendente (viagens a concluir): R$ ${pendingRevenue.toFixed(2)}
- Outras receitas (lançamentos): R$ ${txReceitas.toFixed(2)}
- RECEITA BRUTA (realizados): R$ ${receitaBruta.toFixed(2)}
- RECEITA POTENCIAL (com pendentes): R$ ${(receitaBruta + pendingRevenue).toFixed(2)}
- (-) Combustível: R$ ${totalFuel30.toFixed(2)}
- (-) Manutenção: R$ ${totalMaint30.toFixed(2)}
- (-) Despesas avulsas: R$ ${txDespesas.toFixed(2)}
- RESULTADO ESTIMADO (realizados): R$ ${resultadoEst.toFixed(2)}
- RESULTADO POTENCIAL (com pendentes): R$ ${(resultadoEst + pendingRevenue).toFixed(2)}
- MARGEM ESTIMADA: ${margemEst.toFixed(1)}%

═══ CONTAS A PAGAR ═══
- Total em aberto: R$ ${totalPayables.toFixed(2)} (${payables.length} títulos)
- Vencidos: ${overduePayables.length} títulos = R$ ${overduePayables.reduce((s, p) => s + Number(p.amount || 0), 0).toFixed(2)}
${payables.slice(0, 5).map(p => `  ${p.description ?? 'sem descrição'}: R$${Number(p.amount).toFixed(0)} vence ${p.due_date}`).join('\n')}

═══ CONTAS A RECEBER ═══
- Total em aberto: R$ ${totalReceivables.toFixed(2)} (${receivables.length} títulos)
- Vencidos: ${overdueReceivables.length} títulos
${receivables.slice(0, 5).map(r => `  ${r.description ?? 'sem descrição'}: R$${Number(r.amount).toFixed(0)} vence ${r.due_date}`).join('\n')}

═══ FINANCIAMENTOS ═══
- Contratos ativos: ${financings.length}
- Parcela mensal total: R$ ${monthlyFinancing.toFixed(2)}
- Parcelas vencendo nos próximos 30 dias: R$ ${installmentsNext30.toFixed(2)}
${financings.map(f => `  ${f.description}: parcela R$${Number(f.installment_value).toFixed(0)}/mês`).join('\n')}

═══ ACERTOS / ADIANTAMENTOS (90 dias) ═══
- Total adiantado a motoristas: R$ ${totalAdvances.toFixed(2)} (${advances.length} lançamentos)

═══ MEMÓRIA DA EMPRESA ═══
${memoryLines.length > 0 ? memoryLines.join('\n') : '  Nenhum registro na memória ainda'}

═══ ALERTAS RECENTES ═══
${(insightsRes.data ?? []).map(i => `  [${i.severity.toUpperCase()}] ${i.title}`).join('\n') || '  Nenhum alerta recente'}
`;

        const systemPrompt = `Você é o Gestor IA da transportadora SistemLog — um consultor estratégico especializado em transportes rodoviários de cargas no Brasil.

Você tem acesso aos dados reais e completos da empresa: frota, motoristas, viagens, abastecimento, manutenção (incluindo pneus), financiamentos, contas a pagar/receber, DRE estimado, rentabilidade por veículo, principais clientes e memória de decisões da empresa.

Suas responsabilidades:
- Analisar dados financeiros, operacionais e de frota com profundidade
- Identificar riscos e oportunidades concretas
- Recomendar ações com base nos dados reais
- Alertar sobre vencimentos, margens negativas, veículos problemáticos
- Ajudar na tomada de decisão sobre investimentos, contratações e negociações
- Interpretar o DRE, fluxo de caixa e rentabilidade
- Comentar sobre pneus, manutenção preventiva e custos de frota

Regras de resposta:
- Responda sempre em português brasileiro
- Use os dados fornecidos como base — não invente números
- SEMPRE use formatação estruturada: ## para seções, **negrito** para valores e destaques, bullet points para listas
- Formate valores em R$ corretamente
- Divida a análise em seções claras (ex: ## Situação Financeira, ## Riscos, ## Recomendações)
- Seja objetivo e direto — máximo 3-4 bullet points por seção
- Quando identificar problemas, sempre sugira ações corretivas específicas
- Se perguntado sobre algo sem dados suficientes, diga o que precisaria verificar

${contextData}`;

        // ── MODO ANÁLISE ESTRUTURADA (JSON) ───────────────────────────────────
        const isAnalysis = mode === 'analysis' ||
            question.startsWith('analise_') ||
            question.toLowerCase().includes('análise financeira') ||
            question.toLowerCase().includes('analise a frota') ||
            question.toLowerCase().includes('avalie') ||
            question.toLowerCase().includes('gerar análise') ||
            question.toLowerCase().includes('gere uma análise');

        if (isAnalysis) {
            const analysisTopics: Record<string, string> = {
                analise_financeira:    'situação financeira geral (DRE, fluxo de caixa, contas a pagar/receber)',
                analise_frota:         'frota e rentabilidade por veículo (custos, margens, combustível, manutenção)',
                analise_recebimentos:  'recebimentos e clientes (receita pendente, principais destinos, inadimplência)',
                analise_financiamentos: 'financiamentos e endividamento (parcelas, comprometimento de caixa)',
            };
            const qLower = question.toLowerCase();
            const topic = analysisTopics[question] ??
                (qLower.includes('financ') ? 'situação financeira, DRE e fluxo de caixa' :
                 qLower.includes('frot') || qLower.includes('veíc') ? 'frota, combustível, manutenção e rentabilidade por caminhão' :
                 qLower.includes('receb') || qLower.includes('client') ? 'recebimentos, clientes e inadimplência' :
                 'situação geral da empresa com todos os módulos');

            const analysisSystemPrompt = `${systemPrompt}

INSTRUÇÃO ESPECIAL — MODO ANÁLISE VISUAL:
Analise os dados acima sobre: ${topic}

Retorne APENAS um JSON válido (sem markdown, sem texto extra) com esta estrutura EXATA:
{
  "tipo": "analise",
  "status": "ok" | "atencao" | "critico",
  "resumo": "1-2 frases descrevendo a situação atual com valores reais",
  "metricas": [
    { "label": "Nome da métrica", "valor": "R$ X.XXX,XX ou número", "status": "ok" | "atencao" | "critico" | "info" }
  ],
  "secoes": [
    {
      "titulo": "NOME DA SEÇÃO",
      "linhas": [
        { "label": "Nome do item", "valor": "R$ X.XXX,XX ou descrição", "destaque": false }
      ]
    }
  ],
  "projecao_anual": {
    "receita": "R$ X.XXX.XXX,XX",
    "custos_combustivel": "R$ XXX.XXX,XX",
    "custos_manutencao": "R$ XXX.XXX,XX",
    "custos_financiamentos": "R$ XXX.XXX,XX",
    "custos_totais": "R$ XXX.XXX,XX",
    "lucro_liquido": "R$ XXX.XXX,XX",
    "margem": "XX,X%",
    "base_calculo": "Média de R$X/mês baseada em N meses de histórico",
    "status": "ok" | "atencao" | "critico"
  },
  "recomendacoes": ["Ação concreta 1", "Ação concreta 2", "Ação concreta 3"]
}

Regras:
- Use EXATAMENTE os números da seção PROJEÇÃO ANUAL fornecida no contexto
- máx 6 métricas, máx 4 seções, máx 5 linhas por seção, máx 4 recomendações
- A projecao_anual deve SEMPRE ser preenchida com os dados de projeção do contexto
- status "critico" = prejuízo ou margem negativa
- status "atencao" = margem baixa (< 15%) ou custos elevados
- status "ok" = margem saudável (> 15%)
- Valores sempre formatados em R$ X.XXX,XX (com pontos de milhar e vírgula decimal)`;

            const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    temperature: 0.3,
                    max_tokens: 2000,
                    response_format: { type: 'json_object' },
                    messages: [{ role: 'system', content: analysisSystemPrompt }],
                }),
            });

            if (!openaiRes.ok) throw new Error(`OpenAI error: ${await openaiRes.text()}`);
            const openaiData = await openaiRes.json();
            const rawJson = openaiData.choices?.[0]?.message?.content ?? '{}';

            let analysisData: Record<string, unknown>;
            try { analysisData = JSON.parse(rawJson); }
            catch { throw new Error('IA retornou JSON inválido'); }

            const resumo = (analysisData.resumo as string) ?? 'Análise gerada';
            const analiseStatus = (analysisData.status as string) ?? 'atencao';
            const severity = analiseStatus === 'critico' ? 'critical' : analiseStatus === 'ok' ? 'success' : 'warning';

            await supabase.from('ai_insights').insert([{
                company_id: companyId,
                type: 'risco',
                title: resumo.substring(0, 120),
                content: resumo,
                severity,
                source_data: { ...analysisData, tipo: 'analise', generated_at: new Date().toISOString() },
            }]);

            return new Response(JSON.stringify({ answer: resumo, sessionId: sid }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // ── MODO CHAT (padrão) ─────────────────────────────────────────────────
        const { data: historyData } = await supabase
            .from('ai_conversations')
            .select('role, content')
            .eq('company_id', companyId)
            .eq('session_id', sid)
            .order('created_at', { ascending: true })
            .limit(12);

        const history = (historyData ?? []).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gpt-4o',
                temperature: 0.7,
                max_tokens: 2500,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...history,
                    { role: 'user', content: question },
                ],
            }),
        });

        if (!openaiRes.ok) throw new Error(`OpenAI error: ${await openaiRes.text()}`);
        const openaiData = await openaiRes.json();
        const answer = openaiData.choices?.[0]?.message?.content ?? 'Não foi possível gerar uma resposta.';

        if (userId) {
            await supabase.from('ai_conversations').insert([
                { company_id: companyId, user_id: userId, session_id: sid, role: 'user', content: question },
                { company_id: companyId, user_id: userId, session_id: sid, role: 'assistant', content: answer,
                  metadata: { model: 'gpt-4o', tokens: openaiData.usage?.total_tokens ?? 0 } },
            ]);
        }

        // Insight automático em conversas que detectam risco
        const riskKeywords = ['risco', 'prejuízo', 'vencid', 'alerta', 'atenção', 'problema', 'negativo', 'crítico'];
        const hasRisk = riskKeywords.some(k => answer.toLowerCase().includes(k));
        if (hasRisk && userId) {
            const title = answer.split('\n').find(l => l.trim())?.replace(/\*\*/g, '').trim() ?? 'Alerta detectado';
            await supabase.from('ai_insights').insert([{
                company_id: companyId,
                type: 'risco',
                title: title.substring(0, 120),
                content: answer.substring(0, 3000),
                severity: 'warning',
                source_data: { question, generated_at: new Date().toISOString() },
            }]);
        }

        return new Response(JSON.stringify({ answer, sessionId: sid }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: String(error) }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
