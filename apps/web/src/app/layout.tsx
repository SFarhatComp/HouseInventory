import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'House Inventory',
  description: 'A calm, shared home for household food and spice inventory.',
};

export const viewport: Viewport = {
  themeColor: '#f4f7f2',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-CA">
      <body>{children}</body>
    </html>
  );
}
