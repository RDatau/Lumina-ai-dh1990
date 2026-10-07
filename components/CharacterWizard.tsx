import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wand2, RefreshCw, Plus, ArrowLeft, Sparkles, User, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { AgentConfig, UserProfile } from '../types';
import { generateWizardCharacter, generateWizardProfilePic } from '../services/geminiService';

interface CharacterWizardProps {
  onBack: () => void;
  onAdd: (character: AgentConfig) => void;
  userProfile?: UserProfile;
  themeHex: string;
  isBackgroundDark: boolean;
}

const CharacterWizard: React.FC<CharacterWizardProps> = ({ onBack, onAdd, userProfile, themeHex, isBackgroundDark }) => {
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
  const [generatedData, setGeneratedData] = useState<{
    name: string;
    personality: string;
    imagePrompt: string;
    profilePic: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError('Kasih tau Lumina dulu dong fantasinya kayak gimana... 😉');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedData(null);

    try {
      // Step 1: Generate Text Data
      const data = await generateWizardCharacter(description, userProfile);
      if (!data) throw new Error('Gagal bikin data karakter sayang..');

      setGeneratedData({
        ...data,
        profilePic: null
      });

      // Step 2: Generate Image
      const profilePic = await generateWizardProfilePic(data.imagePrompt, userProfile);
      
      setGeneratedData(prev => prev ? { ...prev, profilePic } : null);
    } catch (err: any) {
      setError(err.message || 'Aduh, ada yang macet nih pas lagi generate.. 🙈');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAdd = () => {
    if (!generatedData) return;

    const newCharacter: AgentConfig = {
      id: Date.now().toString(),
      name: generatedData.name,
      personality: generatedData.personality,
      profilePic: generatedData.profilePic,
      voice: 'Kore',
      background: 'google-theme',
      blur: 40,
      transparency: 0,
      isEnrichPersonaEnabled: false
    };

    onAdd(newCharacter);
  };

  const handleRegenerateImage = async () => {
    if (!generatedData?.imagePrompt) return;
    
    setIsRegeneratingImage(true);
    try {
      const profilePic = await generateWizardProfilePic(generatedData.imagePrompt, userProfile);
      setGeneratedData(prev => prev ? { ...prev, profilePic } : null);
    } catch (err: any) {
      console.error('Failed to regenerate image:', err);
    } finally {
      setIsRegeneratingImage(false);
    }
  };

  return (
    <div className={`flex flex-col h-full font-sans overflow-hidden ${isBackgroundDark ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'}`}>
      {/* Header */}
      <div className={`flex items-center p-4 border-b backdrop-blur-md sticky top-0 z-10 ${isBackgroundDark ? 'border-white/10 bg-zinc-900/50' : 'border-zinc-200 bg-white/80'}`}>
        <button 
          onClick={onBack}
          className={`p-2 rounded-full transition-colors mr-2 ${isBackgroundDark ? 'hover:bg-white/10' : 'hover:bg-zinc-200'}`}
        >
          <ArrowLeft size={24} />
        </button>
        <div className="flex items-center gap-2">
          <Wand2 style={{ color: themeHex }} size={24} />
          <h1 className="text-xl font-semibold tracking-tight">Character Wizard</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Input Section */}
        <section className="space-y-4">
          <div className={`flex items-center gap-2 ${isBackgroundDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
            <Sparkles size={18} />
            <h2 className="text-sm font-medium uppercase tracking-wider">Deskripsikan Fantasimu</h2>
          </div>
          <div className="relative">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Wanita keturunan Jepang-Brazil, rambut panjang bergelombang, mata hijau emerald. Dia adalah seorang detektif yang dingin tapi diam-diam peduli..."
              className={`w-full h-32 rounded-2xl p-4 transition-all resize-none focus:outline-none focus:ring-2 border ${
                isBackgroundDark 
                  ? 'bg-zinc-900/50 border-white/10 text-zinc-100 placeholder:text-zinc-600' 
                  : 'bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
              }`}
              style={{ 
                borderColor: description ? themeHex + '40' : undefined,
                boxShadow: description ? `0 0 0 2px ${themeHex}20` : undefined
              }}
            />
            {error && (
              <p className="text-red-400 text-xs mt-2 ml-2 italic">{error}</p>
            )}
          </div>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-4 disabled:bg-zinc-800 disabled:text-zinc-500 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg text-white"
            style={{ 
              backgroundColor: isGenerating ? undefined : themeHex,
              boxShadow: isGenerating ? undefined : `0 10px 15px -3px ${themeHex}33`
            }}
          >
            {isGenerating ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                <span>Lumina lagi ngeracik... 💦</span>
              </>
            ) : (
              <>
                <Wand2 size={20} />
                <span>Generate Karakter</span>
              </>
            )}
          </button>
        </section>

        {/* Result Section */}
        <AnimatePresence mode="wait">
          {generatedData && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6 pb-8"
            >
              <div className={`h-px ${isBackgroundDark ? 'bg-white/10' : 'bg-zinc-200'}`} />
              
              <div className={`flex items-center gap-2 ${isBackgroundDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                <User size={18} />
                <h2 className="text-sm font-medium uppercase tracking-wider">Hasil Racikan Lumina</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Profile Pic */}
                <div className="md:col-span-1 space-y-3">
                  <div className={`aspect-square rounded-3xl overflow-hidden relative group border ${isBackgroundDark ? 'bg-zinc-900 border-white/10' : 'bg-white border-zinc-200'}`}>
                    {generatedData.profilePic && !isRegeneratingImage ? (
                      <img 
                        src={generatedData.profilePic} 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className={`w-full h-full flex flex-col items-center justify-center gap-3 ${isBackgroundDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                        <Loader2 className="animate-spin" size={32} style={{ color: themeHex }} />
                        <span className="text-sm font-medium">{isRegeneratingImage ? 'Lagi ganti foto... 📸' : 'Lagi gambar... 🎨'}</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleRegenerateImage}
                    disabled={isRegeneratingImage || isGenerating || !generatedData.profilePic}
                    className={`w-full py-2.5 px-4 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all border ${
                      isBackgroundDark 
                        ? 'bg-zinc-900/50 hover:bg-zinc-800 border-white/10 text-zinc-400 hover:text-white' 
                        : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    {isRegeneratingImage ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                    <span>Ganti Foto Aja</span>
                  </button>
                  <p className={`text-[10px] text-center italic ${isBackgroundDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    *Foto profil hasil imajinasi Gemini
                  </p>
                </div>

                {/* Info */}
                <div className="md:col-span-2 space-y-6">
                  <div className="space-y-1">
                    <label className={`text-[10px] uppercase tracking-widest font-bold ${isBackgroundDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Nama Karakter</label>
                    <h3 className={`text-2xl font-bold ${isBackgroundDark ? 'text-white' : 'text-zinc-900'}`}>{generatedData.name}</h3>
                  </div>

                  <div className="space-y-2">
                    <label className={`text-[10px] uppercase tracking-widest font-bold ${isBackgroundDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Personality & Latar Belakang</label>
                    <div className={`rounded-2xl p-4 text-sm leading-relaxed max-h-60 overflow-y-auto border ${
                      isBackgroundDark 
                        ? 'bg-zinc-900/30 border-white/5 text-zinc-300' 
                        : 'bg-white border-zinc-100 text-zinc-700'
                    }`}>
                      {generatedData.personality}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-4">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className={`flex-1 py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all border ${
                    isBackgroundDark 
                      ? 'bg-zinc-800 hover:bg-zinc-700 border-white/5 text-white' 
                      : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-900'
                  }`}
                >
                  <RefreshCw size={20} className={isGenerating ? 'animate-spin' : ''} style={{ color: themeHex }} />
                  <span>Generate Ulang</span>
                </button>
                <button
                  onClick={handleAdd}
                  disabled={isGenerating || !generatedData.profilePic}
                  className={`flex-1 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl ${
                    isGenerating || !generatedData.profilePic
                      ? 'bg-zinc-800 text-zinc-500'
                      : 'text-white'
                  }`}
                  style={{ 
                    backgroundColor: (isGenerating || !generatedData.profilePic) ? undefined : themeHex,
                    boxShadow: (isGenerating || !generatedData.profilePic) ? undefined : `0 10px 20px -5px ${themeHex}44`
                  }}
                >
                  <Plus size={20} />
                  <span>Tambahkan</span>
                </button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CharacterWizard;
