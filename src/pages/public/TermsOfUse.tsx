import { Link } from 'react-router-dom';
import LegalLayout from '../../components/legal/LegalLayout';
import { LEGAL_COMPANY, legalContactLine } from '../../lib/legalCompany';

export default function TermsOfUse() {
    return (
        <LegalLayout title="Termos de Uso">
            <p>
                Estes Termos de Uso regulam o acesso e a utilização da plataforma <strong>{LEGAL_COMPANY.brandName}</strong>{' '}
                ({LEGAL_COMPANY.siteUrl}), solução de gestão logística oferecida na modalidade software como serviço (SaaS).
                Ao criar conta, acessar ou utilizar o serviço, você declara ter lido e concordado com estes Termos e com a{' '}
                <Link to="/privacidade">Política de Privacidade</Link>.
            </p>

            <h2>1. Quem somos (Controlador / Prestador)</h2>
            <p>
                O serviço é prestado por <strong>{LEGAL_COMPANY.controllerName}</strong>
                {LEGAL_COMPANY.cnpj ? `, CNPJ ${LEGAL_COMPANY.cnpj}` : ''}.
                Contato para assuntos legais e LGPD: {legalContactLine()}.
            </p>

            <h2>2. Objeto do serviço</h2>
            <p>
                O {LEGAL_COMPANY.brandName} disponibiliza ferramentas digitais para gestão de frotas, viagens, abastecimento,
                manutenção, financeiro, equipe e recursos correlatos, conforme o plano contratado. O serviço depende de
                conexão à internet e pode integrar provedores de pagamento, autenticação e infraestrutura em nuvem.
            </p>

            <h2>3. Cadastro e conta</h2>
            <ul>
                <li>Você deve fornecer informações verdadeiras, completas e atualizadas.</li>
                <li>É responsável por manter a confidencialidade de login e senha e por todas as atividades na sua conta.</li>
                <li>Contas de equipe (subusuários) devem ser criadas apenas por administradores autorizados da empresa contratante.</li>
                <li>Menores de 18 anos não devem utilizar o serviço sem representação legal adequada.</li>
            </ul>

            <h2>4. Planos, trial e pagamento</h2>
            <ul>
                <li>Pode haver período de teste gratuito, conforme oferta vigente no site.</li>
                <li>Após o trial ou na assinatura paga, o acesso a funcionalidades pode ser limitado se a assinatura estiver vencida, cancelada ou bloqueada.</li>
                <li>Cobranças e renovações podem ser processadas por plataformas de pagamento parceiras (ex.: Kiwify), sujeitas também às regras desses provedores.</li>
                <li>Valores, limites de veículos e módulos seguem o plano indicado no momento da contratação.</li>
            </ul>

            <h2>5. Uso aceitável</h2>
            <p>É vedado, entre outras condutas:</p>
            <ul>
                <li>Usar o serviço para fins ilícitos ou em violação a direitos de terceiros;</li>
                <li>Tentar obter acesso não autorizado a dados de outras empresas (multi-tenant);</li>
                <li>Realizar engenharia reversa abusiva, sobrecarga deliberada ou exploração de falhas de segurança;</li>
                <li>Inserir conteúdo ilegal, ofensivo ou que viole a LGPD ou outras normas aplicáveis;</li>
                <li>Revender o acesso sem autorização escrita.</li>
            </ul>

            <h2>6. Dados e responsabilidade do cliente</h2>
            <p>
                Os dados operacionais inseridos pela empresa contratante (viagens, motoristas, veículos, financeiro etc.)
                são de responsabilidade dessa empresa, que atua como controladora desses dados em relação aos seus
                colaboradores e clientes finais. O {LEGAL_COMPANY.brandName} trata esses dados como operador/prestador
                tecnológico, conforme a <Link to="/privacidade">Política de Privacidade</Link> e a Lei nº 13.709/2018 (LGPD).
            </p>

            <h2>7. Propriedade intelectual</h2>
            <p>
                Marca, software, layout, textos e demais elementos do {LEGAL_COMPANY.brandName} pertencem ao prestador
                ou a licenciantes. O uso do serviço não transfere propriedade intelectual ao usuário, apenas licença
                limitada, não exclusiva e intransferível durante a vigência da assinatura.
            </p>

            <h2>8. Disponibilidade e alterações</h2>
            <p>
                Empregamos esforços razoáveis para manter o serviço disponível, sem garantir disponibilidade ininterrupta.
                Podemos realizar manutenções, melhorias e alterações de funcionalidades. Alterações materiais nestes
                Termos serão comunicadas pelos canais do produto ou do site, com a data de atualização no topo desta página.
            </p>

            <h2>9. Limitação de responsabilidade</h2>
            <p>
                Na máxima extensão permitida pela lei brasileira, o {LEGAL_COMPANY.brandName} não se responsabiliza por
                lucros cessantes, decisões de negócio baseadas em relatórios da plataforma, indisponibilidade de
                terceiros (hospedagem, internet, gateways de pagamento) ou danos decorrentes de uso indevido da conta
                pelo cliente. Em qualquer hipótese, a responsabilidade total fica limitada ao valor pago pelo cliente
                nos 3 (três) meses anteriores ao evento, quando aplicável.
            </p>

            <h2>10. Suspensão e encerramento</h2>
            <p>
                Podemos suspender ou encerrar o acesso em caso de inadimplência, violação destes Termos, risco à
                segurança ou ordem legal. O cliente pode cancelar a assinatura conforme as regras do plano e do
                processador de pagamento. Após o encerramento, dados podem ser retidos pelo prazo necessário ao
                cumprimento legal ou excluídos conforme a Política de Privacidade.
            </p>

            <h2>11. Lei aplicável e foro</h2>
            <p>
                Aplicam-se as leis da República Federativa do Brasil. Fica eleito o foro da comarca do domicílio do
                prestador, salvo disposição legal de proteção ao consumidor em sentido diverso.
            </p>

            <h2>12. Contato</h2>
            <p>
                Dúvidas sobre estes Termos: {legalContactLine()}.{' '}
                <a href={LEGAL_COMPANY.whatsappUrl} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>.
            </p>
        </LegalLayout>
    );
}
