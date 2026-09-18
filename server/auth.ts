import { betterAuth } from "better-auth";
import { database } from "./database";

const configuredBaseUrl = process.env.BETTER_AUTH_URL?.replace(/\/+$/, "");
const productionOrigin = configuredBaseUrl === undefined ? undefined : new URL(configuredBaseUrl).origin;

export const auth = betterAuth({
  database,
  emailAndPassword: { enabled: true },
  trustedOrigins: [
    "http://localhost:5173",
    "http://localhost:3000",
    ...(productionOrigin === undefined ? [] : [productionOrigin]),
    "https://besiege-lite-web-poc-g5lw.onrender.com",
  ],
  advanced: { database: { joins: true } },
});
