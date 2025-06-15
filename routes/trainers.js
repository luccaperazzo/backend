const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const validateReservation = require('../middleware/validateReservation');
const Rating       = require('../models/Rating');
const TrainerStats = require('../models/TrainerStats');
const Reserva = require('../models/Reserve');
const Service = require('../models/Service');

router.get('/top-trainers', async (req, res) => {
  try {
    // 1. Buscar los 3 mejores entrenadores por avgRating y totalRatings
    const topStats = await TrainerStats.find({}) //Si hay un trainer pero no tiene ratings, no lo traigo
      .sort({ avgRating: -1, totalRatings: -1 }) // Ordena por rating, luego más ratings
      .limit(3)
      .populate('entrenador', 'nombre apellido presentacion zona idiomas avatarUrl'); // Trae solo estos campos del User

    // 2. Mapear para enviar los datos combinados
    const result = topStats.map(stats => ({
      _id: stats.entrenador._id,
      nombre: stats.entrenador.nombre,
      apellido: stats.entrenador.apellido,
      presentacion: stats.entrenador.presentacion,
      zona: stats.entrenador.zona,
      idiomas: stats.entrenador.idiomas,
      avgRating: stats.avgRating,
      totalRatings: stats.totalRatings,
      avatarUrl: stats.entrenador.avatarUrl || null // Añadir avatarUrl
    }));

    res.json(result);

  } catch (err) {
    res.status(500).json({ error: 'Error al traer entrenadores top' });
  }
});


// Traer perfil completo de un entrenador, incluyendo su rating promedio
router.get('/:id', async (req, res) => {
  try {
    // 1. Trae el entrenador
    const entrenador = await User.findOne({
      _id: req.params.id,
      role: 'entrenador'
    }).select('-password -__v').lean();

    if (!entrenador) {
      return res.status(404).json({ error: 'Entrenador no encontrado' });
    }    // 2. Busca el promedio de ratings en TrainerStats
    const stats = await TrainerStats.findOne({ entrenador: entrenador._id });
    entrenador.avgRating = stats ? stats.avgRating : 0;
    entrenador.totalRatings = stats ? stats.totalRatings : 0;

    // avatarUrl ya viene en el objeto entrenador
    res.json(entrenador);
  } catch (err) {
    console.error('❌ Error al traer entrenador:', err);
    res.status(500).json({ error: 'Error interno al buscar entrenador' });
  }
});


router.get('/', authMiddleware, async (req, res) => {
  try {
    const clienteId = req.user.userId;    // 1. Buscar reservas relevantes
    const reservas = await Reserva.find({
      cliente: clienteId,
      estado: { $in: ['Aceptado', 'Finalizado'] }
    }).populate({
      path: 'servicio',
      select: 'entrenador',
      populate: {
        path: 'entrenador',
        select: 'nombre apellido avatarUrl'
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
          apellido: entrenador.apellido,
          avatarUrl: entrenador.avatarUrl
        });
      }
    }

    // 3. Buscar stats en lote
    const ids = Array.from(entrenadoresMap.keys());
    const stats = await TrainerStats.find({ entrenador: { $in: ids } })
      .select('entrenador avgRating').lean();    // 4. Unir nombre, apellido y avgRating
    const entrenadores = ids.map(id => {
      const base = entrenadoresMap.get(id);
      const stat = stats.find(s => String(s.entrenador) === id);
      return {
        _id: base._id,
        nombre: base.nombre,
        apellido: base.apellido,
        avatarUrl: base.avatarUrl,
        avgRating: stat ? stat.avgRating : 0,
        totalRatings: stat ? stat.totalRatings : 0
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

      // 1️⃣ Verificar si ya existe un comentario para este entrenador y cliente
      const existente = await Rating.findOne({
        entrenador: entrenadorId,
        cliente: clienteId
      });
      if (existente) {
        return res.status(400).json({ error: 'Ya dejaste un comentario para este entrenador.' });
      }

      
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

// routes/trainers.js
router.get('/:id/service-metrics', authMiddleware, async (req, res) => {
  const servicios = await Service.find({ entrenador: req.params.id }).select('titulo vistas');
  const reservas = await Reserva.aggregate([
    { $match: { servicio: { $in: servicios.map(s => s._id) } } },
    { $group: { _id: '$servicio', total: { $sum: 1 } } }
  ]);

  // Map reservas por servicio
  const reservasMap = {};
  reservas.forEach(r => { reservasMap[r._id] = r.total; });

  // Devuelve en el formato esperado
  const out = servicios.map(s => ({
    servicio: s.titulo,
    vistas: s.vistas,
    reservas: reservasMap[s._id.toString()] || 0,
    tasaConversion: s.vistas
      ? ((reservasMap[s._id.toString()] || 0) / s.vistas * 100).toFixed(1) + '%'
      : '0%'
  }));

  // Totales
  const totalVistas = out.reduce((sum, s) => sum + s.vistas, 0);
  const totalReservas = out.reduce((sum, s) => sum + s.reservas, 0);
  const totalTasa = totalVistas ? ((totalReservas / totalVistas) * 100).toFixed(1) + '%' : '0%';

  out.push({
    servicio: 'Total',
    vistas: totalVistas,
    reservas: totalReservas,
    tasaConversion: totalTasa
  });

  res.json(out);
});

module.exports = router;