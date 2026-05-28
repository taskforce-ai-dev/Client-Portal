import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          0: "#04070f",
          1: "#080d1a",
          2: "#0a1226",
          3: "#0d172d",
        },
        cyan: {
          DEFAULT: "#00d4ff",
          soft: "#4d8bff",
        },
        violet: {
          DEFAULT: "#7b61ff",
        },
        emerald: {
          DEFAULT: "#00e5a0",
        },
        rose: {
          DEFAULT: "#ff6b6b",
        },
      },
      fontFamily: {
        sans: ["var(--font-sora)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "sentinel-glow":
          "radial-gradient(1200px 800px at 12% -10%, rgba(123,97,255,0.16), transparent 60%), radial-gradient(1000px 700px at 95% 8%, rgba(0,212,255,0.12), transparent 60%)",
        "accent-gradient": "linear-gradient(135deg, #00d4ff, #4d8bff)",
        "brand-gradient": "linear-gradient(135deg, #ff6b6b, #7b61ff 50%, #00d4ff)",
      },
    },
  },
  plugins: [],
};

export default config;
