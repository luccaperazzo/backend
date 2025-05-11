// backend/routes/reserve.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Reserva = require('../models/Reserva');
const Service = require('../models/Service');
const { canTransition, nextState } = require('../utils/stateMachine');

// POST  /api/reserve
// Crear una nueva reserva (solo clientes)
router.post('/', authMiddleware, async (req, res) => {
  if (req.user.role !== 'cliente')
    return res.status(403).json({ error: 'Solo clientes pueden reservar servicios' });

  const { servicioId, fechaInicio } = req.body;
  if (!servicioId || !fechaInicio)
    return res.status(400).json({ error: 'servicioId y fechaInicio son obligatorios' });

  try {
    const servicio = await Service.findById(servicioId);
    if (!servicio) return res.status(404).json({ error: 'Servicio no encontrado' });

    const reserva = await Reserva.create({
      cliente: req.user.userId,
      servicio: servicioId,
      fechaInicio: new Date(fechaInicio)
    });

    res.status(201).json(reserva);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear la reserva' });
  }
});

// GET /api/reserve
// Listar reservas: clientes ven las suyas; entrenadores ven reservas de sus servicios
router.get('/', authMiddleware, async (req, res) => {
  try {
    let reservas;
    if (req.user.role === 'cliente') {
      reservas = await Reserva.find({ cliente: req.user.userId })
        .populate('servicio', 'titulo duracion')
        .sort({ fechaInicio: -1 });
    } else if (req.user.role === 'entrenador') {
      reservas = await Reserva.find()
        .populate({
          path: 'servicio',
          match: { entrenador: req.user.userId },
          select: 'titulo duracion'
        })
        .populate('cliente', 'nombre apellido email')
        .sort({ fechaInicio: -1 });
      reservas = reservas.filter(r => r.servicio);
    } else {
      return res.status(403).json({ error: 'Rol no autorizado' });
    }
    res.json(reservas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener reservas' });
  }
});

// PATCH /api/reserve/:id/state
// Cambiar state: Confirmar, Cancelar, Reprogramar
router.patch('/:id/state', authMiddleware, async (req, res) => {
  let { action, fechaInicio } = req.body;
  if (!action)
    return res.status(400).json({ error: 'action es obligatorio' });

  // Normalizamos: primera letra mayúscula, resto minúsculas
  action = action.charAt(0).toUpperCase() + action.slice(1).toLowerCase();

  try {
    const reserva = await Reserva.findById(req.params.id);
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });

    if (!canTransition(req.user.role, reserva.state, action))
      return res.status(403).json({ error: 'Acción no permitida' });

    const update = { state: nextState(reserva.state, action) };
    if (action === 'Reprogramar') {
      if (!fechaInicio)
        return res.status(400).json({ error: 'fechaInicio es obligatorio para reprogramar' });
      update.fechaInicio = new Date(fechaInicio);
    }

    await Reserva.updateOne(
      { _id: reserva._id, state: reserva.state },
      { $set: update }
    );

    const updated = await Reserva.findById(reserva._id)
      .populate('servicio','titulo duracion')
      .populate('cliente','nombre apellido email');
    res.json(updated);

  } catch (err) {
    console.error('❌ ERROR /reserve/:id/state:', err.message);
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;

