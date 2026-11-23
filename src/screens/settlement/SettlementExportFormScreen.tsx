import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { SettlementExportHeader } from '../../components/navigation/SettlementExportHeader';
import { RootNavigationProp, RootStackParamList } from '../../navigation/types';
import { profileApi } from '../../api/profileApi';
import type { TaxSettlementExportZipRequest } from '../../types/taxSettlement';

type Route = RouteProp<RootStackParamList, 'SettlementExportForm'>;

export const SettlementExportFormScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const insets = useSafeAreaInsets();
  const { params } = useRoute<Route>();
  const refundHint = (params.refundAmount ?? 0) > 0;

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [taxOfficeName, setTaxOfficeName] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [contactAddress, setContactAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        setLoadingProfile(true);
        try {
          const p = await profileApi.getProfile();
          if (!alive) return;
          setTaxCode((v) => v || p.taxIdNumber || '');
          setContactAddress((v) => v || p.address || '');
          setPhoneNumber((v) => v || p.phoneNumber || '');
          setEmail((v) => v || p.email || '');
        } catch {
          // Thông tin điền sẵn không bắt buộc — bỏ qua nếu chưa tải được hồ sơ cá nhân
        } finally {
          if (alive) setLoadingProfile(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, [])
  );

  const buildForm = useCallback(
    (): TaxSettlementExportZipRequest => ({
      taxOfficeName,
      taxCode,
      bankAccountNumber,
      bankName,
      contactAddress,
      phoneNumber,
      email,
      note,
    }),
    [
      bankAccountNumber,
      bankName,
      contactAddress,
      email,
      note,
      phoneNumber,
      taxCode,
      taxOfficeName,
    ]
  );

  const onPdf = useCallback(() => {
    navigation.navigate('SettlementPdfViewer', {
      dossierId: params.dossierId,
      form: buildForm(),
    });
  }, [buildForm, navigation, params.dossierId]);

  const onZip = useCallback(() => {
    navigation.navigate('SettlementZipReady', {
      dossierId: params.dossierId,
      form: buildForm(),
      refundAmount: params.refundAmount,
    });
  }, [buildForm, navigation, params.dossierId, params.refundAmount]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <SettlementExportHeader
        title="Xuất hồ sơ"
        backTestID="exportFormBack"
        homeTestID="exportFormHome"
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {loadingProfile ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            testID="exportFormScroll"
          >
            <View style={styles.containerInner}>
              <Text style={styles.lead}>
                Bổ sung thông tin in trên tờ khai quyết toán (tuỳ chọn). Nếu để trống, hệ thống tự động điền theo hồ sơ cá nhân của bạn.
              </Text>

              {refundHint ? (
                <View style={styles.hintBox}>
                  <Ionicons name="information-circle-outline" size={18} color="#7A5A14" />
                  <Text style={styles.hintText}>
                    Vui lòng điền số tài khoản ngân hàng để in đầy đủ thông tin nhận hoàn thuế trên tờ khai.
                  </Text>
                </View>
              ) : null}

              <Section num="01" title="Thông tin cơ quan thuế">
                <Field
                  label="Cơ quan thuế"
                  value={taxOfficeName}
                  onChange={setTaxOfficeName}
                  placeholder="VD: Cục Thuế TP. Hồ Chí Minh"
                  testID="exportTaxOffice"
                />
                <Field
                  label="Mã số thuế"
                  value={taxCode}
                  onChange={setTaxCode}
                  placeholder="10 hoặc 13 chữ số"
                  keyboardType="number-pad"
                  testID="exportTaxCode"
                />
              </Section>

              <Section num="02" title="Tài khoản nhận hoàn thuế">
                <Field
                  label="Số tài khoản"
                  value={bankAccountNumber}
                  onChange={setBankAccountNumber}
                  placeholder="VD: 0071000123456"
                  keyboardType="number-pad"
                  testID="exportBankAccount"
                />
                <Field
                  label="Ngân hàng"
                  value={bankName}
                  onChange={setBankName}
                  placeholder="VD: Vietcombank"
                  testID="exportBankName"
                />
              </Section>

              <Section num="03" title="Thông tin liên hệ">
                <Field
                  label="Địa chỉ"
                  value={contactAddress}
                  onChange={setContactAddress}
                  testID="exportAddress"
                />
                <Field
                  label="Số điện thoại"
                  value={phoneNumber}
                  onChange={setPhoneNumber}
                  placeholder="VD: 0912345678"
                  keyboardType="phone-pad"
                  testID="exportPhone"
                />
                <Field
                  label="Email"
                  value={email}
                  onChange={setEmail}
                  placeholder="VD: nnt@tenmien.vn"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  testID="exportEmail"
                />
                <Field
                  label="Ghi chú"
                  subLabel="tệp hồ sơ nén"
                  value={note}
                  onChange={setNote}
                  testID="exportNote"
                />
              </Section>
            </View>
          </ScrollView>
        )}

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.footerInner}>
            <TouchableOpacity
              style={styles.cta}
              onPress={onPdf}
              testID="exportPdfBtn"
              disabled={loadingProfile}
              accessibilityRole="button"
            >
              <Ionicons name="document-text-outline" size={18} color="#fff" />
              <Text style={styles.ctaText} numberOfLines={1}>
                Tải tờ khai PDF
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondary}
              onPress={onZip}
              testID="exportZipBtn"
              disabled={loadingProfile}
              accessibilityRole="button"
            >
              <Ionicons name="archive-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.secondaryText} numberOfLines={1}>
                Tải bộ hồ sơ
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const Section = React.memo<{ num: string; title: string; children: React.ReactNode }>(
  ({ num, title, children }) => (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionNum}>{num}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  )
);

type FieldProps = {
  label: string;
  subLabel?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad' | 'phone-pad' | 'email-address';
  autoCapitalize?: 'none' | 'sentences';
  testID?: string;
};

const Field = React.memo<FieldProps>(
  ({ label, subLabel, value, onChange, placeholder, keyboardType, autoCapitalize, testID }) => (
    <View style={styles.fieldRow}>
      <View style={styles.fieldLabelWrap}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {subLabel ? <Text style={styles.fieldSub}>{subLabel}</Text> : null}
      </View>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9A9488"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        testID={testID}
      />
    </View>
  )
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F5EE' },
  flex: { flex: 1 },
  body: { paddingHorizontal: 22, paddingBottom: 24, paddingTop: 12 },
  containerInner: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  lead: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: '#444', marginBottom: 14 },
  hintBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: '#F3ECD8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  hintText: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: '#5A4A22' },
  section: { marginBottom: 18 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingBottom: 4,
    borderBottomWidth: 3,
    borderBottomColor: '#C59A3F',
    marginBottom: 4,
  },
  sectionNum: { fontFamily: fonts.serifBold, fontSize: 15, color: '#7A5A14' },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: theme.colors.textPrimary },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#DED7CB',
    gap: 10,
  },
  fieldLabelWrap: { width: 104 },
  fieldLabel: { fontFamily: fonts.body, fontSize: 13, color: '#666' },
  fieldSub: { fontFamily: fonts.body, fontSize: 11, color: '#9A9488' },
  fieldInput: {
    flex: 1,
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: theme.colors.textPrimary,
    paddingVertical: 10,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#DED7CB',
    backgroundColor: '#F8F5EE',
  },
  footerInner: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  cta: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
  },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 15, color: '#fff', flexShrink: 1 },
  secondary: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
  },
  secondaryText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: theme.colors.primary,
    flexShrink: 1,
  },
});
