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
  DependentSaved: {
    fullName: string;
    relationship: string;
    groupCode: string;
    groupId?: number;
    effectiveFromMonth: string;
  };
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
  ExpenseList: undefined;
  ExpenseUpload: { targetYear?: number; periodId?: string } | undefined;
  ExpenseReview: { ocrResult: import('../types/expense').ExpenseOcrResult; periodId?: string; isReadOnly?: boolean };
  SettlementStart: undefined;
  SettlementPreview: {
    taxYear: number;
    cutoffDate?: string;
    charityDeduction?: number;
  };
  SettlementSuccess: {
    dossierId: string;
    taxYear: number;
    cutoffDate: string;
    refundAmount: number;
    dueAmount: number;
    summaryMessage: string;
  };
  SettlementList: undefined;
  SettlementDetail: { id: string };
  SettlementExportForm: {
    dossierId: string;
    taxYear?: number;
    refundAmount?: number;
  };
  SettlementPdfViewer: {
    dossierId: string;
    form: import('../types/taxSettlement').TaxSettlementExportPdfRequest;
  };
  SettlementZipReady: {
    dossierId: string;
    form: import('../types/taxSettlement').TaxSettlementExportZipRequest;
    refundAmount?: number;
    package?: import('../types/taxSettlement').TaxSettlementPackageZipResponse;
  };
  SettlementDownloadExpired: {
    dossierId: string;
    refundAmount?: number;
  };
  ExpertList: undefined;
  ExpertDetail: { expertProfileId: string };
  BookingCreate: { expertProfileId: string; initialSlotId?: string; specializationId?: number };
  MyBookings: { initialStatus?: string } | undefined;
  BookingDetail: { bookingId: string };
};

export type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;
