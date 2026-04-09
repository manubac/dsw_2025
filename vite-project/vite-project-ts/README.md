# Frontend — PokemonCard Market

Carpeta que contiene el código del Frontend del sistema del Trabajo Práctico Integrador de Desarrollo de Software.

---

## Tecnologías Utilizadas

- **React 19**
- **TypeScript**
- **Vite 7**
- **React Router v7**
- **Axios**
- **Lucide React** / **React Icons** — íconos
- **CSS Modules** — estilos por componente

---

## Instrucciones de instalación / utilización

Este Frontend se encuentra desplegado y en funcionamiento en https://dsw-2025-frontend.onrender.com/ .

El siguiente instructivo utilizará `pnpm` como gestor de dependencias.

### 1. Requisitos previos

- [Node.js](https://nodejs.org/) v18 o superior
- [pnpm](https://pnpm.io/) (`npm install -g pnpm`)
- El **backend** corriendo en `http://localhost:3000` (ver `backend/README.md`)

---

### 2. Clonar el repositorio

Primero deberá hacer un clone del directorio de backend de este repositorio:

git clone https://github.com/manubac/dsw_2025.git
cd dsw_2025/backend

### 3. Instalar dependencias

Posicionarse en la carpeta `vite-project/vite-project-ts/` y ejecutar:

pnpm install

---

### 4. Configurar variables de entorno

Crear un archivo `.env` dentro de esta carpeta (a la misma altura que `package.json`) con el siguiente contenido:

# URL base de la API (backend)

VITE_API_URL=http://localhost:3000

Si el backend corre en otro puerto o está desplegado remotamente, ajustar esta variable a ese puerto.

---

### 5. Iniciar el servidor de desarrollo

Para inicializar el servidor, ejecute:

pnpm dev

Navegar a `http://localhost:5173`. La aplicación se recarga automáticamente al guardar cambios.

---

---

## Tests unitarios

Los tests se ubican junto al código que prueban (`*.test.ts`).

Para ejecutarlos:

pnpm test --run

Actualmente cubren la lógica del carrito (`src/context/cart.test.ts`):

- Agregar un producto nuevo
- Incrementar cantidad si el producto ya existe
- Eliminar un producto
- Vaciar el carrito
