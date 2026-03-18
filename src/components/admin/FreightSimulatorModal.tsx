import { useState, useEffect } from 'react';
import { X, Calculator, DollarSign, Fuel, Navigation, Percent, Info, Send, Disc } from 'lucide-react';

interface FreightSimulatorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLaunch: (simulationData: any) => void;
}

export default function FreightSimulatorModal({ isOpen, onClose, onLaunch }: FreightSimulatorModalProps) {
    const [formData, setFormData] = useState({
        distance: '',
        consumption: '2.5',
        dieselPrice: '6.15',
        tolls: '',
        otherExpenses: '',
        driverCommission: '10', // Percentual
        desiredMargin: '20', // Percentual de lucro
        weight: '1000' // Peso em Kg
    });

    const [results, setResults] = useState({
        fuelCost: 0,
        driverCost: 0,
        totalCost: 0,
        suggestedFreight: 0,
        profit: 0,
        freightPerKg: 0
    });

    useEffect(() => {
        const dist = parseFloat(formData.distance) || 0;
        const cons = parseFloat(formData.consumption) || 1;
        const price = parseFloat(formData.dieselPrice) || 0;
        const tolls = parseFloat(formData.tolls) || 0;
        const other = parseFloat(formData.otherExpenses) || 0;
        const commP = parseFloat(formData.driverCommission) || 0;
        const marginP = parseFloat(formData.desiredMargin) || 0;
        const weight = parseFloat(formData.weight) || 1;

        const fuelCost = (dist / cons) * price;
        const baseCost = fuelCost + tolls + other;
        
        const estimatedDriver = (baseCost * (commP / 100)) / (1 - (commP / 100));
        const totalCost = baseCost + estimatedDriver;
        
        const suggested = totalCost / (1 - (marginP / 100));
        const profit = suggested - totalCost;
        const perKg = suggested / weight;

        setResults({
            fuelCost,
            driverCost: estimatedDriver,
            totalCost,
            suggestedFreight: suggested,
            profit,
            freightPerKg: perKg
        });
    }, [formData]);

    if (!isOpen) return null;

    const labelStyle = "text-[10px] font-black text-[#8B95B1] uppercase tracking-widest ml-1 mb-1.5 flex items-end h-[40px]";
    const inputStyle = "w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300 appearance-none";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in duration-200 border border-slate-100">
                {/* Header */}
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                            <Calculator size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-[#0F172A] tracking-tight">Simulador de Fretes</h2>
                            <p className="text-sm text-slate-500 mt-0.5">Calcule custos e projete seu lucro em segundos.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-2xl text-slate-400 transition-all border border-slate-100">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        {/* Formulário */}
                        <div className="space-y-8">
                            {/* Grupo 1: Viagem e Carga */}
                            <div className="space-y-4">
                                <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <div className="w-1 h-3 bg-blue-500 rounded-full"></div>
                                    Viagem e Carga
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                                    <div className="space-y-1">
                                        <label className={labelStyle}>Distância (KM)</label>
                                        <div className="relative">
                                            <Navigation size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="number"
                                                className={`${inputStyle} pl-11`}
                                                placeholder="0 km"
                                                value={formData.distance}
                                                onChange={e => setFormData({ ...formData, distance: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className={labelStyle}>Média Consumo (KM/L)</label>
                                        <div className="relative">
                                            <Fuel size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="number"
                                                step="0.01"
                                                className={`${inputStyle} pl-11`}
                                                placeholder="2.50"
                                                value={formData.consumption}
                                                onChange={e => setFormData({ ...formData, consumption: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className={labelStyle}>Peso da Carga (Kg)</label>
                                        <div className="relative">
                                            <Disc size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="number"
                                                step="0.01"
                                                className={`${inputStyle} pl-11`}
                                                placeholder="1000"
                                                value={formData.weight}
                                                onChange={e => setFormData({ ...formData, weight: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Grupo 2: Custos e Operação */}
                            <div className="space-y-4">
                                <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <div className="w-1 h-3 bg-blue-500 rounded-full"></div>
                                    Custos e Operação
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                                    <div className="space-y-1">
                                        <label className={labelStyle}>Preço Diesel (R$)</label>
                                        <div className="relative">
                                            <Fuel size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="number"
                                                step="0.01"
                                                className={`${inputStyle} pl-11`}
                                                placeholder="6.15"
                                                value={formData.dieselPrice}
                                                onChange={e => setFormData({ ...formData, dieselPrice: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className={labelStyle}>Pedágios (R$)</label>
                                        <div className="relative">
                                            <Info size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="number"
                                                step="0.01"
                                                className={`${inputStyle} pl-11`}
                                                placeholder="0.00"
                                                value={formData.tolls}
                                                onChange={e => setFormData({ ...formData, tolls: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className={labelStyle}>Outros Custos (R$)</label>
                                        <div className="relative">
                                            <Calculator size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="number"
                                                step="0.01"
                                                className={`${inputStyle} pl-11`}
                                                placeholder="0.00"
                                                value={formData.otherExpenses}
                                                onChange={e => setFormData({ ...formData, otherExpenses: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Grupo 3: Financeiro */}
                            <div className="space-y-4">
                                <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <div className="w-1 h-3 bg-blue-500 rounded-full"></div>
                                    Financeiro
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                                    <div className="space-y-1">
                                        <label className={labelStyle}>Comissão Mot. (%)</label>
                                        <div className="relative">
                                            <Percent size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="number"
                                                step="0.01"
                                                className={`${inputStyle} pl-11`}
                                                placeholder="10%"
                                                value={formData.driverCommission}
                                                onChange={e => setFormData({ ...formData, driverCommission: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className={labelStyle}>Margem Desejada (%)</label>
                                        <div className="relative">
                                            <TrendingUp size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="number"
                                                className={`${inputStyle} pl-11`}
                                                placeholder="20%"
                                                value={formData.desiredMargin}
                                                onChange={e => setFormData({ ...formData, desiredMargin: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Resultados */}
                        <div className="bg-slate-50 dark:bg-slate-900/40 rounded-[2rem] p-8 border border-slate-100 flex flex-col justify-between">
                            <div className="space-y-6">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest text-left">Projeção Resultado</h3>
                                
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center py-2 border-b border-slate-200/50">
                                        <span className="text-slate-500 text-sm">Custo Diesel</span>
                                        <span className="font-bold text-slate-900">R$ {results.fuelCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-slate-200/50">
                                        <span className="text-slate-500 text-sm">Custo Motorista (Est.)</span>
                                        <span className="font-bold text-slate-900">R$ {results.driverCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-slate-200/50">
                                        <span className="text-slate-500 text-sm">Custo Operacional Total</span>
                                        <span className="font-bold text-slate-900">R$ {results.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-slate-200/50">
                                        <span className="text-slate-500 text-sm">Frete Sugerido / Kg</span>
                                        <span className="font-bold text-blue-600">R$ {results.freightPerKg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                </div>

                                <div className="mt-8 p-6 bg-blue-600 rounded-2xl text-white shadow-xl shadow-blue-500/20 text-left">
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Sugestão de Frete Mínimo</p>
                                    <h4 className="text-4xl font-black mt-1">
                                        R$ {results.suggestedFreight.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </h4>
                                    <div className="mt-4 flex items-center gap-2 text-blue-100 text-sm">
                                        <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                                        <span>Lucro Estimado: <strong>R$ {results.profit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 flex gap-4">
                                <button 
                                    onClick={() => onLaunch({
                                        ...formData,
                                        ...results
                                    })}
                                    className="flex-1 bg-slate-900 text-white p-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-black transition-all shadow-lg"
                                >
                                    <Send size={18} /> Lançar no Sistema
                                </button>
                                <button 
                                    onClick={onClose}
                                    className="px-6 bg-white text-slate-600 border border-slate-200 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all"
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Re-using TrendingUp for margin indicator
function TrendingUp({ size, className }: { size: number, className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>;
}
