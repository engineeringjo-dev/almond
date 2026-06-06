import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getItemPairings } from '@almond/shared/lib/recommendations';
import { getItemById } from '@/data/menu';
import { ItemConfigurator } from '@/components/menu/ItemConfigurator';
import { CrossSell } from '@/components/menu/CrossSell';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const item = getItemById(id);
  return { title: item?.nameEn ?? 'Menu' };
}

export default async function ItemPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  const item = getItemById(id);
  if (!item) notFound();

  const pairings = getItemPairings(item, 6);

  return (
    <div className="container-content py-xl">
      <ItemConfigurator item={item} />
      <CrossSell items={pairings} />
    </div>
  );
}
