import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  applicationName: 'JobLens',
  title: {
    default: 'JobLens — трекер поиска работы',
    template: '%s · JobLens',
  },
  description:
    'Ведите вакансии по этапам, планируйте следующие действия и анализируйте результаты поиска работы.',
  keywords: [
    'трекер вакансий',
    'поиск работы',
    'отклики',
    'собеседования',
    'аналитика вакансий',
  ],
  icons: { icon: '/favicon.svg' },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
