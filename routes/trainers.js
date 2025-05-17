const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
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

router.post(
  '/:id/comment-answers',
  authMiddleware,
  async (req, res) => {
    try {
      const entrenadorId = req.params.id;
      const entrenadorAuth = req.user.userId;       
      const { commentId, texto } = req.body;

      // 1) Validaciones básicas
      if (entrenadorAuth !== entrenadorId) {
        return res.status(403).json({ error: 'No puedes responder comentarios de otros entrenadores' });
      }
      if (!texto || typeof texto !== 'string' || !texto.trim() || texto.length > 500) {
        return res.status(400).json({ error: 'Texto inválido (1-500 caracteres)' });
      }
      if (!commentId) {
        return res.status(400).json({ error: 'Se requiere el commentId del comentario a responder' });
      }

      // 2) Cargar entrenador y asegurar que exista y sea role==='entrenador'
      const entrenador = await User.findById(entrenadorId);
      if (!entrenador || entrenador.role !== 'entrenador') {
        return res.status(404).json({ error: 'Entrenador no encontrado' });
      }

      // 3) Buscar el comentario dentro del array
      const comentario = entrenador.comentarios.id(commentId);
      if (!comentario) {
        return res.status(404).json({ error: 'Comentario no encontrado' });
      }

      // 4) Verificar que todavía no tenga respuesta
      if (comentario.respuestas.length > 0) {
        return res.status(400).json({ error: 'Ya has respondido a este comentario' });
      }

      // 5) Agregar la respuesta
      comentario.respuestas.push({
        entrenador: entrenadorId,
        texto: texto.trim()
      });

      await entrenador.save();

      // 6) Retornar OK con la respuesta añadida
      const nuevaRespuesta = comentario.respuestas.slice(-1)[0];
      res.status(201).json({
        mensaje: 'Respuesta añadida',
        respuesta: nuevaRespuesta
      });

    } catch (error) {
      console.error('❌ Error POST /:id/comment-answers:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

module.exports = router;