import React from 'react';
import { AgentConfig, GlobalAppearance, ActiveGenerationTask, ChatMessage } from '../types';
import { cleanResponseText } from '../services/geminiService';

interface ProfileSelectorViewProps {
  profiles: AgentConfig[];
  onSelect: (profile: AgentConfig) => void;
  onBack: () => void;
  onNew: () => void;
  onOpenAppearance?: () => void;
  onBackup?: () => void;
  onRestore?: () => void;
  onGlobalBackup?: () => void;
  onGlobalRestore?: () => void;
  appearance: GlobalAppearance;
  config: AgentConfig; // Current config for styling context
  themeHex?: string;
  isSidebar?: boolean;
  isBackgroundDark?: boolean;
  appState?: any; // Using any to avoid importing AppState if not needed, but we'll use it for logic
  onContextMenu?: (e: any, items: any[]) => void;
  onLongPress?: (e: any, items: any[]) => void;
  onTouchMove?: () => void;
  onTouchEnd?: () => void;
  onEditAgent?: (p: AgentConfig) => void;
  onDeleteAgent?: (p: AgentConfig) => void;
  onExportAgent?: (p: AgentConfig) => void;
  onResetProfilePic?: (p: AgentConfig) => void;
  activeGenerations?: ActiveGenerationTask[];
  lastMessagesMap?: Record<string, ChatMessage>;
  unreadCountsMap?: Record<string, number>;
  onToggleUnread?: (p: AgentConfig) => void;
}

const ProfileSelectorView: React.FC<ProfileSelectorViewProps> = ({ 
  profiles, 
  onSelect, 
  onBack, 
  onNew, 
  onOpenAppearance, 
  onBackup, 
  onRestore, 
  onGlobalBackup, 
  onGlobalRestore, 
  appearance, 
  config, 
  themeHex, 
  isSidebar, 
  isBackgroundDark = true, 
  appState,
  onContextMenu,
  onLongPress,
  onTouchMove,
  onTouchEnd,
  onEditAgent,
  onDeleteAgent,
  onExportAgent,
  onResetProfilePic,
  activeGenerations = [],
  lastMessagesMap = {},
  unreadCountsMap = {},
  onToggleUnread
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isDraggingRestore, setIsDraggingRestore] = React.useState(false);
  const [isDraggingGlobal, setIsDraggingGlobal] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const handleFileDrop = (e: React.DragEvent, callback?: (file: File) => void) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.json')) {
      callback?.(file);
    }
  };

  const handleDragOver = (e: React.DragEvent, setter: (val: boolean) => void) => {
    e.preventDefault();
    e.stopPropagation();
    setter(true);
  };

  const handleDragLeave = (e: React.DragEvent, setter: (val: boolean) => void) => {
    e.preventDefault();
    e.stopPropagation();
    setter(false);
  };

  const processRestoreFile = (file: File, isGlobal: boolean) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        // We trigger the same logic as the input change by creating a mock event or just calling a handler
        // But here we can just use the props
        if (isGlobal) {
          // App.tsx handles the actual file reading usually, but here we just have onGlobalRestore
          // Wait, onGlobalRestore in App.tsx opens a file picker.
          // I need to change how onRestore/onGlobalRestore works to accept a file optionally.
          // Or I can just handle the file reading here and pass the data if the prop supports it.
          // Looking at App.tsx, onGlobalRestore doesn't take arguments.
          // I might need to update App.tsx too.
        }
      } catch (err) {
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const getContrastColor = (hex?: string) => {
    if (!hex) return 'white';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? 'black' : 'white';
  };

  const handleBgContextMenu = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const items = [
      { label: 'Import Profil', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>, onClick: () => onRestore?.() },
      { label: 'Export Selected Profil', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>, onClick: () => onBackup?.() },
      { label: 'Import Global', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>, onClick: () => onGlobalRestore?.() },
      { label: 'Export Global', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>, onClick: () => onGlobalBackup?.() },
    ];
    onContextMenu?.(e, items);
  };

  const handleBgLongPress = (e: React.TouchEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const items = [
      { label: 'Import Profil', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>, onClick: () => onRestore?.() },
      { label: 'Export Selected Profil', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>, onClick: () => onBackup?.() },
      { label: 'Import Global', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>, onClick: () => onGlobalRestore?.() },
      { label: 'Export Global', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>, onClick: () => onGlobalBackup?.() },
    ];
    onLongPress?.(e, items);
  };

  const handleAgentNameMenu = (e: React.MouseEvent | React.TouchEvent, p: AgentConfig) => {
    e.stopPropagation();
    const isUnread = (unreadCountsMap[p.id || ''] || 0) > 0;
    const items = [
      { label: isUnread ? 'Tandai Sudah Terbaca' : 'Tandai Belum Terbaca', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>, onClick: () => onToggleUnread?.(p) },
      { label: 'Pengaturan Character', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>, onClick: () => onEditAgent?.(p) },
      { label: 'Export', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>, onClick: () => onExportAgent?.(p) },
      { label: 'Hapus', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>, variant: 'danger' as const, onClick: () => onDeleteAgent?.(p) },
      { label: 'Import Global', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>, onClick: () => onGlobalRestore?.() },
      { label: 'Export Global', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>, onClick: () => onGlobalBackup?.() },
    ];
    if ('clientX' in e) onContextMenu?.(e, items);
    else onLongPress?.(e, items);
  };

  const handleProfilePicMenu = (e: React.MouseEvent | React.TouchEvent, p: AgentConfig) => {
    e.stopPropagation();
    const items = [
      { label: 'Download', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>, onClick: () => p.profilePic && downloadMedia(p.profilePic, `${p.name}_profile.png`, 'image/png') },
      { label: 'Ganti/Upload', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>, onClick: () => onEditAgent?.(p) },
      { label: 'Reset Default', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357-2H15" /></svg>, onClick: () => onResetProfilePic?.(p) },
      { label: 'Import Global', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>, onClick: () => onGlobalRestore?.() },
      { label: 'Export Global', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>, onClick: () => onGlobalBackup?.() },
    ];
    if ('clientX' in e) onContextMenu?.(e, items);
    else onLongPress?.(e, items);
  };

  const downloadMedia = async (urlOrBase64: string, fileName: string, mimeType: string) => {
    try {
      if (urlOrBase64.startsWith('http')) {
        const response = await fetch(urlOrBase64);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 100);
        return;
      }
      const binaryString = window.atob(urlOrBase64.split(',')[1] || urlOrBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const isDataUrl = urlOrBase64.startsWith('data:');
      const finalMime = isDataUrl ? urlOrBase64.split(':')[1].split(';')[0] : mimeType;
      const blob = new Blob([bytes], { type: finalMime });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (e) {
      const link = document.createElement('a');
      link.href = urlOrBase64;
      link.download = fileName;
      link.target = "_blank";
      link.click();
    }
  };

  const handleTouchMoveInternal = () => {
    onTouchMove?.();
  };
  const handleTouchEndInternal = () => {
    onTouchEnd?.();
  };

  const contrastColor = getContrastColor(themeHex);
  const themeTextClass = isBackgroundDark ? 'text-white' : 'text-zinc-900';
  const themeMutedTextColor = isBackgroundDark ? 'text-white/50' : 'text-zinc-500';
  const themeIconClass = isBackgroundDark ? 'text-white/30' : 'text-zinc-400';
  const themeBorderColor = isBackgroundDark ? 'border-white/10' : 'border-black/5';
  
  const glassStyles = {
    backgroundColor: isBackgroundDark ? `rgba(10, 15, 20, ${(appearance?.transparency ?? 0) / 100})` : `rgba(255, 255, 255, ${(appearance?.transparency ?? 0) / 100})`,
    backdropFilter: `blur(${appearance?.blur ?? 40}px)`,
    WebkitBackdropFilter: `blur(${appearance?.blur ?? 40}px)`
  };

  const menuGlassStyles = {
    backgroundColor: isBackgroundDark ? 'rgba(15, 15, 15, 0.75)' : 'rgba(255, 255, 255, 0.75)',
    backdropFilter: `blur(${appearance?.blur ?? 25}px)`,
    WebkitBackdropFilter: `blur(${appearance?.blur ?? 25}px)`
  };

  // Sort profiles by unread status first, then by newest incoming message timestamp descending
  const sortedProfiles = React.useMemo(() => {
    return [...profiles]
      .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        const unreadA = (unreadCountsMap?.[a.id || ''] || 0) > 0 ? 1 : 0;
        const unreadB = (unreadCountsMap?.[b.id || ''] || 0) > 0 ? 1 : 0;
        const timeA = lastMessagesMap?.[a.id || '']?.timestamp || 0;
        const timeB = lastMessagesMap?.[b.id || '']?.timestamp || 0;

        // 1. Unread profiles float to top
        if (unreadA !== unreadB) return unreadB - unreadA;
        // 2. Newest message timestamp on top
        if (timeA !== timeB) return timeB - timeA;
        // 3. Fallback name comparison
        return a.name.localeCompare(b.name);
      });
  }, [profiles, searchQuery, lastMessagesMap, unreadCountsMap]);

  return (
    <div 
      className="w-full h-full flex flex-col animate-in fade-in duration-500 relative overflow-hidden"
      onContextMenu={handleBgContextMenu}
      onTouchStart={handleBgLongPress}
      onTouchMove={handleTouchMoveInternal}
      onTouchEnd={handleTouchEndInternal}
      style={{ 
        paddingTop: '0px'
      }}
    >
      {/* Unified Glass Container */}
      <div 
        className={`flex-1 flex flex-col overflow-hidden shadow-2xl transition-all duration-500`}
        style={glassStyles}
      >
        {/* Header Section */}
        <div className={`flex-shrink-0 p-4 px-6 md:p-6 relative`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 mb-0">
              <div className="w-8 h-8 rounded-lg flex md:hidden items-center justify-center shadow-lg overflow-hidden">
                <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' className="w-full h-full">
                  <defs>
                    <linearGradient id='logoGradientProfile' x1='0%' y1='0%' x2='100%' y2='100%'>
                      <stop offset='0%' style={{ stopColor: themeHex || '#f43f5e', stopOpacity: 1 }} />
                      <stop offset='100%' style={{ stopColor: themeHex || '#881337', stopOpacity: 0.8 }} />
                    </linearGradient>
                  </defs>
                  <rect width='100' height='100' rx='30' fill='rgba(0,0,0,0.8)'/>
                  <path d='M35 25 Q35 75 35 75 L65 75' stroke='url(#logoGradientProfile)' strokeWidth='12' fill='none' strokeLinecap='round'/>
                  <circle cx='70' cy='30' r='8' fill={themeHex || '#f43f5e'} opacity='1' />
                </svg>
              </div>
              <h1 className={`text-2xl md:text-3xl font-black tracking-tighter ${themeTextClass}`}>Lumina</h1>
            </div>
            
            <div className="relative" ref={menuRef}>
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`p-2 rounded-xl transition-all ${isBackgroundDark ? 'hover:bg-white/10 text-white/40' : 'hover:bg-black/10 text-black/40'} active:scale-90`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>

              {isMenuOpen && (
                <div 
                  className={`absolute right-0 mt-2 w-56 rounded-2xl shadow-2xl border ${themeBorderColor} z-[101] overflow-hidden animate-in slide-in-from-top-2 duration-200 origin-top-right glass-menu`}
                  style={{ 
                    backgroundColor: isBackgroundDark ? 'rgba(15, 15, 15, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(40px)',
                    WebkitBackdropFilter: 'blur(40px)'
                  }}
                >
                  <div className="p-2 space-y-1">
                      <div className={`px-3 py-2 text-[9px] font-black uppercase tracking-widest ${themeMutedTextColor}`}>Individu (Agen Aktif)</div>
                      <button 
                        onClick={() => { onBackup?.(); setIsMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${isBackgroundDark ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-black/70 hover:bg-black/5 hover:text-black'}`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${isBackgroundDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                        </div>
                        Export Selected Profil
                      </button>
                      <button 
                        onClick={() => { onRestore?.(); setIsMenuOpen(false); }}
                        onDragOver={(e) => handleDragOver(e, setIsDraggingRestore)}
                        onDragLeave={(e) => handleDragLeave(e, setIsDraggingRestore)}
                        onDrop={(e) => {
                          handleFileDrop(e, (file) => {
                            setIsDraggingRestore(false);
                            const event = new CustomEvent('lumina-restore-file', { detail: { file, isGlobal: false } });
                            window.dispatchEvent(event);
                            setIsMenuOpen(false);
                          });
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${isDraggingRestore ? 'bg-indigo-500/20 scale-[1.02] border-indigo-500/50' : ''} ${isBackgroundDark ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-black/70 hover:bg-black/5 hover:text-black'}`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${isDraggingRestore ? 'bg-indigo-500 border-indigo-400 animate-pulse' : (isBackgroundDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10')}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isDraggingRestore ? 'text-white' : 'opacity-50'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </div>
                        {isDraggingRestore ? 'Lepas untuk Import' : 'Import Profil'}
                      </button>

                      <div className={`px-3 py-2 mt-2 text-[9px] font-black uppercase tracking-widest ${themeMutedTextColor} border-t ${themeBorderColor}`}>Global (Semua Data)</div>
                      <button 
                        onClick={() => { onGlobalBackup?.(); setIsMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${isBackgroundDark ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-black/70 hover:bg-black/5 hover:text-black'}`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${isBackgroundDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                          </svg>
                        </div>
                        Export Semua
                      </button>
                      <button 
                        onClick={() => { onGlobalRestore?.(); setIsMenuOpen(false); }}
                        onDragOver={(e) => handleDragOver(e, setIsDraggingGlobal)}
                        onDragLeave={(e) => handleDragLeave(e, setIsDraggingGlobal)}
                        onDrop={(e) => {
                          handleFileDrop(e, (file) => {
                            setIsDraggingGlobal(false);
                            const event = new CustomEvent('lumina-restore-file', { detail: { file, isGlobal: true } });
                            window.dispatchEvent(event);
                            setIsMenuOpen(false);
                          });
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${isDraggingGlobal ? 'bg-red-500/20 scale-[1.02] border-red-500/50' : ''} ${isBackgroundDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-500/5'}`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${isDraggingGlobal ? 'bg-red-500 border-red-400 animate-pulse' : (isBackgroundDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-500/5 border-red-500/10')}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isDraggingGlobal ? 'text-white' : 'opacity-50'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                          </svg>
                        </div>
                        {isDraggingGlobal ? 'Lepas untuk Global' : 'Import Global'}
                      </button>
                    </div>
                  </div>
              )}
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative group">
            <div 
              className={`absolute inset-y-0 left-4 flex items-center pointer-events-none ${themeIconClass} transition-colors`}
              style={{ color: searchQuery ? themeHex : undefined }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input 
              type="text"
              placeholder="Cari agen atau mulai obrolan baru..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full bg-white/5 border ${themeBorderColor} rounded-2xl py-3 pl-11 pr-4 outline-none ${themeTextClass} placeholder:${themeMutedTextColor} transition-all text-xs font-bold`}
              style={{ 
                borderColor: searchQuery ? `${themeHex}40` : undefined,
                boxShadow: searchQuery ? `0 0 15px ${themeHex}20` : undefined
              }}
            />
          </div>
        </div>

        {/* Profile List Section */}
        <div 
          className="flex-1 relative overflow-hidden"
          onContextMenu={handleBgContextMenu}
          onTouchStart={handleBgLongPress}
          onTouchMove={handleTouchMoveInternal}
          onTouchEnd={handleTouchEndInternal}
        >
          <div className="absolute inset-0 overflow-y-auto custom-scrollbar overscroll-contain">
            <div className={`px-2 pt-4 ${isSidebar ? 'pb-4' : 'pb-32 md:pb-8'}`}>
              {sortedProfiles.length > 0 ? (
                sortedProfiles.map((profile) => {
                  const isSelected = isSidebar && config.id === profile.id;
                  const activeTask = activeGenerations.find(t => t.agentId === profile.id);
                  const unreadCount = unreadCountsMap[profile.id || ''] || 0;

                  return (
                    <button
                      key={profile.id}
                      onClick={() => onSelect(profile)}
                      className={`w-full px-4 py-3 flex items-center gap-3 ${isBackgroundDark ? 'hover:bg-white/5 active:bg-white/10' : 'hover:bg-black/5 active:bg-black/10'} transition-all text-left group rounded-2xl mb-1 relative ${isSelected ? 'shadow-lg' : ''}`}
                      style={isSelected ? { 
                        backgroundColor: isBackgroundDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(15, 23, 42, 0.3)',
                        color: isBackgroundDark ? '#0f172a' : 'white'
                      } : unreadCount > 0 ? {
                        backgroundColor: `${themeHex}15`,
                        borderColor: `${themeHex}40`,
                        borderWidth: '1px',
                        boxShadow: `0 0 15px ${themeHex}20`
                      } : activeTask ? {
                        backgroundColor: `${themeHex}0f`,
                        borderColor: `${themeHex}35`,
                        borderWidth: '1px',
                        boxShadow: `0 0 15px ${themeHex}18`
                      } : {}}
                    >
                    <div 
                      className="relative flex-shrink-0"
                      onContextMenu={(e) => { e.stopPropagation(); handleProfilePicMenu(e, profile); }}
                      onTouchStart={(e) => { e.stopPropagation(); handleProfilePicMenu(e, profile); }}
                      onTouchMove={handleTouchMoveInternal}
                      onTouchEnd={handleTouchEndInternal}
                    >
                      {/* Active Generating Spinning Ring */}
                      {activeTask && (
                        <div 
                          className="absolute -inset-1 rounded-full animate-spin z-0"
                          style={{
                            background: `conic-gradient(from 0deg, transparent 0 60deg, ${themeHex} 180deg, ${themeHex}cc 270deg, transparent 360deg)`,
                            filter: `drop-shadow(0 0 5px ${themeHex}90)`,
                            animationDuration: '1.2s'
                          }}
                        />
                      )}

                      {/* Unread Badge Indicator on Profile Avatar */}
                      {unreadCount > 0 && (
                        <div 
                          className="absolute -top-1 -right-1 z-30 min-w-[20px] h-[20px] px-1 text-white font-black text-[10px] rounded-full border-2 border-zinc-900 flex items-center justify-center shadow-lg animate-pulse"
                          style={{ backgroundColor: themeHex || '#f43f5e' }}
                          title={`${unreadCount} Pesan Belum Terbaca`}
                        >
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </div>
                      )}

                      <div 
                        className={`relative z-10 w-12 h-12 rounded-full overflow-hidden border transition-all ${isSelected ? 'border-black/10' : themeBorderColor}`}
                        style={unreadCount > 0 ? {
                          borderColor: themeHex || '#f43f5e',
                          boxShadow: `0 0 12px ${themeHex || '#f43f5e'}99`
                        } : activeTask ? {
                          borderColor: themeHex,
                          boxShadow: `0 0 10px ${themeHex}50`
                        } : (!isSelected && searchQuery && profile.name.toLowerCase().includes(searchQuery.toLowerCase()) ? { borderColor: `${themeHex}50` } : undefined)}
                      >
                        {profile.profilePic ? (
                          <img src={profile.profilePic} alt={profile.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center ${isSelected ? 'bg-black/5 text-black/20' : (isBackgroundDark ? 'bg-white/5 text-white/20' : 'bg-black/5 text-black/20')}`}>
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                        )}
                        {/* Overlay with subtle animated dots when active */}
                        {activeTask && (
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                            <div className="flex gap-0.5 items-center">
                              <span className="w-1 h-1 bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                              <span className="w-1 h-1 bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                              <span className="w-1 h-1 bg-white rounded-full animate-bounce"></span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Status indicator / type icon */}
                      {activeTask ? (
                        <div 
                          className="absolute -bottom-0.5 -right-0.5 z-20 w-4 h-4 rounded-full border border-white/80 shadow-md flex items-center justify-center text-[8px] text-white"
                          style={{ backgroundColor: themeHex }}
                        >
                          {activeTask.type === 'pap' ? '📸' : activeTask.type === 'audio' ? '🎙️' : '💬'}
                        </div>
                      ) : (
                        <div className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 rounded-full z-20 ${isSelected ? (contrastColor === 'black' ? 'border-black' : 'border-white') : (isBackgroundDark ? 'border-black' : 'border-white')}`} />
                      )}
                    </div>
                    
                    <div 
                      className={`flex-1 min-w-0 pb-2 h-full flex flex-col justify-center ${!isSelected ? `border-b ${themeBorderColor}` : ''}`}
                      onContextMenu={(e) => { e.stopPropagation(); handleAgentNameMenu(e, profile); }}
                      onTouchStart={(e) => { e.stopPropagation(); handleAgentNameMenu(e, profile); }}
                      onTouchMove={handleTouchMoveInternal}
                      onTouchEnd={handleTouchEndInternal}
                    >
                        <div className="flex justify-between items-baseline mb-0.5">
                          <h3 className={`text-base font-bold truncate transition-colors ${isSelected ? '' : `${isBackgroundDark ? 'text-white/60' : 'text-black/60'} group-hover:${isBackgroundDark ? 'text-white' : 'text-black'}`}`}>{profile.name}</h3>
                          {activeTask ? (
                            <span 
                              className="text-[10px] font-extrabold flex items-center gap-1 animate-pulse"
                              style={{ color: themeHex }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: themeHex }} />
                              {activeTask.type === 'pap' ? '📸 Bikin PAP' : 
                               activeTask.type === 'audio' ? '🎙️ Voice Note' : 
                               '✍️ Mengetik...'}
                            </span>
                          ) : unreadCount > 0 ? (
                            <span 
                              className="text-[9px] font-black px-2 py-0.5 rounded-full text-white shadow-md animate-pulse"
                              style={{ backgroundColor: themeHex || '#f43f5e' }}
                            >
                              Pesan Baru
                            </span>
                          ) : (
                            <span className={`text-[9px] font-medium ${isSelected ? 'opacity-60' : themeMutedTextColor}`}>Online</span>
                          )}
                        </div>
                        {(() => {
                          const lastMsg = profile.id ? lastMessagesMap?.[profile.id] : undefined;
                          let lastChatPreview = '';
                          if (lastMsg) {
                            if (lastMsg.image) {
                              const clean = lastMsg.text ? cleanResponseText(lastMsg.text).replace(/\s+/g, ' ').trim() : '';
                              lastChatPreview = `📸 ${lastMsg.role === 'user' ? 'Kamu: ' : ''}${clean || 'Foto'}`;
                            } else if (lastMsg.audio) {
                              const clean = lastMsg.text ? cleanResponseText(lastMsg.text).replace(/\s+/g, ' ').trim() : '';
                              lastChatPreview = `🎙️ ${lastMsg.role === 'user' ? 'Kamu: ' : ''}${clean || 'Pesan Suara'}`;
                            } else if (lastMsg.text) {
                              const clean = cleanResponseText(lastMsg.text).replace(/\s+/g, ' ').trim();
                              if (clean) {
                                lastChatPreview = `${lastMsg.role === 'user' ? 'Kamu: ' : ''}${clean}`;
                              }
                            }
                          }
                          const subtitleDisplayText = lastChatPreview || profile.personality || 'Ready to chat!';

                          return (
                            <div className="flex items-center gap-1 min-w-0 w-full overflow-hidden">
                              {activeTask ? (
                                <p 
                                  className="text-xs truncate font-semibold italic min-w-0 flex-1"
                                  style={{ color: themeHex, opacity: 0.95 }}
                                >
                                  {activeTask.statusText || 'Sedang memproses...'}
                                </p>
                              ) : (
                                <p 
                                  className={`text-xs truncate min-w-0 flex-1 ${unreadCount > 0 ? 'font-black opacity-100' : isSelected ? 'font-medium opacity-70' : `font-medium ${themeMutedTextColor}`}`}
                                  style={unreadCount > 0 ? { color: themeHex || '#f43f5e' } : undefined}
                                  title={subtitleDisplayText}
                                >
                                  {subtitleDisplayText}
                                </p>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className={`flex flex-col items-center justify-center py-20 px-10 text-center opacity-30 ${themeTextClass}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-sm font-bold uppercase tracking-widest">Belum ada percakapan</p>
                </div>
              )}
            </div>
          </div>

          {/* Floating Action Button (New Profile) - Fixed relative to the list area */}
          <button 
            onClick={onNew}
            onContextMenu={(e) => { e.stopPropagation(); handleBgContextMenu(e); }}
            onTouchStart={(e) => { e.stopPropagation(); handleBgLongPress(e); }}
            className={`absolute ${isSidebar ? 'bottom-6' : 'bottom-32 md:bottom-6'} right-6 w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center transition-all active:scale-90 z-30 group border`}
            style={{ 
              backgroundColor: themeHex,
              borderColor: `${themeHex}40`,
              color: contrastColor === 'black' ? 'rgba(0,0,0,0.8)' : 'white'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 transform group-hover:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileSelectorView;
