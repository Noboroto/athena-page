import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toSlug } from './slug.mjs';

test('toSlug strips directories and the .md extension', () => {
  assert.equal(toSlug('src/content/members/nguyen-van-a.md'), 'nguyen-van-a');
  assert.equal(toSlug('nguyen-van-a.md'), 'nguyen-van-a');
  assert.equal(toSlug('nguyen-van-a'), 'nguyen-van-a');
  assert.equal(toSlug('  Nguyen-Van-A.MD '), 'Nguyen-Van-A');
  assert.equal(toSlug('members\\x.md'), 'x');
});
