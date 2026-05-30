import { View, StyleSheet } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { BranchCard } from './BranchCard';
import { spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/useI18n';
import type { Branch } from '@/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  branches: Branch[];
  selectedId?: string | null;
  onSelect: (branch: Branch) => void;
}

/** Manual branch selection — always available (section 2.6). */
export function BranchPicker({ visible, onClose, branches, selectedId, onSelect }: Props) {
  const { t } = useI18n();
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('home.selectBranch')}>
      <View style={styles.list}>
        {branches.map((b) => (
          <BranchCard
            key={b.id}
            branch={b}
            selected={b.id === selectedId}
            onPress={() => {
              onSelect(b);
              onClose();
            }}
          />
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
});
