import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#070B14",
          900: "#0A0F1C",
          850: "#0D1322",
          800: "#111829",
          700: "#172033",
          600: "#1E2942",
          500: "#2A3654",
        },
        accent: {
          50: "#ECFEFF",
          100: "#CFFAFE",
          200: "#A5F3FC",
          300: "#67E8F9",
          400: "#22D3EE",
          500: "#06B6D4",
          600: "#0891B2",
          700: "#0E7490",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(34,211,238,0.25), 0 8px 40px -8px rgba(34,211,238,0.25)",
      },
      backgroundImage: {
        "accent-gradient":
          "linear-gradient(135deg, #22D3EE 0%, #38BDF8 50%, #818CF8 100%)",
        "page-glow":
          "radial-gradient(1200px 600px at 85% 95%, rgba(16,185,129,0.10), transparent 60%), radial-gradient(800px 500px at 10% 0%, rgba(34,211,238,0.06), transparent 60%)",
      },
    },
  },
  plugins: [],
};

export default config;
