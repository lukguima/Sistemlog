import { Link } from 'react-router-dom';
import LegalLayout from '../../components/legal/LegalLayout';
import { LEGAL_COMPANY, legalContactLine } from '../../lib/legalCompany';

export default function PrivacyPolicy() {
    return (
        <LegalLayout title="Política de Privacidade">
            <p>
                Esta Política descreve como o <strong>{LEGAL_COMPANY.brandName}</strong> trata dados pessoais em
                conformidade com a Lei nº 13.709/2018 (LGPD) e demais normas aplicáveis. Ao utilizar{' '}
                {LEGAL_COMPANY.siteUrl} e a plataforma, você declara ciência deste documento e da{' '}
                <Link to="/cookies">Política de Cookies</Link>.
            </p>

            <h2>1. Controlador</h2>
            <p>
                Controlador: <strong>{LEGAL_COMPANY.controllerName}</strong>
                {LEGAL_COMPANY.cnpj ? ` · CNPJ ${LEGAL_COMPANY.cnpj}` : ''}.
                {LEGAL_COMPANY.address ? ` Endereço: ${LEGAL_COMPANY.address}.` : ''}
            </p>
            <p>
                Canal para exercer direitos e dúvidas de privacidade: {legalContactLine()}.{' '}
                <a href={LEGAL_COMPANY.whatsappUrl} target="_blank" rel="noopener noreferrer">WhatsApp</a>.
            </p>

            <h2>2. Dados que podemos tratar</h2>
            <h3>2.1 Conta e identificação</h3>
            <ul>
                <li>Nome, e-mail, telefone, senha (armazenada de forma criptografada pelos serviços de autenticação);</li>
                <li>Dados da empresa (nome, porte da frota e informações fornecidas no cadastro);</li>
                <li>Perfil de acesso (cargo/papel e permissões na plataforma).</li>
            </ul>
            <h3>2.2 Uso do serviço</h3>
            <ul>
                <li>Registros operacionais inseridos pelo cliente (viagens, motoristas, veículos, abastecimentos, financeiro etc.);</li>
                <li>Logs técnicos de acesso, IP, dispositivo, data/hora e eventos de segurança;</li>
                <li>Dados de assinatura e pagamento processados por parceiros (ex.: status de plano, identificadores de cobrança).</li>
            </ul>
            <h3>2.3 Site e comunicações</h3>
            <ul>
                <li>Dados de navegação e cookies (ver <Link to="/cookies">Política de Cookies</Link>);</li>
                <li>Mensagens enviadas por WhatsApp, formulários ou canais de suporte.</li>
            </ul>

            <h2>3. Finalidades e bases legais (LGPD)</h2>
            <ul>
                <li><strong>Execução de contrato</strong> — criar conta, prestar o SaaS, suporte e cobrança;</li>
                <li><strong>Legítimo interesse</strong> — segurança, prevenção a fraudes, melhoria do produto e comunicações pertinentes, com equilíbrio de direitos;</li>
                <li><strong>Cumprimento de obrigação legal/regulatória</strong> — quando exigido;</li>
                <li><strong>Consentimento</strong> — quando necessário (ex.: cookies não essenciais ou marketing, se aplicável).</li>
            </ul>

            <h2>4. Multi-tenant e papéis</h2>
            <p>
                A plataforma é multiempresa: cada organização acessa apenas seus próprios dados, sujeitos a controles
                técnicos (incluindo políticas de acesso). Administradores da empresa contratante podem cadastrar
                usuários e definir permissões. Dados operacionais inseridos pela empresa são, em regra, tratados sob
                responsabilidade dessa empresa perante seus titulares (motoristas, colaboradores, clientes finais).
            </p>

            <h2>5. Compartilhamento com terceiros</h2>
            <p>Podemos compartilhar dados com:</p>
            <ul>
                <li>Provedores de nuvem, autenticação e banco de dados (ex.: Supabase);</li>
                <li>Processadores de pagamento (ex.: Kiwify);</li>
                <li>Serviços de infraestrutura, e-mail ou analytics, quando utilizados;</li>
                <li>Autoridades públicas, mediante obrigação legal ou ordem válida.</li>
            </ul>
            <p>Exigimos de fornecedores medidas compatíveis com a finalidade e a LGPD, no que for aplicável.</p>

            <h2>6. Transferência internacional</h2>
            <p>
                Alguns fornecedores podem processar dados fora do Brasil. Nessas hipóteses, adotamos salvaguardas
                previstas na LGPD (cláusulas contratuais, políticas do fornecedor e demais mecanismos cabíveis).
            </p>

            <h2>7. Retenção e eliminação</h2>
            <p>
                Mantemos dados pelo tempo necessário às finalidades desta Política, à prestação do serviço, a prazos
                legais/contratuais e à defesa de direitos. Após o encerramento da conta, dados podem ser anonimizados
                ou excluídos, salvo retenção obrigatória.
            </p>

            <h2>8. Segurança</h2>
            <p>
                Adotamos medidas técnicas e organizacionais razoáveis (controle de acesso, isolamento por empresa,
                comunicação criptografada quando aplicável, práticas de autenticação). Nenhum sistema é totalmente
                isento de risco; recomendamos senhas fortes e proteção dos dispositivos de acesso.
            </p>

            <h2>9. Direitos do titular (arts. 18 e seguintes da LGPD)</h2>
            <p>Você pode solicitar:</p>
            <ul>
                <li>Confirmação de tratamento e acesso aos dados;</li>
                <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
                <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade;</li>
                <li>Portabilidade, quando aplicável;</li>
                <li>Informação sobre compartilhamentos;</li>
                <li>Revogação de consentimento, quando a base for consentimento;</li>
                <li>Oposição a tratamento irregular, nos termos da lei.</li>
            </ul>
            <p>
                Para exercer direitos: {legalContactLine()}. Responderemos no prazo legal. Poderemos solicitar
                confirmação de identidade para proteger os titulares.
            </p>

            <h2>10. Crianças e adolescentes</h2>
            <p>
                O serviço é voltado a uso profissional/empresarial. Não dirigimos o tratamento a crianças. Se tomar
                conhecimento de cadastro indevido, entre em contato para remoção.
            </p>

            <h2>11. Alterações</h2>
            <p>
                Esta Política pode ser atualizada. A data no topo indica a versão vigente. Em mudanças relevantes,
                poderemos destacar o aviso no site ou no produto.
            </p>

            <h2>12. Documentos relacionados</h2>
            <ul>
                <li><Link to="/termos">Termos de Uso</Link></li>
                <li><Link to="/cookies">Política de Cookies</Link></li>
            </ul>
        </LegalLayout>
    );
}
