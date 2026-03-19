/**
 * Armazena rascunhos de formulários em memória de módulo (nível SPA).
 * Persiste durante toda a sessão enquanto o bundle JS estiver carregado
 * (sobrevive à navegação React Router, não sobrevive a F5).
 */
const drafts: Record<string, any> = {};

export function saveDraft(key: string, data: any) {
    drafts[key] = data;
    try { sessionStorage.setItem(`form_draft_${key}`, JSON.stringify(data)); } catch {}
}

export function loadDraft(key: string): any | null {
    if (drafts[key]) return drafts[key];
    try {
        const saved = sessionStorage.getItem(`form_draft_${key}`);
        if (saved) { drafts[key] = JSON.parse(saved); return drafts[key]; }
    } catch {}
    return null;
}

export function clearDraftStore(key: string) {
    delete drafts[key];
    try { sessionStorage.removeItem(`form_draft_${key}`); } catch {}
}
