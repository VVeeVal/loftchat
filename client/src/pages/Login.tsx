import { useEffect, useState } from "react";
import { authClient, startGoogleAuth } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AetherCanvas } from "@/components/AetherCanvas";
import { API_URL } from "@/lib/api-client";

function GoogleIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
            <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.3 14.7 2.4 12 2.4 6.8 2.4 2.6 6.6 2.6 11.8S6.8 21.2 12 21.2c6.9 0 9.1-4.8 9.1-7.3 0-.5 0-.9-.1-1.2H12Z" />
            <path fill="#34A853" d="M2.6 11.8c0 1.7.4 3.2 1.2 4.6l3.4-2.6c-.2-.6-.4-1.3-.4-2s.1-1.4.4-2L3.8 7.2c-.8 1.4-1.2 3-1.2 4.6Z" />
            <path fill="#FBBC05" d="M12 21.2c2.7 0 5-.9 6.6-2.5l-3.2-2.5c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.8-5.6-4.2l-3.5 2.7c1.6 3.2 4.9 5.6 9.1 5.6Z" />
            <path fill="#4285F4" d="M18.6 18.7c1.9-1.8 2.5-4.4 2.5-6.9 0-.5 0-.9-.1-1.3H12v3.9h5.4c-.3 1.5-1.1 2.8-2.3 3.7l3.5 2.7Z" />
        </svg>
    );
}

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
    const [isFinalizingOAuth, setIsFinalizingOAuth] = useState(false);
    const [hasHandledOAuthCallback, setHasHandledOAuthCallback] = useState(false);
    const [googleOAuthEnabled, setGoogleOAuthEnabled] = useState(false);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");
    const oauthComplete = searchParams.get("oauth") === "complete";
    const oauthError = searchParams.get("error");
    const { data: session } = authClient.useSession();

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await fetch(`${API_URL}/auth/status`, {
                    credentials: "include",
                });
                if (!res.ok) return;
                const data = await res.json();
                setGoogleOAuthEnabled(Boolean(data.googleOAuthEnabled));
            } catch (statusError) {
                console.error("Failed to check auth status", statusError);
            }
        };

        checkStatus();
    }, []);

    useEffect(() => {
        if (!oauthError) {
            return;
        }

        setError("Google sign-in failed. Please try again.");
    }, [oauthError]);

    useEffect(() => {
        if (!session || isFinalizingOAuth || hasHandledOAuthCallback) {
            return;
        }

        if (!oauthComplete) {
            navigate("/");
            return;
        }

        if (!token) {
            navigate("/");
            return;
        }

        const finalizeGoogleInvite = async () => {
            setHasHandledOAuthCallback(true);
            setIsFinalizingOAuth(true);
            setError("");

            try {
                const response = await fetch(`${API_URL}/auth/oauth/finalize`, {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ token }),
                });

                if (!response.ok) {
                    const data = await response.json().catch(() => null);
                    setError(data?.error || "Failed to join organization");
                    return;
                }

                navigate("/");
            } catch (finalizeError) {
                console.error("Failed to finalize Google sign-in", finalizeError);
                setError("Failed to join organization. Please try again.");
            } finally {
                setIsFinalizingOAuth(false);
            }
        };

        finalizeGoogleInvite();
    }, [session, oauthComplete, token, navigate, isFinalizingOAuth, hasHandledOAuthCallback]);

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

    const handleGoogleLogin = async () => {
        setError("");
        setIsGoogleSubmitting(true);

        try {
            const callbackURL = new URL(window.location.pathname, window.location.origin);
            callbackURL.searchParams.set("oauth", "complete");
            if (token) {
                callbackURL.searchParams.set("token", token);
            }

            await startGoogleAuth({
                callbackURL: callbackURL.toString(),
                token,
            });
        } catch (googleError) {
            console.error("Google sign-in failed", googleError);
            setError("Google sign-in failed. Please try again.");
            setIsGoogleSubmitting(false);
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
                            <img
                                src="/loft-logo-no-bg.png"
                                alt="Loft"
                                className="h-20 w-auto sm:h-24"
                            />
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
                            disabled={isSubmitting || isGoogleSubmitting || isFinalizingOAuth}
                        >
                            {isSubmitting ? "Signing in..." : "Sign In"}
                        </Button>
                        {googleOAuthEnabled && (
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full h-11 font-medium bg-white/70"
                                onClick={handleGoogleLogin}
                                disabled={isSubmitting || isGoogleSubmitting || isFinalizingOAuth}
                            >
                                <GoogleIcon />
                                {isGoogleSubmitting ? "Redirecting..." : "Continue with Google"}
                            </Button>
                        )}
                        <div className="text-center text-sm text-muted-foreground">
                            Don't have an account?{" "}
                            <Link
                                to={token ? `/register?token=${encodeURIComponent(token)}` : "/register"}
                                className="text-primary font-medium hover:underline"
                            >
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
