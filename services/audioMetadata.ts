import { ID3Writer } from 'browser-id3-writer';
import * as lamejs from '@breezystack/lamejs';

/**
 * Converts PCM (16-bit, Mono) to MP3.
 */
export const convertPcmToMp3 = (pcmData: Int16Array, sampleRate: number): Uint8Array => {
  // @breezystack/lamejs is a more modern, ESM-friendly fork of lamejs
  const Mp3Encoder = (lamejs as any).Mp3Encoder || (lamejs as any).default?.Mp3Encoder;
  
  if (!Mp3Encoder) {
    throw new Error('MP3 Encoder (@breezystack/lamejs) not properly loaded');
  }

  const mp3encoder = new Mp3Encoder(1, sampleRate, 128);
  const mp3Data: any[] = [];
  
  const sampleBlockSize = 1152;
  for (let i = 0; i < pcmData.length; i += sampleBlockSize) {
    const sampleChunk = pcmData.subarray(i, i + sampleBlockSize);
    const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }
  }
  
  const mp3buf = mp3encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(mp3buf);
  }
  
  const totalLength = mp3Data.reduce((acc, buf) => acc + buf.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buf of mp3Data) {
    result.set(buf, offset);
    offset += buf.length;
  }
  
  return result;
};

/**
 * Processes an image to be square (1:1) by filling empty areas with a blurred version of itself.
 */
export const processCoverImage = async (base64Image: string, size: number = 600): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Image);
        return;
      }

      const w = img.width;
      const h = img.height;

      // 1. Draw Background (Blurred & Scaled to Cover)
      const bgScale = Math.max(size / w, size / h);
      const bgW = w * bgScale;
      const bgH = h * bgScale;
      const bgX = (size - bgW) / 2;
      const bgY = (size - bgH) / 2;

      ctx.save();
      ctx.filter = 'blur(30px) brightness(0.7)'; // Heavy blur and slightly darker
      ctx.drawImage(img, bgX - 50, bgY - 50, bgW + 100, bgH + 100); // Extra padding for blur edges
      ctx.restore();

      // Optional: Add a very subtle dark overlay to the background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, size, size);

      // 2. Draw Foreground (Scaled to Fit)
      const fgScale = Math.min(size / w, size / h);
      const fgW = w * fgScale;
      const fgH = h * fgScale;
      const fgX = (size - fgW) / 2;
      const fgY = (size - fgH) / 2;

      ctx.drawImage(img, fgX, fgY, fgW, fgH);

      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = (e) => {
      console.error("Image loading error for cover processing:", e);
      resolve(base64Image);
    };
    img.src = base64Image;
  });
};

/**
 * Adds ID3 metadata (including album art) to MP3 data.
 */
export const addMetadataToMp3 = async (
  mp3Data: Uint8Array,
  title: string,
  artist: string,
  album: string,
  coverImageBase64?: string,
  trackNumber: string = '1',
  lyrics?: string
): Promise<Uint8Array> => {
  // Ensure we have a clean ArrayBuffer of the exact size
  const mp3Buffer = mp3Data.buffer.slice(mp3Data.byteOffset, mp3Data.byteOffset + mp3Data.byteLength);
  const writer = new ID3Writer(mp3Buffer);
  
  // Replicating the Mutagen script logic as closely as possible
  (writer as any).setFrame('TIT2', title) // Title
        .setFrame('TPE1', [artist])      // Artist
        .setFrame('TALB', album)       // Album
        .setFrame('TCON', ['Audio Roleplay']) // Genre (matching your script)
        .setFrame('TYER', new Date().getFullYear().toString()) // Dynamic Year
        .setFrame('TRCK', trackNumber);        // Dynamic Track Number
        
  if (lyrics) {
    (writer as any).setFrame('USLT', {
      description: 'Lyrics',
      lyrics: lyrics,
      language: 'eng'
    });
  }
        
  if (coverImageBase64) {
    try {
      // Process image to be square with blurred background
      const processedCover = await processCoverImage(coverImageBase64);
      
      const parts = processedCover.split(',');
      if (parts.length < 2) throw new Error('Invalid base64 image');
      
      const data = parts[1];
      const header = parts[0];
      const mimeTypeMatch = header.match(/:(.*?);/);
      let mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';
      
      // Standardize mime type
      mimeType = mimeType.toLowerCase();
      if (mimeType === 'image/jpg') mimeType = 'image/jpeg';
      
      const binaryString = atob(data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Matching the APIC frame from your Mutagen script
      (writer as any).setFrame('APIC', {
        type: 3,             // Cover (front)
        data: bytes.buffer,
        description: 'Cover', // Matching desc=u'Cover'
        mimeType: mimeType
      });
    } catch (e) {
      console.error('Failed to add cover image to MP3:', e);
    }
  }
  
  writer.addTag();
  // browser-id3-writer v6 uses getUint8Array()
  const result = (writer as any).getUint8Array?.() || (writer as any).arrayBuffer || (writer as any).getBuffer?.();
  if (!result) throw new Error('Gagal mengambil buffer dari ID3Writer');
  return new Uint8Array(result);
};
