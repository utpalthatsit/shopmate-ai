const container = document.querySelector('#view-container');
const breadcrumb = document.querySelector('#breadcrumb-title');
const shell = document.querySelector('.app-shell');
const store = {
  user: null,
  shop: null,
  products: [],
  faqs: [],
  conversations: [],
  demo: false
};
const views = { overview: renderOverview, conversations: renderConversations, knowledge: renderKnowledge, embed: renderEmbed, settings: renderSettings };

function configured() {
  return window.shopmateSupabase && !window.supabaseConfigMissing;
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function renderAuth(message = '') {
  shell.style.display = 'none';
  document.body.insertAdjacentHTML('afterbegin', `<main class="auth-screen"><div class="auth-card"><a class="brand" href="#"><span class="brand-mark">✦</span><span>shopmate<span class="brand-dot">.</span>ai</span></a><div class="eyebrow">Owner workspace</div><h1>Turn questions into customers<span class="brand-dot">.</span></h1><p>Create an account with your email and password, then confirm your email once.</p><form id="password-login" class="password-login"><input id="login-email" type="email" placeholder="you@example.com" required autocomplete="current-email"><input id="login-password" type="password" placeholder="Password (6+ characters)" minlength="6" required autocomplete="current-password"><div class="password-actions"><button class="primary-button" id="login-submit" type="submit">Log in</button><button class="secondary-button" id="signup-submit" type="button">Create account</button></div></form><button class="demo-button" id="demo-login" type="button">Try demo mode</button>${message ? `<div class="auth-error">${escapeHtml(message)}</div>` : ''}<div class="auth-divider"><span>or</span></div><button class="secondary-button google-login" id="google-login"><span>G</span> Continue with Google</button><small>Powered by Supabase Auth</small></div></main>`);
  document.querySelector('#demo-login').addEventListener('click', startDemo);
  document.querySelector('#password-login').addEventListener('submit', async event => {
    event.preventDefault();
    const email = document.querySelector('#login-email').value.trim();
    const password = document.querySelector('#login-password').value;
    const button = event.target.querySelector('button');
    button.disabled = true;
    button.textContent = 'Logging in...';
    const { error } = await window.shopmateSupabase.auth.signInWithPassword({ email, password });
    if (error) {
      button.disabled = false;
      button.textContent = 'Log in';
      const errorBox = document.querySelector('.auth-error') || document.createElement('div');
      errorBox.className = 'auth-error';
      errorBox.textContent = error.message;
      document.querySelector('#password-login').after(errorBox);
      return;
    }
    window.location.reload();
  });
  document.querySelector('#signup-submit').addEventListener('click', async event => {
    const email = document.querySelector('#login-email').value.trim();
    const password = document.querySelector('#login-password').value;
    if (!email || password.length < 6) {
      showToast('Enter an email and a password with at least 6 characters');
      return;
    }
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Creating account...';
    const { data, error } = await window.shopmateSupabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/` } });
    button.disabled = false;
    button.textContent = 'Create account';
    if (error) {
      const errorBox = document.querySelector('.auth-error') || document.createElement('div');
      errorBox.className = 'auth-error';
      errorBox.textContent = error.message;
      document.querySelector('#password-login').after(errorBox);
      return;
    }
    if (data.session) window.location.reload();
    else showToast('Confirmation email sent. Confirm it, then log in with your password.');
  });
  document.querySelector('#google-login').addEventListener('click', async () => {
    if (!configured()) {
      showToast('Add your Supabase URL and key in supabase.js first');
      return;
    }
    const button = document.querySelector('#google-login');
    button.disabled = true;
    button.textContent = 'Connecting to Google...';
    const { data, error } = await window.shopmateSupabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/` } });
    if (error) {
      button.disabled = false;
      button.innerHTML = '<span>G</span> Continue with Google';
      const errorBox = document.querySelector('.auth-error') || document.createElement('div');
      errorBox.className = 'auth-error';
      errorBox.textContent = error.message;
      button.after(errorBox);
      return;
    }
    if (data?.url) window.location.assign(data.url);
  });
}

async function loadData() {
  const { data: sessionData, error: sessionError } = await window.shopmateSupabase.auth.getSession();
  if (sessionError) throw sessionError;
  store.user = sessionData.session?.user || null;
  if (!store.user) return false;
  const { data: shop, error: shopError } = await window.shopmateSupabase.from('shops').select('*').eq('owner_id', store.user.id).maybeSingle();
  if (shopError) throw shopError;
  if (!shop) {
    const { data: createdShop, error: createError } = await window.shopmateSupabase.from('shops').insert({ owner_id: store.user.id, name: store.user.user_metadata?.full_name || 'My Shop', category: 'Other' }).select().single();
    if (createError) throw createError;
    store.shop = createdShop;
  } else {
    store.shop = shop;
  }
  const [productsResult, faqsResult, sessionsResult] = await Promise.all([
    window.shopmateSupabase.from('products').select('*').eq('shop_id', store.shop.id).order('created_at', { ascending: false }),
    window.shopmateSupabase.from('faqs').select('*').eq('shop_id', store.shop.id).order('created_at', { ascending: false }),
    window.shopmateSupabase.from('chat_sessions').select('*').eq('shop_id', store.shop.id).order('started_at', { ascending: false }).limit(50)
  ]);
  if (productsResult.error) throw productsResult.error;
  if (faqsResult.error) throw faqsResult.error;
  if (sessionsResult.error) throw sessionsResult.error;
  store.products = productsResult.data || [];
  store.faqs = faqsResult.data || [];
  store.conversations = sessionsResult.data || [];
  return true;
}

function updateSidebar() {
  document.querySelector('.shop-switcher strong').textContent = store.shop.name;
  document.querySelector('.breadcrumbs span').textContent = store.shop.name;
  document.querySelector('.user-row strong').textContent = store.user.user_metadata?.full_name || store.user.email || 'Owner';
  document.querySelector('.user-row small').textContent = store.user.email || 'Owner';
  document.querySelector('.user-row .user-avatar').textContent = (store.user.user_metadata?.full_name || 'OW').split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();
}

function render(view = 'overview') {
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === view));
  breadcrumb.textContent = view[0].toUpperCase() + view.slice(1);
  container.innerHTML = views[view]();
  bindView(view);
}

function metric(label, value, icon, trend, tone = 'up') {
  return `<div class="metric"><div class="metric-top"><span>${label}</span><span class="metric-icon">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-trend ${tone}">${trend}</div></div>`;
}

function renderOverview() {
  const total = store.conversations.length;
  return `<section class="page"><div class="page-heading"><div><div class="eyebrow">Live workspace</div><h1>Good morning<span class="brand-dot">.</span></h1><p class="page-subtitle">Your assistant is connected to your Supabase shop data.</p></div><button class="primary-button" data-view="knowledge">+ &nbsp;Add knowledge</button></div><div class="metrics">${metric('Total conversations', total, '▤', `${total ? 'Live data' : 'No chats yet'}`)}${metric('Products known', store.products.length, '▦', 'From your catalog')}${metric('FAQs ready', store.faqs.length, '?', 'Grounding answers')}${metric('Assistant status', 'Live', '✦', 'Supabase connected')}</div><div class="dashboard-grid"><div class="panel"><div class="panel-header"><span class="panel-title">Your knowledge at a glance</span><span class="panel-meta">Live from Supabase</span></div><div class="data-list"><div class="data-row"><span class="metric-icon" style="background:var(--yellow)">▦</span><div class="data-row-copy"><strong>Products & services</strong><small>${store.products.length} items available to the assistant</small></div><button class="edit-link" data-view="knowledge">Manage</button></div><div class="data-row"><span class="metric-icon" style="background:var(--mint)">?</span><div class="data-row-copy"><strong>Frequently asked questions</strong><small>${store.faqs.length} answers available</small></div><button class="edit-link" data-view="knowledge">Manage</button></div></div></div><div class="panel"><div class="panel-header"><span class="panel-title">Recent conversations</span><button class="text-button" data-view="conversations">View all →</button></div>${store.conversations.slice(0, 4).map(conversationTemplate).join('') || '<div class="data-row"><span class="panel-meta">No customer conversations yet.</span></div>'}</div></div></section>`;
}

function conversationTemplate(item) {
  const initials = (item.visitor_email || 'Visitor').slice(0, 2).toUpperCase();
  return `<div class="conversation-row"><span class="conversation-avatar">${initials}</span><div class="conversation-copy"><strong>${escapeHtml(item.visitor_email || 'Anonymous visitor')}</strong><small>${item.is_lead ? 'Lead captured' : 'Visitor session'}</small></div><span class="tag ${item.is_lead ? 'lead' : 'resolved'}">${item.is_lead ? 'Lead' : 'Open'}</span><span class="conversation-time">${new Date(item.started_at).toLocaleDateString()}</span></div>`;
}

function renderConversations() {
  return `<section class="page"><div class="page-heading"><div><div class="eyebrow">Live inbox</div><h1>Conversations</h1><p class="page-subtitle">Sessions are loaded from your Supabase database.</p></div></div><div class="view-toolbar"><input class="search" id="conversation-search" placeholder="⌕  Search by email"/><span class="panel-meta" style="margin-left:auto">${store.conversations.length} total</span></div><div class="panel conversation-list" id="conversation-list">${store.conversations.map(conversationTemplate).join('') || '<div class="data-row"><span class="panel-meta">No conversations yet.</span></div>'}</div></section>`;
}

function renderKnowledge() {
  return `<section class="page"><div class="page-heading"><div><div class="eyebrow">Your assistant knows</div><h1>Knowledge base</h1><p class="page-subtitle">Changes here are saved directly to Supabase.</p></div><button class="primary-button" id="add-knowledge">+ &nbsp;Add knowledge</button></div><div class="knowledge-grid"><div class="knowledge-card"><div class="knowledge-card-header"><div><h3>Products & services</h3><p>${store.products.length} items · Live data</p></div><span class="metric-icon" style="background:var(--yellow)">▦</span></div><div class="data-list">${store.products.map(item => `<div class="data-row"><span class="conversation-avatar" style="background:var(--yellow);color:#8a7320">${escapeHtml(item.name[0])}</span><div class="data-row-copy"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description || '')} · ${item.price ?? 'No price'}</small></div><small class="tag ${item.in_stock ? 'resolved' : 'lead'}">${item.in_stock ? 'In stock' : 'Out of stock'}</small></div>`).join('') || '<div class="data-row"><span class="panel-meta">No products yet.</span></div>'}</div><div class="add-row" data-add="product">+ Add product or service</div></div><div class="knowledge-card"><div class="knowledge-card-header"><div><h3>Frequently asked questions</h3><p>${store.faqs.length} answers · Live data</p></div><span class="metric-icon" style="background:var(--mint)">?</span></div><div class="data-list">${store.faqs.map(item => `<div class="data-row"><span class="conversation-avatar" style="background:var(--mint);color:var(--mint-strong)">?</span><div class="data-row-copy"><strong>${escapeHtml(item.question)}</strong><small>${escapeHtml(item.answer)}</small></div></div>`).join('') || '<div class="data-row"><span class="panel-meta">No FAQs yet.</span></div>'}</div><div class="add-row" data-add="faq">+ Add FAQ</div></div></div></section>`;
}

function renderEmbed() {
  const snippet = `<script src="${window.location.origin}/widget.js" data-shop-id="${store.shop.id}" defer></script>`;
  return `<section class="page"><div class="page-heading"><div><div class="eyebrow">One line to go live</div><h1>Install your assistant</h1><p class="page-subtitle">Use this shop-specific snippet on your website.</p></div><span class="status-pill"><i></i> Ready to install</span></div><div class="embed-layout"><div><div class="panel"><div class="panel-header"><span class="panel-title">Your embed code</span><button class="text-button" id="copy-code">Copy code ↗</button></div><pre class="code-box">${escapeHtml(snippet)}</pre></div><ol class="install-steps"><li><span class="step-number">1</span><div><strong>Copy the snippet</strong><p>Use the button above to copy your unique widget code.</p></div></li><li><span class="step-number">2</span><div><strong>Paste it into your site</strong><p>Add it before the closing body tag.</p></div></li><li><span class="step-number">3</span><div><strong>Ask a question</strong><p>Visitors can now reach your assistant.</p></div></li></ol></div><div class="preview-shell"><div class="preview-browser"><div class="browser-top"><i class="browser-dot"></i><i class="browser-dot"></i><i class="browser-dot"></i></div><div class="fake-site"><span></span><span></span><span></span></div><div class="widget-preview"><div class="widget-preview-head"><i></i> ${escapeHtml(store.shop.name)} <span style="margin-left:auto">×</span></div><div class="widget-preview-msg">Hi there! How can I help you today?</div><div class="widget-preview-input">Ask anything...</div></div></div></div></div></section>`;
}

function renderSettings() {
  return `<section class="page"><div class="page-heading"><div><div class="eyebrow">Workspace preferences</div><h1>Settings</h1><p class="page-subtitle">Save changes directly to your shop record.</p></div><button class="primary-button" id="save-settings">Save changes</button></div><div class="setting-section"><div class="form-row"><div class="field"><label for="shop-name">Shop name</label><input id="shop-name" value="${escapeHtml(store.shop.name)}"></div><div class="field"><label for="category">Category</label><input id="category" value="${escapeHtml(store.shop.category || '')}"></div></div><div class="field"><label for="description">Short description</label><textarea id="description">${escapeHtml(store.shop.description || '')}</textarea></div><div class="form-row"><div class="field"><label for="hours">Business hours</label><input id="hours" value="${escapeHtml(store.shop.hours || '')}"></div><div class="field"><label for="contact">Contact email</label><input id="contact" value="${escapeHtml(store.shop.contact || '')}"></div></div></div></section>`;
}

async function addProduct() {
  const name = prompt('Product name:');
  if (!name) return;
  const description = prompt('Short description:') || '';
  const price = prompt('Price, for example 38:') || null;
  if (store.demo) {
    store.products.unshift({ id: crypto.randomUUID(), name, description, price: price ? Number(price) : null, in_stock: true });
    localStorage.setItem('shopmate-demo-data', JSON.stringify(store));
    render('knowledge');
    showToast('Demo product saved locally');
    return;
  }
  const { error } = await window.shopmateSupabase.from('products').insert({ shop_id: store.shop.id, name, description, price: price ? Number(price) : null, in_stock: true });
  if (error) return showToast(error.message);
  await loadData(); render('knowledge'); showToast('Product saved');
}

async function addFaq() {
  const question = prompt('Customer question:');
  if (!question) return;
  const answer = prompt('Answer:') || '';
  if (store.demo) {
    store.faqs.unshift({ id: crypto.randomUUID(), question, answer });
    localStorage.setItem('shopmate-demo-data', JSON.stringify(store));
    render('knowledge');
    showToast('Demo FAQ saved locally');
    return;
  }
  const { error } = await window.shopmateSupabase.from('faqs').insert({ shop_id: store.shop.id, question, answer });
  if (error) return showToast(error.message);
  await loadData(); render('knowledge'); showToast('FAQ saved');
}

function bindView(view) {
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => render(button.dataset.view)));
  if (view === 'conversations') document.querySelector('#conversation-search').addEventListener('input', event => { const term = event.target.value.toLowerCase(); document.querySelector('#conversation-list').innerHTML = store.conversations.filter(item => (item.visitor_email || 'Anonymous visitor').toLowerCase().includes(term)).map(conversationTemplate).join('') || '<div class="data-row"><span class="panel-meta">No conversations match that search.</span></div>'; });
  if (view === 'embed') document.querySelector('#copy-code').addEventListener('click', async () => { const snippet = `<script src="${window.location.origin}/widget.js" data-shop-id="${store.shop.id}" defer></script>`; await navigator.clipboard?.writeText(snippet); showToast('Embed code copied'); });
  if (view === 'knowledge') { document.querySelector('#add-knowledge').addEventListener('click', () => showToast('Choose Product or FAQ below')); document.querySelector('[data-add="product"]').addEventListener('click', addProduct); document.querySelector('[data-add="faq"]').addEventListener('click', addFaq); }
  if (view === 'settings') document.querySelector('#save-settings').addEventListener('click', saveSettings);
}

async function saveSettings() {
  const payload = { name: document.querySelector('#shop-name').value.trim(), category: document.querySelector('#category').value.trim(), description: document.querySelector('#description').value.trim(), hours: document.querySelector('#hours').value.trim(), contact: document.querySelector('#contact').value.trim() };
  if (store.demo) {
    store.shop = { ...store.shop, ...payload };
    localStorage.setItem('shopmate-demo-data', JSON.stringify(store));
    updateSidebar();
    showToast('Demo settings saved locally');
    return;
  }
  const { data, error } = await window.shopmateSupabase.from('shops').update(payload).eq('id', store.shop.id).select().single();
  if (error) return showToast(error.message);
  store.shop = data;
  updateSidebar();
  showToast('Settings saved to Supabase');
}

function startDemo() {
  const saved = JSON.parse(localStorage.getItem('shopmate-demo-data') || 'null');
  Object.assign(store, saved || { user: { email: 'demo@shopmate.ai', user_metadata: { full_name: 'Demo Owner' } }, shop: { id: 'demo-shop', name: 'Maison Miro', category: 'Home & living', description: 'Thoughtful objects for everyday rituals.', hours: 'Mon-Sat, 10:00-19:00', contact: 'hello@maisonmiro.com' }, products: [{ id: 'p1', name: 'Linen Table Runner', description: 'Natural flax, 180cm', price: 38, in_stock: true }], faqs: [{ id: 'f1', question: 'Do you ship internationally?', answer: 'Yes, we ship to 24 countries.' }], conversations: [], demo: true });
  store.demo = true;
  document.querySelector('.auth-screen')?.remove();
  shell.style.display = 'flex';
  updateSidebar();
  render();
  document.querySelector('.status-pill').innerHTML = '<i></i> Demo mode';
  document.querySelector('.user-row .icon-button').addEventListener('click', () => window.location.reload());
}

async function start() {
  if (!configured()) return renderAuth('Supabase client is not configured.');
  try {
    const authenticated = await loadData();
    if (!authenticated) return renderAuth();
    document.querySelector('.auth-screen')?.remove();
    shell.style.display = 'flex';
    updateSidebar();
    render();
    document.querySelector('.user-row .icon-button').addEventListener('click', () => window.shopmateSupabase.auth.signOut());
    window.shopmateSupabase.auth.onAuthStateChange((_event, session) => { if (!session) window.location.reload(); });
  } catch (error) {
    renderAuth(error.message);
  }
}

start();
