import { expect, it } from 'vitest';
import { signInErrorMessage } from './signInError';

it('PJ-14 sign-in error messages', () => {
  expect(signInErrorMessage('auth/popup-closed-by-user')).toBeNull();
  expect(signInErrorMessage('auth/cancelled-popup-request')).toBeNull();
  expect(signInErrorMessage('auth/popup-blocked')).toContain('chặn cửa sổ');
  expect(signInErrorMessage('auth/unauthorized-domain')).toContain('Tên miền');
  expect(signInErrorMessage('auth/operation-not-allowed')).toContain('Research Design');
  expect(signInErrorMessage('auth/configuration-not-found')).toBe(
    signInErrorMessage('auth/operation-not-allowed'),
  );
  expect(signInErrorMessage(undefined)).toBe('Không đăng nhập được. Vui lòng thử lại.');
});
