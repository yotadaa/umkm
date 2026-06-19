export async function initializeWhatsAppClient({
  client,
  whatsappSession,
  maxRetries = Number(process.env.WA_INIT_RETRIES || 3),
  retryDelayMs = Number(process.env.WA_INIT_RETRY_MS || 10000),
  wait = defaultWait,
  logger = console
} = {}) {
  let attempts = 0;
  let lastError = null;

  while (attempts <= maxRetries) {
    attempts += 1;

    try {
      await client.initialize();
      return { ok: true, attempts };
    } catch (error) {
      lastError = error;
      whatsappSession?.markError?.(error);

      if (attempts > maxRetries) break;

      logger.warn(`WhatsApp init gagal (${attempts}/${maxRetries + 1}): ${error.message}. Coba lagi dalam ${Math.round(retryDelayMs / 1000)} detik.`);
      await wait(retryDelayMs);
    }
  }

  logger.error('Gagal menginisialisasi WhatsApp setelah retry:', lastError?.stack || lastError);
  return { ok: false, attempts, error: lastError };
}

function defaultWait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
