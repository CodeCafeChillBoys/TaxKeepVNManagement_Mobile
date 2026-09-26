import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { fonts } from '../../constants/fonts';
import { RootNavigationProp } from '../../navigation/types';
import { dependentDocumentApi } from '../../api/dependentDocumentApi';
import { DrumHeader } from '../../components/brand/DrumHeader';
import { GoldDoubleRule } from '../../components/brand/GoldDoubleRule';

/**
 * Màn hình: Điều kiện đăng kí (Figma Frame: iPhone 17 - 14)
 * Thiết kế chuẩn Figma:
 * - Header màu hoa văn trống đồng vàng be: "Điều kiện đăng kí"
 * - Hiển thị chi tiết toàn bộ 5 nhóm quy định luật và giấy tờ bắt buộc upload
 * - Không có thanh tìm kiếm, không có banner tự tạo, không có tab nhóm tùy biến
 */

interface LawConditionSection {
  id: number;
  groupTitle: string;
  logicCondition?: string;
  includesText?: string;
  docs: {
    code: string;
    text: string;
    subItems?: string[];
  }[];
}

const LAW_SECTIONS: LawConditionSection[] = [
  {
    id: 1,
    groupTitle: 'Nhóm 1: Con dưới 18 tuổi',
    logicCondition: 'Độ tuổi tính theo ngày sinh < 18 tuổi.',
    docs: [
      {
        code: 'a',
        text: 'Giấy khai sinh của con (hoặc bản trích lục khai sinh).',
      },
      {
        code: 'b',
        text: 'Căn cước công dân / Mã định danh cá nhân của con (nếu đã được cấp).',
      },
    ],
  },
  {
    id: 2,
    groupTitle: 'Nhóm 2: Con từ 18 tuổi trở lên đang đi học',
    logicCondition: 'Độ tuổi < 18 tuổi và còn đang theo học các bậc giáo dục.',
    docs: [
      {
        code: 'a',
        text: 'Căn cước công dân của con.',
      },
      {
        code: 'b',
        text: 'Giấy khai sinh của con (chứng minh quan hệ).',
      },
      {
        code: 'c',
        text: 'Thẻ sinh viên (còn hạn) hoặc Giấy xác nhận học sinh/sinh viên từ trường đại học, cao đẳng, trung cấp, học nghề.',
      },
    ],
  },
  {
    id: 3,
    groupTitle: 'Nhóm 3: Con bị khuyết tật / Mất khả năng lao động (≥ 18 tuổi)',
    logicCondition: 'Con đủ 18 tuổi trở lên nhưng không có khả năng tự lao động tạo thu nhập.',
    docs: [
      {
        code: 'a',
        text: 'Căn cước công dân của con.',
      },
      {
        code: 'b',
        text: 'Giấy khai sinh của con.',
      },
      {
        code: 'c',
        text: 'Giấy xác nhận mức độ khuyết tật (do UBND cấp xã cấp) hoặc Biên bản giám định y khoa mất khả năng lao động.',
      },
    ],
  },
  {
    id: 4,
    groupTitle: 'Nhóm 4: Vợ / Chồng hoặc Cha / Mẹ',
    includesText: 'Vợ, chồng; cha mẹ đẻ, cha mẹ vợ/chồng, cha mẹ kế, cha mẹ nuôi hợp pháp.',
    docs: [
      {
        code: 'a',
        text: 'Căn cước công dân của người phụ thuộc (cha/mẹ hoặc vợ/chồng).',
      },
      {
        code: 'b',
        text: 'Giấy tờ chứng minh quan hệ:',
        subItems: [
          'Nếu là Vợ/Chồng: Giấy chứng nhận kết hôn.',
          'Nếu là Cha mẹ đẻ: Giấy khai sinh của người nộp thuế.',
          'Nếu là Cha mẹ vợ/chồng: Giấy kết hôn của NNT + Giấy khai sinh của vợ/chồng.',
          'Nếu là Cha mẹ nuôi: Quyết định công nhận việc nuôi con nuôi.',
        ],
      },
      {
        code: 'c',
        text: 'Giấy tờ chứng minh điều kiện giảm trừ:',
        subItems: [
          'Nếu ngoài độ tuổi lao động: Bản cam kết không có thu nhập (hoặc thu nhập dưới ngưỡng luật định).',
          'Nếu trong độ tuổi lao động: Giấy xác nhận khuyết tật / mất khả năng lao động.',
        ],
      },
    ],
  },
  {
    id: 5,
    groupTitle: 'Nhóm 5: Cá nhân không nơi nương tựa khác',
    includesText: 'Anh, chị, em ruột; ông bà nội/ngoại; cô dì chú bác ruột; cháu ruột.',
    docs: [
      {
        code: 'a',
        text: 'Căn cước công dân / Giấy khai sinh của người phụ thuộc.',
      },
      {
        code: 'b',
        text: 'Giấy tờ chứng minh quan hệ huyết thống (Giấy khai sinh các bên, thông tin cư trú chứng minh cùng dòng họ).',
      },
      {
        code: 'c',
        text: 'Văn bản xác nhận của UBND cấp xã nơi cư trú xác nhận người nộp thuế đang trực tiếp nuôi dưỡng và người phụ thuộc không còn ai khác phụ dưỡng.',
      },
      {
        code: 'd',
        text: 'Giấy tờ điều kiện lao động:',
        subItems: [
          'Nếu trong độ tuổi lao động: Giấy xác nhận khuyết tật/ mất khả năng lao động.',
          'Nếu ngoài độ tuổi lao động: Bản cam kết không có thu nhập hợp lệ.',
        ],
      },
    ],
  },
];

export const LawConditionsScreen: React.FC = () => {
  const navigation = useNavigation<RootNavigationProp>();
  const [sections, setSections] = useState<LawConditionSection[]>(LAW_SECTIONS);
  const [openId, setOpenId] = useState<number>(1);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      const rules = await dependentDocumentApi.getRules();
      if (rules && rules.length > 0) {
        const updated = LAW_SECTIONS.map((sec) => {
          let matchedRules = rules.filter((r) => {
            if (sec.id === 1) return r.targetGroup === 'CHILD_UNDER_18';
            if (sec.id === 2) return r.targetGroup === 'CHILD_STUDYING';
            if (sec.id === 3) return r.targetGroup === 'CHILD_DISABLED';
            if (sec.id === 4) return r.targetGroup === 'SPOUSE' || r.targetGroup === 'PARENT' || r.targetGroup === 'PARENT_IN_LAW';
            if (sec.id === 5) return r.targetGroup === 'OTHER_HELPLESS';
            return false;
          });

          if (matchedRules.length > 0) {
            return {
              ...sec,
              docs: matchedRules.map((r, i) => ({
                code: String.fromCharCode(97 + i),
                text: `${r.description || r.docType}${r.isMandatory ? ' (Bắt buộc)' : ' (Tùy chọn)'}`,
              })),
            };
          }
          return sec;
        });
        setSections(updated);
      }
    } catch (err) {
      console.warn('loadRules err in LawConditionsScreen:', err);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <DrumHeader
        title="Điều kiện luật"
        onBack={() => navigation.goBack()}
        backTestID="lawConditionsBackBtn"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lead}>
          Năm nhóm giảm trừ gia cảnh. Mở một nhóm để xem điều kiện và giấy tờ cần nộp.
        </Text>
        <GoldDoubleRule style={styles.rule} />

        {sections.map((sec) => {
          const open = openId === sec.id;
          const shortTitle = sec.groupTitle.replace(/^Nhóm\s+\d+\s*:\s*/, '');
          return (
            <View key={sec.id} style={styles.section}>
              <TouchableOpacity
                style={styles.sectionHead}
                onPress={() => setOpenId(open ? 0 : sec.id)}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
              >
                <Text style={styles.index}>{String(sec.id).padStart(2, '0')}</Text>
                <View style={styles.sectionTitles}>
                  <Text style={styles.groupTitle}>{shortTitle}</Text>
                  {!open && (sec.logicCondition || sec.includesText) ? (
                    <Text style={styles.preview} numberOfLines={1}>
                      {sec.logicCondition || sec.includesText}
                    </Text>
                  ) : null}
                </View>
                <Ionicons
                  name={open ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#999999"
                />
              </TouchableOpacity>

              {open ? (
                <View style={styles.body}>
                  {sec.logicCondition ? (
                    <Text style={styles.note}>{sec.logicCondition}</Text>
                  ) : null}
                  {sec.includesText ? (
                    <Text style={styles.note}>Gồm {sec.includesText}</Text>
                  ) : null}
                  <Text style={styles.docsLabel}>Giấy tờ cần nộp</Text>
                  {sec.docs.map((doc) => (
                    <View key={doc.code} style={styles.docItem}>
                      <Text style={styles.docLetter}>{doc.code}</Text>
                      <View style={styles.docCopy}>
                        <Text style={styles.docText}>{doc.text}</Text>
                        {doc.subItems?.map((sub, sIdx) => (
                          <Text key={sIdx} style={styles.subItem}>
                            {sub}
                          </Text>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 40,
  },
  lead: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22,
    color: '#444444',
  },
  rule: {
    marginTop: 16,
    marginBottom: 4,
  },
  section: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
  },
  index: {
    width: 28,
    fontFamily: fonts.serifBold,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.gold,
  },
  sectionTitles: {
    flex: 1,
    gap: 2,
  },
  groupTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.textPrimary,
  },
  preview: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.textSecondary,
  },
  body: {
    paddingLeft: 40,
    paddingBottom: 14,
  },
  note: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: '#444444',
    marginBottom: 8,
  },
  docsLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
    color: '#5A4A22',
    marginTop: 4,
    marginBottom: 8,
  },
  docItem: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  docLetter: {
    width: 16,
    fontFamily: fonts.serifBold,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.primaryDark,
  },
  docCopy: {
    flex: 1,
  },
  docText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textPrimary,
  },
  subItem: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: '#555555',
    marginTop: 4,
  },
});
