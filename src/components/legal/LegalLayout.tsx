import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { LEGAL_COMPANY } from '../../lib/legalCompany';

export default function LegalLayout({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-[#0B0F17] text-white flex flex-col font-display">
            <nav className="w-full border-b border-white/5 bg-[#0B0F17]/90 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link to="/" className="bg-white rounded-xl p-1.5 inline-flex">
                        <img src="/images/logo.png" alt={LEGAL_COMPANY.brandName} className="h-8 object-contain" />
                    </Link>
                    <Link
                        to="/"
                        className="text-sm font-bold text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1.5"
                    >
                        <ArrowLeft size={14} /> Voltar ao site
                    </Link>
                </div>
            </nav>

            <main className="flex-1 px-6 py-12">
                <article className="max-w-3xl mx-auto">
                    <p className="text-xs font-black uppercase tracking-widest text-primary-400 mb-3">Legal · LGPD</p>
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">{title}</h1>
                    <p className="text-sm text-slate-500 font-medium mb-10">
                        Última atualização: {LEGAL_COMPANY.lastUpdated}
                    </p>
                    <div className="legal-prose space-y-6 text-slate-300 text-[15px] leading-relaxed font-medium [&_h2]:text-white [&_h2]:text-lg [&_h2]:font-black [&_h2]:mt-10 [&_h2]:mb-3 [&_h3]:text-white [&_h3]:font-bold [&_h3]:mt-6 [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_a]:text-primary-400 [&_a]:underline [&_strong]:text-white">
                        {children}
                    </div>
                </article>
            </main>

            <footer className="border-t border-white/5 py-8 px-6 text-center text-slate-600 text-sm font-bold">
                <div className="flex flex-wrap justify-center gap-4 mb-3">
                    <Link to="/termos" className="hover:text-white transition-colors">Termos de Uso</Link>
                    <Link to="/privacidade" className="hover:text-white transition-colors">Privacidade</Link>
                    <Link to="/cookies" className="hover:text-white transition-colors">Cookies</Link>
                </div>
                &copy; {new Date().getFullYear()} {LEGAL_COMPANY.brandName}
            </footer>
        </div>
    );
}
