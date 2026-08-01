import { describe, it, expect } from 'vitest';
import { createReleaseSchema } from './release.js';

// Minimal valid payload shared by tests below - only the field under test
// varies per case.
function baseRelease(overrides = {}) {
  return {
    title: 'Test Release',
    releaseType: 'SINGLE',
    genre: 'Pop',
    releaseDate: '2099-01-01',
    idempotencyKey: 'test-key',
    tracks: [
      {
        title: 'Track 1',
        trackNumber: 1,
        contributors: [
          { name: 'Main Artist', role: 'PRIMARY_ARTIST', royaltyPercentage: 100 },
        ],
        ...overrides.track,
      },
    ],
    ...overrides.release,
  };
}

describe('createReleaseSchema contributor rules', () => {
  it('accepts CO_PRODUCER as a valid contributor role', () => {
    const payload = baseRelease({
      track: {
        title: 'Track 1',
        trackNumber: 1,
        contributors: [
          { name: 'Main Artist', role: 'PRIMARY_ARTIST', royaltyPercentage: 60 },
          { name: 'Helper', role: 'CO_PRODUCER', royaltyPercentage: 40 },
        ],
      },
    });
    const result = createReleaseSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('rejects a contributor role outside the known enum', () => {
    const payload = baseRelease({
      track: {
        title: 'Track 1',
        trackNumber: 1,
        contributors: [{ name: 'X', role: 'NOT_A_REAL_ROLE', royaltyPercentage: 100 }],
      },
    });
    const result = createReleaseSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects a track with zero PRIMARY_ARTIST contributors', () => {
    const payload = baseRelease({
      track: {
        title: 'Track 1',
        trackNumber: 1,
        contributors: [{ name: 'Just a producer', role: 'PRODUCER', royaltyPercentage: 100 }],
      },
    });
    const result = createReleaseSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects more than one PRODUCER on the same track', () => {
    const payload = baseRelease({
      track: {
        title: 'Track 1',
        trackNumber: 1,
        contributors: [
          { name: 'Main Artist', role: 'PRIMARY_ARTIST', royaltyPercentage: 50 },
          { name: 'Producer A', role: 'PRODUCER', royaltyPercentage: 25 },
          { name: 'Producer B', role: 'PRODUCER', royaltyPercentage: 25 },
        ],
      },
    });
    const result = createReleaseSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('allows a second PRODUCER-type contributor if categorized as CO_PRODUCER', () => {
    const payload = baseRelease({
      track: {
        title: 'Track 1',
        trackNumber: 1,
        contributors: [
          { name: 'Main Artist', role: 'PRIMARY_ARTIST', royaltyPercentage: 50 },
          { name: 'Producer A', role: 'PRODUCER', royaltyPercentage: 25 },
          { name: 'Producer B', role: 'CO_PRODUCER', royaltyPercentage: 25 },
        ],
      },
    });
    const result = createReleaseSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('rejects royalty splits that do not sum to exactly 100', () => {
    const payload = baseRelease({
      track: {
        title: 'Track 1',
        trackNumber: 1,
        contributors: [
          { name: 'Main Artist', role: 'PRIMARY_ARTIST', royaltyPercentage: 60 },
          { name: 'Featured', role: 'FEATURED', royaltyPercentage: 30 },
        ],
      },
    });
    const result = createReleaseSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('accepts an optional idempotencyKey and requires nothing extra for it', () => {
    const payload = baseRelease();
    delete payload.idempotencyKey;
    const result = createReleaseSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });
});
