import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFoodMetadata } from './lib/food-ai-metadata.ts';

test('accepts only supported food metadata and removes duplicate tags', () => {
  assert.deepEqual(parseFoodMetadata('HOT', ['LIGHT', 'LIGHT', 'VEGETARIAN']), {
    spiceLevel: 'HOT',
    dishTags: ['LIGHT', 'VEGETARIAN'],
  });
});

test('rejects unsupported spice levels and tags supplied by a client', () => {
  assert.ok('error' in parseFoodMetadata('EXTREME', []));
  assert.ok('error' in parseFoodMetadata(null, ['ADMIN_ONLY']));
  assert.ok('error' in parseFoodMetadata(null, 'KIDS_FRIENDLY'));
});

test('missing metadata is safely stored as empty tags and no spice level', () => {
  assert.deepEqual(parseFoodMetadata(undefined, undefined), { spiceLevel: null, dishTags: [] });
});
