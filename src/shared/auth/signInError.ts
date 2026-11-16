export function signInErrorMessage(code: string | undefined): string | null {
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null;
    case 'auth/popup-blocked':
      return 'Trình duyệt đã chặn cửa sổ đăng nhập; cho phép cửa sổ bật lên cho trang này rồi thử lại.';
    case 'auth/unauthorized-domain':
      return 'Tên miền này chưa được phép đăng nhập trong Firebase Console (Authentication → Settings → Authorized domains).';
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      return 'Đăng nhập Google chưa được bật cho Research Design: Firebase Console → Authentication → Sign-in method → Google.';
    default:
      return 'Không đăng nhập được. Vui lòng thử lại.';
  }
}
