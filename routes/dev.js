// Ruta para poblar la base de datos con datos de prueba solo si está vacía
const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Trainer = require('../models/TrainerStats');
const Service = require('../models/Service');
const Rating = require('../models/Rating');
const Reserve = require('../models/Reserve');

// Puedes ajustar estos datos de ejemplo según tus modelos
const usersSeed = [
  { nombre: 'Juan', apellido: 'Pérez', email: 'juan@test.com', password: 'Test1234!', role: 'cliente', fechaNacimiento: new Date('1990-01-01') },
  { nombre: 'Ana', apellido: 'García', email: 'ana@test.com', password: 'Test1234!', role: 'cliente', fechaNacimiento: new Date('1992-05-10') }
];

const trainersSeed = [
  { 
    nombre: 'Carlos', 
    apellido: 'López', 
    email: 'carlos@test.com', 
    password: 'Test1234!', 
    role: 'entrenador', 
    presentacion: 'Entrenador personal con 8 años de experiencia en fitness y transformación corporal. Especializado en rutinas de alta intensidad.', 
    zona: 'Palermo', 
    idiomas: ['Español', 'Inglés'], 
    fechaNacimiento: new Date('1985-03-15'), 
    avatarUrl: 'https://media.istockphoto.com/id/1136449221/photo/fitness-trainer-portrait-in-the-gym.jpg?s=612x612&w=0&k=20&c=AOkQClzQO8n-TdIwDlep5p4TYBToAW3G2vE5luRdC-U=' 
  },
  { 
    nombre: 'Lucía', 
    apellido: 'Martínez', 
    email: 'lucia@test.com', 
    password: 'Test1234!', 
    role: 'entrenador', 
    presentacion: 'Nutricionista deportiva certificada con enfoque en alimentación consciente y planes personalizados para cada objetivo.', 
    zona: 'Palermo', 
    idiomas: ['Español','Portugués'], 
    fechaNacimiento: new Date('1988-07-22'), 
    avatarUrl: 'https://media.istockphoto.com/id/856797530/photo/portrait-of-a-beautiful-woman-at-the-gym.jpg?s=612x612&w=0&k=20&c=0wMa1MYxt6HHamjd66d5__XGAKbJFDFQyu9LCloRsYU=' 
  },  { 
    nombre: 'Miguel', 
    apellido: 'González', 
    email: 'miguel@test.com', 
    password: 'Test1234!', 
    role: 'entrenador', 
    presentacion: 'Coach de CrossFit nivel 2 y especialista en preparación para competencias. Enfoque en fuerza funcional y resistencia.', 
    zona: 'Villa Crespo', 
    idiomas: ['Español', 'Inglés', 'Portugués'], 
    fechaNacimiento: new Date('1990-11-08'), 
    avatarUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop&crop=face'
  },  { 
    nombre: 'Sofía', 
    apellido: 'Ramírez', 
    email: 'sofia@test.com', 
    password: 'Test1234!', 
    role: 'entrenador', 
    presentacion: 'Instructora de yoga y pilates con formación en anatomía. Clases virtuales y presenciales enfocadas en flexibilidad y mindfulness.', 
    zona: 'Recoleta', 
    idiomas: ['Español'], 
    fechaNacimiento: new Date('1992-04-18'), 
    avatarUrl: 'https://images.unsplash.com/photo-1550345332-09e3ac987658?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
  },  { 
    nombre: 'Diego', 
    apellido: 'Fernández', 
    email: 'diego@test.com', 
    password: 'Test1234!', 
    role: 'entrenador', 
    presentacion: 'Entrenador especializado en rehabilitación deportiva y kinesiología. Trabajo con atletas de alto rendimiento y lesiones.', 
    zona: 'Caballito', 
    idiomas: ['Español', 'Inglés'], 
    fechaNacimiento: new Date('1987-09-12'), 
    avatarUrl: 'https://images.unsplash.com/photo-1611672585731-fa10603fb9e0?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
  },  { 
    nombre: 'Valentina', 
    apellido: 'Torres', 
    email: 'valentina@test.com', 
    password: 'Test1234!', 
    role: 'entrenador', 
    presentacion: 'Personal trainer y consultora en hábitos saludables. Me especializo en entrenamientos para mujeres y programas de bienestar integral.', 
    zona: 'San Telmo', 
    idiomas: ['Español', 'Portugués'], 
    fechaNacimiento: new Date('1991-06-25'), 
    avatarUrl: 'https://plus.unsplash.com/premium_photo-1661284907384-759dc6530470?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
  },  { 
    nombre: 'Roberto', 
    apellido: 'Silva', 
    email: 'roberto@test.com', 
    password: 'Test1234!', 
    role: 'entrenador', 
    presentacion: 'Coach nutricional con 15 años de experiencia. Planes de alimentación personalizados y seguimiento integral para pérdida de peso.', 
    zona: 'Barracas', 
    idiomas: ['Español'], 
    fechaNacimiento: new Date('1978-01-30'), 
    avatarUrl: 'https://images.unsplash.com/photo-1696564006617-1a85ba3a8f3e?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
  },  { 
    nombre: 'Camila', 
    apellido: 'Herrera', 
    email: 'camila@test.com', 
    password: 'Test1234!', 
    role: 'entrenador', 
    presentacion: 'Entrenadora funcional certificada en TRX y kettlebells. Sesiones dinámicas para mejorar fuerza, coordinación y resistencia cardiovascular.', 
    zona: 'Villa Urquiza', 
    idiomas: ['Español', 'Inglés'], 
    fechaNacimiento: new Date('1989-12-03'), 
    avatarUrl: 'https://images.unsplash.com/photo-1548690312-e3b507d8c110?w=400&h=400&fit=crop&crop=face'
  },  { 
    nombre: 'Andrés', 
    apellido: 'Morales', 
    email: 'andres@test.com', 
    password: 'Test1234!', 
    role: 'entrenador', 
    presentacion: 'Especialista en running y maratones. Preparación para carreras de 5K a 42K con planes de entrenamiento progresivos y técnica de carrera.', 
    zona: 'Núñez', 
    idiomas: ['Español', 'Inglés'], 
    fechaNacimiento: new Date('1986-08-14'), 
    avatarUrl: 'https://images.unsplash.com/photo-1667890787288-ecaaa4bc6994?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
  },{ 
    nombre: 'Julieta', 
    apellido: 'Vargas', 
    email: 'julieta@test.com', 
    password: 'Test1234!', 
    role: 'entrenador', 
    presentacion: 'Consultora en wellness y coaching de vida saludable. Combino entrenamiento físico con técnicas de mindfulness y gestión del estrés.', 
    zona: 'Colegiales', 
    idiomas: ['Español', 'Inglés', 'Portugués'], 
    fechaNacimiento: new Date('1993-02-28'), 
    avatarUrl: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=400&fit=crop&crop=face'
  }
];

const servicesSeed = [
  // Servicios de Carlos (Entrenamiento personal y fitness)
  { 
    titulo: 'Entrenamiento Funcional Intensivo',
    descripcion: 'Sesión de entrenamiento funcional de alta intensidad para mejorar fuerza y resistencia cardiovascular',
    precio: 4500,
    categoria: 'Entrenamiento',
    entrenadorEmail: 'carlos@test.com',
    duracion: 60,
    presencial: 'presencial',
    disponibilidad: {
      Lunes: ['08:00', '12:00'],
      Martes: ['08:00', '12:00'],
      Miércoles: ['08:00', '12:00'],
      Jueves: ['08:00', '12:00'],
      Viernes: ['08:00', '12:00'],
      Sábado: ['09:00', '13:00'],
    }
  },
  { 
    titulo: 'Transformación Corporal 90 días',
    descripcion: 'Programa integral de transformación corporal con seguimiento personalizado',
    precio: 8000,
    categoria: 'Consultoría',
    entrenadorEmail: 'carlos@test.com',
    duracion: 90,
    presencial: 'presencial',
    disponibilidad: {
      Lunes: ['14:00', '18:00'],
      Miércoles: ['14:00', '18:00'],
      Viernes: ['14:00', '18:00']
    }
  },
  // Servicios de Lucía (Nutrición)
  {
    titulo: 'Consulta Nutricional Inicial',
    descripcion: 'Evaluación nutricional completa con plan de alimentación personalizado',
    precio: 3500,
    categoria: 'Nutrición',
    entrenadorEmail: 'lucia@test.com',
    duracion: 45,
    presencial: 'virtual',
    disponibilidad: {
      Lunes: ['09:00', '13:00'],
      Martes: ['09:00', '13:00'],
      Miércoles: ['09:00', '13:00'],
      Jueves: ['09:00', '13:00'],
      Viernes: ['09:00', '13:00'],
    }
  },
  {
    titulo: 'Seguimiento Nutricional Mensual',
    descripcion: 'Seguimiento y ajuste de plan nutricional con análisis de progreso',
    precio: 2500,
    categoria: 'Nutrición',
    entrenadorEmail: 'lucia@test.com',
    duracion: 30,
    presencial: 'virtual',
    disponibilidad: {
      Lunes: ['15:00', '18:00'],
      Miércoles: ['15:00', '18:00'],
      Viernes: ['15:00', '18:00']
    }
  },
  // Servicios de Miguel (CrossFit)
  {
    titulo: 'Entrenamiento CrossFit',
    descripcion: 'Clase de CrossFit adaptada a tu nivel con técnica y acondicionamiento',
    precio: 3000,
    categoria: 'Entrenamiento',
    entrenadorEmail: 'miguel@test.com',
    duracion: 60,
    presencial: 'presencial',
    disponibilidad: {
      Lunes: ['06:00', '10:00'],
      Martes: ['06:00', '10:00'],
      Miércoles: ['06:00', '10:00'],
      Jueves: ['06:00', '10:00'],
      Viernes: ['06:00', '10:00'],
      Sábado: ['08:00', '12:00'],
    }
  },
  {
    titulo: 'Preparación para Competencias',
    descripcion: 'Entrenamiento especializado para competencias de CrossFit y fitness',
    precio: 6000,
    categoria: 'Consultoría',
    entrenadorEmail: 'miguel@test.com',
    duracion: 90,
    presencial: 'presencial',
    disponibilidad: {
      Martes: ['18:00', '21:00'],
      Jueves: ['18:00', '21:00'],
      Sábado: ['14:00', '17:00']
    }
  },
  // Servicios de Sofía (Yoga y Pilates)
  {
    titulo: 'Clase de Yoga Hatha',
    descripcion: 'Práctica de yoga enfocada en posturas, respiración y relajación',
    precio: 2200,
    categoria: 'Entrenamiento',
    entrenadorEmail: 'sofia@test.com',
    duracion: 60,
    presencial: 'virtual',
    disponibilidad: {
      Lunes: ['07:00', '11:00'],
      Martes: ['07:00', '11:00'],
      Miércoles: ['07:00', '11:00'],
      Jueves: ['07:00', '11:00'],
      Viernes: ['07:00', '11:00'],
      Domingo: ['09:00', '13:00']
    }
  },
  {
    titulo: 'Pilates Reformer',
    descripcion: 'Clase de pilates con equipamiento especializado para fortalecimiento',
    precio: 3200,
    categoria: 'Entrenamiento',
    entrenadorEmail: 'sofia@test.com',
    duracion: 45,
    presencial: 'presencial',
    disponibilidad: {
      Martes: ['15:00', '18:00'],
      Jueves: ['15:00', '18:00'],
      Sábado: ['09:00', '13:00']
    }
  },

  // Servicios de Diego (Rehabilitación)
  {
    titulo: 'Rehabilitación Deportiva',
    descripcion: 'Sesión de rehabilitación para lesiones deportivas y prevención',
    precio: 4000,
    categoria: 'Consultoría',
    entrenadorEmail: 'diego@test.com',
    duracion: 60,
    presencial: 'presencial',
    disponibilidad: {
      Lunes: ['08:00', '18:00'],
      Martes: ['08:00', '18:00'],
      Miércoles: ['08:00', '18:00'],
      Jueves: ['08:00', '18:00'],
      Viernes: ['08:00', '16:00']
    }
  },

  // Servicios de Valentina (Training femenino)
  {
    titulo: 'Entrenamiento Femenino Personalizado',
    descripcion: 'Rutinas diseñadas específicamente para objetivos femeninos',
    precio: 3800,
    categoria: 'Entrenamiento',
    entrenadorEmail: 'valentina@test.com',
    duracion: 60,
    presencial: 'presencial',
    disponibilidad: {
      Lunes: ['09:00', '13:00'],
      Miércoles: ['09:00', '13:00'],
      Viernes: ['09:00', '13:00'],
      Sábado: ['10:00', '14:00']
    }
  },  {
    titulo: 'Programa de Bienestar Integral',
    descripcion: 'Combinación de ejercicio, nutrición y mindfulness para bienestar total',
    precio: 5500,
    categoria: 'Consultoría',
    entrenadorEmail: 'valentina@test.com',
    duracion: 90,
    presencial: 'virtual',
    disponibilidad: {
      Martes: ['15:00', '18:00'],
      Jueves: ['15:00', '18:00']
    }
  },

  // Servicios de Roberto (Nutrición)
  {
    titulo: 'Plan de Pérdida de Peso',
    descripcion: 'Programa nutricional estructurado para pérdida de peso saludable',
    precio: 4200,
    categoria: 'Nutrición',
    entrenadorEmail: 'roberto@test.com',
    duracion: 60,
    presencial: 'virtual',
    disponibilidad: {
      Lunes: ['10:00', '18:00'],
      Martes: ['10:00', '18:00'],
      Miércoles: ['10:00', '18:00'],
      Jueves: ['10:00', '18:00'],
      Viernes: ['10:00', '16:00']
    }
  },
  // Servicios de Camila (Entrenamiento funcional)
  {
    titulo: 'Entrenamiento con TRX',
    descripcion: 'Rutina de entrenamiento en suspensión para fuerza y estabilidad',
    precio: 3300,
    categoria: 'Entrenamiento',
    entrenadorEmail: 'camila@test.com',
    duracion: 45,
    presencial: 'presencial',
    disponibilidad: {
      Lunes: ['07:00', '12:00'],
      Martes: ['07:00', '12:00'],
      Miércoles: ['07:00', '12:00'],
      Jueves: ['07:00', '12:00'],
      Viernes: ['07:00', '12:00'],
      Sábado: ['08:00', '12:00']
    }
  },
  {
    titulo: 'Kettlebell Training',
    descripcion: 'Entrenamiento con kettlebells para fuerza funcional y resistencia',
    precio: 3500,
    categoria: 'Entrenamiento',
    entrenadorEmail: 'camila@test.com',
    duracion: 60,
    presencial: 'presencial',
    disponibilidad: {
      Martes: ['15:00', '19:00'],
      Jueves: ['15:00', '19:00'],
      Sábado: ['14:00', '18:00']
    }
  },
  // Servicios de Andrés (Running)
  {
    titulo: 'Entrenamiento de Running',
    descripcion: 'Sesión de técnica de carrera y entrenamiento para corredores',
    precio: 2800,
    categoria: 'Entrenamiento',
    entrenadorEmail: 'andres@test.com',
    duracion: 60,
    presencial: 'presencial',
    disponibilidad: {
      Lunes: ['06:00', '12:00'],
      Martes: ['06:00', '12:00'],
      Miércoles: ['06:00', '12:00'],
      Jueves: ['06:00', '12:00'],
      Viernes: ['06:00', '12:00'],
      Sábado: ['07:00', '11:00'],
      Domingo: ['07:00', '11:00']
    }
  },
  {
    titulo: 'Preparación para Maratón',
    descripcion: 'Plan de entrenamiento completo para preparación de maratón 42K',
    precio: 7500,
    categoria: 'Consultoría',
    entrenadorEmail: 'andres@test.com',
    duracion: 90,
    presencial: 'virtual',
    disponibilidad: {
      Lunes: ['18:00', '21:00'],
      Miércoles: ['18:00', '21:00'],
      Viernes: ['18:00', '21:00']
    }
  },
  // Servicios de Julieta (Wellness)
  {
    titulo: 'Coaching de Vida Saludable',
    descripcion: 'Sesión de coaching para desarrollar hábitos saludables duraderos',
    precio: 4800,
    categoria: 'Consultoría',
    entrenadorEmail: 'julieta@test.com',
    duracion: 60,
    presencial: 'virtual',
    disponibilidad: {
      Lunes: ['10:00', '16:00'],
      Martes: ['14:00', '18:00'],
      Miércoles: ['10:00', '16:00'],
      Jueves: ['14:00', '18:00'],
      Viernes: ['10:00', '16:00']
    }
  },
  {
    titulo: 'Mindfulness y Ejercicio',
    descripcion: 'Combinación de técnicas de mindfulness con movimiento consciente',
    precio: 3600,
    categoria: 'Entrenamiento',
    entrenadorEmail: 'julieta@test.com',
    duracion: 45,
    presencial: 'virtual',
    disponibilidad: {
      Martes: ['08:00', '12:00'],
      Jueves: ['08:00', '12:00'],
      Sábado: ['09:00', '13:00'],
      Domingo: ['09:00', '13:00']
    }
  }
];

router.post('/seed', async (req, res) => {
  try {
    console.log('🌱 Iniciando proceso de seeding...');
    
    const userCount = await User.countDocuments();
    const trainerCount = await Trainer.countDocuments();
    const serviceCount = await Service.countDocuments();

    if (userCount > 0 || trainerCount > 0 || serviceCount > 0) {
      return res.status(400).json({ message: 'La base de datos ya tiene datos.' });
    }

    console.log('✅ Base de datos vacía, procediendo con seeding...');

    // Crear usuarios (clientes y entrenadores) uno por uno para que se encripte la contraseña
    const allUsers = usersSeed.concat(trainersSeed);
    const createdUsers = [];
    
    console.log(`📝 Creando ${allUsers.length} usuarios...`);
    for (const userData of allUsers) {
      try {
        const user = new User(userData);
        await user.save();
        createdUsers.push(user);
        console.log(`✅ Usuario creado: ${userData.email}`);
      } catch (userError) {
        console.error(`❌ Error creando usuario ${userData.email}:`, userError.message);
        throw userError;
      }
    }

    // Filtrar los usuarios que son entrenadores
    const entrenadoresUsuarios = createdUsers.filter(u => u.role === 'entrenador');
    console.log(`👨‍💼 Encontrados ${entrenadoresUsuarios.length} entrenadores`);

    // Crear TrainerStats para cada entrenador con valores más variados y realistas
    console.log('📊 Creando estadísticas de entrenadores...');
    const trainerStatsDocs = entrenadoresUsuarios.map((u, index) => {
      // Diferentes perfiles de ratings según el entrenador
      let totalRatings, avgRating, ratingCounts;
      
      switch(index) {
        case 0: // Carlos - muy popular
          totalRatings = Math.floor(Math.random() * 20) + 35; // 35-55 ratings
          avgRating = (Math.random() * 0.5 + 4.3).toFixed(1); // 4.3-4.8
          break;
        case 1: // Lucía - establecida
          totalRatings = Math.floor(Math.random() * 15) + 25; // 25-40 ratings
          avgRating = (Math.random() * 0.4 + 4.1).toFixed(1); // 4.1-4.5
          break;
        case 2: // Miguel - nuevo pero bueno
          totalRatings = Math.floor(Math.random() * 10) + 8; // 8-18 ratings
          avgRating = (Math.random() * 0.6 + 4.0).toFixed(1); // 4.0-4.6
          break;
        case 3: // Sofía - especializada
          totalRatings = Math.floor(Math.random() * 12) + 15; // 15-27 ratings
          avgRating = (Math.random() * 0.5 + 4.2).toFixed(1); // 4.2-4.7
          break;
        case 4: // Diego - nicho especializado
          totalRatings = Math.floor(Math.random() * 8) + 12; // 12-20 ratings
          avgRating = (Math.random() * 0.4 + 4.4).toFixed(1); // 4.4-4.8
          break;
        case 5: // Valentina - creciendo
          totalRatings = Math.floor(Math.random() * 12) + 10; // 10-22 ratings
          avgRating = (Math.random() * 0.5 + 3.9).toFixed(1); // 3.9-4.4
          break;
        case 6: // Roberto - experimentado
          totalRatings = Math.floor(Math.random() * 25) + 30; // 30-55 ratings
          avgRating = (Math.random() * 0.3 + 4.0).toFixed(1); // 4.0-4.3
          break;
        case 7: // Camila - moderna
          totalRatings = Math.floor(Math.random() * 10) + 18; // 18-28 ratings
          avgRating = (Math.random() * 0.6 + 4.1).toFixed(1); // 4.1-4.7
          break;
        case 8: // Andrés - especialista running
          totalRatings = Math.floor(Math.random() * 8) + 14; // 14-22 ratings
          avgRating = (Math.random() * 0.4 + 4.3).toFixed(1); // 4.3-4.7
          break;
        case 9: // Julieta - wellness coach
          totalRatings = Math.floor(Math.random() * 6) + 7; // 7-13 ratings
          avgRating = (Math.random() * 0.5 + 4.2).toFixed(1); // 4.2-4.7
          break;
        default:
          totalRatings = Math.floor(Math.random() * 20) + 10;
          avgRating = (Math.random() * 1.0 + 3.5).toFixed(1);
      }

      // Distribución más realista de ratings basada en el promedio
      const avgNum = parseFloat(avgRating);
      ratingCounts = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
      
      if (avgNum >= 4.5) {
        // Entrenador excelente - mayoría 5 y 4 estrellas
        ratingCounts['5'] = Math.floor(totalRatings * 0.7);
        ratingCounts['4'] = Math.floor(totalRatings * 0.25);
        ratingCounts['3'] = Math.floor(totalRatings * 0.04);
        ratingCounts['2'] = Math.floor(totalRatings * 0.01);
        ratingCounts['1'] = totalRatings - (ratingCounts['5'] + ratingCounts['4'] + ratingCounts['3'] + ratingCounts['2']);
      } else if (avgNum >= 4.0) {
        // Entrenador bueno - mayoría 4 y 5 estrellas
        ratingCounts['5'] = Math.floor(totalRatings * 0.5);
        ratingCounts['4'] = Math.floor(totalRatings * 0.35);
        ratingCounts['3'] = Math.floor(totalRatings * 0.12);
        ratingCounts['2'] = Math.floor(totalRatings * 0.02);
        ratingCounts['1'] = totalRatings - (ratingCounts['5'] + ratingCounts['4'] + ratingCounts['3'] + ratingCounts['2']);
      } else {
        // Entrenador promedio - distribución más variada
        ratingCounts['5'] = Math.floor(totalRatings * 0.3);
        ratingCounts['4'] = Math.floor(totalRatings * 0.4);
        ratingCounts['3'] = Math.floor(totalRatings * 0.2);
        ratingCounts['2'] = Math.floor(totalRatings * 0.08);
        ratingCounts['1'] = totalRatings - (ratingCounts['5'] + ratingCounts['4'] + ratingCounts['3'] + ratingCounts['2']);
      }

      return {
        entrenador: u._id,
        totalRatings,
        avgRating: Number(avgRating),
        ratingCounts
      };
    });
    
    try {
      await Trainer.insertMany(trainerStatsDocs);
      console.log(`✅ ${trainerStatsDocs.length} estadísticas de entrenadores creadas`);
    } catch (trainerError) {
      console.error('❌ Error creando TrainerStats:', trainerError.message);
      throw trainerError;
    }    // Crear servicios, asociando el ObjectId del entrenador
    console.log(`🛠️ Creando ${servicesSeed.length} servicios...`);
    const servicesToInsert = servicesSeed.map(s => {
      const entrenadorUser = entrenadoresUsuarios.find(u => u.email === s.entrenadorEmail);
      if (!entrenadorUser) {
        console.warn(`⚠️ No se encontró entrenador para email: ${s.entrenadorEmail}`);
      }
      return {
        ...s,
        entrenador: entrenadorUser ? entrenadorUser._id : null,
        presencial: s.presencial === 'presencial' // Convertir string a boolean
      };
    });
    
    try {
      await Service.insertMany(servicesToInsert);
      console.log(`✅ ${servicesToInsert.length} servicios creados`);
    } catch (serviceError) {
      console.error('❌ Error creando servicios:', serviceError.message);
      throw serviceError;
    }

    console.log('🎉 Seeding completado exitosamente!');
    res.json({ message: 'Datos de prueba insertados correctamente.' });
  } catch (err) {
    console.error('💥 Error durante el seeding:', err);
    res.status(500).json({ 
      message: 'Error al poblar la base de datos.', 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Ruta para limpiar completamente la base de datos
router.delete('/clear', async (req, res) => {
  try {
    // Eliminar todos los documentos de cada colección
    await User.deleteMany({});
    await Trainer.deleteMany({});
    await Service.deleteMany({});
    await Rating.deleteMany({});
    await Reserve.deleteMany({});

    // Obtener conteos para confirmar
    const userCount = await User.countDocuments();
    const trainerCount = await Trainer.countDocuments();
    const serviceCount = await Service.countDocuments();
    const ratingCount = await Rating.countDocuments();
    const reserveCount = await Reserve.countDocuments();

    res.json({ 
      message: 'Base de datos limpiada completamente.',
      counts: {
        users: userCount,
        trainers: trainerCount,
        services: serviceCount,
        ratings: ratingCount,
        reserves: reserveCount
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error al limpiar la base de datos.', error: err.message });
  }
});

module.exports = router;
