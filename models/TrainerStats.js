const mongoose = require('mongoose');

const trainerStatsSchema = new mongoose.Schema({
  entrenador: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    unique: true,
    required: true
  },
  totalRatings: { type: Number, default: 0 },
  avgRating:    { type: Number, default: 0 },
  ratingCounts: {
    '1': { type: Number, default: 0 },
    '2': { type: Number, default: 0 },
    '3': { type: Number, default: 0 },
    '4': { type: Number, default: 0 },
    '5': { type: Number, default: 0 }
  }
});

module.exports = mongoose.model('TrainerStats', trainerStatsSchema);
