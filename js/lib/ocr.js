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

/** Flattened, ink-only black-and-white versions of a photo, one per threshold. */
export async function cleanPhoto(src, { maxSide = 3000, thresholds = [150, 120], invert = false, both = 0 } = {}) {
  const img = await loadImage(src);
  const k = Math.min(maxSide / Math.max(img.width, img.height), 2);
  const W = Math.round(img.width * k), H = Math.round(img.height * k);
  const base = document.createElement('canvas'); base.width = W; base.height = H;
  const g = base.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, W, H);
  // Background: shrink a lot, blur, stretch back up.
  const small = document.createElement('canvas'); small.width = Math.max(8, Math.round(W / 24)); small.height = Math.max(8, Math.round(H / 24));
  const sg = small.getContext('2d'); sg.filter = 'blur(2px)'; sg.drawImage(base, 0, 0, small.width, small.height);
  const bgc = document.createElement('canvas'); bgc.width = W; bgc.height = H;
  const bgg = bgc.getContext('2d', { willReadFrequently: true }); bgg.imageSmoothingQuality = 'high'; bgg.drawImage(small, 0, 0, W, H);
  const src8 = g.getImageData(0, 0, W, H).data, bg = bgg.getImageData(0, 0, W, H).data;
  const norm = new Uint8ClampedArray(W * H);
  if (both) {
    // Labels: text can be darker OR lighter than the label behind it. Mark anything that differs
    // from its surroundings by more than `both` levels as ink, so both kinds come out black on white.
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const cg = c.getContext('2d'), out = cg.createImageData(W, H), d = out.data;
    for (let i = 0; i < src8.length; i += 4) {
      const v = src8[i] * 0.299 + src8[i + 1] * 0.587 + src8[i + 2] * 0.114, b = bg[i] * 0.299 + bg[i + 1] * 0.587 + bg[i + 2] * 0.114;
      const o = Math.abs(v - b) > both ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = o; d[i + 3] = 255;
    }
    cg.putImageData(out, 0, 0);
    return [c];
  }
  for (let i = 0, p = 0; i < src8.length; i += 4, p++) {
    let v = src8[i] * 0.299 + src8[i + 1] * 0.587 + src8[i + 2] * 0.114;
    let b = bg[i] * 0.299 + bg[i + 1] * 0.587 + bg[i + 2] * 0.114;
    if (invert) { v = 255 - v; b = 255 - b; }   // light text on a dark label becomes dark text on light
    b = b || 1;
    norm[p] = Math.min(255, (v / b) * 255);
  }
  return thresholds.map((t) => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const cg = c.getContext('2d');
    const out = cg.createImageData(W, H), d = out.data;
    for (let p = 0, i = 0; p < norm.length; p++, i += 4) { const o = norm[p] < t ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = o; d[i + 3] = 255; }
    cg.putImageData(out, 0, 0);
    return c;
  });
}

/** Lines of text from a reading, leaving out words the reader had very low confidence in. */
function linesOf(data, minConf = 20) {
  return (data.lines || []).map((l) => (l.words || []).filter((w) => w.confidence >= minConf || /\d[.,]\d{2}/.test(w.text)).map((w) => w.text).join(' ').trim()).filter(Boolean);
}

// Three readings that make different mistakes; the parser keeps the best version of each item.
// psm 6 reads the receipt as one block, so each name stays on the same line as its price.
const PASSES = [{ maxSide: 4000, threshold: 160, psm: '6' }, { maxSide: 3000, threshold: 160, psm: '6' }, { maxSide: 3000, threshold: 180, psm: '4' }];

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
