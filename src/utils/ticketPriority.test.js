import { describe, it, expect } from 'vitest';
import { computeTicketPriority } from './ticketPriority.js';

describe('computeTicketPriority', () => {
  it('uses the category base priority when the message is unremarkable', () => {
    expect(computeTicketPriority('Missing Royalties', 'Where is my statement?')).toBe('high');
    expect(computeTicketPriority('Account Issues', 'I need to change my avatar')).toBe('normal');
    expect(computeTicketPriority('Other', 'Just a general question')).toBe('low');
  });

  it('defaults to normal for an unrecognized category', () => {
    expect(computeTicketPriority('Some Unknown Category', 'hello')).toBe('normal');
  });

  it('escalates a low-priority category to high on an urgent keyword', () => {
    expect(computeTicketPriority('Other', 'This is urgent, my account was hacked')).toBe('high');
  });

  it('is case-insensitive and matches Spanish keywords too', () => {
    expect(computeTicketPriority('Other', 'Creo que fue un FRAUDE')).toBe('high');
  });

  it('never lets a client-reported priority self-escalate a mundane message', () => {
    // No urgent keyword present - even though a user might phrase things
    // dramatically, this only checks the actual keyword list.
    expect(computeTicketPriority('Account Issues', 'This is really important to me')).toBe('normal');
  });
});
