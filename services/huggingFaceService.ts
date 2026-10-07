/**
 * Service untuk integrasi Hugging Face Spaces (Gradio 4, 5 & 6) dengan ZeroGPU.
 * Mendukung CopoZ/Qwen-Image-Edit-Rapid-AIO-Loras-Plus, Qwen/Qwen-Image-Edit,
 * dan custom Spaces lainnya secara otomatis & adaptif.
 * Dilengkapi fitur Auto-Rotate Token saat kuota ZeroGPU akun habis (429/Quota Exceeded),
 * auto-detection endpoint & parameter input Gradio, serta auto-proxy melalui /api/hf-proxy.
 */

export interface HFTokenInfo {
  token: string;
  index: number;
  total: number;
  isExhausted?: boolean;
}

export interface HFSpaceConfig {
  spaceUrl: string;
  tokens: string;
  apiEndpoint?: string;
  injectNegativePrompt?: boolean;
  injectAnatomyGuard?: boolean;
}

export interface HFTestResult {
  success: boolean;
  message: string;
  spaceName?: string;
  spaceStage?: string;
  hardware?: string;
  activeTokenCount: number;
  activeTokenPreview?: string;
}

export interface GradioInputComponent {
  id: number;
  type: string;
  label: string;
  defaultValue: any;
}

export const DEFAULT_QWEN_SPACE_URL = 'https://huggingface.co/spaces/CopoZ/Qwen-Image-Edit-Rapid-AIO-Loras-Plus';
export const DEFAULT_QWEN_SPACE_HOST = 'https://copoz-qwen-image-edit-rapid-aio-loras-plus.hf.space';

// Memory cache untuk tracking token aktif agar rotasi berlanjut antar-request
let currentTokenIndex = 0;
const exhaustedTokensMap = new Map<string, number>(); // token -> timestamp saat limit (TTL 2 jam)

const isTokenExhausted = (token: string): boolean => {
  const ts = exhaustedTokensMap.get(token);
  if (!ts) return false;
  // Kuota ZeroGPU direset Hugging Face setiap ~2 jam
  if (Date.now() - ts > 2 * 60 * 60 * 1000) {
    exhaustedTokensMap.delete(token);
    return false;
  }
  return true;
};

export const markTokenExhausted = (token: string) => {
  exhaustedTokensMap.set(token, Date.now());
};

/**
 * Parsing string tokens (pemisah: baris baru, koma, titik koma)
 */
export const parseHFTokens = (tokensInput?: string): string[] => {
  if (!tokensInput) return [];
  return tokensInput
    .split(/[\n,;]+/)
    .map(t => t.trim())
    .filter(t => t.length > 0);
};

/**
 * Reset status kuota token (misalnya saat user mengedit pengaturan)
 */
export const resetHFTokenRotation = () => {
  currentTokenIndex = 0;
  exhaustedTokensMap.clear();
};

/**
 * Mengubah URL eksternal ke endpoint proxy lokal `/api/hf-proxy` untuk mem-bypass CORS browser.
 */
export const toProxyUrl = (targetUrl: string): string => {
  if (!targetUrl) return '';
  if (targetUrl.startsWith('/') || targetUrl.startsWith('data:')) return targetUrl;
  return `/api/hf-proxy?url=${encodeURIComponent(targetUrl)}`;
};

/**
 * Fetch aman yang otomatis menggunakan `/api/hf-proxy` untuk menghindari CORS,
 * dengan fallback ke direct fetch jika proxy tidak tersedia.
 */
export const proxyFetch = async (targetUrl: string, init?: RequestInit): Promise<Response> => {
  if (targetUrl.startsWith('data:')) {
    return await fetch(targetUrl, init);
  }

  const proxyUrl = toProxyUrl(targetUrl);
  try {
    const resp = await fetch(proxyUrl, init);
    if (resp.status !== 404) {
      return resp;
    }
  } catch (proxyErr) {
    console.warn("[HF-Proxy] Proxy request error, attempting direct fetch fallback:", proxyErr);
  }

  return await fetch(targetUrl, init);
};

/**
 * Normalisasi URL Space (baik format huggingface.co/spaces/owner/name maupun *.hf.space).
 * Jika kosong atau tidak valid, otomatis menggunakan DEFAULT_QWEN_SPACE_HOST.
 */
export const normalizeHFSpaceUrl = async (rawUrl?: string): Promise<string> => {
  let url = (rawUrl || '').trim();
  
  // Jika kosong atau sekadar awalan protokol tanpa nama domain
  if (!url || /^https?:\/?\/?$/i.test(url) || url.toLowerCase() === 'https' || url.toLowerCase() === 'http') {
    return DEFAULT_QWEN_SPACE_HOST;
  }

  // Buang whitespace dan trailing slash
  url = url.replace(/\/+$/, '');

  // Jika URL format https://huggingface.co/spaces/OWNER/REPO
  const match = url.match(/(?:https?:\/\/)?(?:www\.)?huggingface\.co\/spaces\/([^\/\s?#]+)\/([^\/\s?#]+)/i);
  if (match) {
    const owner = match[1];
    const repo = match[2];

    // Cek special alias cepat
    if (owner.toLowerCase() === 'copoz' && repo.toLowerCase() === 'qwen-image-edit-rapid-aio-loras-plus') {
      return 'https://copoz-qwen-image-edit-rapid-aio-loras-plus.hf.space';
    }
    if (owner.toLowerCase() === 'qwen' && repo.toLowerCase() === 'qwen-image-edit') {
      return 'https://qwen-qwen-image-edit.hf.space';
    }
    
    // Coba resolve host asli via API Hugging Face melalui proxy
    try {
      const resp = await proxyFetch(`https://huggingface.co/api/spaces/${owner}/${repo}`);
      if (resp.ok) {
        const text = await resp.text();
        if (text.startsWith('{')) {
          const data = JSON.parse(text);
          if (data.host) {
            const h = data.host.startsWith('http') ? data.host : `https://${data.host}`;
            return h.replace(/\/+$/, '');
          }
        }
      }
    } catch (e) {
      console.warn("Could not query HF API for space host, fallback to pattern:", e);
    }

    // Fallback format umum subdomain HF: owner-repo.hf.space
    const cleanRepo = repo.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const cleanOwner = owner.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    return `https://${cleanOwner}-${cleanRepo}.hf.space`;
  }

  // Jika bukan huggingface.co/spaces/..., pastikan diawali https://
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  // Parse origin URL yang valid
  try {
    const parsed = new URL(url);
    if (!parsed.hostname || parsed.hostname === 'https' || parsed.hostname === 'http' || (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost')) {
      return DEFAULT_QWEN_SPACE_HOST;
    }
    return parsed.origin;
  } catch (e) {
    return DEFAULT_QWEN_SPACE_HOST;
  }
};

/**
 * Mengambil token berikutnya yang belum habis kuotanya
 */
const getNextAvailableToken = (tokens: string[]): { token: string; index: number } | null => {
  if (tokens.length === 0) return { token: '', index: 0 };

  for (let i = 0; i < tokens.length; i++) {
    const idx = (currentTokenIndex + i) % tokens.length;
    const tok = tokens[idx];
    if (!isTokenExhausted(tok)) {
      currentTokenIndex = idx;
      return { token: tok, index: idx };
    }
  }

  // Jika semua token dalam daftar pernah limit, bersihkan catatan dan mulai siklus ulang
  exhaustedTokensMap.clear();
  currentTokenIndex = 0;
  return { token: tokens[0], index: 0 };
};

/**
 * Tandai token saat ini exhausted dan pindah ke token berikutnya
 */
const rotateToken = (tokens: string[], onStatus?: (status: string) => void): string | null => {
  if (tokens.length <= 1) return null;

  const currentTok = tokens[currentTokenIndex];
  if (currentTok) {
    exhaustedTokensMap.set(currentTok, Date.now());
  }
  const prevIdx = currentTokenIndex;

  currentTokenIndex = (currentTokenIndex + 1) % tokens.length;
  const nextTok = tokens[currentTokenIndex];

  const statusMsg = `Akun #${prevIdx + 1} kuota habis/terkendala. Otomatis beralih ke Akun #${currentTokenIndex + 1} (Total: ${tokens.length} akun)...`;
  console.log(`[HF-ZeroGPU] ${statusMsg}`);
  onStatus?.(statusMsg);

  return nextTok;
};

/**
 * Konversi URL remote atau Blob URL ke Data URL (Base64)
 */
export const fetchUrlToDataUrl = async (url: string, token?: string): Promise<string> => {
  if (url.startsWith('data:')) return url;

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let resp = await proxyFetch(url, { headers });
  
  // Jika 404 dan url mengandung /file=, coba tukar antara /gradio_api/file= dan /file=
  if (!resp.ok && url.includes('/file=')) {
    const altUrl = url.includes('/gradio_api/file=')
      ? url.replace('/gradio_api/file=', '/file=')
      : url.replace('/file=', '/gradio_api/file=');
    try {
      const altResp = await proxyFetch(altUrl, { headers });
      if (altResp.ok) {
        resp = altResp;
      }
    } catch (e) {}
  }

  if (!resp.ok) {
    throw new Error(`Failed to fetch image from ${url}: ${resp.statusText}`);
  }
  const blob = await resp.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Upload gambar base64 ke Gradio endpoint (/gradio_api/upload untuk Gradio 5/6 atau /upload untuk Gradio 4)
 */
const uploadToGradio = async (spaceHost: string, dataUrl: string, token?: string): Promise<any> => {
  try {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const binary = atob(parts[1]);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
    const blob = new Blob([array], { type: mime });

    const formData = new FormData();
    formData.append('files', blob, 'input_image.png');

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const uploadEndpoints = [
      `${spaceHost}/gradio_api/upload`,
      `${spaceHost}/upload`
    ];

    for (const ep of uploadEndpoints) {
      try {
        // Coba upload langsung terlebih dahulu jika didukung oleh browser CORS Space
        let resp: Response | null = null;
        try {
          resp = await fetch(ep, {
            method: 'POST',
            headers,
            body: formData
          });
        } catch (directErr) {
          // Fallback ke proxy
        }

        if (!resp || !resp.ok) {
          resp = await proxyFetch(ep, {
            method: 'POST',
            headers,
            body: formData
          });
        }

        if (resp && resp.ok) {
          const text = await resp.text();
          if (text.startsWith('[')) {
            const data = JSON.parse(text);
            if (Array.isArray(data) && data.length > 0) {
              return {
                path: data[0],
                url: `${spaceHost}/gradio_api/file=${data[0]}`,
                orig_name: 'input_image.png',
                size: blob.size,
                mime_type: mime,
                meta: { _type: 'gradio.FileData' }
              };
            }
          }
        }
      } catch (err) {}
    }
  } catch (err) {
    console.warn("[HF-Upload] Upload error:", err);
  }

  // Jika Space menolak upload, lempar error jelas alih-alih dataUrl mentah yang ditolak Gradio modern
  throw new Error("Gagal mengunggah foto referensi ke server Hugging Face Space. Pastikan URL Space aktif dan dapat diakses.");
};

/**
 * Ekstraksi gambar dari output Gradio
 */
const extractImageFromGradioOutput = async (data: any, spaceHost: string, token?: string): Promise<string> => {
  if (!data) throw new Error("Output dari HF Space kosong.");

  const findImage = (obj: any): string | null => {
    if (!obj) return null;
    if (typeof obj === 'string') {
      if (obj.startsWith('data:image/') || obj.startsWith('http://') || obj.startsWith('https://') || obj.startsWith('/file=') || obj.startsWith('/gradio_api/file=')) {
        return obj;
      }
    }
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = findImage(item);
        if (found) return found;
      }
    }
    if (typeof obj === 'object') {
      if (obj.url && typeof obj.url === 'string') return obj.url;
      if (obj.path && typeof obj.path === 'string') return `${spaceHost}/gradio_api/file=${obj.path}`;
      if (obj.image) return findImage(obj.image);
      for (const key of Object.keys(obj)) {
        const found = findImage(obj[key]);
        if (found) return found;
      }
    }
    return null;
  };

  let imgRef = findImage(data);
  if (!imgRef) {
    throw new Error("Gradio tidak mengembalikan gambar valid dalam outputnya: " + JSON.stringify(data).slice(0, 200));
  }

  if (imgRef.startsWith('/file=') || imgRef.startsWith('/gradio_api/file=')) {
    imgRef = `${spaceHost}${imgRef}`;
  }

  return await fetchUrlToDataUrl(imgRef, token);
};

/**
 * Panggil HF Space menggunakan Gradio 4/5/6 EventSource/SSE
 */
const callGradioModernSSE = async (
  spaceHost: string,
  apiEndpoint: string,
  payloadData: any[],
  token?: string,
  onStatus?: (status: string) => void
): Promise<any> => {
  const cleanEndpoint = apiEndpoint.startsWith('/') ? apiEndpoint : `/${apiEndpoint}`;
  
  // Dukung kedua format: Gradio 5/6 (/gradio_api/call/...) dan Gradio 4 (/call/...)
  const callUrls = [
    `${spaceHost}/gradio_api/call${cleanEndpoint}`,
    `${spaceHost}/call${cleanEndpoint}`
  ];

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  onStatus?.("Mengirim tugas ke Space ZeroGPU...");

  let initResp: Response | null = null;
  let chosenBaseCallUrl = '';
  let lastErrorText = '';

  for (const url of callUrls) {
    try {
      const resp = await proxyFetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ data: payloadData })
      });

      const raw = await resp.text();
      if (resp.ok && raw.includes('event_id')) {
        initResp = new Response(raw, { status: resp.status, headers: resp.headers });
        chosenBaseCallUrl = url;
        break;
      } else {
        lastErrorText = raw;
      }
    } catch (e: any) {
      lastErrorText = e?.message || String(e);
    }
  }

  if (!initResp) {
    if (lastErrorText.toLowerCase().includes('sleeping')) {
      throw new Error("Space Hugging Face saat ini dalam status 'Sleeping'. Silakan buka halaman Space di browser untuk membangunkannya.");
    }
    throw new Error(`Gagal memulai tugas di Space (${cleanEndpoint}): ${lastErrorText.slice(0, 150)}`);
  }

  const rawInitText = await initResp.text();
  let initData: any;
  try {
    initData = JSON.parse(rawInitText);
  } catch (parseErr) {
    throw new Error(`Respons dari Space bukan JSON yang valid: ${rawInitText.slice(0, 100)}`);
  }

  const eventId = initData?.event_id;
  if (!eventId) {
    throw new Error("Gradio /call tidak memberikan event_id.");
  }

  onStatus?.("Menunggu antrean dan eksekusi GPU...");
  const streamUrl = `${chosenBaseCallUrl}/${eventId}`;
  const streamResp = await proxyFetch(streamUrl, { headers });

  if (!streamResp.ok) {
    const errText = await streamResp.text().catch(() => '');
    throw {
      status: streamResp.status,
      message: `Stream error ${streamResp.status}: ${errText}`,
      raw: errText
    };
  }

  const reader = streamResp.body?.getReader();
  if (!reader) throw new Error("Tidak dapat membaca stream dari HF Space.");

  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: any = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    let currentEvent = '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('event:')) {
        currentEvent = trimmed.replace('event:', '').trim();
      } else if (trimmed.startsWith('data:')) {
        const rawJson = trimmed.replace('data:', '').trim();
        if (currentEvent === 'complete') {
          try {
            finalResult = JSON.parse(rawJson);
          } catch (e) {
            finalResult = rawJson;
          }
        } else if (currentEvent === 'error') {
          const cleanErr = rawJson && rawJson !== 'null' ? rawJson : 'Antrean GPU penuh atau Space mengembalikan error internal';
          throw new Error(`Space Execution Error: ${cleanErr}`);
        } else if (currentEvent === 'log') {
          try {
            const logObj = JSON.parse(rawJson);
            if (logObj?.log) {
              onStatus?.(`[ZeroGPU] ${logObj.log.slice(0, 60)}...`);
            }
          } catch (e) {}
        } else if (currentEvent === 'generating') {
          onStatus?.("Sedang memproses gambar di ZeroGPU...");
        }
      }
    }
  }

  if (finalResult === null) {
    throw new Error("Stream selesai tanpa data 'complete' dari Gradio.");
  }

  return finalResult;
};

/**
 * Panggil HF Space menggunakan Gradio 3 Legacy (/api/predict atau /run/predict)
 */
const callGradioLegacy = async (
  spaceHost: string,
  apiEndpoint: string,
  payloadData: any[],
  token?: string,
  onStatus?: (status: string) => void
): Promise<any> => {
  const cleanEndpoint = apiEndpoint.startsWith('/') ? apiEndpoint : `/${apiEndpoint}`;
  const urlsToTry = [
    `${spaceHost}/gradio_api/run${cleanEndpoint}`,
    `${spaceHost}/run${cleanEndpoint}`,
    `${spaceHost}/api${cleanEndpoint}`,
    `${spaceHost}/run/predict`,
    `${spaceHost}/api/predict`
  ];

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let lastError: any = null;
  for (const url of urlsToTry) {
    try {
      onStatus?.(`Mencoba endpoint ${url.split('/').slice(-2).join('/')}...`);
      const resp = await proxyFetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ data: payloadData })
      });

      const txt = await resp.text().catch(() => '');
      if (txt.trim().startsWith('<') || txt.toLowerCase().includes('<!doctype')) {
        lastError = { status: resp.status, message: `Space mengembalikan halaman HTML di ${url}` };
        continue;
      }

      if (resp.ok) {
        try {
          const data = JSON.parse(txt);
          return data?.data || data;
        } catch (e) {
          lastError = { status: resp.status, message: `Bukan JSON: ${txt.slice(0, 100)}` };
        }
      } else {
        lastError = { status: resp.status, message: txt };
      }
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || new Error("Gagal memanggil endpoint Gradio legacy.");
};

/**
 * Mendeteksi apakah error terkait limit kuota ZeroGPU atau rate-limit
 */
const isQuotaOrLimitError = (err: any): boolean => {
  if (!err) return false;
  const status = err.status || err.statusCode;
  if (status === 429 || status === 401 || status === 403 || status === 503 || status === 504 || status === 502) return true;

  const msg = (err.message || err.raw || String(err)).toLowerCase();
  return (
    msg.includes('quota') ||
    msg.includes('kuota') ||
    msg.includes('exceeded') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('exhausted') ||
    msg.includes('credit') ||
    msg.includes('unauthorized') ||
    msg.includes('gpu limit') ||
    msg.includes('gpu quota') ||
    msg.includes('zerogpu') ||
    msg.includes('antrean gpu') ||
    msg.includes('gpu') ||
    msg.includes('stream') ||
    msg.includes('space execution error') ||
    msg.includes('busy') ||
    msg.includes('timeout') ||
    msg.includes('try again') ||
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('504')
  );
};

/**
 * Inspeksi /config Space untuk mendeteksi endpoint yang tepat dan struktur argumen inputnya
 */
const inspectSpaceEndpoint = async (
  spaceHost: string,
  requestedEndpoint: string
): Promise<{ endpoint: string; inputComponents: GradioInputComponent[] }> => {
  try {
    const configResp = await proxyFetch(`${spaceHost}/config`);
    if (configResp.ok) {
      const text = await configResp.text();
      if (text.startsWith('{')) {
        const cfg = JSON.parse(text);
        if (Array.isArray(cfg.dependencies)) {
          const cleanReq = requestedEndpoint.replace(/^\/+/, '').toLowerCase();

          // Helper untuk memeriksa apakah dependency merupakan endpoint inferensi gambar sesungguhnya
          const isRealInferenceDep = (d: any): boolean => {
            if (!d.api_name || typeof d.api_name !== 'string') return false;
            const name = d.api_name.toLowerCase();
            // Abaikan UI event handler atau callback perubahan dropdown/slider/setting
            if (
              name.startsWith('on_') ||
              name.includes('change') ||
              name.startsWith('set_') ||
              name.startsWith('get_') ||
              name.startsWith('load_') ||
              name.startsWith('add_') ||
              name.includes('example') ||
              name.includes('preview') ||
              name.includes('clear') ||
              name.includes('update')
            ) {
              return false;
            }

            // Pastikan menghasilkan output gambar
            const hasImageOut = Array.isArray(d.outputs) && d.outputs.some((oid: number) => {
              const comp = cfg.components?.find((c: any) => c.id === oid);
              return comp?.type === 'image';
            });
            return hasImageOut;
          };

          // 1. Coba exact match dengan endpoint yang diminta JIKA merupakan inference endpoint yang valid
          let matchedDep = cfg.dependencies.find((d: any) => 
            d.api_name && d.api_name.toLowerCase() === cleanReq && isRealInferenceDep(d)
          );

          // 2. Jika tidak cocok (misal user minta '/predict' padahal Space punya '/infer'), cari dari nama standar gambar
          if (!matchedDep) {
            const priorityNames = ['infer', 'generate', 'image_edit', 'edit_image', 'process', 'predict', 'run'];
            for (const pName of priorityNames) {
              const found = cfg.dependencies.find((d: any) => 
                d.api_name && d.api_name.toLowerCase() === pName && isRealInferenceDep(d)
              );
              if (found) {
                matchedDep = found;
                break;
              }
            }
          }

          // 3. Jika masih belum ditemukan, cari sembarang dependency yang isRealInferenceDep
          if (!matchedDep) {
            matchedDep = cfg.dependencies.find(isRealInferenceDep);
          }

          // 4. Fallback jika tidak ada yang punya image output eksplisit tapi nama cocok
          if (!matchedDep) {
            matchedDep = cfg.dependencies.find((d: any) => d.api_name && d.api_name.toLowerCase() === cleanReq);
          }

          if (matchedDep && matchedDep.api_name) {
            const endpointName = `/${matchedDep.api_name}`;
            const inputIds: number[] = matchedDep.inputs || [];
            
            const inputComponents: GradioInputComponent[] = [];
            if (Array.isArray(cfg.components)) {
              for (const id of inputIds) {
                const comp = cfg.components.find((c: any) => c.id === id);
                if (comp) {
                  inputComponents.push({
                    id,
                    type: comp.type || 'textbox',
                    label: comp.props?.label || '',
                    defaultValue: comp.props?.value ?? null
                  });
                }
              }
            }

            return {
              endpoint: endpointName,
              inputComponents
            };
          }
        }
      }
    }
  } catch (e) {
    console.warn("[HF-Inspect] Failed to inspect /config, will use requested endpoint directly:", e);
  }

  return {
    endpoint: requestedEndpoint.startsWith('/') ? requestedEndpoint : `/${requestedEndpoint}`,
    inputComponents: []
  };
};

// CopoZ Qwen Image Edit Identity & Anatomy Constants (Pure Positive Directives)
export const QWEN_IDENTITY_BASE = "ABSOLUTE FACIAL IDENTITY LOCK FROM IMAGE 1: Reproduce the exact same person with identical face, facial features, eyes, nose, mouth, face shape, skin tone, hairstyle, and hair color strictly from Image 1 so she remains 100% recognizable. Image 1 is the sole facial biometric reference. Do NOT alter her face using Image 2 or Image 3.";
export const QWEN_IDENTITY_EMPHASIS = "Faithfully maintaining her exact face likeness from Image 1 is the absolute highest priority.";
export const QWEN_IDENTITY_MAX = "Reproduce her exact facial proportions precisely as shown in Image 1 reference.";
export const QWEN_IDENTITY_NEG = "";

export const QWEN_ANATOMY_POS = "Anatomically correct human body with two arms, two legs, and two hands each having exactly five distinct well-defined fingers.";
export const QWEN_ANATOMY_NEG = "";
export const QWEN_REALISM_POS = "Ultra-realistic photographic quality in high resolution: sharp focus, fine skin texture, crisp fabric details, clear eyes.";

// Couple & Two-Person Anatomy & Identity Constants (Pure Positive Directives)
export const QWEN_COUPLE_IDENTITY_POS = "Two distinct individuals in frame with separate identities: Character 1 matches the female reference identity from Image 1, and Character 2 matches the user reference identity. Each person has a unique distinct face and expression.";

export const QWEN_COUPLE_ANATOMY_POS = "Two completely separate bodies: exactly two distinct heads, four arms, four legs, and five fingers per hand, cleanly aligned with natural joints.";

export const QWEN_COUPLE_NEG = "";

export const MASTER_COUPLE_NEGATIVE_PROMPT = "";

export const MASTER_NEGATIVE_PROMPT = "";

export const ANATOMY_GUARD_INJECTION = `${QWEN_IDENTITY_BASE} ${QWEN_IDENTITY_EMPHASIS} ${QWEN_IDENTITY_MAX} ${QWEN_ANATOMY_POS} ${QWEN_REALISM_POS}`;
export const COUPLE_ANATOMY_GUARD_INJECTION = `${QWEN_COUPLE_IDENTITY_POS} ${QWEN_COUPLE_ANATOMY_POS} ${QWEN_REALISM_POS}`;

/**
 * Fungsi Utama: Generate/Edit Gambar dengan Hugging Face Space (Qwen Image Edit / CopoZ AIO LoRAs)
 * Dilengkapi auto-rotation token jika kuota ZeroGPU akun habis dan proxy CORS.
 */
export const generateWithHuggingFaceSpace = async (
  inputImage: string | null,
  prompt: string,
  config: HFSpaceConfig,
  onStatusUpdate?: (status: string, previewInfo?: { slot: number; label: string; url: string }) => void,
  extraRefImage?: string | null,
  additionalImages?: string[]
): Promise<string> => {
  if (!inputImage) {
    throw new Error("Model Hugging Face (Qwen Image Edit) adalah model Image-to-Image yang memerlukan gambar dasar karakter untuk diedit. Gambar dasar tidak ditemukan.");
  }

  const shouldInjectAnatomy = config.injectAnatomyGuard ?? true;

  // Format prompt dengan Direct Prompt Injection & Anatomy Guard jika belum tersemat & diaktifkan
  const hasAnatomyClause = prompt.toLowerCase().includes('anatomy') || prompt.toLowerCase().includes('proportions') || prompt.toLowerCase().includes('identical face') || prompt.toLowerCase().includes('separate identities');
  const hasSoloClause = prompt.toLowerCase().includes('solo') || prompt.toLowerCase().includes('single person') || prompt.toLowerCase().includes('solo subject');
  const isCouplePrompt = prompt.toLowerCase().includes('couple') || 
                         prompt.toLowerCase().includes('two distinct') || 
                         prompt.toLowerCase().includes('two-person') || 
                         prompt.toLowerCase().includes('two people') ||
                         (prompt.toLowerCase().includes('character 1') && prompt.toLowerCase().includes('character 2'));

  let effectivePrompt = prompt.trim();
  const isSingleImageOnly = !extraRefImage && (!additionalImages || additionalImages.length === 0);

  if (isSingleImageOnly) {
    // 🛡️ FIRST PAP PURIFICATION: Mencegah sisa frasa pakaian tergeletak pada PAP pertama kali
    effectivePrompt = effectivePrompt
      .replace(/,\s*her discarded clothes[^,\.]*/gi, '')
      .replace(/,\s*discarded clothes[^,\.]*/gi, '')
      .replace(/her discarded clothes[^,\.]*/gi, '')
      .replace(/discarded clothes[^,\.]*/gi, '')
      .replace(/empty inanimate garments[^,\.]*/gi, '');
  }

  if (isCouplePrompt) {
    // 🛡️ COUPLE MODE ANATOMY & IDENTITY GUARD:
    if (shouldInjectAnatomy && !hasAnatomyClause) {
      effectivePrompt = `${effectivePrompt}, ${COUPLE_ANATOMY_GUARD_INJECTION}`;
    }
  } else {
    // 🛡️ SOLO MODE ANATOMY & IDENTITY GUARD (Pure Positive Directives):
    if (shouldInjectAnatomy && !hasSoloClause) {
      if (isSingleImageOnly) {
        effectivePrompt = `${effectivePrompt}. SOLO SUBJECT: Strictly ONE single female subject in frame (Character 1 from Image 1). Image 1 provides the facial identity, skin tone, and hairstyle. The room setting is clean, orderly, and well-lit.`;
      } else {
        effectivePrompt = `${effectivePrompt}. SOLO SUBJECT: Strictly ONE single female subject in frame (Character 1 from Image 1). Image 1 provides the facial identity, skin tone, and hairstyle. Additional reference images provide inanimate clothing and room setting details. The background room setting is tidy and organized.`;
      }
    }
    if (shouldInjectAnatomy && !hasAnatomyClause) {
      effectivePrompt = `${effectivePrompt}, ${ANATOMY_GUARD_INJECTION}`;
    }
  }

  const spaceHost = await normalizeHFSpaceUrl(config.spaceUrl);
  const tokens = parseHFTokens(config.tokens);
  const requestedEndpoint = config.apiEndpoint || '/infer';

  // Otomatis inspeksi /config Space untuk menentukan endpoint dan struktur argumen
  onStatusUpdate?.("Mendeteksi konfigurasi Space ZeroGPU...", inputImage ? { slot: 1, label: "Image 1: Base (Identitas Karakter)", url: inputImage } : undefined);
  const { endpoint, inputComponents } = await inspectSpaceEndpoint(spaceHost, requestedEndpoint);

  // Gunakan token yang sedang aktif dan belum limit untuk upload referensi awal
  const initialTokenObj = getNextAvailableToken(tokens);
  const activeTokenForUpload = initialTokenObj?.token || undefined;

  // Format gambar untuk Gradio
  onStatusUpdate?.("Mempersiapkan gambar karakter (Image 1: Base/Target)...", { slot: 1, label: "Image 1: Base (Identitas Karakter)", url: inputImage });
  let formattedImage: any = null;
  if (inputImage) {
    formattedImage = await uploadToGradio(spaceHost, inputImage, activeTokenForUpload);
  }

  let formattedExtraRef: any = null;
  if (extraRefImage) {
    try {
      onStatusUpdate?.("Mempersiapkan referensi tambahan (Image 2)...", { slot: 2, label: "Image 2: Referensi (Pose/Outfit)", url: extraRefImage });
      formattedExtraRef = await uploadToGradio(spaceHost, extraRefImage, activeTokenForUpload);
    } catch (e) {
      console.warn("[HF-ZeroGPU] Gagal mengunggah extra reference image:", e);
    }
  }

  const formattedGallery: any[] = [];
  if (Array.isArray(additionalImages) && additionalImages.length > 0) {
    for (let idx = 0; idx < additionalImages.length; idx++) {
      const addImg = additionalImages[idx];
      const slotNum = 3 + idx;
      try {
        onStatusUpdate?.(`Mempersiapkan referensi tambahan (Image ${slotNum})...`, { slot: slotNum, label: `Image ${slotNum}: Ruangan & PAP Sebelumnya`, url: addImg });
        const up = await uploadToGradio(spaceHost, addImg, activeTokenForUpload);
        if (up) formattedGallery.push(up);
      } catch (e) {
        console.warn("[HF-ZeroGPU] Gagal mengunggah gallery reference image:", e);
      }
    }
  }

  // Kembalikan preview jangkar ke Image 1 (Foto Profil Karakter) agar user melihat foto profil sebagai identitas utama
  if (inputImage) {
    onStatusUpdate?.("Seluruh referensi gambar terunggah. Menghubungkan ke Space ZeroGPU...", { slot: 1, label: "Image 1: Base (Identitas Karakter)", url: inputImage });
  }

  // Bangun payload data dinamis berdasarkan skema komponen Space
  let payloadData: any[] = [];

  if (inputComponents.length > 0) {
    let imageInputCount = 0;

    for (const comp of inputComponents) {
      const type = (comp.type || '').toLowerCase();
      const label = (comp.label || '').toLowerCase();

      if (type === 'textbox' || label.includes('prompt')) {
        if (label.includes('negative') || label.includes('neg_prompt') || label.includes('neg prompt')) {
          payloadData.push("");
        } else {
          payloadData.push(effectivePrompt);
        }
      } else if (type === 'image' || label.includes('image')) {
        imageInputCount++;
        if (imageInputCount === 1) {
          // Slot 1: Base / Target Image (Foto Profil / Wajah Karakter)
          payloadData.push(formattedImage || null);
        } else if (imageInputCount === 2) {
          // Slot 2: Extra Reference Image (Foto Pakaian / Outfit)
          payloadData.push(formattedExtraRef || null);
        } else {
          payloadData.push(null);
        }
      } else if (type === 'gallery' || label.includes('additional')) {
        // Slot Gallery: Additional Images (auto-indexed after Image 1/2)
        payloadData.push(formattedGallery);
      } else if (comp.defaultValue !== undefined && comp.defaultValue !== null) {
        payloadData.push(comp.defaultValue);
      } else if (type === 'slider') {
        if (label.includes('identity lock')) payloadData.push(shouldInjectAnatomy ? 65 : 0);
        else payloadData.push(0);
      } else if (type === 'checkbox') {
        if (label.includes('identity') || label.includes('face') || label.includes('hands') || label.includes('anatomy')) {
          payloadData.push(shouldInjectAnatomy);
        } else {
          payloadData.push(false);
        }
      } else {
        payloadData.push(null);
      }
    }
  } else {
    // Default fallback jika /config tidak terdeteksi
    payloadData = formattedImage ? [formattedImage, effectivePrompt] : [effectivePrompt];
  }

  // Maksimum percobaan rotasi sejumlah token yang tersedia
  const maxAttempts = Math.max(1, tokens.length);
  let attempts = 0;
  let lastError: any = null;

  while (attempts < maxAttempts) {
    attempts++;
    const currentTokenObj = getNextAvailableToken(tokens);
    const tokenToUse = currentTokenObj?.token || undefined;
    const tokenDisplay = tokens.length > 0 
      ? `(Akun #${currentTokenIndex + 1}/${tokens.length})` 
      : '(Mode Publik / Tanpa Token)';

    onStatusUpdate?.(`Menghubungkan ke Space ZeroGPU ${tokenDisplay}...`);

    try {
      let rawResult: any;
      try {
        // Coba Gradio modern SSE terlebih dahulu via proxy
        rawResult = await callGradioModernSSE(spaceHost, endpoint, payloadData, tokenToUse, onStatusUpdate);
      } catch (sseErr: any) {
        console.warn("[HF-ZeroGPU] Modern SSE call failed:", sseErr);
        const errMsg = (sseErr?.message || String(sseErr)).toLowerCase();
        if (isQuotaOrLimitError(sseErr) || errMsg.includes('space execution') || errMsg.includes('stream') || errMsg.includes('zerogpu')) {
          throw sseErr;
        }
        // Hanya coba legacy jika endpoint modern /call tidak ditemukan sama sekali pada inisialisasi awal
        if (errMsg.includes('404') && errMsg.includes('gagal memulai tugas')) {
          rawResult = await callGradioLegacy(spaceHost, endpoint, payloadData, tokenToUse, onStatusUpdate);
        } else {
          throw sseErr;
        }
      }

      onStatusUpdate?.("Menerima hasil foto dari ZeroGPU...");
      const finalImageBase64 = await extractImageFromGradioOutput(rawResult, spaceHost, tokenToUse);
      return finalImageBase64;

    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || String(err);
      console.warn(`[HF-ZeroGPU] Percobaan ${attempts} (Akun #${currentTokenIndex + 1}) gagal:`, errMsg);

      // JIKA MASIH ADA TOKEN CADANGAN (attempts < maxAttempts):
      // SELALU rotasikan ke token berikutnya dan coba lagi! Jangan pernah menyerah jika ada akun cadangan.
      if (tokens.length > 1 && attempts < maxAttempts) {
        rotateToken(tokens, onStatusUpdate);
        continue;
      } else if (tokens.length > 0 && attempts >= maxAttempts) {
        // Semua token akun sudah dicoba. Coba satu kali antrean publik tanpa token jika akun token habis kuotanya
        try {
          onStatusUpdate?.("Semua token akun telah dicoba. Mencoba antrean publik ZeroGPU (tanpa token)...");
          const pubResult = await callGradioModernSSE(spaceHost, endpoint, payloadData, undefined, onStatusUpdate);
          return await extractImageFromGradioOutput(pubResult, spaceHost, undefined);
        } catch (pubErr) {
          console.warn("[HF-ZeroGPU] Public fallback attempt failed:", pubErr);
        }
        break;
      } else {
        break;
      }
    }
  }

  const errDetail = lastError?.message || String(lastError);
  if (isQuotaOrLimitError(lastError) || tokens.length > 0) {
    throw new Error(`Semua kuota ZeroGPU akun Hugging Face Anda telah habis (${tokens.length} akun dicek). Silakan ganti atau tambahkan token akun lain di Pengaturan.`);
  }

  throw new Error(`Gagal memproses gambar di Hugging Face Space: ${errDetail}`);
};

/**
 * Menguji koneksi Space dan Token Hugging Face via Proxy
 */
export const testHuggingFaceSpace = async (
  rawUrl: string,
  tokensInput: string,
  endpoint: string = '/infer'
): Promise<HFTestResult> => {
  const tokens = parseHFTokens(tokensInput);
  
  try {
    const spaceHost = await normalizeHFSpaceUrl(rawUrl);
    const testToken = tokens[0] || undefined;
    const headers: Record<string, string> = {};
    if (testToken) headers['Authorization'] = `Bearer ${testToken}`;

    let spaceStage = "UNKNOWN";
    let hardware = "ZeroGPU / CPU";
    let spaceName = spaceHost.replace('https://', '').replace('.hf.space', '');

    try {
      const configResp = await proxyFetch(`${spaceHost}/config`, { headers });
      if (configResp.ok) {
        const text = await configResp.text();
        if (text.startsWith('{')) {
          const cfg = JSON.parse(text);
          spaceStage = "RUNNING";
          if (cfg?.title) spaceName = cfg.title;
        }
      } else if (configResp.status === 401 || configResp.status === 403) {
        return {
          success: false,
          message: `Space ini bersifat Private atau memerlukan Token yang valid (HTTP ${configResp.status}).`,
          activeTokenCount: tokens.length
        };
      }
    } catch (e) {}

    // Periksa status via API Hugging Face
    const hfMatch = (rawUrl || '').match(/huggingface\.co\/spaces\/([^\/]+)\/([^\/]+)/i);
    let targetOwner = hfMatch ? hfMatch[1] : '';
    let targetRepo = hfMatch ? hfMatch[2] : '';

    if (!targetOwner && spaceHost.includes('copoz-qwen-image-edit')) {
      targetOwner = 'CopoZ';
      targetRepo = 'Qwen-Image-Edit-Rapid-AIO-Loras-Plus';
    } else if (!targetOwner && spaceHost.includes('qwen-qwen-image-edit')) {
      targetOwner = 'Qwen';
      targetRepo = 'Qwen-Image-Edit';
    }

    if (targetOwner && targetRepo) {
      try {
        const apiResp = await proxyFetch(`https://huggingface.co/api/spaces/${targetOwner}/${targetRepo}`, { headers });
        if (apiResp.ok) {
          const text = await apiResp.text();
          if (text.startsWith('{')) {
            const apiData = JSON.parse(text);
            spaceStage = apiData?.runtime?.stage || spaceStage;
            hardware = apiData?.runtime?.hardware?.current || hardware;
            spaceName = apiData?.id || spaceName;
          }
        }
      } catch (e) {}
    }

    const activePreview = testToken ? `${testToken.slice(0, 6)}...${testToken.slice(-4)}` : 'Tanpa Token';

    return {
      success: true,
      message: `Terhubung ke Space! Status: ${spaceStage} (${hardware}). Siap dipakai dengan ${tokens.length} akun/token.`,
      spaceName,
      spaceStage,
      hardware,
      activeTokenCount: tokens.length,
      activeTokenPreview: activePreview
    };

  } catch (err: any) {
    return {
      success: false,
      message: `Gagal terhubung ke Space: ${err.message || String(err)}`,
      activeTokenCount: tokens.length
    };
  }
};

