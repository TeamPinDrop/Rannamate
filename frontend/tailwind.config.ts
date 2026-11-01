import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        burgundy: { DEFAULT: "#6C151E", 50: "#F7E8EA", 300: "#B04A55", 700: "#4E0F16", 900: "#2E070C" },
        forest: { DEFAULT: "#0F3D3A", 50: "#E3EFEE", 300: "#3F7A75", 700: "#0A2C2A", 900: "#061B1A" },
        cream: { DEFAULT: "#F5DABF", 50: "#FDF7F1", 100: "#FAEBDC", 300: "#EFC9A3", 700: "#C79E77" },
        ink: "#22110F",
      },
      fontFamily: {
        display: ["Fraunces", "ui-serif", "Georgia", "serif"],
        sans: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glass: "0 20px 60px -20px rgba(46, 7, 12, 0.35), inset 0 1px 0 rgba(255,255,255,0.45)",
        "glass-lg": "0 40px 100px -30px rgba(46, 7, 12, 0.45), inset 0 1px 0 rgba(255,255,255,0.5)",
      },
      keyframes: {
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-14px)" } },
        drift: { "0%,100%": { transform: "translate(0,0) scale(1)" }, "50%": { transform: "translate(40px,-30px) scale(1.08)" } },
        pulseRing: { "0%": { transform: "scale(1)", opacity: "0.6" }, "100%": { transform: "scale(1.8)", opacity: "0" } },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        drift: "drift 18s ease-in-out infinite",
        "pulse-ring": "pulseRing 1.4s ease-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
