// Supabase Edge Function — Exclusão real de subusuário
// Deploy: supabase functions deploy delete-team-user
//
// Apaga o LOGIN (auth.users) e o perfil do usuário, revogando o
// acesso de verdade. Só um admin/master da MESMA empresa pode
// chamar, e ninguém pode excluir a si mesmo.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY         = Deno.env.get('SUPABASE_ANON_KEY')!;

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

    // 1. Quem chama
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json({ error: 'Não autenticado.' }, 401);
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) return json({ error: 'Sessão inválida.' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: callerProfile } = await admin
        .from('profiles')
        .select('role, company_id')
        .eq('id', caller.id)
        .single();

    const callerRole    = callerProfile?.role ?? (caller.app_metadata as any)?.role;
    const callerCompany = callerProfile?.company_id ?? (caller.app_metadata as any)?.company_id;

    if (!['admin', 'master'].includes(callerRole)) {
        return json({ error: 'Apenas administradores podem excluir usuários.' }, 403);
    }

    // 2. Alvo
    let body: any;
    try { body = await req.json(); } catch { return json({ error: 'JSON inválido.' }, 400); }
    const userId = String(body.user_id ?? '');
    if (!userId) return json({ error: 'user_id é obrigatório.' }, 400);
    if (userId === caller.id) return json({ error: 'Você não pode excluir a si mesmo.' }, 400);

    const { data: target } = await admin
        .from('profiles')
        .select('id, company_id, role, email')
        .eq('id', userId)
        .maybeSingle();

    // master pode excluir de qualquer empresa; admin só da própria
    if (target && callerRole !== 'master' && String(target.company_id) !== String(callerCompany)) {
        return json({ error: 'Usuário não pertence à sua empresa.' }, 403);
    }
    if (target && target.role === 'master') {
        return json({ error: 'Não é possível excluir um usuário master.' }, 403);
    }

    // 3. Exclusão real: login primeiro, depois o perfil
    const { error: authErr } = await admin.auth.admin.deleteUser(userId);
    if (authErr && !authErr.message?.toLowerCase().includes('not found')) {
        return json({ error: `Falha ao revogar o login: ${authErr.message}` }, 500);
    }
    await admin.from('profiles').delete().eq('id', userId);

    return json({ ok: true });
});
