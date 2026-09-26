import React from 'react';
import patternImg from '../assets/images/islamic_seamless_pattern_1790363690046.jpg';

/**
 * IslamicBackground
 * Places the seamless Islamic geometric arabesque pattern subtly around the corners
 * and edges of the application with soft fading edges, ~10% opacity, and a sophisticated
 * monochromatic appearance, leaving the center area clean and empty so UI elements and
 * text remain perfectly legible.
 */
export const IslamicBackground: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none no-print"
      style={{ isolation: 'isolate' }}
    >
      {/* 1. Fullscreen Vignette Pattern:
          Repeats seamlessly along corners and edges with a soft radial fade leaving the center empty.
      */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${patternImg})`,
          backgroundRepeat: 'repeat',
          backgroundSize: '160px 160px',
          opacity: 0.10,
          filter: 'grayscale(100%) contrast(115%) brightness(95%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 75% 65% at 50% 50%, transparent 35%, rgba(0, 0, 0, 0.35) 65%, black 100%)',
          maskImage:
            'radial-gradient(ellipse 75% 65% at 50% 50%, transparent 35%, rgba(0, 0, 0, 0.35) 65%, black 100%)',
        }}
      />

      {/* 2. Top-Left Corner Accent with Soft Radial Fade */}
      <div
        className="absolute top-0 left-0 w-80 h-80 sm:w-[420px] sm:h-[420px] lg:w-[500px] lg:h-[500px]"
        style={{
          backgroundImage: `url(${patternImg})`,
          backgroundRepeat: 'repeat',
          backgroundSize: '150px 150px',
          opacity: 0.10,
          filter: 'grayscale(100%) contrast(120%)',
          WebkitMaskImage:
            'radial-gradient(circle at 0% 0%, black 20%, rgba(0, 0, 0, 0.45) 55%, transparent 80%)',
          maskImage:
            'radial-gradient(circle at 0% 0%, black 20%, rgba(0, 0, 0, 0.45) 55%, transparent 80%)',
        }}
      />

      {/* 3. Top-Right Corner Accent with Soft Radial Fade */}
      <div
        className="absolute top-0 right-0 w-80 h-80 sm:w-[420px] sm:h-[420px] lg:w-[500px] lg:h-[500px]"
        style={{
          backgroundImage: `url(${patternImg})`,
          backgroundRepeat: 'repeat',
          backgroundSize: '150px 150px',
          opacity: 0.10,
          filter: 'grayscale(100%) contrast(120%)',
          WebkitMaskImage:
            'radial-gradient(circle at 100% 0%, black 20%, rgba(0, 0, 0, 0.45) 55%, transparent 80%)',
          maskImage:
            'radial-gradient(circle at 100% 0%, black 20%, rgba(0, 0, 0, 0.45) 55%, transparent 80%)',
        }}
      />

      {/* 4. Bottom-Left Corner Accent with Soft Radial Fade */}
      <div
        className="absolute bottom-0 left-0 w-80 h-80 sm:w-[420px] sm:h-[420px] lg:w-[500px] lg:h-[500px]"
        style={{
          backgroundImage: `url(${patternImg})`,
          backgroundRepeat: 'repeat',
          backgroundSize: '150px 150px',
          opacity: 0.10,
          filter: 'grayscale(100%) contrast(120%)',
          WebkitMaskImage:
            'radial-gradient(circle at 0% 100%, black 20%, rgba(0, 0, 0, 0.45) 55%, transparent 80%)',
          maskImage:
            'radial-gradient(circle at 0% 100%, black 20%, rgba(0, 0, 0, 0.45) 55%, transparent 80%)',
        }}
      />

      {/* 5. Bottom-Right Corner Accent with Soft Radial Fade */}
      <div
        className="absolute bottom-0 right-0 w-80 h-80 sm:w-[420px] sm:h-[420px] lg:w-[500px] lg:h-[500px]"
        style={{
          backgroundImage: `url(${patternImg})`,
          backgroundRepeat: 'repeat',
          backgroundSize: '150px 150px',
          opacity: 0.10,
          filter: 'grayscale(100%) contrast(120%)',
          WebkitMaskImage:
            'radial-gradient(circle at 100% 100%, black 20%, rgba(0, 0, 0, 0.45) 55%, transparent 80%)',
          maskImage:
            'radial-gradient(circle at 100% 100%, black 20%, rgba(0, 0, 0, 0.45) 55%, transparent 80%)',
        }}
      />

      {/* 6. Soft Top Edge Fade Border */}
      <div
        className="absolute top-0 inset-x-0 h-24 sm:h-32"
        style={{
          backgroundImage: `url(${patternImg})`,
          backgroundRepeat: 'repeat-x',
          backgroundSize: '140px 140px',
          opacity: 0.08,
          filter: 'grayscale(100%) contrast(110%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, rgba(0, 0, 0, 0.3) 60%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, black 0%, rgba(0, 0, 0, 0.3) 60%, transparent 100%)',
        }}
      />

      {/* 7. Soft Bottom Edge Fade Border */}
      <div
        className="absolute bottom-0 inset-x-0 h-24 sm:h-32"
        style={{
          backgroundImage: `url(${patternImg})`,
          backgroundRepeat: 'repeat-x',
          backgroundSize: '140px 140px',
          opacity: 0.08,
          filter: 'grayscale(100%) contrast(110%)',
          WebkitMaskImage: 'linear-gradient(to top, black 0%, rgba(0, 0, 0, 0.3) 60%, transparent 100%)',
          maskImage: 'linear-gradient(to top, black 0%, rgba(0, 0, 0, 0.3) 60%, transparent 100%)',
        }}
      />

      {/* 8. Soft Left Edge Fade Border */}
      <div
        className="absolute left-0 inset-y-0 w-24 sm:w-32 hidden md:block"
        style={{
          backgroundImage: `url(${patternImg})`,
          backgroundRepeat: 'repeat-y',
          backgroundSize: '140px 140px',
          opacity: 0.08,
          filter: 'grayscale(100%) contrast(110%)',
          WebkitMaskImage: 'linear-gradient(to right, black 0%, rgba(0, 0, 0, 0.3) 60%, transparent 100%)',
          maskImage: 'linear-gradient(to right, black 0%, rgba(0, 0, 0, 0.3) 60%, transparent 100%)',
        }}
      />

      {/* 9. Soft Right Edge Fade Border */}
      <div
        className="absolute right-0 inset-y-0 w-24 sm:w-32 hidden md:block"
        style={{
          backgroundImage: `url(${patternImg})`,
          backgroundRepeat: 'repeat-y',
          backgroundSize: '140px 140px',
          opacity: 0.08,
          filter: 'grayscale(100%) contrast(110%)',
          WebkitMaskImage: 'linear-gradient(to left, black 0%, rgba(0, 0, 0, 0.3) 60%, transparent 100%)',
          maskImage: 'linear-gradient(to left, black 0%, rgba(0, 0, 0, 0.3) 60%, transparent 100%)',
        }}
      />
    </div>
  );
};
