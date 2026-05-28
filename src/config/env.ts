import dotenv from "dotenv";
dotenv.config();

export const env = {
  PORT: parseInt(process.env.PORT || "4000", 10),
  MONGODB_URI:
    process.env.MONGODB_URI || "mongodb://localhost:27017/la-isla-cafe",
  JWT_SECRET: process.env.JWT_SECRET || "default_secret_change_me",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",
  API_BASE_PATHS: process.env.API_BASE_PATHS || "/api",
  NODE_ENV: process.env.NODE_ENV || "development",
};
