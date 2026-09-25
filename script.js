const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');

if (menuButton && nav) {
  menuButton.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.textContent = open ? '×' : '☰';
  });
  document.querySelectorAll('.nav a').forEach(link => link.addEventListener('click', () => {
    nav.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.textContent = '☰';
  }));
}

document.getElementById('year').textContent = new Date().getFullYear();

const cfg = window.KS_CONFIG;
const canLoadGallery = cfg?.supabaseAnonKey && !cfg.supabaseAnonKey.includes('PASTE_');

if (canLoadGallery && window.supabase) {
  const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  loadPublicGallery(client);
  loadOwnerProfile(client);
}

async function loadPublicGallery(client) {
  const container = document.getElementById('liveGallery');
  const status = document.getElementById('galleryStatus');
  if (!container) return;

  const { data, error } = await client.from('gallery').select('id,public_id,secure_url,resource_type,title,category').order('created_at', { ascending: false });
  if (error || !data?.length) return;

  container.innerHTML = data.map((item, index) => {
    const media = item.resource_type === 'video'
      ? `<video src="${item.secure_url}" controls muted playsinline preload="metadata"></video>`
      : `<img src="${item.secure_url}" alt="${escapeHtml(item.title || 'Kishore Studios photograph')}" loading="lazy">`;
    const layout = index % 5 === 0 ? ' tall' : (index % 5 === 4 ? ' wide' : '');
    return `<figure class="gallery-item${layout}">${media}<figcaption>${escapeHtml(item.title || item.category || 'Kishore Studios')}</figcaption></figure>`;
  }).join('');
  if (status) status.textContent = `${data.length} memories from Kishore Studios.`;
}

async function loadOwnerProfile(client) {
  const avatar = document.getElementById('ownerAvatar');
  if (!avatar) return;
  const { data, error } = await client.from('gallery').select('secure_url,resource_type,title,category').eq('category', 'Portraits').order('created_at', { ascending: false }).limit(1);
  if (error || !data?.length || data[0].resource_type === 'video') return;
  avatar.innerHTML = `<img src="${data[0].secure_url}" alt="Kishore — owner of Kishore Studios" loading="lazy">`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}
