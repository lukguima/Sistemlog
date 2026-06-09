import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export const generateDriverPaymentReceipt = (params: {
    companyName: string;
    driverName: string;
    driverCpf?: string;
    period: string;
    trips: Array<{
        date: string; origin: string; destination: string; vehicle: string;
        grossValue: number; commissionRate: number; commissionValue: number;
        advance: number; net: number;
    }>;
    advances?: Array<{ description?: string; amount: number }>;
    summary: { totalGross: number; totalCommission: number; totalAdvances: number; totalNet: number };
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
        head: [['Data', 'Origem → Destino', 'Veículo', 'Frete Bruto', 'Comissão', 'Descontos', 'Líquido']],
        body: trips.map(t => [
            t.date,
            `${t.origin} → ${t.destination}`,
            t.vehicle,
            fmt(t.grossValue),
            `${fmt(t.commissionValue)} (${t.commissionRate}%)`,
            t.advance > 0 ? fmt(t.advance) : '-',
            fmt(Math.max(0, t.net)),
        ]),
        startY: 60,
        headStyles: { fillColor: [37, 99, 235], fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 58 }, 2: { cellWidth: 20 }, 3: { cellWidth: 22 }, 4: { cellWidth: 30 }, 5: { cellWidth: 20 }, 6: { cellWidth: 22 } },
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
    doc.text('Comissão Bruta:', 20, finalY + 17);
    doc.text('(-) Descontos/Vales:', 20, finalY + 25);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(fmt(summary.totalGross), 118, finalY + 9, { align: 'right' });
    doc.text(fmt(summary.totalCommission), 118, finalY + 17, { align: 'right' });
    doc.setTextColor(220, 38, 38);
    doc.text(`- ${fmt(summary.totalAdvances)}`, 118, finalY + 25, { align: 'right' });

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

