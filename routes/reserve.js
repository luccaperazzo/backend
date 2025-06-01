// backend/routes/reserve.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Reserva = require('../models/Reserva');
const Service = require('../models/Service');
const { canTransition, nextState } = require('../utils/stateMachine');

const UPLOAD_PATH = process.env.UPLOAD_PATH || path.join(process.cwd(), 'uploads', 'reservas');
if (!fs.existsSync(UPLOAD_PATH)) {
  fs.mkdirSync(UPLOAD_PATH, { recursive: true });
}

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

// GET /api/reserve/:id/documents
// Listar nombres de documentos asociados a una reserva
router.get('/:id/documents', authMiddleware, async (req, res) => {
  try {
    const reserva = await Reserva.findById(req.params.id).populate('servicio');
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });

    // Solo cliente propietario o entrenador propietario pueden consultar
    if (req.user.role === 'cliente') {
      if (reserva.cliente.toString() !== req.user.userId)
        return res.status(403).json({ error: 'No autorizado para ver documentos' });
    } else if (req.user.role === 'entrenador') {
      if (reserva.servicio.entrenador.toString() !== req.user.userId)
        return res.status(403).json({ error: 'No autorizado para ver documentos' });
    } else {
      return res.status(403).json({ error: 'Rol no autorizado' });
    }

    res.json({ documentos: reserva.documentos });
  } catch (err) {
    console.error('❌ ERROR GET /reserve/:id/documents:', err);
    res.status(500).json({ error: 'Error al obtener documentos' });
  }
});

// POST /api/reserve/:id/documents
router.post('/:id/documents', authMiddleware, async (req, res) => {
  try {
    if (!req.files || !req.files.document)
      return res.status(400).json({ error: 'Debe incluir un archivo PDF en el campo "document"' });

    const file = req.files.document;
    if (file.mimetype !== 'application/pdf')
      return res.status(400).json({ error: 'Solo se permiten archivos PDF' });

    const reserva = await Reserva.findById(req.params.id).populate('servicio');
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });
    if (req.user.role !== 'entrenador' || reserva.servicio.entrenador.toString() !== req.user.userId)
      return res.status(403).json({ error: 'Solo el entrenador propietario puede subir documentos' });
    if (reserva.estado !== 'Aceptado')
      return res.status(400).json({ error: 'Solo se pueden subir documentos en estado Aceptado' });

    const filename = `${reserva._id}_${Date.now()}_${file.name}`;
    const savePath = path.join(UPLOAD_PATH, filename);
    await file.mv(savePath);

    reserva.documentos.push(filename);
    await reserva.save();

    res.status(201).json({ message: 'Documento subido', filename });
  } catch (err) {
    console.error('❌ ERROR /reserve/:id/documents POST:', err);
    res.status(500).json({ error: 'Error al subir documento' });
  }
});

// DELETE /api/reserve/:id/documents/:filename
router.delete('/:id/documents/:filename', authMiddleware, async (req, res) => {
  try {
    const { id, filename } = req.params;
    const reserva = await Reserva.findById(id).populate('servicio');
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });

    if (req.user.role !== 'entrenador' || reserva.servicio.entrenador.toString() !== req.user.userId)
      return res.status(403).json({ error: 'No autorizado para eliminar documentos' });

    if (!reserva.documentos.includes(filename))
      return res.status(404).json({ error: 'Documento no registrado en la reserva' });

    const filePath = path.join(UPLOAD_PATH, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    reserva.documentos = reserva.documentos.filter(doc => doc !== filename);
    await reserva.save();

    res.json({ message: 'Documento eliminado', filename });
  } catch (err) {
    console.error('❌ ERROR /reserve/:id/documents DELETE:', err);
    res.status(500).json({ error: 'Error al eliminar documento' });
  }
});

router.get('/:id/documents/:filename', authMiddleware, async (req, res) => {
  try {
    const { id, filename } = req.params;
    const reserva = await Reserva.findById(id).populate('servicio');
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });

    // Validar rol y propiedad
    const isCliente = req.user.role === 'cliente' && reserva.cliente.toString() === req.user.userId;
    const isEntrenador = req.user.role === 'entrenador' && reserva.servicio.entrenador.toString() === req.user.userId;
    if (!isCliente && !isEntrenador)
      return res.status(403).json({ error: 'No autorizado para descargar documentos' });

    // Solo si está Aceptado o Finalizado
    if (!['Aceptado', 'Finalizado'].includes(reserva.estado))
      return res.status(400).json({ error: 'No se puede descargar en el estado actual' });

    if (!reserva.documentos.includes(filename))
      return res.status(404).json({ error: 'Documento no encontrado en esta reserva' });

    const filePath = path.join(UPLOAD_PATH, filename);
    if (!fs.existsSync(filePath))
      return res.status(404).json({ error: 'Archivo no existe en el servidor' });

    res.download(filePath, filename);
  } catch (err) {
    console.error('❌ ERROR GET /reserve/:id/documents/:filename:', err);
    res.status(500).json({ error: 'Error al descargar documento' });
  }
});

module.exports = router;

