import { cn } from "@/lib/utils";

interface LoftLogoProps {
    className?: string;
    size?: "sm" | "md" | "lg" | "xl";
    showText?: boolean;
    variant?: "default" | "light" | "dark";
}

const sizeMap = {
    sm: { icon: 24, text: "text-lg" },
    md: { icon: 32, text: "text-xl" },
    lg: { icon: 40, text: "text-2xl" },
    xl: { icon: 56, text: "text-4xl" },
};

export function LoftLogo({
    className,
    size = "md",
    showText = true,
    variant = "default",
}: LoftLogoProps) {
    const dimensions = sizeMap[size];

    const textColorClass = {
        default: "text-foreground",
        light: "text-white",
        dark: "text-slate-900",
    }[variant];

    return (
        <div className={cn("flex items-center gap-2", className)}>
            {/* Loft Icon - Cloud with upward motion */}
            <svg
                width={dimensions.icon}
                height={dimensions.icon}
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="flex-shrink-0"
            >
                {/* Background glow */}
                <defs>
                    <linearGradient id="loft-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="hsl(168 70% 42%)" />
                        <stop offset="100%" stopColor="hsl(195 80% 45%)" />
                    </linearGradient>
                    <filter id="loft-glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Main cloud shape */}
                <path
                    d="M38 28C40.2091 28 42 26.2091 42 24C42 21.7909 40.2091 20 38 20C37.7348 20 37.4753 20.0229 37.2231 20.0668C37.7162 18.8523 38 17.5088 38 16.1C38 10.5326 33.4674 6 27.9 6C23.4467 6 19.6685 8.92556 18.3289 12.9479C17.5596 12.3422 16.5981 12 15.56 12C13.0399 12 11 14.0399 11 16.56C11 16.8765 11.0316 17.1854 11.0919 17.4838C8.23189 18.1904 6.12 20.7973 6.12 23.9C6.12 27.5794 9.1006 30.56 12.78 30.56H38"
                    fill="url(#loft-gradient)"
                    filter="url(#loft-glow)"
                />

                {/* Upward arrows suggesting lift/floating */}
                <path
                    d="M24 36V42M24 36L20 40M24 36L28 40"
                    stroke="url(#loft-gradient)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="animate-float"
                />
                <path
                    d="M16 38V42M16 38L14 40M16 38L18 40"
                    stroke="url(#loft-gradient)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.6"
                    style={{ animationDelay: "0.2s" }}
                    className="animate-float"
                />
                <path
                    d="M32 38V42M32 38L30 40M32 38L34 40"
                    stroke="url(#loft-gradient)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.6"
                    style={{ animationDelay: "0.4s" }}
                    className="animate-float"
                />
            </svg>

            {showText && (
                <span
                    className={cn(
                        "font-semibold tracking-tight",
                        dimensions.text,
                        textColorClass
                    )}
                >
                    Loft
                </span>
            )}
        </div>
    );
}

// Icon-only version for favicon/small spaces
export function LoftIcon({ size = 32, className }: { size?: number; className?: string }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            <defs>
                <linearGradient id="loft-icon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="hsl(168 70% 42%)" />
                    <stop offset="100%" stopColor="hsl(195 80% 45%)" />
                </linearGradient>
            </defs>
            <path
                d="M38 28C40.2091 28 42 26.2091 42 24C42 21.7909 40.2091 20 38 20C37.7348 20 37.4753 20.0229 37.2231 20.0668C37.7162 18.8523 38 17.5088 38 16.1C38 10.5326 33.4674 6 27.9 6C23.4467 6 19.6685 8.92556 18.3289 12.9479C17.5596 12.3422 16.5981 12 15.56 12C13.0399 12 11 14.0399 11 16.56C11 16.8765 11.0316 17.1854 11.0919 17.4838C8.23189 18.1904 6.12 20.7973 6.12 23.9C6.12 27.5794 9.1006 30.56 12.78 30.56H38"
                fill="url(#loft-icon-gradient)"
            />
            <path
                d="M24 34V42M24 34L20 38M24 34L28 38"
                stroke="url(#loft-icon-gradient)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
