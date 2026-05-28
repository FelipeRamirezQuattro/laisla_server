# Backend La Isla Café Picnic

API REST para el panel administrativo y el sitio público de La Isla Café Picnic.

## Stack

- Node.js
- Express
- TypeScript
- MongoDB / MongoDB Atlas
- JWT
- PM2 para producción

## Configuración

```bash
npm install
cp .env.example .env
```

Ejemplo de producción:

```env
PORT=4000
NODE_ENV=production
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/la-isla-cafe?retryWrites=true&w=majority
JWT_SECRET=<long-random-secret>
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://laislacafepicnic.com,https://www.laislacafepicnic.com
```

## Comandos

```bash
npm run dev
npm run build
npm start
npm run pm2:start
npm run pm2:logs
npm run pm2:stop
```

## Seed

```bash
npm run seed
npm run seed:costs
npm run seed:inventario
```

Usuario inicial:

- `admin@laislacafepicnic.com`
- `admin123`

## Producción en EC2

1. Instalar Node.js 18+ y PM2.
2. Copiar el proyecto al servidor.
3. Crear `backend/.env` con variables reales.
4. Ejecutar `npm install`.
5. Ejecutar `npm run build`.
6. Levantar con `npm run pm2:start`.
7. Configurar Nginx o proxy reverso hacia `localhost:4000`.
8. Apuntar el subdominio de API al EC2.
9. Verificar `GET /api/health`.

No subas `.env` al repositorio ni compartas `MONGODB_URI` o `JWT_SECRET`.
