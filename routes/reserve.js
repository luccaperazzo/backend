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
// routes/reserve.js
router.patch('/:id/state', authMiddleware, async (req, res) => {
  let { action, fechaInicio } = req.body;
  if (!action) return res.status(400).json({ error: 'action es obligatorio' });

  action = action[0].toUpperCase() + action.slice(1).toLowerCase();

  try {
    // 1️⃣ Cargo la reserva
    const reserva = await Reserva.findById(req.params.id)
      .populate('servicio','titulo duracion')
      .populate('cliente','nombre apellido email');
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });

    // 2️⃣ Valido transición
    if (!canTransition(req.user.role, reserva.estado, action)) {
      return res.status(403).json({ error: 'Acción no permitida' });
    }

    // 3️⃣ Calculo nuevo estado
    const nuevoEstado = nextState(reserva.estado, action);
    reserva.estado = nuevoEstado;

    // 4️⃣ Si reprogramo, actualizo fecha
    if (action === 'Reprogramar') {
      if (!fechaInicio) {
        return res.status(400).json({ error: 'fechaInicio es obligatorio para reprogramar' });
      }
      reserva.fechaInicio = new Date(fechaInicio);
    }

    // 5️⃣ Guardo cambios directamente sobre el documento
    await reserva.save();

    // 6️⃣ Devuelvo la reserva ya actualizada
    return res.json(reserva);

  } catch (err) {
    console.error('❌ ERROR /reserve/:id/state:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});


module.exports = router;

