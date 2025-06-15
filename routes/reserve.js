// backend/routes/reserve.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Reserva = require('../models/Reserve');
const Service = require('../models/Service');
const { canTransition, nextState } = require('../utils/stateMachine');
const sendEmail = require('../utils/sendEmail');

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
    const servicio = await Service.findById(servicioId).populate('entrenador');
    if (!servicio) return res.status(404).json({ error: 'Servicio no encontrado' });

    const reserva = await Reserva.create({
      cliente: req.user.userId,
      servicio: servicioId,
      fechaInicio: new Date(fechaInicio)
    });


    const entrenador = servicio.entrenador;

    // Mail de reserva pendiente
    
    const subject = "Nueva reserva pendiente de aprobación";
    const html = `
      <p>Hola ${entrenador.nombre},</p>
      <p>Has recibido una nueva reserva para tu servicio <strong>${servicio.titulo}</strong>.</p>
      <p>Fecha: ${new Date(reserva.fechaInicio).toLocaleString()}</p>
      <p>Por favor, ingresa a la plataforma para aceptarla o rechazarla.</p>
    `;

      await sendEmail(entrenador.email, subject, html);
      await sendEmail("testgymapi@gmail.com", `Copia de reserva: ${entrenador.nombre}`, html);


    return res.status(201).json(reserva);
  } catch (err) {
    console.error("❌ ERROR AL CREAR RESERVA:", err);
    return res.status(500).json({ error: 'Error al crear la reserva' });
  }
  });
  
// GET /api/reserve
// Listar reservas: clientes ven las suyas; entrenadores ven reservas de sus servicios
router.get('/', authMiddleware, async (req, res) => {
  try {
    let reservas;
    if (req.user.role === 'cliente') {
  reservas = await Reserva.find({ cliente: req.user.userId })
    .populate({
      path: 'servicio',
      select: 'titulo duracion entrenador',
      populate: {
        path: 'entrenador',
        select: 'nombre apellido'
      }
    })
    .sort({ fechaInicio: 1 });
} else if (req.user.role === 'entrenador') {
      reservas = await Reserva.find()
        .populate({
          path: 'servicio',
          match: { entrenador: req.user.userId },
          select: 'titulo duracion'
        })
        .populate('cliente', 'nombre apellido email')
        .sort({ fechaInicio: 1 });
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
      .populate({
        path: 'servicio',
        select: 'titulo duracion',
        populate: {
          path: 'entrenador',
          select: 'nombre apellido email'
        }
      })
      .populate('cliente', 'nombre apellido email');
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


    // Mail de reserva reprogramada
    if (action === 'Reprogramar') {
      
      console.log("📩 Entrando al envío de mail por reprogramación...");
      const entrenador = reserva.servicio.entrenador;
      const subject = "⏰ Reserva reprogramada - Nueva fecha";
      const html = `
        <p>Hola ${entrenador.nombre},</p>
        <p>El cliente <strong>${reserva.cliente.nombre} ${reserva.cliente.apellido}</strong> ha <strong>reprogramado</strong> su reserva.</p>
        <p>Nuevo horario: ${new Date(reserva.fechaInicio).toLocaleString()}</p>
        <p>Por favor, ingresá a la plataforma para aceptarla o rechazarla.</p>
      `;

      await sendEmail(entrenador.email, subject, html);
      await sendEmail("testgymapi@gmail.com", `Copia reprogramación - ${reserva.cliente.email}`, html);
    }


    // Mail de reserva aceptada
    if (nuevoEstado === 'Aceptado') {
      const cliente = reserva.cliente;
      const servicio = await Service.findById(reserva.servicio._id).populate('entrenador', 'nombre apellido email');

      const asunto = "✅ Tu reserva fue confirmada";
      const html = `
        <p>Hola ${cliente.nombre},</p>
        <p>Tu reserva para el servicio <strong>${servicio.titulo}</strong> fue <strong>confirmada</strong> por el entrenador <strong>${servicio.entrenador.nombre} ${servicio.entrenador.apellido}</strong>.</p>
        <p>Fecha: ${new Date(reserva.fechaInicio).toLocaleString()}</p>
        <p>¡Te esperamos!</p>
      `;

      await sendEmail(cliente.email, asunto, html); 
      await sendEmail("testgymapi@gmail.com", `Copia confirmación - ${cliente.email}`, html); 
    }

    // Mail de reserva cancelada - Entrenador
    if (nuevoEstado === 'Cancelado' && req.user.role === 'entrenador') {
      const cliente = reserva.cliente;
      const servicio = await Service.findById(reserva.servicio._id).populate('entrenador', 'nombre apellido email');

      const asunto = "❌ Tu reserva fue rechazada";
      const html = `
        <p>Hola ${cliente.nombre},</p>
        <p>Lamentablemente, el entrenador <strong>${servicio.entrenador.nombre} ${servicio.entrenador.apellido}</strong> ha cancelado tu reserva para el servicio <strong>${servicio.titulo}</strong>.</p>
        <p>Podés intentar seleccionar otro horario o reservar otro servicio.</p>
      `;
      
      console.log("✉️ Enviando email por cancelación del entrenador...");
      await sendEmail(cliente.email, asunto, html);
      await sendEmail("testgymapi@gmail.com", `Copia rechazo - ${cliente.email}`, html);
    }

    // Mail de reserva cancelada - Cliente
    if (nuevoEstado === 'Cancelado' && req.user.role === 'cliente') {
      const entrenador = reserva.servicio.entrenador;
      const cliente = reserva.cliente;
      const servicio = reserva.servicio;

      const asunto = "❌ Cancelación de reserva por parte del cliente";
      const html = `
        <p>Hola ${entrenador.nombre},</p>
        <p>El cliente <strong>${cliente.nombre} ${cliente.apellido}</strong> ha cancelado su reserva para el servicio <strong>${servicio.titulo}</strong>.</p>
        <p>Fecha: ${new Date(reserva.fechaInicio).toLocaleString()}</p>
      `;

      console.log("📨 Enviando email de cancelación del cliente a", entrenador.email);

      await sendEmail(entrenador.email, asunto, html);
      await sendEmail("testgymapi@gmail.com", `Copia cancelación - ${cliente.email}`, html);
    }

      // 6️⃣ Devuelvo la reserva ya actualizada
    return res.json(reserva);

  } catch (err) {
    console.error('❌ ERROR /reserve/:id/state:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

router.get('/:id/documentos', authMiddleware, async (req, res) => {
  const reserva = await Reserva.findById(req.params.id);
  if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada.' });
  // Solo el cliente o el entrenador pueden ver
  if (![reserva.cliente.toString(), reserva.entrenador?.toString()].includes(req.user.userId))
    return res.status(403).json({ error: 'No autorizado.' });
  res.json(reserva.documentos || []);
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

// GET /api/reserve/:id/documents/:filename - CON DEBUGGING
router.get('/:id/documents/:filename', authMiddleware, async (req, res) => {
  try {
    const { id, filename } = req.params;
    
    // LOGS DE DEBUGGING
    console.log('🔍 DEBUG Backend - Descarga solicitada:');
    console.log('  - ID Reserva:', id);
    console.log('  - Filename recibido:', filename);
    console.log('  - Filename decodificado:', decodeURIComponent(filename));
    console.log('  - Usuario:', req.user.userId, req.user.role);
    
    const reserva = await Reserva.findById(id).populate('servicio');
    if (!reserva) {
      console.log('❌ Reserva no encontrada');
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    console.log('🔍 DEBUG - Documentos en BD:', reserva.documentos);
    console.log('🔍 DEBUG - Estado reserva:', reserva.estado);

    // Validar rol y propiedad
    const isCliente = req.user.role === 'cliente' && reserva.cliente.toString() === req.user.userId;
    const isEntrenador = req.user.role === 'entrenador' && reserva.servicio.entrenador.toString() === req.user.userId;
    
    if (!isCliente && !isEntrenador) {
      console.log('❌ No autorizado');
      return res.status(403).json({ error: 'No autorizado para descargar documentos' });
    }

    // Solo si está Aceptado o Finalizado
    if (!['Aceptado', 'Finalizado'].includes(reserva.estado)) {
      console.log('❌ Estado no válido:', reserva.estado);
      return res.status(400).json({ error: 'No se puede descargar en el estado actual' });
    }

    // Decodificar el filename por si tiene caracteres especiales
    const decodedFilename = decodeURIComponent(filename);
    console.log('🔍 DEBUG - Buscando filename:', decodedFilename);
    console.log('🔍 DEBUG - ¿Existe en array?:', reserva.documentos.includes(decodedFilename));

    if (!reserva.documentos.includes(decodedFilename)) {
      console.log('❌ Documento no encontrado en reserva');
      console.log('  - Documentos disponibles:', reserva.documentos);
      console.log('  - Filename buscado:', decodedFilename);
      return res.status(404).json({ error: 'Documento no encontrado en esta reserva' });
    }

    const filePath = path.join(UPLOAD_PATH, decodedFilename);
    console.log('🔍 DEBUG - Ruta completa:', filePath);
    console.log('🔍 DEBUG - UPLOAD_PATH:', UPLOAD_PATH);
    
    // Listar archivos en el directorio para debugging
    try {
      const filesInDir = fs.readdirSync(UPLOAD_PATH);
      console.log('🔍 DEBUG - Archivos en directorio:', filesInDir);
      console.log('🔍 DEBUG - ¿Archivo existe?:', fs.existsSync(filePath));
    } catch (dirErr) {
      console.log('❌ Error leyendo directorio:', dirErr.message);
    }
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ Archivo no existe en servidor');
      return res.status(404).json({ error: 'Archivo no existe en el servidor' });
    }

    console.log('✅ Iniciando descarga...');
    
    // Usar el nombre original para la descarga
    const originalName = decodedFilename.split('_').slice(2).join('_') || decodedFilename;
    res.download(filePath, originalName);
    
  } catch (err) {
    console.error('❌ ERROR GET /reserve/:id/documents/:filename:', err);
    res.status(500).json({ error: 'Error al descargar documento' });
  }
});

module.exports = router;