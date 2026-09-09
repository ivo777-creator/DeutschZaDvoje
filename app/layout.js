import "./globals.css";

export const metadata = {
  title: "Deutsch za dvoje",
  description: "Učenje njemačkog — zajedno i sam",
  manifest: "/manifest.json"
};

export const viewport = {
  themeColor: "#17798F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({ children }) {
  return (
    <html lang="hr">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
