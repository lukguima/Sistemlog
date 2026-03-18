// Supabase Edge Function — Kiwify Webhook Handler
// Deploy: supabase functions deploy kiwify-webhook
//
// Configure no painel Kiwify:
//   Produto → Configurações → Webhooks → URL: https://<project>.supabase.co/functions/v1/kiwify-webhook
//   Token: defina em Supabase Secrets como KIWIFY_WEBHOOK_TOKEN

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_TOKEN    = Deno.env.get('KIWIFY_WEBHOOK_TOKEN') ?? '';

// Mapas de plano Kiwify → plano interno
// Ajuste com os IDs/nomes reais dos seus produtos no Kiwify
const PLAN_MAP: Record<string, string> = {
    'basico':     'basico',
    'básico':     'basico',
    'pro':        'pro',
    'enterprise': 'enterprise',
};

// Mapas de status Kiwify → status interno
const STATUS_MAP: Record<string, string> = {
    order_approved:            'active',
    subscription_active:       'active',
    subscription_overdue:      'overdue',
    subscription_canceled:     'canceled',
    subscription_expired:      'canceled',
    order_refunded:            'canceled',
    order_chargeback:          'canceled',
};

function resolvePlan(productName: string): string {
    const lower = (productName || '').toLowerCase();
    for (const [key, val] of Object.entries(PLAN_MAP)) {
        if (lower.includes(key)) return val;
    }
    return 'pro'; // fallback padrão
}

serve(async (req) => {
    // Apenas POST
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    // Verificar token no header ou query string
    const url = new URL(req.url);
    const tokenHeader = req.headers.get('x-webhook-token') ?? req.headers.get('token') ?? '';
    const tokenQuery  = url.searchParams.get('token') ?? '';
    const token       = tokenHeader || tokenQuery;

    if (WEBHOOK_TOKEN && token !== WEBHOOK_TOKEN) {
        console.error('Webhook token inválido.');
        return new Response('Unauthorized', { status: 401 });
    }

    let payload: any;
    try {
        payload = await req.json();
    } catch {
        return new Response('Invalid JSON', { status: 400 });
    }

    const eventType: string = payload?.type ?? payload?.event ?? '';
    const data              = payload?.data ?? payload;

    console.log(`Kiwify event: ${eventType}`, JSON.stringify(data).slice(0, 300));

    const newStatus = STATUS_MAP[eventType];
    if (!newStatus) {
        // Evento não mapeado — ignorar silenciosamente
        return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

    // Extrair dados do evento
    const customerEmail     = data?.customer?.email ?? data?.Customer?.email ?? '';
    const kiwifySubId       = data?.subscription?.id ?? data?.Subscription?.id ?? '';
    const kiwifyOrderId     = data?.id ?? data?.order_id ?? '';
    const kiwifyCustomerId  = data?.customer?.id ?? data?.Customer?.id ?? '';
    const productName       = data?.product?.name ?? data?.Product?.name ?? '';
    const periodEnd         = data?.subscription?.current_period_end ?? null;
    const priceValue        = data?.product?.price ?? data?.price ?? 0;

    // Calcular plano e MRR
    const plan = resolvePlan(productName);
    const mrr  = Number(priceValue) || 0;

    // Montar update de subscription
    const subscriptionUpdate: Record<string, any> = {
        status:                 newStatus,
        kiwify_order_id:        kiwifyOrderId   || undefined,
        kiwify_subscription_id: kiwifySubId     || undefined,
        kiwify_customer_id:     kiwifyCustomerId|| undefined,
        kiwify_customer_email:  customerEmail   || undefined,
        mrr:                    mrr             || undefined,
        current_period_end:     periodEnd       || undefined,
        updated_at:             new Date().toISOString(),
    };

    // Em aprovação: definir início do período e atualizar plano/limites
    if (newStatus === 'active') {
        const vehicleLimitMap: Record<string, number | null> = {
            basico: 5,
            pro: 10,
            enterprise: null,
        };
        subscriptionUpdate.current_period_start = new Date().toISOString();
        subscriptionUpdate.overdue_since        = null;
        subscriptionUpdate.blocked_at           = null;
        subscriptionUpdate.canceled_at          = null;
        subscriptionUpdate.plan                 = plan;
        subscriptionUpdate.vehicle_limit        = Object.prototype.hasOwnProperty.call(vehicleLimitMap, plan) ? vehicleLimitMap[plan] : 5;
    }

    // Em atraso: marcar data do atraso
    if (newStatus === 'overdue') {
        subscriptionUpdate.overdue_since = new Date().toISOString();
    }

    // Em cancelamento: marcar data
    if (newStatus === 'canceled') {
        subscriptionUpdate.canceled_at = new Date().toISOString();
    }

    // Remover campos undefined
    Object.keys(subscriptionUpdate).forEach(k => subscriptionUpdate[k] === undefined && delete subscriptionUpdate[k]);

    // Tentar encontrar a subscription pelo email do cliente ou pelo kiwify_subscription_id
    let updated = false;

    if (kiwifySubId) {
        const { error } = await supabase
            .from('subscriptions')
            .update(subscriptionUpdate)
            .eq('kiwify_subscription_id', kiwifySubId);
        if (!error) updated = true;
    }

    if (!updated && customerEmail) {
        // Buscar company_id via email do cliente (campo kiwify_customer_email ou profiles.email)
        const { data: sub } = await supabase
            .from('subscriptions')
            .select('id, company_id')
            .eq('kiwify_customer_email', customerEmail)
            .maybeSingle();

        if (sub) {
            const { error } = await supabase
                .from('subscriptions')
                .update(subscriptionUpdate)
                .eq('id', sub.id);
            if (!error) updated = true;
        } else {
            // Buscar company_id pelo email no profiles
            const { data: profile } = await supabase
                .from('profiles')
                .select('company_id')
                .eq('email', customerEmail)
                .maybeSingle();

            if (profile?.company_id) {
                subscriptionUpdate.kiwify_customer_email = customerEmail;
                const { error } = await supabase
                    .from('subscriptions')
                    .update(subscriptionUpdate)
                    .eq('company_id', profile.company_id);
                if (!error) updated = true;
            }
        }
    }

    if (!updated) {
        console.warn(`Nenhuma subscription encontrada para event=${eventType} email=${customerEmail} kiwify_sub=${kiwifySubId}`);
    }

    return new Response(JSON.stringify({ ok: true, updated }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
});
