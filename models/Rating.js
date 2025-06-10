const mongoose = require('mongoose');
const TrainerStats = require('./TrainerStats');

// Esquema para la respuesta del entrenador a una reseña
const replySchema = new mongoose.Schema({
  texto:     { type: String, required: true, maxlength: 500 }, // Texto de la respuesta
  createdAt: { type: Date,   default: Date.now }               // Fecha de creación de la respuesta
}, { _id: false });

// Esquema principal para las calificaciones (ratings)
const ratingSchema = new mongoose.Schema({
  entrenador: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Referencia al entrenador calificado
  cliente:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Referencia al cliente que califica
  texto:      { type: String, maxlength: 500 },                                      // Comentario opcional del cliente
  rating:     { type: Number, required: true, min: 1, max: 5 },                      // Puntuación (1 a 5 estrellas)
  createdAt:  { type: Date, default: Date.now },                                     // Fecha de creación de la calificación
  reply:      { type: replySchema, default: null }                                   // Respuesta opcional del entrenador
});

// Hook que se ejecuta después de guardar una calificación (rating)
// Actualiza las estadísticas del entrenador (TrainerStats) solo si la calificación o el texto cambian
ratingSchema.post('save', async function(doc) {
  // Solo actualizar estadísticas si NO es solo una modificación de la respuesta (reply)
  if (this.isModified('reply') && !this.isModified('rating') && !this.isModified('texto')) {
    return;
  }
  const estrella = doc.rating;
  // Obtiene las estadísticas actuales del entrenador
  const stats = await TrainerStats.findOne({ entrenador: doc.entrenador });
  const prevTotal = stats?.totalRatings || 0; // Total anterior de calificaciones, si no existe, se asume 0
  const prevAvg   = stats?.avgRating    || 0; // Promedio anterior de calificaciones, si no existe, se asume 0
  const newTotal  = prevTotal + 1;            // Nuevo total de calificaciones
  // Calcula el nuevo promedio de calificaciones
  const newAvg    = (prevAvg * prevTotal + estrella) / newTotal;

  // Actualiza o crea el documento de estadísticas del entrenador
  await TrainerStats.findOneAndUpdate(
    { entrenador: doc.entrenador },
    {
      totalRatings: newTotal, // Actualiza el total de calificaciones
      avgRating:    newAvg,   // Actualiza el promedio
      [`ratingCounts.${estrella}`]: (stats?.ratingCounts?.[estrella] || 0) + 1 // Incrementa el contador de la estrella correspondiente
    },
    { upsert: true } // Crea el documento si no existe
  );
});

// Exporta el modelo Rating para usarlo en otras partes de la aplicación
module.exports = mongoose.model('Rating', ratingSchema);
