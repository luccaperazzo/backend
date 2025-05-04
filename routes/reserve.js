const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const reserve = require('../models/reserva');
const Service = require('../models/Service');

// Crear una reserve (solo clientes)
router.post('/', authMiddleware, async (req, res) => {
  if (req.user.role !== 'cliente') {
    return res.status(403).json({ error: 'Solo los clientes pueden contratar servicios' });
  }

  const { servicioId } = req.body;

  try {
    const servicio = await Service.findById(servicioId);
    if (!servicio) return res.status(404).json({ error: 'Servicio no encontrado' });

    const nueva = new reserve({
      cliente: req.user.userId,
      servicio: servicioId
    });

    await nueva.save();
    res.status(201).json(nueva);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear la reserve' });
  }
});

// Ver reservas de un entrenador (ver quién contrató sus servicios)
router.get('/mis-reservas', authMiddleware, async (req, res) => {
  if (req.user.role !== 'entrenador') {
    return res.status(403).json({ error: 'Solo los entrenadores pueden ver esto' });
  }

  try {
    const reservas = await reserve.find()
      .populate({
        path: 'servicio',
        match: { entrenador: req.user.userId },
        populate: { path: 'entrenador', select: 'nombre apellido' }
      })
      .populate('cliente', 'nombre apellido email');

    const filtradas = reservas.filter(r => r.servicio !== null); // sacar reservas que no son de este entrenador

    res.json(filtradas);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener reservas' });
  }
});


// backend/routes/reserva.js
router.patch('/:id/estado', authMiddleware, async (req, res) => {
  const { estado } = req.body;
  const estadosValidos = ['Pendiente', 'Aceptado', 'Completado', 'Cancelado'];

  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ msg: 'Estado inválido' });
  }

  try {
    const reserva = await Reserva.findById(req.params.id).populate('servicio');
    if (!reserva) return res.status(404).json({ msg: 'Reserva no encontrada' });

    // Solo el entrenador dueño del servicio puede cambiar el estado
    if (reserva.servicio.entrenador.toString() !== req.user.userId) {
      return res.status(403).json({ msg: 'No autorizado' });
    }

    reserva.estado = estado;
    await reserva.save();
    res.json({ msg: `Estado de la reserva actualizado a ${estado}` });
  } catch (err) {
    res.status(500).json({ msg: 'Error del servidor' });
  }
});


module.exports = router;
