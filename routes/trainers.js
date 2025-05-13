const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware'); // Agregar esta línea
const validateReservation = require('../middleware/validateReservation');

// Obtener todos los entrenadores + filtro de zona e idioma
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

// Comentar a un entrenador. Validacion:Tiene que tener una reserva finalizada el cliente para comentar. 
router.post('/:id/comments', authMiddleware, validateReservation, async (req, res) => {
  try {
    if (!req.body.texto || req.body.texto.trim().length === 0 || req.body.texto.length > 500) {
      return res.status(400).json({ error: 'Texto inválido (1-500 caracteres)' });
    }

    const entrenador = await User.findOne({ _id: req.params.id, role: 'entrenador' });
    if (!entrenador) return res.status(404).json({ error: 'Entrenador no encontrado' });

    entrenador.comentarios.push({
      cliente: req.user.userId,
      texto: req.body.texto.trim()
    });

    await entrenador.save();
    
    res.status(201).json({
      mensaje: 'Comentario añadido',
      comentario: entrenador.comentarios.slice(-1)[0]
    });

  } catch (error) {
    console.error('❌ Error POST /comments:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;