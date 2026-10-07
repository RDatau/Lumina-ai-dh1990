import React, { useState, useEffect } from 'react';
import { GlobalAppearance } from '../types';

interface ElectronTitleBarProps {
  isBackgroundDark?: boolean;
  themeHex?: string;
  title?: string;
  appearance?: GlobalAppearance;
}

const ElectronTitleBar: React.FC<ElectronTitleBarProps> = ({
  isBackgroundDark = true,
  themeHex = '#f43f5e',
  title = 'Lumina AI',
  appearance
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    if (window.electron && window.electron.isElectron) {
      setIsElectron(true);
      window.electron.isMaximized().then(setIsMaximized).catch(() => {});
    }
  }, []);

  if (!isElectron) return null;

  const handleMinimize = () => {
    window.electron?.minimize();
  };

  const handleMaximize = async () => {
    window.electron?.maximize();
    if (window.electron?.isMaximized) {
      setTimeout(async () => {
        try {
          const max = await window.electron!.isMaximized();
          setIsMaximized(max);
        } catch (e) {}
      }, 100);
    }
  };

  const handleClose = () => {
    window.electron?.close();
  };

  const isDark = appearance?.isBackgroundDark ?? isBackgroundDark;
  const bgAlpha = (appearance?.transparency ?? 0) / 100;
  const blurPx = appearance?.blur ?? 40;

  return (
    <div 
      className="fixed top-0 left-0 right-0 h-8 z-[9999] flex items-center justify-between px-3 select-none pointer-events-auto transition-all duration-300"
      style={{ 
        WebkitAppRegion: 'drag' as any,
        backgroundColor: isDark 
          ? `rgba(10, 15, 20, ${bgAlpha})` 
          : `rgba(255, 255, 255, ${bgAlpha})`,
        backdropFilter: `blur(${blurPx}px)`,
        WebkitBackdropFilter: `blur(${blurPx}px)`,
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`
      }}
    >
      {/* Title & App Branding with Exact Sidebar Logo */}
      <div className="flex items-center gap-2 pointer-events-none">
        <div className="w-4 h-4 rounded-md flex items-center justify-center shadow-md overflow-hidden shrink-0">
          <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' className="w-full h-full">
            <defs>
              <linearGradient id='titlebarLogoGradient' x1='0%' y1='0%' x2='100%' y2='100%'>
                <stop offset='0%' style={{ stopColor: themeHex || '#f43f5e', stopOpacity: 1 }} />
                <stop offset='100%' style={{ stopColor: themeHex || '#881337', stopOpacity: 0.8 }} />
              </linearGradient>
            </defs>
            <rect width='100' height='100' rx='30' fill='rgba(0,0,0,0.85)'/>
            <path d='M35 25 Q35 75 35 75 L65 75' stroke='url(#titlebarLogoGradient)' strokeWidth='12' fill='none' strokeLinecap='round'/>
            <circle cx='70' cy='30' r='8' fill={themeHex || '#f43f5e'} opacity='1' />
          </svg>
        </div>
        <span className={`text-xs font-semibold tracking-wide ${isDark ? 'text-white/80' : 'text-zinc-800/90'}`}>
          {title}
        </span>
      </div>

      {/* Window Controls (Minimize, Maximize/Restore, Close) */}
      <div 
        className="flex items-center h-full gap-0.5"
        style={{ WebkitAppRegion: 'no-drag' as any }}
      >
        {/* Minimize Button */}
        <button
          onClick={handleMinimize}
          className={`h-full w-9 flex items-center justify-center transition-colors rounded-b-md ${
            isDark 
              ? 'text-white/60 hover:text-white hover:bg-white/10 active:bg-white/20' 
              : 'text-zinc-600 hover:text-zinc-900 hover:bg-black/10 active:bg-black/20'
          }`}
          title="Minimize"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>

        {/* Maximize/Restore Button */}
        <button
          onClick={handleMaximize}
          className={`h-full w-9 flex items-center justify-center transition-colors rounded-b-md ${
            isDark 
              ? 'text-white/60 hover:text-white hover:bg-white/10 active:bg-white/20' 
              : 'text-zinc-600 hover:text-zinc-900 hover:bg-black/10 active:bg-black/20'
          }`}
          title={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3.5" y="1.5" width="7" height="7" rx="0.5" stroke="currentColor" strokeWidth="1" />
              <rect x="1.5" y="3.5" width="7" height="7" rx="0.5" fill={isDark ? "#0a0f14" : "#ffffff"} stroke="currentColor" strokeWidth="1" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="2" width="8" height="8" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
            </svg>
          )}
        </button>

        {/* Close Button */}
        <button
          onClick={handleClose}
          className={`h-full w-10 flex items-center justify-center transition-colors rounded-b-md hover:bg-rose-600 hover:text-white ${
            isDark ? 'text-white/60' : 'text-zinc-600'
          }`}
          title="Close"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ElectronTitleBar;
