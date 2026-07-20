// ============================================================
// Sistema de permissões (Plano 3 — Subusuários)
// Fonte única de verdade para menu, guard de rota e modal de convite.
//
// Granularidade: POR ABA (página). A lista `permissions` guarda
// chaves de página (ex.: 'trips', 'dre'). Chaves de SETOR antigas
// (ex.: 'financeiro') continuam valendo como "pacote" do bloco
// inteiro — compatibilidade com usuários já cadastrados.
// ============================================================

export type SectorKey = 'dashboard' | 'operacional' | 'frota' | 'financeiro' | 'analises' | 'admin_config';

export interface Sector {
    key: SectorKey;
    label: string;
    description: string;
    /** false = setor exclusivo do dono (admin), não pode ser atribuído a funcionário */
    assignable?: boolean;
}

export const SECTORS: Sector[] = [
    { key: 'dashboard', label: 'Dashboard', description: 'Painel principal com indicadores', assignable: true },
    { key: 'operacional', label: 'Operacional', description: 'Viagens, Acerto de Fretes e Agregados', assignable: true },
    { key: 'frota', label: 'Frota', description: 'Veículos, Documentos, Manutenção, Abastecimento, Pneus e Fornecedores', assignable: true },
    { key: 'financeiro', label: 'Financeiro', description: 'Financeiro, Fluxo de Caixa, DRE, Financiamentos, Contabilidade, Rentabilidade e Simulador', assignable: true },
    { key: 'analises', label: 'Análises & IA', description: 'Painel Executivo, Clientes, Gestor IA, Memória IA e Riscos', assignable: true },
    { key: 'admin_config', label: 'Administração', description: 'Configurações da empresa e gestão da equipe', assignable: false },
];

export const SECTOR_KEYS: SectorKey[] = SECTORS.map(s => s.key);

// ── Páginas individuais (uma por aba do menu) ────────────────
export interface PageDef {
    key: string;      // valor gravado em permissions
    label: string;    // nome exibido (igual ao menu)
    route: string;
    sector: SectorKey;
}

export const PAGES: PageDef[] = [
    // Dashboard
    { key: 'dashboard',             label: 'Dashboard',        route: '/admin/dashboard',             sector: 'dashboard' },
    // Operacional
    { key: 'trips',                 label: 'Viagens',          route: '/admin/trips',                 sector: 'operacional' },
    { key: 'settlement',            label: 'Acerto',           route: '/admin/settlement',            sector: 'operacional' },
    { key: 'agregados',             label: 'Agregados',        route: '/admin/agregados',             sector: 'operacional' },
    // Frota
    { key: 'fleet',                 label: 'Frota',            route: '/admin/fleet',                 sector: 'frota' },
    { key: 'documents',             label: 'Documentos',       route: '/admin/documents',             sector: 'frota' },
    { key: 'maintenance',           label: 'Manutenção',       route: '/admin/maintenance',           sector: 'frota' },
    { key: 'fuel',                  label: 'Abastecimento',    route: '/admin/fuel',                  sector: 'frota' },
    { key: 'tyre-check',            label: 'Pneus',            route: '/admin/tyre-check',            sector: 'frota' },
    { key: 'suppliers',             label: 'Fornecedores',     route: '/admin/suppliers',             sector: 'frota' },
    // Financeiro
    { key: 'financial',             label: 'Financeiro',       route: '/admin/financial',             sector: 'financeiro' },
    { key: 'cash-flow',             label: 'Fluxo de Caixa',   route: '/admin/cash-flow',             sector: 'financeiro' },
    { key: 'dre',                   label: 'DRE',              route: '/admin/dre',                   sector: 'financeiro' },
    { key: 'vehicle-profitability', label: 'Rentabilidade',    route: '/admin/vehicle-profitability', sector: 'financeiro' },
    { key: 'financings',            label: 'Financiamentos',   route: '/admin/financings',            sector: 'financeiro' },
    { key: 'simulator',             label: 'Simulador',        route: '/admin/simulator',             sector: 'financeiro' },
    { key: 'accounting',            label: 'Contabilidade',    route: '/admin/accounting',            sector: 'financeiro' },
    // Análises & IA
    { key: 'executive',             label: 'Painel Executivo', route: '/admin/executive',             sector: 'analises' },
    { key: 'clients-analysis',      label: 'Clientes',         route: '/admin/clients-analysis',      sector: 'analises' },
    { key: 'ai-manager',            label: 'Gestor IA',        route: '/admin/ai-manager',            sector: 'analises' },
    { key: 'ai-memory',             label: 'Memória IA',       route: '/admin/ai-memory',             sector: 'analises' },
    { key: 'risks',                 label: 'Riscos',           route: '/admin/risks',                 sector: 'analises' },
    { key: 'reports',               label: 'Relatórios',       route: '/admin/reports',               sector: 'analises' },
];

const PAGE_BY_ROUTE: Record<string, PageDef> = Object.fromEntries(PAGES.map(p => [p.route, p]));

/** Páginas de um setor (chaves) */
export const pagesOfSector = (sector: SectorKey): string[] =>
    PAGES.filter(p => p.sector === sector).map(p => p.key);

// Rotas exclusivas do dono (não atribuíveis)
export const ROUTE_SECTOR: Record<string, SectorKey> = {
    '/admin/settings': 'admin_config',
};

// Atalhos prontos para o modal de convite (marcam as abas correspondentes).
export const PERMISSION_PRESETS: { label: string; permissions: string[] }[] = [
    { label: 'Operacional (Viagens + Frota)', permissions: ['dashboard', ...pagesOfSector('operacional'), ...pagesOfSector('frota')] },
    { label: 'Financeiro', permissions: ['dashboard', ...pagesOfSector('financeiro')] },
    { label: 'Gerente (tudo, exceto Administração)', permissions: PAGES.map(p => p.key) },
];

// Roles que ignoram permissions e têm acesso total.
export const FULL_ACCESS_ROLES = ['admin', 'master'];

/**
 * Expande permissões: chaves de setor (legado) viram as páginas do bloco.
 * Usado pelo modal de edição para exibir os checkboxes corretos.
 */
export function expandPermissions(permissions: string[] | undefined): string[] {
    if (!Array.isArray(permissions)) return [];
    const out = new Set<string>();
    for (const p of permissions) {
        if ((SECTOR_KEYS as string[]).includes(p)) {
            pagesOfSector(p as SectorKey).forEach(k => out.add(k));
        } else {
            out.add(p);
        }
    }
    return Array.from(out);
}

/**
 * Acesso a um SETOR (usado pelo dashboard adaptativo e afins).
 * Verdadeiro se tem o setor inteiro (legado) ou QUALQUER aba dele.
 */
export function hasSectorAccess(
    role: string | undefined,
    permissions: string[] | undefined,
    sector: SectorKey
): boolean {
    if (role && FULL_ACCESS_ROLES.includes(role)) return true;
    if (!Array.isArray(permissions)) return false;
    if (permissions.includes(sector)) return true;
    return PAGES.some(p => p.sector === sector && permissions.includes(p.key));
}

/**
 * Acesso a uma ROTA admin (menu + guard).
 * Rotas sem mapeamento em PAGES/ROUTE_SECTOR são liberadas.
 */
export function canAccessRoute(
    role: string | undefined,
    permissions: string[] | undefined,
    path: string
): boolean {
    if (role && FULL_ACCESS_ROLES.includes(role)) return true;
    const page = PAGE_BY_ROUTE[path];
    if (page) {
        return Array.isArray(permissions)
            && (permissions.includes(page.key) || permissions.includes(page.sector));
    }
    const sector = ROUTE_SECTOR[path];
    if (!sector) return true;
    return Array.isArray(permissions) && permissions.includes(sector);
}
