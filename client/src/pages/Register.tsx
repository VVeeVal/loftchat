import { useState, useEffect } from "react";
import { authClient, startGoogleAuth } from "@/lib/auth-client";
import { API_URL } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AetherCanvas } from "@/components/AetherCanvas";

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

export default function Register() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
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

    // Check workspace status on mount
    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await fetch(`${API_URL}/auth/status`, {
                    credentials: 'include'
                });
                if (res.ok) {
                    const data = await res.json();
                    setIsInitialized(data.hasUsers);
                    setGoogleOAuthEnabled(Boolean(data.googleOAuthEnabled));

                    // If workspace is initialized but no token, show error
                    if (data.hasUsers && !token) {
                        setError("Registration requires an invitation link. Please use a valid invitation link to register.");
                    }
                }
            } catch (error) {
                console.error('Failed to check workspace status', error);
            }
        };

        checkStatus();
    }, [token]);

    useEffect(() => {
        if (!oauthError) {
            return;
        }

        setError("Google sign-up failed. Please try again.");
    }, [oauthError]);

    useEffect(() => {
        if (!session || isFinalizingOAuth || hasHandledOAuthCallback) {
            return;
        }

        if (oauthComplete && token) {
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
                        setError(data?.error || "Failed to join workspace");
                        return;
                    }

                    navigate("/");
                } catch (finalizeError) {
                    console.error("Failed to finalize Google sign-up", finalizeError);
                    setError("Failed to join workspace. Please try again.");
                } finally {
                    setIsFinalizingOAuth(false);
                }
            };

            finalizeGoogleInvite();
            return;
        }

        navigate("/");
    }, [session, oauthComplete, token, navigate, isFinalizingOAuth, hasHandledOAuthCallback]);

    const handleRegister = async () => {
        setError("");

        // If workspace is initialized and no token, prevent registration
        if (isInitialized && !token) {
            setError("Registration requires an invitation link. Please use a valid invitation link to register.");
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await fetch(`${API_URL}/auth/sign-up`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    password,
                    name,
                    token: token || undefined,
                }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                setError(data?.error || 'Registration failed');
                return;
            }

            navigate("/");
        } catch {
            setError('Registration failed. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGoogleSignUp = async () => {
        if (isInitialized) {
            if (!token) {
                setError("Registration requires an invitation link. Please use a valid invitation link to register.");
                return;
            }
        } else if (isInitialized === false) {
            setError("Use email and password to create the first workspace admin account.");
            return;
        }

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
                requestSignUp: true,
                token,
            });
        } catch (googleError) {
            console.error("Google sign-up failed", googleError);
            setError("Google sign-up failed. Please try again.");
            setIsGoogleSubmitting(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !isSubmitting) {
            handleRegister();
        }
    };

    const isFirstUser = isInitialized === false;

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
                            <h1 className="text-2xl font-semibold tracking-tight">
                                {isFirstUser ? "Create your workspace" : "Join your team"}
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                {isFirstUser
                                    ? "Set up your account to get started"
                                    : "Create your account to join the workspace"
                                }
                            </p>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-3">
                            <Input
                                placeholder="Full Name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="h-11 bg-white/50 dark:bg-white/5 border-border/50 focus:border-primary focus:ring-primary/20"
                            />
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
                            onClick={handleRegister}
                            disabled={isSubmitting || isGoogleSubmitting || isFinalizingOAuth}
                        >
                            {isSubmitting ? "Creating account..." : (isFirstUser ? "Create Workspace" : "Sign Up")}
                        </Button>
                        {googleOAuthEnabled && !isFirstUser && (
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full h-11 font-medium bg-white/70"
                                onClick={handleGoogleSignUp}
                                disabled={isSubmitting || isGoogleSubmitting || isFinalizingOAuth}
                            >
                                <GoogleIcon />
                                {isGoogleSubmitting ? "Redirecting..." : "Continue with Google"}
                            </Button>
                        )}
                        <div className="text-center text-sm text-muted-foreground">
                            Already have an account?{" "}
                            <Link
                                to={token ? `/login?token=${encodeURIComponent(token)}` : "/login"}
                                className="text-primary font-medium hover:underline"
                            >
                                Sign in
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                <p className="mt-6 text-center text-xs text-muted-foreground/60">
                    Work that feels weightless
                </p>
            </div>
        </div>
    );
}
