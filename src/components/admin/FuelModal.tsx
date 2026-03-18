import { X } from 'lucide-react';
import { useState, useEffect } from 'react';

interface FuelModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => void;
    vehicles: any[];
    drivers: any[];
    suppliers: any[];
    initialData?: any;
}

export default function FuelModal({ isOpen, onClose, onSave, vehicles, drivers, suppliers, initialData }: FuelModalProps) {
    const [formData, setFormData] = useState({
        vehicle_id: '',
        driver_id: '',
        supplier_id: '',
        km_reading: '',
        liters: '',
        price_per_liter: '',
        total_value: '',
        fuel_type: 'Diesel',
        location: '',
        date: new Date().toISOString().split('T')[0]
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData({
                vehicle_id: initialData.vehicle_id || '',
                driver_id: initialData.driver_id || '',
                supplier_id: initialData.supplier_id || '',
                km_reading: (initialData.km_reading || initialData.odometer)?.toString() || '',
                liters: initialData.liters?.toString() || '',
                price_per_liter: initialData.price_per_liter?.toString() || '',
                total_value: initialData.total_value?.toString() || '',
                fuel_type: initialData.fuel_type || 'Diesel',
                location: initialData.location || '',
                date: initialData.created_at ? new Date(initialData.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
            });
        } else {
            setFormData({
                vehicle_id: '',
                driver_id: '',
                supplier_id: '',
                km_reading: '',
                liters: '',
                price_per_liter: '',
                total_value: '',
                fuel_type: 'Diesel',
                location: '',
                date: new Date().toISOString().split('T')[0]
            });
        }
    }, [initialData, isOpen]);

    useEffect(() => {
        const liters = parseFloat(formData.liters);
        const price = parseFloat(formData.price_per_liter);
        if (!isNaN(liters) && !isNaN(price)) {
            setFormData(prev => ({ ...prev, total_value: (liters * price).toFixed(2) }));
        }
    }, [formData.liters, formData.price_per_liter]);

    if (!isOpen) return null;

    const labelStyle = "text-[10px] font-black text-[#8B95B1] uppercase tracking-widest ml-1 mb-1.5 block";
    const inputStyle = "w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300 appearance-none";

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            onSave(formData);
            onClose();
        } catch (error) {
            console.error('Error saving fuel record:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-y-auto max-h-[95vh] animate-in zoom-in duration-200 custom-scrollbar border-none">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h2 className="text-xl font-bold text-[#0F172A]">
                        {initialData ? 'Editar Abastecimento' : 'Novo Abastecimento'}
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-50 rounded-xl text-slate-400 transition-all">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>Veículo</label>
                            <select
                                required
                                value={formData.vehicle_id}
                                onChange={(e) => {
                                    const vId = e.target.value;
                                    const vehicle = vehicles.find(v => v.id === vId);
                                    setFormData({ 
                                        ...formData, 
                                        vehicle_id: vId,
                                        km_reading: vehicle?.current_km?.toString() || ''
                                    });
                                }}
                                className={inputStyle}
                            >
                                <option value="">Selecionar Veículo</option>
                                {vehicles.map(v => (
                                    <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className={labelStyle}>Motorista</label>
                            <select
                                required
                                value={formData.driver_id}
                                onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
                                className={inputStyle}
                            >
                                <option value="">Selecionar Motorista</option>
                                {drivers.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className={labelStyle}>Fornecedor (Posto)</label>
                            <select
                                value={formData.supplier_id}
                                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                                className={inputStyle}
                            >
                                <option value="">Selecionar Fornecedor</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className={labelStyle}>Data</label>
                            <input
                                type="date"
                                required
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                className={inputStyle}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>Cidade/Local</label>
                            <input
                                required
                                className={inputStyle}
                                placeholder="Ex: Posto Graal, São Paulo"
                                value={formData.location}
                                onChange={e => setFormData({ ...formData, location: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>KM Atual</label>
                            <input
                                required
                                type="number"
                                className={inputStyle}
                                placeholder="0"
                                value={formData.km_reading}
                                onChange={e => setFormData({ ...formData, km_reading: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <label className={labelStyle}>Litros</label>
                            <input
                                required
                                type="number"
                                step="0.01"
                                className={inputStyle}
                                placeholder="0,00"
                                value={formData.liters}
                                onChange={e => setFormData({ ...formData, liters: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>Preço/Litro (R$)</label>
                            <input
                                required
                                type="number"
                                step="0.001"
                                className={inputStyle}
                                placeholder="0,000"
                                value={formData.price_per_liter}
                                onChange={e => setFormData({ ...formData, price_per_liter: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className={labelStyle}>Valor Total (R$)</label>
                            <input
                                required
                                type="number"
                                step="0.01"
                                className={`${inputStyle} bg-slate-50 font-bold border-blue-100 text-blue-600 cursor-not-allowed`}
                                placeholder="Calculado..."
                                value={formData.total_value}
                                onChange={e => setFormData({ ...formData, total_value: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="flex gap-4 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 rounded-xl font-bold text-xs uppercase text-slate-700 border border-slate-200 hover:bg-slate-50 transition-all outline-none"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 bg-[#2563EB] text-white px-6 py-3 rounded-xl font-bold text-xs uppercase hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50"
                        >
                            {loading ? 'Salvando...' : 'Salvar Abastecimento'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
