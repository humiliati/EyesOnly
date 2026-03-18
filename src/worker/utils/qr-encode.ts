/* ============================================================
   EYES ONLY — Pure-JS QR Code Encoder for Cloudflare Workers

   Generates QR codes as PNG byte arrays without any native deps.
   Uses Mode Byte, Error Correction Level L, auto-selects version.

   Based on the QR code specification (ISO/IEC 18004).
   Outputs raw PNG via a minimal PNG encoder (no canvas needed).
   ============================================================ */

// ---- Galois Field GF(256) arithmetic for Reed-Solomon ----

const EXP_TABLE = new Uint8Array(256);
const LOG_TABLE = new Uint8Array(256);

(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = x;
    LOG_TABLE[x] = i;
    x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
  }
  EXP_TABLE[255] = EXP_TABLE[0];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP_TABLE[(LOG_TABLE[a] + LOG_TABLE[b]) % 255];
}

function rsEncode(data: number[], ecLen: number): number[] {
  // Build generator polynomial
  const gen: number[] = new Array(ecLen + 1).fill(0);
  gen[0] = 1;
  for (let i = 0; i < ecLen; i++) {
    for (let j = ecLen; j >= 1; j--) {
      gen[j] = gen[j] ^ gfMul(gen[j - 1], EXP_TABLE[i]);
    }
  }

  const msg = [...data, ...new Array(ecLen).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 0; j <= ecLen; j++) {
        msg[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return msg.slice(data.length);
}

// ---- QR Code Data Encoding (Byte mode, ECC Level L) ----

// Version capacities for Byte mode, ECC Level L
const VERSION_CAPACITY_L: number[] = [
  0, 17, 32, 53, 78, 106, 134, 154, 192, 230, 271,
  321, 367, 425, 458, 520, 586, 644, 718, 792, 858,
  929, 1003, 1091, 1171, 1273, 1367, 1465, 1528, 1628, 1732,
  1840, 1952, 2068, 2188, 2303, 2431, 2563, 2699, 2809, 2953
];

// EC codewords per block for Level L
const EC_CODEWORDS_L: number[] = [
  0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18,
  20, 24, 26, 30, 22, 24, 28, 30, 28, 28,
  28, 28, 30, 30, 26, 28, 30, 30, 30, 30,
  30, 30, 30, 30, 30, 30, 30, 30, 30, 30
];

// Number of EC blocks for Level L
const NUM_BLOCKS_L: number[] = [
  0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4,
  4, 4, 4, 4, 6, 6, 6, 6, 7, 8,
  8, 9, 9, 10, 12, 12, 12, 13, 14, 15,
  16, 17, 18, 19, 19, 20, 21, 22, 24, 25
];

// Total data codewords for Level L
const TOTAL_CODEWORDS: number[] = [
  0, 19, 34, 55, 80, 108, 136, 156, 194, 232, 274,
  324, 370, 428, 461, 523, 589, 647, 721, 795, 861,
  932, 1006, 1094, 1174, 1276, 1370, 1468, 1531, 1631, 1735,
  1843, 1955, 2071, 2191, 2306, 2434, 2566, 2702, 2812, 2956
];

function selectVersion(dataLen: number): number {
  for (let v = 1; v <= 40; v++) {
    if (VERSION_CAPACITY_L[v] >= dataLen) return v;
  }
  throw new Error('Data too long for QR code');
}

function encodeData(text: string, version: number): number[] {
  const bytes = new TextEncoder().encode(text);
  const totalCW = TOTAL_CODEWORDS[version];
  const ecCW = EC_CODEWORDS_L[version];
  const numBlocks = NUM_BLOCKS_L[version];
  const dataCW = totalCW - ecCW * numBlocks;

  // Build data stream: mode(4) + count(8 or 16) + data + terminator + padding
  const bits: number[] = [];

  function pushBits(val: number, len: number) {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  }

  // Mode indicator: Byte = 0100
  pushBits(0b0100, 4);

  // Character count
  const ccLen = version <= 9 ? 8 : 16;
  pushBits(bytes.length, ccLen);

  // Data
  for (const b of bytes) pushBits(b, 8);

  // Terminator (up to 4 zeros)
  const maxBits = dataCW * 8;
  const termLen = Math.min(4, maxBits - bits.length);
  pushBits(0, termLen);

  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);

  // Pad bytes
  const padBytes = [0xEC, 0x11];
  let padIdx = 0;
  while (bits.length < maxBits) {
    pushBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  // Convert bits to bytes
  const dataBytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i + j] || 0);
    dataBytes.push(byte);
  }

  // Split into blocks and generate EC
  const shortBlockDataCW = Math.floor(dataCW / numBlocks);
  const longBlocks = dataCW % numBlocks;
  const shortBlocks = numBlocks - longBlocks;

  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;

  for (let i = 0; i < numBlocks; i++) {
    const blockLen = shortBlockDataCW + (i >= shortBlocks ? 1 : 0);
    const block = dataBytes.slice(offset, offset + blockLen);
    dataBlocks.push(block);
    ecBlocks.push(rsEncode(block, ecCW));
    offset += blockLen;
  }

  // Interleave data blocks
  const result: number[] = [];
  const maxDataLen = shortBlockDataCW + 1;
  for (let i = 0; i < maxDataLen; i++) {
    for (let j = 0; j < numBlocks; j++) {
      if (i < dataBlocks[j].length) result.push(dataBlocks[j][i]);
    }
  }

  // Interleave EC blocks
  for (let i = 0; i < ecCW; i++) {
    for (let j = 0; j < numBlocks; j++) {
      result.push(ecBlocks[j][i]);
    }
  }

  return result;
}

// ---- QR Matrix Construction ----

// Alignment pattern positions per version
const ALIGNMENT_POSITIONS: number[][] = [
  [], [], [6,18], [6,22], [6,26], [6,30], [6,34],
  [6,22,38], [6,24,42], [6,26,46], [6,28,50],
  [6,30,54], [6,32,58], [6,34,62], [6,26,46,66],
  [6,26,48,70], [6,26,50,74], [6,30,54,78], [6,30,56,82],
  [6,30,58,86], [6,34,62,90], [6,28,50,72,94],
  [6,26,50,74,98], [6,30,54,78,102], [6,28,54,80,106],
  [6,32,58,84,110], [6,30,58,86,114], [6,34,62,90,118],
  [6,26,50,74,98,122], [6,30,54,78,102,126], [6,26,52,78,104,130],
  [6,30,56,82,108,134], [6,34,60,86,112,138], [6,30,58,86,114,142],
  [6,34,62,90,118,146], [6,30,54,78,102,126,150],
  [6,24,50,76,102,128,154], [6,28,54,80,106,132,158],
  [6,32,58,84,110,136,162], [6,26,54,82,110,138,166],
  [6,30,58,86,114,142,170]
];

function createMatrix(version: number): { matrix: number[][], size: number } {
  const size = version * 4 + 17;
  // 0 = unset, 1 = black function, 2 = white function, 3 = black data, 4 = white data
  const matrix: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));

  // Finder patterns (7x7 at three corners)
  function drawFinder(row: number, col: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = row + r, cc = col + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const inOuter = r === 0 || r === 6 || c === 0 || c === 6;
        const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        const inBorder = r === -1 || r === 7 || c === -1 || c === 7;
        matrix[rr][cc] = inBorder ? 2 : (inOuter || inInner) ? 1 : 2;
      }
    }
  }

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = matrix[6][i] || ((i % 2 === 0) ? 1 : 2);
    matrix[i][6] = matrix[i][6] || ((i % 2 === 0) ? 1 : 2);
  }

  // Alignment patterns
  if (version >= 2) {
    const pos = ALIGNMENT_POSITIONS[version];
    for (const r of pos) {
      for (const c of pos) {
        // Skip if overlapping finder
        if (r <= 8 && c <= 8) continue;
        if (r <= 8 && c >= size - 8) continue;
        if (r >= size - 8 && c <= 8) continue;

        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const isDark = dr === -2 || dr === 2 || dc === -2 || dc === 2 || (dr === 0 && dc === 0);
            matrix[r + dr][c + dc] = isDark ? 1 : 2;
          }
        }
      }
    }
  }

  // Dark module
  matrix[size - 8][8] = 1;

  // Reserve format info areas
  for (let i = 0; i < 8; i++) {
    if (matrix[8][i] === 0) matrix[8][i] = 2;
    if (matrix[i][8] === 0) matrix[i][8] = 2;
    if (matrix[8][size - 1 - i] === 0) matrix[8][size - 1 - i] = 2;
    if (matrix[size - 1 - i][8] === 0) matrix[size - 1 - i][8] = 2;
  }
  if (matrix[8][8] === 0) matrix[8][8] = 2;

  // Reserve version info for v >= 7
  if (version >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        if (matrix[i][size - 11 + j] === 0) matrix[i][size - 11 + j] = 2;
        if (matrix[size - 11 + j][i] === 0) matrix[size - 11 + j][i] = 2;
      }
    }
  }

  return { matrix, size };
}

function placeData(matrix: number[][], size: number, data: number[]): void {
  const bits: number[] = [];
  for (const byte of data) {
    for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
  }

  // Add remainder bits
  const totalModules = size * size;
  while (bits.length < totalModules) bits.push(0);

  let bitIdx = 0;
  let upward = true;

  for (let col = size - 1; col >= 0; col -= 2) {
    if (col === 6) col = 5; // Skip timing column

    const rows = upward
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const row of rows) {
      for (let c = 0; c <= 1; c++) {
        const cc = col - c;
        if (cc < 0) continue;
        if (matrix[row][cc] !== 0) continue; // Already function pattern
        matrix[row][cc] = (bits[bitIdx] === 1) ? 3 : 4;
        bitIdx++;
      }
    }
    upward = !upward;
  }
}

// Format info for ECC Level L (00) with mask patterns 0-7
const FORMAT_INFO_L: number[] = [
  0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976
];

function applyMaskAndFormat(matrix: number[][], size: number, mask: number): number[][] {
  const result = matrix.map(r => [...r]);

  // Apply mask to data modules
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (result[r][c] !== 3 && result[r][c] !== 4) continue;

      let flip = false;
      switch (mask) {
        case 0: flip = (r + c) % 2 === 0; break;
        case 1: flip = r % 2 === 0; break;
        case 2: flip = c % 3 === 0; break;
        case 3: flip = (r + c) % 3 === 0; break;
        case 4: flip = (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; break;
        case 5: flip = ((r * c) % 2 + (r * c) % 3) === 0; break;
        case 6: flip = ((r * c) % 2 + (r * c) % 3) % 2 === 0; break;
        case 7: flip = ((r + c) % 2 + (r * c) % 3) % 2 === 0; break;
      }

      if (flip) {
        result[r][c] = result[r][c] === 3 ? 4 : 3;
      }
    }
  }

  // Write format info
  const fmtBits = FORMAT_INFO_L[mask];
  const formatPositions1 = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
  ];
  const formatPositions2 = [
    [size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8],
    [size - 5, 8], [size - 6, 8], [size - 7, 8],
    [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5],
    [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1]
  ];

  for (let i = 0; i < 15; i++) {
    const bit = (fmtBits >> (14 - i)) & 1;
    const [r1, c1] = formatPositions1[i];
    const [r2, c2] = formatPositions2[i];
    result[r1][c1] = bit ? 1 : 2;
    result[r2][c2] = bit ? 1 : 2;
  }

  return result;
}

function scoreMask(matrix: number[][], size: number): number {
  let score = 0;
  const isDark = (r: number, c: number) => matrix[r][c] === 1 || matrix[r][c] === 3;

  // Rule 1: consecutive same-color runs
  for (let r = 0; r < size; r++) {
    let run = 1;
    for (let c = 1; c < size; c++) {
      if (isDark(r, c) === isDark(r, c - 1)) {
        run++;
        if (run === 5) score += 3;
        else if (run > 5) score += 1;
      } else {
        run = 1;
      }
    }
  }
  for (let c = 0; c < size; c++) {
    let run = 1;
    for (let r = 1; r < size; r++) {
      if (isDark(r, c) === isDark(r - 1, c)) {
        run++;
        if (run === 5) score += 3;
        else if (run > 5) score += 1;
      } else {
        run = 1;
      }
    }
  }

  // Rule 4: proportion of dark modules
  let darkCount = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isDark(r, c)) darkCount++;
    }
  }
  const pct = (darkCount / (size * size)) * 100;
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;

  return score;
}

// ---- PNG Encoder (minimal, no dependencies) ----

function crc32(buf: Uint8Array): number {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return ~crc >>> 0;
}

function adler32(buf: Uint8Array): number {
  let a = 1, b = 0;
  for (let i = 0; i < buf.length; i++) {
    a = (a + buf[i]) % 65521;
    b = (b + a) % 65521;
  }
  return (b << 16) | a;
}

function deflateStored(data: Uint8Array): Uint8Array {
  // Uncompressed deflate (store method) — simple and correct
  const maxBlock = 65535;
  const blocks = Math.ceil(data.length / maxBlock) || 1;
  const out = new Uint8Array(2 + data.length + blocks * 5 + 4); // zlib header + blocks + adler32
  let pos = 0;

  // Zlib header (CM=8, CINFO=7, no dict, FCHECK)
  out[pos++] = 0x78;
  out[pos++] = 0x01;

  for (let i = 0; i < blocks; i++) {
    const start = i * maxBlock;
    const end = Math.min(start + maxBlock, data.length);
    const len = end - start;
    const isLast = i === blocks - 1;

    out[pos++] = isLast ? 1 : 0;
    out[pos++] = len & 0xff;
    out[pos++] = (len >> 8) & 0xff;
    out[pos++] = ~len & 0xff;
    out[pos++] = (~len >> 8) & 0xff;
    out.set(data.subarray(start, end), pos);
    pos += len;
  }

  const adler = adler32(data);
  out[pos++] = (adler >> 24) & 0xff;
  out[pos++] = (adler >> 16) & 0xff;
  out[pos++] = (adler >> 8) & 0xff;
  out[pos++] = adler & 0xff;

  return out.subarray(0, pos);
}

function createPNG(matrix: number[][], size: number, scale: number, border: number): Uint8Array {
  const imgSize = (size + border * 2) * scale;

  // Build raw pixel data with filter bytes
  const isDark = (r: number, c: number) =>
    matrix[r]?.[c] === 1 || matrix[r]?.[c] === 3;

  const rowBytes = 1 + imgSize; // filter byte + 1 byte per pixel (grayscale)
  const rawData = new Uint8Array(imgSize * rowBytes);

  for (let y = 0; y < imgSize; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // No filter

    for (let x = 0; x < imgSize; x++) {
      const moduleR = Math.floor(y / scale) - border;
      const moduleC = Math.floor(x / scale) - border;
      const dark = moduleR >= 0 && moduleR < size && moduleC >= 0 && moduleC < size && isDark(moduleR, moduleC);
      rawData[rowOffset + 1 + x] = dark ? 0 : 255;
    }
  }

  const compressed = deflateStored(rawData);

  // Build PNG
  const chunks: Uint8Array[] = [];

  function writeChunk(type: string, data: Uint8Array) {
    const typeBytes = new TextEncoder().encode(type);
    const buf = new Uint8Array(4 + typeBytes.length + data.length + 4);
    // Length
    const len = data.length;
    buf[0] = (len >> 24) & 0xff;
    buf[1] = (len >> 16) & 0xff;
    buf[2] = (len >> 8) & 0xff;
    buf[3] = len & 0xff;
    // Type + Data
    buf.set(typeBytes, 4);
    buf.set(data, 8);
    // CRC over type + data
    const crcData = new Uint8Array(typeBytes.length + data.length);
    crcData.set(typeBytes);
    crcData.set(data, typeBytes.length);
    const crc = crc32(crcData);
    buf[8 + data.length] = (crc >> 24) & 0xff;
    buf[9 + data.length] = (crc >> 16) & 0xff;
    buf[10 + data.length] = (crc >> 8) & 0xff;
    buf[11 + data.length] = crc & 0xff;
    chunks.push(buf);
  }

  // Signature
  chunks.push(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));

  // IHDR
  const ihdr = new Uint8Array(13);
  ihdr[0] = (imgSize >> 24) & 0xff; ihdr[1] = (imgSize >> 16) & 0xff;
  ihdr[2] = (imgSize >> 8) & 0xff; ihdr[3] = imgSize & 0xff;
  ihdr[4] = (imgSize >> 24) & 0xff; ihdr[5] = (imgSize >> 16) & 0xff;
  ihdr[6] = (imgSize >> 8) & 0xff; ihdr[7] = imgSize & 0xff;
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 0;  // grayscale
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  writeChunk('IHDR', ihdr);

  // IDAT
  writeChunk('IDAT', compressed);

  // IEND
  writeChunk('IEND', new Uint8Array(0));

  // Concat all chunks
  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const png = new Uint8Array(totalLen);
  let off = 0;
  for (const chunk of chunks) {
    png.set(chunk, off);
    off += chunk.length;
  }

  return png;
}

// ---- Public API ----

export function generateQR(text: string, scale: number = 8, border: number = 4): Uint8Array {
  const version = selectVersion(text.length);
  const data = encodeData(text, version);
  const { matrix, size } = createMatrix(version);
  placeData(matrix, size, data);

  // Try all 8 masks, pick lowest penalty
  let bestMask = 0;
  let bestScore = Infinity;
  let bestMatrix: number[][] = matrix;

  for (let mask = 0; mask < 8; mask++) {
    const masked = applyMaskAndFormat(matrix, size, mask);
    const score = scoreMask(masked, size);
    if (score < bestScore) {
      bestScore = score;
      bestMask = mask;
      bestMatrix = masked;
    }
  }

  return createPNG(bestMatrix, size, scale, border);
}
