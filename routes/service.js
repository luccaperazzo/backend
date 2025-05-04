const Joi = require('joi');
const express = require('express');
const router = express.Router();
const Service = require('../models/Service');
const authMiddleware = require('../middleware/authMiddleware');

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
  })
});

// 1️⃣ Crear un nuevo servicio (solo entrenadores)
router.post('/crear', authMiddleware, async (req, res) => {
  if (req.user.role !== 'entrenador') {
    return res.status(403).json({ error: 'No autorizado. Solo entrenadores pueden crear servicios.' });
  }

  // Validación con Joi
  const { error, value } = serviceSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { titulo, descripcion, precio, categoria, duracion } = value;

  try {
    const newService = new Service({
      titulo,
      descripcion,
      precio,
      categoria,
      duracion,           // <-- guardamos duración definida por entrenador
      entrenador: req.user.userId
    });
    await newService.save();
    res.status(201).json(newService);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear el servicio.' });
  }
});

// 2️⃣ Búsqueda con query params
router.get('/buscar', async (req, res) => {
  try {
    const { categoria, precioMin, precioMax } = req.query;
    const filtro = {};
    if (categoria) filtro.categoria = categoria;
    if (precioMin) filtro.precio = { ...filtro.precio, $gte: Number(precioMin) };
    if (precioMax) filtro.precio = { ...filtro.precio, $lte: Number(precioMax) };

    const resultados = await Service.find(filtro).populate('entrenador', 'nombre');
    res.json(resultados);
  } catch (err) {
    res.status(500).json({ error: 'Error en la búsqueda' });
  }
});

// 3️⃣ Listar todos los servicios (público)
router.get('/', async (req, res) => {
  try {
    const servicios = await Service.find({ publicado: true }).populate('entrenador');
    res.json(servicios);
  } catch (err) {
    res.status(500).json({ msg: 'Error al traer los servicios' });
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
