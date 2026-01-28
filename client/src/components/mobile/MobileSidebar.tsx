import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SidebarContent } from "@/components/Sidebar";
import { useMobile } from "@/contexts/MobileContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export function MobileSidebar() {
  const { isSidebarOpen, closeSidebar } = useMobile();
  const { isMobile } = useMediaQuery();

  // Only render on mobile devices
  if (!isMobile) return null;

  return (
    <Sheet open={isSidebarOpen} onOpenChange={closeSidebar}>
      <SheetContent side="left" className="w-[80vw] max-w-sm p-0">
        <SidebarContent onNavigate={closeSidebar} />
      </SheetContent>
    </Sheet>
  );
}
