import { useMemo } from "react";

interface FloatingOrb {
    id: number;
    size: number;
    x: number;
    y: number;
    delay: number;
    duration: number;
}

export function AetherCanvas() {
    // Generate floating orbs with random positions
    const orbs = useMemo<FloatingOrb[]>(() => {
        return Array.from({ length: 8 }, (_, i) => ({
            id: i,
            size: 60 + Math.random() * 120,
            x: Math.random() * 100,
            y: Math.random() * 100,
            delay: Math.random() * 5,
            duration: 6 + Math.random() * 6,
        }));
    }, []);

    return (
        <div className="aether-canvas" aria-hidden="true">
            {/* Cloud layers */}
            <div className="cloud-layer cloud-layer-1">
                <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 1440 320" className="opacity-40">
                    <path
                        fill="currentColor"
                        className="text-white dark:text-white/5"
                        d="M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
                    />
                </svg>
            </div>

            <div className="cloud-layer cloud-layer-2" style={{ top: "20%" }}>
                <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 1440 320" className="opacity-30">
                    <path
                        fill="currentColor"
                        className="text-white dark:text-white/5"
                        d="M0,64L48,80C96,96,192,128,288,128C384,128,480,96,576,90.7C672,85,768,107,864,128C960,149,1056,171,1152,165.3C1248,160,1344,128,1392,112L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
                    />
                </svg>
            </div>

            <div className="cloud-layer cloud-layer-3" style={{ top: "50%" }}>
                <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 1440 320" className="opacity-20">
                    <path
                        fill="currentColor"
                        className="text-white dark:text-white/5"
                        d="M0,256L48,240C96,224,192,192,288,181.3C384,171,480,181,576,197.3C672,213,768,235,864,218.7C960,203,1056,149,1152,138.7C1248,128,1344,160,1392,176L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
                    />
                </svg>
            </div>

            {/* Floating orbs */}
            {orbs.map((orb) => (
                <div
                    key={orb.id}
                    className="floating-orb"
                    style={{
                        width: orb.size,
                        height: orb.size,
                        left: `${orb.x}%`,
                        top: `${orb.y}%`,
                        animationDelay: `${orb.delay}s`,
                        animationDuration: `${orb.duration}s`,
                    }}
                />
            ))}

            {/* Grain texture overlay */}
            <div className="grain-overlay" />
        </div>
    );
}

// Simpler version for pages that need less visual distraction
export function AetherCanvasSimple() {
    return (
        <div className="aether-canvas" aria-hidden="true">
            <div className="grain-overlay" />
        </div>
    );
}
