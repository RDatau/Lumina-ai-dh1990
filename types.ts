
export interface AgentConfig {
  id?: string;
  name: string;
  personality: string;
  voice: string; // Legacy field
  voiceChat?: string;
  voiceCall?: string;
  profilePic: string | null;
  background: string;
  blur: number;
  transparency: number;
  isEnrichPersonaEnabled?: boolean;
  enrichedPersona?: string;
  currentOutfit?: string;
  currentAccessories?: string;
  lastPapTimestamp?: number;
  imageModel?: string;
  callModel?: string;
}

export interface Attachment {
  name: string;
  mimeType: string;
  data: string; // Menyimpan base64 data (termasuk header data:...)
  id?: string; // ID pesan terkait (opsional)
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  image?: string; // Gambar aktif yang ditampilkan
  images?: string[]; // Daftar semua variasi gambar yang dihasilkan untuk pesan ini
  activeImageIndex?: number; // Indeks variasi gambar yang sedang aktif/dipilih
  imagePrompt?: string; // Menyimpan prompt lengkap yang digunakan saat generate gambar/PAP
  generationInputs?: {
    prompt: string;
    baseImage: string | null;
    extraRefImage?: string | null;
    additionalImages?: string[];
  };
  imageMeta?: {
    width?: number;
    height?: number;
    size?: number;
    model?: string;
    aspectRatio?: string;
  };
  attachments?: Attachment[]; // Array untuk berbagai jenis file
  audio?: string; // Menyimpan base64 audio data untuk TTS
  timestamp: number;
  parentId?: string | null;
  hiddenMemory?: string; // Menyimpan konteks/memori internal yang tidak ditampilkan di UI
  outfit?: string; // Menyimpan outfit yang digunakan saat pesan ini dikirim (terutama untuk PAP)
  userOutfit?: string; // Menyimpan outfit user yang terdeteksi saat pesan ini dikirim
  accessories?: string; // Menyimpan aksesoris yang digunakan saat pesan ini dikirim
  agentId?: string; // ID Agen yang memiliki pesan ini
  sessionId?: string; // ID Sesi percakapan
  callTranscript?: string; // Menyimpan transkripsi lengkap panggilan
  audioTitle?: string; // Menyimpan judul MP3 yang dihasilkan secara cerdas
  isError?: boolean;
  errorType?: 'safety' | 'quota' | 'general';
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  activeMessageId: string | null;
  timestamp: number;
  userProfile?: UserProfile;
  currentOutfit?: string;
  currentAccessories?: string;
  lastPapTimestamp?: number;
}

export interface CallHistory {
  id: string;
  timestamp: number;
  duration: string;
  status: 'missed' | 'completed';
}

export interface GlobalGeminiSettings {
  geminiApiKey: string;
  textModel: string;
  ttsModel: string;
  voiceChat: string;
  callModel: string;
  voiceCall: string;
  imageModel: string;
  useGoogleSearch: boolean;
  hfSpaceUrl?: string;
  hfTokens?: string;
  hfApiEndpoint?: string;
  injectNegativePrompt?: boolean;
  injectAnatomyGuard?: boolean;
  enableNotificationSound?: boolean;
  enableVibration?: boolean;
  enableSystemNotifications?: boolean;
}

export interface UserProfile {
  name: string;
  personalityInfo: string;
  profilePic: string | null;
  geminiApiKey?: string;
  useGoogleSearch?: boolean;
  currentOutfit?: string;
  lastPapTimestamp?: number;
  textModel?: string;
  ttsModel?: string;
  imageModel?: string;
  callModel?: string;
  voiceChat?: string;
  voiceCall?: string;
  isEnrichPersonaEnabled?: boolean;
  hfSpaceUrl?: string;
  hfTokens?: string;
  hfApiEndpoint?: string;
  injectNegativePrompt?: boolean;
  injectAnatomyGuard?: boolean;
  enableNotificationSound?: boolean;
  enableVibration?: boolean;
  enableSystemNotifications?: boolean;
}

export interface GlobalAppearance {
  background: string;
  blur: number;
  transparency: number;
  isBackgroundDark: boolean;
  accentColor?: string;
  accentColorMode?: 'manual' | 'wallpaper' | 'default';
  showFloatingProgress?: boolean;
}

export interface ActiveGenerationTask {
  id: string;
  agentId: string;
  agentName: string;
  agentPic?: string | null;
  type: 'text' | 'pap' | 'audio';
  statusText: string;
  startedAt: number;
}

export enum AppState {
  LOGIN = 'login',
  SETUP = 'setup',
  PROFILE_SELECT = 'profile_select',
  CHAT = 'chat',
  CALL = 'call',
  CHARACTER_CARDS = 'character_cards',
  WIZARD = 'wizard',
  SETTINGS = 'settings',
  USER_PROFILE = 'user_profile'
}
