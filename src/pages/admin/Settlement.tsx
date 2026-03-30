import { useState, useMemo, useEffect } from 'react';
import { CheckCircle, Search, Wallet, AlertTriangle, Plus, Edit2, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { tripService, fleetService, settlementService } from '../../lib/services';
import { DEFAULT_COMMISSION_RATE } from '../../lib/constants';
import AddAdvanceModal from '../../components/admin/AddAdvanceModal';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export default function Settlement() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'settlement' | 'advances'>('settlement');

    // Settlement Tab State
    const [viagens, setViagens] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [pendingAdvances, setPendingAdvances] = useState<any[]>([]);
    const [settlePage, setSettlePage] = useState(1);
    const SETTLE_PAGE_SIZE = 20;

    // Advances Tab State
    const [allAdvances, setAllAdvances] = useState<any[]>([]);
    const [advanceSearch, setAdvanceSearch] = useState('');

    // Modal State
    const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [editingAdvance, setEditingAdvance] = useState<any>(null);

    const companyId = (user as any)?.company_id;

    const fetchViagens = async () => {
        if (!companyId) return;
        setLoading(true);
        try {
            const data = await tripService.getTrips(companyId);
            setViagens(data || []);

            // Também buscar adiantamentos pendentes para cálculo
            const advancesData = await settlementService.getAdvances(companyId, 'pending');
            setPendingAdvances(advancesData || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAllAdvances = async () => {
        if (!companyId) return;
        try {
            const data = await settlementService.getAdvances(companyId, 'all');
            setAllAdvances(data || []);
        } catch (error) {
            console.error('Error fetching advances:', error);
        }
    };

    const fetchDrivers = async () => {
        if (!companyId) return;
        try {
            const data = await fleetService.getDrivers(companyId);
            setDrivers(data || []);
        } catch (e) {
            console.error('Error fetching drivers:', e);
        }
    };

    useEffect(() => {
        fetchViagens();
        fetchDrivers();
    }, [companyId]);

    useEffect(() => {
        if (activeTab === 'advances') {
            fetchAllAdvances();
        }
    }, [activeTab, companyId]);

    const handleToggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedIds(newSelected);
    };

    // Bloco C: Cálculo do Cérebro (Base Financeira de Acerto)
    const statusLabel = (status: string) => {
        if (!status) return '';
        const s = status.toLowerCase();
        if (s === 'paid') return 'pago';
        if (s === 'pending') return 'pendente';
        if (s === 'in_transit') return 'em viagem';
        if (s === 'completed') return 'finalizado';
        if (s === 'validated') return 'validado';
        return s;
    };

    const filteredViagens = viagens.filter(v =>
        searchTerm === '' || (
            v.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            v.driver?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            statusLabel(v.status).includes(searchTerm.toLowerCase()) ||
            (v.status || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
    );
    const settleTotalPages = Math.max(1, Math.ceil(filteredViagens.length / SETTLE_PAGE_SIZE));
    const settleSafePage = Math.min(settlePage, settleTotalPages);
    const paginatedViagens = filteredViagens.slice((settleSafePage - 1) * SETTLE_PAGE_SIZE, settleSafePage * SETTLE_PAGE_SIZE);

    const settlementCalc = useMemo(() => {
        const selected = viagens.filter(v => selectedIds.has(v.id));

        const selectedDriverIds = new Set(selected.map(v => v.driver_id).filter(Boolean));
        const advancesForSelected = pendingAdvances.filter(adv => selectedDriverIds.has(adv.driver_id));
        
        const baseSomaBruta = selected.reduce((sum, item) => sum + (Number(item.gross_value) || 0), 0);
        
        // Vales individuais de cada viagem
        const tripAdvancesAmount = selected.reduce((sum, item) => sum + (Number(item.advance_value) || 0), 0);
        // Vales extras (driver_advances)
        const driverAdvancesAmount = advancesForSelected.reduce((sum, adv) => sum + (Number(adv.amount) || 0), 0);
        
        const totalVales = tripAdvancesAmount + driverAdvancesAmount;

        const comissaoBrutaTotal = round2(selected.reduce((sum, item) => {
            const taxa = Number(item.commission_rate) || DEFAULT_COMMISSION_RATE;
            const imposto = Number(item.tax_rate) || 0;
            const baseCalculo = (Number(item.gross_value) || 0) * (1 - (imposto / 100));
            return sum + (baseCalculo * (taxa / 100));
        }, 0));

        const comissaoPagar = round2(Math.max(0, comissaoBrutaTotal - totalVales));

        return { 
            baseSomaBruta, 
            totalVales, 
            tripAdvancesAmount,
            driverAdvancesAmount,
            comissaoBrutaTotal,
            comissaoPagar, 
            qty: selected.length, 
            advancesForSelected 
        };
    }, [selectedIds, viagens, pendingAdvances]);

    // Bloco C: Instrução de Transição de Estado em Lote
    const executePaymentBatch = async () => {
        if (selectedIds.size === 0) return;

        const errors: string[] = [];
        const selectedTrips = viagens.filter(v => selectedIds.has(v.id));

        // Aceita qualquer viagem que ainda não foi paga
        const SETTLEABLE_STATUSES = ['completed', 'validated', 'pending', 'in_transit'];
        const settleableTrips = selectedTrips.filter(t => SETTLEABLE_STATUSES.includes(t.status?.toLowerCase()));
        const skipped = selectedTrips.length - settleableTrips.length;

        if (settleableTrips.length === 0) {
            alert('Nenhuma viagem selecionada disponível para pagamento. Viagens já pagas não podem ser liquidadas novamente.');
            return;
        }

        setLoading(true);
        try {
            const tripsByDriver: Record<string, any[]> = {};
            settleableTrips.forEach(t => {
                if (!t.driver_id) return;
                if (!tripsByDriver[t.driver_id]) tripsByDriver[t.driver_id] = [];
                tripsByDriver[t.driver_id].push(t);
            });

            for (const driverId in tripsByDriver) {
                try {
                    const driverTrips = tripsByDriver[driverId];
                    const driverAdvances = pendingAdvances.filter(adv => adv.driver_id === driverId);

                    const totalGross = round2(driverTrips.reduce((sum, t) => sum + (Number(t.gross_value) || 0), 0));
                    const totalTripDiscounts = round2(driverTrips.reduce((sum, t) => sum + (Number(t.advance_value) || 0), 0));
                    const totalAdvancesApplied = round2(driverAdvances.reduce((sum, adv) => sum + (Number(adv.amount) || 0), 0));

                    const comissaoBrutaTotal = round2(driverTrips.reduce((sum, item) => {
                        const taxa = Number(item.commission_rate) || DEFAULT_COMMISSION_RATE;
                        const imposto = Number(item.tax_rate) || 0;
                        const baseCalculo = (Number(item.gross_value) || 0) * (1 - (imposto / 100));
                        return sum + (baseCalculo * (taxa / 100));
                    }, 0));

                    const netPaid = round2(Math.max(0, comissaoBrutaTotal - totalTripDiscounts - totalAdvancesApplied));

                    // 1. Criar registro de fechamento
                    await (settlementService as any).createSettlement({
                        company_id: companyId,
                        driver_id: driverId,
                        total_gross: totalGross,
                        total_trip_discounts: totalTripDiscounts,
                        total_advances_applied: totalAdvancesApplied,
                        net_paid: netPaid,
                        trips_ids: driverTrips.map(t => t.id),
                        advances_ids: driverAdvances.map(adv => adv.id),
                        status: 'paid',
                        settlement_date: new Date().toISOString()
                    });

                    // 2. Liquidar as viagens
                    await tripService.settleTrips(driverTrips.map(t => t.id));

                    // 3. Liquidar os vales aplicados
                    for (const adv of driverAdvances) {
                        await settlementService.updateAdvanceStatus(adv.id, 'settled');
                    }
                } catch (driverError: any) {
                    const driverName = settleableTrips.find(t => t.driver_id === driverId)?.driver?.name || driverId;
                    errors.push(`Motorista ${driverName}: ${driverError.message || 'erro desconhecido'}`);
                    console.error(`Error settling driver ${driverId}:`, driverError);
                }
            }

            setSelectedIds(new Set());
            fetchViagens();

            if (errors.length > 0) {
                alert(`Acerto parcialmente concluído.\n\nErros:\n${errors.join('\n')}${skipped > 0 ? `\n\n${skipped} viagem(ns) ignorada(s) por status inválido.` : ''}`);
            } else {
                alert(`Acerto realizado com sucesso!${skipped > 0 ? `\n\n${skipped} viagem(ns) ignorada(s) por já estar paga.` : ''}`);
            }
        } finally {
            setLoading(false);
        }
    };

    // CRUD Vales
    const handleSaveAdvance = async (data: any) => {
        if (!companyId) return;
        try {
            if (editingAdvance) {
                await settlementService.updateAdvance(editingAdvance.id, data);
            } else {
                await settlementService.addAdvance({ ...data, company_id: companyId });
            }
            alert('Adiantamento salvo com sucesso!');
            setIsAdvanceModalOpen(false);
            setEditingAdvance(null);
            fetchAllAdvances();
            fetchViagens(); // Refresh pending advances for settlement calc
        } catch (error: any) {
            console.error('Error saving advance:', error);
            throw error;
        }
    };

    const handleDeleteAdvance = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este adiantamento?')) return;
        try {
            await settlementService.deleteAdvance(id);
            setAllAdvances(allAdvances.filter(a => a.id !== id));
            fetchViagens(); // Refresh pending advances
        } catch (error) {
            console.error('Error deleting advance:', error);
            alert('Erro ao excluir adiantamento.');
        }
    };

    const filteredAdvances = allAdvances.filter(a =>
        a.description?.toLowerCase().includes(advanceSearch.toLowerCase()) ||
        a.driver?.name?.toLowerCase().includes(advanceSearch.toLowerCase())
    );

    return (
        <div className="flex-1 flex flex-col h-screen overflow-hidden bg-background-light dark:bg-background-dark font-display">
            <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-surface-dark px-8 flex justify-between items-center shrink-0">
                <div>
                    <h2 className="font-bold text-xl flex items-center gap-2">
                        <Wallet size={20} className="text-emerald-500" />
                        Gestão Financeira
                    </h2>
                </div>
                <button
                    onClick={() => {
                        setEditingAdvance(null);
                        setIsAdvanceModalOpen(true);
                    }}
                    className="btn-primary flex items-center gap-2 py-2 px-4 shadow-lg shadow-primary/20"
                >
                    <Plus size={20} />
                    Novo Vale / Adiantamento
                </button>
            </header>

            <div className="px-8 pt-6">
                <div className="flex border-b border-slate-200 dark:border-slate-800">
                    <button
                        onClick={() => setActiveTab('settlement')}
                        className={`px-6 py-3 text-sm font-bold transition-colors border-b-2 ${activeTab === 'settlement' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Acerto de Fretes
                    </button>
                    <button
                        onClick={() => setActiveTab('advances')}
                        className={`px-6 py-3 text-sm font-bold transition-colors border-b-2 ${activeTab === 'advances' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Gerenciar Vales
                    </button>
                </div>
            </div>

            <main className="flex-1 p-8 overflow-y-auto">
                {activeTab === 'settlement' ? (
                    <div className="flex gap-8 flex-col xl:flex-row h-full">
                        {/* Painel Central: Listagem de Fretes pra Liquidar */}
                        <div className="flex-[2] space-y-6">
                            <div className="card h-full flex flex-col">
                                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/30">
                                    <div className="relative w-64">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Buscar motorista, status ou ID..."
                                            className="input-field pl-9 py-1.5"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <div className="text-sm font-medium text-slate-500">
                                        Mostrando fretes finalizados aguardando pagamento
                                    </div>
                                </div>

                                <div className="flex-1 overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 uppercase text-xs font-semibold text-slate-400">
                                            <tr>
                                                <th className="px-6 py-4 w-12 text-center">
                                                </th>
                                                <th className="px-6 py-4">ID Frete</th>
                                                <th className="px-6 py-4">Motorista</th>
                                                <th className="px-6 py-4 text-right">Frete Bruto</th>
                                                <th className="px-6 py-4 text-right">Adiant/Despesas</th>
                                                <th className="px-6 py-4">Status Base</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                            {loading ? (
                                                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Carregando...</td></tr>
                                            ) : paginatedViagens.length > 0 ? (
                                                paginatedViagens.map(viagem => (
                                                    <tr key={viagem.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer ${viagem.status?.toLowerCase() === 'paid' ? 'opacity-50' : ''}`} onClick={() => viagem.status?.toLowerCase() !== 'paid' && handleToggleSelect(viagem.id)}>
                                                        <td className="px-6 py-4">
                                                            <input
                                                                type="checkbox"
                                                                className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300"
                                                                checked={selectedIds.has(viagem.id)}
                                                                disabled={viagem.status?.toLowerCase() === 'paid'}
                                                                onChange={() => handleToggleSelect(viagem.id)}
                                                                onClick={e => e.stopPropagation()}
                                                            />
                                                        </td>
                                                        <td className="px-6 py-4 font-mono font-medium text-xs truncate max-w-[80px]">{viagem.id.split('-')[0]}...</td>
                                                        <td className="px-6 py-4 font-bold text-sm">
                                                            {viagem.driver?.name || 'S/ Motorista'}
                                                            <span className="block text-[10px] font-normal text-slate-500">{new Date(viagem.created_at).toLocaleDateString('pt-BR')}</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-medium">R$ {(viagem.gross_value || 0).toLocaleString('pt-BR')}</td>
                                                        <td className="px-6 py-4 text-right font-medium text-rose-500">- R$ {((Number(viagem.advance_value) || 0) + (Number(viagem.estimated_cost) || 0)).toLocaleString('pt-BR')}</td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded ${viagem.status?.toLowerCase() === 'paid' || viagem.status === 'Pago' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400'}`}>
                                                                {viagem.status?.toLowerCase() === 'paid' ? 'Pago' :
                                                                 viagem.status?.toLowerCase() === 'pending' ? 'Pendente' :
                                                                 viagem.status?.toLowerCase() === 'in_transit' ? 'Em Viagem' :
                                                                 viagem.status?.toLowerCase() === 'completed' ? 'Finalizado' :
                                                                 viagem.status?.toLowerCase() === 'validated' ? 'Validado' :
                                                                 viagem.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Nada para exibir.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {settleTotalPages > 1 && (
                                    <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/30 shrink-0">
                                        <span className="text-xs text-slate-500">
                                            {filteredViagens.length} fretes — página {settleSafePage} de {settleTotalPages}
                                        </span>
                                        <div className="flex gap-1">
                                            <button onClick={() => setSettlePage(p => Math.max(1, p - 1))} disabled={settleSafePage === 1} className="px-3 py-1 text-xs font-bold rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">‹ Anterior</button>
                                            <button onClick={() => setSettlePage(p => Math.min(settleTotalPages, p + 1))} disabled={settleSafePage === settleTotalPages} className="px-3 py-1 text-xs font-bold rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Próxima ›</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Console de Liquidação Matemático */}
                        <div className="flex-1 max-w-sm">
                            <div className="card sticky top-8">
                                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                    <h3 className="font-bold text-lg mb-1">Cálculo de Fechamento</h3>
                                    <p className="text-xs text-slate-500">Cálculo de Comissão Líquida por Viagem descontando Vale/Adiantamentos e Custos.</p>
                                </div>

                                <div className="p-6 space-y-4">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500">Fretes Selecionados</span>
                                        <span className="font-bold">{settlementCalc.qty}x itens</span>
                                    </div>

                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500">Soma de Valor Bruto</span>
                                        <span className="font-bold">R$ {settlementCalc.baseSomaBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>

                                    <div className="flex justify-between items-center text-sm text-emerald-600">
                                        <span>Comissão Bruta Acumulada</span>
                                        <span className="font-bold">R$ {settlementCalc.comissaoBrutaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>

                                    <div className="flex justify-between items-center text-sm text-rose-500">
                                        <span>Descontos (Vales de Viagem)</span>
                                        <span className="font-bold">- R$ {settlementCalc.tripAdvancesAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>

                                    <div className="border-t border-slate-100 dark:border-slate-800 my-4 pt-4">
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                            Vales Pendentes Automáticos (R$)
                                        </label>
                                        <div className="space-y-2">
                                            {settlementCalc.advancesForSelected?.length > 0 ? (
                                                settlementCalc.advancesForSelected.map((adv: any) => (
                                                    <div key={adv.id} className="flex justify-between items-center text-xs bg-rose-50 dark:bg-rose-900/10 p-2 rounded">
                                                        <span className="text-slate-600 dark:text-slate-400 truncate max-w-[150px]">{adv.description || 'Vale'}</span>
                                                        <span className="font-bold text-rose-500">- R$ {Number(adv.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-[10px] text-slate-400 italic">Nenhum vale pendente para os motoristas selecionados.</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="border-t border-slate-200 dark:border-slate-700 my-4 pt-4">
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Comissão a Pagar Líquida</span>
                                                <span className="flex items-center text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold w-fit">Taxa Variável (Abatendo Vale)</span>
                                            </div>
                                            <span className="text-3xl font-black text-emerald-500">
                                                R$ {Math.max(0, settlementCalc.comissaoPagar).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>

                                    {settlementCalc.qty > 0 && settlementCalc.totalVales > settlementCalc.comissaoBrutaTotal && (
                                        <div className="flex items-start gap-2 p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-sm rounded-lg mt-4">
                                            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                            <p><strong>Atenção:</strong> Vales ultrapassam a comissão bruta. Saldo devedor para o próximo acerto.</p>
                                        </div>
                                    )}

                                    <button
                                        onClick={executePaymentBatch}
                                        disabled={settlementCalc.qty === 0}
                                        className="w-full mt-6 btn-primary flex items-center justify-center gap-2 py-4 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none transition-all disabled:cursor-not-allowed text-lg"
                                    >
                                        <CheckCircle size={20} />
                                        Efetuar Pagamento
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="card overflow-hidden">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/30">
                            <div className="relative w-64">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar vales..."
                                    className="input-field pl-9 py-1.5"
                                    value={advanceSearch}
                                    onChange={(e) => setAdvanceSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 uppercase text-xs font-semibold text-slate-400">
                                    <tr>
                                        <th className="px-6 py-4">Data</th>
                                        <th className="px-6 py-4">Motorista</th>
                                        <th className="px-6 py-4">Descrição</th>
                                        <th className="px-6 py-4">Valor</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                    {filteredAdvances.length > 0 ? (
                                        filteredAdvances.map(adv => (
                                            <tr key={adv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                                <td className="px-6 py-4 text-sm text-slate-500">
                                                    {new Date(adv.date).toLocaleDateString('pt-BR')}
                                                </td>
                                                <td className="px-6 py-4 font-bold text-sm">
                                                    {adv.driver?.name}
                                                </td>
                                                <td className="px-6 py-4 text-sm">
                                                    {adv.description}
                                                </td>
                                                <td className="px-6 py-4 font-bold text-rose-500">
                                                    R$ {Number(adv.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded ${adv.status === 'settled' || adv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                                        }`}>
                                                        {adv.status === 'settled' ? 'Pago' : 'Pendente'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setEditingAdvance(adv);
                                                                setIsAdvanceModalOpen(true);
                                                            }}
                                                            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteAdvance(adv.id)}
                                                            className="p-2 hover:bg-rose-50 rounded-full text-slate-400 hover:text-rose-500"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-8 text-center text-slate-500">Nenhum vale encontrado.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>

            <AddAdvanceModal
                isOpen={isAdvanceModalOpen}
                onClose={() => {
                    setIsAdvanceModalOpen(false);
                    setEditingAdvance(null);
                }}
                drivers={drivers}
                onSave={handleSaveAdvance}
                initialData={editingAdvance}
            />
        </div>
    )
}
