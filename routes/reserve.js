const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Reserva = require('../models/Reserva');
const Service = require('../models/Service');
const { canTransition, nextState } = require('../utils/stateMachine');

// 1) Crear una reserva (solo clientes)
router.post('/', authMiddleware, async (req, res) => {
  if (req.user.role !== 'cliente') {
    return res.status(403).json({ error: 'Solo los clientes pueden contratar servicios' });
  }

  const { servicioId, fechaInicio } = req.body;
  try {
    const servicio = await Service.findById(servicioId);
    if (!servicio) return res.status(404).json({ error: 'Servicio no encontrado' });

    const nueva = new Reserva({
      cliente: req.user.userId,
      servicio: servicioId,
      fechaInicio: fechaInicio // Hora de inicio de la reserva (en formato ISO)
    });

    await nueva.save();
    res.status(201).json(nueva);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear la reserva' });
  }
});

// 2) Ver reservas de un entrenador (ver quién contrató sus servicios)
router.get('/mis-reservas', authMiddleware, async (req, res) => {
  if (req.user.role !== 'entrenador') {
    return res.status(403).json({ error: 'Solo los entrenadores pueden ver esto' });
  }

  try {
    const reservas = await Reserva.find()
      .populate({
        path: 'servicio',
        match: { entrenador: req.user.userId },
        populate: { path: 'entrenador', select: 'nombre apellido' }
      })
      .populate('cliente', 'nombre apellido email');

    const filtradas = reservas.filter(r => r.servicio !== null);
    res.json(filtradas);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener reservas' });
  }
});

// 3) Cambiar estado vía acción
// PATCH /reserva/:id/estado
// Body: { action: 'Confirmar'|'Cancelar'|'Reprogramar', fechareserva? }
router.patch('/:id/estado', authMiddleware, async (req, res) => {
  const { action, fechareserva } = req.body;

  try {
    const r = await Reserva.findById(req.params.id).populate('servicio');
    if (!r) return res.status(404).json({ error: 'Reserva no encontrada' });

    if (!canTransition(req.user.role, r.estado, action)) {
      return res.status(403).json({ error: 'No autorizado o acción inválida' });
    }

    r.estado = nextState(r.estado, action);

    if (action === 'Reprogramar') {
      if (!fechareserva) {
        return res.status(400).json({ error: 'Fecha de reprogramación obligatoria' });
      }
      r.fechareserva = new Date(fechareserva);
    }

    await r.save();
    res.json(r);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// 4) Comentar en reserva completada
// POST /reserva/:id/comentar
// Body: { texto }
router.post('/:id/comentar', authMiddleware, async (req, res) => {
  const { texto } = req.body;
  try {
    const r = await Reserva.findById(req.params.id);
    if (!r) return res.status(404).json({ error: 'Reserva no encontrada' });
    if (r.estado !== 'Completado') {
      return res.status(400).json({ error: 'Solo se puede comentar si está Completada' });
    }

    r.comentarios.push({ autor: req.user.userId, texto });
    await r.save();
    res.json(r);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
