import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { API_URL } from "@/lib/api-client";
import { AetherCanvas } from "@/components/AetherCanvas";
import { LoftLogo } from "@/components/LoftLogo";
import { Building2, Mail, Lock, User } from "lucide-react";

export default function Onboarding() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [organizationName, setOrganizationName] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleRegister = async () => {
        setError("");
        if (!name || !email || !password || !organizationName) {
            setError("All fields are required");
            return;
        }

        try {
            setLoading(true);

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
                    organizationName,
                }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.error || 'Registration failed');
            }

            navigate("/");
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !loading) {
            handleRegister();
        }
    };

    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
            <AetherCanvas />

            <div className="relative z-10 w-full max-w-md px-4 animate-fade-in-up">
                <Card className="border-0 shadow-cloud-lg bg-white/80 dark:bg-card/80 backdrop-blur-xl">
                    <CardHeader className="space-y-4 pb-4">
                        <div className="flex justify-center">
                            <LoftLogo size="xl" />
                        </div>
                        <div className="text-center space-y-2">
                            <h1 className="text-2xl font-semibold tracking-tight">
                                Welcome to Loft
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Set up your workspace and admin account to get started
                            </p>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-3">
                            <div className="relative">
                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Organization Name"
                                    value={organizationName}
                                    onChange={(e) => setOrganizationName(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    disabled={loading}
                                    className="h-11 pl-10 bg-white/50 dark:bg-white/5 border-border/50 focus:border-primary focus:ring-primary/20"
                                />
                            </div>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Your Full Name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    disabled={loading}
                                    className="h-11 pl-10 bg-white/50 dark:bg-white/5 border-border/50 focus:border-primary focus:ring-primary/20"
                                />
                            </div>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="email"
                                    placeholder="Email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    disabled={loading}
                                    className="h-11 pl-10 bg-white/50 dark:bg-white/5 border-border/50 focus:border-primary focus:ring-primary/20"
                                />
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="password"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    disabled={loading}
                                    className="h-11 pl-10 bg-white/50 dark:bg-white/5 border-border/50 focus:border-primary focus:ring-primary/20"
                                />
                            </div>
                        </div>
                        {error && (
                            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                                {error}
                            </div>
                        )}
                        <Button
                            className="w-full h-11 font-medium shadow-loft hover:shadow-loft-lg transition-all"
                            onClick={handleRegister}
                            disabled={loading}
                        >
                            {loading ? "Creating workspace..." : "Create Workspace"}
                        </Button>
                    </CardContent>
                </Card>

                <p className="mt-6 text-center text-xs text-muted-foreground/60">
                    Teams that flow
                </p>
            </div>
        </div>
    );
}
