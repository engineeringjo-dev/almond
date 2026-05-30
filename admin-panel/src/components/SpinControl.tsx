import { useEffect, useState } from 'react';
import { Card, SectionTitle } from './ui';
import { EligibilityForm } from './EligibilityForm';
import { PrizeEditor } from './PrizeEditor';
import { OddsPreview } from './OddsPreview';
import { CampaignManager } from './CampaignManager';
import { colors } from '../theme';
import { adminApi } from '../services/adminApi';
import type { SpinConfig, SpinPrize, SpinCampaign, SpinEligibilityConfig } from '../types';

export function SpinControl() {
  const [config, setConfig] = useState<SpinConfig | null>(null);

  useEffect(() => {
    adminApi.getSpinConfig().then(setConfig);
  }, []);

  if (!config) {
    return <div style={{ color: colors.warmGray }}>جارٍ التحميل...</div>;
  }

  const setEligibility = (eligibility: SpinEligibilityConfig) =>
    setConfig({ ...config, eligibility });
  const setPrizes = (prizes: SpinPrize[]) => setConfig({ ...config, prizes });
  const setCampaigns = (campaigns: SpinCampaign[]) => setConfig({ ...config, campaigns });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ fontSize: 26 }}>🎡 التحكم بعجلة الحظ</h1>

      <EligibilityForm value={config.eligibility} onChange={setEligibility} />

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, alignItems: 'start' }}>
        <PrizeEditor prizes={config.prizes} setPrizes={setPrizes} />
        <Card>
          <SectionTitle>معاينة الاحتمالات</SectionTitle>
          <OddsPreview prizes={config.prizes} />
        </Card>
      </div>

      <CampaignManager campaigns={config.campaigns} setCampaigns={setCampaigns} />
    </div>
  );
}
