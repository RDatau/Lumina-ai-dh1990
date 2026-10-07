import React, { useState, useRef } from 'react';
import { AgentConfig } from '../types';

export interface NotificationItem {
  id: string;
  agentId: string;
  agentName: string;
  message: string;
  timestamp?: number;
}

interface NotificationToastProps {
  notifications: NotificationItem[];
  profiles: AgentConfig[];
  onSelectNotification: (agentId: string, notifId: string) => void;
  onDismissNotification: (notifId: string) => void;
  isBackgroundDark?: boolean;
  themeHex?: string;
  isElectron?: boolean;
}

interface NotificationCardProps {
  notif: NotificationItem;
  agent?: AgentConfig;
  onSelect: (agentId: string, notifId: string) => void;
  onDismiss: (notifId: string) => void;
  isBackgroundDark: boolean;
  themeHex: string;
}

const NotificationCard: React.FC<NotificationCardProps> = ({
  notif,
  agent,
  onSelect,
  onDismiss,
  isBackgroundDark,
  themeHex
}) => {
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isDismissing, setIsDismissed] = useState(false);
  const [dismissDirection, setIsDismissDirection] = useState<'left' | 'right'>('right');

  const startPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasMovedRef = useRef<boolean>(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Abaikan jika klik kanan
    if (e.button !== 0) return;

    setIsDragging(true);
    hasMovedRef.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };

    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (err) {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - startPos.current.x;
    const deltaY = e.clientY - startPos.current.y;

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      hasMovedRef.current = true;
    }

    if (hasMovedRef.current) {
      setDragOffset({ x: deltaX, y: deltaY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {}

    setIsDragging(false);

    // Jika digeser sejauh > 60px ke kiri atau kanan, buang (dismiss)
    if (hasMovedRef.current && Math.abs(dragOffset.x) > 60) {
      const dir = dragOffset.x > 0 ? 'right' : 'left';
      setIsDismissDirection(dir);
      setIsDismissed(true);
      
      setTimeout(() => {
        onDismiss(notif.id);
      }, 200);
      return;
    }

    // Jika tidak digeser jauh, kembalikan posisi ke awal (snap back)
    setDragOffset({ x: 0, y: 0 });

    // Jika cuma ketukan biasa tanpa geser, jalankan aksi klik untuk beralih obrolan
    if (!hasMovedRef.current) {
      onSelect(notif.agentId, notif.id);
    }
  };

  // Hitung transparansi saat digeser (fading)
  const opacity = isDismissing ? 0 : Math.max(0.2, 1 - Math.abs(dragOffset.x) / 180);
  const transformX = isDismissing ? (dismissDirection === 'right' ? 400 : -400) : dragOffset.x;
  const rotationDeg = isDismissing ? (dismissDirection === 'right' ? 15 : -15) : dragOffset.x * 0.05;

  return (
    <div
      ref={cardRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        transform: `translate3d(${transformX}px, ${dragOffset.y * 0.25}px, 0) rotate(${rotationDeg}deg)`,
        opacity: opacity,
        touchAction: 'pan-y',
        transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.18, 0.89, 0.32, 1.28), opacity 0.2s ease-out',
        boxShadow: isBackgroundDark
          ? `0 10px 30px rgba(0,0,0,0.6), 0 0 18px ${themeHex}20`
          : `0 10px 30px rgba(0,0,0,0.12), 0 0 15px ${themeHex}25`
      }}
      className={`relative pointer-events-auto backdrop-blur-2xl border rounded-2xl p-3.5 md:p-4 shadow-2xl select-none cursor-grab active:cursor-grabbing transition-colors duration-200 animate-in slide-in-from-top-4 duration-300 ${
        isBackgroundDark
          ? 'bg-zinc-900/90 border-white/20 text-white shadow-black/80'
          : 'bg-white/95 border-black/15 text-zinc-900 shadow-xl shadow-zinc-400/20'
      }`}
    >
      {/* Visual Mobile Swipe Indicator Pill (Garis Kecil Petunjuk Drag) */}
      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-white/20 pointer-events-none" />

      <div className="flex items-center gap-3.5 pt-1">
        {/* Foto Profil / Inisial Karakter */}
        <div
          className="relative w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm shadow-md shrink-0 ring-2 overflow-hidden"
          style={{ 
            backgroundColor: themeHex,
            ringColor: `${themeHex}80` 
          }}
        >
          {agent?.profilePic ? (
            <img
              src={agent.profilePic}
              alt={notif.agentName}
              className="w-full h-full object-cover pointer-events-none"
              draggable={false}
            />
          ) : (
            <span>{notif.agentName.charAt(0).toUpperCase()}</span>
          )}
        </div>

        {/* Isi Pesan Notifikasi */}
        <div className="min-w-0 flex-1 pr-6">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md text-white shadow-sm" style={{ backgroundColor: themeHex }}>
              Pesan
            </span>
            <span className={`text-xs font-bold truncate ${isBackgroundDark ? 'text-white/90' : 'text-zinc-800'}`}>
              {notif.agentName}
            </span>
          </div>
          <p className={`text-xs font-semibold leading-tight truncate mt-1 ${isBackgroundDark ? 'text-white' : 'text-zinc-900'}`}>
            {notif.message}
          </p>
          <p className={`text-[10px] font-medium mt-0.5 flex items-center gap-1 ${isBackgroundDark ? 'text-white/50' : 'text-zinc-500'}`}>
            <span>Klik untuk beralih</span>
            <span className="text-[9px] opacity-60">· Geser ke samping untuk buang</span>
          </p>
        </div>

        {/* Tombol (X) Tutup Notifikasi */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsDismissed(true);
            setTimeout(() => onDismiss(notif.id), 150);
          }}
          className={`absolute top-2.5 right-2.5 p-1.5 rounded-full transition-all duration-200 active:scale-90 flex items-center justify-center border z-30 cursor-pointer ${
            isBackgroundDark
              ? 'bg-white/10 hover:bg-white/20 border-white/10 text-white/70 hover:text-white'
              : 'bg-black/5 hover:bg-black/10 border-black/10 text-zinc-600 hover:text-zinc-900'
          }`}
          title="Tutup Notifikasi"
          aria-label="Tutup Notifikasi"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notifications,
  profiles,
  onSelectNotification,
  onDismissNotification,
  isBackgroundDark = true,
  themeHex = '#ec4899',
  isElectron = false
}) => {
  if (!notifications || notifications.length === 0) return null;

  return (
    <div
      className={`fixed ${
        isElectron ? 'top-11' : 'top-4'
      } right-4 left-4 sm:left-auto sm:w-80 md:w-96 z-[9990] flex flex-col gap-2.5 pointer-events-none transition-all duration-300`}
    >
      {notifications.map((notif) => {
        const agent = profiles.find((p) => p.id === notif.agentId);
        return (
          <NotificationCard
            key={notif.id}
            notif={notif}
            agent={agent}
            onSelect={onSelectNotification}
            onDismiss={onDismissNotification}
            isBackgroundDark={isBackgroundDark}
            themeHex={themeHex}
          />
        );
      })}
    </div>
  );
};

export default NotificationToast;
