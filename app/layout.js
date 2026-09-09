import "./globals.css";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)",  color: "#232A36" },
    { media: "(prefers-color-scheme: light)", color: "#F4F6FA" }
  ]
};

export const metadata = {
  title: "Deutsch za dvoje",
  description: "Uči sama, a i skupa s Ivom",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Deutsch za dvoje"
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }]
  },
  manifest: "/manifest.json"
};

// Setzt Hell/Dunkel schon vor dem ersten Bild, damit es nicht flackert.
const prijeCrtanja = `
(function(){try{
  var t=localStorage.getItem('tema')||'auto';
  var tamno = t==='dark' || (t==='auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  if(tamno) document.documentElement.classList.add('dark');
}catch(e){}})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="hr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: prijeCrtanja }} />
      </head>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
