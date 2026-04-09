import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
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

// Interceptor para desempaquetar la nueva estructura del backend ({ success, data, message })
api.interceptors.response.use(
  (response) => {
    // Si el backend devuelve un wrapper con { success, data }, desempacamos la data
    if (response.data && typeof response.data === 'object' && 'success' in response.data) {
      if (response.data.success) {
        // Caso 1: Respuesta con { success, data, message } - desempaquetar data
        if ('data' in response.data) {
          const responseData = response.data.data;
          if (responseData && typeof responseData === 'object') {
            responseData._message = response.data.message || response.data.mensaje;
          }
          // Si responseData es null/undefined, mantener el wrapper pero simplificado
          response.data = responseData !== undefined ? responseData : { _message: response.data.message || response.data.mensaje };
        }
        // Caso 2: Respuesta con { success, mensaje, qr/tipo/etc } - mantener intacta
        // (no modificar response.data, ya tiene la estructura correcta)
      }
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
