const matrixSizeEl = document.getElementById('matrixSize');
const matrixPasteZone = document.getElementById('matrixPasteZone');
const optionsPasteZone = document.getElementById('optionsPasteZone');
const matrixSourceCanvas = document.getElementById('matrixSourceCanvas');
const optionsSourceCanvas = document.getElementById('optionsSourceCanvas');
const matrixPreviewCanvas = document.getElementById('matrixPreviewCanvas');
const optionsPreviewCanvas = document.getElementById('optionsPreviewCanvas');
const matrixResetCropBtn = document.getElementById('matrixResetCropBtn');
const optionsResetCropBtn = document.getElementById('optionsResetCropBtn');
const matrixCropInfo = document.getElementById('matrixCropInfo');
const optionsCropInfo = document.getElementById('optionsCropInfo');
const solveBtn = document.getElementById('solveBtn');
const resetBtn = document.getElementById('resetBtn');
const statusEl = document.getElementById('status');
const finalAnswerEl = document.getElementById('finalAnswer');
const optionsList = document.getElementById('optionsList');
const matrixOcrTextEl = document.getElementById('matrixOcrText');
const optionsOcrTextEl = document.getElementById('optionsOcrText');
const analysisLogEl = document.getElementById('analysisLog');

const imageState = {
    matrix: createImageSlot(matrixSourceCanvas, matrixPreviewCanvas, matrixCropInfo),
    options: createImageSlot(optionsSourceCanvas, optionsPreviewCanvas, optionsCropInfo),
};

function createImageSlot(sourceCanvas, previewCanvas, infoEl) {
    return {
        sourceCanvas,
        previewCanvas,
        infoEl,
        bitmap: null,
        crop: null,
        dragging: false,
        dragStart: null,
    };
}

const ui = {
    setStatus(message, state = 'idle') {
        statusEl.textContent = message;
        statusEl.className = `status ${state}`;
    },
    setAnswer(text, confident = false) {
        finalAnswerEl.textContent = text;
        finalAnswerEl.style.borderColor = confident ? 'rgba(34,197,94,0.75)' : 'rgba(245,158,11,0.75)';
        finalAnswerEl.style.background = confident ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.16)';
    },
    setOptions(options) {
        optionsList.innerHTML = '';
        if (!options.length) {
            optionsList.innerHTML = '<li>Inga svarsalternativ hittades.</li>';
            return;
        }

        options.forEach((opt) => {
            const li = document.createElement('li');
            const extra = opt.score !== undefined ? ` (score ${opt.score.toFixed(4)})` : '';
            li.textContent = `${opt.label}: ${opt.value || 'Bildalternativ'}${extra}`;
            optionsList.appendChild(li);
        });
    },
};

function normalizeText(text) {
    return text
        .replace(/[|]/g, '1')
        .replace(/[Oo]/g, '0')
        .replace(/[–—]/g, '-')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractImageFromPaste(event) {
    const items = event.clipboardData?.items || [];
    for (const item of items) {
        if (item.type.startsWith('image/')) {
            return item.getAsFile();
        }
    }

    return null;
}

async function setSlotImage(slot, file) {
    if (!file) {
        return;
    }

    const bitmap = await createImageBitmap(file);
    slot.bitmap = bitmap;
    slot.crop = { x: 0, y: 0, w: bitmap.width, h: bitmap.height };
    drawSource(slot);
    drawCropPreview(slot);
}

function drawSource(slot) {
    const { sourceCanvas, bitmap } = slot;
    if (!bitmap) {
        return;
    }

    sourceCanvas.width = bitmap.width;
    sourceCanvas.height = bitmap.height;

    const ctx = sourceCanvas.getContext('2d');
    ctx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
    ctx.drawImage(bitmap, 0, 0);

    drawCropOverlay(slot);
}

function drawCropOverlay(slot) {
    const { sourceCanvas, crop } = slot;
    const ctx = sourceCanvas.getContext('2d');
    if (!crop) {
        return;
    }

    ctx.save();
    ctx.fillStyle = 'rgba(2,6,23,0.45)';
    ctx.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
    ctx.clearRect(crop.x, crop.y, crop.w, crop.h);

    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = Math.max(2, Math.round(sourceCanvas.width / 400));
    ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);

    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#22c55e';
    ctx.strokeRect(crop.x + 2, crop.y + 2, Math.max(0, crop.w - 4), Math.max(0, crop.h - 4));
    ctx.restore();

    slot.infoEl.textContent = `Crop: x=${Math.round(crop.x)}, y=${Math.round(crop.y)}, w=${Math.round(crop.w)}, h=${Math.round(crop.h)}`;
}

function ensureBounds(rect, maxW, maxH) {
    const x = Math.max(0, Math.min(rect.x, maxW - 1));
    const y = Math.max(0, Math.min(rect.y, maxH - 1));
    const w = Math.max(1, Math.min(rect.w, maxW - x));
    const h = Math.max(1, Math.min(rect.h, maxH - y));
    return { x, y, w, h };
}

function drawCropPreview(slot) {
    const { bitmap, crop, previewCanvas } = slot;
    if (!bitmap || !crop) {
        return;
    }

    const scale = 2;
    previewCanvas.width = Math.max(1, Math.round(crop.w * scale));
    previewCanvas.height = Math.max(1, Math.round(crop.h * scale));

    const ctx = previewCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    ctx.drawImage(bitmap, crop.x, crop.y, crop.w, crop.h, 0, 0, previewCanvas.width, previewCanvas.height);

    applyClarityFilter(previewCanvas);
}

function applyClarityFilter(canvas) {
    const ctx = canvas.getContext('2d');
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;

    for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const contrasted = gray > 165 ? 255 : gray < 75 ? 0 : Math.min(255, gray * 1.2);
        d[i] = contrasted;
        d[i + 1] = contrasted;
        d[i + 2] = contrasted;
    }

    ctx.putImageData(img, 0, 0);
}

function bindCropMouse(slot) {
    const canvas = slot.sourceCanvas;

    canvas.addEventListener('mousedown', (e) => {
        if (!slot.bitmap) {
            return;
        }

        const rect = canvas.getBoundingClientRect();
        const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
        const sy = (e.clientY - rect.top) * (canvas.height / rect.height);

        slot.dragStart = { x: sx, y: sy };
        slot.dragging = true;
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!slot.dragging || !slot.bitmap || !slot.dragStart) {
            return;
        }

        const rect = canvas.getBoundingClientRect();
        const ex = (e.clientX - rect.left) * (canvas.width / rect.width);
        const ey = (e.clientY - rect.top) * (canvas.height / rect.height);

        const x = Math.min(slot.dragStart.x, ex);
        const y = Math.min(slot.dragStart.y, ey);
        const w = Math.abs(ex - slot.dragStart.x);
        const h = Math.abs(ey - slot.dragStart.y);

        slot.crop = ensureBounds({ x, y, w, h }, slot.bitmap.width, slot.bitmap.height);
        drawSource(slot);
        drawCropPreview(slot);
    });

    window.addEventListener('mouseup', () => {
        slot.dragging = false;
        slot.dragStart = null;
    });
}

function resetSlotCrop(slot) {
    if (!slot.bitmap) {
        return;
    }

    slot.crop = { x: 0, y: 0, w: slot.bitmap.width, h: slot.bitmap.height };
    drawSource(slot);
    drawCropPreview(slot);
}

function cropToCanvas(slot, upscale = 2) {
    const crop = slot.crop;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(crop.w * upscale));
    c.height = Math.max(1, Math.round(crop.h * upscale));
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(slot.bitmap, crop.x, crop.y, crop.w, crop.h, 0, 0, c.width, c.height);
    return c;
}

function toBinary(canvas, threshold = 165) {
    const ctx = canvas.getContext('2d');
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const out = new Uint8Array(canvas.width * canvas.height);

    for (let i = 0, p = 0; i < img.data.length; i += 4, p += 1) {
        const gray = 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
        out[p] = gray < threshold ? 1 : 0;
    }

    return { data: out, width: canvas.width, height: canvas.height };
}

function cropBinary(binary, box) {
    const { x, y, w, h } = box;
    const out = new Uint8Array(w * h);
    for (let yy = 0; yy < h; yy += 1) {
        for (let xx = 0; xx < w; xx += 1) {
            out[yy * w + xx] = binary.data[(y + yy) * binary.width + (x + xx)];
        }
    }

    return { data: out, width: w, height: h };
}

function splitMatrixCells(binary, n) {
    const cells = [];
    const cellW = Math.floor(binary.width / n);
    const cellH = Math.floor(binary.height / n);
    const padX = Math.floor(cellW * 0.08);
    const padY = Math.floor(cellH * 0.08);

    for (let r = 0; r < n; r += 1) {
        const row = [];
        for (let c = 0; c < n; c += 1) {
            const x0 = c * cellW + padX;
            const y0 = r * cellH + padY;
            const x1 = Math.min((c + 1) * cellW - padX, binary.width);
            const y1 = Math.min((r + 1) * cellH - padY, binary.height);
            row.push(cropBinary(binary, { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) }));
        }
        cells.push(row);
    }

    return cells;
}

function computeSymmetry(binary, mode) {
    let same = 0;
    let total = 0;
    const { width, height, data } = binary;

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            let x2 = x;
            let y2 = y;
            if (mode === 'v') {
                x2 = width - 1 - x;
            } else if (mode === 'h') {
                y2 = height - 1 - y;
            } else if (mode === 'd1') {
                x2 = Math.floor((y / height) * width);
                y2 = Math.floor((x / width) * height);
            } else if (mode === 'd2') {
                x2 = width - 1 - Math.floor((y / height) * width);
                y2 = height - 1 - Math.floor((x / width) * height);
            }

            const v1 = data[y * width + x];
            const v2 = data[Math.max(0, Math.min(height - 1, y2)) * width + Math.max(0, Math.min(width - 1, x2))];
            if (v1 === v2) {
                same += 1;
            }
            total += 1;
        }
    }

    return total ? same / total : 0;
}

function computeConnectedComponents(binary) {
    const { width, height, data } = binary;
    const seen = new Uint8Array(width * height);
    const boxes = [];

    function idx(x, y) {
        return y * width + x;
    }

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const start = idx(x, y);
            if (seen[start] || data[start] === 0) {
                continue;
            }

            let minX = x;
            let maxX = x;
            let minY = y;
            let maxY = y;
            let area = 0;

            const q = [[x, y]];
            seen[start] = 1;

            while (q.length) {
                const [cx, cy] = q.pop();
                area += 1;
                minX = Math.min(minX, cx);
                maxX = Math.max(maxX, cx);
                minY = Math.min(minY, cy);
                maxY = Math.max(maxY, cy);

                for (let dy = -1; dy <= 1; dy += 1) {
                    for (let dx = -1; dx <= 1; dx += 1) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = cx + dx;
                        const ny = cy + dy;
                        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                        const ni = idx(nx, ny);
                        if (!seen[ni] && data[ni] === 1) {
                            seen[ni] = 1;
                            q.push([nx, ny]);
                        }
                    }
                }
            }

            boxes.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, area });
        }
    }

    return boxes;
}

function computeFeatures(binary) {
    const { width, height, data } = binary;
    const total = width * height;

    let count = 0;
    let sx = 0;
    let sy = 0;
    let edges = 0;

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const v = data[y * width + x];
            if (!v) continue;
            count += 1;
            sx += x;
            sy += y;

            const right = x + 1 < width ? data[y * width + x + 1] : 0;
            const down = y + 1 < height ? data[(y + 1) * width + x] : 0;
            if (right === 0 || down === 0) {
                edges += 1;
            }
        }
    }

    const ink = total ? count / total : 0;
    const cx = count ? sx / count / width : 0.5;
    const cy = count ? sy / count / height : 0.5;

    let mu20 = 0;
    let mu02 = 0;
    let mu11 = 0;

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const v = data[y * width + x];
            if (!v) continue;
            const dx = x / width - cx;
            const dy = y / height - cy;
            mu20 += dx * dx;
            mu02 += dy * dy;
            mu11 += dx * dy;
        }
    }

    const theta = 0.5 * Math.atan2(2 * mu11, mu20 - mu02 || 1e-9);

    const components = computeConnectedComponents(binary).filter((b) => b.area > 4);
    const componentDensity = components.length / 20;

    const largest = components.sort((a, b) => b.area - a.area)[0];
    const compactness = largest ? largest.area / Math.max(1, largest.w * largest.h) : 0;

    return [
        ink,
        edges / Math.max(1, count),
        cx,
        cy,
        computeSymmetry(binary, 'v'),
        computeSymmetry(binary, 'h'),
        computeSymmetry(binary, 'd1'),
        computeSymmetry(binary, 'd2'),
        (Math.sin(theta) + 1) / 2,
        (Math.cos(theta) + 1) / 2,
        Math.min(1, componentDensity),
        compactness,
    ];
}

function vectorAdd(a, b) {
    return a.map((v, i) => v + b[i]);
}

function vectorSub(a, b) {
    return a.map((v, i) => v - b[i]);
}

function vectorScale(a, s) {
    return a.map((v) => v * s);
}

function vectorAbsSum(a) {
    return a.reduce((acc, v) => acc + Math.abs(v), 0);
}

function smoothnessCost(sequence) {
    let cost = 0;
    for (let i = 1; i < sequence.length - 1; i += 1) {
        const second = vectorAdd(sequence[i + 1], vectorAdd(vectorScale(sequence[i], -2), sequence[i - 1]));
        cost += vectorAbsSum(second);
    }
    return cost;
}

function inferByVisualPattern(matrixFeatures, optionFeatures, n, log) {
    if (!optionFeatures.length) {
        return null;
    }

    let best = null;

    optionFeatures.forEach((option) => {
        const grid = matrixFeatures.map((row) => row.slice());
        grid[n - 1][n - 1] = option.features;

        let cost = 0;

        for (let r = 0; r < n; r += 1) {
            cost += smoothnessCost(grid[r]);
        }

        for (let c = 0; c < n; c += 1) {
            const col = [];
            for (let r = 0; r < n; r += 1) {
                col.push(grid[r][c]);
            }
            cost += smoothnessCost(col);
        }

        cost += vectorAbsSum(vectorSub(grid[n - 1][n - 1], grid[n - 1][n - 2])) * 0.2;
        cost += vectorAbsSum(vectorSub(grid[n - 1][n - 1], grid[n - 2][n - 1])) * 0.2;

        if (!best || cost < best.score) {
            best = { ...option, score: cost };
        }
    });

    if (best) {
        log.push(`Visuell kandidat vald: ${best.label} med score ${best.score.toFixed(4)}.`);
    }

    return best;
}

function detectOptionCandidates(binary) {
    const boxes = computeConnectedComponents(binary)
        .filter((b) => b.area > (binary.width * binary.height) * 0.0008)
        .sort((a, b) => a.y - b.y);

    if (!boxes.length) {
        return [];
    }

    const rows = [];
    const tolerance = Math.max(12, Math.round(binary.height * 0.04));

    boxes.forEach((box) => {
        const cy = box.y + box.h / 2;
        let target = null;
        for (const row of rows) {
            if (Math.abs(row.cy - cy) <= tolerance) {
                target = row;
                break;
            }
        }

        if (!target) {
            target = { cy, boxes: [] };
            rows.push(target);
        }

        target.boxes.push(box);
        target.cy = (target.cy * (target.boxes.length - 1) + cy) / target.boxes.length;
    });

    return rows
        .map((row) => {
            const x = Math.min(...row.boxes.map((b) => b.x));
            const y = Math.min(...row.boxes.map((b) => b.y));
            const x2 = Math.max(...row.boxes.map((b) => b.x + b.w));
            const y2 = Math.max(...row.boxes.map((b) => b.y + b.h));
            return { x, y, w: x2 - x, h: y2 - y };
        })
        .filter((b) => b.w > binary.width * 0.08 && b.h > 8)
        .sort((a, b) => a.y - b.y)
        .slice(0, 12);
}

function buildVisualOptions(optionBinary) {
    const boxes = detectOptionCandidates(optionBinary);
    const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

    return boxes.map((box, i) => {
        const pad = 6;
        const x = Math.max(0, box.x - pad);
        const y = Math.max(0, box.y - pad);
        const w = Math.min(optionBinary.width - x, box.w + pad * 2);
        const h = Math.min(optionBinary.height - y, box.h + pad * 2);
        const cropped = cropBinary(optionBinary, { x, y, w, h });
        return {
            label: labels[i] || String(i + 1),
            value: 'Bildalternativ',
            features: computeFeatures(cropped),
            box,
        };
    });
}

function sanitizeLines(text) {
    return text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
}

function extractMatrixNumbers(text, size) {
    const lines = sanitizeLines(text);
    const rows = [];

    for (const line of lines) {
        const nums = line.match(/-?\d+(?:[.,]\d+)?/g);
        if (nums && nums.length >= size) {
            rows.push(nums.slice(0, size).map((n) => Number(n.replace(',', '.'))));
        }
    }

    if (rows.length < size) {
        return null;
    }

    return rows.slice(0, size);
}

function extractOptionsFromText(text) {
    const lines = sanitizeLines(text);
    const options = [];
    const optionRegex = /^\s*([A-Ha-h1-9])[\)\].: -]+(.+)$/;

    for (const line of lines) {
        const clean = line.replace(/\s+/g, ' ');
        const match = clean.match(optionRegex);
        if (!match) {
            continue;
        }

        const label = match[1].toUpperCase();
        const value = normalizeText(match[2]);
        const valueNum = Number(value.replace(',', '.'));
        options.push({
            label,
            value,
            valueNumber: Number.isFinite(valueNum) ? valueNum : null,
        });
    }

    const unique = new Map();
    options.forEach((o) => {
        if (!unique.has(o.label)) {
            unique.set(o.label, o);
        }
    });

    return [...unique.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function inferExpectedValue(matrix, size, log) {
    if (!matrix || matrix.length !== size) {
        log.push(`Kunde inte extrahera ${size}x${size}-matris numeriskt.`);
        return null;
    }

    const candidates = [];

    const rowPatternCandidates = [];
    for (let r = 0; r < size - 1; r += 1) {
        const row = matrix[r];
        const delta = row[1] - row[0];
        let consistent = true;
        for (let c = 2; c < size; c += 1) {
            if (row[c] - row[c - 1] !== delta) {
                consistent = false;
                break;
            }
        }
        if (consistent) rowPatternCandidates.push(delta);
    }

    if (rowPatternCandidates.length === size - 1) {
        const lastRow = matrix[size - 1];
        candidates.push({ value: lastRow[0] + rowPatternCandidates[0] * (size - 1), weight: 3, reason: 'radvis differens' });
    }

    const colDeltas = [];
    for (let c = 0; c < size; c += 1) {
        const delta = matrix[1][c] - matrix[0][c];
        let consistent = true;
        for (let r = 2; r < size; r += 1) {
            if (matrix[r][c] - matrix[r - 1][c] !== delta) {
                consistent = false;
                break;
            }
        }
        if (consistent) colDeltas.push(delta);
    }

    if (colDeltas.length >= size) {
        candidates.push({ value: matrix[size - 2][size - 1] + colDeltas[size - 1], weight: 3, reason: 'kolumnvis differens' });
    }

    if (!candidates.length) {
        return null;
    }

    const score = new Map();
    candidates.forEach((c) => {
        const key = Number(c.value.toFixed(4));
        const old = score.get(key) || { score: 0, reasons: [] };
        old.score += c.weight;
        old.reasons.push(c.reason);
        score.set(key, old);
    });

    const ranked = [...score.entries()].map(([value, d]) => ({ value, ...d })).sort((a, b) => b.score - a.score);
    ranked.forEach((r) => log.push(`Numerisk kandidat ${r.value} (score ${r.score}): ${r.reasons.join(', ')}`));
    return ranked[0]?.value ?? null;
}

function chooseFromNumericOptions(options, expectedValue, log) {
    if (!options.length || expectedValue === null) {
        return null;
    }

    const numeric = options.filter((o) => o.valueNumber !== null);
    if (!numeric.length) {
        return null;
    }

    let best = null;
    numeric.forEach((opt) => {
        const dist = Math.abs(opt.valueNumber - expectedValue);
        if (!best || dist < best.dist) {
            best = { ...opt, dist };
        }
    });

    if (best) {
        log.push(`OCR/numerisk kandidat: ${best.label}:${best.value} (dist ${best.dist.toFixed(4)}).`);
    }

    return best;
}

async function runOCR(canvas, statusPrefix) {
    const result = await Tesseract.recognize(canvas, 'eng+equ', {
        logger: ({ status, progress }) => {
            if (status === 'recognizing text') {
                ui.setStatus(`${statusPrefix} OCR ${Math.round(progress * 100)}%`, 'running');
            }
        },
    });

    return result.data.text || '';
}

function extractMatrixFeatureGrid(matrixBinary, matrixSize) {
    const cells = splitMatrixCells(matrixBinary, matrixSize);
    return cells.map((row) => row.map((cell) => computeFeatures(cell)));
}

async function solve() {
    const matrixSize = Number(matrixSizeEl.value);
    const log = [];

    if (!imageState.matrix.bitmap || !imageState.options.bitmap) {
        ui.setStatus('Klistra in både matrisbild och svarsalternativ först.', 'error');
        return;
    }

    ui.setStatus('Förbereder crop, förstärker pixlar och kör analys…', 'running');
    const matrixCanvas = cropToCanvas(imageState.matrix, 2);
    const optionsCanvas = cropToCanvas(imageState.options, 2);
    applyClarityFilter(matrixCanvas);
    applyClarityFilter(optionsCanvas);

    const matrixBinary = toBinary(matrixCanvas, 165);
    const optionsBinary = toBinary(optionsCanvas, 165);

    const matrixFeatureGrid = extractMatrixFeatureGrid(matrixBinary, matrixSize);
    const visualOptions = buildVisualOptions(optionsBinary);
    log.push(`Visuella alternativ upptäckta: ${visualOptions.length}`);

    const visualChoice = inferByVisualPattern(matrixFeatureGrid, visualOptions, matrixSize, log);

    const matrixText = await runOCR(matrixCanvas, 'Steg 1');
    const optionsText = await runOCR(optionsCanvas, 'Steg 2');
    matrixOcrTextEl.textContent = matrixText.trim() || '(Ingen text i steg 1)';
    optionsOcrTextEl.textContent = optionsText.trim() || '(Ingen text i steg 2)';

    const numericMatrix = extractMatrixNumbers(matrixText, matrixSize);
    const numericOptions = extractOptionsFromText(optionsText);
    log.push(`Textuella alternativ upptäckta: ${numericOptions.length}`);
    const expectedNum = inferExpectedValue(numericMatrix, matrixSize, log);
    const numericChoice = chooseFromNumericOptions(numericOptions, expectedNum, log);

    let final = null;

    if (visualChoice && numericChoice) {
        final = {
            label: visualChoice.label,
            value: numericChoice.value || visualChoice.value,
            score: visualChoice.score,
        };
        log.push('Hybridläge: visuell struktur + OCR-värde kombinerades.');
    } else if (visualChoice) {
        final = { ...visualChoice, value: visualChoice.value || 'Bildalternativ' };
        log.push('Valde svar via visuell matrisanalys.');
    } else if (numericChoice) {
        final = { ...numericChoice, score: numericChoice.dist ?? 0 };
        log.push('Valde svar via OCR/numerisk analys.');
    }

    const shownOptions = visualOptions.length ? visualOptions : numericOptions;
    ui.setOptions(shownOptions.map((o) => ({ ...o, score: o.score })));

    if (!final) {
        ui.setAnswer('Ingen säker match bland svarsalternativen.', false);
        ui.setStatus('Analys klar (ingen säker lösning).', 'done');
    } else {
        ui.setAnswer(`${final.label}: ${final.value}`, true);
        ui.setStatus('Analys klar. Svar valt från steg 2-alternativen.', 'done');
    }

    analysisLogEl.textContent = log.join('\n');
}

function resetAll() {
    imageState.matrix.bitmap = null;
    imageState.options.bitmap = null;
    imageState.matrix.crop = null;
    imageState.options.crop = null;

    [matrixSourceCanvas, optionsSourceCanvas, matrixPreviewCanvas, optionsPreviewCanvas].forEach((c) => {
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, c.width, c.height);
        c.width = 300;
        c.height = 80;
    });

    matrixCropInfo.textContent = 'Crop: full bild';
    optionsCropInfo.textContent = 'Crop: full bild';
    matrixOcrTextEl.textContent = '';
    optionsOcrTextEl.textContent = '';
    analysisLogEl.textContent = '';
    optionsList.innerHTML = '';
    ui.setAnswer('Inget svar ännu', false);
    ui.setStatus('Väntar på inklistrade bilder…', 'idle');
    matrixPasteZone.classList.remove('active');
    optionsPasteZone.classList.remove('active');
}

function bindPaste(zoneEl, slot, zoneName) {
    zoneEl.addEventListener('click', () => zoneEl.focus());

    zoneEl.addEventListener('paste', async (event) => {
        event.preventDefault();
        const file = extractImageFromPaste(event);
        if (!file) {
            ui.setStatus(`Ingen bild hittades i urklipp för ${zoneName}.`, 'error');
            return;
        }

        await setSlotImage(slot, file);
        zoneEl.classList.add('active');
        ui.setStatus(`${zoneName} inklistrad. Dra i bilden för exakt crop av hela området.`, 'idle');
    });
}

bindPaste(matrixPasteZone, imageState.matrix, 'Steg 1');
bindPaste(optionsPasteZone, imageState.options, 'Steg 2');
bindCropMouse(imageState.matrix);
bindCropMouse(imageState.options);

matrixResetCropBtn.addEventListener('click', () => resetSlotCrop(imageState.matrix));
optionsResetCropBtn.addEventListener('click', () => resetSlotCrop(imageState.options));

solveBtn.addEventListener('click', async () => {
    solveBtn.disabled = true;
    resetBtn.disabled = true;

    try {
        await solve();
    } catch (error) {
        console.error(error);
        ui.setStatus('Fel under OCR/analys.', 'error');
        analysisLogEl.textContent = `${analysisLogEl.textContent}\nFel: ${error.message}`.trim();
    } finally {
        solveBtn.disabled = false;
        resetBtn.disabled = false;
    }
});

resetBtn.addEventListener('click', resetAll);

resetAll();
