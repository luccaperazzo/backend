// middlewares/validateReservation.js
const Reserva = require('../models/Reserva');
const Service = require('../models/Service'); // Asumo que existe y tiene campo 'entrenador'

const validateReservation = async (req, res, next) => {
  try {
    // 1. Obtener IDs necesarios
    const clienteId = req.user.id;
    const entrenadorId = req.params.id;

    // 2. Buscar servicios del entrenador
    const serviciosEntrenador = await Service.find({ entrenador: entrenadorId }).select('_id');
    
    // 3. Verificar reserva finalizada
    const reservaFinalizada = await Reserva.findOne({
      cliente: clienteId,
      servicio: { $in: serviciosEntrenador.map(s => s._id) },
      estado: 'Finalizado'
    });

    if (!reservaFinalizada) {
      return res.status(403).json({
        error: 'Debes tener una reserva finalizada con este entrenador para comentar'
      });
    }

    next();
  } catch (error) {
    console.error('🔥 Error en validación de reserva:', error);
    res.status(500).json({ error: 'Error al validar reserva' });
  }
};

module.exports = validateReservation;