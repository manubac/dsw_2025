# Backend — PokemonCard Market

Carpeta que contiene el código de la API REST utilizada por el sistema del Trabajo Práctico Integrador de Desarrollo de Software.

---

## Tecnologías Utilizadas

- **Node.js** + **Express 5**
- **TypeScript**
- **MikroORM 6** (MySQL)
- **MySQL 8** (via Docker)
- **bcryptjs** — hashing de contraseñas
- **jsonwebtoken** — autenticación JWT
- **nodemailer** — envío de emails (confirmación de compra, contacto, reset de contraseña)
- **Puppeteer** — scraping de cartas
- **CORS**
- **dotenv**

---

## Instrucciones de instalación / utilización

Se utilizará `pnpm` como gestor de dependencias.

### 1. Requisitos previos

- [Node.js](https://nodejs.org/) v18 o superior
- [Docker](https://www.docker.com/) (para la base de datos)
- [pnpm](https://pnpm.io/) (`npm install -g pnpm`)

---

### 2. Clonar el repositorio

Primero deberá hacer un clone del directorio de backend de este repositorio:

git clone https://github.com/manubac/dsw_2025.git
cd dsw_2025/backend

### 3. Levantar la base de datos

Desde la raíz del repositorio, ejecutar:

docker compose up -d

Esto levantará un contenedor MySQL 8 en el puerto `3306`. Las credenciales se configuran en el archivo `.env` (ver paso 4).

---

### 4. Instalar dependencias

Posicionarse en la carpeta `backend/` y ejecutar:

pnpm install

---

### 5. Configurar variables de entorno

Crear un archivo `.env` dentro de `backend/` (a la misma altura que `package.json`) con la siguiente estructura:

```env
# Base de datos
DB_NAME=<nombre_de_la_base_de_datos>
DB_CONNECTION_STRING=mysql://<usuario>:<contraseña>@<host>:<puerto>/<nombre_de_la_base_de_datos>

# JWT
JWT_SECRET=<token>

# MercadoPago
MP_ACCESS_TOKEN=<access_token_de_mercadopago>

# Email (Gmail App Password)
GMAIL_USER=<su_email@gmail.com>
GMAIL_APP_PASS=<su_app_password>
CONTACT_FORM_RECIPIENT=<email_que_recibe_contacto>
```

---

### 6. Iniciar el servidor

Para iniciar el servidor (con auto-recarga al guardar cambios), ejecute:

pnpm start:dev

La API quedará disponible en `http://localhost:3000`.

---
