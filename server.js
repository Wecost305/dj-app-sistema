// --- SERVIDOR SAAS MULTI-TENANT PARA DJ APP (VERSIÓN FINAL CON LOGIN CORREGIDO) ---

// 1. IMPORTACIONES
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const { Pool } = require('pg');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');

// 2. CONFIGURACIÓN INICIAL
const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*", methods: ["GET", "POST"] } });
const PORT = 3000;

// 3. MIDDLEWARE
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. SESIONES Y AUTENTICACIÓN
const sessionMiddleware = session({
    secret: 'un_secreto_muy_largo_y_dificil_de_adivinar_para_produccion',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
});
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

// 5. CONEXIÓN A POSTGRESQL
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'dj_app_db',
    password: 'Samva.Wm5', // Tu contraseña
    port: 5432,
});

// 6. LÓGICA DE PASSPORT.JS
passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
        const result = await pool.query('SELECT * FROM djs WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return done(null, false, { message: 'Email no registrado.' });
        }
        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return done(null, false, { message: 'Contraseña incorrecta.' });
        }
        return done(null, user);
    } catch (err) {
        return done(err);
    }
}));
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const result = await pool.query('SELECT id, email, dj_name, public_slug, is_accepting_requests FROM djs WHERE id = $1', [id]);
        done(null, result.rows[0]);
    } catch (err) { done(err); }
});

function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/login.html');
}
function isAdmin(req, res, next) {
    // Primero, nos aseguramos de que esté logueado
    if (!req.isAuthenticated()) {
        return res.redirect('/login.html');
    }
    // Luego, verificamos si su rol es 'admin'
    if (req.user.role === 'admin') {
        return next(); // Si es admin, le permitimos continuar
    }
    // Si no es admin, lo enviamos al dashboard normal con un mensaje de error (opcional)
    res.status(403).send('Acceso Prohibido: Esta página es solo para administradores.');
}

// 7. RUTAS DE LA APLICACIÓN

// --- API de Autenticación ---
app.post('/api/register', async (req, res) => {
    const { email, password, dj_name } = req.body;
    try {
        let slug = dj_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        slug += Math.floor(100 + Math.random() * 900);
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
            'INSERT INTO djs (email, password_hash, dj_name, public_slug) VALUES ($1, $2, $3, $4)',
            [email, hashedPassword, dj_name, slug]
        );
        res.status(201).json({ message: 'Registro exitoso' });
    } catch (err) { res.status(500).send('Error al registrar el usuario.'); }
});

// RUTA DE LOGIN (CORREGIDA Y SIMPLIFICADA)
app.post('/api/login', passport.authenticate('local'), (req, res) => {
    // Si passport.authenticate tiene éxito, la ejecución llega aquí.
    // El usuario ya está en req.user.
    // Simplemente enviamos una respuesta de éxito.
    res.status(200).json({ message: 'Login exitoso', user: req.user });
});
// Si passport.authenticate falla, automáticamente enviará una respuesta 401 Unauthorized,
// que será capturada por el bloque catch en tu auth.js.

app.post('/api/logout', (req, res, next) => {
    req.logout(err => {
        if (err) { return next(err); }
        res.redirect('/login.html');
    });
});
app.get('/api/user', isAuthenticated, (req, res) => { res.json(req.user); });

// --- NUEVAS APIs para la "Sala del DJ" ---
app.post('/api/sala/toggle', isAuthenticated, async (req, res) => {
    const djId = req.user.id;
    const { open } = req.body;
    try {
        const result = await pool.query('UPDATE djs SET is_accepting_requests = $1 WHERE id = $2 RETURNING is_accepting_requests', [open, djId]);
        res.json({ success: true, is_accepting: result.rows[0].is_accepting_requests });
    } catch (err) { res.status(500).send('Error al cambiar estado de la sala.'); }
});

app.get('/api/sala/:slug', async (req, res) => {
    const { slug } = req.params;
    try {
        const result = await pool.query('SELECT id, dj_name, is_accepting_requests FROM djs WHERE public_slug = $1', [slug]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'DJ no encontrado.' });
        res.json(result.rows[0]);
    } catch (err) { res.status(500).send('Error del servidor.'); }
});

app.post('/api/sesion/clear', isAuthenticated, async (req, res) => {
    const djId = req.user.id;
    try {
        // Marcamos todas las canciones pendientes de este DJ como "archivadas"
        await pool.query("UPDATE solicitudes SET estado = 'archivada' WHERE dj_id = $1 AND estado = 'pendiente'", [djId]);
        res.json({ success: true });
    } catch (err) { res.status(500).send('Error al limpiar la sesión.'); }
});

// --- API de Solicitudes (Modificada) ---
app.post('/api/solicitud', async (req, res) => {
    const { cancion, solicitante, dedicatoria, dj_id } = req.body; // Ahora recibimos dj_id
    if (!dj_id || !cancion || !solicitante) {
        return res.status(400).json({ message: 'Faltan datos esenciales.' });
    }
    try {
        const newRequest = await pool.query(
            'INSERT INTO solicitudes (dj_id, cancion, solicitante, dedicatoria) VALUES ($1, $2, $3, $4) RETURNING *',
            [dj_id, cancion, solicitante, dedicatoria]
        );
        io.to(`dj-${dj_id}`).emit('nueva_cancion', newRequest.rows[0]);
        res.status(201).json({ message: 'Solicitud recibida!' });
    } catch (err) { res.status(500).send('Error al guardar la solicitud.'); }
});

// Obtener todos los usuarios (excepto el propio admin)
app.get('/api/admin/users', isAdmin, async (req, res) => {
    try {
        // El req.user.id viene del admin que está haciendo la petición
        const result = await pool.query('SELECT id, dj_name, email, role FROM djs WHERE id != $1 ORDER BY id ASC', [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener usuarios.' });
    }
});

// Eliminar un usuario
app.delete('/api/admin/users/:id', isAdmin, async (req, res) => {
    const userIdToDelete = req.params.id;
    try {
        await pool.query('DELETE FROM djs WHERE id = $1', [userIdToDelete]);
        res.status(200).json({ message: 'Usuario eliminado con éxito.' });
    } catch (err) {
        res.status(500).json({ message: 'Error al eliminar el usuario.' });
    }
});

// --- Rutas de Páginas ---
app.get('/', isAuthenticated, (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
app.get('/stats.html', isAuthenticated, (req, res) => { res.sendFile(path.join(__dirname, 'public', 'stats.html')); });

app.use(express.static(path.join(__dirname, 'public')));


app.get('/admin', isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 8. LÓGICA DE SOCKET.IO (Modificada)
const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
io.use(wrap(sessionMiddleware));
io.use(wrap(passport.initialize()));
io.use(wrap(passport.session()));

io.on('connection', (socket) => {
    if (!socket.request.session.passport?.user) return socket.disconnect();
    const djId = socket.request.session.passport.user;
    socket.join(`dj-${djId}`);

    socket.on('cargar_sesion_actual', async () => {
        try {
            const result = await pool.query("SELECT * FROM solicitudes WHERE dj_id = $1 AND estado IN ('pendiente', 'reproducida', 'cancelada') ORDER BY created_at ASC", [djId]);
            socket.emit('sesion_actual', result.rows);
        } catch (err) { console.error(err); }
    });

    socket.on('actualizar_estado', async ({ id, estado }) => {
        try {
            const result = await pool.query('UPDATE solicitudes SET estado = $1 WHERE id = $2 RETURNING *', [estado, id]);
            io.to(`dj-${djId}`).emit('estado_actualizado', result.rows[0]);
        } catch (err) { console.error(err); }
    });
});

// 9. INICIALIZACIÓN DEL SERVIDOR
async function initializeDatabase() {
    const client = await pool.connect();
    try {
       await client.query(`
    CREATE TABLE IF NOT EXISTS djs (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        dj_name VARCHAR(100) NOT NULL,
        public_slug VARCHAR(100) UNIQUE,
        is_accepting_requests BOOLEAN DEFAULT FALSE,
        -- NUEVA COLUMNA PARA EL ROL --
        role VARCHAR(50) NOT NULL DEFAULT 'dj'
    );
`);
        // La tabla de solicitudes ahora se relaciona directamente con el DJ
        await client.query(`CREATE TABLE IF NOT EXISTS solicitudes (id SERIAL PRIMARY KEY, dj_id INTEGER REFERENCES djs(id) ON DELETE CASCADE, cancion TEXT NOT NULL, solicitante TEXT NOT NULL, dedicatoria TEXT, estado VARCHAR(50) NOT NULL DEFAULT 'pendiente', created_at TIMESTAMPTZ DEFAULT NOW());`);
        // La tabla de eventos ya no es necesaria en este modelo, la puedes eliminar si quieres.
        console.log('Base de datos inicializada y tablas aseguradas.');
    } catch (err) { console.error('Error al inicializar la base de datos:', err); }
    finally { client.release(); }
}

server.listen(PORT, () => {
    console.log(`=== Servidor listo en http://localhost:${PORT} ===`);
    // ...
});
