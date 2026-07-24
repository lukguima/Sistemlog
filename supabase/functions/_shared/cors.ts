/**
 * CORS com allowlist (ALLOWED_ORIGINS ou APP_ORIGIN, separados por vírgula).
 * Sem lista / com "*": reflete o Origin do pedido (nunca envia "*" se houver Origin).
 */
export function buildCors(req: Request): Record<string, string> {
    const raw = Deno.env.get('ALLOWED_ORIGINS') || Deno.env.get('APP_ORIGIN') || '';
    const allowed = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const origin = req.headers.get('Origin') || '';

    let allow: string;
    if (allowed.length === 0 || allowed.includes('*')) {
        allow = origin || '*';
    } else if (origin && allowed.includes(origin)) {
        allow = origin;
    } else {
        // Origem não listada: não libera o Origin do atacante
        allow = allowed[0];
    }

    return {
        'Access-Control-Allow-Origin': allow,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Vary': 'Origin',
    };
}

export function corsJson(req: Request, body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...buildCors(req), 'Content-Type': 'application/json' },
    });
}

export function corsPreflight(req: Request): Response {
    return new Response('ok', { headers: buildCors(req) });
}
