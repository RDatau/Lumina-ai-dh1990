import React, { useState, useRef } from 'react';
import { AgentConfig, GlobalAppearance, AppState } from '../types';
import GlassDropdown from './GlassDropdown';
import { dbService, FullBackup } from '../services/dbService';
import { Sparkles, SlidersHorizontal, User, Trash2, Save, Download, Upload, RotateCcw, AlertTriangle, Check, Camera, Plus } from 'lucide-react';

const DEFAULT_CHARACTER_PIC = 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&q=80&w=600';

interface SetupViewProps {
  config: AgentConfig;
  setConfig: (config: AgentConfig) => void;
  profiles: AgentConfig[];
  setProfiles: (profiles: AgentConfig[]) => void;
  onStart: () => void;
  onReset: () => void;
  onResetMemory?: () => void;
  onClose?: () => void;
  onConfirmAction?: (message: string, onConfirm: () => void) => void;
  onRestoreClick?: (data: FullBackup) => void;
  onExportClick?: (config: AgentConfig) => void;
  onOpenAppearance?: () => void;
  onNavigate?: (state: string) => void;
  appearance: GlobalAppearance;
  isBackgroundDark: boolean;
  setIsBackgroundDark: (dark: boolean) => void;
  themeHex?: string;
}

const SetupView: React.FC<SetupViewProps> = ({ 
  config, 
  setConfig, 
  profiles, 
  setProfiles, 
  onStart, 
  onReset, 
  onResetMemory, 
  onClose, 
  onConfirmAction, 
  onRestoreClick, 
  onExportClick, 
  onOpenAppearance, 
  onNavigate, 
  appearance, 
  isBackgroundDark, 
  themeHex 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingImport, setIsDraggingImport] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const handleSaveProfile = () => {
    let newProfiles = [...profiles];
    let currentConfig = { ...config };
    
    if (!currentConfig.id || currentConfig.id === 'default') {
      currentConfig.id = Date.now().toString();
      setConfig(currentConfig);
      newProfiles.push(currentConfig);
    } else {
      const existingIndex = profiles.findIndex(p => p.id === currentConfig.id);
      if (existingIndex >= 0) {
        newProfiles[existingIndex] = currentConfig;
      } else {
        newProfiles.push(currentConfig);
      }
    }
    setProfiles(newProfiles);
  };

  const handleDeleteProfile = async () => {
    if (!config.id || config.id === 'default') {
      alert('Profil default tidak bisa dihapus.');
      return;
    }
    
    const doDelete = async () => {
      const newProfiles = profiles.filter(p => p.id !== config.id);
      setProfiles(newProfiles);
      await dbService.saveProfiles(newProfiles);
      
      if (newProfiles.length > 0) {
        setConfig(newProfiles[0]);
      } else {
        handleLoadProfile('new');
      }
    };

    if (onConfirmAction) {
      onConfirmAction(`Yakin ingin menghapus profil "${config.name}"?`, doDelete);
    } else {
      if (confirm(`Yakin ingin menghapus profil "${config.name}"?`)) {
        doDelete();
      }
    }
  };

  const handleLoadProfile = async (profileId: string) => {
    if (config.id) {
      await dbService.saveConfig(config);
    }

    if (profileId === 'new') {
      setConfig({
        id: Date.now().toString(),
        name: 'Karakter Baru',
        personality: '',
        profilePic: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&q=80&w=600',
        background: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=600',
        blur: 40,
        transparency: 0
      });
    } else {
      const selected = profiles.find(p => p.id === profileId);
      if (selected) setConfig(selected);
    }
  };

  const handleFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setConfig({ ...config, profilePic: reader.result as string });
      reader.readAsDataURL(file);
    }
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement> | File) => {
    const file = e instanceof File ? e : e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.type === 'global') {
          alert('Gunakan menu Sidebar untuk Restore Global.');
        } else {
          if (!json.config || !Array.isArray(json.messages)) {
            throw new Error("Format file backup tidak valid.");
          }
          if (onConfirmAction && onRestoreClick) {
            onConfirmAction(`Yakin ingin merestore profil "${json.config.name}"? Ini akan menimpa data profil ini.`, () => {
              onRestoreClick(json as FullBackup);
            });
          }
        }
      } catch (err) {
        alert("Gagal membaca file backup.");
      }
    };
    reader.readAsText(file);
    if (!(e instanceof File)) e.target.value = '';
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
      handleRestoreFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const dynamicTextColor = isBackgroundDark ? 'text-white' : 'text-zinc-900';
  const dynamicMutedTextColor = isBackgroundDark ? 'text-white/70' : 'text-zinc-500';
  const dynamicBorderColor = isBackgroundDark ? 'border-white/15' : 'border-zinc-300';
  const dynamicBg = isBackgroundDark ? 'bg-zinc-950/95' : 'bg-white/95';

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

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 md:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      {/* Modal Container: expands to landscape on md+ screens */}
      <div className={`relative w-full max-w-lg md:max-w-4xl lg:max-w-5xl xl:max-w-6xl md:h-[84vh] md:max-h-[720px] max-h-[92vh] ${dynamicBg} backdrop-blur-2xl border ${dynamicBorderColor} rounded-3xl md:rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col md:flex-row`}>
        
        {/* DESKTOP / WIDE SIDEBAR (Visible on md+) */}
        <div className="hidden md:flex md:w-64 lg:w-72 flex-shrink-0 flex-col justify-between border-r border-white/10 p-5 lg:p-6 bg-black/15 select-none">
          <div className="space-y-5">
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
                <p className={`text-[10px] ${dynamicMutedTextColor} font-medium truncate`}>Karakter & Persona</p>
              </div>
            </div>

            {/* Avatar & Name Card */}
            <div className={`p-4 rounded-2xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-white/5' : 'bg-black/5'} space-y-3`}>
              <div className="flex items-center gap-3.5">
                <div className="relative flex-shrink-0">
                  <div 
                    className={`w-14 h-14 rounded-2xl overflow-hidden border-2 shadow-lg bg-black/40 transition-all duration-300 ${isDragging ? 'scale-105 border-indigo-500' : dynamicBorderColor}`}
                    onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                  >
                    {config.profilePic ? (
                      <img src={config.profilePic} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-500">
                        <User className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <label 
                    className="absolute -bottom-1 -right-1 p-1.5 rounded-lg cursor-pointer hover:scale-110 active:scale-95 transition-all shadow-md border border-white/20"
                    style={{ backgroundColor: themeHex || '#6366f1' }}
                    title="Ganti Foto"
                  >
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                    <Camera className={`h-2.5 w-2.5 ${themeTextClass}`} />
                  </label>
                  {config.profilePic && config.profilePic !== DEFAULT_CHARACTER_PIC && (
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, profilePic: DEFAULT_CHARACTER_PIC })}
                      className="absolute -top-1 -right-1 p-1 rounded-lg bg-indigo-500/90 hover:bg-indigo-600 text-white cursor-pointer hover:scale-110 active:scale-95 transition-all shadow-md border border-white/20"
                      title="Reset Foto Profil Karakter ke Default"
                    >
                      <RotateCcw className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <label className={`text-[9px] font-black uppercase tracking-wider ${dynamicMutedTextColor} block`}>Nama Agen</label>
                  <input 
                    type="text" 
                    className={`w-full bg-transparent border-none p-0 outline-none font-black ${dynamicTextColor} text-sm placeholder:${isBackgroundDark ? 'text-white/20' : 'text-black/20'} truncate`} 
                    value={config.name} 
                    onChange={(e) => setConfig({ ...config, name: e.target.value })} 
                    placeholder="Nama Agen..." 
                  />
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: themeHex || '#6366f1' }} />
                    <span className={`text-[8px] font-bold ${dynamicMutedTextColor} uppercase tracking-wider`}>Siap Beraksi</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Selector */}
            <div className={`p-4 rounded-2xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-white/5' : 'bg-black/5'} space-y-2.5`}>
              <div className="flex items-center justify-between">
                <label className={`text-[9px] font-black ${dynamicMutedTextColor} uppercase tracking-wider`}>Pilih Profil</label>
                <button 
                  onClick={handleSaveProfile} 
                  className="text-[9px] font-black uppercase tracking-wider flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity" 
                  style={{ color: themeHex || '#6366f1' }}
                >
                  <Save className="w-2.5 h-2.5" />
                  Simpan
                </button>
              </div>
              <div className="flex gap-1.5">
                <div className="flex-1 min-w-0">
                  <GlassDropdown
                    size="sm"
                    value={config.id || 'default'}
                    onChange={handleLoadProfile}
                    placeholder="Pilih Profil..."
                    isBackgroundDark={isBackgroundDark}
                    themeHex={themeHex}
                    options={[
                      ...profiles.map(p => ({ value: p.id || `profile-${Math.random()}`, label: p.name })),
                      { value: 'new', label: '+ Karakter Baru' }
                    ]}
                  />
                </div>
                {config.id && config.id !== 'default' && (
                  <button 
                    onClick={handleDeleteProfile} 
                    className="p-2.5 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all flex-shrink-0"
                    title="Hapus Profil Ini"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Bottom: Selesai action */}
          <div className="pt-4 border-t border-white/10 space-y-2.5">
            <button
              onClick={() => {
                handleSaveProfile();
                onStart();
              }}
              className="w-full text-white font-bold py-2.5 px-4 rounded-xl shadow-lg active:scale-[0.98] transition-all uppercase tracking-wider text-[11px] opacity-95 hover:opacity-100 flex items-center justify-center gap-2"
              style={{ backgroundColor: themeHex || '#6366f1' }}
            >
              <Check className="w-3.5 h-3.5" />
              Selesai & Mulai
            </button>
          </div>
        </div>

        {/* MOBILE HEADER (Visible on small screens only) */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between md:hidden flex-shrink-0 select-none">
          <div className="flex items-center gap-2.5">
            <div className={`w-1.5 h-4 rounded-full`} style={{ backgroundColor: themeHex || '#6366f1' }} />
            <h2 className={`text-xs font-black uppercase tracking-[0.2em] ${dynamicTextColor}`}>Pengaturan Karakter</h2>
          </div>
          {onClose && (
            <button onClick={onClose} className={`p-1.5 rounded-full ${isBackgroundDark ? 'hover:bg-white/10' : 'hover:bg-black/10'} transition-all ${dynamicMutedTextColor}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* RIGHT MAIN PANEL (Landscape workbench) */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          
          {/* Desktop Top Header Bar */}
          <div className="hidden md:flex items-center justify-between px-6 py-4 border-b border-white/10 select-none flex-shrink-0">
            <div>
              <h3 className={`text-sm font-black uppercase tracking-wider ${dynamicTextColor}`}>
                {config.name || 'Pengaturan Karakter'}
              </h3>
              <p className={`text-[10px] ${dynamicMutedTextColor}`}>
                Kustomisasi vibes kepribadian, memory, import/export, dan alat karakter
              </p>
            </div>
            {onClose && (
              <button 
                onClick={onClose} 
                className={`p-2 rounded-xl border border-white/10 ${isBackgroundDark ? 'hover:bg-white/10' : 'hover:bg-black/10'} transition-all ${dynamicMutedTextColor}`}
                title="Tutup (Esc)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Scrollable Content with 2-Column Responsive Landscape Grid */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 lg:p-7 space-y-4">
            
            {/* Mobile-only avatar and profile selector */}
            <div className="md:hidden space-y-3">
              {/* Profile Card Mobile */}
              <div className={`p-4 rounded-2xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-white/5' : 'bg-black/5'} flex items-center gap-4`}>
                <div className="relative flex-shrink-0">
                  <div 
                    className={`w-14 h-14 rounded-2xl overflow-hidden border-2 shadow-md bg-black/40 ${dynamicBorderColor}`}
                    onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                  >
                    {config.profilePic ? (
                      <img src={config.profilePic} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-500">
                        <User className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <label 
                    className="absolute -bottom-1 -right-1 p-1.5 rounded-lg cursor-pointer shadow-md border border-white/20"
                    style={{ backgroundColor: themeHex || '#6366f1' }}
                  >
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                    <Camera className={`h-2.5 w-2.5 ${themeTextClass}`} />
                  </label>
                  {config.profilePic && config.profilePic !== DEFAULT_CHARACTER_PIC && (
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, profilePic: DEFAULT_CHARACTER_PIC })}
                      className="absolute -top-1 -right-1 p-1 rounded-lg bg-indigo-500/90 hover:bg-indigo-600 text-white cursor-pointer shadow-md border border-white/20"
                      title="Reset Foto Profil Karakter ke Default"
                    >
                      <RotateCcw className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <input 
                    type="text" 
                    className={`w-full bg-transparent border-none p-0 outline-none font-black ${dynamicTextColor} text-base placeholder:${isBackgroundDark ? 'text-white/20' : 'text-black/20'}`} 
                    value={config.name} 
                    onChange={(e) => setConfig({ ...config, name: e.target.value })} 
                    placeholder="Nama Karakter..." 
                  />
                  <p className={`text-[9px] font-bold ${dynamicMutedTextColor} uppercase tracking-wider mt-0.5`}>Aktif & Siap</p>
                </div>
              </div>

              {/* Selector Mobile */}
              <div className={`p-3 rounded-2xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-white/5' : 'bg-black/5'} space-y-2`}>
                <div className="flex items-center justify-between">
                  <label className={`text-[9px] font-black ${dynamicMutedTextColor} uppercase tracking-wider`}>Pilih Profil</label>
                  <button 
                    onClick={handleSaveProfile} 
                    className="text-[9px] font-black uppercase tracking-wider" 
                    style={{ color: themeHex || '#6366f1' }}
                  >
                    Simpan Perubahan
                  </button>
                </div>
                <div className="flex gap-1.5">
                  <div className="flex-1 min-w-0">
                    <GlassDropdown
                      size="sm"
                      value={config.id || 'default'}
                      onChange={handleLoadProfile}
                      placeholder="Pilih Profil..."
                      isBackgroundDark={isBackgroundDark}
                      themeHex={themeHex}
                      options={[
                        ...profiles.map(p => ({ value: p.id || `profile-${Math.random()}`, label: p.name })),
                        { value: 'new', label: '+ Karakter Baru' }
                      ]}
                    />
                  </div>
                  {config.id && config.id !== 'default' && (
                    <button 
                      onClick={handleDeleteProfile} 
                      className="p-2 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Responsive Landscape Grid for Desktop & Mobile */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5 items-start">
              
              {/* Column 1: Character Wizard & Personality */}
              <div className="space-y-4">
                {/* Character Wizard Entry */}
                {onNavigate && (
                  <button
                    onClick={() => onNavigate?.(AppState.WIZARD)}
                    className={`w-full group relative overflow-hidden p-4 rounded-2xl border transition-all active:scale-[0.98] text-left ${
                      isBackgroundDark ? 'hover:bg-opacity-20' : 'hover:bg-opacity-10'
                    }`}
                    style={{
                      backgroundColor: isBackgroundDark ? `${themeHex}1a` : `${themeHex}0d`,
                      borderColor: isBackgroundDark ? `${themeHex}33` : `${themeHex}26`
                    }}
                  >
                    <div className="flex items-center gap-3 relative z-10">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md flex-shrink-0"
                        style={{ 
                          backgroundColor: isBackgroundDark ? `${themeHex}33` : themeHex,
                          color: isBackgroundDark ? themeHex : 'white'
                        }}
                      >
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-black uppercase tracking-wider" style={{ color: themeHex }}>Character Wizard</h4>
                          <span className="text-[8px] font-bold px-1.5 py-0.2 rounded-full border border-current opacity-70">AI</span>
                        </div>
                        <p className="text-[9px] font-medium mt-0.5 truncate opacity-80" style={{ color: themeHex }}>
                          Racik karakter impianmu bareng Lumina ✨
                        </p>
                      </div>
                    </div>
                  </button>
                )}

                {/* Personality & Vibes Textarea */}
                <div className={`p-4 rounded-2xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-white/5' : 'bg-black/5'} space-y-2.5`}>
                  <div className="flex items-center justify-between select-none">
                    <label className={`text-[10px] font-black ${dynamicMutedTextColor} uppercase tracking-[0.25em]`}>
                      Personality & Vibes
                    </label>
                    <span className={`text-[8px] font-mono ${dynamicMutedTextColor}`}>
                      {config.personality?.length || 0} karakter
                    </span>
                  </div>
                  <textarea 
                    className={`w-full h-36 md:h-44 ${isBackgroundDark ? 'bg-black/20' : 'bg-white/30'} border ${dynamicBorderColor} rounded-xl p-3 outline-none resize-none text-xs font-medium custom-scrollbar ${dynamicTextColor} placeholder:${isBackgroundDark ? 'text-white/20' : 'text-black/20'} leading-relaxed`} 
                    placeholder="Deskripsikan karakter ini: nada bicara, kepribadian, gaya bahasa, panggilan khusus sayang, dsb..."
                    value={config.personality} 
                    onChange={(e) => setConfig({ ...config, personality: e.target.value })} 
                  />
                  <p className={`text-[9px] ${dynamicMutedTextColor} leading-relaxed`}>
                    Karakter akan menyesuaikan gaya percakapan dan intonasi suara berdasarkan deskripsi ini.
                  </p>
                </div>
              </div>

              {/* Column 2: Tools & Danger Zone */}
              <div className="space-y-4">
                {/* Tools & Quick Actions */}
                <div className={`p-4 rounded-2xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-white/5' : 'bg-black/5'} space-y-3`}>
                  <label className={`text-[10px] font-black ${dynamicMutedTextColor} uppercase tracking-[0.25em] select-none block`}>
                    Tools & Pengaturan
                  </label>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      onClick={onOpenAppearance}
                      className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} transition-all group`}
                    >
                      <SlidersHorizontal className={`h-4 w-4 ${dynamicMutedTextColor} group-hover:text-indigo-400 transition-colors`} />
                      <span className={`text-[8px] font-black uppercase tracking-wider ${dynamicTextColor} opacity-80 group-hover:opacity-100 truncate`}>
                        Pengaturan
                      </span>
                    </button>
                    
                    <button 
                      onClick={() => restoreInputRef.current?.click()}
                      onDragOver={onDragOverImport}
                      onDragLeave={onDragLeaveImport}
                      onDrop={onDropImport}
                      className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl border transition-all group ${
                        isDraggingImport 
                          ? 'bg-indigo-500/20 border-indigo-500 scale-[1.02] shadow-md' 
                          : `${dynamicBorderColor} ${isBackgroundDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`
                      }`}
                    >
                      <Upload className={`h-4 w-4 ${isDraggingImport ? 'text-indigo-400 animate-bounce' : dynamicMutedTextColor} group-hover:text-indigo-400 transition-colors`} />
                      <span className={`text-[8px] font-black uppercase tracking-wider ${dynamicTextColor} opacity-80 group-hover:opacity-100 truncate`}>
                        {isDraggingImport ? 'Lepas File' : 'Import'}
                      </span>
                    </button>

                    <button 
                      onClick={() => onExportClick && onExportClick(config)}
                      className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl border ${dynamicBorderColor} ${isBackgroundDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} transition-all group`}
                    >
                      <Download className={`h-4 w-4 ${dynamicMutedTextColor} group-hover:text-indigo-400 transition-colors`} />
                      <span className={`text-[8px] font-black uppercase tracking-wider ${dynamicTextColor} opacity-80 group-hover:opacity-100 truncate`}>
                        Export
                      </span>
                    </button>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className={`p-4 rounded-2xl border border-red-500/15 ${isBackgroundDark ? 'bg-red-500/5' : 'bg-red-500/5'} space-y-3`}>
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                    <label className="text-[10px] font-black text-red-400 uppercase tracking-[0.25em] select-none block">
                      Danger Zone
                    </label>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={onResetMemory} 
                      className="w-full text-[9px] font-black uppercase tracking-wider text-orange-400 hover:text-orange-300 py-2.5 px-2 border border-orange-500/20 hover:bg-orange-500/10 rounded-xl transition-all flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span className="truncate">Reset Memori</span>
                    </button>
                    
                    <button 
                      onClick={onReset} 
                      className="w-full text-[9px] font-black uppercase tracking-wider text-red-400 hover:text-red-300 py-2.5 px-2 border border-red-500/20 hover:bg-red-500/10 rounded-xl transition-all flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span className="truncate">Reset DB</span>
                    </button>
                  </div>
                  <p className="text-[8px] text-red-400/60 leading-tight">
                    Reset Memori menghapus transkrip & memori obrolan karakter ini. Reset DB mengembalikan seluruh database.
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* MOBILE FOOTER (Visible on mobile only) */}
          <div className="p-3 border-t border-white/10 md:hidden flex-shrink-0">
            <button 
              onClick={() => {
                handleSaveProfile();
                onStart();
              }}
              className="w-full text-white font-bold py-2.5 rounded-xl shadow-md active:scale-[0.98] transition-all uppercase tracking-wider text-xs opacity-95 hover:opacity-100 flex items-center justify-center gap-1.5"
              style={{ backgroundColor: themeHex || '#6366f1' }}
            >
              <Check className="w-3.5 h-3.5" />
              Selesai & Mulai
            </button>
          </div>

        </div>
      </div>

      <input 
        type="file" 
        ref={restoreInputRef} 
        className="hidden" 
        accept=".json" 
        onChange={handleRestoreFile} 
      />
    </div>
  );
};

export default SetupView;
