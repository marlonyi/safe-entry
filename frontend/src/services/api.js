import axios from 'axios';

// En producción Vite reemplaza VITE_API_URL en el build.
// En desarrollo cae al localhost:5000 por defecto.
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para inyectar el token en cada petición
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Interceptor de respuesta: desempaqueta el wrapper { success, data, message } del backend.
// Comportamiento: si la respuesta contiene { success: true, data: X }, response.data se reemplaza
// por X directamente. Los consumidores acceden a resp.data (ya es la data interna).
// Caso sin campo "data": la respuesta se deja intacta (ej: { success, qr, token }).
// Si success === false, la respuesta no se modifica; el error se maneja en el catch del consumidor.
api.interceptors.response.use(
  (response) => {
    if (
      response.data &&
      typeof response.data === 'object' &&
      'success' in response.data &&
      response.data.success === true &&
      'data' in response.data
    ) {
      // Unwrap: reemplazar el wrapper por la data interna.
      // El mensaje queda descartado aquí; si se necesita, leer response.data antes del unwrap.
      response.data = response.data.data;
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
