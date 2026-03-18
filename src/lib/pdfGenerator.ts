import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AdvanceData {
    driverName: string;
    amount: number;
    date: string;
    description: string;
    companyName?: string;
}

export const generateAdvanceReceipt = (data: AdvanceData) => {
    const doc = new jsPDF();
    const { driverName, amount, date, description, companyName = 'LOGISTICA SAAS' } = data;

    // Configurações de estilo
    const primaryColor = [37, 99, 235]; // Blue 600
    const textColor = [30, 41, 59]; // Slate 800

    // Cabeçalho
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('RECIBO DE ADIANTAMENTO', 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(companyName.toUpperCase(), 105, 30, { align: 'center' });

    // Corpo do Recibo
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFontSize(12);

    let currentY = 60;

    // Valor em destaque
    doc.setFont('helvetica', 'bold');
    doc.text('VALOR:', 20, currentY);
    doc.setFontSize(16);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 40, currentY);

    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFontSize(12);
    currentY += 15;

    // Detalhes
    const details = [
        ['Motorista:', driverName],
        ['Data:', new Date(date).toLocaleDateString('pt-BR')],
        ['Descrição:', description || 'Adiantamento / Vale']
    ];

    autoTable(doc, {
        startY: currentY,
        head: [],
        body: details,
        theme: 'plain',
        styles: { fontSize: 11, cellPadding: 5 },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 30 },
            1: { cellWidth: 'auto' }
        }
    });

    currentY = (doc as any).lastAutoTable.finalY + 20;

    // Texto de Declaração
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const text = `Eu, ${driverName.toUpperCase()}, declaro ter recebido da empresa ${companyName.toUpperCase()} a importância de R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} referente ao adiantamento descrito acima.`;
    const splitText = doc.splitTextToSize(text, 170);
    doc.text(splitText, 20, currentY);

    currentY += 40;

    // Assinaturas
    doc.line(20, currentY, 90, currentY);
    doc.text('ASSINATURA DO MOTORISTA', 25, currentY + 5);

    doc.line(120, currentY, 190, currentY);
    doc.text('RESPONSÁVEL FINANCEIRO', 125, currentY + 5);

    // Rodapé
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 105, 285, { align: 'center' });

    // Salvar
    doc.save(`Recibo_Vale_${driverName.replace(/\s+/g, '_')}_${date}.pdf`);
};

