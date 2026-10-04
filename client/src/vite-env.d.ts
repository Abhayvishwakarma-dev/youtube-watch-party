/// <reference types="vite/client" />

// ============================================================
//  client/src/vite-env.d.ts
//
//  Vite ambient types + project-specific env var declarations.
//
//  Without this file, TypeScript won't know about
//  `import.meta.env.VITE_API_URL` and will throw:
//    "Property 'env' does not exist on type 'ImportMeta'"
// ============================================================

interface ImportMetaEnv {
    /** Backend base URL (e.g. http://localhost:5000). Optional — falls back to localhost in dev. */
    readonly VITE_API_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}