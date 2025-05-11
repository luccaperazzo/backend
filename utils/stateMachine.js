const SYSTEM_ROLE = 'system';

const transitions = Object.freeze({
  Pendiente: {
    Confirmar:   { to: 'Aceptado',  role: 'entrenador' },
    Cancelar:    { to: 'Cancelado', role: ['cliente','entrenador'] },
    Reprogramar: { to: 'Pendiente', role: 'cliente' },
  },
  Aceptado: {
    Cancelar:    { to: 'Cancelado', role: 'cliente' },
    AutoFinalizar: { to: 'Finalizado', role: SYSTEM_ROLE }
  },
  Finalizado: {},
  Cancelado: {}
});

function canTransition(userRole, currentState, action) {
  const state = transitions[currentState];
  if (!state || !state[action]) return false;
  const { role } = state[action];
  return Array.isArray(role)
    ? role.includes(userRole)
    : role === userRole;
}

function nextState(currentState, action) {
  return transitions[currentState]?.[action]?.to || null;
}

module.exports = { canTransition, nextState, SYSTEM_ROLE };
