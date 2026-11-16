// Reading receipt photos on the phone (no internet service needed after the reader is downloaded).
//
// Steps:
//   1. Flatten the lighting: divide the photo by a blurred copy of itself, so shadows and uneven light vanish.
//   2. Keep only dark ink: thermal print is near-black, while the faint print showing through from the back
//      of the paper and the countertop texture are lighter, so they drop out.
//   3. Read the text twice with two ink settings, and drop words the reader itself was unsure of.
// The parser then keeps the best reading of each item (see parseReceiptReadings in receipt.js).

const TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let loading = null;
function loadReader() {
  if (window.Tesseract) return Promise.resolve();
  if (!loading) loading = new Promise((ok, bad) => {
    const s = document.createElement('script'); s.src = TESSERACT; s.onload = ok;
    s.onerror = () => { loading = null; bad(new Error('Could not load the text reader. Check your internet connection.')); };
    document.head.appendChild(s);
  });
  return loading;
}

async function loadImage(src) {
  const url = src instanceof Blob ? URL.createObjectURL(src) : src;
  try {
    return await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('That photo could not be opened. Try taking it again.')); i.src = url; });
  } finally { if (src instanceof Blob) setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

/**
 * Estimate the paper's brightness everywhere in the photo, in plain JavaScript so every browser gives the
 * same result (Safari ignores canvas blur filters and shrinks images roughly, which ruined this step on iPhones).
 * gray: brightness per pixel. Returns a function bg(x, y).
 */
function paperBrightness(gray, W, H) {
  const T = globalThis.__ocrTune || {};
  const cell = T.cell || Math.max(10, Math.round(Math.max(W, H) / (T.cellDiv || 168)));
  const cols = Math.ceil(W / cell), rows = Math.ceil(H / cell);
  // 1. Brightness of each cell: the 95th percentile (the paper), so dark text inside a cell does not pull it down.
  const level = new Float32Array(cols * rows), hist = new Uint32Array(256);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    hist.fill(0);
    const x0 = c * cell, y0 = r * cell, x1 = Math.min(W, x0 + cell), y1 = Math.min(H, y0 + cell);
    let n = 0;
    for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { hist[gray[y * W + x]]++; n++; }
    let acc = 0, v = 255;
    if (T.mean) { let sum = 0; for (let i = 0; i < 256; i++) sum += hist[i] * i; v = sum / Math.max(1, n); }
    else for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= n * (T.pct || 0.95)) { v = i; break; } }
    level[r * cols + c] = v;
  }
  // 2. Take the brightest neighbour (cells full of text borrow the paper level next to them), then smooth twice.
  const pass = (srcA, fn) => {
    const out = new Float32Array(srcA.length);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const vals = [];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) vals.push(srcA[rr * cols + cc]); }
      out[r * cols + c] = fn(vals);
    }
    return out;
  };
  const avg = (v) => v.reduce((a, b) => a + b, 0) / v.length;
  let bg = T.mean ? level : pass(level, (v) => Math.max(...v));
  bg = pass(pass(bg, avg), avg);
  if (T.mean) bg = pass(pass(bg, avg), avg);
  // 3. Smooth (bilinear) lookup between cell centres.
  return (x, y) => {
    const fx = Math.min(cols - 1, Math.max(0, x / cell - 0.5)), fy = Math.min(rows - 1, Math.max(0, y / cell - 0.5));
    const c0 = Math.floor(fx), r0 = Math.floor(fy), c1 = Math.min(cols - 1, c0 + 1), r1 = Math.min(rows - 1, r0 + 1), tx = fx - c0, ty = fy - r0;
    const top = bg[r0 * cols + c0] * (1 - tx) + bg[r0 * cols + c1] * tx, bot = bg[r1 * cols + c0] * (1 - tx) + bg[r1 * cols + c1] * tx;
    return top * (1 - ty) + bot * ty;
  };
}

/** Flattened, ink-only black-and-white versions of a photo, one per threshold. */
export async function cleanPhoto(src, { maxSide = 3000, thresholds = [150, 120], invert = false, both = 0 } = {}) {
  const img = await loadImage(src);
  const k = Math.min(maxSide / Math.max(img.width, img.height), 2);
  const W = Math.round(img.width * k), H = Math.round(img.height * k);
  const base = document.createElement('canvas'); base.width = W; base.height = H;
  const g = base.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, W, H);
  const px = g.getImageData(0, 0, W, H).data;
  base.width = base.height = 0; // free the memory right away (iPhones have a small canvas memory budget)
  const gray = new Uint8ClampedArray(W * H);
  for (let i = 0, p = 0; p < gray.length; i += 4, p++) gray[p] = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
  const bgAt = paperBrightness(invert ? gray.map((v) => 255 - v) : gray, W, H);
  // Brightness relative to the paper around it: paper -> 255, ink -> dark.
  const norm = new Uint8ClampedArray(W * H);
  for (let y = 0, p = 0; y < H; y++) for (let x = 0; x < W; x++, p++) {
    const v = invert ? 255 - gray[p] : gray[p], b = bgAt(x, y) || 1;
    norm[p] = both ? 255 - Math.min(255, Math.abs(v - b) * (255 / both) * 0.5) : Math.min(255, (v / b) * 255);
  }
  const make = (test) => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const cg = c.getContext('2d'), out = cg.createImageData(W, H), d = out.data;
    for (let p = 0, i = 0; p < norm.length; p++, i += 4) { const o = test(norm[p]) ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = o; d[i + 3] = 255; }
    cg.putImageData(out, 0, 0);
    return c;
  };
  // Labels: text can be darker OR lighter than the label behind it; both count as ink.
  if (both) return [make((v) => v < 128)];
  return thresholds.map((t) => make((v) => v < t));
}

/** Lines of text from a reading, leaving out words the reader had very low confidence in. */
function linesOf(data, minConf = 20) {
  return (data.lines || []).map((l) => (l.words || []).filter((w) => w.confidence >= minConf || /\d[.,]\d{2}/.test(w.text)).map((w) => w.text).join(' ').trim()).filter(Boolean);
}

// Three readings that make different mistakes; the parser keeps the best version of each item.
// psm 6 reads the receipt as one block, so each name stays on the same line as its price.
const PASSES = [{ maxSide: 4000, threshold: 140, psm: '6' }, { maxSide: 3000, threshold: 155, psm: '6' }, { maxSide: 3000, threshold: 175, psm: '4' }];

/**
 * Read a receipt photo. Returns several readings, each an array of text lines.
 * onProgress(percent) is called while reading.
 */
export async function readReceiptPhoto(file, onProgress = () => {}) {
  await loadReader();
  let done = 0;
  const worker = await window.Tesseract.createWorker('eng', 1, {
    logger: (m) => { if (m.status === 'recognizing text') onProgress(Math.round(((done + m.progress) / PASSES.length) * 100)); },
  });
  try {
    const readings = [];
    for (const pass of PASSES) {
      const [page] = await cleanPhoto(file, { maxSide: pass.maxSide, thresholds: [pass.threshold] });
      await worker.setParameters({ tessedit_pageseg_mode: pass.psm, preserve_interword_spaces: '1' });
      const { data } = await worker.recognize(page);
      readings.push(linesOf(data, 15));
      done++;
    }
    return readings;
  } finally { worker.terminate(); }
}

/**
 * Read the words on a product label. Labels mix dark text and light text on colored backgrounds, so the photo is
 * read four ways. Returns one list of { text, h } per reading (h = letter height in pixels, bigger = more prominent).
 */
export async function readLabel(src) {
  await loadReader();
  const worker = await window.Tesseract.createWorker('eng', 1);
  try {
    await worker.setParameters({ tessedit_pageseg_mode: '11' }); // sparse text: labels are not neat paragraphs
    const readings = [];
    // Several sizes, because the reader works best when letters are a certain size and we do not know how big the label is.
    for (const opts of [{ maxSide: 1200, both: 35 }, { maxSide: 1600, both: 35 }, { maxSide: 2400, both: 35 }, { maxSide: 1600, thresholds: [170] }]) {
      const [page] = await cleanPhoto(src, opts);
      const { data } = await worker.recognize(page);
      const words = [];
      for (const line of data.lines || []) for (const w of line.words || []) {
        if (w.confidence >= 30 && /[A-Za-z]{2,}/.test(w.text)) words.push({ text: w.text, h: (w.bbox.y1 - w.bbox.y0) * (1600 / opts.maxSide) });
      }
      readings.push(words);
    }
    return readings;
  } finally { worker.terminate(); }
}
