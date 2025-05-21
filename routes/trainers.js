const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const validateReservation = require('../middleware/validateReservation');
const Rating       = require('../models/Rating');
const TrainerStats = require('../models/TrainerStats');
const Reserva = require('../models/Reserva');

/*
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


*/


router.get('/', authMiddleware, async (req, res) => {
  try {
    const clienteId = req.user.userId;

    // 1. Buscar reservas relevantes
    const reservas = await Reserva.find({
      cliente: clienteId,
      estado: { $in: ['Aceptado', 'Finalizado'] }
    }).populate({
      path: 'servicio',
      select: 'entrenador',
      populate: {
        path: 'entrenador',
        select: 'nombre apellido'
      }
    });

    // 2. Extraer IDs únicos y datos básicos
    const entrenadoresMap = new Map();

    for (const reserva of reservas) {
      const entrenador = reserva.servicio?.entrenador;
      if (entrenador && !entrenadoresMap.has(String(entrenador._id))) {
        entrenadoresMap.set(String(entrenador._id), {
          _id: entrenador._id,
          nombre: entrenador.nombre,
          apellido: entrenador.apellido
        });
      }
    }

    // 3. Buscar stats en lote
    const ids = Array.from(entrenadoresMap.keys());
    const stats = await TrainerStats.find({ entrenador: { $in: ids } })
      .select('entrenador avgRating').lean();

    // 4. Unir nombre, apellido y avgRating
    const entrenadores = ids.map(id => {
      const base = entrenadoresMap.get(id);
      const stat = stats.find(s => String(s.entrenador) === id);
      return {
        nombre: base.nombre,
        apellido: base.apellido,
        avgRating: stat ? stat.avgRating : 0
      };
    });

    res.json(entrenadores);

  } catch (err) {
    console.error('❌ Error al traer entrenadores del cliente:', err);
    res.status(500).json({ error: 'Error interno al buscar entrenadores' });
  }
});










// Comentar a un entrenador. Validacion:Tiene que tener una reserva finalizada el cliente para comentar. 
router.post(
  '/:id/reviews',
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
      createdAt: r.createdAt,
      reply:     r.reply      // puede ser null o { texto, createdAt }

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

// POST /api/trainers/:trainerId/reviews/:reviewId/reply
router.post(
  '/:trainerId/reviews/:reviewId/reply',
  authMiddleware,
  async (req, res) => {
    const { trainerId, reviewId } = req.params;
    const texto = req.body.texto?.trim();

    // 1️⃣ Validar rol y propietario
    if (req.user.role !== 'entrenador' || req.user.userId !== trainerId) {
      return res.status(403).json({ error: 'Sólo el entrenador propietario puede responder.' });
    }

    // 2️⃣ Validar texto
    if (!texto || texto.length === 0 || texto.length > 500) {
      return res.status(400).json({ error: 'Texto inválido (1–500 caracteres).' });
    }

    // 3️⃣ Buscar el review
    const review = await Rating.findOne({ 
      _id: reviewId,
      entrenador: trainerId
    });
    if (!review) {
      return res.status(404).json({ error: 'Reseña no encontrada.' });
    }

    // 4️⃣ Verificar que no tenga ya respuesta
    if (review.reply) {
      return res.status(400).json({ error: 'Ya existe una respuesta para esta reseña.' });
    }

    // 5️⃣ Guardar respuesta
    review.reply = { texto };
    await review.save();

    return res.status(201).json({
      mensaje: 'Respuesta guardada',
      reply:   review.reply
    });
  }
);


module.exports = router;