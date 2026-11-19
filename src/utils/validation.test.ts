jest.mock('../constants/theme', () => ({
  theme: {
    colors: {
      error: '#D32F2F',
      warning: '#F57C00',
      success: '#2E7D32',
    },
  },
}));

import { loginSchema, registerSchema } from './validation';

describe('validation schemas (Auth)', () => {
  describe('loginSchema', () => {
    it('chỉ chấp nhận số CCCD gồm đúng 12 chữ số', () => {
      expect(
        loginSchema.safeParse({ account: '079201001234', password: 'Password123' }).success
      ).toBe(true);
    });

    it('từ chối email hoặc số điện thoại ở màn đăng nhập', () => {
      const emailRes = loginSchema.safeParse({
        account: 'user@example.com',
        password: 'Password123',
      });
      expect(emailRes.success).toBe(false);

      const phoneRes = loginSchema.safeParse({
        account: '0901234567',
        password: 'Password123',
      });
      expect(phoneRes.success).toBe(false);
    });
  });

  describe('registerSchema', () => {
    it('hợp lệ khi không có trường mã số thuế (taxIdNumber)', () => {
      const res = registerSchema.safeParse({
        fullName: 'Nguyễn Văn A',
        citizenId: '079201001234',
        dateOfBirth: '1995-05-12',
        email: 'nguyenvana@gmail.com',
        phoneNumber: '0901234567',
        address: 'TP. Hồ Chí Minh',
        password: 'Password123',
        confirmPassword: 'Password123',
        agreeTerms: true,
      });
      expect(res.success).toBe(true);
    });
  });
});

