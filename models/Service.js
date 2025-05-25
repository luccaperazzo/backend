const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  titulo:      { type: String, required: true },
  descripcion: { type: String, required: true },
  precio:      { type: Number, required: true },
  entrenador:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  categoria:   { type: String, enum: ['Entrenamiento', 'Nutrición', 'Consultoría'], required: true },
  duracion:   { type: Number, enum: [30,45,60,90], required: true }, // Duración en minutos
       // en minutos
  fechaCreacion:{ type: Date, default: Date.now },
  publicado:   { type: Boolean, default: true },
  presencial:  { type: Boolean, required: true },
  disponibilidad: { type: Map, of: [[String]], default: {} }, // ← Cierra acá
  vistas: { type: Number, default: 0 } // ← Y este queda aparte
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);
