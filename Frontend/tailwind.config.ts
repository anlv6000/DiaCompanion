import type { Config } from "tailwindcss";

// Colors reference CSS variables defined in src/styles/tokens.css
// (single source of truth = DESIGN.md). No hex in components.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        hairline: "var(--hairline)",
        ink: {
          DEFAULT: "var(--ink)",
          muted: "var(--ink-muted)",
          faint: "var(--ink-faint)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          active: "var(--primary-active)",
        },
        fundus: {
          canvas: "var(--fundus-canvas)",
          chrome: "var(--fundus-chrome)",
        },
        grade: {
          0: "var(--grade-0)",
          1: "var(--grade-1)",
          2: "var(--grade-2)",
          3: "var(--grade-3)",
          4: "var(--grade-4)",
        },
        defer: {
          DEFAULT: "var(--defer)",
          bg: "var(--defer-bg)",
        },
        risk: {
          ok: "var(--risk-ok)",
          watch: "var(--risk-watch)",
          alert: "var(--risk-alert)",
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
        serif: ['"IBM Plex Serif"', "Georgia", "serif"],
      },
      fontSize: {
        micro: ["11px", { lineHeight: "14px" }],
        meta: ["12px", { lineHeight: "16px" }],
        dense: ["13px", { lineHeight: "18px" }],
        body: ["14px", { lineHeight: "20px" }],
        sub: ["16px", { lineHeight: "22px" }],
        section: ["20px", { lineHeight: "26px" }],
        title: ["28px", { lineHeight: "34px" }],
      },
      borderRadius: {
        xs: "2px",
        sm: "4px",
        md: "6px",
        lg: "8px",
      },
      boxShadow: {
        overlay: "0 4px 16px rgba(20,23,28,0.12)",
      },
      spacing: {
        "0.5": "2px",
      },
    },
  },
  plugins: [],
} satisfies Config;
