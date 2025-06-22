const Service = require('../models/Service');

function validarDisponibilidadInterna(disponibilidad) {
  
  const disponibilidadMap = disponibilidad instanceof Map
    ? disponibilidad
    : new Map(Object.entries(disponibilidad));

  for (const [dia, bloques] of disponibilidadMap.entries()) {
    if (!Array.isArray(bloques)) {
      return {
        ok: false,
        mensaje: `Formato inválido en disponibilidad para ${dia}.`
      };
    }
    const bloquesConMinutos = [];
    for (const bloque of bloques) {
      if (!Array.isArray(bloque) || bloque.length !== 2) {
        return {
          ok: false,
          mensaje: `Cada bloque en ${dia} debe ser un array [inicio, fin].`
        };
      }
      const [inicioStr, finStr] = bloque;
      const [h1, m1] = inicioStr.split(':').map(Number);
      const [h2, m2] = finStr.split(':').map(Number);
      if (
        Number.isNaN(h1) || Number.isNaN(m1) ||
        Number.isNaN(h2) || Number.isNaN(m2) ||
        h1 < 0 || h1 > 23 || m1 < 0 || m1 > 59 ||
        h2 < 0 || h2 > 23 || m2 < 0 || m2 > 59
      ) {
        return {
          ok: false,
          mensaje: `Formato de hora inválido en ${dia}: "${inicioStr}" o "${finStr}". Debe ser "HH:MM".`
        };
      }
      const minutosInicio = h1 * 60 + m1;
      const minutosFin    = h2 * 60 + m2;
      if (minutosFin <= minutosInicio) {
        return {
          ok: false,
          mensaje: `En ${dia}, el inicio (${inicioStr}) debe ser anterior al fin (${finStr}).`
        };
      }
      bloquesConMinutos.push({
        inicioMin: minutosInicio,
        finMin: minutosFin,
        inicioStr,
        finStr
      });
    }
    
    bloquesConMinutos.sort((a, b) => a.inicioMin - b.inicioMin);
    for (let i = 1; i < bloquesConMinutos.length; i++) {
      const prev = bloquesConMinutos[i - 1];
      const curr = bloquesConMinutos[i];
      if (curr.inicioMin < prev.finMin) {
        return {
          ok: false,
          mensaje: `Conflicto interno en ${dia}: el bloque ${curr.inicioStr}-${curr.finStr} se solapa con ${prev.inicioStr}-${prev.finStr}.`
        };
      }
    }
  }
  return { ok: true };
}

function validarDuracionBloques(disponibilidad, duracion) {
  for (const [dia, bloques] of Object.entries(disponibilidad)) {
    if (!Array.isArray(bloques)) {
      return {
        ok: false,
        mensaje: `Formato inválido en disponibilidad para ${dia}.`
      };
    }
    for (const [inicio, fin] of bloques) {
      const [h1, m1] = inicio.split(':').map(Number);
      const [h2, m2] = fin.split(':').map(Number);
      if (
        Number.isNaN(h1) || Number.isNaN(m1) ||
        Number.isNaN(h2) || Number.isNaN(m2)
      ) {
        return {
          ok: false,
          mensaje: `Formato de hora inválido en ${dia}: "${inicio}" o "${fin}".`
        };
      }
      const minutosInicio = h1 * 60 + m1;
      const minutosFin    = h2 * 60 + m2;
      const diff = minutosFin - minutosInicio;
      if (diff < duracion) {
        return {
          ok: false,
          mensaje: `El bloque en ${dia} de ${inicio} a ${fin} dura ${diff} min, menor a la duración del servicio (${duracion} min).`
        };
      }
      if (diff % duracion !== 0) {
        return {
          ok: false,
          mensaje: `El bloque en ${dia} de ${inicio} a ${fin} no es múltiplo exacto de ${duracion} min (sobran ${diff % duracion} min).`
        };
      }
    }
  }
  return { ok: true };
}

async function validarSolapamientoConOtros(entrenadorId, disponibilidad, excludeServiceId, rangosSolapan) {
  // Buscar servicios del mismo entrenador, excluyendo el que estamos actualizando
  const filtro = { entrenador: entrenadorId };
  if (excludeServiceId) {
    filtro._id = { $ne: excludeServiceId };
  }
  const otrosServicios = await Service.find(filtro);
  for (const otro of otrosServicios) {
    for (const [dia, bloquesNuevo] of Object.entries(disponibilidad)) {
      // extraer bloques existentes; puede ser Map en Mongoose, usamos .get(dia) o []
      const bloquesExistentes = otro.disponibilidad?.get(dia) || [];
      for (const [nuevoInicio, nuevoFin] of bloquesNuevo) {
        for (const [existenteInicio, existenteFin] of bloquesExistentes) {
          if (rangosSolapan(nuevoInicio, nuevoFin, existenteInicio, existenteFin)) {
            return {
              ok: false,
              mensaje: `Conflicto con otro servicio (ID ${otro._id}) en ${dia}: ya tenés un servicio entre ${existenteInicio} y ${existenteFin}.`
            };
          }
        }
      }
    }
  }
  return { ok: true };
}

module.exports = {
  validarDisponibilidadInterna,
  validarDuracionBloques,
  validarSolapamientoConOtros
};
