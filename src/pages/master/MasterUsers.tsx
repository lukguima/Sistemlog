import { useState, useEffect, useCallback } from 'react';
import {
    Users, Loader2, Trash2, AlertTriangle, UserPlus,
    ShieldCheck, X, RefreshCw, Info
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface MasterUser {
    id: string;
    email: string;
    role: string;
    created_at: string;
}

export default function MasterUsers() {
    const [users, setUsers] = useState<MasterUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<MasterUser | null>(null);
    const [inviteModal, setInviteModal] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await supabase
                .from('profiles')
                .select('id, email, role, created_at')
                .eq('role', 'master');
            if (fetchError) throw fetchError;
            setUsers(data ?? []);
        } catch (err: any) {
            setError(err.message ?? 'Erro ao buscar usuários.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const handleDelete = async () => {
        if (!deleteConfirm) return;
        setActionLoading(deleteConfirm.id);
        try {
            const { error: delError } = await supabase
                .from('profiles')
                .delete()
                .eq('id', deleteConfirm.id);
            if (delError) throw delError;
            setDeleteConfirm(null);
            await fetchUsers();
        } catch (err: any) {
            setError(err.message ?? 'Erro ao remover usuário.');
        } finally {
            setActionLoading(null);
        }
    };

    const fmtDate = (d: string) =>
        new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const getInitial = (email: string) =>
        email ? email[0].toUpperCase() : '?';

    return (
        <div className="min-h-screen bg-[#0B0F17] p-6 md:p-8">
            <div className="max-w-5xl mx-auto space-y-6">

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-2xl font-bold text-white tracking-tight">Usuários Master</h1>
                            {!loading && (
                                <span className="bg-indigo-500/20 text-indigo-400 text-xs font-bold px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                                    {users.length} {users.length === 1 ? 'usuário' : 'usuários'}
                                </span>
                            )}
                        </div>
                        <p className="text-slate-400 text-sm">Administradores globais do SaaS (acesso via JWT app_metadata).</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchUsers}
                            disabled={loading}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-slate-700 rounded-xl text-slate-400 hover:text-white hover:border-slate-600 hover:bg-slate-800 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                            Atualizar
                        </button>
                        <button
                            onClick={() => setInviteModal(true)}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors"
                        >
                            <UserPlus size={15} />
                            Como promover Master
                        </button>
                    </div>
                </div>

                <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
                    <AlertTriangle size={18} className="text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-amber-300">
                        <span className="font-bold">Segurança:</span> Master só vale com{' '}
                        <span className="font-mono text-amber-200">app_metadata.role = &quot;master&quot;</span> no Auth.
                        Só o perfil em <span className="font-mono">profiles</span> não abre o painel nem o RLS.
                    </p>
                </div>

                {error && (
                    <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-rose-400 text-sm">
                        <AlertTriangle size={16} className="shrink-0" />
                        {error}
                    </div>
                )}

                <div className="bg-[#161B26] rounded-2xl border border-slate-800 overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                        </div>
                    ) : users.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                            <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mb-4">
                                <Users size={26} className="text-slate-500" />
                            </div>
                            <p className="text-slate-300 font-semibold mb-1">Nenhum usuário master encontrado</p>
                            <p className="text-slate-500 text-sm max-w-sm">
                                Promova pelo Supabase Auth (App Metadata). Veja o botão &quot;Como promover Master&quot;.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                        <th className="px-6 py-4">Usuário</th>
                                        <th className="px-6 py-4">Role</th>
                                        <th className="px-6 py-4">Criado em</th>
                                        <th className="px-6 py-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {users.map(user => (
                                        <tr key={user.id} className="hover:bg-slate-800/20 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-black text-sm shrink-0">
                                                        {getInitial(user.email)}
                                                    </div>
                                                    <span className="text-slate-200 font-medium">{user.email}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center gap-1.5 bg-indigo-500/15 text-indigo-400 text-[11px] font-black px-2.5 py-1 rounded-full border border-indigo-500/25 uppercase tracking-wide">
                                                    <ShieldCheck size={11} />
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-400 text-xs">
                                                {fmtDate(user.created_at)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-end">
                                                    {actionLoading === user.id ? (
                                                        <Loader2 size={16} className="animate-spin text-slate-400" />
                                                    ) : (
                                                        <button
                                                            onClick={() => setDeleteConfirm(user)}
                                                            title="Remover perfil master (também remova app_metadata no Auth)"
                                                            className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {deleteConfirm && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#161B26] border border-slate-700 rounded-3xl p-8 w-full max-w-md shadow-2xl space-y-5">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-full bg-rose-500/15 flex items-center justify-center shrink-0">
                                <Trash2 size={20} className="text-rose-400" />
                            </div>
                            <div>
                                <h3 className="font-black text-white text-base">Remover Usuário Master</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Remove o perfil; limpe também o App Metadata no Auth.</p>
                            </div>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl px-4 py-3">
                            <p className="text-slate-300 text-sm font-medium">{deleteConfirm.email}</p>
                            <p className="text-slate-500 text-xs mt-0.5">ID: {deleteConfirm.id}</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-300 font-bold text-sm hover:bg-slate-800 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={!!actionLoading}
                                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm transition-colors disabled:opacity-50"
                            >
                                Remover
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {inviteModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#161B26] border border-slate-700 rounded-3xl p-8 w-full max-w-lg shadow-2xl space-y-5">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-full bg-indigo-500/15 flex items-center justify-center shrink-0">
                                    <UserPlus size={20} className="text-indigo-400" />
                                </div>
                                <div>
                                    <h3 className="font-black text-white text-base">Promover Master (só Dashboard)</h3>
                                    <p className="text-xs text-slate-400 mt-0.5">Não há promoção pelo browser — evita invasão</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setInviteModal(false)}
                                className="text-slate-500 hover:text-slate-300 transition-colors mt-0.5"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/25 rounded-xl p-4">
                            <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
                            <ol className="list-decimal list-inside space-y-1.5 text-xs text-blue-300/90">
                                <li>Supabase → <span className="font-bold text-blue-200">Authentication → Users</span></li>
                                <li>Convide ou abra o usuário</li>
                                <li>Em <span className="font-bold text-blue-200">App Metadata</span> grave: <span className="font-mono text-blue-100">{'{"role":"master"}'}</span></li>
                                <li>Em <span className="font-bold text-blue-200">Table Editor → profiles</span>, role = master (mesmo id do Auth)</li>
                                <li>Peça para o usuário sair e entrar de novo (JWT novo)</li>
                            </ol>
                        </div>

                        <button
                            onClick={() => setInviteModal(false)}
                            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm transition-colors"
                        >
                            Entendi
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
