import { describe, expect, it } from 'vitest';
import { aggregateReactions, parseMentions } from './message-utils.js';

describe('parseMentions', () => {
  it('returns unique mentions without the @ prefix', () => {
    const content = 'Hello @alice and @bob. Hey @alice!';
    expect(parseMentions(content)).toEqual(['alice', 'bob']);
  });

  it('returns an empty array when no mentions exist', () => {
    expect(parseMentions('no mentions here')).toEqual([]);
  });

  it('supports names with spaces and punctuation boundaries', () => {
    const content = 'Hi @John Doe, please meet @Jane-Smith.';
    expect(parseMentions(content)).toEqual(['John Doe', 'Jane-Smith']);
  });
});

describe('aggregateReactions', () => {
  it('groups reactions by emoji and counts them', () => {
    const reactions = [
      { emoji: ':fire:', user: { id: 'u1', name: 'A' } },
      { emoji: ':fire:', user: { id: 'u2', name: 'B' } },
      { emoji: ':check:', user: { id: 'u3', name: 'C' } }
    ];

    expect(aggregateReactions(reactions)).toEqual([
      { emoji: ':fire:', count: 2, users: [{ id: 'u1', name: 'A' }, { id: 'u2', name: 'B' }] },
      { emoji: ':check:', count: 1, users: [{ id: 'u3', name: 'C' }] }
    ]);
  });
});
