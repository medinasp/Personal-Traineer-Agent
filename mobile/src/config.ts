// URL base da API. Defina EXPO_PUBLIC_API_URL no .env (ver .env.example).
// No emulador/celular use o IP da sua maquina na LAN, nao "localhost".
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

// Token de acesso a API (deve bater com API_TOKEN do backend em producao).
// Vazio em dev local (auth desligada).
export const API_TOKEN = process.env.EXPO_PUBLIC_API_TOKEN ?? "";
