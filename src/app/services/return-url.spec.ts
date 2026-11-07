import { isSafeReturnUrl, rememberReturnUrl, takeReturnUrl } from './return-url';

describe('return-url', () => {
  beforeEach(() => localStorage.removeItem('wordle.returnUrl'));

  it('returns a remembered in-app path once', () => {
    rememberReturnUrl('/duel/invite/abc');

    expect(takeReturnUrl()).toBe('/duel/invite/abc');
    expect(takeReturnUrl()).toBeNull();
  });

  it('never redirects off-site', () => {
    expect(isSafeReturnUrl('/duel/1')).toBeTrue();
    expect(isSafeReturnUrl('//evil.example')).toBeFalse();
    expect(isSafeReturnUrl('https://evil.example')).toBeFalse();
    expect(isSafeReturnUrl('/\\evil.example')).toBeFalse();

    rememberReturnUrl('//evil.example');
    expect(takeReturnUrl()).toBeNull();
  });

  it('forgets a stale return URL', () => {
    localStorage.setItem('wordle.returnUrl', JSON.stringify({ url: '/duel/1', savedAt: Date.now() - 2 * 3_600_000 }));

    expect(takeReturnUrl()).toBeNull();
  });
});
