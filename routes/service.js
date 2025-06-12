const Joi = require('joi');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const duration = require('dayjs/plugin/duration'); // Importa el plugin de duración
dayjs.extend(duration); // Extiende dayjs con el plugin de duraciónconst express = require('express');
dayjs.extend(utc);
const express = require('express');
const router = express.Router();
const Service = require('../models/Service');
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');
const diasValidos = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const horaRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const Reserva = require('../models/Reserve');  // Asegúrate de que la ruta sea correcta
const TrainerStats = require('../models/TrainerStats'); // ajustá la ruta si es necesario


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
  categoria: Joi.string().valid('Entrenamiento', 'Nutrición', 'Consultoría').required().messages({
    'string.base': 'La categoría debe ser un texto',
    'any.required': 'La categoría es obligatoria',
    'any.only': 'La categoría debe ser una de: Entrenamiento, Nutrición, Consultoría'
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
router.post('/create', authMiddleware, async (req, res) => {
  if (req.user.role !== 'entrenador') {
    return res.status(403).json({ error: 'Solo los entrenadores pueden crear servicios.' });
  }

  const { error, value } = serviceSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { titulo, descripcion, precio, categoria, duracion, presencial, disponibilidad,vistas } = value;

  try {
    // 0️⃣ Validar que cada bloque cumpla la duración
    for (const [dia, bloques] of Object.entries(disponibilidad)) {
      for (const [inicio, fin] of bloques) {
        const [h1, m1] = inicio.split(':').map(Number);
        const [h2, m2] = fin.split(':').map(Number);
        const minutosInicio = h1 * 60 + m1;
        const minutosFin    = h2 * 60 + m2;
        const diff = minutosFin - minutosInicio;

        if (diff < duracion) {
          return res.status(400).json({
            error: `El bloque en ${dia} de ${inicio} a ${fin} dura ${diff} min, menor a la duración del servicio (${duracion} min).`
          });
        }
        if (diff % duracion !== 0) {
          return res.status(400).json({
            error: `El bloque en ${dia} de ${inicio} a ${fin} no es múltiplo exacto de ${duracion} min (sobran ${diff % duracion} min).`
          });
        }
      }
    }

    // 1️⃣ Verificar solapamiento con otros servicios del mismo entrenador
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

    // 2️⃣ Crear servicio
    const newService = new Service({
      titulo,
      descripcion,
      precio,
      categoria,
      duracion,
      presencial,
      disponibilidad,
      vistas,
      entrenador: req.user.userId
    });

    await newService.save();
    res.status(201).json(newService);

  } catch (err) {
    console.error('❌ Error al crear servicio:', err);
    res.status(500).json({ error: 'Error al crear el servicio.' });
  }
});


router.get('/trainers', async (req, res) => {
  try {

    // === Filtros desde query ===
    const {
      categoria,      // ÚNICA (string)
      presencial,     // 'presencial', 'virtual', o no definido (ambos)
      precioMax,      // number (opcional)
      duracion,       // number (30,45,60,90) - ÚNICO valor
      zona,           // string, barrio (enum en User)
      idioma,         // puede venir como string separado por coma o array
      rating         // número mínimo de rating (1-5)
    } = req.query;

    // ====== Filtro de servicios ======
    let servicioFiltro = {
      publicado: true,
      ...(categoria && { categoria }), // solo uno
      ...(precioMax && { precio: { $lte: parseFloat(precioMax) } }),
      ...(duracion && [30,45,60,90].includes(Number(duracion)) && { duracion: Number(duracion) }),
    };

    // Filtrado presencial/virtual/ambos (campo booleano)
    if (presencial === 'presencial') {
      servicioFiltro.presencial = true;
    } else if (presencial === 'virtual') {
      servicioFiltro.presencial = false;
    }
    // Si no viene presencial, no se filtra (ambos)

    // ====== Buscar servicios ======
    const servicios = await Service.find(servicioFiltro);
    if (servicios.length === 0) {
      return res.json({ entrenadores: [] });
    }
    // IDs de entrenadores
    const idsEntrenadores = [...new Set(servicios.map(s => s.entrenador.toString()))];

    // ====== Filtro de entrenadores ======
    // -- Zona debe ser única y enum, así que solo admitimos si zona es válida --
    const barriosCABA = [
      "Almagro", "Balvanera", "Barracas", "Belgrano", "Boedo",
      "Caballito", "Chacarita", "Coghlan", "Colegiales", "Constitución",
      "Flores", "Floresta", "La Boca", "La Paternal", "Liniers", "Mataderos",
      "Monserrat", "Monte Castro", "Nueva Pompeya", "Nuñez", "Palermo",
      "Parque Avellaneda", "Parque Chacabuco", "Parque Chas", "Parque Patricios",
      "Puerto Madero", "Recoleta", "Retiro", "Saavedra", "San Cristóbal",
      "San Nicolás", "San Telmo", "Vélez Sarsfield", "Versalles", "Villa Crespo",
      "Villa del Parque", "Villa Devoto", "Villa Gral. Mitre", "Villa Lugano",
      "Villa Luro", "Villa Ortúzar", "Villa Pueyrredón", "Villa Real",
      "Villa Riachuelo", "Villa Santa Rita", "Villa Soldati", "Villa Urquiza"
    ];

    let userFiltro = {
      _id: { $in: idsEntrenadores },
      role: 'entrenador',
      ...(zona && barriosCABA.includes(zona) ? { zona } : {}),
    };

    // ====== Idiomas: OR (al menos 1 coincide) ======
    let idiomasFiltro = undefined;
    if (idioma) {
      // Puede venir como string separado por coma o como array
      let idiomasArray = Array.isArray(idioma) ? idioma : idioma.split(',').map(i => i.trim());
      // Solo aceptamos valores válidos
      const idiomasValidos = ["Español", "Inglés", "Portugués"];
      idiomasArray = idiomasArray.filter(idm => idiomasValidos.includes(idm));
      if (idiomasArray.length) {
        userFiltro.idiomas = { $in: idiomasArray };
      }
    }

    // ====== Buscar entrenadores ======
    const entrenadores = await User.find(userFiltro).select('-password');
    
    // === Nuevo bloque: para cada entrenador, traemos sus stats y le agregamos avgRating ===
    const entrenadoresConRating = await Promise.all(
      entrenadores.map(async trainer => {
        // lo pasamos a objeto plano para poder añadirle propiedades
        const obj = trainer.toObject();
        const stats = await TrainerStats.findOne({ entrenador: trainer._id }).lean();
        obj.avgRating    = stats?.avgRating    ?? 0;
        obj.totalRatings = stats?.totalRatings ?? 0;
        return obj;
      })
    );
    
    // Filtrar por rating mínimo si se especificó
    let entrenadoresFiltrados = entrenadoresConRating;
    if (rating && rating !== "") {
      if (rating === "5+") {
        entrenadoresFiltrados = entrenadoresConRating.filter(e => e.avgRating === 5);
      } else {
        const ratingMin = parseInt(rating);
        if (!isNaN(ratingMin) && ratingMin >= 1 && ratingMin <= 5) {
          entrenadoresFiltrados = entrenadoresConRating.filter(e => e.avgRating >= ratingMin);
        }
      }
    }
    res.json({ entrenadores: entrenadoresFiltrados });

  } catch (error) {
    console.error('❌ Error en /trainers:', error);
    res.status(500).json({ error: 'Error al obtener entrenadores' });
  }
});

// Obtener solo la preview de los servicios publicados de un entrenador
router.get('/trainer/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Trae solo los campos básicos (preview)
    const servicios = await Service.find({
      entrenador: id,
      publicado: true
    }).select('titulo precio categoria duracion presencial');

    res.json({ servicios });
  } catch (err) {
    console.error('❌ Error al obtener servicios:', err);
    res.status(500).json({ error: 'Error al obtener servicios del entrenador' });
  }
});

// 3️⃣ Listar todos los servicios de un trainer (solo trainer)
router.get('/my', authMiddleware, async (req, res) => {
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
    // Incrementar el contador de vistas
    await Service.findByIdAndUpdate(req.params.id, { $inc: { vistas: 1 } });

    // Buscar y devolver el servicio actualizado (sin esperar a que se actualicen las vistas en el doc retornado)
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
router.patch('/:id/publish', authMiddleware, async (req, res) => {
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

// Mapeo de días de la semana de inglés a español
const traduccionDias = {
  'Monday': 'Lunes',
  'Tuesday': 'Martes',
  'Wednesday': 'Miércoles',
  'Thursday': 'Jueves',
  'Friday': 'Viernes',
  'Saturday': 'Sábado',
  'Sunday': 'Domingo'
};

// Función para generar bloques horarios
function generarBloques(inicio, fin, duracionMin) {
  const formato = 'HH:mm';
  const bloques = [];
  
  let actual = dayjs(`2025-01-01T${inicio}`);
  const final = dayjs(`2025-01-01T${fin}`);
  
  const duracion = dayjs.duration(duracionMin, 'minutes'); // Duración de los bloques

  // Generamos bloques de tiempo mientras 'actual' no pase del 'final'
  while (actual.add(duracion).isBefore(final) || actual.isSame(final)) {
    bloques.push(actual.format(formato));  // Agrega el bloque de horario formateado
    
    // Avanza a la siguiente hora
    actual = actual.add(duracion);
  }
  // No agregamos el último bloque si es igual a la hora final
  if (actual.format(formato) !== final.format(formato)) {
    bloques.push(actual.format(formato));
  }

  return bloques;
}

// Ruta para obtener disponibilidad real
router.get('/:id/real-availability', async (req, res) => {
  try {
    const { fecha } = req.query;
    console.log("Fecha recibida:", fecha);  // Verifica la fecha recibida

    // VALIDACIÓN DE FECHA PASADA
    const hoy = dayjs().utc().startOf('day');
    const diaConsulta = dayjs(fecha).utc().startOf('day'); // chequeas que la fecha no sea anterior a hoy
    if (diaConsulta.isBefore(hoy)) {
      return res.status(400).json({ error: 'No se puede consultar disponibilidad para fechas pasadas.' });
    }

    const servicio = await Service.findById(req.params.id); //Agarras el ID del servicio desde la URL y lo buscas
    if (!servicio) return res.status(404).json({ error: 'Servicio no encontrado' });

    // Obtener el nombre del día en español
    const diaSemana = dayjs(fecha).format('dddd'); // Día en inglés
    const nombreDia = traduccionDias[diaSemana];  // Traducción al español

    console.log("Día formateado:", nombreDia);
    console.log("Disponibilidad del servicio:", servicio.disponibilidad);

    // Obtener las franjas de ese día
    const franjas = servicio.disponibilidad.get(nombreDia); 
    console.log("Franjas para el día:", franjas); //Esto es simplemente la disponibilidad del servicio, que es un Map

    if (!franjas || franjas.length === 0) return res.json([]);

    let bloquesTotales = [];
    for (let [inicio, fin] of franjas) {
      bloquesTotales.push(...generarBloques(inicio, fin, servicio.duracion));
    }

    console.log("Bloques totales generados:", bloquesTotales);

    // Buscas las reservas del servicio en la fecha indicada
    const reservas = await Reserva.find({
      servicio: servicio._id,
      fechaInicio: { 
        $gte: dayjs(`${fecha}T00:00:00.000Z`).utc().toDate(), 
        $lt: dayjs(`${fecha}T23:59:59.999Z`).utc().toDate()
      },
      estado: { $nin: ['Cancelado', 'Finalizado'] }  // Excluir reservas con estado "Cancelado" o "Finalizado"
    });

    // Obtener las horas de inicio de las reservas (solo la hora)
    const horariosReservados = reservas.map(r => dayjs(r.fechaInicio).utc().format('HH:mm'));
    console.log("Horarios reservados:", horariosReservados);

    // Filtrar los bloques disponibles, excluyendo los reservados en base a su fechaInicio
    const disponibles = bloquesTotales.filter(bloque => !horariosReservados.includes(bloque));
    console.log("Bloques disponibles después de filtrar:", disponibles);

    res.json(disponibles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener disponibilidad real.' });
  }
});

module.exports = router;
