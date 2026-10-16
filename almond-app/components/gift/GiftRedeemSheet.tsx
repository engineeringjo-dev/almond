import { GiftClaimForm } from '@/components/gift/GiftClaimForm';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function GiftRedeemSheet({ visible, onClose }: Props) {
  return <GiftClaimForm presentation="sheet" visible={visible} onClose={onClose} />;
}
