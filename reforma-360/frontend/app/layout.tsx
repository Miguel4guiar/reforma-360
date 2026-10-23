import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Reforma 360 | Gestão da Reforma Tributária',
  description: 'Plataforma integrada de preparação e acompanhamento da Reforma Tributária.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
