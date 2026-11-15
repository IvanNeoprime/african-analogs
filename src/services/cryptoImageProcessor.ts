// geotiff is loaded on demand (only when a TIFF is opened) to keep the initial bundle small.

export type DecryptionAlgorithm =
  | 'auto'
  | 'aes_gcm_pbkdf2'
  | 'openssl_aes_cbc'
  | 'raw_key_aes_gcm'
  | 'raw_key_aes_cbc';

export interface DecodedImageMetadata {
  originalFileName: string;
  detectedFormat: string;
  wasEncrypted: boolean;
  decryptionMethod?: string;
  width?: number;
  height?: number;
  bands?: number;
  bitsPerSample?: number;
  minVal?: number;
  maxVal?: number;
  meanVal?: number;
  isGeoTiff?: boolean;
  geoCoords?: { lat: number; lng: number };
}

export interface ProcessedImageResult {
  dataUrl: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
  metadata: DecodedImageMetadata;
}

export function isProbablyEncryptedOrTiffFile(fileName: string, mimeType: string): {
  isTiff: boolean;
  isEncrypted: boolean;
  isStandardImage: boolean;
} {
  const lower = fileName.toLowerCase();
  const isEncrypted =
    lower.endsWith('.enc') ||
    lower.endsWith('.aes') ||
    lower.endsWith('.bin') ||
    lower.endsWith('.dat') ||
    lower.endsWith('.pgp') ||
    lower.endsWith('.asc') ||
    lower.endsWith('.b64') ||
    lower.endsWith('.crypt') ||
    lower.includes('.tif.enc') ||
    lower.includes('.tiff.enc');

  const isTiff =
    !isEncrypted &&
    (lower.endsWith('.tif') ||
      lower.endsWith('.tiff') ||
      lower.endsWith('.geotiff') ||
      mimeType === 'image/tiff' ||
      mimeType === 'image/x-tiff');

  const isStandardImage =
    !isEncrypted &&
    !isTiff &&
    (mimeType.startsWith('image/') ||
      /\.(png|jpe?g|webp|gif|bmp)$/i.test(lower));

  return { isTiff, isEncrypted, isStandardImage };
}

export function detectImageMagic(
  bytes: Uint8Array
): 'tiff' | 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | 'image/bmp' | 'openssl' | 'json' | 'unknown' {
  if (bytes.length < 4) return 'unknown';

  // TIFF (II*0 or MM0* or BigTIFF)
  if (
    (bytes[0] === 0x49 && bytes[1] === 0x49 && (bytes[2] === 0x2a || bytes[2] === 0x2b) && bytes[3] === 0x00) ||
    (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && (bytes[3] === 0x2a || bytes[3] === 0x2b))
  ) {
    return 'tiff';
  }

  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }

  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  // GIF
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'image/gif';
  }

  // BMP
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return 'image/bmp';
  }

  // OpenSSL "Salted__"
  if (
    bytes.length >= 16 &&
    bytes[0] === 0x53 &&
    bytes[1] === 0x61 &&
    bytes[2] === 0x6c &&
    bytes[3] === 0x74 &&
    bytes[4] === 0x65 &&
    bytes[5] === 0x64 &&
    bytes[6] === 0x5f &&
    bytes[7] === 0x5f
  ) {
    return 'openssl';
  }

  // JSON envelope
  if (bytes[0] === 0x7b) {
    return 'json';
  }

  return 'unknown';
}

function tryDecodeTextPayload(bytes: Uint8Array): Uint8Array | null {
  try {
    const text = new TextDecoder().decode(bytes).trim();
    if (!text) return null;

    // Strip PEM/PGP-like armor headers if present
    const stripped = text
      .replace(/-----BEGIN [^-]+-----/g, '')
      .replace(/-----END [^-]+-----/g, '')
      .replace(/\s+/g, '');

    if (/^[A-Za-z0-9+/=]+$/.test(stripped) && stripped.length >= 16 && stripped.length % 4 === 0) {
      const bin = atob(stripped);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }

    if (/^[0-9a-fA-F]+$/.test(stripped) && stripped.length >= 32 && stripped.length % 2 === 0) {
      const out = new Uint8Array(stripped.length / 2);
      for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(stripped.slice(i * 2, i * 2 + 2), 16);
      }
      return out;
    }
  } catch {
    return null;
  }
  return null;
}

function decodeKeyString(str: string): Uint8Array | null {
  const clean = str.trim();
  if (/^[0-9a-fA-F]{32}$/.test(clean) || /^[0-9a-fA-F]{64}$/.test(clean)) {
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  }

  try {
    const bin = atob(clean);
    if (bin.length === 16 || bin.length === 24 || bin.length === 32) {
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
  } catch {
    // Not base64 key
  }
  return null;
}

function decodeBase64OrHex(str: string): Uint8Array {
  const clean = str.trim();
  if (/^[0-9a-fA-F]+$/.test(clean) && clean.length % 2 === 0) {
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    return out;
  }
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

async function derivePbkdf2Bits(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
  bitsLength: number
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    bitsLength
  );
  return new Uint8Array(derived);
}

async function tryDecryptAesGcm(
  keyBytes: Uint8Array,
  iv: Uint8Array,
  ciphertext: Uint8Array
): Promise<Uint8Array | null> {
  try {
    const key = await crypto.subtle.importKey('raw', toArrayBuffer(keyBytes), 'AES-GCM', false, ['decrypt']);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(ciphertext)
    );
    return new Uint8Array(plain);
  } catch {
    return null;
  }
}

async function tryDecryptAesCbc(
  keyBytes: Uint8Array,
  iv: Uint8Array,
  ciphertext: Uint8Array
): Promise<Uint8Array | null> {
  try {
    const key = await crypto.subtle.importKey('raw', toArrayBuffer(keyBytes), 'AES-CBC', false, ['decrypt']);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(ciphertext)
    );
    return new Uint8Array(plain);
  } catch {
    return null;
  }
}

function isValidDecodedImageMagic(bytes: Uint8Array): boolean {
  const m = detectImageMagic(bytes);
  return m === 'tiff' || m === 'image/png' || m === 'image/jpeg' || m === 'image/webp' || m === 'image/gif' || m === 'image/bmp';
}

export async function decryptEncryptedImageBytes(
  rawBytes: Uint8Array,
  secretInput: string,
  algorithm: DecryptionAlgorithm = 'auto'
): Promise<{ bytes: Uint8Array; method: string }> {
  if (!secretInput.trim()) {
    throw new Error('Informe a senha ou chave criptográfica fornecida para descriptografar o arquivo.');
  }

  // Unwrap Base64/Hex container if the file is text-armored
  let payload = rawBytes;
  const initialMagic = detectImageMagic(payload);

  if (initialMagic === 'json') {
    const jsonText = new TextDecoder().decode(payload);
    const parsed = JSON.parse(jsonText);
    const cipherField = parsed.ciphertext || parsed.data || parsed.payload;
    if (!cipherField || !parsed.iv) {
      throw new Error('Envelope JSON criptografado inválido: campos "iv" e "ciphertext/data" são obrigatórios.');
    }
    const iv = decodeBase64OrHex(parsed.iv);
    const cipher = decodeBase64OrHex(cipherField);
    const iterations = Number(parsed.iterations) || 100000;
    const rawKey = decodeKeyString(secretInput);

    let keyBytes: Uint8Array;
    if (parsed.salt) {
      keyBytes = await derivePbkdf2Bits(secretInput, decodeBase64OrHex(parsed.salt), iterations, 256);
    } else if (rawKey) {
      keyBytes = rawKey;
    } else {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secretInput));
      keyBytes = new Uint8Array(digest);
    }

    const algName = String(parsed.alg || parsed.algorithm || 'AES-GCM').toUpperCase();
    const decrypted = algName.includes('CBC')
      ? await tryDecryptAesCbc(keyBytes, iv, cipher)
      : await tryDecryptAesGcm(keyBytes, iv, cipher);

    if (!decrypted || !isValidDecodedImageMagic(decrypted)) {
      throw new Error('Chave/senha incorreta ou formato de imagem inválido após descriptografia JSON.');
    }
    return { bytes: decrypted, method: `Envelope JSON (${algName})` };
  }

  if (initialMagic === 'unknown') {
    const unwrapped = tryDecodeTextPayload(payload);
    if (unwrapped) {
      payload = unwrapped;
    }
  }

  const magic = detectImageMagic(payload);
  if (isValidDecodedImageMagic(payload)) {
    return { bytes: payload, method: 'Decodificação Base64/Hex direta' };
  }

  // 1. OpenSSL "Salted__" (AES-256-CBC with PBKDF2-SHA256)
  if ((algorithm === 'auto' || algorithm === 'openssl_aes_cbc') && magic === 'openssl') {
    const salt = payload.slice(8, 16);
    const ciphertext = payload.slice(16);

    for (const iter of [10000, 100000, 65536, 1]) {
      const keyAndIv = await derivePbkdf2Bits(secretInput, salt, iter, 384); // 32B key + 16B IV
      const key = keyAndIv.slice(0, 32);
      const iv = keyAndIv.slice(32, 48);
      const plain = await tryDecryptAesCbc(key, iv, ciphertext);
      if (plain && isValidDecodedImageMagic(plain)) {
        return { bytes: plain, method: `OpenSSL AES-256-CBC (PBKDF2 ${iter} it.)` };
      }
    }
  }

  // 2. Raw Key AES-GCM or AES-CBC (Hex 128/256-bit or Base64 key)
  const rawKeyBytes = decodeKeyString(secretInput);
  if (rawKeyBytes && (algorithm === 'auto' || algorithm === 'raw_key_aes_gcm' || algorithm === 'raw_key_aes_cbc')) {
    if ((algorithm === 'auto' || algorithm === 'raw_key_aes_gcm') && payload.length > 28) {
      const plain = await tryDecryptAesGcm(rawKeyBytes, payload.slice(0, 12), payload.slice(12));
      if (plain && isValidDecodedImageMagic(plain)) {
        return { bytes: plain, method: `AES-${rawKeyBytes.length * 8}-GCM (Chave Bruta)` };
      }
    }
    if ((algorithm === 'auto' || algorithm === 'raw_key_aes_cbc') && payload.length > 32) {
      const plain = await tryDecryptAesCbc(rawKeyBytes, payload.slice(0, 16), payload.slice(16));
      if (plain && isValidDecodedImageMagic(plain)) {
        return { bytes: plain, method: `AES-${rawKeyBytes.length * 8}-CBC (Chave Bruta)` };
      }
    }
  }

  // 3. Binary PBKDF2-SHA256 AES-GCM ([16B salt][12B IV][ciphertext])
  if ((algorithm === 'auto' || algorithm === 'aes_gcm_pbkdf2') && payload.length > 44) {
    const salt = payload.slice(0, 16);
    const iv = payload.slice(16, 28);
    const ciphertext = payload.slice(28);

    for (const iter of [100000, 65536, 10000]) {
      const keyBytes = await derivePbkdf2Bits(secretInput, salt, iter, 256);
      const plain = await tryDecryptAesGcm(keyBytes, iv, ciphertext);
      if (plain && isValidDecodedImageMagic(plain)) {
        return { bytes: plain, method: `AES-256-GCM (PBKDF2-SHA256)` };
      }
    }
  }

  // 4. SHA-256 hashed passphrase + [12B IV][ciphertext] or [16B IV][ciphertext]
  const passphraseHash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secretInput))
  );
  if (payload.length > 28) {
    const plainGcm = await tryDecryptAesGcm(passphraseHash, payload.slice(0, 12), payload.slice(12));
    if (plainGcm && isValidDecodedImageMagic(plainGcm)) {
      return { bytes: plainGcm, method: 'AES-256-GCM (SHA-256)' };
    }
  }
  if (payload.length > 32) {
    const plainCbc = await tryDecryptAesCbc(passphraseHash, payload.slice(0, 16), payload.slice(16));
    if (plainCbc && isValidDecodedImageMagic(plainCbc)) {
      return { bytes: plainCbc, method: 'AES-256-CBC (SHA-256)' };
    }
  }

  throw new Error(
    'Não foi possível descriptografar o arquivo. Verifique se a senha/chave está correta ou selecione o algoritmo correspondente (AES-GCM, OpenSSL AES-CBC ou chave Hex/Base64).'
  );
}

export async function decodeTiffBytesToPng(bytes: Uint8Array, originalFileName: string, wasEncrypted: boolean, decryptionMethod?: string): Promise<ProcessedImageResult> {
  const { fromArrayBuffer } = await import('geotiff');
  const tiff = await fromArrayBuffer(toArrayBuffer(bytes));
  const image = await tiff.getImage();

  const srcWidth = image.getWidth();
  const srcHeight = image.getHeight();
  const samplesPerPixel = image.getSamplesPerPixel();
  const bitsArray = image.getBitsPerSample();
  const bitsPerSample = Array.isArray(bitsArray) ? bitsArray[0] : bitsArray || 8;

  // Downsample proportionally if huge NASA raster (> 1280px) to keep canvas/Gemini fast
  const maxDim = 1280;
  const scale = Math.min(1, maxDim / Math.max(srcWidth, srcHeight));
  const targetWidth = Math.max(1, Math.round(srcWidth * scale));
  const targetHeight = Math.max(1, Math.round(srcHeight * scale));

  const rasters = await image.readRasters({
    width: targetWidth,
    height: targetHeight,
  });

  const pixelCount = targetWidth * targetHeight;
  const band0 = rasters[0] as ArrayLike<number>;

  let minVal = Infinity;
  let maxVal = -Infinity;
  let sumVal = 0;
  let validCount = 0;

  for (let i = 0; i < pixelCount; i++) {
    const v = band0[i];
    if (Number.isFinite(v) && v !== -32768 && v !== -9999 && v < 1e20) {
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
      sumVal += v;
      validCount++;
    }
  }

  if (!Number.isFinite(minVal) || !Number.isFinite(maxVal) || maxVal === minVal) {
    minVal = 0;
    maxVal = 255;
  }
  const meanVal = validCount > 0 ? sumVal / validCount : 0;
  const range = maxVal - minVal || 1;

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Falha ao inicializar canvas para renderização TIFF.');

  const imgData = ctx.createImageData(targetWidth, targetHeight);
  const rgba = imgData.data;

  if (samplesPerPixel >= 3 && rasters.length >= 3) {
    // Normalize RGB/Multispectral bands
    const bandR = rasters[0] as ArrayLike<number>;
    const bandG = rasters[1] as ArrayLike<number>;
    const bandB = rasters[2] as ArrayLike<number>;
    const bandA = samplesPerPixel >= 4 && rasters[3] ? (rasters[3] as ArrayLike<number>) : null;

    const maxDynamic = bitsPerSample > 8 ? (maxVal > 255 ? maxVal : (1 << bitsPerSample) - 1) : 255;
    const normFactor = maxDynamic > 255 ? 255 / maxDynamic : 1;

    for (let i = 0; i < pixelCount; i++) {
      const idx = i * 4;
      rgba[idx] = Math.min(255, Math.max(0, Math.round(bandR[i] * normFactor)));
      rgba[idx + 1] = Math.min(255, Math.max(0, Math.round(bandG[i] * normFactor)));
      rgba[idx + 2] = Math.min(255, Math.max(0, Math.round(bandB[i] * normFactor)));
      rgba[idx + 3] = bandA ? Math.min(255, Math.max(0, Math.round(bandA[i] * normFactor))) : 255;
    }
  } else {
    // Single-band DEM / Elevation / Thermal / Albedo Raster -> High-contrast Hypsometric / Grayscale Relief
    for (let i = 0; i < pixelCount; i++) {
      const v = band0[i];
      const idx = i * 4;
      if (!Number.isFinite(v) || v === -32768 || v === -9999) {
        rgba[idx] = 15;
        rgba[idx + 1] = 23;
        rgba[idx + 2] = 42;
        rgba[idx + 3] = 255;
      } else {
        const norm = Math.min(1, Math.max(0, (v - minVal) / range));
        const gray = Math.round(norm * 255);
        rgba[idx] = gray;
        rgba[idx + 1] = gray;
        rgba[idx + 2] = gray;
        rgba[idx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const pngDataUrl = canvas.toDataURL('image/png');

  // Extract WGS84 GeoTIFF Coordinates if available
  let geoCoords: { lat: number; lng: number } | undefined;
  let isGeoTiff = false;
  try {
    const geoKeys = image.getGeoKeys();
    const bbox = image.getBoundingBox();
    if (geoKeys && Object.keys(geoKeys).length > 0) {
      isGeoTiff = true;
    }
    if (bbox && bbox.length === 4) {
      const [minX, minY, maxX, maxY] = bbox;
      if (
        minX >= -180 &&
        maxX <= 180 &&
        minY >= -90 &&
        maxY <= 90 &&
        (minX !== 0 || maxX !== srcWidth)
      ) {
        isGeoTiff = true;
        geoCoords = {
          lat: parseFloat(((minY + maxY) / 2).toFixed(5)),
          lng: parseFloat(((minX + maxX) / 2).toFixed(5)),
        };
      }
    }
  } catch {
    // Non-georeferenced plain TIFF
  }

  return {
    dataUrl: pngDataUrl,
    mimeType: 'image/png',
    metadata: {
      originalFileName,
      detectedFormat: isGeoTiff ? 'NASA GeoTIFF / DEM Raster' : 'TIFF Raster',
      wasEncrypted,
      decryptionMethod,
      width: srcWidth,
      height: srcHeight,
      bands: samplesPerPixel,
      bitsPerSample,
      minVal: parseFloat(minVal.toFixed(2)),
      maxVal: parseFloat(maxVal.toFixed(2)),
      meanVal: parseFloat(meanVal.toFixed(2)),
      isGeoTiff,
      geoCoords,
    },
  };
}

function bytesToDataUrl(bytes: Uint8Array, mimeType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([toArrayBuffer(bytes)], { type: mimeType });
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Falha ao converter imagem decodificada.'));
    reader.readAsDataURL(blob);
  });
}

export async function processUploadedScientificImage(
  file: File,
  options?: {
    secretKey?: string;
    algorithm?: DecryptionAlgorithm;
    forceDecrypt?: boolean;
  }
): Promise<ProcessedImageResult> {
  const arrayBuffer = await file.arrayBuffer();
  const rawBytes = new Uint8Array(arrayBuffer);
  const nameFlags = isProbablyEncryptedOrTiffFile(file.name, file.type);
  let workingBytes: Uint8Array = rawBytes;
  let wasEncrypted = false;
  let decryptionMethod: string | undefined;

  let magic = detectImageMagic(workingBytes);

  // Check if file needs decryption (explicitly encrypted extension, OpenSSL Salted__, JSON envelope, or unknown magic)
  if (
    options?.forceDecrypt ||
    nameFlags.isEncrypted ||
    magic === 'openssl' ||
    magic === 'json' ||
    magic === 'unknown'
  ) {
    // First check if it's plain Base64/Hex without encryption before demanding a password
    const unwrapped = magic === 'unknown' ? tryDecodeTextPayload(workingBytes) : null;
    if (unwrapped && isValidDecodedImageMagic(unwrapped)) {
      workingBytes = unwrapped;
      magic = detectImageMagic(workingBytes);
    } else {
      const decrypted = await decryptEncryptedImageBytes(
        workingBytes,
        options?.secretKey || '',
        options?.algorithm || 'auto'
      );
      workingBytes = decrypted.bytes;
      wasEncrypted = true;
      decryptionMethod = decrypted.method;
      magic = detectImageMagic(workingBytes);
    }
  }

  if (magic === 'tiff') {
    return decodeTiffBytesToPng(workingBytes, file.name, wasEncrypted, decryptionMethod);
  }

  if (
    magic === 'image/png' ||
    magic === 'image/jpeg' ||
    magic === 'image/webp' ||
    magic === 'image/gif'
  ) {
    const dataUrl = await bytesToDataUrl(workingBytes, magic);
    return {
      dataUrl,
      mimeType: magic,
      metadata: {
        originalFileName: file.name,
        detectedFormat: magic.replace('image/', '').toUpperCase(),
        wasEncrypted,
        decryptionMethod,
      },
    };
  }

  if (magic === 'image/bmp') {
    const bmpUrl = await bytesToDataUrl(workingBytes, 'image/bmp');
    const pngUrl = await new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 1;
        canvas.height = img.naturalHeight || 1;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } else {
          resolve(bmpUrl);
        }
      };
      img.onerror = () => resolve(bmpUrl);
      img.src = bmpUrl;
    });
    return {
      dataUrl: pngUrl,
      mimeType: pngUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
      metadata: {
        originalFileName: file.name,
        detectedFormat: 'BMP (Convertido PNG)',
        wasEncrypted,
        decryptionMethod,
      },
    };
  }

  throw new Error('Formato de arquivo não reconhecido como imagem ou GeoTIFF válido após processamento.');
}
