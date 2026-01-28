import { authClient } from "@/lib/auth-client";
import { Outlet, Navigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import { OrganizationProvider, useOrganization } from "@/contexts/OrganizationContext";
import { PresenceProvider } from "@/contexts/PresenceContext";
import { MobileProvider } from "@/contexts/MobileContext";
import { NotificationHandler } from "@/components/NotificationHandler";
import { MobileSidebar } from "@/components/mobile/MobileSidebar";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { AetherCanvasSimple } from "@/components/AetherCanvas";
import { LoftLogo } from "@/components/LoftLogo";

function LoadingScreen() {
    return (
        <div className="relative flex h-screen items-center justify-center overflow-hidden">
            <AetherCanvasSimple />
            <div className="relative z-10 flex flex-col items-center gap-4 animate-fade-in">
                <LoftLogo size="xl" />
                <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="text-sm">Loading...</span>
                </div>
            </div>
        </div>
    );
}

function ErrorScreen({ message, description }: { message: string; description: string }) {
    return (
        <div className="relative flex h-screen items-center justify-center overflow-hidden">
            <AetherCanvasSimple />
            <div className="relative z-10 text-center animate-fade-in-up">
                <div className="mb-4">
                    <LoftLogo size="lg" />
                </div>
                <p className="text-destructive font-medium">{message}</p>
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
            </div>
        </div>
    );
}

function AppLayoutContent() {
    const { data: session, isPending } = authClient.useSession();
    const { loading: orgLoading, currentOrganization, error } = useOrganization();

    if (isPending || orgLoading) {
        return <LoadingScreen />;
    }

    if (!session) {
        return <Navigate to="/login" />;
    }

    if (error) {
        return (
            <ErrorScreen
                message="Error loading organizations"
                description={error}
            />
        );
    }

    if (!currentOrganization) {
        return (
            <ErrorScreen
                message="No organization assigned"
                description="Ask a workspace admin to add you to an organization."
            />
        );
    }

    return (
        <div className="flex h-screen w-full overflow-hidden bg-background">
            <NotificationHandler />

            {/* Desktop Sidebar - Hidden on mobile */}
            <div className="hidden md:block">
                <Sidebar />
            </div>

            {/* Mobile Sidebar Sheet */}
            <MobileSidebar />

            <main className="flex-1 flex flex-col h-full overflow-hidden bg-white/50 dark:bg-background">
                {/* Mobile Header with Hamburger */}
                <MobileHeader />
                <Outlet />
            </main>
        </div>
    );
}

export default function AppLayout() {
    return (
        <OrganizationProvider>
            <PresenceProvider>
                <MobileProvider>
                    <AppLayoutContent />
                </MobileProvider>
            </PresenceProvider>
        </OrganizationProvider>
    );
}
