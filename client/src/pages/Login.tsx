import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Link, useNavigate } from "react-router-dom";
import { AetherCanvas } from "@/components/AetherCanvas";
import { LoftLogo } from "@/components/LoftLogo";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();
    const { data: session } = authClient.useSession();

    useEffect(() => {
        if (session) {
            navigate("/");
        }
    }, [session, navigate]);

    const handleLogin = async () => {
        setError("");
        setIsSubmitting(true);
        try {
            await authClient.signIn.email(
                {
                    email,
                    password,
                },
                {
                    onError: (ctx) => {
                        setError(ctx?.error?.message || "Login failed");
                    },
                }
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !isSubmitting) {
            handleLogin();
        }
    };

    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
            <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                    backgroundImage: "url('/backdrop.png')",
                    filter: "brightness(0.7) contrast(1.05)"
                }}
            />
            <div className="absolute inset-0 bg-black/30" />
            <AetherCanvas />

            <div className="relative z-10 w-full max-w-md px-4 animate-fade-in-up">
                <Card className="border-0 shadow-cloud-lg bg-white/80 dark:bg-card/80 backdrop-blur-xl">
                    <CardHeader className="space-y-4 pb-4">
                        <div className="flex justify-center">
                            <LoftLogo size="lg" />
                        </div>
                        <div className="text-center space-y-1">
                            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
                            <p className="text-sm text-muted-foreground">
                                Sign in to continue to your workspace
                            </p>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-3">
                            <Input
                                placeholder="Email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="h-11 bg-white/50 dark:bg-white/5 border-border/50 focus:border-primary focus:ring-primary/20"
                            />
                            <Input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="h-11 bg-white/50 dark:bg-white/5 border-border/50 focus:border-primary focus:ring-primary/20"
                            />
                        </div>
                        {error && (
                            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                                {error}
                            </div>
                        )}
                        <Button
                            className="w-full h-11 font-medium shadow-loft hover:shadow-loft-lg transition-all"
                            onClick={handleLogin}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Signing in..." : "Sign In"}
                        </Button>
                        <div className="text-center text-sm text-muted-foreground">
                            Don't have an account?{" "}
                            <Link to="/register" className="text-primary font-medium hover:underline">
                                Register
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                <p className="mt-6 text-center text-xs text-muted-foreground/60">
                    Where your team can breathe
                </p>
            </div>
        </div>
    );
}
