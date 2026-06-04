import mongoose from 'mongoose';
import { env } from '../config/env';
import User from '../models/User';
import Project from '../models/Project';
import Task from '../models/Task';

const setupTasks = [
  ['Buscar y visitar locales en Piedra Pintada / Zona Rosa', 'urgent', 'in-progress'],
  ['Constituir la SAS ante Cámara de Comercio de Ibagué', 'high', 'pending'],
  ['Cotizar equipo de café (máquina espresso, molinos, métodos)', 'high', 'pending'],
  ['Diseñar logo y paleta visual con diseñador gráfico', 'medium', 'pending'],
  ['Crear cuenta Instagram y TikTok', 'medium', 'pending'],
  ['Visitar Fondo Emprender SENA e iNNpulsa', 'high', 'pending'],
  ['Redactar acuerdo de socios con abogado', 'urgent', 'pending'],
  ['Contactar fincas cafeteras del Tolima para alianza de suministro', 'medium', 'pending'],
  ['Definir paquetes Work Café definitivos y validar con mercado objetivo', 'medium', 'pending'],
] as const;

async function seedProjects() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  const superadmin = await User.findOneAndUpdate(
    { email: 'admin@laislacafepicnic.com' },
    { name: 'Administrador', role: 'superadmin', isActive: true },
    { new: true }
  );

  if (!superadmin) {
    throw new Error('No existe el usuario seed admin@laislacafepicnic.com. Ejecuta npm run seed primero.');
  }

  const montaje = await Project.findOneAndUpdate(
    { name: 'Montaje del Café' },
    {
      name: 'Montaje del Café',
      color: '#43593B',
      description: 'Todas las tareas para abrir La Isla Café Picnic',
      isActive: true,
      createdBy: superadmin._id,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  await Project.findOneAndUpdate(
    { name: 'Tareas Diarias' },
    {
      name: 'Tareas Diarias',
      color: '#7CC1E7',
      description: 'Operaciones del día a día del café',
      isActive: true,
      createdBy: superadmin._id,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  for (const [title, priority, status] of setupTasks) {
    await Task.findOneAndUpdate(
      { projectId: montaje._id, title },
      {
        projectId: montaje._id,
        title,
        priority,
        status,
        assignedTo: [superadmin._id],
        createdBy: superadmin._id,
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }

  console.log('✨ Seed de proyectos completado');
  await mongoose.disconnect();
  process.exit(0);
}

seedProjects().catch((err) => {
  console.error('❌ Seed projects error:', err);
  process.exit(1);
});
