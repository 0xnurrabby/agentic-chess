import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0a0e1a",
          light: "#ffffff",
        },
        card: {
          DEFAULT: "#111827",
          light: "#f9fafb",
        },
        border: {
          DEFAULT: "#1f2937",
          light: "#e5e7eb",
        },
        accent: {
          indigo: "#6366f1",
          emerald: "#10b981",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(99, 102, 241, 0.4)" },
          "50%": { boxShadow: "0 0 0 8px rgba(99, 102, 241, 0)" },
        },
        slideIn: {
          from: { opacity: "0", transform: "translateY(-4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        pulseGlow: "pulseGlow 2s ease-in-out infinite",
        slideIn: "slideIn 0.2s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
