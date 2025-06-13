// Ruta para poblar la base de datos con datos de prueba solo si está vacía
const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Trainer = require('../models/TrainerStats');
const Service = require('../models/Service');

// Puedes ajustar estos datos de ejemplo según tus modelos
const usersSeed = [
  { nombre: 'Juan', apellido: 'Pérez', email: 'juan@test.com', password: 'Test1234!', role: 'cliente', fechaNacimiento: new Date('1990-01-01') },
  { nombre: 'Ana', apellido: 'García', email: 'ana@test.com', password: 'Test1234!', role: 'cliente', fechaNacimiento: new Date('1992-05-10') }
];

const trainersSeed = [
  { nombre: 'Carlos', apellido: 'López', email: 'carlos@test.com', password: 'Test1234!', role: 'entrenador', presentacion: 'Entrenador personal con experiencia en fitness y salud.', zona: 'Palermo', idiomas: ['Español', 'Inglés'], fechaNacimiento: new Date('1985-03-15'), avatarUrl: 'https://media.istockphoto.com/id/1136449221/photo/fitness-trainer-portrait-in-the-gym.jpg?s=612x612&w=0&k=20&c=AOkQClzQO8n-TdIwDlep5p4TYBToAW3G2vE5luRdC-U=' },
  { nombre: 'Lucía', apellido: 'Martínez', email: 'lucia@test.com', password: 'Test1234!', role: 'entrenador', presentacion: 'Especialista en fitness y bienestar integral.', zona: 'Belgrano', idiomas: ['Español'], fechaNacimiento: new Date('1988-07-22'), avatarUrl: 'https://media.istockphoto.com/id/856797530/photo/portrait-of-a-beautiful-woman-at-the-gym.jpg?s=612x612&w=0&k=20&c=0wMa1MYxt6HHamjd66d5__XGAKbJFDFQyu9LCloRsYU=' }
];

const servicesSeed = [
  { titulo: 'Entrenamiento Funcional', descripcion: 'Sesión de entrenamiento funcional', precio: 20, categoria: 'Entrenamiento', entrenadorEmail: 'carlos@test.com', duracion: 60, presencial: true, disponibilidad: { lunes: ['09:00', '10:00'], miercoles: ['14:00'] } },
  { titulo: 'Yoga', descripcion: 'Clase de yoga para todos los niveles', precio: 15, categoria: 'Entrenamiento', entrenadorEmail: 'lucia@test.com', duracion: 60, presencial: false, disponibilidad: { martes: ['11:00'], jueves: ['16:00', '17:00'] } }
];

router.post('/seed', async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    const trainerCount = await Trainer.countDocuments();
    const serviceCount = await Service.countDocuments();

    if (userCount > 0 || trainerCount > 0 || serviceCount > 0) {
      return res.status(400).json({ message: 'La base de datos ya tiene datos.' });
    }

    // Crear usuarios (clientes y entrenadores) uno por uno para que se encripte la contraseña
    const allUsers = usersSeed.concat(trainersSeed);
    const createdUsers = [];
    for (const userData of allUsers) {
      const user = new User(userData);
      await user.save();
      createdUsers.push(user);
    }

    // Filtrar los usuarios que son entrenadores
    const entrenadoresUsuarios = createdUsers.filter(u => u.role === 'entrenador');

    // Crear TrainerStats para cada entrenador con valores randomizados
    const trainerStatsDocs = entrenadoresUsuarios.map(u => {
      // Generar valores aleatorios para ratings
      const totalRatings = Math.floor(Math.random() * 40) + 1; // 1 a 40
      const avgRating = (Math.random() * 2 + 3).toFixed(2); // 3.00 a 5.00
      // Distribución aleatoria de ratings 1-5
      let restantes = totalRatings;
      const ratingCounts = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
      for (let i = 1; i <= 5; i++) {
        if (i === 5) {
          ratingCounts[i] = restantes;
        } else {
          const val = Math.floor(Math.random() * (restantes + 1));
          ratingCounts[i] = val;
          restantes -= val;
        }
      }
      return {
        entrenador: u._id,
        totalRatings,
        avgRating: Number(avgRating),
        ratingCounts
      };
    });
    await Trainer.insertMany(trainerStatsDocs);

    // Crear servicios, asociando el ObjectId del entrenador
    const servicesToInsert = servicesSeed.map(s => {
      const entrenadorUser = entrenadoresUsuarios.find(u => u.email === s.entrenadorEmail);
      return {
        ...s,
        entrenador: entrenadorUser ? entrenadorUser._id : null // referencia correcta
      };
    });
    await Service.insertMany(servicesToInsert);

    res.json({ message: 'Datos de prueba insertados correctamente.' });
  } catch (err) {
    res.status(500).json({ message: 'Error al poblar la base de datos.', error: err.message });
  }
});

module.exports = router;
