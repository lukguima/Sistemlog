export const TRUCK_TYPES = {
    VUC: {
        id: 'VUC',
        name: 'VUC - 2 Eixos (4 Pneus)',
        description: 'Veículo Urbano de Carga - Ideal para centros urbanos.',
        axles: 2,
        tyre_count: 4,
        default_intervals: { oil: 10000, filter: 20000, tyre: 40000 }
    },
    TOCO: {
        id: 'TOCO',
        name: 'Caminhão Leve (Toco) - 2 Eixos (6 Pneus)',
        description: 'Eixo traseiro de rodagem dupla.',
        axles: 2,
        tyre_count: 6,
        default_intervals: { oil: 15000, filter: 30000, tyre: 50000 }
    },
    TRUCK: {
        id: 'TRUCK',
        name: 'Caminhão Pesado (Truck) - 3 Eixos (10 Pneus)',
        description: 'Padrão para transporte de cargas médias/longas.',
        axles: 3,
        tyre_count: 10,
        default_intervals: { oil: 20000, filter: 40000, tyre: 60000 }
    },
    BITRUCK: {
        id: 'BITRUCK',
        name: 'Bitruck - 4 Eixos (12 Pneus)',
        description: 'Dois eixos dianteiros direcionais.',
        axles: 4,
        tyre_count: 12,
        default_intervals: { oil: 20000, filter: 40000, tyre: 60000 }
    },
    CAVALO_2E: {
        id: 'CAVALO_2E',
        name: 'C. Mecânico + Carreta 2 Eixos (10 Pneus)',
        description: 'Cavalo (6 pneus) + Carreta (4 pneus).',
        axles: 4,
        tyre_count: 10,
        default_intervals: { oil: 25000, filter: 50000, tyre: 80000 }
    },
    CAVALO_3E: {
        id: 'CAVALO_3E',
        name: 'C. Mecânico + Carreta 3 Eixos (18 Pneus)',
        description: 'Uma das configurações mais comuns.',
        axles: 5,
        tyre_count: 18,
        default_intervals: { oil: 25000, filter: 50000, tyre: 80000 }
    },
    BITREM: {
        id: 'BITREM',
        name: 'Bitrem (22 a 26 Pneus)',
        description: 'Dois semirreboques acoplados.',
        axles: 7,
        tyre_count: 26,
        default_intervals: { oil: 30000, filter: 60000, tyre: 100000 }
    },
    RODOTREM: {
        id: 'RODOTREM',
        name: 'Rodotrem (34 Pneus ou mais)',
        description: 'Para cargas pesadas como grãos.',
        axles: 9,
        tyre_count: 34,
        default_intervals: { oil: 30000, filter: 60000, tyre: 100000 }
    }
};

export type TruckTypeId = keyof typeof TRUCK_TYPES;

// Comissão padrão de motorista (%) usada como fallback quando a viagem não tem commission_rate definido
export const DEFAULT_COMMISSION_RATE = 12;

// Planos de assinatura disponíveis
export const SUBSCRIPTION_PLANS = {
    basico: {
        id: 'basico',
        name: 'Básico',
        price: 197,
        vehicleLimit: 5,
        description: 'Ideal para transportadoras pequenas',
        features: [
            'Até 5 veículos',
            'Controle de viagens',
            'Frota e motoristas',
            'Acerto financeiro',
            'Abastecimento',
            'Relatórios básicos',
        ],
    },
    pro: {
        id: 'pro',
        name: 'Pro',
        price: 297,
        vehicleLimit: 10,
        description: 'Para frotas em crescimento',
        features: [
            'Até 10 veículos',
            'Tudo do Básico',
            'Controle de pneus',
            'Manutenção avançada',
            'Fornecedores',
            'Relatórios completos',
        ],
    },
    enterprise: {
        id: 'enterprise',
        name: 'Enterprise',
        price: 397,
        vehicleLimit: Infinity,
        description: 'Para grandes operações',
        features: [
            'Veículos ilimitados',
            'Tudo do Pro',
            'Múltiplos usuários',
            'Suporte prioritário',
            'Acesso antecipado a novidades',
        ],
    },
} as const;

export type PlanId = keyof typeof SUBSCRIPTION_PLANS;

// Limiares de profundidade de sulco de pneu (mm)
export const TYRE_DEPTH = {
    SAFE: 3.5,      // Acima disso: OK
    WARNING: 2.0,   // Entre 2.0 e 3.5: atenção / desgaste acelerado
    LEGAL_MIN: 1.6, // Mínimo legal (TWI) — abaixo disso: crítico
};
