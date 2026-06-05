import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { SignInGate } from "@/components/SignInGate";
import { ThemeProvider } from "@/components/ThemeProvider";
import { VisitorSessionProvider } from "@/components/VisitorSessionProvider";
import { VisitorWarningBanner } from "@/components/VisitorWarningBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IncidentFox",
  description: "AI-Powered SRE Platform",
};

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "/incident/web-ui";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        {/* CRITICAL: basePath fetch patch — MUST run before any client fetch.
            Next.js basePath auto-prefixes next/link & assets, but NOT native fetch().
            This patches window.fetch to prefix same-origin root-relative paths so all
            55+ `fetch('/api/...')` calls reach `/incident/web-ui/api/...` under the gateway. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var BASE = ${JSON.stringify(BASE_PATH)};
                  if (!BASE || window.__ifoxFetchPatched) return;
                  window.__ifoxFetchPatched = true;
                  var of = window.fetch.bind(window);
                  function needsPrefix(p) {
                    return typeof p === 'string'
                      && p.charAt(0) === '/'
                      && p.indexOf('//') !== 0
                      && p.indexOf(BASE + '/') !== 0
                      && p !== BASE;
                  }
                  window.fetch = function(input, init) {
                    try {
                      if (needsPrefix(input)) {
                        input = BASE + input;
                      } else if (input && typeof input === 'object' && typeof input.url === 'string') {
                        var origin = window.location.origin;
                        if (input.url.indexOf(origin) === 0) {
                          var path = input.url.substring(origin.length);
                          if (needsPrefix(path)) {
                            input = new Request(origin + BASE + path, input);
                          }
                        }
                      }
                    } catch (e) {}
                    return of(input, init);
                  };
                } catch (e) {}
              })();
            `,
          }}
        />
        {/* CRITICAL: This script MUST run before any rendering to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('theme') || 'dark';
                  const root = document.documentElement;
                  if (theme === 'dark') {
                    root.classList.add('dark');
                    root.style.colorScheme = 'dark';
                  } else {
                    root.classList.remove('dark');
                    root.style.colorScheme = 'light';
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full bg-gray-50 dark:bg-black`}
      >
        <ThemeProvider>
          <SignInGate>
            <VisitorSessionProvider>
              <div className="min-h-screen">
                <Sidebar />
                <main className="lg:pl-64 min-h-screen transition-all duration-200">{children}</main>
              </div>
              <VisitorWarningBanner />
            </VisitorSessionProvider>
          </SignInGate>
        </ThemeProvider>
      </body>
    </html>
  );
}
