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
      .min(2, 'Họ và tên phải có ít nhất 2 ký tự.')
      .max(100, 'Họ và tên không được vượt quá 100 ký tự.')
      .regex(VIETNAMESE_NAME_REGEX, 'Họ và tên không được chứa số hoặc ký tự đặc biệt.'),
      
    citizenId: z
      .string()
      .trim()
      .min(1, 'Vui lòng nhập số căn cước công dân.')
      .regex(/^\d{12}$/, 'Số căn cước công dân phải gồm đúng 12 chữ số.'),
      
    dateOfBirth: z
      .string()
      .optional()
      .refine((val) => {
        if (!val) return true;
        const d = new Date(val);
        return !isNaN(d.getTime()) && d <= new Date();
      }, 'Ngày sinh không hợp lệ hoặc ở tương lai.')
      .refine((val) => {
        if (!val) return true;
        return calculateAge(val) >= 18;
      }, 'Người đăng ký phải từ 18 tuổi trở lên.'),
      
    email: z
      .string()
      .trim()
      .min(1, 'Vui lòng nhập email.')
      .email('Địa chỉ email không hợp lệ.')
      .transform((val) => val.toLowerCase()),
      
    phoneNumber: z
      .string()
      .trim()
      .min(1, 'Vui lòng nhập số điện thoại.')
      .regex(/^(0|\+84)[0-9]{9}$/, 'Số điện thoại không hợp lệ (gồm 10 số bắt đầu bằng 0).'),
      
    taxIdNumber: z
      .string()
      .trim()
      .optional()
      .refine((val) => {
        if (!val || val === '') return true;
        return /^\d{10}$|^\d{13}$/.test(val);
      }, 'Mã số thuế phải gồm 10 hoặc 13 chữ số.'),
      
    address: z
      .string()
      .trim()
      .max(255, 'Địa chỉ không được vượt quá 255 ký tự.')
      .optional(),
      
    password: z
      .string()
      .min(1, 'Vui lòng nhập mật khẩu.')
      .min(8, 'Mật khẩu phải có ít nhất 8 ký tự.')
      .regex(/[A-Z]/, 'Mật khẩu phải chứa ít nhất một chữ hoa.')
      .regex(/[a-z]/, 'Mật khẩu phải chứa ít nhất một chữ thường.')
      .regex(/[0-9]/, 'Mật khẩu phải chứa ít nhất một chữ số.'),
      
    confirmPassword: z
      .string()
      .min(1, 'Vui lòng xác nhận mật khẩu.'),
      
    agreeTerms: z
      .boolean()
      .refine((val) => val === true, 'Vui lòng đồng ý với điều khoản sử dụng để tiếp tục.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp.',
    path: ['confirmPassword'],
  })
  .refine((data) => data.password !== data.email, {
    message: 'Mật khẩu không được trùng với email.',
    path: ['password'],
  })
  .refine((data) => !data.phoneNumber || data.password !== data.phoneNumber, {
    message: 'Mật khẩu không được trùng với số điện thoại.',
    path: ['password'],
  });

export type RegisterFormData = z.infer<typeof registerSchema>;

// Schema xác thực Form Đăng nhập (Figma iPhone 17 - 12)
export const loginSchema = z.object({
  account: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập số CCCD hoặc email đăng nhập.'),
  password: z
    .string()
    .min(1, 'Vui lòng nhập mật khẩu.'),
});

export type LoginFormData = z.infer<typeof loginSchema>;
