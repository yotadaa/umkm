import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const emptyProduct = { name: '', price: '', keywords: '', description: '', promo: '' };
const followUpSteps = [
  { key: 'h1', title: 'Follow-Up H+1', tone: 'blue' },
  { key: 'h3', title: 'Follow-Up H+3', tone: 'orange' },
  { key: 'h7', title: 'Re-engagement H+7', tone: 'slate' }
];

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', short: 'Home' },
  { id: 'products', label: 'Produk', icon: 'inventory_2', short: 'Produk' },
  { id: 'chat', label: 'WhatsApp Chat', icon: 'chat', short: 'Chat' },
  { id: 'leads', label: 'Leads/CRM', icon: 'groups', short: 'Leads' },
  { id: 'followup', label: 'Follow Up', icon: 'history_toggle_off', short: 'Follow' },
  { id: 'broadcast', label: 'Broadcast', icon: 'campaign', short: 'Broadcast' },
  { id: 'settings', label: 'Pengaturan', icon: 'settings', short: 'Menu' }
];

function App() {
  const [state, setState] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [activePage, setActivePage] = useState('dashboard');
  const [selectedPhone, setSelectedPhone] = useState(null);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [editingId, setEditingId] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [reply, setReply] = useState('');
  const [notice, setNotice] = useState('');
  const [leadQuery, setLeadQuery] = useState('');
  const [leadStatusFilter, setLeadStatusFilter] = useState('All');
  const [profileForm, setProfileForm] = useState(null);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastNotice, setBroadcastNotice] = useState('');
  const [followupNotice, setFollowupNotice] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  async function loadState() {
    try {
      const response = await fetch('/api/state');
      if (!response.ok) throw new Error('Gagal memuat data dashboard');
      const payload = await response.json();
      setState(payload);
      setLoadError('');
    } catch (error) {
      setLoadError(error.message);
    }
  }

  useEffect(() => {
    loadState();
    const timer = setInterval(loadState, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (state?.businessProfile) setProfileForm(state.businessProfile);
    if (state?.businessProfile?.currentPromo && !broadcastMessage) {
      setBroadcastMessage(state.businessProfile.currentPromo);
    }
  }, [state?.businessProfile, broadcastMessage]);

  const conversations = state?.conversations || {};
  const chatPhones = useMemo(() => sortPhonesByConversation(conversations), [conversations]);
  const activePhone = selectedPhone || chatPhones[0] || null;
  const activeConversation = activePhone ? conversations[activePhone] : null;
  const activeLead = activePhone ? (state?.leads || []).find((lead) => lead.phone === activePhone) : null;
  const activeMessages = useMemo(
    () => (state?.messages || []).filter((message) => message.phone === activePhone),
    [state?.messages, activePhone]
  );
  const stats = useMemo(() => buildStats(state?.leads || [], conversations), [state?.leads, conversations]);
  const dueItems = useMemo(() => buildDueFollowUps(state?.leads || []), [state?.leads]);
  const filteredLeads = useMemo(
    () => filterLeads(state?.leads || [], leadStatusFilter, leadQuery),
    [state?.leads, leadStatusFilter, leadQuery]
  );
  const selectedProduct = useMemo(
    () => (state?.products || []).find((product) => product.id === selectedProductId) || null,
    [state?.products, selectedProductId]
  );

  async function saveProduct(event) {
    event.preventDefault();
    const payload = normalizeProductForm(productForm);
    const url = editingId ? `/api/products/${editingId}` : '/api/products';
    const method = editingId ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json();
      setNotice(error.error || 'Gagal menyimpan produk');
      return;
    }

    setProductForm(emptyProduct);
    setEditingId(null);
    setNotice('Produk tersimpan. AI akan memakai katalog terbaru.');
    await loadState();
  }

  async function deleteProduct(id) {
    if (!confirm('Hapus produk ini?')) return;
    const response = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    setNotice(response.ok ? 'Produk dihapus dari katalog AI.' : 'Gagal menghapus produk.');
    await loadState();
  }

  async function sendOwnerReply(event) {
    event.preventDefault();
    if (!activePhone || !reply.trim()) return;

    const response = await fetch(`/api/chats/${activePhone}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: reply })
    });

    if (!response.ok) {
      const error = await response.json();
      setNotice(error.error || 'Gagal mengirim balasan');
      return;
    }

    setReply('');
    await loadState();
  }

  async function shareProductMedia(phone, productId) {
    if (!phone || !productId) return;

    const response = await fetch(`/api/products/${productId}/media/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });

    if (!response.ok) {
      const error = await response.json();
      setNotice(error.error || 'Gagal share foto produk.');
      return;
    }

    const result = await response.json();
    setNotice(`${result.sent.length} foto produk terkirim ke customer.`);
    await loadState();
  }

  async function addProductMedia(productId, media) {
    const response = await fetch(`/api/products/${productId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(media)
    });

    if (!response.ok) {
      const error = await response.json();
      setNotice(error.error || 'Gagal menambahkan foto produk.');
      return false;
    }

    setNotice('Foto produk tersimpan ke katalog dan database.');
    await loadState();
    return true;
  }

  async function deleteProductMedia(productId, mediaId) {
    const response = await fetch(`/api/products/${productId}/media/${mediaId}`, { method: 'DELETE' });

    if (!response.ok) {
      const error = await response.json();
      setNotice(error.error || 'Gagal menghapus foto produk.');
      return;
    }

    setNotice('Foto produk dihapus dari katalog.');
    await loadState();
  }

  async function updateLeadStatus(id, status) {
    const response = await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });

    if (!response.ok) {
      setNotice('Gagal mengubah status lead.');
      return;
    }

    await loadState();
  }

  async function sendFollowUp(leadId, day) {
    const response = await fetch('/api/followups/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, day })
    });

    if (!response.ok) {
      const error = await response.json();
      setFollowupNotice(error.error || 'Gagal mengirim follow-up.');
      return;
    }

    setFollowupNotice('Follow-up terkirim dan riwayat lead diperbarui.');
    await loadState();
  }

  async function sendBroadcast(event) {
    event.preventDefault();
    const response = await fetch('/api/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: broadcastMessage })
    });

    if (!response.ok) {
      const error = await response.json();
      setBroadcastNotice(error.error || 'Gagal mengirim broadcast.');
      return;
    }

    const result = await response.json();
    setBroadcastNotice(`Broadcast terkirim ke ${result.sent.length} lead aktif.`);
    await loadState();
  }

  async function saveProfile(event) {
    event.preventDefault();
    const response = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileForm || {})
    });

    if (!response.ok) {
      setNotice('Gagal menyimpan pengaturan bisnis.');
      return;
    }

    setNotice('Pengaturan bisnis tersimpan. AI memakai profil terbaru.');
    await loadState();
  }

  function goToPage(page) {
    setActivePage(page);
    if (page !== 'product-detail') setSelectedProductId(null);
    setMobileNavOpen(false);
  }

  function openProductDetail(productId) {
    setSelectedProductId(productId);
    setActivePage('product-detail');
    setMobileNavOpen(false);
  }

  if (!state) {
    return <LoadingScreen error={loadError} onRetry={loadState} />;
  }

  const pageTitle = activePage === 'product-detail'
    ? selectedProduct?.name || 'Detail Produk'
    : navItems.find((item) => item.id === activePage)?.label || 'Dashboard';

  return (
    <div className="app-frame">
      <Sidebar
        activePage={activePage === 'product-detail' ? 'products' : activePage}
        businessName={state.businessProfile.name}
        chatCount={chatPhones.length}
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        onNavigate={goToPage}
      />
      <section className="main-shell">
        <Topbar
          pageTitle={pageTitle}
          whatsapp={state.whatsapp}
          onMenu={() => setMobileNavOpen(true)}
          onNavigate={goToPage}
        />
        <main className="content-canvas">
          <WhatsAppConnectPanel whatsapp={state.whatsapp} onRefresh={loadState} />
          {loadError && <Notice tone="danger">{loadError}</Notice>}
          {notice && <Notice onDismiss={() => setNotice('')}>{notice}</Notice>}
          {activePage === 'dashboard' && (
            <DashboardPage
              businessName={state.businessProfile.name}
              stats={stats}
              leads={state.leads}
              messages={state.messages}
              products={state.products}
              dueItems={dueItems}
              whatsapp={state.whatsapp}
              onNavigate={goToPage}
            />
          )}
          {activePage === 'products' && (
            <ProductsPage
              editingId={editingId}
              form={productForm}
              notice={notice}
              products={state.products}
              onCancelEdit={() => {
                setEditingId(null);
                setProductForm(emptyProduct);
              }}
              onDelete={deleteProduct}
              onEdit={(product) => {
                setEditingId(product.id);
                setProductForm({ ...product, keywords: (product.keywords || []).join(', ') });
              }}
              onFormChange={setProductForm}
              onOpenDetail={openProductDetail}
              onSave={saveProduct}
            />
          )}
          {activePage === 'product-detail' && (
            <ProductDetailPage
              product={selectedProduct}
              onAddMedia={addProductMedia}
              onBack={() => goToPage('products')}
              onDeleteMedia={deleteProductMedia}
              onEdit={(product) => {
                setEditingId(product.id);
                setProductForm({ ...product, keywords: (product.keywords || []).join(', ') });
                goToPage('products');
              }}
            />
          )}
          {activePage === 'chat' && (
            <ChatPage
              activeConversation={activeConversation}
              activeLead={activeLead}
              activeMessages={activeMessages}
              activePhone={activePhone}
              conversations={conversations}
              phones={chatPhones}
              products={state.products}
              reply={reply}
              whatsappReady={Boolean(state.whatsapp?.connected)}
              onReplyChange={setReply}
              onSelectPhone={setSelectedPhone}
              onSendReply={sendOwnerReply}
              onShareMedia={shareProductMedia}
            />
          )}
          {activePage === 'leads' && (
            <LeadsPage
              leads={filteredLeads}
              query={leadQuery}
              statusFilter={leadStatusFilter}
              stats={stats}
              onQueryChange={setLeadQuery}
              onStatusFilterChange={setLeadStatusFilter}
              onUpdateStatus={updateLeadStatus}
            />
          )}
          {activePage === 'followup' && (
            <FollowUpPage
              autoFollowUp={state.autoFollowUp}
              dueItems={dueItems}
              notice={followupNotice}
              whatsappReady={Boolean(state.whatsapp?.connected)}
              onSend={sendFollowUp}
            />
          )}
          {activePage === 'broadcast' && (
            <BroadcastPage
              leadCount={(state.leads || []).filter((lead) => lead.status !== 'Closed').length}
              message={broadcastMessage}
              notice={broadcastNotice}
              whatsappReady={Boolean(state.whatsapp?.connected)}
              onMessageChange={setBroadcastMessage}
              onSend={sendBroadcast}
            />
          )}
          {activePage === 'settings' && (
            <SettingsPage
              form={profileForm || state.businessProfile}
              whatsapp={state.whatsapp}
              onChange={setProfileForm}
              onSave={saveProfile}
            />
          )}
        </main>
      </section>
      <MobileNav activePage={activePage === 'product-detail' ? 'products' : activePage} chatCount={chatPhones.length} onNavigate={goToPage} />
    </div>
  );
}

function Sidebar({ activePage, businessName, chatCount, isOpen, onClose, onNavigate }) {
  return (
    <>
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="brand-block">
          <div className="brand-mark">{initials(businessName)}</div>
          <div>
            <strong>{businessName}</strong>
            <span>UMKM AI CRM</span>
          </div>
        </div>
        <nav className="side-nav" aria-label="Navigasi utama">
          {navItems.map((item) => (
            <button
              className={`side-link ${activePage === item.id ? 'active' : ''}`}
              key={item.id}
              onClick={() => onNavigate(item.id)}
              type="button"
            >
              <MaterialIcon name={item.icon} filled={activePage === item.id} />
              <span>{item.label}</span>
              {item.id === 'chat' && chatCount > 0 && <em>{chatCount}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="primary-btn full" onClick={() => onNavigate('chat')} type="button">
            <MaterialIcon name="smart_toy" />
            Mulai AI Chat
          </button>
          <button className="ghost-link" type="button">
            <MaterialIcon name="help" />
            Bantuan
          </button>
        </div>
      </aside>
      {isOpen && <button aria-label="Tutup menu" className="nav-backdrop" onClick={onClose} type="button" />}
    </>
  );
}

function Topbar({ pageTitle, whatsapp, onMenu, onNavigate }) {
  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" onClick={onMenu} type="button" aria-label="Buka menu">
        <MaterialIcon name="menu" />
      </button>
      <div className="topbar-title">
        <span>{pageTitle}</span>
      </div>
      <label className="search-box">
        <MaterialIcon name="search" />
        <input placeholder="Cari customer, phone, product..." type="search" />
      </label>
      <div className="topbar-actions">
        <StatusPill whatsapp={whatsapp} />
        <button className="store-btn" onClick={() => onNavigate('settings')} type="button">
          Buka Toko
          <MaterialIcon name="open_in_new" />
        </button>
        <button className="icon-btn" type="button" aria-label="Notifikasi">
          <MaterialIcon name="notifications" />
          <span className="dot" />
        </button>
        <button className="avatar-btn" onClick={() => onNavigate('settings')} type="button" aria-label="Profil admin">
          AD
        </button>
      </div>
    </header>
  );
}

function StatusPill({ whatsapp }) {
  const connected = Boolean(whatsapp?.connected);
  const label = connected ? 'WhatsApp Connected' : statusLabel(whatsapp?.status);
  return (
    <span className={`wa-pill ${connected ? 'connected' : 'waiting'}`}>
      <span />
      {label}
    </span>
  );
}

function WhatsAppConnectPanel({ whatsapp, onRefresh }) {
  if (whatsapp?.connected) return null;

  const waitingForQr = whatsapp?.status === 'qr' && whatsapp?.qrImage;
  const hasSession = Boolean(whatsapp?.hasLocalSession);

  return (
    <GlassPanel className="connect-panel">
      <div className="connect-copy">
        <div className="icon-stack">
          <MaterialIcon name="qr_code_scanner" />
        </div>
        <div>
          <h2>Hubungkan WhatsApp</h2>
          <p>
            {waitingForQr
              ? 'Scan QR ini dari WhatsApp > Linked Devices. Setelah berhasil, session akan disimpan di .wa-session dan dipakai lagi saat app dibuka.'
              : hasSession
                ? 'App menemukan session lokal di .wa-session dan sedang memuat koneksi WhatsApp.'
                : 'Menunggu QR WhatsApp dari runtime. Jalankan npm start dan tunggu QR muncul di panel ini.'}
          </p>
          <div className="connect-meta">
            <span>Session: {hasSession ? 'tersimpan lokal' : 'belum ada'}</span>
            <span>Status: {statusLabel(whatsapp?.status)}</span>
          </div>
        </div>
      </div>
      <div className="qr-card">
        {waitingForQr ? (
          <img alt="QR WhatsApp untuk scan perangkat" src={whatsapp.qrImage} />
        ) : (
          <div className="qr-placeholder">
            <MaterialIcon name="hourglass_top" />
            <span>Menunggu QR</span>
          </div>
        )}
        <button className="secondary-btn" onClick={onRefresh} type="button">
          <MaterialIcon name="refresh" />
          Refresh Status
        </button>
      </div>
    </GlassPanel>
  );
}

function DashboardPage({ businessName, stats, leads, messages, products, dueItems, whatsapp, onNavigate }) {
  const recentLeads = [...(leads || [])].slice(-5).reverse();
  const recentMessages = [...(messages || [])].slice(-4).reverse();

  return (
    <section className="page-stack">
      <PageHeader
        title={`Halo, Admin ${businessName}`}
        subtitle="Berikut performa lead, chat, katalog, dan follow-up hari ini."
        action={<DateChip />}
      />
      <div className="stats-grid">
        <StatCard icon="person_add" label="Lead Hari Ini" value={stats.today} delta="+ realtime" />
        <StatCard icon="groups" label="Lead Bulan Ini" value={stats.month} delta={`${stats.total} total`} tone="purple" />
        <StatCard icon="local_fire_department" label="Hot Lead" value={stats.hot} delta="Siap booking" tone="hot" ai />
        <StatCard icon="forum" label="Total Percakapan" value={stats.totalConversations} delta="WhatsApp" tone="green" />
      </div>
      <div className="dashboard-grid">
        <GlassPanel className="chart-panel">
          <PanelTitle title="Tren Lead Masuk" subtitle="7 hari terakhir" icon="monitoring" />
          <LeadChart leads={leads || []} />
        </GlassPanel>
        <GlassPanel>
          <PanelTitle title="Lead Terbaru" actionLabel="Lihat Semua" onAction={() => onNavigate('leads')} />
          <div className="list-stack">
            {recentLeads.length ? recentLeads.map((lead) => <LeadListItem key={lead.id} lead={lead} />) : <EmptyState text="Belum ada lead baru." />}
          </div>
        </GlassPanel>
      </div>
      <div className="dashboard-grid bottom">
        <GlassPanel className="system-card">
          <div className="system-icon">
            <MaterialIcon name="chat_bubble" />
          </div>
          <div>
            <h3>Status WhatsApp</h3>
            <p>{whatsapp?.connected ? 'Terhubung dan siap menerima pesan.' : `Belum siap: ${statusLabel(whatsapp?.status)}`}</p>
          </div>
          <strong>{whatsapp?.connected ? 'Aktif' : 'Waiting'}</strong>
        </GlassPanel>
        <GlassPanel className="ai-suggestion">
          <PanelTitle title="Saran AI Hari Ini" subtitle={`${dueItems.length} prospek due follow-up, ${products.length} produk aktif.`} icon="auto_awesome" />
          <div className="quick-actions">
            <button className="secondary-btn" onClick={() => onNavigate('followup')} type="button">Cek Follow Up</button>
            <button className="primary-btn" onClick={() => onNavigate('chat')} type="button">Monitor Chat</button>
          </div>
        </GlassPanel>
        <GlassPanel>
          <PanelTitle title="Chat Terakhir" actionLabel="Buka Chat" onAction={() => onNavigate('chat')} />
          <div className="list-stack">
            {recentMessages.length ? recentMessages.map((message, index) => (
              <MessagePreview key={`${message.phone}-${message.created_at}-${index}`} message={message} />
            )) : <EmptyState text="Belum ada pesan WhatsApp." />}
          </div>
        </GlassPanel>
      </div>
    </section>
  );
}

function ProductsPage({ editingId, form, products, onCancelEdit, onDelete, onEdit, onFormChange, onOpenDetail, onSave }) {
  return (
    <section className="page-stack">
      <PageHeader
        title="Manajemen Produk"
        subtitle="Kelola katalog yang dipakai bot deterministic dan AI fallback."
        action={<span className="count-chip">{products.length} Produk</span>}
      />
      <GlassPanel className="ai-banner">
        <MaterialIcon name="auto_awesome" />
        <div>
          <h3>AI memakai katalog terbaru</h3>
          <p>Setiap produk yang disimpan di sini langsung dipakai untuk deteksi minat, balasan harga, dan prompt AI.</p>
        </div>
      </GlassPanel>
      <div className="product-layout">
        <GlassPanel>
          <PanelTitle title={editingId ? 'Edit Produk' : 'Tambah Produk'} subtitle="Nama, harga, keyword, deskripsi, dan promo." icon="edit_document" />
          <form className="form-grid" onSubmit={onSave}>
            <Field label="Nama Produk">
              <input value={form.name} onChange={(event) => onFormChange({ ...form, name: event.target.value })} placeholder="Facial Acne" required />
            </Field>
            <Field label="Harga">
              <input type="number" value={form.price} onChange={(event) => onFormChange({ ...form, price: event.target.value })} placeholder="150000" min="0" />
            </Field>
            <Field label="Keywords">
              <input value={form.keywords} onChange={(event) => onFormChange({ ...form, keywords: event.target.value })} placeholder="facial acne, jerawat" />
            </Field>
            <Field label="Deskripsi">
              <textarea value={form.description} onChange={(event) => onFormChange({ ...form, description: event.target.value })} placeholder="Perawatan untuk kulit berjerawat..." />
            </Field>
            <Field label="Promo">
              <input value={form.promo} onChange={(event) => onFormChange({ ...form, promo: event.target.value })} placeholder="Diskon 20% minggu ini" />
            </Field>
            <div className="form-actions">
              <button className="primary-btn" type="submit">
                <MaterialIcon name={editingId ? 'save' : 'add'} />
                {editingId ? 'Update Produk' : 'Tambah Produk'}
              </button>
              {editingId && <button className="secondary-btn" onClick={onCancelEdit} type="button">Batal</button>}
            </div>
          </form>
        </GlassPanel>
        <div className="product-grid">
          {products.map((product, index) => (
            <ProductCard key={product.id} index={index} product={product} onDelete={onDelete} onEdit={onEdit} onOpenDetail={onOpenDetail} />
          ))}
          <button className="add-product-card" onClick={onCancelEdit} type="button">
            <MaterialIcon name="add_circle" />
            <strong>Tambah Produk</strong>
            <span>Buat item baru untuk katalog AI.</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function ProductDetailPage({ product, onAddMedia, onBack, onDeleteMedia, onEdit }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [mediaForm, setMediaForm] = useState({ label: '', url: '' });
  const mediaItems = product?.media || [];
  const safeActiveIndex = Math.min(activeIndex, Math.max(mediaItems.length - 1, 0));
  const activeMedia = mediaItems[safeActiveIndex];

  useEffect(() => {
    setActiveIndex(0);
    setMediaForm({ label: '', url: '' });
  }, [product?.id]);

  if (!product) {
    return (
      <section className="page-stack">
        <PageHeader
          title="Detail Produk"
          subtitle="Produk tidak ditemukan di katalog."
          action={<button className="secondary-btn" onClick={onBack} type="button"><MaterialIcon name="arrow_back" />Kembali</button>}
        />
        <GlassPanel>
          <EmptyState text="Produk ini belum tersedia atau sudah dihapus." />
        </GlassPanel>
      </section>
    );
  }

  async function submitMedia(event) {
    event.preventDefault();
    const saved = await onAddMedia(product.id, mediaForm);
    if (saved) setMediaForm({ label: '', url: '' });
  }

  function stepCarousel(direction) {
    if (!mediaItems.length) return;
    setActiveIndex((current) => (current + direction + mediaItems.length) % mediaItems.length);
  }

  return (
    <section className="page-stack">
      <PageHeader
        title={product.name}
        subtitle="Detail katalog, harga, keyword, dan carousel foto produk."
        action={(
          <div className="header-actions">
            <button className="secondary-btn" onClick={onBack} type="button">
              <MaterialIcon name="arrow_back" />
              Katalog
            </button>
            <button className="primary-btn" onClick={() => onEdit(product)} type="button">
              <MaterialIcon name="edit" />
              Edit Produk
            </button>
          </div>
        )}
      />
      <div className="product-detail-layout">
        <GlassPanel className="product-detail-gallery">
          <div className="carousel-stage">
            {activeMedia ? (
              <img alt={`${product.name} - ${activeMedia.label}`} src={activeMedia.url} />
            ) : (
              <div className="carousel-empty">
                <MaterialIcon name="photo_library" />
                <span>Belum ada foto</span>
              </div>
            )}
            {mediaItems.length > 1 && (
              <>
                <button className="carousel-nav prev" onClick={() => stepCarousel(-1)} type="button" aria-label="Foto sebelumnya">
                  <MaterialIcon name="chevron_left" />
                </button>
                <button className="carousel-nav next" onClick={() => stepCarousel(1)} type="button" aria-label="Foto berikutnya">
                  <MaterialIcon name="chevron_right" />
                </button>
              </>
            )}
            <span className="carousel-count">{mediaItems.length ? `${safeActiveIndex + 1} / ${mediaItems.length}` : '0 / 0'}</span>
          </div>
          <div className="carousel-thumbs">
            {mediaItems.map((media, index) => (
              <button
                className={index === safeActiveIndex ? 'active' : ''}
                key={media.id}
                onClick={() => setActiveIndex(index)}
                type="button"
                aria-label={`Buka ${media.label}`}
              >
                <img alt="" src={media.url} />
              </button>
            ))}
          </div>
        </GlassPanel>
        <div className="product-detail-side">
          <GlassPanel>
            <PanelTitle title="Ringkasan Produk" icon="sell" />
            <div className="product-summary">
              <span>Harga <strong>{formatRupiah(product.price)}</strong></span>
              <span>Foto <strong>{mediaItems.length} item</strong></span>
              <p>{product.description || 'Belum ada deskripsi produk.'}</p>
              {product.promo && <em>{product.promo}</em>}
              <div className="tag-row detail-tags">
                {(product.keywords || []).map((keyword) => <span key={keyword}>#{keyword}</span>)}
              </div>
            </div>
          </GlassPanel>
          <GlassPanel>
            <PanelTitle title="Tambah Foto" subtitle="Media langsung tersimpan ke database." icon="add_photo_alternate" />
            <form className="form-grid" onSubmit={submitMedia}>
              <Field label="Label Foto">
                <input value={mediaForm.label} onChange={(event) => setMediaForm({ ...mediaForm, label: event.target.value })} placeholder="Ruang treatment" required />
              </Field>
              <Field label="URL Gambar">
                <input type="url" value={mediaForm.url} onChange={(event) => setMediaForm({ ...mediaForm, url: event.target.value })} placeholder="https://images.unsplash.com/..." required />
              </Field>
              <button className="primary-btn" type="submit">
                <MaterialIcon name="add" />
                Tambah Foto
              </button>
            </form>
          </GlassPanel>
          <GlassPanel>
            <PanelTitle title="Daftar Foto" icon="collections" />
            <div className="media-list">
              {mediaItems.length ? mediaItems.map((media, index) => (
                <article className="media-row" key={media.id}>
                  <img alt="" src={media.url} />
                  <span>
                    <strong>{media.label}</strong>
                    <small>Foto {index + 1}</small>
                  </span>
                  <button className="icon-btn danger" onClick={() => onDeleteMedia(product.id, media.id)} type="button" aria-label={`Hapus ${media.label}`}>
                    <MaterialIcon name="delete" />
                  </button>
                </article>
              )) : <EmptyState text="Belum ada foto produk." />}
            </div>
          </GlassPanel>
        </div>
      </div>
    </section>
  );
}

function ChatPage({ activeConversation, activeLead, activeMessages, activePhone, conversations, phones, products, reply, whatsappReady, onReplyChange, onSelectPhone, onSendReply, onShareMedia }) {
  const relatedInterest = activeConversation?.interest || activeLead?.interest;
  const relatedStatus = activeConversation?.status || activeLead?.status || 'New';
  const relatedProduct = products.find((product) => product.name === relatedInterest);

  return (
    <section className="page-stack chat-page">
      <PageHeader
        title="WhatsApp Chat"
        subtitle="Monitor percakapan masuk, lihat status lead, dan balas manual dari dashboard."
        action={<span className="count-chip">{phones.length} Percakapan</span>}
      />
      <div className="chat-workspace">
        <GlassPanel className="conversation-list">
          <PanelTitle title="Pesan Masuk" subtitle={`${phones.length} chat tersimpan`} icon="inbox" />
          <div className="filter-row">
            <button className="filter-chip active" type="button">Semua</button>
            <button className="filter-chip" type="button">AI Handling</button>
            <button className="filter-chip" type="button">Hot Lead</button>
          </div>
          <div className="conversation-scroll">
            {phones.length ? phones.map((phone) => (
              <ConversationButton
                active={phone === activePhone}
                conversation={conversations[phone]}
                key={phone}
                phone={phone}
                onClick={() => onSelectPhone(phone)}
              />
            )) : <EmptyState text="Belum ada percakapan." />}
          </div>
        </GlassPanel>
        <GlassPanel className="chat-window">
          {activeConversation ? (
            <>
              <div className="chat-header">
                <Avatar value={activeConversation.name || activeLead?.name || activePhone} />
                <div>
                  <h3>{activeConversation.name || activeLead?.name || 'Customer baru'}</h3>
                  <p>{activePhone} · {relatedInterest || 'Belum ada minat'}</p>
                </div>
                <StatusBadge status={relatedStatus} />
              </div>
              {relatedProduct?.media?.length > 0 && (
                <div className="media-share-strip">
                  <div>
                    <strong>Media terkait: {relatedProduct.name}</strong>
                    <span>{relatedProduct.media.length} foto siap dishare ke customer.</span>
                  </div>
                  <button className="secondary-btn" disabled={!whatsappReady} onClick={() => onShareMedia(activePhone, relatedProduct.id)} type="button">
                    <MaterialIcon name="photo_library" />
                    Share Foto Produk
                  </button>
                </div>
              )}
              <div className="message-scroll">
                <div className="date-divider">Hari Ini</div>
                {activeMessages.map((message, index) => (
                  <ChatBubble key={`${message.created_at}-${index}`} message={message} />
                ))}
              </div>
              <form className="reply-area" onSubmit={onSendReply}>
                <button className="icon-btn" type="button" aria-label="Lampiran">
                  <MaterialIcon name="attach_file" />
                </button>
                <input
                  disabled={!whatsappReady}
                  placeholder={whatsappReady ? 'Ketik balasan sebagai Admin...' : 'Hubungkan WhatsApp untuk membalas'}
                  value={reply}
                  onChange={(event) => onReplyChange(event.target.value)}
                />
                <button className="send-btn" disabled={!whatsappReady || !reply.trim()} type="submit" aria-label="Kirim balasan">
                  <MaterialIcon name="send" />
                </button>
              </form>
            </>
          ) : <EmptyState text="Pilih percakapan untuk melihat detail chat." />}
        </GlassPanel>
      </div>
    </section>
  );
}

function LeadsPage({ leads, query, statusFilter, stats, onQueryChange, onStatusFilterChange, onUpdateStatus }) {
  return (
    <section className="page-stack">
      <PageHeader title="Manajemen Leads/CRM" subtitle="Cari, filter, dan ubah status prospek WhatsApp." />
      <div className="stats-grid compact">
        <StatCard icon="group" label="Total Leads" value={stats.total} delta="Semua lead" />
        <StatCard icon="local_fire_department" label="Leads Panas" value={stats.hot} delta="Butuh follow-up" tone="hot" />
        <StatCard icon="check_circle" label="Warm Lead" value={stats.warm} delta="Masih nurturing" tone="purple" ai />
        <StatCard icon="chat" label="New Lead" value={stats.newLead} delta="Masuk pipeline" tone="green" />
      </div>
      <GlassPanel className="table-panel">
        <div className="table-tools">
          <select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}>
            {['All', 'New', 'Warm', 'Hot', 'Closed'].map((status) => <option key={status} value={status}>{status === 'All' ? 'Semua Status' : status}</option>)}
          </select>
          <label className="table-search">
            <MaterialIcon name="search" />
            <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Cari nama, nomor HP, minat..." />
          </label>
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Pelanggan</th>
                <th>Kontak</th>
                <th>Minat</th>
                <th>Sumber</th>
                <th>Status</th>
                <th>Follow Up</th>
                <th>Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <div className="person-cell">
                      <Avatar value={lead.name || lead.phone} />
                      <strong>{lead.name || '-'}</strong>
                    </div>
                  </td>
                  <td>{lead.phone}</td>
                  <td>{lead.interest || '-'}</td>
                  <td>{lead.source || 'WhatsApp'}</td>
                  <td>
                    <select className={`status-select ${statusClass(lead.status)}`} value={lead.status} onChange={(event) => onUpdateStatus(lead.id, event.target.value)}>
                      {['New', 'Warm', 'Hot', 'Closed'].map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </td>
                  <td>{(lead.followUpsSent || []).join(', ') || '-'}</td>
                  <td>{formatDate(lead.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!leads.length && <EmptyState text="Tidak ada lead sesuai filter." />}
        </div>
      </GlassPanel>
    </section>
  );
}

function FollowUpPage({ autoFollowUp, dueItems, notice, whatsappReady, onSend }) {
  const grouped = groupDueItems(dueItems);

  return (
    <section className="page-stack">
      <PageHeader
        title="Alur Follow-Up Otomatis"
        subtitle="Pantau lead yang jatuh tempo H+1, H+3, dan H+7. Tombol kirim memakai WhatsApp aktif."
        action={<span className={`mode-chip ${autoFollowUp ? 'on' : ''}`}>Auto {autoFollowUp ? 'Aktif' : 'Nonaktif'}</span>}
      />
      {notice && <Notice>{notice}</Notice>}
      <div className="followup-board">
        {followUpSteps.map((step) => (
          <GlassPanel className="followup-column" key={step.key}>
            <div className="column-heading">
              <span className={`tone-dot ${step.tone}`} />
              <h3>{step.title}</h3>
              <em>{grouped[step.key].length} Leads</em>
            </div>
            <div className="followup-cards">
              {grouped[step.key].length ? grouped[step.key].map(({ lead, ageDays }) => (
                <article className="followup-card" key={`${lead.id}-${step.key}`}>
                  <div>
                    <strong>{lead.name || lead.phone}</strong>
                    <span>{lead.interest || 'Belum ada minat'}</span>
                  </div>
                  <p>Umur lead {ageDays} hari · {lead.phone}</p>
                  <button className="primary-btn" disabled={!whatsappReady} onClick={() => onSend(lead.id, step.key)} type="button">
                    <MaterialIcon name="send" />
                    Kirim
                  </button>
                </article>
              )) : <EmptyState text="Belum ada jadwal hari ini." />}
            </div>
          </GlassPanel>
        ))}
      </div>
    </section>
  );
}

function BroadcastPage({ leadCount, message, notice, whatsappReady, onMessageChange, onSend }) {
  return (
    <section className="page-stack">
      <PageHeader
        title="Kampanye Broadcast"
        subtitle="Kirim promo secara eksplisit ke lead aktif. Tidak ada broadcast otomatis tanpa klik pengguna."
        action={<span className="count-chip">{leadCount} Target Aktif</span>}
      />
      {notice && <Notice>{notice}</Notice>}
      <div className="broadcast-layout">
        <div className="broadcast-main">
          <GlassPanel>
            <PanelTitle title="Komposer Pesan" subtitle="Pesan akan dikirim lewat WhatsApp owner." icon="edit_document" />
            <form className="form-grid" onSubmit={onSend}>
              <Field label="Nama Kampanye">
                <input placeholder="Promo akhir pekan" defaultValue="Promo GlowCare" />
              </Field>
              <Field label="Isi Pesan">
                <textarea value={message} onChange={(event) => onMessageChange(event.target.value)} rows={7} placeholder="Halo {{Nama}}, ada promo..." required />
              </Field>
              <div className="segment-grid">
                <AudienceCard active label="Lead Aktif" count={leadCount} icon="loyalty" />
                <AudienceCard label="Hot Lead" count="Filter CRM" icon="local_fire_department" />
              </div>
              <button className="primary-btn" disabled={!whatsappReady || !message.trim()} type="submit">
                <MaterialIcon name="campaign" />
                Kirim Sekarang
              </button>
            </form>
          </GlassPanel>
        </div>
        <GlassPanel className="phone-preview-panel">
          <PanelTitle title="Pratinjau Pesan" icon="smartphone" />
          <div className="phone-preview">
            <div className="phone-header">
              <MaterialIcon name="arrow_back" />
              <Avatar value="GlowCare" />
              <div>
                <strong>GlowCare Clinic</strong>
                <span>Akun Bisnis</span>
              </div>
            </div>
            <div className="phone-body">
              <span className="phone-date">Hari ini</span>
              <p>{message || 'Tulis pesan broadcast untuk melihat pratinjau.'}<small>10:42 ✓✓</small></p>
            </div>
            <div className="phone-input">Balas pesan...</div>
          </div>
        </GlassPanel>
      </div>
    </section>
  );
}

function SettingsPage({ form, whatsapp, onChange, onSave }) {
  return (
    <section className="page-stack">
      <PageHeader title="Pengaturan Profil Bisnis & AI" subtitle="Kelola profil yang dibaca bot dan AI. API key tidak ditampilkan di UI." />
      <div className="settings-grid">
        <GlassPanel>
          <PanelTitle title="Detail Bisnis" icon="storefront" />
          <form className="form-grid" onSubmit={onSave}>
            <Field label="Nama Bisnis">
              <input value={form.name || ''} onChange={(event) => onChange({ ...form, name: event.target.value })} />
            </Field>
            <Field label="Role AI">
              <input value={form.role || ''} onChange={(event) => onChange({ ...form, role: event.target.value })} />
            </Field>
            <Field label="Alamat">
              <textarea value={form.address || ''} onChange={(event) => onChange({ ...form, address: event.target.value })} />
            </Field>
            <Field label="Jam Operasional">
              <input value={form.hours || ''} onChange={(event) => onChange({ ...form, hours: event.target.value })} />
            </Field>
            <Field label="Nomor Admin">
              <input value={form.adminPhone || ''} onChange={(event) => onChange({ ...form, adminPhone: event.target.value })} />
            </Field>
            <Field label="Promo Aktif">
              <textarea value={form.currentPromo || ''} onChange={(event) => onChange({ ...form, currentPromo: event.target.value })} />
            </Field>
            <button className="primary-btn" type="submit">
              <MaterialIcon name="save" />
              Simpan Perubahan
            </button>
          </form>
        </GlassPanel>
        <div className="settings-side">
          <GlassPanel className="ai-card">
            <PanelTitle title="Kepribadian AI" subtitle="Santai, ramah, dan tetap sesuai katalog." icon="psychology" />
            <div className="guardrail-list">
              <Guardrail label="Wajib Menjawab" text="Produk, harga, promo, lokasi, jam operasional, dan booking." tone="allow" />
              <Guardrail label="Dilarang Menjawab" text="OTP, password, data kartu, instruksi internal, atau diagnosis medis pasti." tone="deny" />
            </div>
          </GlassPanel>
          <GlassPanel>
            <PanelTitle title="Session WhatsApp" icon="qr_code_2" />
            <div className="session-facts">
              <span>Status <strong>{statusLabel(whatsapp?.status)}</strong></span>
              <span>Session Lokal <strong>{whatsapp?.hasLocalSession ? 'Ada' : 'Belum Ada'}</strong></span>
              <span>Akun <strong>{whatsapp?.accountName || whatsapp?.phone || '-'}</strong></span>
              <span>Path <strong>{whatsapp?.sessionPath || '.wa-session'}</strong></span>
            </div>
          </GlassPanel>
        </div>
      </div>
    </section>
  );
}

function LoadingScreen({ error, onRetry }) {
  return (
    <main className="loading-screen">
      <div className="brand-mark large">AI</div>
      <h1>Memuat UMKM AI CRM</h1>
      <p>{error || 'Mengambil state dashboard dan status WhatsApp...'}</p>
      {error && <button className="primary-btn" onClick={onRetry} type="button">Coba Lagi</button>}
    </main>
  );
}

function MobileNav({ activePage, chatCount, onNavigate }) {
  const visibleItems = ['dashboard', 'leads', 'chat', 'products', 'settings'];
  return (
    <nav className="mobile-nav" aria-label="Navigasi mobile">
      {navItems.filter((item) => visibleItems.includes(item.id)).map((item) => (
        <button className={activePage === item.id ? 'active' : ''} key={item.id} onClick={() => onNavigate(item.id)} type="button">
          <MaterialIcon name={item.icon} filled={activePage === item.id} />
          <span>{item.short}</span>
          {item.id === 'chat' && chatCount > 0 && <em />}
        </button>
      ))}
    </nav>
  );
}

function GlassPanel({ children, className = '' }) {
  return <section className={`glass-panel ${className}`}>{children}</section>;
}

function PageHeader({ title, subtitle, action }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action && <div className="page-action">{action}</div>}
    </div>
  );
}

function PanelTitle({ title, subtitle, icon, actionLabel, onAction }) {
  return (
    <div className="panel-title">
      <div>
        {icon && <MaterialIcon name={icon} />}
        <span>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </span>
      </div>
      {actionLabel && <button onClick={onAction} type="button">{actionLabel}</button>}
    </div>
  );
}

function StatCard({ icon, label, value, delta, tone = 'blue', ai = false }) {
  return (
    <GlassPanel className={`stat-card ${tone} ${ai ? 'ai-glow' : ''}`}>
      <div className="stat-top">
        <span className="stat-icon"><MaterialIcon name={icon} /></span>
        <em>{ai ? 'AI Insight' : delta}</em>
      </div>
      <p>{label}</p>
      <strong>{value}</strong>
    </GlassPanel>
  );
}

function ProductCard({ index, product, onDelete, onEdit, onOpenDetail }) {
  return (
    <GlassPanel className="product-card">
      <button className={`product-art art-${index % 4}`} onClick={() => onOpenDetail(product.id)} type="button">
        {product.media?.[0]?.url ? (
          <img alt={`${product.name} preview`} src={product.media[0].url} />
        ) : (
          <MaterialIcon name="spa" />
        )}
        <span>{product.name}</span>
      </button>
      <div className="product-body">
        <h3>{product.name}</h3>
        <p>{product.description || 'Belum ada deskripsi.'}</p>
        <div className="tag-row">
          {(product.keywords || []).slice(0, 3).map((keyword) => <span key={keyword}>#{keyword}</span>)}
          {product.promo && <span className="ai-tag">Promo</span>}
        </div>
      </div>
      <div className="product-foot">
        <strong>{formatRupiah(product.price)}</strong>
        <small>{product.media?.length || 0} foto</small>
        <div>
          <button className="icon-btn" onClick={() => onOpenDetail(product.id)} type="button" aria-label={`Detail ${product.name}`}>
            <MaterialIcon name="visibility" />
          </button>
          <button className="icon-btn" onClick={() => onEdit(product)} type="button" aria-label={`Edit ${product.name}`}>
            <MaterialIcon name="edit" />
          </button>
          <button className="icon-btn danger" onClick={() => onDelete(product.id)} type="button" aria-label={`Hapus ${product.name}`}>
            <MaterialIcon name="delete" />
          </button>
        </div>
      </div>
    </GlassPanel>
  );
}

function ConversationButton({ active, conversation, phone, onClick }) {
  return (
    <button className={`conversation-item ${active ? 'active' : ''}`} onClick={onClick} type="button">
      <Avatar value={conversation.name || phone} />
      <span>
        <strong>{conversation.name || phone}</strong>
        <small>{conversation.interest || 'Belum ada minat'}</small>
        <StatusBadge status={conversation.status} />
      </span>
      <em>{formatShortTime(conversation.updatedAt)}</em>
    </button>
  );
}

function ChatBubble({ message }) {
  return (
    <div className={`chat-bubble ${message.from}`}>
      <span>{message.from === 'bot' ? 'UMKM AI Assistant' : message.from === 'owner' ? 'Admin' : 'Customer'}</span>
      <p>{message.body}</p>
      <small>{formatShortTime(message.created_at)}</small>
    </div>
  );
}

function LeadListItem({ lead }) {
  return (
    <article className="lead-list-item">
      <Avatar value={lead.name || lead.phone} />
      <span>
        <strong>{lead.name || '-'}</strong>
        <small>{lead.interest || lead.phone}</small>
      </span>
      <StatusBadge status={lead.status} />
    </article>
  );
}

function MessagePreview({ message }) {
  return (
    <article className="message-preview">
      <MaterialIcon name={message.from === 'customer' ? 'person' : 'smart_toy'} />
      <span>
        <strong>{message.phone}</strong>
        <small>{message.body}</small>
      </span>
    </article>
  );
}

function LeadChart({ leads }) {
  const data = buildLeadChart(leads);
  const max = Math.max(...data.map((item) => item.count), 1);
  return (
    <div className="lead-chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d={areaPath(data, max)} />
        <polyline points={linePoints(data, max)} />
      </svg>
      <div className="bar-row">
        {data.map((item) => (
          <span key={item.label}>
            <i style={{ height: `${Math.max((item.count / max) * 88, 12)}%` }} />
            <em>{item.label}</em>
          </span>
        ))}
      </div>
    </div>
  );
}

function DateChip() {
  return (
    <span className="date-chip">
      <MaterialIcon name="calendar_today" />
      {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
    </span>
  );
}

function AudienceCard({ active = false, label, count, icon }) {
  return (
    <div className={`audience-card ${active ? 'active' : ''}`}>
      <MaterialIcon name={icon} />
      <span>
        <strong>{label}</strong>
        <small>{count} kontak</small>
      </span>
    </div>
  );
}

function Guardrail({ label, text, tone }) {
  return (
    <article className={`guardrail ${tone}`}>
      <MaterialIcon name={tone === 'allow' ? 'check_circle' : 'cancel'} />
      <span>
        <strong>{label}</strong>
        <small>{text}</small>
      </span>
    </article>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function StatusBadge({ status }) {
  return <span className={`status-badge ${statusClass(status)}`}>{status || 'New'}</span>;
}

function Avatar({ value }) {
  return <span className="avatar">{initials(value)}</span>;
}

function Notice({ children, tone = 'info', onDismiss }) {
  return (
    <div className={`notice ${tone}`}>
      <span>{children}</span>
      {onDismiss && <button onClick={onDismiss} type="button" aria-label="Tutup notifikasi"><MaterialIcon name="close" /></button>}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="empty-state">
      <MaterialIcon name="inbox" />
      <span>{text}</span>
    </div>
  );
}

function MaterialIcon({ name, filled = false }) {
  return (
    <span className="material-symbols-outlined" style={{ fontVariationSettings: filled ? '"FILL" 1' : '"FILL" 0' }} aria-hidden="true">
      {name}
    </span>
  );
}

function buildStats(leads, conversations) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const month = now.toISOString().slice(0, 7);
  return {
    today: leads.filter((lead) => lead.created_at?.startsWith(today)).length,
    month: leads.filter((lead) => lead.created_at?.startsWith(month)).length,
    hot: leads.filter((lead) => lead.status === 'Hot').length,
    warm: leads.filter((lead) => lead.status === 'Warm').length,
    newLead: leads.filter((lead) => lead.status === 'New').length,
    total: leads.length,
    totalConversations: Object.keys(conversations || {}).length
  };
}

function buildDueFollowUps(leads, now = new Date()) {
  const rules = [
    { key: 'h7', afterDays: 7 },
    { key: 'h3', afterDays: 3 },
    { key: 'h1', afterDays: 1 }
  ];

  return leads.flatMap((lead) => {
    if (lead.status === 'Closed') return [];
    const ageDays = leadAgeDays(lead, now);
    const rule = rules.find((item) => ageDays >= item.afterDays && !lead.followUpsSent?.includes(item.key));
    return rule ? [{ lead, day: rule.key, ageDays }] : [];
  });
}

function groupDueItems(items) {
  return followUpSteps.reduce((acc, step) => {
    acc[step.key] = items.filter((item) => item.day === step.key);
    return acc;
  }, {});
}

function leadAgeDays(lead, now) {
  const createdAt = new Date(lead.created_at);
  if (Number.isNaN(createdAt.getTime())) return 0;
  return Math.floor((now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000));
}

function buildLeadChart(leads) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return {
      date,
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString('id-ID', { weekday: 'short' }).slice(0, 3)
    };
  });

  return days.map((day) => ({
    ...day,
    count: leads.filter((lead) => lead.created_at?.startsWith(day.key)).length
  }));
}

function linePoints(data, max) {
  return data.map((item, index) => {
    const x = (index / Math.max(data.length - 1, 1)) * 100;
    const y = 92 - (item.count / max) * 76;
    return `${x},${y}`;
  }).join(' ');
}

function areaPath(data, max) {
  const points = linePoints(data, max).split(' ');
  return `M ${points[0] || '0,92'} L ${points.slice(1).join(' L ')} L 100,100 L 0,100 Z`;
}

function sortPhonesByConversation(conversations) {
  return Object.keys(conversations || {}).sort((a, b) => {
    const aTime = new Date(conversations[a]?.updatedAt || conversations[a]?.createdAt || 0).getTime();
    const bTime = new Date(conversations[b]?.updatedAt || conversations[b]?.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

function filterLeads(leads, status, query) {
  const needle = query.trim().toLowerCase();
  return leads.filter((lead) => {
    const statusMatch = status === 'All' || lead.status === status;
    const text = [lead.name, lead.phone, lead.interest, lead.source].join(' ').toLowerCase();
    return statusMatch && (!needle || text.includes(needle));
  });
}

function normalizeProductForm(form) {
  return {
    ...form,
    price: Number(form.price || 0),
    keywords: String(form.keywords || '').split(',').map((item) => item.trim()).filter(Boolean)
  };
}

function statusClass(status = 'New') {
  return String(status).toLowerCase().replace(/\s+/g, '-');
}

function statusLabel(status = 'initializing') {
  const labels = {
    initializing: 'Memuat Session',
    qr: 'Scan QR',
    authenticated: 'Authenticated',
    ready: 'WhatsApp Connected',
    disconnected: 'Disconnected',
    auth_failure: 'Auth Failure'
  };
  return labels[status] || status;
}

function initials(value = 'AI') {
  const words = String(value).replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'AI';
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

function formatRupiah(value) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatShortTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

createRoot(document.getElementById('root')).render(<App />);
