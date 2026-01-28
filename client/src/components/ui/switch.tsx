import { useId } from 'react';

interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    onCheckedChange?: (checked: boolean) => void;
}

export function Switch({
    label,
    className = '',
    onCheckedChange,
    onChange,
    ...props
}: SwitchProps) {
    const id = useId();
    const handleChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
        onChange?.(event);
        onCheckedChange?.(event.target.checked);
    };

    return (
        <label htmlFor={id} className={`inline-flex items-center gap-2 ${className}`}>
            <span className="relative inline-flex h-5 w-9 items-center rounded-full bg-gray-200 transition-colors">
                <input
                    id={id}
                    type="checkbox"
                    className="peer sr-only"
                    onChange={handleChange}
                    {...props}
                />
                <span className="pointer-events-none absolute left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
            </span>
            {label && <span className="text-sm text-gray-600">{label}</span>}
        </label>
    );
}
