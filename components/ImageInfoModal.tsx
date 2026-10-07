import React, { useState, useEffect } from 'react';
import { analyzePreviousPapImage } from '../services/geminiService';

interface ImageInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  imagePrompt?: string;
  caption?: string;
  outfit?: string;
  model?: string;
  timestamp?: number;
  isBackgroundDark?: boolean;
  themeHex?: string;
  agentName?: string;
}

export const ImageInfoModal: React.FC<ImageInfoModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  imagePrompt,
  caption,
  outfit,
  model,
  timestamp,
  isBackgroundDark = true,
  themeHex = '#ec4899',
  agentName
}) => {
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [fileSizeStr, setFileSizeStr] = useState<string>('-');
  const [imageFormat, setImageFormat] = useState<string>('PNG');
  const [visionAnalysis, setVisionAnalysis] = useState<{
    outfitPrompt: string;
    roomPrompt: string;
    isNude: boolean;
  } | null>(null);
  const [isAnalyzingVision, setIsAnalyzingVision] = useState<boolean>(false);

  // Zoom & Pan Interactive State
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialTouchDistRef = React.useRef<number | null>(null);
  const initialTouchScaleRef = React.useRef<number>(1);

  const handleZoomIn = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setScale(prev => Math.min(prev + 0.5, 5));
  };

  const handleZoomOut = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setScale(prev => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [isOpen, imageUrl]);

  // Touch handlers for Touch Pinch and Pan
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialTouchDistRef.current = dist;
      initialTouchScaleRef.current = scale;
    } else if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialTouchDistRef.current !== null) {
      if (e.cancelable) e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / initialTouchDistRef.current;
      const nextScale = Math.min(Math.max(initialTouchScaleRef.current * factor, 1), 5);
      setScale(nextScale);
      if (nextScale === 1) setPosition({ x: 0, y: 0 });
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      if (e.cancelable) e.preventDefault();
      setPosition({
        x: e.touches[0].clientX - dragStartRef.current.x,
        y: e.touches[0].clientY - dragStartRef.current.y
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      initialTouchDistRef.current = null;
    }
    if (e.touches.length === 0) {
      setIsDragging(false);
      if (scale <= 1) setPosition({ x: 0, y: 0 });
    }
  };

  // Mouse handlers for drag and wheel
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      e.preventDefault();
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      e.preventDefault();
      setPosition({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.25 : -0.25;
    setScale(prev => {
      const next = Math.min(Math.max(prev + zoomFactor, 1), 5);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scale > 1) {
      handleResetZoom();
    } else {
      setScale(2.5);
    }
  };

  // Helper untuk mengekstrak Atasan, Bawahan, dan Detail Ruangan secara akurat
  const extractGarmentAndRoomDetails = (
    outfitStr?: string,
    promptStr?: string,
    captionStr?: string
  ) => {
    const fullText = `${outfitStr || ''} ${promptStr || ''} ${captionStr || ''}`;
    const lowText = fullText.toLowerCase();

    // Deteksi status pelepasan pakaian
    const isBottomless = lowText.includes('bottomless') || lowText.includes('buka celana') || lowText.includes('tanpa celana');
    const isTopless = lowText.includes('topless') || lowText.includes('buka baju') || lowText.includes('tanpa baju');
    const isFullNude = lowText.includes('completely undressed') || lowText.includes('full nudity') || lowText.includes('bare skin') || lowText.includes('telanjang');

    if (isFullNude) {
      return {
        topGarment: 'Dilepas / Tanpa Atasan (Bare Skin)',
        bottomGarment: 'Dilepas / Tanpa Bawahan (Bare Skin)',
        roomDetail: extractRoomDetail(fullText, lowText)
      };
    }

    if (isTopless && !isBottomless) {
      return {
        topGarment: 'Dilepas / Tanpa Atasan (Bare Skin)',
        bottomGarment: extractBottomGarment(fullText) || 'Celana / Bawahan',
        roomDetail: extractRoomDetail(fullText, lowText)
      };
    }

    if (isBottomless && !isTopless) {
      return {
        topGarment: extractTopGarment(fullText) || 'Baju / Atasan',
        bottomGarment: 'Dilepas / Tanpa Bawahan (Bare Skin)',
        roomDetail: extractRoomDetail(fullText, lowText)
      };
    }

    // Cek apakah outfit adalah MURNI 1-piece terhubung (Dress, Daster, Gamis, Onesie, Bodysuit)
    // SANGAT PENTING: Pajamas, piyama, bikini, dan setelan BUKAN 1-piece, melainkan 2-piece (atasan kemeja/kaos + bawahan celana)!
    const isPureOnePiece = outfitStr && /\b(?:dress|daster|gamis|onesie|bodysuit|gown|nightdress|nightgown)\b/i.test(outfitStr) && !/\b(?:and|paired with|dan|dipadukan|pajamas|piyama|shorts|pants|celana)\b/i.test(outfitStr);

    if (isPureOnePiece) {
      return {
        topGarment: outfitStr,
        bottomGarment: 'Terhubung 1-Piece (Gaun / Dress / Daster)',
        roomDetail: extractRoomDetail(fullText, lowText)
      };
    }

    // Jika outfit mengandung piyama / pajamas set:
    if (/\b(?:pajamas|piyama)\b/i.test(fullText)) {
      let topDesc = 'Atasan Kemeja / Kaos Piyama Satin';
      let bottomDesc = 'Celana Panjang / Pendek Piyama Satin Senada';

      if (outfitStr) {
        topDesc = `Atasan Piyama (${outfitStr})`;
        bottomDesc = `Celana Piyama Senada (${outfitStr})`;
      } else {
        const pijamaMatch = fullText.match(/\b[^,.]*?(?:pajamas|piyama)[^,.]*?/i);
        if (pijamaMatch && pijamaMatch[0]) {
          topDesc = `Atasan Piyama (${pijamaMatch[0].trim()})`;
          bottomDesc = `Celana Piyama Senada (${pijamaMatch[0].trim()})`;
        }
      }

      const specificBottom = extractBottomGarment(fullText);
      if (specificBottom) {
        bottomDesc = specificBottom;
      }

      const specificTop = extractTopGarment(fullText);
      if (specificTop) {
        topDesc = specificTop;
      }

      return {
        topGarment: topDesc,
        bottomGarment: bottomDesc,
        roomDetail: extractRoomDetail(fullText, lowText)
      };
    }

    // Ekstraksi 2-piece umum (Atasan & Bawahan terpisah)
    let extractedTop = extractTopGarment(fullText);
    let extractedBottom = extractBottomGarment(fullText);

    if (!extractedTop && outfitStr) {
      extractedTop = outfitStr;
    }
    if (!extractedBottom) {
      extractedBottom = 'Celana / Bawahan Senada';
    }

    return {
      topGarment: extractedTop || 'Atasan / Baju',
      bottomGarment: extractedBottom || 'Bawahan / Celana',
      roomDetail: extractRoomDetail(fullText, lowText)
    };
  };

  const extractTopGarment = (fullText: string): string | null => {
    const splitMatch = fullText.match(/\b([^,.]*?(?:top|shirt|t-shirt|crop top|tanktop|bra|blouse|sweater|hoodie|kaos|baju|kebaya)[^,.]*?)\b(?:\s+(?:and|paired with|with|dan|dipadukan dengan)\s+|\b)/i);
    if (splitMatch && splitMatch[1]) {
      return splitMatch[1].trim();
    }
    const topMatch = fullText.match(/\b[^,.]*?(?:top|shirt|t-shirt|crop top|tanktop|bra|blouse|sweater|hoodie|kaos|baju|kebaya)[^,.]*?/i);
    if (topMatch && topMatch[0]) {
      return topMatch[0].trim();
    }
    return null;
  };

  const extractBottomGarment = (fullText: string): string | null => {
    const bottomMatch = fullText.match(/\b[^,.]*?(?:shorts|pants|jeans|skirt|hotpants|panties|trousers|celana|rok|legging)[^,.]*?/i);
    if (bottomMatch && bottomMatch[0]) {
      return bottomMatch[0].trim();
    }
    return null;
  };

  const extractRoomDetail = (fullText: string, lowText: string): string => {
    const roomMatch = fullText.match(/(?:exact same room:|in a |room setting:|in an |in the |setting:)\s*([^,.;\n]+(?:,[^,.;\n]+)?)/i);
    if (roomMatch && roomMatch[1]) {
      return roomMatch[1].trim();
    } else if (lowText.includes('bedroom') || lowText.includes('kamar')) {
      return 'Kamar tidur interior dengan tempat tidur, sprei, dan lampu kamar hangat';
    } else if (lowText.includes('bathroom') || lowText.includes('shower') || lowText.includes('mandi')) {
      return 'Kamar mandi / Area shower bernuansa segar';
    } else if (lowText.includes('living room') || lowText.includes('ruang tamu')) {
      return 'Ruang tamu santai dengan sofa dan pencahayaan alami';
    } else if (lowText.includes('car') || lowText.includes('mobil')) {
      return 'Interior dalam mobil';
    } else if (lowText.includes('outdoor') || lowText.includes('pantai') || lowText.includes('park')) {
      return 'Latar suasana luar ruangan (Outdoor)';
    }
    return 'Kamar tidur bernuansa intim, kasur, sprei, dan pencahayaan hangat';
  };

  const parsedDetails = extractGarmentAndRoomDetails(outfit, imagePrompt, caption);

  const effectiveDetails = visionAnalysis ? {
    topGarment: visionAnalysis.isNude 
      ? 'Dilepas / Tanpa Atasan (Bare Skin)' 
      : visionAnalysis.outfitPrompt,
    bottomGarment: visionAnalysis.isNude 
      ? 'Dilepas / Tanpa Bawahan (Bare Skin)' 
      : (/\b(?:dress|daster|gamis|onesie|bodysuit|gown|nightdress|nightgown|slip|robe)\b/i.test(visionAnalysis.outfitPrompt) && !/\b(?:shorts|pants|jeans|skirt|celana|rok|pajamas|piyama)\b/i.test(visionAnalysis.outfitPrompt)
          ? 'Terhubung 1-Piece (Gaun Tidur Satin / Slip Nightdress)'
          : (/\b(?:pajamas|piyama)\b/i.test(visionAnalysis.outfitPrompt)
              ? 'Celana Piyama Satin Senada'
              : (extractBottomGarment(visionAnalysis.outfitPrompt) || 'Celana / Bawahan Senada'))),
    roomDetail: visionAnalysis.roomPrompt,
    isVision: true
  } : {
    ...parsedDetails,
    isVision: false
  };

  // Hitung aspect ratio paling mendekati
  const calculateAspectRatio = (w: number, h: number): string => {
    if (!w || !h) return '-';
    const ratio = w / h;
    if (Math.abs(ratio - 1) < 0.05) return '1:1 (Square)';
    if (Math.abs(ratio - 16 / 9) < 0.08) return '16:9 (Widescreen)';
    if (Math.abs(ratio - 9 / 16) < 0.08) return '9:16 (Portrait Story)';
    if (Math.abs(ratio - 4 / 3) < 0.08) return '4:3 (Landscape)';
    if (Math.abs(ratio - 3 / 4) < 0.08) return '3:4 (Portrait)';
    if (Math.abs(ratio - 3 / 2) < 0.08) return '3:2 (Photo)';
    if (Math.abs(ratio - 2 / 3) < 0.08) return '2:3 (Vertical)';
    return `${w}:${h}`;
  };

  useEffect(() => {
    if (!isOpen || !imageUrl) {
      setDimensions(null);
      setFileSizeStr('-');
      setVisionAnalysis(null);
      setIsAnalyzingVision(false);
      return;
    }

    // Panggil Visi AI secara otomatis untuk analisis forensik piksel foto
    if (imageUrl.startsWith('data:image/')) {
      setIsAnalyzingVision(true);
      analyzePreviousPapImage(imageUrl, outfit || caption || imagePrompt)
        .then(res => {
          setVisionAnalysis(res);
        })
        .catch(err => {
          console.warn("[Vision Analysis] Error:", err);
        })
        .finally(() => {
          setIsAnalyzingVision(false);
        });
    }

    // Hitung ukuran file dari Base64
    if (imageUrl.startsWith('data:')) {
      const headerPart = imageUrl.split(',')[0];
      const dataPart = imageUrl.split(',')[1] || '';
      
      // Deteksi format mime
      const mimeMatch = headerPart.match(/:(.*?);/);
      if (mimeMatch && mimeMatch[1]) {
        const mime = mimeMatch[1].toLowerCase();
        if (mime.includes('png')) setImageFormat('PNG');
        else if (mime.includes('jpeg') || mime.includes('jpg')) setImageFormat('JPEG');
        else if (mime.includes('webp')) setImageFormat('WEBP');
        else if (mime.includes('gif')) setImageFormat('GIF');
        else setImageFormat(mime.split('/')[1]?.toUpperCase() || 'IMAGE');
      }

      // Hitung byte size
      const padding = (dataPart.endsWith('==') ? 2 : dataPart.endsWith('=') ? 1 : 0);
      const byteSize = (dataPart.length * (3 / 4)) - padding;
      if (byteSize > 1024 * 1024) {
        setFileSizeStr(`${(byteSize / (1024 * 1024)).toFixed(2)} MB`);
      } else if (byteSize > 0) {
        setFileSizeStr(`${Math.round(byteSize / 1024)} KB`);
      } else {
        setFileSizeStr('-');
      }
    } else {
      setImageFormat('URL / Remote');
      setFileSizeStr('-');
    }

    // Ambil resolusi natural gambar
    const img = new Image();
    img.onload = () => {
      setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      setDimensions(null);
    };
    img.src = imageUrl;
  }, [isOpen, imageUrl]);

  if (!isOpen || !imageUrl) return null;

  const handleCopyPrompt = async () => {
    const textToCopy = imagePrompt || caption || 'No prompt available';
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch (err) {
      console.error('Failed to copy prompt:', err);
    }
  };

  const formattedDate = timestamp ? new Date(timestamp).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) : '-';

  const effectivePrompt = imagePrompt || caption || 'Prompt tidak tercatat dalam riwayat pesan ini.';

  return (
    <div 
      className="fixed inset-0 z-[500] flex items-center justify-center p-3 md:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className={`w-full max-w-md md:max-w-2xl max-h-[85vh] md:max-h-[88vh] flex flex-col rounded-3xl p-4 md:p-6 shadow-2xl border transition-all duration-300 animate-in zoom-in-95 ${
          isBackgroundDark 
            ? 'bg-zinc-900/95 border-white/15 text-white shadow-black/80' 
            : 'bg-white/95 border-black/10 text-zinc-900 shadow-xl'
        }`}
        style={{
          boxShadow: `0 20px 50px rgba(0,0,0,0.6), 0 0 30px ${themeHex}20`
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Header Tetap (Fixed Header) */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0 mb-3">
          <div className="flex items-center gap-2.5">
            <div 
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-md font-bold text-sm shrink-0"
              style={{ backgroundColor: themeHex }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight leading-none">Informasi Gambar</h2>
              <p className="text-[11px] opacity-60 font-medium mt-0.5">
                {agentName ? `PAP dari ${agentName}` : 'Detail foto & prompt'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`p-2 rounded-full transition-all cursor-pointer ${
              isBackgroundDark ? 'hover:bg-white/10 text-white/60 hover:text-white' : 'hover:bg-black/10 text-zinc-500 hover:text-black'
            }`}
            title="Tutup"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 2. Area Konten Ber-Scrollbar (Custom Scrollbar Container) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 md:pr-2 space-y-4">
          {/* Baris Atas: Responsive Mobile (Stacked) / Wide Screen (Side-by-Side Grid) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-stretch">
            {/* Interactive Image Preview Card with Pinch, Zoom, Pan & Reset */}
            <div 
              className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/80 h-52 md:h-full min-h-[200px] flex items-center justify-center touch-none select-none group cursor-pointer"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              onDoubleClick={handleDoubleClick}
            >
              {/* YouTube-style Ambient Light Glow Background */}
              {imageUrl && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
                  <img 
                    src={imageUrl} 
                    alt="" 
                    className="w-full h-full object-cover blur-2xl md:blur-3xl opacity-50 scale-125 saturate-150 transition-all duration-500"
                    aria-hidden="true"
                  />
                  <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" />
                </div>
              )}

              <img 
                src={imageUrl} 
                alt="Preview" 
                className="relative z-10 w-full h-full object-contain pointer-events-none select-none transition-transform drop-shadow-2xl"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  transformOrigin: 'center center',
                  transition: isDragging ? 'none' : 'transform 0.15s ease-out'
                }}
              />

              {/* Floating Overlay Controls on Image Preview */}
              <div className="absolute top-2 right-2 z-20 flex items-center gap-1 bg-black/70 backdrop-blur-md px-2 py-1 rounded-full border border-white/20 shadow-lg">
                <span className="text-[10px] font-black text-white px-1.5 py-0.5 rounded-full bg-white/10">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center text-xs font-bold transition-all"
                  title="Zoom Out (-)"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center text-xs font-bold transition-all"
                  title="Zoom In (+)"
                >
                  +
                </button>
                {(scale !== 1 || position.x !== 0 || position.y !== 0) && (
                  <button
                    type="button"
                    onClick={handleResetZoom}
                    className="px-2 py-0.5 rounded-full bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1"
                    title="Reset Zoom & Posisi"
                  >
                    ↺ Reset
                  </button>
                )}
              </div>

              {/* Touch Pinch & Pan Helper Banner */}
              <div className="absolute bottom-2 left-2.5 right-2.5 z-10 flex justify-between items-center text-white pointer-events-none">
                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-white/80">
                  {scale > 1 ? '✋ Geser untuk Pan' : '🤌 Pinch / Scroll untuk Zoom'}
                </span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/20">
                  {dimensions ? `${dimensions.width} × ${dimensions.height}` : 'Memuat...'}
                </span>
              </div>
            </div>

            {/* Grid Stats 2x2 */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Dimensi */}
              <div className={`p-2.5 rounded-2xl border ${isBackgroundDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
                <span className="text-[10px] uppercase tracking-wider font-bold opacity-50 block mb-0.5">Dimensi</span>
                <p className="text-xs font-black truncate" style={{ color: themeHex }}>
                  {dimensions ? `${dimensions.width} × ${dimensions.height} px` : '1024 × 768 px'}
                </p>
              </div>

              {/* Ukuran File */}
              <div className={`p-2.5 rounded-2xl border ${isBackgroundDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
                <span className="text-[10px] uppercase tracking-wider font-bold opacity-50 block mb-0.5">Ukuran File</span>
                <p className="text-xs font-black truncate" style={{ color: themeHex }}>
                  {fileSizeStr}
                </p>
              </div>

              {/* Format */}
              <div className={`p-2.5 rounded-2xl border ${isBackgroundDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
                <span className="text-[10px] uppercase tracking-wider font-bold opacity-50 block mb-0.5">Format</span>
                <p className="text-xs font-black truncate">
                  {imageFormat}
                </p>
              </div>

              {/* Waktu Pembuatan */}
              <div className={`p-2.5 rounded-2xl border ${isBackgroundDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
                <span className="text-[10px] uppercase tracking-wider font-bold opacity-50 block mb-0.5">Waktu Render</span>
                <p className="text-[11px] font-semibold truncate opacity-80">
                  {formattedDate}
                </p>
              </div>
            </div>
          </div>

          {/* Detail Pakaian & Ruangan (Top Garment, Bottom Garment, Detail Ruangan) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider opacity-70 flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Detail Pakaian & Latar Ruangan
              </span>
              {isAnalyzingVision ? (
                <span className="text-[9px] font-bold text-indigo-400 animate-pulse flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                  Analisis Piksel...
                </span>
              ) : effectiveDetails.isVision ? (
                <span className="text-[8px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ✨ Visi AI Real-time
                </span>
              ) : null}
            </div>

            <div className={`p-3.5 rounded-2xl border space-y-2.5 ${isBackgroundDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
              {/* Top Garment */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] uppercase tracking-wider font-extrabold opacity-50 flex items-center gap-1">
                  👕 Top Garment (Atasan)
                </span>
                <p className="text-xs font-extrabold text-emerald-400 leading-snug">
                  {effectiveDetails.topGarment}
                </p>
              </div>

              {/* Bottom Garment */}
              <div className="flex flex-col gap-0.5 pt-2 border-t border-white/5">
                <span className="text-[10px] uppercase tracking-wider font-extrabold opacity-50 flex items-center gap-1">
                  👖 Bottom Garment (Bawahan)
                </span>
                <p className="text-xs font-extrabold text-sky-400 leading-snug">
                  {effectiveDetails.bottomGarment}
                </p>
              </div>

              {/* Detail Ruangan */}
              <div className="flex flex-col gap-0.5 pt-2 border-t border-white/5">
                <span className="text-[10px] uppercase tracking-wider font-extrabold opacity-50 flex items-center gap-1">
                  🏠 Detail Ruangan & Setting
                </span>
                <p className="text-xs font-extrabold text-amber-300 leading-snug">
                  {effectiveDetails.roomDetail}
                </p>
              </div>
            </div>
          </div>

          {/* Prompt Section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider opacity-70 flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                Prompt Generator AI
              </span>
              <button
                onClick={handleCopyPrompt}
                className="text-[10px] font-bold px-2.5 py-1 rounded-xl flex items-center gap-1 transition-all border border-white/10 shadow-sm cursor-pointer active:scale-95"
                style={{
                  backgroundColor: copiedPrompt ? themeHex : `${themeHex}20`,
                  color: copiedPrompt ? '#ffffff' : themeHex
                }}
              >
                {copiedPrompt ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Tersalin!
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Salin Prompt
                  </>
                )}
              </button>
            </div>

            <div className={`p-3 rounded-2xl border text-xs max-h-32 overflow-y-auto custom-scrollbar font-mono leading-relaxed select-text ${
              isBackgroundDark 
                ? 'bg-black/40 border-white/10 text-white/90' 
                : 'bg-black/5 border-black/10 text-zinc-800'
            }`}>
              {effectivePrompt}
            </div>
          </div>
        </div>

        {/* 3. Tombol Bawah Tetap (Fixed Footer Button) */}
        <div className="pt-3 border-t border-white/10 shrink-0 mt-3">
          <button
            onClick={onClose}
            className="w-full py-2.5 md:py-3 rounded-2xl font-bold text-xs uppercase tracking-wider text-white shadow-lg transition-all active:scale-95 cursor-pointer"
            style={{
              backgroundColor: themeHex,
              boxShadow: `0 8px 20px ${themeHex}40`
            }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageInfoModal;
