const transitions = {
    Pendiente: {
      Confirmar:   { to: 'Aceptado',  role: 'entrenador' },
      Cancelar:    { to: 'Cancelado', role: 'entrenador' },
      Reprogramar: { to: 'Pendiente', role: 'cliente' },
    },
    Aceptado: {
      Cancelar:    { to: 'Cancelado', role: 'cliente' },
      // Completado será automático al vencerse la clase
    },
    Completado: {
      Comentar:    { to: 'Completado', role: ['cliente', 'entrenador'] },
    },
    Cancelado: {}
  };
  
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
  
  module.exports = { canTransition, nextState };
  