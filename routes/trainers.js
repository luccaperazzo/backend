const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware'); // Agregar esta línea
const validateReservation = require('../middleware/validateReservation');
const Rating       = require('../models/Rating');
const TrainerStats = require('../models/TrainerStats');

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
router.post(
  '/:id/comments-rating',
  authMiddleware,
  validateReservation,
  async (req, res) => {
    try {
      const { texto, rating } = req.body;
      const entrenadorId = req.params.id;
      const clienteId    = req.user.userId;

      // 1️⃣ Validaciones básicas
      if (!texto || typeof texto !== 'string' || texto.trim().length === 0 || texto.trim().length > 500) {
        return res.status(400).json({ error: 'Texto inválido (1–500 caracteres)' });
      }
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating inválido (1–5)' });
      }

      // 2️⃣ Crear documento Rating
      const nuevoRating = await Rating.create({
        entrenador: entrenadorId,
        cliente:    clienteId,
        texto:      texto.trim(),
        rating
      });

      // 3️⃣ (Opcional) Leer estadísticas actualizadas
      const stats = await TrainerStats.findOne({ entrenador: entrenadorId });

      res.status(201).json({
        mensaje:    'Comentario y calificación añadidos',
        comentario: nuevoRating,
        stats
      });
    } catch (err) {
      console.error('❌ Error POST /comments:', err);
      res.status(500).json({ error: 'Error interno' });
    }
  }
);


//
// GET /api/trainers/:id/reviews
// Lista todos los comentarios + rating de un entrenador
//
router.get('/:id/reviews', async (req, res) => {
  try {
    const entrenadorId = req.params.id;

    const reviews = await Rating.find({ entrenador: entrenadorId })
      .populate('cliente', 'nombre apellido avatarUrl')
      .sort({ createdAt: -1 })
      .lean();

    // Formateamos la salida
    const output = reviews.map(r => ({
      _id:       r._id,
      cliente:   r.cliente,      // { _id, nombre, apellido, avatarUrl }
      texto:     r.texto,
      rating:    r.rating,
      createdAt: r.createdAt
    }));

    return res.json(output);
  } catch (err) {
    console.error('❌ Error GET /reviews:', err);
    return res.status(500).json({ error: 'Error interno al recuperar reseñas' });
  }
});

//
// GET /api/trainers/:id/stats
// Recupera las estadísticas pre-calculadas del entrenador
//
router.get('/:id/stats', async (req, res) => {
  try {
    const entrenadorId = req.params.id;

    // Busca el documento TrainerStats
    let stats = await TrainerStats.findOne({ entrenador: entrenadorId }).lean();

    // Si no existe, devolvemos valores por defecto
    if (!stats) {
      stats = {
        entrenador:    entrenadorId,
        totalRatings:  0,
        avgRating:     0,
        ratingCounts:  { '1':0,'2':0,'3':0,'4':0,'5':0 }
      };
    }

    return res.json(stats);
  } catch (err) {
    console.error('❌ Error GET /stats:', err);
    return res.status(500).json({ error: 'Error interno al recuperar estadísticas' });
  }
});


module.exports = router;