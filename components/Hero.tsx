
import React from 'react';

interface HeroProps {
  onShare: () => void;
  onExploreMenu: () => void;
}

const Hero: React.FC<HeroProps> = ({ onShare, onExploreMenu }) => {
  return (
    <div className="relative min-h-[65vh] md:h-[85vh] flex items-center overflow-hidden">
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center transition-transform duration-[10000ms] hover:scale-110"
        style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1594007654729-407eedc4be65?auto=format&fit=crop&w=1920&q=80)' }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/40 to-transparent z-10" />

      <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-12 md:py-0">
        <div className="max-w-2xl">
          <span className="inline-block py-1 px-4 bg-red-600 text-white text-[10px] font-bold uppercase tracking-[0.2em] rounded-full mb-4 md:mb-6 animate-pulse">
            Voted Best Pizza 2025
          </span>
          <h1 className="text-4xl md:text-8xl font-display text-white mb-4 md:mb-6 leading-tight">
            The Art of <br />
            <span className="text-red-500">Perfect Dough.</span>
          </h1>
          <p className="text-base md:text-xl text-white/80 mb-8 md:mb-10 leading-relaxed font-light">
            Indulge in Harino's handcrafted recipes. BECAUSE HARI KNOWS exactly how to bake the perfect pizza.
          </p>
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
            <button 
              onClick={onExploreMenu}
              className="px-8 md:px-10 py-4 md:py-5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all transform hover:scale-105 shadow-xl shadow-red-900/20 uppercase tracking-widest text-[10px] md:text-xs"
            >
              Explore Menu
            </button>
            <button 
              onClick={onShare}
              className="px-8 md:px-10 py-4 md:py-5 bg-white/10 hover:bg-white/20 text-white border border-white/30 backdrop-blur-sm rounded-xl font-bold transition-all uppercase tracking-widest text-[10px] md:text-xs flex items-center justify-center space-x-3"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 100 6 3 3 0 000-6z" />
              </svg>
              <span>Share The Love</span>
            </button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 md:bottom-10 right-6 md:right-10 hidden sm:block z-20">
        <div className="bg-white/10 backdrop-blur-md p-4 md:p-6 rounded-3xl border border-white/20 flex items-center space-x-4 text-white">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-500 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
          <div>
            <div className="font-bold text-sm md:text-lg">Pure Veg Kitchen</div>
            <div className="text-white/60 text-[8px] md:text-[10px] uppercase tracking-widest font-bold">Because Hari Knows</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
