/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
    theme: {
        extend: {
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)'
            },
            colors: {
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))'
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))'
                },
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))'
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))'
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))'
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))'
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))'
                },
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                chart: {
                    '1': 'hsl(var(--chart-1))',
                    '2': 'hsl(var(--chart-2))',
                    '3': 'hsl(var(--chart-3))',
                    '4': 'hsl(var(--chart-4))',
                    '5': 'hsl(var(--chart-5))'
                },
                // Loft Brand Colors
                loft: {
                    sky: 'hsl(var(--loft-sky))',
                    lavender: 'hsl(var(--loft-lavender))',
                    peach: 'hsl(var(--loft-peach))',
                    mint: 'hsl(var(--loft-mint))',
                    'mint-light': 'hsl(var(--loft-mint-light))',
                    glow: 'hsl(var(--loft-glow))',
                    cloud: 'hsl(var(--loft-cloud))'
                },
                // Sidebar Colors
                sidebar: {
                    DEFAULT: 'hsl(var(--sidebar-bg))',
                    border: 'hsl(var(--sidebar-border))',
                    text: 'hsl(var(--sidebar-text))',
                    'text-muted': 'hsl(var(--sidebar-text-muted))',
                    hover: 'hsl(var(--sidebar-hover))',
                    active: 'hsl(var(--sidebar-active))',
                    'active-text': 'hsl(var(--sidebar-active-text))'
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
            },
            boxShadow: {
                'loft': '0 4px 6px -1px hsl(var(--loft-mint) / 0.1), 0 2px 4px -2px hsl(var(--loft-mint) / 0.1)',
                'loft-lg': '0 10px 15px -3px hsl(var(--loft-mint) / 0.1), 0 4px 6px -4px hsl(var(--loft-mint) / 0.1)',
                'loft-glow': '0 0 20px hsl(var(--loft-mint) / 0.3)',
                'cloud': '0 8px 32px -8px rgba(0, 0, 0, 0.08)',
                'cloud-lg': '0 16px 48px -12px rgba(0, 0, 0, 0.1)',
            },
            animation: {
                'float': 'float-gentle 6s ease-in-out infinite',
                'float-slow': 'float-gentle 8s ease-in-out infinite',
                'float-fast': 'float-gentle 4s ease-in-out infinite',
                'drift': 'drift-slow 120s linear infinite',
                'drift-medium': 'drift-medium 90s linear infinite',
                'drift-fast': 'drift-fast 60s linear infinite',
                'pulse-soft': 'pulse-soft 4s ease-in-out infinite',
                'fade-in': 'fade-in 0.3s ease-out',
                'fade-in-up': 'fade-in-up 0.4s ease-out',
                'scale-in': 'scale-in 0.2s ease-out',
            },
            keyframes: {
                'float-gentle': {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
                'drift-slow': {
                    from: { transform: 'translateX(0)' },
                    to: { transform: 'translateX(-50%)' },
                },
                'drift-medium': {
                    from: { transform: 'translateX(0)' },
                    to: { transform: 'translateX(-50%)' },
                },
                'drift-fast': {
                    from: { transform: 'translateX(0)' },
                    to: { transform: 'translateX(-50%)' },
                },
                'pulse-soft': {
                    '0%, 100%': { opacity: '0.6' },
                    '50%': { opacity: '0.8' },
                },
                'fade-in': {
                    from: { opacity: '0' },
                    to: { opacity: '1' },
                },
                'fade-in-up': {
                    from: { opacity: '0', transform: 'translateY(10px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                'scale-in': {
                    from: { opacity: '0', transform: 'scale(0.95)' },
                    to: { opacity: '1', transform: 'scale(1)' },
                },
            },
            backgroundImage: {
                'gradient-loft': 'linear-gradient(135deg, hsl(var(--loft-mint)) 0%, hsl(168 70% 50%) 100%)',
                'gradient-loft-subtle': 'linear-gradient(135deg, hsl(var(--loft-sky)) 0%, hsl(var(--loft-lavender)) 50%, hsl(var(--loft-peach)) 100%)',
                'gradient-aether': 'linear-gradient(180deg, hsl(var(--loft-sky)) 0%, hsl(var(--loft-lavender)) 50%, hsl(var(--loft-peach)) 100%)',
            },
        }
    },
    plugins: [require("tailwindcss-animate")],
}
