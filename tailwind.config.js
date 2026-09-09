module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx}", "./lib/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        pod:    "rgb(var(--pod) / <alpha-value>)",   // Hintergrund
        ploha:  "rgb(var(--ploha) / <alpha-value>)", // Karten
        tekst:  "rgb(var(--tekst) / <alpha-value>)", // Schrift
        tiho:   "rgb(var(--tiho) / <alpha-value>)",  // Schrift leise
        rub:    "rgb(var(--rub) / <alpha-value>)",   // Linien
        akzent: "rgb(var(--akzent) / <alpha-value>)",
        alarm:  "#D9534F"
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "SF Pro Display",
               "SF Pro Text", "system-ui", "Segoe UI", "Roboto", "sans-serif"]
      },
      borderRadius: { xl2: "1.25rem" }
    }
  },
  plugins: []
};
