import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import * as schema from "../db/schema";
import { AUTH_MODEL_NAMES, AUTH_ROLE_VALUES, DEFAULT_SIGN_UP_ROLE, resolveBetterAuthEnvironment } from "./auth-config";

const authEnv = resolveBetterAuthEnvironment();

export const auth = betterAuth({
  appName: "Rental Mobil XYZ",
  baseURL: authEnv.baseURL,
  secret: authEnv.secret,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      [AUTH_MODEL_NAMES.user]: schema.users,
      [AUTH_MODEL_NAMES.account]: schema.accounts,
      [AUTH_MODEL_NAMES.session]: schema.sessions,
      [AUTH_MODEL_NAMES.verification]: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    modelName: AUTH_MODEL_NAMES.user,
    additionalFields: {
      role: {
        type: [...AUTH_ROLE_VALUES],
        required: true,
        input: false,
        defaultValue: DEFAULT_SIGN_UP_ROLE,
      },
    },
  },
  account: {
    modelName: AUTH_MODEL_NAMES.account,
  },
  session: {
    modelName: AUTH_MODEL_NAMES.session,
  },
  verification: {
    modelName: AUTH_MODEL_NAMES.verification,
  },
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
});
