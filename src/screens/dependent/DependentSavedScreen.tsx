import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '../../constants/fonts';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { formatPersonName } from '../../utils/formatPersonName';
import { CONDITION_GROUP_OPTIONS, RELATIONSHIP_OPTIONS } from './dependentEligibility';
import { groupCodeToTitle } from './dependentGroupUtils';

type Route = RouteProp<RootStackParamList, 'DependentSaved'>;

function formatEffectiveFrom(value: string): string {
  const match = /^(\d{4})-(\d{2})/.exec((value || '').trim());
  if (!match) return value || '—';
  return `01/${match[2]}/${match[1]}`;
}

function relationshipLabel(code: string): string {
  return RELATIONSHIP_OPTIONS.find((item) => item.value === code)?.label || code || '—';
}

function conditionLabel(groupCode: string, groupId?: number): string {
  if (groupId && groupId >= 1 && groupId <= CONDITION_GROUP_OPTIONS.length) {
    return CONDITION_GROUP_OPTIONS[groupId - 1].title;
  }
  return groupCodeToTitle(groupCode);
}

export const DependentSavedScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<Route>();
  const { fullName, relationship, groupCode, groupId, effectiveFromMonth } = route.params;
  const displayName = formatPersonName(fullName) || fullName;

  const goToList = () => {
    navigation.reset({
      index: 1,
      routes: [{ name: 'Home' }, { name: 'DependentList' }],
    });
  };

  return (
    <View style={styles.safe}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      <SavedPattern />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>Đơn đăng ký người phụ thuộc</Text>
          <Text style={styles.title}>Đã lưu hồ sơ</Text>
          <Text style={styles.lead}>
            Thông tin của <Text style={styles.leadName}>{displayName}</Text> đã được ghi nhận vào
            danh sách người phụ thuộc.
          </Text>
        </View>

        <View style={styles.cardShadow}>
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardKicker}>BIÊN NHẬN HỒ SƠ</Text>
              <Text style={styles.cardBrand}>TaxKeep VN</Text>
            </View>
            <View style={styles.doubleRule} />

            <ReceiptRow label="Người phụ thuộc" value={displayName} />
            <ReceiptRow label="Quan hệ" value={relationshipLabel(relationship)} />
            <ReceiptRow label="Điều kiện" value={conditionLabel(groupCode, groupId)} />
            <ReceiptRow label="Hiệu lực từ" value={formatEffectiveFrom(effectiveFromMonth)} last />
          </View>

          <View style={styles.stamp} pointerEvents="none">
            <View style={styles.stampInner}>
              <Text style={styles.stampSmall}>TAXKEEP</Text>
              <Text style={styles.stampMain}>ĐÃ LƯU</Text>
              <Text style={styles.stampSmall}>HỒ SƠ NPT</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.button}
          activeOpacity={0.85}
          onPress={goToList}
          accessibilityRole="button"
          accessibilityLabel="Về danh sách người phụ thuộc"
          testID="dependentSavedGoList"
        >
          <Text style={styles.buttonText}>Về danh sách người phụ thuộc</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

/** Hoa văn 460px, right -190 / top -150, mờ từ 40% đến 80% chiều cao. */
function SavedPattern() {
  return (
    <View pointerEvents="none" style={styles.pattern}>
      <LinearGradient
        colors={['#ECE9C2', '#ECE9C2', '#F8F5EE']}
        locations={[0, 0.45, 1]}
        style={styles.wash}
      />
      <View style={styles.drumFrame}>
        <Image
          source={require('../../../assets/brand/trong-dong-header.png')}
          style={styles.drum}
          resizeMode="contain"
        />
        <LinearGradient
          colors={['transparent', 'transparent', '#F8F5EE', '#F8F5EE']}
          locations={[0, 0.4, 0.8, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </View>
  );
}

function ReceiptRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8F5EE',
  },
  pattern: {
    ...StyleSheet.absoluteFillObject,
  },
  wash: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 300,
  },
  drumFrame: {
    position: 'absolute',
    width: 460,
    height: 460,
    top: -150,
    right: -190,
  },
  drum: {
    width: 460,
    height: 460,
    opacity: 0.8,
  },
  scroll: {
    paddingBottom: 56,
  },
  heading: {
    paddingTop: 56,
    paddingHorizontal: 22,
  },
  eyebrow: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: '#5A4A22',
  },
  title: {
    fontFamily: fonts.serifBold,
    fontSize: 30,
    lineHeight: 36,
    color: '#661212',
    marginTop: 6,
  },
  lead: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22,
    color: '#444444',
    maxWidth: 250,
    marginTop: 8,
  },
  leadName: {
    fontFamily: fonts.bodyBold,
    color: '#444444',
  },
  cardShadow: {
    marginTop: 30,
    marginHorizontal: 22,
    borderRadius: 4,
    backgroundColor: '#DED7CB',
    paddingBottom: 1,
    shadowColor: '#661212',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#DED7CB',
    paddingTop: 16,
    paddingHorizontal: 18,
    paddingBottom: 20,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
  },
  cardKicker: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    lineHeight: 14,
    color: '#661212',
  },
  cardBrand: {
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 14,
    color: '#666666',
  },
  doubleRule: {
    height: 3,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#C59A3F',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 11,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderStyle: 'dotted',
    borderColor: '#BDB5A6',
  },
  rowLabel: {
    width: 96,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: '#666666',
  },
  rowValue: {
    flex: 1,
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    lineHeight: 20,
    color: '#1E1E1E',
  },
  stamp: {
    position: 'absolute',
    right: -8,
    bottom: -44,
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: '#B3261E',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    opacity: 0.88,
    transform: [{ rotate: '-12deg' }],
  },
  stampInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: '#B3261E',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  stampSmall: {
    fontFamily: fonts.bodyBold,
    fontSize: 7,
    lineHeight: 7,
    color: '#B3261E',
  },
  stampMain: {
    fontFamily: fonts.bodyExtra,
    fontSize: 15,
    lineHeight: 15,
    color: '#B3261E',
  },
  footer: {
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#F8F5EE',
  },
  button: {
    height: 52,
    borderRadius: 10,
    backgroundColor: '#8B1E1E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    lineHeight: 20,
    color: '#FFFFFF',
  },
});
