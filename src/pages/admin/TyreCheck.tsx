import { useState, useMemo, useEffect, Suspense } from 'react';
import { Map, ChevronDown, History, Settings, Save, Info, AlertTriangle, Loader2 } from 'lucide-react';
import { fleetService, tyreService } from '../../lib/services';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';
import { TruckScene3D } from '../../components/admin/TruckScene3D';
import { TYRE_DEPTH } from '../../lib/constants';

export default function TyreCheck() {
    const { user } = useAuth();
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
    const [pneus, setPneus] = useState<any[]>([]);
    const [activeTyre, setActiveTyre] = useState<any | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Form states
    const [editForm, setEditForm] = useState({
        brand: '',
        serial_number: '',
        tread_depth_mm: 0,
        last_km: 0,
        install_date: format(new Date(), 'yyyy-MM-dd'),
        status: 'good'
    });

    const companyId = (user as any)?.company_id;

    useEffect(() => {
        if (!companyId) return;
        const fetchVehicles = async () => {
            try {
                const data = await fleetService.getVehicles(companyId);
                setVehicles(data || []);
                if (data && data.length > 0) {
                    setSelectedVehicle(data[0].id);
                }
            } catch (error) {
                console.error('Error fetching vehicles:', error);
            }
        };
        fetchVehicles();
    }, [companyId]);

    useEffect(() => {
        if (!selectedVehicle) return;
        const fetchTyres = async () => {
            try {
                const data = await tyreService.getTyresByVehicle(selectedVehicle);
                setPneus(data || []);
                setActiveTyre(null);
            } catch (error) {
                console.error('Error fetching tyres:', error);
            }
        };
        fetchTyres();
    }, [selectedVehicle]);

    const selectedVehicleData = useMemo(() => vehicles.find(v => v.id === selectedVehicle), [selectedVehicle, vehicles]);

    const fetchHistory = async (tyreId: string) => {
        if (!tyreId) {
            setHistory([]);
            return;
        }
        try {
            const data = await tyreService.getTyreHistory(tyreId);
            setHistory(data || []);
        } catch (error) {
            console.error('Error fetching history:', error);
        }
    };

    const handleSelectTyre = (pneu: any) => {
        setActiveTyre(pneu);
        if (pneu.id) {
            fetchHistory(pneu.id);
        } else {
            setHistory([]);
        }
    };

    const handleOpenEdit = (pneu: any) => {
        setActiveTyre(pneu);
        setEditForm({
            brand: pneu.brand || '',
            serial_number: pneu.serial_number || '',
            tread_depth_mm: pneu.tread_depth_mm || 0,
            last_km: pneu.last_km || selectedVehicleData?.current_km || 0,
            install_date: pneu.install_date ? format(new Date(pneu.install_date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
            status: pneu.status || 'good'
        });
        setIsEditModalOpen(true);
    };

    const [isSaving, setIsSaving] = useState(false);

    const handleSaveTyre = async () => {
        if (!activeTyre || !selectedVehicle || !companyId) {
            alert("Erro: Dados do veículo ou empresa não identificados.");
            return;
        }
        setIsSaving(true);
        try {
            // Se estivermos editando um pneu existente, removemos o company_id do update_mask 
            // se o pneu já pertencer a outra empresa (segurança), mas aqui garantimos que enviamos o ID correto.
            const tyrePayload = {
                ...editForm,
                vehicle_id: selectedVehicle,
                position: activeTyre.position,
                company_id: companyId
            };

            let updated;
            if (activeTyre.id) {
                // Update existing
                updated = await tyreService.updateTyre(activeTyre.id, tyrePayload);
            } else {
                // Create new
                updated = await tyreService.addTyre(tyrePayload);
            }

            // Log the check
            await tyreService.addTyreCheck({
                company_id: companyId,
                tyre_id: updated.id,
                vehicle_id: selectedVehicle,
                position: activeTyre.position,
                depth_mm: editForm.tread_depth_mm,
                km: editForm.last_km,
                type: activeTyre.id ? 'check' : 'install',
                notes: activeTyre.id ? `Atualização manual: ${editForm.brand}` : `Instalação inicial: ${editForm.brand}`
            });

            setPneus(prev => {
                const existing = prev.find(p => p.id === activeTyre.id && activeTyre.id);
                if (existing) {
                    return prev.map(p => p.id === activeTyre.id ? updated : p);
                } else {
                    return [...prev, updated];
                }
            });
            setActiveTyre(updated);
            setIsEditModalOpen(false);
            fetchHistory(updated.id);
            alert("Alterações salvas com sucesso!");
        } catch (error: any) {
            console.error('Error saving tyre:', error);
            alert(`Erro ao salvar: ${error.message || 'Verifique se você executou os scripts SQL no Supabase.'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteTyre = async () => {
        if (!activeTyre?.id) return;
        if (!window.confirm('Tem certeza que deseja remover este pneu? Este registro será excluído permanentemente.')) return;

        try {
            await tyreService.deleteTyre(activeTyre.id);
            setPneus(prev => prev.filter(p => p.id !== activeTyre.id));
            setActiveTyre({ position: activeTyre.position, tread_depth_mm: 0 });
            setHistory([]);
        } catch (error) {
            console.error('Error deleting tyre:', error);
        }
    };

    const validationAlerts = useMemo(() => {
        const alerts: { msg: string; level: 'critical' | 'warning' }[] = [];
        pneus.forEach(p => {
            const d = Number(p.tread_depth_mm) || 0;
            if (d <= TYRE_DEPTH.LEGAL_MIN) {
                alerts.push({ msg: `Pneu ${p.position}: ${d}mm — abaixo do mínimo legal (TWI). Troca imediata!`, level: 'critical' });
            } else if (d <= TYRE_DEPTH.WARNING) {
                alerts.push({ msg: `Pneu ${p.position}: ${d}mm — abaixo de ${TYRE_DEPTH.WARNING}mm. Agende a troca.`, level: 'critical' });
            } else if (d <= TYRE_DEPTH.SAFE) {
                alerts.push({ msg: `Pneu ${p.position}: ${d}mm — monitorar, próximo do limite de segurança.`, level: 'warning' });
            }
        });
        return alerts;
    }, [pneus]);

    return (
        <div className="max-w-7xl mx-auto space-y-8 font-display pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Gestão Técnica de Pneus</h1>
                    <p className="text-slate-500 dark:text-slate-400">Controle por veículo, histórico de trocas e monitoramento de sulcos.</p>
                </div>

                <div className="flex gap-4 items-center">
                    <div className="relative">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1 ml-1">Veículo Selecionado</label>
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 min-w-[240px] shadow-sm">
                            <select
                                className="bg-transparent border-none focus:ring-0 font-bold text-sm w-full appearance-none cursor-pointer outline-none"
                                value={selectedVehicle || ''}
                                onChange={(e) => setSelectedVehicle(e.target.value)}
                            >
                                {vehicles.map(v => (
                                    <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>
                                ))}
                            </select>
                            <ChevronDown size={16} className="text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Visualizador de Chassi com Perspectiva 3D Real (Three.js) */}
                <div className="lg:col-span-7 flex-1 bg-slate-50 rounded-[2.5rem] border border-slate-200 flex flex-col items-center justify-center min-h-[600px] overflow-hidden relative shadow-xl">
                    <div className="absolute top-8 left-8 flex items-center gap-2 z-10">
                        <Map size={16} className="text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inspeção Técnica 3D</span>
                    </div>

                    <Suspense fallback={
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Carregando Modelo 3D...</span>
                        </div>
                    }>
                        <TruckScene3D
                            pneus={pneus}
                            activeTyre={activeTyre}
                            onSelect={handleSelectTyre}
                            vehicleType={selectedVehicleData?.truck_type}
                        />
                    </Suspense>

                    <div className="absolute bottom-8 flex gap-6 text-[10px] font-bold uppercase tracking-widest text-slate-400 z-10 bg-white/80 px-6 py-3 rounded-full border border-slate-200/50 backdrop-blur-sm">
                        <span className="flex items-center gap-2"><i className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]"></i> Seguro</span>
                        <span className="flex items-center gap-2"><i className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]"></i> Monitorar</span>
                        <span className="flex items-center gap-2"><i className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]"></i> Crítico</span>
                    </div>
                </div>

                {/* Painel de Detalhes Estilizado conforme novo layout */}
                <div id="data-panel" className="w-full lg:w-[450px] bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl flex flex-col gap-6 relative overflow-hidden">
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tight">
                                {activeTyre ? `Pneu ${activeTyre.position}` : 'Selecione um Pneu'}
                            </h2>
                            <p className="text-slate-400 text-sm font-medium">
                                {activeTyre ? `Dados técnicos da posição ${activeTyre.position}` : 'Clique no diagrama para ver os detalhes'}
                            </p>
                        </div>
                        {activeTyre && (
                            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase
                                ${activeTyre.tread_depth_mm > TYRE_DEPTH.SAFE ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/20' :
                                    activeTyre.tread_depth_mm > TYRE_DEPTH.LEGAL_MIN ? 'bg-amber-500/20 text-amber-500 border border-amber-500/20' :
                                        'bg-rose-500/20 text-rose-500 border border-rose-500/20'}
                            `}>
                                {activeTyre.tread_depth_mm > TYRE_DEPTH.SAFE ? 'OK' : activeTyre.tread_depth_mm > TYRE_DEPTH.LEGAL_MIN ? 'Atenção' : 'Perigo'}
                            </div>
                        )}
                    </div>

                    {/* Alertas de Validação */}
                    {validationAlerts.length > 0 && (
                        <div className="space-y-2 relative z-10">
                            {validationAlerts.map((alert, i) => (
                                <div key={i} className={`px-4 py-3 rounded-2xl flex items-start gap-3 ${alert.level === 'critical' ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                                    <AlertTriangle size={18} className={`shrink-0 mt-0.5 animate-pulse ${alert.level === 'critical' ? 'text-rose-500' : 'text-amber-400'}`} />
                                    <span className={`text-[10px] font-bold uppercase leading-relaxed ${alert.level === 'critical' ? 'text-rose-200' : 'text-amber-200'}`}>{alert.msg}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 mt-2 relative z-10">
                        <div className="p-4 bg-slate-800/40 rounded-2xl border border-slate-700/50 hover:border-slate-600 transition-colors">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Última Troca</label>
                            <span className="text-white text-sm font-bold">
                                {activeTyre?.install_date ? format(new Date(activeTyre.install_date), 'dd/MM/yyyy') : '---'}
                            </span>
                        </div>
                        <div className="p-4 bg-slate-800/40 rounded-2xl border border-slate-700/50 hover:border-slate-600 transition-colors">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Sulco Atual</label>
                            <div className="flex items-baseline gap-1">
                                <span className="text-white text-lg font-black">{activeTyre?.tread_depth_mm || '0.0'}</span>
                                <span className="text-[10px] text-slate-500 font-bold">mm</span>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-800/40 rounded-2xl border border-slate-700/50 hover:border-slate-600 transition-colors col-span-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Marca / Nº Série</label>
                            <span className="text-white text-sm font-bold block truncate">
                                {activeTyre ? `${activeTyre.brand || 'Marca não informada'} - ${activeTyre.serial_number || 'S/N'}` : '---'}
                            </span>
                        </div>
                        <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20 col-span-2 group">
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] font-black text-primary uppercase tracking-widest">Vida Útil Estimada</label>
                                <Info size={14} className="text-primary/40 group-hover:text-primary transition-colors cursor-help" />
                            </div>
                            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden mt-2">
                                <div
                                    className={`h-full transition-all duration-1000 ${activeTyre?.tread_depth_mm > TYRE_DEPTH.SAFE ? 'bg-primary' : activeTyre?.tread_depth_mm > TYRE_DEPTH.LEGAL_MIN ? 'bg-amber-500' : 'bg-rose-500'}`}
                                    style={{ width: `${Math.min(((activeTyre?.tread_depth_mm || 0) / 10) * 100, 100)}%` }}
                                ></div>
                            </div>
                            <p className="text-[10px] font-bold text-slate-500 mt-2 flex justify-between">
                                <span>TWI Mínimo: 1.6mm</span>
                                <span className="text-white font-black">{Math.round(Math.min(((activeTyre?.tread_depth_mm || 0) / 10) * 100, 100))}% disponível</span>
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3 mt-4 relative z-10">
                        <button
                            disabled={!activeTyre}
                            onClick={() => activeTyre && handleOpenEdit(activeTyre)}
                            className="w-full bg-primary hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 group"
                        >
                            <Settings size={18} className="group-hover:rotate-90 transition-transform duration-500" />
                            {activeTyre?.id ? 'CONFIGURAR PNEU' : 'INSTALAR PNEU'}
                        </button>

                        {activeTyre?.id && (
                            <button
                                onClick={handleDeleteTyre}
                                className="w-full bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 border border-rose-500/20"
                            >
                                <AlertTriangle size={16} />
                                REMOVER PNEU DA POSIÇÃO
                            </button>
                        )}

                        <button
                            disabled={!activeTyre?.id}
                            onClick={() => activeTyre?.id && setIsHistoryOpen(!isHistoryOpen)}
                            className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                            <History size={16} />
                            {isHistoryOpen ? 'OCULTAR HISTÓRICO' : 'VER HISTÓRICO COMPLETO'}
                        </button>

                        {/* Lista de Histórico (se aberto) */}
                        {isHistoryOpen && activeTyre && (
                            <div className="mt-2 space-y-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar relative z-10">
                                {history.length > 0 ? history.map((h, i) => (
                                    <div key={i} className="p-3 bg-slate-800/30 rounded-xl border border-slate-700/30">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[9px] font-black text-primary uppercase">{h.type}</span>
                                            <span className="text-[9px] font-bold text-slate-500">{format(new Date(h.checked_at), 'dd/MM/yy')}</span>
                                        </div>
                                        <p className="text-xs text-white font-bold">{h.depth_mm}mm - {h.notes || 'Sem observações'}</p>
                                    </div>
                                )) : (
                                    <p className="text-[10px] text-slate-500 text-center py-4">Sem registros de manutenção.</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Branding Decorativo */}
                    <div className="absolute -bottom-20 -right-20 opacity-[0.02] pointer-events-none">
                        <Map size={300} className="text-white" />
                    </div>
                </div>
            </div>

            {/* Modal de Edição/Novos Dados */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl border border-slate-200 dark:border-800 p-8 space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Atualizar Pneu {activeTyre?.position}</h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-black text-xl">×</button>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Marca</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/50"
                                        value={editForm.brand}
                                        onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Nº de Série</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/50"
                                        value={editForm.serial_number}
                                        onChange={(e) => setEditForm({ ...editForm, serial_number: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Sulco (mm)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-black outline-none focus:ring-2 focus:ring-primary/50"
                                        value={editForm.tread_depth_mm}
                                        onChange={(e) => setEditForm({ ...editForm, tread_depth_mm: Number(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">KM Atual do Veículo</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-black outline-none focus:ring-2 focus:ring-primary/50"
                                        value={editForm.last_km}
                                        onChange={(e) => setEditForm({ ...editForm, last_km: Number(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Data Instalação</label>
                                    <input
                                        type="date"
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/50"
                                        value={editForm.install_date}
                                        onChange={(e) => setEditForm({ ...editForm, install_date: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleSaveTyre}
                            disabled={isSaving}
                            className={`w-full bg-primary hover:bg-primary-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/30 ${isSaving ? 'opacity-70 cursor-wait' : ''}`}
                        >
                            {isSaving ? (
                                <>
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    SALVANDO...
                                </>
                            ) : (
                                <>
                                    <Save size={18} />
                                    SALVAR ALTERAÇÕES
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
