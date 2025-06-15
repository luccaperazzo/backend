
const SYSTEM_ROLE = 'system';

const transitions = Object.freeze({
  Pendiente: {
    Confirmar:   { to: 'Aceptado',  role: 'entrenador' },
    Cancelar:    { to: 'Cancelado', role: ['cliente','entrenador'] },
    Reprogramar: { to: 'Pendiente', role: ['cliente','entrenador'] },
  },
  Aceptado: {
    Cancelar:    { to: 'Cancelado', role: ['cliente','entrenador'] },
    AutoFinalizar: { to: 'Finalizado', role: SYSTEM_ROLE }
  },
  Finalizado: {},
  Cancelado: {}
});

// Verifica si un usuario puede hacer una acción específica
function canTransition(userRole, currentState, action) {
  const state = transitions[currentState];
  if (!state || !state[action]) return false;
  const { role } = state[action]; // extrae el rol de la acción específica
  return Array.isArray(role) // Verifica si es un array o si es un string
    ? role.includes(userRole) // verifica si el rol del usuario está en el array
    : role === userRole; // verifica si el rol es el mismo
}
// Retorna el estado de destino despues de una acción
function nextState(currentState, action) {
  return transitions[currentState]?.[action]?.to || null;
}

module.exports = { canTransition, nextState, SYSTEM_ROLE };
