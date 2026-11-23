// Capa de acceso a la API: guarda el token de sesión y lo envía en cada petición.
import { solicitar } from './servidor-local.js';

const CLAVE_TOKEN = 'derma_token', CLAVE_USUARIO = 'derma_usuario';

export const sesion = {
  token: () => localStorage.getItem(CLAVE_TOKEN),
  usuario: () => JSON.parse(localStorage.getItem(CLAVE_USUARIO) || 'null'),
  guardar(token, usuario) {
    localStorage.setItem(CLAVE_TOKEN, token);
    localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
  },
  cerrar() {
    localStorage.removeItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_USUARIO);
    location.replace('login.html');
  },
};

// Versión estática (GitHub Pages): en lugar de llamar a un servidor con fetch,
// las peticiones las atiende js/servidor-local.js dentro del navegador.
async function pedir(metodo, url, cuerpo) {
  try {
    return await solicitar(metodo, url, cuerpo, sesion.token());
  } catch (e) {
    if (e.status === 401 && !url.startsWith('/auth/login')) sesion.cerrar();
    throw new Error(e.message || 'No se pudo completar la solicitud');
  }
}

export const api = {
  get: (u) => pedir('GET', u),
  post: (u, b) => pedir('POST', u, b),
  put: (u, b) => pedir('PUT', u, b),
  patch: (u, b) => pedir('PATCH', u, b),
  del: (u) => pedir('DELETE', u),
};
