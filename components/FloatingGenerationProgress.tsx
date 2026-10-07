import React, { useState, useEffect, useRef } from 'react';
import { ActiveGenerationTask, AppState } from '../types';

interface FloatingGenerationProgressProps {
  activeGenerations: ActiveGenerationTask[];
  onSelectAgent: (agentId: string) => void;
  isBackgroundDark?: boolean;
  themeHex?: string;
  currentAgentId?: string;
  appState?: AppState;
}

export const FloatingGenerationProgress: React.FC<FloatingGenerationProgressProps> = ({
  activeGenerations,
  onSelectAgent,
  isBackgroundDark = true,
  themeHex = '#ec4899',
  currentAgentId,
  appState
}) => {
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);
  
  // Posisi gelembung melayang (Floating Bubble Position)
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined') {
      const savedX = localStorage.getItem('lumina_floating_bubble_x');
      const savedY = localStorage.getItem('lumina_floating_bubble_y');
      if (savedX && savedY) {
        return { 
          x: Math.min(Math.max(parseFloat(savedX), 12), window.innerWidth - 64),
          y: Math.min(Math.max(parseFloat(savedY), 60), window.innerHeight - 100)
        };
      }
      return { x: window.innerWidth - 64, y: 100 };
    }
    return { x: 300, y: 100 };
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);
  const [isDismissTargetActive, setIsDismissTargetActive] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  
  const dragStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const startBubblePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasMovedRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Jika user sedang di dalam chat agent tertentu, sembunyikan agent tersebut dari floating bubble
  const visibleTasks = activeGenerations.filter(task => {
    if (appState === AppState.CHAT && task.agentId === currentAgentId) {
      return false;
    }
    return true;
  });

  // Reset status dismiss jika ada task baru yang masuk
  useEffect(() => {
    if (visibleTasks.length > 0) {
      setIsDismissed(false);
    }
  }, [visibleTasks.length]);

  // Adjust posisi jika ukuran jendela browser berubah (resize)
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => ({
        x: prev.x > window.innerWidth / 2 ? window.innerWidth - 64 : 12,
        y: Math.min(Math.max(prev.y, 60), window.innerHeight - 100)
      }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (visibleTasks.length === 0 || isDismissed) return null;

  const getTypeBadge = (type: 'text' | 'pap' | 'audio') => {
    switch (type) {
      case 'pap':
        return {
          icon: '📸',
          label: 'PAP'
        };
      case 'audio':
        return {
          icon: '🎙️',
          label: 'Audio VN'
        };
      case 'text':
      default:
        return {
          icon: '💬',
          label: 'Mengetik'
        };
    }
  };

  // --- DRAG GESTURE HANDLERS (POINTER EVENTS) ---
  const handlePointerDown = (e: React.PointerEvent) => {
    // Jangan drag jika event berasal dari tombol dismiss atau interaksi sekunder
    if (e.button !== 0) return; // Hanya klik kiri / touch utama
    
    setIsDragging(true);
    setIsSnapping(false);
    hasMovedRef.current = false;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    startBubblePos.current = { ...position };

    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (err) {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartPos.current.x;
    const deltaY = e.clientY - dragStartPos.current.y;
    const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (dist > 6) {
      hasMovedRef.current = true;
    }

    if (hasMovedRef.current) {
      const newX = Math.min(Math.max(startBubblePos.current.x + deltaX, 8), window.innerWidth - 64);
      const newY = Math.min(Math.max(startBubblePos.current.y + deltaY, 40), window.innerHeight - 90);
      setPosition({ x: newX, y: newY });

      // Cek apakah mendekati area dismiss di bagian bawah tengah layar
      const isNearBottomCenter = newY > window.innerHeight - 150 && Math.abs(newX - (window.innerWidth / 2 - 24)) < 90;
      setIsDismissTargetActive(isNearBottomCenter);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {}

    setIsDragging(false);

    // Jika dilepas di area dismiss (bawah tengah)
    if (isDismissTargetActive) {
      setIsDismissed(true);
      setIsDismissTargetActive(false);
      return;
    }

    // Jika digeser, lakukan SNAP TO EDGE (menempel ke tepi kiri atau kanan layar)
    if (hasMovedRef.current) {
      setIsSnapping(true);
      const snapToLeft = position.x < window.innerWidth / 2;
      const finalX = snapToLeft ? 12 : window.innerWidth - 64;
      const finalY = Math.min(Math.max(position.y, 60), window.innerHeight - 100);
      
      setPosition({ x: finalX, y: finalY });
      localStorage.setItem('lumina_floating_bubble_x', finalX.toString());
      localStorage.setItem('lumina_floating_bubble_y', finalY.toString());

      setTimeout(() => {
        setIsSnapping(false);
      }, 350);
    }
  };

  const handleBubbleClick = (agentId: string) => {
    // Jika baru saja digeser (drag), jangan trigger buka chat
    if (hasMovedRef.current) return;
    onSelectAgent(agentId);
  };

  const isLeftAligned = position.x < window.innerWidth / 2;

  return (
    <>
      {/* Area Target Dismiss / Tutup di Bawah Layar Saat Dragging */}
      {isDragging && hasMovedRef.current && (
        <div 
          className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[99] flex flex-col items-center gap-1.5 transition-all duration-200 pointer-events-none ${
            isDismissTargetActive ? 'scale-125' : 'scale-100 opacity-70'
          }`}
        >
          <div className={`w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all shadow-2xl backdrop-blur-xl ${
            isDismissTargetActive 
              ? 'bg-rose-600/80 border-white text-white animate-pulse ring-4 ring-rose-500/40' 
              : 'bg-black/60 border-white/30 text-white/70'
          }`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <span className="text-[10px] font-bold text-white/90 bg-black/60 px-2.5 py-0.5 rounded-full border border-white/10 shadow">
            {isDismissTargetActive ? 'Lepas untuk sembunyikan' : 'Seret ke sini untuk tutup'}
          </span>
        </div>
      )}

      {/* Floating Draggable Bubble Dock */}
      <div 
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          touchAction: 'none',
          transition: isSnapping ? 'transform 0.35s cubic-bezier(0.18, 0.89, 0.32, 1.28)' : 'none',
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        className="fixed top-0 left-0 z-[95] flex flex-col items-center gap-2 select-none pointer-events-auto group"
      >
        {visibleTasks.map((task) => {
          const badge = getTypeBadge(task.type);
          const isHovered = hoveredAgentId === task.agentId && !isDragging;

          return (
            <div 
              key={task.id}
              className="relative flex items-center"
              onMouseEnter={() => !isDragging && setHoveredAgentId(task.agentId)}
              onMouseLeave={() => setHoveredAgentId(null)}
            >
              {/* Tooltip / Status Popover on Hover (menyesuaikan sisi kiri/kanan layar) */}
              {isHovered && (
                <div 
                  className={`absolute top-1/2 -translate-y-1/2 ${
                    isLeftAligned ? 'left-14 origin-left' : 'right-14 origin-right'
                  } whitespace-nowrap px-3 py-2 rounded-2xl text-xs font-bold shadow-2xl backdrop-blur-2xl border flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-150 z-50 pointer-events-none ${
                    isBackgroundDark 
                      ? 'bg-zinc-900/95 border-white/20 text-white' 
                      : 'bg-white/95 border-black/10 text-zinc-900'
                  }`}
                  style={{
                    boxShadow: `0 10px 30px rgba(0,0,0,0.5)`
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">{badge.icon}</span>
                    <span className="font-extrabold">{task.agentName}</span>
                  </div>
                  <div className="text-[10px] font-semibold" style={{ color: themeHex }}>
                    {task.statusText || `${badge.label}...`}
                  </div>
                  <div className={`text-[9px] font-normal ${isBackgroundDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    Ketuk untuk membuka obrolan
                  </div>
                </div>
              )}

              {/* Circular Avatar Progress Button */}
              <div
                onClick={() => handleBubbleClick(task.agentId)}
                className={`relative p-0.5 rounded-full transition-transform duration-200 ${
                  isDragging ? 'scale-110 shadow-2xl' : 'hover:scale-110 active:scale-95'
                }`}
                title={`${task.agentName}: ${task.statusText || badge.label}`}
              >
                {/* Glowing Spinning Ring */}
                <div 
                  className="absolute inset-0 rounded-full animate-spin"
                  style={{
                    background: `conic-gradient(from 0deg, transparent 0 60deg, ${themeHex} 180deg, ${themeHex}cc 270deg, transparent 360deg)`,
                    filter: `drop-shadow(0 0 6px ${themeHex}90)`,
                    animationDuration: '1.2s'
                  }}
                />

                {/* Outer Breathing Glow Effect */}
                <div 
                  className="absolute -inset-1 rounded-full opacity-40 animate-ping"
                  style={{ backgroundColor: themeHex, animationDuration: '2.5s' }}
                />

                {/* Inner Avatar Container */}
                <div 
                  className="relative w-11 h-11 md:w-12 md:h-12 rounded-full overflow-hidden border-2 bg-zinc-900 z-10 shadow-xl flex items-center justify-center"
                  style={{ borderColor: themeHex }}
                >
                  {task.agentPic ? (
                    <img 
                      src={task.agentPic} 
                      alt={task.agentName} 
                      className="w-full h-full object-cover pointer-events-none"
                      draggable={false}
                    />
                  ) : (
                    <span className="text-sm font-bold text-white uppercase">
                      {task.agentName.charAt(0)}
                    </span>
                  )}

                  {/* Overlay With Mini Animated Dots */}
                  <div className="absolute inset-0 bg-black/25 flex items-center justify-center pointer-events-none">
                    <div className="flex gap-0.5 items-center">
                      <span className="w-1 h-1 bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-1 h-1 bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-1 h-1 bg-white rounded-full animate-bounce"></span>
                    </div>
                  </div>
                </div>

                {/* Mini Type Badge Indicator at bottom right */}
                <div 
                  className="absolute -bottom-0.5 -right-0.5 z-20 w-4.5 h-4.5 rounded-full border border-white/80 shadow-md flex items-center justify-center text-[9px] leading-none text-white"
                  style={{ backgroundColor: themeHex }}
                >
                  {badge.icon}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default FloatingGenerationProgress;
