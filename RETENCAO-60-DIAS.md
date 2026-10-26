# Política e Rotina de Retenção de 60 Dias — Baphotography

Este documento detalha o funcionamento, as regras de negócio e os métodos de configuração e execução da limpeza de solicitações de orçamento elegíveis após **60 dias**.

---

## 1. Regra de Negócio

- **Coleção afetada:** `requests` (Solicitações de orçamento).
- **Status obrigatório:** Apenas registros com status `encerrada`. Solicitações com status `nova`, `atendimento`, `orcamento` ou `contratada` **nunca** são excluídas automaticamente, mesmo que tenham mais de 60 dias.
- **Data de referência:** Campo `createdAt` (Timestamp oficial do servidor no momento do envio). Não é utilizada a data do evento (`eventDate`), pois casamentos podem ser agendados com 1 a 2 anos de antecedência.
- **Prazo estrito:** Mais de **60 dias** corridos decorridos desde `createdAt`.
- **Integridade:** Álbuns (`albums`), fotografias (`photos`), configurações (`settings`) e avaliações (`testimonials`) **jamais** são tocados pela rotina de retenção.

---

## 2. Opções de Execução

### Opção A: Cloud Functions Agendado (Automático, Nuvem)
Localizado em `functions/index.js`.
- **Agendamento:** Diariamente às 03:15 (fuso horário `America/Araguaina`).
- **Comportamento:** Paginação em lotes de até 300 documentos, exclusão em `batch` atômico e registro de logs via `firebase-functions/logger`.
- **Requisitos de infraestrutura:**
  - O Firebase exige o plano **Blaze (Pay as you go)** para funções que utilizam o Cloud Scheduler.
  - APIs necessárias ativas no Google Cloud Console: Cloud Functions API, Cloud Scheduler API e Cloud Build API.
- **Como publicar:**
  ```bash
  cd functions
  npm install
  cd ..
  firebase deploy --only functions:purgeOldClosedRequests
  ```

### Opção B: Botão no Painel Administrativo (Manual, Sem Custo)
Disponível diretamente no Painel Administrativo do estúdio:
1. Acesse o painel e entre na aba **Solicitações**.
2. Clique no botão **"Apagar solicitações encerradas (>60 dias)"**.
3. Uma confirmação será exibida e o Firestore excluirá até 500 registros elegíveis por clique, exibindo o total de itens removidos.
4. Funciona em qualquer plano do Firebase (inclusive Spark gratuito).

### Opção C: Script Node.js Standalone (GitHub Actions ou Cron)
Localizado em `scripts/purge-requests.mjs`.
- Permite rodar a limpeza automaticamente sem assinar o plano Blaze, usando um agendamento gratuito no GitHub Actions ou servidor próprio.
- **Execução:**
  ```bash
  export GOOGLE_APPLICATION_CREDENTIALS="./serviceAccountKey.json"
  node scripts/purge-requests.mjs
  ```

---

## 3. Índices do Firestore Necessários

Para que as consultas de retenção por data e status funcionem com máxima velocidade, os seguintes índices foram configurados em `firestore.indexes.json`:

```json
{
  "collectionGroup": "requests",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "ASCENDING" }
  ]
}
```

Para publicar os índices:
```bash
firebase deploy --only firestore:indexes
```
