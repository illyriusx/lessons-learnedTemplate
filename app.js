const state = {
  size: 4,
  sequence: [],
  options: [],
  lastResult: null,
};

const sequenceWrap = document.getElementById('sequenceWrap');
const optionsWrap = document.getElementById('optionsWrap');
const gridSizeSelect = document.getElementById('gridSize');
const resultBox = document.getElementById('result');
const explanationBox = document.getElementById('explanation');

function makeEmptyGrid(size) {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

function cloneGrid(grid) {
  return grid.map((row) => [...row]);
}

function initState(size = state.size) {
  state.size = size;
  state.sequence = [makeEmptyGrid(size), makeEmptyGrid(size), makeEmptyGrid(size)];
  state.options = [makeEmptyGrid(size), makeEmptyGrid(size), makeEmptyGrid(size), makeEmptyGrid(size)];
  state.lastResult = null;
  renderAll();
  setResult('No prediction yet.', 'warn');
  explanationBox.textContent = 'Run the solver to generate a rule trace.';
}

function setResult(text, kind = '') {
  resultBox.textContent = text;
  resultBox.className = `result ${kind}`.trim();
}

function buildPanel(title, grid, onCellClick) {
  const panel = document.createElement('div');
  panel.className = 'panel';

  const heading = document.createElement('h3');
  heading.textContent = title;
  panel.appendChild(heading);

  const gridEl = document.createElement('div');
  gridEl.className = 'dot-grid';
  gridEl.style.gridTemplateColumns = `repeat(${state.size}, 28px)`;

  for (let r = 0; r < state.size; r += 1) {
    for (let c = 0; c < state.size; c += 1) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `cell ${grid[r][c] ? 'active' : ''}`.trim();
      cell.title = `Row ${r + 1}, Col ${c + 1}`;
      cell.addEventListener('click', () => onCellClick(r, c));
      gridEl.appendChild(cell);
    }
  }

  panel.appendChild(gridEl);
  return panel;
}

function renderAll() {
  sequenceWrap.innerHTML = '';
  optionsWrap.innerHTML = '';

  ['A', 'B', 'C'].forEach((label, idx) => {
    const panel = buildPanel(`Frame ${label}`, state.sequence[idx], (r, c) => {
      state.sequence[idx][r][c] = state.sequence[idx][r][c] ? 0 : 1;
      renderAll();
    });
    sequenceWrap.appendChild(panel);
  });

  state.options.forEach((grid, idx) => {
    const panel = buildPanel(`Option ${idx + 1}`, grid, (r, c) => {
      state.options[idx][r][c] = state.options[idx][r][c] ? 0 : 1;
      renderAll();
    });

    if (state.lastResult && state.lastResult.bestIndex === idx) {
      panel.classList.add('selected');
    }

    optionsWrap.appendChild(panel);
  });
}

function activeCells(grid) {
  const cells = [];
  grid.forEach((row, r) => row.forEach((v, c) => {
    if (v) cells.push([r, c]);
  }));
  return cells;
}

function toSet(grid) {
  const set = new Set();
  activeCells(grid).forEach(([r, c]) => set.add(`${r},${c}`));
  return set;
}

function fromSet(set, size) {
  const grid = makeEmptyGrid(size);
  set.forEach((key) => {
    const [r, c] = key.split(',').map(Number);
    grid[r][c] = 1;
  });
  return grid;
}

function countDots(grid) {
  return activeCells(grid).length;
}

function gridsEqual(g1, g2) {
  for (let r = 0; r < state.size; r += 1) {
    for (let c = 0; c < state.size; c += 1) {
      if (g1[r][c] !== g2[r][c]) return false;
    }
  }
  return true;
}

function rotate90(grid) {
  const n = state.size;
  const out = makeEmptyGrid(n);
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      out[c][n - 1 - r] = grid[r][c];
    }
  }
  return out;
}

function rotate(grid, times) {
  let g = cloneGrid(grid);
  for (let i = 0; i < times; i += 1) g = rotate90(g);
  return g;
}

function flipHorizontal(grid) {
  return grid.map((row) => [...row].reverse());
}

function flipVertical(grid) {
  return [...grid].reverse().map((row) => [...row]);
}

function translate(grid, dr, dc) {
  const out = makeEmptyGrid(state.size);
  for (let r = 0; r < state.size; r += 1) {
    for (let c = 0; c < state.size; c += 1) {
      if (!grid[r][c]) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < state.size && nc >= 0 && nc < state.size) {
        out[nr][nc] = 1;
      }
    }
  }
  return out;
}

function setOp(a, b, op) {
  const as = toSet(a);
  const bs = toSet(b);
  const out = new Set();

  if (op === 'union') {
    as.forEach((v) => out.add(v));
    bs.forEach((v) => out.add(v));
  } else if (op === 'intersection') {
    as.forEach((v) => {
      if (bs.has(v)) out.add(v);
    });
  } else if (op === 'xor') {
    as.forEach((v) => {
      if (!bs.has(v)) out.add(v);
    });
    bs.forEach((v) => {
      if (!as.has(v)) out.add(v);
    });
  }

  return fromSet(out, state.size);
}

function similarityScore(g1, g2) {
  let same = 0;
  const total = state.size * state.size;
  for (let r = 0; r < state.size; r += 1) {
    for (let c = 0; c < state.size; c += 1) {
      if (g1[r][c] === g2[r][c]) same += 1;
    }
  }
  return same / total;
}

function detectRuleCandidates(a, b, c) {
  const rules = [];

  // Dot count arithmetic progression rule
  const ca = countDots(a);
  const cb = countDots(b);
  const cc = countDots(c);
  const diffAB = cb - ca;
  rules.push({
    name: 'dot-count-linear',
    predictCount: cc + diffAB,
    weight: 1.6,
    note: `dot counts ${ca}→${cb}→${cc}, expecting +${diffAB}`,
  });

  // Dot count multiplicative rule
  const ratio = ca > 0 ? cb / ca : null;
  if (ratio !== null && Number.isFinite(ratio)) {
    rules.push({
      name: 'dot-count-ratio',
      predictCount: Math.round(cc * ratio),
      weight: 0.8,
      note: `count ratio approx ${ratio.toFixed(2)}`,
    });
  }

  // Rotations
  for (let t = 1; t <= 3; t += 1) {
    if (gridsEqual(rotate(a, t), b) && gridsEqual(rotate(b, t), c)) {
      rules.push({
        name: 'rotation',
        predictedGrid: rotate(c, t),
        weight: 2.2,
        note: `consistent rotation by ${t * 90}°`,
      });
    }
  }

  // Mirror
  if (gridsEqual(flipHorizontal(a), b) && gridsEqual(flipHorizontal(b), c)) {
    rules.push({
      name: 'mirror-horizontal',
      predictedGrid: flipHorizontal(c),
      weight: 1.7,
      note: 'repeated horizontal mirror',
    });
  }

  if (gridsEqual(flipVertical(a), b) && gridsEqual(flipVertical(b), c)) {
    rules.push({
      name: 'mirror-vertical',
      predictedGrid: flipVertical(c),
      weight: 1.7,
      note: 'repeated vertical mirror',
    });
  }

  // Translation estimation by center-of-mass shift
  const aCells = activeCells(a);
  const bCells = activeCells(b);
  const cCells = activeCells(c);
  if (aCells.length > 0 && aCells.length === bCells.length && bCells.length === cCells.length) {
    const centroid = (cells) => {
      const sum = cells.reduce((acc, [r, cl]) => [acc[0] + r, acc[1] + cl], [0, 0]);
      return [sum[0] / cells.length, sum[1] / cells.length];
    };
    const [ar, ac] = centroid(aCells);
    const [br, bc] = centroid(bCells);
    const [cr, cc2] = centroid(cCells);
    const dr1 = Math.round(br - ar);
    const dc1 = Math.round(bc - ac);
    const dr2 = Math.round(cr - br);
    const dc2 = Math.round(cc2 - bc);
    if (dr1 === dr2 && dc1 === dc2 && similarityScore(translate(a, dr1, dc1), b) > 0.85) {
      rules.push({
        name: 'translation',
        predictedGrid: translate(c, dr1, dc1),
        weight: 1.9,
        note: `translation vector (${dr1}, ${dc1})`,
      });
    }
  }

  // Set operations
  ['union', 'intersection', 'xor'].forEach((op) => {
    if (gridsEqual(setOp(a, b, op), c)) {
      rules.push({
        name: `set-${op}`,
        predictedGrid: setOp(b, c, op),
        weight: 2.0,
        note: `${op.toUpperCase()}(A,B)=C pattern`,
      });
    }
  });

  return rules;
}

function scoreOption(optionGrid, rules) {
  let score = 0;
  const matched = [];

  rules.forEach((rule) => {
    if (rule.predictedGrid) {
      const sim = similarityScore(optionGrid, rule.predictedGrid);
      const weighted = sim * rule.weight;
      score += weighted;
      if (sim > 0.8) matched.push(`${rule.name} (${sim.toFixed(2)})`);
    }

    if (rule.predictCount !== undefined) {
      const diff = Math.abs(countDots(optionGrid) - rule.predictCount);
      const maxErr = Math.max(1, state.size);
      const closeness = Math.max(0, 1 - diff / maxErr);
      const weighted = closeness * rule.weight;
      score += weighted;
      if (closeness > 0.8) matched.push(`${rule.name} count-fit (${closeness.toFixed(2)})`);
    }
  });

  return { score, matched };
}

function solvePuzzle() {
  const [a, b, c] = state.sequence;
  const rules = detectRuleCandidates(a, b, c);

  if (rules.length === 0) {
    setResult('No strong pattern detected. Try cleaner transformations.', 'warn');
    explanationBox.textContent = 'Rule detector could not identify reliable transitions from A→B→C.';
    return;
  }

  const scored = state.options.map((optionGrid, idx) => {
    const { score, matched } = scoreOption(optionGrid, rules);
    return { idx, score, matched, count: countDots(optionGrid) };
  });

  scored.sort((x, y) => y.score - x.score);
  const best = scored[0];
  const second = scored[1];
  const margin = second ? (best.score - second.score) : best.score;

  state.lastResult = {
    bestIndex: best.idx,
    score: best.score,
    margin,
    ruleTrace: rules,
    ranked: scored,
  };

  renderAll();

  const confidence = margin > 0.8 ? 'high' : margin > 0.35 ? 'medium' : 'low';
  setResult(`Predicted answer: Option ${best.idx + 1} (confidence: ${confidence})`, confidence === 'low' ? 'warn' : 'ok');

  explanationBox.textContent = [
    'Detected rules:',
    ...rules.map((r) => `- ${r.name}: ${r.note}`),
    '',
    'Ranking:',
    ...state.lastResult.ranked.map((r, i) => `${i + 1}. Option ${r.idx + 1} -> score ${r.score.toFixed(3)} | dots ${r.count}`),
    '',
    `Decision margin: ${margin.toFixed(3)}`,
    `Chosen option: ${best.idx + 1}`,
    best.matched.length ? `Key matches: ${best.matched.join(', ')}` : 'No highly specific rule matches; decision was aggregate.',
  ].join('\n');
}

function explainLast() {
  if (!state.lastResult) {
    explanationBox.textContent = 'No previous run. Click Solve first.';
    return;
  }

  const lines = [
    'Last solve details:',
    `- Selected option: ${state.lastResult.bestIndex + 1}`,
    `- Score: ${state.lastResult.score.toFixed(3)}`,
    `- Margin over next best: ${state.lastResult.margin.toFixed(3)}`,
    '- Candidate rules:',
    ...state.lastResult.ruleTrace.map((r) => `  • ${r.name} [w=${r.weight}] ${r.note}`),
  ];

  explanationBox.textContent = lines.join('\n');
}

function loadSamplePuzzle() {
  const n = state.size;
  initState(n);

  // Sample: L-shape rotating 90° each frame
  const a = makeEmptyGrid(n);
  a[0][0] = 1; a[1][0] = 1; a[1][1] = 1;
  const b = rotate(a, 1);
  const c = rotate(b, 1);
  const d = rotate(c, 1);

  state.sequence = [a, b, c];
  state.options = [
    rotate(d, 1),
    d,
    translate(d, 1, 0),
    setOp(b, c, 'xor'),
  ];

  state.lastResult = null;
  renderAll();
  setResult('Sample loaded. Press Solve.', '');
}

document.getElementById('solveBtn').addEventListener('click', solvePuzzle);
document.getElementById('explainBtn').addEventListener('click', explainLast);
document.getElementById('resetBtn').addEventListener('click', () => initState(Number(gridSizeSelect.value)));
document.getElementById('sampleBtn').addEventListener('click', loadSamplePuzzle);

gridSizeSelect.addEventListener('change', (e) => {
  initState(Number(e.target.value));
});

initState(4);
