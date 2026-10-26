import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";

initializeApp();
const db = getFirestore();
const RETENTION_DAYS = 60;
const PAGE_SIZE = 300;

/**
 * Rotina automática diária de retenção de dados (LGPD / Privacidade).
 * Executa às 03:15 (horário de Araguaína / Tocantins).
 * Identifica e exclui de forma segura apenas solicitações de orçamento
 * com status "encerrada" cuja data de criação seja superior a 60 dias.
 * Não altera nem remove álbuns, fotos, avaliações ou outras coleções.
 */
export const purgeOldClosedRequests = onSchedule(
  { schedule: "every day 03:15", timeZone: "America/Araguaina", region: "southamerica-east1", retryCount: 2 },
  async () => {
    try {
      const cutoff = Timestamp.fromMillis(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
      let deleted = 0;

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

        deleted += snap.size;
        if (snap.size < PAGE_SIZE) break;
      }

      logger.info("Limpeza automática de solicitações concluída com sucesso.", {
        deleted,
        retentionDays: RETENTION_DAYS,
        cutoffDate: cutoff.toDate().toISOString()
      });
    } catch (err) {
      logger.error("Erro durante a execução da limpeza de solicitações encerradas:", err);
      throw err;
    }
  }
);
