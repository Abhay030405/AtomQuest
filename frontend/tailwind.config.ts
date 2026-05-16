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
        sans: ["Geist", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      // Design system color tokens
      colors: {
        // Shadcn/ui CSS var tokens (kept for primitives like Dialog, Sheet, etc.)
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "#0058be",
          foreground: "#ffffff",
          container: "#2170e4",
          fixed: "#d8e2ff",
          "fixed-dim": "#adc6ff",
        },
        secondary: {
          DEFAULT: "#505f76",
          foreground: "#ffffff",
          container: "#d0e1fb",
          fixed: "#d3e4fe",
          "fixed-dim": "#b7c8e1",
        },
        tertiary: {
          DEFAULT: "#006947",
          foreground: "#ffffff",
          container: "#00855b",
          fixed: "#6ffbbe",
          "fixed-dim": "#4edea3",
        },
        error: {
          DEFAULT: "#ba1a1a",
          foreground: "#ffffff",
          container: "#ffdad6",
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
        // Surface tokens
        surface: {
          DEFAULT: "#f7f9fb",
          bright: "#f7f9fb",
          dim: "#d8dadc",
          variant: "#e0e3e5",
          tint: "#005ac2",
          container: {
            DEFAULT: "#eceef0",
            lowest: "#ffffff",
            low: "#f2f4f6",
            high: "#e6e8ea",
            highest: "#e0e3e5",
          },
        },
        outline: {
          DEFAULT: "#727785",
          variant: "#c2c6d6",
        },
        // On-color tokens
        "on-primary": "#ffffff",
        "on-primary-container": "#fefcff",
        "on-primary-fixed": "#001a42",
        "on-primary-fixed-variant": "#004395",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#54647a",
        "on-secondary-fixed": "#0b1c30",
        "on-secondary-fixed-variant": "#38485d",
        "on-tertiary": "#ffffff",
        "on-tertiary-container": "#f5fff6",
        "on-tertiary-fixed": "#002113",
        "on-tertiary-fixed-variant": "#005236",
        "on-error": "#ffffff",
        "on-error-container": "#93000a",
        "on-surface": "#191c1e",
        "on-surface-variant": "#424754",
        "on-background": "#191c1e",
        // Inverse tokens
        "inverse-surface": "#2d3133",
        "inverse-on-surface": "#eff1f3",
        "inverse-primary": "#adc6ff",
        // Secondary fixed dim (extra alias)
        "secondary-fixed-dim": "#b7c8e1",
        "primary-fixed-dim": "#adc6ff",
        "tertiary-fixed-dim": "#4edea3",
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        gutter: "24px",
        base: "8px",
        "margin-mobile": "16px",
        "margin-desktop": "40px",
        "max-width": "1440px",
      },
      fontSize: {
        "display-lg": ["48px", { lineHeight: "56px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "headline-lg-mobile": ["28px", { lineHeight: "36px", fontWeight: "600" }],
        "headline-md": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "title-lg": ["20px", { lineHeight: "28px", fontWeight: "600" }],
        "title-md": ["16px", { lineHeight: "24px", fontWeight: "600" }],
        "body-lg": ["16px", { lineHeight: "26px", fontWeight: "400" }],
        "body-md": ["14px", { lineHeight: "22px", fontWeight: "400" }],
        "label-md": ["12px", { lineHeight: "16px", letterSpacing: "0.02em", fontWeight: "500" }],
        "code": ["13px", { lineHeight: "20px", fontWeight: "400" }],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        sm: "0.25rem",
        md: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.5rem",
        full: "9999px",
      },
      boxShadow: {
        "level-1": "0 1px 3px 0 rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.03)",
        "level-2": "0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -1px rgba(0,0,0,0.04)",
        "level-3": "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
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
