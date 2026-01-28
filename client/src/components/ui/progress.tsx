interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
    value?: number;
    max?: number;
}

export function Progress({ value = 0, max = 100, className = '', ...props }: ProgressProps) {
    const percent = Math.max(0, Math.min(100, (value / max) * 100));
    return (
        <div className={`w-full h-2 bg-gray-200 rounded-full overflow-hidden ${className}`} {...props}>
            <div
                className="h-full bg-gradient-to-r from-[#7c3aed] to-[#4f46e5]"
                style={{ width: `${percent}%` }}
            />
        </div>
    );
}
