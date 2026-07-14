import type { Metadata } from 'next';
import { GiftsView } from '@/components/gifts/GiftsView';

export const metadata: Metadata = { title: 'Gifts' };

export default function GiftsPage() {
  return <GiftsView />;
}
