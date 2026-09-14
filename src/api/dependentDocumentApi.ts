import { Platform } from 'react-native';
import { apiClient, storageHelper } from './apiClient';
import { config } from '../constants/config';

export interface DependentItem {
  id: string;
  fullName: string;
  birthDate: string;
  currentGroup: string;
  groupTitle: string;
  isProfileComplete: boolean;
  requiredDocs: string[];
  citizenId?: string;
  birthCertNumber?: string;
  relationship?: string;
  effectiveFromMonth?: string;
  effectiveToMonth?: string;
  status?: string;
}

export interface UploadedDocumentItem {
  docId: string;
  dependentId: string;
  docType: string;
  docTypeLabel: string;
  fileName: string;
  fileUrl: string;
  fileMimeType: string;
  isReadable: boolean;
  uploadedAt: string;
}

export interface UploadDocumentResponse {
  docId: string;
  dependentId: string;
  docType: string;
  fileUrl: string;
  fileMimeType: string;
  isReadable: boolean;
  uploadedAt: string;
  isProfileComplete: boolean;
  missingDocuments: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: any;
}

export interface DependentDocumentRuleItem {
  ruleId: string;
  targetGroup: string;
  docType: string;
  isMandatory: boolean;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const DOC_TYPE_OPTIONS = [
  { value: 'BIRTH_CERTIFICATE', label: 'Giấy khai sinh (Bản sao)' },
  { value: 'CITIZEN_CARD', label: 'Thẻ Căn cước / CCCD' },
  { value: 'CITIZEN_ID', label: 'Căn cước công dân (Bản sao)' },
  { value: 'STUDENT_DOCUMENT', label: 'Thẻ sinh viên / Giấy xác nhận trường' },
  { value: 'STUDENT_CARD', label: 'Thẻ HSSV / Giấy xác nhận trường' },
  { value: 'DISABILITY_OR_INCAPACITY_CERT', label: 'Giấy xác nhận khuyết tật / mất NLHV dân sự' },
  { value: 'DISABILITY_CERTIFICATE', label: 'Giấy xác nhận khuyết tật' },
  { value: 'MARRIAGE_CERTIFICATE', label: 'Giấy chứng nhận kết hôn' },
  { value: 'LABOR_INCAPACITY_DOC', label: 'Giấy tờ chứng minh suy giảm khả năng LĐ (≥81%)' },
  { value: 'TAXPAYER_BIRTH_CERT', label: 'Giấy khai sinh của NNT (chứng minh quan hệ)' },
  { value: 'SPOUSE_BIRTH_CERT', label: 'Giấy khai sinh của vợ/chồng (chứng minh quan hệ)' },
  { value: 'RELATIONSHIP_CERTIFICATE', label: 'Giấy tờ chứng minh quan hệ (Hộ khẩu)' },
  { value: 'SUPPORT_COMMITMENT_FORM', label: 'Bản cam kết nuôi dưỡng trực tiếp' },
  { value: 'OTHER', label: 'Giấy tờ minh chứng hợp pháp khác' },
];

export const getDocTypeLabel = (docType: string): string => {
  const found = DOC_TYPE_OPTIONS.find((opt) => opt.value === docType.toUpperCase());
  return found ? found.label : docType;
};

export const getGroupTitle = (currentGroup?: string): string => {
  switch (currentGroup) {
    case 'CHILD_UNDER_18':
      return 'Nhóm 1: Con chưa thành niên (< 18 tuổi)';
    case 'CHILD_OVER_18_STUDYING':
    case 'CHILD_STUDYING':
      return 'Nhóm 2: Con ≥ 18 tuổi đang theo học ĐH/CĐ';
    case 'CHILD_OVER_18_DISABLED':
    case 'CHILD_DISABLED':
    case 'DISABLED_DEPENDENT':
      return 'Nhóm 3: Con bị khuyết tật / Mất khả năng LĐ';
    case 'SPOUSE_RETIRED':
    case 'SPOUSE_DISABLED':
    case 'PARENT_RETIRED':
    case 'PARENT_DISABLED':
    case 'SPOUSE_OR_PARENTS':
    case 'PARENT':
    case 'SPOUSE':
    case 'PARENT_IN_LAW':
      return 'Nhóm 4: Vợ / Chồng hoặc Cha / Mẹ';
    case 'OTHER_HELPLESS':
    case 'OTHER_DEPENDENT':
      return 'Nhóm 5: Cá nhân không nơi nương tựa khác';
    default:
      return 'Người phụ thuộc';
  }
};

export const getFullFileUrl = (fileUrl?: string): string => {
  if (!fileUrl) return '';
  let url = fileUrl;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    const cleanBase = config.apiBaseUrl.replace(/\/+$/, '');
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    url = `${cleanBase}${cleanPath}`;
  }
  // Đồng bộ host giữa Android Emulator (10.0.2.2) và Web / iOS / Host (localhost)
  if (Platform.OS === 'android' && (url.includes('localhost:5023') || url.includes('127.0.0.1:5023'))) {
    url = url.replace('localhost:5023', '10.0.2.2:5023').replace('127.0.0.1:5023', '10.0.2.2:5023');
  } else if (Platform.OS !== 'android' && url.includes('10.0.2.2:5023')) {
    url = url.replace('10.0.2.2:5023', 'localhost:5023');
  }
  return url;
};

const STORAGE_DOCS_PREFIX = 'taxkeep_docs_';

export const dependentDocumentApi = {
  // Tạo hồ sơ người phụ thuộc mới: POST /api/v1/dependents
  createDependent: async (data: {
    fullName: string;
    relationship: string;
    currentGroup: string;
    birthDate: string;
    citizenId?: string;
    birthCertNumber?: string;
    taxIdNumber?: string;
    effectiveFromMonth: string;
    effectiveToMonth: string;
    note?: string;
  }): Promise<{ id: string; dependentId: string; fullName: string; citizenId?: string; [key: string]: any }> => {
    try {
      const res = await apiClient.post<any>('/api/v1/dependents', data);
      const result = res.data?.data || res.data;
      const realId = result?.dependentId || result?.id;
      if (!realId) {
        throw new Error('Máy chủ không trả về mã định danh người phụ thuộc.');
      }
      return {
        ...result,
        id: realId,
        dependentId: realId,
        fullName: data.fullName,
        citizenId: data.citizenId,
        birthCertNumber: data.birthCertNumber,
      };
    } catch (err: any) {
      const serverMessage =
        err?.response?.data?.message ||
        err?.response?.data?.errors?.message ||
        err?.message ||
        'Không thể đăng ký người phụ thuộc.';
      throw new Error(serverMessage);
    }
  },

  // Lấy danh sách NPT: gọi trực tiếp Backend API GET /api/v1/dependents
  getDependents: async (query?: { page?: number; size?: number; search?: string; status?: string; relationship?: string }): Promise<DependentItem[]> => {
    try {
      const res = await apiClient.get<any>('/api/v1/dependents', { params: query });
      const list = res.data?.data?.items || res.data?.data || res.data;
      if (Array.isArray(list)) {
        return list.map((item: any) => ({
          id: item.dependentId || item.id,
          fullName: item.fullName || item.name || 'Người phụ thuộc',
          birthDate: (item.birthDate || '').split('T')[0],
          currentGroup: item.currentGroup || 'CHILD_UNDER_18',
          groupTitle: item.groupTitle || getGroupTitle(item.currentGroup),
          isProfileComplete: Boolean(item.isProfileComplete),
          requiredDocs: item.requiredDocuments || item.requiredDocs || ['BIRTH_CERTIFICATE'],
          citizenId: item.citizenId,
          birthCertNumber: item.birthCertNumber,
          relationship: item.relationship,
          effectiveFromMonth: item.effectiveFromMonth,
          effectiveToMonth: item.effectiveToMonth,
          status: item.status || 'ACTIVE',
        }));
      }
      return [];
    } catch (err) {
      return [];
    }
  },

  // Lấy chi tiết NPT kèm danh sách tài liệu từ server: GET /api/v1/dependents/{id}
  getDependentById: async (dependentId: string): Promise<any> => {
    try {
      const res = await apiClient.get<any>(`/api/v1/dependents/${dependentId}`);
      const data = res.data?.data || res.data;
      if (data && Array.isArray(data.documents)) {
        data.documents = data.documents.map((d: any) => ({
          ...d,
          fileUrl: getFullFileUrl(d.fileUrl),
        }));
      }
      return data;
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Không thể lấy thông tin chi tiết người phụ thuộc.';
      throw new Error(msg);
    }
  },

  // Lấy danh sách giấy tờ đã nộp của 1 NPT trực tiếp từ server
  getDocuments: async (dependentId: string): Promise<UploadedDocumentItem[]> => {
    try {
      const res = await apiClient.get<any>(`/api/v1/dependents/${dependentId}`);
      const detail = res.data?.data || res.data;
      if (Array.isArray(detail?.documents)) {
        return detail.documents.map((d: any) => ({
          docId: d.docId || d.id,
          dependentId: d.dependentId || dependentId,
          docType: d.docType,
          docTypeLabel: getDocTypeLabel(d.docType),
          fileName: (d.fileUrl || '').split('/').pop() || d.docType,
          fileUrl: getFullFileUrl(d.fileUrl),
          fileMimeType: d.fileMimeType,
          isReadable: Boolean(d.isReadable),
          uploadedAt: d.uploadedAt,
        }));
      }
    } catch {}
    return [];
  },

  // Tải lên giấy tờ minh chứng mới: POST /api/v1/dependents/{dependentId}/documents
  uploadDocument: async (
    dependentId: string,
    docType: string,
    fileObj: { uri?: string; name: string; type: string; blob?: Blob | File }
  ): Promise<UploadDocumentResponse> => {
    const formData = new FormData();
    // Chuẩn hóa DocType đồng bộ giữa DB rule và Validator Backend
    let normalizedDocType = docType;
    if (docType === 'CITIZEN_CARD') normalizedDocType = 'CITIZEN_ID';
    if (docType === 'STUDENT_DOCUMENT') normalizedDocType = 'STUDENT_CARD';
    formData.append('DocType', normalizedDocType);

    const isRealFileUri =
      fileObj.uri &&
      (Platform.OS === 'web' ||
        fileObj.uri.startsWith('content://') ||
        fileObj.uri.startsWith('file:///data') ||
        fileObj.uri.startsWith('file:///storage') ||
        fileObj.uri.startsWith('file:///var') ||
        fileObj.uri.startsWith('http'));

    if (fileObj.blob) {
      formData.append('File', fileObj.blob, fileObj.name);
    } else if (isRealFileUri) {
      formData.append('File', {
        uri: fileObj.uri,
        name: fileObj.name,
        type: fileObj.type || 'image/jpeg',
      } as any);
    }

    let result: UploadDocumentResponse;

    try {
      // 1. Gửi request multipart lên Backend
      const response = await apiClient.post<ApiResponse<UploadDocumentResponse>>(
        `/api/v1/dependents/${dependentId}/documents`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          transformRequest: (data) => data,
        }
      );
      result = response.data?.data || response.data;
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.errors?.DocType?.[0] ||
        err?.message ||
        'Không thể tải lên giấy tờ minh chứng.';
      throw new Error(errMsg);
    }

    // Lưu vào bộ nhớ cục bộ để người dùng có thể xem lại ngay lập tức
    try {
      const currentDocs = await dependentDocumentApi.getDocuments(dependentId);
      const newDocItem: UploadedDocumentItem = {
        docId: result.docId,
        dependentId: result.dependentId,
        docType: result.docType,
        docTypeLabel: getDocTypeLabel(result.docType),
        fileName: fileObj.name,
        fileUrl: result.fileUrl,
        fileMimeType: result.fileMimeType,
        isReadable: result.isReadable,
        uploadedAt: result.uploadedAt,
      };

      const updatedDocs = [newDocItem, ...currentDocs];
      await storageHelper.setItem(STORAGE_DOCS_PREFIX + dependentId, JSON.stringify(updatedDocs));
    } catch {}

    return result;
  },

  // Lấy danh sách quy tắc giấy tờ từ Backend API: GET /api/v1/dependent-rules
  getRules: async (targetGroup?: string): Promise<DependentDocumentRuleItem[]> => {
    try {
      const query = targetGroup
        ? `?targetGroup=${encodeURIComponent(targetGroup)}&isActive=true&size=50`
        : '?isActive=true&size=100';
      const res = await apiClient.get<any>(`/api/v1/dependent-rules${query}`);
      const items = res.data?.data?.items || res.data?.data || res.data;
      if (Array.isArray(items)) {
        return items;
      }
      return [];
    } catch (err: any) {
      console.warn('getRules API error:', err?.response?.data || err?.message);
      return [];
    }
  },

  // Lấy danh sách nhắc nhở chuyển nhóm tuổi NPT: GET /api/v1/dependents/reminders/age-transitions
  getAgeTransitionReminders: async (taxYear: number = new Date().getFullYear()): Promise<AgeReminderItemDto[]> => {
    try {
      const res = await apiClient.get<any>('/api/v1/dependents/reminders/age-transitions', {
        params: { taxYear, size: 20 },
      });
      const items = res.data?.data?.items || res.data?.data || res.data;
      if (Array.isArray(items)) {
        return items;
      }
      return [];
    } catch (err: any) {
      console.warn('getAgeTransitionReminders error:', err?.response?.data || err?.message);
      return [];
    }
  },
};

export interface AgeReminderItemDto {
  dependentId: string;
  fullName: string;
  birthDate: string;
  currentGroup: string;
  recommendedGroup: string;
  transitionStatus: 'TURNING_18_SOON' | 'ALREADY_18_PENDING_ACTION' | string;
  turning18Date: string;
  daysRemaining: number;
  message: string;
  requiredAction: string;
}


