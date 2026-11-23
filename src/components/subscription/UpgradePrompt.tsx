import React, { useEffect, useState } from 'react';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { Dialog } from '../common/Dialog';
import { RootStackParamList } from '../../navigation/types';
import { onQuotaExceeded, QuotaError, quotaTitle } from '../../utils/subscriptionQuota';

type Props = { navigationRef: NavigationContainerRefWithCurrent<RootStackParamList> };

/** Hộp thoại chung khi BE báo vượt hạn mức gói, mở từ apiClient */
export const UpgradePrompt: React.FC<Props> = ({ navigationRef }) => {
  const [quota, setQuota] = useState<QuotaError | null>(null);

  useEffect(() => onQuotaExceeded(setQuota), []);

  if (!quota) return null;

  return (
    <Dialog
      visible
      title={quotaTitle(quota.code)}
      message={quota.message}
      primaryLabel="Xem các gói"
      secondaryLabel="Để sau"
      onPrimary={() => {
        setQuota(null);
        if (navigationRef.isReady()) navigationRef.navigate('SubscriptionPlans');
      }}
      onSecondary={() => setQuota(null)}
      testID="subscriptionUpgradePrompt"
    />
  );
};
