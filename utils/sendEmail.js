
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.sendgrid.net',
  port: 587,
  auth: {
    user: 'apikey',                   // SendGrid usa el literal "apikey" como usuario
    pass: process.env.SENDGRID_API_KEY
  }
});

/**
 * Envía un correo
 * @param {string} to      - destinatario
 * @param {string} subject - asunto
 * @param {string} html    - cuerpo en HTML
 */
async function sendEmail(to, subject, html) {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html
    });
    console.log('✅ Email enviado:', info.messageId);
  } catch (err) {
    console.error('❌ Error al enviar el email:', err);
  }
}

module.exports = sendEmail;

