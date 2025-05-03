const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Asegurate que esta ruta esté bien

// Obtener todos los entrenadores
router.get('/', async (req, res) => {
  try {
    const trainers = await User.find({ rol: 'trainer' }).select('-password');
    res.status(200).json(trainers);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los entrenadores' });
  }
});

module.exports = router;