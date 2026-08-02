import { describe, it, expect } from 'vitest';
import {
  TICKET_WORKFLOWS,
  WORKFLOW_TYPES,
  workflowTypeForCategory,
  initialStateFor,
  isTerminalState,
  availableTransitions,
  validateTransition,
  coarseStatusFor,
} from './ticketWorkflow.js';
import { ROLE_PERMISSIONS, userHasPermission } from '../middleware/rbac.js';

const allowAll = () => true;
const denyAll = () => false;
const asRole = (role) => (permission) => userHasPermission({ role, permissions: null }, permission);

describe('workflow definitions are internally consistent', () => {
  it.each(WORKFLOW_TYPES)('%s: every transition target is a real state', (type) => {
    const { states } = TICKET_WORKFLOWS[type];
    for (const [name, definition] of Object.entries(states)) {
      for (const target of Object.keys(definition.transitions || {})) {
        expect(states[target], `${type}.${name} -> ${target}`).toBeDefined();
      }
    }
  });

  it.each(WORKFLOW_TYPES)('%s: initial state exists and is not terminal', (type) => {
    const initial = initialStateFor(type);
    expect(TICKET_WORKFLOWS[type].states[initial]).toBeDefined();
    expect(isTerminalState(type, initial)).toBe(false);
  });

  it.each(WORKFLOW_TYPES)('%s: every terminal state is reachable', (type) => {
    const { states, initial } = TICKET_WORKFLOWS[type];
    const seen = new Set();
    const queue = [initial];
    while (queue.length) {
      const current = queue.shift();
      if (seen.has(current)) continue;
      seen.add(current);
      queue.push(...Object.keys(states[current]?.transitions || {}));
    }
    for (const [name, definition] of Object.entries(states)) {
      if (definition.terminal) expect(seen.has(name), `${type}.${name} unreachable`).toBe(true);
    }
  });

  it.each(WORKFLOW_TYPES)('%s: every non-terminal state can move somewhere', (type) => {
    for (const [name, definition] of Object.entries(TICKET_WORKFLOWS[type].states)) {
      if (definition.terminal) continue;
      expect(Object.keys(definition.transitions || {}).length, `${type}.${name} is a dead end`).toBeGreaterThan(0);
    }
  });

  it('every transition declares a permission', () => {
    for (const type of WORKFLOW_TYPES) {
      for (const [name, definition] of Object.entries(TICKET_WORKFLOWS[type].states)) {
        for (const [target, rule] of Object.entries(definition.transitions || {})) {
          expect(rule.permission, `${type}.${name} -> ${target}`).toBeTruthy();
        }
      }
    }
  });
});

describe('category routing', () => {
  it.each([
    ['Missing Royalties', 'ROYALTY_HOLD'],
    ['Takedown Request', 'TAKEDOWN'],
    ['Copyright Claim', 'COPYRIGHT'],
    ['Failed Payment', 'FAILED_PAYMENT'],
  ])('%s opens a %s case', (category, expected) => {
    expect(workflowTypeForCategory(category)).toBe(expected);
  });

  it.each(['Account Issues', 'Other', 'General', 'Plan Upgrade', undefined])(
    'falls back to GENERAL for %s',
    (category) => expect(workflowTypeForCategory(category)).toBe('GENERAL')
  );
});

describe('copyright claim: recibido -> investigación -> retenido -> evidencia -> resolución', () => {
  const walk = ['RECEIVED', 'INVESTIGATING', 'RELEASE_HELD', 'AWAITING_EVIDENCE'];

  it('follows the documented happy path', () => {
    for (let i = 0; i < walk.length - 1; i++) {
      const result = validateTransition({
        workflowType: 'COPYRIGHT',
        from: walk[i],
        to: walk[i + 1],
        note: 'motivo',
        hasPermission: allowAll,
      });
      expect(result.ok, `${walk[i]} -> ${walk[i + 1]}`).toBe(true);
    }
  });

  it('cannot skip investigation and hold a release straight away', () => {
    const result = validateTransition({
      workflowType: 'COPYRIGHT',
      from: 'RECEIVED',
      to: 'RELEASE_HELD',
      note: 'motivo',
      hasPermission: allowAll,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('ILLEGAL_TRANSITION');
  });

  it('holding a release triggers the real backend operation', () => {
    const { transition } = validateTransition({
      workflowType: 'COPYRIGHT',
      from: 'INVESTIGATING',
      to: 'RELEASE_HELD',
      note: 'reclamo creíble',
      hasPermission: allowAll,
    });
    expect(transition.effect).toBe('HOLD_RELEASE');
  });

  it('refuses to hold a release without a recorded reason', () => {
    const result = validateTransition({
      workflowType: 'COPYRIGHT',
      from: 'INVESTIGATING',
      to: 'RELEASE_HELD',
      note: '   ',
      hasPermission: allowAll,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('NOTE_REQUIRED');
  });

  it('a resolved claim cannot be reopened', () => {
    const result = validateTransition({
      workflowType: 'COPYRIGHT',
      from: 'RESOLVED_TAKEDOWN',
      to: 'INVESTIGATING',
      note: 'reabrir',
      hasPermission: allowAll,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('TERMINAL_STATE');
  });
});

describe('permission boundaries on transitions', () => {
  it('SUPPORT can investigate a copyright claim but not hold the release', () => {
    expect(
      validateTransition({
        workflowType: 'COPYRIGHT',
        from: 'RECEIVED',
        to: 'INVESTIGATING',
        hasPermission: asRole('SUPPORT'),
      }).ok
    ).toBe(true);

    const held = validateTransition({
      workflowType: 'COPYRIGHT',
      from: 'INVESTIGATING',
      to: 'RELEASE_HELD',
      note: 'motivo',
      hasPermission: asRole('SUPPORT'),
    });
    expect(held.ok).toBe(false);
    expect(held.code).toBe('FORBIDDEN_TRANSITION');
  });

  it('ADMIN cannot release withheld royalties - that is FINANCE', () => {
    const asAdmin = validateTransition({
      workflowType: 'ROYALTY_HOLD',
      from: 'UNDER_REVIEW',
      to: 'RELEASED',
      note: 'liberar',
      hasPermission: asRole('ADMIN'),
    });
    expect(asAdmin.ok).toBe(false);
    expect(asAdmin.code).toBe('FORBIDDEN_TRANSITION');

    expect(
      validateTransition({
        workflowType: 'ROYALTY_HOLD',
        from: 'UNDER_REVIEW',
        to: 'RELEASED',
        note: 'liberar',
        hasPermission: asRole('FINANCE'),
      }).ok
    ).toBe(true);
  });

  it('FINANCE cannot take a release down - that is catalog work', () => {
    const result = validateTransition({
      workflowType: 'TAKEDOWN',
      from: 'VALIDATING',
      to: 'EXECUTING',
      note: 'ejecutar',
      hasPermission: asRole('FINANCE'),
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('FORBIDDEN_TRANSITION');
  });

  it('a takedown stays open until stores confirm removal', () => {
    expect(isTerminalState('TAKEDOWN', 'EXECUTING')).toBe(false);
    expect(isTerminalState('TAKEDOWN', 'CONFIRMED')).toBe(true);
  });
});

describe('financial reversal workflow', () => {
  it('routes money-back through the reversal model, not a wallet edit', () => {
    const { transition } = validateTransition({
      workflowType: 'FAILED_PAYMENT',
      from: 'CORRECTING',
      to: 'REVERSAL_REQUESTED',
      note: 'cobro duplicado',
      hasPermission: allowAll,
    });
    expect(transition.effect).toBe('OPEN_REVERSAL');
    expect(transition.permission).toBe('reversals:request');
  });

  it('approving requires reversals:approve, which ADMIN does not hold', () => {
    const result = validateTransition({
      workflowType: 'FINANCIAL_REVERSAL',
      from: 'REQUESTED',
      to: 'APPROVED',
      note: 'aprobado',
      hasPermission: asRole('ADMIN'),
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('FORBIDDEN_TRANSITION');
  });

  it('ends in an audit step, not at execution', () => {
    expect(isTerminalState('FINANCIAL_REVERSAL', 'APPROVED')).toBe(false);
    expect(isTerminalState('FINANCIAL_REVERSAL', 'AUDITED')).toBe(true);
  });

  it('the two-person rule is not expressible as a permission', () => {
    // Both live on FINANCE by design - which is exactly why the endpoint has
    // to compare requester and approver identities.
    expect(ROLE_PERMISSIONS.FINANCE).toContain('reversals:request');
    expect(ROLE_PERMISSIONS.FINANCE).toContain('reversals:approve');
  });
});

describe('availableTransitions', () => {
  it('lists every legal move with its permission and effect', () => {
    const moves = availableTransitions('COPYRIGHT', 'AWAITING_EVIDENCE');
    expect(moves.map((m) => m.to).sort()).toEqual(['RESOLVED_RESTORED', 'RESOLVED_TAKEDOWN']);
    for (const move of moves) {
      expect(move.permission).toBe('takedowns:execute');
      expect(move.requiresNote).toBe(true);
    }
  });

  it('is empty for terminal and unknown states', () => {
    expect(availableTransitions('COPYRIGHT', 'RESOLVED_TAKEDOWN')).toEqual([]);
    expect(availableTransitions('COPYRIGHT', 'NOPE')).toEqual([]);
    expect(availableTransitions('NOPE', 'RECEIVED')).toEqual([]);
  });

  it('does not filter by permission on its own', () => {
    // The route layer does the filtering; this function reports the machine.
    expect(availableTransitions('ROYALTY_HOLD', 'UNDER_REVIEW').length).toBe(2);
  });
});

describe('coarse status mirroring', () => {
  it('maps initial -> OPEN, mid -> IN_PROGRESS, terminal -> RESOLVED', () => {
    expect(coarseStatusFor('COPYRIGHT', 'RECEIVED')).toBe('OPEN');
    expect(coarseStatusFor('COPYRIGHT', 'RELEASE_HELD')).toBe('IN_PROGRESS');
    expect(coarseStatusFor('COPYRIGHT', 'RESOLVED_TAKEDOWN')).toBe('RESOLVED');
  });

  it('keeps GENERAL tickets behaving exactly as before', () => {
    expect(coarseStatusFor('GENERAL', 'OPEN')).toBe('OPEN');
    expect(coarseStatusFor('GENERAL', 'RESOLVED')).toBe('RESOLVED');
  });
});

describe('validateTransition rejects malformed input', () => {
  it.each([
    [{ workflowType: 'NOPE', from: 'RECEIVED', to: 'INVESTIGATING' }, 'UNKNOWN_WORKFLOW'],
    [{ workflowType: 'COPYRIGHT', from: 'NOPE', to: 'INVESTIGATING' }, 'UNKNOWN_STATE'],
  ])('%o -> %s', (input, code) => {
    const result = validateTransition({ ...input, hasPermission: allowAll });
    expect(result.ok).toBe(false);
    expect(result.code).toBe(code);
  });

  it('denies everything when the caller holds no permissions', () => {
    const result = validateTransition({
      workflowType: 'COPYRIGHT',
      from: 'RECEIVED',
      to: 'INVESTIGATING',
      hasPermission: denyAll,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('FORBIDDEN_TRANSITION');
  });
});
