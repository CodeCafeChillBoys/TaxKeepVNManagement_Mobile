import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { apiClient, storageHelper } from './apiClient';
import { config } from '../constants/config';
import { groupName } from '../screens/dependent/dependentGroupUtils';
import { getCachedCatalog } from './dependentCatalogStore';
import {
  getDocTypeLabel,
  registerDocNames,
  extractUploadErrorMessage,
  resolveUploadFileName,
} from './dependentDocHelpers';

export interface DependentItem {
  id: string;
  fullName: string;
  birthDate: string;
  currentGroup: string;
  groupTitle: string;
  isProfileComplete: boolean;
  requiredDocs: string[];
  /** Giấy tờ bắt buộc còn thiếu (từ BE, tính theo rule hiện tại). */
  missingDocuments?: string[];
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
  docName?: string | null;
  description?: string;
  /** Các rule cùng targetGroup và cùng alternativeGroup: chỉ cần nộp 1. */
  alternativeGroup?: string | null;
  source?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Danh mục quan hệ / nhóm NPT đang active (GET /api/v1/dependents/catalog). */
export interface CatalogRelationship {
  code: string;
  name: string;
  displayOrder: number;
}

export interface CatalogGroup {
  code: string;
  name: string;
  relationshipCode?: string | null;
  minAge?: number | null;
  maxAge?: number | null;
  requireDisabled: boolean;
  requireStudying: boolean;
  level: number;
  displayOrder: number;
}

export interface DependentCatalog {
  relationships: CatalogRelationship[];
  groups: CatalogGroup[];
}

export { DOC_TYPE_OPTIONS, getDocTypeLabel } from './dependentDocHelpers';

/** Nhãn nhóm theo catalog đã cache (màn NPT nạp catalog qua useDependentCatalog). */
export const getGroupTitle = (currentGroup?: string): string =>
  groupName(getCachedCatalog(), currentGroup);

export const getFullFileUrl = (fileUrl?: string): string => {
  if (!fileUrl) return '';
  let url = fileUrl;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    const cleanBase = config.apiBaseUrl.replace(/\/+$/, '');
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    url = `${cleanBase}${cleanPath}`;
  }
  // Map localhost / 10.0.2.2 → host đang dùng trong config (LAN máy thật hoặc emulator)
  try {
    const apiHost = new URL(config.apiBaseUrl).host; // host:port
    url = url
      .replace(/localhost:5023/gi, apiHost)
      .replace(/127\.0\.0\.1:5023/gi, apiHost)
      .replace(/10\.0\.2\.2:5023/gi, apiHost);
  } catch {
    /* keep url */
  }
  return url;
};

const STORAGE_DOCS_PREFIX = 'taxkeep_docs_';

function extractValidationOrServerMessage(err: any, fallback: string): string {
  const data = err?.response?.data;
  const errors = data?.errors;
  if (errors && typeof errors === 'object' && !Array.isArray(errors)) {
    const fieldMessages: string[] = [];
    for (const [key, val] of Object.entries(errors)) {
      if (key === 'errorCode' || key === 'message') continue;
      if (Array.isArray(val)) {
        for (const item of val) {
          if (typeof item === 'string' && item.trim()) fieldMessages.push(item.trim());
        }
      } else if (typeof val === 'string' && val.trim()) {
        fieldMessages.push(val.trim());
      }
    }
    if (fieldMessages.length > 0) {
      return fieldMessages.join(' ');
    }
  }
  return (
    data?.message ||
    errors?.message ||
    err?.message ||
    fallback
  );
}

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
      const serverMessage = extractValidationOrServerMessage(
        err,
        'Không thể đăng ký người phụ thuộc.'
      );
      throw new Error(serverMessage);
    }
  },

  // Cập nhật hồ sơ NPT sau khi tạo: PUT /api/v1/dependents/{id}
  // Khớp UpdateDependentRequest (BE): tất cả trường đều tùy chọn (hỗ trợ partial update).
  updateDependent: async (
    dependentId: string,
    data: {
      fullName?: string;
      relationship?: string;
      currentGroup?: string;
      birthDate?: string;
      citizenId?: string;
      birthCertNumber?: string;
      taxIdNumber?: string;
      effectiveFromMonth?: string;
      effectiveToMonth?: string;
      note?: string;
      confirmIdentityChange?: boolean;
    }
  ): Promise<{
    dependentId: string;
    fullName: string;
    status?: string;
    requiredDocuments?: string[];
    missingDocuments?: string[];
    statusChanged?: boolean;
    documentsNeedReupload?: boolean;
    [key: string]: any;
  }> => {
    try {
      const res = await apiClient.put<any>(`/api/v1/dependents/${dependentId}`, data);
      const result = res.data?.data || res.data;
      return {
        ...result,
        dependentId: result?.dependentId || dependentId,
        fullName: result?.fullName || data.fullName || '',
        status: result?.status,
        requiredDocuments: Array.isArray(result?.requiredDocuments)
          ? result.requiredDocuments
          : undefined,
        missingDocuments: Array.isArray(result?.missingDocuments)
          ? result.missingDocuments
          : undefined,
        statusChanged: Boolean(result?.statusChanged ?? result?.status_changed),
        documentsNeedReupload: Boolean(
          result?.documentsNeedReupload ?? result?.documents_need_reupload
        ),
      };
    } catch (err: any) {
      const code =
        err?.response?.data?.errors?.errorCode || err?.response?.data?.errorCode || '';
      const serverMessage = extractValidationOrServerMessage(
        err,
        'Không thể cập nhật hồ sơ người phụ thuộc.'
      );
      const wrapped = new Error(serverMessage) as Error & { errorCode?: string };
      wrapped.errorCode = code;
      throw wrapped;
    }
  },

  // Lấy danh sách NPT: gọi trực tiếp Backend API GET /api/v1/dependents
  getDependents: async (query?: { page?: number; size?: number; search?: string; status?: string; relationship?: string }): Promise<DependentItem[]> => {
    try {
      const res = await apiClient.get<any>('/api/v1/dependents', { params: query });
      const list = res.data?.data?.items || res.data?.data || res.data;
      if (Array.isArray(list)) {
        return list.map((item: any) => {
          const missingDocuments = Array.isArray(item.missingDocuments)
            ? item.missingDocuments.filter((x: unknown) => typeof x === 'string' && x.trim())
            : [];
          // Đủ hồ sơ = cờ BE và không còn giấy bắt buộc thiếu (tránh lệch list vs chi tiết)
          const isProfileComplete =
            Boolean(item.isProfileComplete) && missingDocuments.length === 0;
          return {
            id: item.dependentId || item.id,
            fullName: item.fullName || item.name || 'Người phụ thuộc',
            birthDate: (item.birthDate || '').split('T')[0],
            currentGroup: item.currentGroup || '',
            groupTitle: item.groupTitle || getGroupTitle(item.currentGroup),
            isProfileComplete,
            requiredDocs: item.requiredDocuments || item.requiredDocs || ['BIRTH_CERTIFICATE'],
            missingDocuments,
            citizenId: item.citizenId,
            birthCertNumber: item.birthCertNumber,
            relationship: item.relationship,
            effectiveFromMonth: item.effectiveFromMonth,
            effectiveToMonth: item.effectiveToMonth,
            status: item.status || 'ACTIVE',
          };
        });
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

  // Quét lại giấy đã lưu sau khi đổi thông tin nhân thân: tải ảnh trên server về bộ nhớ tạm
  // rồi gửi lại qua API upload có sẵn, BE chạy lại OCR đối chiếu theo thông tin mới.
  reuploadStoredDocument: async (
    dependentId: string,
    docType: string,
    stored: { uri?: string; name: string; type: string }
  ): Promise<UploadDocumentResponse> => {
    if (!stored.uri) {
      throw new Error('Không tìm thấy ảnh đã lưu để quét lại. Vui lòng chọn ảnh khác.');
    }
    if (Platform.OS === 'web') {
      const response = await fetch(stored.uri);
      if (!response.ok) {
        throw new Error('Không tải được ảnh đã lưu để quét lại. Vui lòng chọn ảnh khác.');
      }
      const blob = await response.blob();
      return dependentDocumentApi.uploadDocument(dependentId, docType, {
        name: stored.name,
        type: stored.type || blob.type || 'image/jpeg',
        blob,
      });
    }
    const safeName = (stored.name || 'minh_chung').replace(/[^\w.\-]/g, '_');
    const target = `${FileSystem.cacheDirectory}reverify_${Date.now()}_${safeName}`;
    const dl = await FileSystem.downloadAsync(stored.uri, target);
    if (dl.status < 200 || dl.status >= 300) {
      throw new Error('Không tải được ảnh đã lưu để quét lại. Vui lòng chọn ảnh khác.');
    }
    try {
      return await dependentDocumentApi.uploadDocument(dependentId, docType, {
        uri: dl.uri,
        name: stored.name,
        type: stored.type,
      });
    } finally {
      FileSystem.deleteAsync(dl.uri, { idempotent: true }).catch(() => {});
    }
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

    const fileName = resolveUploadFileName(fileObj.name, fileObj.uri, fileObj.type);
    if (fileObj.blob) {
      formData.append('File', fileObj.blob, fileName);
    } else if (fileObj.uri) {
      formData.append('File', {
        uri: fileObj.uri,
        name: fileName,
        type: fileObj.type || 'image/jpeg',
      } as any);
    } else {
      // Trước đây gửi request không có file rồi nhận lỗi chung từ BE
      throw new Error('Không đọc được tệp đã chọn. Vui lòng chụp hoặc chọn lại tệp minh chứng.');
    }

    let result: UploadDocumentResponse;

    try {
      // Upload + OCR cross-check (TaxAI) thường >15s — đặc biệt ảnh CCCD.
      const response = await apiClient.post<ApiResponse<UploadDocumentResponse>>(
        `/api/v1/dependents/${dependentId}/documents`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          transformRequest: (data) => data,
          timeout: 120000,
        }
      );
      result = response.data?.data || response.data;
    } catch (err: any) {
      const isTimeout =
        err?.code === 'ECONNABORTED' || /timeout/i.test(String(err?.message || ''));
      const data = err?.response?.data;
      const errorCode =
        data?.errorCode ||
        data?.errors?.errorCode ||
        (isTimeout ? 'TIMEOUT' : undefined);
      const rawMessage = extractUploadErrorMessage(
        data,
        err?.message || 'Không thể tải lên giấy tờ minh chứng.'
      );
      const wrappedError: any = new Error(
        isTimeout
          ? 'Quá thời gian đọc thông tin giấy tờ. Vui lòng chụp lại ảnh rõ nét, đủ sáng và thử tải lên lại.'
          : rawMessage
      );
      wrappedError.errorCode = errorCode;
      wrappedError.httpStatus = err?.response?.status;
      wrappedError.rawMessage = rawMessage;
      wrappedError.code = err?.code;
      wrappedError.response = err?.response;
      wrappedError.request = err?.request;
      throw wrappedError;
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

    return {
      ...result,
      fileUrl: getFullFileUrl(result.fileUrl),
    };
  },

  // Danh mục quan hệ + nhóm NPT đang active: GET /api/v1/dependents/catalog.
  // Lỗi mạng thì ném lỗi để màn hình báo và cho thử lại (không có danh sách dự phòng).
  getCatalog: async (): Promise<DependentCatalog> => {
    const res = await apiClient.get<any>('/api/v1/dependents/catalog');
    const data = res.data?.data ?? res.data;
    return {
      relationships: Array.isArray(data?.relationships) ? data.relationships : [],
      groups: Array.isArray(data?.groups) ? data.groups : [],
    };
  },

  // Nhóm NPT đang có rule active trong DB: GET /api/v1/dependents/groups?relationship=PARENT
  getGroups: async (relationship?: string): Promise<string[]> => {
    try {
      const res = await apiClient.get<any>('/api/v1/dependents/groups', {
        params: relationship ? { relationship } : undefined,
      });
      const items = res.data?.data ?? res.data;
      return Array.isArray(items) ? items.filter((g: unknown) => typeof g === 'string') : [];
    } catch (err: any) {
      if (__DEV__) {
        console.warn('getGroups API error:', err?.response?.data || err?.message);
      }
      return [];
    }
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
        registerDocNames(items);
        return items;
      }
      return [];
    } catch (err: any) {
      if (__DEV__) {
        console.warn('getRules API error:', err?.response?.data || err?.message);
      }
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
      const status = err?.response?.status;
      const errorCode = err?.response?.data?.errors?.errorCode;
      if (__DEV__ && status !== 403 && errorCode !== 'FORBIDDEN') {
        console.warn('getAgeTransitionReminders error:', err?.response?.data || err?.message);
      }
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


