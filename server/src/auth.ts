import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db.js";
import { config } from "./config/index.js";

const trustedOrigins = config.isProduction
    ? [config.frontendUrl]
    : [config.frontendUrl, "http://localhost:5173", "http://127.0.0.1:5173"];

const frontendOrigin = config.frontendUrl ? new URL(config.frontendUrl).origin : undefined;
const authOrigin = config.betterAuthUrl ? new URL(config.betterAuthUrl).origin : undefined;
const isCrossSite = Boolean(frontendOrigin && authOrigin && frontendOrigin !== authOrigin);

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true,
    },
    socialProviders: {
        // Add providers here if needed
    },
    trustedOrigins,
    advanced: {
        useSecureCookies: config.isProduction,
        defaultCookieAttributes: isCrossSite
            ? { sameSite: "none", secure: true }
            : undefined,
    },
});
