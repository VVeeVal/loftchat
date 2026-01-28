import { useState, useEffect } from "react";
import { API_URL } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AetherCanvas } from "@/components/AetherCanvas";
import { LoftLogo } from "@/components/LoftLogo";

export default function Register() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");

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
        } catch (err) {
            setError('Registration failed. Please try again.');
        } finally {
            setIsSubmitting(false);
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
                            <LoftLogo size="lg" />
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
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Creating account..." : (isFirstUser ? "Create Workspace" : "Sign Up")}
                        </Button>
                        <div className="text-center text-sm text-muted-foreground">
                            Already have an account?{" "}
                            <Link to="/login" className="text-primary font-medium hover:underline">
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
