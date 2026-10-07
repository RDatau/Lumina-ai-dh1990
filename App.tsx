import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AgentConfig, AppState, ChatMessage, CallHistory, ChatSession, UserProfile, GlobalAppearance, ActiveGenerationTask } from './types';
import SetupView from './components/SetupView';
import ProfileSelectorView from './components/ProfileSelectorView';
import CharacterCardsView from './components/CharacterCardsView';
import ChatView from './components/ChatView';
import CallView from './components/CallView';
import CharacterWizard from './components/CharacterWizard';
import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';
import UserProfileModal from './components/UserProfileModal';
import ContextMenu, { ContextMenuItem } from './components/ContextMenu';
import FloatingGenerationProgress from './components/FloatingGenerationProgress';
import NotificationToast from './components/NotificationToast';
import ElectronTitleBar from './components/ElectronTitleBar';
import { dbService, FullBackup, GlobalBackup, getStoredGlobalGeminiSettings, setStoredGlobalGeminiSettings, DEFAULT_GLOBAL_GEMINI_SETTINGS, getEffectiveGlobalGeminiSettings, saveGlobalGeminiSettingsSync } from './services/dbService';
import { getDominantColor, enrichPersona } from './services/geminiService';
import { GlobalGeminiSettings } from './types';

const LUMINA_DEFAULT_PIC = 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&q=80&w=600';
const DEFAULT_BG = 'https://www.gstatic.com/images/branding/product/2x/google_chat_64dp.png'; // Placeholder for Google style, but we'll use CSS mostly

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.PROFILE_SELECT);
  
  // Navigation handling for Android back button/gestures
  const handleNavigate = (newState: AppState, replace = false) => {
    if (newState === appState) return;
    if (replace) {
      window.history.replaceState({ appState: newState }, '');
    } else {
      window.history.pushState({ appState: newState }, '');
    }
    setAppState(newState);
  };

  const handleSaveUserProfile = async (updatedProfile: UserProfile) => {
    const effectiveGemini = getEffectiveGlobalGeminiSettings();
    const finalProfile: UserProfile = {
      ...updatedProfile,
      geminiApiKey: effectiveGemini.geminiApiKey,
      textModel: effectiveGemini.textModel,
      ttsModel: effectiveGemini.ttsModel,
      voiceChat: effectiveGemini.voiceChat,
      callModel: effectiveGemini.callModel,
      voiceCall: effectiveGemini.voiceCall,
      imageModel: effectiveGemini.imageModel,
      useGoogleSearch: effectiveGemini.useGoogleSearch,
      hfSpaceUrl: effectiveGemini.hfSpaceUrl,
      hfTokens: effectiveGemini.hfTokens,
      hfApiEndpoint: effectiveGemini.hfApiEndpoint,
      injectNegativePrompt: effectiveGemini.injectNegativePrompt,
      injectAnatomyGuard: effectiveGemini.injectAnatomyGuard,
    };
    setUserProfile(finalProfile);
    if (isDbReady) {
      // Save to global profile
      await dbService.saveGlobalUserProfile(finalProfile);
    }
  };

  const handleLoadGlobalProfile = async () => {
    if (isDbReady) {
      const globalProfile = await dbService.getGlobalUserProfile();
      if (globalProfile) {
        const effectiveGemini = getEffectiveGlobalGeminiSettings();
        const merged: UserProfile = {
          ...globalProfile,
          geminiApiKey: effectiveGemini.geminiApiKey,
          textModel: effectiveGemini.textModel,
          ttsModel: effectiveGemini.ttsModel,
          voiceChat: effectiveGemini.voiceChat,
          callModel: effectiveGemini.callModel,
          voiceCall: effectiveGemini.voiceCall,
          imageModel: effectiveGemini.imageModel,
          useGoogleSearch: effectiveGemini.useGoogleSearch,
          hfSpaceUrl: effectiveGemini.hfSpaceUrl,
          hfTokens: effectiveGemini.hfTokens,
          hfApiEndpoint: effectiveGemini.hfApiEndpoint,
          injectNegativePrompt: effectiveGemini.injectNegativePrompt,
          injectAnatomyGuard: effectiveGemini.injectAnatomyGuard,
        };
        setUserProfile(merged);
        return merged;
      }
    }
    return null;
  };

  const updateUserProfileForAgent = async (agentId: string, updatedProfile: UserProfile) => {
    const effectiveGemini = getEffectiveGlobalGeminiSettings();
    const finalProfile: UserProfile = {
      ...updatedProfile,
      geminiApiKey: effectiveGemini.geminiApiKey,
      textModel: effectiveGemini.textModel,
      ttsModel: effectiveGemini.ttsModel,
      voiceChat: effectiveGemini.voiceChat,
      callModel: effectiveGemini.callModel,
      voiceCall: effectiveGemini.voiceCall,
      imageModel: effectiveGemini.imageModel,
      useGoogleSearch: effectiveGemini.useGoogleSearch,
      hfSpaceUrl: effectiveGemini.hfSpaceUrl,
      hfTokens: effectiveGemini.hfTokens,
      hfApiEndpoint: effectiveGemini.hfApiEndpoint,
      injectNegativePrompt: effectiveGemini.injectNegativePrompt,
      injectAnatomyGuard: effectiveGemini.injectAnatomyGuard,
    };
    setUserProfile(finalProfile);
    if (isDbReady) {
      await dbService.saveGlobalUserProfile(finalProfile);
      await dbService.saveUserProfile(finalProfile, agentId);
    }
  };

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.appState) {
        setAppState(e.state.appState);
      } else {
        // Default fallback
        setAppState(AppState.PROFILE_SELECT);
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    // Initialize history state if not present
    if (!window.history.state) {
      window.history.replaceState({ appState: appState }, '');
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, [appState]);

  // Global Context Menu for App
  useEffect(() => {
    const handleGlobalContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      
      let items: ContextMenuItem[] = [];
      
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        // Menu khusus input tetap dipertahankan karena berguna
        items = [
          { label: 'Potong (Cut)', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758L5 19m0-14l4.121 4.121" /></svg>, onClick: () => { document.execCommand('cut'); } },
          { label: 'Salin (Copy)', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>, onClick: () => { document.execCommand('copy'); } },
          { label: 'Tempel (Paste)', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>, onClick: async () => { 
            try {
              const text = await navigator.clipboard.readText();
              const el = e.target as HTMLInputElement | HTMLTextAreaElement;
              const start = el.selectionStart || 0;
              const end = el.selectionEnd || 0;
              el.setRangeText(text, start, end, 'end');
              el.dispatchEvent(new Event('input', { bubbles: true }));
            } catch (err) {
              console.error('Paste failed:', err);
            }
          } },
          { label: 'Pilih Semua', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-2.5m0 2.5h5m-5 0h-5m10 0V14m0-2.5v-2.5m0 2.5h5m-5 0h-5" /></svg>, onClick: () => { (e.target as HTMLInputElement | HTMLTextAreaElement).select(); } },
        ];
      } else {
        // HAPUS MENU UMUM GLOBAL AGAR TIDAK REBUTAN AREA
        return;
      }
      
      setContextMenu({ x: e.clientX, y: e.clientY, items, target: e.target as HTMLElement });
    };

    window.addEventListener('contextmenu', handleGlobalContextMenu);
    
    const handleGlobalTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) touchStartPos.current = { x: touch.clientX, y: touch.clientY };

      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (!isInput) return;
      
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      
      longPressTimer.current = setTimeout(() => {
        let items: ContextMenuItem[] = [
          { label: 'Potong (Cut)', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758L5 19m0-14l4.121 4.121" /></svg>, onClick: () => { document.execCommand('cut'); } },
          { label: 'Salin (Copy)', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>, onClick: () => { document.execCommand('copy'); } },
          { label: 'Tempel (Paste)', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>, onClick: async () => { 
            try {
              const text = await navigator.clipboard.readText();
              const el = e.target as HTMLInputElement | HTMLTextAreaElement;
              const start = el.selectionStart || 0;
              const end = el.selectionEnd || 0;
              el.setRangeText(text, start, end, 'end');
              el.dispatchEvent(new Event('input', { bubbles: true }));
            } catch (err) {
              console.error('Paste failed:', err);
            }
          } },
          { label: 'Pilih Semua', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-2.5m0 2.5h5m-5 0h-5m10 0V14m0-2.5v-2.5m0 2.5h5m-5 0h-5" /></svg>, onClick: () => { (e.target as HTMLInputElement | HTMLTextAreaElement).select(); } },
        ];
        
        setContextMenu({ x: touch.clientX, y: touch.clientY, items, target: e.target as HTMLElement });
        if (window.navigator.vibrate) window.navigator.vibrate(50);
      }, 600);
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (!touchStartPos.current) return;
      const touch = e.touches[0];
      const dist = Math.hypot(touch.clientX - touchStartPos.current.x, touch.clientY - touchStartPos.current.y);
      if (dist > 5) {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }
    };

    const handleGlobalTouchEnd = () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };

    window.addEventListener('touchstart', handleGlobalTouchStart, { passive: true });
    window.addEventListener('touchmove', handleGlobalTouchMove, { passive: true });
    window.addEventListener('touchend', handleGlobalTouchEnd);

    return () => {
      window.removeEventListener('contextmenu', handleGlobalContextMenu);
      window.removeEventListener('touchstart', handleGlobalTouchStart);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, []);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const [isUserProfileOpen, setIsUserProfileOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const effective = getEffectiveGlobalGeminiSettings();
    return { 
      name: '', 
      personalityInfo: '', 
      profilePic: null,
      geminiApiKey: effective.geminiApiKey,
      textModel: effective.textModel,
      ttsModel: effective.ttsModel,
      voiceChat: effective.voiceChat,
      callModel: effective.callModel,
      voiceCall: effective.voiceCall,
      imageModel: effective.imageModel,
      useGoogleSearch: effective.useGoogleSearch,
      hfSpaceUrl: effective.hfSpaceUrl,
      hfTokens: effective.hfTokens,
      hfApiEndpoint: effective.hfApiEndpoint,
      injectNegativePrompt: effective.injectNegativePrompt,
      injectAnatomyGuard: effective.injectAnatomyGuard,
    };
  });
  const [isDbReady, setIsDbReady] = useState(false);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [loadedAgentId, setLoadedAgentId] = useState<string | null>(null);
  const [isSwitchingProfile, setIsSwitchingProfile] = useState(false);
  const [restoringStatus, setRestoringStatus] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string, onConfirm: () => void } | null>(null);
  const [profiles, setProfiles] = useState<AgentConfig[]>([]);
  const [agentIdsWithMessages, setAgentIdsWithMessages] = useState<string[]>([]);
  const [lastMessagesMap, setLastMessagesMap] = useState<Record<string, ChatMessage>>({});
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [unreadCountsMap, setUnreadCountsMap] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('lumina_unread_counts');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, items: ContextMenuItem[], target?: HTMLElement | null } | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartPos = useRef<{ x: number, y: number } | null>(null);

  const triggerContextMenu = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent, items: ContextMenuItem[]) => {
    // Jika ada text yang sedang diseleksi, biarkan menu bawaan browser yang muncul
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      return;
    }

    if ('preventDefault' in e) e.preventDefault();
    if ('stopPropagation' in e) e.stopPropagation();
    
    let x, y;
    if ('clientX' in e) {
      x = e.clientX;
      y = e.clientY;
    } else {
      const touch = (e as any).touches?.[0] || (e as any).changedTouches?.[0];
      if (touch) {
        x = touch.clientX;
        y = touch.clientY;
      } else {
        x = 0; y = 0;
      }
    }
    
    setContextMenu({ x, y, items, target: e.target as HTMLElement });
  };

  const handleTouchStart = (e: React.TouchEvent | TouchEvent, items: ContextMenuItem[]) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    
    const touch = (e as any).touches?.[0];
    if (!touch) return;
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    
    longPressTimer.current = setTimeout(() => {
      triggerContextMenu(e, items);
      if (window.navigator.vibrate) window.navigator.vibrate(50);
      longPressTimer.current = null;
    }, 600);
  };

  const handleTouchMove = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const profilesWithMessages = useMemo(() => {
    return profiles.filter(p => agentIdsWithMessages.includes(p.id!));
  }, [profiles, agentIdsWithMessages]);
  const [config, setConfig] = useState<AgentConfig>({
    id: 'default',
    name: 'Lumina',
    personality: 'Aku bestie kamu yang paling asik, santai, tapi perhatian banget. Seru diajak ngobrol apa aja deh!',
    voice: 'Kore',
    profilePic: LUMINA_DEFAULT_PIC,
    background: 'google-theme',
    blur: 40,
    transparency: 0,
  });

  const [isResizing, setIsResizing] = useState(false);
  const [themeHex, setThemeHex] = useState('#ec4899');
  const [notifications, setNotifications] = useState<{ id: string, message: string, agentId: string, agentName: string }[]>([]);
  const [activeGenerations, setActiveGenerations] = useState<ActiveGenerationTask[]>([]);
  const currentAgentIdRef = useRef(config.id);
  const isSwitchingRef = useRef(false);

  const handleStartGeneration = (task: ActiveGenerationTask) => {
    setActiveGenerations(prev => {
      const filtered = prev.filter(t => t.agentId !== task.agentId);
      return [...filtered, task];
    });
  };

  const handleUpdateGeneration = (agentId: string, statusText: string, type?: 'text' | 'pap' | 'audio') => {
    setActiveGenerations(prev => prev.map(t => {
      if (t.agentId === agentId) {
        return { ...t, statusText, type: type || t.type };
      }
      return t;
    }));
  };

  const handleFinishGeneration = (agentId: string, type?: 'text' | 'pap' | 'audio') => {
    setActiveGenerations(prev => prev.filter(t => t.agentId !== agentId));
  };

  const appStateRef = useRef<AppState>(appState);
  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  useEffect(() => {
    currentAgentIdRef.current = config.id;
  }, [config.id]);

  const totalUnreadCount = useMemo(() => {
    return Object.values(unreadCountsMap).reduce<number>((sum, val) => sum + (Number(val) || 0), 0);
  }, [unreadCountsMap]);

  const handleToggleUnread = (targetProfile: AgentConfig) => {
    if (!targetProfile.id) return;
    setUnreadCountsMap(prev => {
      const current = prev[targetProfile.id!] || 0;
      const next = { ...prev };
      if (current > 0) {
        delete next[targetProfile.id!];
      } else {
        next[targetProfile.id!] = 1;
      }
      try { localStorage.setItem('lumina_unread_counts', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const updateAgentConfig = async (agentId: string, updates: Partial<AgentConfig>) => {
    // 1. Update current config if it's the active agent
    if (agentId === currentAgentIdRef.current) {
      setConfig(prev => ({ ...prev, ...updates }));
    }
    
    // 2. Update in profiles list state to keep UI (sidebar/cards) in sync
    setProfiles(prev => prev.map(p => p.id === agentId ? { ...p, ...updates } : p));

    // 3. Update in DB for non-active agents (active agent is handled by useEffect on config)
    if (agentId !== currentAgentIdRef.current) {
      const allProfiles = await dbService.getProfiles();
      const updatedProfiles = allProfiles.map(p => p.id === agentId ? { ...p, ...updates } : p);
      await dbService.saveProfiles(updatedProfiles);
    }
  };

  const addMessageToAgent = async (agentId: string, newMessage: ChatMessage, setActive = true) => {
    // 1. Always update DB first to ensure persistence
    const agentMessages = await dbService.getMessages(agentId);
    const existingIndex = agentMessages.findIndex(m => m.id === newMessage.id);
    let updatedMessages: ChatMessage[];
    if (existingIndex !== -1) {
      updatedMessages = agentMessages.map(m => m.id === newMessage.id ? newMessage : m);
    } else {
      updatedMessages = [...agentMessages, newMessage];
    }

    // Clean up any duplicate IDs in agentMessages if they ever exist
    const seenIds = new Set<string>();
    const cleanMessages: ChatMessage[] = [];
    for (const msg of updatedMessages) {
      if (msg?.id && !seenIds.has(msg.id)) {
        seenIds.add(msg.id);
        cleanMessages.push(msg);
      }
    }
    updatedMessages = cleanMessages;

    await dbService.saveMessages(updatedMessages, agentId);
    if (setActive && existingIndex === -1) await dbService.saveActiveMessageId(newMessage.id, agentId);

    // Update lastMessagesMap for real-time list update
    setLastMessagesMap(prev => ({
      ...prev,
      [agentId]: newMessage
    }));

    const isViewingThisChat = (agentId === currentAgentIdRef.current && appStateRef.current === AppState.CHAT);

    // 2. ALWAYS update React messages state if this agent is the active character in config
    // This ensures state is never stale when user enters chat from another screen
    if (agentId === currentAgentIdRef.current) {
      setMessages(updatedMessages);
      if (setActive && existingIndex === -1) setActiveMessageId(newMessage.id);
    }

    // 3. Handle unread badge and notifications if user is not actively viewing this chat screen
    if (!isViewingThisChat) {
      // Increment unread count if user is on another screen or viewing another character
      if (newMessage.role === 'agent') {
        setUnreadCountsMap(prev => {
          const next = { ...prev, [agentId]: (prev[agentId] || 0) + 1 };
          try { localStorage.setItem('lumina_unread_counts', JSON.stringify(next)); } catch {}
          return next;
        });
      }

      // Update agentIdsWithMessages if needed
      setAgentIdsWithMessages(prev => {
        if (!prev.includes(agentId)) return [...prev, agentId];
        return prev;
      });

      // Show notification
      const agent = profiles.find(p => p.id === agentId);
      if (agent && newMessage.role === 'agent' && !newMessage.text.includes('Panggilan berakhir')) {
        const notifId = Date.now().toString();
        const isPap = !!newMessage.image;
        setNotifications(prev => [...prev, { 
          id: notifId, 
          agentId, 
          agentName: agent.name, 
          message: isPap ? '📸 Mengirim foto baru!' : newMessage.audio ? '🎙️ Mengirim pesan suara' : newMessage.text, 
          timestamp: Date.now() 
        }]);
        setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== notifId));
        }, 8000);
      }
    }
  };
  const [isBackgroundDark, setIsBackgroundDark] = useState(true);
  const [appearance, setAppearance] = useState<GlobalAppearance>({
    background: 'google-theme',
    blur: 40,
    transparency: 0,
    isBackgroundDark: true,
    showFloatingProgress: true
  });

  useEffect(() => {
    const updateThemeAndBrightness = async () => {
      const isDark = appearance.isBackgroundDark;
      setIsBackgroundDark(isDark);
      
      // Update CSS variables for glass effects
      const root = document.documentElement;
      root.setAttribute('data-theme', isDark ? 'dark' : 'light');
      
      if (isDark) {
        root.style.setProperty('--glass-bg', 'rgba(15, 15, 15, 0.7)');
        root.style.setProperty('--glass-bg-dark', 'rgba(10, 10, 10, 0.7)');
        root.style.setProperty('--main-bg', '#0a0f14');
        root.style.setProperty('--main-text', '#ffffff');
      } else {
        root.style.setProperty('--glass-bg', 'rgba(255, 255, 255, 0.7)');
        root.style.setProperty('--glass-bg-dark', 'rgba(240, 240, 240, 0.7)');
        root.style.setProperty('--main-bg', '#ffffff');
        root.style.setProperty('--main-text', '#000000');
      }
      
      // Use custom accent color if available, otherwise fallback to default maroon
      let finalHex = isDark ? "#d70947" : "#b0073a";
      if (appearance.accentColor) {
        finalHex = appearance.accentColor;
      }

      // Helper to convert hex to rgb string for Tailwind variables
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : null;
      };

      const rgb = hexToRgb(finalHex);
      const finalRgb = rgb || (isDark ? "215, 9, 71" : "176, 7, 58");
      
      document.documentElement.style.setProperty('--theme-color-rgb', finalRgb);
      setThemeHex(finalHex);

      // --- STATUS BAR COLOR LOGIC ---
      // Default to a dark/light color based on theme, NOT the accent color
      let statusBarColor = isDark ? '#0a0f14' : '#ffffff'; 
      
      if (appearance.background && appearance.background !== 'google-theme' && (appearance.background.startsWith('http') || appearance.background.startsWith('data:'))) {
        try {
          const topColor = await getDominantColor(appearance.background, true);
          statusBarColor = topColor.hex;
        } catch (e) {
          console.warn("Failed to get top wallpaper color:", e);
        }
      }

      // Update ALL theme-color meta tags to be sure
      const metaThemes = document.querySelectorAll('meta[name="theme-color"]');
      if (metaThemes.length > 0) {
        metaThemes.forEach(m => m.setAttribute('content', statusBarColor));
      } else {
        const meta = document.createElement('meta');
        meta.name = "theme-color";
        meta.content = statusBarColor;
        document.head.appendChild(meta);
      }
    };
    updateThemeAndBrightness();
  }, [appearance.isBackgroundDark, appearance.accentColor, appearance.background]);

  // Save appearance when it changes
  useEffect(() => {
    if (isDbReady) {
      dbService.saveAppearance(appearance);
    }
  }, [appearance, isDbReady]);

  const messageMap = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    messages.forEach(m => map.set(m.id, m));
    return map;
  }, [messages]);

  const activeThread = useMemo(() => {
    if (!activeMessageId) return [];
    const thread: ChatMessage[] = [];
    let currentId: string | null | undefined = activeMessageId;
    
    while (currentId) {
      const msg = messageMap.get(currentId);
      if (msg) {
        thread.unshift(msg);
        currentId = msg.parentId;
      } else {
        currentId = null;
      }
    }
    return thread;
  }, [activeMessageId, messageMap]);

  useEffect(() => {
    const initApp = async () => {
      try {
        setDbError(null);
        await dbService.init();
        const [savedConfig, savedMessages, savedActiveId, savedSessions, savedProfile, savedProfiles, savedAppearance, savedAgentIdsWithMessages, globalProfile, globalGeminiSettings] = await Promise.all([
          dbService.getConfig(),
          dbService.getMessages(),
          dbService.getActiveMessageId(),
          dbService.getSessions(),
          dbService.getUserProfile(),
          dbService.getProfiles(),
          dbService.getAppearance(),
          dbService.getAgentIdsWithMessages(),
          dbService.getGlobalUserProfile(),
          dbService.getGlobalGeminiSettings()
        ]);

        if (savedAgentIdsWithMessages) {
          setAgentIdsWithMessages(savedAgentIdsWithMessages);
        }

        if (savedAppearance) {
          setAppearance(prev => ({ ...prev, ...savedAppearance }));
        }

        if (savedProfile) {
          setUserProfile(prev => ({ 
            ...prev, 
            name: savedProfile.name || prev.name,
            personalityInfo: savedProfile.personalityInfo || prev.personalityInfo,
            profilePic: savedProfile.profilePic ?? prev.profilePic,
            currentOutfit: savedProfile.currentOutfit ?? prev.currentOutfit,
            lastPapTimestamp: savedProfile.lastPapTimestamp ?? prev.lastPapTimestamp,
            isEnrichPersonaEnabled: savedProfile.isEnrichPersonaEnabled ?? prev.isEnrichPersonaEnabled,
          }));
        }

        if (globalProfile) {
          setUserProfile(prev => ({ 
            ...prev, 
            name: globalProfile.name || prev.name,
            personalityInfo: globalProfile.personalityInfo || prev.personalityInfo,
            profilePic: globalProfile.profilePic ?? prev.profilePic,
            isEnrichPersonaEnabled: globalProfile.isEnrichPersonaEnabled ?? prev.isEnrichPersonaEnabled,
          }));
        }

        if (savedConfig) {
          setConfig(prev => ({ ...prev, ...savedConfig }));
          // Load agent specific data for the saved config
          const agentId = savedConfig.id || 'default';
          const [agentMessages, agentActiveId, agentSessions, agentProfile] = await Promise.all([
            dbService.getMessages(agentId),
            dbService.getActiveMessageId(agentId),
            dbService.getSessions(agentId),
            dbService.getUserProfile(agentId)
          ]);
          
          const messagesToSet = agentMessages || [];
          setMessages(messagesToSet);
          
          if (agentProfile) {
            setUserProfile(prev => ({ 
              ...prev, 
              name: globalProfile?.name || agentProfile.name || prev.name,
              personalityInfo: agentProfile.personalityInfo || prev.personalityInfo,
              profilePic: globalProfile?.profilePic ?? agentProfile.profilePic ?? prev.profilePic,
              currentOutfit: agentProfile.currentOutfit ?? prev.currentOutfit,
              lastPapTimestamp: agentProfile.lastPapTimestamp ?? prev.lastPapTimestamp,
              isEnrichPersonaEnabled: agentProfile.isEnrichPersonaEnabled ?? globalProfile?.isEnrichPersonaEnabled ?? prev.isEnrichPersonaEnabled,
            }));
          }
          
          if (agentActiveId) setActiveMessageId(agentActiveId);
          if (agentSessions) setSessions(agentSessions);

          // Navigate to CHAT on desktop, or PROFILE_SELECT as main view on mobile
          if (typeof window !== 'undefined' && window.innerWidth >= 768) {
            handleNavigate(AppState.CHAT, true);
          } else {
            handleNavigate(AppState.PROFILE_SELECT, true);
          }
          setLoadedAgentId(agentId);
        }

        // Pengaturan Gemini & Model SELALU GLOBAL (berlaku ke semua karakter)
        const effectiveGemini = getEffectiveGlobalGeminiSettings(globalGeminiSettings);
        setUserProfile(prev => ({
          ...prev,
          geminiApiKey: effectiveGemini.geminiApiKey,
          textModel: effectiveGemini.textModel,
          ttsModel: effectiveGemini.ttsModel,
          voiceChat: effectiveGemini.voiceChat,
          callModel: effectiveGemini.callModel,
          voiceCall: effectiveGemini.voiceCall,
          imageModel: effectiveGemini.imageModel,
          useGoogleSearch: effectiveGemini.useGoogleSearch,
          hfSpaceUrl: effectiveGemini.hfSpaceUrl,
          hfTokens: effectiveGemini.hfTokens,
          hfApiEndpoint: effectiveGemini.hfApiEndpoint,
          injectNegativePrompt: effectiveGemini.injectNegativePrompt,
          injectAnatomyGuard: effectiveGemini.injectAnatomyGuard,
        }));
        
        if (savedProfiles && savedProfiles.length > 0) setProfiles(savedProfiles);
        
        // Load all last messages across all agents for instant preview in character list
        const allAgentIds = Array.from(new Set([
          ...(savedProfiles || []).map(p => p.id!).filter(Boolean),
          ...(savedAgentIdsWithMessages || []),
          savedConfig?.id || 'default'
        ]));
        if (allAgentIds.length > 0) {
          try {
            const allLast = await dbService.getAllLastMessages(allAgentIds);
            setLastMessagesMap(allLast);
          } catch (e) {
            console.warn("Failed to load last messages map:", e);
          }
        }

        // Mark as ready AND initial load complete in one go
        setIsInitialLoadComplete(true);
        setIsDbReady(true);
      } catch (e) { 
        console.error("Database Error:", e);
        setDbError("Gagal memuat database sayang... 💦 Coba refresh ya?");
        // Don't set isDbReady to true if it failed, to prevent overwriting with empty data
      }
    };
    initApp();
  }, []);

  // Auto-save logic - Only runs when isDbReady is true AND initial load is complete
  useEffect(() => { if (isDbReady && isInitialLoadComplete && !restoringStatus && !isSwitchingProfile) dbService.saveConfig(config); }, [config, isDbReady, isInitialLoadComplete, restoringStatus, isSwitchingProfile]);
  useEffect(() => { if (isDbReady && isInitialLoadComplete && !restoringStatus && !isSwitchingProfile && loadedAgentId === config.id) dbService.saveMessages(messages, config.id); }, [messages, isDbReady, isInitialLoadComplete, restoringStatus, config.id, loadedAgentId, isSwitchingProfile]);
  useEffect(() => { if (isDbReady && isInitialLoadComplete && !restoringStatus && !isSwitchingProfile && loadedAgentId === config.id) dbService.saveActiveMessageId(activeMessageId, config.id); }, [activeMessageId, isDbReady, isInitialLoadComplete, restoringStatus, config.id, loadedAgentId, isSwitchingProfile]);
  useEffect(() => { if (isDbReady && isInitialLoadComplete && !restoringStatus && !isSwitchingProfile && loadedAgentId === config.id) dbService.saveSessions(sessions, config.id); }, [sessions, isDbReady, isInitialLoadComplete, restoringStatus, config.id, loadedAgentId, isSwitchingProfile]);
  useEffect(() => { 
    if (isDbReady && isInitialLoadComplete && !restoringStatus && !isSwitchingProfile) {
      if (loadedAgentId === config.id) {
        dbService.saveUserProfile(userProfile, config.id);
      }
      
      // Simpan Pengaturan Gemini secara Global (berlaku untuk semua karakter)
      const geminiSettings: GlobalGeminiSettings = {
        geminiApiKey: (userProfile.geminiApiKey || '').trim(),
        textModel: userProfile.textModel || DEFAULT_GLOBAL_GEMINI_SETTINGS.textModel,
        ttsModel: userProfile.ttsModel || DEFAULT_GLOBAL_GEMINI_SETTINGS.ttsModel,
        voiceChat: userProfile.voiceChat || DEFAULT_GLOBAL_GEMINI_SETTINGS.voiceChat,
        callModel: userProfile.callModel || DEFAULT_GLOBAL_GEMINI_SETTINGS.callModel,
        voiceCall: (userProfile.voiceCall === 'Fola' ? 'Aoede' : (userProfile.voiceCall || DEFAULT_GLOBAL_GEMINI_SETTINGS.voiceCall)),
        imageModel: userProfile.imageModel || DEFAULT_GLOBAL_GEMINI_SETTINGS.imageModel,
        useGoogleSearch: userProfile.useGoogleSearch ?? DEFAULT_GLOBAL_GEMINI_SETTINGS.useGoogleSearch,
      };

      saveGlobalGeminiSettingsSync(geminiSettings);

      dbService.getGlobalUserProfile().then(global => {
        const updatedGlobal = { ...(global || {}), ...userProfile, ...geminiSettings };
        dbService.saveGlobalUserProfile(updatedGlobal);
      });
    } 
  }, [userProfile, isDbReady, isInitialLoadComplete, restoringStatus, config.id, loadedAgentId, isSwitchingProfile]);
  useEffect(() => { if (isDbReady && isInitialLoadComplete && !restoringStatus && !isSwitchingProfile) dbService.saveProfiles(profiles); }, [profiles, isDbReady, isInitialLoadComplete, restoringStatus, isSwitchingProfile]);

  // Update agentIdsWithMessages when messages change
  useEffect(() => {
    if (isDbReady && !restoringStatus && !isSwitchingProfile && config.id) {
      setAgentIdsWithMessages(prev => {
        const hasMessages = messages.length > 0;
        const inList = prev.includes(config.id!);
        if (hasMessages && !inList) {
          return [...prev, config.id!];
        } else if (!hasMessages && inList) {
          return prev.filter(id => id !== config.id);
        }
        return prev;
      });
    }
  }, [messages, isDbReady, restoringStatus, isSwitchingProfile, config.id]);

  // Keep lastMessagesMap updated when messages of active agent change
  useEffect(() => {
    if (config.id) {
      if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        setLastMessagesMap(prev => ({
          ...prev,
          [config.id!]: lastMsg
        }));
      } else {
        setLastMessagesMap(prev => {
          if (!prev[config.id!]) return prev;
          const copy = { ...prev };
          delete copy[config.id!];
          return copy;
        });
      }
    }
  }, [messages, config.id]);

  // Load agent-specific data when config.id changes
  useEffect(() => {
    const loadAgentData = async () => {
      if (!isDbReady || restoringStatus || !config.id) return;
      const targetId = config.id;
      if (loadedAgentId === targetId) return; // Already loaded
      
      if (isSwitchingRef.current) return;
      isSwitchingRef.current = true;
      setIsSwitchingProfile(true);
      
      try {
        const [savedMessages, savedActiveId, savedSessions, savedProfile, globalProfile, globalGeminiSettings] = await Promise.all([
          dbService.getMessages(targetId),
          dbService.getActiveMessageId(targetId),
          dbService.getSessions(targetId),
          dbService.getUserProfile(targetId),
          dbService.getGlobalUserProfile(),
          dbService.getGlobalGeminiSettings()
        ]);

        // Race condition: check if user switched away while we were loading
        if (currentAgentIdRef.current !== targetId) {
          isSwitchingRef.current = false;
          setIsSwitchingProfile(false);
          return;
        }

        // Deduplicate messages by ID to ensure clean branches
        const uniqueMsgMap = new Map<string, ChatMessage>();
        (savedMessages || []).forEach(m => {
          if (m?.id) uniqueMsgMap.set(m.id, m);
        });
        const messagesToSet = Array.from(uniqueMsgMap.values());
        if (savedMessages && messagesToSet.length !== savedMessages.length) {
          dbService.saveMessages(messagesToSet, targetId);
        }

        setMessages(messagesToSet);
        setActiveMessageId(savedActiveId || null);
        setSessions(savedSessions || []);

        if (messagesToSet.length > 0) {
          const lastMsg = messagesToSet[messagesToSet.length - 1];
          setLastMessagesMap(prev => ({
            ...prev,
            [targetId]: lastMsg
          }));
        } else {
          setLastMessagesMap(prev => {
            if (!prev[targetId]) return prev;
            const copy = { ...prev };
            delete copy[targetId];
            return copy;
          });
        }
        
        // PENGATURAN GEMINI & MODEL SELALU GLOBAL (MUTLAK BERLAKU KE SEMUA KARAKTER)
        const effectiveGemini = getEffectiveGlobalGeminiSettings(globalGeminiSettings);

        const mergedProfile: UserProfile = {
          // Identitas & Informasi User Global
          name: globalProfile?.name || savedProfile?.name || userProfile.name || '',
          profilePic: globalProfile?.profilePic ?? savedProfile?.profilePic ?? userProfile.profilePic ?? null,
          personalityInfo: globalProfile?.personalityInfo || savedProfile?.personalityInfo || userProfile.personalityInfo || '',
          currentOutfit: savedProfile?.currentOutfit,
          lastPapTimestamp: savedProfile?.lastPapTimestamp,
          isEnrichPersonaEnabled: savedProfile?.isEnrichPersonaEnabled ?? globalProfile?.isEnrichPersonaEnabled,
          // Pengaturan Gemini Global yang persisten untuk SEMUA karakter (MUTLAK GLOBAL)
          geminiApiKey: effectiveGemini.geminiApiKey,
          textModel: effectiveGemini.textModel,
          ttsModel: effectiveGemini.ttsModel,
          voiceChat: effectiveGemini.voiceChat,
          callModel: effectiveGemini.callModel,
          voiceCall: effectiveGemini.voiceCall,
          imageModel: effectiveGemini.imageModel,
          useGoogleSearch: effectiveGemini.useGoogleSearch,
          hfSpaceUrl: effectiveGemini.hfSpaceUrl,
          hfTokens: effectiveGemini.hfTokens,
          hfApiEndpoint: effectiveGemini.hfApiEndpoint,
          injectNegativePrompt: effectiveGemini.injectNegativePrompt,
          injectAnatomyGuard: effectiveGemini.injectAnatomyGuard,
        };

        setUserProfile(mergedProfile);
        setLoadedAgentId(targetId);

        // Clear unread count for targetId when loaded
        setUnreadCountsMap(prev => {
          if (!prev[targetId]) return prev;
          const next = { ...prev };
          delete next[targetId];
          try { localStorage.setItem('lumina_unread_counts', JSON.stringify(next)); } catch {}
          return next;
        });

        // Always navigate to CHAT when a profile is selected/loaded, 
        // UNLESS we are explicitly in SETUP mode (e.g. creating a new profile)
        if (appState !== AppState.SETUP) {
          handleNavigate(AppState.CHAT, true);
        }
      } catch (e) {
        console.error("Failed to load agent data:", e);
      } finally {
        setIsSwitchingProfile(false);
        isSwitchingRef.current = false;
      }
    };
    
    loadAgentData();
  }, [config.id, isDbReady, loadedAgentId, restoringStatus]);

  // Clear unread count and re-sync messages from DB whenever user enters CHAT state for active config
  useEffect(() => {
    if (appState === AppState.CHAT && config.id && isDbReady) {
      // 1. Clear unread count for current active character
      setUnreadCountsMap(prev => {
        if (!prev[config.id!]) return prev;
        const next = { ...prev };
        delete next[config.id!];
        try { localStorage.setItem('lumina_unread_counts', JSON.stringify(next)); } catch {}
        return next;
      });

      // 2. Fetch latest messages from DB for config.id to guarantee 100% sync
      dbService.getMessages(config.id).then(dbMsgs => {
        if (dbMsgs && dbMsgs.length > 0) {
          const uniqueMsgMap = new Map<string, ChatMessage>();
          dbMsgs.forEach(m => {
            if (m?.id) uniqueMsgMap.set(m.id, m);
          });
          const cleanMsgs = Array.from(uniqueMsgMap.values());
          if (cleanMsgs.length !== dbMsgs.length) {
            dbService.saveMessages(cleanMsgs, config.id!);
          }
          setMessages(cleanMsgs);
          const lastMsg = cleanMsgs[cleanMsgs.length - 1];
          if (lastMsg) {
            setActiveMessageId(lastMsg.id);
          }
        }
      }).catch(err => console.warn("Failed to sync messages on entering chat:", err));
    }
  }, [appState, config.id, isDbReady]);


  // Persona Enrichment Logic
  useEffect(() => {
    const updatePersona = async () => {
      if (!config.name || !isDbReady || restoringStatus || config.isEnrichPersonaEnabled === false) return;
      
      // Don't re-enrich if we already have it for this name
      // This saves quota when userProfile (API Key) changes but name doesn't
      if (config.enrichedPersona && config.enrichedPersona.includes(config.name)) return;

      try {
        const enriched = await enrichPersona(config.name, userProfile);
        if (enriched && enriched !== config.enrichedPersona) {
          setConfig(prev => ({ ...prev, enrichedPersona: enriched }));
        }
      } catch (e) {
        console.warn("Failed to enrich persona:", e);
      }
    };
    const timer = setTimeout(updatePersona, 1500);
    return () => clearTimeout(timer);
  }, [config.name, isDbReady, restoringStatus, userProfile]);

  const handleDeleteProfile = (profile: AgentConfig) => {
    setConfirmDialog({
      message: `Hapus agen "${profile.name}" beserta semua ingatan dan chatnya?`,
      onConfirm: async () => {
        try {
          // 1. Remove from DB
          await dbService.deleteProfile(profile.id!);
          
          // 2. Update UI State
          const remaining = profiles.filter(p => p.id !== profile.id);
          setProfiles(remaining);
          setAgentIdsWithMessages(prev => prev.filter(id => id !== profile.id));
          setLastMessagesMap(prev => {
            const next = { ...prev };
            delete next[profile.id!];
            return next;
          });
          
          // 3. If it was the loaded agent, reset or switch
          if (loadedAgentId === profile.id) {
            setMessages([]);
            setActiveMessageId(null);
            setSessions([]);
            setUserProfile(prev => ({ ...prev }));
            setLoadedAgentId(null);
            
            // Go to profile select or setup if no profiles left
            if (remaining.length > 0) {
              setConfig(remaining[0]);
              handleNavigate(AppState.PROFILE_SELECT);
            } else {
              handleNavigate(AppState.SETUP);
            }
          }
        } catch (e) {
          alert("Gagal menghapus profil sayang... 💦");
        }
      }
    });
  };

  const handleEditProfile = (profile: AgentConfig) => {
    setConfig(profile);
    handleNavigate(AppState.SETUP);
  };

  const handleExportProfile = async (profile: AgentConfig) => {
    try {
      const data = await dbService.getAgentDataForBackup(profile.id!);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const now = new Date();
      const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
      const agentName = profile.name.toLowerCase().replace(/\s+/g, '_');
      a.download = `${agentName}_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Gagal export profil sayang... 💦");
    }
  };

  const handleRestore = async (data: FullBackup) => {
    try {
      // 1. Lock system and show overlay
      setRestoringStatus("Menyiapkan Ruang Memori...");
      setIsDbReady(false);
      
      // Artificial delay for better UX and stability
      await new Promise(r => setTimeout(r, 800));
      
      setRestoringStatus("Menulis Ulang Database...");
      
      // Get current global profile to maintain user identity
      const globalProfile = await dbService.getGlobalUserProfile();
      let profileToRestore = data.userProfile || { name: '', personalityInfo: '', profilePic: null };
      
      if (globalProfile) {
        profileToRestore = {
          ...profileToRestore,
          name: globalProfile.name || profileToRestore.name,
          profilePic: globalProfile.profilePic || profileToRestore.profilePic,
          personalityInfo: globalProfile.personalityInfo || profileToRestore.personalityInfo
        };
      }

      // 2. Clear and Write directly to IndexedDB
      await dbService.restoreAllData({ ...data, userProfile: profileToRestore });
      
      setRestoringStatus("Sinkronisasi State UI...");
      // 3. Update all memory states synchronously
      if (data.config) {
        setConfig(prev => ({ ...prev, ...data.config }));
        const currentProfiles = await dbService.getProfiles();
        setProfiles(currentProfiles);
      }
      setMessages([...(data.messages || [])]);
      setActiveMessageId(data.activeMessageId || null);
      setSessions([...(data.sessions || [])]);
      const effectiveGemini = getEffectiveGlobalGeminiSettings();
      setUserProfile({
        ...profileToRestore,
        geminiApiKey: effectiveGemini.geminiApiKey,
        textModel: effectiveGemini.textModel,
        ttsModel: effectiveGemini.ttsModel,
        voiceChat: effectiveGemini.voiceChat,
        callModel: effectiveGemini.callModel,
        voiceCall: effectiveGemini.voiceCall,
        imageModel: effectiveGemini.imageModel,
        useGoogleSearch: effectiveGemini.useGoogleSearch,
        hfSpaceUrl: effectiveGemini.hfSpaceUrl,
        hfTokens: effectiveGemini.hfTokens,
        hfApiEndpoint: effectiveGemini.hfApiEndpoint,
        injectNegativePrompt: effectiveGemini.injectNegativePrompt,
        injectAnatomyGuard: effectiveGemini.injectAnatomyGuard,
      });
      
      // 4. Update View State - Always go to CHAT
      handleNavigate(AppState.CHAT, true);
      
      if (data.config?.id) {
        setLoadedAgentId(data.config.id);
      } else {
        setLoadedAgentId('default');
      }
      
      setRestoringStatus("Selesai!");
      await new Promise(r => setTimeout(r, 600));

      // 5. Release locks
      setRestoringStatus(null);
      setIsDbReady(true);
      setIsSidebarOpen(false);

    } catch (e) {
      console.error("Restore Error:", e);
      alert("Aduh sori sayang, gagal restorasi data. Filenya mungkin rusak.");
      setRestoringStatus(null);
      setIsDbReady(true);
    }
  };

  const handleRestoreGlobal = async (data: GlobalBackup) => {
    try {
      setRestoringStatus("Menyiapkan Ruang Memori Global...");
      setIsDbReady(false);
      await new Promise(r => setTimeout(r, 800));
      
      setRestoringStatus("Menulis Ulang Database Global...");
      await dbService.restoreGlobalData(data);
      
      setRestoringStatus("Sinkronisasi State UI...");
      // Reload everything
      const [savedProfiles, savedConfig, savedAppearance, savedGlobalProfile] = await Promise.all([
        dbService.getProfiles(),
        dbService.getConfig(),
        dbService.getAppearance(),
        dbService.getGlobalUserProfile()
      ]);
      
      if (savedProfiles && savedProfiles.length > 0) setProfiles(savedProfiles);
      if (savedAppearance) setAppearance(savedAppearance);
      
      if (savedConfig) {
        setConfig(prev => ({ ...prev, ...savedConfig }));
        const agentId = savedConfig.id || 'default';
        const [agentMessages, agentActiveId, agentSessions, agentProfile] = await Promise.all([
          dbService.getMessages(agentId),
          dbService.getActiveMessageId(agentId),
          dbService.getSessions(agentId),
          dbService.getUserProfile(agentId)
        ]);
        
        setMessages(agentMessages || []);
        setActiveMessageId(agentActiveId || null);
        setSessions(agentSessions || []);
        
        // Merge global identity with agent-specific profile
        const effectiveGemini = getEffectiveGlobalGeminiSettings();
        const mergedProfile = {
          ...(agentProfile || {}),
          ...(savedGlobalProfile ? {
            name: savedGlobalProfile.name || agentProfile?.name || '',
            profilePic: savedGlobalProfile.profilePic || agentProfile?.profilePic || null,
            personalityInfo: savedGlobalProfile.personalityInfo || agentProfile?.personalityInfo || ''
          } : {}),
          geminiApiKey: effectiveGemini.geminiApiKey,
          textModel: effectiveGemini.textModel,
          ttsModel: effectiveGemini.ttsModel,
          voiceChat: effectiveGemini.voiceChat,
          callModel: effectiveGemini.callModel,
          voiceCall: effectiveGemini.voiceCall,
          imageModel: effectiveGemini.imageModel,
          useGoogleSearch: effectiveGemini.useGoogleSearch,
          hfSpaceUrl: effectiveGemini.hfSpaceUrl,
          hfTokens: effectiveGemini.hfTokens,
          hfApiEndpoint: effectiveGemini.hfApiEndpoint,
          injectNegativePrompt: effectiveGemini.injectNegativePrompt,
          injectAnatomyGuard: effectiveGemini.injectAnatomyGuard,
        };
        setUserProfile(mergedProfile);
        setLoadedAgentId(agentId);

        // Always navigate to CHAT
        handleNavigate(AppState.CHAT, true);
      } else {
        handleNavigate(AppState.SETUP, true);
      }
      
      setRestoringStatus("Selesai!");
      await new Promise(r => setTimeout(r, 600));

      setRestoringStatus(null);
      setIsDbReady(true);
      setIsSidebarOpen(false);

    } catch (e) {
      console.error("Restore Global Error:", e);
      alert("Aduh sori sayang, gagal restorasi data global. Filenya mungkin rusak.");
      setRestoringStatus(null);
      setIsDbReady(true);
    }
  };

  useEffect(() => {
    const handleRestoreEvent = (e: any) => {
      const { file, isGlobal } = e.detail;
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          // Auto-detect type if not explicitly provided
          const effectiveIsGlobal = isGlobal !== undefined ? isGlobal : (json.type === 'global');
          
          if (effectiveIsGlobal) {
            handleRestoreGlobal(json);
          } else {
            handleRestore(json);
          }
        } catch (err) {
          alert(`Gagal membaca file backup sayang... 💦`);
        }
      };
      reader.readAsText(file);
    };

    window.addEventListener('lumina-restore-file', handleRestoreEvent as any);
    return () => window.removeEventListener('lumina-restore-file', handleRestoreEvent as any);
  }, []);

  const archiveCurrentSession = () => {
    if (messages.length > 0) {
      const firstMsg = messages.find(m => !m.parentId);
      const title = firstMsg ? (firstMsg.text.substring(0, 35) + (firstMsg.text.length > 35 ? '...' : '')) : "Obrolan Baru";
      const newSession: ChatSession = {
        id: Date.now().toString(),
        title,
        messages: [...messages],
        activeMessageId: activeMessageId,
        timestamp: Date.now(),
        userProfile: { ...userProfile },
        currentOutfit: config.currentOutfit,
        currentAccessories: config.currentAccessories,
        lastPapTimestamp: config.lastPapTimestamp
      };
      setSessions(prev => [newSession, ...prev]);
    }
  };

  const startNewChat = () => {
    archiveCurrentSession();
    setMessages([]);
    setActiveMessageId(null);
    
    // Reset profile for new session
    const clearedProfile = { ...userProfile };
    setUserProfile(clearedProfile);
    
    // FIX: Reset Character-specific session state (outfit) when starting new chat
    // agar tidak terbawa ke sesi baru
    setConfig(prev => ({
      ...prev,
      currentOutfit: undefined,
      currentAccessories: undefined,
      lastPapTimestamp: undefined
    }));

    // Simpan profil yang sudah bersih ke DB agen
    if (config.id) {
      dbService.saveUserProfile(clearedProfile, config.id);
    }
    
    // Pastikan global profile juga nggak bawa sampah ingatan
    dbService.getGlobalUserProfile().then(global => {
      if (global) dbService.saveGlobalUserProfile(global);
    });

    setIsSidebarOpen(false);
  };

  const loadSession = (session: ChatSession) => {
    archiveCurrentSession(); 
    setMessages(session.messages);
    setActiveMessageId(session.activeMessageId);
    const profile = session.userProfile || { name: '', personalityInfo: '', profilePic: null };
    const effectiveGemini = getEffectiveGlobalGeminiSettings();
    setUserProfile(prev => ({ 
      ...prev, 
      ...profile,
      geminiApiKey: effectiveGemini.geminiApiKey,
      textModel: effectiveGemini.textModel,
      ttsModel: effectiveGemini.ttsModel,
      voiceChat: effectiveGemini.voiceChat,
      callModel: effectiveGemini.callModel,
      voiceCall: effectiveGemini.voiceCall,
      imageModel: effectiveGemini.imageModel,
      useGoogleSearch: effectiveGemini.useGoogleSearch,
      hfSpaceUrl: effectiveGemini.hfSpaceUrl,
      hfTokens: effectiveGemini.hfTokens,
      hfApiEndpoint: effectiveGemini.hfApiEndpoint,
      injectNegativePrompt: effectiveGemini.injectNegativePrompt,
      injectAnatomyGuard: effectiveGemini.injectAnatomyGuard,
    }));
    
    // Restore session-specific character state
    setConfig(prev => ({
      ...prev,
      currentOutfit: session.currentOutfit,
      currentAccessories: session.currentAccessories,
      lastPapTimestamp: session.lastPapTimestamp
    }));

    // Update global profile in DB to match loaded session
    if (config.id) {
      dbService.saveUserProfile(profile, config.id);
    }
    setSessions(prev => prev.filter(s => s.id !== session.id));
    setIsSidebarOpen(false);
  };

  const deleteSession = (id: string) => {
    setConfirmDialog({
      message: "Hapus arsip obrolan ini?",
      onConfirm: () => {
        setSessions(prev => prev.filter(s => s.id !== id));
      }
    });
  };

  const clearAllSessions = async () => {
    setConfirmDialog({
      message: "Hapus semua arsip obrolan?",
      onConfirm: () => {
        setMessages([]);
        setActiveMessageId(null);
        setSessions([]);
        setIsSidebarOpen(false);
        handleNavigate(AppState.SETUP, true);
      }
    });
  };

  const handleDeleteMessage = (id: string) => {
    const msgToDelete = messages.find(m => m.id === id);
    const parentId = msgToDelete?.parentId;
    const role = msgToDelete?.role;

    setConfirmDialog({
      message: "Hapus pesan ini beserta balasannya?",
      onConfirm: () => {
        const descendants = new Set<string>();
        const toProcess = [id];

        while (toProcess.length > 0) {
          const currentId = toProcess.pop()!;
          descendants.add(currentId);
          
          messages.forEach(m => {
            if (m.parentId === currentId) {
              toProcess.push(m.id);
            }
          });
        }
        
        const newMessages = messages.filter(m => !descendants.has(m.id));
        setMessages(newMessages);
        
        if (activeMessageId && descendants.has(activeMessageId)) {
          const remainingSiblings = newMessages.filter(m => m.parentId === parentId && m.role === role);
          if (remainingSiblings.length > 0) {
            let deepest = remainingSiblings[0].id;
            let next = newMessages.find(m => m.parentId === deepest);
            while (next) { deepest = next.id; next = newMessages.find(m => m.parentId === deepest); }
            setActiveMessageId(deepest);
          } else {
            setActiveMessageId(parentId || null);
          }
        }

        // ALWAYS re-evaluate outfit context from the remaining messages
        const remainingPaps = newMessages.filter(m => !!m.image).sort((a, b) => b.timestamp - a.timestamp);
        
        if (remainingPaps.length > 0) {
          const latestPap = remainingPaps[0];
          const newOutfit = latestPap.outfit;
          const newUserOutfit = latestPap.userOutfit;
          const newAccessories = latestPap.accessories;
          const newTimestamp = latestPap.timestamp;

          setConfig(prev => ({
            ...prev,
            currentOutfit: newOutfit,
            currentAccessories: newAccessories,
            lastPapTimestamp: newTimestamp
          }));
          
          const updatedProfile = {
            ...userProfile,
            currentOutfit: newUserOutfit,
            lastPapTimestamp: newTimestamp
          };
          setUserProfile(updatedProfile);

          if (config.id) {
            dbService.saveUserProfile(updatedProfile, config.id);
          }
        } else {
          // Jika benar-benar tidak ada PAP tersisa di riwayat, baru reset total
          setConfig(prev => ({
            ...prev,
            currentOutfit: undefined,
            currentAccessories: undefined,
            lastPapTimestamp: undefined
          }));
          
          const updatedProfile = {
            ...userProfile,
            currentOutfit: undefined,
            lastPapTimestamp: undefined
          };
          setUserProfile(updatedProfile);
          
          if (config.id) {
            dbService.saveUserProfile(updatedProfile, config.id);
          }
        }

        // Jika semua pesan dihapus, reset total (Long Term Memory & Outfit)
        if (newMessages.length === 0) {
          const clearedProfile = { 
            ...userProfile, 
            personalityInfo: '', 
            currentOutfit: undefined, 
            lastPapTimestamp: undefined 
          };
          setUserProfile(clearedProfile);
          
          setConfig(prev => ({
            ...prev,
            currentOutfit: undefined,
            currentAccessories: undefined,
            lastPapTimestamp: undefined
          }));

          if (config.id) {
            dbService.saveUserProfile(clearedProfile, config.id);
          }
          dbService.getGlobalUserProfile().then(global => {
            if (global) {
              const updatedGlobal = { ...global, personalityInfo: '' };
              dbService.saveGlobalUserProfile(updatedGlobal);
            }
          });
        }
      }
    });
  };

  const handleResetMemory = () => {
    setConfirmDialog({
      message: "Hapus semua ingatan agen tentang kamu?",
      onConfirm: () => {
        // Cari PAP terakhir dari riwayat yang ada untuk tetap konsisten dengan apa yang terlihat
        const remainingPaps = messages.filter(m => !!m.image).sort((a, b) => b.timestamp - a.timestamp);
        const latestPap = remainingPaps.length > 0 ? remainingPaps[0] : null;

        const clearedProfile = { 
          ...userProfile, 
          personalityInfo: '', 
          currentOutfit: latestPap ? latestPap.userOutfit : undefined, 
          lastPapTimestamp: latestPap ? latestPap.timestamp : undefined 
        };
        setUserProfile(clearedProfile);

        setConfig(prev => ({
          ...prev,
          currentOutfit: latestPap ? latestPap.outfit : undefined,
          currentAccessories: latestPap ? latestPap.accessories : undefined,
          lastPapTimestamp: latestPap ? latestPap.timestamp : undefined
        }));

        if (config.id) {
          dbService.saveUserProfile(clearedProfile, config.id);
        }
        dbService.getGlobalUserProfile().then(global => {
          if (global) {
            const updatedGlobal = { ...global, personalityInfo: '' };
            dbService.saveGlobalUserProfile(updatedGlobal);
          }
        });
      }
    });
  };

  const resetAll = async () => {
    setConfirmDialog({
      message: "Hapus semua data dan kembali ke awal?",
      onConfirm: async () => {
        await dbService.clearAll();
        localStorage.clear();
        window.location.reload();
      }
    });
    return true; // We return true but the actual action is deferred
  };

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = e.clientX;
      if (newWidth > 200 && newWidth < 600) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const [vViewport, setVViewport] = useState({
    height: window.innerHeight,
    offsetTop: 0
  });

  useEffect(() => {
    if (!window.visualViewport) return;
    
    const handleResize = () => {
      setVViewport({
        height: window.visualViewport!.height,
        offsetTop: window.visualViewport!.offsetTop
      });
      // Force scroll to top to prevent browser from shifting the layout viewport
      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
    };
    
    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    handleResize();
    
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, []);

  const handleBackup = async () => {
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
      alert("Gagal membuat backup profil sayang... 💦");
    }
  };

  const handleGlobalBackup = async () => {
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
      alert("Gagal membuat backup global sayang... 💦");
    }
  };

  const triggerRestore = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          handleRestore(json);
        } catch (err) {
          alert("Gagal membaca file backup sayang... 💦");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const triggerGlobalRestore = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          handleRestoreGlobal(json);
        } catch (err) {
          alert("Gagal membaca file backup global sayang... 💦");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  if ((!isDbReady || !isInitialLoadComplete) && !restoringStatus) {
    return (
      <div className={`fixed inset-0 ${appearance.isBackgroundDark ? 'bg-black' : 'bg-white'} flex flex-col items-center justify-center gap-6`}>
        {dbError ? (
          <div className="text-center space-y-4 p-6">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className={`text-[12px] font-black ${appearance.isBackgroundDark ? 'text-white' : 'text-black'} uppercase tracking-widest`}>{dbError}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest active:scale-95 transition-all"
            >
              Coba Lagi Sayang 🫦
            </button>
          </div>
        ) : (
          <>
            <div className="relative w-20 h-20">
                <div className={`absolute inset-0 border-4 rounded-full`} style={{ borderColor: `${themeHex}10` }}></div>
                <div className={`absolute inset-0 border-4 rounded-full animate-spin`} style={{ borderTopColor: themeHex }}></div>
            </div>
            <div className="text-center space-y-2">
              <p className={`text-[12px] font-black ${appearance.isBackgroundDark ? 'text-white' : 'text-black'} uppercase tracking-[0.5em] animate-pulse`}>Initializing Database</p>
              <p className="text-[9px] font-bold uppercase tracking-widest italic" style={{ color: `${themeHex}66` }}>Lumina v2.5.5</p>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={`relative h-screen h-[100dvh] w-full overflow-hidden flex flex-col items-center justify-center ${appearance.isBackgroundDark ? 'bg-black' : 'bg-white'}`}>
      <div className="flex-1 w-full flex flex-col pt-0 overflow-hidden">
      {/* Restoring Overlay */}
      {restoringStatus && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-[40px] flex flex-col items-center justify-center animate-in fade-in duration-300">
           <div className="relative w-24 h-24 mb-8">
              <div className="absolute inset-0 border-4 border-white/5 rounded-[30px] rotate-45"></div>
              <div 
                className={`absolute inset-0 border-4 rounded-[30px] rotate-45 animate-spin [animation-duration:3s]`}
                style={{ borderColor: themeHex }}
              ></div>
              <div className="absolute inset-0 flex items-center justify-center">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 animate-pulse" style={{ color: themeHex }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                 </svg>
              </div>
           </div>
           <div className="text-center space-y-3">
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter drop-shadow-xl">Restoring Memories</h2>
              <p className="text-[10px] font-black text-white uppercase tracking-[0.4em] italic animate-bounce">{restoringStatus}</p>
           </div>
        </div>
      )}

      {/* Global Confirm Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-2xl" onClick={() => setConfirmDialog(null)} />
          <div className={`relative w-full max-w-sm border ${appearance.isBackgroundDark ? 'border-white/20 bg-zinc-900/90' : 'border-black/10 bg-white/75'} rounded-[40px] p-8 shadow-2xl overflow-hidden group backdrop-blur-xl`}>
            <div className={`absolute -top-24 -right-24 w-48 h-48 ${appearance.isBackgroundDark ? 'bg-red-500/20' : 'bg-red-500/10'} blur-[80px] rounded-full group-hover:bg-red-500/30 transition-all duration-700`} />
            
            <header className="text-center mb-8">
              <div className={`w-16 h-16 ${appearance.isBackgroundDark ? 'bg-red-500/10' : 'bg-red-500/5'} rounded-[22px] border ${appearance.isBackgroundDark ? 'border-red-500/30' : 'border-red-500/20'} flex items-center justify-center mx-auto mb-4 shadow-inner`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className={`text-xl font-black ${appearance.isBackgroundDark ? 'text-white' : 'text-black'} uppercase tracking-tighter`}>Konfirmasi</h3>
              <p className={`text-[12px] font-bold ${appearance.isBackgroundDark ? 'text-white/60' : 'text-black/60'} mt-4 leading-relaxed`}>{confirmDialog.message}</p>
            </header>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-red-500/20 active:scale-95 transition-all uppercase text-[10px] tracking-[0.2em] border border-white/20"
              >
                Ya, Lanjutkan
              </button>
              <button 
                onClick={() => setConfirmDialog(null)}
                className={`w-full ${appearance.isBackgroundDark ? 'bg-white/5 text-white/60 hover:bg-white/10' : 'bg-black/5 text-black/60 hover:bg-black/10'} font-black py-4 rounded-2xl transition-all uppercase text-[10px] tracking-[0.2em] border ${appearance.isBackgroundDark ? 'border-white/10' : 'border-black/5'}`}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      <div 
        className={`absolute inset-0 z-0 transition-all duration-700 ${
          appearance?.background === 'google-theme' 
            ? (appearance.isBackgroundDark ? 'google-bg-dark' : 'google-bg-light') 
            : (appearance.isBackgroundDark ? 'bg-[#0a0f14]' : 'bg-white')
        }`}
        style={appearance?.background && appearance?.background !== 'google-theme' ? {
          backgroundImage: `url(${appearance.background})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        } : {}}
      />

      {/* Electron Transparent Frameless Titlebar */}
      <ElectronTitleBar 
        isBackgroundDark={appearance.isBackgroundDark} 
        themeHex={themeHex} 
        title={config.name ? `Lumina AI - ${config.name}` : 'Lumina AI'} 
        appearance={appearance}
      />

      <SettingsModal userProfile={userProfile} setUserProfile={setUserProfile}  
        isOpen={isAppearanceOpen}
        onClose={() => setIsAppearanceOpen(false)}
        appearance={appearance}
        setAppearance={setAppearance}
        themeHex={themeHex}
      />
      {isUserProfileOpen && (
        <UserProfileModal
          isOpen={isUserProfileOpen}
          onClose={() => setIsUserProfileOpen(false)}
          profile={userProfile}
          onSave={handleSaveUserProfile}
          onLoadGlobal={handleLoadGlobalProfile}
          appearance={appearance}
          themeHex={themeHex}
        />
      )}

      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        config={config}
        messages={activeThread}
        sessions={sessions}
        onNewChat={startNewChat}
        onLoadSession={loadSession}
        onDeleteSession={deleteSession}
        onClearSessions={clearAllSessions}
        onReset={resetAll}
        onRestore={handleRestore}
        onRestoreGlobal={handleRestoreGlobal}
        isBackgroundDark={appearance.isBackgroundDark}
        themeHex={themeHex}
        onOpenAppearance={() => {
          setIsAppearanceOpen(true);
          setIsSidebarOpen(false);
        }}
        appearance={appearance}
      />

      {contextMenu && (
        <ContextMenu 
          x={contextMenu.x} 
          y={contextMenu.y} 
          items={contextMenu.items} 
          targetElement={contextMenu.target}
          onClose={() => setContextMenu(null)} 
          isBackgroundDark={appearance.isBackgroundDark}
        />
      )}

      <main 
        className={`fixed top-0 left-0 right-0 z-10 w-full flex flex-row items-center justify-start overflow-hidden ${
          typeof window !== 'undefined' && window.electron?.isElectron ? 'pt-8' : ''
        }`}
        style={{ 
          height: `${vViewport.height}px`, 
          transform: `translateY(${vViewport.offsetTop}px)`,
          paddingBottom: 'env(safe-area-inset-bottom)'
        }}
      >
        {/* Global Navigation - Side Rail for Desktop, Bottom Nav for Mobile */}
        {(appState === AppState.CHAT || appState === AppState.PROFILE_SELECT || appState === AppState.CHARACTER_CARDS || appState === AppState.SETTINGS || appState === AppState.USER_PROFILE || (appState === AppState.SETUP && messages.length > 0)) && (
          <>
            {/* Desktop Side Navigation Rail */}
            <div 
              className={`hidden md:flex w-16 md:w-20 flex-shrink-0 h-full flex-col items-center pt-4 pb-8 gap-6 border-r z-40 relative transition-all duration-500`}
              style={{
                backgroundColor: appearance.isBackgroundDark ? `rgba(10, 15, 20, ${(appearance?.transparency ?? 0) / 100})` : `rgba(255, 255, 255, ${(appearance?.transparency ?? 0) / 100})`,
                backdropFilter: `blur(${appearance?.blur ?? 40}px)`,
                WebkitBackdropFilter: `blur(${appearance?.blur ?? 40}px)`,
                borderColor: appearance.isBackgroundDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
              }}
            >
              {/* Logo / Top Icon */}
              <div className="mb-1">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg overflow-hidden">
                  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' className="w-full h-full">
                    <defs>
                      <linearGradient id='logoGradient' x1='0%' y1='0%' x2='100%' y2='100%'>
                        <stop offset='0%' style={{ stopColor: themeHex || '#f43f5e', stopOpacity: 1 }} />
                        <stop offset='100%' style={{ stopColor: themeHex || '#881337', stopOpacity: 0.8 }} />
                      </linearGradient>
                    </defs>
                    <rect width='100' height='100' rx='30' fill='rgba(0,0,0,0.8)'/>
                    <path d='M35 25 Q35 75 35 75 L65 75' stroke='url(#logoGradient)' strokeWidth='12' fill='none' strokeLinecap='round'/>
                    <circle cx='70' cy='30' r='8' fill={themeHex || '#f43f5e'} opacity='1' />
                  </svg>
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="flex-1 flex flex-col items-center gap-4 w-full px-2">
                {/* Chat Button */}
                <button 
                  className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all group relative ${appState === AppState.CHAT || appState === AppState.PROFILE_SELECT ? (appearance.isBackgroundDark ? 'bg-white/10 text-white' : 'bg-black/10 text-black') : `${appearance.isBackgroundDark ? 'text-white/40 hover:text-white/60 hover:bg-white/5' : 'text-black/40 hover:text-black/60 hover:bg-black/5'}`}`}
                  onClick={() => handleNavigate(AppState.PROFILE_SELECT)}
                  title="Chat"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                  </svg>
                  {(appState === AppState.CHAT || appState === AppState.PROFILE_SELECT) && (
                    <div className="absolute left-0 w-1 h-6 rounded-r-full" style={{ backgroundColor: themeHex }} />
                  )}
                </button>

                {/* Character Button */}
                <button 
                  className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all group relative ${appState === AppState.CHARACTER_CARDS ? (appearance.isBackgroundDark ? 'bg-white/10 text-white' : 'bg-black/10 text-black') : `${appearance.isBackgroundDark ? 'text-white/40 hover:text-white/60 hover:bg-white/5' : 'text-black/40 hover:text-black/60 hover:bg-black/5'}`}`}
                  onClick={() => handleNavigate(AppState.CHARACTER_CARDS)}
                  title="Characters"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                  {appState === AppState.CHARACTER_CARDS && (
                    <div className="absolute left-0 w-1 h-6 rounded-r-full" style={{ backgroundColor: themeHex }} />
                  )}
                </button>
              </div>

              {/* Bottom Rail Icons */}
              <div className="flex flex-col items-center gap-4 pb-4">
                <button 
                  onClick={() => setIsAppearanceOpen(true)}
                  className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${appearance.isBackgroundDark ? 'text-white/30 hover:text-white/60 hover:bg-white/5' : 'text-black/30 hover:text-black/60 hover:bg-black/5'}`}
                  title="Pengaturan"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                
                <button 
                  onClick={() => setIsUserProfileOpen(true)}
                  className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/10 shadow-lg cursor-pointer hover:scale-110 transition-all flex items-center justify-center bg-zinc-800"
                  title="Profil Saya"
                >
                  {userProfile.profilePic ? (
                    <img 
                      src={userProfile.profilePic} 
                      alt="User" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white/40" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Mobile Bottom Navigation Bar */}
            <div 
              className={`md:hidden fixed left-4 right-4 h-[72px] flex items-center justify-around z-50 transition-all duration-500 px-2 rounded-[32px] border shadow-2xl ${appState === AppState.CHAT || (appState === AppState.SETUP && messages.length > 0) ? 'translate-y-[150%] opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}
              style={{
                bottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
                backgroundColor: appearance.isBackgroundDark ? `rgba(10, 15, 20, ${(appearance?.transparency ?? 0) / 100})` : `rgba(255, 255, 255, ${(appearance?.transparency ?? 0) / 100})`,
                backdropFilter: `blur(${appearance?.blur ?? 40}px)`,
                WebkitBackdropFilter: `blur(${appearance?.blur ?? 40}px)`,
                borderColor: appearance.isBackgroundDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
              }}
            >
              {/* Chat Button */}
              <button 
                className={`flex flex-col items-center gap-1.5 transition-all flex-1 py-2`}
                onClick={() => handleNavigate(AppState.PROFILE_SELECT)}
              >
                <div className={`w-[64px] h-[32px] relative flex items-center justify-center rounded-2xl transition-all ${appState === AppState.CHAT || appState === AppState.PROFILE_SELECT ? (appearance.isBackgroundDark ? 'bg-white/10 text-white' : 'bg-black/10 text-black') : (appearance.isBackgroundDark ? 'text-white/40' : 'text-black/40')}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                  </svg>
                  {totalUnreadCount > 0 && (
                    <span 
                      className="absolute -top-1 -right-1 z-30 min-w-[18px] h-[18px] px-1 text-white font-black text-[9px] rounded-full flex items-center justify-center shadow-lg border border-black animate-pulse"
                      style={{ backgroundColor: themeHex || '#f43f5e' }}
                      title={`${totalUnreadCount} Pesan Belum Terbaca`}
                    >
                      {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-[0.1em] ${appState === AppState.CHAT || appState === AppState.PROFILE_SELECT ? (appearance.isBackgroundDark ? 'text-white' : 'text-black') : (appearance.isBackgroundDark ? 'text-white/40' : 'text-black/40')}`}>Chat</span>
              </button>

              {/* Character Button */}
              <button 
                className={`flex flex-col items-center gap-1.5 transition-all flex-1 py-2`}
                onClick={() => handleNavigate(AppState.CHARACTER_CARDS)}
              >
                <div className={`w-[64px] h-[32px] flex items-center justify-center rounded-2xl transition-all ${appState === AppState.CHARACTER_CARDS ? (appearance.isBackgroundDark ? 'bg-white/10 text-white' : 'bg-black/10 text-black') : (appearance.isBackgroundDark ? 'text-white/40' : 'text-black/40')}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
                <span className={`text-[10px] font-black uppercase tracking-[0.1em] ${appState === AppState.CHARACTER_CARDS ? (appearance.isBackgroundDark ? 'text-white' : 'text-black') : (appearance.isBackgroundDark ? 'text-white/40' : 'text-black/40')}`}>Character</span>
              </button>

              {/* Pengaturan Button */}
              <button 
                className={`flex flex-col items-center gap-1.5 transition-all flex-1 py-2`}
                onClick={() => handleNavigate(AppState.SETTINGS)}
              >
                <div className={`w-[64px] h-[32px] flex items-center justify-center rounded-2xl transition-all ${appState === AppState.SETTINGS || isAppearanceOpen ? (appearance.isBackgroundDark ? 'bg-white/10 text-white' : 'bg-black/10 text-black') : (appearance.isBackgroundDark ? 'text-white/40' : 'text-black/40')}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span className={`text-[10px] font-black uppercase tracking-[0.1em] ${appState === AppState.SETTINGS || isAppearanceOpen ? (appearance.isBackgroundDark ? 'text-white' : 'text-black') : (appearance.isBackgroundDark ? 'text-white/40' : 'text-black/40')}`}>Pengaturan</span>
              </button>

              {/* Profile Button */}
              <button 
                className={`flex flex-col items-center gap-1.5 transition-all flex-1 py-2`}
                onClick={() => handleNavigate(AppState.USER_PROFILE)}
              >
                <div className={`w-[64px] h-[32px] flex items-center justify-center rounded-2xl transition-all ${appState === AppState.USER_PROFILE || isUserProfileOpen ? (appearance.isBackgroundDark ? 'bg-white/10 text-white' : 'bg-black/10 text-black') : (appearance.isBackgroundDark ? 'text-white/40' : 'text-black/40')}`}>
                  {userProfile.profilePic ? (
                    <div className="w-5 h-5 rounded-full overflow-hidden border border-white/20">
                      <img src={userProfile.profilePic} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                    </svg>
                  )}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-[0.1em] ${appState === AppState.USER_PROFILE || isUserProfileOpen ? (appearance.isBackgroundDark ? 'text-white' : 'text-black') : (appearance.isBackgroundDark ? 'text-white/40' : 'text-black/40')}`}>Profil</span>
              </button>
            </div>
          </>
        )}

        <div className={`flex-1 h-full flex flex-col overflow-hidden relative`}>
        {appState === AppState.SETUP && (
          <SetupView 
            config={config} 
            setConfig={setConfig} 
            profiles={profiles}
            setProfiles={setProfiles}
            onStart={() => {
              if (config.id) {
                setProfiles(prev => {
                  const exists = prev.some(p => p.id === config.id);
                  if (!exists) {
                    const updated = [...prev, config];
                    if (isDbReady) dbService.saveProfiles(updated);
                    return updated;
                  }
                  const updated = prev.map(p => p.id === config.id ? config : p);
                  if (isDbReady) dbService.saveProfiles(updated);
                  return updated;
                });
                if (isDbReady) {
                  dbService.saveConfig(config);
                }
              }
              handleNavigate(AppState.CHAT, true);
            }} 
            onReset={resetAll} 
            onResetMemory={handleResetMemory}
            onClose={() => {
              if (config.id) {
                handleNavigate(AppState.CHAT, true);
              } else {
                handleNavigate(AppState.PROFILE_SELECT, true);
              }
            }}
            onConfirmAction={(msg, onConfirm) => setConfirmDialog({ message: msg, onConfirm })}
            onRestoreClick={handleRestore}
            onExportClick={handleExportProfile}
            onOpenAppearance={() => setIsAppearanceOpen(true)}
            onNavigate={(state) => handleNavigate(state as AppState)}
            appearance={appearance}
            isBackgroundDark={appearance.isBackgroundDark}
            setIsBackgroundDark={setIsBackgroundDark}
            themeHex={themeHex}
          />
        )}
        {(appState === AppState.PROFILE_SELECT || (appState === AppState.SETUP && messages.length === 0)) && (
          <div className={`w-full h-full flex overflow-hidden ${appState === AppState.SETUP ? 'pointer-events-none' : ''}`}>
            <ProfileSelectorView
              profiles={profiles}
              lastMessagesMap={lastMessagesMap}
              unreadCountsMap={unreadCountsMap}
              onToggleUnread={handleToggleUnread}
              config={config}
              themeHex={themeHex}
              isBackgroundDark={appearance.isBackgroundDark}
              appState={appState}
              activeGenerations={activeGenerations}
              onSelect={(selected) => {
                setConfig(selected);
                handleNavigate(AppState.CHAT);
              }}
              onBack={() => handleNavigate(AppState.CHARACTER_CARDS)}
              onOpenAppearance={() => setIsAppearanceOpen(true)}
              appearance={appearance}
              onBackup={handleBackup}
              onRestore={triggerRestore}
              onGlobalBackup={handleGlobalBackup}
              onGlobalRestore={triggerGlobalRestore}
              onNew={() => {
                const newId = Date.now().toString();
                const newProfile: AgentConfig = {
                  id: newId,
                  name: 'Karakter Baru',
                  personality: '',
                  voice: 'Kore',
                  profilePic: LUMINA_DEFAULT_PIC,
                  background: 'google-theme',
                  blur: 40,
                  transparency: 0,
                };
                setConfig(newProfile);
                handleNavigate(AppState.SETUP);
              }}
              onContextMenu={triggerContextMenu}
              onLongPress={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onEditAgent={(p) => {
                setConfig(p);
                handleNavigate(AppState.SETUP);
              }}
              onDeleteAgent={handleDeleteProfile}
              onExportAgent={handleBackup}
              onResetProfilePic={(p) => updateAgentConfig(p.id!, { profilePic: LUMINA_DEFAULT_PIC })}
            />
          </div>
        )}
        {(appState === AppState.CHAT || (appState === AppState.SETUP && messages.length > 0)) && (
          <div className={`w-full h-full flex overflow-hidden ${appState === AppState.SETUP ? 'pointer-events-none' : ''}`}>
            {/* Desktop Sidebar Profile Selector */}
            <div 
              className="hidden md:flex flex-col h-full border-r border-white/10 relative z-20"
              style={{ width: sidebarWidth }}
            >
              <ProfileSelectorView
                profiles={profiles}
                lastMessagesMap={lastMessagesMap}
                unreadCountsMap={unreadCountsMap}
                config={config}
                themeHex={themeHex}
                isSidebar={true}
                isBackgroundDark={appearance.isBackgroundDark}
                appearance={appearance}
                appState={appState}
                activeGenerations={activeGenerations}
                onOpenAppearance={() => setIsAppearanceOpen(true)}
                onBackup={handleBackup}
                onRestore={triggerRestore}
                onGlobalBackup={handleGlobalBackup}
                onGlobalRestore={triggerGlobalRestore}
                onSelect={(selected) => {
                  setConfig(selected);
                  handleNavigate(AppState.CHAT);
                }}
                onBack={() => handleNavigate(AppState.CHARACTER_CARDS)}
                onNew={() => {
                  const newId = Date.now().toString();
                  const newProfile: AgentConfig = {
                    id: newId,
                    name: 'Karakter Baru',
                    personality: '',
                    voice: 'Kore',
                    profilePic: LUMINA_DEFAULT_PIC,
                    background: 'google-theme',
                    blur: 40,
                    transparency: 0,
                  };
                  setConfig(newProfile);
                  handleNavigate(AppState.SETUP);
                }}
                onContextMenu={triggerContextMenu}
                onLongPress={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onEditAgent={(p) => {
                  setConfig(p);
                  handleNavigate(AppState.SETUP);
                }}
                onDeleteAgent={handleDeleteProfile}
                onExportAgent={handleBackup}
                onResetProfilePic={(p) => updateAgentConfig(p.id!, { profilePic: LUMINA_DEFAULT_PIC })}
              />
              
              {/* Resize Handle */}
              <div 
                className={`absolute top-0 -right-1 w-1.5 h-full cursor-col-resize z-30 transition-all ${isResizing ? 'opacity-50' : 'opacity-0 hover:opacity-20'}`}
                style={{ backgroundColor: themeHex }}
                onMouseDown={startResizing}
              />
            </div>

            <div className="flex-1 h-full relative z-30">
              <ChatView 
                key={config.id || 'default'}
                config={config} 
                setConfig={setConfig}
                messages={messages}
                setMessages={setMessages}
                activeMessageId={activeMessageId}
                setActiveMessageId={setActiveMessageId}
                activeThread={activeThread}
                userProfile={userProfile}
                setUserProfile={setUserProfile}
                onOpenSidebar={() => setIsSidebarOpen(true)}
                onCall={() => handleNavigate(AppState.CALL)}
                onEdit={() => handleNavigate(AppState.SETUP)}
                onBackToList={() => handleNavigate(AppState.PROFILE_SELECT)}
                onDeleteMessage={handleDeleteMessage}
                onResetMemory={handleResetMemory}
                addMessageToAgent={addMessageToAgent}
                updateUserProfileForAgent={updateUserProfileForAgent}
                updateAgentConfig={updateAgentConfig}
                onOpenAppearance={() => setIsAppearanceOpen(true)}
                appearance={appearance}
                defaultProfilePic={LUMINA_DEFAULT_PIC}
                isBackgroundDark={appearance.isBackgroundDark}
                themeHex={themeHex}
                viewportHeight={vViewport.height}
                onContextMenu={triggerContextMenu}
                onLongPress={handleTouchStart}
                onGlobalTouchMove={handleTouchMove}
                onGlobalTouchEnd={handleTouchEnd}
                onOpenProfile={() => setIsUserProfileOpen(true)}
                onOpenGallery={() => {}} 
                activeGenerations={activeGenerations}
                onStartGeneration={handleStartGeneration}
                onUpdateGeneration={handleUpdateGeneration}
                onFinishGeneration={handleFinishGeneration}
              />
            </div>
          </div>
        )}
        {appState === AppState.CHARACTER_CARDS && (
          <div className="w-full h-full flex overflow-hidden">
            <CharacterCardsView
              profiles={profiles}
              lastMessagesMap={lastMessagesMap}
              unreadCountsMap={unreadCountsMap}
              onToggleUnread={handleToggleUnread}
              isBackgroundDark={appearance.isBackgroundDark}
              themeHex={themeHex}
              onSelect={(selected) => {
                setConfig(selected);
                handleNavigate(AppState.CHAT);
              }}
              onEdit={handleEditProfile}
              onDelete={handleDeleteProfile}
              onExport={handleExportProfile}
              onRestore={triggerRestore}
              onNavigate={(state) => handleNavigate(state as AppState)}
              onOpenAppearance={() => setIsAppearanceOpen(true)}
              appearance={appearance}
              onNew={() => {
                const newId = Date.now().toString();
                const newProfile: AgentConfig = {
                  id: newId,
                  name: 'Karakter Baru',
                  personality: '',
                  voice: 'Kore',
                  profilePic: LUMINA_DEFAULT_PIC,
                  background: 'google-theme',
                  blur: 40,
                  transparency: 0,
                };
                setConfig(newProfile);
                handleNavigate(AppState.SETUP);
              }}
              onContextMenu={triggerContextMenu}
              onLongPress={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onOpenProfile={() => setIsUserProfileOpen(true)}
            />
          </div>
        )}
        {appState === AppState.SETTINGS && (
          <div className="w-full h-full flex overflow-hidden">
            <SettingsModal
              isOpen={true}
              isEmbeddedPage={true}
              onClose={() => handleNavigate(AppState.PROFILE_SELECT)}
              appearance={appearance}
              setAppearance={setAppearance}
              userProfile={userProfile}
              setUserProfile={setUserProfile}
              themeHex={themeHex}
            />
          </div>
        )}
        {appState === AppState.USER_PROFILE && (
          <div className="w-full h-full flex overflow-hidden">
            <UserProfileModal
              isOpen={true}
              isEmbeddedPage={true}
              onClose={() => handleNavigate(AppState.PROFILE_SELECT)}
              profile={userProfile}
              onSave={handleSaveUserProfile}
              onLoadGlobal={handleLoadGlobalProfile}
              appearance={appearance}
              themeHex={themeHex}
            />
          </div>
        )}
        {appState === AppState.CALL && (
          <CallView 
            key={`call_${config.id}_${activeThread.length > 0 ? activeThread[0].id : 'new'}`}
            config={config}
            activeThread={activeThread}
            userProfile={userProfile}
            setUserProfile={setUserProfile}
            isBackgroundDark={appearance.isBackgroundDark}
            themeHex={themeHex}
            viewportHeight={vViewport.height}
            onEndCall={(duration, summary, transcript) => {
              if (duration !== "0:00") {
                const callMsgId = Date.now().toString();
                const callMemoryMsg: ChatMessage = {
                  id: callMsgId,
                  role: 'agent',
                  text: `Panggilan berakhir (${duration})`,
                  hiddenMemory: transcript,
                  callTranscript: transcript,
                  timestamp: Date.now(),
                  parentId: activeMessageId,
                  agentId: config.id,
                  sessionId: activeThread.length > 0 ? activeThread[0].id : 'new_session'
                };
                addMessageToAgent(config.id || 'default', callMemoryMsg);
              }
              handleNavigate(AppState.CHAT, true);
            }}
          />
        )}
        {appState === AppState.WIZARD && (
          <CharacterWizard
            onBack={() => handleNavigate(AppState.CHARACTER_CARDS)}
            onAdd={(newChar) => {
              setProfiles(prev => [...prev, newChar]);
              if (isDbReady) {
                dbService.saveConfig(newChar);
              }
              setConfig(newChar);
              handleNavigate(AppState.CHAT);
            }}
            userProfile={userProfile}
            themeHex={themeHex}
            isBackgroundDark={appearance.isBackgroundDark}
          />
        )}
        {/* Floating Circular Progress for Background Generating Agents */}
        {appearance.showFloatingProgress !== false && (
          <FloatingGenerationProgress
            activeGenerations={activeGenerations}
            onSelectAgent={(targetAgentId) => {
              const targetAgent = profiles.find(p => p.id === targetAgentId);
              if (targetAgent) {
                setConfig(targetAgent);
                handleNavigate(AppState.CHAT);
              }
            }}
            isBackgroundDark={appearance.isBackgroundDark}
            themeHex={themeHex}
            currentAgentId={config.id}
            appState={appState}
          />
        )}

        {/* Notifications */}
        <NotificationToast
          notifications={notifications}
          profiles={profiles}
          onSelectNotification={(agentId, notifId) => {
            const targetAgent = profiles.find(p => p.id === agentId);
            if (targetAgent) {
              setConfig(targetAgent);
              handleNavigate(AppState.CHAT);
              setNotifications(prev => prev.filter(n => n.id !== notifId));
            }
          }}
          onDismissNotification={(notifId) => {
            setNotifications(prev => prev.filter(n => n.id !== notifId));
          }}
          isBackgroundDark={appearance.isBackgroundDark}
          themeHex={themeHex}
          isElectron={typeof window !== 'undefined' && !!window.electron?.isElectron}
        />
        </div>
      </main>
    </div>
  </div>
);
};

export default App;