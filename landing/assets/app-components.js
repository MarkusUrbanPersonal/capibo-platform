/*
 * Animated replicas of Capibo platform components for the landing page.
 * Data and copy mirror platform/src (missionAgent.js, mock.js, visuals.js) so
 * the landing shows exactly what the app shows. Each [data-cp] element is
 * rendered here and loops only while it is on screen.
 */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function icon(name, cls) {
    return '<svg class="cp-ico ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }
  function tone(name, toneName, size) {
    return '<span class="cp-tone ' + (size || '') + ' tone-' + toneName + '">' + icon(name) + '</span>';
  }
  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  var usdRound = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
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

  function countUp(el, to, ms, fmt) {
    var t0 = performance.now();
    return new Promise(function (resolve) {
      function tick(now) {
        var p = Math.min(1, (now - t0) / ms);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(to * eased);
        if (p < 1) requestAnimationFrame(tick); else resolve();
      }
      requestAnimationFrame(tick);
    });
  }

  function stepMarkup(label) {
    return '<li class="cp-step">' +
      '<span class="cp-step-mark">' +
      icon('circle', '" data-state="pending') + icon('loader-circle', 'cp-spin" data-state="running') + icon('check', '" data-state="done') +
      '</span><div class="cp-grow"><div class="cp-step-label">' + label + '</div><div class="cp-step-detail"></div></div></li>';
  }
  function setStep(li, status, detail) {
    li.classList.toggle('is-running', status === 'running');
    li.classList.toggle('is-done', status === 'done');
    li.querySelector('.cp-step-label').classList.toggle('cp-shimmer', status === 'running');
    if (detail !== undefined) li.querySelector('.cp-step-detail').textContent = detail;
  }

  /* ---------------------------------------------------------------------------
   * Agent planning: user goal → "Planning your mission" steps → drafted tasks
   * (missionAgent.js proposePlan, AgentStepsTool.vue, ProposeTasksTool.vue)
   * ------------------------------------------------------------------------- */
  var PLAN_STEPS = [
    ['Understanding the goal', 'Reading your description…', 'Target behavior: robotic clothes folding', 700],
    ['Searching the task library', 'Comparing with past missions…', '2 similar missions · 15 reference clips', 900],
    ['Breaking it into recordable tasks', 'Segmenting the behavior…', '6 tasks drafted', 850],
    ['Checking collector availability', 'Querying US, PT and MX…', 'US, PT, MX · 1,240 eligible collectors', 750],
    ['Writing recording guidelines', 'Framing, lighting, privacy…', '3 guidelines shared by all tasks', 600],
    ['Pricing each task', 'Scaling by clip length…', 'Avg. $2.65 per accepted video', 600],
  ];
  var PLAN_TASKS = [
    ['Pick garment from pile', 'Reach into a mixed laundry pile and lift a single garment by its edge.', 'hand-grab', 'amber', '8–18s', 400],
    ['Lay garment flat', 'Spread the garment flat on a table, front side up, and smooth out creases.', 'hand', 'emerald', '12–25s', 700],
    ['Fold t-shirt', 'Fold sleeves in, then fold the shirt in thirds lengthwise.', 'shirt', 'violet', '20–45s', 900],
    ['Fold trousers', 'Align the legs, fold in half lengthwise, then fold twice from the hem.', 'fold-vertical', 'blue', '25–50s', 650],
  ];
  var GOAL = 'I want to create a robot that folds clothes';

  function planner(root) {
    root.innerHTML =
      '<div class="cp-msg" data-msg></div>' +
      '<div class="cp-card cp-agent" data-agent data-phase="running">' +
        '<div class="cp-agent-head">' +
          '<span class="cp-head-state">' + icon('loader-circle', 'cp-spin cp-muted" data-state="running') + icon('circle-check-big', '" data-state="done') + '</span>' +
          '<span class="cp-medium" data-title></span><span class="cp-xs cp-muted" data-count></span>' + icon('chevron-down', 'cp-chev') +
        '</div>' +
        '<div class="cp-agent-body"><div><ol class="cp-steps">' + PLAN_STEPS.map(function (s) { return stepMarkup(s[0]); }).join('') + '</ol></div></div>' +
      '</div>' +
      '<div class="cp-plan" data-plan>' +
        '<div class="cp-between cp-plan-head"><div class="cp-grow"><div class="cp-semibold" style="font-size:15px">Robotic clothes folding</div>' +
        '<div class="cp-xs cp-truncate">Egocentric demonstrations for a clothes-folding policy</div></div><span class="cp-badge">Draft</span></div>' +
        '<ul class="cp-plan" data-tasks></ul>' +
      '</div>';

    var msg = root.querySelector('[data-msg]');
    var agent = root.querySelector('[data-agent]');
    var title = root.querySelector('[data-title]');
    var count = root.querySelector('[data-count]');
    var steps = Array.prototype.slice.call(root.querySelectorAll('.cp-step'));
    var plan = root.querySelector('[data-plan]');
    var list = root.querySelector('[data-tasks]');
    var r = runner(root);

    function taskMarkup(t) {
      return '<li class="cp-card cp-task cp-rise" style="box-shadow:none">' + tone(t[2], t[3]) +
        '<div class="cp-grow"><div class="cp-sm cp-medium cp-truncate">' + t[0] + '</div><div class="cp-xs cp-muted cp-truncate">' + t[1] + '</div></div>' +
        '<div class="cp-task-meta cp-xs"><div class="cp-medium">' + num.format(t[5]) + ' videos</div><div class="cp-muted">' + t[4] + '</div></div></li>';
    }

    function finalState() {
      msg.textContent = GOAL;
      agent.dataset.phase = 'done';
      agent.classList.add('is-collapsed');
      title.textContent = 'Mission planned';
      count.textContent = '6/6 steps · 4.6s';
      steps.forEach(function (li, i) { setStep(li, 'done', PLAN_STEPS[i][2]); });
      list.innerHTML = PLAN_TASKS.map(taskMarkup).join('');
    }
    if (reduceMotion) return finalState();

    (async function loop() {
      await r.start();
      for (;;) {
        msg.innerHTML = '<span class="cp-caret"></span>';
        agent.classList.add('cp-hidden');
        agent.classList.remove('is-collapsed', 'cp-rise');
        plan.classList.add('cp-hidden');
        list.innerHTML = '';
        steps.forEach(function (li) { setStep(li, 'pending', ''); });
        root.style.opacity = 1;
        await r.wait(500);

        for (var c = 1; c <= GOAL.length; c++) {
          msg.innerHTML = GOAL.slice(0, c) + '<span class="cp-caret"></span>';
          await r.wait(28 + Math.random() * 30);
        }
        await r.wait(350);
        msg.textContent = GOAL;
        await r.wait(250);

        agent.dataset.phase = 'running';
        title.textContent = 'Planning your mission';
        count.textContent = '0/6 steps';
        agent.classList.remove('cp-hidden');
        agent.classList.add('cp-rise');
        for (var i = 0; i < steps.length; i++) {
          setStep(steps[i], 'running', PLAN_STEPS[i][1]);
          await r.wait(PLAN_STEPS[i][3]);
          setStep(steps[i], 'done', PLAN_STEPS[i][2]);
          count.textContent = (i + 1) + '/6 steps';
        }
        await r.wait(250);
        agent.dataset.phase = 'done';
        title.textContent = 'Mission planned';
        count.textContent = '6/6 steps · 4.6s';
        await r.wait(700);
        agent.classList.add('is-collapsed');
        await r.wait(250);

        plan.classList.remove('cp-hidden');
        plan.classList.add('cp-rise');
        for (var t = 0; t < PLAN_TASKS.length; t++) {
          await r.wait(320);
          list.insertAdjacentHTML('beforeend', taskMarkup(PLAN_TASKS[t]));
        }
        await r.wait(4200);
        root.style.transition = 'opacity 350ms ease';
        root.style.opacity = 0;
        await r.wait(400);
      }
    })();
  }

  /* ---------------------------------------------------------------------------
   * Acceptance by task: concentric rings, one per task
   * (RadialRingsChart.vue on MissionDetailView.vue)
   * ------------------------------------------------------------------------- */
  var RING_MISSIONS = [
    { name: 'Household laundry folding', icon: 'shirt', tone: 'violet', overall: 87,
      tasks: [['Lay garment flat', 91], ['Fold t-shirt', 84], ['Fold trousers', 82], ['Fold towel', 89], ['Stack folded clothes', 93]] },
    { name: 'Dishwasher loading', icon: 'droplets', tone: 'blue', overall: 82,
      tasks: [['Open dishwasher', 88], ['Load plates', 83], ['Load glasses', 76], ['Load cutlery basket', 81]] },
    { name: 'Grocery bagging', icon: 'egg', tone: 'amber', overall: 88,
      tasks: [['Open bag', 94], ['Pack heavy items', 89], ['Pack fragile items', 81]] },
  ];
  var RING_SHADES = [100, 84, 70, 58, 48, 40];
  var SIZE = 196;

  function rings(root) {
    root.innerHTML =
      '<div class="cp-row cp-fade" data-head><span data-icon></span><div class="cp-grow"><div class="cp-sm cp-medium cp-truncate" data-name></div>' +
      '<div class="cp-xs cp-muted">Acceptance by task · last 90 days</div></div>' +
      '<span class="cp-status is-good">' + icon('circle-dot') + 'Active</span></div>' +
      '<div class="cp-rings"><svg viewBox="0 0 ' + SIZE + ' ' + SIZE + '" role="img" data-svg></svg>' +
      '<div class="cp-rings-center"><b data-center>0%</b><span>overall</span></div></div>' +
      '<ul class="cp-legend cp-fade" data-legend></ul>';
    var svg = root.querySelector('[data-svg]');
    var head = root.querySelector('[data-head]');
    var legend = root.querySelector('[data-legend]');
    var center = root.querySelector('[data-center]');
    var r = runner(root);

    function render(m) {
      var n = m.tasks.length;
      var step = Math.min(14, (SIZE / 2 - SIZE * 0.23) / Math.max(1, n));
      var stroke = step * 0.64;
      var outer = SIZE / 2 - stroke / 2;
      var html = '';
      var arcs = [];
      m.tasks.forEach(function (t, i) {
        var rad = outer - i * step;
        var c = 2 * Math.PI * rad;
        var color = 'color-mix(in oklab, var(--status-good) ' + RING_SHADES[i] + '%, #fff)';
        html += '<circle class="track" cx="' + SIZE / 2 + '" cy="' + SIZE / 2 + '" r="' + rad + '" fill="none" stroke-width="' + stroke + '"></circle>' +
          '<circle class="arc" cx="' + SIZE / 2 + '" cy="' + SIZE / 2 + '" r="' + rad + '" fill="none" stroke-width="' + stroke + '" stroke-linecap="round" style="stroke:' + color + '" stroke-dasharray="0 ' + c + '" data-dash="' + (c * t[1]) / 100 + ' ' + c + '"></circle>';
        arcs.push({ color: color });
      });
      svg.innerHTML = html;
      svg.setAttribute('aria-label', m.tasks.map(function (t) { return t[0] + ' ' + t[1] + '%'; }).join(', '));
      root.querySelector('[data-icon]').innerHTML = tone(m.icon, m.tone);
      root.querySelector('[data-name]').textContent = m.name;
      legend.innerHTML = m.tasks.map(function (t, i) {
        return '<li><span class="sw" style="background:' + arcs[i].color + '"></span><span class="cp-grow cp-truncate">' + t[0] + '</span><span class="cp-muted">' + t[1] + '%</span></li>';
      }).join('');
    }
    function draw(on) {
      svg.querySelectorAll('.arc').forEach(function (a) {
        a.setAttribute('stroke-dasharray', on ? a.dataset.dash : '0 ' + a.dataset.dash.split(' ')[1]);
      });
    }

    if (reduceMotion) { render(RING_MISSIONS[0]); draw(true); center.textContent = RING_MISSIONS[0].overall + '%'; return; }

    (async function loop() {
      await r.start();
      for (var k = 0; ; k = (k + 1) % RING_MISSIONS.length) {
        var m = RING_MISSIONS[k];
        render(m);
        head.classList.remove('is-out');
        legend.classList.remove('is-out');
        await nextFrame();
        draw(true);
        countUp(center, m.overall, 900, function (v) { return Math.round(v) + '%'; });
        await r.wait(4800);
        draw(false);
        head.classList.add('is-out');
        legend.classList.add('is-out');
        countUp(center, 0, 500, function () { return '0%'; });
        await r.wait(800);
      }
    })();
  }

  /* ---------------------------------------------------------------------------
   * Cost estimate (CostEstimateTool.vue). Numbers come from computeEstimate()
   * in missionAgent.js for the clothes-folding plan.
   * ------------------------------------------------------------------------- */
  var EST = {
    total: 10200.35, avgPrice: 2.78, balance: 18420.55,
    // [label, value, color] for the bar: one segment per task, then QA processing
    segments: [
      ['Pick garment from pile', 844, 'var(--chart-1)'],
      ['Lay garment flat', 1694, 'var(--chart-3)'],
      ['Fold t-shirt', 2871, 'var(--chart-4)'],
      ['Fold trousers', 2249, 'var(--chart-5)'],
      ['Fold towel', 1251, 'var(--chart-2)'],
      ['Stack folded clothes', 682.5, 'color-mix(in oklab, var(--chart-1) 50%, #fff)'],
      ['QA processing', 608.85, 'color-mix(in oklab, #737373 35%, transparent)'],
    ],
    // Rows shown under the bar
    lines: [
      { label: 'Fold t-shirt', sub: '900 videos × $3.19', value: 2871, color: 'var(--chart-4)', icon: tone('shirt', 'violet') },
      { label: 'Fold trousers', sub: '650 videos × $3.46', value: 2249, color: 'var(--chart-5)', icon: tone('fold-vertical', 'blue') },
      { label: 'Lay garment flat', sub: '700 videos × $2.42', value: 1694, color: 'var(--chart-3)', icon: tone('hand', 'emerald') },
      { label: '3 more tasks', sub: 'Pick, fold towel, stack · 1,200 videos', value: 2777.5, color: 'conic-gradient(var(--chart-1) 0 33%, var(--chart-2) 0 66%, color-mix(in oklab, var(--chart-1) 50%, #fff) 0)', icon: tone('layers', 'muted') },
      { label: 'QA processing', sub: '4,059 submissions · 85% expected acceptance', value: 608.85, color: 'color-mix(in oklab, #737373 35%, transparent)', icon: tone('shield-check', 'muted') },
    ],
  };

  function estimate(root) {
    var covered = EST.balance - EST.total;
    root.innerHTML =
      '<div class="cp-estimate-hero">' +
        '<div class="cp-between"><div class="cp-row cp-sm cp-medium"><span class="cp-dispatch-icon" style="width:28px;height:28px">' + icon('receipt', 'sm') + '</span>Cost estimate</div>' +
        '<span class="cp-xs cp-muted">avg ' + usd.format(EST.avgPrice) + ' / video</span></div>' +
        '<div><div class="cp-total" data-total>$0.00</div><p class="cp-xs cp-muted" style="margin-top:4px">Estimated total · you only pay for accepted videos plus QA</p></div>' +
        '<div class="cp-segbar" role="img" aria-label="Cost split by task">' + EST.segments.map(function (s) {
          return '<span title="' + s[0] + ' · ' + usd.format(s[1]) + '" style="background:' + s[2] + '" data-grow="' + (s[1] / EST.total) * 100 + '"></span>';
        }).join('') + '</div>' +
        '<ul class="cp-lines">' + EST.lines.map(function (l) {
          return '<li class="cp-line"><span class="sw" style="background:' + l.color + '"></span>' + l.icon +
            '<div class="cp-grow"><div class="cp-medium cp-truncate">' + l.label + '</div><div class="cp-xs cp-muted cp-truncate">' + l.sub + '</div></div>' +
            '<span class="pct">' + Math.round((l.value / EST.total) * 100) + '%</span><span class="amt">' + usd.format(l.value) + '</span></li>';
        }).join('') + '</ul>' +
      '</div>' +
      '<div class="cp-coverage"><div class="cp-between cp-xs"><span class="cp-row cp-muted" style="gap:6px">' + icon('wallet', 'sm') + 'Credit balance ' + usdRound.format(EST.balance) + '</span>' +
        '<span class="cp-row cp-good cp-medium" style="gap:4px">' + icon('shield-check', 'sm') + 'Covered · ' + usdRound.format(covered) + ' left after</span></div>' +
        '<div class="cp-bar"><span data-cover style="background:var(--status-good)"></span></div></div>' +
      '<div class="cp-estimate-foot"><span class="cp-xs cp-muted">Billed from prepaid credits as videos are accepted</span>' +
        '<div class="cp-row" data-when="pending"><span class="cp-btn">' + icon('pencil-line', 'sm') + 'Adjust</span><span class="cp-btn is-primary" data-approve>' + icon('circle-check', 'sm') + 'Approve</span></div>' +
        '<span class="cp-badge" data-when="approved">' + icon('circle-check', 'xs') + 'Approved</span></div>';

    var total = root.querySelector('[data-total]');
    var segs = Array.prototype.slice.call(root.querySelectorAll('.cp-segbar > span'));
    var lines = Array.prototype.slice.call(root.querySelectorAll('.cp-line'));
    var cover = root.querySelector('[data-cover]');
    var approve = root.querySelector('[data-approve]');
    var usedPct = (EST.total / EST.balance) * 100;
    var r = runner(root);

    function show(on) {
      segs.forEach(function (s) { s.style.flexGrow = on ? Math.max(+s.dataset.grow, 0.5) : 0.0001; });
      cover.style.width = on ? usedPct + '%' : '0%';
    }
    if (reduceMotion) {
      root.dataset.phase = 'pending';
      lines.forEach(function (l) { l.classList.add('is-in'); });
      total.textContent = usd.format(EST.total);
      return show(true);
    }

    (async function loop() {
      await r.start();
      for (;;) {
        root.dataset.phase = 'pending';
        approve.classList.remove('is-pressed');
        await r.wait(400);
        show(true);
        countUp(total, EST.total, 1400, function (v) { return usd.format(v); });
        for (var i = 0; i < lines.length; i++) {
          lines[i].classList.add('is-in');
          await r.wait(110);
        }
        await r.wait(2400);
        approve.classList.add('is-pressed');
        await r.wait(220);
        approve.classList.remove('is-pressed');
        await r.wait(160);
        root.dataset.phase = 'approved';
        await r.wait(3200);
        lines.forEach(function (l) { l.classList.remove('is-in'); });
        show(false);
        countUp(total, 0, 500, function () { return '$0.00'; });
        await r.wait(700);
      }
    })();
  }

  /* ---------------------------------------------------------------------------
   * Mission launch (DispatchTool.vue, missionAgent.js launch())
   * ------------------------------------------------------------------------- */
  var COLLECTORS = 363;
  var LAUNCH_STEPS = [
    ['Create mission MSN-1049', '6 tasks · 3,450 video target'],
    ['Generate recording guidelines', 'Instructions and example frames per task'],
    ['Localize instructions', 'English, Spanish, Portuguese'],
    ['Match collectors', 'Region, device and rating ≥ 4.6 → 363 collectors'],
    ['Push tasks to Capibo mobile app', '0 / 363 devices notified'],
    ['Await first submissions', 'QA pipeline armed'],
  ];

  function dispatch(root) {
    root.innerHTML =
      '<div class="cp-dispatch-head">' +
        '<div class="cp-row" style="gap:10px"><span class="cp-dispatch-icon">' + icon('smartphone') + '</span>' +
        '<div class="cp-grow"><div class="cp-sm cp-semibold cp-truncate">Dispatching MSN-1049</div><div class="cp-xs cp-muted cp-truncate" data-sub></div></div></div>' +
        '<div class="cp-row" style="margin-top:10px;gap:10px"><div class="cp-bar cp-grow"><span data-progress></span></div>' +
        '<span class="cp-badge" data-when="running">' + icon('loader-circle', 'xs cp-spin') + 'Running</span>' +
        '<span class="cp-badge is-live" data-when="live">' + icon('circle-check-big', 'xs') + 'Live</span></div>' +
      '</div>' +
      '<ol class="cp-steps">' + LAUNCH_STEPS.map(function (s) { return stepMarkup(s[0]); }).join('') + '</ol>';

    var steps = Array.prototype.slice.call(root.querySelectorAll('.cp-step'));
    var sub = root.querySelector('[data-sub]');
    var notified = { set textContent(n) { sub.textContent = n + ' / ' + COLLECTORS + ' devices notified'; } };
    var LIVE = 'Live · first video in QA';
    var progress = root.querySelector('[data-progress]');
    var r = runner(root);

    function setProgress(done) { progress.style.width = Math.round((done / steps.length) * 100) + '%'; }
    function finalState() {
      root.dataset.phase = 'live';
      sub.textContent = LIVE;
      steps.forEach(function (li, i) { setStep(li, 'done', LAUNCH_STEPS[i][1]); });
      setProgress(steps.length);
    }
    if (reduceMotion) return finalState();

    (async function loop() {
      await r.start();
      for (;;) {
        root.dataset.phase = 'running';
        notified.textContent = '0';
        steps.forEach(function (li, i) { setStep(li, 'pending', LAUNCH_STEPS[i][1]); });
        setProgress(0);
        await r.wait(600);
        for (var i = 0; i < steps.length; i++) {
          setStep(steps[i], 'running');
          if (i === 4) {
            for (var n = 0; n <= COLLECTORS; n += Math.ceil(COLLECTORS / 12)) {
              notified.textContent = n;
              steps[i].querySelector('.cp-step-detail').textContent = n + ' / ' + COLLECTORS + ' devices notified';
              await r.wait(140);
            }
            notified.textContent = COLLECTORS;
            steps[i].querySelector('.cp-step-detail').textContent = COLLECTORS + ' / ' + COLLECTORS + ' devices notified';
          } else {
            await r.wait(i === 5 ? 1500 : 550 + i * 100);
          }
          setStep(steps[i], 'done');
          setProgress(i + 1);
        }
        root.dataset.phase = 'live';
        sub.textContent = LIVE;
        await r.wait(3800);
      }
    })();
  }

  /* ---------------------------------------------------------------------------
   * Platform window: app shell + mission detail with live QA results
   * (AppSidebar.vue, MissionDetailView.vue, StatusBadge.vue)
   * ------------------------------------------------------------------------- */
  var VIDEO_TASKS = [['Fold t-shirt', 32], ['Fold towel', 21], ['Lay garment flat', 18], ['Fold trousers', 41], ['Stack folded clothes', 12]];
  var TARGET = 10000;

  function seriesPath(w, h) {
    // Deterministic 30-day accepted series: steady growth with weekend bumps (as in mock.js).
    var pts = [];
    var seed = 7;
    function rand() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 30; i++) {
      var weekend = i % 7 === 5 || i % 7 === 6 ? 1.22 : 1;
      pts.push((92 + i * 1.4) * weekend * (0.86 + rand() * 0.28));
    }
    var max = Math.max.apply(null, pts) * 1.08;
    var min = Math.min.apply(null, pts) * 0.7;
    var xy = pts.map(function (v, i) { return [(i / 29) * w, h - ((v - min) / (max - min)) * h]; });
    var line = 'M' + xy.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L');
    return { line: line, area: line + ' L' + w + ' ' + h + ' L0 ' + h + ' Z' };
  }

  function platform(root) {
    var path = seriesPath(300, 100);
    root.innerHTML =
      '<div class="cp-window-bar"><i></i><i></i><i></i><span class="cp-url">app.capibo.ai/missions/MSN-1042</span></div>' +
      '<div class="cp-shell">' +
        '<nav class="cp-rail" aria-hidden="true"><img src="./assets/capibo-mascot.png" alt=""/>' +
          '<span>' + icon('house') + '</span><span class="is-active">' + icon('target') + '</span><span>' + icon('database') + '</span>' +
          '<span>' + icon('gauge') + '</span><span>' + icon('credit-card') + '</span></nav>' +
        '<div class="cp-main">' +
          '<div class="cp-row" style="gap:10px">' + tone('shirt', 'violet', 'md') +
            '<div class="cp-grow"><div class="cp-row"><span class="cp-semibold cp-truncate" style="font-size:15px">Household laundry folding</span></div>' +
            '<div class="cp-xs cp-muted cp-truncate">MSN-1042 · US, PT, MX</div></div>' +
            '<span class="cp-status is-good">' + icon('circle-dot') + 'Active</span></div>' +
          '<div><div class="cp-between cp-sm"><span><b class="cp-semibold" style="font-size:18px" data-accepted>0</b> <span class="cp-muted">/ 10,000 accepted</span></span><span class="cp-xs cp-muted" data-pct>0%</span></div>' +
            '<div class="cp-bar" style="margin-top:6px;height:7px"><span data-progress style="background:rgb(10 10 10 / 70%)"></span></div></div>' +
          '<div class="cp-card" style="box-shadow:none;padding:12px">' +
            '<div class="cp-between"><div><div class="cp-sm cp-medium">Collection over time</div><div class="cp-xs cp-muted">Last 30 days</div></div>' +
            '<div class="cp-toggle"><span class="is-on"><i class="cp-dot" style="width:6px;height:6px;border-radius:50%;background:var(--status-good)"></i>Accepted</span><span>Rejected</span></div></div>' +
            '<div class="cp-chart" style="margin-top:10px"><svg viewBox="0 0 300 100" preserveAspectRatio="none" aria-hidden="true">' +
              '<defs><linearGradient id="cp-area-grad" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#0ca30c" stop-opacity=".22"/><stop offset="1" stop-color="#0ca30c" stop-opacity="0"/></linearGradient></defs>' +
              '<line class="grid" x1="0" x2="300" y1="25" y2="25" vector-effect="non-scaling-stroke"/><line class="grid" x1="0" x2="300" y1="62" y2="62" vector-effect="non-scaling-stroke"/>' +
              '<path class="area" d="' + path.area + '"/>' +
              '<path class="line" d="' + path.line + '" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" vector-effect="non-scaling-stroke" data-line/>' +
            '</svg></div>' +
          '</div>' +
          '<div><div class="cp-between" style="margin-bottom:8px"><span class="cp-sm cp-medium">Latest videos</span><span class="cp-xs cp-muted">Automated QA</span></div>' +
          '<ul class="cp-videos" data-videos></ul></div>' +
        '</div>' +
      '</div>';

    var acceptedEl = root.querySelector('[data-accepted]');
    var pctEl = root.querySelector('[data-pct]');
    var progress = root.querySelector('[data-progress]');
    var chart = root.querySelector('.cp-chart');
    var line = root.querySelector('[data-line]');
    var list = root.querySelector('[data-videos]');
    var accepted = 7412;
    var vid = 784214;
    var k = 0;
    var r = runner(root);

    function videoRow(status) {
      var t = VIDEO_TASKS[k++ % VIDEO_TASKS.length];
      return '<li class="cp-video cp-rise"><span class="thumb">' + icon('video', 'xs') + '</span>' +
        '<div class="cp-grow"><div class="cp-medium cp-truncate">' + t[0] + '</div><div class="cp-muted" style="font-size:11px">VID-' + vid++ + ' · ' + t[1] + 's</div></div>' +
        statusBadge(status) + '</li>';
    }
    function statusBadge(status) {
      return status === 'accepted'
        ? '<span class="cp-status is-good">' + icon('circle-check') + 'Accepted</span>'
        : '<span class="cp-status is-warning">' + icon('clock') + 'Processing</span>';
    }
    function setAccepted(n) {
      acceptedEl.textContent = num.format(Math.round(n));
      pctEl.textContent = Math.floor((n / TARGET) * 100) + '%';
      progress.style.width = (n / TARGET) * 100 + '%';
    }

    for (var i = 0; i < 4; i++) list.insertAdjacentHTML('afterbegin', videoRow('accepted'));
    if (reduceMotion) { setAccepted(accepted); chart.classList.add('is-drawn'); line.setAttribute('stroke-dashoffset', '0'); return; }

    (async function loop() {
      await r.start();
      line.style.transition = 'stroke-dashoffset 1600ms cubic-bezier(0.2, 0.7, 0.2, 1)';
      await nextFrame();
      line.setAttribute('stroke-dashoffset', '0');
      chart.classList.add('is-drawn');
      await countUp({ set textContent(v) { setAccepted(+v); } }, accepted, 1400, function (v) { return v; });
      for (;;) {
        await r.wait(1600);
        list.insertAdjacentHTML('afterbegin', videoRow('processing'));
        if (list.children.length > 4) list.lastElementChild.remove();
        await r.wait(1500);
        var badge = list.firstElementChild.querySelector('.cp-status');
        badge.outerHTML = statusBadge('accepted');
        accepted += 1;
        setAccepted(accepted);
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
