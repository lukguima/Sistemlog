/**
 * Identidade do controlador (SistemLog) para páginas legais / LGPD.
 * Atualize CNPJ, razão social e e-mail quando disponíveis.
 */
export const LEGAL_COMPANY = {
    brandName: 'SistemLog',
    siteUrl: 'https://sistemlog.com.br',
    /** Razão social / nome do controlador — ajuste se houver PJ formal */
    controllerName: 'SistemLog',
    cnpj: '',
    address: '',
    privacyEmail: '',
    whatsappDisplay: '+55 63 99281-5404',
    whatsappUrl: 'https://wa.me/5563992815404?text=Olá,%20quero%20exercer%20meus%20direitos%20LGPD%20no%20SistemLog',
    lastUpdated: '02 de agosto de 2026',
} as const;

export function legalContactLine(): string {
    const parts = [
        LEGAL_COMPANY.privacyEmail
            ? `e-mail ${LEGAL_COMPANY.privacyEmail}`
            : null,
        `WhatsApp ${LEGAL_COMPANY.whatsappDisplay}`,
    ].filter(Boolean);
    return parts.join(' ou ');
}
