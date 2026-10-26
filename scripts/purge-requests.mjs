/**
 * Script de Manutenção / Limpeza de Solicitações (>60 dias)
 * 
 * Alternativa viável ao Cloud Functions caso o projeto esteja no plano gratuito (Spark)
 * ou utilize execução via GitHub Actions / Cron / CLI local.
 * 
 * Uso:
 * 1. Configure a variável de ambiente GOOGLE_APPLICATION_CREDENTIALS apontando para sua chave de serviço.
 * 2. Execute: node scripts/purge-requests.mjs
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "node:fs";

const RETENTION_DAYS = 60;
const PAGE_SIZE = 300;

async function run() {
  console.log(`[Limpeza Baphotography] Iniciando rotina de retenção de ${RETENTION_DAYS} dias...`);

  if (!getApps().length) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS && existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      const sa = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8"));
      initializeApp({ credential: cert(sa) });
    } else {
      initializeApp();
    }
  }

  const db = getFirestore();
  const cutoff = Timestamp.fromMillis(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  console.log(`[Limpeza] Data limite calculada: ${cutoff.toDate().toISOString()}`);

  let totalDeleted = 0;
  while (true) {
    const snap = await db.collection("requests")
      .where("status", "==", "encerrada")
      .where("createdAt", "<", cutoff)
      .orderBy("createdAt", "asc")
      .limit(PAGE_SIZE)
      .get();

    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    totalDeleted += snap.size;
    console.log(`[Limpeza] Lote processado: ${snap.size} registro(s) removido(s).`);
    if (snap.size < PAGE_SIZE) break;
  }

  console.log(`[Limpeza Baphotography] Concluída com sucesso. Total removido: ${totalDeleted} registro(s).`);
}

run().catch((err) => {
  console.error("[Limpeza Baphotography] Erro fatal durante a execução:", err);
  process.exit(1);
});
