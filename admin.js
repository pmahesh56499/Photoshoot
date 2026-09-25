window.__KISHORE_ADMIN_LOADED = true;

(function () {
  'use strict';

  var cfg = window.KS_CONFIG || {};
  var supabaseReady = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && String(cfg.supabaseAnonKey).indexOf('PASTE_') === -1);
  var cloudinaryReady = !!(cfg.cloudinaryCloudName && cfg.cloudinaryUploadPreset && String(cfg.cloudinaryCloudName).indexOf('PASTE_') === -1);
  var supabase = null;

  function byId(id) { return document.getElementById(id); }
  function msg(el, text, type) {
    if (!el) return;
    el.textContent = text || '';
    el.className = 'form-message' + (type ? ' ' + type : '');
  }
  function setConnection(text, ready) {
    var el = byId('connectionStatus');
    if (!el) return;
    el.textContent = text;
    if (el.classList) el.classList.toggle('ready', !!ready);
  }
  function showDashboard(session) {
    var login = byId('loginView');
    var dash = byId('dashboardView');
    if (login) login.hidden = true;
    if (dash) dash.hidden = false;
    var email = byId('adminEmail');
    if (email) email.textContent = session && session.user ? (session.user.email || '') : '';
    loadGallery();
  }
  function showLogin() {
    var login = byId('loginView');
    var dash = byId('dashboardView');
    if (dash) dash.hidden = true;
    if (login) login.hidden = false;
  }
  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    var units = ['B', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0) + ' ' + units[i];
  }
  function renderFileSummary() {
    var input = byId('mediaFiles');
    var out = byId('fileSummary');
    if (!input || !out) return;
    var files = Array.prototype.slice.call(input.files || []);
    var total = files.reduce(function (n, f) { return n + f.size; }, 0);
    out.textContent = files.length ? files.length + ' file' + (files.length > 1 ? 's' : '') + ' selected • ' + formatBytes(total) : 'No files selected';
  }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];
    });
  }

  function init() {
    var loginMessage = byId('loginMessage');
    if (!supabaseReady) {
      msg(loginMessage, 'Supabase configuration is missing.', 'error');
      setConnection('Config needed', false);
      return;
    }
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      msg(loginMessage, 'Authentication library could not be loaded. Please refresh once and try again.', 'error');
      setConnection('Library error', false);
      return;
    }

    try {
      supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
      setConnection(cloudinaryReady ? 'Connected' : 'Cloudinary config needed', cloudinaryReady);
      supabase.auth.getSession().then(function (result) {
        if (result.error) throw result.error;
        if (result.data && result.data.session) showDashboard(result.data.session);
      }).catch(function (error) {
        msg(loginMessage, error.message || 'Could not connect to authentication service.', 'error');
        setConnection('Connection error', false);
      });
      supabase.auth.onAuthStateChange(function (_event, session) {
        if (session) showDashboard(session); else showLogin();
      });
    } catch (error) {
      msg(loginMessage, error.message || 'Could not initialize authentication.', 'error');
      setConnection('Connection error', false);
    }
  }

  function bindLogin() {
    var form = byId('loginForm');
    if (!form) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      event.stopPropagation();
      var loginMessage = byId('loginMessage');
      if (!supabase) {
        msg(loginMessage, 'Authentication service is not available. Please refresh and try again.', 'error');
        return;
      }
      var emailEl = byId('email');
      var passwordEl = byId('password');
      var email = emailEl ? emailEl.value.trim() : '';
      var password = passwordEl ? passwordEl.value : '';
      if (!email || !password) {
        msg(loginMessage, 'Please enter your email and password.', 'error');
        return;
      }
      var button = form.querySelector('button[type="submit"]');
      if (button) { button.disabled = true; button.textContent = 'Signing in…'; }
      msg(loginMessage, 'Connecting to secure sign-in…');

      var timedOut = new Promise(function (_, reject) {
        setTimeout(function () { reject(new Error('Sign-in request timed out after 15 seconds. Please check your internet connection.')); }, 15000);
      });
      Promise.race([supabase.auth.signInWithPassword({ email: email, password: password }), timedOut])
        .then(function (result) {
          if (result.error) throw result.error;
          if (!result.data || !result.data.session) throw new Error('Sign-in completed but no session was returned.');
          msg(loginMessage, 'Signed in successfully.', 'success');
          showDashboard(result.data.session);
        })
        .catch(function (error) {
          console.error('Kishore Studios sign-in error:', error);
          msg(loginMessage, 'Sign-in failed: ' + (error && error.message ? error.message : 'Please check your email and password.'), 'error');
        })
        .finally(function () {
          if (button) { button.disabled = false; button.textContent = 'Sign in'; }
        });
    });
  }

  function bindLogout() {
    var button = byId('logoutBtn');
    if (!button) return;
    button.addEventListener('click', function () {
      if (supabase) supabase.auth.signOut().finally(showLogin);
      else showLogin();
    });
  }

  function uploadToCloudinary(file) {
    if (!cloudinaryReady) return Promise.reject(new Error('Cloudinary configuration is incomplete.'));
    var type = file.type.indexOf('video/') === 0 ? 'video' : 'image';
    var endpoint = 'https://api.cloudinary.com/v1_1/' + encodeURIComponent(cfg.cloudinaryCloudName) + '/' + type + '/upload';
    var form = new FormData();
    form.append('file', file);
    form.append('upload_preset', cfg.cloudinaryUploadPreset);
    form.append('folder', 'kishore-studios');
    return fetch(endpoint, { method: 'POST', body: form }).then(function (response) {
      return response.json().then(function (result) {
        if (!response.ok) throw new Error(result.error && result.error.message ? result.error.message : 'Cloudinary upload failed.');
        return result;
      });
    });
  }

  function bindUpload() {
    var form = byId('uploadForm');
    var input = byId('mediaFiles');
    if (!form) return;
    if (input) input.addEventListener('change', renderFileSummary);
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var files = input ? Array.prototype.slice.call(input.files || []) : [];
      var uploadMessage = byId('uploadMessage');
      var uploadBtn = byId('uploadBtn');
      if (!files.length) return msg(uploadMessage, 'Please select at least one file.', 'error');
      if (!supabase) return msg(uploadMessage, 'Supabase is not configured.', 'error');
      if (!cloudinaryReady) return msg(uploadMessage, 'Cloudinary configuration is incomplete.', 'error');
      var title = byId('title').value.trim();
      var category = byId('category').value;
      if (uploadBtn) uploadBtn.disabled = true;
      var progress = byId('uploadProgress');
      if (progress) progress.hidden = false;
      var completed = 0;

      files.reduce(function (chain, file) {
        return chain.then(function () {
          if (file.size > 100 * 1024 * 1024) throw new Error(file.name + ' is larger than 100 MB.');
          var text = byId('progressText');
          if (text) text.textContent = 'Uploading ' + (completed + 1) + ' of ' + files.length + ': ' + file.name;
          return uploadToCloudinary(file).then(function (result) {
            return supabase.from('gallery').insert({
              public_id: result.public_id,
              secure_url: result.secure_url,
              resource_type: result.resource_type || (file.type.indexOf('video/') === 0 ? 'video' : 'image'),
              title: title,
              category: category
            });
          }).then(function (result) {
            if (result.error) throw new Error('Uploaded ' + file.name + ', but database save failed: ' + result.error.message);
            completed++;
            var bar = byId('progressBar');
            if (bar) bar.style.width = Math.round(completed / files.length * 100) + '%';
          });
        });
      }, Promise.resolve()).then(function () {
        msg(uploadMessage, completed + ' item' + (completed > 1 ? 's' : '') + ' added to the public gallery.', 'success');
        form.reset();
        renderFileSummary();
        return loadGallery();
      }).catch(function (error) {
        console.error('Kishore Studios upload error:', error);
        msg(uploadMessage, error.message || 'Upload failed.', 'error');
      }).finally(function () {
        if (uploadBtn) uploadBtn.disabled = false;
        if (progress) progress.hidden = true;
      });
    });
  }

  function loadGallery() {
    var gallery = byId('adminGallery');
    if (!supabase || !gallery) return Promise.resolve();
    gallery.innerHTML = '<p class="empty-state">Loading gallery…</p>';
    return supabase.from('gallery').select('*').order('created_at', { ascending: false }).then(function (result) {
      if (result.error) throw result.error;
      var data = result.data || [];
      var count = byId('galleryCount');
      if (count) count.textContent = data.length + ' item' + (data.length === 1 ? '' : 's');
      if (!data.length) {
        gallery.innerHTML = '<p class="empty-state">No uploads yet. Your first upload will appear here.</p>';
        return;
      }
      gallery.innerHTML = data.map(function (item) {
        var media = item.resource_type === 'video'
          ? '<video src="' + escapeHtml(item.secure_url) + '" muted playsinline preload="metadata"></video>'
          : '<img src="' + escapeHtml(item.secure_url) + '" alt="' + escapeHtml(item.title || 'Kishore Studios photo') + '" loading="lazy">';
        return '<article class="admin-card"><div class="admin-media">' + media + '<span>' + escapeHtml(item.category || 'Gallery') + '</span></div><div class="admin-card-body"><div><strong>' + escapeHtml(item.title || 'Untitled') + '</strong><small>' + escapeHtml(item.public_id || '') + '</small></div><button class="delete-btn" data-id="' + escapeHtml(item.id) + '" type="button">Remove</button></div></article>';
      }).join('');
    }).catch(function (error) {
      gallery.innerHTML = '<p class="empty-state error">' + escapeHtml(error.message || 'Could not load gallery.') + '</p>';
    });
  }

  function bindDelete() {
    var gallery = byId('adminGallery');
    if (!gallery) return;
    gallery.addEventListener('click', function (event) {
      var button = event.target.closest ? event.target.closest('.delete-btn') : null;
      if (!button || !supabase) return;
      if (!window.confirm('Remove this item from the public gallery?')) return;
      button.disabled = true;
      supabase.from('gallery').delete().eq('id', button.getAttribute('data-id')).then(function (result) {
        if (result.error) throw result.error;
        return loadGallery();
      }).catch(function (error) {
        window.alert(error.message || 'Delete failed.');
        button.disabled = false;
      });
    });
  }

  bindLogin();
  bindLogout();
  bindUpload();
  bindDelete();
  init();
})();
