import { api, sesion } from './api.js';

if (sesion.token()) location.replace('index.html');

const form = document.getElementById('form');
const error = document.getElementById('error');
const btn = document.getElementById('btn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  error.textContent = '';
  btn.disabled = true;
  try {
    const { token, usuario } = await api.post('/auth/login', { email: form.email.value, password: form.password.value });
    sesion.guardar(token, usuario);
    location.replace('index.html');
  } catch (err) {
    error.textContent = err.message;
    btn.disabled = false;
  }
});

document.getElementById('ver').addEventListener('click', (e) => {
  const oculto = form.password.type === 'password';
  form.password.type = oculto ? 'text' : 'password';
  e.target.textContent = oculto ? 'Ocultar' : 'Mostrar';
});

document.querySelectorAll('.demo button').forEach((b) => b.addEventListener('click', () => {
  form.email.value = b.dataset.u;
  form.password.value = b.dataset.p;
  form.password.focus();
}));
