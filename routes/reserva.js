const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Reserva = require('../models/Reserva');
const Service = require('../models/Service');

// Crear una reserva (solo clientes)
router.post('/', authMiddleware, async (req, res) => {
  if (req.user.role !== 'cliente') {
    return res.status(403).json({ error: 'Solo los clientes pueden contratar servicios' });
  }

  const { servicioId } = req.body;

  try {
    const servicio = await Service.findById(servicioId);
    if (!servicio) return res.status(404).json({ error: 'Servicio no encontrado' });

    const nueva = new Reserva({
      cliente: req.user.userId,
      servicio: servicioId
    });

    await nueva.save();
    res.status(201).json(nueva);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear la reserva' });
  }
});

// Ver reservas de un entrenador (ver quién contrató sus servicios)
router.get('/mis-servicios', authMiddleware, async (req, res) => {
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

    const filtradas = reservas.filter(r => r.servicio !== null); // sacar reservas que no son de este entrenador

    res.json(filtradas);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener reservas' });
  }
});

module.exports = router;
