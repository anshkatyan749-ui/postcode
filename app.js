// Home page behaviour: cookie consent, the download pop-up, booking, and the
// signed-in welcome. Accounts live in auth.js and on signup.html / profile.html.
(function () {
  'use strict';
  var A = window.PostcodeAuth;
  var $ = function (sel) { return document.querySelector(sel); };

  function showError(id, message) {
    var node = $(id);
    if (!node) return;
    node.textContent = message || '';
    node.hidden = !message;
  }

  // ---------- welcome, for people who came back signed in ----------
  function wireWelcome() {
    var me = A.account();
    var badge = $('#authBadge');
    var section = $('#welcome');
    if (!me) {
      $('#navAccount').textContent = 'sign in';
      return;
    }
    if (badge) { badge.textContent = me.email; badge.hidden = false; }
    $('#navAccount').textContent = 'my account';
    $('#navGet').textContent = 'get postcode';
    if (section) {
      section.hidden = false;
      $('#welcomeName').textContent = (me.name || me.email.split('@')[0]);
      $('#welcomeEmail').textContent = me.email + (me.provider === 'google' ? ' · Google' : ' · email');
      $('#welcomeUsername').textContent = me.username || 'not chosen yet';
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    }
  }

  // ---------- download: pop-up, then the post-download questions ----------
  var pop = $('#dlPop');
  function openPop() { pop.hidden = false; $('#dlPopGo').focus(); }
  function closePop() { pop.hidden = true; }
  document.querySelectorAll('a[href="#get"]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); openPop(); });
  });
  $('#dlPopX').onclick = closePop;
  pop.addEventListener('click', function (e) { if (e.target === pop) closePop(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pop.hidden) closePop(); });
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
