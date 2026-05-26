import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "ml-service/.venv-v4/**",
    "ml-service/venv/**",
    "ml-service/**/__pycache__/**",
    "ml-service/**/.pytest_cache/**",
    "ml-service/**/*.pyc",
    "ml-service/artifacts/**/*.pkl",
    "ml-service/artifacts/**/*.joblib",
  ]),
]);

export default eslintConfig;
