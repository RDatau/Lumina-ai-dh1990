
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AgentConfig, ChatMessage, Attachment, UserProfile, GlobalAppearance, ActiveGenerationTask } from '../types';
import { generateAgentResponse, getSpeech, generatePAP, cleanResponseText, generateErrorMessage, reviseAgentResponseBasedOnImage, generateSmartTitle, isTtsModelStreamSupported, getActiveTtsModel, cleanRawCaptionToPureGarment, regeneratePapVariation, getAllGeminiApiKeys } from '../services/geminiService';
import { triggerNewMessageNotification } from '../services/notificationService';
import ImageInfoModal from './ImageInfoModal';


const decodeBase64 = (base64: string) => {
  const binaryString = atob(base64.includes(',') ? base64.split(',')[1] : base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
};

const AudioVisualizer = ({ isBackgroundDark }: { isBackgroundDark: boolean }) => (
  <div className="flex items-end gap-0.5 h-3">
    <div className={`w-1 ${isBackgroundDark ? 'bg-white' : 'bg-black'} rounded-full animate-eq-1`}></div>
    <div className={`w-1 ${isBackgroundDark ? 'bg-white/60' : 'bg-black/60'} rounded-full animate-eq-2`}></div>
    <div className={`w-1 ${isBackgroundDark ? 'bg-white' : 'bg-black'} rounded-full animate-eq-3`}></div>
  </div>
);

const CodeBlockItem: React.FC<{
  code: string;
  lang?: string;
  isBackgroundDark: boolean;
}> = ({ code, lang, isBackgroundDark }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayLang = lang?.trim() ? lang.toUpperCase() : 'PROMPT';

  return (
    <div className={`my-2 rounded-2xl overflow-hidden border ${isBackgroundDark ? 'border-white/15 bg-black/60' : 'border-black/10 bg-black/80 text-white'} backdrop-blur-md shadow-xl text-left`}>
      <div className="flex items-center justify-between px-3.5 py-2 bg-white/10 border-b border-white/10 select-none">
        <div className="flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-emerald-400 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
            {displayLang}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all cursor-pointer shadow-sm"
          title="Salin Prompt"
        >
          {copied ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-emerald-400">Tersalin!</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
              <span>Salin Prompt</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 text-xs md:text-sm font-mono overflow-x-auto text-zinc-100 whitespace-pre-wrap break-words leading-relaxed select-text font-normal">
        <code>{code.trim()}</code>
      </pre>
    </div>
  );
};

const parseMarkdownInline = (text: string, keyPrefix = ''): React.ReactNode[] => {
  if (!text) return [];

  // Match inline markdown formatting:
  // 1. Inline code: `...`
  // 2. Bold italic: ***...***
  // 3. Bold: **...** or __...__
  // 4. Italic: *...* or _..._
  // 5. Strikethrough: ~~...~~
  const tokenRegex = /(`[^`\n]+`|\*\*\*[^\*\n]+?\*\*\*|\*\*[^\*\n]+?\*\*|__[^_\n]+?__|\*[^\*\n]+?\*|(?<!\w)_[^_\n]+?_(?!\w)|~~[^~\n]+?~~)/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-${match.index}`;

    if (token.startsWith('`') && token.endsWith('`')) {
      const code = token.slice(1, -1);
      parts.push(
        <code
          key={key}
          className="px-1.5 py-0.5 mx-0.5 rounded bg-black/30 border border-white/10 font-mono text-[11px] md:text-xs text-pink-300 font-semibold select-text"
        >
          {code}
        </code>
      );
    } else if (token.startsWith('***') && token.endsWith('***')) {
      const inner = token.slice(3, -3);
      parts.push(
        <strong key={key} className="font-extrabold italic">
          {parseMarkdownInline(inner, `${key}-bi`)}
        </strong>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      const inner = token.slice(2, -2);
      parts.push(
        <strong key={key} className="font-bold">
          {parseMarkdownInline(inner, `${key}-b`)}
        </strong>
      );
    } else if (token.startsWith('__') && token.endsWith('__')) {
      const inner = token.slice(2, -2);
      parts.push(
        <strong key={key} className="font-bold">
          {parseMarkdownInline(inner, `${key}-u`)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      const inner = token.slice(1, -1);
      parts.push(
        <em key={key} className="italic opacity-90">
          {parseMarkdownInline(inner, `${key}-i`)}
        </em>
      );
    } else if (token.startsWith('_') && token.endsWith('_')) {
      const inner = token.slice(1, -1);
      parts.push(
        <em key={key} className="italic opacity-90">
          {parseMarkdownInline(inner, `${key}-ui`)}
        </em>
      );
    } else if (token.startsWith('~~') && token.endsWith('~~')) {
      const inner = token.slice(2, -2);
      parts.push(
        <del key={key} className="line-through opacity-75">
          {parseMarkdownInline(inner, `${key}-s`)}
        </del>
      );
    } else {
      parts.push(token);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
};

const FormattedMessage: React.FC<{
  content: string;
  role: 'user' | 'agent';
  dynamicTextColor: string;
  themeTextClass: string;
  isBackgroundDark: boolean;
}> = ({ content, role, dynamicTextColor, themeTextClass, isBackgroundDark }) => {
  const parts: React.ReactNode[] = [];
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const textColor = role === 'agent' ? dynamicTextColor : themeTextClass;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const textBefore = content.substring(lastIndex, match.index);
    if (textBefore) {
      parts.push(
        <span key={`text-${lastIndex}`} className="whitespace-pre-wrap">
          {parseMarkdownInline(textBefore, `pre-${lastIndex}`)}
        </span>
      );
    }

    const lang = match[1]?.trim();
    const code = match[2];
    parts.push(
      <CodeBlockItem
        key={`code-${match.index}`}
        code={code}
        lang={lang}
        isBackgroundDark={isBackgroundDark}
      />
    );

    lastIndex = match.index + match[0].length;
  }

  const remainingText = content.substring(lastIndex);
  if (remainingText) {
    parts.push(
      <span key={`text-${lastIndex}`} className="whitespace-pre-wrap">
        {parseMarkdownInline(remainingText, `post-${lastIndex}`)}
      </span>
    );
  }

  return (
    <div className={`text-sm leading-relaxed font-medium select-text ${textColor}`}>
      {parts.length > 0 ? parts : <span className="whitespace-pre-wrap">{parseMarkdownInline(content, 'single')}</span>}
    </div>
  );
};

const VoicePlayer: React.FC<{ 
  audioBase64: string; 
  msgId: string; 
  onPlayStateChange: (isPlaying: boolean) => void;
  isBackgroundDark: boolean;
  dynamicBorderColor: string;
  dynamicMutedTextColor: string;
}> = ({ audioBase64, msgId, onPlayStateChange, isBackgroundDark, dynamicBorderColor, dynamicMutedTextColor }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioBase64) return;
    
    let url = '';
    try {
      const data = decodeBase64(audioBase64);
      const blob = new Blob([data], { type: 'audio/mpeg' });
      url = URL.createObjectURL(blob);
      audioRef.current = new Audio(url);
      const audio = audioRef.current;

      const updateProgress = () => {
        if (audio.duration) {
          setCurrentTime(audio.currentTime);
          setProgress((audio.currentTime / audio.duration) * 100);
        }
      };

      const onLoadedMetadata = () => setDuration(audio.duration);
      const onEnded = () => {
        setIsPlaying(false);
        setProgress(0);
        setCurrentTime(0);
        onPlayStateChange(false);
      };

      audio.addEventListener('timeupdate', updateProgress);
      audio.addEventListener('loadedmetadata', onLoadedMetadata);
      audio.addEventListener('ended', onEnded);

      return () => {
        audio.pause();
        audio.removeEventListener('timeupdate', updateProgress);
        audio.removeEventListener('loadedmetadata', onLoadedMetadata);
        audio.removeEventListener('ended', onEnded);
        if (url) URL.revokeObjectURL(url);
      };
    } catch (e) {
      console.error("VoicePlayer error:", e);
      return () => {
        if (url) URL.revokeObjectURL(url);
      };
    }
  }, [audioBase64]);

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      onPlayStateChange(false);
    } else {
      audioRef.current?.play();
      setIsPlaying(true);
      onPlayStateChange(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const seekTime = (val / 100) * duration;
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
      setProgress(val);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex flex-col gap-2 w-full mt-3 ${isBackgroundDark ? 'bg-white/5' : 'bg-black/5'} p-3 rounded-2xl border ${dynamicBorderColor} shadow-inner`}>
      <div className="flex items-center gap-3">
        <button 
          onClick={togglePlay} 
          className={`w-10 h-10 flex-shrink-0 flex items-center justify-center ${isBackgroundDark ? 'bg-white text-black' : 'bg-black text-white'} rounded-full shadow-lg active:scale-90 transition-all`}
        >
          {isPlaying ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-0.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
          )}
        </button>
        <div className="flex-1 flex flex-col gap-1.5">
          <input 
            type="range" 
            min="0" 
            max="100" 
            step="0.1"
            value={progress} 
            onChange={handleSeek} 
            className={`w-full h-1.5 ${isBackgroundDark ? 'bg-white/10' : 'bg-black/10'} rounded-full appearance-none cursor-pointer ${isBackgroundDark ? 'accent-white' : 'accent-black'}`} 
          />
          <div className={`flex justify-between text-[9px] font-black ${dynamicMutedTextColor} uppercase tracking-[0.2em]`}>
            <span>{formatTime(currentTime)}</span>
            <div className="flex items-center gap-2">
               {isPlaying && <AudioVisualizer isBackgroundDark={isBackgroundDark} />}
               <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

class StreamingPcmPlayer {
  private ctx: AudioContext | null = null;
  private nextPlayTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private isStreamingActive: boolean = false;
  private onPlaybackComplete?: () => void;
  private onPlaybackStart?: () => void;

  constructor(callbacks?: { onPlaybackStart?: () => void; onPlaybackComplete?: () => void }) {
    this.onPlaybackStart = callbacks?.onPlaybackStart;
    this.onPlaybackComplete = callbacks?.onPlaybackComplete;
  }

  public async init() {
    this.stop();
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioCtx({ sampleRate: 24000 });
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    this.nextPlayTime = 0;
    this.activeSources = [];
    this.isStreamingActive = true;
  }

  public playChunk(pcmInt16: Int16Array) {
    if (!this.ctx || pcmInt16.length === 0) return;

    const frameCount = pcmInt16.length;
    const audioBuffer = this.ctx.createBuffer(1, frameCount, 24000);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = pcmInt16[i] / 32768.0;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.ctx.destination);

    const currentTime = this.ctx.currentTime;
    if (this.nextPlayTime < currentTime) {
      this.nextPlayTime = currentTime + 0.025;
      this.onPlaybackStart?.();
    }

    source.start(this.nextPlayTime);
    this.nextPlayTime += audioBuffer.duration;
    this.activeSources.push(source);

    source.onended = () => {
      const idx = this.activeSources.indexOf(source);
      if (idx !== -1) {
        this.activeSources.splice(idx, 1);
      }
      if (this.activeSources.length === 0 && !this.isStreamingActive) {
        this.onPlaybackComplete?.();
      }
    };
  }

  public markStreamFinished() {
    this.isStreamingActive = false;
    if (this.activeSources.length === 0) {
      this.onPlaybackComplete?.();
    }
  }

  public stop() {
    this.isStreamingActive = false;
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {}
    }
    this.activeSources = [];
    this.nextPlayTime = 0;
  }

  public get isPlaying(): boolean {
    return this.activeSources.length > 0;
  }
}

export const isTouchOrMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia('(pointer: coarse)').matches ||
    window.innerWidth < 768
  );
};

export const handleTextareaKeyDown = (
  e: React.KeyboardEvent<HTMLTextAreaElement>, 
  onSend: () => void
) => {
  if (e.key === 'Enter') {
    const isMobile = isTouchOrMobileDevice();
    if (isMobile) {
      // Mode Mobile: Enter untuk baris baru (biarkan default behavior)
      return;
    } else {
      // Mode Desktop:
      if (e.shiftKey) {
        // Shift + Enter = baris baru (biarkan default behavior)
        return;
      } else {
        // Enter tanpa Shift = KIRIM PESAN!
        e.preventDefault();
        onSend();
      }
    }
  }
};

interface ChatViewProps {
  config: AgentConfig; 
  setConfig: (config: AgentConfig) => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  activeMessageId: string | null;
  setActiveMessageId: (id: string | null) => void;
  activeThread: ChatMessage[];
  userProfile: UserProfile;
  setUserProfile: (profile: UserProfile) => void;
  onOpenSidebar: () => void;
  onCall: () => void;
  onEdit: () => void;
  onBackToList: () => void;
  onDeleteMessage: (id: string) => void;
  onResetMemory?: () => void;
  addMessageToAgent: (agentId: string, newMessage: ChatMessage, setActive?: boolean) => Promise<void>;
  updateUserProfileForAgent: (agentId: string, updatedProfile: UserProfile) => Promise<void>;
  onOpenAppearance?: () => void;
  appearance: GlobalAppearance;
  defaultProfilePic: string;
  isBackgroundDark?: boolean;
  themeHex?: string;
  viewportHeight?: number;
  onContextMenu?: (e: any, items: any[]) => void;
  onLongPress?: (e: any, items: any[]) => void;
  onGlobalTouchMove?: () => void;
  onGlobalTouchEnd?: () => void;
  onOpenProfile?: () => void;
  onOpenGallery?: () => void;
  onStartGeneration?: (task: ActiveGenerationTask) => void;
  onUpdateGeneration?: (agentId: string, statusText: string, type?: 'text' | 'pap' | 'audio') => void;
  onFinishGeneration?: (agentId: string, type?: 'text' | 'pap' | 'audio') => void;
  activeGenerations?: ActiveGenerationTask[];
}

const ChatView: React.FC<ChatViewProps> = ({ 
  config, 
  setConfig,
  messages, 
  setMessages, 
  activeMessageId, 
  setActiveMessageId,
  activeThread,
  userProfile,
  setUserProfile,
  onOpenSidebar, 
  onCall, 
  onEdit,
  onBackToList,
  onDeleteMessage,
  onResetMemory,
  addMessageToAgent,
  updateUserProfileForAgent,
  updateAgentConfig,
  onOpenAppearance,
  appearance,
  defaultProfilePic,
  isBackgroundDark = true,
  themeHex,
  viewportHeight,
  onContextMenu,
  onLongPress,
  onGlobalTouchMove,
  onGlobalTouchEnd,
  onOpenProfile,
  onOpenGallery,
  onStartGeneration,
  onUpdateGeneration,
  onFinishGeneration,
  activeGenerations = []
}) => {
  const hasApiKey = useMemo(() => {
    return getAllGeminiApiKeys(userProfile).length > 0;
  }, [userProfile]);

  const [inputText, setInputText] = useState('');
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editAttachments, setEditAttachments] = useState<Attachment[]>([]);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessingMetadata, setIsProcessingMetadata] = useState(false);
  const [metadataStatus, setMetadataStatus] = useState("");
  
  const [isTyping, setIsTyping] = useState(false);
  const [loadingType, setLoadingType] = useState<'typing' | 'pap' | 'audio' | null>(null);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [papSlotPreview, setPapSlotPreview] = useState<{ slot: number; label: string; url: string } | null>(null);
  const [allPapSlots, setAllPapSlots] = useState<{ slot: number; label: string; url: string }[]>([]);

  // Auto-rotasi pergantian preview gambar Slot 1 (Foto Profil) dan Slot 2 (Pose/Ruangan) setiap 3 detik saat generate PAP
  useEffect(() => {
    if (loadingType !== 'pap' || allPapSlots.length <= 1) return;

    const interval = setInterval(() => {
      setPapSlotPreview(current => {
        if (!current) return allPapSlots[0];
        const currentIdx = allPapSlots.findIndex(s => s.slot === current.slot);
        const nextIdx = (currentIdx + 1) % allPapSlots.length;
        return allPapSlots[nextIdx];
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [loadingType, allPapSlots]);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [streamingAudioId, setStreamingAudioId] = useState<string | null>(null);
  const [streamingStatus, setStreamingStatus] = useState<'connecting' | 'playing' | null>(null);
  const streamingPlayerRef = useRef<StreamingPcmPlayer | null>(null);
  const abortSignalRef = useRef<{ aborted: boolean }>({ aborted: false });
  const [attachedFiles, setAttachedFiles] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingProfile, setIsDraggingProfile] = useState(false);
  const [showProfilePreview, setShowProfilePreview] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<Attachment | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryTab, setGalleryTab] = useState<'media' | 'audio' | 'docs'>('media');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [imageInfoData, setImageInfoData] = useState<{
    isOpen: boolean;
    imageUrl: string | null;
    imagePrompt?: string;
    caption?: string;
    outfit?: string;
    timestamp?: number;
    agentName?: string;
  }>({
    isOpen: false,
    imageUrl: null,
  });

  const [isRegeneratingVariation, setIsRegeneratingVariation] = useState<boolean>(false);
  const [regeneratingStatus, setRegeneratingStatus] = useState<string>('');

  const handleSwitchVariationForMessage = (messageId: string, targetVarIndex: number) => {
    const targetMsg = activeThread.find(m => m.id === messageId);
    if (!targetMsg || !targetMsg.images || !targetMsg.images[targetVarIndex]) return;

    const selectedImage = targetMsg.images[targetVarIndex];
    const updatedMsg: ChatMessage = {
      ...targetMsg,
      image: selectedImage,
      activeImageIndex: targetVarIndex
    };

    setMessages(prev => prev.map(m => m.id === messageId ? updatedMsg : m));
    addMessageToAgent(config.id || 'default', updatedMsg, false);

    // If currently previewing this image in the modal, update previewMedia
    if (previewMedia && (previewMedia.id === messageId || targetMsg.images.includes(previewMedia.data))) {
      setPreviewMedia(prev => prev ? ({
        ...prev,
        data: selectedImage
      }) : null);
    }
  };

  const handleDeleteVariationForMessage = (messageId: string, varIndexToDelete: number) => {
    const targetMsg = activeThread.find(m => m.id === messageId);
    if (!targetMsg || !targetMsg.images || !targetMsg.images[varIndexToDelete]) return;

    const remainingImages = targetMsg.images.filter((_, idx) => idx !== varIndexToDelete);

    if (remainingImages.length === 0) {
      const updatedMsg: ChatMessage = {
        ...targetMsg,
        image: undefined,
        images: undefined,
        activeImageIndex: undefined
      };
      setMessages(prev => prev.map(m => m.id === messageId ? updatedMsg : m));
      addMessageToAgent(config.id || 'default', updatedMsg, false);
      setPreviewMedia(null);
      return;
    }

    const newActiveIndex = Math.min(varIndexToDelete, remainingImages.length - 1);
    const newActiveImage = remainingImages[newActiveIndex];

    const updatedMsg: ChatMessage = {
      ...targetMsg,
      image: newActiveImage,
      images: remainingImages,
      activeImageIndex: newActiveIndex
    };

    setMessages(prev => prev.map(m => m.id === messageId ? updatedMsg : m));
    addMessageToAgent(config.id || 'default', updatedMsg, false);

    setPreviewMedia(prev => prev ? ({
      ...prev,
      data: newActiveImage
    }) : null);
  };

  const handleRegenerateVariation = async () => {
    const currentItem = allMediaItems[currentMediaIndex];
    const sourceMsg = activeThread.find(m => m.id === currentItem?.id || m.id === previewMedia?.id);
    if (!sourceMsg) return;

    // Persiapkan input data yang sama persis
    const promptToUse = sourceMsg.generationInputs?.prompt || sourceMsg.imagePrompt || sourceMsg.outfit || '';
    if (!promptToUse) {
      console.warn("Prompt untuk regenerasi variasi tidak ditemukan.");
      return;
    }

    let baseImgToUse = sourceMsg.generationInputs?.baseImage || config.profilePic || null;
    if (!baseImgToUse) {
      const prevMsg = [...activeThread].reverse().find(m => m.id !== sourceMsg.id && m.image && m.image.startsWith('data:'));
      baseImgToUse = prevMsg?.image || null;
    }

    if (!baseImgToUse) {
      alert("Foto profil atau dasar karakter diperlukan untuk menghasilkan variasi.");
      return;
    }

    const extraRefToUse = sourceMsg.generationInputs?.extraRefImage || null;
    const additionalImagesToUse = sourceMsg.generationInputs?.additionalImages || [];

    setIsRegeneratingVariation(true);
    setRegeneratingStatus('Menghubungkan ke Space ZeroGPU...');

    const capturedAgentId = config.id || 'default';
    onStartGeneration?.({
      id: `regen-${sourceMsg.id}`,
      agentId: capturedAgentId,
      agentName: config.name,
      agentPic: config.profilePic,
      type: 'pap',
      statusText: 'Regenerate variasi PAP...',
      startedAt: Date.now()
    });

    try {
      const newPapUrl = await regeneratePapVariation(
        promptToUse,
        baseImgToUse,
        extraRefToUse,
        additionalImagesToUse,
        userProfile,
        (status, previewInfo) => {
          if (isMounted.current) {
            setRegeneratingStatus(status);
          }
          onUpdateGeneration?.(capturedAgentId, status, 'pap');
        }
      );

      if (newPapUrl) {
        const existingImages = sourceMsg.images && sourceMsg.images.length > 0 
          ? [...sourceMsg.images] 
          : (sourceMsg.image ? [sourceMsg.image] : []);
        
        const updatedImages = [...existingImages, newPapUrl];
        const newActiveIndex = updatedImages.length - 1;

        const updatedMsg: ChatMessage = {
          ...sourceMsg,
          image: newPapUrl,
          images: updatedImages,
          activeImageIndex: newActiveIndex,
          generationInputs: sourceMsg.generationInputs || {
            prompt: promptToUse,
            baseImage: baseImgToUse,
            extraRefImage: extraRefToUse,
            additionalImages: additionalImagesToUse
          }
        };

        setMessages(prev => prev.map(m => m.id === sourceMsg.id ? updatedMsg : m));
        addMessageToAgent(capturedAgentId, updatedMsg, false);
        triggerNewMessageNotification(config.name, "Variasi PAP baru telah selesai dibuat!", 'pap', config.profilePic);

        setPreviewMedia(prev => prev ? ({
          ...prev,
          data: newPapUrl
        }) : null);
      }
    } catch (err: any) {
      console.error("Gagal meregenerasi variasi PAP:", err);
      const errMsg = err?.message || String(err);
      alert(`Gagal membuat variasi baru: ${errMsg}`);
    } finally {
      if (isMounted.current) {
        setIsRegeneratingVariation(false);
        setRegeneratingStatus('');
      }
      onFinishGeneration?.(capturedAgentId, 'pap');
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedItems(new Set());
  };

  const toggleItemSelection = (id: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedItems(newSelection);
  };

  const selectAllItems = (items: any[]) => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(i => i.id + i.name))); // Unique ID
    }
  };

  const downloadSelectedItems = async (items: any[]) => {
    const itemsToDownload = items.filter(i => selectedItems.has(i.id + i.name));
    for (const item of itemsToDownload) {
      const downloadName = item.fileName || item.name;
      await downloadMedia(item.data, downloadName, item.mimeType || (item.type === 'image' ? 'image/png' : 'video/mp4'), item.id);
      // Small delay to prevent browser blocking multiple downloads
      await new Promise(r => setTimeout(r, 300));
    }
    setIsSelectionMode(false);
    setSelectedItems(new Set());
  };
  const [isQuotaCooldown, setIsQuotaCooldown] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcriptText, setTranscriptText] = useState('');
  
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDraggingMedia, setIsDraggingMedia] = useState(false);

  // Zoom & Pan state for Media Preview Modal (PAP Viewer)
  const [mediaZoomScale, setMediaZoomScale] = useState<number>(1);
  const [mediaZoomPos, setMediaZoomPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isMediaPanDragging, setIsMediaPanDragging] = useState<boolean>(false);
  const mediaDragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const mediaTouchDistRef = useRef<number | null>(null);
  const mediaInitialScaleRef = useRef<number>(1);
  const mediaContainerRef = useRef<HTMLDivElement | null>(null);
  const mediaImgRef = useRef<HTMLImageElement | null>(null);

  const handleResetMediaZoom = () => {
    setMediaZoomScale(1);
    setMediaZoomPos({ x: 0, y: 0 });
    setIsMediaPanDragging(false);
  };
  
  const [previewAudioPlaying, setPreviewAudioPlaying] = useState(false);
  const [previewAudioProgress, setPreviewAudioProgress] = useState(0);
  const [previewAudioDuration, setPreviewAudioDuration] = useState(0);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const [previewVideoPlaying, setPreviewVideoPlaying] = useState(false);
  const [previewVideoProgress, setPreviewVideoProgress] = useState(0);
  const [previewVideoDuration, setPreviewVideoDuration] = useState(0);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const isMounted = useRef(true);

  const stopStreamingAudio = () => {
    abortSignalRef.current.aborted = true;
    streamingPlayerRef.current?.stop();
    if (isMounted.current) {
      setStreamingAudioId(null);
      setStreamingStatus(null);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    return () => { 
      isMounted.current = false; 
      stopStreamingAudio();
    };
  }, []);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevThreadLength = useRef(activeThread.length);
  const isAtBottom = useRef(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const getSafeAgentName = () => config.name.toLowerCase().replace(/\s+/g, '_');

  const allMediaItems = useMemo(() => {
    return activeThread.flatMap(m => {
      const items: any[] = [];
      const agentName = getSafeAgentName();
      const d = new Date(m.timestamp);
      const dateStr = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}_${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}-${String(d.getSeconds()).padStart(2, '0')}`;
      if (m.image) {
        const papIndex = activeThread.filter((msg, i) => i <= activeThread.indexOf(m) && msg.image).length;
        items.push({ 
          type: 'image', 
          data: m.image, 
          name: 'PAP', 
          fileName: `pap_${agentName}_${dateStr}_${papIndex}.png`,
          id: m.id, 
          timestamp: m.timestamp 
        });
      }
      if (m.audio) {
        const vnIndex = activeThread.filter((msg, i) => i <= activeThread.indexOf(m) && msg.audio).length;
        const audioTitle = m.audioTitle || `VN ${vnIndex}`;
        items.push({ 
          type: 'audio', 
          data: m.audio, 
          name: `Suara ${config.name}`, 
          fileName: `${config.name} - ${audioTitle}.mp3`,
          id: m.id, 
          timestamp: m.timestamp 
        });
      }
      if (m.attachments) {
        m.attachments.forEach(att => {
          if (att.mimeType.startsWith('image/') || att.mimeType.startsWith('video/') || att.mimeType.startsWith('audio/')) {
            let type = 'doc';
            if (att.mimeType.startsWith('image/')) type = 'image';
            else if (att.mimeType.startsWith('video/')) type = 'video';
            else if (att.mimeType.startsWith('audio/')) type = 'audio';

            items.push({ 
              type, 
              data: att.data, 
              name: att.name, 
              fileName: att.name,
              id: m.id, 
              mimeType: att.mimeType,
              timestamp: m.timestamp
            });
          }
        });
      }
      return items;
    }).sort((a, b) => a.timestamp - b.timestamp);
  }, [activeThread, config.name]);

  const currentMediaIndex = useMemo(() => {
    if (!previewMedia) return -1;
    return allMediaItems.findIndex(item => item.data === previewMedia.data);
  }, [previewMedia, allMediaItems]);

  const handleNextMedia = () => {
    if (currentMediaIndex < allMediaItems.length - 1) {
      const next = allMediaItems[currentMediaIndex + 1];
      setPreviewMedia({ name: next.name, data: next.data, mimeType: next.type === 'image' ? 'image/png' : (next.mimeType || 'video/mp4') });
    }
  };

  const handlePrevMedia = () => {
    if (currentMediaIndex > 0) {
      const prev = allMediaItems[currentMediaIndex - 1];
      setPreviewMedia({ name: prev.name, data: prev.data, mimeType: prev.type === 'image' ? 'image/png' : (prev.mimeType || 'video/mp4') });
    }
  };

  useEffect(() => {
    if (previewMedia?.mimeType.startsWith('audio/')) {
      setPreviewAudioProgress(0);
      setPreviewAudioPlaying(true);
    } else {
      setPreviewAudioPlaying(false);
    }

    if (previewMedia?.mimeType.startsWith('video/')) {
      setPreviewVideoProgress(0);
      setPreviewVideoPlaying(true);
    } else {
      setPreviewVideoPlaying(false);
    }
  }, [previewMedia]);

  const togglePreviewAudio = () => {
    if (previewAudioRef.current) {
      if (previewAudioPlaying) previewAudioRef.current.pause();
      else previewAudioRef.current.play();
      setPreviewAudioPlaying(!previewAudioPlaying);
    }
  };

  const togglePreviewVideo = () => {
    if (previewVideoRef.current) {
      if (previewVideoPlaying) previewVideoRef.current.pause();
      else previewVideoRef.current.play();
      setPreviewVideoPlaying(!previewVideoPlaying);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (previewAudioRef.current) {
      const progress = (previewAudioRef.current.currentTime / previewAudioRef.current.duration) * 100;
      setPreviewAudioProgress(progress || 0);
    }
  };

  const handleVideoTimeUpdate = () => {
    if (previewVideoRef.current) {
      const progress = (previewVideoRef.current.currentTime / previewVideoRef.current.duration) * 100;
      setPreviewVideoProgress(progress || 0);
    }
  };

  const handleAudioLoadedMetadata = () => {
    if (previewAudioRef.current) {
      setPreviewAudioDuration(previewAudioRef.current.duration);
    }
  };

  const handleVideoLoadedMetadata = () => {
    if (previewVideoRef.current) {
      setPreviewVideoDuration(previewVideoRef.current.duration);
    }
  };

  const handleAudioSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (previewAudioRef.current) {
      const time = (parseFloat(e.target.value) / 100) * previewAudioRef.current.duration;
      previewAudioRef.current.currentTime = time;
      setPreviewAudioProgress(parseFloat(e.target.value));
    }
  };

  const handleVideoSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (previewVideoRef.current) {
      const time = (parseFloat(e.target.value) / 100) * previewVideoRef.current.duration;
      previewVideoRef.current.currentTime = time;
      setPreviewVideoProgress(parseFloat(e.target.value));
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!previewMedia) return;
      if (e.key === 'ArrowRight') handleNextMedia();
      if (e.key === 'ArrowLeft') handlePrevMedia();
      if (e.key === 'Escape') setPreviewMedia(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewMedia, currentMediaIndex, allMediaItems]);

  // Reset media zoom when opening or switching media
  useEffect(() => {
    handleResetMediaZoom();
  }, [previewMedia, currentMediaIndex]);

  const clampPanPosition = (x: number, y: number, scale: number) => {
    if (scale <= 1) return { x: 0, y: 0 };
    
    let containerWidth = window.innerWidth;
    let containerHeight = window.innerHeight * 0.7;
    let imgWidth = containerWidth;
    let imgHeight = containerHeight;

    if (mediaContainerRef.current) {
      const cRect = mediaContainerRef.current.getBoundingClientRect();
      containerWidth = cRect.width || containerWidth;
      containerHeight = cRect.height || containerHeight;
    }

    if (mediaImgRef.current) {
      const iRect = mediaImgRef.current.getBoundingClientRect();
      imgWidth = (iRect.width / scale) || containerWidth;
      imgHeight = (iRect.height / scale) || containerHeight;
    }

    const scaledW = imgWidth * scale;
    const scaledH = imgHeight * scale;

    const maxX = Math.max((scaledW - containerWidth) / 2, ((scale - 1) * imgWidth) / 2) + 60;
    const maxY = Math.max((scaledH - containerHeight) / 2, ((scale - 1) * imgHeight) / 2) + 60;

    return {
      x: Math.min(Math.max(x, -maxX), maxX),
      y: Math.min(Math.max(y, -maxY), maxY)
    };
  };

  const handleMediaZoomIn = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setMediaZoomScale(prev => Math.min(prev + 0.5, 5));
  };

  const handleMediaZoomOut = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setMediaZoomScale(prev => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setMediaZoomPos({ x: 0, y: 0 });
      return next;
    });
  };

  const handleMediaTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      mediaTouchDistRef.current = dist;
      mediaInitialScaleRef.current = mediaZoomScale;
    } else if (e.touches.length === 1 && mediaZoomScale > 1) {
      setIsMediaPanDragging(true);
      mediaDragStartRef.current = {
        x: e.touches[0].clientX - mediaZoomPos.x,
        y: e.touches[0].clientY - mediaZoomPos.y
      };
      setTouchStart(null);
      setDragOffset(0);
    } else if (e.touches.length === 1 && mediaZoomScale === 1) {
      onTouchStart(e);
    }
  };

  const handleMediaTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && mediaTouchDistRef.current !== null) {
      if (e.cancelable) e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / mediaTouchDistRef.current;
      const nextScale = Math.min(Math.max(mediaInitialScaleRef.current * factor, 1), 5);
      setMediaZoomScale(nextScale);
      if (nextScale === 1) setMediaZoomPos({ x: 0, y: 0 });
    } else if (e.touches.length === 1 && isMediaPanDragging && mediaZoomScale > 1) {
      if (e.cancelable) e.preventDefault();
      const newPos = clampPanPosition(
        e.touches[0].clientX - mediaDragStartRef.current.x,
        e.touches[0].clientY - mediaDragStartRef.current.y,
        mediaZoomScale
      );
      setMediaZoomPos(newPos);
      setDragOffset(0);
    } else if (e.touches.length === 1 && mediaZoomScale === 1) {
      onTouchMove(e);
    }
  };

  const handleMediaTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      mediaTouchDistRef.current = null;
    }
    if (e.touches.length === 0) {
      setIsMediaPanDragging(false);
      if (mediaZoomScale <= 1) {
        setMediaZoomPos({ x: 0, y: 0 });
        onTouchEnd();
      } else {
        setTouchStart(null);
        setDragOffset(0);
      }
    }
  };

  const handleMediaMouseDown = (e: React.MouseEvent) => {
    if (mediaZoomScale > 1) {
      e.preventDefault();
      setIsMediaPanDragging(true);
      mediaDragStartRef.current = {
        x: e.clientX - mediaZoomPos.x,
        y: e.clientY - mediaZoomPos.y
      };
    }
  };

  const handleMediaMouseMove = (e: React.MouseEvent) => {
    if (isMediaPanDragging && mediaZoomScale > 1) {
      e.preventDefault();
      const newPos = clampPanPosition(
        e.clientX - mediaDragStartRef.current.x,
        e.clientY - mediaDragStartRef.current.y,
        mediaZoomScale
      );
      setMediaZoomPos(newPos);
    }
  };

  const handleMediaMouseUp = () => {
    setIsMediaPanDragging(false);
  };

  const handleMediaWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.25 : -0.25;
    setMediaZoomScale(prev => {
      const next = Math.min(Math.max(prev + zoomFactor, 1), 5);
      if (next === 1) setMediaZoomPos({ x: 0, y: 0 });
      return next;
    });
  };

  const handleMediaDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (mediaZoomScale > 1) {
      handleResetMediaZoom();
    } else {
      setMediaZoomScale(2.5);
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (mediaZoomScale > 1) return; // Locked when zoomed
    setTouchStart(e.targetTouches[0].clientX);
    setDragOffset(0);
    setIsDraggingMedia(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (mediaZoomScale > 1) return; // Locked when zoomed
    if (touchStart === null) return;
    const currentX = e.targetTouches[0].clientX;
    setDragOffset(currentX - touchStart);
  };

  const onTouchEnd = () => {
    setIsDraggingMedia(false);
    if (mediaZoomScale > 1 || touchStart === null) {
      setTouchStart(null);
      setDragOffset(0);
      return; // Locked when zoomed
    }
    
    const threshold = window.innerWidth * 0.2; // 20% of screen width to trigger swipe
    if (dragOffset < -threshold) {
      handleNextMedia();
    } else if (dragOffset > threshold) {
      handlePrevMedia();
    }
    
    setTouchStart(null);
    setDragOffset(0);
  };

  const filteredThread = useMemo(() => {
    if (!searchQuery.trim()) return activeThread;
    return activeThread.filter(m => m.text.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [activeThread, searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMoreMenu]);

  // FIX: Mencegah efek "Lifting" / Bounce di batas scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      // Deteksi apakah user sedang di bawah (dengan toleransi 100px)
      const atBottom = el.scrollHeight - el.scrollTop - el.offsetHeight < 100;
      isAtBottom.current = atBottom;

      if (el.scrollTop <= 0) el.scrollTop = 1;
      else if (el.scrollTop + el.offsetHeight >= el.scrollHeight) el.scrollTop = el.scrollHeight - el.offsetHeight - 1;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (el.scrollTop <= 0) el.scrollTop = 1;
      if (el.scrollTop + el.offsetHeight >= el.scrollHeight) el.scrollTop = el.scrollHeight - el.offsetHeight - 1;
    };

    el.addEventListener('scroll', handleScroll);
    el.addEventListener('touchstart', handleTouchStart, { passive: true });

    return () => {
      el.removeEventListener('scroll', handleScroll);
      el.removeEventListener('touchstart', handleTouchStart);
    };
  }, [activeThread]);

  useEffect(() => {
    if (!scrollRef.current) return;
    
    const isNewMessage = activeThread.length > prevThreadLength.current;
    const lastMessage = activeThread[activeThread.length - 1];
    const isUserMessage = lastMessage?.role === 'user';
    
    // Logika Scroll Pintar:
    // 1. Selalu scroll jika user baru saja mengirim pesan (agar pesan user terlihat).
    // 2. Jika pesan baru dari agen atau agen sedang mengetik, hanya scroll jika user sudah berada di posisi paling bawah.
    // 3. Jika user sedang scroll di atas (membaca history), jangan paksa scroll ke bawah saat ada update (PAP/Audio/Typing).
    if ((isNewMessage && isUserMessage) || isAtBottom.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    
    prevThreadLength.current = activeThread.length;
  }, [activeThread, isTyping, loadingStatus, viewportHeight]);

  const handleDeleteWithAnimation = (id: string) => {
    setDeletingIds(prev => new Set(prev).add(id));
    setTimeout(() => {
      onDeleteMessage(id);
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 400); // Wait for fade-out animation
  };

  const dynamicTextColor = isBackgroundDark ? 'text-white' : 'text-black';
  const dynamicMutedTextColor = isBackgroundDark ? 'text-white/60' : 'text-black/60';
  const dynamicIconColor = isBackgroundDark ? 'text-white/40' : 'text-black/40';
  const dynamicBorderColor = isBackgroundDark ? 'border-white/10' : 'border-black/10';
  const dynamicThemeTextColor = isBackgroundDark ? 'text-indigo-300' : 'text-indigo-800'; // Will be overridden by inline styles where needed
  
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
  const themeIconClass = themeContrastColor === 'black' ? 'text-black/60' : 'text-white/60';

  const formatDateSeparator = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (msgDate.getTime() === today.getTime()) return 'Hari Ini';
    if (msgDate.getTime() === yesterday.getTime()) return 'Kemarin';
    
    // Check if it's within the last 7 days to show day name
    const diffDays = Math.floor((today.getTime() - msgDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) {
      return date.toLocaleDateString('id-ID', { weekday: 'long' });
    }

    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatMessageTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const handleBgContextMenu = (e: React.MouseEvent) => {
    const items = [
      { label: 'Cari Pesan', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>, onClick: () => setIsSearching(true) },
      { label: 'Reset Memori', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>, onClick: () => onResetMemory?.() },
      { label: 'Pengaturan Character', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>, onClick: () => onEdit() },
      { label: 'Galeri & Media', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>, onClick: () => setShowGallery(true) },
    ];
    onContextMenu?.(e, items);
  };

  const handleBgLongPress = (e: React.TouchEvent) => {
    const items = [
      { label: 'Cari Pesan', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>, onClick: () => setIsSearching(true) },
      { label: 'Reset Memori', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>, onClick: () => onResetMemory?.() },
      { label: 'Pengaturan Character', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>, onClick: () => onEdit() },
      { label: 'Galeri & Media', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>, onClick: () => setShowGallery(true) },
    ];
    onLongPress?.(e, items);
  };

  const handleUserBubbleMenu = (e: React.MouseEvent | React.TouchEvent, msg: ChatMessage) => {
    e.stopPropagation();
    
    // Jika mobile (touchstart) dan target adalah paragraf teks, biarkan browser menangani seleksi
    if (e.type === 'touchstart' && (e.target instanceof HTMLParagraphElement || (e.target as HTMLElement).closest('p'))) {
      return;
    }

    const items = [
      { label: 'Salin Text', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>, onClick: () => navigator.clipboard.writeText(msg.text) },
      { label: 'Edit', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>, onClick: () => { setEditingId(msg.id); setEditText(msg.text); setEditAttachments(msg.attachments ? [...msg.attachments] : []); } },
      { label: 'Perbarui Judul', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>, onClick: () => handleRegenerateTitle(msg) },
      { label: 'Hapus', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>, variant: 'danger' as const, onClick: () => handleDeleteWithAnimation(msg.id) },
    ];
    if ('clientX' in e) onContextMenu?.(e, items);
    else onLongPress?.(e, items);
  };

  const handleRegenerateTitle = async (msg: ChatMessage) => {
    setIsProcessingMetadata(true);
    setMetadataStatus("Memperbarui Judul...");
    try {
      setLoadingAudioId(msg.id); // Re-use loading state for visual feedback
      const textContent = (msg.text || '').trim() || (msg.attachments?.find(att => att.mimeType?.startsWith('audio/'))?.name || `Audio ${config.name}`);
      const newTitle = await generateSmartTitle(textContent, userProfile.geminiApiKey, activeThread);

      if (newTitle) {
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, audioTitle: newTitle } : m));
        const updatedMsg = { ...msg, audioTitle: newTitle };
        addMessageToAgent(config.id || 'default', updatedMsg, false);
        setMetadataStatus(`BERHASIL: Judul diperbarui menjadi "${newTitle}"`);
        await new Promise(r => setTimeout(r, 2200));
      } else {
        throw new Error("Model Gemini tidak mengembalikan judul.");
      }
    } catch (e: any) {
      console.error("Gagal memperbarui judul:", e);
      const rawErr = e?.message || (typeof e === 'string' ? e : '');
      let causeStr = "Terjadi gangguan jaringan atau masalah koneksi server.";

      if (!userProfile.geminiApiKey && !localStorage.getItem('lumina_gemini_api_key') && !process.env.GEMINI_API_KEY) {
        causeStr = "API Key Gemini belum diisi. Silakan isi API Key di Pengaturan.";
      } else if (rawErr.includes('429') || rawErr.toLowerCase().includes('quota') || rawErr.toLowerCase().includes('resource_exhausted')) {
        causeStr = "Kuota API Gemini telah habis atau mencapai rate limit (Error 429).";
      } else if (rawErr.toLowerCase().includes('api key') || rawErr.toLowerCase().includes('apikey') || rawErr.includes('403') || rawErr.includes('401')) {
        causeStr = "API Key Gemini tidak valid atau telah kedaluwarsa.";
      } else if (rawErr.toLowerCase().includes('safety') || rawErr.toLowerCase().includes('blocked')) {
        causeStr = "Teks pesan diblokir oleh filter keamanan AI.";
      } else if (rawErr) {
        causeStr = rawErr;
      }

      setMetadataStatus(`GAGAL: ${causeStr}`);
      await new Promise(r => setTimeout(r, 3500));
    } finally {
      setLoadingAudioId(null);
      setIsProcessingMetadata(false);
      setMetadataStatus("");
    }
  };

  const handleAgentBubbleMenu = (e: React.MouseEvent | React.TouchEvent, msg: ChatMessage) => {
    e.stopPropagation();
    
    // Jika mobile (touchstart) dan target adalah paragraf teks, biarkan browser menangani seleksi
    if (e.type === 'touchstart' && (e.target instanceof HTMLParagraphElement || (e.target as HTMLElement).closest('p'))) {
      return;
    }

    const items = [
      { label: 'Salin Text', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>, onClick: () => navigator.clipboard.writeText(msg.text) },
      { label: 'Edit', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>, onClick: () => { setEditingId(msg.id); setEditText(msg.text); setEditAttachments(msg.attachments ? [...msg.attachments] : []); } },
      { label: 'Perbarui Judul', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>, onClick: () => handleRegenerateTitle(msg) },
      { label: 'Coba lagi', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357-2H15" /></svg>, onClick: () => handleSend(undefined, true) },
      { label: 'Hapus', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>, variant: 'danger' as const, onClick: () => handleDeleteWithAnimation(msg.id) },
    ];
    if ('clientX' in e) onContextMenu?.(e, items);
    else onLongPress?.(e, items);
  };

  const handleCallBubbleMenu = (e: React.MouseEvent | React.TouchEvent, msg: ChatMessage) => {
    e.stopPropagation();
    const items = [
      { 
        label: 'Lihat Obrolan (Transkripsi)', 
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>, 
        onClick: () => { setTranscriptText(msg.callTranscript || msg.hiddenMemory || ''); setShowTranscript(true); } 
      },
      { 
        label: 'Hapus', 
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>, 
        variant: 'danger' as const, 
        onClick: () => handleDeleteWithAnimation(msg.id) 
      },
    ];
    if ('clientX' in e) onContextMenu?.(e, items);
    else onLongPress?.(e, items);
  };

  const handleProfilePicMenu = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const items = [
      { label: 'Download', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>, onClick: () => config.profilePic && downloadMedia(config.profilePic, `${getSafeAgentName()}_profile.png`, 'image/png') },
      { label: 'Ganti/Upload', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>, onClick: () => profileInputRef.current?.click() },
      { label: 'Reset Default', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357-2H15" /></svg>, onClick: () => updateAgentConfig(config.id!, { profilePic: defaultProfilePic }) },
    ];
    if ('clientX' in e) onContextMenu?.(e, items);
    else onLongPress?.(e, items);
  };

  const handleTouchMoveInternal = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    onGlobalTouchMove?.();
  };

  const handleTouchEndInternal = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    onGlobalTouchEnd?.();
  };
  const dynamicThemeHoverBgColor = `hover:bg-[${themeHex}]/20`;
  const dynamicThemeBorderColor = isBackgroundDark ? 'border-white/10' : 'border-black/5';
  const dynamicThemeHoverBorderColor = `hover:border-[${themeHex}]/40`;

  const glassStyles = {
    backgroundColor: isBackgroundDark ? `rgba(10, 15, 20, ${(appearance?.transparency ?? 0) / 100})` : `rgba(255, 255, 255, ${(appearance?.transparency ?? 0) / 100})`,
    backdropFilter: `blur(${appearance?.blur ?? 40}px)`,
    WebkitBackdropFilter: `blur(${appearance?.blur ?? 40}px)`,
    border: isBackgroundDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.1)'
  };

  const userGlassStyles = {
    backgroundColor: `rgb(var(--theme-color-rgb))`,
    border: isBackgroundDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.1)',
    color: themeContrastColor === 'black' ? '#000000' : '#ffffff'
  };

  const agentGlassStyles = {
    backgroundColor: isBackgroundDark ? `rgba(10, 15, 20, ${(appearance?.transparency ?? 0) / 100})` : `rgba(255, 255, 255, ${(appearance?.transparency ?? 0) / 100})`,
    backdropFilter: `blur(${appearance?.blur ?? 40}px)`,
    WebkitBackdropFilter: `blur(${appearance?.blur ?? 40}px)`,
    border: isBackgroundDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.1)',
    color: isBackgroundDark ? 'white' : 'black'
  };

  const downloadMedia = async (urlOrBase64: string, fileName: string, mimeType: string, msgId?: string) => {
    setIsProcessingMetadata(true);
    setMetadataStatus("Menyiapkan File...");
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

      const isDataUrl = urlOrBase64.startsWith('data:');
      let data = decodeBase64(urlOrBase64);
      let finalMime = isDataUrl ? urlOrBase64.split(':')[1].split(';')[0] : mimeType;

      // KHUSUS AUDIO: Konversi & Metadata
      if (finalMime.includes('audio') || finalMime.includes('pcm') || fileName.endsWith('.mp3')) {
        setMetadataStatus("Menyiapkan Metadata Audio...");
        try {
          const { addMetadataToMp3, convertPcmToMp3 } = await import('../services/audioMetadata');
          const msg = msgId 
            ? messages.find(m => m.id === msgId) 
            : activeThread.find(m => m.audio === urlOrBase64 || m.attachments?.some(att => att.data === urlOrBase64));
          
          // Deteksi apakah ini PCM (biasanya dari backup lama atau format mentah)
          // MP3 biasanya mulai dengan 0xFF 0xFB atau 'ID3'
          const isMp3 = data[0] === 0xFF && (data[1] & 0xE0) === 0xE0 || (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33);
          
          if (!isMp3 && (finalMime.includes('pcm') || data.length > 1000)) {
             setMetadataStatus("Konversi PCM ke MP3...");
             // Asumsi PCM 24000Hz (standar Gemini TTS kita)
             try {
               const pcmInt16 = new Int16Array(data.buffer);
               data = convertPcmToMp3(pcmInt16, 24000);
               finalMime = 'audio/mpeg';
               if (!fileName.endsWith('.mp3')) fileName += '.mp3';
             } catch (e) {
               console.warn("Gagal konversi PCM, mungkin bukan PCM murni:", e);
             }
          }

          if (msg) {
            const trackNumber = Math.max(1, activeThread.indexOf(msg) + 1);
            let audioTitle = msg.audioTitle;
            const textContent = (msg.text || '').trim() || (msg.attachments?.find(att => att.data === urlOrBase64)?.name || `Audio ${config.name}`);
            
            // Jika belum ada judul pintar (misal audio lama atau audio unggahan), generate sekarang
            if (!audioTitle) {
              try {
                setMetadataStatus("Generate Judul Pintar...");
                audioTitle = await generateSmartTitle(textContent, userProfile.geminiApiKey, activeThread);
                // Update state agar tersimpan permanen
                setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, audioTitle } : m));
                // Update fileName agar file yang didownload pakai judul baru
                fileName = `${audioTitle}.mp3`;
              } catch (e) {
                console.warn("Gagal generate smart title on-the-fly:", e);
                audioTitle = fileName.replace(/\.[^/.]+$/, '');
              }
            }
            
            setMetadataStatus("Menyisipkan Metadata ID3...");
            const mp3WithMetadata = await addMetadataToMp3(
              data,
              audioTitle,
              config.name,
              "Lumina AI Memories",
              config.profilePic || undefined,
              trackNumber.toString(),
              textContent
            );
            data = mp3WithMetadata;
            finalMime = 'audio/mpeg';
            if (!fileName.endsWith('.mp3')) fileName = `${fileName.replace(/\.[^/.]+$/, '')}.mp3`;
          }
        } catch (metaErr) {
          console.error("Failed to process audio during download:", metaErr);
        }
      }

      const blob = new Blob([data], { type: finalMime });
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
    } finally {
      setIsProcessingMetadata(false);
      setMetadataStatus("");
    }
  };

  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => updateAgentConfig(config.id || 'default', { profilePic: reader.result as string });
      reader.readAsDataURL(file);
    }
  };

  const handleProfileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingProfile(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => updateAgentConfig(config.id || 'default', { profilePic: reader.result as string });
      reader.readAsDataURL(file);
    }
  };

  async function decodeRawPcm(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = Math.floor(dataInt16.length / numChannels);
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
    return buffer;
  }

  const playAudio = async (audioBase64: string, msgId: string) => {
    try {
      if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
      const data = decodeBase64(audioBase64);
      let buf: AudioBuffer;
      if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46) {
        buf = await audioContextRef.current.decodeAudioData(data.buffer.slice(0));
      } else {
        buf = await decodeRawPcm(data, audioContextRef.current, 24000, 1);
      }
      setPlayingAudioId(msgId);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buf; 
      source.connect(audioContextRef.current.destination);
      source.onended = () => setPlayingAudioId(null);
      source.start();
    } catch (e) { 
      setPlayingAudioId(null);
    }
  };

  const handleListen = async (msg: ChatMessage) => {
    // Jika tombol ditekan saat sedang streaming/memutar pesan ini, hentikan (stop/pause)
    if (streamingAudioId === msg.id) {
      stopStreamingAudio();
      return;
    }

    // Jika ada audio lain yang sedang streaming atau diputar, hentikan dulu
    stopStreamingAudio();
    setPlayingAudioId(null);

    // Jika sudah ada audio utuh yang tersimpan, tidak perlu generate lagi
    if (msg.audio) return;

    const currentTtsModel = getActiveTtsModel(userProfile);
    const supportsStreaming = isTtsModelStreamSupported(currentTtsModel);

    // Jika model TIDAK mendukung streaming audio bertahap:
    // Gunakan mode fallback tradisional: tampilkan loading "Generating...", generate sampai tuntas, lalu simpan & putar.
    if (!supportsStreaming) {
      setLoadingAudioId(msg.id);
      onStartGeneration?.({
        id: `audio-${msg.id}`,
        agentId: config.id || 'default',
        agentName: config.name,
        agentPic: config.profilePic,
        type: 'audio',
        statusText: 'Lagi bikin Voice Note...',
        startedAt: Date.now()
      });
      try {
        const trackNumber = activeThread.findIndex(m => m.id === msg.id) + 1;
        const result = await getSpeech(msg.text, config, userProfile, trackNumber, activeThread);
        if (result && isMounted.current) {
          setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, audio: result.audio, audioTitle: result.title } : m));
        } else if (isMounted.current) {
          const errorMsg = await generateErrorMessage('general', config, userProfile);
          alert(errorMsg);
        }
      } catch (e: any) {
        const errStr = e.message?.toLowerCase() || String(e).toLowerCase();
        const isQuota = errStr.includes('429') || e.status === 429 || errStr.includes('quota');
        const errorMsg = await generateErrorMessage(isQuota ? 'quota_audio' : 'general', config, userProfile);
        alert(errorMsg);
      } finally {
        if (isMounted.current) {
          setLoadingAudioId(null);
        }
        onFinishGeneration?.(config.id || 'default', 'audio');
      }
      return;
    }

    // Jika model MENDUKUNG streaming audio bertahap:
    setStreamingAudioId(msg.id);
    setStreamingStatus('connecting');
    onStartGeneration?.({
      id: `audio-${msg.id}`,
      agentId: config.id || 'default',
      agentName: config.name,
      agentPic: config.profilePic,
      type: 'audio',
      statusText: 'Streaming Voice Note...',
      startedAt: Date.now()
    });
    abortSignalRef.current = { aborted: false };

    try {
      const player = new StreamingPcmPlayer({
        onPlaybackStart: () => {
          if (isMounted.current) setStreamingStatus('playing');
        },
        onPlaybackComplete: () => {
          if (isMounted.current) {
            setStreamingAudioId(null);
            setStreamingStatus(null);
          }
          onFinishGeneration?.(config.id || 'default', 'audio');
        }
      });
      streamingPlayerRef.current = player;
      await player.init();

      const trackNumber = activeThread.findIndex(m => m.id === msg.id) + 1;
      const result = await getSpeech(
        msg.text, 
        config, 
        userProfile, 
        trackNumber, 
        activeThread,
        {
          onStart: () => {
            if (isMounted.current) setStreamingStatus('playing');
          },
          onChunk: (pcmChunk: Int16Array) => {
            if (isMounted.current && !abortSignalRef.current.aborted) {
              setStreamingStatus('playing');
              player.playChunk(pcmChunk);
            }
          }
        },
        abortSignalRef.current
      );

      if (abortSignalRef.current.aborted) {
        onFinishGeneration?.(config.id || 'default', 'audio');
        return;
      }

      if (result) {
        player.markStreamFinished();
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, audio: result.audio, audioTitle: result.title } : m));
      } else {
        player.stop();
        if (isMounted.current) {
          setStreamingAudioId(null);
          setStreamingStatus(null);
        }
        onFinishGeneration?.(config.id || 'default', 'audio');
      }
    } catch (e: any) {
      onFinishGeneration?.(config.id || 'default', 'audio');
      if (abortSignalRef.current.aborted) return;
      const errStr = e.message?.toLowerCase() || String(e).toLowerCase();
      const isQuota = errStr.includes('429') || e.status === 429 || errStr.includes('quota');
      const errorMsg = await generateErrorMessage(isQuota ? 'quota_audio' : 'general', config, userProfile);
      alert(errorMsg);
      stopStreamingAudio();
    }
  };

  const handleRegenerateAudio = async (msg: ChatMessage) => {
    stopStreamingAudio();
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, audio: undefined, audioTitle: undefined } : m));
    handleListen({ ...msg, audio: undefined, audioTitle: undefined });
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedFiles(prev => [...prev, {
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          data: reader.result as string
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddEditFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditAttachments(prev => [...prev, {
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          data: reader.result as string
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveEditAttachment = (index: number) => {
    setEditAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async (customPrompt?: string, isRegen: boolean = false, isBranch: boolean = false, parentIdForBranch?: string | null, customFiles?: Attachment[]) => {
    const prompt = customPrompt !== undefined ? customPrompt : inputText;
    let fFiles = customFiles !== undefined ? [...customFiles] : [...attachedFiles];
    if (!isRegen && !prompt.trim() && fFiles.length === 0) return;

    let fPrompt = prompt;
    let currentParentId = isBranch ? parentIdForBranch : activeMessageId;
    let historyToUse = [...activeThread];
    const capturedAgentId = config.id || 'default';
    const capturedSessionId = activeThread.length > 0 ? activeThread[0].id : 'new_session';

    if (isRegen) {
      const lastMsg = activeThread[activeThread.length - 1];
      if (lastMsg && lastMsg.role === 'agent') {
        const userPromptMsg = messages.find(m => m.id === lastMsg.parentId);
        if (userPromptMsg) {
          fPrompt = userPromptMsg.text;
          fFiles = userPromptMsg.attachments || [];
          currentParentId = userPromptMsg.id;
          const promptIdx = activeThread.findIndex(m => m.id === userPromptMsg.id);
          historyToUse = activeThread.slice(0, promptIdx);
        }
      }
    } else if (isBranch) {
      if (parentIdForBranch === null) {
        historyToUse = [];
      } else {
        const parentIdx = activeThread.findIndex(m => m.id === parentIdForBranch);
        if (parentIdx !== -1) historyToUse = activeThread.slice(0, parentIdx + 1);
      }
    }

    let actualUserMsgId = currentParentId;
    if (!isRegen) {
      const userMsgId = Date.now().toString();
      const newUserMsg: ChatMessage = { 
        id: userMsgId, 
        role: 'user', 
        text: fPrompt, 
        attachments: fFiles.length > 0 ? fFiles : undefined,
        timestamp: Date.now(),
        parentId: currentParentId,
        agentId: capturedAgentId,
        sessionId: capturedSessionId
      };
      addMessageToAgent(capturedAgentId, newUserMsg);
      actualUserMsgId = userMsgId;
    }

    setInputText(''); 
    setAttachedFiles([]); 
    setEditingId(null); 
    if (chatTextareaRef.current) {
      chatTextareaRef.current.style.height = 'auto';
    }
    let loadingStatusText = "Lagi baca kiriman kamu...";
    let currentOutfitForMsg: string | undefined = undefined;
    let currentUserOutfitForMsg: string | undefined = undefined;
    let currentAccessoriesForMsg: string | undefined = undefined;

    if (isMounted.current) {
      setIsTyping(true); 
      setLoadingType('typing'); 
      setLoadingStatus(loadingStatusText); 
    }

    onStartGeneration?.({
      id: capturedAgentId,
      agentId: capturedAgentId,
      agentName: config.name,
      agentPic: config.profilePic,
      type: 'text',
      statusText: loadingStatusText,
      startedAt: Date.now()
    });
    
    try { 
      const rawFirstResponse = await generateAgentResponse(fPrompt || "Lanjut", config, historyToUse, fFiles, userProfile); 
      let papUrl: string | null = null; 
      let finalDisplayText = cleanResponseText(rawFirstResponse); 
      let capturedImagePrompt: string | undefined = undefined;
      let capturedInputs: { baseImage: string | null; extraRefImage: string | null; additionalImages: string[] } | undefined = undefined;
      if (rawFirstResponse.toUpperCase().includes('[CAPTION:')) { 
        if (isMounted.current) {
          setLoadingType('pap'); 
          setLoadingStatus("Lagi bikin PAP..."); 
        }
        onUpdateGeneration?.(capturedAgentId, 'Lagi bikin PAP...', 'pap');
        const captionMatch = rawFirstResponse.match(/\[CAPTION:(.*?)\]/i); 
        let originalCaption = captionMatch ? captionMatch[1].trim() : "foto gue yang lagi seksi"; 
        originalCaption = originalCaption.replace(/^(gue lagi|gue sedang|saya lagi|saya sedang)\s+/i, ""); 
        
        let pureGarmentOutfit = cleanRawCaptionToPureGarment(originalCaption);

        // Deteksi apakah user meminta undress pada prompt saat ini agar tidak salah menganggap memakai baju lama
        const isUserUndressReq = /\b(lepas|buka|copot|tanggalkan|tanpa|nggak\s+pake|gak\s+pake|ga\s+pake|tidak\s+pakai|gapake)\b.*\b(baju|pakaian|celana|rok|daster|dress|bh|bra|cd|daleman|busana|benang)\b|\b(telanjang|bugil|naked|nude|undress|undressed|strip|stripped|topless|bottomless)\b/i.test((fPrompt || '').toLowerCase());
        if (isUserUndressReq && (pureGarmentOutfit === 'her/his previous outfit' || !pureGarmentOutfit)) {
          const lowFPrompt = (fPrompt || '').toLowerCase();
          pureGarmentOutfit = lowFPrompt.includes('celana') || lowFPrompt.includes('rok')
            ? 'bottomless / bare skin lower body'
            : (lowFPrompt.includes('baju') || lowFPrompt.includes('bra') || lowFPrompt.includes('bh') || lowFPrompt.includes('kaos')
                ? 'topless / bare skin upper body'
                : 'completely undressed / bare skin');
        }
        currentOutfitForMsg = pureGarmentOutfit;

        // Siapkan history untuk generatePAP yang menyertakan prompt user turn ini
        const currentUserMsgForPap: ChatMessage = {
          id: actualUserMsgId || 'current-user-turn',
          role: 'user',
          text: fPrompt || '',
          attachments: fFiles.length > 0 ? fFiles : undefined,
          timestamp: Date.now(),
          parentId: currentParentId
        };
        const historyForPap = [...historyToUse, currentUserMsgForPap];

        try { 
          papUrl = await generatePAP(rawFirstResponse, config, userProfile, fFiles, historyForPap, (status, previewInfo) => {
            if (isMounted.current) {
              setLoadingStatus(status);
              if (previewInfo) {
                setPapSlotPreview(previewInfo);
                setAllPapSlots(prev => {
                  const filtered = prev.filter(p => p.slot !== previewInfo.slot);
                  return [...filtered, previewInfo].sort((a, b) => a.slot - b.slot);
                });
              }
            }
            onUpdateGeneration?.(capturedAgentId, status, 'pap');
          }, (prompt, inputs) => {
            capturedImagePrompt = prompt;
            if (inputs) {
              capturedInputs = inputs;
            }
          }); 
          
          // Ekstrak aksesoris dari caption untuk konsistensi
          const accessoryKeywords = ['jilbab', 'hijab', 'kacamata', 'jam tangan', 'kalung', 'anting', 'topi', 'bando', 'pita', 'masker', 'kerudung'];
          const foundAccessories = accessoryKeywords.filter(word => originalCaption.toLowerCase().includes(word));
          const accessoriesStr = foundAccessories.join(', ');
          
          currentAccessoriesForMsg = accessoriesStr || undefined;

          // Simpan outfit dan timestamp untuk konsistensi PAP berikutnya
          updateAgentConfig(capturedAgentId, {
            currentOutfit: pureGarmentOutfit,
            currentAccessories: accessoriesStr || undefined,
            lastPapTimestamp: Date.now()
          });

          // Ekstrak outfit user jika ada (untuk konsistensi user)
          const lowCaption = originalCaption.toLowerCase();
          const userMentioned = lowCaption.includes('lo ') || lowCaption.includes('kamu ') || lowCaption.includes('kita ');
          if (userMentioned && (lowCaption.includes('pake') || lowCaption.includes('pakai'))) {
            const userOutfitMatch = originalCaption.match(/(?:lo|kamu|kita)\s+(?:sedang\s+)?paka?i\s+([^,.]+?)(?:\s+dan|\s+sambil|$|[.,])/i);
            if (userOutfitMatch && userOutfitMatch[1]) {
              const detectedUserOutfit = userOutfitMatch[1].trim();
              currentUserOutfitForMsg = detectedUserOutfit;
              updateUserProfileForAgent(capturedAgentId, {
                ...userProfile,
                currentOutfit: detectedUserOutfit,
                lastPapTimestamp: Date.now()
              });
            }
          }

          if (papUrl) {
            if (isMounted.current) {
              setLoadingStatus("Lagi ngecek hasil foto...");
            }
            onUpdateGeneration?.(capturedAgentId, 'Lagi ngecek hasil foto...', 'pap');
            finalDisplayText = await reviseAgentResponseBasedOnImage(rawFirstResponse, papUrl, config, userProfile, historyForPap);
          }
        } catch (e: any) { 
          const errStr = e.message?.toLowerCase() || String(e).toLowerCase();
          const isQuota = errStr.includes('429') || e.status === 429 || errStr.includes('quota') || errStr.includes('kuota') || errStr.includes('zerogpu') || errStr.includes('limit'); 
          const isSafety = errStr.includes("image_safety_blocked") || errStr.includes("safety") || errStr.includes("policy") || errStr.includes("block"); 
          
          let errorMsg = "";
          if (isQuota) { 
            errorMsg = await generateErrorMessage('quota_image', config, userProfile);
          } else if (isSafety) { 
            errorMsg = await generateErrorMessage('safety_image', config, userProfile, originalCaption);
          } else { 
            errorMsg = await generateErrorMessage('general', config, userProfile);
          } 
          
          finalDisplayText = `${cleanResponseText(rawFirstResponse)}\n\n${errorMsg}`;
          papUrl = null; 
        } 
      }

      const agentMsgId = (Date.now() + 1).toString();
      const newAgentMsg: ChatMessage = { 
        id: agentMsgId, 
        role: 'agent', 
        text: finalDisplayText, 
        image: papUrl || undefined, 
        images: papUrl ? [papUrl] : undefined,
        activeImageIndex: papUrl ? 0 : undefined,
        imagePrompt: capturedImagePrompt || currentOutfitForMsg,
        generationInputs: capturedInputs && capturedImagePrompt ? {
          prompt: capturedImagePrompt,
          baseImage: capturedInputs.baseImage,
          extraRefImage: capturedInputs.extraRefImage,
          additionalImages: capturedInputs.additionalImages,
        } : undefined,
        outfit: currentOutfitForMsg,
        userOutfit: currentUserOutfitForMsg,
        accessories: currentAccessoriesForMsg,
        timestamp: Date.now(),
        parentId: actualUserMsgId,
        agentId: capturedAgentId,
        sessionId: capturedSessionId
      };
      
      addMessageToAgent(capturedAgentId, newAgentMsg);
      triggerNewMessageNotification(config.name, finalDisplayText, papUrl ? 'pap' : 'text', config.profilePic);
      if (isMounted.current) {
        setIsTyping(false); 
        setLoadingType(null);
      }
      onFinishGeneration?.(capturedAgentId, papUrl ? 'pap' : 'text');
    } catch (error: any) {
      if (isMounted.current) {
        setIsTyping(false);
        setLoadingType(null);
      }
      onFinishGeneration?.(capturedAgentId, 'text');
      const errStr = error.message?.toLowerCase() || String(error).toLowerCase();
      const isQuota = errStr.includes('429') || error.status === 429 || errStr.includes('quota');
      const isSafety = errStr.includes("response_safety_blocked") || errStr.includes("safety") || errStr.includes("policy") || errStr.includes("block");
      const isImageSafety = errStr.includes("image_safety_blocked");
      
      let errorText = "";
      let errorTypeVal: 'safety' | 'quota' | 'general' = 'general';
      if (isQuota) {
        setIsQuotaCooldown(true);
        setTimeout(() => {
          if (isMounted.current) setIsQuotaCooldown(false);
        }, 60000);
        errorText = await generateErrorMessage('quota_chat', config, userProfile);
        errorTypeVal = 'quota';
      } else if (isImageSafety) {
        errorText = await generateErrorMessage('safety_image', config, userProfile);
        errorTypeVal = 'safety';
      } else if (isSafety) {
        errorText = await generateErrorMessage('safety_text', config, userProfile);
        errorTypeVal = 'safety';
      } else {
        errorText = await generateErrorMessage('general', config, userProfile);
        errorTypeVal = 'general';
      }

      const errorMsgId = Date.now().toString();
      const errorAgentMsg: ChatMessage = {
        id: errorMsgId,
        role: 'agent',
        text: errorText,
        timestamp: Date.now(),
        parentId: actualUserMsgId,
        agentId: capturedAgentId,
        sessionId: capturedSessionId,
        isError: true,
        errorType: errorTypeVal
      };
      addMessageToAgent(capturedAgentId, errorAgentMsg);
    }
  };

  const handleEditSave = (msg: ChatMessage) => {
    if (!editText.trim() && editAttachments.length === 0) return;
    if (msg.role === 'user') {
      handleSend(editText, false, true, msg.parentId, editAttachments);
      setEditingId(null);
      setEditAttachments([]);
    } else {
      const newMsgId = Date.now().toString();
      const newMsg: ChatMessage = { 
        ...msg, 
        id: newMsgId, 
        text: editText, 
        attachments: editAttachments.length > 0 ? editAttachments : undefined,
        timestamp: Date.now(), 
        audio: undefined,
        agentId: config.id,
        sessionId: msg.sessionId
      };
      addMessageToAgent(config.id || 'default', newMsg);
      setEditingId(null);
      setEditAttachments([]);
    }
  };

  const toggleVoiceToText = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser lo nggak support Voice-to-Text sayang.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(prev => (prev + " " + transcript).trim());
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  const exportChat = () => {
    const text = activeThread.map(m => `${m.role.toUpperCase()} [${new Date(m.timestamp).toLocaleString()}]: ${m.text}`).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
    const agentName = config.name.toLowerCase().replace(/\s+/g, '_');
    link.download = `export_chat_${agentName}_${dateStr}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const AttachmentPreview: React.FC<{ attachment: Attachment, onRemove?: () => void, onPreview?: () => void }> = ({ attachment, onRemove, onPreview }) => {
    const isImg = attachment.mimeType.startsWith('image/');
    const isVideo = attachment.mimeType.startsWith('video/');
    const isAudio = attachment.mimeType.startsWith('audio/');
    const isPdf = attachment.mimeType === 'application/pdf';

    return (
      <div 
        onClick={onPreview}
        className={`relative group/att w-20 h-20 md:w-24 md:h-24 flex-shrink-0 ${isBackgroundDark ? 'bg-white/10' : 'bg-black/10'} rounded-2xl border ${dynamicBorderColor} overflow-hidden shadow-lg transition-all ${onPreview ? `cursor-pointer hover:scale-105 active:scale-95 ${dynamicThemeHoverBorderColor}` : ''}`}
      >
        {isImg ? (
          attachment.data ? <img src={attachment.data} className="w-full h-full object-cover" alt={attachment.name} /> : <div className="w-full h-full bg-black/20" />
        ) : isVideo ? (
          <div className="w-full h-full relative">
            {attachment.data && (
              <video 
                src={attachment.data} 
                className="w-full h-full object-cover" 
                preload="metadata"
                muted
                playsInline
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/att:bg-black/40 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white drop-shadow-[0_0_15px_rgba(168,85,247,0.8)] group-hover/att:scale-125 transition-transform" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
            </div>
            <span className="absolute bottom-1.5 text-[6px] font-black uppercase tracking-widest text-white/80 bg-black/40 px-1.5 py-0.5 rounded-full backdrop-blur-sm">Video</span>
          </div>
        ) : isAudio ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-blue-500/20 relative">
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/att:bg-black/40 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white drop-shadow-[0_0_15px_rgba(59,130,246,0.8)] group-hover/att:scale-125 transition-transform" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3V7.82l8-1.6V11.114A4.369 4.369 0 0015 11c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3V3z" />
                </svg>
            </div>
            <span className="absolute bottom-2 text-[7px] font-black uppercase tracking-widest text-white/60">Play Audio</span>
          </div>
        ) : isPdf ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-red-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
            <span className="text-[7px] font-black uppercase tracking-widest mt-1 text-white/40">PDF</span>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-white/5">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
             <span className="text-[7px] font-black uppercase tracking-widest mt-1 text-white/20 truncate px-1 w-full text-center">{attachment.name}</span>
          </div>
        )}
        {onRemove && (
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="absolute top-1 right-1 p-1 bg-black/60 backdrop-blur-md rounded-lg text-white opacity-0 group-hover/att:opacity-100 transition-all hover:bg-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>
    );
  };

    const BranchSwitcher: React.FC<{ message: ChatMessage }> = ({ message }) => {
      const siblings = useMemo(() => {
        const matching = messages.filter(m => m.parentId === message.parentId && m.role === message.role);
        const seen = new Set<string>();
        return matching.filter(m => {
          if (!m.id || seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
      }, [message.parentId, message.role, messages]);
      if (siblings.length <= 1) return null;
      const currentIndex = siblings.findIndex(s => s.id === message.id);
      const switchToBranch = (id: string) => {
        let deepest = id;
        let next = messages.find(m => m.parentId === deepest);
        while (next) { deepest = next.id; next = messages.find(m => m.parentId === deepest); }
        setActiveMessageId(deepest);
      };
      return (
        <div className={`flex items-center gap-2 mt-2 px-3 py-1 ${isBackgroundDark ? 'bg-white/5' : 'bg-black/5'} backdrop-blur-md rounded-full border ${dynamicBorderColor} w-fit animate-in fade-in zoom-in duration-300 ${message.role === 'user' ? '' : 'self-start'}`}>
          <button disabled={currentIndex === 0} onClick={() => switchToBranch(siblings[currentIndex - 1].id)} className={`p-1 ${isBackgroundDark ? 'hover:bg-white/10' : 'hover:bg-black/10'} rounded-full disabled:opacity-20 transition-all ${dynamicIconColor} hover:${dynamicTextColor}`}><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg></button>
          <span className={`text-[9px] font-black tracking-widest ${dynamicMutedTextColor}`}>{currentIndex + 1} / {siblings.length}</span>
          <button disabled={currentIndex === siblings.length - 1} onClick={() => switchToBranch(siblings[currentIndex + 1].id)} className={`p-1 ${isBackgroundDark ? 'hover:bg-white/10' : 'hover:bg-black/10'} rounded-full disabled:opacity-20 transition-all ${dynamicIconColor} hover:${dynamicTextColor}`}><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg></button>
          <div className={`w-px h-3 mx-0.5 ${isBackgroundDark ? 'bg-white/10' : 'bg-black/10'}`}></div>
          <button 
            onClick={(e) => { e.stopPropagation(); handleDeleteWithAnimation(message.id); }} 
            className={`p-1 ${isBackgroundDark ? 'hover:bg-red-500/20' : 'hover:bg-red-500/10'} rounded-full transition-all ${isBackgroundDark ? 'text-white/20' : 'text-black/20'} hover:text-red-500`}
            title="Hapus Cabang Ini"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      );
    };

  const MetadataOverlay: React.FC<{ status: string }> = ({ status }) => {
    const isSuccess = status.startsWith('BERHASIL');
    const isError = status.startsWith('GAGAL');
    const isFinished = isSuccess || isError;

    let displayMessage = status;
    if (isSuccess) displayMessage = status.replace(/^BERHASIL:\s*/, '');
    if (isError) displayMessage = status.replace(/^GAGAL:\s*/, '');

    return (
      <div className="fixed inset-0 z-[350] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className={`bg-zinc-900/95 border ${isSuccess ? 'border-emerald-500/50 shadow-emerald-500/10' : isError ? 'border-red-500/50 shadow-red-500/10' : 'border-white/10'} rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full text-center transition-all duration-300`}>
          <div className="relative w-14 h-14 flex items-center justify-center">
            {isSuccess ? (
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center shadow-lg animate-in zoom-in-50 duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            ) : isError ? (
              <div className="w-12 h-12 rounded-full bg-red-500/20 border-2 border-red-500 text-red-400 flex items-center justify-center shadow-lg animate-in zoom-in-50 duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            ) : (
              <>
                <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 animate-ping"></div>
                <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
              </>
            )}
          </div>
          <div className="flex flex-col items-center gap-1.5 w-full">
            <p className={`font-black text-xs uppercase tracking-[0.2em] ${isSuccess ? 'text-emerald-400' : isError ? 'text-red-400' : 'text-white'}`}>
              {isSuccess ? 'Judul Berhasil Diperbarui!' : isError ? 'Gagal Memperbarui Judul' : status}
            </p>
            <p className={`text-[11px] font-medium leading-relaxed px-2 ${isSuccess ? 'text-emerald-200/90 font-semibold' : isError ? 'text-red-200/90 font-semibold' : 'text-white/50'}`}>
              {isFinished ? displayMessage : 'Mohon tunggu sebentar ya sayang.. 💦'}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      className="relative h-full w-full flex flex-col overflow-hidden bg-transparent" 
      style={{ 
        overscrollBehavior: 'none',
        touchAction: 'none'
      }} 
      onDragOver={e => { e.preventDefault(); setIsDragging(true); }} 
      onDragLeave={() => setIsDragging(false)} 
      onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
    >
      
      <div 
        className="absolute top-0 left-0 w-full px-4 pt-4 z-20 pointer-events-none"
      >
        <div className="pointer-events-auto">
          {isSearching && (
            <div className="mb-2 animate-in slide-in-from-top-2 duration-300">
              <div className={`flex items-center gap-2 p-2 px-4 rounded-full border ${dynamicBorderColor}`} style={glassStyles}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${dynamicMutedTextColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input 
                  type="text" 
                  placeholder="Cari pesan..." 
                  className={`flex-1 bg-transparent outline-none text-xs font-bold ${dynamicTextColor} placeholder:${dynamicMutedTextColor}`}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  autoFocus
                />
                <button onClick={() => { setIsSearching(false); setSearchQuery(''); }} className={`p-1 hover:bg-white/10 rounded-full ${dynamicMutedTextColor} hover:${dynamicTextColor}`}><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
            </div>
          )}
          <header 
            className={`flex items-center justify-between p-1.5 px-4 md:p-2 md:px-6 rounded-full shadow-2xl transition-all duration-300`} 
            style={glassStyles}
          >
            <div className="flex items-center gap-0.5 md:gap-1 flex-1 min-w-0 mr-1 md:mr-2">
              <button onClick={onBackToList} className={`p-2 hover:bg-white/10 rounded-full transition-all ${dynamicIconColor} hover:${dynamicTextColor}`} title="Kembali ke Daftar">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <button onClick={onOpenSidebar} className={`p-2 hover:bg-white/10 rounded-full transition-all ${dynamicIconColor} hover:${dynamicTextColor}`} title="Menu">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              <div 
                className="relative group/avatar cursor-pointer ml-0.5 flex-shrink-0" 
                onClick={() => setShowProfilePreview(true)}
                onContextMenu={handleProfilePicMenu}
                onTouchStart={handleProfilePicMenu}
                onTouchMove={handleTouchMoveInternal}
                onTouchEnd={handleTouchEndInternal}
                title="Lihat Foto Profil"
              >
                <img src={config.profilePic || undefined} className={`w-10 h-10 md:w-12 md:h-12 rounded-full object-cover border ${isBackgroundDark ? 'border-white/20' : 'border-black/20'} shadow-md transition-transform group-hover/avatar:scale-105 active:scale-95`} alt="Avatar" />
                <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border border-black ${hasApiKey ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
              </div>
              
              <div 
                onClick={onEdit} 
                className="ml-1 flex-1 min-w-0 h-full flex flex-col justify-center select-none cursor-pointer py-1.5 px-2.5 rounded-2xl hover:bg-white/10 active:scale-[0.99] transition-all"
                title="Buka Pengaturan Karakter"
              >
                <div className="flex items-center gap-1.5 min-w-0 w-full">
                  <h2 className={`font-bold text-sm md:text-base leading-tight tracking-tight truncate ${dynamicTextColor}`}>{config.name}</h2>
                </div>
                {hasApiKey ? (
                  <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                    <span>ONLINE</span>
                  </p>
                ) : (
                  <p className="text-[10px] text-rose-500 font-black uppercase tracking-widest flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
                    <span>OFFLINE</span>
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex gap-1 md:gap-1.5 items-center">
              <div className="relative" ref={moreMenuRef}>
                <button 
                  onClick={() => setShowMoreMenu(!showMoreMenu)} 
                  className={`p-2.5 rounded-full transition-all ${showMoreMenu ? (isBackgroundDark ? 'bg-white/20 text-white' : 'bg-black/10 text-black') : `${dynamicIconColor} hover:${dynamicTextColor} hover:bg-white/5`}`}
                  title="Lainnya"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>

                {showMoreMenu && (
                  <div 
                    className={`absolute right-0 mt-2 w-52 border rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 origin-top-right z-[100] ${dynamicBorderColor} glass-menu`}
                    style={{ 
                      backgroundColor: isBackgroundDark ? 'rgba(15, 15, 15, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(40px)',
                      WebkitBackdropFilter: 'blur(40px)'
                    }}
                  >
                    <div className="p-1.5 flex flex-col gap-1">
                      <button 
                        onClick={() => { setIsSearching(true); setShowMoreMenu(false); }}
                        className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-3 ${isBackgroundDark ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-black/70 hover:bg-black/5 hover:text-black'}`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${isBackgroundDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        Cari Pesan
                      </button>
                      {onResetMemory && (
                        <button 
                          onClick={() => { onResetMemory(); setShowMoreMenu(false); }}
                          className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-3 ${isBackgroundDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-500/5'}`}
                        >
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${isBackgroundDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-500/5 border-red-500/10'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </div>
                          Reset Memori
                        </button>
                      )}
                      <button 
                        onClick={() => { onEdit(); setShowMoreMenu(false); }}
                        className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-3 ${isBackgroundDark ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-black/70 hover:bg-black/5 hover:text-black'}`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${isBackgroundDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        Pengaturan Character
                      </button>
                      <button 
                        onClick={() => { setShowGallery(true); setShowMoreMenu(false); }}
                        className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-3 ${isBackgroundDark ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-black/70 hover:bg-black/5 hover:text-black'}`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${isBackgroundDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2-2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        Galeri & Media
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <button 
                onClick={onCall} 
                className={`px-5 py-2.5 md:px-7 md:py-3 ${themeTextClass} hover:opacity-90 rounded-full font-black transition-all text-[10px] md:text-xs uppercase shadow-lg active:scale-95 border ${dynamicThemeBorderColor}`}
                style={{ backgroundColor: themeHex, borderColor: `${themeHex}40` }}
              >
                Call
              </button>
            </div>
          </header>
        </div>
      </div>

      <div 
        ref={scrollRef} 
        className="absolute inset-0 overflow-y-auto px-4 md:px-8 custom-scrollbar z-10"
        onContextMenu={(e) => handleBgContextMenu(e)}
        onTouchStart={(e) => handleBgLongPress(e)}
        onTouchMove={handleTouchMoveInternal}
        onTouchEnd={handleTouchEndInternal}
        style={{ 
          overscrollBehaviorY: 'contain',
          touchAction: 'pan-y', 
          WebkitOverflowScrolling: 'touch',
          paddingTop: isSearching ? '130px' : '70px',
          paddingBottom: attachedFiles.length > 0 ? '220px' : '140px'
        }} 
      >
        <div className="pt-0"></div>
        {filteredThread.map((m, idx) => {
          const prevMsg = idx > 0 ? filteredThread[idx - 1] : null;
          const showDateSeparator = !prevMsg || new Date(m.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString();
          const isDeleting = deletingIds.has(m.id);
          
          return (
            <React.Fragment key={m.id}>
              {showDateSeparator && (
                <div className="sticky top-2 z-20 flex justify-center my-6 pointer-events-none">
                  <div 
                    className={`px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg border ${dynamicBorderColor} pointer-events-auto`}
                    style={{
                      ...glassStyles,
                      backgroundColor: isBackgroundDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.8)',
                      color: isBackgroundDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)'
                    }}
                  >
                    {formatDateSeparator(m.timestamp)}
                  </div>
                </div>
              )}
              <div className={`flex flex-col mb-6 ${m.role === 'user' ? 'items-end' : 'items-start'} transition-all duration-500 ${isDeleting ? 'opacity-0 scale-95 translate-y-4' : 'animate-in slide-in-from-bottom-2 duration-300'}`}>
                {/* TAMPILAN KHUSUS UNTUK BUBBLE PANGGILAN */}
                {m.hiddenMemory ? (
                  <div 
                    className="flex flex-col items-center w-full my-4 animate-in fade-in zoom-in duration-500 cursor-pointer"
                    onContextMenu={(e) => handleCallBubbleMenu(e, m)}
                    onTouchStart={(e) => handleCallBubbleMenu(e, m)}
                    onTouchMove={handleTouchMoveInternal}
                    onTouchEnd={handleTouchEndInternal}
                  >
                    <div className={`flex items-center gap-3 px-6 py-2.5 rounded-full border ${dynamicBorderColor} shadow-xl group`} style={glassStyles}>
                       <div 
                        className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}
                        style={{ backgroundColor: themeHex, boxShadow: `0 4px 12px ${themeHex}40` }}
                       >
                          <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${themeTextClass}`} viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                          </svg>
                       </div>
                       <div className="flex flex-col">
                         <p className={`text-[10px] md:text-xs font-black ${dynamicMutedTextColor} tracking-[0.2em] uppercase`}>{m.text}</p>
                         <span className={`text-[8px] font-bold opacity-40 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>{formatMessageTime(m.timestamp)}</span>
                       </div>
                    </div>
                    <p className={`text-[8px] font-black ${isBackgroundDark ? 'text-white/30' : 'text-black/30'} uppercase mt-2 tracking-widest italic animate-pulse`}>Memori Panggilan Disimpan secara Internal</p>
                  </div>
                ) : (
              <div 
                id={`bubble-${m.id}`}
                className={`relative group/bubble max-w-[88%] md:max-w-[85%] p-4 md:p-5 shadow-2xl transition-all duration-300 outline-none ${m.role === 'user' ? 'rounded-[25px] rounded-tr-none' : 'rounded-[25px] rounded-tl-none'} ${(loadingAudioId === m.id || streamingAudioId === m.id) ? 'animate-pulse-neon' : ''}`} 
                style={m.role === 'user' ? userGlassStyles : agentGlassStyles}
                onContextMenu={(e) => m.role === 'user' ? handleUserBubbleMenu(e, m) : handleAgentBubbleMenu(e, m)}
                onTouchStart={(e) => m.role === 'user' ? handleUserBubbleMenu(e, m) : handleAgentBubbleMenu(e, m)}
                onTouchMove={handleTouchMoveInternal}
                onTouchEnd={handleTouchEndInternal}
              >
                <div className={`absolute ${m.role === 'user' ? '-left-10' : '-right-10'} top-2 flex flex-col gap-1 opacity-0 group-hover/bubble:opacity-100 transition-all`}>
                  <button onClick={() => { setEditingId(m.id); setEditText(m.text); setEditAttachments(m.attachments ? [...m.attachments] : []); }} className={`p-2 ${isBackgroundDark ? 'bg-white/5 hover:bg-white/20' : 'bg-black/5 hover:bg-black/10'} rounded-full ${isBackgroundDark ? 'text-white/20' : 'text-black/20'} hover:${m.role === 'user' ? dynamicTextColor : 'text-white'} transition-all`} title="Edit Pesan"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                  <button onClick={() => handleDeleteWithAnimation(m.id)} className={`p-2 ${isBackgroundDark ? 'bg-white/5' : 'bg-black/5'} hover:bg-red-500/80 rounded-full ${isBackgroundDark ? 'text-white/20' : 'text-black/20'} hover:text-white transition-all`} title="Hapus Pesan"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                </div>
                
                {m.image && (
                  <div className={`mb-4 overflow-hidden rounded-2xl border ${m.role === 'user' ? dynamicBorderColor : 'border-white/20'} relative group/img cursor-pointer`} onClick={() => setPreviewMedia({ name: 'PAP', mimeType: 'image/png', data: m.image!, id: m.id })}>
                    <img src={m.image} className="w-full max-h-80 object-cover" alt="PAP" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 group-hover/img:opacity-100 transition-all pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>

                    {/* Action buttons (Download & Info) */}
                    <div className="absolute top-3 right-3 flex flex-col gap-1.5 opacity-90 md:opacity-0 md:group-hover/img:opacity-100 transition-all z-10">
                      <button onClick={(e) => { 
                        e.stopPropagation(); 
                        const d = new Date(m.timestamp);
                        const dateStr = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}_${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}-${String(d.getSeconds()).padStart(2, '0')}`;
                        const papIndex = activeThread.filter((msg, i) => i <= activeThread.indexOf(m) && msg.image).length;
                        downloadMedia(m.image!, `pap_${getSafeAgentName()}_${dateStr}_${papIndex}.png`, 'image/png'); 
                      }} className={`p-2.5 bg-black/60 backdrop-blur-md rounded-xl text-white hover:scale-110 active:scale-95 transition-all border ${m.role === 'user' ? dynamicBorderColor : 'border-white/20'}`} title="Unduh Gambar"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg></button>

                      <button onClick={(e) => { 
                        e.stopPropagation(); 
                        setImageInfoData({
                          isOpen: true,
                          imageUrl: m.image!,
                          imagePrompt: m.imagePrompt || m.outfit,
                          caption: m.outfit,
                          outfit: m.outfit,
                          timestamp: m.timestamp,
                          agentName: config.name
                        });
                      }} className={`p-2.5 bg-black/60 backdrop-blur-md rounded-xl text-white hover:scale-110 active:scale-95 transition-all border ${m.role === 'user' ? dynamicBorderColor : 'border-white/20'}`} title="Informasi Gambar"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
                    </div>

                    {/* Mini Variation Navigation on Chat Bubble Image */}
                    {m.images && m.images.length > 1 && (
                      <div 
                        className="absolute bottom-3 left-3 z-10 flex items-center gap-1 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20 text-white text-[10px] font-black uppercase shadow-xl select-none"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const currentIdx = m.activeImageIndex ?? (m.images!.length - 1);
                            const prevIdx = currentIdx > 0 ? currentIdx - 1 : m.images!.length - 1;
                            handleSwitchVariationForMessage(m.id, prevIdx);
                          }}
                          className="w-4 h-4 rounded-full hover:bg-white/25 active:scale-90 flex items-center justify-center transition-all cursor-pointer font-bold"
                          title="Variasi sebelumnya"
                        >
                          ‹
                        </button>
                        <span className="text-[9px] tracking-wider px-1 text-white/90">
                          {(m.activeImageIndex ?? (m.images.length - 1)) + 1} / {m.images.length}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const currentIdx = m.activeImageIndex ?? (m.images!.length - 1);
                            const nextIdx = currentIdx < m.images!.length - 1 ? currentIdx + 1 : 0;
                            handleSwitchVariationForMessage(m.id, nextIdx);
                          }}
                          className="w-4 h-4 rounded-full hover:bg-white/25 active:scale-90 flex items-center justify-center transition-all cursor-pointer font-bold"
                          title="Variasi berikutnya"
                        >
                          ›
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const currentIdx = m.activeImageIndex ?? (m.images!.length - 1);
                            handleDeleteVariationForMessage(m.id, currentIdx);
                          }}
                          className="w-4 h-4 rounded-full hover:bg-red-500/80 text-white/60 hover:text-white flex items-center justify-center transition-all cursor-pointer ml-0.5"
                          title="Hapus variasi ini"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {editingId !== m.id && m.attachments && m.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {m.attachments.map((att, attIdx) => (
                      <div key={attIdx} className="relative group/chatatt">
                         <AttachmentPreview attachment={att} onPreview={() => setPreviewMedia(att)} />
                         <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover/chatatt:opacity-100 transition-all">
                            <button onClick={(e) => { e.stopPropagation(); downloadMedia(att.data, att.name, att.mimeType); }} className={`p-1.5 bg-black/60 backdrop-blur-md rounded-lg text-white border border-white/10 ${dynamicThemeHoverBgColor}`}>
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                            </button>
                         </div>
                      </div>
                    ))}
                  </div>
                )}

                {editingId === m.id ? (
                  <div className={`space-y-3 p-3.5 rounded-2xl ${m.role === 'user' ? (isBackgroundDark ? 'bg-black/40' : 'bg-white/40') : 'bg-white/10'} border ${m.role === 'user' ? dynamicBorderColor : 'border-white/20'}`}>
                    {/* DAFATAR LAMPIRAN YANG SEDANG DIEDIT */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {editAttachments.map((att, attIdx) => (
                        <div key={attIdx} className="relative group/editatt flex items-center gap-2 p-1.5 pr-2.5 rounded-xl bg-black/50 border border-white/20 shadow-md">
                          {att.mimeType.startsWith('image/') ? (
                            <img src={att.data} className="w-10 h-10 object-cover rounded-lg" alt={att.name} />
                          ) : att.mimeType.startsWith('video/') ? (
                            <div className="w-10 h-10 rounded-lg bg-indigo-900/60 flex items-center justify-center text-white text-xs font-black">
                              🎥
                            </div>
                          ) : att.mimeType.startsWith('audio/') ? (
                            <div className="w-10 h-10 rounded-lg bg-pink-900/60 flex items-center justify-center text-white text-xs font-black">
                              🎙️
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-white text-xs font-black">
                              📄
                            </div>
                          )}
                          <div className="flex flex-col min-w-0 max-w-[110px]">
                            <span className="text-[10px] font-bold text-white truncate">{att.name}</span>
                            <span className="text-[8px] font-black uppercase tracking-wider text-white/50">{att.mimeType.split('/')[1]?.toUpperCase() || 'FILE'}</span>
                          </div>
                          {/* Tombol (x) di bagian atas/pojok setiap lampiran */}
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleRemoveEditAttachment(attIdx); }} 
                            className="w-5 h-5 rounded-full bg-red-500/80 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-all active:scale-90 ml-1 cursor-pointer"
                            title="Hapus Lampiran"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      ))}

                      {/* Tombol (+) untuk menambah lampiran baru */}
                      <label className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 cursor-pointer transition-all active:scale-95 text-[10px] font-black uppercase tracking-wider shadow-md">
                        <input 
                          type="file" 
                          ref={editFileInputRef}
                          className="hidden" 
                          multiple 
                          accept="image/*,video/*,audio/*,.pdf,.txt" 
                          onChange={e => handleAddEditFiles(e.target.files)} 
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Tambah</span>
                      </label>
                    </div>

                    <textarea 
                      className={`w-full ${m.role === 'user' ? (isBackgroundDark ? 'bg-black/60 text-white' : 'bg-white/80 text-black') : 'bg-black/40 text-white'} border ${m.role === 'user' ? dynamicBorderColor : 'border-white/20'} rounded-xl p-4 outline-none text-sm font-bold resize-none min-h-[120px] custom-scrollbar shadow-inner`} 
                      value={editText} 
                      onChange={e => setEditText(e.target.value)} 
                      autoFocus 
                    />
                    <div className="flex gap-3 justify-end">
                      <button 
                        onClick={() => { setEditingId(null); setEditAttachments([]); }} 
                        className={`text-[10px] font-black uppercase px-5 py-2.5 rounded-xl transition-all active:scale-95 border shadow-xl ${isBackgroundDark ? 'bg-zinc-800 text-white border-white/10 hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-900 border-black/5 hover:bg-zinc-200'}`}
                      >
                        Batal
                      </button>
                      <button 
                        onClick={() => handleEditSave(m)} 
                        className={`text-[10px] font-black uppercase px-6 py-2.5 rounded-xl shadow-xl active:scale-95 transition-all ${isBackgroundDark ? 'bg-indigo-500 text-white hover:bg-indigo-600' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                      >
                        Cabangkan
                      </button>
                    </div>
                  </div>
                ) : ( 
                  <div className="flex flex-col gap-1">
                    {m.isError && m.errorType === 'safety' && (
                      <div className="flex items-center gap-1.5 mb-1 px-2.5 py-1.5 bg-red-500/20 text-red-500 border border-red-500/30 rounded-lg w-fit">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="text-[9px] font-bold uppercase tracking-wider">Diblokir Keamanan</span>
                      </div>
                    )}
                    {m.isError && m.errorType === 'quota' && (
                      <div className="flex items-center gap-1.5 mb-1 px-2.5 py-1.5 bg-orange-500/20 text-orange-500 border border-orange-500/30 rounded-lg w-fit">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="text-[9px] font-bold uppercase tracking-wider">Limit Kuota API</span>
                      </div>
                    )}
                    {m.isError && m.errorType === 'general' && (
                      <div className="flex items-center gap-1.5 mb-1 px-2.5 py-1.5 bg-zinc-500/20 text-zinc-500 border border-zinc-500/30 rounded-lg w-fit">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="text-[9px] font-bold uppercase tracking-wider">Error Sistem</span>
                      </div>
                    )}
                    <FormattedMessage
                      content={m.text}
                      role={m.role}
                      dynamicTextColor={dynamicTextColor}
                      themeTextClass={themeTextClass}
                      isBackgroundDark={isBackgroundDark}
                    />
                    <div className={`flex items-center justify-end gap-1.5 mt-1 opacity-40`}>
                      <span className={`text-[9px] font-bold ${m.role === 'user' ? themeTextClass : dynamicTextColor}`}>{formatMessageTime(m.timestamp)}</span>
                      {m.role === 'user' && (
                        <div className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 ${themeTextClass}`} viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 -ml-1.5 ${themeTextClass}`} viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {m.role === 'agent' && (
                  <div className="flex flex-col gap-2 mt-4 w-full">
                    <div className="flex gap-2 flex-wrap items-center">
                      {m.text.includes('Ganti API Key') && (
                        <button 
                          onClick={async () => {
                            if ((window as any).aistudio && (window as any).aistudio.openSelectKey) {
                              await (window as any).aistudio.openSelectKey();
                            } else {
                              alert("Fitur ganti API Key tidak tersedia di environment ini.");
                            }
                          }} 
                          className={`text-[10px] font-bold uppercase py-2.5 px-6 hover:opacity-90 text-white rounded-2xl transition-all shadow-xl flex items-center gap-2`}
                          style={{ backgroundColor: themeHex }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
                          </svg>
                          Ganti API Key
                        </button>
                      )}
                      {!m.audio && streamingAudioId !== m.id && (
                        <button 
                          onClick={() => handleListen(m)} 
                          disabled={(streamingAudioId !== null && streamingAudioId !== m.id) || loadingAudioId === m.id} 
                          className={`text-[10px] font-bold uppercase py-2.5 px-6 ${isBackgroundDark ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700'} hover:opacity-90 backdrop-blur-md border ${isBackgroundDark ? 'border-white/10' : 'border-black/5'} rounded-2xl transition-all flex items-center gap-2 disabled:opacity-50 shadow-xl shadow-black/10 active:scale-95`}
                        >
                          {loadingAudioId === m.id ? (
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: themeHex || '#6366f1' }}></div>
                              <span className="animate-pulse">Generating...</span>
                            </div>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                              </svg>
                              Listen
                            </>
                          )}
                        </button>
                      )}
                      {streamingAudioId === m.id && (
                        <div className={`flex items-center gap-2.5 py-1.5 px-3.5 rounded-2xl border ${isBackgroundDark ? 'bg-white/10 border-white/20' : 'bg-black/10 border-black/10'} backdrop-blur-md shadow-xl animate-in fade-in zoom-in-95 duration-200`}>
                          <button 
                            onClick={() => handleListen(m)} 
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-white transition-all active:scale-90 shadow-md hover:opacity-90 flex-shrink-0`}
                            style={{ backgroundColor: themeHex || '#6366f1' }}
                            title="Hentikan Suara"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 fill-current" viewBox="0 0 24 24">
                              <rect x="6" y="6" width="12" height="12" rx="2" />
                            </svg>
                          </button>
                          <div className="flex items-center gap-2 select-none">
                            <AudioVisualizer isBackgroundDark={isBackgroundDark} />
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${dynamicTextColor}`}>
                              {streamingStatus === 'connecting' ? 'Memulai suara...' : 'Sedang Bicara...'}
                            </span>
                          </div>
                        </div>
                      )}
                      {m.audio && streamingAudioId !== m.id && ( 
                        <>
                          <button onClick={() => {
                            const d = new Date(m.timestamp);
                            const dateStr = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}_${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}-${String(d.getSeconds()).padStart(2, '0')}`;
                            const vnIndex = activeThread.filter((msg, i) => i <= activeThread.indexOf(m) && msg.audio).length;
                            const audioTitle = m.audioTitle || `vn_${getSafeAgentName()}_${dateStr}_${vnIndex}`;
                            downloadMedia(m.audio!, `${audioTitle}.mp3`, 'audio/mpeg', m.id);
                          }} className={`p-2.5 ${isBackgroundDark ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200'} rounded-xl transition-all border ${dynamicBorderColor}`} title="Download Audio">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                          </button> 
                          <button 
                            onClick={() => handleRegenerateAudio(m)} 
                            className={`p-2.5 ${isBackgroundDark ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200'} rounded-xl transition-all border ${dynamicBorderColor} active:scale-90`}
                            title="Regenerate Audio"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357-2H15" /></svg>
                          </button>
                        </>
                      )}
                      {idx === activeThread.length - 1 && ( 
                        <button onClick={() => handleSend(undefined, true)} disabled={isTyping} className={`text-[10px] font-bold uppercase py-2.5 px-6 ${isBackgroundDark ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700'} hover:opacity-90 backdrop-blur-md border ${isBackgroundDark ? 'border-white/10' : 'border-black/5'} rounded-2xl transition-all flex items-center gap-2 disabled:opacity-50 shadow-xl shadow-black/10`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 ${isTyping ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357-2H15" /></svg>Coba Lagi
                        </button> 
                      )}
                    </div>
                    {m.audio && streamingAudioId !== m.id && (
                      <VoicePlayer 
                        audioBase64={m.audio} 
                        msgId={m.id} 
                        isBackgroundDark={isBackgroundDark}
                        dynamicBorderColor={dynamicBorderColor}
                        dynamicMutedTextColor={dynamicMutedTextColor}
                        onPlayStateChange={(playing) => {
                          if (playing) {
                            stopStreamingAudio();
                            setPlayingAudioId(m.id);
                          } else if (playingAudioId === m.id) {
                            setPlayingAudioId(null);
                          }
                        }} 
                      />
                    )}
                  </div>
                )}
              </div>
            )}
            <BranchSwitcher message={m} />
          </div>
        </React.Fragment>
      )})}
        {isTyping && ( 
          <div className="flex justify-start">
            <div className="rounded-[25px] rounded-tl-none p-4 flex flex-col gap-2 shadow-2xl min-w-[160px]" style={glassStyles}>
              {loadingType === 'pap' && (
                <div className="mb-3 overflow-hidden rounded-2xl border border-white/20 aspect-video bg-black/50 flex items-center justify-center relative shadow-2xl min-w-[220px]">
                  {/* Background Preview Gambar Slot dengan Opasitas 50% */}
                  {papSlotPreview?.url && (
                    <div className="absolute inset-0 overflow-hidden">
                      <img 
                        src={papSlotPreview.url} 
                        className="w-full h-full object-cover opacity-50 transition-all duration-700 scale-105 filter blur-[0.5px]" 
                        alt="Slot Preview" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/60" />
                    </div>
                  )}

                  <div 
                    className="absolute inset-0 animate-pulse pointer-events-none"
                    style={{ background: `radial-gradient(circle at center, ${themeHex}30 0%, transparent 75%)` }}
                  ></div>

                  {/* Badge Slot Info di Pojok Atas */}
                  {papSlotPreview && (
                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-20 pointer-events-none">
                      <span className="px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md text-[8px] font-black uppercase tracking-wider text-white border border-white/20 shadow-lg flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-300">
                        <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: themeHex }} />
                        {papSlotPreview.label}
                      </span>
                      {allPapSlots.length > 1 && (
                        <div className="flex gap-1 pointer-events-auto">
                          {allPapSlots.map(s => (
                            <button 
                              type="button"
                              key={s.slot} 
                              onClick={(e) => { e.stopPropagation(); setPapSlotPreview(s); }}
                              className={`px-2 py-0.5 rounded text-[7px] font-black uppercase transition-all cursor-pointer ${s.slot === papSlotPreview.slot ? 'bg-white text-black font-extrabold shadow scale-105 ring-1 ring-white/50' : 'bg-black/60 text-white/70 hover:bg-black/80 hover:text-white border border-white/10'}`}
                              title={s.label}
                            >
                              Img {s.slot}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Spinner & Tulisan Generating PAP di Tengah */}
                  <div className="flex flex-col items-center gap-2 z-10 p-4 text-center">
                    <div 
                      className="w-8 h-8 rounded-full border-[3.5px] animate-spin shadow-lg"
                      style={{ borderColor: `${themeHex}30`, borderTopColor: themeHex }}
                    ></div>
                    <span 
                      className="text-[9px] font-black uppercase tracking-widest drop-shadow-md text-white"
                    >
                      Generating PAP...
                    </span>
                    {papSlotPreview && (
                      <span className="text-[8px] font-bold text-white/90 line-clamp-1 max-w-[220px] drop-shadow mt-0.5 bg-black/40 px-2 py-0.5 rounded-full border border-white/10">
                        {loadingStatus}
                      </span>
                    )}
                  </div>
                </div>
              )}
              <div className="flex gap-3 items-center">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: themeHex }}></div>
                  <div className="w-2 h-2 rounded-full animate-bounce [animation-delay:0.2s]" style={{ backgroundColor: themeHex }}></div>
                  <div className="w-2 h-2 rounded-full animate-bounce [animation-delay:0.4s]" style={{ backgroundColor: themeHex }}></div>
                </div>
                <span className={`text-[10px] font-black italic ${dynamicTextColor}`}>{loadingStatus}</span>
              </div>
            </div>
          </div> 
        )}
        <div className="pb-4"></div> 
      </div>

      <div 
        className="absolute bottom-0 left-0 w-full flex flex-col gap-2 max-w-8xl mx-auto px-4 md:px-8 pb-6 z-20 pointer-events-none"
        style={{ touchAction: 'none' }}
      >
        <div className="pointer-events-auto w-full flex flex-col gap-2">
          {isQuotaCooldown && (
            <div className={`mx-auto px-4 py-2 rounded-full border border-amber-500/30 bg-amber-500/10 backdrop-blur-xl flex items-center gap-2 animate-in slide-in-from-bottom-2 duration-300 select-none`}>
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">
                Quota Exhausted (429) - Tunggu sebentar atau matikan 'Google Search' di profil ya sayang.. 💦
              </span>
            </div>
          )}
          {attachedFiles.length > 0 && (
            <div className={`flex gap-3 overflow-x-auto pb-2 custom-scrollbar p-3 ${isBackgroundDark ? 'bg-white/5' : 'bg-black/5'} backdrop-blur-3xl rounded-[25px] border ${dynamicBorderColor} animate-in slide-in-from-bottom-4 duration-300`}>
              {attachedFiles.map((file, i) => (
                <AttachmentPreview key={i} attachment={file} onRemove={() => removeAttachment(i)} />
              ))}
            </div>
          )}
          <footer className={`relative flex items-end gap-2 p-1.5 rounded-[28px] shadow-[0_15px_35px_rgba(0,0,0,0.4)] transition-all group`} style={glassStyles}>
            <label className="p-3 mb-0.5 hover:bg-white/10 rounded-full cursor-pointer transition-all active:scale-90 flex items-center justify-center shrink-0">
              <input type="file" className="hidden" multiple accept="image/*,video/*,audio/*,.pdf,.txt" onChange={e => handleFiles(e.target.files)} />
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${dynamicIconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </label>
            <button 
              onClick={toggleVoiceToText} 
              className={`p-3 mb-0.5 rounded-full transition-all active:scale-90 flex items-center justify-center shrink-0 ${isListening ? `text-white animate-pulse` : `hover:bg-white/10 ${dynamicIconColor}`}`}
              style={isListening ? { backgroundColor: themeHex } : {}}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            </button>
            <textarea 
              ref={chatTextareaRef}
              rows={1}
              placeholder={`Bisikin sesuatu ke ${config.name}...`} 
              className={`flex-1 bg-transparent outline-none py-2.5 text-sm font-semibold ${dynamicTextColor} placeholder:${dynamicMutedTextColor} resize-none max-h-32 min-h-[40px] overflow-y-auto custom-scrollbar leading-relaxed`} 
              value={inputText} 
              onChange={e => {
                setInputText(e.target.value);
                if (e.target) {
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 130)}px`;
                }
              }} 
              onKeyDown={e => handleTextareaKeyDown(e, () => handleSend())} 
              style={{ touchAction: 'auto' }}
            />
            <button 
              onClick={() => handleSend()} 
              disabled={(!inputText.trim() && attachedFiles.length === 0) || isTyping} 
              className={`w-11 h-11 md:w-12 md:h-12 flex-shrink-0 mb-0.5 ${themeTextClass} rounded-full transition-all active:scale-95 disabled:opacity-20 shadow-lg border ${dynamicThemeBorderColor} flex items-center justify-center mr-0.5`}
              style={{ backgroundColor: themeHex, borderColor: `${themeHex}40` }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.154.75.75 0 0 0 0-1.115A28.897 28.897 0 0 0 3.105 2.288Z" />
              </svg>
            </button>
          </footer>
        </div>
      </div>

      {isDragging && (
        <div className="absolute inset-0 z-[150] bg-black/60 backdrop-blur-2xl flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300 pointer-events-none p-6 md:p-12">
          <div 
            className={`w-full h-full rounded-[40px] md:rounded-[50px] border-4 border-dashed ${dynamicThemeBorderColor} flex flex-col items-center justify-center gap-6 shadow-[0_0_100px_rgba(var(--theme-color-rgb),0.2)]`}
            style={{ borderColor: `${themeHex}40`, backgroundColor: `${themeHex}05` }}
          >
            <div 
              className={`w-24 h-24 md:w-32 md:h-32 rounded-full flex items-center justify-center animate-bounce border-4 border-white/20`}
              style={{ 
                background: `linear-gradient(to bottom right, ${themeHex}, #9333ea, ${themeHex})`,
                boxShadow: `0 0 60px ${themeHex}CC`
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 md:h-16 md:w-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>
            </div>
            <div className="text-center space-y-2 px-6">
              <h3 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter drop-shadow-[0_5px_15px_rgba(0,0,0,0.5)]">Ahhh Sayang!!</h3>
              <p className="text-lg md:text-2xl font-bold italic leading-tight" style={{ color: themeHex }}>"Masukin filenya di sini dong... mmmh... 💦"</p>
            </div>
          </div>
        </div>
      )}

      {showProfilePreview && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-3xl animate-in fade-in duration-300" 
          onClick={() => setShowProfilePreview(false)}
          onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsDraggingProfile(true); }}
          onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setIsDraggingProfile(false); }}
          onDrop={handleProfileDrop}
        >
          <div 
            className={`relative max-w-lg w-full aspect-square animate-in zoom-in fade-in duration-500 delay-150 transition-all ${isDraggingProfile ? 'scale-105' : 'scale-100'}`} 
            onClick={e => e.stopPropagation()}
            onContextMenu={handleProfilePicMenu}
            onTouchStart={handleProfilePicMenu}
            onTouchMove={handleTouchMoveInternal}
            onTouchEnd={handleTouchEndInternal}
          >
            <div className={`absolute inset-0 rounded-[35px] md:rounded-[50px] transition-all duration-300 z-10 pointer-events-none ${isDraggingProfile ? 'bg-indigo-500/20 border-4 border-indigo-400 border-dashed shadow-[0_0_50px_rgba(99,102,241,0.4)]' : 'border-4 border-white/10'}`}>
              {isDraggingProfile && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white">
                  <div className="w-20 h-20 rounded-full bg-indigo-500 flex items-center justify-center animate-bounce shadow-2xl">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  </div>
                  <p className="font-black uppercase tracking-[0.3em] text-xs drop-shadow-lg">Lepaskan untuk Ganti Foto</p>
                </div>
              )}
            </div>
            <img src={config.profilePic || undefined} className={`w-full h-full object-cover rounded-[35px] md:rounded-[50px] shadow-2xl transition-all duration-300 ${isDraggingProfile ? 'blur-sm opacity-50' : 'opacity-100'}`} alt="Profile Full" />
            <div className="absolute top-6 right-6 flex flex-col gap-3 z-20">
              <button onClick={() => setShowProfilePreview(false)} className="bg-white/10 backdrop-blur-md text-white p-3 rounded-2xl shadow-2xl hover:bg-white hover:text-black hover:scale-110 active:scale-95 transition-all border border-white/20" title="Tutup">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <button onClick={() => {
                const now = new Date();
                const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
                downloadMedia(config.profilePic!, `${getSafeAgentName()}_profile_${dateStr}.png`, 'image/png');
              }} className={`backdrop-blur-md text-white p-3 rounded-2xl shadow-2xl hover:scale-110 active:scale-95 transition-all border border-white/30`} style={{ backgroundColor: `${themeHex}CC` }} title="Download">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
              </button>
              <button onClick={() => profileInputRef.current?.click()} className="bg-purple-600/80 backdrop-blur-md text-white p-3 rounded-2xl shadow-2xl hover:bg-purple-600 hover:scale-110 active:scale-95 transition-all border border-white/30" title="Ganti Foto">
                <input type="file" ref={profileInputRef} className="hidden" accept="image/*" onChange={handleProfilePicChange} />
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
              <button onClick={() => updateAgentConfig(config.id || 'default', { profilePic: defaultProfilePic })} className="bg-orange-500/80 backdrop-blur-md text-white p-3 rounded-2xl shadow-2xl hover:bg-orange-500 hover:scale-110 active:scale-95 transition-all border border-white/30" title="Reset ke Default">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357-2H15" /></svg>
              </button>
            </div>
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md px-8 py-3 rounded-full border border-white/20 shadow-2xl">
               <p className="text-white font-black uppercase text-[10px] tracking-[0.5em]">{config.name}</p>
            </div>
          </div>
        </div>
      )}

      {showGallery && (
        <div 
          className={`fixed inset-0 z-[250] flex items-center justify-center p-4 ${isBackgroundDark ? 'bg-black/80' : 'bg-white/80'} backdrop-blur-2xl animate-in fade-in duration-300`} 
          onClick={() => setShowGallery(false)}
          onContextMenu={(e) => handleBgContextMenu(e)}
          onTouchStart={(e) => handleBgLongPress(e)}
          onTouchMove={handleTouchMoveInternal}
          onTouchEnd={handleTouchEndInternal}
        >
          <div 
            className={`relative max-w-2xl w-full h-[80vh] flex flex-col rounded-[35px] border ${dynamicBorderColor} shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500`} 
            onClick={e => e.stopPropagation()}
            style={glassStyles}
          >
            {/* Header */}
            <div className={`p-6 border-b ${dynamicBorderColor} flex items-center justify-between`}>
              <div>
                <h3 className={`text-xl font-black uppercase tracking-tighter ${dynamicTextColor}`}>Media & Galeri</h3>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${dynamicMutedTextColor}`}>Koleksi kenangan bareng {config.name}</p>
              </div>
              <div className="flex items-center gap-2">
                {isSelectionMode && selectedItems.size > 0 && (
                  <button 
                    onClick={() => {
                      const allItems = activeThread.flatMap(m => {
                        const items: any[] = [];
                        const agentName = getSafeAgentName();
                        const d = new Date(m.timestamp);
                        const dateStr = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}_${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}-${String(d.getSeconds()).padStart(2, '0')}`;
                        
                        if (galleryTab === 'media') {
                          if (m.image) {
                            const papIndex = activeThread.filter((msg, i) => i <= activeThread.indexOf(m) && msg.image).length;
                            items.push({ type: 'image', data: m.image, name: 'PAP', id: m.id, fileName: `pap_${agentName}_${dateStr}_${papIndex}.png` });
                          }
                          if (m.attachments) m.attachments.forEach(att => { if (att.mimeType.startsWith('image/') || att.mimeType.startsWith('video/')) items.push({ type: att.mimeType.startsWith('image/') ? 'image' : 'video', data: att.data, name: att.name, id: m.id, mimeType: att.mimeType, fileName: att.name }); });
                        } else if (galleryTab === 'audio') {
                          if (m.audio) {
                            const vnIndex = activeThread.filter((msg, i) => i <= activeThread.indexOf(m) && msg.audio).length;
                            items.push({ type: 'audio', data: m.audio, name: `Suara ${config.name}`, id: m.id, date: m.timestamp, fileName: `vn_${agentName}_${dateStr}_${vnIndex}.mp3` });
                          }
                          if (m.attachments) m.attachments.forEach(att => { if (att.mimeType.startsWith('audio/')) items.push({ type: 'audio', data: att.data, name: att.name, id: m.id, date: m.timestamp, fileName: att.name }); });
                        } else if (galleryTab === 'docs') {
                          if (m.attachments) m.attachments.forEach(att => { if (!att.mimeType.startsWith('image/') && !att.mimeType.startsWith('video/') && !att.mimeType.startsWith('audio/')) items.push({ type: 'doc', data: att.data, name: att.name, id: m.id, date: m.timestamp, mimeType: att.mimeType, fileName: att.name }); });
                        }
                        return items;
                      });
                      downloadSelectedItems(allItems);
                    }} 
                    className={`p-2 ${isBackgroundDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-black/5 hover:bg-black/10 text-black'} rounded-full transition-all`}
                    title={`Download ${selectedItems.size} item`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  </button>
                )}
                <button onClick={toggleSelectionMode} className={`p-2 ${isSelectionMode ? (isBackgroundDark ? 'bg-white/20 text-white' : 'bg-black/10 text-black') : `hover:${isBackgroundDark ? 'bg-white/10' : 'bg-black/5'} ${dynamicIconColor} hover:${dynamicTextColor}`} rounded-full transition-all`} title={isSelectionMode ? "Batal Pilih" : "Pilih Item"}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </button>
                <button onClick={() => { setShowGallery(false); setIsSelectionMode(false); setSelectedItems(new Set()); }} className={`p-2 hover:${isBackgroundDark ? 'bg-white/10' : 'bg-black/5'} rounded-full transition-all ${dynamicIconColor} hover:${dynamicTextColor}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className={`flex p-2 gap-2 border-b ${dynamicBorderColor} ${isBackgroundDark ? 'bg-black/20' : 'bg-black/5'}`}>
              {(['media', 'audio', 'docs'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setGalleryTab(tab)}
                  className={`flex-1 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${galleryTab === tab ? `${isBackgroundDark ? 'bg-white/10' : 'bg-black/5'} ${dynamicTextColor} shadow-lg` : `${dynamicMutedTextColor} hover:${isBackgroundDark ? 'bg-white/5' : 'bg-black/5'}`}`}
                >
                  {tab === 'media' ? 'Foto & Video' : tab === 'audio' ? 'Suara' : 'Dokumen'}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {galleryTab === 'media' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {activeThread.flatMap(m => {
                    const items: any[] = [];
                    if (m.image) items.push({ type: 'image', data: m.image, name: 'PAP', id: m.id });
                    if (m.attachments) {
                      m.attachments.forEach(att => {
                        if (att.mimeType.startsWith('image/') || att.mimeType.startsWith('video/')) {
                          items.push({ type: att.mimeType.startsWith('image/') ? 'image' : 'video', data: att.data, name: att.name, id: m.id, mimeType: att.mimeType });
                        }
                      });
                    }
                    return items;
                  }).length === 0 ? (
                    <div className="col-span-full py-20 flex flex-col items-center gap-4 opacity-20 select-none pointer-events-none">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>
                      <p className="text-xs font-black uppercase tracking-widest">Belum ada foto/video sayang..</p>
                    </div>
                  ) : (
                    activeThread.flatMap(m => {
                      const items: any[] = [];
                      const agentName = getSafeAgentName();
                      const d = new Date(m.timestamp);
                      const dateStr = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}_${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}-${String(d.getSeconds()).padStart(2, '0')}`;
                      
                      if (m.image) {
                        const papIndex = activeThread.filter((msg, i) => i <= activeThread.indexOf(m) && msg.image).length;
                        items.push({ type: 'image', data: m.image, name: 'PAP', id: m.id, fileName: `pap_${agentName}_${dateStr}_${papIndex}.png` });
                      }
                      if (m.attachments) {
                        m.attachments.forEach(att => {
                          if (att.mimeType.startsWith('image/') || att.mimeType.startsWith('video/')) {
                            items.push({ type: att.mimeType.startsWith('image/') ? 'image' : 'video', data: att.data, name: att.name, id: m.id, mimeType: att.mimeType, fileName: att.name });
                          }
                        });
                      }
                      return items;
                    }).map((item, i) => {
                      const uniqueId = item.id + item.name;
                      const isSelected = selectedItems.has(uniqueId);
                      return (
                      <div 
                        key={i} 
                        className={`relative aspect-square rounded-2xl overflow-hidden border ${isSelected ? `border-4 border-[${themeHex}]` : dynamicBorderColor} group cursor-pointer shadow-lg hover:scale-105 transition-all`}
                        onClick={() => {
                          if (isSelectionMode) {
                            toggleItemSelection(uniqueId);
                          } else {
                            setPreviewMedia({ name: item.name, data: item.data, mimeType: item.type === 'image' ? 'image/png' : (item.mimeType || 'video/mp4'), id: item.id });
                          }
                        }}
                      >
                        {isSelectionMode && (
                          <div className="absolute top-2 left-2 z-20">
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? `bg-[${themeHex}] border-[${themeHex}]` : 'bg-black/50 border-white/50'}`}>
                              {isSelected && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                            </div>
                          </div>
                        )}
                        {item.type === 'image' ? (
                          item.data ? <img src={item.data} className={`w-full h-full object-cover ${isSelected ? 'scale-110 opacity-80' : ''}`} alt={item.name} /> : <div className="w-full h-full bg-black/20" />
                        ) : (
                          <div className="w-full h-full relative">
                            {item.data && (
                              <video 
                                src={item.data} 
                                className={`w-full h-full object-cover ${isSelected ? 'scale-110 opacity-80' : ''}`} 
                                preload="metadata"
                                muted
                                playsInline
                              />
                            )}
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                              <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-lg">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white ml-0.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                              </div>
                            </div>
                          </div>
                        )}
                        {!isSelectionMode && (
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </div>
                        )}
                      </div>
                      );
                    })
                  )}
                </div>
              )}

              {galleryTab === 'audio' && (
                <div className="flex flex-col gap-3">
                  {activeThread.flatMap(m => {
                    const items: any[] = [];
                    if (m.audio) items.push({ type: 'audio', data: m.audio, name: `Suara ${config.name}`, id: m.id, date: m.timestamp });
                    if (m.attachments) {
                      m.attachments.forEach(att => {
                        if (att.mimeType.startsWith('audio/')) {
                          items.push({ type: 'audio', data: att.data, name: att.name, id: m.id, date: m.timestamp });
                        }
                      });
                    }
                    return items;
                  }).length === 0 ? (
                    <div className="py-20 flex flex-col items-center gap-4 opacity-20">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                      <p className="text-xs font-black uppercase tracking-widest">Belum ada rekaman suara sayang..</p>
                    </div>
                  ) : (
                      activeThread.flatMap(m => {
                        const items: any[] = [];
                        const agentName = getSafeAgentName();
                        const d = new Date(m.timestamp);
                        const dateStr = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}_${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}-${String(d.getSeconds()).padStart(2, '0')}`;
                        if (m.audio) {
                          const vnIndex = activeThread.filter((msg, i) => i <= activeThread.indexOf(m) && msg.audio).length;
                          const audioTitle = m.audioTitle || `vn_${agentName}_${dateStr}_${vnIndex}`;
                          items.push({ type: 'audio', data: m.audio, name: `Suara ${config.name}`, id: m.id, date: m.timestamp, fileName: `${audioTitle}.mp3` });
                        }
                        if (m.attachments) {
                          m.attachments.forEach(att => {
                            if (att.mimeType.startsWith('audio/')) {
                              items.push({ type: 'audio', data: att.data, name: att.name, id: m.id, date: m.timestamp, fileName: att.name });
                            }
                          });
                        }
                        return items;
                      }).sort((a, b) => b.date - a.date).map((item, i) => {
                        const uniqueId = item.id + item.name;
                        const isSelected = selectedItems.has(uniqueId);
                        return (
                        <div 
                          key={i} 
                          className={`p-4 rounded-3xl border ${isSelected ? `border-[${themeHex}] bg-white/10` : `${dynamicBorderColor} bg-white/5`} flex items-center justify-between group hover:bg-white/10 transition-all ${isSelectionMode ? 'cursor-pointer' : ''}`}
                          onClick={() => {
                            if (isSelectionMode) toggleItemSelection(uniqueId);
                          }}
                        >
                          <div className="flex items-center gap-4">
                            {isSelectionMode && (
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? `bg-[${themeHex}] border-[${themeHex}]` : 'border-white/50'}`}>
                                {isSelected && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                              </div>
                            )}
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg`} style={{ backgroundColor: `${themeHex}20`, border: `1px solid ${themeHex}40` }}>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" style={{ color: themeHex }} viewBox="0 0 20 20" fill="currentColor"><path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3V7.82l8-1.6V11.114A4.369 4.369 0 0015 11c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3V3z" /></svg>
                            </div>
                            <div>
                              <p className={`text-xs font-black ${dynamicTextColor} truncate max-w-[150px]`}>{item.name}</p>
                              <p className={`text-[9px] font-bold ${dynamicMutedTextColor} uppercase tracking-widest mt-0.5`}>{new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                          </div>
                          {!isSelectionMode && (
                            <div className="flex gap-2">
                              <button 
                                onClick={(e) => { e.stopPropagation(); setPreviewMedia({ name: item.name, data: item.data, mimeType: 'audio/mpeg', id: item.id }); }}
                                className={`p-2.5 rounded-xl ${isBackgroundDark ? 'bg-white/10' : 'bg-black/10'} hover:scale-110 active:scale-95 transition-all`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); downloadMedia(item.data, item.fileName, 'audio/mpeg', item.id); }}
                                className={`p-2.5 rounded-xl ${isBackgroundDark ? 'bg-white/10' : 'bg-black/10'} hover:scale-110 active:scale-95 transition-all`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                              </button>
                            </div>
                          )}
                        </div>
                        );
                      })
                  )}
                </div>
              )}

              {galleryTab === 'docs' && (
                <div className="flex flex-col gap-3">
                  {activeThread.flatMap(m => {
                    const items: any[] = [];
                    if (m.attachments) {
                      m.attachments.forEach(att => {
                        if (!att.mimeType.startsWith('image/') && !att.mimeType.startsWith('video/') && !att.mimeType.startsWith('audio/')) {
                          items.push({ type: 'doc', data: att.data, name: att.name, id: m.id, date: m.timestamp, mimeType: att.mimeType });
                        }
                      });
                    }
                    return items;
                  }).length === 0 ? (
                    <div className="py-20 flex flex-col items-center gap-4 opacity-20">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a2 2 0 011.414.586l4 4a2 2 0 01.586 1.414V19a2 2 0 01-2 2z" /></svg>
                      <p className="text-xs font-black uppercase tracking-widest">Belum ada dokumen sayang..</p>
                    </div>
                  ) : (
                    activeThread.flatMap(m => {
                      const items: any[] = [];
                      if (m.attachments) {
                        m.attachments.forEach(att => {
                          if (!att.mimeType.startsWith('image/') && !att.mimeType.startsWith('video/') && !att.mimeType.startsWith('audio/')) {
                            items.push({ type: 'doc', data: att.data, name: att.name, id: m.id, date: m.timestamp, mimeType: att.mimeType, fileName: att.name });
                          }
                        });
                      }
                      return items;
                    }).sort((a, b) => b.date - a.date).map((item, i) => {
                        const uniqueId = item.id + item.name;
                        const isSelected = selectedItems.has(uniqueId);
                        return (
                        <div 
                          key={i} 
                          className={`p-4 rounded-3xl border ${isSelected ? `border-[${themeHex}] bg-white/10` : `${dynamicBorderColor} bg-white/5`} flex items-center justify-between group hover:bg-white/10 transition-all ${isSelectionMode ? 'cursor-pointer' : ''}`}
                          onClick={() => {
                            if (isSelectionMode) toggleItemSelection(uniqueId);
                          }}
                        >
                          <div className="flex items-center gap-4">
                            {isSelectionMode && (
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? `bg-[${themeHex}] border-[${themeHex}]` : 'border-white/50'}`}>
                                {isSelected && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                              </div>
                            )}
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-zinc-500/10 border border-zinc-500/20`}>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                            </div>
                            <div className="min-w-0">
                              <p className={`text-xs font-black ${dynamicTextColor} truncate max-w-[150px]`}>{item.name}</p>
                              <p className={`text-[9px] font-bold ${dynamicMutedTextColor} uppercase tracking-widest mt-0.5`}>{item.mimeType.split('/')[1].toUpperCase()} • {new Date(item.date).toLocaleDateString('id-ID')}</p>
                            </div>
                          </div>
                          {!isSelectionMode && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); downloadMedia(item.data, item.fileName, item.mimeType); }}
                              className={`p-2.5 rounded-xl ${isBackgroundDark ? 'bg-white/10' : 'bg-black/10'} hover:scale-110 active:scale-95 transition-all`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                            </button>
                          )}
                        </div>
                        );
                      })
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={`p-4 bg-black/20 border-t ${dynamicBorderColor} text-center`}>
              <p className={`text-[8px] font-black uppercase tracking-[0.3em] ${dynamicMutedTextColor}`}>Total {activeThread.length} Pesan Dianalisis</p>
            </div>
          </div>
        </div>
      )}

      {previewMedia && (
        <div 
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/95 backdrop-blur-3xl animate-in fade-in duration-300 select-none" 
          onClick={() => setPreviewMedia(null)}
          onContextMenu={(e) => handleBgContextMenu(e)}
          onTouchStart={(e) => {
            onTouchStart(e);
            handleBgLongPress(e);
          }}
          onTouchMove={(e) => {
            onTouchMove(e);
            handleTouchEndInternal();
          }}
          onTouchEnd={(e) => {
            onTouchEnd();
            handleTouchEndInternal();
          }}
        >
          <div className="relative max-w-4xl w-full flex flex-col items-center gap-4 animate-in zoom-in duration-500" onClick={e => e.stopPropagation()}>
            <div className="w-full flex justify-between items-center bg-white/5 backdrop-blur-xl px-5 py-3 rounded-[20px] border border-white/10 shadow-2xl">
              <div className="flex flex-col">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60 truncate max-w-[200px]">{previewMedia.name}</p>
                {currentMediaIndex !== -1 && (
                  <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest mt-0.5">{currentMediaIndex + 1} dari {allMediaItems.length}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                 {allMediaItems[currentMediaIndex]?.type === 'image' && (
                   <button 
                    onClick={() => {
                      const currentItem = allMediaItems[currentMediaIndex];
                      const sourceMsg = activeThread.find(m => m.id === currentItem?.id);
                      setImageInfoData({
                        isOpen: true,
                        imageUrl: currentItem?.data || previewMedia.data,
                        imagePrompt: sourceMsg?.imagePrompt || sourceMsg?.outfit,
                        caption: sourceMsg?.outfit,
                        timestamp: sourceMsg?.timestamp,
                        agentName: config.name
                      });
                    }} 
                    className={`p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all active:scale-90 border border-white/10 group`}
                    title="Informasi Gambar"
                   >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                   </button>
                 )}
                 <button 
                  onClick={() => {
                    const currentItem = allMediaItems[currentMediaIndex];
                    const downloadName = currentItem?.fileName || previewMedia.name;
                    downloadMedia(previewMedia.data, downloadName, previewMedia.mimeType, previewMedia.id);
                  }} 
                  className={`p-2.5 bg-white/10 rounded-xl text-white transition-all active:scale-90 border border-white/10 group`} 
                  style={{ backgroundColor: `${themeHex}20` }}
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                 </button>
                 <button onClick={() => setPreviewMedia(null)} className="p-2.5 bg-white/10 hover:bg-red-500 rounded-xl text-white transition-all active:scale-90 border border-white/10 group">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                 </button>
              </div>
            </div>

            <div className="relative w-full rounded-[30px] overflow-hidden border border-white/10 shadow-2xl bg-black/40 flex items-center group/viewer">
               {/* 3. Text Info Progress - Melayang di tengah atas dengan opacity 50% */}
               {isRegeneratingVariation && (
                 <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-amber-500/40 text-amber-300 text-xs font-black shadow-2xl flex items-center gap-2 animate-pulse select-none">
                   <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                   <span>{regeneratingStatus || 'Memproses Variasi...'}</span>
                 </div>
               )}

               {/* 1. Navigasi Variasi PAP - Melayang di kiri bawah */}
               {(() => {
                 const currentItem = allMediaItems[currentMediaIndex];
                 const sourceMsg = activeThread.find(m => m.id === currentItem?.id || m.id === previewMedia.id);
                 if (currentItem?.type === 'image' && sourceMsg?.images && sourceMsg.images.length > 1) {
                   const currentVarIdx = sourceMsg.images.indexOf(previewMedia.data) !== -1 
                     ? sourceMsg.images.indexOf(previewMedia.data) 
                     : (sourceMsg.activeImageIndex ?? (sourceMsg.images.length - 1));
                   return (
                     <div className="absolute bottom-4 left-4 z-30 flex items-center gap-2 bg-black/75 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20 shadow-2xl select-none">
                       <button
                         type="button"
                         onClick={(e) => {
                           e.stopPropagation();
                           const prevIdx = currentVarIdx > 0 ? currentVarIdx - 1 : sourceMsg.images!.length - 1;
                           handleSwitchVariationForMessage(sourceMsg.id, prevIdx);
                         }}
                         className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/25 active:scale-90 text-white flex items-center justify-center text-sm font-black transition-all cursor-pointer"
                         title="Variasi sebelumnya"
                       >
                         ‹
                       </button>
                       <span className="text-[10px] font-black text-white px-2 py-0.5 rounded-full bg-white/10 border border-white/10 tracking-wider">
                         Variasi {currentVarIdx + 1} / {sourceMsg.images.length}
                       </span>
                       <button
                         type="button"
                         onClick={(e) => {
                           e.stopPropagation();
                           const nextIdx = currentVarIdx < sourceMsg.images!.length - 1 ? currentVarIdx + 1 : 0;
                           handleSwitchVariationForMessage(sourceMsg.id, nextIdx);
                         }}
                         className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/25 active:scale-90 text-white flex items-center justify-center text-sm font-black transition-all cursor-pointer"
                         title="Variasi berikutnya"
                       >
                         ›
                       </button>
                       <button
                         type="button"
                         onClick={(e) => {
                           e.stopPropagation();
                           handleDeleteVariationForMessage(sourceMsg.id, currentVarIdx);
                         }}
                         className="w-6 h-6 rounded-full bg-white/10 hover:bg-red-500/80 text-white/50 hover:text-white flex items-center justify-center transition-all active:scale-90 cursor-pointer ml-1"
                         title="Hapus variasi gambar ini"
                       >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                         </svg>
                       </button>
                     </div>
                   );
                 }
                 return null;
               })()}

               {/* 2. Tombol Regenerate Variasi PAP - Melayang di kanan bawah */}
               {allMediaItems[currentMediaIndex]?.type === 'image' && (
                 <button 
                   type="button"
                   onClick={(e) => { e.stopPropagation(); handleRegenerateVariation(); }}
                   disabled={isRegeneratingVariation}
                   className={`absolute bottom-4 right-4 z-30 w-11 h-11 rounded-full text-white transition-all active:scale-90 border border-white/20 shadow-2xl flex items-center justify-center cursor-pointer group backdrop-blur-md ${
                     isRegeneratingVariation ? 'bg-amber-500/40 border-amber-500/60 text-amber-300 cursor-not-allowed' : 'bg-black/75 hover:bg-black/90'
                   }`}
                   title="Regenerate Variasi Gambar Baru (Data & Prompt Sama)"
                 >
                   {isRegeneratingVariation ? (
                     <svg className="animate-spin h-5 w-5 text-amber-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                       <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                       <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                     </svg>
                   ) : (
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:rotate-180 transition-transform duration-500 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357-2H15" />
                     </svg>
                   )}
                 </button>
               )}

               {/* Navigation Arrows (Desktop) */}
               {currentMediaIndex > 0 && (
                 <button 
                  onClick={(e) => { e.stopPropagation(); handlePrevMedia(); }}
                  className="absolute left-4 z-20 p-4 bg-black/40 backdrop-blur-md rounded-full text-white opacity-0 group-hover/viewer:opacity-100 transition-all hover:bg-white/20 hidden md:block"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                 </button>
               )}
               
               {currentMediaIndex < allMediaItems.length - 1 && (
                 <button 
                  onClick={(e) => { e.stopPropagation(); handleNextMedia(); }}
                  className="absolute right-4 z-10 p-4 bg-black/40 backdrop-blur-md rounded-full text-white opacity-0 group-hover/viewer:opacity-100 transition-all hover:bg-white/20 hidden md:block"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                 </button>
               )}

               <div 
                className={`flex w-full transition-transform duration-300 ease-out`}
                style={{ 
                  transform: `translateX(calc(-${currentMediaIndex * 100}% + ${dragOffset}px))`,
                  transitionProperty: isDraggingMedia ? 'none' : 'transform'
                }}
               >
                 {allMediaItems.map((item, i) => (
                   <div key={i} className="w-full flex-shrink-0 flex items-center justify-center min-h-[40vh]">
                     {item.type === 'image' ? (
                       <div 
                         ref={i === currentMediaIndex ? mediaContainerRef : null}
                         className={`relative w-full h-[70vh] flex items-center justify-center overflow-hidden touch-none select-none group ${
                           mediaZoomScale > 1 ? (isMediaPanDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-pointer'
                         }`}
                         onTouchStart={handleMediaTouchStart}
                         onTouchMove={handleMediaTouchMove}
                         onTouchEnd={handleMediaTouchEnd}
                         onMouseDown={handleMediaMouseDown}
                         onMouseMove={handleMediaMouseMove}
                         onMouseUp={handleMediaMouseUp}
                         onMouseLeave={handleMediaMouseUp}
                         onWheel={handleMediaWheel}
                         onDoubleClick={handleMediaDoubleClick}
                       >
                         {/* Ambient Light Glow Background (YouTube-style Ambient Mode) */}
                         {item.data && (
                           <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
                             <img 
                               src={item.data} 
                               alt="" 
                               className="w-full h-full object-cover blur-2xl md:blur-3xl opacity-50 scale-125 saturate-150 transition-all duration-500"
                               aria-hidden="true"
                             />
                             <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
                           </div>
                         )}

                         <img 
                           ref={i === currentMediaIndex ? mediaImgRef : null}
                           src={item.data} 
                           className="relative z-10 w-full h-auto max-h-[70vh] object-contain pointer-events-none select-none transition-transform drop-shadow-2xl" 
                           style={{
                             transform: `translate(${mediaZoomPos.x}px, ${mediaZoomPos.y}px) scale(${mediaZoomScale})`,
                             transformOrigin: 'center center',
                             transition: isMediaPanDragging ? 'none' : 'transform 0.15s ease-out'
                           }}
                           alt={item.name} 
                         />

                         {/* Floating Zoom & Pan Controls */}
                         <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 bg-black/75 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-white/20 shadow-2xl">
                           <span className="text-[10px] font-black text-white px-2 py-0.5 rounded-full bg-white/10 font-mono">
                             {Math.round(mediaZoomScale * 100)}%
                           </span>
                           <button
                             type="button"
                             onClick={handleMediaZoomOut}
                             className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center text-sm font-black transition-all cursor-pointer"
                             title="Zoom Out (-)"
                           >
                             −
                           </button>
                           <button
                             type="button"
                             onClick={handleMediaZoomIn}
                             className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center text-sm font-black transition-all cursor-pointer"
                             title="Zoom In (+)"
                           >
                             +
                           </button>
                           {(mediaZoomScale !== 1 || mediaZoomPos.x !== 0 || mediaZoomPos.y !== 0) && (
                             <button
                               type="button"
                               onClick={handleResetMediaZoom}
                               className="px-2.5 py-1 rounded-full bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer shadow-md"
                               title="Reset Zoom & Posisi"
                             >
                               ↺ Reset
                             </button>
                           )}
                         </div>
                       </div>
                     ) : item.type === 'video' ? (
                       <div className="w-full h-[70vh] flex flex-col items-center justify-center relative overflow-hidden" key={item.data}>
                          {/* Ambient Light Mode Background */}
                          <div className="absolute inset-0 z-0">
                            {item.data && (
                              <video 
                                src={item.data} 
                                className="w-full h-full object-cover blur-[100px] opacity-40 scale-125"
                                muted
                                loop
                                playsInline
                                ref={(el) => {
                                  if (el && previewVideoRef.current) {
                                    el.currentTime = previewVideoRef.current.currentTime;
                                    if (previewVideoPlaying) el.play().catch(() => {});
                                    else el.pause();
                                  }
                                }}
                              />
                            )}
                            <div className="absolute inset-0 bg-black/40"></div>
                          </div>

                          {/* Main Video */}
                          {item.data && (
                            <video 
                              ref={previewVideoRef}
                              src={item.data} 
                              className="relative z-10 w-full h-auto max-h-[70vh] object-contain shadow-2xl"
                              autoPlay
                              playsInline
                              onTimeUpdate={handleVideoTimeUpdate}
                              onLoadedMetadata={handleVideoLoadedMetadata}
                              onEnded={() => setPreviewVideoPlaying(false)}
                              onClick={(e) => { e.stopPropagation(); togglePreviewVideo(); }}
                            />
                          )}

                          {/* Floating Playback Controls */}
                          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[30px] p-4 flex flex-col gap-3 shadow-2xl z-20">
                            <div className="flex items-center gap-4">
                              <button 
                                onClick={(e) => { e.stopPropagation(); togglePreviewVideo(); }}
                                className="w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg"
                                style={{ backgroundColor: themeHex }}
                              >
                                {previewVideoPlaying && currentMediaIndex === i ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                )}
                              </button>
                              <div className="flex-1 flex flex-col gap-1">
                                <div className="flex justify-between items-center px-1">
                                  <span className="text-[10px] font-black text-white/80 uppercase tracking-widest truncate max-w-[150px]">{item.name}</span>
                                  <span className="text-[10px] font-bold text-white/40 font-mono">
                                    {currentMediaIndex === i ? `${Math.floor(previewVideoRef.current?.currentTime || 0)}s / ${Math.floor(previewVideoDuration || 0)}s` : '0s / 0s'}
                                  </span>
                                </div>
                                <input 
                                  type="range" 
                                  min="0" 
                                  max="100" 
                                  value={currentMediaIndex === i ? previewVideoProgress : 0}
                                  onChange={handleVideoSeek}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-white hover:accent-indigo-400 transition-all"
                                  style={{ 
                                    background: `linear-gradient(to right, ${themeHex} ${currentMediaIndex === i ? previewVideoProgress : 0}%, rgba(255,255,255,0.1) ${currentMediaIndex === i ? previewVideoProgress : 0}%)` 
                                  }}
                                />
                              </div>
                              <div className="flex items-center gap-2 px-2">
                                 <div className={`flex gap-0.5 items-end h-4 ${previewVideoPlaying && currentMediaIndex === i ? 'opacity-100' : 'opacity-20'}`}>
                                    {[1,2,3,4].map(idx => (
                                      <div 
                                        key={idx} 
                                        className={`w-1 rounded-full bg-white/60 ${previewVideoPlaying && currentMediaIndex === i ? 'animate-bounce' : ''}`} 
                                        style={{ height: `${20 + Math.random() * 80}%`, animationDelay: `${idx * 0.1}s` }}
                                      ></div>
                                    ))}
                                 </div>
                              </div>
                            </div>
                          </div>
                       </div>
                     ) : (
                       <div className="w-full h-[60vh] flex flex-col items-center justify-center relative overflow-hidden">
                          {/* Blurred Background */}
                          <div className="absolute inset-0 z-0">
                            <img 
                              src={config.profilePic || `https://picsum.photos/seed/${getSafeAgentName()}/400/400`} 
                              className="w-full h-full object-cover blur-3xl opacity-30 scale-110"
                              alt="Background"
                            />
                            <div className="absolute inset-0 bg-black/40"></div>
                          </div>

                          {/* Visualizer Glow */}
                          <div 
                            className={`absolute w-64 h-64 rounded-full blur-[80px] transition-all duration-500 opacity-40 z-0 ${previewAudioPlaying && currentMediaIndex === i ? 'scale-150 animate-pulse' : 'scale-100'}`}
                            style={{ backgroundColor: themeHex }}
                          ></div>
                          
                          {/* Agent Profile Pic */}
                          <div className={`relative z-10 w-48 h-48 rounded-full border-4 border-white/20 shadow-2xl overflow-hidden group/avatar transition-all duration-300 ${previewAudioPlaying && currentMediaIndex === i ? 'scale-105 animate-pulse shadow-[0_0_50px_rgba(255,255,255,0.2)]' : 'scale-100'}`}>
                            <img 
                              src={config.profilePic || `https://picsum.photos/seed/${getSafeAgentName()}/400/400`} 
                              className={`w-full h-full object-cover transition-transform duration-700 ${previewAudioPlaying && currentMediaIndex === i ? 'scale-110' : 'scale-100'}`}
                              alt={config.name}
                            />
                            <div className="absolute inset-0 bg-black/10"></div>
                          </div>

                          {/* Audio Element (Only for active item) */}
                          {currentMediaIndex === i && item.data && (
                            <audio 
                              ref={previewAudioRef}
                              src={item.data.startsWith('data:') ? item.data : `data:audio/mpeg;base64,${item.data}`}
                              autoPlay
                              onTimeUpdate={handleAudioTimeUpdate}
                              onLoadedMetadata={handleAudioLoadedMetadata}
                              onEnded={() => setPreviewAudioPlaying(false)}
                            />
                          )}

                          {/* Floating Playback Controls */}
                          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[30px] p-4 flex flex-col gap-3 shadow-2xl z-20">
                            <div className="flex items-center gap-4">
                              <button 
                                onClick={(e) => { e.stopPropagation(); togglePreviewAudio(); }}
                                className="w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg"
                                style={{ backgroundColor: themeHex }}
                              >
                                {previewAudioPlaying && currentMediaIndex === i ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                )}
                              </button>
                              <div className="flex-1 flex flex-col gap-1">
                                <div className="flex justify-between items-center px-1">
                                  <span className="text-[10px] font-black text-white/80 uppercase tracking-widest">{item.name}</span>
                                  <span className="text-[10px] font-bold text-white/40 font-mono">
                                    {currentMediaIndex === i ? `${Math.floor((previewAudioProgress / 100) * previewAudioDuration || 0)}s / ${Math.floor(previewAudioDuration || 0)}s` : '0s / 0s'}
                                  </span>
                                </div>
                                <input 
                                  type="range" 
                                  min="0" 
                                  max="100" 
                                  value={currentMediaIndex === i ? previewAudioProgress : 0}
                                  onChange={handleAudioSeek}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-white hover:accent-indigo-400 transition-all"
                                  style={{ 
                                    background: `linear-gradient(to right, ${themeHex} ${currentMediaIndex === i ? previewAudioProgress : 0}%, rgba(255,255,255,0.1) ${currentMediaIndex === i ? previewAudioProgress : 0}%)` 
                                  }}
                                />
                              </div>
                              <div className="flex items-center gap-2 px-2">
                                 <div className={`flex gap-0.5 items-end h-4 ${previewAudioPlaying && currentMediaIndex === i ? 'opacity-100' : 'opacity-20'}`}>
                                    {[1,2,3,4].map(idx => (
                                      <div 
                                        key={idx} 
                                        className={`w-1 rounded-full bg-white/60 ${previewAudioPlaying && currentMediaIndex === i ? 'animate-bounce' : ''}`} 
                                        style={{ height: `${20 + Math.random() * 80}%`, animationDelay: `${idx * 0.1}s` }}
                                      ></div>
                                    ))}
                                 </div>
                              </div>
                            </div>
                          </div>
                       </div>
                     )}
                   </div>
                 ))}
               </div>
            </div>
            
            {/* Mobile Navigation Hints */}
            <div className="md:hidden flex gap-4 mt-2">
               <div className="flex items-center gap-2 opacity-30">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  <span className="text-[8px] font-black text-white uppercase tracking-widest">Swipe</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
               </div>
            </div>
          </div>
        </div>
      )}

      {showTranscript && (
        <div 
          className={`fixed inset-0 z-[300] flex items-center justify-center p-4 ${isBackgroundDark ? 'bg-black/80' : 'bg-white/80'} backdrop-blur-2xl animate-in fade-in duration-300`} 
          onClick={() => setShowTranscript(false)}
        >
          <div 
            className={`relative max-w-2xl w-full h-[70vh] flex flex-col rounded-[35px] border ${dynamicBorderColor} shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500`} 
            onClick={e => e.stopPropagation()}
            style={glassStyles}
          >
            <div className={`p-6 border-b ${dynamicBorderColor} flex items-center justify-between`}>
              <div>
                <h3 className={`text-xl font-black uppercase tracking-tighter ${dynamicTextColor}`}>Transkripsi Panggilan</h3>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${dynamicMutedTextColor}`}>Isi percakapan yang tersimpan di memori</p>
              </div>
              <button onClick={() => setShowTranscript(false)} className={`p-2 hover:bg-white/10 rounded-full transition-all ${dynamicIconColor} hover:${dynamicTextColor}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <div className={`text-sm leading-relaxed whitespace-pre-wrap font-medium select-text ${dynamicTextColor}`}>
                {transcriptText || "Tidak ada transkripsi yang tersedia."}
              </div>
            </div>
            <div className={`p-4 border-t ${dynamicBorderColor} flex justify-end`}>
              <button 
                onClick={() => { navigator.clipboard.writeText(transcriptText); alert("Transkripsi disalin!"); }}
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${isBackgroundDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-black/5 text-black hover:bg-black/10'}`}
              >
                Salin Transkripsi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Info (i) Modal */}
      <ImageInfoModal
        isOpen={imageInfoData.isOpen}
        onClose={() => setImageInfoData(prev => ({ ...prev, isOpen: false }))}
        imageUrl={imageInfoData.imageUrl}
        imagePrompt={imageInfoData.imagePrompt}
        caption={imageInfoData.caption}
        outfit={imageInfoData.outfit}
        timestamp={imageInfoData.timestamp}
        agentName={imageInfoData.agentName || config.name}
        isBackgroundDark={isBackgroundDark}
        themeHex={themeHex}
      />

      {isProcessingMetadata && <MetadataOverlay status={metadataStatus} />}
    </div>
  );
};

export default ChatView;
