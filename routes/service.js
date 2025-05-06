const Joi = require('joi');
const express = require('express');
const router = express.Router();
const Service = require('../models/Service');
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');
const diasValidos = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const horaRegex = /^([01]\d|2[0-3]):[0-5]\d$/;


// 🔸 Joi Schema
const disponibilidadSchema = Joi.object().pattern(
  Joi.string().valid(...diasValidos),
  Joi.array().items(
    Joi.array().ordered(
      Joi.string().pattern(horaRegex).required(),
      Joi.string().pattern(horaRegex).required()
    ).length(2)
  )
);

// Esquema de validación para crear/actualizar un servicio
const serviceSchema = Joi.object({
  titulo: Joi.string().min(3).required().messages({
    'string.base': 'El título debe ser un texto',
    'string.min': 'El título debe tener al menos 3 caracteres',
    'any.required': 'El título es obligatorio'
  }),
  descripcion: Joi.string().min(5).required().messages({
    'string.base': 'La descripción debe ser un texto',
    'string.min': 'La descripción debe tener al menos 5 caracteres',
    'any.required': 'La descripción es obligatoria'
  }),
  precio: Joi.number().positive().required().messages({
    'number.base': 'El precio debe ser un número',
    'number.positive': 'El precio debe ser positivo',
    'any.required': 'El precio es obligatorio'
  }),
  categoria: Joi.string().valid('Entrenamiento', 'Nutrición', 'Bienestar').required().messages({
    'string.base': 'La categoría debe ser un texto',
    'any.required': 'La categoría es obligatoria',
    'any.only': 'La categoría debe ser una de: Entrenamiento, Nutrición, Bienestar'
  }),
  duracion: Joi.number().positive().required().messages({
    'number.base': 'La duración debe ser un número',
    'number.positive': 'La duración debe ser positiva',
    'any.required': 'La duración es obligatoria'
  }),
  presencial: Joi.boolean().required().messages({
    'boolean.base': 'El campo presencial debe ser verdadero o falso',
    'any.required': 'Debe indicarse si el servicio es presencial o no'
  }),
  disponibilidad: disponibilidadSchema.required()
});


// 🔸 Utilidades para comparar horarios
function horaToMinutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

function rangosSolapan(inicio1, fin1, inicio2, fin2) {
  return horaToMinutos(inicio1) < horaToMinutos(fin2) &&
         horaToMinutos(fin1) > horaToMinutos(inicio2);
}

// 1️⃣ Crear un nuevo servicio (solo entrenadores)
router.post('/crear', authMiddleware, async (req, res) => {
  if (req.user.role !== 'entrenador') {
    return res.status(403).json({ error: 'Solo los entrenadores pueden crear servicios.' });
  }

  const { error, value } = serviceSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { titulo, descripcion, precio, categoria, duracion, presencial, disponibilidad } = value;

  try {
    // Verificar solapamiento con otros servicios del mismo entrenador
    const otrosServicios = await Service.find({ entrenador: req.user.userId });

    for (const otro of otrosServicios) {
      for (const [dia, bloquesNuevo] of Object.entries(disponibilidad)) {
        const bloquesExistentes = otro.disponibilidad?.get(dia) || [];

        for (const [nuevoInicio, nuevoFin] of bloquesNuevo) {
          for (const [existenteInicio, existenteFin] of bloquesExistentes) {
            if (rangosSolapan(nuevoInicio, nuevoFin, existenteInicio, existenteFin)) {
              return res.status(400).json({
                error: `Conflicto: Ya tenés un servicio el ${dia} entre ${existenteInicio} y ${existenteFin}`
              });
            }
          }
        }
      }
    }

    // Crear servicio
    const newService = new Service({
      titulo,
      descripcion,
      precio,
      categoria,
      duracion,
      presencial,
      disponibilidad,
      entrenador: req.user.userId
    });

    await newService.save();
    res.status(201).json(newService);

  } catch (err) {
    console.error('❌ Error al crear servicio:', err);
    res.status(500).json({ error: 'Error al crear el servicio.' });
  }
});


// GET /api/entrenadores -> Listar entrenadores por filtros 
router.get('/entrenadores', async (req, res) => {
  try {
    const {
      categoria,
      presencial,
      precioMin,
      precioMax,
      duracionMin,
      duracionMax,
      zona,
      idioma
    } = req.query;

    // Paso 1: Filtro de servicios (si hay filtros de servicio)
    const servicioFiltro = {
      publicado : true,
      ...(categoria && { categoria }),
      ...(presencial !== undefined && { presencial: presencial === 'true' }),
      ...(precioMin && { precio: { $gte: parseFloat(precioMin) } }),
      ...(precioMax && {
        precio: {
          ...(precioMin ? { $gte: parseFloat(precioMin) } : {}),
          $lte: parseFloat(precioMax)
        }
      }),
      ...(duracionMin && { duracion: { $gte: parseInt(duracionMin) } }),
      ...(duracionMax && {
        duracion: {
          ...(duracionMin ? { $gte: parseInt(duracionMin) } : {}),
          $lte: parseInt(duracionMax)
        }
      })
    };

    // Paso 2: Buscar servicios que coincidan con el filtro
    const servicios = await Service.find(servicioFiltro);
    console.log('⏺️ Servicios encontrados:', servicios.length);
    if (servicios.length === 0) {
      return res.json({ entrenadores: [] });
    }

    // Paso 3: Obtener IDs de entrenadores asociados a esos servicios
    const idsEntrenadores = [...new Set(servicios.map(s => s.entrenador.toString()))];
    console.log('⏺️ IDs de entrenadores:', idsEntrenadores);

    // Paso 4: Filtro de entrenadores (si hay filtros de entrenadores)
    const userFiltro = {
      _id: { $in: idsEntrenadores },
      role: 'entrenador',
      ...(zona && { zona }),
      ...(idioma && { idiomas: idioma })
    };

    // Paso 5: Buscar entrenadores que coincidan con el filtro
    const entrenadores = await User.find(userFiltro).select('-password');
    console.log('⏺️ Entrenadores encontrados:', entrenadores.length);

    // Paso 6: Devolver entrenadores
    res.json({ entrenadores });
  } catch (error) {
    console.error('❌ Error en /entrenadores:', error);
    res.status(500).json({ error: 'Error al obtener entrenadores' });
  }
});


// Obtener los servicios publicados de un entrenador por ID 
router.get('/entrenador/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const servicios = await Service.find({
      entrenador: id,
      publicado: true
    });

    res.json({ servicios });
  } catch (err) {
    console.error('❌ Error al obtener servicios:', err);
    res.status(500).json({ error: 'Error al obtener servicios del entrenador' });
  }
});




// 3️⃣ Listar todos los servicios de un trainer (solo trainer)
router.get('/mis', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'entrenador') {
      return res.status(403).json({ error: 'Solo los entrenadores pueden ver sus servicios.' });
    }

    const servicios = await Service.find({
      entrenador: req.user.userId
    });

    res.json(servicios);
  } catch (err) {
    console.error('❌ Error al obtener servicios del entrenador:', err);
    res.status(500).json({ msg: 'Error al traer tus servicios' });
  }
});


// 4️⃣ Detalle de un servicio por ID (público)
router.get('/:id', async (req, res) => {
  try {
    const servicio = await Service.findById(req.params.id)
      .populate('entrenador', 'nombre apellido email');
    if (!servicio) return res.status(404).json({ error: 'Servicio no encontrado' });
    res.json(servicio);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener el servicio' });
  }
});

// 5️⃣ Actualizar un servicio (solo dueño)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const servicio = await Service.findById(req.params.id);
    if (!servicio) return res.status(404).json({ error: 'No existe el servicio' });
    if (servicio.entrenador.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Validar body en actualización también
    const { error, value } = serviceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    Object.assign(servicio, value); // incluye duracion
    await servicio.save();
    res.json(servicio);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar servicio' });
  }
});

// 6️⃣ Eliminar un servicio (solo dueño)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const servicio = await Service.findById(req.params.id);
    if (!servicio) return res.status(404).json({ error: 'No existe el servicio' });
    if (servicio.entrenador.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    await Service.findByIdAndDelete(req.params.id);
    res.json({ message: 'Servicio eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar servicio' });
  }
});

// 7️⃣ Publicar/despublicar
router.patch('/:id/publicar', authMiddleware, async (req, res) => {
  try {
    const servicio = await Service.findById(req.params.id);
    if (!servicio) return res.status(404).json({ msg: 'Servicio no encontrado' });
    if (servicio.entrenador.toString() !== req.user.userId) {
      return res.status(403).json({ msg: 'No autorizado' });
    }
    servicio.publicado = !servicio.publicado;
    await servicio.save();
    res.json({ msg: `Servicio ${servicio.publicado ? 'publicado' : 'despublicado'}` });
  } catch (err) {
    res.status(500).json({ msg: 'Error del servidor' });
  }
});

module.exports = router;
