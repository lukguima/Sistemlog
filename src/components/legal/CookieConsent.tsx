import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LEGAL_COMPANY } from '../../lib/legalCompany';

const STORAGE_KEY = 'sl_cookie_consent';

type Choice = 'accepted' | 'essential';

export default function CookieConsent() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) setVisible(true);
        } catch {
            setVisible(true);
        }
    }, []);

    function save(choice: Choice) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice, at: new Date().toISOString() }));
        } catch { /* ignore */ }
        setVisible(false);
    }

    if (!visible) return null;

    return (
        <div className="fixed bottom-0 inset-x-0 z-[100] p-4 md:p-6 pointer-events-none">
            <div className="max-w-3xl mx-auto pointer-events-auto rounded-2xl border border-white/10 bg-[#121826]/95 backdrop-blur-md shadow-2xl p-5 md:p-6 text-white">
                <p className="text-sm font-bold text-white mb-1">Cookies e privacidade</p>
                <p className="text-sm text-slate-400 font-medium leading-relaxed mb-4">
                    O {LEGAL_COMPANY.brandName} usa cookies essenciais para login e segurança, e pode usar cookies
                    opcionais para melhorar a experiência. Consulte a{' '}
                    <Link to="/cookies" className="text-primary-400 underline">Política de Cookies</Link>
                    {' '}e a{' '}
                    <Link to="/privacidade" className="text-primary-400 underline">Política de Privacidade</Link>.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                    <button
                        type="button"
                        onClick={() => save('essential')}
                        className="px-4 py-2.5 rounded-xl text-sm font-bold border border-white/15 text-slate-300 hover:bg-white/5 transition-colors"
                    >
                        Apenas essenciais
                    </button>
                    <button
                        type="button"
                        onClick={() => save('accepted')}
                        className="px-4 py-2.5 rounded-xl text-sm font-black bg-primary-600 hover:bg-primary-500 text-white transition-colors"
                    >
                        Aceitar
                    </button>
                </div>
            </div>
        </div>
    );
}
