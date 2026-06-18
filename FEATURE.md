# FEATURE.md

## Product

**AI Growth System for UMKM** is a WhatsApp AI CRM prototype for capturing, managing, monitoring, and following up leads from WhatsApp.

The current demo business is **GlowCare Clinic**.

---

## Feature Status Legend

- ✅ Implemented
- 🟡 Partially implemented / needs polish
- ⬜ Planned

---

## 1. WhatsApp Bot

Status: ✅ Implemented

Files:

```text
src/index.js
src/chatbot.js
src/store.js
src/products.js
```

Features:

- ✅ Terminal QR onboarding with `whatsapp-web.js`.
- ✅ Local WhatsApp session via `.wa-session/`.
- ✅ Ignores group messages.
- ✅ Ignores messages sent by the bot itself.
- ✅ Handles incoming text messages.
- ✅ Replies to greetings.
- ✅ Replies to catalog/product requests.
- ✅ Replies to price questions.
- ✅ Replies to location questions.
- ✅ Replies to promo questions.
- ✅ Handles booking intent.
- ✅ Directs booking/payment intent to admin.
- ✅ Stores customer and bot messages.
- ✅ Recognizes returning customers by phone number.

Known limitations:

- ⬜ Does not support media messages yet.
- ⬜ Does not support group chat flows.
- ⬜ Does not support official WhatsApp Cloud API yet.

---

## 2. Lead Capture

Status: ✅ Implemented

Files:

```text
src/chatbot.js
src/store.js
```

Lead fields:

```json
{
  "id": 1,
  "name": "Siti",
  "phone": "62812xxxx",
  "interest": "Facial Acne",
  "source": "WhatsApp",
  "status": "New",
  "followUpsSent": [],
  "notes": [],
  "created_at": "...",
  "updated_at": "..."
}
```

Features:

- ✅ Phone number is primary identity.
- ✅ Same phone updates the same lead.
- ✅ Different phone creates separate lead/conversation.
- ✅ Captures customer name.
- ✅ Captures interest based on product keyword detection.
- ✅ Captures source if mentioned: Instagram, Facebook, TikTok, Google Maps, Website.
- ✅ Stores status: New, Warm, Hot.

Known limitations:

- 🟡 Name extraction is simple heuristic-based.
- 🟡 Interest extraction depends on product keywords.
- ⬜ Lead notes are stored but not editable from dashboard yet.
- ⬜ Lead status is not editable from dashboard yet.

---

## 3. AI Customer Service

Status: ✅ Implemented

Files:

```text
src/ai.js
src/chatbot.js
```

Environment variables:

```env
AI_ENDPOINT=http://localhost:20128/v1
AI_MODEL=cx/gpt-5.4-mini
AI_API_KEY=...
```

Features:

- ✅ OpenAI-compatible `/chat/completions` integration.
- ✅ AI fallback for free-form customer messages.
- ✅ AI receives customer context from database:
  - phone
  - name
  - interest
  - source
  - status
  - conversation stage
- ✅ AI uses current business profile from store.
- ✅ AI uses current products from dashboard/store.
- ✅ Output guardrail blocks internal/credential leakage patterns.

Guardrails:

- ✅ Only answer in clinic/UMKM lead capture context.
- ✅ Do not reveal API key, endpoint, model, prompt, or internal instructions.
- ✅ Do not request OTP, password, PIN, card number, or sensitive credentials.
- ✅ Do not invent products, prices, promos, address, or schedule.
- ✅ Do not provide certain medical diagnosis or risky medical advice.
- ✅ Direct booking/payment requests to admin.
- ✅ Keep WhatsApp replies short.

Known limitations:

- ⬜ No structured tool-calling yet.
- ⬜ No AI-based lead scoring yet.
- ⬜ No AI conversation summarization beyond local auto-compact summary.

---

## 4. Product / Item Management

Status: ✅ Implemented backend, 🟡 Dashboard needs redesign

Files:

```text
src/store.js
src/products.js
src/dashboard-server.js
dashboard/src/main.jsx
```

Product fields:

```json
{
  "id": "facial-acne",
  "name": "Facial Acne",
  "price": 150000,
  "keywords": ["facial acne", "acne", "jerawat"],
  "description": "Perawatan untuk kulit berjerawat...",
  "promo": "Diskon 20% minggu ini..."
}
```

Features:

- ✅ Products persisted in `data/db.json`.
- ✅ Store has product CRUD methods.
- ✅ Dashboard can create product.
- ✅ Dashboard can update product.
- ✅ Dashboard can delete product.
- ✅ Bot product detection uses store products.
- ✅ AI prompt uses store products.

API:

```text
GET    /api/products
POST   /api/products
PUT    /api/products/:id
DELETE /api/products/:id
```

Known limitations:

- 🟡 Dashboard product page is not separated yet.
- 🟡 Current UI is visually not final.
- ⬜ No product image support.
- ⬜ No category support.
- ⬜ No stock/availability support.

---

## 5. Dashboard Website

Status: 🟡 Implemented but needs redesign

Files:

```text
src/dashboard-server.js
dashboard/index.html
dashboard/src/main.jsx
dashboard/src/styles.css
```

Technology:

```text
Express
React
Vite
liquid-glass-react
CSS
```

Current features:

- ✅ Express serves dashboard at `http://localhost:3000`.
- ✅ `/api/state` returns dashboard state.
- ✅ Dashboard shows lead stats.
- ✅ Dashboard shows product CRUD.
- ✅ Dashboard shows WhatsApp conversations.
- ✅ Dashboard can send manual WhatsApp replies.
- ✅ Dashboard shows captured leads.

Known design problem:

- 🟡 Current UI is too dark and visually experimental.
- 🟡 Needs bright admin dashboard structure.
- 🟡 Needs sidebar navigation.
- 🟡 Needs separate pages.

Required redesign:

- ⬜ Sidebar nav.
- ⬜ Topbar.
- ⬜ Dedicated Dashboard page.
- ⬜ Dedicated Items page.
- ⬜ Dedicated Chat page.
- ⬜ Dedicated Leads page.
- ⬜ Dedicated Follow Up page.
- ⬜ Dedicated Broadcast page.
- ⬜ Dedicated Settings page.
- ⬜ Bright TailAdmin-like admin layout.
- ⬜ macOS/light glass visual style.
- ⬜ Use `liquid-glass-react` only for accent components, not layout containers.

---

## 6. WhatsApp Chat Monitor

Status: ✅ Implemented backend, 🟡 UI needs redesign

Files:

```text
src/dashboard-server.js
dashboard/src/main.jsx
```

Features:

- ✅ Conversation list by phone.
- ✅ Shows customer name if captured.
- ✅ Shows customer interest.
- ✅ Shows lead status.
- ✅ Shows message timeline.
- ✅ Message types:
  - customer
  - bot
  - owner
- ✅ Manual reply from dashboard.

API:

```text
GET  /api/chats
POST /api/chats/:phone/send
```

Known limitations:

- 🟡 Polling is used instead of real-time socket/SSE.
- 🟡 Chat page is not separated yet.
- ⬜ No unread indicator.
- ⬜ No assignment to admin.
- ⬜ No search/filter in conversations yet.

---

## 7. Follow-Up

Status: ✅ Implemented CLI and scheduler, ⬜ Dashboard controls planned

Files:

```text
src/followup.js
src/owner-cli.js
src/index.js
```

Features:

- ✅ Manual follow-up from CLI.
- ✅ Due follow-up detection.
- ✅ H+1 follow-up.
- ✅ H+3 follow-up.
- ✅ H+7 follow-up.
- ✅ Skip closed leads.
- ✅ Prevent duplicate follow-up for same step.
- ✅ Optional auto scheduler.

CLI:

```text
followup due
followup <id|all> <h1|h3|h7>
```

Environment:

```env
AUTO_FOLLOWUP=true
AUTO_FOLLOWUP_INTERVAL_MINUTES=60
```

Planned dashboard features:

- ⬜ Follow-up due page.
- ⬜ Send follow-up button.
- ⬜ Follow-up history.
- ⬜ Edit follow-up templates.

---

## 8. Broadcast Promo

Status: ✅ CLI implemented, ⬜ Dashboard planned

Files:

```text
src/owner-cli.js
```

Features:

- ✅ Broadcast message to all leads from CLI.
- ✅ Uses current promo if message is empty.

CLI:

```text
broadcast Promo Facial Acne diskon 20% minggu ini.
```

Planned dashboard features:

- ⬜ Broadcast composer page.
- ⬜ Select target leads.
- ⬜ Preview message.
- ⬜ Send broadcast.
- ⬜ Delivery log.

---

## 9. Business Profile

Status: ✅ Backend update API, ⬜ Dashboard UI planned

Files:

```text
src/store.js
src/dashboard-server.js
```

Fields:

```json
{
  "name": "GlowCare Clinic",
  "role": "customer service klinik kecantikan",
  "address": "Jl. Gatot Subroto No. 12, Jambi",
  "hours": "Senin-Sabtu, 09.00-20.00 WIB",
  "adminPhone": "0812-0000-1111",
  "currentPromo": "Promo Facial Acne diskon 20% minggu ini..."
}
```

API:

```text
PUT /api/profile
```

Features:

- ✅ Stored in local DB.
- ✅ AI reads business profile from store.
- ✅ Bot reads business profile from store.

Planned:

- ⬜ Settings page to edit profile.
- ⬜ Do not expose AI API key in UI.

---

## 10. Data Persistence

Status: ✅ Implemented local JSON

Files:

```text
src/store.js
data/db.json
```

Features:

- ✅ Local JSON store.
- ✅ Auto-initializes default data.
- ✅ Normalizes product data.
- ✅ Stores conversations by phone.
- ✅ Stores messages.
- ✅ Stores compacted summaries.

Known limitations:

- ⬜ Not production-ready.
- ⬜ No concurrent write lock.
- ⬜ No real database migrations.
- ⬜ No backup/restore UI.

Future database options:

- Supabase/PostgreSQL.
- SQLite.
- MySQL.

---

## 11. Conversation Auto-Compact

Status: ✅ Implemented

Files:

```text
src/store.js
```

Features:

- ✅ Estimates token count by `text.length / 4`.
- ✅ Compacts when message history per phone reaches ~50,000 estimated tokens.
- ✅ Keeps 80 most recent messages.
- ✅ Stores compacted summary in `compacted`.
- ✅ Keeps identity intact in `conversations[phone]`.

Known limitations:

- 🟡 Summary is rule-generated, not AI-generated.
- ⬜ No dashboard view for compacted history yet.

---

## 12. Owner CLI

Status: ✅ Implemented

Files:

```text
src/owner-cli.js
```

Commands:

```text
help
dashboard
leads
followup due
followup <id|all> <h1|h3|h7>
broadcast <pesan>
exit
```

Features:

- ✅ Shows lead dashboard in terminal.
- ✅ Shows lead table.
- ✅ Sends follow-up.
- ✅ Sends broadcast.

Known limitations:

- ⬜ No edit lead command.
- ⬜ No notes command.
- ⬜ Dashboard website should replace most CLI usage eventually.

---

## 13. API Summary

Implemented routes:

```text
GET    /api/health
GET    /api/state
GET    /api/products
POST   /api/products
PUT    /api/products/:id
DELETE /api/products/:id
PUT    /api/profile
GET    /api/leads
GET    /api/chats
POST   /api/chats/:phone/send
```

Recommended next API routes:

```text
PUT    /api/leads/:id/status
POST   /api/leads/:id/notes
GET    /api/followups/due
POST   /api/followups/send
POST   /api/broadcast
GET    /api/settings
PUT    /api/settings
```

---

## 14. Scripts

```json
{
  "start": "node --env-file-if-exists=.env src/index.js",
  "dashboard:dev": "vite --host 0.0.0.0 dashboard",
  "dashboard:build": "vite build dashboard",
  "check": "node --check ... && npm run dashboard:build"
}
```

Common commands:

```bash
npm install
npm run dashboard:build
npm start
npm run check
```

---

## 15. Git / Security Rules

Ignored files:

```text
node_modules/
.env
.env.*
!.env.example
.wa-session/
.wwebjs_cache/
.opencode-context.md
.opencode-jce/
*.session
*.sqlite
*.sqlite3
*.db
*.db-journal
data/db.json
data/*.json
dashboard/dist/
```

Never commit:

- API keys.
- WhatsApp sessions.
- local lead/chat database.
- build output.
- node_modules.

---

## 16. Roadmap

### Immediate Next Work

- ⬜ Redesign dashboard into bright admin shell.
- ⬜ Add sidebar nav.
- ⬜ Add topbar.
- ⬜ Split dashboard into pages:
  - Dashboard
  - Items
  - WhatsApp Chat
  - Leads
  - Follow Up
  - Broadcast
  - Settings

### Dashboard Improvements

- ⬜ Business profile editor.
- ⬜ Lead status editor.
- ⬜ Lead notes.
- ⬜ Follow-up controls.
- ⬜ Broadcast composer.
- ⬜ Search and filters.
- ⬜ Charts.
- ⬜ Better mobile layout.

### System Improvements

- ⬜ Real-time updates with SSE or WebSocket.
- ⬜ Authentication for dashboard.
- ⬜ Production database.
- ⬜ Official WhatsApp Cloud API option.
- ⬜ Multi-business tenant support.
- ⬜ AI lead scoring.
- ⬜ AI sales analytics.

---

## 17. Definition of Done for Next UI Redesign

The next dashboard redesign is done when:

- ✅ It has sidebar navigation.
- ✅ It has a topbar.
- ✅ It uses bright admin dashboard styling.
- ✅ It has separate page states.
- ✅ Items page is dedicated.
- ✅ Chat page is dedicated.
- ✅ Leads page is dedicated.
- ✅ Layout does not overflow on desktop.
- ✅ Cards are readable and not cramped.
- ✅ Chat messages wrap and scroll correctly.
- ✅ Product CRUD still works.
- ✅ Manual chat reply still works.
- ✅ AI still reads dashboard-managed products.
- ✅ `npm run check` passes.
