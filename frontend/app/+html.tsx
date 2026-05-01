// @ts-nocheck
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es" style={{ height: "100%" }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        
        {/* SEO & Basic Meta Tags */}
        <title>RapiPay - Recargas y Pagos Online</title>
        <meta name="description" content="RapiPay - Tu plataforma de recargas Zinli, Wally, Gift Cards y servicios de Personal Shopper. Pagos seguros y rápidos." />
        <meta name="keywords" content="recargas, zinli, wally, gift cards, pagos online, personal shopper, venezuela" />
        <meta name="author" content="RapiPay" />
        
        {/* Open Graph / Facebook / WhatsApp */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://rapippay.com/" />
        <meta property="og:title" content="RapiPay - Recargas y Pagos Online" />
        <meta property="og:description" content="Tu plataforma de recargas Zinli, Wally, Gift Cards y servicios de Personal Shopper. Pagos seguros y rápidos." />
        <meta property="og:image" content="https://rapippay.com/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="RapiPay" />
        <meta property="og:locale" content="es_ES" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://rapippay.com/" />
        <meta name="twitter:title" content="RapiPay - Recargas y Pagos Online" />
        <meta name="twitter:description" content="Tu plataforma de recargas Zinli, Wally, Gift Cards y servicios de Personal Shopper." />
        <meta name="twitter:image" content="https://rapippay.com/og-image.png" />
        
        {/* Theme Color */}
        <meta name="theme-color" content="#FF5000" />
        <meta name="msapplication-TileColor" content="#FF5000" />
        
        {/* Favicon */}
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/favicon.png" />
        
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              body > div:first-child { position: fixed !important; top: 0; left: 0; right: 0; bottom: 0; }
              [role="tablist"] [role="tab"] * { overflow: visible !important; }
              [role="heading"], [role="heading"] * { overflow: visible !important; }
            `,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          height: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </body>
    </html>
  );
}
