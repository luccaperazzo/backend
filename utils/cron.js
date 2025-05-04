const cron    = require('node-cron');
const Reserva = require('../models/Reserva');
const Service = require('../models/Service');

cron.schedule('* * * * *', async () => {
  try {
    const ahora = new Date();

    // Carga reservas Aceptadas junto con su servicio
    const aceptadas = await Reserva.find({ estado: 'Aceptado' }).populate('servicio');

    for (const r of aceptadas) {
      const dur = r.servicio.duracion * 60000; // milisegundos
      if (r.fechareserva.getTime() + dur <= ahora.getTime()) {
        r.estado = 'Completado';
        await r.save();
        console.log(`Reserva ${r._id} marcada como Completado`);
      }
    }
  } catch (err) {
    console.error('Error en cron de reservas:', err);
  }
});
