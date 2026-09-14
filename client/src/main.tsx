import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.js' // Обрати внимание на .js, если TS требует расширения
// @ts-ignore
import './index.css'    // Тут обычно подключается Tailwind
import axios from 'axios';

axios.defaults.baseURL = 'http://localhost:5000';

// (Опционально) Если хочешь, чтобы поддомен автоматически подмешивался в каждый запрос:
const host = window.location.hostname;
const parts = host.split('.');
if (parts.length > 1 && parts[0] !== 'localhost') {
  axios.defaults.headers.common['X-Subdomain'] = parts[0]; 
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('SW зарегистрирован успешно:', registration.scope);
      })
      .catch((error) => {
        console.error('Ошибка регистрации SW:', error);
      });
  });
}