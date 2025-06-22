// backend/utils/cron.js
const cron        = require('node-cron');
const Reserva     = require('../models/Reserve');
const { SYSTEM_ROLE, nextState } = require('./stateMachine');

cron.schedule('* * * * *', async () => {
  try {
    const ahora = Date.now();
  console.log(`Ejecutando cron de reservas... ${new Date(ahora).toISOString()}`);
    // Solo reservas en Aceptado
    const aceptadas = await Reserva.find({ estado: 'Aceptado' }).populate('servicio');

    for (const r of aceptadas) {
      if (!r.fechaInicio) {
        console.warn(`Reserva ${r._id} sin fechaInicio → omitida`);
        continue;
      }
      if (!r.servicio) {
        console.warn(`Reserva ${r._id} tiene el servicio eliminado`);
        continue;
      }
      // calculamos fin = inicio + duracion (minutos → ms)
      const finServicio = r.fechaInicio.getTime() + (r.servicio.duracion * 60_000);

      if (finServicio <= ahora) {
        // aplicamos la transición automática
        const nuevoEstado = nextState(r.estado, 'AutoFinalizar');
        if (nuevoEstado) {
          await Reserva.updateOne(
            { _id: r._id, estado: r.estado },
            { $set: { estado: nuevoEstado } }
          );
          console.log(`Reserva ${r._id} → ${nuevoEstado}`);
        }
      }
    }
  } catch (err) {
    console.error('Error en cron de reservas:', err);
  }
});
