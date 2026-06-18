import { existsSync } from 'node:fs';

export function createWhatsAppSessionTracker({
  sessionPath = '.wa-session',
  hasLocalSession = existsSync,
  now = () => new Date().toISOString()
} = {}) {
  const state = {
    status: 'initializing',
    connected: false,
    hasLocalSession: Boolean(hasLocalSession(sessionPath)),
    sessionPath,
    qrAvailable: false,
    qrImage: null,
    qrReceivedAt: null,
    authenticatedAt: null,
    readyAt: null,
    disconnectedAt: null,
    lastDisconnectReason: null,
    lastError: null,
    accountName: null,
    phone: null,
    updatedAt: now()
  };

  function update(patch) {
    Object.assign(state, patch, {
      hasLocalSession: Boolean(hasLocalSession(sessionPath)),
      updatedAt: now()
    });
  }

  return {
    markQr(rawQr, { qrImage = null } = {}) {
      update({
        status: 'qr',
        connected: false,
        qrAvailable: true,
        qrImage,
        qrReceivedAt: now(),
        lastError: null
      });
    },
    markAuthenticated() {
      update({
        status: 'authenticated',
        qrAvailable: false,
        qrImage: null,
        authenticatedAt: now(),
        lastError: null
      });
    },
    markReady(info = {}) {
      update({
        status: 'ready',
        connected: true,
        qrAvailable: false,
        qrImage: null,
        readyAt: now(),
        lastDisconnectReason: null,
        lastError: null,
        accountName: info.pushname || info.me?.pushname || null,
        phone: info.wid?.user || info.me?.user || null
      });
    },
    markAuthFailure(message) {
      update({
        status: 'auth_failure',
        connected: false,
        qrAvailable: false,
        qrImage: null,
        lastError: String(message || 'Authentication failed')
      });
    },
    markDisconnected(reason) {
      update({
        status: 'disconnected',
        connected: false,
        qrAvailable: false,
        qrImage: null,
        disconnectedAt: now(),
        lastDisconnectReason: String(reason || 'Unknown')
      });
    },
    snapshot() {
      return { ...state };
    }
  };
}
