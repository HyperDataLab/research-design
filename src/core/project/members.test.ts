import { expect, it } from 'vitest';
import { checkMemberEmail, sortMembers } from './members';

it('MB-01 normalizes and validates member emails and limits', () => {
  const members = ['owner@example.org'];
  expect(checkMemberEmail('  A@EXAMPLE.ORG ', members, 'example.org')).toEqual({
    ok: true,
    email: 'a@example.org',
  });
  expect(checkMemberEmail('bad', members, 'example.org')).toEqual({ ok: false, error: 'malformed' });
  expect(checkMemberEmail('a@other.org', members, 'example.org')).toEqual({
    ok: false,
    error: 'foreign_domain',
  });
  expect(checkMemberEmail('OWNER@example.org', members, 'example.org')).toEqual({
    ok: false,
    error: 'already_member',
  });
  expect(checkMemberEmail('a@example.org', Array(50).fill('owner@example.org'), 'example.org')).toEqual({
    ok: false,
    error: 'too_many',
  });
});

it('MB-02 sorts owner first without mutating the list', () => {
  const members = ['z@example.org', 'owner@example.org', 'a@example.org'];
  expect(sortMembers(members, 'owner@example.org')).toEqual([
    'owner@example.org',
    'a@example.org',
    'z@example.org',
  ]);
  expect(members[0]).toBe('z@example.org');
});
