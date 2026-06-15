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
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        const fmt = (d: Date) => d.toISOString().split('T')[0];

        // Buscar dados da empresa em paralelo
        const [
            tripsRes, vehiclesRes, driversRes, fuelRes, maintenanceRes,
            txRes, payableRes, receivableRes, financingsRes, insightsRes
        ] = await Promise.all([
            supabase.from('trips').select('id,origin,destination,gross_value,status,created_at,vehicle_id,driver_id')
                .eq('company_id', companyId).gte('created_at', fmt(thirtyDaysAgo)).limit(100),
            supabase.from('vehicles').select('id,plate,model,brand,status').eq('company_id', companyId),
            supabase.from('drivers').select('id,name,status').eq('company_id', companyId),
            supabase.from('fuel_records').select('id,liters,total_value,created_at,vehicle_id')
                .eq('company_id', companyId).gte('created_at', fmt(thirtyDaysAgo)).limit(50),
            supabase.from('maintenance').select('id,description,cost,status,vehicle_id,created_at')
                .eq('company_id', companyId).gte('created_at', fmt(thirtyDaysAgo)).limit(50),
            supabase.from('financial_transactions').select('id,description,amount,type,category_id,paid_at,created_at')
                .eq('company_id', companyId).gte('created_at', fmt(thirtyDaysAgo)).limit(50),
            supabase.from('accounts_payable').select('id,description,amount,due_date,paid')
                .eq('company_id', companyId).eq('paid', false).limit(30),
            supabase.from('accounts_receivable').select('id,description,amount,due_date,received')
                .eq('company_id', companyId).eq('received', false).limit(30),
            supabase.from('financings').select('id,description,total_amount,installment_value,status')
                .eq('company_id', companyId).eq('status', 'active'),
            supabase.from('ai_insights').select('title,content,severity,type,created_at')
                .eq('company_id', companyId).order('created_at', { ascending: false }).limit(10),
        ]);

        const trips = tripsRes.data ?? [];
        const vehicles = vehiclesRes.data ?? [];
        const drivers = driversRes.data ?? [];
        const fuel = fuelRes.data ?? [];
        const maintenance = maintenanceRes.data ?? [];
        const transactions = txRes.data ?? [];
        const payables = payableRes.data ?? [];
        const receivables = receivableRes.data ?? [];
        const financings = financingsRes.data ?? [];
        const recentInsights = insightsRes.data ?? [];

        // Calcular métricas resumidas
        const totalRevenue = trips.filter(t => ['completed', 'paid'].includes(t.status)).reduce((s, t) => s + (t.gross_value || 0), 0);
        const totalFuelCost = fuel.reduce((s, f) => s + (f.total_value || 0), 0);
        const totalMaintenanceCost = maintenance.reduce((s, m) => s + (m.cost || 0), 0);
        const totalPayables = payables.reduce((s, p) => s + (p.amount || 0), 0);
        const totalReceivables = receivables.reduce((s, r) => s + (r.amount || 0), 0);
        const monthlyFinancingCommitment = financings.reduce((s, f) => s + (f.installment_value || 0), 0);
        const txRevenue = transactions.filter(t => t.type === 'receita').reduce((s, t) => s + (t.amount || 0), 0);
        const txExpense = transactions.filter(t => t.type === 'despesa').reduce((s, t) => s + (t.amount || 0), 0);

        const overduePayables = payables.filter(p => new Date(p.due_date) < today).length;
        const completedTrips = trips.filter(t => ['completed', 'paid'].includes(t.status)).length;
        const pendingTrips = trips.filter(t => ['pending', 'in_transit'].includes(t.status)).length;

        const contextData = `
DADOS DA EMPRESA (últimos 30 dias - ${fmt(thirtyDaysAgo)} até ${fmt(today)}):

FROTA:
- Total de veículos: ${vehicles.length} (ativos: ${vehicles.filter(v => v.status === 'active').length})
- Total de motoristas: ${drivers.length} (ativos: ${drivers.filter(d => d.status === 'active').length})

VIAGENS:
- Viagens concluídas: ${completedTrips}
- Viagens em andamento: ${pendingTrips}
- Receita total de fretes: R$ ${totalRevenue.toFixed(2)}
- Ticket médio por viagem: R$ ${completedTrips > 0 ? (totalRevenue / completedTrips).toFixed(2) : '0.00'}

CUSTOS OPERACIONAIS:
- Combustível: R$ ${totalFuelCost.toFixed(2)}
- Manutenção: R$ ${totalMaintenanceCost.toFixed(2)}
- Lançamentos financeiros (receitas): R$ ${txRevenue.toFixed(2)}
- Lançamentos financeiros (despesas): R$ ${txExpense.toFixed(2)}

FINANCEIRO:
- Contas a pagar (em aberto): R$ ${totalPayables.toFixed(2)} (${payables.length} títulos, ${overduePayables} vencidos)
- Contas a receber (em aberto): R$ ${totalReceivables.toFixed(2)} (${receivables.length} títulos)
- Compromisso mensal com financiamentos: R$ ${monthlyFinancingCommitment.toFixed(2)} (${financings.length} contratos ativos)

MARGEM ESTIMADA (período):
- Receita bruta estimada: R$ ${(totalRevenue + txRevenue).toFixed(2)}
- Custos estimados: R$ ${(totalFuelCost + totalMaintenanceCost + txExpense).toFixed(2)}
- Resultado estimado: R$ ${(totalRevenue + txRevenue - totalFuelCost - totalMaintenanceCost - txExpense).toFixed(2)}

INSIGHTS RECENTES DA IA:
${recentInsights.length > 0 ? recentInsights.map(i => `- [${i.severity.toUpperCase()}] ${i.title}: ${i.content}`).join('\n') : '- Nenhum insight gerado ainda'}
`;

        const systemPrompt = `Você é o Gestor IA da transportadora, um consultor de negócios especializado no setor de transportes rodoviários de cargas no Brasil. Você analisa os dados reais da empresa e oferece insights práticos, recomendações estratégicas e alertas.

Suas responsabilidades:
- Analisar dados financeiros, operacionais e de frota
- Identificar riscos e oportunidades de negócio
- Recomendar ações concretas com base nos dados
- Alertar sobre vencimentos, margens negativas, veículos problemáticos
- Ajudar na tomada de decisão de investimentos e contratações
- Responder perguntas com base nos dados reais da empresa

Regras importantes:
- Responda sempre em português brasileiro
- Baseie suas respostas nos dados fornecidos
- Seja objetivo e direto, com respostas bem estruturadas
- Use valores em Reais (R$) formatados corretamente
- Quando identificar problemas, sempre sugira ações corretivas
- Se os dados não forem suficientes para responder, diga o que precisaria verificar

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
                max_tokens: 1500,
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

        // Verificar se deve gerar um insight automático (palavras-chave de risco/alerta)
        const riskKeywords = ['risco', 'prejuízo', 'vencid', 'alerta', 'atenção', 'problema', 'deficit', 'negativo'];
        const lowerAnswer = answer.toLowerCase();
        const hasRisk = riskKeywords.some(k => lowerAnswer.includes(k));

        if (hasRisk && userId) {
            const firstSentence = answer.split(/[.!?]/)[0]?.trim() ?? 'Análise identificou ponto de atenção';
            await supabase.from('ai_insights').insert([{
                company_id: companyId,
                type: 'risco',
                title: firstSentence.substring(0, 100),
                content: answer.substring(0, 500),
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
