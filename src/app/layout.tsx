import './globals.css';
import { ThemeProvider } from 'next-themes';
import { Toaster } from "@/components/ui/sonner"

export const metadata = {
  title: 'SyncLyrics',
  description: '同期歌詞で楽しむ',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <ThemeProvider attribute="class" defaultTheme="system">
          {children}
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}