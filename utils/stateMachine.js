// backend/routes/reserve.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Reserva = require('../models/Reserva');
const Service = require('../models/Service');
const { canTransition, nextState } = require('../utils/stateMachine');

// Crear una nueva reserva (solo clientes)
// POST /api/reserve
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

// Listar reservas: clientes ven las suyas; entrenadores ven reservas de sus servicios
// GET /api/reserve
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

// Confirmar reserva (solo entrenador)
// POST /api/reserve/:id/confirmar
router.post('/:id/confirmar', authMiddleware, async (req, res) => {
  try {
    const reserva = await Reserva.findById(req.params.id);
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });

    const action = 'Confirmar';
    if (!canTransition(req.user.role, reserva.estado, action))
      return res.status(403).json({ error: 'Acción no permitida' });

    const nuevoEstado = nextState(reserva.estado, action);
    await Reserva.updateOne({ _id: reserva._id, estado: reserva.estado }, { $set: { estado: nuevoEstado } });

    const updated = await Reserva.findById(reserva._id);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al confirmar reserva' });
  }
});

// Cancelar reserva (cliente y entrenador según estado)
// POST /api/reserve/:id/cancelar
router.post('/:id/cancelar', authMiddleware, async (req, res) => {
  try {
    const reserva = await Reserva.findById(req.params.id);
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });

    const action = 'Cancelar';
    if (!canTransition(req.user.role, reserva.estado, action))
      return res.status(403).json({ error: 'Acción no permitida' });

    const nuevoEstado = nextState(reserva.estado, action);
    await Reserva.updateOne({ _id: reserva._id, estado: reserva.estado }, { $set: { estado: nuevoEstado } });

    const updated = await Reserva.findById(reserva._id);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cancelar reserva' });
  }
});

// Reprogramar reserva (solo cliente)
// POST /api/reserve/:id/reprogramar
router.post('/:id/reprogramar', authMiddleware, async (req, res) => {
  const { fechaInicio } = req.body;
  if (!fechaInicio) return res.status(400).json({ error: 'fechaInicio es obligatorio' });

  try {
    const reserva = await Reserva.findById(req.params.id);
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });

    const action = 'Reprogramar';
    if (!canTransition(req.user.role, reserva.estado, action))
      return res.status(403).json({ error: 'Acción no permitida' });

    const nuevoEstado = nextState(reserva.estado, action);
    await Reserva.updateOne(
      { _id: reserva._id, estado: reserva.estado },
      { $set: { estado: nuevoEstado, fechaInicio: new Date(fechaInicio) } }
    );

    const updated = await Reserva.findById(reserva._id);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al reprogramar reserva' });
  }
});

module.exports = router;