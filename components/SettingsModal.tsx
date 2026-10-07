import React, { useState, useRef } from 'react';
import { Eye, EyeOff, Key, Loader2, CheckCircle2, XCircle, Globe, Sparkles, SlidersHorizontal, Palette, Upload, Download, Check, Cpu, Server, ShieldCheck, ShieldAlert, Bell, Volume2, Smartphone } from "lucide-react";
import { validateApiKey, parseGeminiApiKeys } from "../services/geminiService";
import { GlobalAppearance, UserProfile } from '../types';
import GlassDropdown from './GlassDropdown';
import { saveGlobalGeminiSettingsSync, DEFAULT_QWEN_SPACE_URL } from '../services/dbService';
import { testHuggingFaceSpace, parseHFTokens, HFTestResult } from '../services/huggingFaceService';
import { 
  getNotificationSettings, 
  saveNotificationSettings, 
  requestNotificationPermission, 
  getSystemNotificationPermissionState, 
  playNotificationSound, 
  triggerVibration 
} from '../services/notificationService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  appearance: GlobalAppearance;
  setAppearance: (appearance: GlobalAppearance) => void;
  userProfile?: UserProfile;
  setUserProfile?: React.Dispatch<React.SetStateAction<UserProfile>>;
  themeHex?: string;
  isEmbeddedPage?: boolean;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  appearance, 
  setAppearance,
  userProfile,
  setUserProfile,
  themeHex,
  isEmbeddedPage = false
}) => {
  const [activeTab, setActiveTab] = useState<'appearance' | 'gemini' | 'notifications'>('appearance');
  const [notifSound, setNotifSound] = useState(() => getNotificationSettings().enableSound);
  const [notifVibration, setNotifVibration] = useState(() => getNotificationSettings().enableVibration);
  const [notifSystem, setNotifSystem] = useState(() => getNotificationSettings().enableSystemNotifications);
  const [permissionState, setPermissionState] = useState<NotificationPermission | 'unsupported'>(getSystemNotificationPermissionState());
  const [showApiKey, setShowApiKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [isTestingHF, setIsTestingHF] = useState(false);
  const [hfTestResult, setHfTestResult] = useState<HFTestResult | null>(null);
  const [showHfTokens, setShowHfTokens] = useState(false);
  const [mousePos, setMousePos] = useState<{ x: number, y: number } | null>(null);
  const [hoverColor, setHoverColor] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingRestore, setIsDraggingRestore] = useState(false);
  const wallpaperRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const isBackgroundDark = appearance?.isBackgroundDark ?? true;
  const dynamicTextColor = isBackgroundDark ? 'text-white' : 'text-zinc-900';
  const dynamicMutedTextColor = isBackgroundDark ? 'text-white/70' : 'text-zinc-500';
  const dynamicBorderColor = isBackgroundDark ? 'border-white/15' : 'border-zinc-300';
  const dynamicBg = isBackgroundDark ? 'bg-zinc-950/95' : 'bg-white/95';

  const getContrastColor = (hex?: string) => {
    if (!hex) return 'white';
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.slice(0, 2), 16);
    const g = parseInt(cleanHex.slice(2, 4), 16);
    const b = parseInt(cleanHex.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return 'white';
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? 'black' : 'white';
  };
  const contrastColor = getContrastColor(themeHex);

  const handleCheckApiKey = async () => {
    if (!userProfile?.geminiApiKey) return;
    setIsValidating(true);
    setValidationResult(null);
    try {
      const result = await validateApiKey(userProfile.geminiApiKey);
      setValidationResult(result);
    } catch (e) {
      setValidationResult({ valid: false, message: "Gagal cek API sayang.." });
    } finally {
      setIsValidating(false);
    }
  };

  const handleTestHF = async () => {
    const spaceToTest = userProfile?.hfSpaceUrl || DEFAULT_QWEN_SPACE_URL;
    setIsTestingHF(true);
    setHfTestResult(null);
    try {
      const res = await testHuggingFaceSpace(
        spaceToTest,
        userProfile?.hfTokens || '',
        userProfile?.hfApiEndpoint || '/infer'
      );
      setHfTestResult(res);
    } catch (e: any) {
      setHfTestResult({
        success: false,
        message: e?.message || "Gagal menguji koneksi ke Space",
        activeTokenCount: 0
      });
    } finally {
      setIsTestingHF(false);
    }
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    processFile(file);
  };

  const processFile = (file: File | undefined) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setAppearance({ ...appearance, background: reader.result as string });
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (appearance.accentColorMode !== 'wallpaper') {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (appearance.accentColorMode !== 'wallpaper') {
      const file = e.dataTransfer.files?.[0];
      processFile(file);
    }
  };

  const getColorAtPosition = (x: number, y: number, container: HTMLDivElement) => {
    const img = container.querySelector('img');
    if (!img || !img.naturalWidth) return null;

    const rect = container.getBoundingClientRect();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = rect.width;
    canvas.height = rect.height;

    // Mimic object-cover logic
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const cw = rect.width;
    const ch = rect.height;
    const scale = Math.max(cw / nw, ch / nh);
    const dw = nw * scale;
    const dh = nh * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;

    ctx.drawImage(img, dx, dy, dw, dh);
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    return `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`;
  };

  const handleWallpaperMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (appearance.accentColorMode !== 'wallpaper') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });

    const color = getColorAtPosition(x, y, e.currentTarget);
    if (color) setHoverColor(color);
  };

  const handleWallpaperMouseLeave = () => {
    setMousePos(null);
    setHoverColor(null);
  };

  const handleWallpaperClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (appearance.accentColorMode !== 'wallpaper') return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const hex = getColorAtPosition(x, y, e.currentTarget);
    if (hex) {
      setAppearance({
        ...appearance,
        accentColor: hex
      });
    }
  };

  const handleBackup = () => {
    const data = JSON.stringify(appearance, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
    link.download = `appearance_lumina_${dateStr}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement> | File) => {
    const file = e instanceof File ? e : e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.background && typeof json.blur === 'number') {
          setAppearance(json);
        } else {
          alert("Format file tidak valid sayang... 💦");
        }
      } catch (err) {
        alert("Gagal membaca file... 💦");
      }
    };
    reader.readAsText(file);
    if (!(e instanceof File)) e.target.value = '';
  };

  const onDragOverRestore = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingRestore(true);
  };

  const onDragLeaveRestore = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingRestore(false);
  };

  const onDropRestore = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingRestore(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.json')) {
      handleRestore(file);
    }
  };

  const isGemini38Tts = userProfile?.ttsModel === 'gemini-3.8-flash-tts';

  const standardVoiceOptions = [
    { value: 'Aoede', label: 'Aoede (Hangat)' },
    { value: 'Kore', label: 'Kore (Ceria)' },
    { value: 'Puck', label: 'Puck (Deep)' },
    { value: 'Charon', label: 'Charon (Elegan)' },
    { value: 'Zephyr', label: 'Zephyr (Ramah)' },
    { value: 'Fenrir', label: 'Fenrir (Enerjik)' }
  ];

  const gemini38VoiceOptions = [
    { value: 'Fola', label: 'Fola (Jernih & Ramah - Medium Pitch)' },
    { value: 'Aoede', label: 'Aoede (Hangat & Natural)' },
    { value: 'Kore', label: 'Kore (Ceria & Tegas)' },
    { value: 'Puck', label: 'Puck (Deep & Santai)' },
    { value: 'Charon', label: 'Charon (Elegan & Kalem)' },
    { value: 'Zephyr', label: 'Zephyr (Ramah & Jernih)' },
    { value: 'Fenrir', label: 'Fenrir (Enerjik & Bersemangat)' },
    { value: 'Leda', label: 'Leda (Muda & Lembut)' },
    { value: 'Orus', label: 'Orus (Tegas & Wibawa)' }
  ];

  const liveCallVoiceOptions = [
    { value: 'Aoede', label: 'Aoede (Hangat & Natural)' },
    { value: 'Kore', label: 'Kore (Ceria & Tegas)' },
    { value: 'Puck', label: 'Puck (Deep & Santai)' },
    { value: 'Charon', label: 'Charon (Elegan & Kalem)' },
    { value: 'Zephyr', label: 'Zephyr (Ramah & Jernih)' },
    { value: 'Fenrir', label: 'Fenrir (Enerjik & Bersemangat)' },
    { value: 'Leda', label: 'Leda (Muda & Lembut)' },
    { value: 'Orus', label: 'Orus (Tegas & Wibawa)' }
  ];

  const voiceChatOptions = isGemini38Tts ? gemini38VoiceOptions : standardVoiceOptions;

  const contentNode = (
    <div className={`relative w-full ${isEmbeddedPage ? 'h-full rounded-none border-none shadow-none pb-[85px] md:pb-0' : 'max-w-lg md:max-w-4xl lg:max-w-5xl xl:max-w-6xl md:h-[84vh] md:max-h-[720px] max-h-[92vh] rounded-3xl md:rounded-[32px] border ' + dynamicBorderColor + ' shadow-2xl'} ${dynamicBg} backdrop-blur-2xl overflow-hidden animate-in fade-in duration-300 flex flex-col md:flex-row`}>
      {/* DESKTOP / WIDE SIDEBAR (Visible on md+) */}
        <div className="hidden md:flex md:w-60 lg:w-72 flex-shrink-0 flex-col justify-between border-r border-white/10 p-5 lg:p-6 bg-black/15 select-none">
          <div className="space-y-6">
            {/* Header Brand */}
            <div className="flex items-center gap-3 pb-4 border-b border-white/10">
              <div 
                className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg transition-transform"
                style={{ backgroundColor: themeHex || '#6366f1' }}
              >
                <SlidersHorizontal className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className={`text-xs font-black uppercase tracking-[0.2em] truncate ${dynamicTextColor}`}>Pengaturan</h2>
                <p className={`text-[10px] ${dynamicMutedTextColor} font-medium truncate`}>Pusat Kontrol Lumina</p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="space-y-2">
              <button
                onClick={() => setActiveTab('appearance')}
                className={`w-full text-left p-3 rounded-2xl transition-all flex items-center gap-3 border ${
                  activeTab === 'appearance'
                    ? (isBackgroundDark ? 'bg-white/10 border-white/20 text-white shadow-md' : 'bg-black/10 border-black/10 text-zinc-900 shadow-md')
                    : 'border-transparent text-white/50 hover:bg-white/5 hover:text-white/80'
                }`}
                style={activeTab === 'appearance' ? { borderLeftColor: themeHex || '#6366f1', borderLeftWidth: '4px' } : {}}
              >
                <div className={`p-2 rounded-xl ${activeTab === 'appearance' ? 'bg-white/10' : 'bg-transparent'}`}>
                  <Palette className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold block truncate">Tampilan & Nuansa</span>
                  <span className={`text-[9px] ${dynamicMutedTextColor} block truncate`}>Wallpaper, tema, warna</span>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('gemini')}
                className={`w-full text-left p-3 rounded-2xl transition-all flex items-center gap-3 border ${
                  activeTab === 'gemini'
                    ? (isBackgroundDark ? 'bg-white/10 border-white/20 text-white shadow-md' : 'bg-black/10 border-black/10 text-zinc-900 shadow-md')
                    : 'border-transparent text-white/50 hover:bg-white/5 hover:text-white/80'
                }`}
                style={activeTab === 'gemini' ? { borderLeftColor: themeHex || '#6366f1', borderLeftWidth: '4px' } : {}}
              >
                <div className={`p-2 rounded-xl ${activeTab === 'gemini' ? 'bg-white/10' : 'bg-transparent'}`}>
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold block truncate">Gemini AI</span>
                  <span className={`text-[9px] ${dynamicMutedTextColor} block truncate`}>Model, suara, API key</span>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('notifications')}
                className={`w-full text-left p-3 rounded-2xl transition-all flex items-center gap-3 border ${
                  activeTab === 'notifications'
                    ? (isBackgroundDark ? 'bg-white/10 border-white/20 text-white shadow-md' : 'bg-black/10 border-black/10 text-zinc-900 shadow-md')
                    : 'border-transparent text-white/50 hover:bg-white/5 hover:text-white/80'
                }`}
                style={activeTab === 'notifications' ? { borderLeftColor: themeHex || '#6366f1', borderLeftWidth: '4px' } : {}}
              >
                <div className={`p-2 rounded-xl ${activeTab === 'notifications' ? 'bg-white/10' : 'bg-transparent'}`}>
                  <Bell className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold block truncate">Notifikasi & Getar</span>
                  <span className={`text-[9px] ${dynamicMutedTextColor} block truncate`}>Suara, getar Android, izin</span>
                </div>
              </button>
            </div>
          </div>

          {/* Sidebar Bottom: Status & Selesai button */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            <div className={`p-2.5 rounded-xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-white/5' : 'bg-black/5'} flex items-center justify-between`}>
              <span className={`text-[9px] font-bold uppercase tracking-wider ${dynamicMutedTextColor}`}>Aksen Aktif</span>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-full border border-white/30 shadow-sm" style={{ backgroundColor: themeHex || '#6366f1' }} />
                <span className={`text-[10px] font-mono font-bold ${dynamicTextColor}`}>{themeHex || '#6366f1'}</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full text-white font-bold py-2.5 px-4 rounded-xl shadow-lg active:scale-[0.98] transition-all uppercase tracking-wider text-[11px] opacity-95 hover:opacity-100 flex items-center justify-center gap-2"
              style={{ backgroundColor: themeHex || '#6366f1' }}
            >
              <Check className="w-3.5 h-3.5" />
              Selesai
            </button>
          </div>
        </div>

        {/* MOBILE HEADER (Visible on small screens only) */}
        <div className="px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 border-none flex flex-col select-none md:hidden flex-shrink-0">
          <div className="flex items-center justify-between mb-2.5 min-h-[32px]">
            <div className="flex items-center gap-3 min-w-0">
              <div 
                className={`w-1.5 h-6 md:h-7 ${isBackgroundDark ? 'bg-white' : 'bg-zinc-900'} rounded-full shrink-0 shadow-sm`} 
              />
              <h2 className={`text-2xl md:text-3xl font-black tracking-tighter ${dynamicTextColor} select-none truncate`}>Pengaturan</h2>
            </div>
            {!isEmbeddedPage && (
              <button onClick={onClose} className={`p-1.5 rounded-full ${isBackgroundDark ? 'hover:bg-white/10' : 'hover:bg-black/10'} transition-all ${dynamicMutedTextColor}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          
          <div className="flex space-x-1.5">
            <button
              onClick={() => setActiveTab('appearance')}
              className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all ${
                activeTab === 'appearance' 
                  ? (isBackgroundDark ? 'bg-white text-black' : 'bg-black text-white') 
                  : (isBackgroundDark ? 'text-white/50 hover:bg-white/10' : 'text-black/50 hover:bg-black/10')
              }`}
            >
              Tampilan
            </button>
            <button
              onClick={() => setActiveTab('gemini')}
              className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all ${
                activeTab === 'gemini' 
                  ? (isBackgroundDark ? 'bg-white text-black' : 'bg-black text-white') 
                  : (isBackgroundDark ? 'text-white/50 hover:bg-white/10' : 'text-black/50 hover:bg-black/10')
              }`}
            >
              Gemini AI
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all ${
                activeTab === 'notifications' 
                  ? (isBackgroundDark ? 'bg-white text-black' : 'bg-black text-white') 
                  : (isBackgroundDark ? 'text-white/50 hover:bg-white/10' : 'text-black/50 hover:bg-black/10')
              }`}
            >
              Notifikasi
            </button>
          </div>
        </div>

        {/* RIGHT MAIN PANEL (Landscape content workbench) */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          
          {/* Desktop Top Header Bar */}
          <div className="hidden md:flex items-center justify-between px-6 py-4 border-b border-white/10 select-none flex-shrink-0">
            <div>
              <h3 className={`text-sm font-black uppercase tracking-wider ${dynamicTextColor}`}>
                {activeTab === 'appearance' ? 'Tampilan & Nuansa' : (activeTab === 'gemini' ? 'Konfigurasi Gemini AI' : 'Notifikasi & Getar (Mobile/Android)')}
              </h3>
              <p className={`text-[10px] ${dynamicMutedTextColor}`}>
                {activeTab === 'appearance' ? 'Kustomisasi wallpaper, warna aksen, efek kaca, dan pencadangan' : (activeTab === 'gemini' ? 'Model AI, suara percakapan & telepon, serta API Key global' : 'Suara lonceng respon/PAP, getar Mobile/Android, dan izin bawaan')}
              </p>
            </div>
            <button 
              onClick={onClose} 
              className={`p-2 rounded-xl border border-white/10 ${isBackgroundDark ? 'hover:bg-white/10' : 'hover:bg-black/10'} transition-all ${dynamicMutedTextColor}`}
              title="Tutup Pengaturan"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable Content Body with 2-Column Responsive Landscape Grid */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 lg:p-7">
            {activeTab === 'appearance' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5 items-start">
                
                {/* Column 1: Wallpaper & Accent Color */}
                <div className="space-y-4">
                  {/* Wallpaper Box */}
                  <div className={`p-4 rounded-2xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-white/5' : 'bg-black/5'} space-y-3`}>
                    <div className="flex items-center justify-between select-none">
                      <label className={`text-[10px] font-black ${dynamicMutedTextColor} uppercase tracking-[0.25em]`}>Background Wallpaper</label>
                      {appearance.background && appearance.background !== 'google-theme' ? (
                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Custom Aktif</span>
                      ) : (
                        <span className={`text-[9px] font-bold ${dynamicMutedTextColor}`}>Tema Standar</span>
                      )}
                    </div>

                    <div 
                      ref={wallpaperRef}
                      className={`relative w-full aspect-video rounded-2xl overflow-hidden border-2 transition-all duration-300 ${isDragging ? 'border-indigo-500 scale-[1.02] shadow-2xl' : dynamicBorderColor} bg-black/30 group ${appearance.accentColorMode === 'wallpaper' ? 'cursor-none ring-2 ring-offset-2 ring-offset-transparent' : ''}`}
                      style={appearance.accentColorMode === 'wallpaper' ? { ringColor: themeHex } : {}}
                      onClick={handleWallpaperClick}
                      onMouseMove={handleWallpaperMouseMove}
                      onMouseLeave={handleWallpaperMouseLeave}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      {appearance.background && appearance.background !== 'google-theme' ? (
                        <img src={appearance.background} className={`w-full h-full object-cover pointer-events-none transition-all duration-300 ${isDragging ? 'blur-sm opacity-50' : ''}`} alt="Custom Background" crossOrigin="anonymous" />
                      ) : (
                        <div className={`w-full h-full flex flex-col items-center justify-center text-zinc-400 text-xs gap-1 transition-all duration-300 ${isDragging ? 'opacity-0' : ''}`}>
                          <span className="font-semibold">Tema Standar Lumina</span>
                          <span className="text-[9px] opacity-60">Tarik gambar kemari atau klik ganti</span>
                        </div>
                      )}

                      {/* Drag Overlay Feedback */}
                      {isDragging && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-indigo-500/20 backdrop-blur-sm animate-in fade-in duration-200">
                          <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center shadow-xl mb-2 animate-bounce">
                            <Upload className="h-5 w-5 text-white" />
                          </div>
                          <span className="text-white text-[9px] font-black uppercase tracking-[0.2em] drop-shadow-md">Lepas untuk ganti background</span>
                        </div>
                      )}
                      
                      {/* Eye Dropper Indicator */}
                      {appearance.accentColorMode === 'wallpaper' && mousePos && (
                        <div 
                          className="absolute pointer-events-none z-50 flex flex-col items-center gap-1.5"
                          style={{ 
                            left: mousePos.x, 
                            top: mousePos.y,
                            transform: 'translate(-50%, -50%)'
                          }}
                        >
                          <div 
                            className="w-10 h-10 rounded-full border-2 border-white shadow-2xl flex items-center justify-center overflow-hidden"
                            style={{ backgroundColor: hoverColor || 'transparent' }}
                          >
                            <div className="w-full h-full border border-black/20 rounded-full" />
                          </div>
                          <div className="w-3.5 h-3.5 relative">
                            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white shadow-sm" />
                            <div className="absolute left-1/2 top-0 w-0.5 h-full bg-white shadow-sm" />
                          </div>
                        </div>
                      )}

                      {appearance.accentColorMode !== 'wallpaper' && (
                        <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                          <input type="file" className="hidden" accept="image/*" onChange={handleBackgroundUpload} />
                          <span className="text-white text-[9px] font-black uppercase tracking-wider bg-white/20 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/30 shadow-md">Ganti Background</span>
                        </label>
                      )}
                      {appearance.accentColorMode === 'wallpaper' && !mousePos && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span 
                            className="text-white text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full backdrop-blur-md border border-white/30 shadow-xl"
                            style={{ backgroundColor: `${themeHex}CC` }}
                          >
                            Klik area wallpaper untuk ambil warna
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <label className={`text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl border border-white/10 ${isBackgroundDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} cursor-pointer transition-all ${dynamicTextColor}`}>
                        <input type="file" className="hidden" accept="image/*" onChange={handleBackgroundUpload} />
                        Pilih Berkas
                      </label>

                      <button 
                        onClick={() => setAppearance({ ...appearance, background: 'google-theme' })}
                        className={`text-[9px] font-bold uppercase tracking-wider ${dynamicMutedTextColor} hover:${dynamicTextColor} transition-all`}
                      >
                        Reset Standar
                      </button>
                    </div>
                  </div>

                  {/* Accent Color Card */}
                  <div className={`p-4 rounded-2xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-white/5' : 'bg-black/5'} space-y-3`}>
                    <label className={`text-[10px] font-black ${dynamicMutedTextColor} uppercase tracking-[0.25em] select-none block`}>Warna Aksen</label>
                    
                    {/* Mode Selection */}
                    <div className="flex flex-wrap gap-1.5">
                      <button 
                        onClick={() => setAppearance({ ...appearance, accentColorMode: 'default', accentColor: undefined })}
                        className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border ${appearance.accentColorMode === 'default' || !appearance.accentColorMode ? 'text-white border-transparent shadow-sm' : `${isBackgroundDark ? 'bg-white/5 text-white/60 border-white/10' : 'bg-black/5 text-black/60 border-black/5'} hover:opacity-80`}`}
                        style={(appearance.accentColorMode === 'default' || !appearance.accentColorMode) ? { backgroundColor: themeHex } : {}}
                      >
                        Default
                      </button>
                      <button 
                        onClick={() => setAppearance({ ...appearance, accentColorMode: 'manual' })}
                        className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border ${appearance.accentColorMode === 'manual' ? 'text-white border-transparent shadow-sm' : `${isBackgroundDark ? 'bg-white/5 text-white/60 border-white/10' : 'bg-black/5 text-black/60 border-black/5'} hover:opacity-80`}`}
                        style={appearance.accentColorMode === 'manual' ? { backgroundColor: themeHex } : {}}
                      >
                        Manual
                      </button>
                      <button 
                        onClick={() => setAppearance({ ...appearance, accentColorMode: 'wallpaper' })}
                        className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border ${appearance.accentColorMode === 'wallpaper' ? 'text-white border-transparent shadow-sm' : `${isBackgroundDark ? 'bg-white/5 text-white/60 border-white/10' : 'bg-black/5 text-black/60 border-black/5'} hover:opacity-80`}`}
                        style={appearance.accentColorMode === 'wallpaper' ? { backgroundColor: themeHex } : {}}
                      >
                        Wallpaper
                      </button>
                    </div>

                    {/* Color Controls */}
                    {appearance.accentColorMode === 'manual' && (
                      <div className={`flex items-center gap-3 p-2.5 ${isBackgroundDark ? 'bg-white/5' : 'bg-black/5'} rounded-xl border ${dynamicBorderColor} animate-in slide-in-from-top-2 duration-300`}>
                        <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-white/20 shadow-md flex-shrink-0">
                          <input 
                            type="color" 
                            value={appearance.accentColor || '#d70947'} 
                            onChange={(e) => setAppearance({ ...appearance, accentColor: e.target.value })}
                            className="absolute inset-[-5px] w-[calc(100%+10px)] h-[calc(100%+10px)] cursor-pointer"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[9px] font-black uppercase tracking-wider ${dynamicTextColor}`}>Pilih Warna Manual</p>
                          <p className={`text-[9px] font-mono font-bold ${dynamicMutedTextColor}`}>{appearance.accentColor || '#d70947'}</p>
                        </div>
                      </div>
                    )}

                    {appearance.accentColorMode === 'wallpaper' && (
                      <div className={`flex items-center gap-3 p-2.5 ${isBackgroundDark ? 'bg-white/5' : 'bg-black/5'} rounded-xl border ${dynamicBorderColor} animate-in slide-in-from-top-2 duration-300`}>
                        <div 
                          className="w-8 h-8 rounded-lg border border-white/20 shadow-md flex-shrink-0"
                          style={{ backgroundColor: appearance.accentColor || 'transparent' }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className={`text-[9px] font-black uppercase tracking-wider ${dynamicTextColor}`}>Warna Dari Wallpaper</p>
                          <p className={`text-[9px] font-mono font-bold ${dynamicMutedTextColor}`}>{appearance.accentColor || 'Arahkan kursor ke wallpaper'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Column 2: Display & Sliders + Backup/Restore */}
                <div className="space-y-4">
                  {/* Display & Effects Card */}
                  <div className={`p-4 rounded-2xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-white/5' : 'bg-black/5'} space-y-4`}>
                    <label className={`text-[10px] font-black ${dynamicMutedTextColor} uppercase tracking-[0.25em] select-none block`}>Efek & Tampilan Kaca</label>

                    {/* Dark Mode Toggle */}
                    <div 
                      onClick={() => setAppearance({ ...appearance, isBackgroundDark: !isBackgroundDark })}
                      className={`flex items-center justify-between p-3 ${isBackgroundDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} rounded-xl border ${dynamicBorderColor} cursor-pointer transition-all active:scale-[0.99]`}
                    >
                      <div className="flex flex-col select-none">
                        <span className={`text-[10px] font-black uppercase tracking-wider ${dynamicTextColor}`}>Mode Gelap</span>
                        <span className={`text-[9px] font-medium ${dynamicMutedTextColor}`}>Kontras latar belakang</span>
                      </div>
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setAppearance({ ...appearance, isBackgroundDark: !isBackgroundDark }); }}
                        className={`relative w-11 h-6 rounded-full transition-all duration-300 ${isBackgroundDark ? '' : 'bg-zinc-300'}`}
                        style={isBackgroundDark ? { backgroundColor: themeHex } : {}}
                      >
                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-md ${isBackgroundDark ? 'left-5' : 'left-0.5'}`} />
                      </button>
                    </div>

                    {/* Floating Progress Toggle */}
                    <div 
                      onClick={() => setAppearance({ ...appearance, showFloatingProgress: appearance.showFloatingProgress === false ? true : false })}
                      className={`flex items-center justify-between p-3 ${isBackgroundDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} rounded-xl border ${dynamicBorderColor} cursor-pointer transition-all active:scale-[0.99]`}
                    >
                      <div className="flex flex-col select-none pr-2">
                        <span className={`text-[10px] font-black uppercase tracking-wider ${dynamicTextColor}`}>Progress Melayang</span>
                        <span className={`text-[9px] font-medium ${dynamicMutedTextColor}`}>Tampilkan widget proses generasi agen</span>
                      </div>
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setAppearance({ ...appearance, showFloatingProgress: appearance.showFloatingProgress === false ? true : false }); }}
                        className={`relative w-11 h-6 rounded-full transition-all duration-300 flex-shrink-0 ${appearance.showFloatingProgress !== false ? '' : (isBackgroundDark ? 'bg-zinc-700/60' : 'bg-zinc-300')}`}
                        style={appearance.showFloatingProgress !== false ? { backgroundColor: themeHex } : {}}
                      >
                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-md ${appearance.showFloatingProgress !== false ? 'left-5' : 'left-0.5'}`} />
                      </button>
                    </div>

                    {/* Blur Slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center select-none">
                        <label className={`text-[9px] font-black ${dynamicMutedTextColor} uppercase tracking-wider`}>Kekuatan Blur</label>
                        <span className={`text-[11px] font-mono font-bold ${dynamicTextColor}`}>{appearance?.blur ?? 40}px</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="40" 
                        className={`w-full h-1.5 ${isBackgroundDark ? 'bg-white/10' : 'bg-black/10'} rounded-full appearance-none cursor-pointer`} 
                        style={{ accentColor: themeHex }}
                        value={appearance?.blur ?? 40} 
                        onChange={(e) => setAppearance({...appearance, blur: parseInt(e.target.value)})} 
                      />
                    </div>
                    
                    {/* Transparency Slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center select-none">
                        <label className={`text-[9px] font-black ${dynamicMutedTextColor} uppercase tracking-wider`}>Transparansi Kaca</label>
                        <span className={`text-[11px] font-mono font-bold ${dynamicTextColor}`}>{appearance?.transparency ?? 0}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        className={`w-full h-1.5 ${isBackgroundDark ? 'bg-white/10' : 'bg-black/10'} rounded-full appearance-none cursor-pointer`} 
                        style={{ accentColor: themeHex }}
                        value={appearance?.transparency ?? 0} 
                        onChange={(e) => setAppearance({...appearance, transparency: parseInt(e.target.value)})} 
                      />
                    </div>
                  </div>

                  {/* Backup & Restore Card */}
                  <div className={`p-4 rounded-2xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-white/5' : 'bg-black/5'} space-y-3`}>
                    <label className={`text-[10px] font-black ${dynamicMutedTextColor} uppercase tracking-[0.25em] select-none block`}>Cadangan & Pemulihan</label>
                    
                    <div className="grid grid-cols-2 gap-2.5">
                      <button 
                        onClick={handleBackup}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 ${isBackgroundDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} rounded-xl border ${dynamicBorderColor} transition-all group select-none`}
                      >
                        <Download className={`h-3.5 w-3.5 ${isBackgroundDark ? 'text-white/50' : 'text-black/50'} group-hover:text-indigo-400 transition-colors`} />
                        <span className={`text-[9px] font-black uppercase tracking-wider ${dynamicTextColor} opacity-75 group-hover:opacity-100`}>Backup</span>
                      </button>

                      <label 
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border transition-all group cursor-pointer select-none ${isDraggingRestore ? 'bg-purple-500/20 border-purple-500 scale-[1.02] shadow-lg' : `${isBackgroundDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} ${dynamicBorderColor}`}`}
                        onDragOver={onDragOverRestore}
                        onDragLeave={onDragLeaveRestore}
                        onDrop={onDropRestore}
                      >
                        <input 
                          type="file" 
                          className="hidden" 
                          accept=".json" 
                          onChange={handleRestore} 
                        />
                        <Upload className={`h-3.5 w-3.5 transition-colors ${isDraggingRestore ? 'text-purple-500 animate-bounce' : `${isBackgroundDark ? 'text-white/50' : 'text-black/50'} group-hover:text-purple-400`}`} />
                        <span className={`text-[9px] font-black uppercase tracking-wider ${dynamicTextColor} ${isDraggingRestore ? 'opacity-100' : 'opacity-75 group-hover:opacity-100'}`}>
                          {isDraggingRestore ? 'Lepas Tema' : 'Restore'}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'gemini' && userProfile && setUserProfile && (() => {
              const updateGlobalGemini = (updates: Partial<UserProfile>) => {
                const updated = { ...userProfile, ...updates };
                setUserProfile(updated);
                saveGlobalGeminiSettingsSync({
                  geminiApiKey: updated.geminiApiKey,
                  textModel: updated.textModel,
                  ttsModel: updated.ttsModel,
                  voiceChat: updated.voiceChat,
                  callModel: updated.callModel,
                  voiceCall: updated.voiceCall,
                  imageModel: updated.imageModel,
                  useGoogleSearch: updated.useGoogleSearch,
                  hfSpaceUrl: updated.hfSpaceUrl,
                  hfTokens: updated.hfTokens,
                  hfApiEndpoint: updated.hfApiEndpoint,
                  injectNegativePrompt: updated.injectNegativePrompt,
                  injectAnatomyGuard: updated.injectAnatomyGuard,
                });
              };

              return (
                <div className="space-y-4">
                  {/* Global Indicator Banner */}
                  <div className={`p-3 rounded-xl border ${dynamicBorderColor} bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 flex items-center gap-3 shadow-sm`}>
                    <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 flex-shrink-0">
                      <Globe className="w-4 h-4 animate-pulse" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">Pengaturan Global</span>
                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Semua Karakter</span>
                      </div>
                      <p className={`text-[9px] ${dynamicMutedTextColor} truncate mt-0.5`}>
                        Model AI, Suara, dan API Key di bawah ini otomatis berlaku ke semua karakter secara global.
                      </p>
                    </div>
                  </div>

                  {/* 2-Column Responsive Landscape Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5 items-start">
                    
                    {/* Column 1: API Key & Chat / Voice Note Models */}
                    <div className="space-y-4">
                      {/* API Key Box */}
                      {(() => {
                        const geminiKeysList = parseGeminiApiKeys(userProfile.geminiApiKey);
                        return (
                          <div className={`p-3.5 rounded-2xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-white/5' : 'bg-black/5'} space-y-2.5`}>
                            <div className="flex items-center justify-between select-none">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <label className={`text-[10px] font-black ${dynamicMutedTextColor} uppercase tracking-[0.25em]`}>API Key (Gemini)</label>
                                {geminiKeysList.length > 0 && (
                                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                                    {geminiKeysList.length} Key Terdaftar (Cycles)
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setShowApiKey(!showApiKey)}
                                  className={`text-[8px] font-bold uppercase tracking-wider flex items-center gap-1 ${dynamicMutedTextColor} hover:${dynamicTextColor}`}
                                >
                                  {showApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                  {showApiKey ? 'Sembunyikan' : 'Tampilkan'}
                                </button>
                                <a 
                                  href="https://aistudio.google.com/app/apikey" 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${dynamicBorderColor} ${isBackgroundDark ? 'text-indigo-400 border-indigo-500/30' : 'text-indigo-600 border-indigo-500/30'} hover:bg-indigo-500/10 transition-all`}
                                >
                                  Ambil Key
                                </a>
                              </div>
                            </div>

                            <textarea 
                              rows={3}
                              className={`w-full p-2.5 text-xs font-mono rounded-xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-black/20 text-white' : 'bg-white/60 text-black'} outline-none focus:border-indigo-400/60 transition-all resize-none`}
                              placeholder={"AIzaSyKeyAkun1\nAIzaSyKeyAkun2 (opsional, rotasi otomatis saat limit 429)\nAIzaSyKeyAkun3..."}
                              style={{ WebkitTextSecurity: showApiKey ? 'none' : 'disc' } as any}
                              value={userProfile.geminiApiKey || ''}
                              onChange={(e) => {
                                updateGlobalGemini({ geminiApiKey: e.target.value });
                                setValidationResult(null);
                              }}
                              /* --- TAMBAHKAN DUA EVENT DI BAWAH INI --- */
                              onInput={(e) => {
                                const val = (e.target as HTMLTextAreaElement).value;
                                updateGlobalGemini({ geminiApiKey: val });
                                setValidationResult(null);
                              }}
                              onPaste={(e) => {
                                const pasted = e.clipboardData.getData('text');
                                if (pasted) {
                                updateGlobalGemini({ geminiApiKey: pasted });
                                setValidationResult(null);
                                }
                              }}
                            />

                            <div className="flex items-center justify-between gap-2 pt-0.5">
                              <p className={`text-[8px] ${dynamicMutedTextColor} leading-relaxed flex-1`}>
                                💡 <strong>Siklus Rotasi (Cycles):</strong> Masukkan 1 atau beberapa API Key Gemini (satu baris per key). Saat limit 429 atau kuota habis, sistem otomatis beralih (*auto-rotate*) ke key berikutnya secara transparan tanpa menghentikan percakapan!
                              </p>
                              <button 
                                type="button"
                                onClick={handleCheckApiKey}
                                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 flex-shrink-0 ${
                                  isValidating || !userProfile.geminiApiKey
                                    ? 'bg-zinc-500/20 text-zinc-500 cursor-not-allowed'
                                    : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-md shadow-indigo-500/20' 
                                }`}
                                disabled={isValidating || !userProfile.geminiApiKey}
                              >
                                {isValidating ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Key className="h-3 w-3" />
                                )}
                                Cek API
                              </button>
                            </div>
                            
                            {validationResult && (
                              <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[9px] font-medium animate-in slide-in-from-top-1 duration-200 ${
                                validationResult.valid 
                                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                                  : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                              }`}>
                                {validationResult.valid ? <CheckCircle2 className="h-3 w-3 flex-shrink-0" /> : <XCircle className="h-3 w-3 flex-shrink-0" />}
                                <span className="truncate">{validationResult.message}</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Text Model Dropdown */}
                      <div className={`p-3.5 rounded-2xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-white/5' : 'bg-black/5'} space-y-2`}>
                        <label className={`text-[10px] font-black ${dynamicMutedTextColor} uppercase tracking-[0.25em] select-none block`}>Model Text (Global)</label>
                        <GlassDropdown
                          size="sm"
                          value={userProfile.textModel || 'gemini-3.1-flash-lite'}
                          isBackgroundDark={isBackgroundDark}
                          themeHex={themeHex}
                          onChange={(val) => updateGlobalGemini({ textModel: val })}
                          options={[
                            { value: 'gemini-3.8-flash', label: 'gemini-3.8-flash' },
                            { value: 'gemini-3.1-pro-preview', label: 'gemini-3.1-pro-preview' },
                            { value: 'gemini-3.1-flash-lite', label: 'gemini-3.1-flash-lite (Default)' }
                          ]}
                        />
                      </div>

                      {/* Voice Model (TTS) Dropdown */}
                      <div className={`p-3.5 rounded-2xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-white/5' : 'bg-black/5'} space-y-2`}>
                        <label className={`text-[10px] font-black ${dynamicMutedTextColor} uppercase tracking-[0.25em] select-none block`}>Model Voice (TTS Global)</label>
                        <GlassDropdown
                          size="sm"
                          value={userProfile.ttsModel || 'gemini-2.5-flash-preview-tts'}
                          isBackgroundDark={isBackgroundDark}
                          themeHex={themeHex}
                          onChange={(val) => {
                            const updates: Partial<UserProfile> = { ttsModel: val };
                            if (val === 'gemini-3.8-flash-tts' && (!userProfile.voiceChat || userProfile.voiceChat === 'Aoede')) {
                              updates.voiceChat = 'Fola';
                            }
                            if (userProfile.voiceCall === 'Fola') {
                              updates.voiceCall = 'Aoede';
                            }
                            updateGlobalGemini(updates);
                          }}
                          options={[
                            { value: 'gemini-2.5-flash-preview-tts', label: 'gemini-2.5-flash-preview-tts (Default)' },
                            { value: 'gemini-3.8-flash-lite-tts', label: 'gemini-3.8-flash-lite-tts (Fast Streaming)' },
                            { value: 'gemini-3.8-flash-tts', label: 'gemini-3.8-flash-tts' },
                            { value: 'gemini-2.5-pro-preview-tts', label: 'gemini-2.5-pro-preview-tts' },
                            { value: 'gemini-3.1-flash-tts-preview', label: 'gemini-3.1-flash-tts-preview' }
                          ]}
                        />
                      </div>

                      {/* Chat Voice Dropdown */}
                      <div className={`p-3.5 rounded-2xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-white/5' : 'bg-black/5'} space-y-2`}>
                        <div className="flex items-center justify-between select-none">
                          <label className={`text-[10px] font-black ${dynamicMutedTextColor} uppercase tracking-[0.25em]`}>Pilih Suara Chat (TTS)</label>
                          {isGemini38Tts && (
                            <span 
                              className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full text-white/90 border border-white/20 shadow-sm"
                              style={{ backgroundColor: `${themeHex || '#6366f1'}88` }}
                            >
                              3.8 TTS
                            </span>
                          )}
                        </div>
                        <GlassDropdown
                          size="sm"
                          value={userProfile.voiceChat || (isGemini38Tts ? 'Fola' : 'Aoede')}
                          isBackgroundDark={isBackgroundDark}
                          themeHex={themeHex}
                          onChange={(val) => updateGlobalGemini({ voiceChat: val })}
                          options={voiceChatOptions}
                        />
                        <p className={`text-[9px] ${dynamicMutedTextColor} leading-relaxed`}>
                          Untuk Voice Note (VN) dan narasi suara chat semua karakter.
                        </p>
                      </div>
                    </div>

                    {/* Column 2: Live Call, Image Generation & Toggles */}
                    <div className="space-y-4">
                      {/* Call Model Dropdown */}
                      <div className={`p-3.5 rounded-2xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-white/5' : 'bg-black/5'} space-y-2`}>
                        <label className={`text-[10px] font-black ${dynamicMutedTextColor} uppercase tracking-[0.25em] select-none block`}>Model Live (Call Global)</label>
                        <GlassDropdown
                          size="sm"
                          value={userProfile.callModel || 'gemini-2.5-flash-native-audio-preview-12-2025'}
                          isBackgroundDark={isBackgroundDark}
                          themeHex={themeHex}
                          onChange={(val) => updateGlobalGemini({ callModel: val })}
                          options={[
                            { value: 'gemini-2.5-flash-native-audio-preview-12-2025', label: 'gemini-2.5-flash-native-audio-preview-12-2025 (Default Native)' },
                            { value: 'gemini-2.5-flash-native-audio-preview-09-2025', label: 'gemini-2.5-flash-native-audio-preview-09-2025' },
                            { value: 'gemini-2.5-flash-native-audio-latest', label: 'gemini-2.5-flash-native-audio-latest' },
                            { value: 'gemini-3.8-live', label: 'gemini-3.8-live' },
                            { value: 'gemini-3.1-flash-live-preview', label: 'gemini-3.1-flash-live-preview' }
                          ]}
                        />
                      </div>

                      {/* Live Call Voice Dropdown */}
                      <div className={`p-3.5 rounded-2xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-white/5' : 'bg-black/5'} space-y-2`}>
                        <div className="flex items-center justify-between select-none">
                          <label className={`text-[10px] font-black ${dynamicMutedTextColor} uppercase tracking-[0.25em]`}>Suara Telepon (Live Call)</label>
                          <span 
                            className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full text-white/90 border border-white/20 shadow-sm"
                            style={{ backgroundColor: `${themeHex || '#6366f1'}88` }}
                          >
                            Live Audio
                          </span>
                        </div>
                        <GlassDropdown
                          size="sm"
                          value={(!userProfile.voiceCall || userProfile.voiceCall === 'Fola') ? 'Aoede' : userProfile.voiceCall}
                          isBackgroundDark={isBackgroundDark}
                          themeHex={themeHex}
                          onChange={(val) => updateGlobalGemini({ voiceCall: val })}
                          options={liveCallVoiceOptions}
                        />
                        <p className={`text-[9px] ${dynamicMutedTextColor} leading-relaxed`}>
                          Khusus untuk panggilan telepon langsung di semua karakter.
                        </p>
                      </div>

                      {/* Image Model Dropdown */}
                      <div className={`p-3.5 rounded-2xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-white/5' : 'bg-black/5'} space-y-2`}>
                        <div className="flex items-center justify-between select-none">
                          <label className={`text-[10px] font-black ${dynamicMutedTextColor} uppercase tracking-[0.25em] block`}>Model Image Generation (Global)</label>
                          <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            ZeroGPU
                          </span>
                        </div>
                        <GlassDropdown
                          size="sm"
                          value={userProfile.imageModel || 'hf-qwen-image-edit'}
                          isBackgroundDark={isBackgroundDark}
                          themeHex={themeHex}
                          onChange={(val) => updateGlobalGemini({ imageModel: val })}
                          options={[
                            { value: 'hf-qwen-image-edit', label: 'Qwen Image Edit / ZeroGPU (Default - Hugging Face Space)' }
                          ]}
                        />
                        <p className={`text-[9px] ${dynamicMutedTextColor} leading-relaxed`}>
                          Menghubungkan ke Space Hugging Face CopoZ (Qwen Image Edit Rapid AIO) dengan perangkat ZeroGPU tanpa sensor (Uncensored) & mendukung multi-token rotasi otomatis.
                        </p>
                      </div>

                      {/* Hugging Face Space & Multi-Token Configuration */}
                      {((userProfile.imageModel || 'hf-qwen-image-edit') === 'hf-qwen-image-edit' || userProfile.imageModel?.startsWith('hf-')) && (() => {
                        const tokensList = parseHFTokens(userProfile.hfTokens);
                        return (
                          <div className={`p-3.5 rounded-2xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-white/5' : 'bg-black/5'} space-y-3 animate-in slide-in-from-top-2 duration-300`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <Cpu className="w-3.5 h-3.5 text-amber-400" />
                                <label className={`text-[10px] font-black ${dynamicTextColor} uppercase tracking-[0.15em]`}>
                                  Konfigurasi Space & ZeroGPU
                                </label>
                              </div>
                              <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Fleksibel
                              </span>
                            </div>

                            {/* Space URL Input */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between select-none">
                                <span className={`text-[9px] font-bold ${dynamicMutedTextColor} uppercase tracking-wider`}>
                                  URL Hugging Face Space
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => updateGlobalGemini({ 
                                      hfSpaceUrl: 'https://huggingface.co/spaces/CopoZ/Qwen-Image-Edit-Rapid-AIO-Loras-Plus',
                                      hfApiEndpoint: '/infer'
                                    })}
                                    className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border border-amber-500/40 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-all`}
                                    title="Gunakan Space Default CopoZ"
                                  >
                                    CopoZ Rapid AIO (Default)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateGlobalGemini({ 
                                      hfSpaceUrl: 'https://huggingface.co/spaces/Qwen/Qwen-Image-Edit',
                                      hfApiEndpoint: '/infer'
                                    })}
                                    className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border border-white/20 text-neutral-300 hover:bg-white/10 transition-all`}
                                    title="Gunakan Space Resmi Qwen jika CopoZ bermasalah"
                                  >
                                    Official Qwen (Cadangan)
                                  </button>
                                </div>
                              </div>
                              <input
                                type="text"
                                className={`w-full p-2 text-xs font-mono rounded-xl border ${
                                  !userProfile.hfSpaceUrl ? 'border-amber-500/50' : dynamicBorderColor
                                } ${isBackgroundDark ? 'bg-black/20 text-white' : 'bg-white/60 text-black'} outline-none focus:border-amber-400/60 transition-all`}
                                placeholder="https://huggingface.co/spaces/CopoZ/Qwen-Image-Edit-Rapid-AIO-Loras-Plus"
                                value={userProfile.hfSpaceUrl ?? 'https://huggingface.co/spaces/CopoZ/Qwen-Image-Edit-Rapid-AIO-Loras-Plus'}
                                onChange={(e) => updateGlobalGemini({ hfSpaceUrl: e.target.value })}
                              />
                              <p className={`text-[8px] ${dynamicMutedTextColor} leading-relaxed`}>
                                📌 <strong>Default Space:</strong> <code>CopoZ Rapid AIO</code>. Anda bisa bebas mengubah URL ke Space Hugging Face mana saja jika Space default sedang bermasalah atau tidur (*sleeping*).
                              </p>
                            </div>

                            {/* Multi-Tokens Input */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between select-none">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[9px] font-bold ${dynamicMutedTextColor} uppercase tracking-wider`}>
                                    HF Access Token(s) (hf_...)
                                  </span>
                                  {tokensList.length > 0 && (
                                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                      {tokensList.length} Akun Terdaftar
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setShowHfTokens(!showHfTokens)}
                                  className={`text-[8px] font-bold uppercase tracking-wider flex items-center gap-1 ${dynamicMutedTextColor} hover:${dynamicTextColor}`}
                                >
                                  {showHfTokens ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                  {showHfTokens ? 'Sembunyikan' : 'Tampilkan'}
                                </button>
                              </div>
                              <textarea
                                rows={3}
                                className={`w-full p-2 text-xs font-mono rounded-xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-black/20 text-white' : 'bg-white/60 text-black'} outline-none focus:border-amber-400/60 transition-all resize-none`}
                                placeholder={"hf_tokenAkun1\nhf_tokenAkun2 (opsional, rotasi otomatis saat kuota akun 1 limit)\nhf_tokenAkun3..."}
                                style={{ WebkitTextSecurity: showHfTokens ? 'none' : 'disc' } as any}
                                value={userProfile.hfTokens || ''}
                                onChange={(e) => updateGlobalGemini({ hfTokens: e.target.value })}
                              />
                              <p className={`text-[8px] ${dynamicMutedTextColor} leading-relaxed`}>
                                💡 <strong>Ganti-ganti Akun Otomatis:</strong> Masukkan 1 atau beberapa token HF (satu baris per akun). Jika kuota ZeroGPU akun pertama limit (429/Exceeded), sistem akan otomatis berpindah ke akun berikutnya tanpa Anda harus keluar dari chat!
                              </p>
                            </div>

                            {/* Endpoint API Space */}
                            <div className="flex items-center gap-2 pt-0.5">
                              <span className={`text-[9px] font-bold ${dynamicMutedTextColor} uppercase tracking-wider whitespace-nowrap`}>
                                Endpoint API:
                              </span>
                              <input
                                type="text"
                                className={`flex-1 p-1.5 text-xs font-mono rounded-lg border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-black/20 text-white' : 'bg-white/60 text-black'} outline-none focus:border-amber-400/60 transition-all`}
                                placeholder="/infer"
                                value={userProfile.hfApiEndpoint || '/infer'}
                                onChange={(e) => updateGlobalGemini({ hfApiEndpoint: e.target.value })}
                              />
                            </div>

                            {/* Test Connection Button & Result */}
                            <div className="pt-1 space-y-2">
                              <button
                                type="button"
                                onClick={handleTestHF}
                                disabled={isTestingHF}
                                className={`w-full py-2 px-3 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                                  isTestingHF
                                    ? 'bg-zinc-500/20 text-zinc-500 cursor-not-allowed'
                                    : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 shadow-sm'
                                }`}
                              >
                                {isTestingHF ? <Loader2 className="w-3 h-3 animate-spin" /> : <Server className="w-3 h-3" />}
                                {isTestingHF ? 'Menguji Space & Token...' : 'Tes Koneksi Space & Kuota'}
                              </button>

                              {hfTestResult && (
                                <div className={`p-2.5 rounded-xl border text-[9px] leading-relaxed animate-in slide-in-from-top-1 duration-200 ${
                                  hfTestResult.success
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                    : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                                }`}>
                                  <div className="flex items-start gap-1.5">
                                    {hfTestResult.success ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> : <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
                                    <div>
                                      <p className="font-bold">{hfTestResult.message}</p>
                                      {hfTestResult.spaceName && (
                                        <p className="opacity-80 text-[8px] mt-0.5">Space: {hfTestResult.spaceName} • Akun Aktif: {hfTestResult.activeTokenPreview}</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Prompt Injection & Anatomy Guard Toggles */}
                      <div className={`p-3.5 rounded-2xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-white/5' : 'bg-black/5'} space-y-3`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-pink-400" />
                            <label className={`text-[10px] font-black ${dynamicTextColor} uppercase tracking-[0.15em]`}>
                              Injeksi Pengaman PAP & Model Gambar
                            </label>
                          </div>
                          <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
                            Anatomy & Quality
                          </span>
                        </div>

                        {/* Toggle 1: Inject Anatomy & Identity Guard (Pure Positive Directives) */}
                        <div 
                          onClick={() => updateGlobalGemini({ injectAnatomyGuard: userProfile.injectAnatomyGuard === false ? true : false })}
                          className={`p-2.5 rounded-xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} flex items-center justify-between cursor-pointer transition-all active:scale-[0.99]`}
                        >
                          <div className="space-y-0.5 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] font-black uppercase tracking-wider ${dynamicTextColor} block`}>
                                Inject Anatomy & Identity Guard
                              </span>
                              <span className={`text-[7px] font-black uppercase px-1.5 py-0.2 rounded ${
                                userProfile.injectAnatomyGuard !== false ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'
                              }`}>
                                {userProfile.injectAnatomyGuard !== false ? 'Aktif' : 'Nonaktif'}
                              </span>
                            </div>
                            <span className={`text-[9px] font-medium ${dynamicMutedTextColor} block leading-relaxed`}>
                              Menyuntikkan instruksi positif untuk preservasi wajah, biometrik, 5 jari per tangan, dan proporsi anatomi sempurna.
                            </span>
                          </div>
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); updateGlobalGemini({ injectAnatomyGuard: userProfile.injectAnatomyGuard === false ? true : false }); }}
                            className={`relative w-10 h-5 rounded-full transition-all duration-300 flex-shrink-0 ${userProfile.injectAnatomyGuard !== false ? 'bg-emerald-500' : 'bg-zinc-600'}`}
                          >
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${userProfile.injectAnatomyGuard !== false ? 'left-5' : 'left-0.5'}`} />
                          </button>
                        </div>
                      </div>

                      {/* Feature Toggles */}
                      <div className={`p-3.5 rounded-2xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-white/5' : 'bg-black/5'} space-y-2.5`}>
                        <label className={`text-[10px] font-black ${dynamicMutedTextColor} uppercase tracking-[0.25em] select-none block`}>Fitur Cerdas</label>
                        
                        <div 
                          onClick={() => updateGlobalGemini({ useGoogleSearch: !userProfile.useGoogleSearch })}
                          className={`p-2.5 rounded-xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} flex items-center justify-between cursor-pointer transition-all active:scale-[0.99]`}
                        >
                          <div className="space-y-0.5">
                            <span className={`text-[10px] font-black uppercase tracking-wider ${dynamicTextColor} block`}>Google Search Grounding</span>
                            <span className={`text-[9px] font-medium ${dynamicMutedTextColor} block`}>Beri akses internet ke agen</span>
                          </div>
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); updateGlobalGemini({ useGoogleSearch: !userProfile.useGoogleSearch }); }}
                            className={`relative w-10 h-5 rounded-full transition-all duration-300 ${userProfile.useGoogleSearch ? 'bg-emerald-500' : 'bg-zinc-600'}`}
                          >
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${userProfile.useGoogleSearch ? 'left-5' : 'left-0.5'}`} />
                          </button>
                        </div>

                        <div 
                          onClick={() => updateGlobalGemini({ isEnrichPersonaEnabled: !userProfile.isEnrichPersonaEnabled })}
                          className={`p-2.5 rounded-xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} flex items-center justify-between cursor-pointer transition-all active:scale-[0.99]`}
                        >
                          <div className="space-y-0.5">
                            <span className={`text-[10px] font-black uppercase tracking-wider ${dynamicTextColor} block`}>Enrich Persona</span>
                            <span className={`text-[9px] font-medium ${dynamicMutedTextColor} block`}>Auto-perkaya deskripsi karakter</span>
                          </div>
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); updateGlobalGemini({ isEnrichPersonaEnabled: !userProfile.isEnrichPersonaEnabled }); }}
                            className={`relative w-10 h-5 rounded-full transition-all duration-300 ${userProfile.isEnrichPersonaEnabled ? 'bg-purple-500' : 'bg-zinc-600'}`}
                          >
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${userProfile.isEnrichPersonaEnabled ? 'left-5' : 'left-0.5'}`} />
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              );
            })()}

            {activeTab === 'notifications' && (
              <div className="max-w-2xl mx-auto space-y-6">
                <div className={`p-5 rounded-2xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-white/5' : 'bg-black/5'} space-y-4`}>
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2.5">
                      <Bell className="w-5 h-5 text-indigo-400" />
                      <h4 className={`text-xs font-black uppercase tracking-widest ${dynamicTextColor}`}>Suara, Getar & Izin Notifikasi</h4>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${permissionState === 'granted' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                      {permissionState === 'granted' ? 'Izin Perangkat Aktif' : (permissionState === 'unsupported' ? 'Web Only' : 'Izin Belum Aktif')}
                    </span>
                  </div>

                  {/* Toggle Suara */}
                  <div 
                    onClick={() => {
                      const next = !notifSound;
                      setNotifSound(next);
                      saveNotificationSettings({ enableSound: next });
                      if (setUserProfile && userProfile) {
                        setUserProfile({ ...userProfile, enableNotificationSound: next });
                      }
                    }}
                    className={`flex items-center justify-between py-2 px-3 rounded-xl hover:bg-white/5 transition-all cursor-pointer select-none`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <Volume2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${dynamicTextColor}`}>Suara Notifikasi</p>
                        <p className={`text-[9px] ${dynamicMutedTextColor}`}>Putar nada jernih saat balasan pesan atau PAP telah selesai</p>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = !notifSound;
                        setNotifSound(next);
                        saveNotificationSettings({ enableSound: next });
                        if (setUserProfile && userProfile) {
                          setUserProfile({ ...userProfile, enableNotificationSound: next });
                        }
                      }}
                      className={`relative w-11 h-6 rounded-full transition-all duration-300 ${notifSound ? 'bg-indigo-500' : 'bg-zinc-600'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-md ${notifSound ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>

                  {/* Toggle Getar */}
                  <div 
                    onClick={() => {
                      const next = !notifVibration;
                      setNotifVibration(next);
                      saveNotificationSettings({ enableVibration: next });
                      if (setUserProfile && userProfile) {
                        setUserProfile({ ...userProfile, enableVibration: next });
                      }
                      if (next) triggerVibration('text');
                    }}
                    className={`flex items-center justify-between py-2 px-3 rounded-xl border-t border-white/5 hover:bg-white/5 transition-all cursor-pointer select-none`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${dynamicTextColor}`}>Getar Mobile / Android</p>
                        <p className={`text-[9px] ${dynamicMutedTextColor}`}>Getarkan HP/perangkat saat balasan atau PAP baru tiba</p>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = !notifVibration;
                        setNotifVibration(next);
                        saveNotificationSettings({ enableVibration: next });
                        if (setUserProfile && userProfile) {
                          setUserProfile({ ...userProfile, enableVibration: next });
                        }
                        if (next) triggerVibration('text');
                      }}
                      className={`relative w-11 h-6 rounded-full transition-all duration-300 ${notifVibration ? 'bg-purple-500' : 'bg-zinc-600'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-md ${notifVibration ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>

                  {/* Toggle System Notification */}
                  <div 
                    onClick={() => {
                      const next = !notifSystem;
                      setNotifSystem(next);
                      saveNotificationSettings({ enableSystemNotifications: next });
                      if (setUserProfile && userProfile) {
                        setUserProfile({ ...userProfile, enableSystemNotifications: next });
                      }
                    }}
                    className={`flex items-center justify-between py-2 px-3 rounded-xl border-t border-white/5 hover:bg-white/5 transition-all cursor-pointer select-none`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <Bell className="w-4 h-4" />
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${dynamicTextColor}`}>Notifikasi Bawaan Status Bar Android / Browser</p>
                        <p className={`text-[9px] ${dynamicMutedTextColor}`}>Tampilkan notifikasi di layar saat aplikasi berada di latar belakang</p>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = !notifSystem;
                        setNotifSystem(next);
                        saveNotificationSettings({ enableSystemNotifications: next });
                        if (setUserProfile && userProfile) {
                          setUserProfile({ ...userProfile, enableSystemNotifications: next });
                        }
                      }}
                      className={`relative w-11 h-6 rounded-full transition-all duration-300 ${notifSystem ? 'bg-emerald-500' : 'bg-zinc-600'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-md ${notifSystem ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>

                  {/* Permission request button */}
                  {permissionState !== 'granted' && permissionState !== 'unsupported' && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await requestNotificationPermission();
                          setPermissionState(res);
                          if (res === 'granted') {
                            alert("Izin notifikasi bawaan Android / Browser berhasil diberikan! 🎉");
                          }
                        }}
                        className="w-full py-3 px-4 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                      >
                        <Bell className="w-4 h-4" />
                        Aktifkan / Minta Izin Notifikasi Android
                      </button>
                    </div>
                  )}

                  {/* Sound & Vibe test buttons */}
                  <div className="flex gap-2 pt-2 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => {
                        playNotificationSound('text');
                        triggerVibration('text');
                      }}
                      className={`flex-1 py-2.5 px-3 rounded-xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} text-xs font-bold ${dynamicTextColor} transition-all cursor-pointer flex items-center justify-center gap-1.5`}
                    >
                      <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                      Tes Nada Pesan
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playNotificationSound('pap');
                        triggerVibration('pap');
                      }}
                      className={`flex-1 py-2.5 px-3 rounded-xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} text-xs font-bold ${dynamicTextColor} transition-all cursor-pointer flex items-center justify-center gap-1.5`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      Tes Nada PAP
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Floating Finish Flyout Button (Mobile Only - Identical to ProfileSelector FAB) */}
          <button 
            type="button"
            onClick={onClose}
            className={`md:hidden ${isEmbeddedPage ? 'fixed bottom-32 right-6' : 'absolute bottom-6 right-6'} z-[210] w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center transition-all active:scale-90 group border cursor-pointer`}
            style={{ 
              backgroundColor: themeHex || '#f43f5e',
              borderColor: themeHex ? `${themeHex}40` : '#f43f5e40',
              color: contrastColor === 'black' ? 'rgba(0,0,0,0.8)' : 'white'
            }}
            title="Selesai"
            aria-label="Selesai"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </button>

        </div>
      </div>
  );

  if (isEmbeddedPage) {
    return contentNode;
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 md:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      {contentNode}
    </div>
  );
};

export default SettingsModal;
