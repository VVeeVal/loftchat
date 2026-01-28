import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoftLogo } from "@/components/LoftLogo";
import { useMobile } from "@/contexts/MobileContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export function MobileHeader() {
  const { openSidebar } = useMobile();
  const { isMobile } = useMediaQuery();

  // Only render on mobile devices
  if (!isMobile) return null;

  return (
    <div className="md:hidden h-14 border-b border-border/50 flex items-center px-4 bg-white/80 dark:bg-card/80 backdrop-blur-sm sticky top-0 z-10">
      <Button
        variant="ghost"
        size="icon"
        className="h-11 w-11 flex-shrink-0"
        onClick={openSidebar}
        aria-label="Open sidebar"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <div className="ml-3 flex items-center">
        <LoftLogo size="sm" />
      </div>
    </div>
  );
}
