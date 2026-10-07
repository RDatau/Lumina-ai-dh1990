/**
 * Service untuk mengelola Suara Notifikasi, Getar (Vibration API), 
 * dan Izin Notifikasi Bawaan Android/Browser (Web Notification API & ServiceWorker).
 */

export interface NotificationSettings {
  enableSound: boolean;
  enableVibration: boolean;
  enableSystemNotifications: boolean;
}

const STORAGE_KEY_SOUND = 'lumina_notif_sound';
const STORAGE_KEY_VIBRATION = 'lumina_notif_vibration';
const STORAGE_KEY_SYSTEM = 'lumina_notif_system';

export const getNotificationSettings = (): NotificationSettings => {
  if (typeof localStorage === 'undefined') {
    return { enableSound: true, enableVibration: true, enableSystemNotifications: true };
  }
  const sound = localStorage.getItem(STORAGE_KEY_SOUND);
  const vibration = localStorage.getItem(STORAGE_KEY_VIBRATION);
  const system = localStorage.getItem(STORAGE_KEY_SYSTEM);

  return {
    enableSound: sound !== null ? sound === 'true' : true,
    enableVibration: vibration !== null ? vibration === 'true' : true,
    enableSystemNotifications: system !== null ? system === 'true' : true,
  };
};

export const saveNotificationSettings = (settings: Partial<NotificationSettings>) => {
  if (typeof localStorage === 'undefined') return;
  if (settings.enableSound !== undefined) {
    localStorage.setItem(STORAGE_KEY_SOUND, String(settings.enableSound));
  }
  if (settings.enableVibration !== undefined) {
    localStorage.setItem(STORAGE_KEY_VIBRATION, String(settings.enableVibration));
  }
  if (settings.enableSystemNotifications !== undefined) {
    localStorage.setItem(STORAGE_KEY_SYSTEM, String(settings.enableSystemNotifications));
  }
};

// Re-use audio context for Web Audio chime synthesis
let audioCtx: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
};

/**
 * Memutar suara lonceng notifikasi (Chime) yang jernih & estetik menggunakan Web Audio API.
 * @param type 'text' (balasan teks biasa) atau 'pap' (PAP/foto baru telah jadi)
 */
export const playNotificationSound = (type: 'text' | 'pap' = 'text') => {
  const settings = getNotificationSettings();
  if (!settings.enableSound) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (type === 'pap') {
      // Suara Notifikasi PAP Spesial: 3-nada jernih berkilau (C5 -> G5 -> C6)
      const notes = [523.25, 783.99, 1046.50];
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + index * 0.09);

        // Envelope nada
        gain.gain.setValueAtTime(0.01, now + index * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.25, now + index * 0.09 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.09 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + index * 0.09);
        osc.stop(now + index * 0.09 + 0.4);
      });
    } else {
      // Suara Notifikasi Pesan Teks Biasa: 2-nada lembut (E5 -> G5)
      const notes = [659.25, 783.99];
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + index * 0.1);

        gain.gain.setValueAtTime(0.01, now + index * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.2, now + index * 0.1 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.1 + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + index * 0.1);
        osc.stop(now + index * 0.1 + 0.35);
      });
    }
  } catch (e) {
    console.warn("[NotificationService] Gagal memutar suara notifikasi:", e);
  }
};

/**
 * Memicu Getar (Vibration API) untuk perangkat Mobile/Android.
 */
export const triggerVibration = (type: 'text' | 'pap' = 'text') => {
  const settings = getNotificationSettings();
  if (!settings.enableVibration) return;

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      if (type === 'pap') {
        // Pola getar PAP: dua getaran lebih tegas (120ms getar, 60ms jeda, 180ms getar)
        navigator.vibrate([120, 60, 180]);
      } else {
        // Pola getar pesan teks: getaran ganda lembut (80ms getar, 50ms jeda, 80ms getar)
        navigator.vibrate([80, 50, 80]);
      }
    } catch (e) {
      console.warn("[NotificationService] Vibration Error:", e);
    }
  }
};

/**
 * Meminta izin Notifikasi Sistem / Android ke user.
 */
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (e) {
    console.warn("[NotificationService] Request Permission Error:", e);
    return Notification.permission || 'default';
  }
};

/**
 * Memeriksa status izin notifikasi sistem saat ini.
 */
export const getSystemNotificationPermissionState = (): NotificationPermission | 'unsupported' => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
};

/**
 * Mengirimkan Notifikasi Bawaan Browser/Android (System Notification).
 */
export const sendSystemNotification = async (
  title: string,
  body: string,
  icon?: string | null,
  type: 'text' | 'pap' = 'text'
) => {
  const settings = getNotificationSettings();
  if (!settings.enableSystemNotifications) return;

  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const notifOptions: any = {
    body,
    icon: icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: `lumina-msg-${Date.now()}`,
    vibrate: type === 'pap' ? [120, 60, 180] : [80, 50, 80],
    renotify: true,
    data: {
      url: window.location.href,
      type
    }
  };

  try {
    // Coba kirim via Service Worker jika tersedia (Android PWA background compatibility)
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      if (reg && reg.showNotification) {
        await reg.showNotification(title, notifOptions);
        return;
      }
    }

    // Fallback via Web Notification API standar
    const notif = new Notification(title, notifOptions);
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
  } catch (e) {
    console.warn("[NotificationService] System Notification Error:", e);
  }
};

/**
 * Fungsi Terpadu: Memutar suara, memicu getaran, dan menampilkan notifikasi sistem saat respon baru/PAP ada.
 */
export const triggerNewMessageNotification = (
  senderName: string,
  text: string,
  type: 'text' | 'pap' = 'text',
  avatarPic?: string | null
) => {
  // 1. Suara Notifikasi
  playNotificationSound(type);

  // 2. Getar Android / Mobile
  triggerVibration(type);

  // 3. Notifikasi Sistem (Terutama berguna saat tab diminimalkan atau di background)
  const isDocumentHidden = typeof document !== 'undefined' && document.hidden;
  const settings = getNotificationSettings();

  if (settings.enableSystemNotifications && isDocumentHidden) {
    const title = type === 'pap' ? `📸 ${senderName} mengirim PAP baru!` : `💬 ${senderName}`;
    const cleanBody = text
      .replace(/\[CAPTION:[\s\S]*?\]/gi, '')
      .replace(/\[WAKTU:[\s\S]*?\]/gi, '')
      .trim() || (type === 'pap' ? 'Lihat foto terbaru dariku sayang..' : 'Mengirim pesan baru..');
    
    sendSystemNotification(title, cleanBody.slice(0, 100), avatarPic, type);
  }
};
