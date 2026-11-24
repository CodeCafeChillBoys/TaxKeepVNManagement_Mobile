import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import {
  formatPeriodShort,
  isBeforeBirthMonth,
  shiftYearMonth,
} from '../../screens/dependent/editEffectivePeriod';

type Props = {
  visible: boolean;
  personName: string;
  periodFrom: string;
  periodTo: string;
  birthDate?: string | null;
  saving?: boolean;
  error?: string | null;
  onChangeFrom: (ym: string) => void;
  onChangeTo: (ym: string) => void;
  onCancel: () => void;
  onSave: () => void;
};

function monthSpan(from: string, to: string): number | null {
  const a = /^(\d{4})-(\d{2})$/.exec(from);
  const b = /^(\d{4})-(\d{2})$/.exec(to);
  if (!a || !b) return null;
  const months = (Number(b[1]) - Number(a[1])) * 12 + (Number(b[2]) - Number(a[2])) + 1;
  return months > 0 ? months : null;
}

function Stepper({
  caption,
  value,
  birthDate,
  blockBeforeBirth,
  onChange,
}: {
  caption: string;
  value: string;
  birthDate?: string | null;
  blockBeforeBirth?: boolean;
  onChange: (ym: string) => void;
}) {
  const prev = shiftYearMonth(value, -1);
  const next = shiftYearMonth(value, 1);
  const prevOk = !(blockBeforeBirth && isBeforeBirthMonth(prev, birthDate));
  const nextOk = !(blockBeforeBirth && isBeforeBirthMonth(next, birthDate));
  const label = formatPeriodShort(value);
  const year = value.slice(0, 4);
  const monthNum = String(Number(value.slice(5, 7) || '0'));

  return (
    <View style={styles.stepCard}>
      <Text style={styles.stepCaption}>{caption}</Text>
      <Text style={styles.stepMonth}>{monthNum}</Text>
      <Text style={styles.stepYear}>{year}</Text>
      <Text style={styles.stepHint}>{label}</Text>
      <View style={styles.stepBtns}>
        <TouchableOpacity
          style={[styles.stepBtn, !prevOk && styles.stepBtnOff]}
          disabled={!prevOk}
          onPress={() => onChange(prev)}
          accessibilityRole="button"
          accessibilityLabel={`${caption} tháng trước`}
        >
          <Ionicons name="chevron-back" size={20} color={prevOk ? theme.colors.primary : '#C8C2B8'} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.stepBtn, !nextOk && styles.stepBtnOff]}
          disabled={!nextOk}
          onPress={() => onChange(next)}
          accessibilityRole="button"
          accessibilityLabel={`${caption} tháng sau`}
        >
          <Ionicons name="chevron-forward" size={20} color={nextOk ? theme.colors.primary : '#C8C2B8'} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function EditEffectivePeriodSheet({
  visible,
  personName,
  periodFrom,
  periodTo,
  birthDate,
  saving,
  error,
  onChangeFrom,
  onChangeTo,
  onCancel,
  onSave,
}: Props) {
  const insets = useSafeAreaInsets();
  const span = monthSpan(periodFrom, periodTo);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={saving ? undefined : onCancel}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}
          onPress={() => undefined}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Thời gian hiệu lực</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {personName}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onCancel}
              disabled={!!saving}
              accessibilityLabel="Đóng"
            >
              <Ionicons name="close" size={18} color="#1A1A1A" />
            </TouchableOpacity>
          </View>

          <View style={styles.pair}>
            <Stepper
              caption="Bắt đầu"
              value={periodFrom}
              birthDate={birthDate}
              blockBeforeBirth
              onChange={onChangeFrom}
            />
            <View style={styles.bridge}>
              <View style={styles.bridgeLine} />
              <Ionicons name="arrow-forward" size={16} color={theme.colors.primary} />
              <View style={styles.bridgeLine} />
            </View>
            <Stepper caption="Kết thúc" value={periodTo} birthDate={birthDate} onChange={onChangeTo} />
          </View>

          <View style={styles.summary}>
            <Text style={styles.summaryRange}>
              {formatPeriodShort(periodFrom)}  →  {formatPeriodShort(periodTo)}
            </Text>
            {span ? <Text style={styles.summarySpan}>{span} tháng giảm trừ</Text> : null}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} disabled={!!saving} onPress={onCancel}>
              <Text style={styles.cancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.7 }]}
              disabled={!!saving}
              onPress={onSave}
              testID="btnSaveEffectivePeriod"
            >
              {saving ? (
                <ActivityIndicator color="#1A1A1A" />
              ) : (
                <Text style={styles.saveText}>Lưu</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26,26,26,0.42)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#F8F5EE',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D8D0C4',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
    gap: 12,
  },
  title: {
    fontFamily: fonts.serifBold,
    fontSize: 22,
    color: theme.colors.primaryDark,
  },
  subtitle: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#6E6860',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EFE8DC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E7DFD2',
  },
  stepCaption: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.colors.primary,
  },
  stepMonth: {
    marginTop: 6,
    fontFamily: fonts.serifBold,
    fontSize: 48,
    lineHeight: 52,
    color: '#1A1A1A',
  },
  stepYear: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: '#3A342C',
  },
  stepHint: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#8A847A',
  },
  stepBtns: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F6EFE3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnOff: {
    backgroundColor: '#F3F0EA',
  },
  bridge: {
    width: 28,
    alignItems: 'center',
    gap: 4,
  },
  bridgeLine: {
    width: 1,
    height: 18,
    backgroundColor: '#E0D6C8',
  },
  summary: {
    marginTop: 16,
    alignItems: 'center',
  },
  summaryRange: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: '#1A1A1A',
  },
  summarySpan: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#6E6860',
  },
  errorText: {
    marginTop: 10,
    textAlign: 'center',
    fontFamily: fonts.body,
    fontSize: 13,
    color: theme.colors.error,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#EFE8DC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
    color: '#1A1A1A',
  },
  saveBtn: {
    flex: 1.2,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#EFE3BF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: '#1A1A1A',
  },
});
