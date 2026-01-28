import { toast } from 'sonner';

export interface Toast {
    title: string;
    description?: string;
    variant?: 'default' | 'destructive';
}

export function useToast() {
    return {
        toast: (options: Toast) => {
            if (options.variant === 'destructive') {
                toast.error(options.title, {
                    description: options.description
                });
            } else {
                toast.success(options.title, {
                    description: options.description
                });
            }
        }
    };
}
