const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Obtener todos los entrenadores con filtros
router.get('/', async (req, res) => {
  try {
    const { zona, idiomas } = req.query;
    const query = { role: 'entrenador' };
    
    // Aplicar filtros
    if (zona) query.zona = zona;
    if (idiomas) {
      const idiomasArray = idiomas.split(',');
      query.idiomas = { $all: idiomasArray };
    }

    const entrenadores = await User.find(query)
      .select('-password -fechaNacimiento -comentarios -createdAt -updatedAt -__v');

    if (entrenadores.length === 0) {
      return res.status(404).json({ error: 'No se encontraron entrenadores con los filtros aplicados' });
    }

    res.json(entrenadores);

  } catch (err) {
    console.error('❌ Error al obtener entrenadores:', err);
    res.status(500).json({ error: 'Error al obtener los entrenadores' });
  }
});

module.exports = router;