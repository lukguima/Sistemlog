// ============================================================
// Sistema de permissões por setor (Plano 3 — Subusuários)
// Fonte única de verdade para menu, guard de rota e modal de convite.
// ============================================================

export type SectorKey = 'operacional' | 'frota' | 'financeiro' | 'analises' | 'admin_config';

export interface Sector {
    key: SectorKey;
    label: string;
    description: string;
    /** false = setor exclusivo do dono (admin), não pode ser atribuído a funcionário */
    assignable?: boolean;
}

export const SECTORS: Sector[] = [
    { key: 'operacional', label: 'Operacional', description: 'Viagens, Acerto de Fretes e Agregados', assignable: true },
    { key: 'frota', label: 'Frota', description: 'Veículos, Manutenção, Abastecimento, Pneus e Fornecedores', assignable: true },
    { key: 'financeiro', label: 'Financeiro', description: 'Financeiro, Fluxo de Caixa, DRE, Financiamentos, Contabilidade, Rentabilidade e Simulador', assignable: true },
    { key: 'analises', label: 'Análises & IA', description: 'Painel Executivo, Clientes, Gestor IA, Memória IA e Riscos', assignable: true },
    { key: 'admin_config', label: 'Administração', description: 'Configurações da empresa e gestão da equipe', assignable: false },
];

// Setores que podem ser atribuídos a funcionários no modal de convite.
export const ASSIGNABLE_SECTORS = SECTORS.filter(s => s.assignable);

// Mapeia cada rota admin ao setor que a controla.
// Rotas ausentes deste mapa (ex.: dashboard) são visíveis para todos.
export const ROUTE_SECTOR: Record<string, SectorKey> = {
    '/admin/trips': 'operacional',
    '/admin/settlement': 'operacional',
    '/admin/agregados': 'operacional',
    '/admin/fleet': 'frota',
    '/admin/maintenance': 'frota',
    '/admin/fuel': 'frota',
    '/admin/tyre-check': 'frota',
    '/admin/suppliers': 'frota',
    '/admin/financial': 'financeiro',
    '/admin/cash-flow': 'financeiro',
    '/admin/dre': 'financeiro',
    '/admin/vehicle-profitability': 'financeiro',
    '/admin/financings': 'financeiro',
    '/admin/simulator': 'financeiro',
    '/admin/accounting': 'financeiro',
    '/admin/executive': 'analises',
    '/admin/clients-analysis': 'analises',
    '/admin/ai-manager': 'analises',
    '/admin/ai-memory': 'analises',
    '/admin/risks': 'analises',
    '/admin/settings': 'admin_config',
    '/admin/reports': 'analises',
};

// Atalhos prontos para o modal de convite.
export const PERMISSION_PRESETS: { label: string; permissions: SectorKey[] }[] = [
    { label: 'Operacional (Viagens + Frota)', permissions: ['operacional', 'frota'] },
    { label: 'Financeiro', permissions: ['financeiro'] },
    { label: 'Gerente (tudo, exceto Administração)', permissions: ['operacional', 'frota', 'financeiro', 'analises'] },
];

// Roles que ignoram permissions e têm acesso total.
export const FULL_ACCESS_ROLES = ['admin', 'master'];

/**
 * Decide se um usuário pode acessar um setor.
 * @param role role do usuário
 * @param permissions lista de setores permitidos (para roles restritos)
 * @param sector setor a verificar
 */
export function hasSectorAccess(
    role: string | undefined,
    permissions: string[] | undefined,
    sector: SectorKey
): boolean {
    if (role && FULL_ACCESS_ROLES.includes(role)) return true;
    return Array.isArray(permissions) && permissions.includes(sector);
}

/**
 * Verifica acesso a uma rota admin específica.
 * Rotas sem setor mapeado (dashboard) são liberadas para qualquer autenticado.
 */
export function canAccessRoute(
    role: string | undefined,
    permissions: string[] | undefined,
    path: string
): boolean {
    if (role && FULL_ACCESS_ROLES.includes(role)) return true;
    const sector = ROUTE_SECTOR[path];
    if (!sector) return true; // dashboard e afins
    return Array.isArray(permissions) && permissions.includes(sector);
}
