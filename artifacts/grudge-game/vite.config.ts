import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 5173;
const basePath = process.env.BASE_PATH || "/";
const isReplit = process.env.REPL_ID !== undefined;

export default defineConfig({
  base: basePath,
  // Grudge's dependency graph is large (three.js + ~25 Radix packages +
  // recharts/framer-motion/etc.). Vite's automatic esbuild dependency *scan*
  // (`scanAllDependencies`) crawls the entire source + transitive graph in one
  // pass and, at this scale, exhausts memory / deadlocks the esbuild service on
  // a cold cache — which kills the dev server before optimization can finalize.
  // We disable auto-discovery and pre-declare the dependency set explicitly so
  // optimization is a single bounded pass. Keep this list in sync with the bare
  // (non-relative, non-`@/`, non-`@workspace/`) imports used across src.
  //
  // three.js (+ its example loaders) is excluded from pre-bundling: it is the
  // single largest dependency and ships native ESM, so Vite can serve it
  // unbundled and skip a slow esbuild pre-bundle pass over a huge library.
  optimizeDeps: {
    noDiscovery: true,
    exclude: [
      "three",
      "three/examples/jsm/loaders/GLTFLoader.js",
      "three/examples/jsm/loaders/FBXLoader.js",
      "@dimforge/rapier3d-compat",
    ],
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "wouter",
      "@tanstack/react-query",
      "framer-motion",
      "recharts",
      "lucide-react",
      "date-fns",
      "clsx",
      "tailwind-merge",
      "class-variance-authority",
      "cmdk",
      "vaul",
      "sonner",
      "embla-carousel-react",
      "input-otp",
      "next-themes",
      "react-hook-form",
      "@hookform/resolvers",
      "react-day-picker",
      "react-resizable-panels",
      "zod",
      "@radix-ui/react-accordion",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-aspect-ratio",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-collapsible",
      "@radix-ui/react-context-menu",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-hover-card",
      "@radix-ui/react-label",
      "@radix-ui/react-menubar",
      "@radix-ui/react-navigation-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-progress",
      "@radix-ui/react-radio-group",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slider",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toast",
      "@radix-ui/react-toggle",
      "@radix-ui/react-toggle-group",
      "@radix-ui/react-tooltip",
    ],
  },
  plugins: [
    react(),
    tailwindcss(),
    ...(isReplit
      ? [
          await import("@replit/vite-plugin-runtime-error-modal").then((m) =>
            m.default(),
          ),
          ...(process.env.NODE_ENV !== "production"
            ? [
                await import("@replit/vite-plugin-cartographer").then((m) =>
                  m.cartographer({
                    root: path.resolve(import.meta.dirname, ".."),
                  }),
                ),
                await import("@replit/vite-plugin-dev-banner").then((m) =>
                  m.devBanner(),
                ),
              ]
            : []),
        ]
      : []),
  ],
  assetsInclude: ["**/*.wasm"],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@dimforge/")) {
            return "rapier-vendor";
          }
          if (id.includes("/three/") || id.includes("three-mesh-bvh")) {
            return "three-vendor";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
