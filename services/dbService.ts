import { AgentConfig, ChatMessage, ChatSession, CallHistory, UserProfile, GlobalAppearance, GlobalGeminiSettings } from '../types';

export const DEFAULT_QWEN_SPACE_URL = 'https://huggingface.co/spaces/CopoZ/Qwen-Image-Edit-Rapid-AIO-Loras-Plus';

export const DEFAULT_GLOBAL_GEMINI_SETTINGS: GlobalGeminiSettings = {
  geminiApiKey: '',
  textModel: 'gemini-3.1-flash-lite',
  ttsModel: 'gemini-2.5-flash-preview-tts',
  voiceChat: 'Aoede',
  callModel: 'gemini-2.5-flash-native-audio-preview-12-2025',
  voiceCall: 'Aoede',
  imageModel: 'hf-qwen-image-edit',
  useGoogleSearch: false,
  hfSpaceUrl: DEFAULT_QWEN_SPACE_URL,
  hfTokens: '',
  hfApiEndpoint: '/infer',
  injectNegativePrompt: true,
  injectAnatomyGuard: true,
};

export const getStoredGlobalGeminiSettings = (): Partial<GlobalGeminiSettings> => {
  try {
    const raw = localStorage.getItem('lumina_global_gemini_settings');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {};
};

export const setStoredGlobalGeminiSettings = (settings: Partial<GlobalGeminiSettings>) => {
  try {
    const current = getStoredGlobalGeminiSettings();
    const updated = { ...DEFAULT_GLOBAL_GEMINI_SETTINGS, ...current, ...settings };
    localStorage.setItem('lumina_global_gemini_settings', JSON.stringify(updated));
    if (updated.geminiApiKey) {
      localStorage.setItem('lumina_gemini_api_key', updated.geminiApiKey.trim());
    }
  } catch (e) {}
};

export const getEffectiveGlobalGeminiSettings = (dbSettings?: Partial<GlobalGeminiSettings> | null): GlobalGeminiSettings => {
  const local = getStoredGlobalGeminiSettings();
  const cachedApiKey = typeof localStorage !== 'undefined' ? (localStorage.getItem('lumina_gemini_api_key') || '') : '';
  
  const rawVoiceCall = local.voiceCall || dbSettings?.voiceCall || DEFAULT_GLOBAL_GEMINI_SETTINGS.voiceCall;
  const safeVoiceCall = rawVoiceCall === 'Fola' ? 'Aoede' : rawVoiceCall;

  return {
    geminiApiKey: (local.geminiApiKey || dbSettings?.geminiApiKey || cachedApiKey || '').trim(),
    textModel: local.textModel || dbSettings?.textModel || DEFAULT_GLOBAL_GEMINI_SETTINGS.textModel,
    ttsModel: local.ttsModel || dbSettings?.ttsModel || DEFAULT_GLOBAL_GEMINI_SETTINGS.ttsModel,
    voiceChat: local.voiceChat || dbSettings?.voiceChat || DEFAULT_GLOBAL_GEMINI_SETTINGS.voiceChat,
    callModel: local.callModel || dbSettings?.callModel || DEFAULT_GLOBAL_GEMINI_SETTINGS.callModel,
    voiceCall: safeVoiceCall,
    imageModel: local.imageModel || dbSettings?.imageModel || DEFAULT_GLOBAL_GEMINI_SETTINGS.imageModel,
    useGoogleSearch: local.useGoogleSearch ?? dbSettings?.useGoogleSearch ?? DEFAULT_GLOBAL_GEMINI_SETTINGS.useGoogleSearch,
    hfSpaceUrl: (() => {
      const raw = (local.hfSpaceUrl ?? dbSettings?.hfSpaceUrl ?? '').trim();
      return (!raw || raw === 'https' || raw === 'https://' || raw === 'http' || raw === 'http://')
        ? DEFAULT_QWEN_SPACE_URL
        : raw;
    })(),
    hfTokens: (local.hfTokens ?? dbSettings?.hfTokens ?? '').trim(),
    hfApiEndpoint: (local.hfApiEndpoint ?? dbSettings?.hfApiEndpoint ?? '/infer').trim(),
    injectNegativePrompt: typeof local.injectNegativePrompt === 'boolean'
      ? local.injectNegativePrompt
      : (typeof dbSettings?.injectNegativePrompt === 'boolean'
          ? dbSettings.injectNegativePrompt
          : (DEFAULT_GLOBAL_GEMINI_SETTINGS.injectNegativePrompt ?? true)),
    injectAnatomyGuard: typeof local.injectAnatomyGuard === 'boolean'
      ? local.injectAnatomyGuard
      : (typeof dbSettings?.injectAnatomyGuard === 'boolean'
          ? dbSettings.injectAnatomyGuard
          : (DEFAULT_GLOBAL_GEMINI_SETTINGS.injectAnatomyGuard ?? true)),
  };
};

export const saveGlobalGeminiSettingsSync = async (settings: Partial<GlobalGeminiSettings>): Promise<GlobalGeminiSettings> => {
  setStoredGlobalGeminiSettings(settings);
  const effective = getEffectiveGlobalGeminiSettings(settings);
  try {
    await dbService.saveGlobalGeminiSettings(effective);
  } catch (e) {
    console.warn('Failed to sync global gemini settings to DB:', e);
  }
  return effective;
};

const DB_NAME = 'LuminaAIDatabase';
const DB_VERSION = 3;

export interface FullBackup {
  config: AgentConfig | null;
  messages: ChatMessage[];
  activeMessageId: string | null;
  sessions: ChatSession[];
  history: CallHistory[];
  userProfile?: UserProfile | null;
  timestamp: number;
  version: string;
  type?: 'individual';
}

export interface GlobalBackup {
  profiles: AgentConfig[];
  activeProfileId: string | null;
  appearance?: GlobalAppearance | null;
  globalUserProfile?: UserProfile | null;
  agentData: Record<string, {
    messages: ChatMessage[];
    activeMessageId: string | null;
    sessions: ChatSession[];
    history: CallHistory[];
    userProfile: UserProfile | null;
  }>;
  timestamp: number;
  version: string;
  type: 'global';
}

export class DBService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return Promise.resolve();
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB Error:', request.error);
        this.initPromise = null; // Reset on error so we can try again
        reject('Gagal membuka IndexedDB');
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;

        if (oldVersion < 1) {
          db.createObjectStore('settings');
          db.createObjectStore('messages');
          db.createObjectStore('sessions');
          db.createObjectStore('history');
        }
        
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains('user_profile')) {
            db.createObjectStore('user_profile');
          }
        }

        if (oldVersion < 3) {
          if (!db.objectStoreNames.contains('blobs')) {
            db.createObjectStore('blobs');
          }
        }
      };
    });

    return this.initPromise;
  }

  private async get<T>(storeName: string, key: string): Promise<T | null> {
    await this.init();
    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  private async set(storeName: string, key: string, value: any): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(value, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  // API Methods
  async getConfig(): Promise<AgentConfig | null> { return this.get<AgentConfig>('settings', 'config'); }
  async saveConfig(config: AgentConfig): Promise<void> { return this.set('settings', 'config', config); }

  async getAppearance(): Promise<GlobalAppearance | null> { return this.get<GlobalAppearance>('settings', 'global_appearance'); }
  async saveAppearance(appearance: GlobalAppearance): Promise<void> { return this.set('settings', 'global_appearance', appearance); }

  async getGlobalUserProfile(): Promise<UserProfile | null> { return this.get<UserProfile>('settings', 'global_user_profile'); }
  async saveGlobalUserProfile(profile: UserProfile): Promise<void> { return this.set('settings', 'global_user_profile', profile); }

  async getGlobalGeminiSettings(): Promise<GlobalGeminiSettings | null> { return this.get<GlobalGeminiSettings>('settings', 'global_gemini_settings'); }
  async saveGlobalGeminiSettings(settings: GlobalGeminiSettings): Promise<void> { return this.set('settings', 'global_gemini_settings', settings); }

  async getProfiles(): Promise<AgentConfig[]> {
    await this.init();
    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(['settings', 'blobs'], 'readonly');
        const store = transaction.objectStore('settings');
        const blobStore = transaction.objectStore('blobs');
        const orderReq = store.get('profiles_order');
        orderReq.onsuccess = () => {
          const ids = orderReq.result as string[];
          if (ids && Array.isArray(ids)) {
            const profiles: AgentConfig[] = [];
            let loaded = 0;
            if (ids.length === 0) return resolve([]);
            ids.forEach(id => {
              const req = store.get(`profile_${id}`);
              req.onsuccess = () => {
                const p = req.result as AgentConfig;
                if (p) {
                  if (p.profilePic === '__blob__') {
                    const blobReq = blobStore.get(`pic_${p.id}`);
                    blobReq.onsuccess = () => {
                      if (blobReq.result) p.profilePic = blobReq.result;
                      profiles.push(p);
                      loaded++;
                      if (loaded === ids.length) {
                        const sorted = ids.map(id => profiles.find(p => p.id === id)).filter(Boolean) as AgentConfig[];
                        resolve(sorted);
                      }
                    };
                    blobReq.onerror = () => {
                      profiles.push(p);
                      loaded++;
                      if (loaded === ids.length) {
                        const sorted = ids.map(id => profiles.find(p => p.id === id)).filter(Boolean) as AgentConfig[];
                        resolve(sorted);
                      }
                    };
                  } else {
                    profiles.push(p);
                    loaded++;
                    if (loaded === ids.length) {
                      const sorted = ids.map(id => profiles.find(p => p.id === id)).filter(Boolean) as AgentConfig[];
                      resolve(sorted);
                    }
                  }
                } else {
                  loaded++;
                  if (loaded === ids.length) {
                    const sorted = ids.map(id => profiles.find(p => p.id === id)).filter(Boolean) as AgentConfig[];
                    resolve(sorted);
                  }
                }
              };
              req.onerror = () => { loaded++; if (loaded === ids.length) resolve(profiles); };
            });
          } else {
            // Fallback
            const oldReq = store.get('profiles');
            oldReq.onsuccess = () => resolve(oldReq.result || []);
            oldReq.onerror = () => resolve([]);
          }
        };
        orderReq.onerror = () => resolve([]);
      } catch (e) { resolve([]); }
    });
  }

  async saveProfiles(profiles: AgentConfig[]): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(['settings', 'blobs'], 'readwrite');
        const store = transaction.objectStore('settings');
        const blobStore = transaction.objectStore('blobs');
        const ids = profiles.map(p => p.id);
        store.put(ids, 'profiles_order');
        profiles.forEach(p => {
          const pToSave = { ...p };
          if (pToSave.profilePic && pToSave.profilePic.length > 10000) {
            blobStore.put(pToSave.profilePic, `pic_${pToSave.id}`);
            pToSave.profilePic = '__blob__';
          }
          store.put(pToSave, `profile_${pToSave.id}`);
        });
        store.delete('profiles'); // Cleanup old
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      } catch (e) { reject(e); }
    });
  }

  async deleteProfile(agentId: string): Promise<void> {
    // 1. Update profiles list
    const profiles = await this.getProfiles();
    const updatedProfiles = profiles.filter(p => p.id !== agentId);
    await this.saveProfiles(updatedProfiles);

    // 2. Clear agent specific data
    await this.init();
    const stores = ['messages', 'sessions', 'history', 'user_profile'];
    return new Promise((resolve) => {
      const transaction = this.db!.transaction(stores, 'readwrite');
      
      // Messages
      transaction.objectStore('messages').delete(`${agentId}_list`);
      transaction.objectStore('messages').delete(`${agentId}_active_id`);
      
      // Cleanup format baru
      const orderReq = transaction.objectStore('messages').get(`${agentId}_order`);
      orderReq.onsuccess = () => {
        const ids = orderReq.result as string[];
        if (ids && Array.isArray(ids)) {
          ids.forEach(id => transaction.objectStore('messages').delete(`msg_${id}`));
        }
        transaction.objectStore('messages').delete(`${agentId}_order`);
      };
      
      // Sessions
      transaction.objectStore('sessions').delete(`${agentId}_list`);
      
      // History
      transaction.objectStore('history').delete(`${agentId}_list`);
      
      // User Profile
      transaction.objectStore('user_profile').delete(agentId);

      transaction.oncomplete = () => resolve();
    });
  }

  async getUserProfile(agentId: string = 'default'): Promise<UserProfile | null> { return this.get<UserProfile>('user_profile', agentId); }
  async saveUserProfile(profile: UserProfile, agentId: string = 'default'): Promise<void> { return this.set('user_profile', agentId, profile); }

  async getMessages(agentId: string = 'default'): Promise<ChatMessage[]> {
    await this.init();
    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(['messages', 'blobs'], 'readonly');
        const store = transaction.objectStore('messages');
        const blobStore = transaction.objectStore('blobs');
        
        const orderRequest = store.get(`${agentId}_order`);
        orderRequest.onsuccess = () => {
          const ids = orderRequest.result as string[];
          if (ids && Array.isArray(ids)) {
            if (ids.length === 0) {
              resolve([]);
              return;
            }
            
            const messages: ChatMessage[] = [];
            let loadedCount = 0;
            
            ids.forEach((id) => {
              const msgRequest = store.get(`msg_${id}`);
              msgRequest.onsuccess = () => {
                const msg = msgRequest.result as ChatMessage;
                if (msg) {
                  // Check if audio is stored in blobs
                  if (msg.audio === '__blob__') {
                    const blobReq = blobStore.get(`audio_${msg.id}`);
                    blobReq.onsuccess = () => {
                      if (blobReq.result) msg.audio = blobReq.result;
                      messages.push(msg);
                      loadedCount++;
                      if (loadedCount === ids.length) {
                        const sorted = ids.map(id => messages.find(m => m.id === id)).filter(Boolean) as ChatMessage[];
                        resolve(sorted);
                      }
                    };
                    blobReq.onerror = () => {
                      messages.push(msg);
                      loadedCount++;
                      if (loadedCount === ids.length) {
                        const sorted = ids.map(id => messages.find(m => m.id === id)).filter(Boolean) as ChatMessage[];
                        resolve(sorted);
                      }
                    };
                  } else {
                    messages.push(msg);
                    loadedCount++;
                    if (loadedCount === ids.length) {
                      const sorted = ids.map(id => messages.find(m => m.id === id)).filter(Boolean) as ChatMessage[];
                      resolve(sorted);
                    }
                  }
                } else {
                  loadedCount++;
                  if (loadedCount === ids.length) {
                    const sorted = ids.map(id => messages.find(m => m.id === id)).filter(Boolean) as ChatMessage[];
                    resolve(sorted);
                  }
                }
              };
              msgRequest.onerror = () => {
                loadedCount++;
                if (loadedCount === ids.length) {
                  const sorted = ids.map(id => messages.find(m => m.id === id)).filter(Boolean) as ChatMessage[];
                  resolve(sorted);
                }
              };
            });
          } else {
            // Fallback ke format lama
            const listRequest = store.get(`${agentId}_list`);
            listRequest.onsuccess = () => resolve(listRequest.result || []);
            listRequest.onerror = () => resolve([]);
          }
        };
        orderRequest.onerror = () => {
          const listRequest = store.get(`${agentId}_list`);
          listRequest.onsuccess = () => resolve(listRequest.result || []);
          listRequest.onerror = () => resolve([]);
        };
      } catch (e) {
        resolve([]);
      }
    });
  }

  async getLastMessage(agentId: string = 'default'): Promise<ChatMessage | null> {
    await this.init();
    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(['messages'], 'readonly');
        const store = transaction.objectStore('messages');
        
        const orderRequest = store.get(`${agentId}_order`);
        orderRequest.onsuccess = () => {
          const ids = orderRequest.result as string[];
          if (ids && Array.isArray(ids) && ids.length > 0) {
            const lastId = ids[ids.length - 1];
            const msgRequest = store.get(`msg_${lastId}`);
            msgRequest.onsuccess = () => {
              const msg = msgRequest.result as ChatMessage;
              resolve(msg || null);
            };
            msgRequest.onerror = () => resolve(null);
          } else {
            const listRequest = store.get(`${agentId}_list`);
            listRequest.onsuccess = () => {
              const list = listRequest.result as ChatMessage[];
              if (list && Array.isArray(list) && list.length > 0) {
                resolve(list[list.length - 1] || null);
              } else {
                resolve(null);
              }
            };
            listRequest.onerror = () => resolve(null);
          }
        };
        orderRequest.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  async getAllLastMessages(agentIds: string[]): Promise<Record<string, ChatMessage>> {
    const results: Record<string, ChatMessage> = {};
    if (!agentIds || agentIds.length === 0) return results;
    await Promise.all(agentIds.map(async (id) => {
      try {
        const last = await this.getLastMessage(id);
        if (last) results[id] = last;
      } catch (e) {
        // ignore errors
      }
    }));
    return results;
  }

  async saveMessages(messages: ChatMessage[], agentId: string = 'default'): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(['messages', 'blobs'], 'readwrite');
        const store = transaction.objectStore('messages');
        const blobStore = transaction.objectStore('blobs');
        
        const ids = messages.map(m => m.id);
        store.put(ids, `${agentId}_order`);
        
        messages.forEach(msg => {
          // Clone message to avoid modifying the original in state
          const msgToSave = { ...msg };
          if (msgToSave.audio && msgToSave.audio.length > 10000) {
            blobStore.put(msgToSave.audio, `audio_${msgToSave.id}`);
            msgToSave.audio = '__blob__';
          }
          store.put(msgToSave, `msg_${msgToSave.id}`);
        });
        
        store.delete(`${agentId}_list`);
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      } catch (e) {
        reject(e);
      }
    });
  }
  
  async addMessage(message: ChatMessage, agentId: string = 'default'): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction(['messages', 'blobs'], 'readwrite');
        const store = transaction.objectStore('messages');
        const blobStore = transaction.objectStore('blobs');
        
        const orderReq = store.get(`${agentId}_order`);
        orderReq.onsuccess = () => {
          let ids = orderReq.result as string[] || [];
          if (!ids.includes(message.id)) {
            ids.push(message.id);
            store.put(ids, `${agentId}_order`);
            
            const msgToSave = { ...message };
            if (msgToSave.audio && msgToSave.audio.length > 10000) {
              blobStore.put(msgToSave.audio, `audio_${msgToSave.id}`);
              msgToSave.audio = '__blob__';
            }
            store.put(msgToSave, `msg_${msgToSave.id}`);
          }
          transaction.oncomplete = () => resolve();
        };
        orderReq.onerror = () => reject(orderReq.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  async getActiveMessageId(agentId: string = 'default'): Promise<string | null> { return this.get<string>('messages', `${agentId}_active_id`); }
  async saveActiveMessageId(id: string | null, agentId: string = 'default'): Promise<void> { return this.set('messages', `${agentId}_active_id`, id); }

  async getSessions(agentId: string = 'default'): Promise<ChatSession[]> {
    await this.init();
    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction('sessions', 'readonly');
        const store = transaction.objectStore('sessions');
        const orderReq = store.get(`${agentId}_order`);
        orderReq.onsuccess = () => {
          const ids = orderReq.result as string[];
          if (ids && Array.isArray(ids)) {
            const items: ChatSession[] = [];
            let loaded = 0;
            if (ids.length === 0) return resolve([]);
            ids.forEach(id => {
              const req = store.get(`session_${id}`);
              req.onsuccess = () => {
                if (req.result) items.push(req.result);
                loaded++;
                if (loaded === ids.length) {
                  const sorted = ids.map(id => items.find(i => i.id === id)).filter(Boolean) as ChatSession[];
                  resolve(sorted);
                }
              };
              req.onerror = () => { loaded++; if (loaded === ids.length) resolve(items); };
            });
          } else {
            const oldReq = store.get(`${agentId}_list`);
            oldReq.onsuccess = () => resolve(oldReq.result || []);
            oldReq.onerror = () => resolve([]);
          }
        };
        orderReq.onerror = () => resolve([]);
      } catch (e) { resolve([]); }
    });
  }

  async saveSessions(sessions: ChatSession[], agentId: string = 'default'): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction('sessions', 'readwrite');
        const store = transaction.objectStore('sessions');
        const ids = sessions.map(s => s.id);
        store.put(ids, `${agentId}_order`);
        sessions.forEach(s => store.put(s, `session_${s.id}`));
        store.delete(`${agentId}_list`);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      } catch (e) { reject(e); }
    });
  }

  async getCallHistory(agentId: string = 'default'): Promise<CallHistory[]> {
    await this.init();
    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction('history', 'readonly');
        const store = transaction.objectStore('history');
        const orderReq = store.get(`${agentId}_order`);
        orderReq.onsuccess = () => {
          const ids = orderReq.result as string[];
          if (ids && Array.isArray(ids)) {
            const items: CallHistory[] = [];
            let loaded = 0;
            if (ids.length === 0) return resolve([]);
            ids.forEach(id => {
              const req = store.get(`call_${id}`);
              req.onsuccess = () => {
                if (req.result) items.push(req.result);
                loaded++;
                if (loaded === ids.length) {
                  const sorted = ids.map(id => items.find(i => i.id === id)).filter(Boolean) as CallHistory[];
                  resolve(sorted);
                }
              };
              req.onerror = () => { loaded++; if (loaded === ids.length) resolve(items); };
            });
          } else {
            const oldReq = store.get(`${agentId}_list`);
            oldReq.onsuccess = () => resolve(oldReq.result || []);
            oldReq.onerror = () => resolve([]);
          }
        };
        orderReq.onerror = () => resolve([]);
      } catch (e) { resolve([]); }
    });
  }

  async saveCallHistory(history: CallHistory[], agentId: string = 'default'): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction('history', 'readwrite');
        const store = transaction.objectStore('history');
        const ids = history.map(h => h.id);
        store.put(ids, `${agentId}_order`);
        history.forEach(h => store.put(h, `call_${h.id}`));
        store.delete(`${agentId}_list`);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      } catch (e) { reject(e); }
    });
  }

  async getAgentIdsWithMessages(): Promise<string[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('messages', 'readonly');
      const store = transaction.objectStore('messages');
      // Gunakan openKeyCursor agar tidak membaca value yang mungkin terlalu besar
      const request = store.openKeyCursor();
      const agentIds = new Set<string>();
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursor>).result;
        if (cursor) {
          const key = cursor.key as string;
          if (key.endsWith('_list')) {
            agentIds.add(key.replace('_list', ''));
          } else if (key.endsWith('_order')) {
            agentIds.add(key.replace('_order', ''));
          }
          cursor.continue();
        } else {
          resolve(Array.from(agentIds));
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllDataForBackup(): Promise<FullBackup> {
    const config = await this.getConfig();
    return this.getAgentDataForBackup(config?.id || 'default');
  }

  async getAgentDataForBackup(agentId: string): Promise<FullBackup> {
    const profiles = await this.getProfiles();
    const config = profiles.find(p => p.id === agentId) || null;
    
    const [messages, activeMessageId, sessions, history, userProfile] = await Promise.all([
      this.getMessages(agentId),
      this.getActiveMessageId(agentId),
      this.getSessions(agentId),
      this.getCallHistory(agentId),
      this.getUserProfile(agentId)
    ]);
    return {
      config,
      messages,
      activeMessageId,
      sessions,
      history,
      userProfile,
      timestamp: Date.now(),
      version: '2.6',
      type: 'individual'
    };
  }

  async getGlobalDataForBackup(): Promise<GlobalBackup> {
    const [profiles, config, appearance, globalUserProfile] = await Promise.all([
      this.getProfiles(),
      this.getConfig(),
      this.getAppearance(),
      this.getGlobalUserProfile()
    ]);
    
    const activeProfileId = config?.id || null;
    const agentData: Record<string, any> = {};
    
    const idsToBackup = new Set(profiles.map(p => p.id || 'default'));
    if (activeProfileId) idsToBackup.add(activeProfileId);
    idsToBackup.add('default');

    for (const agentId of idsToBackup) {
      const [messages, activeMessageId, sessions, history, userProfile] = await Promise.all([
        this.getMessages(agentId),
        this.getActiveMessageId(agentId),
        this.getSessions(agentId),
        this.getCallHistory(agentId),
        this.getUserProfile(agentId)
      ]);
      
      agentData[agentId] = {
        messages,
        activeMessageId,
        sessions,
        history,
        userProfile
      };
    }

    return {
      profiles,
      activeProfileId,
      appearance,
      globalUserProfile,
      agentData,
      timestamp: Date.now(),
      version: '2.7',
      type: 'global'
    };
  }

  async restoreAllData(data: FullBackup): Promise<void> {
    const agentId = data.config?.id || 'default';
    if (data.config) {
      await this.saveConfig(data.config);
      const profiles = await this.getProfiles();
      const existingIndex = profiles.findIndex(p => p.id === agentId);
      if (existingIndex >= 0) {
        profiles[existingIndex] = data.config;
      } else {
        profiles.push(data.config);
      }
      await this.saveProfiles(profiles);
    }
    if (data.userProfile) await this.saveUserProfile(data.userProfile, agentId);
    await this.saveMessages(data.messages || [], agentId);
    await this.saveActiveMessageId(data.activeMessageId || null, agentId);
    await this.saveSessions(data.sessions || [], agentId);
    await this.saveCallHistory(data.history || [], agentId);
  }

  async restoreGlobalData(data: GlobalBackup): Promise<void> {
    await this.clearAll();
    
    if (data.profiles) {
      await this.saveProfiles(data.profiles);
    }
    
    if (data.appearance) {
      await this.saveAppearance(data.appearance);
    }

    if (data.globalUserProfile) {
      await this.saveGlobalUserProfile(data.globalUserProfile);
    }

    if (data.activeProfileId) {
      const activeProfile = data.profiles.find(p => p.id === data.activeProfileId);
      if (activeProfile) {
        await this.saveConfig(activeProfile);
      }
    }

    if (data.agentData) {
      for (const [agentId, agentState] of Object.entries(data.agentData)) {
        if (agentState.userProfile) await this.saveUserProfile(agentState.userProfile, agentId);
        await this.saveMessages(agentState.messages || [], agentId);
        await this.saveActiveMessageId(agentState.activeMessageId || null, agentId);
        await this.saveSessions(agentState.sessions || [], agentId);
        await this.saveCallHistory(agentState.history || [], agentId);
      }
    }
  }

  async clearAll(): Promise<void> {
    await this.init();
    const stores = ['settings', 'messages', 'sessions', 'history', 'user_profile'];
    return new Promise((resolve) => {
      const transaction = this.db!.transaction(stores, 'readwrite');
      stores.forEach(s => {
        if (this.db!.objectStoreNames.contains(s)) {
          transaction.objectStore(s).clear();
        }
      });
      transaction.oncomplete = () => resolve();
    });
  }
}

export const dbService = new DBService();