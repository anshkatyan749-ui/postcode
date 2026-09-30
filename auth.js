// Shared account core for the site: validation, the stored account, the send queue,
// and Google Identity Services. Used by app.js (sign-up and profile live on the home page).
(function (global) {
  'use strict';
  var CFG = global.POSTCODE_CONFIG || {};

  var EMAIL_RE = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(\.[A-Za-z0-9-]{1,63})*\.[A-Za-z]{2,24}$/;
  var JUNK = ["'", '"', ";", "--", "/*", "*/", "\\", "\x00", " or ", " and ", "union ", "select ",
              "insert ", "update ", "delete ", "drop ", "alter ", "create ", "exec ", "sleep(", "benchmark("];
  var FILES = ['.sql', '.sqlite', '.db', '.exe', '.zip', '.csv', '.dylib'];
  var ACCOUNT_KEY = 'postcode_account';
  var SESSION_KEY = 'postcode_session';
  var QUEUE_KEY = 'postcode_pending';

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || '') || fallback; } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }

  // ---------- validation ----------
  function emailError(value) {
    var text = String(value == null ? '' : value).trim();
    if (!text) return 'Enter your email address.';
    if (text.length > 254 || text.indexOf('..') > -1) return 'That is not a valid email address.';
    var probe = ' ' + text.toLowerCase() + ' ';
    for (var i = 0; i < JUNK.length; i++) if (probe.indexOf(JUNK[i]) > -1) return 'That is not a valid email address.';
    for (var f = 0; f < FILES.length; f++) if (probe.indexOf(FILES[f]) > -1) return 'That is not a valid email address.';
    if (!EMAIL_RE.test(text)) return 'That is not a valid email address. Use something like you@company.com';
    return '';
  }
  function passwordError(value, email) {
    var text = String(value == null ? '' : value);
    if (text.length < 8) return 'Password needs at least 8 characters.';
    if (text.length > 200) return 'That password is too long.';
    if (text.toLowerCase() === String(email || '').trim().toLowerCase()) return 'Password cannot be your email address.';
    if (!/[A-Za-z]/.test(text) || !/[0-9]/.test(text)) return 'Password needs at least one letter and one number.';
    return '';
  }
  function usernameError(value) {
    var text = String(value == null ? '' : value).trim().toLowerCase();
    if (!text) return 'Pick a username. This one cannot be skipped.';
    if (text.length < 3 || text.length > 24) return 'Usernames are 3 to 24 characters.';
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(text)) return 'Use letters, numbers, dot, dash or underscore.';
    var probe = ' ' + text + ' ';
    for (var i = 0; i < JUNK.length; i++) if (probe.indexOf(JUNK[i]) > -1) return 'That username is not allowed.';
    for (var f = 0; f < FILES.length; f++) if (probe.indexOf(FILES[f]) > -1) return 'That username is not allowed.';
    return '';
  }
  function isEmail(value) { return emailError(value) === ''; }

  // ---------- account ----------
  function account() { return read(ACCOUNT_KEY, null); }
  function session() { return read(SESSION_KEY, null); }
  function signIn(record) {
    record = record || {};
    record.created = record.created || new Date().toISOString();
    write(ACCOUNT_KEY, record);
    write(SESSION_KEY, { email: record.email, at: new Date().toISOString() });
    return record;
  }
  function signOut() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }
  function updateAccount(patch) {
    var current = account() || {};
    Object.keys(patch).forEach(function (key) { current[key] = patch[key]; });
    return signIn(current);
  }
  function fingerprint(text) {
    var hash = 5381;
    text = String(text);
    for (var i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
    return 'fp' + hash.toString(16);
  }

  // ---------- sending, with an honest queue when no endpoint is set ----------
  function queue() { return read(QUEUE_KEY, []); }
  function saveQueue(items) { write(QUEUE_KEY, items); }

  function post(payload) {
    payload.at = payload.at || new Date().toISOString();
    payload.ua = (navigator.userAgent || '').slice(0, 120);
    payload.source_site = location.href;
    if (!CFG.endpoint) {
      var pending = queue();
      pending.push(payload);
      saveQueue(pending);
      return Promise.resolve({ sent: false, queued: true, pending: pending.length });
    }
    return fetch(CFG.endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    }).then(function (response) {
      if (!response.ok) throw new Error('endpoint said ' + response.status);
      return response.json().catch(function () { return {}; });
    }).then(function (result) { result.sent = true; return result; })
      .catch(function (error) {
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
        }).then(function (response) { if (response.ok) sent++; return response; }).catch(function () { return null; });
      });
    });
    return chain.then(function () { saveQueue(pending.slice(sent)); return sent; });
  }

  // ---------- google sign-in (Google Identity Services) ----------
  var googleReady = null;
  function loadGoogle() {
    if (googleReady) return googleReady;
    googleReady = new Promise(function (resolve, reject) {
      if (!CFG.googleClientId) { reject(new Error('no-client-id')); return; }
      if (global.google && global.google.accounts && global.google.accounts.id) { resolve(global.google); return; }
      var script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = function () {
        if (global.google && global.google.accounts) resolve(global.google);
        else reject(new Error('google-unavailable'));
      };
      script.onerror = function () { reject(new Error('google-blocked')); };
      document.head.appendChild(script);
    });
    return googleReady;
  }

  // Renders the real Google button when the site is connected to Google,
  // and a Google-styled button that explains itself when it is not. Never mentions setup.
  function mountGoogleButton(element, onCredential) {
    if (!element) return Promise.resolve('missing');
    return loadGoogle().then(function (google) {
      google.accounts.id.initialize({
        client_id: CFG.googleClientId,
        callback: function (response) {
          var profile = decodeCredential(response.credential);
          if (profile) onCredential(profile);
        },
        ux_mode: 'popup',
        cancel_on_tap_outside: false
      });
      element.innerHTML = '';
      google.accounts.id.renderButton(element, {
        theme: 'filled_black', size: 'large', shape: 'rectangular',
        text: 'continue_with', width: Math.min(320, element.clientWidth || 320)
      });
      return 'live';
    }).catch(function (error) {
      var reason = error && error.message === 'no-client-id' ? 'not-configured' : 'unavailable';
      if (reason === 'not-configured') {
        element.innerHTML =
          '<button class="gbtn" type="button">' +
          '<svg viewBox="0 0 48 48" aria-hidden="true">' +
          '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>' +
          '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>' +
          '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>' +
          '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>' +
          '</svg>Continue with Google</button>' +
          '<p class="fnote gnote" hidden>Google sign-up on this site is not connected yet. Use your email address instead.</p>';
        element.querySelector('.gbtn').onclick = function () {
          element.querySelector('.gnote').hidden = false;
        };
      } else {
        element.innerHTML = '<p class="fnote gnote">Could not reach Google from here. Use your email address instead.</p>';
      }
      return reason;
    });
  }

  function decodeCredential(credential) {
    try {
      var body = JSON.parse(atob(String(credential).split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (CFG.googleClientId && body.aud !== CFG.googleClientId) return null;  // token minted for another app
      if (body.email_verified === false) return null;
      return {
        email: String(body.email || '').toLowerCase(),
        name: body.name || '',
        picture: body.picture || '',
        provider: 'google',
        sub: body.sub || ''
      };
    } catch (e) { return null; }
  }

  global.PostcodeAuth = {
    config: CFG,
    emailError: emailError, passwordError: passwordError, usernameError: usernameError, isEmail: isEmail,
    account: account, session: session, signIn: signIn, signOut: signOut, updateAccount: updateAccount,
    fingerprint: fingerprint, post: post, flushQueue: flushQueue,
    mountGoogleButton: mountGoogleButton, decodeCredential: decodeCredential
  };
})(window);
