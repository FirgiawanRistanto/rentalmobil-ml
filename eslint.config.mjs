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
  {
    // Keputusan sadar untuk fase ini (bukan kelalaian):
    // - no-img-element: gambar statis lokal/placeholder dengan dimensi CSS eksplisit;
    //   migrasi next/image memerlukan audit layout & remotePatterns, dijadwalkan terpisah.
    // - no-page-custom-font: Material Symbols dimuat di App Router <head> (bukan pages/_document),
    //   sehingga warning tersebut tidak relevan untuk arsitektur App Router.
    rules: {
      "@next/next/no-img-element": "off",
      "@next/next/no-page-custom-font": "off",
    },
  },
]);

export default eslintConfig;
