import { createAuthClient } from "better-auth/react";
import { AUTH_BASE_URL } from "@/lib/api-client";

export const authClient = createAuthClient({
    baseURL: AUTH_BASE_URL,
});

type GoogleAuthOptions = {
    callbackURL: string;
    requestSignUp?: boolean;
    token?: string | null;
};

export const startGoogleAuth = async ({
    callbackURL,
    requestSignUp = false,
    token,
}: GoogleAuthOptions) => {
    await authClient.signIn.social({
        provider: "google",
        callbackURL,
        newUserCallbackURL: callbackURL,
        errorCallbackURL: callbackURL,
        requestSignUp,
        additionalData: token ? { token } : undefined,
    });
};
