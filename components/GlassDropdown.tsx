import React, { useState, useRef, useEffect } from 'react';

interface Option {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface GlassDropdownProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  isBackgroundDark?: boolean;
  themeHex?: string;
  size?: 'default' | 'sm';
}

const GlassDropdown: React.FC<GlassDropdownProps> = ({ 
  options, 
  value, 
  onChange, 
  placeholder = "Pilih...", 
  className = "",
  label,
  isBackgroundDark = true, 
  themeHex,
  size = 'default'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isSmall = size === 'sm';

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const dynamicTextColor = isBackgroundDark ? 'text-white' : 'text-zinc-900';
  const dynamicMutedTextColor = isBackgroundDark ? 'text-white/70' : 'text-zinc-500';
  const dynamicBorderColor = isBackgroundDark ? 'border-white/20' : 'border-zinc-300';

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

  return (
    <div className={`relative w-full ${className}`} ref={dropdownRef}>
      {label && (
        <label className={`${isSmall ? 'text-[9px] mb-1.5 ml-2' : 'text-[9px] mb-2 ml-4'} font-black ${dynamicMutedTextColor} uppercase tracking-[0.25em] block select-none`}>
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full ${isBackgroundDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} backdrop-blur-xl border ${dynamicBorderColor} ${
          isSmall 
            ? 'rounded-xl px-3.5 py-2.5 text-xs font-semibold' 
            : 'rounded-[25px] px-6 py-4 text-sm font-bold shadow-xl'
        } flex items-center justify-between ${dynamicTextColor} transition-all active:scale-[0.98] group`}
      >
        <span className={`truncate text-left pr-2 ${selectedOption ? dynamicTextColor : (isBackgroundDark ? "text-white/40" : "text-slate-400")}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className={`${isSmall ? 'h-3.5 w-3.5' : 'h-4 w-4'} flex-shrink-0 ${dynamicMutedTextColor} transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className={`absolute z-[100] w-full mt-1.5 ${isBackgroundDark ? 'bg-zinc-950/95' : 'bg-white/95'} backdrop-blur-2xl border ${dynamicBorderColor} ${
          isSmall ? 'rounded-xl p-1.5 shadow-xl' : 'rounded-[25px] p-2 shadow-2xl'
        } overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top`}>
          <div className="max-h-56 overflow-y-auto custom-scrollbar p-0.5 flex flex-col gap-1">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left ${
                  isSmall ? 'px-3 py-2 rounded-lg text-[11px]' : 'px-4 py-3 rounded-xl text-xs'
                } font-semibold transition-all flex items-center gap-2.5 ${
                  value === option.value 
                    ? 'shadow-sm' 
                    : `${dynamicTextColor} opacity-75 hover:opacity-100 ${isBackgroundDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`
                }`}
                style={value === option.value ? { 
                  backgroundColor: themeHex || '#ec4899', 
                  color: themeContrastColor === 'black' ? '#000000' : '#ffffff' 
                } : {}}
              >
                {option.icon && <span className="flex-shrink-0">{option.icon}</span>}
                <span className="flex-1 truncate">{option.label}</span>
                {value === option.value && (
                  <svg xmlns="http://www.w3.org/2000/svg" className={`${isSmall ? 'h-3 w-3' : 'h-3.5 w-3.5'} flex-shrink-0`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GlassDropdown;
