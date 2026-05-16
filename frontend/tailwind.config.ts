import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: ["Plus Jakarta Sans", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Brand tokens
        brand: {
          primary: "#4F46E5",
          secondary: "#6366F1",
        },
        // Goal status tokens
        status: {
          draft: { DEFAULT: "#6B7280", light: "#F3F4F6", foreground: "#374151" },
          submitted: { DEFAULT: "#3B82F6", light: "#EFF6FF", foreground: "#1E40AF" },
          "under-review": { DEFAULT: "#F59E0B", light: "#FFFBEB", foreground: "#92400E" },
          approved: { DEFAULT: "#10B981", light: "#ECFDF5", foreground: "#065F46" },
          locked: { DEFAULT: "#8B5CF6", light: "#F5F3FF", foreground: "#5B21B6" },
          archived: { DEFAULT: "#64748B", light: "#F8FAFC", foreground: "#334155" },
        },
        // Score tokens
        score: {
          high: { DEFAULT: "#10B981", light: "#ECFDF5", foreground: "#065F46" },
          medium: { DEFAULT: "#F59E0B", light: "#FFFBEB", foreground: "#92400E" },
          low: { DEFAULT: "#EF4444", light: "#FEF2F2", foreground: "#991B1B" },
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
