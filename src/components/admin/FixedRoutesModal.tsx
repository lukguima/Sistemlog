import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, MapPin } from 'lucide-react';
import { fixedRouteService } from '../../lib/services';
import { useAuth } from '../../context/AuthContext';

interface FixedRoutesModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function FixedRoutesModal({ isOpen, onClose }: FixedRoutesModalProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [routes, setRoutes] = useState<any[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        origin: '',
        destination: '',
        freight_value: '',
        distance_km: '',
        company_id: (user as any)?.company_id
    });

    const companyId = (user as any)?.company_id;

    const fetchRoutes = async () => {
        if (!companyId) return;
        try {
            setLoading(true);
            const data = await fixedRouteService.getFixedRoutes(companyId);
            setRoutes(data || []);
        } catch (error) {
            console.error('Error fetching fixed routes:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchRoutes();
            setShowForm(false);
        }
    }, [isOpen, companyId]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            await fixedRouteService.addFixedRoute({
                ...formData,
                freight_value: parseFloat(formData.freight_value.toString()),
                distance_km: formData.distance_km ? parseFloat(formData.distance_km.toString()) : null,
                company_id: companyId
            });
            setFormData({ origin: '', destination: '', freight_value: '', distance_km: '', company_id: companyId });
            setShowForm(false);
            fetchRoutes();
        } catch (error) {
            console.error('Error saving fixed route:', error);
            alert('Erro ao salvar trecho fixo.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir este trecho fixo?')) return;
        try {
            await fixedRouteService.deleteFixedRoute(id);
            fetchRoutes();
        } catch (error) {
            console.error('Error deleting fixed route:', error);
        }
    };

    const labelStyle = "text-[10px] font-black text-[#8B95B1] uppercase tracking-widest ml-1 mb-1.5 block";
    const inputStyle = "w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300 appearance-none";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in duration-200">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
                    <div>
                        <h2 className="text-xl font-bold text-[#0F172A]">Trechos Fixos</h2>
                        <p className="text-xs text-slate-500 mt-1">Gerencie valores de frete pré-definidos para suas rotas.</p>
                    </div>
                    <div className="flex gap-2">
                        {!showForm && (
                            <button 
                                onClick={() => setShowForm(true)}
                                className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-all flex items-center gap-2 text-xs font-bold px-4"
                            >
                                <Plus size={16} /> Novo Trecho
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {showForm ? (
                        <form onSubmit={handleSubmit} className="space-y-4 animate-in slide-in-from-top-4 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className={labelStyle}>Cidade de Origem</label>
                                    <input
                                        required
                                        className={inputStyle}
                                        placeholder="Ex: São Paulo, SP"
                                        value={formData.origin}
                                        onChange={e => setFormData({ ...formData, origin: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelStyle}>Cidade de Destino</label>
                                    <input
                                        required
                                        className={inputStyle}
                                        placeholder="Ex: Curitiba, PR"
                                        value={formData.destination}
                                        onChange={e => setFormData({ ...formData, destination: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className={labelStyle}>Valor do Frete (R$)</label>
                                    <input
                                        required
                                        type="number"
                                        step="0.01"
                                        className={inputStyle}
                                        placeholder="0,00"
                                        value={formData.freight_value}
                                        onChange={e => setFormData({ ...formData, freight_value: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelStyle}>Distância Est. (KM)</label>
                                    <input
                                        type="number"
                                        className={inputStyle}
                                        placeholder="Km"
                                        value={formData.distance_km}
                                        onChange={e => setFormData({ ...formData, distance_km: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="flex-1 px-6 py-3 rounded-xl font-bold text-xs uppercase text-slate-700 border border-slate-200 hover:bg-slate-50 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-[#2563EB] text-white px-6 py-3 rounded-xl font-bold text-xs uppercase hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/25"
                                >
                                    {loading ? 'Salvando...' : 'Salvar Trecho'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="space-y-3">
                            {loading && routes.length === 0 ? (
                                <p className="text-center py-8 text-slate-400">Carregando...</p>
                            ) : routes.length > 0 ? (
                                routes.map((route) => (
                                    <div key={route.id} className="group p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-blue-100 hover:shadow-md transition-all flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                                                <MapPin size={20} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-900">{route.origin}</span>
                                                    <span className="text-slate-300">→</span>
                                                    <span className="font-bold text-slate-900">{route.destination}</span>
                                                </div>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                                        R$ {Number(route.freight_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </span>
                                                    {route.distance_km && (
                                                        <span className="text-[10px] font-medium text-slate-400">
                                                            {route.distance_km} KM
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleDelete(route.id)}
                                            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-[2rem]">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                        <MapPin size={32} />
                                    </div>
                                    <p className="text-slate-500 font-medium">Nenhum trecho fixo cadastrado.</p>
                                    <p className="text-xs text-slate-400 mt-1">Cadastre seus fretes recorrentes para agilidade.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
