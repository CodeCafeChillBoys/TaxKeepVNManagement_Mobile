import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OcrDependentFill, OcrFormFill, ScanIdentitySource } from '../types/ocr';

export type RootStackParamList = {
  Login: undefined;
  Register: { ocrResult?: OcrFormFill } | undefined;
  VerifyPending: { email: string };
  Home: undefined;
  Profile: undefined;
  EditProfile: { autoFocusTaxId?: boolean; ocrResult?: OcrFormFill } | undefined;
  ScanIdentity: {
    source: ScanIdentitySource;
    hasExistingData?: boolean;
    /** CCCD khóa trên hồ sơ — so khớp khi source=editProfile */
    lockedCitizenId?: string;
  };
  TaxRegistration: { ocrDependentFill?: OcrDependentFill } | undefined;
  ProofDocuments:
    | {
        groupIndex?: number;
        dependentId?: string;
        /** Checklist từ PATCH /group — ưu tiên hơn LAW_GROUP_SPECS local */
        requiredDocuments?: string[];
        dependentData?: {
          fullName: string;
          citizenId?: string;
          birthCertNumber?: string;
          dateOfBirth: string;
          relationship: string;
          effectiveFromMonth: string;
          effectiveToMonth?: string;
          groupId: number;
          groupCode: string;
        };
      }
    | undefined;
  IncomeSourceList: undefined;
  ChangePassword: undefined;
  LawConditions: undefined;
  DependentList: undefined;
  SettlementHome: { taxYear?: number } | undefined;
  SettlementReview: { dossierId: string };
  SettlementResult: { dossierId: string };
  ExpenseList: undefined;
  ExpenseUpload: { targetYear?: number; periodId?: string } | undefined;
  ExpenseReview: { ocrResult: import('../types/expense').ExpenseOcrResult; periodId?: string; isReadOnly?: boolean };
};

export type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;
