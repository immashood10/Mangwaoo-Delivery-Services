import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Nothing is remembered in the browser: no localStorage, sessionStorage, IndexedDB, cache storage or cookies set from
  // client code. Everything lives in the database (see AGENTS.md); cookies are only set by the server.
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs}"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "localStorage", message: "Do not store anything in the browser. Save it in the database through an API route." },
        { name: "sessionStorage", message: "Do not store anything in the browser. Save it in the database through an API route." },
        { name: "indexedDB", message: "Do not store anything in the browser. Save it in the database through an API route." },
        { name: "caches", message: "Do not use the browser's cache storage. Save things in the database." },
      ],
      "no-restricted-properties": [
        "error",
        { object: "window", property: "localStorage", message: "Do not store anything in the browser." },
        { object: "window", property: "sessionStorage", message: "Do not store anything in the browser." },
        { object: "window", property: "indexedDB", message: "Do not store anything in the browser." },
        { object: "globalThis", property: "localStorage", message: "Do not store anything in the browser." },
        { object: "globalThis", property: "sessionStorage", message: "Do not store anything in the browser." },
        { object: "document", property: "cookie", message: "Cookies are set by the server only (httpOnly), never from client code." },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
