import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RouteErrorBoundaryProps {
    children: ReactNode;
    title?: string;
    description?: string;
    onReset?: () => void;
    resetKey?: string | null;
}

interface RouteErrorBoundaryState {
    hasError: boolean;
}

export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
    state: RouteErrorBoundaryState = {
        hasError: false,
    };

    static getDerivedStateFromError(): RouteErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Route render failed", error, errorInfo);
    }

    componentDidUpdate(prevProps: RouteErrorBoundaryProps) {
        if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
            this.setState({ hasError: false });
        }
    }

    private handleReload = () => {
        this.setState({ hasError: false });
        this.props.onReset?.();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex h-full items-center justify-center p-6">
                    <div className="max-w-md rounded-lg border bg-background p-6 text-center shadow-sm">
                        <AlertCircle className="mx-auto mb-3 h-10 w-10 text-destructive" />
                        <h2 className="text-lg font-semibold">
                            {this.props.title ?? "This page failed to load"}
                        </h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            {this.props.description ?? "A rendering error prevented this view from opening."}
                        </p>
                        <Button className="mt-4" onClick={this.handleReload}>
                            Try again
                        </Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
