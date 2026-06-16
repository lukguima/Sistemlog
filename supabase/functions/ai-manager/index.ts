import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { companyId, question, userId, sessionId } = await req.json();
        if (!companyId || !question) {
            return new Response(JSON.stringify({ error: 'companyId e question são obrigatórios' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const sid = sessionId ?? crypto.randomUUID();
        const today = new Date();
        const fmtDate = (d: Date) => d.toISOString().split('T')[0];

        // Janelas de tempo
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
        const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
        const lastOfMonth = fmtDate(new Date(today.getFullYear(), today.getMonth() + 1, 0));
        const nextNinetyDays = fmtDate(new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000));

        // Buscar todos os dados em paralelo
        const [
            tripsAllRes, tripsMonthRes,
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
                .select('driver_id,amount,type,description,created_at')
                .eq('company_id', companyId)
                .gte('created_at', fmtDate(ninetyDaysAgo))
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
        // Usa últimos 30 dias para evitar mês calendário sem dados
        const monthRevenue = completedTrips30.reduce((s, t) => s + Number(t.gross_value || 0), 0);
        const revenue90 = completedTrips90.reduce((s, t) => s + Number(t.gross_value || 0), 0);
        // monthTrips usado apenas para referência de viagens criadas este mês
        const _monthTripsCount = monthTrips.filter(t => ['completed', 'paid'].includes(t.status)).length;

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
- Viagens concluídas (últimos 30 dias): ${completedTrips30.length}
- Viagens concluídas (últimos 90 dias): ${completedTrips90.length}
- Viagens em andamento agora: ${pendingTrips.length}
- Receita de fretes (últimos 30 dias): R$ ${monthRevenue.toFixed(2)}
- Receita de fretes (últimos 90 dias): R$ ${revenue90.toFixed(2)}
- Ticket médio (30 dias): R$ ${completedTrips30.length > 0 ? (monthRevenue / completedTrips30.length).toFixed(2) : '0.00'}

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

═══ DRE ESTIMADO (últimos 30 dias) ═══
- Receita de fretes: R$ ${monthRevenue.toFixed(2)}
- Outras receitas (lançamentos): R$ ${txReceitas.toFixed(2)}
- RECEITA BRUTA: R$ ${receitaBruta.toFixed(2)}
- (-) Combustível: R$ ${totalFuel30.toFixed(2)}
- (-) Manutenção: R$ ${totalMaint30.toFixed(2)}
- (-) Despesas avulsas (lançamentos): R$ ${txDespesas.toFixed(2)}
- RESULTADO ESTIMADO: R$ ${resultadoEst.toFixed(2)}
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

        // Buscar histórico da sessão (últimas 6 trocas)
        const { data: historyData } = await supabase
            .from('ai_conversations')
            .select('role, content')
            .eq('company_id', companyId)
            .eq('session_id', sid)
            .order('created_at', { ascending: true })
            .limit(12);

        const history = (historyData ?? []).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

        // Chamar OpenAI GPT-4o
        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
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

        if (!openaiRes.ok) {
            const err = await openaiRes.text();
            throw new Error(`OpenAI error: ${err}`);
        }

        const openaiData = await openaiRes.json();
        const answer = openaiData.choices?.[0]?.message?.content ?? 'Não foi possível gerar uma resposta.';

        // Salvar conversa
        if (userId) {
            await supabase.from('ai_conversations').insert([
                { company_id: companyId, user_id: userId, session_id: sid, role: 'user', content: question },
                { company_id: companyId, user_id: userId, session_id: sid, role: 'assistant', content: answer,
                  metadata: { model: 'gpt-4o', tokens: openaiData.usage?.total_tokens ?? 0 } },
            ]);
        }

        // Gerar insight automático se detectar risco
        const riskKeywords = ['risco', 'prejuízo', 'vencid', 'alerta', 'atenção', 'problema', 'deficit', 'negativo', 'crítico', 'urgente'];
        const positiveKeywords = ['lucro', 'crescimento', 'oportunidade', 'positivo', 'saudável', 'excelente'];
        const lowerAnswer = answer.toLowerCase();
        const hasRisk = riskKeywords.some(k => lowerAnswer.includes(k));
        const hasPositive = positiveKeywords.some(k => lowerAnswer.includes(k));

        if ((hasRisk || hasPositive) && userId) {
            const firstLine = answer.split('\n').find(l => l.trim() && !l.startsWith('#')) ?? answer.split(/[.!?]/)[0] ?? 'Análise gerada';
            const cleanTitle = firstLine.replace(/\*\*/g, '').trim();
            await supabase.from('ai_insights').insert([{
                company_id: companyId,
                type: hasRisk ? 'risco' : 'oportunidade',
                title: cleanTitle.substring(0, 120),
                content: answer.substring(0, 3000),
                severity: hasRisk ? 'warning' : 'success',
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
