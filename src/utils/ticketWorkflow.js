// ===========================================
// TICKET WORKFLOW STATE MACHINES
// ===========================================
// A support ticket is not just a thread of messages. The cases that actually
// carry risk - a copyright claim, a failed payment, a withheld royalty, a
// takedown, a financial reversal - each follow a defined sequence of states,
// and moving between them is what triggers the real backend operation.
//
// Everything here is pure data + pure functions so the rules can be tested
// without a database. The route layer (POST /admin/tickets/:id/workflow/
// transition) is the only thing that touches Prisma; it asks this module
// "is this move legal, and who is allowed to make it?" and then applies the
// declared effect.
//
// Design notes:
//  - `permission` on a transition is what the CALLER must hold. It is
//    deliberately per-transition, not per-workflow: investigating a copyright
//    claim is support work (tickets:status), but holding the release behind
//    it is a catalog action (takedowns:execute), and releasing a withheld
//    royalty is money (royalties:release).
//  - `effect` names a backend operation the route layer performs inside the
//    same transaction as the state change. A transition with no effect is
//    purely administrative bookkeeping.
//  - `requiresNote: true` forces the operator to record WHY. Used on every
//    state where the reason is the thing an auditor will actually want later
//    (holding someone's money, taking down someone's release).
//  - Terminal states have no outgoing transitions. Reopening is deliberately
//    not modelled: a resolved case that comes back is a new ticket, so the
//    original decision and its evidence trail stay immutable.

export const TICKET_WORKFLOWS = {
  // Copyright claim: recibido -> investigación -> release retenido ->
  // evidencia -> resolución/takedown.
  COPYRIGHT: {
    label: 'Reclamo de copyright',
    initial: 'RECEIVED',
    states: {
      RECEIVED: {
        label: 'Recibido',
        transitions: {
          INVESTIGATING: { permission: 'tickets:status' },
        },
      },
      INVESTIGATING: {
        label: 'En investigación',
        transitions: {
          // The claim is credible enough to stop distribution while it's
          // examined - this is the point where the artist loses visibility,
          // so it needs the catalog permission and a recorded reason.
          RELEASE_HELD: { permission: 'takedowns:execute', effect: 'HOLD_RELEASE', requiresNote: true },
          DISMISSED: { permission: 'tickets:status', requiresNote: true },
        },
      },
      RELEASE_HELD: {
        label: 'Release retenido',
        transitions: {
          AWAITING_EVIDENCE: { permission: 'tickets:status' },
        },
      },
      AWAITING_EVIDENCE: {
        label: 'Esperando evidencia',
        transitions: {
          // Claimant substantiated it -> permanent takedown.
          RESOLVED_TAKEDOWN: { permission: 'takedowns:execute', effect: 'TAKEDOWN_RELEASE', requiresNote: true },
          // Artist substantiated their rights -> put it back.
          RESOLVED_RESTORED: { permission: 'takedowns:execute', effect: 'RESTORE_RELEASE', requiresNote: true },
        },
      },
      DISMISSED: { label: 'Desestimado', terminal: true },
      RESOLVED_TAKEDOWN: { label: 'Resuelto - takedown', terminal: true },
      RESOLVED_RESTORED: { label: 'Resuelto - restaurado', terminal: true },
    },
  },

  // Pago fallido: reportado -> conciliación -> corrección -> reintento/reverso.
  FAILED_PAYMENT: {
    label: 'Pago fallido',
    initial: 'REPORTED',
    states: {
      REPORTED: {
        label: 'Reportado',
        transitions: {
          RECONCILING: { permission: 'finance:read' },
        },
      },
      RECONCILING: {
        label: 'En conciliación',
        transitions: {
          CORRECTING: { permission: 'finance:write', requiresNote: true },
          // Nothing was actually wrong - the payment did land.
          RESOLVED_NO_ACTION: { permission: 'finance:read', requiresNote: true },
        },
      },
      CORRECTING: {
        label: 'Corrigiendo',
        transitions: {
          RETRY_SCHEDULED: { permission: 'payouts:process', effect: 'RETRY_PAYOUT', requiresNote: true },
          // Money needs to go back - handed off to the reversal workflow,
          // which is the only path with a two-person rule on it.
          REVERSAL_REQUESTED: { permission: 'reversals:request', effect: 'OPEN_REVERSAL', requiresNote: true },
        },
      },
      RETRY_SCHEDULED: {
        label: 'Reintento programado',
        transitions: {
          RESOLVED_PAID: { permission: 'payouts:process' },
          REPORTED: { permission: 'finance:read', requiresNote: true },
        },
      },
      REVERSAL_REQUESTED: {
        label: 'Reverso solicitado',
        transitions: {
          RESOLVED_REVERSED: { permission: 'reversals:approve' },
        },
      },
      RESOLVED_NO_ACTION: { label: 'Resuelto - sin acción', terminal: true },
      RESOLVED_PAID: { label: 'Resuelto - pagado', terminal: true },
      RESOLVED_REVERSED: { label: 'Resuelto - revertido', terminal: true },
    },
  },

  // Regalía retenida: revisión -> justificación -> liberación o disputa.
  ROYALTY_HOLD: {
    label: 'Regalía retenida',
    initial: 'UNDER_REVIEW',
    states: {
      UNDER_REVIEW: {
        label: 'En revisión',
        transitions: {
          JUSTIFIED: { permission: 'royalties:hold', effect: 'HOLD_ROYALTIES', requiresNote: true },
          RELEASED: { permission: 'royalties:release', effect: 'RELEASE_ROYALTIES', requiresNote: true },
        },
      },
      JUSTIFIED: {
        label: 'Retención justificada',
        transitions: {
          DISPUTED: { permission: 'tickets:status', requiresNote: true },
          RELEASED: { permission: 'royalties:release', effect: 'RELEASE_ROYALTIES', requiresNote: true },
        },
      },
      DISPUTED: {
        label: 'En disputa',
        transitions: {
          RELEASED: { permission: 'royalties:release', effect: 'RELEASE_ROYALTIES', requiresNote: true },
          UPHELD: { permission: 'royalties:hold', requiresNote: true },
        },
      },
      RELEASED: { label: 'Liberada', terminal: true },
      UPHELD: { label: 'Retención sostenida', terminal: true },
    },
  },

  // Takedown: solicitud -> validación -> ejecución -> confirmación de tiendas.
  TAKEDOWN: {
    label: 'Solicitud de takedown',
    initial: 'REQUESTED',
    states: {
      REQUESTED: {
        label: 'Solicitado',
        transitions: {
          VALIDATING: { permission: 'takedowns:read' },
        },
      },
      VALIDATING: {
        label: 'En validación',
        transitions: {
          EXECUTING: { permission: 'takedowns:execute', effect: 'TAKEDOWN_RELEASE', requiresNote: true },
          REJECTED: { permission: 'takedowns:execute', requiresNote: true },
        },
      },
      EXECUTING: {
        label: 'En ejecución',
        transitions: {
          // Distribution is not instant - the case stays open until the
          // stores actually confirm removal, so nobody closes it early on
          // the assumption that "we sent it" means "it's gone".
          CONFIRMED: { permission: 'takedowns:execute', requiresNote: true },
        },
      },
      CONFIRMED: { label: 'Confirmado por tiendas', terminal: true },
      REJECTED: { label: 'Rechazado', terminal: true },
    },
  },

  // Reverso financiero: solicitud -> doble aprobación -> ejecución -> auditoría.
  //
  // The two-person rule is NOT enforceable here: holding both
  // reversals:request and reversals:approve is normal for FINANCE. The
  // "approver must not be the requester" check lives in the reversal
  // endpoints (see POST /admin/reversals/:id/approve), because it is a fact
  // about WHO acted, which a permission cannot express.
  FINANCIAL_REVERSAL: {
    label: 'Reverso financiero',
    initial: 'REQUESTED',
    states: {
      REQUESTED: {
        label: 'Solicitado',
        transitions: {
          APPROVED: { permission: 'reversals:approve', effect: 'EXECUTE_REVERSAL', requiresNote: true },
          REJECTED: { permission: 'reversals:approve', requiresNote: true },
        },
      },
      APPROVED: {
        label: 'Aprobado y ejecutado',
        transitions: {
          AUDITED: { permission: 'audit:read', requiresNote: true },
        },
      },
      AUDITED: { label: 'Auditado', terminal: true },
      REJECTED: { label: 'Rechazado', terminal: true },
    },
  },

  // Anything that isn't one of the risk-carrying cases above. No state
  // machine, no effects - the plain OPEN/IN_PROGRESS/RESOLVED/CLOSED status
  // field still governs these, exactly as before.
  GENERAL: {
    label: 'General',
    initial: 'OPEN',
    states: {
      OPEN: { label: 'Abierto', transitions: { RESOLVED: { permission: 'tickets:status' } } },
      RESOLVED: { label: 'Resuelto', terminal: true },
    },
  },
};

export const WORKFLOW_TYPES = Object.keys(TICKET_WORKFLOWS);

// Maps the category an artist picks in the support form to the workflow that
// should govern the resulting ticket. Categories with no entry fall through
// to GENERAL.
const CATEGORY_TO_WORKFLOW = {
  'Missing Royalties': 'ROYALTY_HOLD',
  'Takedown Request': 'TAKEDOWN',
  'Copyright Claim': 'COPYRIGHT',
  'Failed Payment': 'FAILED_PAYMENT',
};

export function workflowTypeForCategory(category) {
  return CATEGORY_TO_WORKFLOW[category] || 'GENERAL';
}

export function initialStateFor(workflowType) {
  const workflow = TICKET_WORKFLOWS[workflowType];
  if (!workflow) throw new Error(`Unknown ticket workflow type: ${workflowType}`);
  return workflow.initial;
}

export function isTerminalState(workflowType, state) {
  return Boolean(TICKET_WORKFLOWS[workflowType]?.states?.[state]?.terminal);
}

/**
 * Every move legal from `state`, as
 * `[{ to, permission, effect, requiresNote, label }]`. Used both to render
 * the operator's available actions and to validate an attempted transition.
 * Unknown workflow/state, or a terminal state, yields [].
 */
export function availableTransitions(workflowType, state) {
  const definition = TICKET_WORKFLOWS[workflowType]?.states?.[state];
  if (!definition || definition.terminal) return [];

  return Object.entries(definition.transitions || {}).map(([to, rule]) => ({
    to,
    label: TICKET_WORKFLOWS[workflowType].states[to]?.label || to,
    permission: rule.permission,
    effect: rule.effect || null,
    requiresNote: Boolean(rule.requiresNote),
  }));
}

/**
 * Validates a proposed transition. Returns
 * `{ ok: true, transition }` or `{ ok: false, code, message }` - never
 * throws, so the route layer can map `code` straight onto a response.
 *
 * `hasPermission` is injected (rather than importing rbac here) to keep this
 * module free of middleware concerns and trivially testable.
 */
export function validateTransition({ workflowType, from, to, note, hasPermission }) {
  const workflow = TICKET_WORKFLOWS[workflowType];
  if (!workflow) {
    return { ok: false, code: 'UNKNOWN_WORKFLOW', message: `Flujo de trabajo desconocido: ${workflowType}` };
  }

  const current = workflow.states[from];
  if (!current) {
    return { ok: false, code: 'UNKNOWN_STATE', message: `Estado desconocido: ${from}` };
  }
  if (current.terminal) {
    return {
      ok: false,
      code: 'TERMINAL_STATE',
      message: `El caso ya está cerrado en "${current.label}". Abre un ticket nuevo si reaparece.`,
    };
  }

  const rule = current.transitions?.[to];
  if (!rule) {
    const allowed = Object.keys(current.transitions || {}).join(', ') || 'ninguno';
    return {
      ok: false,
      code: 'ILLEGAL_TRANSITION',
      message: `No se puede pasar de "${from}" a "${to}". Transiciones válidas: ${allowed}.`,
    };
  }

  if (!hasPermission(rule.permission)) {
    return {
      ok: false,
      code: 'FORBIDDEN_TRANSITION',
      message: `Esta acción requiere el permiso "${rule.permission}".`,
    };
  }

  if (rule.requiresNote && !String(note || '').trim()) {
    return {
      ok: false,
      code: 'NOTE_REQUIRED',
      message: 'Esta acción requiere una nota explicando el motivo (queda en la auditoría).',
    };
  }

  return {
    ok: true,
    transition: {
      to,
      permission: rule.permission,
      effect: rule.effect || null,
      requiresNote: Boolean(rule.requiresNote),
      terminal: Boolean(workflow.states[to]?.terminal),
    },
  };
}

/**
 * The coarse OPEN/IN_PROGRESS/RESOLVED status that mirrors a workflow state,
 * so the existing ticket list/filters (and the artist-facing view) keep
 * working without needing to understand any of the machinery above.
 */
export function coarseStatusFor(workflowType, state) {
  if (isTerminalState(workflowType, state)) return 'RESOLVED';
  return state === TICKET_WORKFLOWS[workflowType]?.initial ? 'OPEN' : 'IN_PROGRESS';
}
