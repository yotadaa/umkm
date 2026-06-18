import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import LiquidGlass from 'liquid-glass-react';
import './styles.css';

const emptyProduct = { name: '', price: 0, keywords: '', description: '', promo: '' };

function App() {
  const [state, setState] = useState(null);
  const [selectedPhone, setSelectedPhone] = useState(null);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [editingId, setEditingId] = useState(null);
  const [reply, setReply] = useState('');
  const [notice, setNotice] = useState('');

  async function loadState() {
    const response = await fetch('/api/state');
    setState(await response.json());
  }

  useEffect(() => {
    loadState();
    const timer = setInterval(loadState, 5000);
    return () => clearInterval(timer);
  }, []);

  const stats = useMemo(() => buildStats(state?.leads || []), [state]);
  const chatPhones = Object.keys(state?.conversations || {});
  const activePhone = selectedPhone || chatPhones[0];
  const activeConversation = activePhone ? state?.conversations?.[activePhone] : null;
  const activeMessages = (state?.messages || []).filter((message) => message.phone === activePhone);

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
    setNotice('Produk tersimpan. AI akan memakai data katalog terbaru.');
    await loadState();
  }

  async function deleteProduct(id) {
    if (!confirm('Hapus produk ini?')) return;
    await fetch(`/api/products/${id}`, { method: 'DELETE' });
    await loadState();
  }

  async function sendOwnerReply(event) {
    event.preventDefault();
    if (!activePhone || !reply.trim()) return;

    await fetch(`/api/chats/${activePhone}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: reply })
    });

    setReply('');
    await loadState();
  }

  if (!state) return <div className="loading">Loading dashboard...</div>;

  return (
    <main className="app-shell">
      <div className="orb orb-a" />
      <div className="orb orb-b" />
      <header className="topbar glass-lite">
        <div>
          <p className="eyebrow">AI Growth System</p>
          <h1>{state.businessProfile.name}</h1>
        </div>
        <div className="mac-controls"><span /><span /><span /></div>
      </header>

      <section className="stats-grid">
        <Stat label="Lead Hari Ini" value={stats.today} />
        <Stat label="Lead Bulan Ini" value={stats.month} />
        <Stat label="Hot Lead" value={stats.hot} accent="hot" />
        <Stat label="Warm Lead" value={stats.warm} accent="warm" />
      </section>

      <section className="workspace">
        <GlassPanel className="products-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Katalog AI</p>
              <h2>Item yang dijual</h2>
            </div>
            <span className="pill">{state.products.length} produk</span>
          </div>

          <form className="product-form" onSubmit={saveProduct}>
            <input placeholder="Nama produk" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} />
            <input type="number" placeholder="Harga" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} />
            <input placeholder="Keywords, pisah koma" value={productForm.keywords} onChange={(e) => setProductForm({ ...productForm, keywords: e.target.value })} />
            <textarea placeholder="Deskripsi" value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} />
            <input placeholder="Promo" value={productForm.promo} onChange={(e) => setProductForm({ ...productForm, promo: e.target.value })} />
            <div className="form-actions">
              <button className="primary" type="submit">{editingId ? 'Update Produk' : 'Tambah Produk'}</button>
              {editingId && <button type="button" onClick={() => { setEditingId(null); setProductForm(emptyProduct); }}>Batal</button>}
            </div>
          </form>
          {notice && <p className="notice">{notice}</p>}

          <div className="product-list">
            {state.products.map((product) => (
              <article className="product-card" key={product.id}>
                <div>
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <small>{formatRupiah(product.price)} · {(product.keywords || []).join(', ')}</small>
                </div>
                <div className="card-actions">
                  <button onClick={() => { setEditingId(product.id); setProductForm({ ...product, keywords: (product.keywords || []).join(', ') }); }}>Edit</button>
                  <button className="danger" onClick={() => deleteProduct(product.id)}>Hapus</button>
                </div>
              </article>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel className="chat-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">WhatsApp Monitor</p>
              <h2>Chat masuk</h2>
            </div>
            <span className="pill live">Live</span>
          </div>
          <div className="chat-layout">
            <aside className="chat-list">
              {chatPhones.map((phone) => {
                const conversation = state.conversations[phone];
                return <button className={phone === activePhone ? 'active' : ''} key={phone} onClick={() => setSelectedPhone(phone)}>
                  <strong>{conversation.name || phone}</strong>
                  <span>{conversation.interest || 'Belum ada minat'}</span>
                </button>;
              })}
            </aside>
            <section className="chat-window">
              {activeConversation ? (
                <>
                  <div className="chat-meta">
                    <strong>{activeConversation.name || 'Customer baru'}</strong>
                    <span>{activePhone} · {activeConversation.status}</span>
                  </div>
                  <div className="messages">
                    {activeMessages.map((message, index) => <div className={`bubble ${message.from}`} key={`${message.created_at}-${index}`}>
                      <span>{message.from}</span>
                      <p>{message.body}</p>
                    </div>)}
                  </div>
                  <form className="reply-box" onSubmit={sendOwnerReply}>
                    <input placeholder="Balas manual dari dashboard..." value={reply} onChange={(e) => setReply(e.target.value)} />
                    <button className="primary">Kirim</button>
                  </form>
                </>
              ) : <p className="empty">Belum ada chat WhatsApp.</p>}
            </section>
          </div>
        </GlassPanel>
      </section>

      <GlassPanel>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">CRM</p>
            <h2>Lead captured</h2>
          </div>
        </div>
        <div className="lead-table">
          {(state.leads || []).map((lead) => <div className="lead-row" key={lead.id}>
            <span>{lead.name}</span><span>{lead.phone}</span><span>{lead.interest}</span><span className={`status ${String(lead.status).toLowerCase()}`}>{lead.status}</span><span>{new Date(lead.created_at).toLocaleDateString('id-ID')}</span>
          </div>)}
        </div>
      </GlassPanel>
    </main>
  );
}

function GlassPanel({ children, className = '' }) {
  return <div className={`glass-panel ${className}`}>{children}</div>;
}

function Stat({ label, value, accent = '' }) {
  return <div className={`stat-wrap ${accent}`}>
    <LiquidGlass blurAmount={0.055} saturation={150} aberrationIntensity={1.2} elasticity={0.2} cornerRadius={24} padding="0">
      <div className="stat-content"><p>{label}</p><strong>{value}</strong></div>
    </LiquidGlass>
  </div>;
}

function buildStats(leads) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const month = now.toISOString().slice(0, 7);
  return {
    today: leads.filter((lead) => lead.created_at?.startsWith(today)).length,
    month: leads.filter((lead) => lead.created_at?.startsWith(month)).length,
    hot: leads.filter((lead) => lead.status === 'Hot').length,
    warm: leads.filter((lead) => lead.status === 'Warm').length
  };
}

function normalizeProductForm(form) {
  return { ...form, price: Number(form.price || 0), keywords: String(form.keywords || '').split(',').map((item) => item.trim()).filter(Boolean) };
}

function formatRupiah(value) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0);
}

createRoot(document.getElementById('root')).render(<App />);
