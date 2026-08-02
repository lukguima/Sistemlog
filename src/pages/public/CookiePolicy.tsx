import { Link } from 'react-router-dom';
import LegalLayout from '../../components/legal/LegalLayout';
import { LEGAL_COMPANY, legalContactLine } from '../../lib/legalCompany';

export default function CookiePolicy() {
    return (
        <LegalLayout title="Política de Cookies">
            <p>
                Esta Política explica o uso de cookies e tecnologias semelhantes no site e na plataforma{' '}
                <strong>{LEGAL_COMPANY.brandName}</strong> ({LEGAL_COMPANY.siteUrl}), em alinhamento à LGPD
                (Lei nº 13.709/2018) e às boas práticas de transparência. Complementa a{' '}
                <Link to="/privacidade">Política de Privacidade</Link>.
            </p>

            <h2>1. O que são cookies</h2>
            <p>
                Cookies são pequenos arquivos armazenados no seu dispositivo quando você visita um site. Servem para
                lembrar preferências, manter sessão autenticada, entender uso da página e, quando autorizados,
                apoiar marketing ou métricas.
            </p>

            <h2>2. Tipos que podemos utilizar</h2>
            <h3>2.1 Necessários / essenciais</h3>
            <ul>
                <li>Autenticação e sessão (incluindo cookies HttpOnly de segurança, quando ativos);</li>
                <li>Preferência de consentimento de cookies;</li>
                <li>Segurança e prevenção a abusos.</li>
            </ul>
            <p>Esses cookies são indispensáveis ao funcionamento do serviço e, em regra, não dependem de consentimento opcional.</p>

            <h3>2.2 Funcionais</h3>
            <ul>
                <li>Lembrar escolhas da interface (ex.: rascunhos locais, preferências de exibição), quando aplicável.</li>
            </ul>

            <h3>2.3 Analíticos / desempenho</h3>
            <ul>
                <li>Estatísticas agregadas de uso do site ou produto, se/quando habilitados, para melhorar a experiência.</li>
            </ul>

            <h3>2.4 Marketing</h3>
            <ul>
                <li>Somente se forem adotados no futuro e com base legal adequada (em geral, consentimento).</li>
            </ul>

            <h2>3. Cookies de terceiros</h2>
            <p>
                Provedores como autenticação/nuvem, pagamento ou ferramentas embutidas podem definir cookies próprios
                sujeitos às políticas desses terceiros. Recomendamos consultar as políticas dos respectivos serviços.
            </p>

            <h2>4. Base legal</h2>
            <ul>
                <li><strong>Cookies essenciais:</strong> execução de contrato / legítimo interesse (segurança e funcionamento);</li>
                <li><strong>Cookies não essenciais:</strong> consentimento, quando exigido — você pode aceitar, recusar ou gerenciar pelo banner e pelo navegador.</li>
            </ul>

            <h2>5. Como gerenciar</h2>
            <ul>
                <li>Pelo banner de cookies do site (quando exibido);</li>
                <li>Pelas configurações do navegador (bloquear, apagar ou alertar sobre cookies);</li>
                <li>Limpando dados do site nas configurações do dispositivo.</li>
            </ul>
            <p>
                Bloquear cookies essenciais pode impedir login ou o uso correto da plataforma.
            </p>

            <h2>6. Armazenamento da escolha</h2>
            <p>
                Quando você registra uma preferência no banner, podemos guardar essa escolha em{' '}
                <code className="text-primary-300 text-sm">localStorage</code> ou cookie próprio, para não perguntar
                a cada visita no mesmo dispositivo.
            </p>

            <h2>7. Contato</h2>
            <p>
                Dúvidas sobre cookies ou privacidade: {legalContactLine()}.{' '}
                <a href={LEGAL_COMPANY.whatsappUrl} target="_blank" rel="noopener noreferrer">WhatsApp</a>.
            </p>

            <h2>8. Documentos relacionados</h2>
            <ul>
                <li><Link to="/privacidade">Política de Privacidade</Link></li>
                <li><Link to="/termos">Termos de Uso</Link></li>
            </ul>
        </LegalLayout>
    );
}
