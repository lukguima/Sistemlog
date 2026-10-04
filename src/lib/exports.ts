import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { calcTripCommission, type CommissionBase } from './commission';

export const generateDriverPaymentReceipt = (params: {
    companyName: string;
    driverName: string;
    driverCpf?: string;
    period: string;
    trips: Array<{
        date: string; cte?: string; origin: string; destination: string; vehicle: string;
        grossValue: number; commissionRate: number; commissionValue: number;
        advance: number; taxAmount?: number; net: number;
    }>;
    advances?: Array<{ description?: string; amount: number }>;
    summary: { totalGross: number; totalCommission: number; totalAdvances: number; totalTax?: number; totalNet: number };
}) => {
    const doc = new jsPDF();
    const { companyName, driverName, driverCpf, period, trips, advances, summary } = params;
    const fmt = (v: number) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    // Header
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('RECIBO DE PAGAMENTO DE PRODUÇÃO', 105, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(companyName, 105, 25, { align: 'center' });

    // Driver info
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('MOTORISTA:', 14, 46);
    doc.setFont('helvetica', 'normal');
    doc.text(driverName, 44, 46);
    if (driverCpf) { doc.setFont('helvetica', 'bold'); doc.text('CPF:', 110, 46); doc.setFont('helvetica', 'normal'); doc.text(driverCpf, 122, 46); }
    doc.setFont('helvetica', 'bold');
    doc.text('PERÍODO:', 14, 53);
    doc.setFont('helvetica', 'normal');
    doc.text(period, 44, 53);

    // Trips table
    autoTable(doc, {
        head: [['Data', 'CTE', 'Origem → Destino', 'Veículo', 'Frete Bruto', 'Resultado', 'Descontos', 'Líquido']],
        body: trips.map(t => {
            const descontos = (Number(t.advance) || 0) + (Number(t.taxAmount) || 0);
            return [
            t.date,
            t.cte?.trim() || '-',
            `${t.origin} → ${t.destination}`,
            t.vehicle,
            fmt(t.grossValue),
            `${fmt(t.commissionValue)} (${t.commissionRate}%)`,
            descontos > 0 ? fmt(descontos) : '-',
            fmt(Math.max(0, t.net)),
            ];
        }),
        startY: 60,
        headStyles: { fillColor: [37, 99, 235], fontSize: 7, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
            0: { cellWidth: 16 },
            1: { cellWidth: 22 },
            2: { cellWidth: 44 },
            3: { cellWidth: 18 },
            4: { cellWidth: 22 },
            5: { cellWidth: 26 },
            6: { cellWidth: 18 },
            7: { cellWidth: 16 },
        },
        margin: { left: 14, right: 14 },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 8;

    // Summary box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, finalY, 182, 38, 3, 3, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, finalY, 182, 38, 3, 3, 'S');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Frete Bruto Total:', 20, finalY + 9);
    doc.text('Resultado:', 20, finalY + 17);
    doc.text('(-) Descontos:', 20, finalY + 25);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(fmt(summary.totalGross), 118, finalY + 9, { align: 'right' });
    doc.text(fmt(summary.totalCommission), 118, finalY + 17, { align: 'right' });
    doc.setTextColor(220, 38, 38);
    doc.text(`- ${fmt((summary.totalAdvances || 0) + (summary.totalTax || 0))}`, 118, finalY + 25, { align: 'right' });

    // Net highlight
    doc.setFillColor(22, 163, 74);
    doc.roundedRect(122, finalY + 4, 70, 28, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('LÍQUIDO A PAGAR', 157, finalY + 14, { align: 'center' });
    doc.setFontSize(13);
    doc.text(fmt(summary.totalNet), 157, finalY + 26, { align: 'center' });

    // Pending advances breakdown
    let afterSummaryY = finalY + 50;
    if (advances && advances.length > 0) {
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('Vales/Adiantamentos inclusos nos descontos:', 14, afterSummaryY);
        doc.setFont('helvetica', 'normal');
        advances.forEach((adv, i) => {
            doc.text(`• ${adv.description || 'Vale'}: ${fmt(Number(adv.amount))}`, 20, afterSummaryY + 7 + i * 6);
        });
        afterSummaryY += 10 + advances.length * 6;
    }

    // Signatures
    const sigY = Math.min(afterSummaryY + 10, 260);
    doc.setDrawColor(148, 163, 184);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.line(14, sigY, 88, sigY);
    doc.text('Responsável pela Empresa', 51, sigY + 6, { align: 'center' });
    doc.line(110, sigY, 196, sigY);
    doc.text('Assinatura do Motorista', 153, sigY + 6, { align: 'center' });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 105, 290, { align: 'center' });

    doc.save(`recibo_${driverName.replace(/\s+/g, '_')}_${period.replace(/[\s\/]/g, '-')}.pdf`);
};

export const exportToPDF = (title: string, headers: string[][], data: any[][], fileName: string) => {
    const doc = new jsPDF();
    doc.text(title, 14, 15);
    autoTable(doc, {
        head: headers,
        body: data,
        startY: 20,
        headStyles: { fillColor: [37, 99, 235] }
    });
    doc.save(`${fileName}.pdf`);
};

export const exportToExcel = (data: any[], fileName: string) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados');
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportMultipleSheetsToExcel = (sheets: { name: string, data: any[] }[], fileName: string) => {
    const workbook = XLSX.utils.book_new();
    sheets.forEach(sheet => {
        const worksheet = XLSX.utils.json_to_sheet(sheet.data);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
    });
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

const brl = (v: number) => Number(v || 0);
const brDateTime = (iso: string | null | undefined) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const utcDay = (value: string | null | undefined) => {
    const day = String(value || '').slice(0, 10);
    const [y, m, d] = day.split('-');
    if (!y || !m || !d) return '—';
    return `${d}/${m}/${y}`;
};
const tripStatusLabel = (status: string) => {
    const map: Record<string, string> = {
        pending: 'Pendente', in_transit: 'Em trânsito', completed: 'Concluída', validated: 'Validada', paid: 'Paga',
    };
    return map[status] || status || '—';
};
const maintTypeLabel = (type: string) => {
    const map: Record<string, string> = {
        preventive: 'Preventiva', corrective: 'Corretiva', oil: 'Óleo', tyres: 'Pneus', mechanical: 'Mecânica', electrical: 'Elétrica',
    };
    return map[type] || type || '—';
};

export type VehicleYearReport = {
    year: number;
    companyName: string;
    commissionBase: CommissionBase;
    vehicle: any;
    stats: {
        totalGross: number; totalFuel: number; totalArla: number; totalMaint: number;
        totalTolls: number; totalIcms: number; totalInsurance: number;
        totalLoading: number; totalUnloading: number; totalCommission: number; totalTax: number;
        totalExpenses: number; netProfit: number; avgKmPerLiter: number;
        tripCount: number; fuelCount: number; maintCount: number;
    };
    trips: any[];
    fuels: any[];
    maintenances: any[];
};

const reportFileBase = (report: VehicleYearReport) => {
    const plate = String(report.vehicle?.plate || 'veiculo').replace(/\s+/g, '');
    return `Relatorio_${plate}_${report.year}`;
};

const money2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const summaryRows = (report: VehicleYearReport) => {
    const v = report.vehicle || {};
    const s = report.stats;
    return [
        { Item: 'Empresa', Valor: report.companyName || '—' },
        { Item: 'Placa', Valor: v.plate || '—' },
        { Item: 'Modelo', Valor: [v.brand, v.model].filter(Boolean).join(' ') || v.model || '—' },
        { Item: 'Ano do relatório', Valor: report.year },
        { Item: 'KM atual', Valor: Number(v.current_km) || 0 },
        { Item: 'Fretes', Valor: s.tripCount },
        { Item: 'Abastecimentos', Valor: s.fuelCount },
        { Item: 'Manutenções', Valor: s.maintCount },
        { Item: 'Faturamento bruto', Valor: money2(s.totalGross) },
        { Item: 'Diesel', Valor: money2(s.totalFuel) },
        { Item: 'ARLA', Valor: money2(s.totalArla) },
        { Item: 'Manutenção', Valor: money2(s.totalMaint) },
        { Item: 'Pedágio', Valor: money2(s.totalTolls) },
        { Item: 'ICMS', Valor: money2(s.totalIcms) },
        { Item: 'Seguro', Valor: money2(s.totalInsurance) },
        { Item: 'Carregamento', Valor: money2(s.totalLoading) },
        { Item: 'Descarga', Valor: money2(s.totalUnloading) },
        { Item: 'Comissão', Valor: money2(s.totalCommission) },
        { Item: 'Imposto', Valor: money2(s.totalTax) },
        { Item: 'Despesas', Valor: money2(s.totalExpenses) },
        { Item: 'Resultado', Valor: money2(s.netProfit) },
        { Item: 'KM/L médio', Valor: Math.round(s.avgKmPerLiter * 100) / 100 },
    ];
};

export const exportVehicleYearExcel = (report: VehicleYearReport) => {
    const trips = (report.trips || []).map((t) => ({
        Data: brDateTime(t.created_at),
        Origem: t.origin || '—',
        Destino: t.destination || '—',
        Motorista: t.driver?.name || '—',
        Status: tripStatusLabel(t.status),
        'Valor bruto': brl(t.gross_value),
        Pedágio: brl(t.tolls_value),
        ICMS: brl(t.icms_value),
        Seguro: brl(t.insurance_value),
        Carga: brl(t.loading_cost),
        Descarga: brl(t.unloading_cost),
        Comissão: brl(calcTripCommission(t, report.commissionBase).commission),
    }));
    const fuels = (report.fuels || []).map((f) => ({
        Data: brDateTime(f.created_at),
        KM: Number(f.odometer) || 0,
        'Litros diesel': Number(f.liters) || 0,
        'Valor diesel': brl(f.total_value),
        'Litros ARLA': Number(f.arla_liters) || 0,
        'Valor ARLA': brl(f.arla_value),
        Motorista: f.driver?.name || '—',
        Posto: f.location || '—',
    }));
    const maints = (report.maintenances || []).map((m) => ({
        Data: utcDay(m.date),
        Tipo: maintTypeLabel(m.type),
        Descrição: m.description || '—',
        KM: Number(m.km) || 0,
        Custo: brl(m.cost),
        Fornecedor: m.workshop || '—',
        Nota: m.notes || '—',
    }));
    exportMultipleSheetsToExcel([
        { name: 'Resumo', data: summaryRows(report) },
        { name: 'Fretes', data: trips.length ? trips : [{ Data: 'Nenhum frete neste ano' }] },
        { name: 'Abastecimentos', data: fuels.length ? fuels : [{ Data: 'Nenhum abastecimento neste ano' }] },
        { name: 'Manutenções', data: maints.length ? maints : [{ Data: 'Nenhuma manutenção neste ano' }] },
    ], reportFileBase(report));
};

export const exportVehicleYearPdf = (report: VehicleYearReport) => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const fmt = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const plate = report.vehicle?.plate || '—';
    const model = [report.vehicle?.brand, report.vehicle?.model].filter(Boolean).join(' ') || report.vehicle?.model || '';
    const s = report.stats;

    const paintHeader = () => {
        doc.setFillColor(37, 99, 235);
        doc.rect(0, 0, 297, 22, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text(`RELATÓRIO ANUAL — ${plate} — ${report.year}`, 14, 10);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(report.companyName || 'SistemLog', 14, 16);
        if (model) doc.text(model, 283, 16, { align: 'right' });
    };

    paintHeader();
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo', 14, 30);

    autoTable(doc, {
        body: [
            ['Fretes', String(s.tripCount), 'Faturamento bruto', fmt(s.totalGross)],
            ['Abastecimentos', String(s.fuelCount), 'Diesel', fmt(s.totalFuel)],
            ['Manutenções', String(s.maintCount), 'ARLA', fmt(s.totalArla)],
            ['KM atual', Number(report.vehicle?.current_km || 0).toLocaleString('pt-BR'), 'Manutenção', fmt(s.totalMaint)],
            ['KM/L médio', s.avgKmPerLiter.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 'Pedágio', fmt(s.totalTolls)],
            ['', '', 'ICMS', fmt(s.totalIcms)],
            ['', '', 'Seguro', fmt(s.totalInsurance)],
            ['', '', 'Carga / descarga', fmt(s.totalLoading + s.totalUnloading)],
            ['', '', 'Comissão', fmt(s.totalCommission)],
            ['', '', 'Imposto', fmt(s.totalTax)],
            ['', '', 'Resultado', fmt(s.netProfit)],
        ],
        startY: 34,
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 1.2 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 }, 2: { fontStyle: 'bold', cellWidth: 40 } },
        margin: { left: 14, right: 14 },
    });

    const startSection = (title: string) => {
        const y = (doc as any).lastAutoTable?.finalY ?? 34;
        if (y > 150) {
            doc.addPage();
            paintHeader();
            doc.setTextColor(30, 41, 59);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text(title, 14, 30);
            return 34;
        }
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(title, 14, y + 10);
        return y + 14;
    };

    const tableOpts = {
        headStyles: { fillColor: [37, 99, 235] as [number, number, number], fontSize: 7 },
        bodyStyles: { fontSize: 7 },
        alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
        margin: { left: 14, right: 14, bottom: 16 },
    };

    const tripBody = (report.trips || []).map((t) => [
        brDateTime(t.created_at),
        `${t.origin || '—'} → ${t.destination || '—'}`,
        t.driver?.name || '—',
        tripStatusLabel(t.status),
        fmt(t.gross_value),
        fmt(t.tolls_value),
        fmt(t.icms_value),
        fmt(Number(t.loading_cost) + Number(t.unloading_cost)),
        fmt(calcTripCommission(t, report.commissionBase).commission),
    ]);
    autoTable(doc, {
        ...tableOpts,
        head: [['Data', 'Origem → Destino', 'Motorista', 'Status', 'Bruto', 'Pedágio', 'ICMS', 'Carga/descarga', 'Comissão']],
        body: tripBody.length ? tripBody : [['Nenhum frete neste ano', '', '', '', '', '', '', '', '']],
        startY: startSection('Fretes'),
    });

    const fuelBody = (report.fuels || []).map((f) => [
        brDateTime(f.created_at),
        Number(f.odometer || 0).toLocaleString('pt-BR'),
        Number(f.liters || 0).toLocaleString('pt-BR'),
        fmt(f.total_value),
        Number(f.arla_liters || 0).toLocaleString('pt-BR'),
        fmt(f.arla_value),
        f.driver?.name || '—',
        f.location || '—',
    ]);
    autoTable(doc, {
        ...tableOpts,
        head: [['Data', 'KM', 'Litros diesel', 'Valor diesel', 'Litros ARLA', 'Valor ARLA', 'Motorista', 'Posto']],
        body: fuelBody.length ? fuelBody : [['Nenhum abastecimento neste ano', '', '', '', '', '', '', '']],
        startY: startSection('Abastecimentos'),
    });

    const maintBody = (report.maintenances || []).map((m) => [
        utcDay(m.date),
        maintTypeLabel(m.type),
        m.description || '—',
        Number(m.km || 0).toLocaleString('pt-BR'),
        fmt(m.cost),
        m.workshop || '—',
        m.notes || '—',
    ]);
    autoTable(doc, {
        ...tableOpts,
        head: [['Data', 'Tipo', 'Descrição', 'KM', 'Custo', 'Fornecedor', 'Nota']],
        body: maintBody.length ? maintBody : [['Nenhuma manutenção neste ano', '', '', '', '', '', '']],
        startY: startSection('Manutenções'),
    });

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`, 14, 200);
        doc.text(`${i} / ${pages}`, 283, 200, { align: 'right' });
    }

    doc.save(`${reportFileBase(report)}.pdf`);
};

