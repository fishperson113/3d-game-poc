import { betterAuth } from "better-auth";
import { database } from "./database";

const configuredBaseUrl = process.env.BETTER_AUTH_URL?.replace(/\/+$/, "");
const productionOrigin = configuredBaseUrl === undefined ? undefined : new URL(configuredBaseUrl).origin;
const canonicalProductionOrigin = "https://besiege-lite-web-poc-g5lw.onrender.com";

export const auth = betterAuth({
  database,
  baseURL: {
    allowedHosts: [
      "besiege-lite-web-poc-g5lw.onrender.com",
      "localhost:*",
      "127.0.0.1:*",
    ],
    protocol: "auto",
    fallback: canonicalProductionOrigin,
  },
  emailAndPassword: { enabled: true },
  trustedOrigins: [
    "http://localhost:5173",
    "http://localhost:3000",
    ...(productionOrigin === undefined ? [] : [productionOrigin]),
    canonicalProductionOrigin,
  ],
  advanced: {
    trustedProxyHeaders: true,
    database: { joins: true },
  },
});
