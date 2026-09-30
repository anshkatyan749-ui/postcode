// A calm, slow meadow for the sign-up page. Canvas, layered blades, drifting light.
// No images, no libraries. Respects prefers-reduced-motion by drawing one still frame.
(function () {
  'use strict';
  var canvas = document.getElementById('meadow');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
  var blades = [], seeds = [], motes = [];

  function resize() {
    var rect = canvas.getBoundingClientRect();
    W = Math.max(320, rect.width);
    H = Math.max(320, rect.height);
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    build();
  }

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function build() {
    blades = [];
    seeds = [];
    motes = [];
    // five depth layers: far and hazy, near and dark
    var layers = 5;
    for (var layer = 0; layer < layers; layer++) {
      var depth = layer / (layers - 1);
      var count = Math.round(70 + depth * 150);
      for (var i = 0; i < count; i++) {
        blades.push({
          x: rnd(-40, W + 40),
          y: H + rnd(10, 40),
          height: rnd(38, 120) * (0.5 + depth),
          lean: rnd(-0.5, 0.5),
          phase: rnd(0, Math.PI * 2),
          speed: rnd(0.35, 0.9),
          width: rnd(1.1, 2.6) * (0.6 + depth),
          layer: depth,
          tone: 118 + depth * 46
        });
      }
    }
    for (var s = 0; s < 90; s++) {
      seeds.push({ x: rnd(0, W), y: rnd(H * 0.18, H), r: rnd(0.6, 1.7), a: rnd(0.15, 0.5), drift: rnd(0.1, 0.5) });
    }
    for (var m = 0; m < 26; m++) {
      motes.push({ x: rnd(0, W), y: rnd(0, H * 0.8), r: rnd(0.8, 2.1), a: rnd(0.06, 0.22), speed: rnd(0.05, 0.22), phase: rnd(0, 6.28) });
    }
  }

  function sky(t) {
    var top = ctx.createLinearGradient(0, 0, 0, H);
    top.addColorStop(0, '#12161a');
    top.addColorStop(0.38, '#18201e');
    top.addColorStop(0.66, '#222a24');
    top.addColorStop(1, '#161c17');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, H);

    // low sun, breathing
    var sunY = H * 0.32 + Math.sin(t * 0.12) * 6;
    var glow = ctx.createRadialGradient(W * 0.66, sunY, 0, W * 0.66, sunY, H * 0.78);
    glow.addColorStop(0, 'rgba(226,196,140,0.22)');
    glow.addColorStop(0.3, 'rgba(200,170,120,0.09)');
    glow.addColorStop(1, 'rgba(190,160,110,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // distant hills
    for (var hill = 0; hill < 3; hill++) {
      var baseY = H * (0.5 + hill * 0.055);
      ctx.fillStyle = 'rgba(26,34,30,' + (0.55 + hill * 0.16) + ')';
      ctx.beginPath();
      ctx.moveTo(0, baseY);
      for (var x = 0; x <= W; x += 14) {
        var wave = Math.sin((x / W) * Math.PI * (1.2 + hill * 0.5) + hill * 2.1) * (H * 0.035);
        ctx.lineTo(x, baseY + wave);
      }
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fill();
    }

    // mist where the hills meet the grass, so the band is not a hard edge
    var mist = ctx.createLinearGradient(0, H * 0.62, 0, H * 0.9);
    mist.addColorStop(0, 'rgba(150,164,150,0)');
    mist.addColorStop(0.45, 'rgba(146,160,146,0.10)');
    mist.addColorStop(1, 'rgba(120,136,124,0)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, H * 0.62, W, H * 0.3);
  }

  function draw(t) {
    sky(t);
    // drifting motes
    for (var m = 0; m < motes.length; m++) {
      var mote = motes[m];
      var my = (mote.y - t * mote.speed * 6) % (H * 0.85);
      if (my < 0) my += H * 0.85;
      var mx = mote.x + Math.sin(t * 0.3 + mote.phase) * 14;
      ctx.fillStyle = 'rgba(255,240,210,' + mote.a + ')';
      ctx.beginPath();
      ctx.arc(mx, my, mote.r, 0, 6.2832);
      ctx.fill();
    }
    // grass, painted back to front. Muted, deep greens: sage far, olive near.
    var order = blades.slice().sort(function (a, b) { return a.layer - b.layer; });
    for (var i = 0; i < order.length; i++) {
      var blade = order[i];
      var sway = Math.sin(t * blade.speed + blade.phase) * 7 + Math.sin(t * blade.speed * 0.37 + blade.phase) * 3;
      var tipX = blade.x + blade.lean * blade.height * 0.5 + sway;
      var tipY = blade.y - blade.height;
      var d = blade.layer;
      var r = Math.round(58 + d * 34);
      var g = Math.round(84 + d * 44);
      var b2 = Math.round(66 + d * 22);
      ctx.strokeStyle = 'rgb(' + r + ',' + g + ',' + b2 + ')';
      ctx.globalAlpha = 0.22 + d * 0.6;
      ctx.lineWidth = blade.width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(blade.x, blade.y);
      ctx.quadraticCurveTo(blade.x + (tipX - blade.x) * 0.25, blade.y - blade.height * 0.55, tipX, tipY);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // ground the band so it does not float
    var floor = ctx.createLinearGradient(0, H * 0.86, 0, H);
    floor.addColorStop(0, 'rgba(14,17,14,0)');
    floor.addColorStop(1, 'rgba(14,17,14,0.92)');
    ctx.fillStyle = floor;
    ctx.fillRect(0, H * 0.86, W, H * 0.14);
    // seeds drifting above the grass
    for (var s = 0; s < seeds.length; s++) {
      var seed = seeds[s];
      var sy = (seed.y - t * seed.drift * 5) % (H * 0.9);
      if (sy < 0) sy += H * 0.9;
      var sx = seed.x + Math.sin(t * 0.5 + seed.x) * 10;
      ctx.fillStyle = 'rgba(226,214,186,' + seed.a + ')';
      ctx.beginPath();
      ctx.arc(sx, sy, seed.r, 0, 6.2832);
      ctx.fill();
    }
    // soft vignette so the text side stays readable
    var shade = ctx.createLinearGradient(0, 0, W, 0);
    shade.addColorStop(0, 'rgba(11,10,9,0.55)');
    shade.addColorStop(0.35, 'rgba(11,10,9,0.12)');
    shade.addColorStop(1, 'rgba(11,10,9,0)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, W, H);
  }

  var start = performance.now();
  function frame(now) {
    draw((now - start) / 1000);
    if (!reduce) requestAnimationFrame(frame);
  }
  resize();
  if (reduce) { draw(0); }
  else { requestAnimationFrame(frame); }
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 180);
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden || reduce) return;
    start = performance.now();
    requestAnimationFrame(frame);
  });
})();
