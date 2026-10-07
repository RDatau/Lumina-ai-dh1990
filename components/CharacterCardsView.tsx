import React from 'react';
import { AgentConfig, GlobalAppearance, AppState, ChatMessage } from '../types';
import { cleanResponseText } from '../services/geminiService';

interface CharacterCardsViewProps {
  profiles: AgentConfig[];
  onSelect: (profile: AgentConfig) => void;
  onEdit: (profile: AgentConfig) => void;
  onDelete: (profile: AgentConfig) => void;
  onExport: (profile: AgentConfig) => void;
  onRestore?: () => void;
  onNew: () => void;
  onOpenAppearance?: () => void;
  onNavigate: (state: any) => void;
  appearance: GlobalAppearance;
  isBackgroundDark?: boolean;
  themeHex?: string;
  isSidebar?: boolean;
  onContextMenu?: (e: any, items: any[]) => void;
  onLongPress?: (e: any, items: any[]) => void;
  onTouchMove?: () => void;
  onTouchEnd?: () => void;
  onOpenProfile?: () => void;
  lastMessagesMap?: Record<string, ChatMessage>;
  unreadCountsMap?: Record<string, number>;
  onToggleUnread?: (p: AgentConfig) => void;
}

const CharacterCardsView: React.FC<CharacterCardsViewProps> = ({ 
  profiles, 
  onSelect, 
  onEdit,
  onDelete,
  onExport,
  onRestore,
  onNew, 
  onOpenAppearance, 
  onNavigate,
  appearance, 
  isBackgroundDark = true,
  themeHex,
  isSidebar = false,
  onContextMenu,
  onLongPress,
  onTouchMove,
  onTouchEnd,
  onOpenProfile,
  lastMessagesMap = {},
  unreadCountsMap = {},
  onToggleUnread
}) => {
  const [menuOpenId, setMenuOpenId] = React.useState<string | null>(null);
  const [isDraggingImport, setIsDraggingImport] = React.useState(false);
  const [isDraggingBg, setIsDraggingBg] = React.useState(false);
  const [cardSize, setCardSize] = React.useState<'large' | 'medium' | 'small'>(() => {
    try {
      const saved = localStorage.getItem('lumina_card_size');
      return (saved === 'medium' || saved === 'small') ? saved : 'large';
    } catch {
      return 'large';
    }
  });

  const handleCardSizeChange = (size: 'large' | 'medium' | 'small') => {
    setCardSize(size);
    try {
      localStorage.setItem('lumina_card_size', size);
    } catch (e) {
      console.warn("Failed to save card size:", e);
    }
  };

  const sortedProfiles = React.useMemo(() => {
    return [...profiles].sort((a, b) => {
      const unreadA = (unreadCountsMap?.[a.id || ''] || 0) > 0 ? 1 : 0;
      const unreadB = (unreadCountsMap?.[b.id || ''] || 0) > 0 ? 1 : 0;
      const timeA = lastMessagesMap?.[a.id || '']?.timestamp || 0;
      const timeB = lastMessagesMap?.[b.id || '']?.timestamp || 0;

      if (unreadA !== unreadB) return unreadB - unreadA;
      if (timeA !== timeB) return timeB - timeA;
      return a.name.localeCompare(b.name);
    });
  }, [profiles, lastMessagesMap, unreadCountsMap]);

  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
    };
    if (menuOpenId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpenId]);

  const handleBgContextMenu = (e: React.MouseEvent) => {
    const items = [
      { label: 'Import', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>, onClick: () => onRestore?.() },
      { label: 'Tambah', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>, onClick: () => onNew() },
      { label: 'Pengaturan Character', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>, onClick: () => onNavigate(AppState.SETUP) },
      { label: 'Pengaturan Tampilan', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>, onClick: () => onOpenAppearance?.() },
      { label: 'Profil Pengguna', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>, onClick: () => onOpenProfile?.() },
    ];
    onContextMenu?.(e, items);
  };

  const handleBgLongPress = (e: React.TouchEvent) => {
    const items = [
      { label: 'Import', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>, onClick: () => onRestore?.() },
      { label: 'Tambah', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>, onClick: () => onNew() },
      { label: 'Pengaturan Character', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>, onClick: () => onNavigate(AppState.SETUP) },
      { label: 'Pengaturan Tampilan', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>, onClick: () => onOpenAppearance?.() },
      { label: 'Profil Pengguna', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>, onClick: () => onOpenProfile?.() },
    ];
    onLongPress?.(e, items);
  };

  const handleCardMenu = (e: React.MouseEvent | React.TouchEvent, p: AgentConfig) => {
    e.stopPropagation();
    const isUnread = (unreadCountsMap[p.id || ''] || 0) > 0;
    const items = [
      { label: isUnread ? 'Tandai Sudah Terbaca' : 'Tandai Belum Terbaca', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>, onClick: () => onToggleUnread?.(p) },
      { label: 'Edit', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>, onClick: () => onEdit(p) },
      { label: 'Export', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>, onClick: () => onExport(p) },
      { label: 'Hapus', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>, variant: 'danger' as const, onClick: () => onDelete(p) },
    ];
    if ('clientX' in e) onContextMenu?.(e, items);
    else onLongPress?.(e, items);
  };

  const handleTouchMoveInternal = () => {
    onTouchMove?.();
  };
  const handleTouchEndInternal = () => {
    onTouchEnd?.();
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
      const event = new CustomEvent('lumina-restore-file', { detail: { file, isGlobal: false } });
      window.dispatchEvent(event);
    }
  };

  const onDragOverBg = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingBg(true);
  };

  const onDragLeaveBg = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingBg(false);
  };

  const onDropBg = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingBg(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.json')) {
      // We'll let App.tsx handle the detection of global vs individual
      const event = new CustomEvent('lumina-restore-file', { detail: { file } });
      window.dispatchEvent(event);
    }
  };

  const themeTextClass = isBackgroundDark ? 'text-white' : 'text-zinc-900';
  const themeMutedTextColor = isBackgroundDark ? 'text-white/50' : 'text-zinc-500';
  const themeBorderColor = isBackgroundDark ? 'border-white/10' : 'border-black/5';
  
  const getContrastColor = (hex?: string) => {
    if (!hex) return 'white';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? 'black' : 'white';
  };

  const contrastColor = getContrastColor(themeHex);

  const glassStyles = {
    backgroundColor: isBackgroundDark ? `rgba(10, 15, 20, ${(appearance?.transparency ?? 0) / 100})` : `rgba(255, 255, 255, ${(appearance?.transparency ?? 0) / 100})`,
    backdropFilter: `blur(${appearance?.blur ?? 40}px)`,
    WebkitBackdropFilter: `blur(${appearance?.blur ?? 40}px)`
  };

  return (
    <div 
      className="w-full h-full flex flex-col animate-in fade-in duration-500 relative overflow-hidden"
      style={glassStyles}
      onContextMenu={handleBgContextMenu}
      onTouchStart={handleBgLongPress}
      onTouchMove={handleTouchMoveInternal}
      onTouchEnd={handleTouchEndInternal}
      onDragOver={onDragOverBg}
      onDragLeave={onDragLeaveBg}
      onDrop={onDropBg}
    >
      {/* Drag Overlay */}
      {isDraggingBg && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center p-8 pointer-events-none">
          <div className="absolute inset-0 bg-indigo-500/20 backdrop-blur-md animate-in fade-in duration-300" />
          <div className={`relative p-12 rounded-[40px] border-4 border-dashed border-indigo-500/50 flex flex-col items-center gap-6 animate-in zoom-in duration-300 ${isBackgroundDark ? 'bg-black/60' : 'bg-white/60'}`}>
            <div className="w-24 h-24 rounded-full bg-indigo-500 flex items-center justify-center shadow-2xl shadow-indigo-500/50 animate-bounce">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div className="text-center space-y-2">
              <h2 className={`text-2xl font-black uppercase tracking-widest ${themeTextClass}`}>Lepas untuk Import</h2>
              <p className={`text-sm font-bold opacity-60 ${themeTextClass}`}>File .json akan otomatis menambah karakter baru</p>
            </div>
          </div>
        </div>
      )}
      {/* Main Content Container (No global glass) */}
      <div 
        className={`flex-1 flex flex-col overflow-hidden transition-all duration-500 relative`}
      >
        {/* Header Section */}
        <div 
          className={`absolute top-0 left-0 w-full z-20 pointer-events-none pt-0 px-0 md:pt-4 ${isSidebar ? 'px-2' : 'md:px-4'}`}
        >
          <div className="pointer-events-auto">
            <header 
              className={`flex items-center justify-between min-h-[56px] shadow-2xl transition-all duration-300 rounded-none md:rounded-full ${isSidebar ? 'p-1.5 px-3' : 'px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 md:px-6'}`} 
              style={{
                background: isBackgroundDark 
                  ? `linear-gradient(to bottom, rgba(10, 15, 20, 1) 0%, rgba(10, 15, 20, 1) 25%, rgba(10, 15, 20, ${(appearance?.transparency ?? 0) / 100}) 100%)`
                  : `linear-gradient(to bottom, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 25%, rgba(255, 255, 255, ${(appearance?.transparency ?? 0) / 100}) 100%)`,
                backdropFilter: `blur(${appearance?.blur ?? 40}px)`,
                WebkitBackdropFilter: `blur(${appearance?.blur ?? 40}px)`,
                border: 'none'
              }}
            >
            <div className="flex items-center gap-3 min-w-0">
              <div 
                className={`w-1.5 ${isSidebar ? 'h-4' : 'h-6 md:h-7'} ${isBackgroundDark ? 'bg-white' : 'bg-zinc-900'} rounded-full shrink-0 shadow-sm`} 
              />
              <h1 className={`${isSidebar ? 'text-xs' : 'text-2xl md:text-3xl'} font-black tracking-tighter ${themeTextClass} select-none truncate`}>
                {isSidebar ? 'Agen' : 'Karakter'}
              </h1>

              {!isSidebar && (
                <div className={`hidden sm:flex items-center p-1 rounded-full border transition-all ${isBackgroundDark ? 'bg-black/40 border-white/10' : 'bg-black/5 border-black/10'}`}>
                  <button
                    type="button"
                    onClick={() => handleCardSizeChange('large')}
                    className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all ${cardSize === 'large' ? 'bg-white text-black shadow-md scale-105' : 'opacity-60 hover:opacity-100'}`}
                  >
                    Besar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCardSizeChange('medium')}
                    className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all ${cardSize === 'medium' ? 'bg-white text-black shadow-md scale-105' : 'opacity-60 hover:opacity-100'}`}
                  >
                    Medium
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCardSizeChange('small')}
                    className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all ${cardSize === 'small' ? 'bg-white text-black shadow-md scale-105' : 'opacity-60 hover:opacity-100'}`}
                  >
                    Kecil
                  </button>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-1.5 shrink-0">
              {!isSidebar && (
                <div className={`flex sm:hidden items-center p-0.5 rounded-full border transition-all ${isBackgroundDark ? 'bg-black/40 border-white/10' : 'bg-black/5 border-black/10'}`}>
                  <button
                    type="button"
                    onClick={() => handleCardSizeChange('large')}
                    className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase transition-all ${cardSize === 'large' ? 'bg-white text-black shadow' : 'opacity-60'}`}
                  >
                    L
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCardSizeChange('medium')}
                    className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase transition-all ${cardSize === 'medium' ? 'bg-white text-black shadow' : 'opacity-60'}`}
                  >
                    M
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCardSizeChange('small')}
                    className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase transition-all ${cardSize === 'small' ? 'bg-white text-black shadow' : 'opacity-60'}`}
                  >
                    S
                  </button>
                </div>
              )}
              {!isSidebar && (
                <button 
                  onClick={onRestore}
                  onDragOver={onDragOverImport}
                  onDragLeave={onDragLeaveImport}
                  onDrop={onDropImport}
                  className={`rounded-full transition-all active:scale-95 shadow-lg border flex items-center justify-center gap-1.5 ${isDraggingImport ? 'bg-indigo-500 text-white border-indigo-400 scale-[1.05] animate-pulse' : `${isBackgroundDark ? 'bg-white/10 text-white border-white/20' : 'bg-black/5 text-black border-black/10'} hover:bg-opacity-80`} w-8 h-8 sm:w-auto sm:h-auto sm:px-5 sm:py-2 md:px-6 md:py-2.5 text-[10px] font-black tracking-[0.2em] uppercase`}
                  title="Import Profil"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span className="hidden sm:inline">{isDraggingImport ? 'Lepas Profil' : 'Import'}</span>
                </button>
              )}
              <button 
                onClick={onNew}
                className={`rounded-full font-black tracking-[0.2em] uppercase transition-all active:scale-95 shadow-lg border ${isBackgroundDark ? 'border-white/20' : 'border-black/10'} hover:opacity-90 flex items-center justify-center gap-1.5 ${isSidebar ? 'px-3 py-1.5 text-[9px]' : 'w-8 h-8 sm:w-auto sm:h-auto sm:px-5 sm:py-2 md:px-6 md:py-2.5 text-[10px]'}`}
                style={{ 
                  backgroundColor: themeHex || 'rgb(var(--theme-color-rgb))',
                  color: contrastColor,
                  borderColor: `${themeHex}40`
                }}
                title="Tambah Karakter Baru"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                <span className={isSidebar ? 'inline' : 'hidden sm:inline'}>{isSidebar ? 'Baru' : 'Tambah'}</span>
              </button>
            </div>
          </header>
        </div>
      </div>

      {/* Main Content Container */}
      <div 
        className={`flex-1 flex flex-col overflow-hidden transition-all duration-500`}
      >
        {/* Character Grid Section */}
        <div className={`flex-1 overflow-y-auto custom-scrollbar overscroll-contain relative ${isSidebar ? 'p-2 pt-16' : 'p-4 md:p-8 pt-24 md:pt-32 pb-32'}`}>
          <div className={`grid ${
            isSidebar 
              ? 'grid-cols-1 gap-3' 
              : cardSize === 'small' 
                ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2 md:gap-3' 
                : cardSize === 'medium' 
                  ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 md:gap-4' 
                  : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6'
          }`}>
            {sortedProfiles.map((profile) => {
              const unreadCount = unreadCountsMap[profile.id || ''] || 0;
              return (
              <div 
                key={profile.id}
                className={`relative ${isSidebar ? 'aspect-[2/1]' : 'aspect-[3/4]'} group cursor-pointer transition-all duration-500 hover:-translate-y-1 active:scale-95 transform-gpu isolate`}
                onClick={() => onSelect(profile)}
                onContextMenu={(e) => { e.stopPropagation(); handleCardMenu(e, profile); }}
                onTouchStart={(e) => { e.stopPropagation(); handleCardMenu(e, profile); }}
                onTouchMove={handleTouchMoveInternal}
                onTouchEnd={handleTouchEndInternal}
              >
                {/* Unread Badge Indicator on Character Card */}
                {unreadCount > 0 && (
                  <div 
                    className="absolute -top-1.5 -right-1.5 z-40 min-w-[22px] h-[22px] px-1.5 text-white font-black text-[10px] rounded-full border-2 border-zinc-900 flex items-center justify-center shadow-lg animate-pulse"
                    style={{ backgroundColor: themeHex || '#f43f5e' }}
                    title={`${unreadCount} Pesan Belum Terbaca`}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </div>
                )}
                {/* Glow Effect behind card */}
                <div 
                  className={`absolute -inset-1 rounded-[22px] blur-xl transition-opacity duration-500 ${unreadCount > 0 ? 'opacity-70 animate-pulse' : 'opacity-0 group-hover:opacity-40'}`}
                  style={{ backgroundColor: themeHex || 'rgb(var(--theme-color-rgb))' }}
                />

                {/* Inner clipped container */}
                <div 
                  className={`absolute inset-0 rounded-2xl overflow-hidden border ${unreadCount > 0 ? '' : themeBorderColor} shadow-2xl bg-zinc-900/20`}
                  style={unreadCount > 0 ? { borderColor: themeHex || '#f43f5e', borderWidth: '2px' } : undefined}
                >
                  {/* Background Image */}
                  {profile.profilePic ? (
                    <img 
                      src={profile.profilePic} 
                      alt={profile.name} 
                      className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${isBackgroundDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                      <svg className="h-10 w-10 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}

                  {/* Gradient Overlay - More dramatic */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-500" />

                  {/* Content - Glassmorphism style */}
                  <div className={`absolute bottom-0 left-0 right-0 p-2 pb-3 ${!isSidebar ? 'translate-y-2 group-hover:translate-y-0' : ''} transition-transform duration-500`}>
                    <div className={`backdrop-blur-md bg-white/5 border border-white/10 rounded-xl ${isSidebar ? 'p-1.5' : 'p-2.5'} shadow-xl`}>
                      <h3 className={`text-white ${isSidebar ? 'text-[11px]' : 'text-[13px]'} font-black tracking-wide mb-0.5 truncate drop-shadow-md`}>{profile.name}</h3>
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
                        const cardDisplayText = lastChatPreview || profile.personality || 'Ready to chat!';
                        return (
                          <p 
                            className={`${unreadCount > 0 ? 'font-black' : 'text-white/60 font-bold'} ${isSidebar ? 'text-[9px]' : 'text-[10px]'} truncate leading-tight italic tracking-tight`}
                            style={unreadCount > 0 ? { color: themeHex || '#f43f5e' } : undefined}
                            title={cardDisplayText}
                          >
                            {cardDisplayText}
                          </p>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Menu Button (Top Right) - Repositioned for better balance */}
                <div className="absolute top-2 right-2 z-30" ref={menuOpenId === profile.id ? menuRef : null}>
                  <button 
                    className={`p-2.5 rounded-2xl backdrop-blur-xl transition-all duration-300 ${menuOpenId === profile.id ? 'bg-white/30 text-white scale-110' : 'bg-black/40 text-white/50 hover:text-white hover:bg-black/60 opacity-0 group-hover:opacity-100'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(menuOpenId === profile.id ? null : (profile.id || null));
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>

                  {menuOpenId === profile.id && (
                    <div 
                      className={`absolute right-0 mt-2 w-44 rounded-[24px] shadow-2xl border ${themeBorderColor} z-[101] overflow-hidden animate-in fade-in zoom-in-95 duration-300 origin-top-right glass-menu`}
                      style={{ 
                        backgroundColor: isBackgroundDark ? 'rgba(15, 15, 18, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(40px)',
                        WebkitBackdropFilter: 'blur(40px)'
                      }}
                    >
                      <div className="p-2 flex flex-col gap-1">
                        <button 
                          onClick={(e) => { e.stopPropagation(); onEdit(profile); setMenuOpenId(null); }}
                          className={`w-full text-left px-4 py-3.5 rounded-2xl text-[14px] font-black transition-all flex items-center gap-3.5 ${isBackgroundDark ? 'text-white/80 hover:bg-white/10 hover:text-white' : 'text-black/80 hover:bg-black/5 hover:text-black'}`}
                        >
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${isBackgroundDark ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-indigo-500/5 border-indigo-500/10'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isBackgroundDark ? 'text-indigo-400' : 'text-indigo-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </div>
                          Edit
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onExport(profile); setMenuOpenId(null); }}
                          className={`w-full text-left px-4 py-3.5 rounded-2xl text-[14px] font-black transition-all flex items-center gap-3.5 ${isBackgroundDark ? 'text-white/80 hover:bg-white/10 hover:text-white' : 'text-black/80 hover:bg-black/5 hover:text-black'}`}
                        >
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${isBackgroundDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-500/5 border-emerald-500/10'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isBackgroundDark ? 'text-emerald-400' : 'text-emerald-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          </div>
                          Export
                        </button>
                        <div className={`h-px ${isBackgroundDark ? 'bg-white/5' : 'bg-black/5'} mx-2 my-1`} />
                        <button 
                          onClick={(e) => { e.stopPropagation(); onDelete(profile); setMenuOpenId(null); }}
                          className={`w-full text-left px-4 py-3.5 rounded-2xl text-[14px] font-black transition-all flex items-center gap-3.5 ${isBackgroundDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-500/5'}`}
                        >
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${isBackgroundDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-500/5 border-red-500/10'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isBackgroundDark ? 'text-red-400' : 'text-red-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </div>
                          Hapus
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  </div>
);
};

export default CharacterCardsView;
