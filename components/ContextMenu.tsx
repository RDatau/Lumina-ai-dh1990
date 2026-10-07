import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
  targetElement?: HTMLElement | null;
  isBackgroundDark?: boolean;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose, targetElement, isBackgroundDark = true }) => {
  // Pastikan menu tidak keluar layar
  const menuWidth = 180;
  const menuHeight = items.length * 44 + 16;
  
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10);

  // Fungsi pembantu untuk aksi input
  const handleInputActions = async (action: string) => {
    if (!targetElement) return;
    const isInput = targetElement instanceof HTMLInputElement || targetElement instanceof HTMLTextAreaElement;
    if (!isInput) return;
    
    const el = targetElement as HTMLInputElement | HTMLTextAreaElement;
    const val = el.value || '';
    
    try {
      switch (action) {
        case 'cut':
          if (el.selectionStart !== null && el.selectionEnd !== null) {
            const selectedText = val.substring(el.selectionStart, el.selectionEnd);
            await navigator.clipboard.writeText(selectedText);
            const newValue = val.substring(0, el.selectionStart) + val.substring(el.selectionEnd);
            el.value = newValue;
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
          break;
        case 'copy':
          if (el.selectionStart !== null && el.selectionEnd !== null) {
            const selectedText = val.substring(el.selectionStart, el.selectionEnd);
            await navigator.clipboard.writeText(selectedText);
          }
          break;
        case 'paste':
          const text = await navigator.clipboard.readText();
          if (el.selectionStart !== null && el.selectionEnd !== null) {
            const newValue = val.substring(0, el.selectionStart) + text + val.substring(el.selectionEnd);
            el.value = newValue;
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
          break;
        case 'selectall':
          el.select();
          break;
      }
    } catch (err) {
      console.error('Gagal melakukan aksi input:', err);
    }
    onClose();
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[10000]" 
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -5 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          style={{ 
            left: adjustedX, 
            top: adjustedY, 
            zIndex: 10001,
            backgroundColor: isBackgroundDark ? 'rgba(15, 15, 15, 0.5)' : 'rgba(255, 255, 255, 0.5)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)'
          }}
          className={`absolute w-44 glass-menu rounded-2xl border shadow-2xl overflow-hidden py-2 ${isBackgroundDark ? 'border-white/10' : 'border-black/10'}`}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item, idx) => (
            <button
              key={idx}
              onClick={() => {
                // Jika label mengandung kata kunci aksi input, kita tangani secara khusus
                // HANYA jika target adalah elemen input
                const lowerLabel = item.label.toLowerCase();
                const isInput = targetElement instanceof HTMLInputElement || targetElement instanceof HTMLTextAreaElement;
                
                if (isInput && (lowerLabel.includes('cut') || lowerLabel.includes('potong'))) {
                  handleInputActions('cut');
                } else if (isInput && (lowerLabel.includes('copy') || lowerLabel.includes('salin'))) {
                  handleInputActions('copy');
                } else if (isInput && (lowerLabel.includes('paste') || lowerLabel.includes('tempel'))) {
                  handleInputActions('paste');
                } else if (isInput && (lowerLabel.includes('select all') || lowerLabel.includes('pilih semua'))) {
                  handleInputActions('selectall');
                } else {
                  item.onClick();
                  onClose();
                }
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left
                ${item.variant === 'danger' 
                  ? (isBackgroundDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-500/5')
                  : (isBackgroundDark ? 'text-white/90 hover:bg-white/5' : 'text-black/80 hover:bg-black/5')
                }`}
            >
              {item.icon && <span className="opacity-70">{item.icon}</span>}
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ContextMenu;
