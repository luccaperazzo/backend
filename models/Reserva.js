const mongoose = require('mongoose');

const reserveSchema = new mongoose.Schema({
  cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  servicio: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  fechareserva: { type: Date, default: Date.now }

}, { timestamps: true });

module.exports = mongoose.model('reserve', reserveSchema);
