import { z } from 'zod';
import { theme } from '../constants/theme';

// Chữ cái Unicode (gồm đủ dấu tiếng Việt) + khoảng trắng; không số / ký tự đặc biệt.
// Dùng \p{L} để tránh thiếu tổ hợp dấu (trước đây thiếu ế/Ế → tên như "Yến" bị reject).
const VIETNAMESE_NAME_REGEX = /^[\p{L}\s]+$/u;

// Hàm tính tuổi dựa trên chuỗi ngày sinh (yyyy-MM-dd)
const calculateAge = (dobString: string): number => {
  const birthDate = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// Hàm đo độ mạnh mật khẩu theo đặc tả mục 8.8 docs 1.1.T3
export type PasswordStrength = {
  score: 1 | 2 | 3;
  label: 'Yếu' | 'Trung bình' | 'Mạnh';
  color: string;
};

export const calculatePasswordStrength = (pwd: string): PasswordStrength => {
  if (!pwd || pwd.length < 8) {
    return { score: 1, label: 'Yếu', color: theme.colors.error };
  }
  
  const hasUpper = /[A-Z]/.test(pwd);
  const hasLower = /[a-z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSpecial = /[^A-Za-z0-9]/.test(pwd);

  if (pwd.length >= 12 && hasUpper && hasLower && hasNumber && hasSpecial) {
    return { score: 3, label: 'Mạnh', color: theme.colors.success };
  }
  
  if (hasUpper && hasLower && hasNumber) {
    return { score: 2, label: 'Trung bình', color: theme.colors.warning };
  }

  return { score: 1, label: 'Yếu', color: theme.colors.error };
};

// Schema xác thực Form Đăng ký tài khoản (Task 1.1.T3)
export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, 'Vui lòng nhập họ và tên.')
      .min(2, 'Họ tên tối thiểu 2 ký tự.')
      .max(100, 'Họ tên tối đa 100 ký tự.')
      .regex(VIETNAMESE_NAME_REGEX, 'Họ tên không chứa số hoặc ký tự đặc biệt.'),
      
    citizenId: z
      .string()
      .trim()
      .min(1, 'Vui lòng nhập số CCCD.')
      .regex(/^\d{12}$/, 'Số CCCD phải gồm 12 chữ số.'),
      
    dateOfBirth: z
      .string()
      .optional()
      .refine((val) => {
        if (!val) return true;
        const d = new Date(val);
        return !isNaN(d.getTime()) && d <= new Date();
      }, 'Ngày sinh không hợp lệ.')
      .refine((val) => {
        if (!val) return true;
        return calculateAge(val) >= 18;
      }, 'Người đăng ký phải đủ 18 tuổi.'),
      
    email: z
      .string()
      .trim()
      .min(1, 'Vui lòng nhập email.')
      .email('Email không đúng định dạng.')
      .transform((val) => val.toLowerCase()),
      
    phoneNumber: z
      .string()
      .trim()
      .min(1, 'Vui lòng nhập số điện thoại.')
      .regex(/^(0|\+84)[0-9]{9}$/, 'Số điện thoại không hợp lệ (10 chữ số).'),
      
    address: z
      .string()
      .trim()
      .max(255, 'Địa chỉ tối đa 255 ký tự.')
      .optional(),
      
    password: z
      .string()
      .min(1, 'Vui lòng nhập mật khẩu.')
      .min(8, 'Mật khẩu tối thiểu 8 ký tự.')
      .regex(/[A-Z]/, 'Mật khẩu cần ít nhất 1 chữ hoa.')
      .regex(/[a-z]/, 'Mật khẩu cần ít nhất 1 chữ thường.')
      .regex(/[0-9]/, 'Mật khẩu cần ít nhất 1 chữ số.'),
      
    confirmPassword: z
      .string()
      .min(1, 'Vui lòng xác nhận mật khẩu.'),
      
    agreeTerms: z
      .boolean()
      .refine((val) => val === true, 'Vui lòng đồng ý điều khoản sử dụng.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp.',
    path: ['confirmPassword'],
  })
  .refine((data) => data.password !== data.email, {
    message: 'Mật khẩu không được trùng email.',
    path: ['password'],
  })
  .refine((data) => !data.phoneNumber || data.password !== data.phoneNumber, {
    message: 'Mật khẩu không được trùng số điện thoại.',
    path: ['password'],
  });

export type RegisterFormData = z.infer<typeof registerSchema>;

// Schema xác thực Form Đăng nhập (chỉ dùng số CCCD 12 số khớp với BE)
export const loginSchema = z.object({
  account: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập số CCCD.')
    .regex(/^\d{12}$/, 'Số CCCD phải gồm 12 chữ số.'),
  password: z
    .string()
    .min(1, 'Vui lòng nhập mật khẩu.'),
});

export type LoginFormData = z.infer<typeof loginSchema>;
