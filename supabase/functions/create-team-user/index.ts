// Supabase Edge Function — Criação de Subusuários (equipe / frentista)
// Deploy: supabase functions deploy create-team-user
//
// Cria um usuário de login REAL (auth.users) com email + senha,
// vinculado à empresa do admin que fez a chamada, com role e
// permissões por setor. Só um admin/master da própria empresa pode chamar.

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

const ALLOWED_ROLES = ['admin', 'manager', 'operator', 'frentista'];

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

    // 1. Identificar quem está chamando (a partir do JWT enviado pelo navegador)
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json({ error: 'Não autenticado.' }, 401);

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) return json({ error: 'Sessão inválida.' }, 401);

    // 2. Verificar que o chamador é admin/master
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: callerProfile } = await admin
        .from('profiles')
        .select('role, company_id')
        .eq('id', caller.id)
        .single();

    const callerRole = callerProfile?.role
        ?? (caller.app_metadata as any)?.role;
    const callerCompany = callerProfile?.company_id
        ?? (caller.app_metadata as any)?.company_id;

    if (!['admin', 'master'].includes(callerRole)) {
        return json({ error: 'Apenas administradores podem criar usuários.' }, 403);
    }

    // 3. Validar payload
    let body: any;
    try { body = await req.json(); } catch { return json({ error: 'JSON inválido.' }, 400); }

    const email       = String(body.email ?? '').trim().toLowerCase();
    const password    = String(body.password ?? '');
    const full_name   = String(body.full_name ?? '').trim();
    const role        = String(body.role ?? 'operator');
    const permissions = Array.isArray(body.permissions) ? body.permissions : [];
    // master pode indicar a empresa; admin sempre usa a própria
    const company_id  = callerRole === 'master' ? (body.company_id ?? callerCompany) : callerCompany;

    if (!email || !email.includes('@')) return json({ error: 'E-mail inválido.' }, 400);
    if (password.length < 6)            return json({ error: 'A senha deve ter ao menos 6 caracteres.' }, 400);
    if (!ALLOWED_ROLES.includes(role))  return json({ error: 'Nível de acesso inválido.' }, 400);
    if (!company_id)                    return json({ error: 'Empresa não identificada.' }, 400);

    // 4. Remove profile órfão com o mesmo e-mail (de convites antigos que
    //    criavam só a linha em profiles, sem login de verdade)
    const { data: orphan } = await admin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();
    if (orphan?.id) {
        const { data: existingAuth } = await admin.auth.admin
            .getUserById(orphan.id)
            .catch(() => ({ data: null } as any));
        if (!existingAuth?.user) {
            await admin.from('profiles').delete().eq('id', orphan.id);
        }
    }

    // 5. Criar o usuário de autenticação (login real)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        // company_id/role/permissions só em app_metadata (trigger ignora user_metadata)
        user_metadata: { nome: full_name },
        app_metadata:  { company_id, role, permissions },
    });

    if (createErr || !created?.user) {
        const msg = createErr?.message ?? 'Erro ao criar usuário.';
        if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')) {
            return json({ error: 'Este e-mail já possui acesso ao sistema.' }, 409);
        }
        return json({ error: msg }, 400);
    }

    const newId = created.user.id;

    // 6. Ajustar o profile (o trigger handle_new_user já criou a linha).
    //    Este update dispara sync_user_claims, que grava permissions no JWT.
    const { error: updErr } = await admin
        .from('profiles')
        .update({
            full_name,
            email,
            role,
            company_id,
            permissions,
            active: true,
        })
        .eq('id', newId);

    if (updErr) {
        // rollback: remove o auth user para não deixar login órfão
        await admin.auth.admin.deleteUser(newId).catch(() => {});
        return json({ error: `Usuário criado mas falha ao aplicar permissões: ${updErr.message}` }, 500);
    }

    return json({ ok: true, user_id: newId });
});
