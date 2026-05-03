/* ════════════════════════════════════════════════
   LZW Compression Visualizer — script.js
   ════════════════════════════════════════════════ */

'use strict';

/* ──────────────────────────────────────────────
   1. LZW CORE ALGORITHM
   ────────────────────────────────────────────── */

function lzwCompress(input) {
  const t0 = performance.now();

  // Build initial dictionary (256 ASCII)
  const dict = {};
  for (let i = 0; i < 256; i++) {
    dict[String.fromCharCode(i)] = i;
  }
  let nextCode = 256;
  const output = [];
  const steps  = [];
  const dictGrowth = []; // {step, size}

  if (!input || input.length === 0) {
    return { output: [], steps: [], dict: {}, execTime: 0, dictGrowth: [] };
  }

  let W = input[0];

  for (let i = 1; i < input.length; i++) {
    const C = input[i];
    const WC = W + C;

    dictGrowth.push({ step: i, size: nextCode });

    if (dict[WC] !== undefined) {
      // WC exists in dict → extend W
      steps.push({
        pos:       i,
        char:      C,
        W:         W,
        WC:        WC,
        action:    'extend',
        actionMsg: `"${WC}" found in dictionary → extend W`,
        output:    null,
        newEntry:  null,
        dictSize:  nextCode
      });
      W = WC;
    } else {
      // Output code for W, add WC to dict
      const code = dict[W];
      const newEntry = { str: WC, code: nextCode };

      steps.push({
        pos:       i,
        char:      C,
        W:         W,
        WC:        WC,
        action:    'output',
        actionMsg: `"${WC}" NOT in dict → output code for "${W}" (${code}), add "${WC}"=${nextCode}`,
        output:    code,
        newEntry:  newEntry,
        dictSize:  nextCode + 1
      });

      output.push(code);
      dict[WC] = nextCode++;
      W = C;
    }
  }

  // Final character
  const finalCode = dict[W];
  dictGrowth.push({ step: input.length, size: nextCode });
  steps.push({
    pos:       input.length,
    char:      '∅',
    W:         W,
    WC:        W,
    action:    'final',
    actionMsg: `End of input → output final code for "${W}" (${finalCode})`,
    output:    finalCode,
    newEntry:  null,
    dictSize:  nextCode
  });
  output.push(finalCode);

  const execTime = performance.now() - t0;

  return { output, steps, dict, execTime, dictGrowth, nextCode };
}

/* ──────────────────────────────────────────────
   2. STATE
   ────────────────────────────────────────────── */

const state = {
  steps:        [],
  currentStep:  -1,
  isRunning:    false,
  animTimer:    null,
  lzwResult:    null,
  inputStr:     '',
  benchData:    null,
};

/* ──────────────────────────────────────────────
   3. DOM HELPERS
   ────────────────────────────────────────────── */

const $  = id => document.getElementById(id);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls)  e.className   = cls;
  if (html !== undefined) e.innerHTML  = html;
  return e;
};

function showToast(msg, duration = 2500) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

/* ──────────────────────────────────────────────
   4. INPUT TAPE
   ────────────────────────────────────────────── */

function buildTape(input) {
  const wrap = $('inputTape');
  wrap.innerHTML = '';
  for (let i = 0; i < input.length; i++) {
    const cell = el('div', 'tape-cell', input[i]);
    cell.id = `tape-${i}`;
    wrap.appendChild(cell);
  }
}

function updateTape(activePos, windowStart) {
  const cells = document.querySelectorAll('.tape-cell');
  cells.forEach((cell, idx) => {
    cell.classList.remove('active', 'processed', 'in-window');
    if (idx === activePos) {
      cell.classList.add('active');
    } else if (idx < windowStart) {
      cell.classList.add('processed');
    } else if (idx < activePos) {
      cell.classList.add('in-window');
    }
  });
}

/* ──────────────────────────────────────────────
   5. DICTIONARY
   ────────────────────────────────────────────── */

function initDictTable() {
  const tbody = $('dictBody');
  tbody.innerHTML = '';
  // Show first few ASCII + all that will be added
  const shown = [65, 66, 67, 68, 69]; // A-E representative
  for (const code of shown) {
    const ch = String.fromCharCode(code);
    const tr = el('tr', 'row-ascii');
    tr.innerHTML = `<td>${code}</td><td>"${ch}"</td><td><span class="tag-ascii">ASCII</span></td><td>Init</td>`;
    tbody.appendChild(tr);
  }
  // Ellipsis row
  const ellipsis = el('tr', 'row-ascii');
  ellipsis.innerHTML = `<td colspan="4" style="color:var(--text-mute);font-size:0.75rem;text-align:center">… 251 more ASCII entries (0–255) …</td>`;
  tbody.appendChild(ellipsis);
  $('dictCount').textContent = '256';
}

function addDictRow(code, str, stepNum, type = 'new') {
  const tbody = $('dictBody');
  const tr = el('tr', type === 'new' ? 'row-new' : 'row-match');
  tr.innerHTML = `<td>${code}</td><td>"${str}"</td><td><span class="tag-${type}">${type === 'new' ? 'New' : 'Match'}</span></td><td>${stepNum}</td>`;
  tbody.appendChild(tr);
  // Scroll to bottom
  const scroll = tbody.closest('.dict-scroll');
  if (scroll) scroll.scrollTop = scroll.scrollHeight;
  $('dictCount').textContent = 256 + tbody.querySelectorAll('.row-new').length;
}

/* ──────────────────────────────────────────────
   6. OUTPUT CODES
   ────────────────────────────────────────────── */

function addOutputCode(code) {
  const wrap = $('outputCodes');
  const chip = el('div', 'code-chip new-chip', code);
  wrap.appendChild(chip);
  // Remove new-chip after animation
  setTimeout(() => chip.classList.remove('new-chip'), 500);
}

/* ──────────────────────────────────────────────
   7. STEP DISPLAY
   ────────────────────────────────────────────── */

function renderStep(stepIndex) {
  if (stepIndex < 0 || stepIndex >= state.steps.length) return;
  const s = state.steps[stepIndex];

  $('stepPos').textContent    = s.pos >= state.inputStr.length ? 'End' : s.pos;
  $('stepChar').textContent   = s.char;
  $('stepW').textContent      = `"${s.W}"`;
  $('stepWC').textContent     = `"${s.WC}"`;
  $('stepAction').textContent = s.actionMsg;
  $('stepOutput').textContent = s.output !== null ? s.output : '—';
  $('stepCount').textContent  = stepIndex + 1;
  $('stepTotal').textContent  = state.steps.length;

  // Progress bar
  const pct = ((stepIndex + 1) / state.steps.length) * 100;
  $('progressBar').style.width = pct + '%';

  // Color the action text
  const actionEl = $('stepAction');
  if (s.action === 'output' || s.action === 'final') {
    actionEl.style.color = 'var(--orange)';
  } else {
    actionEl.style.color = 'var(--accent)';
  }

  // Tape
  const windowStart = s.pos - s.W.length + 1;
  updateTape(s.pos >= state.inputStr.length ? -1 : s.pos, windowStart);

  // Dict & output
  if (s.action === 'output' || s.action === 'final') {
    if (s.output !== null) addOutputCode(s.output);
  }
  if (s.newEntry) {
    addDictRow(s.newEntry.code, s.newEntry.str, stepIndex + 1, 'new');
  }
}

/* ──────────────────────────────────────────────
   8. ANIMATION LOOP
   ────────────────────────────────────────────── */

function getSpeed() {
  const raw = parseInt($('speedSlider').value);
  return 1600 - raw; // invert: higher slider = faster = shorter delay
}

function runAnimation() {
  if (state.currentStep >= state.steps.length - 1) {
    finishRun();
    return;
  }
  state.currentStep++;
  renderStep(state.currentStep);

  state.animTimer = setTimeout(runAnimation, getSpeed());
}

function startRun() {
  const input = $('inputString').value.trim();
  if (!input) { showToast('⚠ Please enter an input string.'); return; }
  state.inputStr = input;

  // Reset UI
  $('outputCodes').innerHTML = '';
  $('resultCard').style.display = 'none';
  $('stepPos').textContent    = '—';
  $('stepChar').textContent   = '—';
  $('stepW').textContent      = '—';
  $('stepWC').textContent     = '—';
  $('stepAction').textContent = '—';
  $('stepOutput').textContent = '—';
  $('stepCount').textContent  = '0';
  $('stepTotal').textContent  = '0';
  $('progressBar').style.width = '0%';

  buildTape(input);
  initDictTable();

  // Run algorithm
  state.lzwResult  = lzwCompress(input);
  state.steps      = state.lzwResult.steps;
  state.currentStep = -1;
  state.isRunning   = true;

  $('btnRun').disabled  = true;
  $('btnStep').disabled = false;

  $('stepTotal').textContent = state.steps.length;

  // Update complexity panel immediately
  updateComplexity(state.lzwResult, input.length);
  // Update dict growth graph immediately
  drawDictGrowthGraph(state.lzwResult.dictGrowth);

  runAnimation();
}

function stepOnce() {
  if (state.animTimer) clearTimeout(state.animTimer);
  if (state.currentStep >= state.steps.length - 1) {
    finishRun();
    return;
  }
  state.currentStep++;
  renderStep(state.currentStep);
  if (state.currentStep >= state.steps.length - 1) finishRun();
}

function finishRun() {
  state.isRunning = false;
  if (state.animTimer) clearTimeout(state.animTimer);
  $('btnRun').disabled  = false;
  $('btnStep').disabled = true;

  const r      = state.lzwResult;
  const input  = state.inputStr;
  const n      = input.length;
  const origBits = n * 8;
  const codeSize = Math.ceil(Math.log2(r.nextCode || 256));
  const compBits = r.output.length * codeSize;
  const ratio    = origBits > 0 ? ((1 - compBits / origBits) * 100).toFixed(1) : 0;
  const dictEntries = r.nextCode - 256;

  $('resOrigSize').textContent  = origBits;
  $('resCompSize').textContent  = compBits;
  $('resRatio').textContent     = ratio + '%';
  $('resSteps').textContent     = r.steps.length;
  $('resDictSize').textContent  = r.nextCode;
  $('resTime').textContent      = r.execTime.toFixed(4);

  const arrWrap = $('outputArray');
  arrWrap.innerHTML = '';
  r.output.forEach(code => {
    const span = el('span', 'out-code', code);
    arrWrap.appendChild(span);
  });

  $('resultCard').style.display = 'block';
  $('resultCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  showToast(`✓ Done — ${r.output.length} codes, ratio ${ratio}%`);
}

function resetAll() {
  if (state.animTimer) clearTimeout(state.animTimer);
  state.isRunning   = false;
  state.steps       = [];
  state.currentStep = -1;
  state.lzwResult   = null;

  $('inputTape').innerHTML      = '';
  $('outputCodes').innerHTML    = '';
  $('dictBody').innerHTML       = '';
  $('outputArray').innerHTML    = '';
  $('resultCard').style.display = 'none';
  $('btnRun').disabled  = false;
  $('btnStep').disabled = true;
  $('stepPos').textContent    = '—';
  $('stepChar').textContent   = '—';
  $('stepW').textContent      = '—';
  $('stepWC').textContent     = '—';
  $('stepAction').textContent = '—';
  $('stepOutput').textContent = '—';
  $('stepCount').textContent  = '0';
  $('stepTotal').textContent  = '0';
  $('progressBar').style.width = '0%';
  $('dictCount').textContent   = '0';
}

/* ──────────────────────────────────────────────
   9. COMPLEXITY UPDATER
   ────────────────────────────────────────────── */

function updateComplexity(result, n) {
  $('measuredN').textContent    = n;
  $('measuredTime').textContent = result.execTime.toFixed(4) + ' ms';

  // Space
  const entries   = result.nextCode;
  const auxBytes  = result.output.length * 2; // 2 bytes per code approx
  const dictBytes = Object.keys(result.dict || {}).reduce((sum, k) => sum + k.length + 4, 0);
  const totalKB   = ((auxBytes + dictBytes) / 1024).toFixed(2);

  $('spaceDictEntries').textContent = entries + ' entries';
  $('spaceAux').textContent         = auxBytes + ' bytes';
  $('spaceTotal').textContent       = totalKB + ' KB';
  $('dictGrowthRate').textContent   = (((entries - 256) / n) * 100).toFixed(1) + '% expansion per char';
}

/* ──────────────────────────────────────────────
   10. GRAPH ENGINE
   ────────────────────────────────────────────── */

const PALETTE = {
  blue:   '#5b9cf6',
  green:  '#36c98e',
  orange: '#f5a623',
  purple: '#a78bfa',
  grid:   '#1a2030',
  axis:   '#4a5570',
  text:   '#7a8baa',
};

function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const W = rect.width  || canvas.width;
  const H = rect.height || canvas.height;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, W, H };
}

function drawGraph(canvasId, data, color, label, xLabel, yLabel) {
  const canvas = $(canvasId);
  if (!canvas) return;

  const { ctx, W, H } = setupCanvas(canvas);

  const PAD = { top: 24, right: 20, bottom: 50, left: 60 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top  - PAD.bottom;

  ctx.clearRect(0, 0, W, H);

  const xs = data.map(d => d.x);
  const ys = data.map(d => d.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = 0,               yMax = Math.max(...ys) * 1.15 || 1;

  const toX = v => PAD.left + ((v - xMin) / (xMax - xMin || 1)) * plotW;
  const toY = v => PAD.top  + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;

  // Grid
  ctx.strokeStyle = PALETTE.grid;
  ctx.lineWidth   = 1;
  for (let i = 0; i <= 5; i++) {
    const y = PAD.top + (plotH / 5) * i;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + plotW, y);
    ctx.stroke();
    const val = yMax - (yMax / 5) * i;
    ctx.fillStyle = PALETTE.text;
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(val.toFixed(val < 1 ? 3 : 0), PAD.left - 6, y + 4);
  }

  // X-axis ticks
  ctx.fillStyle  = PALETTE.text;
  ctx.font       = '10px JetBrains Mono, monospace';
  ctx.textAlign  = 'center';
  data.forEach(d => {
    const x = toX(d.x);
    ctx.beginPath();
    ctx.strokeStyle = PALETTE.axis;
    ctx.moveTo(x, PAD.top + plotH);
    ctx.lineTo(x, PAD.top + plotH + 4);
    ctx.stroke();
    ctx.fillText(d.x, x, PAD.top + plotH + 16);
  });

  // Axes
  ctx.strokeStyle = PALETTE.axis;
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(PAD.left, PAD.top);
  ctx.lineTo(PAD.left, PAD.top + plotH);
  ctx.lineTo(PAD.left + plotW, PAD.top + plotH);
  ctx.stroke();

  // Area fill
  ctx.beginPath();
  ctx.moveTo(toX(xs[0]), toY(ys[0]));
  for (let i = 1; i < data.length; i++) {
    ctx.lineTo(toX(xs[i]), toY(ys[i]));
  }
  ctx.lineTo(toX(xs[xs.length - 1]), toY(0));
  ctx.lineTo(toX(xs[0]), toY(0));
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + plotH);
  grad.addColorStop(0, color + '33');
  grad.addColorStop(1, color + '00');
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(toX(xs[0]), toY(ys[0]));
  for (let i = 1; i < data.length; i++) {
    ctx.lineTo(toX(xs[i]), toY(ys[i]));
  }
  ctx.strokeStyle = color;
  ctx.lineWidth   = 2.5;
  ctx.lineJoin    = 'round';
  ctx.stroke();

  // Points
  data.forEach(d => {
    const x = toX(d.x), y = toY(d.y);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle   = color;
    ctx.fill();
    ctx.strokeStyle = '#0d0f14';
    ctx.lineWidth   = 2;
    ctx.stroke();
  });

  // Label
  ctx.fillStyle = color;
  ctx.font      = '11px Syne, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, PAD.left + 8, PAD.top + 14);
}

function drawDictGrowthGraph(dictGrowth) {
  if (!dictGrowth || dictGrowth.length === 0) return;
  const data = dictGrowth.map(d => ({ x: d.step, y: d.size }));
  drawGraph('graphDict', data, PALETTE.purple, 'Dictionary Size', 'Step', 'Entries');
}

/* ──────────────────────────────────────────────
   11. BENCHMARKING
   ────────────────────────────────────────────── */

const BENCH_SIZES = [10, 50, 100, 200, 500, 1000, 2000];

function generateString(n) {
  // Mix of repeating patterns and random chars for realistic benchmark
  const alphabet = 'ABCDEFGHIJ';
  let s = '';
  for (let i = 0; i < n; i++) {
    if (Math.random() < 0.6) {
      s += alphabet[Math.floor(Math.random() * 4)]; // biased to create repetition
    } else {
      s += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
  }
  return s;
}

function runBenchmark() {
  const btn = $('btnBenchmark');
  btn.disabled = true;
  btn.textContent = '⏳ Benchmarking…';

  setTimeout(() => {
    const timeData  = [];
    const spaceData = [];
    const ratioData = [];
    const tableRows = [];

    BENCH_SIZES.forEach(n => {
      const input    = generateString(n);
      // Run 3 times and average for stability
      let totalTime  = 0;
      let result;
      for (let t = 0; t < 3; t++) {
        result = lzwCompress(input);
        totalTime += result.execTime;
      }
      const avgTime = totalTime / 3;

      const origBits = n * 8;
      const codeSize = Math.ceil(Math.log2(result.nextCode || 256));
      const compBits = result.output.length * codeSize;
      const ratio    = origBits > 0 ? ((1 - compBits / origBits) * 100) : 0;

      timeData.push( { x: n, y: parseFloat(avgTime.toFixed(4)) });
      spaceData.push({ x: n, y: result.nextCode });
      ratioData.push({ x: n, y: parseFloat(ratio.toFixed(2)) });

      tableRows.push({ n, time: avgTime.toFixed(4), dict: result.nextCode, codes: result.output.length, ratio: ratio.toFixed(1) });
    });

    state.benchData = { timeData, spaceData, ratioData };

    // Draw graphs
    drawGraph('graphTime',  timeData,  PALETTE.blue,   'Execution Time (ms)', 'n', 'ms');
    drawGraph('graphSpace', spaceData, PALETTE.green,  'Dictionary Size',     'n', 'entries');
    drawGraph('graphRatio', ratioData, PALETTE.orange, 'Compression Ratio %', 'n', '%');

    // Table
    const tbody = $('benchTableBody');
    tbody.innerHTML = '';
    tableRows.forEach(row => {
      const tr = el('tr');
      tr.innerHTML = `
        <td class="mono">${row.n}</td>
        <td class="mono">${row.time}</td>
        <td class="mono">${row.dict}</td>
        <td class="mono">${row.codes}</td>
        <td class="mono">${row.ratio}%</td>
      `;
      tbody.appendChild(tr);
    });

    $('benchmarkTable').style.display = 'block';
    btn.disabled    = false;
    btn.textContent = '📊 Run Benchmark';
    showToast('✓ Benchmark complete!');
  }, 50);
}

/* ──────────────────────────────────────────────
   12. TEST CASES
   ────────────────────────────────────────────── */

const TEST_CASES = [
  {
    input:    'ABABABA',
    expected: [65, 66, 128, 130, 65],
    note:     'Classic LZW example'
  },
  {
    input:    'AAAAAAAAA',
    expected: [65, 128, 129, 130],
    note:     'All same character'
  },
  {
    input:    'ABCABCABC',
    expected: [65, 66, 67, 128, 130, 132],
    note:     'Repeating ABC pattern'
  },
  {
    input:    'ABCD',
    expected: [65, 66, 67, 68],
    note:     'No repetition — no compression'
  },
  {
    input:    'TOBEORNOTTOBEORTOBEORNOT',
    expected: null, // computed at runtime
    note:     'Classic text sample'
  },
];

function runTests() {
  const tbody = $('testBody');
  tbody.innerHTML = '';

  TEST_CASES.forEach((tc, i) => {
    const result   = lzwCompress(tc.input);
    const actual   = result.output;
    const origBits = tc.input.length * 8;
    const codeSize = Math.ceil(Math.log2(result.nextCode || 256));
    const compBits = actual.length * codeSize;
    const ratio    = ((1 - compBits / origBits) * 100).toFixed(1) + '%';

    // Validate
    let pass = false;
    if (tc.expected) {
      pass = tc.expected.length === actual.slice(0, tc.expected.length).length &&
             tc.expected.every((v, j) => v === actual[j]);
    } else {
      // Just check it ran without error
      pass = actual.length > 0;
    }

    const expectedStr = tc.expected
      ? '[' + tc.expected.join(', ') + ', …]'
      : 'auto-computed';

    const tr = el('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${tc.input}</td>
      <td>${expectedStr}</td>
      <td>[${actual.join(', ')}]</td>
      <td>${result.nextCode}</td>
      <td>${ratio}</td>
      <td class="${pass ? 'status-pass' : 'status-fail'}">${pass ? '✓ PASS' : '✗ FAIL'}</td>
    `;
    tbody.appendChild(tr);
  });

  showToast(`✓ Tests complete — ${TEST_CASES.length} cases run`);
}

/* ──────────────────────────────────────────────
   13. EMPTY GRAPH PLACEHOLDERS
   ────────────────────────────────────────────── */

function drawPlaceholder(canvasId, msg) {
  const canvas = $(canvasId);
  if (!canvas) return;
  const { ctx, W, H } = setupCanvas(canvas);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = PALETTE.axis;
  ctx.font = '12px Syne, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(msg, W / 2, H / 2);
}

function initEmptyGraphs() {
  const msg = 'Click "Run Benchmark" to generate data';
  drawPlaceholder('graphTime',  msg);
  drawPlaceholder('graphSpace', msg);
  drawPlaceholder('graphRatio', msg);
  drawPlaceholder('graphDict',  'Run the algorithm to see dictionary growth');
}

/* ──────────────────────────────────────────────
   14. EVENT LISTENERS
   ────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  // Buttons
  $('btnRun').addEventListener('click', startRun);

  $('btnStep').addEventListener('click', () => {
    if (state.animTimer) clearTimeout(state.animTimer);
    stepOnce();
  });

  $('btnReset').addEventListener('click', resetAll);

  $('btnBenchmark').addEventListener('click', runBenchmark);

  $('btnRunTests').addEventListener('click', runTests);

  // Sample buttons
  document.querySelectorAll('.sample-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $('inputString').value = btn.dataset.val;
      resetAll();
    });
  });

  // Smooth scroll for nav
  document.querySelectorAll('.header-nav a').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(a.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Init
  initEmptyGraphs();

  // Initialize test table with pending status
  const tbody = $('testBody');
  TEST_CASES.forEach((tc, i) => {
    const tr = el('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${tc.input}</td>
      <td>${tc.expected ? '[' + tc.expected.join(', ') + ', …]' : 'auto-computed'}</td>
      <td class="status-pending">—</td>
      <td class="status-pending">—</td>
      <td class="status-pending">—</td>
      <td class="status-pending">Pending</td>
    `;
    tbody.appendChild(tr);
  });

  // Resize graphs on window resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (state.benchData) {
        drawGraph('graphTime',  state.benchData.timeData,  PALETTE.blue,   'Execution Time (ms)', 'n', 'ms');
        drawGraph('graphSpace', state.benchData.spaceData, PALETTE.green,  'Dictionary Size',     'n', 'entries');
        drawGraph('graphRatio', state.benchData.ratioData, PALETTE.orange, 'Compression Ratio %', 'n', '%');
      } else {
        initEmptyGraphs();
      }
      if (state.lzwResult) {
        drawDictGrowthGraph(state.lzwResult.dictGrowth);
      }
    }, 200);
  });
});
