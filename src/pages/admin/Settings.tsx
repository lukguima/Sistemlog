import {
    Palette,
    Upload,
    Save,
    Eye,
    Globe,
    Smartphone,
    Activity,
    Type,
    Image as ImageIcon,
    Building2,
    Users,
    ShieldCheck,
    CreditCard,
    Plus,
    Trash2,
    Mail,
    Lock,
    Pencil
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { settingsService, profileService, subscriptionService } from '../../lib/services';
import { SUBSCRIPTION_PLANS } from '../../lib/constants';
import { supabase } from '../../lib/supabase';
import UserModal from '../../components/admin/UserModal';
import { SECTORS } from '../../lib/permissions';

type Tab = 'company' | 'users' | 'security' | 'subscription' | 'branding';

export default function Settings() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('company');
    const [settings, setSettings] = useState({
        primary_color: '#2563EB',
        system_name: '',
        active_modules: ['portal', 'driver_app', 'monitoring'],
        logo_url: '',
        default_commission_rate: '12',
        default_tax_rate: '6',
    });
    const [companyProfile, setCompanyProfile] = useState({
        company_name: '',
        cnpj: '',
        phone: '',
        address: '',
        email: ''
    });
    const [usersList, setUsersList] = useState<any[]>([]);
    const [subscription, setSubscription] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);

    // Security State
    const [securityData, setSecurityData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        newEmail: ''
    });

    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [loadingEmail, setLoadingEmail] = useState(false);
    const logoInputRef = useRef<HTMLInputElement>(null);

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user?.company_id) return;
        const allowed = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp'];
        if (!allowed.includes(file.type)) { setStatusMessage({ type: 'error', text: 'Formato inválido. Use PNG, SVG, JPG ou WebP.' }); return; }
        setUploadingLogo(true);
        try {
            const ext = file.name.split('.').pop();
            const path = `logos/${user.company_id}/logo.${ext}`;
            const { error: upErr } = await supabase.storage.from('company-assets').upload(path, file, { upsert: true });
            if (upErr) throw upErr;
            const { data: { publicUrl } } = supabase.storage.from('company-assets').getPublicUrl(path);
            setSettings(s => ({ ...s, logo_url: publicUrl }));
            await supabase.from('settings').upsert({ company_id: user.company_id, logo_url: publicUrl }, { onConflict: 'company_id' });
            setStatusMessage({ type: 'success', text: 'Logo atualizada com sucesso!' });
        } catch (err: any) {
            setStatusMessage({ type: 'error', text: `Erro ao fazer upload: ${err.message}` });
        } finally {
            setUploadingLogo(false);
        }
    };

    useEffect(() => {
        if (statusMessage) {
            const timer = setTimeout(() => setStatusMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [statusMessage]);

    useEffect(() => {
        if (user?.company_id) {
            loadAllData();
        }
        if (user?.email) {
            setSecurityData(prev => ({ ...prev, newEmail: user.email || '' }));
        }
    }, [user]);

    const loadAllData = async () => {
        if (!user?.company_id) return;
        setLoading(true);
        try {
            // Buscar dados em paralelo mas tratar erros individualmente
            const fetches = await Promise.allSettled([
                settingsService.getSettings(user.company_id),
                settingsService.getCompanyProfile(user.company_id),
                subscriptionService.getSubscription(user.company_id),
                profileService.getUsers(user.company_id)
            ]);

            const [settingsRes, profileRes, subsRes, usersRes] = fetches;

            if (settingsRes.status === 'fulfilled' && settingsRes.value) {
                const data = settingsRes.value;
                setSettings({
                    primary_color: data.primary_color || '#2563EB',
                    system_name: data.system_name || '',
                    active_modules: data.active_modules || data.modules || ['portal', 'driver_app', 'monitoring'],
                    logo_url: data.logo_url || '',
                    default_commission_rate: String(data.default_commission_rate ?? '12'),
                    default_tax_rate: String(data.default_tax_rate ?? '6'),
                });
            }

            if (profileRes.status === 'fulfilled' && profileRes.value) {
                const data = profileRes.value;
                setCompanyProfile({
                    company_name: data.name || data.company_name || '',
                    cnpj: data.document || data.cnpj || '',
                    phone: data.phone || '',
                    address: data.address || '',
                    email: data.email || ''
                });
            }

            if (subsRes.status === 'fulfilled' && subsRes.value) {
                setSubscription(subsRes.value);
            }

            if (usersRes.status === 'fulfilled' && usersRes.value) {
                setUsersList(usersRes.value);
            }
        } catch (error) {
            console.error('Unexpected error loading settings data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSettings = async () => {
        if (!user?.company_id) return;
        setLoading(true);
        try {
            await settingsService.saveSettings({
                company_id: user.company_id,
                ...settings
            });
            setStatusMessage({ type: 'success', text: 'Marca salva com sucesso!' });
        } catch (error) {
            setStatusMessage({ type: 'error', text: 'Erro ao salvar branding.' });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!user?.company_id) {
            setStatusMessage({ type: 'error', text: 'ID da empresa não encontrado. Faça logout e login novamente.' });
            return;
        }
        setLoading(true);
        try {
            await settingsService.saveCompanyProfile(user.company_id, companyProfile);
            setStatusMessage({ type: 'success', text: 'Perfil da empresa atualizado com sucesso!' });
        } catch (error) {
            setStatusMessage({ type: 'error', text: 'Erro ao salvar perfil: ' + (error as any).message });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePassword = async () => {
        if (!securityData.newPassword) {
            alert('Por favor, digite a nova senha.');
            return;
        }
        if (securityData.newPassword !== securityData.confirmPassword) {
            alert('As senhas não coincidem.');
            return;
        }
        if (securityData.newPassword.length < 6) {
            alert('A senha deve ter pelo menos 6 caracteres.');
            return;
        }
        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: securityData.newPassword
            });
            if (error) throw error;
            setStatusMessage({ type: 'success', text: 'Senha alterada com sucesso!' });
            setSecurityData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
        } catch (error) {
            console.error('Error updating password:', error);
            setStatusMessage({ type: 'error', text: 'Erro ao alterar senha: ' + (error as any).message });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateEmail = async () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!securityData.newEmail) {
            setStatusMessage({ type: 'error', text: 'Digite o novo e-mail.' });
            return;
        }
        if (!emailRegex.test(securityData.newEmail)) {
            setStatusMessage({ type: 'error', text: 'Formato de e-mail inválido.' });
            return;
        }
        if (securityData.newEmail === user?.email) {
            setStatusMessage({ type: 'error', text: 'O novo e-mail é igual ao atual.' });
            return;
        }
        setLoadingEmail(true);
        try {
            const { error } = await supabase.auth.updateUser({ email: securityData.newEmail });
            if (error) throw error;
            setStatusMessage({ type: 'success', text: 'Solicitação enviada! Verifique o novo e-mail para confirmar a troca.' });
        } catch (error: any) {
            console.error('Error updating email:', error);
            setStatusMessage({ type: 'error', text: `Erro ao atualizar e-mail: ${error.message}` });
        } finally {
            setLoadingEmail(false);
        }
    };

    const handleRenewSubscription = (plan: string) => {
        try {
            const url = subscriptionService.createKiwifyCheckout(plan);
            window.open(url, '_blank');
        } catch (error: any) {
            console.error('Erro ao abrir checkout Kiwify:', error);
            setStatusMessage({ type: 'error', text: error.message || 'Erro ao iniciar pagamento.' });
        }
    };

    const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

    const handleDeleteUser = async (e: React.MouseEvent, userId: string) => {
        e.preventDefault();
        e.stopPropagation();

        if (!confirm('Tem certeza que deseja remover este usuário? O login dele será revogado e esta ação não pode ser desfeita.')) return;

        setDeletingUserId(userId);
        try {
            // Exclusão real via Edge Function (revoga o login + apaga o perfil)
            const { data: result, error: fnError } = await supabase.functions.invoke('delete-team-user', {
                body: { user_id: userId },
            });
            if (fnError) {
                let msg = fnError.message || 'Erro ao excluir usuário.';
                try {
                    const ctx = (fnError as any).context;
                    if (ctx && typeof ctx.json === 'function') {
                        const b = await ctx.json();
                        if (b?.error) msg = b.error;
                    }
                } catch { /* ignora */ }
                throw new Error(msg);
            }
            if ((result as any)?.error) throw new Error((result as any).error);
            setUsersList(usersList.filter(u => u.id !== userId));
            setStatusMessage({ type: 'success', text: 'Usuário removido e acesso revogado!' });
        } catch (error) {
            console.error('Erro detalhado ao remover usuário:', error);
            const msg = (error as any).message || 'Erro desconhecido';
            setStatusMessage({ type: 'error', text: 'Erro ao remover usuário: ' + msg });
        } finally {
            setDeletingUserId(null);
        }
    };

    const renderTabButton = (id: Tab, label: string, Icon: any) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === id 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
        >
            <Icon size={16} />
            {label}
        </button>
    );

    return (
        <div className="space-y-8 font-display pb-12">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Configurações</h1>
                    <p className="text-slate-500 mt-1 uppercase text-[10px] font-black tracking-[0.2em] leading-none">Gestão Administrativa & Identidade</p>
                </div>

                {statusMessage && (
                    <div className={`animate-in fade-in slide-in-from-top-2 duration-300 px-6 py-3 rounded-2xl border flex items-center gap-3 shadow-lg ${
                        statusMessage.type === 'success' 
                        ? 'bg-emerald-50 border-emerald-100 text-emerald-700 shadow-emerald-500/10' 
                        : 'bg-rose-50 border-rose-100 text-rose-700 shadow-rose-500/10'
                    }`}>
                        <div className={`w-2 h-2 rounded-full ${statusMessage.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />
                        <span className="text-xs font-black uppercase tracking-wider">{statusMessage.text}</span>
                    </div>
                )}
                
                <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 overflow-x-auto no-scrollbar max-w-full gap-1">
                    {renderTabButton('company', 'Empresa', Building2)}
                    {renderTabButton('users', 'Equipe', Users)}
                    {renderTabButton('security', 'Segurança', ShieldCheck)}
                    {renderTabButton('subscription', 'Assinatura', CreditCard)}
                </div>
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {activeTab === 'company' && (
                    <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl space-y-8">
                        <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                                <Building2 size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 leading-none">Perfil da Empresa</h3>
                                <p className="text-slate-500 text-[10px] font-bold mt-2 uppercase tracking-widest">Informações Estruturais</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-[#8B95B1] uppercase tracking-widest block mb-2 px-1">Nome Fantasia</label>
                                    <input 
                                        type="text" 
                                        className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-900 w-full outline-none focus:border-blue-500 transition-colors"
                                        value={companyProfile.company_name}
                                        onChange={e => setCompanyProfile({...companyProfile, company_name: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-[#8B95B1] uppercase tracking-widest block mb-2 px-1">CNPJ</label>
                                    <input 
                                        type="text" 
                                        className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-900 w-full outline-none focus:border-blue-500 transition-colors"
                                        placeholder="00.000.000/0000-00"
                                        value={companyProfile.cnpj}
                                        onChange={e => setCompanyProfile({...companyProfile, cnpj: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-[#8B95B1] uppercase tracking-widest block mb-2 px-1">Telefone Principal</label>
                                    <input 
                                        type="text" 
                                        className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-900 w-full outline-none focus:border-blue-500 transition-colors"
                                        placeholder="(00) 0 0000-0000"
                                        value={companyProfile.phone}
                                        onChange={e => setCompanyProfile({...companyProfile, phone: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-[#8B95B1] uppercase tracking-widest block mb-2 px-1">E-mail Comercial</label>
                                    <input 
                                        type="email" 
                                        className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-900 w-full outline-none focus:border-blue-500 transition-colors"
                                        placeholder="contato@empresa.com"
                                        value={companyProfile.email}
                                        onChange={e => setCompanyProfile({...companyProfile, email: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                                    <CreditCard size={18} />
                                </div>
                                <div>
                                    <p className="font-black text-slate-900 text-sm">Padrões de Viagem</p>
                                    <p className="text-[11px] text-slate-400">Valores pré-preenchidos ao lançar nova viagem</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="text-[10px] font-black text-[#8B95B1] uppercase tracking-widest block mb-2 px-1">Comissão Padrão (%)</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        step={0.1}
                                        className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-900 w-full outline-none focus:border-blue-500 transition-colors"
                                        placeholder="12"
                                        value={settings.default_commission_rate}
                                        onChange={e => setSettings({ ...settings, default_commission_rate: e.target.value })}
                                    />
                                    <p className="text-[11px] text-slate-400 mt-1.5 px-1">Percentual pago ao motorista por viagem</p>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-[#8B95B1] uppercase tracking-widest block mb-2 px-1">Imposto Padrão (%)</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        step={0.1}
                                        className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-900 w-full outline-none focus:border-blue-500 transition-colors"
                                        placeholder="6"
                                        value={settings.default_tax_rate}
                                        onChange={e => setSettings({ ...settings, default_tax_rate: e.target.value })}
                                    />
                                    <p className="text-[11px] text-slate-400 mt-1.5 px-1">Percentual de imposto aplicado ao frete</p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end gap-3">
                            <button
                                onClick={handleSaveSettings}
                                disabled={loading}
                                className="bg-amber-500 hover:bg-amber-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save size={18} />
                                {loading ? 'Salvando...' : 'Salvar Padrões'}
                            </button>
                            <button
                                onClick={handleSaveProfile}
                                disabled={loading}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save size={18} />
                                {loading ? 'Salvando...' : 'Salvar Perfil'}
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl space-y-8">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                                    <Users size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 leading-none">Equipe Administrativa</h3>
                                    <p className="text-slate-500 text-[10px] font-bold mt-2 uppercase tracking-widest">{usersList.length} usuários vinculados</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => { setSelectedUser(null); setIsUserModalOpen(true); }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                            >
                                <Plus size={18} />
                                Convidar
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {usersList.map((usr) => (
                                <div key={usr.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 hover:border-blue-500/30 hover:shadow-lg transition-all group relative overflow-hidden">
                                    <div className="flex justify-between items-start relative z-10">
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center font-black text-lg text-slate-700 shadow-sm border border-slate-200">
                                            {usr.full_name?.[0] || 'U'}
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => { setSelectedUser(usr); setIsUserModalOpen(true); }} title="Editar usuário" className="p-2 hover:bg-blue-50 rounded-xl text-blue-600 transition-colors"><Pencil size={14} /></button>
                                            <button 
                                                onClick={(e) => handleDeleteUser(e, usr.id)} 
                                                disabled={deletingUserId === usr.id}
                                                className={`p-2 rounded-xl transition-colors ${deletingUserId === usr.id ? 'bg-slate-100 text-slate-300' : 'hover:bg-rose-50 text-rose-600'}`}
                                            >
                                                {deletingUserId === usr.id ? (
                                                    <div className="w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <Trash2 size={14} />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-4 space-y-1 relative z-10">
                                        <h4 className="text-slate-900 font-black text-lg">{usr.full_name}</h4>
                                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider truncate">{usr.email}</p>
                                    </div>
                                    <div className="mt-6 space-y-3 relative z-10">
                                        <div className="flex items-center justify-between">
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${usr.role === 'admin' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                                                {usr.role === 'admin' ? 'Acesso Total' : 'Funcionário'}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${usr.active ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-slate-300'}`}></div>
                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{usr.active ? 'Ativo' : 'Inativo'}</span>
                                            </div>
                                        </div>
                                        {usr.role !== 'admin' && Array.isArray(usr.permissions) && usr.permissions.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {usr.permissions.map((p: string) => {
                                                    const sector = SECTORS.find(s => s.key === p);
                                                    return (
                                                        <span key={p} className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                            {sector?.label ?? p}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'security' && (
                    <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl space-y-10">
                        <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
                            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                                <ShieldCheck size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 leading-none">Segurança & Autenticação</h3>
                                <p className="text-slate-500 text-[10px] font-bold mt-2 uppercase tracking-widest">Controles de Acesso Pessoal</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                            <div className="space-y-6">
                                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                    <Lock size={14} className="text-rose-500" /> Alterar Senha de Acesso
                                </h4>
                                <div className="space-y-4 bg-slate-50 p-8 rounded-[2rem] border border-slate-200">
                                    <div>
                                        <label className="text-[10px] font-black text-[#8B95B1] uppercase tracking-widest block mb-2 px-1">Nova Senha</label>
                                        <input 
                                            type="password" 
                                            className="bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-900 w-full outline-none focus:border-rose-500 transition-colors"
                                            placeholder="••••••••"
                                            value={securityData.newPassword}
                                            onChange={e => setSecurityData({...securityData, newPassword: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-[#8B95B1] uppercase tracking-widest block mb-2 px-1">Confirmar Senha</label>
                                        <input 
                                            type="password" 
                                            className="bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-900 w-full outline-none focus:border-rose-500 transition-colors"
                                            placeholder="••••••••"
                                            value={securityData.confirmPassword}
                                            onChange={e => setSecurityData({...securityData, confirmPassword: e.target.value})}
                                        />
                                    </div>
                                    <button 
                                        onClick={handleUpdatePassword}
                                        disabled={loading}
                                        className="bg-rose-600 hover:bg-rose-700 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase transition-all shadow-lg shadow-rose-500/20 w-full disabled:opacity-50"
                                    >
                                        {loading ? 'Processando...' : 'Atualizar Credenciais'}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                    <Mail size={14} className="text-blue-500" /> E-mail de Login
                                </h4>
                                 <div className="bg-blue-50 p-8 rounded-[2rem] border border-blue-100 space-y-4">
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-[#8B95B1] uppercase tracking-widest block mb-2 px-1">Novo E-mail de Login</label>
                                        <input 
                                            type="email" 
                                            className="bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-900 w-full outline-none focus:border-blue-500 transition-colors"
                                            placeholder="novo@email.com"
                                            value={securityData.newEmail}
                                            onChange={e => setSecurityData({...securityData, newEmail: e.target.value})}
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-500 uppercase font-black leading-relaxed">
                                        * Ao trocar o e-mail, você receberá um link de confirmação no novo endereço.
                                    </p>
                                    <button
                                        onClick={handleUpdateEmail}
                                        disabled={loadingEmail}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase transition-all shadow-lg shadow-blue-500/20 w-full disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        <Mail size={16} />
                                        {loadingEmail ? 'Enviando...' : 'Atualizar E-mail'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'subscription' && (
                    <div className="space-y-8">
                        {/* Status atual */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                                    <CreditCard size={22} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900">Assinatura Atual</h3>
                                    <p className="text-slate-500 text-xs mt-0.5">
                                        Plano: <span className="font-bold text-slate-700 capitalize">{subscription?.plan ?? 'trial'}</span>
                                        {' · '}
                                        Status: <span className={`font-bold ${subscription?.status === 'active' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                            {subscription?.status === 'active' ? 'Ativo' : subscription?.status === 'trial' ? 'Demonstração' : subscription?.status ?? '—'}
                                        </span>
                                    </p>
                                </div>
                            </div>
                            {subscription?.current_period_end && (
                                <div className="bg-slate-50 px-5 py-2.5 rounded-xl border border-slate-200 text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        {subscription.status === 'active' ? 'Próxima renovação' : 'Expira em'}
                                    </p>
                                    <p className="text-sm font-black text-slate-800 mt-0.5">
                                        {new Date(subscription.current_period_end).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Cards dos planos */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {(Object.values(SUBSCRIPTION_PLANS) as typeof SUBSCRIPTION_PLANS[keyof typeof SUBSCRIPTION_PLANS][]).map((plan) => {
                                const isCurrent = subscription?.plan === plan.id;
                                const isEnterprise = plan.id === 'enterprise';
                                return (
                                    <div
                                        key={plan.id}
                                        className={`relative rounded-3xl border-2 p-7 flex flex-col gap-5 transition-all ${
                                            isCurrent
                                                ? 'border-blue-500 bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-2xl shadow-blue-500/30 scale-[1.02]'
                                                : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:shadow-lg'
                                        }`}
                                    >
                                        {isCurrent && (
                                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-400 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow">
                                                Plano Atual
                                            </span>
                                        )}
                                        {isEnterprise && !isCurrent && (
                                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow">
                                                Mais Popular
                                            </span>
                                        )}

                                        <div>
                                            <p className={`text-[10px] font-black uppercase tracking-widest ${isCurrent ? 'text-blue-200' : 'text-slate-400'}`}>
                                                {plan.description}
                                            </p>
                                            <h4 className={`text-2xl font-black mt-1 ${isCurrent ? 'text-white' : 'text-slate-900'}`}>{plan.name}</h4>
                                        </div>

                                        <div className="flex items-baseline gap-1">
                                            <span className={`text-sm font-bold ${isCurrent ? 'text-blue-200' : 'text-slate-400'}`}>R$</span>
                                            <span className={`text-4xl font-black tracking-tighter ${isCurrent ? 'text-white' : 'text-slate-900'}`}>{plan.price}</span>
                                            <span className={`text-sm font-bold ${isCurrent ? 'text-blue-200' : 'text-slate-400'}`}>/mês</span>
                                        </div>

                                        <ul className="space-y-2 flex-1">
                                            {plan.features.map((feat, i) => (
                                                <li key={i} className={`flex items-center gap-2 text-xs font-medium ${isCurrent ? 'text-blue-100' : 'text-slate-600'}`}>
                                                    <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] ${isCurrent ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-600'}`}>✓</span>
                                                    {feat}
                                                </li>
                                            ))}
                                        </ul>

                                        <button
                                            onClick={() => handleRenewSubscription(plan.id)}
                                            className={`w-full py-3 rounded-2xl font-black text-xs uppercase tracking-wide transition-all ${
                                                isCurrent
                                                    ? 'bg-white text-blue-700 hover:bg-blue-50'
                                                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20'
                                            }`}
                                        >
                                            {isCurrent ? 'Renovar Plano' : 'Assinar'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Kiwify badge */}
                        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-2 shadow-sm">
                                    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
                                        <rect width="40" height="40" rx="10" fill="#00C96B"/>
                                        <path d="M12 28C12 28 16 14 28 12C28 12 22 18 20 28H12Z" fill="white"/>
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-slate-900 font-black text-sm">Checkout Seguro via Kiwify</p>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Transação protegida e criptografada</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {['CARTÃO', 'PIX', 'BOLETO'].map(m => (
                                    <span key={m} className="bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm text-slate-700 font-black text-[10px]">{m}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'branding' && (
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                        <div className="xl:col-span-2 space-y-8">
                            <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl space-y-8">
                                <h3 className="text-xl font-black text-slate-900 border-b border-slate-100 pb-6 flex items-center gap-3">
                                    <Palette className="text-blue-600" /> Identidade do Ecossistema
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-[#8B95B1] uppercase tracking-widest">Logo da Marca (Proporção 1:1)</label>
                                        <div
                                            className="h-44 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center gap-4 hover:border-blue-500/50 transition-all cursor-pointer bg-slate-50 group relative overflow-hidden"
                                            onClick={() => logoInputRef.current?.click()}
                                        >
                                            <input ref={logoInputRef} type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="hidden" onChange={handleLogoUpload} />
                                            {settings.logo_url ? (
                                                <img src={settings.logo_url} alt="Logo" className="h-24 object-contain relative z-10" />
                                            ) : (
                                                <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center group-hover:scale-110 transition-transform relative z-10 shadow-sm border border-slate-100">
                                                    {uploadingLogo ? <span className="text-[10px] text-slate-400 font-bold">...</span> : <Upload className="text-slate-400" />}
                                                </div>
                                            )}
                                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest relative z-10">
                                                {uploadingLogo ? 'Enviando...' : settings.logo_url ? 'Clique para trocar' : 'Upload PNG/SVG/JPG'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-8">
                                        <div>
                                            <label className="text-[10px] font-black text-[#8B95B1] uppercase tracking-widest block mb-4 px-1">Cor Primária do Layout</label>
                                            <div className="flex items-center gap-5">
                                                <div 
                                                    className="w-16 h-16 rounded-[1.5rem] shadow-xl border-4 border-slate-50"
                                                    style={{ backgroundColor: settings.primary_color }}
                                                ></div>
                                                <div className="flex-1 space-y-2">
                                                    <input 
                                                        type="color" 
                                                        value={settings.primary_color} 
                                                        onChange={e => setSettings({ ...settings, primary_color: e.target.value })}
                                                        className="h-10 w-full cursor-pointer bg-transparent" 
                                                    />
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{settings.primary_color}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-[#8B95B1] uppercase tracking-widest block mb-3 px-1">Nome do Sistema na Aba</label>
                                            <input 
                                                type="text" 
                                                className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 w-full outline-none focus:border-blue-600 transition-colors"
                                                placeholder="Ex: My Logistic Cloud"
                                                value={settings.system_name}
                                                onChange={e => setSettings({ ...settings, system_name: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl">
                                <h3 className="text-xl font-black text-slate-900 mb-8 italic border-b border-slate-100 pb-6">Ativação de Módulos</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    {[
                                        { id: 'portal', name: 'Portal Cliente', icon: <Globe size={18} /> },
                                        { id: 'driver_app', name: 'App Driver', icon: <Smartphone size={18} /> },
                                        { id: 'monitoring', name: 'Track 3D', icon: <Activity size={18} /> },
                                    ].map((mod) => (
                                        <div 
                                            key={mod.id} 
                                            className={`bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100 flex flex-col gap-4 cursor-pointer transition-all ${settings.active_modules.includes(mod.id) ? 'border-blue-200 bg-blue-50 shadow-sm' : 'hover:border-slate-200 hover:bg-slate-100/50'}`}
                                            onClick={() => {
                                                const modules = settings.active_modules.includes(mod.id)
                                                    ? settings.active_modules.filter(m => m !== mod.id)
                                                    : [...settings.active_modules, mod.id];
                                                setSettings({ ...settings, active_modules: modules });
                                            }}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="text-blue-600 p-2 bg-white rounded-xl shadow-sm border border-slate-100">{mod.icon}</div>
                                                <div className={`w-10 h-6 rounded-full flex items-center px-1 transition-colors ${settings.active_modules.includes(mod.id) ? 'bg-blue-600' : 'bg-slate-300'}`}>
                                                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${settings.active_modules.includes(mod.id) ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-900">{mod.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-8">
                            <div className="bg-white p-10 rounded-[3.5rem] shadow-xl relative overflow-hidden group border border-slate-100">
                                <div className="absolute top-0 right-0 p-8 opacity-5 transform translate-x-4 -translate-y-4">
                                    <Eye size={140} />
                                </div>
                                <h3 className="text-slate-900 font-black text-2xl italic relative z-10 tracking-tighter">Preview Realtime</h3>
                                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-2 relative z-10">Visualização Sugerida</p>

                                <div className="mt-10 space-y-4 relative z-10">
                                    <div className="aspect-[4/3] bg-slate-900 rounded-[2.5rem] border border-slate-800 p-6 overflow-hidden shadow-inner">
                                        <div className="flex gap-2 items-center mb-6">
                                            <div className="w-2.5 h-2.5 rounded-full bg-rose-500/50"></div>
                                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50"></div>
                                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50"></div>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="w-full h-3 bg-white/5 rounded-full"></div>
                                            <div className="w-3/4 h-3 bg-white/5 rounded-full"></div>
                                            <div className="grid grid-cols-2 gap-4 pt-4">
                                                <div className="h-16 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex flex-col justify-end p-3">
                                                    <div className="w-full h-1 bg-blue-500 rounded-full"></div>
                                                </div>
                                                <div className="h-16 bg-white/5 rounded-2xl"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    onClick={handleSaveSettings}
                                    disabled={loading}
                                    className="w-full mt-10 bg-blue-600 text-white py-5 rounded-[1.5rem] font-black transition-all flex items-center justify-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-500/25 uppercase text-[10px] tracking-widest disabled:opacity-50 active:scale-95"
                                >
                                    <Save size={18} />
                                    {loading ? 'Aplicando...' : 'Publicar Alterações'}
                                </button>
                            </div>

                            <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8 px-1">Suporte Mobile & Web</h4>
                                <div className="space-y-6">
                                    <div className="flex items-center gap-4 text-slate-600">
                                        <div className="p-2 bg-blue-100 rounded-xl"><Type size={16} className="text-blue-600" /></div>
                                        <span className="text-[10px] font-black uppercase tracking-wider italic">Google Fonts API v3</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-slate-600">
                                        <div className="p-2 bg-blue-100 rounded-xl"><ImageIcon size={16} className="text-blue-600" /></div>
                                        <span className="text-[10px] font-black uppercase tracking-wider italic">Favicon Multi-size</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <UserModal 
                isOpen={isUserModalOpen} 
                onClose={() => setIsUserModalOpen(false)} 
                initialData={selectedUser}
                onSave={async (data) => {
                    if (!user?.company_id) return;
                    try {
                        if (selectedUser) {
                            const { password: _pw, ...updateData } = data;
                            await profileService.updateUser(selectedUser.id, updateData);
                            setStatusMessage({ type: 'success', text: 'Usuário atualizado com sucesso!' });
                        } else {
                            // Cria login real via Edge Function (auth user + perfil + permissões)
                            const { data: result, error: fnError } = await supabase.functions.invoke('create-team-user', {
                                body: {
                                    full_name: data.full_name,
                                    email: data.email,
                                    password: data.password,
                                    role: data.role,
                                    permissions: data.permissions ?? [],
                                },
                            });
                            if (fnError) {
                                // Extrai a mensagem retornada pela função
                                let msg = fnError.message || 'Erro ao criar usuário.';
                                try {
                                    const ctx = (fnError as any).context;
                                    if (ctx && typeof ctx.json === 'function') {
                                        const b = await ctx.json();
                                        if (b?.error) msg = b.error;
                                    }
                                } catch { /* ignora */ }
                                throw new Error(msg);
                            }
                            if ((result as any)?.error) throw new Error((result as any).error);
                            setStatusMessage({ type: 'success', text: 'Usuário criado com sucesso! Informe o e-mail e a senha ao funcionário.' });
                        }
                        await loadAllData();
                    } catch (error) {
                        console.error('Error saving user full details:', error);
                        const errObj = error as any;
                        const msg = errObj.message || '';
                        
                        // Detecção aprimorada baseada no código de erro ou mensagem
                        if (msg.includes('column "active" of relation "profiles" does not exist') || 
                            msg.includes('column "email" of relation "profiles" does not exist') ||
                            (errObj.code === 'PGRST204')) {
                            setStatusMessage({ 
                                type: 'error', 
                                text: 'Erro: Colunas faltando no banco. Por favor, execute o script SQL "ADD_PROFILES_COLUMNS.sql" no seu dashboard Supabase.' 
                            });
                        } else if (msg.includes('violates check constraint "profiles_role_check"') || (errObj.code === '23514')) {
                            setStatusMessage({ 
                                type: 'error', 
                                text: 'Erro: O nível de acesso selecionado não é permitido. Execute o script SQL "ADD_PROFILES_COLUMNS.sql" para atualizar as permissões.' 
                            });
                        } else {
                            setStatusMessage({ type: 'error', text: 'Erro ao salvar usuário: ' + (msg || 'Erro desconhecido') });
                        }
                        throw error;
                    }
                }}
            />
        </div>
    );
}
