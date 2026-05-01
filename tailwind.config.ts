import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
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
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
          muted: "hsl(var(--sidebar-muted))",
        },
        status: {
          todo: "hsl(var(--status-todo))",
          progress: "hsl(var(--status-progress))",
          review: "hsl(var(--status-review))",
          done: "hsl(var(--status-done))",
          blocked: "hsl(var(--status-blocked))",
        },
        cost: {
          positive: "hsl(var(--cost-positive))",
          negative: "hsl(var(--cost-negative))",
          warning: "hsl(var(--cost-warning))",
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
        "flash-green": {
          "0%, 100%": { backgroundColor: "transparent" },
          "50%": { backgroundColor: "hsl(142 71% 45% / 0.15)" },
        },
        "fire-flicker": {
          "0%, 100%": {
            opacity: "1",
            filter: "drop-shadow(0 0 4px hsl(15 90% 55% / 0.8)) drop-shadow(0 0 12px hsl(0 85% 55% / 0.5))",
          },
          "25%": {
            opacity: "0.92",
            filter: "drop-shadow(0 0 6px hsl(38 92% 55% / 0.9)) drop-shadow(0 0 16px hsl(15 90% 55% / 0.6))",
          },
          "50%": {
            opacity: "0.96",
            filter: "drop-shadow(0 0 8px hsl(15 90% 55% / 1)) drop-shadow(0 0 20px hsl(0 85% 55% / 0.7))",
          },
          "75%": {
            opacity: "0.88",
            filter: "drop-shadow(0 0 5px hsl(38 92% 55% / 0.8)) drop-shadow(0 0 14px hsl(15 90% 55% / 0.5))",
          },
        },
        "ember-rise": {
          "0%": { transform: "translateY(0) scale(1)", opacity: "0" },
          "10%": { opacity: "0.8" },
          "100%": { transform: "translateY(-100vh) scale(0.3)", opacity: "0" },
        },
        "fire-glow-pulse": {
          "0%, 100%": {
            boxShadow: "0 0 12px hsl(15 90% 55% / 0.4), 0 0 24px hsl(0 85% 55% / 0.2), inset 0 0 8px hsl(15 90% 55% / 0.1)",
          },
          "50%": {
            boxShadow: "0 0 20px hsl(15 90% 55% / 0.7), 0 0 40px hsl(0 85% 55% / 0.4), inset 0 0 12px hsl(15 90% 55% / 0.2)",
          },
        },
        "fire-border-flow": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "ignite": {
          "0%": { transform: "scale(0.95)", opacity: "0", filter: "blur(4px) brightness(2)" },
          "60%": { filter: "blur(0) brightness(1.4)" },
          "100%": { transform: "scale(1)", opacity: "1", filter: "blur(0) brightness(1)" },
        },
        "scorch-shake": {
          "0%, 100%": { transform: "translate(0, 0) rotate(0)" },
          "25%": { transform: "translate(-1px, 1px) rotate(-0.3deg)" },
          "75%": { transform: "translate(1px, -1px) rotate(0.3deg)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "flash-green": "flash-green 0.6s ease-out",
        "fire-flicker": "fire-flicker 2.4s ease-in-out infinite",
        "ember-rise": "ember-rise linear infinite",
        "fire-glow-pulse": "fire-glow-pulse 3s ease-in-out infinite",
        "fire-border-flow": "fire-border-flow 4s ease-in-out infinite",
        "ignite": "ignite 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        "scorch-shake": "scorch-shake 0.4s ease-in-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
