const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Asegurate que esta ruta esté bien

// Obtener entrandor por ID
router.get('/:id', async (req, res) => {
  try {
    const entrenador = await User.findOne({
      _id: req.params.id,
      role: 'entrenador'
    }).select('-password');

    if (!entrenador) {
      return res.status(404).json({ error: 'Entrenador no encontrado' });
    }

    res.json(entrenador);
  } catch (err) {
    console.error('❌ Error al obtener entrenador:', err);
    res.status(500).json({ error: 'Error al obtener el entrenador' });
  }
});
module.exports = router;