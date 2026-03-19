import { useState, useEffect, useCallback } from 'react';

/**
 * Hook que persiste dados de formulário no sessionStorage.
 * Dados sobrevivem à navegação e só são limpos após salvar com sucesso.
 * Para formulários de EDIÇÃO (isEditing=true), não persiste — carrega do dado original.
 */
export function usePersistedForm<T extends object>(
    key: string,
    initialState: T,
    isEditing: boolean = false
) {
    const storageKey = `form_draft_${key}`;

    const getInitialState = (): T => {
        if (isEditing) return initialState;
        try {
            const saved = sessionStorage.getItem(storageKey);
            if (saved) return { ...initialState, ...JSON.parse(saved) };
        } catch {}
        return initialState;
    };

    const [formData, setFormDataRaw] = useState<T>(getInitialState);

    // Quando initialState muda (ex: abriu modal de edição), reseta o form
    useEffect(() => {
        if (isEditing) {
            setFormDataRaw(initialState);
        } else {
            setFormDataRaw(getInitialState());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditing, key]);

    // Persiste no sessionStorage sempre que formData muda (só para novos cadastros)
    useEffect(() => {
        if (!isEditing) {
            try {
                sessionStorage.setItem(storageKey, JSON.stringify(formData));
            } catch {}
        }
    }, [formData, isEditing, storageKey]);

    const setFormData = useCallback((updater: Partial<T> | ((prev: T) => T)) => {
        setFormDataRaw(prev => {
            if (typeof updater === 'function') return updater(prev);
            return { ...prev, ...updater };
        });
    }, []);

    const clearDraft = useCallback(() => {
        try { sessionStorage.removeItem(storageKey); } catch {}
        setFormDataRaw(initialState);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storageKey]);

    return { formData, setFormData, clearDraft };
}
