const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const BARRIOS_CABA = [
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

const IDIOMAS_ENUM = ["Español", "Inglés", "Portugués"];


const userSchema = new mongoose.Schema({
  nombre:          { 
    type: String, 
    required: [true, 'El nombre es obligatorio.'],
    maxlength: [50, 'El nombre no puede superar los 50 caracteres.']
  },
  apellido:        { 
    type: String, 
    required: [true, 'El apellido es obligatorio.'],
    maxlength: [50, 'El apellido no puede superar los 50 caracteres.']
  },
  email:           { 
    type: String, 
    required: [true, 'El email es obligatorio.'], 
    unique: true,
    maxlength: [100, 'El email no puede superar los 100 caracteres.']
  },
  password:        { type: String, required: [true, 'La contraseña es obligatoria.'] },
  fechaNacimiento: { 
    type: Date,   
    required: [true, 'La fecha de nacimiento es obligatoria.'],
    validate: {
      validator: function(value) {
        if (!value) return false;
        const today = new Date();
        const minDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
        return value <= minDate;
      },
      message: 'Debes tener al menos 18 años para registrarte.'
    }
  },
  role:            { type: String, enum: ['cliente', 'entrenador'], default: 'cliente', required: [true, 'El rol es obligatorio.'] },
  resetToken: String,
  resetTokenExpires: Date,
  avatarUrl: { type: String, default: null },


  // Campos exclusivos para entrenadores:
  zona: {
    type: String,
    enum: BARRIOS_CABA,
    required: [function() { return this.role === 'entrenador'; }, 'La zona es obligatoria para entrenadores.']
  },  presentacion: {
    type: String,
    required: [function() { return this.role === 'entrenador'; }, 'La presentación es obligatoria para entrenadores.'],
    minlength: [10, 'La presentación debe tener al menos 10 caracteres.'],
    maxlength: [200, 'La presentación no puede superar los 200 caracteres.']
  },
  idiomas: {
    type: [String],
    enum: IDIOMAS_ENUM,  // 👈 Restringe los valores permitidos
    required: [function() { return this.role === 'entrenador'; }, 'Debes indicar al menos un idioma.'], // Este mensaje aparece cuando el campo directamente no está
    validate: {
      validator: function(arr) {
        if (this.role !== 'entrenador') return true;
        return Array.isArray(arr) && arr.length > 0;
      },
      message: 'Un entrenador debe indicar al menos un idioma.' // Este mensaje aparecerá si el campo está vacío, es decir si idiomas = []
    }
  },
}, { timestamps: true });

// Antes de guardar, encriptar la contraseña
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Comparar contraseña en login
userSchema.methods.comparePassword = function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
