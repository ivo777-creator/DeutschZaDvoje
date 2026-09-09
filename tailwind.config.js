module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        tinta:  "#10333F",  // dunkles Blaugrün, Schrift
        more:   "#17798F",  // Adria-Blau, Hauptfarbe
        magla:  "#E7EEEF",  // heller Hintergrund
        pijesak:"#E8A33D",  // Sandgelb, Punkte
        koral:  "#C4553B"   // Rot, falsche Antwort
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Fraunces", "Georgia", "serif"]
      }
    }
  },
  plugins: []
};
