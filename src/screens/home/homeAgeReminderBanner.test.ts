import {
  buildPendingUploadAgeReminders,
  isReminderAwaitingUploadOnly,
  mergeAgeTransitionReminders,
  proofNavFromAgeReminder,
} from './homeAgeReminderBanner';
import type { AgeReminderItemDto, DependentItem } from '../../api/dependentDocumentApi';

describe('homeAgeReminderBanner', () => {
  const now = new Date(2026, 8, 21); // 21/09/2026

  it('builds pending-upload reminders for studying + incomplete profile', () => {
    const deps: DependentItem[] = [
      {
        id: 'dep-1',
        fullName: 'Lê Thị Kim Liên',
        birthDate: '2008-09-22',
        currentGroup: 'CHILD_OVER_18_STUDYING',
        groupTitle: 'Nhóm 2',
        isProfileComplete: false,
        requiredDocs: ['STUDENT_CARD'],
      },
      {
        id: 'dep-2',
        fullName: 'Đã đủ hồ sơ',
        birthDate: '2008-01-01',
        currentGroup: 'CHILD_OVER_18_STUDYING',
        groupTitle: 'Nhóm 2',
        isProfileComplete: true,
        requiredDocs: ['STUDENT_CARD'],
      },
      {
        id: 'dep-3',
        fullName: 'Còn nhóm 1',
        birthDate: '2008-09-15',
        currentGroup: 'CHILD_UNDER_18',
        groupTitle: 'Nhóm 1',
        isProfileComplete: true,
        requiredDocs: [],
      },
    ];

    const pending = buildPendingUploadAgeReminders(deps, { now });
    expect(pending).toHaveLength(1);
    expect(pending[0].dependentId).toBe('dep-1');
    expect(pending[0].requiredAction).toBe('UPLOAD_STUDENT_CARD');
    expect(isReminderAwaitingUploadOnly(pending[0])).toBe(true);
  });

  it('keeps pending upload when API no longer returns under-18 reminder', () => {
    const api: AgeReminderItemDto[] = [];
    const pending: AgeReminderItemDto[] = [
      {
        dependentId: 'dep-1',
        fullName: 'A',
        birthDate: '2008-09-22',
        currentGroup: 'CHILD_OVER_18_STUDYING',
        recommendedGroup: 'CHILD_OVER_18_STUDYING',
        transitionStatus: 'TURNING_18_SOON',
        turning18Date: '2026-09-22',
        daysRemaining: 1,
        message: 'upload',
        requiredAction: 'UPLOAD_STUDENT_CARD',
      },
    ];
    const merged = mergeAgeTransitionReminders(api, pending);
    expect(merged).toHaveLength(1);
    expect(merged[0].requiredAction).toBe('UPLOAD_STUDENT_CARD');
  });

  it('prefers pending-upload action when same dependent in both lists', () => {
    const api: AgeReminderItemDto[] = [
      {
        dependentId: 'dep-1',
        fullName: 'A',
        birthDate: '2008-09-22',
        currentGroup: 'CHILD_UNDER_18',
        recommendedGroup: 'CHILD_OVER_18_STUDYING',
        transitionStatus: 'TURNING_18_SOON',
        turning18Date: '2026-09-22',
        daysRemaining: 1,
        message: 'api',
        requiredAction: 'UPDATE_GROUP_AND_UPLOAD_STUDENT_CARD',
      },
    ];
    const pending: AgeReminderItemDto[] = [
      {
        ...api[0],
        currentGroup: 'CHILD_OVER_18_STUDYING',
        message: 'pending',
        requiredAction: 'UPLOAD_STUDENT_CARD',
      },
    ];
    const merged = mergeAgeTransitionReminders(api, pending);
    expect(merged).toHaveLength(1);
    expect(merged[0].requiredAction).toBe('UPLOAD_STUDENT_CARD');
    expect(merged[0].currentGroup).toBe('CHILD_OVER_18_STUDYING');
  });

  it('builds ProofDocuments nav for upload-only CTA', () => {
    const nav = proofNavFromAgeReminder({
      dependentId: 'dep-1',
      fullName: 'A',
      birthDate: '2008-01-01',
      currentGroup: 'CHILD_OVER_18_STUDYING',
      recommendedGroup: 'CHILD_OVER_18_STUDYING',
      transitionStatus: 'ALREADY_18_PENDING_ACTION',
      turning18Date: '2026-01-01',
      daysRemaining: -1,
      message: 'x',
      requiredAction: 'UPLOAD_STUDENT_CARD',
    });
    expect(nav).toEqual({
      screen: 'ProofDocuments',
      params: {
        dependentId: 'dep-1',
        groupIndex: 1,
        requiredDocuments: ['STUDENT_CARD'],
      },
    });
  });
});
