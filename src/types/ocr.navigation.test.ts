import {
  SCAN_IDENTITY_SOURCES,
  isScanIdentitySource,
  type OcrDependentFill,
  type OcrFormFill,
  type OcrExtractedFields,
  type ScanIdentitySource,
} from '../types/ocr';
import type { RootStackParamList } from '../navigation/types';

describe('OCR types & navigation params', () => {
  describe('ScanIdentitySource', () => {
    it('includes register, editProfile, and dependent', () => {
      expect(SCAN_IDENTITY_SOURCES).toEqual(['register', 'editProfile', 'dependent']);
      expect(isScanIdentitySource('dependent')).toBe(true);
      expect(isScanIdentitySource('register')).toBe(true);
      expect(isScanIdentitySource('editProfile')).toBe(true);
      expect(isScanIdentitySource('other')).toBe(false);
    });
  });

  describe('OcrFormFill', () => {
    it('carries register/profile fill plus optional availability warning', () => {
      const fill: OcrFormFill = {
        fullName: 'Nguyen Van A',
        citizenId: '079301001234',
        dateOfBirth: '1990-05-12',
        address: 'Ha Noi',
        isAvailable: false,
        warning: 'Số CCCD này đã được đăng ký tài khoản trong hệ thống.',
      };

      expect(fill.citizenId).toBe('079301001234');
      expect(fill.isAvailable).toBe(false);
      expect(fill.warning).toContain('đã được đăng ký');
    });
  });

  describe('OcrDependentFill', () => {
    it('carries NPT fill fields used after scan confirm', () => {
      const fill: OcrDependentFill = {
        fullName: 'Nguyen Van B',
        birthDate: '2010-05-15',
        citizenId: '079301009999',
        birthCertNumber: undefined,
        suggestedGroup: 'CHILD_UNDER_18',
        relationship: 'CHILD',
        selectedGroupIdx: 0,
      };

      expect(fill.selectedGroupIdx).toBe(0);
      expect(fill.relationship).toBe('CHILD');
      expect(fill.birthDate).toBe('2010-05-15');
    });
  });

  describe('OcrExtractedFields review extras', () => {
    it('allows documentNumber and suggestedGroup on extracted review fields', () => {
      const fields: OcrExtractedFields = {
        fullName: 'NGUYEN VAN C',
        citizenId: '',
        dateOfBirth: '2015-01-01',
        address: '',
        gender: '',
        issueDate: '',
        documentNumber: 'GKS-001',
        suggestedGroup: 'CHILD_UNDER_18',
        isAvailable: true,
        warning: null,
      };

      expect(fields.documentNumber).toBe('GKS-001');
      expect(fields.suggestedGroup).toBe('CHILD_UNDER_18');
    });
  });

  describe('RootStackParamList contracts', () => {
    it('ScanIdentity accepts dependent source and lockedCitizenId for editProfile', () => {
      const dependentScan: RootStackParamList['ScanIdentity'] = {
        source: 'dependent' as ScanIdentitySource,
        hasExistingData: false,
      };
      const editScan: RootStackParamList['ScanIdentity'] = {
        source: 'editProfile',
        hasExistingData: true,
        lockedCitizenId: '079301001234',
      };

      expect(dependentScan.source).toBe('dependent');
      expect(editScan.lockedCitizenId).toBe('079301001234');
    });

    it('TaxRegistration accepts ocrDependentFill; Register/EditProfile keep ocrResult', () => {
      const tax: RootStackParamList['TaxRegistration'] = {
        ocrDependentFill: {
          fullName: 'Nguyen Van D',
          birthDate: '2012-03-20',
          birthCertNumber: 'BS-99',
          selectedGroupIdx: 0,
        },
      };
      const register: RootStackParamList['Register'] = {
        ocrResult: {
          fullName: 'A',
          citizenId: '079301001234',
          dateOfBirth: '1990-01-01',
          address: 'HN',
        },
      };
      const edit: RootStackParamList['EditProfile'] = {
        ocrResult: {
          fullName: 'A',
          citizenId: '079301001234',
          dateOfBirth: '1990-01-01',
          address: 'HN',
          isAvailable: true,
        },
      };

      expect(tax?.ocrDependentFill?.birthCertNumber).toBe('BS-99');
      expect(register?.ocrResult?.citizenId).toBe('079301001234');
      expect(edit?.ocrResult?.isAvailable).toBe(true);
    });
  });
});
