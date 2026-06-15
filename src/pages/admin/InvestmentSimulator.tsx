import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { simulationService } from '../../lib/financial.services';
import { Calculator, Truck, Users, Route, Save, Trash2, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

const fmt = (v: number) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const n = (v: string) => parseFloat(v) || 0;

const SIM_TYPES = [
    { id: 'truck', label: 'Compra de Caminhão', icon: Truck, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'driver', label: 'Contratação de Motorista', icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
    { id: 'freight', label: 'Novo Contrato de Frete', icon: Route, color: 'text-green-600', bg: 'bg-green-50' },
];

function Field({ label, value, onChange, type = 'number', placeholder = '', suffix = '' }: any) {
    return (
        <label className="block">
            <span className="text-xs font-medium text-slate-600">{label}</span>
            <div className="mt-1 relative">
                <input type={type} step="0.01" min="0" value={value} onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm pr-10" />
                {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{suffix}</span>}
            </div>
        </label>
    );
}

function ResultCard({ label, value, highlight = false, positive = true }: any) {
    return (
        <div className={`rounded-xl p-3 ${highlight ? (positive ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200') : 'bg-slate-50'}`}>
            <p className="text-xs text-slate-500 font-medium">{label}</p>
            <p className={`text-base font-bold mt-0.5 ${highlight ? (positive ? 'text-green-700' : 'text-red-700') : 'text-slate-800'}`}>{value}</p>
        </div>
    );
}

// ── Simulador Caminhão ───────────────────────────────────────────────────────
function TruckSimulator({ onResult }: { onResult: (r: any, p: any) => void }) {
    const [p, setP] = useState({
        truckPrice: '', downPayment: '', installments: '60', interestRate: '1.5',
        expectedRevenuePerMonth: '', fuelCostPerMonth: '', maintenanceCostPerMonth: '',
        driverCostPerMonth: '', otherCostsPerMonth: ''
    });
    const [result, setResult] = useState<any>(null);

    const calculate = () => {
        const params = {
            truckPrice: n(p.truckPrice), downPayment: n(p.downPayment),
            installments: n(p.installments), interestRate: n(p.interestRate),
            expectedRevenuePerMonth: n(p.expectedRevenuePerMonth),
            fuelCostPerMonth: n(p.fuelCostPerMonth),
            maintenanceCostPerMonth: n(p.maintenanceCostPerMonth),
            driverCostPerMonth: n(p.driverCostPerMonth),
            otherCostsPerMonth: n(p.otherCostsPerMonth)
        };
        const r = simulationService.simulateTruck(params);
        setResult(r);
        onResult(r, params);
    };

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
                <Field label="Valor do Caminhão (R$)" value={p.truckPrice} onChange={(v: string) => setP(f => ({ ...f, truckPrice: v }))} />
                <Field label="Entrada (R$)" value={p.downPayment} onChange={(v: string) => setP(f => ({ ...f, downPayment: v }))} />
                <Field label="Parcelas" value={p.installments} onChange={(v: string) => setP(f => ({ ...f, installments: v }))} />
                <Field label="Juros (% a.m.)" value={p.interestRate} onChange={(v: string) => setP(f => ({ ...f, interestRate: v }))} suffix="%" />
                <Field label="Receita esperada/mês (R$)" value={p.expectedRevenuePerMonth} onChange={(v: string) => setP(f => ({ ...f, expectedRevenuePerMonth: v }))} />
                <Field label="Custo combustível/mês (R$)" value={p.fuelCostPerMonth} onChange={(v: string) => setP(f => ({ ...f, fuelCostPerMonth: v }))} />
                <Field label="Custo manutenção/mês (R$)" value={p.maintenanceCostPerMonth} onChange={(v: string) => setP(f => ({ ...f, maintenanceCostPerMonth: v }))} />
                <Field label="Custo motorista/mês (R$)" value={p.driverCostPerMonth} onChange={(v: string) => setP(f => ({ ...f, driverCostPerMonth: v }))} />
                <Field label="Outros custos/mês (R$)" value={p.otherCostsPerMonth} onChange={(v: string) => setP(f => ({ ...f, otherCostsPerMonth: v }))} />
            </div>
            <button onClick={calculate}
                className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                <Calculator size={16} /> Calcular
            </button>
            {result && (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <ResultCard label="Parcela Mensal" value={fmt(result.installmentValue)} />
                        <ResultCard label="Custo Total/mês" value={fmt(result.totalMonthlyCost)} />
                        <ResultCard label="Lucro Líquido/mês" value={fmt(result.monthlyProfit)} highlight positive={result.monthlyProfit >= 0} />
                        <ResultCard label="Margem" value={`${result.margin.toFixed(1)}%`} />
                        <ResultCard label="ROI Anual" value={`${result.annualROI.toFixed(1)}%`} />
                        <ResultCard label="Receita Mínima" value={fmt(result.minRevenue)} />
                        {result.breakEvenMonths && <ResultCard label="Break-even (entrada)" value={`${result.breakEvenMonths} meses`} />}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Simulador Motorista ──────────────────────────────────────────────────────
function DriverSimulator({ onResult }: { onResult: (r: any, p: any) => void }) {
    const [p, setP] = useState({
        monthlySalary: '', commission: '', benefits: '',
        expectedExtraRevenue: '', currentCapacityUsed: '70'
    });
    const [result, setResult] = useState<any>(null);

    const calculate = () => {
        const params = {
            monthlySalary: n(p.monthlySalary), commission: n(p.commission),
            benefits: n(p.benefits), expectedExtraRevenue: n(p.expectedExtraRevenue),
            currentCapacityUsed: n(p.currentCapacityUsed)
        };
        const r = simulationService.simulateDriver(params);
        setResult(r); onResult(r, params);
    };

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
                <Field label="Salário base/mês (R$)" value={p.monthlySalary} onChange={(v: string) => setP(f => ({ ...f, monthlySalary: v }))} />
                <Field label="Comissão estimada/mês (R$)" value={p.commission} onChange={(v: string) => setP(f => ({ ...f, commission: v }))} />
                <Field label="Benefícios/mês (R$)" value={p.benefits} onChange={(v: string) => setP(f => ({ ...f, benefits: v }))} placeholder="VT, VR, plano..." />
                <Field label="Receita adicional esperada/mês (R$)" value={p.expectedExtraRevenue} onChange={(v: string) => setP(f => ({ ...f, expectedExtraRevenue: v }))} />
                <Field label="Capacidade atual usada (%)" value={p.currentCapacityUsed} onChange={(v: string) => setP(f => ({ ...f, currentCapacityUsed: v }))} suffix="%" />
            </div>
            <button onClick={calculate}
                className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                <Calculator size={16} /> Calcular
            </button>
            {result && (
                <div className="grid grid-cols-2 gap-2">
                    <ResultCard label="Custo Total/mês" value={fmt(result.totalCost)} />
                    <ResultCard label="Receita Adicional" value={fmt(n(p.expectedExtraRevenue))} />
                    <ResultCard label="Ganho Líquido/mês" value={fmt(result.netGain)} highlight positive={result.netGain >= 0} />
                    <ResultCard label="Comprometimento" value={`${result.breakEven.toFixed(1)}%`} />
                </div>
            )}
        </div>
    );
}

// ── Simulador Frete ──────────────────────────────────────────────────────────
function FreightSimulator({ onResult }: { onResult: (r: any, p: any) => void }) {
    const [p, setP] = useState({
        freightValue: '', distanceKm: '', fuelConsumption: '2.5',
        fuelPrice: '6.50', tollCost: '', driverCommission: '12',
        otherCosts: '', taxRate: '6'
    });
    const [result, setResult] = useState<any>(null);

    const calculate = () => {
        const params = {
            freightValue: n(p.freightValue), distanceKm: n(p.distanceKm),
            fuelConsumption: n(p.fuelConsumption), fuelPrice: n(p.fuelPrice),
            tollCost: n(p.tollCost), driverCommission: n(p.driverCommission),
            otherCosts: n(p.otherCosts), taxRate: n(p.taxRate)
        };
        const r = simulationService.simulateFreight(params);
        setResult(r); onResult(r, params);
    };

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
                <Field label="Valor do frete (R$)" value={p.freightValue} onChange={(v: string) => setP(f => ({ ...f, freightValue: v }))} />
                <Field label="Distância (km)" value={p.distanceKm} onChange={(v: string) => setP(f => ({ ...f, distanceKm: v }))} suffix="km" />
                <Field label="Consumo (km/L)" value={p.fuelConsumption} onChange={(v: string) => setP(f => ({ ...f, fuelConsumption: v }))} suffix="km/L" />
                <Field label="Preço combustível (R$/L)" value={p.fuelPrice} onChange={(v: string) => setP(f => ({ ...f, fuelPrice: v }))} />
                <Field label="Pedágio (R$)" value={p.tollCost} onChange={(v: string) => setP(f => ({ ...f, tollCost: v }))} />
                <Field label="Comissão motorista (%)" value={p.driverCommission} onChange={(v: string) => setP(f => ({ ...f, driverCommission: v }))} suffix="%" />
                <Field label="Outros custos (R$)" value={p.otherCosts} onChange={(v: string) => setP(f => ({ ...f, otherCosts: v }))} />
                <Field label="Imposto (%)" value={p.taxRate} onChange={(v: string) => setP(f => ({ ...f, taxRate: v }))} suffix="%" />
            </div>
            <button onClick={calculate}
                className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                <Calculator size={16} /> Calcular
            </button>
            {result && (
                <div className="grid grid-cols-2 gap-2">
                    <ResultCard label="Combustível" value={fmt(result.fuelCost)} />
                    <ResultCard label="Comissão" value={fmt(result.commission)} />
                    <ResultCard label="Custo Total" value={fmt(result.totalCost)} />
                    <ResultCard label="Receita Líquida" value={fmt(result.netFreight)} />
                    <ResultCard label="Lucro" value={fmt(result.profit)} highlight positive={result.profit >= 0} />
                    <ResultCard label="Margem" value={`${result.margin.toFixed(1)}%`} />
                    <ResultCard label="Receita/km" value={fmt(result.revenuePerKm)} />
                    <ResultCard label="Custo/km" value={fmt(result.costPerKm)} />
                </div>
            )}
        </div>
    );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function InvestmentSimulator() {
    const { user } = useAuth();
    const companyId = (user as any)?.company_id;
    const [simType, setSimType] = useState<'truck' | 'driver' | 'freight'>('truck');
    const [currentResult, setCurrentResult] = useState<{ result: any; params: any; title: string } | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [saving, setSaving] = useState(false);

    const loadHistory = async () => {
        if (!companyId) return;
        try { setHistory(await simulationService.getAll(companyId)); } catch {}
    };

    useEffect(() => { loadHistory(); }, [companyId]);

    const handleResult = (result: any, params: any) => {
        const type = SIM_TYPES.find(t => t.id === simType);
        setCurrentResult({ result, params, title: type?.label ?? '' });
    };

    const handleSave = async () => {
        if (!currentResult) return;
        setSaving(true);
        try {
            await simulationService.save(companyId, {
                type: simType,
                title: `${currentResult.title} — ${new Date().toLocaleDateString('pt-BR')}`,
                params: currentResult.params,
                result: currentResult.result,
                recommendation: currentResult.result.recommendation ?? ''
            });
            await loadHistory();
        } finally { setSaving(false); }
    };

    const handleDeleteHistory = async (id: string) => {
        if (!confirm('Excluir esta simulação?')) return;
        await simulationService.remove(id);
        loadHistory();
    };

    const viable = currentResult?.result?.viable;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Simulador de Investimentos</h1>
                <p className="text-sm text-slate-500 mt-0.5">Calcule a viabilidade antes de tomar decisões</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Painel simulação */}
                <div className="lg:col-span-3 space-y-4">
                    {/* Tipo */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                        <p className="text-xs font-semibold text-slate-500 mb-3">TIPO DE SIMULAÇÃO</p>
                        <div className="grid grid-cols-3 gap-2">
                            {SIM_TYPES.map(t => {
                                const Icon = t.icon;
                                return (
                                    <button key={t.id} onClick={() => { setSimType(t.id as any); setCurrentResult(null); }}
                                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${simType === t.id ? `border-primary-400 ${t.bg}` : 'border-slate-100 hover:border-slate-200'}`}>
                                        <div className={`w-9 h-9 rounded-xl ${t.bg} flex items-center justify-center`}>
                                            <Icon size={18} className={t.color} />
                                        </div>
                                        <span className="text-xs font-medium text-slate-700 leading-tight">{t.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Formulário */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                        <h2 className="text-sm font-semibold text-slate-700 mb-4">
                            {SIM_TYPES.find(t => t.id === simType)?.label}
                        </h2>
                        {simType === 'truck' && <TruckSimulator onResult={handleResult} />}
                        {simType === 'driver' && <DriverSimulator onResult={handleResult} />}
                        {simType === 'freight' && <FreightSimulator onResult={handleResult} />}
                    </div>
                </div>

                {/* Painel resultado */}
                <div className="lg:col-span-2 space-y-4">
                    {currentResult ? (
                        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                            <div className="flex items-center gap-2">
                                {viable ? (
                                    <CheckCircle2 size={20} className="text-green-500 flex-shrink-0" />
                                ) : viable === false ? (
                                    <XCircle size={20} className="text-red-500 flex-shrink-0" />
                                ) : (
                                    <AlertTriangle size={20} className="text-yellow-500 flex-shrink-0" />
                                )}
                                <h2 className="text-sm font-bold text-slate-800">Análise da IA</h2>
                            </div>
                            <p className={`text-sm leading-relaxed p-3 rounded-xl ${viable ? 'bg-green-50 text-green-800' : viable === false ? 'bg-red-50 text-red-800' : 'bg-yellow-50 text-yellow-800'}`}>
                                {currentResult.result.recommendation}
                            </p>
                            <button onClick={handleSave} disabled={saving}
                                className="w-full py-2 flex items-center justify-center gap-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                                <Save size={15} /> {saving ? 'Salvando...' : 'Salvar no Histórico'}
                            </button>
                        </div>
                    ) : (
                        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-8 text-center">
                            <Calculator size={32} className="text-slate-300 mx-auto mb-2" />
                            <p className="text-sm text-slate-400">Preencha os dados e clique em<br />Calcular para ver a análise.</p>
                        </div>
                    )}

                    {/* Histórico */}
                    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                        <button onClick={() => setShowHistory(!showHistory)}
                            className="w-full flex items-center justify-between p-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                            Histórico de Simulações ({history.length})
                            {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {showHistory && (
                            <div className="border-t border-slate-100 max-h-72 overflow-y-auto">
                                {history.length === 0 ? (
                                    <p className="text-xs text-slate-400 text-center py-6">Nenhuma simulação salva.</p>
                                ) : history.map(h => (
                                    <div key={h.id} className="p-3 border-b border-slate-50 hover:bg-slate-50">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-xs font-medium text-slate-700 truncate">{h.title}</p>
                                                <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{h.recommendation}</p>
                                            </div>
                                            <button onClick={() => handleDeleteHistory(h.id)}
                                                className="p-1 hover:text-red-400 text-slate-300 flex-shrink-0"><Trash2 size={13} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
