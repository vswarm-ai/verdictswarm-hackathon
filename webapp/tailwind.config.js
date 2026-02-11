/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "vs-bg": "var(--vs-bg)",
        "vs-surface": "var(--vs-surface)",
        "vs-surface-2": "var(--vs-surface-2)",
        "vs-border": "var(--vs-border)",
        "vs-text": "var(--vs-text)",
        "vs-muted": "var(--vs-muted)",
        "vs-purple": "var(--vs-purple)",
        "vs-cyan": "var(--vs-cyan)",
        "vs-success": "var(--vs-success)",
        "vs-warning": "var(--vs-warning)",
        "vs-error": "var(--vs-error)",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.06), 0 10px 30px rgba(0,0,0,0.45)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
