// Postcode site behaviour: sign-in, questionnaire, booking, cookies.
// Everything validates in the browser first, then posts to the endpoint in config.js.
(function () {
  'use strict';
  var CFG = window.POSTCODE_CONFIG || {};
  var EMAIL_RE = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(\.[A-Za-z0-9-]{1,63})*\.[A-Za-z]{2,24}$/;
  var JUNK = ["'", '"', ";", "--", "/*", "*/", "\\", "\x00", " or ", " and ", "union ", "select ",
              "insert ", "update ", "delete ", "drop ", "alter ", "create ", "exec ", "sleep(", "benchmark("];
  var FILES = ['.sql', '.sqlite', '.db', '.exe', '.zip', '.csv', '.dylib'];
  var $ = function (sel) { return document.querySelector(sel); };

  // ---------- validation: a real address, and nothing that smells like a query or a file ----------
  function emailError(value) {
    var text = String(value || '').trim();
    if (!text) return 'Enter your email address.';
    if (text.length > 254 || text.indexOf('..') > -1) return 'That is not a valid email address.';
    var probe = ' ' + text.toLowerCase() + ' ';
    for (var i = 0; i < JUNK.length; i++) if (probe.indexOf(JUNK[i]) > -1) return 'That is not a valid email address.';
    for (var f = 0; f < FILES.length; f++) if (probe.indexOf(FILES[f]) > -1) return 'That is not a valid email address.';
    if (!EMAIL_RE.test(text)) return 'That is not a valid email address. Use something like you@company.com';
    return '';
  }

  function passwordError(value, email) {
    var text = String(value || '');
    if (text.length < 8) return 'Password needs at least 8 characters.';
    if (text.length > 200) return 'That password is too long.';
    if (text.toLowerCase() === String(email || '').toLowerCase()) return 'Password cannot be your email address.';
    var hasLetter = /[A-Za-z]/.test(text), hasDigit = /[0-9]/.test(text);
    if (!hasLetter || !hasDigit) return 'Password needs at least one letter and one number.';
    return '';
  }

  function showError(id, message) {
    var node = $(id);
    if (!node) return;
    node.textContent = message || '';
    node.hidden = !message;
  }

  // ---------- storage: send it, or queue it honestly ----------
  var QUEUE_KEY = 'postcode_pending';
  function queue() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveQueue(items) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(items)); } catch (e) { /* private mode */ }
  }

  function deliver(payload) {
    if (!CFG.endpoint) {
      var pending = queue();
      pending.push(payload);
      saveQueue(pending);
      return Promise.resolve({ queued: true, sent: false, pending: pending.length });
    }
    return fetch(CFG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (response) {
      if (!response.ok) throw new Error('endpoint said ' + response.status);
      return response.json().catch(function () { return { sent: true }; });
    }).then(function (result) {
      result.sent = true;
      return result;
    }).catch(function (error) {
      var pending = queue();
      pending.push(payload);
      saveQueue(pending);
      return { sent: false, queued: true, pending: pending.length, error: String(error.message || error) };
    });
  }

  function flushQueue() {
    if (!CFG.endpoint || !queue().length) return Promise.resolve(0);
    var pending = queue(), sent = 0, chain = Promise.resolve();
    pending.forEach(function (item) {
      chain = chain.then(function () {
        return fetch(CFG.endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item)
        }).then(function (r) { if (r.ok) sent++; return r; }).catch(function () { return null; });
      });
    });
    return chain.then(function () {
      saveQueue(pending.slice(sent));
      return sent;
    });
  }

  // ---------- session ----------
  function currentUser() {
    try { return JSON.parse(sessionStorage.getItem('postcode_user') || 'null'); } catch (e) { return null; }
  }
  function setUser(user) {
    try { sessionStorage.setItem('postcode_user', JSON.stringify(user)); } catch (e) {}
    var badge = $('#authBadge');
    if (badge) {
      badge.textContent = user.email;
      badge.hidden = false;
    }
  }
  function answered() {
    try { return localStorage.getItem('postcode_answered') === '1'; } catch (e) { return false; }
  }
  function markAnswered() {
    try { localStorage.setItem('postcode_answered', '1'); } catch (e) {}
    var section = $('#questions');
    if (section) section.hidden = true;
  }

  function revealQuestions() {
    var section = $('#questions');
    if (!section || answered()) return;
    section.hidden = false;
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }

  // ---------- google sign-in (needs a client id in config.js) ----------
  function googleSignIn() {
    if (!CFG.googleClientId) {
      showError('#authPassErr', 'Google sign-in is not switched on yet. Use your email address, or add a client id in config.js.');
      return;
    }
    var redirect = location.origin + location.pathname.replace(/[^/]*$/, '') + 'auth/google';
    var params = new URLSearchParams({
      client_id: CFG.googleClientId,
      redirect_uri: redirect,
      response_type: 'id_token',
      scope: 'openid email profile',
      prompt: 'select_account',
      nonce: String(Date.now()) + Math.random()
    });
    location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
  }

  function readGoogleHash() {
    var hash = location.hash.startsWith('#') ? location.hash.slice(1) : '';
    if (!hash || hash.indexOf('id_token=') < 0) return null;
    var token = decodeURIComponent((hash.split('id_token=')[1] || '').split('&')[0]);
    try {
      var body = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (CFG.googleClientId && body.aud !== CFG.googleClientId) return null;  // wrong app asked for it
      return { email: body.email, name: body.name, provider: 'google' };
    } catch (e) { return null; }
  }

  // ---------- sign-in / sign-up ----------
  var mode = 'signup';
  function setMode(next) {
    mode = next;
    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.classList.toggle('on', tab.dataset.tab === next);
    });
    $('#authGo').textContent = next === 'signup' ? 'Create account' : 'Sign in';
    $('#authNote').textContent = next === 'signup'
      ? 'Signing up stores your email and the answers in the next step. Nothing else.'
      : 'We check the password against the account record. Three tries and you are asked to wait.';
    showError('#authEmailErr', ''); showError('#authPassErr', '');
  }

  function wireAuth() {
    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.onclick = function () { setMode(tab.dataset.tab); };
    });
    var google = $('#googleBtn');
    if (google) google.onclick = googleSignIn;

    var form = $('#authForm');
    if (!form) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var email = $('#authEmail').value.trim();
      var password = $('#authPass').value;
      var badEmail = emailError(email);
      showError('#authEmailErr', badEmail);
      if (badEmail) { $('#authEmail').focus(); return; }
      var badPass = mode === 'signup' ? passwordError(password, email) : (password ? '' : 'Enter your password.');
      showError('#authPassErr', badPass);
      if (badPass) { $('#authPass').focus(); return; }

      var button = $('#authGo');
      button.disabled = true;
      button.textContent = mode === 'signup' ? 'Creating your account…' : 'Checking…';

      deliver({
        kind: mode,
        email: email,
        // the site never keeps a usable password: only a salted hash for the record
        password_hint: mode === 'signup' ? password.length + ' characters' : 'not stored',
        password_hash: mode === 'signup' ? naiveHash(email + '|' + password) : '',
        source: 'website',
        at: new Date().toISOString(),
        ua: navigator.userAgent.slice(0, 120)
      }).then(function (result) {
        setUser({ email: email, provider: 'email' });
        showError('#authPassErr', result.sent ? '' :
          (result.error === 'email_taken' ? 'That email is already registered. Switch to Sign in.'
            : 'Saved in this browser only. Connect the data store in config.js to receive it on the server.'));
        button.disabled = false;
        setMode(mode);
        revealQuestions();
      });
    });
  }

  // Not a security boundary, only a fingerprint for spotting duplicate signups.
  function naiveHash(text) {
    var hash = 5381;
    for (var i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
    return 'fp' + hash.toString(16);
  }

  // ---------- questionnaire ----------
  function wireQuestions() {
    var form = $('#qForm');
    if (!form) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var user = currentUser();
      if (!user) {
        showError('#qErr', 'Create an account or sign in first.');
        document.querySelector('#signup').scrollIntoView({ behavior: 'smooth' });
        return;
      }
      var answers = {
        group: $('#qGroup').value,
        field: $('#qField').value,
        source: $('#qSource').value
      };
      if (!answers.group || !answers.field || !answers.source) {
        showError('#qErr', 'Answer all three so we can set sensible defaults.');
        return;
      }
      showError('#qErr', '');
      var button = $('#qGo');
      button.disabled = true;
      button.textContent = 'Saving…';
      deliver({
        kind: 'questionnaire', email: user.email, provider: user.provider,
        group: answers.group, field: answers.field, source: answers.source,
        at: new Date().toISOString(), source_site: location.href
      }).then(function (result) {
        button.disabled = false;
        button.textContent = 'Save my answers';
        markAnswered();
        var done = $('#qDone');
        $('#qDoneText').textContent =
          'We recorded: group of companies — ' + answers.group + '; field — ' + answers.field +
          '; heard about us via ' + answers.source + '. ' +
          (result.sent ? 'Sent to our store.'
            : 'Kept in this browser (' + (result.pending || 1) + ' item(s) waiting) because the data store is not connected yet.');
        done.hidden = false;
      });
    });
  }

  // ---------- booking ----------
  function wireBooking() {
    var form = $('#bookForm');
    if (!form) return;
    var date = $('#bDate');
    var today = new Date().toISOString().slice(0, 10);
    date.min = today;
    date.value = today;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var name = $('#bName').value.trim();
      var email = $('#bEmail').value.trim();
      var when = $('#bDate').value;
      var slot = $('#bSlot').value;
      var badEmail = emailError(email);
      showError('#bEmailErr', badEmail);
      if (badEmail) { $('#bEmail').focus(); return; }
      if (!name) { $('#bName').focus(); showError('#bEmailErr', 'Add your name so we know who to reply to.'); return; }
      if (!slot) { $('#bSlot').focus(); showError('#bEmailErr', 'Pick a time slot.'); return; }
      showError('#bEmailErr', '');

      var button = $('#bGo');
      button.disabled = true;
      button.textContent = 'Requesting…';
      deliver({
        kind: 'booking', name: name, email: email, company: $('#bCompany').value.trim(),
        date: when, slot: slot, notes: $('#bNotes').value.trim().slice(0, 600),
        at: new Date().toISOString(), source_site: location.href
      }).then(function (result) {
        button.disabled = false;
        button.textContent = 'Request this slot';
        $('#bNote').textContent = result.sent
          ? 'Requested: ' + when + ' at ' + slot + '. We reply by email within one working day.'
          : 'Saved in this browser only. Connect the data store in config.js and it will be sent on your next visit.';
        if (!result.sent) flushQueue();
      });
    });
  }

  // ---------- cookies ----------
  function wireCookies() {
    var bar = $('#cookieBar');
    function choice(value) {
      try { localStorage.setItem('postcode_consent', value); } catch (e) {}
      // a single first-party cookie, only after consent
      if (value === 'all') document.cookie = 'pc_consent=all; path=/; max-age=31536000; SameSite=Lax';
      bar.hidden = true;
    }
    var stored = null;
    try { stored = localStorage.getItem('postcode_consent'); } catch (e) {}
    if (!stored) bar.hidden = false;
    $('#cookieAccept').onclick = function () { choice('all'); };
    $('#cookieEssential').onclick = function () { choice('essential'); };
  }

  // ---------- boot ----------
  function boot() {
    wireAuth();
    wireQuestions();
    wireBooking();
    wireCookies();

    var google = readGoogleHash();
    if (google) {
      setUser(google);
      history.replaceState(null, '', location.pathname);
      $('#authBadge').textContent = google.email;
      $('#authBadge').hidden = false;
    } else if (currentUser()) {
      $('#authBadge').textContent = currentUser().email;
      $('#authBadge').hidden = false;
    }
    if (answered()) $('#questions').hidden = true; else revealQuestions();
    flushQueue();

    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
