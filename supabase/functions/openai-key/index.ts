import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildCors, corsPreflight } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const ALLOWED = new Set(['admin', 'master']);

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
        const authHeader = req.headers.get('Authorization') ?? '';
        if (!authHeader.startsWith('Bearer ')) return json({ error: 'Não autenticado.' }, 401);

        const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: authHeader } },
        });
        const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
        if (callerErr || !caller) return json({ error: 'Sessão inválida.' }, 401);

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data: profile } = await supabase
            .from('profiles')
            .select('role, company_id')
            .eq('id', caller.id)
            .maybeSingle();

        const role = String(profile?.role ?? (caller.app_metadata as Record<string, unknown>)?.role ?? '');
        const companyId = String(
            profile?.company_id ?? (caller.app_metadata as Record<string, unknown>)?.company_id ?? ''
        );
        if (!ALLOWED.has(role)) return json({ error: 'Só o administrador pode gerenciar a chave.' }, 403);
        if (!companyId) return json({ error: 'Empresa não identificada.' }, 400);

        const body = await req.json().catch(() => ({}));
        const action = String((body as { action?: string }).action || 'status');

        if (action === 'status') {
            const { data } = await supabase
                .from('company_openai_keys')
                .select('key_hint')
                .eq('company_id', companyId)
                .maybeSingle();
            return json({ configured: !!data, hint: data?.key_hint ?? null });
        }

        if (action === 'delete') {
            const { error } = await supabase.from('company_openai_keys').delete().eq('company_id', companyId);
            if (error) return json({ error: 'Não foi possível remover a chave.' }, 500);
            return json({ configured: false, hint: null });
        }

        if (action === 'save') {
            const apiKey = String((body as { apiKey?: string }).apiKey || '').trim();
            if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
                return json({ error: 'Cole uma chave da OpenAI que comece com sk-.' }, 400);
            }
            const test = await fetch('https://api.openai.com/v1/models', {
                headers: { Authorization: `Bearer ${apiKey}` },
            });
            if (!test.ok) {
                return json({ error: 'A OpenAI não aceitou essa chave. Confira se ela está ativa.' }, 400);
            }
            const hint = `sk-...${apiKey.slice(-4)}`;
            const { error } = await supabase.from('company_openai_keys').upsert({
                company_id: companyId,
                api_key: apiKey,
                key_hint: hint,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'company_id' });
            if (error) return json({ error: 'Não foi possível gravar a chave. Rode o SQL FIX_OPENAI_KEY no Supabase.' }, 500);
            return json({ configured: true, hint });
        }

        return json({ error: 'Ação inválida.' }, 400);
    } catch {
        return json({ error: 'Falha ao gerenciar a chave.' }, 500);
    }
});
