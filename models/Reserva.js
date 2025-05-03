const mongoose = require('mongoose');

const reservaSchema = new mongoose.Schema({
  cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  servicio: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  fechaReserva: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Reserva', reservaSchema);
