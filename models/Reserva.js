const mongoose = require('mongoose');

const comentarioSchema = new mongoose.Schema({
  autor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  texto: { type: String, required: true },
  fecha: { type: Date, default: Date.now }
});

const reserveSchema = new mongoose.Schema({
  cliente:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  servicio:     { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  fechareserva: { type: Date, default: Date.now },
  estado:       { 
    type: String,
    enum: ['Pendiente', 'Aceptado', 'Completado', 'Cancelado'],
    default: 'Pendiente'
  },
  comentarios:  [comentarioSchema]
}, { timestamps: true });

module.exports = mongoose.model('Reserva', reserveSchema);
