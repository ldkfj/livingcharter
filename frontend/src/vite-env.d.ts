/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHARTER_ADDRESS?: string;
  readonly VITE_TREASURY_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
