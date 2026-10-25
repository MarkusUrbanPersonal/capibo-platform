/*
 * Animated replicas of Capibo platform components for the landing page.
 * Data and copy mirror platform/src (missionAgent.js, mock.js, visuals.js).
 * Each [data-cp] element is a small floating card inside a gradient tile,
 * rendered here and looping only while it is on screen.
 */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function icon(name, cls) {
    return '<svg class="cp-ico ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }
  function tone(name, toneName) {
    return '<span class="cp-tone tone-' + toneName + '">' + icon(name) + '</span>';
  }
  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  var num = new Intl.NumberFormat('en-US');

  /* Waits that pause while the component is off screen, so loops resume where they left off. */
  function runner(root) {
    var visible = false;
    var waiters = [];
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) waiters.splice(0).forEach(function (fn) { fn(); });
    }, { threshold: 0.15 }).observe(root);
    function whenVisible() {
      return visible ? Promise.resolve() : new Promise(function (r) { waiters.push(r); });
    }
    return {
      wait: function (ms) {
        return new Promise(function (r) { setTimeout(r, ms); }).then(whenVisible);
      },
      start: whenVisible,
    };
  }

  function nextFrame() {
    return new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });
  }

  function countUp(el, from, to, ms, fmt) {
    var t0 = performance.now();
    return new Promise(function (resolve) {
      function tick(now) {
        // rAF timestamps can predate t0 by a frame; clamp so values never overshoot below `from`.
        var p = Math.max(0, Math.min(1, (now - t0) / ms));
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(from + (to - from) * eased);
        if (p < 1) requestAnimationFrame(tick); else resolve();
      }
      requestAnimationFrame(tick);
    });
  }

  /* Fade the whole card out and back in between loop iterations. */
  async function fadeOut(root, r, ms) {
    root.classList.add('is-out');
    await r.wait(ms || 380);
  }

  var STATE_ICONS = '<span class="cp-state">' + icon('loader-circle', 'sm cp-spin" data-state="running') + icon('circle-check-big', 'sm" data-state="done') + '</span>';

  /* ---------------------------------------------------------------------------
   * Hero · Agent planning: goal typed → planner drafts task cards
   * (missionAgent.js proposePlan, ProposeTasksTool.vue)
   * ------------------------------------------------------------------------- */
  var GOAL = 'A robot that folds clothes';
  var PLAN_TASKS = [
    ['Pick garment', 'hand-grab', 'amber', 400, '6–14s'],
    ['Lay garment flat', 'hand', 'emerald', 700, '12–25s'],
    ['Fold t-shirt', 'shirt', 'violet', 900, '20–45s'],
    ['Fold towel', 'fold-horizontal', 'teal', 600, '15–35s'],
  ];

  function planner(root) {
    root.innerHTML =
      '<div class="cp-plan-head">' +
        '<div class="cp-row cp-sm cp-medium">' + STATE_ICONS + '<span data-title>Planning mission</span></div>' +
        '<div class="cp-plan-goal"><span class="cp-xs cp-muted">Goal</span><span class="cp-sm cp-truncate"><span data-msg></span><span class="cp-caret" data-caret></span></span></div>' +
      '</div>' +
      '<ul class="cp-plan-tasks">' + PLAN_TASKS.map(function (t) {
        return '<li class="cp-item cp-task-card">' + tone(t[1], t[2]) +
          '<div class="cp-grow"><div class="cp-sm cp-medium cp-truncate">' + t[0] + '</div>' +
          '<div class="cp-xs cp-muted">' + num.format(t[3]) + ' videos · ' + t[4] + '</div></div>' +
          '<span class="cp-muted">' + icon('pencil-line', 'sm') + '</span></li>';
      }).join('') + '</ul>';

    var msg = root.querySelector('[data-msg]');
    var caret = root.querySelector('[data-caret]');
    var title = root.querySelector('[data-title]');
    var items = Array.prototype.slice.call(root.querySelectorAll('.cp-item'));
    var r = runner(root);

    function setPhase(phase) {
      root.dataset.phase = phase;
      title.textContent = phase === 'done' ? PLAN_TASKS.length + ' tasks drafted' : 'Planning mission';
      title.classList.toggle('cp-shimmer', phase === 'running');
    }
    if (reduceMotion) {
      msg.textContent = GOAL;
      caret.hidden = true;
      setPhase('done');
      items.forEach(function (li) { li.classList.add('is-in'); });
      return;
    }

    (async function loop() {
      await r.start();
      for (;;) {
        msg.textContent = '';
        caret.hidden = false;
        items.forEach(function (li) { li.classList.remove('is-in'); });
        setPhase('running');
        root.classList.remove('is-out');
        await r.wait(250);
        for (var c = 1; c <= GOAL.length; c++) {
          msg.textContent = GOAL.slice(0, c);
          await r.wait(22 + Math.random() * 22);
        }
        await r.wait(200);
        caret.hidden = true;
        await r.wait(350);
        for (var i = 0; i < items.length; i++) {
          items[i].classList.add('is-in');
          await r.wait(180);
        }
        setPhase('done');
        await r.wait(4600);
        await fadeOut(root, r);
      }
    })();
  }

  /* ---------------------------------------------------------------------------
   * Hero · Acceptance rings, one ring per task (RadialRingsChart.vue)
   * ------------------------------------------------------------------------- */
  var RING_MISSIONS = [
    { name: 'Laundry folding', overall: 87, tasks: [['Lay garment flat', 91], ['Fold t-shirt', 84], ['Fold trousers', 82]] },
    { name: 'Dishwasher loading', overall: 82, tasks: [['Load plates', 88], ['Load glasses', 83], ['Load cutlery basket', 76]] },
    { name: 'Grocery bagging', overall: 88, tasks: [['Open bag', 94], ['Pack heavy items', 89], ['Pack fragile items', 81]] },
  ];
  var RING_SHADES = [100, 72, 48];
  // Thinner rings on a larger chart leave a wide hole around the overall figure.
  var SIZE = 200;
  var STROKE = 11;
  var STEP = 15;

  function ringColor(shade) { return 'color-mix(in oklab, var(--status-good) ' + shade + '%, #fff)'; }

  function rings(root) {
    var html = '';
    RING_SHADES.forEach(function (shade, i) {
      var rad = SIZE / 2 - STROKE / 2 - i * STEP;
      var c = 2 * Math.PI * rad;
      html += '<circle class="track" cx="' + SIZE / 2 + '" cy="' + SIZE / 2 + '" r="' + rad + '" fill="none" stroke-width="' + STROKE + '"></circle>' +
        '<circle class="arc" cx="' + SIZE / 2 + '" cy="' + SIZE / 2 + '" r="' + rad + '" fill="none" stroke-width="' + STROKE + '" stroke-linecap="round" style="stroke:' + ringColor(shade) + '" stroke-dasharray="0 ' + c + '" data-c="' + c + '"></circle>';
    });
    root.innerHTML =
      '<div><div class="cp-sm cp-medium">Acceptance by task</div>' +
      '<div class="cp-xs cp-muted cp-truncate cp-fade" data-name></div></div>' +
      '<div class="cp-rings"><svg viewBox="0 0 ' + SIZE + ' ' + SIZE + '" role="img" data-svg>' + html + '</svg>' +
      '<div class="cp-rings-center"><b data-center>0%</b><span class="cp-xs cp-muted">overall</span></div></div>' +
      '<ul class="cp-legend cp-fade" data-legend>' + RING_SHADES.map(function (shade) {
        return '<li><span class="cp-legend-sw" style="background:' + ringColor(shade) + '"></span><span class="cp-grow cp-truncate" data-label></span><span class="cp-muted" data-value></span></li>';
      }).join('') + '</ul>';
    var svg = root.querySelector('[data-svg]');
    var arcs = Array.prototype.slice.call(svg.querySelectorAll('.arc'));
    var name = root.querySelector('[data-name]');
    var legend = root.querySelector('[data-legend]');
    var labels = root.querySelectorAll('[data-label]');
    var values = root.querySelectorAll('[data-value]');
    var center = root.querySelector('[data-center]');
    var r = runner(root);

    function draw(m) {
      arcs.forEach(function (a, i) {
        var c = +a.dataset.c;
        a.setAttribute('stroke-dasharray', (m ? (c * m.tasks[i][1]) / 100 : 0) + ' ' + c);
      });
    }
    function show(m) {
      name.textContent = m.name;
      m.tasks.forEach(function (t, i) { labels[i].textContent = t[0]; values[i].textContent = t[1] + '%'; });
      svg.setAttribute('aria-label', m.name + ': ' + m.overall + '% accepted');
    }

    if (reduceMotion) { show(RING_MISSIONS[0]); draw(RING_MISSIONS[0]); center.textContent = RING_MISSIONS[0].overall + '%'; return; }

    (async function loop() {
      await r.start();
      for (var k = 0; ; k = (k + 1) % RING_MISSIONS.length) {
        var m = RING_MISSIONS[k];
        show(m);
        name.classList.remove('is-out');
        legend.classList.remove('is-out');
        await nextFrame();
        draw(m);
        countUp(center, 0, m.overall, 900, function (v) { return Math.round(v) + '%'; });
        await r.wait(4600);
        draw(null);
        name.classList.add('is-out');
        legend.classList.add('is-out');
        countUp(center, m.overall, 0, 500, function (v) { return Math.round(v) + '%'; });
        await r.wait(700);
      }
    })();
  }

  /* ---------------------------------------------------------------------------
   * Features · Cost estimate (CostEstimateTool.vue, computeEstimate() numbers)
   * ------------------------------------------------------------------------- */
  // Segment colors are each task's icon-tile hue (visualFor().color, Tailwind 500 shades).
  var PRICE = 3.19;
  var EST_LINES = [
    { label: 'Fold t-shirt', videos: 900, icon: 'shirt', tone: 'violet', color: '#8b5cf6' },
    { label: 'Fold trousers', videos: 705, icon: 'fold-vertical', tone: 'blue', color: '#3b82f6' },
    { label: 'Lay garment flat', videos: 531, icon: 'hand', tone: 'emerald', color: '#10b981' },
    { label: 'Fold towel', videos: 330, color: '#14b8a6', hidden: true },
    { label: 'Pick garment', videos: 300, color: '#f59e0b', hidden: true },
    { label: 'Smooth wrinkles', videos: 240, color: '#0ea5e9', hidden: true },
    { label: 'QA processing', value: 608.85, icon: 'shield-check', tone: 'muted', meta: '3,496 submissions · 86% expected acceptance', color: 'color-mix(in oklab, #737373 35%, transparent)' },
  ];
  EST_LINES.forEach(function (l) { if (l.value == null) l.value = Math.round(l.videos * PRICE * 100) / 100; });
  var EST_TOTAL = EST_LINES.reduce(function (s, l) { return s + l.value; }, 0);

  function estimate(root) {
    root.innerHTML =
      '<div class="cp-between"><span class="cp-row cp-sm cp-medium"><span class="cp-dispatch-icon is-muted">' + icon('receipt', 'sm') + '</span>Cost estimate</span>' +
        '<span class="cp-xs cp-muted">avg ' + usd.format(PRICE) + ' / video</span></div>' +
      '<div><div class="cp-total" data-total>$0.00</div>' +
        '<div class="cp-xs cp-muted" style="margin-top:4px">Estimated total · you only pay for accepted videos plus QA</div></div>' +
      '<div class="cp-segbar" role="img" aria-label="Cost split by task">' + EST_LINES.map(function (l) {
        return '<span style="background:' + l.color + '" data-grow="' + l.value / EST_TOTAL + '"></span>';
      }).join('') + '</div>' +
      '<ul class="cp-list">' + EST_LINES.filter(function (l) { return !l.hidden; }).map(function (l) {
        return '<li class="cp-item is-plain">' + tone(l.icon, l.tone) +
          '<div class="cp-grow"><div class="cp-sm cp-medium cp-truncate">' + l.label + '</div>' +
          '<div class="cp-xs cp-muted cp-truncate">' + (l.meta || num.format(l.videos) + ' videos × ' + usd.format(PRICE)) + '</div></div>' +
          '<span class="cp-xs cp-muted cp-est-pct">' + Math.round((l.value / EST_TOTAL) * 100) + '%</span>' +
          '<span class="cp-sm cp-medium cp-est-value">' + usd.format(l.value) + '</span></li>';
      }).join('') + '</ul>' +
      '<div class="cp-est-foot"><span class="cp-xs cp-muted">Billed from prepaid credits as videos are accepted</span>' +
        '<span class="cp-row" style="gap:8px"><span class="cp-btn" data-adjust>' + icon('pencil-line', 'sm') + 'Adjust</span>' +
        '<span class="cp-btn is-primary" data-approve>' + icon('circle-check', 'sm') + '<span data-label>Approve</span></span></span></div>';

    var total = root.querySelector('[data-total]');
    var segs = Array.prototype.slice.call(root.querySelectorAll('.cp-segbar > span'));
    var items = Array.prototype.slice.call(root.querySelectorAll('.cp-item'));
    var adjust = root.querySelector('[data-adjust]');
    var approve = root.querySelector('[data-approve]');
    var label = root.querySelector('[data-label]');
    var r = runner(root);

    function showBar(on) { segs.forEach(function (s) { s.style.flexGrow = on ? s.dataset.grow : 0.0001; }); }
    function setApproved(on) {
      approve.classList.toggle('is-done', on);
      adjust.classList.toggle('is-gone', on);
      label.textContent = on ? 'Approved' : 'Approve';
    }
    if (reduceMotion) {
      total.textContent = usd.format(EST_TOTAL);
      showBar(true);
      items.forEach(function (li) { li.classList.add('is-in'); });
      return;
    }

    // Calm loop: the total eases in slowly while the rows settle one by one.
    (async function loop() {
      await r.start();
      for (;;) {
        setApproved(false);
        showBar(false);
        items.forEach(function (li) { li.classList.remove('is-in'); });
        total.textContent = '$0.00';
        root.classList.remove('is-out');
        await r.wait(900);
        showBar(true);
        countUp(total, 0, EST_TOTAL, 2800, function (v) { return usd.format(v); });
        for (var i = 0; i < items.length; i++) {
          await r.wait(450);
          items[i].classList.add('is-in');
        }
        await r.wait(2600);
        approve.classList.add('is-pressed');
        await r.wait(260);
        approve.classList.remove('is-pressed');
        setApproved(true);
        await r.wait(5200);
        await fadeOut(root, r, 820);
      }
    })();
  }

  /* ---------------------------------------------------------------------------
   * Features · Mission launch (DispatchTool.vue, missionAgent.js launch())
   * ------------------------------------------------------------------------- */
  var COLLECTORS = 363;

  function dispatch(root) {
    root.innerHTML =
      '<div class="cp-row" style="gap:10px"><span class="cp-dispatch-icon">' + icon('smartphone', 'sm') + '</span>' +
        '<div class="cp-grow"><div class="cp-sm cp-medium">Tasks</div><div class="cp-xs cp-muted" data-sub></div></div>' + STATE_ICONS + '</div>' +
      '<div class="cp-bar"><span data-progress></span></div>' +
      '<div class="cp-xs cp-muted"><b class="cp-medium" style="color:var(--cp-fg)" data-count>0</b> / ' + COLLECTORS + ' collectors notified</div>';

    var sub = root.querySelector('[data-sub]');
    var count = root.querySelector('[data-count]');
    var progress = root.querySelector('[data-progress]');
    var r = runner(root);

    function setCount(n) {
      count.textContent = Math.round(n);
      progress.style.width = (n / COLLECTORS) * 100 + '%';
    }
    function setPhase(phase) {
      root.dataset.phase = phase;
      sub.textContent = phase === 'live' ? 'Live' : 'Dispatching';
      sub.classList.toggle('cp-shimmer', phase === 'running');
    }
    if (reduceMotion) { setPhase('live'); return setCount(COLLECTORS); }

    (async function loop() {
      await r.start();
      for (;;) {
        setPhase('running');
        setCount(0);
        root.classList.remove('is-out');
        await r.wait(700);
        await countUp({ set textContent(v) { setCount(+v); } }, 0, COLLECTORS, 2600, function (v) { return v; });
        setPhase('live');
        await r.wait(3200);
        await fadeOut(root, r);
      }
    })();
  }

  /* ---------------------------------------------------------------------------
   * Platform · Mission detail (MissionDetailView.vue): header with actions,
   * progress-to-goal chart (GoalProgressChart.vue) and task cards, ticking live.
   * ------------------------------------------------------------------------- */
  var MISSION = {
    name: 'Laundry folding',
    description: 'Egocentric videos of people folding everyday garments for a clothes-folding robot policy.',
    start: Date.UTC(2026, 7, 4),
    days: 81,
    accepted: 7412,
    target: 10000,
    tasks: [
      ['Lay garment flat', 'hand', 'emerald', 24, 91, 18],
      ['Fold t-shirt', 'shirt', 'violet', 31, 84, 32],
      ['Fold trousers', 'fold-vertical', 'blue', 22, 82, 37],
    ],
  };
  var Y_MAX = 11000;
  var shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

  function cumulativePath(w, h) {
    // Deterministic daily accepted series: growing volume with weekend bumps (as in mock.js), summed.
    var daily = [];
    var seed = 7;
    function rand() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < MISSION.days; i++) {
      var weekend = i % 7 === 5 || i % 7 === 6 ? 1.22 : 1;
      daily.push((1 + (i / MISSION.days) * 0.6) * weekend * (0.86 + rand() * 0.28));
    }
    var sum = daily.reduce(function (a, b) { return a + b; }, 0);
    var total = 0;
    var xy = daily.map(function (d, i) {
      total += (d / sum) * MISSION.accepted;
      return [(i / (MISSION.days - 1)) * w, h - (total / Y_MAX) * h];
    });
    var line = 'M' + xy.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L');
    return { line: line, area: line + ' L' + w + ' ' + h + ' L0 ' + h + ' Z' };
  }

  function platform(root) {
    var m = MISSION;
    var path = cumulativePath(400, 120);
    var goalPct = (1 - m.target / Y_MAX) * 100;
    var xTicks = [0, 0.5, 1].map(function (f) { return shortDate.format(m.start + Math.round(f * (m.days - 1)) * 86400000); });
    root.innerHTML =
      '<div class="cp-mission-head">' + '<span class="cp-tone md tone-violet">' + icon('shirt') + '</span>' +
        '<div class="cp-grow"><div class="cp-row" style="gap:8px"><span class="cp-mission-title cp-truncate">' + m.name + '</span>' +
          '<span class="cp-status is-good">' + icon('circle-dot') + 'Active</span></div>' +
        '<div class="cp-xs cp-muted cp-truncate" style="margin-top:2px">' + m.description + '</div></div>' +
        '<div class="cp-mission-actions"><span class="cp-btn">' + icon('database', 'sm') + 'Videos</span>' +
          '<span class="cp-btn is-icon" aria-label="Pause">' + icon('circle-pause', 'sm') + '</span>' +
          '<span class="cp-btn is-icon cp-muted" aria-label="Delete mission">' + icon('trash-2', 'sm') + '</span></div></div>' +
      '<div class="cp-panel">' +
        '<div class="cp-between" style="align-items:flex-start"><div class="cp-grow"><div class="cp-sm cp-medium">Progress to goal</div>' +
          '<div class="cp-xs cp-muted cp-truncate"><span data-progress-text>0</span> / ' + num.format(m.target) + ' accepted videos · <span data-pct>0</span>%</div></div>' +
          '<span class="cp-btn cp-select">' + icon('calendar-days', 'sm cp-muted') + 'Last 90 days' + icon('chevron-down', 'sm cp-muted') + '</span></div>' +
        '<div class="cp-toggle" role="group" aria-label="Quality outcome">' +
          '<span class="is-on"><i style="background:var(--status-good)"></i>Accepted</span>' +
          '<span><i style="background:var(--status-critical)"></i>Rejected</span>' +
          '<span><i style="background:var(--status-warning)"></i>Pending</span></div>' +
        '<div class="cp-goal-chart">' +
          '<div class="cp-goal-y"><span style="top:' + goalPct + '%">10k</span><span style="top:' + (1 - 5000 / Y_MAX) * 100 + '%">5k</span><span style="top:100%">0</span></div>' +
          '<div class="cp-chart"><svg viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">' +
            '<defs><linearGradient id="cp-area-grad" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#0ca30c" stop-opacity=".2"/><stop offset="1" stop-color="#0ca30c" stop-opacity="0"/></linearGradient></defs>' +
            '<line class="goal" x1="0" x2="400" y1="' + (goalPct * 1.2).toFixed(1) + '" y2="' + (goalPct * 1.2).toFixed(1) + '" vector-effect="non-scaling-stroke"/>' +
            '<path class="area" d="' + path.area + '"/>' +
            '<path class="line" d="' + path.line + '" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" vector-effect="non-scaling-stroke" data-line/>' +
          '</svg></div>' +
          '<div class="cp-goal-x">' + xTicks.map(function (t) { return '<span>' + t + '</span>'; }).join('') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="cp-mission-tasks"><div class="cp-sm cp-medium">Tasks</div><ul class="cp-list">' + m.tasks.map(function (t) {
        return '<li class="cp-item is-in cp-task-card">' + tone(t[1], t[2]) +
          '<div class="cp-grow"><div class="cp-sm cp-medium cp-truncate">' + t[0] + '</div>' +
          '<div class="cp-xs cp-muted cp-meta"><span>' + t[3] + '% of videos</span><span>' + t[4] + '% accepted</span><span class="cp-row" style="gap:3px">' + icon('clock', 'xs') + t[5] + 's</span></div></div></li>';
      }).join('') + '</ul></div>';

    var progressText = root.querySelector('[data-progress-text]');
    var pctEl = root.querySelector('[data-pct]');
    var chart = root.querySelector('.cp-chart');
    var line = root.querySelector('[data-line]');
    var accepted = m.accepted;
    var r = runner(root);

    function setAccepted(n) {
      var v = Math.round(n);
      progressText.textContent = num.format(v);
      pctEl.textContent = Math.floor((v / m.target) * 100);
    }

    if (reduceMotion) { setAccepted(accepted); chart.classList.add('is-drawn'); line.setAttribute('stroke-dashoffset', '0'); return; }

    (async function loop() {
      await r.start();
      line.style.transition = 'stroke-dashoffset 1800ms cubic-bezier(0.2, 0.7, 0.2, 1)';
      await nextFrame();
      line.setAttribute('stroke-dashoffset', '0');
      chart.classList.add('is-drawn');
      await countUp({ set textContent(v) { setAccepted(+v); } }, 0, accepted, 1600, function (v) { return v; });
      // Live: a few more videos clear QA every couple of seconds.
      for (;;) {
        await r.wait(2200 + Math.random() * 1200);
        accepted += 1 + Math.floor(Math.random() * 3);
        setAccepted(accepted);
        progressText.classList.remove('cp-tick');
        void progressText.offsetWidth;
        progressText.classList.add('cp-tick');
      }
    })();
  }

  var COMPONENTS = { planner: planner, rings: rings, estimate: estimate, dispatch: dispatch, platform: platform };

  function init() {
    document.querySelectorAll('[data-cp]').forEach(function (el) {
      var fn = COMPONENTS[el.getAttribute('data-cp')];
      if (fn) fn(el);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
