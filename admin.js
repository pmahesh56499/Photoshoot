const cfg = window.KS_CONFIG || {};
const supabaseReady = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && !String(cfg.supabaseAnonKey).includes('PASTE_'));
const cloudinaryReady = Boolean(cfg.cloudinaryCloudName && cfg.cloudinaryUploadPreset && !String(cfg.cloudinaryCloudName).includes('PASTE_'));
const supabaseClientReady = supabaseReady && Boolean(window.supabase?.createClient);
const supabase = supabaseClientReady ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

const $ = (id) => document.getElementById(id);
const loginView = $('loginView');
const dashboardView = $('dashboardView');
const loginForm = $('loginForm');
const loginMessage = $('loginMessage');
const uploadForm = $('uploadForm');
const uploadMessage = $('uploadMessage');
const uploadBtn = $('uploadBtn');
const mediaFiles = $('mediaFiles');
const fileSummary = $('fileSummary');
const adminGallery = $('adminGallery');

function message(el, text, type = '') {
  if (!el) return;
  el.textContent = text;
  el.className = `form-message ${type}`;
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}

function renderFileSummary() {
  if (!mediaFiles || !fileSummary) return;
  const files = [...mediaFiles.files];
  fileSummary.textContent = files.length
    ? `${files.length} file${files.length > 1 ? 's' : ''} selected • ${formatBytes(files.reduce((n, f) => n + f.size, 0))}`
    : 'No files selected';
}

async function init() {
  if (!supabaseReady) {
    message(loginMessage, 'Supabase configuration is missing.', 'error');
    $('connectionStatus').textContent = 'Config needed';
    return;
  }

  if (!supabaseClientReady) {
    message(loginMessage, 'Authentication library could not be loaded. Please refresh the page and try again.', 'error');
    $('connectionStatus').textContent = 'Connection error';
    return;
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session) showDashboard(data.session);
    $('connectionStatus').textContent = cloudinaryReady ? 'Connected' : 'Cloudinary config needed';
    $('connectionStatus').classList.toggle('ready', cloudinaryReady);
  } catch (error) {
    message(loginMessage, error.message || 'Could not connect to authentication service.', 'error');
    $('connectionStatus').textContent = 'Connection error';
  }
}

function showDashboard(session) {
  loginView.hidden = true;
  dashboardView.hidden = false;
  $('adminEmail').textContent = session?.user?.email || '';
  loadGallery();
}

function showLogin() {
  if (dashboardView) dashboardView.hidden = true;
  if (loginView) loginView.hidden = false;
}

loginForm?.addEventListener('submit', async (event) => {
  // Always prevent the browser's native form submission. This avoids a page
  // reload (and the password field being cleared) if authentication is unavailable.
  event.preventDefault();
  event.stopPropagation();

  if (!supabase) {
    message(loginMessage, 'Authentication service is not available. Please refresh the page and try again.', 'error');
    return;
  }

  const email = $('email')?.value.trim();
  const password = $('password')?.value || '';
  if (!email || !password) {
    message(loginMessage, 'Please enter your email and password.', 'error');
    return;
  }

  const button = loginForm.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  message(loginMessage, 'Signing in…');

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    message(loginMessage, 'Signed in.', 'success');
    showDashboard(data.session);
  } catch (error) {
    console.error('Kishore Studios sign-in error:', error);
    message(loginMessage, error?.message || 'Sign-in failed. Please check your email and password.', 'error');
  } finally {
    if (button) button.disabled = false;
  }
});

$('logoutBtn')?.addEventListener('click', async () => {
  await supabase?.auth.signOut();
  showLogin();
});

mediaFiles?.addEventListener('change', renderFileSummary);

async function uploadToCloudinary(file) {
  if (!cloudinaryReady) throw new Error('Cloudinary configuration is incomplete.');
  const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cfg.cloudinaryCloudName)}/${resourceType}/upload`;
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', cfg.cloudinaryUploadPreset);
  form.append('folder', 'kishore-studios');
  const response = await fetch(endpoint, { method: 'POST', body: form });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || 'Cloudinary upload failed.');
  return result;
}

uploadForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const files = [...mediaFiles.files];
  if (!files.length) return message(uploadMessage, 'Please select at least one file.', 'error');
  if (!supabase) return message(uploadMessage, 'Supabase is not configured.', 'error');
  if (!cloudinaryReady) return message(uploadMessage, 'Cloudinary configuration is incomplete.', 'error');

  const title = $('title').value.trim();
  const category = $('category').value;
  uploadBtn.disabled = true;
  $('uploadProgress').hidden = false;
  message(uploadMessage, '');

  let completed = 0;
  try {
    for (const file of files) {
      if (file.size > 100 * 1024 * 1024) throw new Error(`${file.name} is larger than 100 MB.`);
      $('progressText').textContent = `Uploading ${completed + 1} of ${files.length}: ${file.name}`;
      const result = await uploadToCloudinary(file);
      const row = {
        public_id: result.public_id,
        secure_url: result.secure_url,
        resource_type: result.resource_type || (file.type.startsWith('video/') ? 'video' : 'image'),
        title,
        category
      };
      const { error } = await supabase.from('gallery').insert(row);
      if (error) throw new Error(`Uploaded ${file.name}, but database save failed: ${error.message}`);
      completed += 1;
      $('progressBar').style.width = `${Math.round((completed / files.length) * 100)}%`;
    }
    message(uploadMessage, `${completed} item${completed > 1 ? 's' : ''} added to the public gallery.`, 'success');
    uploadForm.reset();
    renderFileSummary();
    await loadGallery();
  } catch (error) {
    console.error('Kishore Studios upload error:', error);
    message(uploadMessage, error.message || 'Upload failed.', 'error');
  } finally {
    uploadBtn.disabled = false;
    $('uploadProgress').hidden = true;
  }
});

async function loadGallery() {
  if (!supabase || !adminGallery) return;
  adminGallery.innerHTML = '<p class="empty-state">Loading gallery…</p>';
  const { data, error } = await supabase.from('gallery').select('*').order('created_at', { ascending: false });
  if (error) {
    adminGallery.innerHTML = `<p class="empty-state error">${escapeHtml(error.message)}</p>`;
    return;
  }
  $('galleryCount').textContent = `${data.length} item${data.length === 1 ? '' : 's'}`;
  if (!data.length) {
    adminGallery.innerHTML = '<p class="empty-state">No uploads yet. Your first upload will appear here.</p>';
    return;
  }
  adminGallery.innerHTML = data.map(item => {
    const media = item.resource_type === 'video'
      ? `<video src="${escapeHtml(item.secure_url)}" muted playsinline preload="metadata"></video>`
      : `<img src="${escapeHtml(item.secure_url)}" alt="${escapeHtml(item.title || 'Kishore Studios photo')}" loading="lazy">`;
    return `<article class="admin-card"><div class="admin-media">${media}<span>${escapeHtml(item.category || 'Gallery')}</span></div><div class="admin-card-body"><div><strong>${escapeHtml(item.title || 'Untitled')}</strong><small>${escapeHtml(item.public_id || '')}</small></div><button class="delete-btn" data-id="${escapeHtml(item.id)}" type="button">Remove</button></div></article>`;
  }).join('');
}

adminGallery?.addEventListener('click', async (event) => {
  const button = event.target.closest('.delete-btn');
  if (!button || !supabase) return;
  if (!confirm('Remove this item from the public gallery?')) return;
  button.disabled = true;
  const { error } = await supabase.from('gallery').delete().eq('id', button.dataset.id);
  if (error) {
    alert(error.message);
    button.disabled = false;
    return;
  }
  await loadGallery();
});

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) showDashboard(session);
    else showLogin();
  });
}

// Surface unexpected JavaScript errors in the login area instead of silently
// falling back to the browser's native form submission.
window.addEventListener('error', (event) => {
  console.error(event.error || event.message);
  if (loginView && !dashboardView?.hidden === false) {
    message(loginMessage, 'The admin page encountered a browser error. Please refresh and try again.', 'error');
  }
});

init();
