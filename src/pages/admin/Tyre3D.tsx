import {
    Activity,
    ArrowRight,
    ChevronRight,
    History,
    Thermometer,
    Gauge,
    Info,
    ArrowUpCircle
} from 'lucide-react';
import { useState } from 'react';

export default function Tyre3D() {
    const [selectedTyre, setSelectedTyre] = useState<number | null>(1);

    const tyreData = [
        { id: 1, pos: 'D-1 (Frontal Esq)', pressure: '110 PSI', temp: '42°C', depth: '6.2mm', status: 'excelente' },
        { id: 2, pos: 'D-2 (Frontal Dir)', pressure: '108 PSI', temp: '41°C', depth: '5.8mm', status: 'excelente' },
        { id: 3, pos: 'T-1 (Tras. Ext. Esq)', pressure: '95 PSI', temp: '52°C', depth: '1.4mm', status: 'crítico' },
        { id: 4, pos: 'T-2 (Tras. Int. Esq)', pressure: '98 PSI', temp: '50°C', depth: '1.8mm', status: 'atenção' },
        { id: 5, pos: 'T-3 (Tras. Int. Dir)', pressure: '102 PSI', temp: '48°C', depth: '2.1mm', status: 'excelente' },
        { id: 6, pos: 'T-4 (Tras. Ext. Dir)', pressure: '101 PSI', temp: '49°C', depth: '2.4mm', status: 'excelente' },
    ];

    const currentTyre = tyreData.find(t => t.id === selectedTyre) || tyreData[0];

    return (
        <div className="space-y-8 pb-12 font-display">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-white">Monitoramento de Pneus 3D</h1>
                    <p className="text-slate-400 mt-1 uppercase text-xs font-bold tracking-widest leading-none">Veículo: ABC-1234 • Bitrem 9 Eixos</p>
                </div>
                <div className="flex gap-4">
                    <div className="bg-[#161B26] border border-white/5 rounded-2xl px-5 py-2 flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-sm font-black text-slate-300">Sensores Online</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* 3D Viewport Simulation */}
                <div className="lg:col-span-2 bg-gradient-to-b from-[#161B26] to-[#0B0F17] rounded-[3rem] border border-white/10 relative h-[600px] overflow-hidden group">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>

                    {/* Perspective Guide Lines */}
                    <div className="absolute inset-0 opacity-20 pointer-events-none">
                        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-primary-500/50 shadow-[0_0_15px_rgba(37,99,235,0.5)]"></div>
                        <div className="absolute top-0 left-1/2 w-[1px] h-full bg-primary-500/20"></div>
                    </div>

                    {/* Truck Silhouette / Chassis Visualization */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-[450px] h-[300px] border-x-[1px] border-slate-700/50 skew-y-12 flex flex-col justify-between p-4">
                            <div className="h-2 w-full bg-slate-800/50 rounded-full blur-sm"></div>
                            <div className="h-6 w-full bg-slate-800/80 rounded-full blur-md"></div>
                        </div>
                    </div>

                    {/* Interactive Tyre Nodes */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative w-[500px] h-[300px]">
                            {/* Front Left */}
                            <TyreNode id={1} x="10%" y="20%" status="optimal" selected={selectedTyre === 1} onClick={() => setSelectedTyre(1)} label="FL" />
                            {/* Front Right */}
                            <TyreNode id={2} x="80%" y="20%" status="optimal" selected={selectedTyre === 2} onClick={() => setSelectedTyre(2)} label="FR" />

                            {/* Rear Bogie L */}
                            <TyreNode id={3} x="15%" y="70%" status="critical" selected={selectedTyre === 3} onClick={() => setSelectedTyre(3)} label="RO" />
                            <TyreNode id={4} x="20%" y="65%" status="warning" selected={selectedTyre === 4} onClick={() => setSelectedTyre(4)} label="RI" />

                            {/* Rear Bogie R */}
                            <TyreNode id={5} x="75%" y="65%" status="optimal" selected={selectedTyre === 5} onClick={() => setSelectedTyre(5)} label="RI" />
                            <TyreNode id={6} x="80%" y="70%" status="optimal" selected={selectedTyre === 6} onClick={() => setSelectedTyre(6)} label="RO" />
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="absolute bottom-8 left-8 flex gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                            <span className="text-[10px] font-black uppercase text-slate-400">Excelente</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                            <span className="text-[10px] font-black uppercase text-slate-400">Atenção</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.7)] animate-pulse"></div>
                            <span className="text-[10px] font-black uppercase text-slate-400">Crítico</span>
                        </div>
                    </div>

                    {/* Overlay Tip */}
                    <div className="absolute top-8 left-8 bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl border border-white/5 flex items-center gap-2">
                        <Info size={14} className="text-primary-400" />
                        <span className="text-xs font-bold text-slate-300 italic">Interaja com os sensores para ver detalhes</span>
                    </div>
                </div>

                {/* Info Sidebar */}
                <div className="space-y-6">
                    {/* Selected Tyre Detail */}
                    <div className="bg-[#161B26] p-8 rounded-[3rem] border border-white/10 shadow-2xl relative overflow-hidden">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-xl font-black text-white">{currentTyre.pos}</h3>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Sensor ID: TPR-99{currentTyre.id}</p>
                            </div>
                            <div className={`p-3 rounded-2xl ${currentTyre.status === 'crítico' ? 'bg-rose-500/10 text-rose-500' :
                                currentTyre.status === 'atenção' ? 'bg-amber-500/10 text-amber-500' :
                                    'bg-emerald-500/10 text-emerald-500'
                                }`}>
                                <Activity size={24} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-[#0B0F17] p-4 rounded-2xl border border-white/5">
                                <p className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1 mb-2">
                                    <Gauge size={12} className="text-sky-500" /> Pressão
                                </p>
                                <p className="text-xl font-black text-white italic">{currentTyre.pressure}</p>
                            </div>
                            <div className="bg-[#0B0F17] p-4 rounded-2xl border border-white/5">
                                <p className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1 mb-2">
                                    <Thermometer size={12} className="text-rose-500" /> Temp.
                                </p>
                                <p className="text-xl font-black text-white italic">{currentTyre.temp}</p>
                            </div>
                        </div>

                        <div className="mt-6 p-4 rounded-2xl border border-white/5 bg-[#0B0F17]">
                            <div className="flex justify-between items-center mb-2">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sulco Atual</p>
                                <span className="font-black text-white italic">{currentTyre.depth}</span>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ${currentTyre.status === 'crítico' ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]' :
                                        currentTyre.status === 'atenção' ? 'bg-amber-500' : 'bg-emerald-500'
                                        }`}
                                    style={{ width: `${(parseFloat(currentTyre.depth) / 8) * 100}%` }}
                                ></div>
                            </div>
                        </div>

                        {currentTyre.status === 'crítico' && (
                            <button className="w-full mt-8 bg-rose-600 hover:bg-rose-500 text-white py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-[0_10px_20px_-5px_rgba(244,63,94,0.4)]">
                                Solicit. Troca Imediata
                                <ArrowRight size={18} />
                            </button>
                        )}
                    </div>

                    {/* Fleet History Mini */}
                    <div className="bg-[#161B26] p-8 rounded-[2.5rem] border border-white/5">
                        <div className="flex items-center justify-between mb-6">
                            <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <History size={16} className="text-primary-500" /> Histórico Radar
                            </h4>
                            <ChevronRight size={16} className="text-slate-600" />
                        </div>
                        <div className="space-y-4">
                            {[
                                { truck: 'ABC-1234', action: 'Giro de Pneus', time: '12h ago', icon: <ArrowUpCircle size={14} className="text-sky-500" /> },
                                { truck: 'DEF-5678', action: 'Recalibragem', time: '1d ago', icon: <Gauge size={14} className="text-emerald-500" /> },
                            ].map((log, i) => (
                                <div key={i} className="flex items-center justify-between group cursor-pointer">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                                            {log.icon}
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-white">{log.action}</p>
                                            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{log.truck}</p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-black text-slate-600">{log.time}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function TyreNode({ x, y, status, selected, onClick, label }: any) {
    const statusColor =
        status === 'crítico' ? 'bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.8)]' :
            status === 'atenção' ? 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.6)]' :
                'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]';

    return (
        <div
            className={`absolute w-12 h-20 rounded-xl transition-all duration-500 cursor-pointer group flex items-center justify-center flex-col gap-1 -translate-x-1/2 -translate-y-1/2 hover:scale-110 ${selected ? 'border-2 border-primary-500 ring-4 ring-primary-500/20' : 'border border-white/10'
                }`}
            style={{ left: x, top: y, background: 'rgba(255,255,255,0.05)', perspective: '1000px', transform: `translate(-50%, -50%) rotateY(${selected ? '0deg' : '45deg'})` }}
            onClick={onClick}
        >
            <span className={`w-3 h-3 rounded-full ${statusColor} mb-2 ${status === 'crítico' ? 'animate-pulse' : ''}`}></span>
            <span className="text-[8px] font-black text-slate-500 uppercase">{label}</span>
            {selected && <div className="absolute -bottom-8 bg-primary-600 text-white text-[10px] font-black px-2 py-0.5 rounded italic whitespace-nowrap">SELECIONADO</div>}
        </div>
    );
}
