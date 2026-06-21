import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
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
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        glow: "0 0 20px -5px hsla(191, 91%, 36%, 0.3)",
        soft: "0 10px 40px -10px rgba(0, 0, 0, 0.05)",
      },
      backgroundImage: {
        grid: "linear-gradient(to right, rgba(0,0,0,0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.02) 1px, transparent 1px)",
        "bio-gradient": "linear-gradient(135deg, hsla(191, 91%, 36%, 0.1), hsla(262, 83%, 58%, 0.1))",
      },
    },
  },
  plugins: [],
};

export default config;
