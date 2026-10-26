import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import * as fs from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import * as st from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import * as au from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { config } from "./config.js";

export const isConfigured = Boolean(config.firebase.projectId && config.firebase.apiKey);
let app = null, db = null, storage = null, auth = null;

if (isConfigured) {
  app = initializeApp(config.firebase);
  db = fs.getFirestore(app);
  storage = st.getStorage(app);
  auth = au.getAuth(app);
}

/**
 * Função inteligente e resiliente para upload de imagens no Firebase Storage.
 * Trata autenticação, nomes alternativos de bucket (.appspot.com vs .firebasestorage.app)
 * e alternativas entre upload direto (uploadBytes) e resumable para contornar bloqueios de CORS.
 */
export async function uploadToStorage(path, blob, onProgress = () => {}) {
  if (!isConfigured) {
    throw new Error("Firebase não está configurado. Preencha js/config.js.");
  }

  // 1. Garante que o administrador está autenticado
  if (!auth.currentUser) {
    throw new Error("Usuário administrador não autenticado. Faça login novamente no painel antes de enviar arquivos.");
  }

  // Atualiza token de autenticação
  try {
    await auth.currentUser.getIdToken(false);
  } catch (tokenErr) {
    console.warn("Aviso ao validar token:", tokenErr);
  }

  const primaryBucket = config.firebase.storageBucket || `${config.firebase.projectId}.appspot.com`;
  const alternateBucket = primaryBucket.includes(".firebasestorage.app")
    ? primaryBucket.replace(".firebasestorage.app", ".appspot.com")
    : primaryBucket.replace(".appspot.com", ".firebasestorage.app");

  const candidateBuckets = [primaryBucket, alternateBucket].filter(Boolean);
  let lastError = null;

  for (const bucketName of candidateBuckets) {
    try {
      const storageInstance = st.getStorage(app, `gs://${bucketName}`);
      const fileRef = st.ref(storageInstance, path);
      const metadata = {
        contentType: blob.type || "image/webp",
        cacheControl: "public,max-age=31536000,immutable"
      };

      // Tenta upload direto via uploadBytes (evita pré-voo resumable do CORS em alguns navegadores)
      try {
        onProgress(0.3);
        const snapshot = await st.uploadBytes(fileRef, blob, metadata);
        onProgress(0.8);
        const downloadUrl = await st.getDownloadURL(snapshot.ref);
        onProgress(1.0);
        return { url: downloadUrl, bucket: bucketName, path };
      } catch (directErr) {
        // Se falhar o uploadBytes, tenta uploadBytesResumable
        return await new Promise((resolve, reject) => {
          const uploadTask = st.uploadBytesResumable(fileRef, blob, metadata);
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const progress = snapshot.bytesTransferred / (snapshot.totalBytes || 1);
              onProgress(progress);
            },
            (err) => reject(err),
            async () => {
              const downloadUrl = await st.getDownloadURL(uploadTask.snapshot.ref);
              resolve({ url: downloadUrl, bucket: bucketName, path });
            }
          );
        });
      }
    } catch (err) {
      lastError = err;
      console.warn(`Tentativa no bucket ${bucketName} falhou:`, err.message || err.code);
    }
  }

  // Mensagem diagnóstica detalhada e amigável para o administrador
  const errorMsg = lastError?.message || lastError?.code || "Falha de rede";
  let userFriendly = `Erro no upload da imagem (${errorMsg}).`;
  if (errorMsg.includes("CORS") || errorMsg.includes("ERR_FAILED") || errorMsg.includes("network") || errorMsg.includes("404")) {
    userFriendly = `Erro de conexão com o Firebase Storage.\n\nCausas prováveis:\n1. O serviço de Storage ainda não foi ativado no Console Firebase (abra a aba Storage e clique em "Começar").\n2. O bucket requer permissão de CORS (aplique o arquivo cors.json fornecido no projeto).\n3. Verifique se o nome do bucket em js/config.js confere com o Console Firebase.`;
  }

  throw new Error(userFriendly);
}

export { db, storage, auth, fs, st, au, config };
