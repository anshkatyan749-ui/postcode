// Home page behaviour. The sign-up form and the profile questions live on this page
// (no separate pages, the URL never changes); this file also keeps the download pop-up,
// booking, cookies and the signed-in welcome. Account core lives in auth.js.
(function () {
  'use strict';
  var A = window.PostcodeAuth;
  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  function showError(id, message) {
    var node = $(id.charAt(0) === '#' ? id : '#' + id);
    if (!node) return;
    node.textContent = message || '';
    node.hidden = !message;
  }
  function setErr(id, message) {
    var node = $(id);
    if (node) node.textContent = message || '';
  }
  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- the overlay: sign-up view and question view, one page ----------
  var flow = $('#flow'), authView = $('#authView'), wizardView = $('#wizardView');
  var mode = 'signup';

  function openFlow(which) {
    authView.hidden = which !== 'auth';
    wizardView.hidden = which !== 'wizard';
    flow.hidden = false;
    document.body.style.overflow = 'hidden';
    if (which === 'auth') {
      setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 60);  // meadow sizes itself
      setTimeout(function () { var f = $('#email'); if (f) f.focus(); }, 90);
    }
  }
  function closeFlow() {
    flow.hidden = true;
    document.body.style.overflow = '';
    wireWelcome();
  }
  function openAuth(nextMode) {
    setMode(nextMode || 'signup');
    openFlow('auth');
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!flow.hidden) closeFlow();
  });

  // ---------- sign up / sign in ----------
  function setMode(next) {
    mode = next;
    $$('.a-tab').forEach(function (tab) { tab.classList.toggle('on', tab.dataset.mode === next); });
    $('#headline').textContent = next === 'signup' ? 'Create your account' : 'Welcome back';
    $('#subline').textContent = next === 'signup'
      ? 'Two minutes now, one file to download after.'
      : 'Sign in and carry on where you left off.';
    $('#submitBtn').textContent = next === 'signup' ? 'Create account' : 'Sign in';
    $('#pwLabel').textContent = next === 'signup' ? 'Password' : 'Your password';
    $('#password').setAttribute('autocomplete', next === 'signup' ? 'new-password' : 'current-password');
    $('#note').innerHTML = next === 'signup'
      ? 'We keep your email and nothing else. No password is ever readable, not even by us.'
      : 'If the address is not on file you stay here. <a href="#" id="toSignup">Create an account instead</a>';
    var link = $('#toSignup');
    if (link) link.onclick = function (e) { e.preventDefault(); setMode('signup'); };
    showError('emailErr', ''); showError('passwordErr', '');
  }
  $$('.a-tab').forEach(function (tab) { tab.onclick = function () { setMode(tab.dataset.mode); }; });
  $('#pwToggle').onclick = function () {
    var field = $('#password');
    field.type = field.type === 'password' ? 'text' : 'password';
    this.textContent = field.type === 'password' ? 'show' : 'hide';
  };
  var meter = $('#pwMeter');
  $('#password').addEventListener('input', function () {
    var value = this.value, score = 0;
    if (value.length >= 8) score++;
    if (/[A-Za-z]/.test(value) && /[0-9]/.test(value)) score++;
    if (value.length >= 12) score++;
    if (/[^A-Za-z0-9]/.test(value)) score++;
    meter.firstElementChild.style.width = (score / 4 * 100) + '%';
    meter.classList.toggle('good', score === 4);
  });

  $('#authForm').addEventListener('submit', function (event) {
    event.preventDefault();
    var email = $('#email').value.trim();
    var password = $('#password').value;

    var badEmail = A.emailError(email);
    showError('emailErr', badEmail);
    if (badEmail) { $('#email').focus(); return; }
    var badPassword = mode === 'signup' ? A.passwordError(password, email)
      : (password ? '' : 'Enter your password.');
    showError('passwordErr', badPassword);
    if (badPassword) { $('#password').focus(); return; }

    var button = $('#submitBtn');
    button.disabled = true;
    button.textContent = mode === 'signup' ? 'Creating your account…' : 'Signing you in…';

    var known = A.account();
    if (mode === 'signup' && known && known.email === email && known.provider === 'email' && known.password_hash) {
      showError('passwordErr', 'That email is already registered here. Switch to Sign in.');
      button.disabled = false; setMode('signup');
      return;
    }
    if (mode === 'signin' && (!known || known.email !== email || !known.password_hash)) {
      showError('passwordErr', 'We do not have an account for that email on this device. Create one, or continue with Google.');
      button.disabled = false;
      return;
    }
    if (mode === 'signin' && known.password_hash !== A.fingerprint(email + '|' + password)) {
      showError('passwordErr', 'That password is not right.');
      button.disabled = false;
      return;
    }

    var payload = {
      kind: mode, email: email, provider: 'email',
      password_hint: mode === 'signup' ? password.length + ' characters' : 'not stored',
      password_hash: mode === 'signup' ? A.fingerprint(email + '|' + password) : ''
    };
    A.post(payload).then(function () {
      if (mode === 'signup') A.signIn({ email: email, provider: 'email', password_hash: payload.password_hash, name: '' });
      else A.signIn(known);
      button.disabled = false;
      button.textContent = mode === 'signup' ? 'Create account' : 'Sign in';
      enterAfterAuth();
    });
  });

  function enterAfterAuth() {
    var me = A.account();
    if (mode === 'signin' && me && me.profile && me.profile.saved_at) closeFlow();
    else openWizard();
  }

  // Google: the real button when the site is connected, same destination either way.
  A.mountGoogleButton($('#googleSlot'), function (profile) {
    if (!profile || !profile.email) {
      showError('emailErr', 'Google did not return an email address. Use the email form instead.');
      return;
    }
    A.signIn({ email: profile.email, provider: 'google', name: profile.name, picture: profile.picture });
    A.post({ kind: 'signup', email: profile.email, provider: 'google', name: profile.name || '' })
      .then(function () {
        mode = 'signup';
        var me = A.account();
        if (me && me.profile && me.profile.saved_at) closeFlow();
        else openWizard();
      });
  });

  // ---------- the questions: one screen per question, never a scrolling form ----------
  var answers = { usage: '', role: '', company: '', source: '', name: '', username: '', dob: '', other: '', skipped: {} };
  var order = [], qi = 0, saveStarted = false, roleTimer = null;
  var STEPS = {
    0: ['Tell us about you', 'Pick the one that fits best. It changes what we ask next.'],
    1: ['What is your company called?', 'It shows up on demo calls and update emails.'],
    2: ["What's your date of birth?", 'Optional. It only shapes the defaults we suggest.'],
    3: ['What will be your username?', 'The one field we always need. 3 to 24 characters.'],
    4: ['What is your name?', 'Optional — we use it when we write to you.'],
    5: ['How did you hear about us?', 'Optional, and it takes one tap.'],
    6: ['Anything else we should know?', 'Your machine, your team, your setup. Optional.'],
    7: ['You are all set.', 'Here is what we saved. You can change any of it later.']
  };

  function buildOrder() {
    order = [0];
    if (answers.usage === 'company' || answers.usage === 'group') order.push(1);
    order = order.concat([2, 3, 4, 5, 6, 7]);
  }
  function stepAnswered(step) {
    if (step === 0) return !!answers.usage;
    if (step === 1) return !!(answers.skipped.company || answers.company);
    if (step === 2) return !!(answers.skipped.dob || answers.dob);
    if (step === 3) return !!answers.username;
    if (step === 4) return !!(answers.skipped.name || answers.name);
    if (step === 5) return !!(answers.skipped.source || answers.source);
    if (step === 6) return !!(answers.skipped.other || answers.other);
    return false;
  }
  function showStep() {
    var step = order[qi];
    $$('.qstep').forEach(function (el) { el.classList.toggle('on', Number(el.dataset.step) === step); });
    $('#qTitle').textContent = STEPS[step][0];
    $('#qSub').textContent = STEPS[step][1];
    $('#qKicker').textContent = 'step ' + (qi + 1) + ' of ' + order.length + ' · your profile';
    $('#qProgBar').style.width = ((qi + 1) / order.length * 100) + '%';
    var focus = { 1: '#qCompany', 2: '#qDob', 3: '#qUsername', 4: '#qName', 6: '#qOther' }[step];
    if (focus) { var f = $(focus); if (f) f.focus(); }
    if (step === 7 && !saveStarted) { saveStarted = true; saveAnswers(); }
    $('.qbody').scrollTop = 0;
  }
  function next() { if (qi < order.length - 1) { qi++; showStep(); } }
  function prev() {
    if (order[qi] === 7) saveStarted = false;
    if (qi > 0) { qi--; showStep(); } else closeFlow();
  }
  function openWizard() {
    var me = A.account();
    if (!me) { openAuth('signup'); return; }
    var p = me.profile || {};
    answers = {
      usage: p.usage || '', role: p.role || '', company: p.company || '', source: p.source || '',
      name: p.name || '', username: p.username || me.username || '', dob: p.dob || '',
      other: p.other || '', skipped: p.skipped || {}
    };
    $('#qCompany').value = answers.company;
    $('#qDob').value = answers.dob;
    $('#qUsername').value = answers.username;
    $('#qName').value = answers.name;
    $('#qOther').value = answers.other;
    $$('#roleGrid .role').forEach(function (b) { b.classList.toggle('on', b.dataset.role === answers.role); });
    $$('#sourceChips .qchip').forEach(function (c) { c.classList.toggle('on', c.textContent === answers.source); });
    buildOrder();
    qi = order.length - 1;   // open on the summary only when everything is already answered
    for (var i = 0; i < order.length - 1; i++) {
      if (!stepAnswered(order[i])) { qi = i; break; }
    }
    saveStarted = false;
    openFlow('wizard');
    showStep();
  }

  // role cards decide the path: company opens the company question, everything else goes personal
  $$('#roleGrid .role').forEach(function (card) {
    card.onclick = function () {
      $$('#roleGrid .role').forEach(function (b) { b.classList.toggle('on', b === card); });
      answers.role = card.dataset.role;
      answers.usage = card.dataset.usage;
      delete answers.skipped.usage;
      buildOrder();
      clearTimeout(roleTimer);
      roleTimer = setTimeout(next, 160);   // one click, next page
    };
  });
  $$('#sourceChips .qchip').forEach(function (chip) {
    chip.onclick = function () {
      var on = chip.classList.contains('on');
      $$('#sourceChips .qchip').forEach(function (c) { c.classList.remove('on'); });
      if (!on) { chip.classList.add('on'); answers.source = chip.textContent; }
      else answers.source = '';
      delete answers.skipped.source;
    };
  });
  $$('.qskip').forEach(function (button) {
    button.onclick = function () {
      var key = button.dataset.skip;
      answers.skipped[key] = true;
      answers[key] = '';
      if (key === 'company') { answers.usage = 'personal'; answers.role = ''; buildOrder(); }
      next();
    };
  });
  $('#qBack').onclick = prev;
  $('#qCompanyNext').onclick = function () { answers.company = $('#qCompany').value.trim(); delete answers.skipped.company; next(); };
  $('#qDobNext').onclick = function () {
    var value = $('#qDob').value;
    if (value && value > new Date().toISOString().slice(0, 10)) { setErr('#qDobErr', 'That date is in the future.'); return; }
    setErr('#qDobErr', '');
    answers.dob = value; delete answers.skipped.dob;
    if (!value) answers.skipped.dob = true;
    next();
  };
  $('#qUsernameNext').onclick = function () {
    var value = $('#qUsername').value.trim().toLowerCase();
    var bad = A.usernameError(value);
    setErr('#qUsernameErr', bad);
    if (bad) { $('#qUsername').focus(); return; }
    answers.username = value;
    next();
  };
  $('#qNameNext').onclick = function () { answers.name = $('#qName').value.trim(); delete answers.skipped.name; next(); };
  $('#qSourceNext').onclick = function () { if (!answers.source) answers.skipped.source = true; next(); };
  $('#qOtherNext').onclick = function () { answers.other = $('#qOther').value.trim().slice(0, 600); delete answers.skipped.other; next(); };
  $('#wizardClose').onclick = closeFlow;
  $('#authClose').onclick = closeFlow;

  function usageLabel(value) {
    return value === 'group' ? 'Group of companies' : value === 'company' ? 'Company'
      : value === 'personal' ? 'Personal use' : '';
  }
  function saveAnswers() {
    var me = A.account();
    if (!me) { openAuth('signup'); return; }
    var profile = {
      usage: answers.usage, role: answers.role, company: answers.company, source: answers.source,
      name: answers.name, username: answers.username, dob: answers.dob, other: answers.other,
      skipped: answers.skipped, saved_at: new Date().toISOString()
    };
    A.post({
      kind: 'profile', email: me.email, provider: me.provider, username: answers.username,
      group: usageLabel(answers.usage), field: answers.role || '', source: answers.source,
      company: answers.company, name: answers.name, date: answers.dob, notes: answers.other
    }).then(function (result) {
      A.updateAccount({ username: answers.username, name: answers.name, profile: profile });
      var bits = [];
      if (profile.usage) bits.push(['use', usageLabel(profile.usage)]);
      if (profile.role) bits.push(['role', profile.role]);
      if (profile.company) bits.push(['company', profile.company]);
      if (profile.name) bits.push(['name', profile.name]);
      if (profile.dob) bits.push(['born', profile.dob]);
      if (profile.source) bits.push(['found us via', profile.source]);
      if (profile.other) bits.push(['note', 'added']);
      bits.push(['username', profile.username]);
      bits.push(['status', result.sent ? 'sent to our store' : 'held in this browser for now']);
      $('#qSummary').innerHTML = bits.map(function (b) {
        return '<li><i>' + escapeHtml(b[0]) + '</i>' + escapeHtml(b[1]) + '</li>';
      }).join('');
    });
  }
  $('#qFinish').onclick = function () {
    closeFlow();
    var target = $('#welcome');
    if (target && !target.hidden) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ---------- entry points, all on this page ----------
  $('#navCreate').onclick = function () { openAuth('signup'); };
  $('#navAccount').onclick = function () {
    var me = A.account();
    if (!me) { openAuth('signin'); return; }
    if (!me.profile || !me.profile.saved_at) { openWizard(); return; }
    var target = $('#welcome');
    if (target && !target.hidden) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  $('#installCreate').onclick = function () { openAuth('signup'); };
  $('#welcomeProfile').onclick = function () { openWizard(); };
  if (location.hash === '#signup' || location.hash === '#create') openAuth('signup');

  // ---------- welcome, for people who came back signed in ----------
  function wireWelcome() {
    var me = A.account();
    var badge = $('#authBadge');
    var section = $('#welcome');
    if (!me) {
      $('#navAccount').textContent = 'sign in';
      if (badge) badge.hidden = true;
      if (section) section.hidden = true;
      return;
    }
    if (badge) { badge.textContent = me.username || me.email; badge.hidden = false; }
    $('#navAccount').textContent = 'my account';
    if (section) {
      section.hidden = false;
      $('#welcomeName').textContent = me.name || me.username || me.email.split('@')[0];
      $('#welcomeEmail').textContent = me.email + (me.provider === 'google' ? ' · Google' : ' · email');
      $('#welcomeUsername').textContent = me.username || 'not chosen yet';
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    }
  }

  // ---------- download pop-up ----------
  var pop = $('#dlPop');
  function openPop() { pop.hidden = false; $('#dlPopGo').focus(); }
  function closePop() { pop.hidden = true; }
  $$('a[href="#get"]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); openPop(); });
  });
  $('#dlPopX').onclick = closePop;
  pop.addEventListener('click', function (e) { if (e.target === pop) closePop(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && flow.hidden && !pop.hidden) closePop(); });
  if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
    $('#dlPopLocal').hidden = false;
    $('#dlPopLocalLink').href = (window.POSTCODE_CONFIG && POSTCODE_CONFIG.localApp) || '#get';
  }
  $('#dlPopGo').onclick = function () {
    var me = A.account();
    A.post({
      kind: 'download', email: me ? me.email : '', provider: me ? me.provider : '',
      username: me ? (me.username || '') : ''
    }).then(function (result) {
      $('#dlPopFine').textContent = result.sent
        ? 'downloading · one file, no wizard'
        : 'downloading · saved in this browser (' + (result.pending || 1) + ' item(s) waiting)';
    });
    window.location.href = (window.POSTCODE_CONFIG && POSTCODE_CONFIG.release) || '#get';
  };

  // ---------- booking ----------
  var today = new Date().toISOString().slice(0, 10);
  $('#bDate').min = today;
  $('#bDate').value = today;
  $('#bookForm').addEventListener('submit', function (event) {
    event.preventDefault();
    var name = $('#bName').value.trim();
    var email = $('#bEmail').value.trim();
    var slot = $('#bSlot').value;
    var badEmail = A.emailError(email);
    showError('#bEmailErr', badEmail);
    if (badEmail) { $('#bEmail').focus(); return; }
    if (!name) { $('#bName').focus(); showError('#bEmailErr', 'Add your name so we know who to reply to.'); return; }
    if (!slot) { $('#bSlot').focus(); showError('#bEmailErr', 'Pick a time slot.'); return; }
    showError('#bEmailErr', '');
    var button = $('#bGo');
    button.disabled = true;
    button.textContent = 'Requesting…';
    A.post({
      kind: 'booking', name: name, email: email, company: $('#bCompany').value.trim(),
      date: $('#bDate').value, slot: slot, notes: $('#bNotes').value.trim().slice(0, 600)
    }).then(function (result) {
      button.disabled = false;
      button.textContent = 'Request this slot';
      $('#bNote').textContent = result.sent
        ? 'Requested: ' + $('#bDate').value + ' at ' + slot + '. We reply by email within one working day.'
        : 'Saved in this browser only. Connect the data store in config.js and it goes on your next visit.';
      if (!result.sent) A.flushQueue();
    });
  });

  // ---------- cookies ----------
  (function () {
    var bar = $('#cookieBar');
    function choice(value) {
      try { localStorage.setItem('postcode_consent', value); } catch (e) {}
      if (value === 'all') document.cookie = 'pc_consent=all; path=/; max-age=31536000; SameSite=Lax';
      bar.hidden = true;
    }
    var stored = null;
    try { stored = localStorage.getItem('postcode_consent'); } catch (e) {}
    if (!stored) bar.hidden = false;
    $('#cookieAccept').onclick = function () { choice('all'); };
    $('#cookieEssential').onclick = function () { choice('essential'); };
  })();

  wireWelcome();
  A.flushQueue();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
