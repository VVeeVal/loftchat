import { useState, useEffect } from 'react';

/**
 * Custom hook to detect breakpoints and screen sizes
 * Returns boolean states for mobile, tablet, and desktop
 */
export function useMediaQuery() {
  // Using Tailwind's default breakpoints:
  // sm: 640px, md: 768px, lg: 1024px, xl: 1280px
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    // Safety check for SSR or environments without window
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    // Media query strings matching Tailwind breakpoints
    const mobileQuery = window.matchMedia('(max-width: 767px)');
    const tabletQuery = window.matchMedia('(min-width: 768px) and (max-width: 1023px)');
    const desktopQuery = window.matchMedia('(min-width: 1024px)');

    // Update state based on current matches
    const updateMatches = () => {
      setIsMobile(mobileQuery.matches);
      setIsTablet(tabletQuery.matches);
      setIsDesktop(desktopQuery.matches);
    };

    // Set initial values
    updateMatches();

    // Add event listeners for changes
    // Use addListener for older Safari compatibility
    if (mobileQuery.addEventListener) {
      mobileQuery.addEventListener('change', updateMatches);
      tabletQuery.addEventListener('change', updateMatches);
      desktopQuery.addEventListener('change', updateMatches);
    } else {
      // Fallback for older Safari versions
      (mobileQuery as any).addListener(updateMatches);
      (tabletQuery as any).addListener(updateMatches);
      (desktopQuery as any).addListener(updateMatches);
    }

    // Cleanup
    return () => {
      if (mobileQuery.removeEventListener) {
        mobileQuery.removeEventListener('change', updateMatches);
        tabletQuery.removeEventListener('change', updateMatches);
        desktopQuery.removeEventListener('change', updateMatches);
      } else {
        // Fallback for older Safari versions
        (mobileQuery as any).removeListener(updateMatches);
        (tabletQuery as any).removeListener(updateMatches);
        (desktopQuery as any).removeListener(updateMatches);
      }
    };
  }, []);

  return {
    isMobile,  // < 768px
    isTablet,  // 768px - 1023px
    isDesktop, // >= 1024px
  };
}
