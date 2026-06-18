# DESIGN.md

## Project Name

**AI Growth System for UMKM**

A WhatsApp-based AI CRM prototype for small businesses/UMKM.

---

## 1. Product Summary

This project is a demo SaaS-style system that helps UMKM capture, manage, and follow up leads from WhatsApp.

Core flow:

```text
Customer discovers business
↓
Customer chats WhatsApp
↓
AI bot replies automatically
↓
Lead is captured
↓
Lead appears in dashboard
↓
Owner/admin monitors chat
↓
Owner/admin follows up
↓
Customer is moved toward booking/closing
```

The current demo business is:

```text
GlowCare Clinic
```

A beauty clinic used as dummy business context.

The system should later be adaptable to other UMKM types such as salons, dental clinics, workshops, courses, real estate, travel, or local service businesses.

---

## 2. Target User

### Primary User

UMKM owner or admin who receives many WhatsApp inquiries and needs a simple system to:

- reply faster
- capture leads
- organize customer interest
- follow up manually or automatically
- broadcast promos
- understand which leads are hot/warm/new

### Customer User

A potential buyer chatting through WhatsApp.

Customer expectations:

- fast replies
- clear product/service info
- price info
- promo info
- location info
- easy booking handoff to admin

---

## 3. Core Jobs To Be Done

### For UMKM Owner/Admin

1. See lead statistics quickly.
2. Manage products/items/services.
3. Monitor incoming WhatsApp conversations.
4. Reply manually from dashboard when needed.
5. See captured customer data.
6. Follow up leads.
7. Broadcast promos.
8. Trust that AI uses the latest product data.

### For Customer

1. Ask questions through WhatsApp.
2. Get product/service info instantly.
3. Share name and needs naturally.
4. Be directed to admin when ready to book.

---

## 4. System Components

### 4.1 WhatsApp Bot

Technology:

```text
Node.js
whatsapp-web.js
qrcode-terminal
```

Purpose:

- Connect to WhatsApp through terminal QR scan.
- Receive incoming messages.
- Send automatic replies.
- Save messages to local DB.
- Capture lead data.
- Recognize returning customers by phone number.

Session storage:

```text
.wa-session/
```

This must never be committed.

---

### 4.2 AI Customer Service

AI uses an OpenAI-compatible endpoint.

Environment variables:

```env
AI_ENDPOINT=http://localhost:20128/v1
AI_MODEL=cx/gpt-5.4-mini
AI_API_KEY=...
```

AI is used only for fallback/free-form replies.

Deterministic code still handles:

- product detection
- price/catalog replies
- lead capture
- source/status update
- follow-up status
- saving database

AI must use current product data from the dashboard/local store.

---

### 4.3 Store / Local Database

Current persistence:

```text
data/db.json
```

Main structures:

```json
{
  "businessProfile": {},
  "products": [],
  "leads": [],
  "conversations": {},
  "messages": [],
  "compacted": []
}
```

Important rules:

- `phone` is the main identity key.
- Same phone = same customer/conversation.
- Different phone = different customer/conversation.
- `data/*.json` must be ignored from Git.

---

### 4.4 Dashboard Web App

Technology:

```text
React
Vite
Express
liquid-glass-react
CSS
```

Dashboard served by Express:

```text
http://localhost:3000
```

Dashboard source:

```text
dashboard/
```

Build output:

```text
dashboard/dist/
```

Build output is ignored.

---

## 5. Current Features

### WhatsApp Bot

- QR login from terminal.
- Auto replies:
  - greeting
  - catalog
  - price
  - product details
  - promo
  - location
  - booking handoff
- Lead capture:
  - name
  - phone
  - interest
  - source
  - status
- Lead scoring:
  - New
  - Warm
  - Hot
- Returning customer recognition.
- Message persistence.
- Auto-compact for long message history.

### AI

- OpenAI-compatible `/chat/completions`.
- Uses guarded system prompt.
- Reads product catalog from store/dashboard.
- Rejects out-of-context topics.
- Avoids sensitive data requests.
- Avoids internal disclosure.

### Follow-Up

Manual CLI:

```text
followup due
followup <id|all> <h1|h3|h7>
```

Optional auto follow-up:

```env
AUTO_FOLLOWUP=true
AUTO_FOLLOWUP_INTERVAL_MINUTES=60
```

Rules:

- `h1`: after 1 day
- `h3`: after 3 days
- `h7`: after 7 days
- no duplicate follow-up for same step
- closed leads are skipped

### Dashboard

Current dashboard includes:

- stats cards
- product CRUD
- WhatsApp chat monitor
- manual reply
- lead table

Current dashboard needs redesign.

---

## 6. Desired Dashboard Redesign

The dashboard should look like a **bright modern admin dashboard** inspired by layouts like TailAdmin, but with a refined **liquid glass / macOS** visual style.

The current dark full-page glass layout is not good enough.

### Desired Visual Direction

- Bright background.
- Clean admin layout.
- Sidebar navigation.
- Topbar with search/actions/avatar.
- Content pages separated clearly.
- White or near-white glass cards.
- Subtle blue/purple accent.
- Soft borders.
- Large whitespace.
- Clear hierarchy.
- Polished SaaS feel.
- Liquid glass used tastefully, not for unstable layout containers.

Reference style:

```text
TailAdmin-like structure
+
macOS glass styling
+
liquid-glass-react accents
```

---

## 7. Dashboard Layout Requirements

### 7.1 Global Layout

Use a stable app shell:

```text
+--------------------------------------------------+
| Sidebar | Topbar                                 |
|         +----------------------------------------+
|         | Page content                           |
|         |                                        |
+--------------------------------------------------+
```

Sidebar should be fixed/sticky on desktop.

Topbar should be sticky or visually persistent.

Main content should scroll independently if needed.

---

### 7.2 Sidebar

Sidebar sections:

```text
AI Growth
- Dashboard
- Items / Products
- WhatsApp Chat
- Leads / CRM
- Follow Up
- Broadcast
- Settings
```

Sidebar requirements:

- Logo/title at top.
- Active nav item highlight.
- Icons can be simple Unicode/SVG/CSS placeholders.
- Collapsed mode optional, not required.
- Mobile behavior can be stacked or hidden behind menu later.

---

### 7.3 Topbar

Topbar should include:

- Current page title.
- Search input placeholder:
  ```text
  Search customer, phone, product...
  ```
- Small status pill:
  ```text
  WhatsApp Connected / Waiting
  ```
- Notification icon placeholder.
- Avatar/admin profile placeholder.

---

## 8. Dashboard Pages

### 8.1 Dashboard Page

Purpose:

Show high-level metrics and business health.

Content:

- Lead Hari Ini
- Lead Bulan Ini
- Hot Lead
- Warm Lead
- New Lead
- Total Conversations
- Mini chart placeholder for leads over time
- Recent leads table
- Recent chats preview
- Follow-up due count

Visual:

- Bright cards.
- Soft shadows.
- Glass panels.
- Blue/purple accent.

---

### 8.2 Items / Products Page

Purpose:

Manage items/services that the bot and AI use.

Content:

- Product list table/cards.
- Add product form.
- Edit product.
- Delete product.
- Fields:
  - name
  - price
  - keywords
  - description
  - promo

Important behavior:

- Product changes update `store.products`.
- Bot product detection uses updated products.
- AI prompt uses updated products.
- After save, show notice:
  ```text
  Produk tersimpan. AI akan memakai katalog terbaru.
  ```

Design:

- This page should be dedicated, not squeezed beside chat.
- Product form should be clean and spacious.
- Product table/card should not overflow.

---

### 8.3 WhatsApp Chat Page

Purpose:

Monitor and respond to WhatsApp conversations.

Content:

```text
Left column:
- conversation list
- customer name or phone
- interest
- status
- last message preview

Right column:
- chat header
- customer name
- phone
- status
- message timeline
- reply input
```

Message bubble types:

- customer
- bot
- owner/admin

Requirements:

- Chat panel must not overflow outside card.
- Long messages should wrap.
- Message area should scroll.
- Reply input fixed at bottom of chat panel.
- Sending reply calls:
  ```text
  POST /api/chats/:phone/send
  ```

---

### 8.4 Leads / CRM Page

Purpose:

Manage captured leads.

Content:

- Lead table:
  - name
  - phone
  - interest
  - source
  - status
  - created_at
  - followUpsSent
- Status filter:
  - All
  - New
  - Warm
  - Hot
  - Closed
- Search by name/phone/interest.
- Future: edit status and notes.

---

### 8.5 Follow Up Page

Purpose:

Control follow-up workflow.

Content:

- Due follow-ups:
  - lead
  - phone
  - interest
  - status
  - due step: h1/h3/h7
- Button to send follow-up manually.
- Auto follow-up status display.
- Environment hint:
  ```env
  AUTO_FOLLOWUP=true
  ```

---

### 8.6 Broadcast Page

Purpose:

Send promo broadcast to lead list.

Content:

- Promo message composer.
- Lead target summary.
- Send broadcast button.
- Delivery log placeholder.

Important:

- Keep broadcast action explicit.
- Do not auto-send broadcast without user click.

---

### 8.7 Settings Page

Purpose:

Manage business profile and AI settings.

Content:

- Business name.
- Address.
- Opening hours.
- Admin phone.
- Current promo.
- AI endpoint/model display.
- Guardrail summary.

Do not expose API key value in UI.

---

## 9. Visual Design System

### Color Direction

Use bright admin dashboard colors:

```text
Background: #F6F8FC / #F8FAFF
Card: rgba(255,255,255,0.75)
Border: rgba(15,23,42,0.08)
Text primary: #0F172A
Text secondary: #64748B
Accent blue: #4F6BFF
Accent purple: #8B5CF6
Success: #10B981
Warning: #F59E0B
Danger: #EF4444
```

### Typography

Use system/macOS fonts:

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
```

### Card Style

Cards should feel like light glass:

```css
background: rgba(255, 255, 255, 0.72);
backdrop-filter: blur(24px) saturate(160%);
border: 1px solid rgba(15, 23, 42, 0.08);
box-shadow: 0 20px 60px rgba(15, 23, 42, 0.08);
border-radius: 24px;
```

### Liquid Glass Usage

`liquid-glass-react` should be used for:

- primary CTA buttons
- small stat highlights
- active sidebar item
- floating status chips

Avoid using `LiquidGlass` for:

- full page layout
- large grid wrappers
- scroll containers
- table wrappers
- chat timeline wrapper

Reason:

Large layout usage previously caused visual overlap and unstable positioning.

---

## 10. API Surface

Current API routes:

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

Future API routes recommended:

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

## 11. Data Ownership Rules

Dashboard product data is the source of truth for product catalog.

Bot and AI must not maintain a separate product catalog.

Correct flow:

```text
Dashboard edits product
↓
Store saves product in data/db.json
↓
Bot uses store.getProducts()
↓
AI prompt uses store.getProducts()
```

This ensures AI always uses the dashboard-managed product data.

---

## 12. Security / Git Ignore Rules

Never commit:

```text
.env
.env.* except .env.example
.wa-session/
.wwebjs_cache/
data/*.json
dashboard/dist/
node_modules/
```

Reason:

- `.env` contains API keys.
- `.wa-session/` contains WhatsApp credentials/session.
- `data/*.json` may contain customer data.
- `dashboard/dist/` is build output.
- `node_modules/` is dependency output.

---

## 13. Run Commands

Install:

```bash
npm install
```

Build dashboard:

```bash
npm run dashboard:build
```

Run full app:

```bash
npm start
```

Open dashboard:

```text
http://localhost:3000
```

Dashboard dev mode:

```bash
npm run dashboard:dev
```

Verify:

```bash
npm run check
```

---

## 14. Implementation Priorities

### Priority 1

Redesign dashboard layout into a real admin shell:

- sidebar
- topbar
- separate pages
- bright design
- no visual overlap

### Priority 2

Create page routing/state:

- Dashboard
- Items
- Chat
- Leads
- Follow Up
- Broadcast
- Settings

Can be simple client-side state first. React Router is optional.

### Priority 3

Improve dashboard functionality:

- lead status editing
- business profile editor
- follow-up due controls
- broadcast composer

### Priority 4

Improve real-time behavior:

- replace polling with SSE or WebSocket
- show WhatsApp connection status accurately

### Priority 5

Add authentication for dashboard.

---

## 15. Definition of Done for Dashboard Redesign

Dashboard redesign is done when:

- It no longer looks like a dark full-page visual experiment.
- It has a clear admin dashboard structure.
- Sidebar nav is present.
- Topbar is present.
- Products are on a dedicated page.
- Chat is on a dedicated page.
- Leads are on a dedicated page.
- Layout works at desktop width without overlap.
- Cards and tables do not overflow.
- `npm run dashboard:build` passes.
- `npm run check` passes.
- AI still reads products from dashboard-managed store.
- WhatsApp session and credentials remain ignored.

---

## 16. Notes for Future Agents

Before making changes:

```bash
git status --short
git log --oneline -10
```

After making changes:

```bash
npm run check
```

If changing dashboard UI:

```bash
npm run dashboard:build
```

Commit only intended source files.

Do not commit:

- `.env`
- `.wa-session/`
- `.wwebjs_cache/`
- `data/*.json`
- `dashboard/dist/`

---

## 17. Current Known Design Issue

The previous dashboard visual attempt was too dark and structurally weak.

Problems observed:

- Cards looked visually floating without admin structure.
- No sidebar navigation.
- Product and chat panels were cramped together.
- Chat content overflowed.
- Product cards were squeezed.
- The layout looked like a visual art board rather than an admin dashboard.

The next redesign should move toward:

```text
Bright SaaS admin dashboard
+
TailAdmin-like structure
+
macOS liquid glass accents
```
