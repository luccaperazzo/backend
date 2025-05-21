const mongoose = require('mongoose');
const TrainerStats = require('./TrainerStats');


const replySchema = new mongoose.Schema({
  texto:     { type: String, required: true, maxlength: 500 },
  createdAt: { type: Date,   default: Date.now }
}, { _id: false });

const ratingSchema = new mongoose.Schema({
  entrenador: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  cliente:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  texto:      { type: String, maxlength: 500 },
  rating:     { type: Number, required: true, min: 1, max: 5 },
  createdAt:  { type: Date, default: Date.now },
    reply:      { type: replySchema, default: null }       // <-- aquí

});


// Hook que actualiza TrainerStats tras cada save()
ratingSchema.post('save', async function(doc) {
  const estrella = doc.rating;
  // calculo manual de avg si tu Mongo no soporta operaciones en pipeline:
  const stats = await TrainerStats.findOne({ entrenador: doc.entrenador });
  const prevTotal = stats?.totalRatings || 0;
  const prevAvg   = stats?.avgRating    || 0;
  const newTotal  = prevTotal + 1;
  const newAvg    = (prevAvg * prevTotal + estrella) / newTotal;

  await TrainerStats.findOneAndUpdate(
    { entrenador: doc.entrenador },
    {
      totalRatings: newTotal,
      avgRating:    newAvg,
      [`ratingCounts.${estrella}`]: (stats?.ratingCounts?.[estrella] || 0) + 1
    },
    { upsert: true }
  );
});

module.exports = mongoose.model('Rating', ratingSchema);
