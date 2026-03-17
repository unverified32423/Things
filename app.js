const CONFIG = {
  API_URL: '',  // same origin on Netlify — functions are at /.netlify/functions/ but redirected
};

const state = {
  user: null, products: [], purchases: [],
  currentPage: 'home', loading: true,
  admin: { stats: null, logs: [], users: [], purchases: [], bannedIPs: [] }
};

/* ===== NAVIGATION ===== */
function navigate(page, pushState = true) {
  state.currentPage = page; render();
  if (pushState) window.history.pushState({}, '', page === 'home' ? '/' : `/${page}`);
  window.scrollTo(0, 0);
}

/* ===== AUTH (session-based via Python backend) ===== */
function loginWithDiscord() {
  window.location.href = `${CONFIG.API_URL}/login`;
}

async function handleCallback() {
  // callback is handled server-side; Python redirects to /client or /?error=
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');
  if (error === 'no_access') {
    toast('You do not have the Client role.', 'error');
  } else if (error) {
    toast('Login failed. Try again.', 'error');
  }
  window.history.replaceState({}, '', '/');
  state.currentPage = 'home';
  state.loading = false;
  render();
}

async function logout() {
  await fetch(`${CONFIG.API_URL}/logout`, { credentials: 'include' });
  state.user = null;
  toast('Logged out successfully', 'success');
  navigate('home');
}

async function loadUser() {
  try {
    const res = await fetch(`${CONFIG.API_URL}/me`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data.logged_in) state.user = data.user;
    }
  } catch {}
}

async function loadProducts() {
  // products are hardcoded in the frontend for now
}

async function checkout(productId) {
  if (!state.user) { toast('Please login first', 'error'); loginWithDiscord(); return; }
  try {
    const data = await api('/checkout', { method: 'POST', body: JSON.stringify({ productId }) });
    if (data.success && data.url) window.location.href = data.url;
    else toast(data.error || 'Checkout failed', 'error');
  } catch (err) { toast(err.message || 'Checkout failed', 'error'); }
}

/* ===== ADMIN API ===== */
async function loadAdminStats() {
  try { const d = await api('/admin/stats'); if (d.success) state.admin.stats = d.stats; } catch {}
}
async function loadAdminLogs(action = 'all') {
  try { const d = await api(`/admin/logs?limit=50&action=${action}`); if (d.success) state.admin.logs = d.logs; } catch {}
}
async function loadAdminUsers() {
  try { const d = await api('/admin/users'); if (d.success) state.admin.users = d.users; } catch {}
}
async function loadAdminPurchases() {
  try { const d = await api('/admin/purchases'); if (d.success) state.admin.purchases = d.purchases; } catch {}
}
async function loadBannedIPs() {
  try { const d = await api('/admin/banned-ips'); if (d.success) state.admin.bannedIPs = d.bannedIPs; } catch {}
}
async function banUser(userId, banned, reason = '') {
  try {
    const d = await api(`/admin/users/${userId}/ban`, { method: 'POST', body: JSON.stringify({ banned, reason }) });
    if (d.success) { toast(d.message, 'success'); await loadAdminUsers(); render(); }
  } catch (err) { toast(err.message || 'Failed to update user', 'error'); }
}
async function banIP(ip, reason = '', duration = null) {
  try {
    const d = await api('/admin/ban-ip', { method: 'POST', body: JSON.stringify({ ip, reason, duration }) });
    if (d.success) { toast(d.message, 'success'); await loadBannedIPs(); await loadAdminStats(); showAdminTab('ips'); }
  } catch (err) { toast(err.message || 'Failed to ban IP', 'error'); }
}
async function unbanIP(ip) {
  try {
    const d = await api('/admin/unban-ip', { method: 'POST', body: JSON.stringify({ ip }) });
    if (d.success) { toast(d.message, 'success'); await loadBannedIPs(); await loadAdminStats(); showAdminTab('ips'); }
  } catch (err) { toast(err.message || 'Failed to unban IP', 'error'); }
}

/* ===== MODALS ===== */
function showBanIPModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <h3><i class="fas fa-ban"></i> Ban IP Address</h3>
      <div class="form-group">
        <label>IP Address</label>
        <input type="text" id="ban-ip-input" placeholder="e.g. 192.168.1.1">
      </div>
      <div class="form-group">
        <label>Reason (optional)</label>
        <input type="text" id="ban-reason-input" placeholder="e.g. Suspicious activity">
      </div>
      <div class="form-group">
        <label>Duration</label>
        <select id="ban-duration-input">
          <option value="">Permanent</option>
          <option value="1">1 hour</option>
          <option value="24">24 hours</option>
          <option value="168">7 days</option>
          <option value="720">30 days</option>
        </select>
      </div>
      <div class="modal-actions">
        <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
        <button class="btn btn-danger" onclick="submitBanIP()"><i class="fas fa-ban"></i> Ban IP</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}
function closeModal() { document.querySelector('.modal-overlay')?.remove(); }
function submitBanIP() {
  const ip = document.getElementById('ban-ip-input').value.trim();
  const reason = document.getElementById('ban-reason-input').value.trim();
  const duration = document.getElementById('ban-duration-input').value;
  if (!ip) { toast('Please enter an IP address', 'error'); return; }
  closeModal();
  banIP(ip, reason, duration ? parseInt(duration) : null);
}

/* ===== TOAST ===== */
function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: 'check-circle', error: 'exclamation-circle', info: 'info-circle', warning: 'exclamation-triangle' };
  el.innerHTML = `<i class="fas fa-${icons[type] || icons.info}"></i><span>${escapeHtml(message)}</span>`;
  container.appendChild(el);
  setTimeout(() => { el.style.animation = 'slideOut 0.3s ease forwards'; setTimeout(() => el.remove(), 300); }, 4000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/* ===== USER MENU ===== */
function toggleUserMenu(e) {
  e.stopPropagation();
  document.getElementById('user-dropdown')?.classList.toggle('show');
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.user-menu')) document.getElementById('user-dropdown')?.classList.remove('show');
});

/* ===== CAROUSEL ===== */
let currentSlide = 0;
const totalSlides = 2;
function slideNews(direction) {
  currentSlide = (currentSlide + direction + totalSlides) % totalSlides;
  updateCarousel();
}
function goToSlide(index) { currentSlide = index; updateCarousel(); }
function updateCarousel() {
  const slider = document.getElementById('news-slider');
  if (slider) slider.style.transform = `translateX(-${currentSlide * 100}%)`;
  document.querySelectorAll('.carousel-dot').forEach((dot, i) => dot.classList.toggle('active', i === currentSlide));
}

/* ===== COMPONENTS ===== */
function Navbar() {
  const avatarUrl = state.user
    ? `https://cdn.discordapp.com/avatars/${state.user.discord_id}/${state.user.avatar}.png`
    : '';
  const p = state.currentPage;
  return `
  <nav class="navbar">
    <a href="/" class="nav-brand" onclick="navigate('home'); return false;">
      <img src="/images/aether.png" alt="Aether" onerror="this.style.display='none'">
      <span class="nav-brand-text">Aether</span>
    </a>
    <div class="nav-links">
      <a href="/" onclick="navigate('home'); return false;" class="${p==='home'?'active':''}">Home</a>
      <a href="/store" onclick="navigate('store'); return false;" class="${p==='store'?'active':''}">Store</a>
      <a href="https://discord.gg/" target="_blank" rel="noopener">Discord</a>
      <a href="/tos" onclick="navigate('tos'); return false;" class="${p==='tos'?'active':''}">TOS</a>
      ${state.user?.is_admin ? `<a href="/admin" onclick="navigate('admin'); return false;" class="admin-link ${p==='admin'?'active':''}"><i class="fas fa-shield-alt"></i> Admin</a>` : ''}
    </div>
    <div class="nav-right">
      ${state.user ? `
        <div class="user-menu">
          <button class="user-btn" onclick="toggleUserMenu(event)">
            <img src="${escapeHtml(avatarUrl)}" alt=""
              onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect fill=%22%23222%22 width=%2240%22 height=%2240%22/><text x=%2220%22 y=%2220%22 dominant-baseline=%22central%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2218%22>${state.user.username[0].toUpperCase()}</text></svg>'">
            <span>${escapeHtml(state.user.username)}</span>
            <i class="fas fa-chevron-down"></i>
          </button>
          <div class="user-dropdown" id="user-dropdown">
            <a href="/dashboard" onclick="navigate('dashboard'); return false;"><i class="fas fa-home"></i> Dashboard</a>
            <a href="/store" onclick="navigate('store'); return false;"><i class="fas fa-shopping-cart"></i> Store</a>
            ${state.user?.is_admin ? `<a href="/admin" onclick="navigate('admin'); return false;"><i class="fas fa-shield-alt"></i> Admin Panel</a>` : ''}
            <a href="#" class="danger" onclick="logout(); return false;"><i class="fas fa-sign-out-alt"></i> Logout</a>
          </div>
        </div>` : `<button class="btn btn-primary" onclick="loginWithDiscord()"><i class="fab fa-discord"></i> Login with Discord</button>`}
    </div>
  </nav>`;
}

function Footer() {
  return `
  <footer>
    <div class="footer-content">
      <div class="footer-brand">
        <img src="/images/aether.png" alt="Aether" onerror="this.style.display='none'">
        <p>Premium gaming solutions built by experts. Trusted by thousands of users worldwide.</p>
      </div>
      <div class="footer-section">
        <h4>Product</h4>
        <a href="/store" onclick="navigate('store'); return false;">Store</a>
        <a href="#">Downloads</a>
        <a href="#">Status</a>
      </div>
      <div class="footer-section">
        <h4>Support</h4>
        <a href="https://discord.gg/" target="_blank" rel="noopener">Discord</a>
        <a href="#">FAQ</a>
      </div>
      <div class="footer-section">
        <h4>Legal</h4>
        <a href="/tos" onclick="navigate('tos'); return false;">Terms of Service</a>
        <a href="#">Privacy Policy</a>
      </div>
    </div>
    <div class="footer-bottom">© 2026 Aether. All rights reserved.</div>
  </footer>`;
}

function LoadingPage() {
  return `
  <div class="loading-screen">
    <div class="gradient-bg"></div>
    <div class="loading-content">
      <img src="/images/aether.png" alt="Aether" class="loading-logo">
      <div class="loading-spinner"></div>
    </div>
  </div>`;
}

function injectLoader() {
  if (sessionStorage.getItem('kenz_seen_loader')) return;
  sessionStorage.setItem('kenz_seen_loader', '1');
  const el = document.createElement('div');
  el.className = 'loader-wrapper';
  el.innerHTML = `
    <div class="loader-content">
      <img src="/images/aether.png" alt="Aether" class="loader-logo" id="loader-logo">
      <div class="loader-spinner" id="loader-spin"></div>
    </div>`;
  document.body.appendChild(el);
  const logo = document.getElementById('loader-logo');
  const spin = document.getElementById('loader-spin');
  setTimeout(() => { logo.classList.add('show'); spin.classList.add('show'); }, 200);
  setTimeout(() => el.classList.add('fade-out'), 1800);
  setTimeout(() => el.remove(), 2600);
}

/* ===== PAGES ===== */

function toggleFaq(el) {
  const item = el.closest('.faq-item');
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
  if (!isOpen) item.classList.add('open');
}

function TickerBar() {
  const items = [
    { icon: 'fa-shield-alt',   label: '100% Undetected' },
    { icon: 'fa-ban',          label: 'Bypassed All Scanners' },
    { icon: 'fa-star',         label: '5-Star Rated' },
    { icon: 'fa-lock',         label: 'Secure Process' },
    { icon: 'fa-check-circle', label: '100% Safe' },
    { icon: 'fa-headset',      label: '24/7 Support' },
    { icon: 'fa-eye-slash',    label: 'Undetected Options' },
  ];
  const sep = `<span class="ticker-sep">·</span>`;
  const html = items.map(i => `<span class="ticker-item"><i class="fas ${i.icon}"></i>${i.label}</span>${sep}`).join('');
  return `<div class="ticker-wrap"><div class="ticker-track" id="ticker-track">${html.repeat(6)}</div></div>`;
}

function HorizontalFeatures() {
  const cards = [
    { icon: 'fa-shield-alt', title: 'Pristine Cheat Development', desc: 'Advanced cheat solutions with real-time features and custom scripts for FiveM servers' },
    { icon: 'fa-eye',        title: 'ESP & Visuals',              desc: 'Comprehensive visual enhancements including player ESP, vehicle tracking, and advanced overlays' },
    { icon: 'fa-crosshairs', title: 'Combat Features',            desc: 'Aimbot, silent aim, triggerbot, and weapon modifications for superior gameplay advantage' },
    { icon: 'fa-code',       title: 'Custom Scripts',             desc: 'Tailored automation tools and custom features built for your specific gaming needs' },
  ];
  return `
  <section class="hfeatures-section">
    <div class="hfeatures-grid">
      ${cards.map(c => `
        <div class="hfeature-card">
          <div class="hfeature-icon"><i class="fas ${c.icon}"></i></div>
          <h3>${c.title}</h3>
          <p>${c.desc}</p>
        </div>`).join('')}
    </div>
  </section>`;
}

function SoftwareFeatures() {
  const items = [
    { icon: 'fa-shield-alt', title: 'Advanced Bypass System', desc: 'Sophisticated technology designed to evade modern anti-cheat detection methods' },
    { icon: 'fa-eye-slash',  title: 'Stealth Mode',           desc: 'Operates invisibly with zero footprint, ensuring complete anonymity during gameplay' },
    { icon: 'fa-lock',       title: 'Secure Architecture',    desc: 'Military-grade encryption and protection layers to safeguard your account' },
  ];
  return `
  <section class="swfeatures-section">
    <div class="section-header" style="text-align:left">
      <h2>Software Features</h2>
    </div>
    <div class="swfeature-list">
      ${items.map(i => `
        <div class="swfeature-item">
          <div class="swfeature-item-icon"><i class="fas ${i.icon}"></i></div>
          <div class="swfeature-item-text">
            <h4>${i.title}</h4>
            <p>${i.desc}</p>
          </div>
        </div>`).join('')}
    </div>
  </section>`;
}

function StatusSection() {
  const scanners = ['Storm', 'Detect.ac', 'Ocean', 'Napse', 'Echo'];
  return `
  <section class="status-section">
    <div class="section-header">
      <span class="section-tag">Products</span>
      <h2>Available Products</h2>
      <p>Currently available products & operational status of Aether.</p>
    </div>
    <div class="product-status-card">
      <div class="product-status-icon"><i class="fas fa-shield-alt"></i></div>
      <div class="product-status-info">
        <h4>Aether 2.0 External</h4>
        <p>Next-generation FiveM enhancement suite — Stable Release</p>
      </div>
      <span class="status-badge undetected">Undetected</span>
    </div>
    <div class="section-header" style="margin-top:3rem">
      <span class="section-tag">Status</span>
      <h2>Scanner Status</h2>
      <p>Current detection status from scanners. This applies to all of our products.</p>
    </div>
    <div class="scanner-list">
      ${scanners.map(s => `
        <div class="scanner-row">
          <div class="scanner-row-icon"><i class="fas fa-search"></i></div>
          <span class="scanner-row-name">${s}</span>
          <span class="status-badge undetected">Undetected</span>
        </div>`).join('')}
    </div>
  </section>`;
}

function FAQSection() {
  const faqs = [
    { q: 'How fast is delivery?',          a: 'Access is granted instantly after your payment is confirmed. You will receive your credentials within seconds.' },
    { q: 'Is my account safe?',            a: 'Yes. Our bypass system is designed to leave zero footprint. We use advanced stealth techniques to keep your account protected.' },
    { q: 'What anti-cheats are bypassed?', a: 'Aether bypasses all major FiveM anti-cheat systems including Storm, Detect.ac, Ocean, Napse, and Echo.' },
    { q: 'Do you offer refunds?',          a: 'All sales are final. Refunds may be considered on a case-by-case basis. Contact support on Discord for assistance.' },
    { q: 'How do I get support?',          a: 'Join our Discord server and open a support ticket. Our team is available 24/7 to help you with any issues.' },
  ];
  return `
  <section class="faq-section">
    <div class="section-header">
      <span class="section-tag">FAQ</span>
      <h2>Frequently Asked Questions</h2>
      <p>Everything you need to know before getting started</p>
    </div>
    <div class="faq-list">
      ${faqs.map(f => `
        <div class="faq-item">
          <button class="faq-question" onclick="toggleFaq(this)">
            <span>${f.q}</span>
            <span class="faq-icon"><i class="fas fa-plus"></i></span>
          </button>
          <div class="faq-answer"><p>${f.a}</p></div>
        </div>`).join('')}
    </div>
  </section>`;
}

function ProductsSection() {
  const products = state.products.length ? state.products : [
    { id: 'aether-public',   name: 'Aether Public',   price: 999,  duration_days: 30, desc: 'Perfect for casual players' },
    { id: 'aether-private',  name: 'Aether Private',  price: 2499, duration_days: 30, desc: 'Advanced features & priority support' },
    { id: 'aether-lifetime', name: 'Aether Lifetime', price: 9999, duration_days: -1, desc: 'One-time payment, forever access' }
  ];
  return `
  <section class="products-section" id="products">
    <div class="section-header">
      <span class="section-tag">Pricing</span>
      <h2>Choose Your Plan</h2>
      <p>All plans include full feature access and Discord support</p>
    </div>
    <div class="products-grid">
      ${products.map((p, i) => `
        <div class="product-card ${i === 1 ? 'featured' : ''}">
          ${i === 1 ? '<span class="product-popular-badge">Most Popular</span>' : ''}
          <div class="product-name">${escapeHtml(p.name)}</div>
          <div class="product-desc">${escapeHtml(p.desc || '')}</div>
          <div class="product-price">$${(p.price / 100).toFixed(2)}<span> / ${p.duration_days > 0 ? `${p.duration_days} days` : 'lifetime'}</span></div>
          <ul class="product-features">
            <li><i class="fas fa-check"></i> Full feature access</li>
            <li><i class="fas fa-check"></i> Automatic updates</li>
            <li><i class="fas fa-check"></i> Discord support</li>
            ${p.duration_days === -1 ? '<li><i class="fas fa-check"></i> Lifetime updates</li>' : ''}
            ${i >= 1 ? '<li><i class="fas fa-check"></i> Priority support</li>' : ''}
          </ul>
          <button class="btn btn-maintenance" disabled><i class="fas fa-tools"></i> Under Maintenance</button>
          <div class="maintenance-note"><i class="fas fa-info-circle"></i> Payments temporarily unavailable</div>
        </div>`).join('')}
    </div>
  </section>`;
}

function HomePage() {
  return `
  <div class="gradient-bg"></div>
  ${Navbar()}
  <main>
    <section class="hero">
      <div class="hero-badge"><span class="dot"></span> Now Available — Join Thousands of Users</div>
      <h1>The <span class="highlight">Premium</span> Gaming Solution</h1>
      <p>Undetected, reliable, and built by experts. Get instant access and stay ahead of the game.</p>
      <div class="hero-buttons">
        ${state.user
          ? `<button class="btn btn-primary" onclick="navigate('store')"><i class="fas fa-shopping-cart"></i> Browse Store</button>`
          : `<button class="btn btn-primary" onclick="loginWithDiscord()"><i class="fab fa-discord"></i> Login with Discord</button>`}
        <a href="https://discord.gg/" class="btn btn-outline" target="_blank" rel="noopener"><i class="fab fa-discord"></i> Join Discord</a>
      </div>
    </section>

    ${TickerBar()}
    ${HorizontalFeatures()}

    <section class="menu-showcase">
      <div class="menu-showcase-content">
        <div class="menu-image-wrap" id="menu-tilt">
          <img src="/images/menu-preview.png" alt="Aether Menu Interface" id="menu-img">
        </div>
        <div class="menu-desc">
          <div class="section-tag">Interface</div>
          <h2>Powerful &amp; Intuitive</h2>
          <p>Experience complete control with our sleek, modern interface. Over 100+ functions organized into intuitive categories, all accessible through a beautifully designed dark theme menu.</p>
          <ul class="menu-features-list">
            <li><i class="fas fa-check"></i> <span><strong>Extensive Options</strong> — ESP, visuals, player tracking, and advanced customization</span></li>
            <li><i class="fas fa-check"></i> <span><strong>Smart Search</strong> — Instantly find any function with the built-in search bar</span></li>
            <li><i class="fas fa-check"></i> <span><strong>Organized Categories</strong> — Everything neatly sorted for effortless navigation</span></li>
            <li><i class="fas fa-check"></i> <span><strong>Clean Dark UI</strong> — Minimalist design with smooth animations</span></li>
          </ul>
        </div>
      </div>
    </section>

    <section class="news-section">
      <div class="section-header">
        <span class="section-tag">Latest</span>
        <h2>News & Updates</h2>
      </div>
      <div class="news-carousel">
        <button class="carousel-btn prev" onclick="slideNews(-1)"><i class="fas fa-chevron-left"></i></button>
        <div class="news-slider" id="news-slider">
          <div class="news-slide">
            <div class="news-card">
              <div class="news-card-media">
                <a href="https://youtu.be/" target="_blank" rel="noopener" class="yt-thumb-link">
                  <img src="/images/youtube.png" alt="Aether Showcase" class="news-card-image">
                  <div class="yt-play-btn"><i class="fab fa-youtube"></i></div>
                </a>
              </div>
              <div class="news-card-content">
                <span class="news-badge">Showcase</span>
                <h3>Official Showcase Released</h3>
                <p>Watch our official showcase video to see exactly what Aether is capable of. Full feature demo included.</p>
                <a href="https://youtu.be/aH_AGl70vbA" class="news-link" target="_blank" rel="noopener">
                  <i class="fab fa-youtube"></i> Watch on YouTube <i class="fas fa-arrow-right"></i>
                </a>
              </div>
            </div>
          </div>
          <div class="news-slide">
            <div class="news-card">
              <div class="news-card-media">
                <img src="/images/pre-release.jpg" alt="Pre Release" class="news-card-image">
              </div>
              <div class="news-card-content">
                <span class="news-badge">New</span>
                <h3>Pre Releases Now Available</h3>
                <p>Get early access to upcoming features before public release. Join our Discord server to grab your pre-release access.</p>
                <a href="https://discord.gg/" class="news-link" target="_blank" rel="noopener">
                  <i class="fab fa-discord"></i> Join Discord <i class="fas fa-arrow-right"></i>
                </a>
              </div>
            </div>
          </div>
        </div>
        <button class="carousel-btn next" onclick="slideNews(1)"><i class="fas fa-chevron-right"></i></button>
      </div>
      <div class="carousel-dots">
        <div class="carousel-dot active" onclick="goToSlide(0)"></div>
        <div class="carousel-dot" onclick="goToSlide(1)"></div>
      </div>
    </section>

    <section class="features">
      <div class="section-header">
        <span class="section-tag">Why Aether</span>
        <h2>Built Different</h2>
      </div>
      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon"><i class="fas fa-shield-alt"></i></div>
          <h3>Undetected</h3>
          <p>Advanced bypass technology keeps you under the radar. Continuously updated to stay ahead.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon"><i class="fas fa-headset"></i></div>
          <h3>24/7 Support</h3>
          <p>Our dedicated support team is always available on Discord to help you with anything.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon"><i class="fas fa-bolt"></i></div>
          <h3>Instant Access</h3>
          <p>Get access immediately after purchase. No waiting, no delays — just log in and go.</p>
        </div>
      </div>
    </section>

    ${ProductsSection()}
    ${SoftwareFeatures()}
    ${StatusSection()}
    ${FAQSection()}
  </main>
  ${Footer()}`;
}

function ClientPage() {
  if (!state.user?.is_client) {
    navigate('home');
    return '<div class="loading">Unauthorized</div>';
  }
  const avatarUrl = `https://cdn.discordapp.com/avatars/${state.user.id}/${state.user.avatar}.png`;
  return `
  <div class="gradient-bg"></div>
  ${Navbar()}
  <main>
    <div class="client-page">
      <div class="client-header">
        <img src="${escapeHtml(avatarUrl)}" alt="" class="client-avatar"
          onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect fill=%22%23222%22 width=%2240%22 height=%2240%22/></svg>'">
        <div>
          <h1>Welcome, ${escapeHtml(state.user.username)}</h1>
          <p>You have access to the Aether client area.</p>
        </div>
      </div>
      <div class="client-cards">
        <div class="client-card">
          <div class="feature-icon"><i class="fas fa-download"></i></div>
          <h3>Download</h3>
          <p>Get the latest version of Aether.</p>
          <button class="btn btn-primary" style="margin-top:1rem"><i class="fas fa-download"></i> Download</button>
        </div>
        <div class="client-card">
          <div class="feature-icon"><i class="fas fa-key"></i></div>
          <h3>Your License</h3>
          <p>Active — granted via Discord role.</p>
        </div>
        <div class="client-card">
          <div class="feature-icon"><i class="fas fa-headset"></i></div>
          <h3>Support</h3>
          <p>Need help? Open a ticket on Discord.</p>
          <a href="https://discord.gg/" target="_blank" class="btn btn-outline" style="margin-top:1rem"><i class="fab fa-discord"></i> Discord</a>
        </div>
      </div>
    </div>
  </main>
  ${Footer()}`;
}

function StorePage() {
  return `
  <div class="gradient-bg"></div>
  ${Navbar()}
  <main style="padding-top: 100px;">${ProductsSection()}</main>
  ${Footer()}`;
}

function TOSPage() {
  return `
  <div class="gradient-bg"></div>
  ${Navbar()}
  <main>
    <div class="tos-container">
      <div class="tos-header">
        <h1>Terms of Service</h1>
        <p>Last updated: January 2026</p>
      </div>
      <div class="tos-content">
        <div class="tos-section"><h2>1. Acceptance of Terms</h2><p>By accessing and using Aether services, you agree to be bound by these Terms of Service. If you do not agree, please do not use our services.</p></div>
        <div class="tos-section"><h2>2. Description of Service</h2><p>Aether provides software solutions for gaming purposes. Our services are provided "as is" and we make no warranties regarding availability, reliability, or functionality.</p></div>
        <div class="tos-section"><h2>3. User Responsibilities</h2><p>Users are responsible for:</p><ul><li>Maintaining the confidentiality of their account</li><li>All activities that occur under their account</li><li>Complying with all applicable laws and regulations</li><li>Not sharing or redistributing our software</li></ul></div>
        <div class="tos-section"><h2>4. Prohibited Activities</h2><p>Users may not:</p><ul><li>Reverse engineer, decompile, or disassemble our software</li><li>Share, sell, or distribute access to our services</li><li>Use our services for any illegal purposes</li><li>Attempt to bypass any security measures</li></ul></div>
        <div class="tos-section"><h2>5. Refund Policy</h2><p>All sales are final. Refunds may be considered on a case-by-case basis at our sole discretion. Contact support on Discord for refund requests.</p></div>
        <div class="tos-section"><h2>6. Limitation of Liability</h2><p>Aether shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of our services.</p></div>
        <div class="tos-section"><h2>7. Account Termination</h2><p>We reserve the right to terminate or suspend your account at any time, without prior notice, for conduct that violates these Terms of Service.</p></div>
        <div class="tos-section"><h2>8. Changes to Terms</h2><p>We reserve the right to modify these terms at any time. Continued use of our services after changes constitutes acceptance of the new terms.</p></div>
        <div class="tos-section"><h2>9. Contact</h2><p>For questions about these Terms of Service, please contact us through our Discord server.</p></div>
      </div>
    </div>
  </main>
  ${Footer()}`;
}

function DashboardPage() {
  if (!state.user) { navigate('home'); return '<div class="loading">Redirecting...</div>'; }
  const active = state.purchases.filter(p => p.status === 'completed');
  return `
  <div class="gradient-bg"></div>
  ${Navbar()}
  <main>
    <div class="dashboard">
      <aside class="sidebar">
        <div class="sidebar-section">
          <div class="sidebar-section-label">Menu</div>
          <nav class="sidebar-nav">
            <a href="/dashboard" class="active" onclick="navigate('dashboard'); return false;"><i class="fas fa-home"></i> Overview</a>
            <a href="/store" onclick="navigate('store'); return false;"><i class="fas fa-shopping-cart"></i> Store</a>
            <a href="#"><i class="fas fa-download"></i> Downloads</a>
            <a href="https://discord.gg/" target="_blank" rel="noopener"><i class="fab fa-discord"></i> Support</a>
          </nav>
        </div>
      </aside>
      <div class="dashboard-content">
        <div class="dashboard-header">
          <h1>Welcome back, ${escapeHtml(state.user.username)}</h1>
          <p>Manage your subscriptions and downloads</p>
        </div>
        <div class="stats-grid">
          <div class="stat-card"><h3>Active Subscriptions</h3><div class="value success">${active.length}</div></div>
          <div class="stat-card"><h3>Account Status</h3><div class="value success">Active</div></div>
        </div>
        <div class="section-title">Your Purchases</div>
        ${active.length
          ? `<div class="purchases-list">${active.map(p => `
              <div class="purchase-card">
                <div class="purchase-info">
                  <h3>${escapeHtml(p.product_name)}</h3>
                  <p>${p.expires_at ? `Expires ${new Date(p.expires_at).toLocaleDateString()}` : 'Lifetime access'}</p>
                </div>
                <div class="purchase-status active"><i class="fas fa-check-circle"></i> Active</div>
              </div>`).join('')}</div>`
          : `<div class="empty-state">
              <p>No active subscriptions yet.</p>
              <button class="btn btn-primary" onclick="navigate('store')"><i class="fas fa-shopping-cart"></i> Browse Store</button>
            </div>`}
      </div>
    </div>
  </main>`;
}

/* ===== ADMIN TABLES ===== */
function AdminLogsTable(logs) {
  if (!logs.length) return '<p style="color:var(--text-2);padding:1rem 0">No activity logs yet.</p>';
  const colors = { login:'success', register:'info', logout:'warning', purchase:'success', checkout_started:'info', user_banned:'error', user_unbanned:'warning' };
  return `
  <div class="admin-table-container">
    <table class="admin-table">
      <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th><th>IP</th></tr></thead>
      <tbody>${logs.map(l => `
        <tr>
          <td>${new Date(l.created_at).toLocaleString()}</td>
          <td>${escapeHtml(l.username || 'Unknown')}</td>
          <td><span class="badge ${colors[l.action] || ''}">${escapeHtml(l.action)}</span></td>
          <td>${escapeHtml(l.details || '—')}</td>
          <td>${escapeHtml(l.ip_address || '—')}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

function AdminUsersTable(users) {
  if (!users.length) return '<p style="color:var(--text-2);padding:1rem 0">No users yet.</p>';
  return `
  <div class="admin-table-container">
    <table class="admin-table">
      <thead><tr><th>User</th><th>Discord ID</th><th>Purchases</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${users.map(u => `
        <tr>
          <td><div class="user-cell">
            <img src="https://cdn.discordapp.com/avatars/${u.discord_id}/${u.avatar}.png"
              onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect fill=%22%236366f1%22 width=%2240%22 height=%2240%22/></svg>'" alt="">
            ${escapeHtml(u.username)}
          </div></td>
          <td><code>${u.discord_id}</code></td>
          <td>${u.purchase_count || 0}</td>
          <td>${new Date(u.created_at).toLocaleDateString()}</td>
          <td><span class="badge ${u.banned ? 'error' : 'success'}">${u.banned ? 'Banned' : 'Active'}</span></td>
          <td>${u.banned
            ? `<button class="btn btn-sm btn-success" onclick="banUser('${u.id}', false)">Unban</button>`
            : `<button class="btn btn-sm btn-danger" onclick="banUser('${u.id}', true, 'Banned by admin')">Ban</button>`}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

function AdminPurchasesTable(purchases) {
  if (!purchases.length) return '<p style="color:var(--text-2);padding:1rem 0">No purchases yet.</p>';
  return `
  <div class="admin-table-container">
    <table class="admin-table">
      <thead><tr><th>User</th><th>Product</th><th>Status</th><th>Date</th><th>Expires</th></tr></thead>
      <tbody>${purchases.map(p => `
        <tr>
          <td>${escapeHtml(p.username)}</td>
          <td>${escapeHtml(p.product_name)}</td>
          <td><span class="badge ${p.status === 'completed' ? 'success' : ''}">${p.status}</span></td>
          <td>${new Date(p.created_at).toLocaleDateString()}</td>
          <td>${p.expires_at ? new Date(p.expires_at).toLocaleDateString() : 'Lifetime'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

function AdminBannedIPsTable(ips) {
  if (!ips?.length) return '<p style="color:var(--text-2);padding:1rem 0">No banned IPs.</p>';
  return `
  <div class="admin-table-container">
    <table class="admin-table">
      <thead><tr><th>IP Address</th><th>Reason</th><th>Banned By</th><th>Date</th><th>Expires</th><th>Actions</th></tr></thead>
      <tbody>${ips.map(ip => `
        <tr>
          <td><code>${escapeHtml(ip.ip_address)}</code></td>
          <td>${escapeHtml(ip.reason || '—')}</td>
          <td>${escapeHtml(ip.banned_by || '—')}</td>
          <td>${new Date(ip.created_at).toLocaleDateString()}</td>
          <td>${ip.expires_at ? new Date(ip.expires_at).toLocaleString() : '<span class="badge error">Permanent</span>'}</td>
          <td><button class="btn btn-sm btn-success" onclick="unbanIP('${escapeHtml(ip.ip_address)}')">Unban</button></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

function AdminPage() {
  if (!state.user?.is_admin) { navigate('home'); return '<div class="loading">Unauthorized</div>'; }
  const s = state.admin.stats || {};
  return `
  <div class="gradient-bg"></div>
  ${Navbar()}
  <main>
    <div class="dashboard admin-dashboard">
      <aside class="sidebar">
        <div class="sidebar-section">
          <div class="sidebar-section-label">Admin</div>
          <nav class="sidebar-nav">
            <a href="#" class="active" onclick="showAdminTab('overview'); return false;"><i class="fas fa-chart-line"></i> Overview</a>
            <a href="#" onclick="showAdminTab('logs'); return false;"><i class="fas fa-history"></i> Activity Logs</a>
            <a href="#" onclick="showAdminTab('users'); return false;"><i class="fas fa-users"></i> Users</a>
            <a href="#" onclick="showAdminTab('purchases'); return false;"><i class="fas fa-receipt"></i> Purchases</a>
            <a href="#" onclick="showAdminTab('ips'); return false;"><i class="fas fa-ban"></i> Banned IPs</a>
          </nav>
        </div>
      </aside>
      <div class="dashboard-content">
        <div class="dashboard-header">
          <h1><i class="fas fa-shield-alt" style="color:var(--indigo-light)"></i> Admin Panel</h1>
          <p>Manage users, view logs, and monitor activity</p>
        </div>
        <div id="admin-content">
          <div class="stats-grid">
            <div class="stat-card"><h3>Total Users</h3><div class="value indigo">${s.totalUsers||0}</div></div>
            <div class="stat-card"><h3>Total Purchases</h3><div class="value success">${s.totalPurchases||0}</div></div>
            <div class="stat-card"><h3>Total Revenue</h3><div class="value">$${((s.totalRevenue||0)/100).toFixed(2)}</div></div>
            <div class="stat-card"><h3>Today's Logins</h3><div class="value">${s.todayLogins||0}</div></div>
            <div class="stat-card"><h3>New Users Today</h3><div class="value">${s.todayRegistrations||0}</div></div>
            <div class="stat-card"><h3>Banned IPs</h3><div class="value error">${s.bannedIPs||0}</div></div>
          </div>
          <div class="section-title" style="margin-top:2rem">Recent Activity</div>
          ${AdminLogsTable(state.admin.logs.slice(0, 10))}
        </div>
      </div>
    </div>
  </main>`;
}

async function showAdminTab(tab) {
  const content = document.getElementById('admin-content');
  if (!content) return;
  document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
  event?.target?.closest('a')?.classList.add('active');
  if (tab === 'overview') {
    await loadAdminStats(); await loadAdminLogs(); render();
  } else if (tab === 'logs') {
    await loadAdminLogs();
    content.innerHTML = `
      <div class="section-title">Activity Logs</div>
      <div class="filter-bar">
        <select onchange="filterLogs(this.value)">
          <option value="all">All Actions</option>
          <option value="login">Logins</option>
          <option value="register">Registrations</option>
          <option value="purchase">Purchases</option>
          <option value="logout">Logouts</option>
          <option value="ip_banned">IP Bans</option>
        </select>
      </div>
      ${AdminLogsTable(state.admin.logs)}`;
  } else if (tab === 'users') {
    await loadAdminUsers();
    content.innerHTML = `<div class="section-title">Users</div>${AdminUsersTable(state.admin.users)}`;
  } else if (tab === 'purchases') {
    await loadAdminPurchases();
    content.innerHTML = `<div class="section-title">Purchases</div>${AdminPurchasesTable(state.admin.purchases)}`;
  } else if (tab === 'ips') {
    await loadBannedIPs();
    content.innerHTML = `
      <div class="admin-header-row">
        <div class="section-title" style="margin:0">Banned IPs</div>
        <button class="btn btn-danger btn-sm" onclick="showBanIPModal()"><i class="fas fa-plus"></i> Ban IP</button>
      </div>
      ${AdminBannedIPsTable(state.admin.bannedIPs)}`;
  }
}

async function filterLogs(action) {
  await loadAdminLogs(action);
  const container = document.querySelector('#admin-content .admin-table-container');
  if (container) container.outerHTML = AdminLogsTable(state.admin.logs);
}

/* ===== ANIMATIONS ===== */
function initScrollReveal() {
  const els = document.querySelectorAll(
    '.feature-card, .hfeature-card, .swfeature-item, .product-card, ' +
    '.scanner-row, .faq-item, .section-header, .menu-showcase-content, ' +
    '.news-card, .product-status-card, .stat-card'
  );
  els.forEach((el, i) => {
    el.classList.add('reveal');
    const delay = (i % 5);
    if (delay) el.classList.add(`reveal-delay-${delay}`);
  });
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
  }, { threshold: 0.1 });
  els.forEach(el => observer.observe(el));
}

function initCursorGlow() {
  if (window.matchMedia('(pointer: coarse)').matches) return;
  let cursor = document.getElementById('custom-cursor');
  if (!cursor) {
    cursor = document.createElement('div');
    cursor.id = 'custom-cursor';
    cursor.innerHTML = '<div class="cursor-dot"></div>';
    document.body.appendChild(cursor);
  }
  document.addEventListener('mousemove', e => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top  = e.clientY + 'px';
  });
}

function initCountUp() {
  document.querySelectorAll('.stat-card .value').forEach(el => {
    const raw = el.textContent.trim();
    const num = parseFloat(raw.replace(/[^0-9.]/g, ''));
    if (isNaN(num) || num === 0) return;
    const isFloat = raw.includes('.');
    const prefix = raw.match(/^[^0-9]*/)?.[0] || '';
    const suffix = raw.match(/[^0-9.]+$/)?.[0] || '';
    let start = null;
    const duration = 1200;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      function step(ts) {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        const val = num * ease;
        el.textContent = prefix + (isFloat ? val.toFixed(2) : Math.floor(val)) + suffix;
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }, { threshold: 0.5 });
    observer.observe(el);
  });
}
function initTicker() {
  const track = document.getElementById('ticker-track');
  if (!track) return;
  // measure half-width (the "one set" width) after render
  const halfW = track.scrollWidth / 2;
  let x = 0;
  let paused = false;
  track.closest('.ticker-wrap').addEventListener('mouseenter', () => paused = true);
  track.closest('.ticker-wrap').addEventListener('mouseleave', () => paused = false);
  // keep on GPU layer always
  track.style.willChange = 'transform';
  track.style.transform = 'translate3d(0,0,0)';
  function tick() {
    if (!paused) {
      x -= 0.5; // px per frame ~30px/s at 60fps
      if (x <= -halfW) x += halfW;
      track.style.transform = `translate3d(${x}px,0,0)`;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
function initTilt() {
  // News card images — only tilt if it's the video embed, not the static pre-release image
  document.querySelectorAll('.news-card-media').forEach(container => {
    const img = container.querySelector('.news-card-image');
    if (img) return; // static image — no tilt
    container.addEventListener('mousemove', (e) => {
      const rect = container.getBoundingClientRect();
      const rx = (e.clientY - rect.top  - rect.height / 2) / 12;
      const ry = (rect.width / 2 - (e.clientX - rect.left)) / 12;
      container.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) scale(1.02)`;
    });
    container.addEventListener('mouseleave', () => {
      container.style.transform = 'rotateX(0) rotateY(0) scale(1)';
    });
  });
  // Menu preview image
  const menuWrap = document.getElementById('menu-tilt');
  const menuImg  = document.getElementById('menu-img');
  if (menuWrap && menuImg) {
    menuWrap.addEventListener('mousemove', (e) => {
      const rect = menuWrap.getBoundingClientRect();
      const rx = (e.clientY - rect.top  - rect.height / 2) / 14;
      const ry = (rect.width / 2 - (e.clientX - rect.left)) / 14;
      menuImg.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) scale(1.03)`;
    });
    menuWrap.addEventListener('mouseleave', () => {
      menuImg.style.transform = 'rotateX(0) rotateY(0) scale(1)';
    });
  }
}

/* ===== RENDER ===== */
function render() {
  const app = document.getElementById('app');
  if (state.loading) { app.innerHTML = LoadingPage(); return; }
  switch (state.currentPage) {
    case 'dashboard': app.innerHTML = DashboardPage(); break;
    case 'store':     app.innerHTML = StorePage(); break;
    case 'client':    app.innerHTML = ClientPage(); break;
    case 'admin':     app.innerHTML = AdminPage(); break;
    case 'tos':       app.innerHTML = TOSPage(); break;
    default:          app.innerHTML = HomePage();
  }
  initTilt();
  initTicker();
  initScrollReveal();
  initCursorGlow();
  initCountUp();
}

/* ===== INIT ===== */
async function init() {
  injectLoader();
  state.loading = true; render();
  const minLoad = new Promise(r => setTimeout(r, 1200));
  const path = window.location.pathname.replace(/^\//, '') || 'home';
  const params = new URLSearchParams(window.location.search);

  // handle error redirect from Python backend
  if (params.get('error')) {
    const err = params.get('error');
    window.history.replaceState({}, '', '/');
    await loadUser();
    await minLoad;
    state.loading = false;
    state.currentPage = 'home';
    render();
    if (err === 'no_access') toast('You do not have the Client role.', 'error');
    else toast('Login failed. Try again.', 'error');
    return;
  }

  state.currentPage = path || 'home';
  await Promise.all([loadUser(), minLoad]);
  state.loading = false;

  // if landing on /client, verify access
  if (state.currentPage === 'client' && !state.user?.is_client) {
    state.currentPage = 'home';
    toast('Access denied.', 'error');
  }

  render();
}

window.addEventListener('popstate', () => {
  state.currentPage = window.location.pathname.replace(/^\//, '') || 'home';
  render();
});

init();
