import { useState } from 'react';
import { X, ArrowRightLeft, Loader2 } from 'lucide-react';
import { conjuntoHistoryService } from '../../lib/services';
import { useAuth } from '../../context/AuthContext';

interface SwapConjuntoModalProps {
    isOpen: boolean;
    onClose: () => void;
    vehicle: any; // veículo (cavalo) atual
    onSuccess: () => void;
}

export default function SwapConjuntoModal({ isOpen, onClose, vehicle, onSuccess }: SwapConjuntoModalProps) {
    const { user } = useAuth();
    const companyId = (user as any)?.company_id;
    const today = new Date().toISOString().split('T')[0];

    const [newPlate1, setNewPlate1] = useState('');
    const [newPlate2, setNewPlate2] = useState('');
    const [swapDate, setSwapDate] = useState(today);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen || !vehicle) return null;

    const labelStyle = "text-[10px] font-black text-[#8B95B1] uppercase tracking-widest ml-1 mb-1.5 block";
    const inputStyle = "w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300 appearance-none";

    const handleSave = async () => {
        if (!swapDate) { alert('Informe a data da troca.'); return; }
        setLoading(true);
        try {
            await conjuntoHistoryService.swapConjunto(
                vehicle.id,
                companyId,
                newPlate1.trim().toUpperCase() || null,
                newPlate2.trim().toUpperCase() || null,
                swapDate,
                notes.trim()
            );
            onSuccess();
            onClose();
        } catch (err: any) {
            alert(`Erro ao registrar troca: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                            <ArrowRightLeft size={20} className="text-amber-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-[#0F172A]">Trocar Conjunto</h2>
                            <p className="text-xs text-slate-500 font-medium">Cavalo: <span className="font-black text-slate-700">{vehicle.plate}</span></p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-50 rounded-xl text-slate-400 transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Conjunto atual */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Conjunto Atual</p>
                        <div className="flex gap-4">
                            <div>
                                <span className="text-[10px] text-slate-500 font-bold uppercase">Implemento 1</span>
                                <p className="font-black text-slate-800 font-mono">{vehicle.implement_plate_1 || '—'}</p>
                            </div>
                            {vehicle.implement_plate_2 && (
                                <div>
                                    <span className="text-[10px] text-slate-500 font-bold uppercase">Implemento 2</span>
                                    <p className="font-black text-slate-800 font-mono">{vehicle.implement_plate_2}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Seta de troca */}
                    <div className="flex items-center justify-center">
                        <div className="flex items-center gap-2 text-amber-500 font-black text-xs uppercase tracking-widest">
                            <ArrowRightLeft size={16} />
                            Novo Conjunto
                        </div>
                    </div>

                    {/* Novos implementos */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelStyle}>Implemento 1 (Placa)</label>
                            <input
                                type="text"
                                className={inputStyle}
                                placeholder="ABC-1234"
                                value={newPlate1}
                                onChange={e => setNewPlate1(e.target.value.toUpperCase())}
                                maxLength={8}
                            />
                        </div>
                        <div>
                            <label className={labelStyle}>Implemento 2 (Placa)</label>
                            <input
                                type="text"
                                className={inputStyle}
                                placeholder="DEF-5678 (opcional)"
                                value={newPlate2}
                                onChange={e => setNewPlate2(e.target.value.toUpperCase())}
                                maxLength={8}
                            />
                        </div>
                    </div>

                    {/* Data da troca */}
                    <div>
                        <label className={labelStyle}>Data da Troca</label>
                        <input
                            type="date"
                            className={inputStyle}
                            value={swapDate}
                            onChange={e => setSwapDate(e.target.value)}
                        />
                    </div>

                    {/* Observações */}
                    <div>
                        <label className={labelStyle}>Observações (opcional)</label>
                        <textarea
                            className={`${inputStyle} resize-none`}
                            rows={3}
                            placeholder="Ex: Cavalo realocado para novo conjunto após manutenção da carreta antiga."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-6 py-2.5 rounded-xl text-sm font-black bg-amber-500 hover:bg-amber-600 text-white transition-all flex items-center gap-2 disabled:opacity-60"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRightLeft size={16} />}
                        Confirmar Troca
                    </button>
                </div>
            </div>
        </div>
    );
}
