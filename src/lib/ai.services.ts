import { supabase } from './supabase';

export interface AiMessage { role: 'user' | 'assistant'; content: string; created_at?: string; }
export interface AnalysisMetric { label: string; valor: string; status: 'ok' | 'atencao' | 'critico' | 'info'; }
export interface AnalysisSection { titulo: string; linhas: { label: string; valor: string; destaque?: boolean }[]; }
export interface AnalysisData {
    tipo: 'analise';
    resumo: string;
    status: 'ok' | 'atencao' | 'critico';
    metricas: AnalysisMetric[];
    secoes: AnalysisSection[];
    recomendacoes: string[];
}
export interface AiInsight {
    id: string; type: string; title: string; content: string;
    severity: 'info' | 'warning' | 'critical' | 'success'; is_read: boolean; created_at: string;
    source_data?: Record<string, unknown> | AnalysisData;
}
export interface AiMemory {
    id: string; category: string; title: string; description: string;
    importance: number; tags: string[]; created_at: string;
}

export const aiChatService = {
    async ask(companyId: string, question: string, userId: string, sessionId?: string, mode?: 'chat' | 'analysis') {
        const { data, error } = await supabase.functions.invoke('ai-manager', {
            body: { companyId, question, userId, sessionId, mode },
        });
        if (error) throw error;
        return data as { answer: string; sessionId: string };
    },

    async getHistory(companyId: string, sessionId: string): Promise<AiMessage[]> {
        const { data, error } = await supabase
            .from('ai_conversations')
            .select('role, content, created_at')
            .eq('company_id', companyId)
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return (data ?? []) as AiMessage[];
    },

    async getSessions(companyId: string) {
        const { data, error } = await supabase
            .from('ai_conversations')
            .select('session_id, content, created_at')
            .eq('company_id', companyId)
            .eq('role', 'user')
            .order('created_at', { ascending: false })
            .limit(50);
        if (error) throw error;
        // Deduplica por session_id, mantendo a mais recente
        const seen = new Set<string>();
        return (data ?? []).filter(m => {
            if (seen.has(m.session_id)) return false;
            seen.add(m.session_id);
            return true;
        });
    },
};

export const aiInsightService = {
    async getAll(companyId: string): Promise<AiInsight[]> {
        const { data, error } = await supabase
            .from('ai_insights')
            .select('id,type,title,content,severity,is_read,created_at,source_data')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data ?? []) as AiInsight[];
    },

    async markRead(id: string) {
        const { error } = await supabase.from('ai_insights').update({ is_read: true }).eq('id', id);
        if (error) throw error;
    },

    async remove(id: string) {
        const { error } = await supabase.from('ai_insights').delete().eq('id', id);
        if (error) throw error;
    },

    async add(companyId: string, payload: Omit<AiInsight, 'id' | 'is_read' | 'created_at'>) {
        const { data, error } = await supabase
            .from('ai_insights')
            .insert([{ ...payload, company_id: companyId }])
            .select().single();
        if (error) throw error;
        return data as AiInsight;
    },
};

export const aiMemoryService = {
    async getAll(companyId: string): Promise<AiMemory[]> {
        const { data, error } = await supabase
            .from('ai_business_memory')
            .select('*')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data ?? []) as AiMemory[];
    },

    async add(companyId: string, payload: Omit<AiMemory, 'id' | 'created_at'>) {
        const { data, error } = await supabase
            .from('ai_business_memory')
            .insert([{ ...payload, company_id: companyId }])
            .select().single();
        if (error) throw error;
        return data as AiMemory;
    },

    async remove(id: string) {
        const { error } = await supabase.from('ai_business_memory').delete().eq('id', id);
        if (error) throw error;
    },

    async update(id: string, payload: Partial<Omit<AiMemory, 'id' | 'created_at'>>) {
        const { error } = await supabase.from('ai_business_memory').update(payload).eq('id', id);
        if (error) throw error;
    },
};
