// ============================================================
// Minimal QR encoder — byte mode, error correction level M,
// versions 1 through 10 (enough for any sane join URL).
//
// Vendored rather than pulled from a CDN on purpose: the projector
// laptop at a youth group is exactly the machine whose wifi will be
// flaky, and a join screen with no QR code on it is a dead session.
// This file has no dependencies and works from file://.
//
// Verified two ways (see "Verifying the QR encoder" in ../../README.md):
//   - every output decodes back to the exact input string through the
//     zxing-cpp decoder, versions 1 to 10;
//   - each matrix is byte-identical to the `segno` reference encoder when
//     both are pinned to the same mask. We pick our own mask by the
//     spec's penalty rules, so the chosen mask sometimes differs from
//     segno's; any of the eight is valid and scanners handle all of them.
// ============================================================

// ---------- GF(256), generator polynomial 0x11d ----------
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function initTables() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const mul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

/** Reed-Solomon generator polynomial of the given degree. */
function rsGenerator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

/** EC codewords for one data block. */
function rsEncode(data, ecCount) {
  const gen = rsGenerator(ecCount);
  const res = new Uint8Array(data.length + ecCount);
  res.set(data);
  for (let i = 0; i < data.length; i++) {
    const factor = res[i];
    if (factor === 0) continue;
    for (let j = 0; j < gen.length; j++) {
      res[i + j] ^= mul(gen[j], factor);
    }
  }
  return res.slice(data.length);
}

// ---------- version tables, error correction level M ----------
// [ total codewords, ec codewords per block, [blocks, data per block], ...groups ]
const VERSIONS = {
  1:  { total: 26,  ec: 10, groups: [[1, 16]] },
  2:  { total: 44,  ec: 16, groups: [[1, 28]] },
  3:  { total: 70,  ec: 26, groups: [[1, 44]] },
  4:  { total: 100, ec: 18, groups: [[2, 32]] },
  5:  { total: 134, ec: 24, groups: [[2, 43]] },
  6:  { total: 172, ec: 16, groups: [[4, 27]] },
  7:  { total: 196, ec: 18, groups: [[4, 31]] },
  8:  { total: 242, ec: 22, groups: [[2, 38], [2, 39]] },
  9:  { total: 292, ec: 22, groups: [[3, 36], [2, 37]] },
  10: { total: 346, ec: 26, groups: [[4, 43], [1, 44]] },
};

const ALIGNMENT = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

const dataCapacity = (v) =>
  VERSIONS[v].groups.reduce((sum, [blocks, per]) => sum + blocks * per, 0);

// ---------- bit buffer ----------
class Bits {
  constructor() { this.bytes = []; this.length = 0; }
  push(value, width) {
    for (let i = width - 1; i >= 0; i--) {
      const bit = (value >>> i) & 1;
      const bytePos = this.length >>> 3;
      if (this.bytes.length <= bytePos) this.bytes.push(0);
      if (bit) this.bytes[bytePos] |= 0x80 >>> (this.length & 7);
      this.length++;
    }
  }
}

// ---------- BCH for format and version information ----------
function bch(value, generator, genBits) {
  let v = value << (genBits - 1);
  const genLen = 32 - Math.clz32(generator);
  while (32 - Math.clz32(v) >= genLen) {
    v ^= generator << ((32 - Math.clz32(v)) - genLen);
  }
  return (value << (genBits - 1)) | v;
}

const formatBits = (mask) => bch((0 /* level M */ << 3) | mask, 0x537, 11) ^ 0x5412;
const versionBits = (version) => bch(version, 0x1f25, 13);

// ---------- matrix construction ----------
function buildMatrix(version, codewords, mask) {
  const size = version * 4 + 17;
  const m = Array.from({ length: size }, () => new Int8Array(size).fill(-1));

  const setFinder = (r, c) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        const edge = dr === -1 || dr === 7 || dc === -1 || dc === 7;
        const inner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        const ring = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        m[rr][cc] = edge ? 0 : (inner || ring) ? 1 : 0;
      }
    }
  };
  setFinder(0, 0);
  setFinder(0, size - 7);
  setFinder(size - 7, 0);

  // timing patterns
  for (let i = 8; i < size - 8; i++) {
    const bit = i % 2 === 0 ? 1 : 0;
    if (m[6][i] === -1) m[6][i] = bit;
    if (m[i][6] === -1) m[i][6] = bit;
  }

  // Alignment patterns.
  //
  // Skip only the three centres that collide with a finder pattern. Do NOT
  // skip on "this cell is already filled": the centres at (6, n) and (n, 6)
  // sit ON the timing pattern and are supposed to overwrite part of it. An
  // occupancy test silently drops those two, which still scans at small
  // versions and then fails at larger ones.
  const centers = ALIGNMENT[version];
  const last = size - 7;
  for (const r of centers) {
    for (const c of centers) {
      const onFinder = (r === 6 && c === 6) || (r === 6 && c === last) || (r === last && c === 6);
      if (onFinder) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const ring = Math.max(Math.abs(dr), Math.abs(dc));
          m[r + dr][c + dc] = (ring === 1) ? 0 : 1;
        }
      }
    }
  }

  // Reserve the format-information cells.
  //
  // The two copies are not the same shape, and getting this wrong is the
  // classic way to produce a QR code that looks right and scans as garbage:
  //   copy 1  row 8 cols 0-8, and col 8 rows 0-8            (15 cells)
  //   copy 2  col 8 rows size-1..size-7  (bits 0-6, SEVEN cells),
  //           row 8 cols size-8..size-1  (bits 7-14, EIGHT cells),
  //           plus the always-dark module at (size-8, 8)
  // The two runs are different lengths, which is the easy thing to get
  // wrong: an off-by-one here yields a code that looks perfect and scans
  // as garbage, because every later data bit shifts by one module.
  const reserve = (r, c) => { if (m[r][c] === -1) m[r][c] = -2; };
  for (let i = 0; i < 9; i++) { reserve(8, i); reserve(i, 8); }
  for (let i = 0; i < 8; i++) { reserve(8, size - 1 - i); reserve(size - 1 - i, 8); }
  m[size - 8][8] = 1;

  // version information block, versions 7 and up
  if (version >= 7) {
    const vb = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = (vb >>> i) & 1;
      m[size - 11 + (i % 3)][Math.floor(i / 3)] = bit;
      m[Math.floor(i / 3)][size - 11 + (i % 3)] = bit;
    }
  }

  // data, in the two-column upward/downward zigzag from the right edge
  let bitIndex = 0;
  const totalBits = codewords.length * 8;
  const nextBit = () => {
    if (bitIndex >= totalBits) return 0;   // remainder bits are 0
    const bit = (codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1;
    bitIndex++;
    return bit;
  };

  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;   // the vertical timing pattern is not a data column
    for (let i = 0; i < size; i++) {
      const row = upward ? size - 1 - i : i;
      for (const c of [col, col - 1]) {
        if (m[row][c] !== -1) continue;
        let bit = nextBit();
        if (maskAt(mask, row, c)) bit ^= 1;
        m[row][c] = bit;
      }
    }
    upward = !upward;
  }

  // format information, written last, into the reserved cells
  const fb = formatBits(mask);
  for (let i = 0; i < 15; i++) {
    const bit = (fb >>> (14 - i)) & 1;
    // top-left, skipping the timing row/column at index 6
    if (i < 6)       m[8][i] = bit;
    else if (i === 6) m[8][7] = bit;
    else if (i === 7) m[8][8] = bit;
    else if (i === 8) m[7][8] = bit;
    else              m[14 - i][8] = bit;
    // the duplicate copy: seven cells up the bottom-left column, then
    // eight along the top-right row
    if (i < 7) m[size - 1 - i][8] = bit;
    else       m[8][size - 15 + i] = bit;
  }
  m[size - 8][8] = 1;   // dark module, never a format cell

  return m;
}

function maskAt(mask, i, j) {
  switch (mask) {
    case 0: return (i + j) % 2 === 0;
    case 1: return i % 2 === 0;
    case 2: return j % 3 === 0;
    case 3: return (i + j) % 3 === 0;
    case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
    case 5: return ((i * j) % 2) + ((i * j) % 3) === 0;
    case 6: return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0;
    case 7: return (((i + j) % 2) + ((i * j) % 3)) % 2 === 0;
    default: return false;
  }
}

// ---------- mask penalty scoring ----------
function penalty(m) {
  const size = m.length;
  let score = 0;

  // rule 1 — runs of five or more
  const runScore = (get) => {
    let total = 0;
    for (let a = 0; a < size; a++) {
      let run = 1;
      for (let b = 1; b < size; b++) {
        if (get(a, b) === get(a, b - 1)) {
          run++;
        } else {
          if (run >= 5) total += 3 + (run - 5);
          run = 1;
        }
      }
      if (run >= 5) total += 3 + (run - 5);
    }
    return total;
  };
  score += runScore((r, c) => m[r][c]);
  score += runScore((c, r) => m[r][c]);

  // rule 2 — 2x2 blocks of one colour
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
    }
  }

  // rule 3 — finder-lookalike sequences
  const FINDER = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const REV = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const matches = (get, a, b, pat) => {
    for (let k = 0; k < 11; k++) if (get(a, b + k) !== pat[k]) return false;
    return true;
  };
  for (let a = 0; a < size; a++) {
    for (let b = 0; b <= size - 11; b++) {
      if (matches((x, y) => m[x][y], a, b, FINDER)) score += 40;
      if (matches((x, y) => m[x][y], a, b, REV)) score += 40;
      if (matches((x, y) => m[y][x], a, b, FINDER)) score += 40;
      if (matches((x, y) => m[y][x], a, b, REV)) score += 40;
    }
  }

  // rule 4 — overall balance of dark to light
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (m[r][c]) dark++;
  const ratio = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(ratio - 50) / 5) * 10;

  return score;
}

// ---------- top level ----------
/**
 * Encode a string as a QR matrix of 0/1 rows.
 * Throws if the text is too long for version 10 at level M (216 bytes).
 */
export function encode(text) {
  const bytes = new TextEncoder().encode(text);

  let version = 0;
  for (let v = 1; v <= 10; v++) {
    const countBits = v < 10 ? 8 : 16;
    const needed = 4 + countBits + bytes.length * 8;
    if (needed <= dataCapacity(v) * 8) { version = v; break; }
  }
  if (!version) throw new Error(`Too long for a version 10 QR code: ${bytes.length} bytes`);

  const spec = VERSIONS[version];
  const capacity = dataCapacity(version);

  const bits = new Bits();
  bits.push(0b0100, 4);                          // byte mode
  bits.push(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) bits.push(b, 8);

  // terminator, then pad to a whole byte, then the standard pad bytes
  const terminator = Math.min(4, capacity * 8 - bits.length);
  if (terminator > 0) bits.push(0, terminator);
  while (bits.length % 8 !== 0) bits.push(0, 1);

  const data = new Uint8Array(capacity);
  data.set(bits.bytes.slice(0, capacity));
  for (let i = bits.bytes.length, pad = 0; i < capacity; i++, pad++) {
    data[i] = pad % 2 === 0 ? 0xec : 0x11;
  }

  // split into blocks, compute EC for each
  const blocks = [];
  let offset = 0;
  for (const [count, perBlock] of spec.groups) {
    for (let i = 0; i < count; i++) {
      const chunk = data.slice(offset, offset + perBlock);
      offset += perBlock;
      blocks.push({ data: chunk, ec: rsEncode(chunk, spec.ec) });
    }
  }

  // interleave data codewords, then EC codewords
  const out = [];
  const maxData = Math.max(...blocks.map((b) => b.data.length));
  for (let i = 0; i < maxData; i++) {
    for (const b of blocks) if (i < b.data.length) out.push(b.data[i]);
  }
  for (let i = 0; i < spec.ec; i++) {
    for (const b of blocks) out.push(b.ec[i]);
  }

  const codewords = Uint8Array.from(out);

  // pick the mask with the lowest penalty, as the spec requires
  let best = null, bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const m = buildMatrix(version, codewords, mask);
    const s = penalty(m);
    if (s < bestScore) { bestScore = s; best = m; }
  }

  return best.map((row) => Array.from(row));
}

/** Render an encoded matrix as a crisp, scalable SVG string. */
export function toSvg(text, { quiet = 4 } = {}) {
  const m = encode(text);
  const size = m.length + quiet * 2;
  let path = '';
  for (let r = 0; r < m.length; r++) {
    for (let c = 0; c < m.length; c++) {
      if (m[r][c]) path += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR code to join"><rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}
