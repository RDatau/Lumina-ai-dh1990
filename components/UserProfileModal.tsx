import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, GlobalAppearance } from '../types';
import { Volume2, Smartphone, Bell, Trash2, Camera, User, Download, Upload, RefreshCw } from 'lucide-react';
import { 
  getNotificationSettings, 
  saveNotificationSettings, 
  requestNotificationPermission, 
  getSystemNotificationPermissionState, 
  playNotificationSound, 
  triggerVibration 
} from '../services/notificationService';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSave: (updatedProfile: UserProfile) => void;
  onLoadGlobal: () => Promise<UserProfile | null>;
  onSignOut?: () => void;
  appearance: GlobalAppearance;
  themeHex?: string;
  isEmbeddedPage?: boolean;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({ 
  isOpen, 
  onClose, 
  profile, 
  onSave, 
  onLoadGlobal, 
  onSignOut, 
  appearance, 
  themeHex, 
  isEmbeddedPage = false 
}) => {
  const [name, setName] = useState(profile.name || '');
  const [personalityInfo, setPersonalityInfo] = useState(profile.personalityInfo || '');
  const [profilePic, setProfilePic] = useState<string | null>(profile.profilePic || null);
  const [notifSound, setNotifSound] = useState(() => getNotificationSettings().enableSound);
  const [notifVibration, setNotifVibration] = useState(() => getNotificationSettings().enableVibration);
  const [notifSystem, setNotifSystem] = useState(() => getNotificationSettings().enableSystemNotifications);
  const [permissionState, setPermissionState] = useState<NotificationPermission | 'unsupported'>(getSystemNotificationPermissionState());
  const [isDraggingImport, setIsDraggingImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync internal state with props when modal opens or profile changes
  useEffect(() => {
    if (isOpen) {
      setName(profile.name || '');
      setPersonalityInfo(profile.personalityInfo || '');
      setProfilePic(profile.profilePic || null);
      setNotifSound(getNotificationSettings().enableSound);
      setNotifVibration(getNotificationSettings().enableVibration);
      setNotifSystem(getNotificationSettings().enableSystemNotifications);
      setPermissionState(getSystemNotificationPermissionState());
    }
  }, [isOpen, profile.name, profile.personalityInfo, profile.profilePic]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePic(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setProfilePic(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = () => {
    saveNotificationSettings({
      enableSound: notifSound,
      enableVibration: notifVibration,
      enableSystemNotifications: notifSystem,
    });
    onSave({
      ...profile,
      name,
      personalityInfo,
      profilePic,
      enableNotificationSound: notifSound,
      enableVibration: notifVibration,
      enableSystemNotifications: notifSystem,
    });
    onClose();
  };

  const handleExport = () => {
    const data = {
      name,
      personalityInfo,
      profilePic,
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `profile_${name.toLowerCase().replace(/\s+/g, '_') || 'user'}_${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement> | File) => {
    const file = e instanceof File ? e : e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (data.name !== undefined) setName(data.name);
          if (data.personalityInfo !== undefined) setPersonalityInfo(data.personalityInfo);
          if (data.profilePic !== undefined) setProfilePic(data.profilePic);
          alert("Profil berhasil di-import! Jangan lupa klik Simpan ya sayang.. 💦");
        } catch (err) {
          alert("Gagal baca file profil. Pastikan formatnya bener ya..");
        }
      };
      reader.readAsText(file);
    }
  };

  const onDragOverImport = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingImport(true);
  };

  const onDragLeaveImport = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingImport(false);
  };

  const onDropImport = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingImport(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.json')) {
      handleImport(file);
    }
  };

  const handleSyncGlobal = async () => {
    const globalProfile = await onLoadGlobal();
    if (globalProfile) {
      setName(globalProfile.name || '');
      setPersonalityInfo(globalProfile.personalityInfo || '');
      setProfilePic(globalProfile.profilePic || null);
      alert("Profil berhasil disinkronkan dengan data global! Mmmh, makin kenal deh.. 💦");
    } else {
      alert("Belum ada profil global yang tersimpan sayang..");
    }
  };

  const isDark = appearance.isBackgroundDark;
  const dynamicTextColor = isDark ? 'text-white' : 'text-zinc-900';
  const dynamicMutedTextColor = isDark ? 'text-white/70' : 'text-zinc-500';
  const dynamicBorderColor = isDark ? 'border-white/20' : 'border-black/5';

  const getContrastColor = (hex?: string) => {
    if (!hex) return 'white';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? 'black' : 'white';
  };

  const themeContrastColor = getContrastColor(themeHex);
  const themeTextClass = themeContrastColor === 'black' ? 'text-black' : 'text-white';

  const glassStyles = {
    backgroundColor: isDark ? `rgba(10, 15, 20, ${(appearance?.transparency ?? 0) / 100})` : `rgba(255, 255, 255, ${(appearance?.transparency ?? 0) / 100})`,
    backdropFilter: (appearance?.blur ?? 40) === 0 ? 'none' : `blur(${appearance?.blur ?? 40}px)`,
    WebkitBackdropFilter: (appearance?.blur ?? 40) === 0 ? 'none' : `blur(${appearance?.blur ?? 40}px)`
  };

  const headerStyle = {
    background: isMobile 
      ? (isDark 
          ? `linear-gradient(to bottom, rgba(10, 15, 20, 1) 0%, rgba(10, 15, 20, 1) 25%, rgba(10, 15, 20, ${(appearance?.transparency ?? 0) / 100}) 100%)`
          : `linear-gradient(to bottom, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 25%, rgba(255, 255, 255, ${(appearance?.transparency ?? 0) / 100}) 100%)`)
      : (isDark 
          ? `rgba(10, 15, 20, ${(appearance?.transparency ?? 0) / 100})`
          : `rgba(255, 255, 255, ${(appearance?.transparency ?? 0) / 100})`),
    backdropFilter: (appearance?.blur ?? 40) === 0 ? 'none' : `blur(${appearance?.blur ?? 40}px)`,
    WebkitBackdropFilter: (appearance?.blur ?? 40) === 0 ? 'none' : `blur(${appearance?.blur ?? 40}px)`
  };

  const contentNode = (
    <div 
      className={`relative w-full ${isEmbeddedPage ? 'h-full rounded-none border-none shadow-none pb-[85px] md:pb-0' : 'max-w-lg md:max-w-4xl lg:max-w-5xl md:h-[84vh] md:max-h-[720px] max-h-[92vh] rounded-3xl md:rounded-[36px] border ' + dynamicBorderColor + ' shadow-2xl'} overflow-hidden animate-in fade-in duration-300 flex flex-col md:flex-row`}
      onContextMenu={(e) => {
        // Allow context menu event to bubble
      }}
      style={glassStyles}
    >
      {/* DESKTOP LANDSCAPE SIDEBAR (Visible on md+) */}
      <div className="hidden md:flex md:w-80 lg:w-96 flex-shrink-0 flex-col justify-between border-r border-white/10 p-6 bg-black/15 select-none">
        <div className="space-y-6">
          {/* Header Brand */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div 
                className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
                style={{ backgroundColor: themeHex || '#6366f1' }}
              >
                <User className={`w-5 h-5 ${themeTextClass}`} />
              </div>
              <div className="min-w-0">
                <h2 className={`text-base font-black uppercase tracking-wider truncate ${dynamicTextColor}`}>Profil Saya</h2>
                <p className={`text-[10px] ${dynamicMutedTextColor} font-medium truncate`}>Identitas Pengguna</p>
              </div>
            </div>
            {!isEmbeddedPage && (
              <button onClick={onClose} className={`p-1.5 rounded-full ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'} transition-all ${dynamicMutedTextColor}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Desktop Avatar & Name Card */}
          <div className={`p-5 rounded-[28px] border ${dynamicBorderColor} bg-black/20 flex flex-col items-center gap-4 text-center relative overflow-hidden`}>
            <div className="relative">
              <div className={`w-28 h-28 rounded-[32px] overflow-hidden border-2 shadow-2xl bg-black/40 transition-all duration-500 ${isDark ? 'border-white/15' : 'border-black/15'}`}>
                {profilePic ? (
                  <img src={profilePic} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-500/20">
                    <User className="h-12 w-12" />
                  </div>
                )}
              </div>
              <label 
                className="absolute -bottom-1 -right-1 p-2.5 rounded-2xl cursor-pointer hover:scale-110 active:scale-95 transition-all shadow-xl border border-white/20"
                style={{ backgroundColor: themeHex || '#6366f1' }}
                title="Upload / Ganti Foto"
              >
                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} ref={fileInputRef} />
                <Camera className={`h-4 w-4 ${themeTextClass}`} />
              </label>
            </div>

            <div className="w-full space-y-2">
              <input 
                type="text" 
                className={`w-full bg-transparent border-b border-white/10 focus:border-white/30 pb-1 outline-none font-black ${dynamicTextColor} text-lg text-center placeholder:${isDark ? 'text-white/20' : 'text-black/20'} select-text`} 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="Nama Kamu..." 
              />
              <div className="flex items-center justify-center gap-2 pt-0.5">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: themeHex || '#6366f1' }}></span>
                <p className={`text-[9px] font-bold ${dynamicMutedTextColor} uppercase tracking-widest`}>Pengguna Aktif</p>
              </div>
              {profilePic && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[10px] font-bold transition-all active:scale-95 cursor-pointer"
                  title="Hapus Foto Profil"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Foto</span>
                </button>
              )}
            </div>
          </div>

          {/* Backup & Sync Actions on Desktop */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between px-1">
              <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${dynamicMutedTextColor}`}>Kelola Data</span>
              <button 
                onClick={handleSyncGlobal}
                className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${dynamicBorderColor} ${isDark ? 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white' : 'bg-black/5 hover:bg-black/10 text-black/60 hover:text-black'} transition-all flex items-center gap-1`}
              >
                <RefreshCw className="w-2.5 h-2.5" />
                Sync
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={handleExport}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border ${dynamicBorderColor} ${isDark ? 'bg-white/5 hover:bg-white/10 text-white/80' : 'bg-black/5 hover:bg-black/10 text-black/80'} transition-all text-[9px] font-black uppercase tracking-wider`}
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
              <button 
                onClick={() => importInputRef.current?.click()}
                onDragOver={onDragOverImport}
                onDragLeave={onDragLeaveImport}
                onDrop={onDropImport}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border transition-all text-[9px] font-black uppercase tracking-wider ${isDraggingImport ? 'bg-indigo-500/20 border-indigo-500 scale-[1.05]' : `${dynamicBorderColor} ${isDark ? 'bg-white/5 hover:bg-white/10 text-white/80' : 'bg-black/5 hover:bg-black/10 text-black/80'}`}`}
              >
                <input type="file" ref={importInputRef} className="hidden" accept=".json" onChange={handleImport} />
                <Upload className="w-3.5 h-3.5" />
                Import
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Footer Actions */}
        <div className="pt-4 border-t border-white/10 flex gap-2">
          {!isEmbeddedPage && (
            <button 
              onClick={onClose}
              className={`flex-1 py-3 rounded-2xl font-black uppercase tracking-wider text-[10px] transition-all active:scale-95 ${isDark ? 'bg-white/5 text-white/60 hover:bg-white/10' : 'bg-black/5 text-black/60 hover:bg-black/10'}`}
            >
              Batal
            </button>
          )}
          <button 
            onClick={handleSave}
            className={`flex-1 text-white font-black py-3 rounded-2xl shadow-xl active:scale-[0.98] transition-all uppercase tracking-wider text-[10px] opacity-90 hover:opacity-100`}
            style={{ backgroundColor: themeHex || '#6366f1' }}
          >
            Simpan
          </button>
        </div>
      </div>

      {/* MOBILE TOP HEADER (Visible on mobile only) */}
      <div 
        className="md:hidden px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2.5 border-none flex items-center justify-between min-h-[56px] select-none flex-shrink-0 shadow-lg z-20"
        style={headerStyle}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-1.5 h-6 ${isDark ? 'bg-white' : 'bg-zinc-900'} rounded-full shrink-0 shadow-sm`} />
          <h2 className={`text-2xl font-black tracking-tighter ${dynamicTextColor} select-none truncate`}>Profil Saya</h2>
        </div>
        {!isEmbeddedPage && (
          <button onClick={onClose} className={`p-1.5 rounded-full ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'} transition-all ${dynamicMutedTextColor}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* MAIN CONTENT AREA (Shared between Desktop & Mobile) */}
      <div className="flex-1 h-full overflow-y-auto custom-scrollbar p-6 md:p-8 space-y-6 md:space-y-8">
        
        {/* Mobile Profile Picture & Name Card (Mobile Only) */}
        <section className="space-y-4 md:hidden">
          <label className={`text-[10px] font-black ${dynamicMutedTextColor} uppercase tracking-[0.3em] ml-1 select-none`}>Foto Profil & Nama</label>
          <div className={`p-6 rounded-[32px] border ${dynamicBorderColor} bg-black/20 relative overflow-hidden`}>
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className={`w-20 h-20 rounded-[28px] overflow-hidden border-2 shadow-xl bg-black/40 transition-all duration-500 ${isDark ? 'border-white/10' : 'border-black/10'}`}>
                  {profilePic ? (
                    <img src={profilePic} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500/20">
                      <User className="h-10 w-10" />
                    </div>
                  )}
                </div>
                <label 
                  className="absolute -bottom-1 -right-1 p-2 rounded-xl cursor-pointer hover:scale-110 active:scale-95 transition-all shadow-lg border border-white/20"
                  style={{ backgroundColor: themeHex || '#6366f1' }}
                  title="Upload / Ganti Foto"
                >
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} ref={fileInputRef} />
                  <Camera className={`h-3.5 w-3.5 ${themeTextClass}`} />
                </label>
              </div>
              
              <div className="flex-1 space-y-1">
                <input 
                  type="text" 
                  className={`w-full bg-transparent border-none p-0 outline-none font-black ${dynamicTextColor} text-xl placeholder:${isDark ? 'text-white/10' : 'text-black/10'} select-none`} 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="Nama Kamu..." 
                />
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: themeHex || '#6366f1' }}></span>
                    <p className={`text-[9px] font-bold ${dynamicMutedTextColor} uppercase tracking-widest`}>User Aktif</p>
                  </div>
                  {profilePic && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[10px] font-bold transition-all active:scale-95 cursor-pointer"
                      title="Hapus Foto Profil"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Hapus Foto</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 1. Personality Info */}
        <section className="space-y-3">
          <div className="flex items-center justify-between select-none">
            <label className={`text-[10px] font-black ${dynamicMutedTextColor} uppercase tracking-[0.3em] ml-1`}>
              Tentang Kamu (Personality Info)
            </label>
            <span className={`text-[9px] font-bold ${dynamicMutedTextColor}`}>
              Karakter & Gaya Ngobrol
            </span>
          </div>
          <textarea 
            className={`w-full h-36 ${isDark ? 'bg-white/5' : 'bg-black/5'} border ${dynamicBorderColor} rounded-2xl px-5 py-4 outline-none resize-none text-sm font-medium custom-scrollbar ${isDark ? 'text-white/80' : 'text-black/80'} shadow-inner leading-relaxed select-text`} 
            placeholder="Ceritain dikit tentang kamu biar Agen lebih kenal (misal: hobi, makanan kesukaan, gaya bahasa)..."
            value={personalityInfo} 
            onChange={(e) => setPersonalityInfo(e.target.value)} 
          />
          <p className={`text-[9px] leading-relaxed ${isDark ? 'text-white/30' : 'text-black/30'} px-1`}>
            Informasi ini digunakan oleh semua Karakter Agen untuk mengenali identitas dan gaya bahasa kamu saat mengobrol.
          </p>
        </section>

        {/* 2. Notifikasi & Getar (Mobile / Android) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between select-none">
            <label className={`text-[10px] font-black ${dynamicMutedTextColor} uppercase tracking-[0.3em] ml-1`}>
              Notifikasi & Getar (Mobile / Device)
            </label>
            <span className={`text-[8px] font-bold px-2.5 py-0.5 rounded-full border ${permissionState === 'granted' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
              {permissionState === 'granted' ? 'Izin Bawaan Aktif' : (permissionState === 'unsupported' ? 'Web Only' : 'Perlu Izin Bawaan')}
            </span>
          </div>

          <div className={`p-5 rounded-2xl border ${dynamicBorderColor} ${isDark ? 'bg-white/5' : 'bg-black/5'} space-y-4`}>
            {/* Toggle Suara */}
            <div 
              onClick={() => {
                const next = !notifSound;
                setNotifSound(next);
                saveNotificationSettings({ enableSound: next });
              }}
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 transition-all cursor-pointer select-none"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Volume2 className="w-4 h-4" />
                </div>
                <div>
                  <p className={`text-xs font-bold ${dynamicTextColor}`}>Suara Notifikasi</p>
                  <p className={`text-[9px] ${dynamicMutedTextColor}`}>Putar nada saat balasan/PAP telah selesai</p>
                </div>
              </div>
              <input 
                type="checkbox" 
                checked={notifSound} 
                onChange={(e) => { 
                  e.stopPropagation();
                  setNotifSound(e.target.checked); 
                  saveNotificationSettings({ enableSound: e.target.checked }); 
                }}
                className="w-5 h-5 accent-indigo-500 rounded cursor-pointer"
              />
            </div>

            {/* Toggle Getar */}
            <div 
              onClick={() => {
                const next = !notifVibration;
                setNotifVibration(next);
                saveNotificationSettings({ enableVibration: next });
                if (next) triggerVibration('text');
              }}
              className="flex items-center justify-between p-2.5 rounded-xl border-t border-white/5 hover:bg-white/5 transition-all cursor-pointer select-none"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <p className={`text-xs font-bold ${dynamicTextColor}`}>Getar Mobile / Android</p>
                  <p className={`text-[9px] ${dynamicMutedTextColor}`}>Getarkan HP saat ada balasan/PAP baru</p>
                </div>
              </div>
              <input 
                type="checkbox" 
                checked={notifVibration} 
                onChange={(e) => { 
                  e.stopPropagation();
                  setNotifVibration(e.target.checked); 
                  saveNotificationSettings({ enableVibration: e.target.checked }); 
                  if (e.target.checked) triggerVibration('text');
                }}
                className="w-5 h-5 accent-purple-500 rounded cursor-pointer"
              />
            </div>

            {/* Toggle Notifikasi Bawaan Android/Browser */}
            <div 
              onClick={() => {
                const next = !notifSystem;
                setNotifSystem(next);
                saveNotificationSettings({ enableSystemNotifications: next });
              }}
              className="flex items-center justify-between p-2.5 rounded-xl border-t border-white/5 hover:bg-white/5 transition-all cursor-pointer select-none"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <p className={`text-xs font-bold ${dynamicTextColor}`}>Notifikasi Bawaan Perangkat</p>
                  <p className={`text-[9px] ${dynamicMutedTextColor}`}>Kirim kabar ke status bar Android/Browser</p>
                </div>
              </div>
              <input 
                type="checkbox" 
                checked={notifSystem} 
                onChange={(e) => { 
                  e.stopPropagation();
                  setNotifSystem(e.target.checked); 
                  saveNotificationSettings({ enableSystemNotifications: e.target.checked }); 
                }}
                className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            {/* Tombol Minta Izin Notifikasi Bawaan Android */}
            {permissionState !== 'granted' && permissionState !== 'unsupported' && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    const res = await requestNotificationPermission();
                    setPermissionState(res);
                    if (res === 'granted') {
                      alert("Izin notifikasi Android / Browser berhasil diberikan! 🎉");
                    }
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5" />
                  Aktifkan Izin Notifikasi Android / Browser
                </button>
              </div>
            )}

            {/* Tombol Tes Suara & Getar */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  playNotificationSound('text');
                  triggerVibration('text');
                }}
                className={`flex-1 py-2.5 px-3 rounded-xl border ${dynamicBorderColor} ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} text-[10px] font-bold ${dynamicTextColor} transition-all cursor-pointer`}
              >
                🔔 Tes Nada Pesan
              </button>
              <button
                type="button"
                onClick={() => {
                  playNotificationSound('pap');
                  triggerVibration('pap');
                }}
                className={`flex-1 py-2.5 px-3 rounded-xl border ${dynamicBorderColor} ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} text-[10px] font-bold ${dynamicTextColor} transition-all cursor-pointer`}
              >
                📸 Tes Nada PAP
              </button>
            </div>
          </div>
        </section>

        {/* Mobile Backup & Restore (Mobile Only) */}
        <section className="space-y-4 pt-2 md:hidden">
          <div className="flex items-center justify-between select-none">
            <label className={`text-[10px] font-black ${dynamicMutedTextColor} uppercase tracking-[0.3em] ml-1`}>Backup & Restore Profil</label>
            <button 
              onClick={handleSyncGlobal}
              className={`text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${dynamicBorderColor} ${isDark ? 'bg-white/5 hover:bg-white/10 text-white/40 hover:text-white' : 'bg-black/5 hover:bg-black/10 text-black/40 hover:text-black'} transition-all`}
            >
              Sync Global
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={handleExport}
              className={`flex items-center justify-center gap-2 py-3 rounded-2xl border ${dynamicBorderColor} ${isDark ? 'bg-white/5 hover:bg-white/10 text-white/80' : 'bg-black/5 hover:bg-black/10 text-black/80'} transition-all text-[10px] font-black uppercase tracking-widest`}
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <button 
              onClick={() => importInputRef.current?.click()}
              onDragOver={onDragOverImport}
              onDragLeave={onDragLeaveImport}
              onDrop={onDropImport}
              className={`flex items-center justify-center gap-2 py-3 rounded-2xl border transition-all text-[10px] font-black uppercase tracking-widest ${isDraggingImport ? 'bg-indigo-500/20 border-indigo-500 scale-[1.05] shadow-xl' : `${dynamicBorderColor} ${isDark ? 'bg-white/5 hover:bg-white/10 text-white/80' : 'bg-black/5 hover:bg-black/10 text-black/80'}`}`}
            >
              <input type="file" ref={importInputRef} className="hidden" accept=".json" onChange={handleImport} />
              <Upload className={`h-4 w-4 ${isDraggingImport ? 'text-indigo-500 animate-bounce' : ''}`} />
              {isDraggingImport ? 'Lepas Profil' : 'Import'}
            </button>
          </div>
        </section>

      </div>

      {/* MOBILE BOTTOM FOOTER (Visible on mobile only) */}
      <div className="md:hidden p-5 flex gap-3 border-t border-white/10 flex-shrink-0">
        <button 
          onClick={onClose}
          className={`flex-1 py-3.5 rounded-[22px] font-black uppercase tracking-[0.2em] text-[10px] transition-all active:scale-95 ${isDark ? 'bg-white/5 text-white/60 hover:bg-white/10' : 'bg-black/5 text-black/60 hover:bg-black/10'}`}
        >
          Batal
        </button>
        <button 
          onClick={handleSave}
          className={`flex-1 text-white font-black py-3.5 rounded-[22px] shadow-xl active:scale-[0.98] transition-all uppercase tracking-[0.3em] text-[10px] opacity-90 hover:opacity-100`}
          style={{ backgroundColor: themeHex || '#6366f1' }}
        >
          Simpan
        </button>
      </div>
    </div>
  );

  if (isEmbeddedPage) {
    return contentNode;
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-6">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      {contentNode}
    </div>
  );
};

export default UserProfileModal;
