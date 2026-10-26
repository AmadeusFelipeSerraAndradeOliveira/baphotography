# Baphotography — Estúdio Editorial de Fotografia & Videografia

Site editorial moderno, sofisticado e minimalista de fotografia e videografia de casamentos, com identidade visual clara e refinada (tons claros/brancos, cartões sutis, tipografia elegante e detalhes dourados champanhe), portfólio integrado, galeria ampliada (Lightbox), sistema público de avaliações de clientes moderadas pelo estúdio, formulário flutuante e de página com horário desejado e integração oficial ao WhatsApp, painel administrativo completo (Upload resiliente, Gestão de Capas, Solicitações em 3 status, Agendamentos com detecção de conflitos, Sistema Financeiro e Métricas, Conteúdo do Site com upload de fotos) e rotina de retenção de dados de 60 dias.

---

## 1. Visão Geral da Arquitetura

- **Frontend:** HTML5 semântico, CSS3 moderno com estética clean/editorial (fundo suave `#fcfbf9`, superfícies brancas com bordas discretas, tipografia legível cinza-escuro/preto e destaque bronze-dourado `#a67c37`), JavaScript modular nativo (ES Modules, sem necessidade de build ou bundlers).
- **Backend / BaaS:** Firebase 10 (Authentication, Cloud Firestore, Cloud Storage com CORS configurado, Cloud Functions v2, Firebase Hosting).
- **Design System:** Tipografia elegante (*Cormorant Garamond* para títulos e *DM Sans* para textos e dados numéricos), espaçamento generoso, imagens em destaque, transições suaves e suporte estrito a `prefers-reduced-motion`.

---

## 2. Estrutura de Arquivos

```
baphotography/
├── index.html              # Página inicial integrada (Hero, Portfólio, Sobre, Serviços, Avaliações, Contato)
├── portfolio.html          # Galeria completa do portfólio com filtros por categoria
├── album.html              # Visualização individual de álbum e fotografias (Masonry + Lightbox)
├── sobre.html              # Página editorial Sobre o fotógrafo
├── orcamento.html          # Página dedicada de solicitação de orçamento com horário desejado
├── privacidade.html        # Política de privacidade e retenção de dados (60 dias)
├── admin/
│   ├── index.html          # Painel administrativo integrado
│   └── admin.js            # Lógica completa: Álbuns, Upload, Capa, Solicitações (3 status), Agendamentos, Financeiro, Conteúdo, Moderação e Configurações
├── css/
│   └── style.css           # Design System clean/editorial completo, responsivo e acessível
├── js/
│   ├── config.js           # Credenciais do Firebase e links de marca oficiais
│   ├── config.example.js   # Exemplo de configuração
│   ├── firebase.js         # Inicialização do Firebase SDK + uploadToStorage com fallback resiliente de bucket
│   ├── ui.js               # Layout comum, modal flutuante de orçamento com horário, lightbox e ícones SVG
│   ├── home.js             # Lógica dinâmica da página inicial e portfólio integrado
│   ├── portfolio.js        # Lógica da listagem do portfólio completo
│   ├── album.js            # Lógica da galeria de fotos e visualização do álbum
│   ├── sobre.js            # Lógica dos textos e retrato da página Sobre
│   ├── quote.js            # Formulário de orçamento com horário e redirecionamento ao WhatsApp
│   └── whatsapp.js         # Montagem e codificação de mensagens para WhatsApp (#ID e horário)
├── functions/
│   ├── index.js            # Cloud Function agendada diária para retenção de 60 dias
│   └── package.json        # Dependências das Cloud Functions
├── scripts/
│   └── purge-requests.mjs  # Script Node.js de limpeza sem necessidade de plano Blaze
├── tests/
│   ├── whatsapp.test.mjs   # Testes unitários de WhatsApp, formato de hora e validações
│   ├── retention.test.mjs  # Testes unitários da regra estrita de 60 dias de retenção
│   └── portfolio.test.mjs  # Testes unitários de filtros de categoria e ordenação
├── cors.json               # Configuração CORS para o bucket do Cloud Storage
├── firestore.rules         # Regras de segurança do Cloud Firestore (com validações de transações e solicitações)
├── storage.rules           # Regras de segurança do Cloud Storage (upload restrito a administradores autenticados)
├── firestore.indexes.json  # Índices compostos do Firestore (incluindo financeiro e solicitações)
├── RETENCAO-60-DIAS.md     # Documentação detalhada da política de retenção
└── README.md               # Este guia completo do projeto
```

---

## 3. Redes Sociais Oficiais

Configuradas nos cabeçalhos, formulários e rodapés:
- **Instagram:** https://www.instagram.com/baphotographyyy/
- **Threads:** https://www.threads.com/@baphotographyyy
- **WhatsApp:** https://wa.me/message/BHVC4OEONZS7A1

---

## 4. Correção Definitiva do Upload e Configuração CORS

### Diagnóstico do Erro CORS / ERR_FAILED
O erro `CORS policy` no Firebase Storage em projetos web ocorre tipicamente por 2 motivos:
1. O bucket do Google Cloud Storage não tem a regra de CORS explicitamente aplicada para requisições de navegadores web (`Access-Control-Allow-Origin`).
2. O bucket informado no Firebase Config usa o domínio padrão mais novo `.firebasestorage.app`, enquanto projetos legados usam `.appspot.com` (ou vice-versa). Quando a URL retorna 404, o Google Cloud não emite cabeçalhos CORS, gerando o erro enganoso no console.

### Soluções Implementadas no Código:
- Em `js/firebase.js`, criamos a função `uploadToStorage()` que:
  - Verifica se o administrador está autenticado antes de qualquer chamada.
  - Tenta fazer o upload via `uploadBytes` (evitando problemas de handshake de sessão do `uploadBytesResumable`).
  - Se houver falha de rede ou 404 no bucket primário, tenta automaticamente o bucket alternativo (`.appspot.com` vs `.firebasestorage.app`).
  - Fornece diagnóstico amigável no console e na interface se o Firebase Storage não estiver ativado no projeto.

### Como aplicar a regra CORS no Cloud Storage (Passo a Passo):
Um arquivo `cors.json` já está incluído na raiz do projeto:

```json
[
  {
    "origin": ["*"],
    "method": ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"],
    "responseHeader": [
      "Content-Type",
      "Authorization",
      "Content-Length",
      "User-Agent",
      "x-goog-resumable"
    ],
    "maxAgeSeconds": 3600
  }
]
```

Para aplicar no seu bucket usando a ferramenta de linha de comando `gcloud` ou `gsutil`:

```bash
# Opção A (gcloud storage):
gcloud storage buckets update gs://baphotography-4d15a.firebasestorage.app --cors-file=cors.json

# Opção B (gsutil):
gsutil cors set cors.json gs://baphotography-4d15a.firebasestorage.app
```
*(Caso seu bucket termine em `.appspot.com`, substitua o nome do bucket no comando acima).*

---

## 5. Novas Funcionalidades do Painel Administrativo

### A. Gestão Completa de Imagem de Capa do Álbum
- **Escolha direta do computador:** selecione um arquivo de imagem local e visualize a prévia instantaneamente antes de salvar.
- **Escolha a partir das fotos do álbum:** selecione qualquer fotografia já enviada com um clique em "Definir como capa".
- **Substituir ou Remover Capa:** botões dedicados para trocar ou remover a capa a qualquer momento.

### B. Gestão de Solicitações (Estritamente 3 Status)
1. **Novo:** solicitações que acabaram de chegar pelo site.
2. **Em atendimento:** fotógrafo iniciou a conversa com o cliente pelo botão "Iniciar atendimento".
3. **Cancelado:** orçamento cancelado com registro de data.
4. **Encerrar atendimento:** ao clicar no botão "Encerrar atendimento", abre uma janela modal obrigatória para registrar:
   - **Forma de pagamento utilizada:** Pix, Dinheiro, Cartão de crédito, Cartão de débito, Transferência bancária ou Outro.
   - **Valor final recebido (R$):** valor real efetivamente pago.
   - **Data do pagamento e observações.**
   - O atendimento é marcado como concluído e os dados alimentam automaticamente o sistema financeiro, sem duplicidade de receita caso seja reaberto.

### C. Módulo de Agendamentos
- Exibe todas as datas solicitadas pelos clientes em ordem cronológica.
- **Alerta de conflito de agenda:** sinaliza visualmente em vermelho quando dois ou mais clientes solicitam a mesma data.
- **Confirmar data com o cliente:** modal com atalho para enviar mensagem formatada via WhatsApp com a confirmação de data e horário.

### D. Módulo Financeiro Completo
- **Indicadores no topo:** Faturamento no Mês atual, Faturamento no Ano, Faturamento Total Líquido, Contratos Pagos e Estornos.
- **Gráficos visuais:**
  - *Evolução Mensal:* barras com o faturamento mês a mês do ano.
  - *Distribuição por Forma de Pagamento:* proporção percentual entre Pix, Cartão, Dinheiro etc.
- **Filtros avançados:** filtrar por Mês, Ano, Forma de Pagamento e busca por nome de cliente.
- **Tabela de Movimentações:** listagem de transações com data, cliente, forma de pagamento, valor e botão para "Registrar Estorno" caso um contrato seja devolvido.

### E. Conteúdo do Site com Upload do Computador
- Não é mais necessário colar URLs de imagens manualmente.
- Campos com prévia e botão de upload direto para:
  - **Fotografia de destaque da Página Inicial (Hero Image)**
  - **Retrato do fotógrafo na seção Sobre (About Portrait)**

---

## 6. Como Executar Localmente

Como o projeto utiliza módulos ES nativos (`import`/`export`), execute a partir de um servidor HTTP local:

```bash
# Opção 1: Via Node.js
npx serve .

# Opção 2: Via Python 3
python -m http.server 8000
```

Abra no navegador: `http://localhost:8000` (ou a porta informada pelo terminal).

### Executar os testes automatizados:
```bash
npm test
```

---

## 7. Publicação no Firebase

### 1. Publicar regras e índices:
```bash
firebase deploy --only firestore,storage,firestore:indexes
```

### 2. Publicar o site (Hosting):
```bash
firebase deploy --only hosting
```

### 3. Ativar a rotina automática de 60 dias (opcional, requer plano Blaze):
```bash
cd functions
npm install
cd ..
firebase deploy --only functions:purgeOldClosedRequests
```
*(Consulte `RETENCAO-60-DIAS.md` para a alternativa gratuita via script ou botão do painel).*
