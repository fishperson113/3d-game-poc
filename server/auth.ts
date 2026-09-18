import { betterAuth } from "better-auth";
import { database } from "./database";

export const auth = betterAuth({
  database,
  emailAndPassword: { enabled: true },
  trustedOrigins: [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://besiege-lite-web-poc.onrender.com",
  ],
  advanced: { database: { joins: true } },
});
