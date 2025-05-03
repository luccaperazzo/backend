// backend/models/Service.js
const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  titulo: { type: String, required: true },
  descripcion: { type: String, required: true },
  precio: { type: Number, required: true },
  entrenador: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  categoria: { type: String, enum: ['Entrenamiento', 'Nutrición', 'Consultoría'], required: true },
  fechaCreacion: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);