import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import { AUTH_MODE, usesCookieAuth } from './authMode';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias no arquivo .env');
}

/** Storage só em memória — refresh durável fica no cookie HttpOnly (modos dual/cookie). */
const memoryStore = new Map<string, string>();
const memoryStorage: SupportedStorage = {
    getItem: (key) => memoryStore.get(key) ?? null,
    setItem: (key, value) => { memoryStore.set(key, value); },
    removeItem: (key) => { memoryStore.delete(key); },
};

/**
 * cookie/dual: memória + refresh via BFF/cookie HttpOnly.
 * legacy: localStorage (rollback).
 */
export const supabase = createClient(
    supabaseUrl,
    supabaseAnonKey,
    usesCookieAuth
        ? {
            auth: {
                storage: memoryStorage,
                persistSession: true,
                autoRefreshToken: false,
                detectSessionInUrl: false,
            },
        }
        : undefined
);

export const authMode = AUTH_MODE;
