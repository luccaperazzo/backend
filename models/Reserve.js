const mongoose = require('mongoose');

const reserveSchema = new mongoose.Schema({
  cliente:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  servicio:     { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  fechareserva: { type: Date, default: Date.now },
  fechaInicio:  { type: Date, required: true },
  estado:       { type: String, enum: ['Pendiente', 'Aceptado', 'Finalizado', 'Cancelado'], default: 'Pendiente' },
  documentos:   [{ type: String, trim: true }]
}, { timestamps: true });

module.exports = mongoose.models.Reserva || mongoose.model('Reserva', reserveSchema);