const mongoose = require('mongoose');

const reservaSchema = new mongoose.Schema({
  cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  servicio: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
<<<<<<< HEAD
  fechareserva: { type: Date, default: Date.now }
=======
  fechaReserva: { type: Date, default: Date.now },
  estado: {
    type: String,
    enum: ['Pendiente', 'Aceptado', 'Completado', 'Cancelado'],
    default: 'Pendiente'
  }
>>>>>>> f65ec3eab0f2b762d9cfb92d2d7f34b6954af84b
}, { timestamps: true });

module.exports = mongoose.model('reserve', reservaSchema);
