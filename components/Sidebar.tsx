import React, { useState, useRef } from 'react';
import { ChatMessage, CallHistory, ChatSession, AgentConfig, GlobalAppearance } from '../types';
import { dbService, FullBackup, GlobalBackup } from '../services/dbService';
import { LogOut } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  config: AgentConfig;
  messages: ChatMessage[];
  sessions: ChatSession[];
  onNewChat: () => void;
  currentSessionTitle?: string;
  onLoadSession: (session: ChatSession) => void;
  onDeleteSession: (id: string) => void;
  onClearSessions: () => void;
  onReset: () => void;
  onRestore: (data: FullBackup) => Promise<void>;
  onRestoreGlobal: (data: GlobalBackup) => Promise<void>;
  isBackgroundDark?: boolean;
  themeHex?: string;
  onOpenAppearance?: () => void;
  appearance: GlobalAppearance;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, 
  onClose, 
  config,
  onReset, 
  messages, 
  sessions, 
  onNewChat, 
  currentSessionTitle = "Obrolan Baru",
  onLoadSession, 
  onDeleteSession, 
  onClearSessions,
  onRestore,
  onRestoreGlobal,
  isBackgroundDark = true,
  themeHex,
  onOpenAppearance,
  appearance
}) => {
  const [copyStatus, setCopyStatus] = useState('Bagikan Aplikasi');
  const [isDataActionLoading, setIsDataActionLoading] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<FullBackup | null>(null);
  const [pendingGlobalRestoreData, setPendingGlobalRestoreData] = useState<GlobalBackup | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const globalFileInputRef = useRef<HTMLInputElement>(null);

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopyStatus('Link Disalin!');
      setTimeout(() => setCopyStatus('Bagikan Aplikasi'), 2000);
    });
  };

  const handleBackup = async () => {
    setIsDataActionLoading(true);
    try {
      const allData = await dbService.getAllDataForBackup();
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const now = new Date();
      const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
      const agentName = config.name.toLowerCase().replace(/\s+/g, '_');
      
      link.href = url;
      link.download = `${agentName}_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Gagal membuat backup. Coba lagi sayang... 💦");
    } finally {
      setIsDataActionLoading(false);
    }
  };

  const handleGlobalBackup = async () => {
    setIsDataActionLoading(true);
    try {
      const allData = await dbService.getGlobalDataForBackup();
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const now = new Date();
      const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
      
      link.href = url;
      link.download = `global_lumina_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Gagal membuat backup global. Coba lagi sayang... 💦");
    } finally {
      setIsDataActionLoading(false);
    }
  };

  const handleRestoreClick = () => {
    if (isDataActionLoading) return;
    fileInputRef.current?.click();
  };

  const handleGlobalRestoreClick = () => {
    if (isDataActionLoading) return;
    globalFileInputRef.current?.click();
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.type === 'global') {
          setPendingGlobalRestoreData(json as GlobalBackup);
        } else {
          if (!json.config || !Array.isArray(json.messages)) {
            throw new Error("Format file backup tidak valid.");
          }
          setPendingRestoreData(json as FullBackup);
        }
      } catch (err) {
        alert("Gagal membaca file backup. Pastikan file .json benar dan tidak korup sayang... 💦");
      }
    };
    reader.onerror = () => {
      alert("Terjadi kesalahan saat membaca file.");
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmRestore = async () => {
    if (!pendingRestoreData) return;
    setIsDataActionLoading(true);
    const data = pendingRestoreData;
    setPendingRestoreData(null);
    await onRestore(data);
    setIsDataActionLoading(false);
  };

  const confirmGlobalRestore = async () => {
    if (!pendingGlobalRestoreData) return;
    setIsDataActionLoading(true);
    const data = pendingGlobalRestoreData;
    setPendingGlobalRestoreData(null);
    await onRestoreGlobal(data);
    setIsDataActionLoading(false);
  };

  const dynamicTextColor = isBackgroundDark ? 'text-white' : 'text-black';
  const dynamicMutedTextColor = isBackgroundDark ? 'text-white/60' : 'text-black/60';
  const dynamicIconColor = isBackgroundDark ? 'text-white/40' : 'text-black/40';
  const dynamicBorderColor = isBackgroundDark ? 'border-white/10' : 'border-black/10';
  const dynamicBgColor = isBackgroundDark ? 'bg-white/5' : 'bg-black/5';
  const dynamicHoverBgColor = isBackgroundDark ? 'hover:bg-white/10' : 'hover:bg-black/10';
  const dynamicThemeTextColor = ''; // Using inline styles
  const dynamicThemeBgColor = ''; // Using inline styles
  const dynamicThemeBorderColor = ''; // Using inline styles
  const dynamicThemeMutedBgColor = ''; // Using inline styles
  const dynamicThemeMutedTextColor = ''; // Using inline styles

  return (
    <>
      {/* RESTORE PREVIEW MODAL */}
      {pendingRestoreData && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="absolute inset-0 bg-black/80 backdrop-blur-2xl" onClick={() => setPendingRestoreData(null)} />
           <div className={`relative w-full max-w-sm ${isBackgroundDark ? 'bg-zinc-900 border-white/20' : 'bg-white border-black/10'} border rounded-[40px] p-8 shadow-2xl overflow-hidden group`}>
               <div 
                className="absolute -top-24 -right-24 w-48 h-48 blur-[80px] rounded-full transition-all duration-700" 
                style={{ backgroundColor: `${themeHex}30` }}
              />
              
              <header className="text-center mb-8">
                 <div 
                  className="w-16 h-16 rounded-[22px] border flex items-center justify-center mx-auto mb-4 shadow-inner"
                  style={{ backgroundColor: `${themeHex}10`, borderColor: `${themeHex}30` }}
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 animate-pulse" style={{ color: themeHex }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                 </div>
                 <h3 className={`text-xl font-black ${dynamicTextColor} uppercase tracking-tighter`}>Konfirmasi Restorasi Profil</h3>
                 <p className="text-[9px] font-black uppercase tracking-[0.3em] mt-1 italic" style={{ color: `${themeHex}99` }}>Tinjau memori yang akan diimpor</p>
              </header>

              <div className="space-y-3 mb-8">
                 <div className={`flex items-center gap-4 p-4 ${dynamicBgColor} rounded-2xl border ${dynamicBorderColor}`}>
                    <div className={`w-12 h-12 rounded-xl overflow-hidden border ${dynamicBorderColor}`}>
                       <img src={pendingRestoreData.config?.profilePic || undefined} className="w-full h-full object-cover" />
                    </div>
                    <div>
                       <span className={`text-[10px] font-black ${dynamicMutedTextColor} uppercase tracking-widest`}>Karakter</span>
                       <p className={`text-sm font-black ${dynamicTextColor}`}>{pendingRestoreData.config?.name || 'Unknown'}</p>
                    </div>
                 </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className={`p-3 ${dynamicBgColor} rounded-2xl border ${dynamicBorderColor} text-center`}>
                       <p className="text-[14px] font-black leading-none" style={{ color: themeHex }}>{pendingRestoreData.messages?.length || 0}</p>
                       <p className={`text-[7px] font-black ${dynamicMutedTextColor} uppercase tracking-widest mt-1`}>Pesan</p>
                    </div>
                    <div className={`p-3 ${dynamicBgColor} rounded-2xl border ${dynamicBorderColor} text-center`}>
                       <p className="text-[14px] font-black text-purple-500 leading-none">{pendingRestoreData.sessions?.length || 0}</p>
                       <p className={`text-[7px] font-black ${dynamicMutedTextColor} uppercase tracking-widest mt-1`}>Arsip</p>
                    </div>
                    <div className={`p-3 ${dynamicBgColor} rounded-2xl border ${dynamicBorderColor} text-center`}>
                       <p className="text-[14px] font-black text-blue-500 leading-none">{pendingRestoreData.history?.length || 0}</p>
                       <p className={`text-[7px] font-black ${dynamicMutedTextColor} uppercase tracking-widest mt-1`}>Call</p>
                    </div>
                 </div>
                 <p className="text-center text-[9px] font-bold text-red-400/60 px-4 leading-relaxed mt-4 italic">
                    *Tindakan ini akan menimpa data profil ini.
                 </p>
              </div>

              <div className="flex flex-col gap-3">
                 <button 
                    onClick={confirmRestore}
                    className="w-full text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all uppercase text-[10px] tracking-[0.2em] border border-white/20"
                    style={{ backgroundColor: themeHex, boxShadow: `0 10px 20px ${themeHex}30` }}
                 >
                    Lanjut Restore
                 </button>
                 <button 
                    onClick={() => setPendingRestoreData(null)}
                    className={`w-full ${dynamicBgColor} ${dynamicHoverBgColor} ${dynamicMutedTextColor} font-black py-4 rounded-2xl transition-all uppercase text-[10px] tracking-[0.2em]`}
                 >
                    Batal
                 </button>
              </div>
           </div>
        </div>
      )}

      <div 
        className={`fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <aside 
        className={`fixed top-0 left-0 h-full w-[300px] z-[70] shadow-2xl transition-transform duration-500 ease-out border-r ${dynamicBorderColor} overflow-hidden flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ 
          backgroundColor: isBackgroundDark ? `rgba(0, 0, 0, ${(appearance?.transparency ?? 0) / 100})` : `rgba(255, 255, 255, ${(appearance?.transparency ?? 0) / 100})`,
          backdropFilter: `blur(${appearance?.blur ?? 40}px)`,
          WebkitBackdropFilter: `blur(${appearance?.blur ?? 40}px)`
        }}
      >
        <div className="p-6 flex flex-col h-full relative">
          {/* Internal Sidebar Loading Indicator */}
          {isDataActionLoading && (
            <div className={`absolute inset-0 z-[100] ${isBackgroundDark ? 'bg-black/40' : 'bg-white/40'} backdrop-blur-md flex flex-col items-center justify-center gap-4`}>
              <div 
                className={`w-10 h-10 border-4 ${isBackgroundDark ? 'border-white/10' : 'border-black/10'} rounded-full animate-spin`}
                style={{ borderTopColor: themeHex }}
              ></div>
              <p className={`text-[8px] font-black ${dynamicTextColor} uppercase tracking-widest animate-pulse`}>Processing File...</p>
            </div>
          )}

          <header className="flex items-center justify-between mb-8 select-none">
            <div>
              <h1 className={`text-xl font-black tracking-tight ${dynamicTextColor}`}>Archives</h1>
              <p className={`text-[9px] font-bold uppercase tracking-widest mt-0.5`} style={{ color: themeHex }}>Memories</p>
            </div>
            <button onClick={onClose} className={`p-2 ${dynamicHoverBgColor} rounded-xl transition-all`}>
               <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${dynamicMutedTextColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
               </svg>
            </button>
          </header>

          <div className="flex flex-col gap-3 mb-8">
            <button 
              onClick={onNewChat}
              className={`w-full ${isBackgroundDark ? 'bg-white text-black' : 'bg-black text-white'} font-black py-3.5 rounded-2xl shadow-xl flex items-center justify-center gap-3 transition-all active:scale-[0.97] border ${dynamicBorderColor} uppercase text-[10px] tracking-widest`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Sesi Baru
            </button>

            <button 
              onClick={handleShare}
              className={`w-full ${dynamicBgColor} ${dynamicHoverBgColor} ${isBackgroundDark ? 'text-white/60' : 'text-black/60'} font-black py-3 rounded-2xl border ${dynamicBorderColor} flex items-center justify-center gap-3 transition-all active:scale-[0.97] uppercase text-[9px] tracking-widest`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              {copyStatus}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-10 pr-2 custom-scrollbar">
            {/* SAVED CHATS */}
            <section>
              <div className="flex items-center justify-between mb-4 px-1">
                <label className={`font-bold text-[9px] uppercase tracking-[0.2em]`} style={{ color: themeHex }}>Chat History</label>
                {(sessions.length > 0 || messages.length > 0) && (
                  <button 
                    type="button"
                    onClick={onClearSessions} 
                    className={`relative z-[80] text-[8px] font-bold ${dynamicMutedTextColor} hover:text-red-400 uppercase tracking-widest transition-colors px-2 py-1`}
                  >
                    Hapus Semua
                  </button>
                )}
              </div>
              
              <div className="space-y-3">
                {/* Active Session Preview */}
                {messages.length > 0 && (
                  <div 
                    className={`p-4 rounded-2xl border relative overflow-hidden group`}
                    style={{ borderColor: `${themeHex}30`, backgroundColor: `${themeHex}05` }}
                  >
                    <div className="flex gap-3 items-start">
                        <div 
                          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg`}
                          style={{ backgroundColor: themeHex }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white animate-pulse" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7z" clipRule="evenodd" /></svg>
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className={`text-[8px] font-black uppercase mb-0.5 tracking-widest`} style={{ color: `${themeHex}99` }}>Sesi Aktif</p>
                          <p className={`text-xs font-bold truncate ${isBackgroundDark ? 'text-white/90' : 'text-black/90'}`}>
                            {currentSessionTitle}
                          </p>
                        </div>
                    </div>
                  </div>
                )}

                {sessions.map(session => (
                  <div key={session.id} className="group relative">
                    <button 
                      onClick={() => onLoadSession(session)}
                      className={`w-full text-left p-3 rounded-2xl ${dynamicBgColor} border ${dynamicBorderColor} ${dynamicHoverBgColor} hover:border-white/20 transition-all flex gap-3 items-center group/btn`}
                    >
                      <div className={`w-8 h-8 ${dynamicBgColor} rounded-lg flex items-center justify-center flex-shrink-0 ${dynamicMutedTextColor} group-hover/btn:${isBackgroundDark ? 'text-white/60' : 'text-black/60'} transition-colors`}>
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                      </div>
                      <div className="flex-1 overflow-hidden pr-6">
                         <p className={`text-xs font-bold truncate ${isBackgroundDark ? 'text-white/60' : 'text-black/60'} group-hover/btn:${dynamicTextColor} transition-colors`}>{session.title}</p>
                         <p className={`text-[9px] ${isBackgroundDark ? 'text-white/10' : 'text-black/10'} mt-0.5 font-medium`}>{new Date(session.timestamp).toLocaleDateString()}</p>
                      </div>
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 text-transparent group-hover:text-red-500/40 hover:text-red-500 transition-all focus:outline-none`}
                      title="Hapus Sesi"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* DATA MANAGEMENT */}
            <section className={`pt-4 space-y-3`}>
              <label className={`${dynamicMutedTextColor} font-bold text-[8px] uppercase tracking-[0.3em] px-1`}>Data Management</label>
              
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={handleBackup}
                  disabled={isDataActionLoading}
                  className={`flex flex-col items-center justify-center gap-2 p-4 ${dynamicBgColor} ${dynamicHoverBgColor} rounded-2xl border ${dynamicBorderColor} transition-all group disabled:opacity-50`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isDataActionLoading ? 'animate-bounce' : `${dynamicIconColor} group-hover:text-white`} transition-colors`} style={isDataActionLoading ? { color: themeHex } : {}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span className={`text-[8px] font-black uppercase ${isBackgroundDark ? 'text-white/20' : 'text-black/20'} group-hover:text-white/60 tracking-widest text-center`}>Backup<br/>Profil</span>
                </button>

                <button 
                  onClick={handleRestoreClick}
                  disabled={isDataActionLoading}
                  className={`flex flex-col items-center justify-center gap-2 p-4 ${dynamicBgColor} ${dynamicHoverBgColor} rounded-2xl border ${dynamicBorderColor} transition-all group disabled:opacity-50`}
                >
                  <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileImport} />
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${dynamicIconColor} group-hover:text-purple-500 transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span className={`text-[8px] font-black uppercase ${isBackgroundDark ? 'text-white/20' : 'text-black/20'} group-hover:text-white/60 tracking-widest text-center`}>Restore<br/>Profil</span>
                </button>
              </div>
            </section>
          </div>

          <footer className={`mt-8 pt-4 flex flex-col items-center gap-4`}>
            <button 
              type="button"
              onClick={onReset}
              className={`relative z-[80] px-6 py-2 text-[8px] font-black uppercase tracking-[0.4em] ${isBackgroundDark ? 'text-white/20' : 'text-black/20'} hover:text-red-500/60 rounded-xl transition-all`}
            >
              Reset Memories
            </button>
            <p className={`mt-1 text-[7px] font-bold ${isBackgroundDark ? 'text-white/10' : 'text-black/10'} uppercase tracking-widest text-center`}>Lumina v2.5 Stable</p>
          </footer>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;