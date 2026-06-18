import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWhatsAppSessionTracker } from './whatsapp-session.js';

test('tracks WhatsApp session lifecycle without exposing the raw QR payload', () => {
  const tracker = createWhatsAppSessionTracker({
    sessionPath: '.wa-session',
    hasLocalSession: () => true,
    now: () => '2026-06-18T11:00:00.000Z'
  });

  assert.equal(tracker.snapshot().hasLocalSession, true);
  assert.equal(tracker.snapshot().status, 'initializing');

  tracker.markQr('raw-qr-secret', { qrImage: 'data:image/png;base64,abc123' });
  assert.equal(tracker.snapshot().status, 'qr');
  assert.equal(tracker.snapshot().qrAvailable, true);
  assert.equal(tracker.snapshot().qrImage, 'data:image/png;base64,abc123');
  assert.equal(Object.hasOwn(tracker.snapshot(), 'qr'), false);

  tracker.markAuthenticated();
  assert.equal(tracker.snapshot().status, 'authenticated');

  tracker.markReady({ wid: { user: '6281234567890' }, pushname: 'GlowCare Bot' });
  assert.equal(tracker.snapshot().status, 'ready');
  assert.equal(tracker.snapshot().connected, true);
  assert.equal(tracker.snapshot().accountName, 'GlowCare Bot');
  assert.equal(tracker.snapshot().phone, '6281234567890');

  tracker.markDisconnected('LOGOUT');
  assert.equal(tracker.snapshot().status, 'disconnected');
  assert.equal(tracker.snapshot().connected, false);
  assert.equal(tracker.snapshot().lastDisconnectReason, 'LOGOUT');
});
