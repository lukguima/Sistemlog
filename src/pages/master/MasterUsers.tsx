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
    const [newEmail, setNewEmail] = useState('');
    const [insertLoading, setInsertLoading] = useState(false);
    const [insertError, setInsertError] = useState<string | null>(null);
    const [insertSuccess, setInsertSuccess] = useState(false);
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

    const handleInsertProfile = async () => {
        if (!newEmail.trim()) return;
        setInsertLoading(true);
        setInsertError(null);
        setInsertSuccess(false);
        try {
            const { error: insError } = await supabase
                .from('profiles')
                .insert({ email: newEmail.trim(), role: 'master' });
            if (insError) throw insError;
            setInsertSuccess(true);
            setNewEmail('');
            await fetchUsers();
        } catch (err: any) {
            setInsertError(err.message ?? 'Erro ao inserir perfil.');
        } finally {
            setInsertLoading(false);
        }
    };

    const closeInviteModal = () => {
        setInviteModal(false);
        setNewEmail('');
        setInsertError(null);
        setInsertSuccess(false);
    };

    const fmtDate = (d: string) =>
        new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const getInitial = (email: string) =>
        email ? email[0].toUpperCase() : '?';

    return (
        <div className="min-h-screen bg-[#0B0F17] p-6 md:p-8">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* Header */}
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
                        <p className="text-slate-400 text-sm">Gerencie os administradores globais do sistema.</p>
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
                            Convidar Usuário Master
                        </button>
                    </div>
                </div>

                {/* Warning card */}
                <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
                    <AlertTriangle size={18} className="text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-amber-300">
                        <span className="font-bold">Atenção:</span> Usuários Master têm acesso total ao sistema. Adicione apenas pessoas de confiança.
                    </p>
                </div>

                {/* Error */}
                {error && (
                    <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-rose-400 text-sm">
                        <AlertTriangle size={16} className="shrink-0" />
                        {error}
                    </div>
                )}

                {/* Table card */}
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
                            <p className="text-slate-500 text-sm max-w-xs">
                                Ainda não há perfis com role=master. Use o botão "Convidar Usuário Master" para adicionar.
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
                                                            title="Remover usuário master"
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

            {/* Modal: Confirmar exclusão */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#161B26] border border-slate-700 rounded-3xl p-8 w-full max-w-md shadow-2xl space-y-5">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-full bg-rose-500/15 flex items-center justify-center shrink-0">
                                <Trash2 size={20} className="text-rose-400" />
                            </div>
                            <div>
                                <h3 className="font-black text-white text-base">Remover Usuário Master</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Esta ação remove o perfil do banco de dados.</p>
                            </div>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl px-4 py-3">
                            <p className="text-slate-300 text-sm font-medium">{deleteConfirm.email}</p>
                            <p className="text-slate-500 text-xs mt-0.5">ID: {deleteConfirm.id}</p>
                        </div>
                        <p className="text-slate-400 text-sm">
                            Tem certeza que deseja remover este usuário master? O registro de perfil será excluído.
                        </p>
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

            {/* Modal: Convidar usuário master */}
            {inviteModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#161B26] border border-slate-700 rounded-3xl p-8 w-full max-w-lg shadow-2xl space-y-5">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-full bg-indigo-500/15 flex items-center justify-center shrink-0">
                                    <UserPlus size={20} className="text-indigo-400" />
                                </div>
                                <div>
                                    <h3 className="font-black text-white text-base">Convidar Usuário Master</h3>
                                    <p className="text-xs text-slate-400 mt-0.5">Adicionar administrador global ao sistema</p>
                                </div>
                            </div>
                            <button
                                onClick={closeInviteModal}
                                className="text-slate-500 hover:text-slate-300 transition-colors mt-0.5"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Info box */}
                        <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/25 rounded-xl p-4">
                            <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
                            <div className="text-xs text-blue-300 space-y-1.5">
                                <p className="font-bold text-blue-200">Como adicionar um usuário master:</p>
                                <ol className="list-decimal list-inside space-y-1 text-blue-300/90">
                                    <li>Acesse o painel <span className="font-bold text-blue-200">Supabase → Authentication → Users</span></li>
                                    <li>Clique em <span className="font-bold text-blue-200">"Invite user"</span> e informe o e-mail</li>
                                    <li>O usuário receberá um link de convite por e-mail</li>
                                    <li>Após aceitar, insira o e-mail abaixo para registrar o perfil com role=master</li>
                                </ol>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">
                                E-mail do usuário (já criado no Supabase Auth)
                            </label>
                            <input
                                type="email"
                                value={newEmail}
                                onChange={e => setNewEmail(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleInsertProfile()}
                                placeholder="admin@empresa.com"
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition"
                            />
                        </div>

                        {insertError && (
                            <div className="flex items-center gap-2 text-rose-400 text-sm bg-rose-500/10 border border-rose-500/25 rounded-xl px-4 py-3">
                                <AlertTriangle size={15} className="shrink-0" />
                                {insertError}
                            </div>
                        )}

                        {insertSuccess && (
                            <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3">
                                <ShieldCheck size={15} className="shrink-0" />
                                Perfil master registrado com sucesso!
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={closeInviteModal}
                                className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-300 font-bold text-sm hover:bg-slate-800 transition-colors"
                            >
                                Fechar
                            </button>
                            <button
                                onClick={handleInsertProfile}
                                disabled={insertLoading || !newEmail.trim()}
                                className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {insertLoading ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
                                Registrar Perfil Master
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
