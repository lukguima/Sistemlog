import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildCors, corsPreflight } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const ALLOWED = new Set(['admin', 'master', 'manager', 'operator']);

const SYSTEM = `Você extrai dados de um CT-e / DACTE brasileiro a partir do texto do PDF.
Responda somente JSON com estas chaves:
{
  "isDacte": boolean,
  "cteNumber": string | null,
  "series": string | null,
  "accessKey": string | null,
  "date": "YYYY-MM-DD" | null,
  "origin": "Cidade - UF" | null,
  "destination": "Cidade - UF" | null,
  "cargoDescription": string | null,
  "weightKg": number | null,
  "weightLiters": number | null,
  "freightValue": number | null,
  "tollsValue": number | null,
  "taxRate": number | null,
  "icmsValue": number | null,
  "plates": string[],
  "driverName": string | null,
  "driverCpf": string | null
}
Regras:
- Números em valor JSON (16051.5), nunca com R$ nem ponto de milhar.
- taxRate é a alíquota do ICMS em percentual (ex.: 7), não o valor em reais.
- icmsValue é o ICMS em reais.
- freightValue é o valor total do serviço / frete.
- plates são placas de cavalo e implemento, sem hífen, maiúsculas, na ordem do documento.
- driverCpf só dígitos.
- accessKey tem 44 dígitos ou null.
- Se o texto não for CT-e/DACTE, isDacte=false e o restante null.`;

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
        if (!ALLOWED.has(role) || !companyId) return json({ use_local: true });

        const body = await req.json().catch(() => ({}));
        const text = String((body as { text?: string }).text || '').slice(0, 20000);
        const fileName = String((body as { fileName?: string }).fileName || '');
        if (!text.trim()) return json({ use_local: true });

        const { data: keyRow } = await supabase
            .from('company_openai_keys')
            .select('api_key')
            .eq('company_id', companyId)
            .maybeSingle();
        const apiKey = keyRow?.api_key;
        if (!apiKey) return json({ use_local: true });

        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                temperature: 0,
                max_tokens: 900,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: SYSTEM },
                    { role: 'user', content: `Arquivo: ${fileName}\n\n${text}` },
                ],
            }),
        });
        if (!openaiRes.ok) return json({ use_local: true });

        const openaiData = await openaiRes.json();
        const raw = openaiData.choices?.[0]?.message?.content ?? '';
        let parsed: Record<string, unknown>;
        try { parsed = JSON.parse(raw); }
        catch { return json({ use_local: true }); }

        if (parsed.isDacte !== true) return json({ use_local: true });
        return json({ use_local: false, parsed });
    } catch {
        return json({ use_local: true });
    }
});
