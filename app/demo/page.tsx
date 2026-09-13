import type { Metadata } from 'next';
import Workspace from '../workspace';

export const metadata: Metadata = {
  title: 'Демо',
  description:
    'Откройте демонстрационную доску JobLens с вымышленными вакансиями, аналитикой откликов и планом следующих действий.',
};

export default function Demo() {
  return <Workspace signedIn={false} />;
}
