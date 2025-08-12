// --- app.js - Lógica del Dashboard con "Sala de DJ" y URL Fija ---

document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // --- Elementos del DOM ---
    const welcomeMessage = document.getElementById('welcome-message');
    const clockEl = document.getElementById('clock');
    
    // Nuevos elementos para la "Sala de DJ"
    const salaToggle = document.getElementById('sala-toggle');
    const salaStatusText = document.getElementById('sala-status-text');
    const publicUrlInput = document.getElementById('public-url-input');
    const copyUrlButton = document.getElementById('copy-url-button');
    const clearSessionButton = document.getElementById('clear-session-button');

    // Elementos del dashboard de canciones
    const pendingColumn = document.getElementById('pending-column');
    const playedColumn = document.getElementById('played-column');
    const canceledColumn = document.getElementById('canceled-column');
    const pendingCountEl = document.getElementById('pending-count');
    const playedCountEl = document.getElementById('played-count');
    const canceledCountEl = document.getElementById('canceled-count');
    const totalCountEl = document.getElementById('total-count');

    // --- Estado Local ---
    let songs = [];

    // --- Lógica de la Sala del DJ ---
    async function toggleSala() {
        const newState = salaToggle.checked;
        try {
            const response = await fetch('/api/sala/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ open: newState })
            });
            const data = await response.json();
            if (data.success) {
                updateSalaStatus(data.is_accepting);
            }
        } catch (error) {
            console.error('Error al cambiar estado de la sala:', error);
        }
    }

    function updateSalaStatus(isAccepting) {
        if (isAccepting) {
            salaStatusText.textContent = 'Sala Abierta (Aceptando Solicitudes)';
            salaStatusText.parentElement.classList.add('active');
        } else {
            salaStatusText.textContent = 'Sala Cerrada';
            salaStatusText.parentElement.classList.remove('active');
        }
    }

    function copyPublicUrl() {
        publicUrlInput.select();
        publicUrlInput.setSelectionRange(0, 99999); // Para móviles
        document.execCommand('copy');
        copyUrlButton.textContent = '¡Copiado!';
        setTimeout(() => { copyUrlButton.textContent = 'Copiar'; }, 2000);
    }

    async function clearCurrentSession() {
        if (!confirm('¿Estás seguro de que quieres archivar todas las solicitudes actuales y limpiar el dashboard? Esta acción no se puede deshacer.')) {
            return;
        }
        try {
            const response = await fetch('/api/sesion/clear', { method: 'POST' });
            const data = await response.json();
            if (data.success) {
                songs = []; // Limpiar el array local
                renderDashboard(); // Volver a dibujar el dashboard vacío
                alert('Dashboard limpiado. ¡Listo para la siguiente sesión!');
            }
        } catch (error) {
            console.error('Error al limpiar la sesión:', error);
        }
    }

    // --- Lógica del Dashboard de Canciones ---
   function createSongCard(song) {
        const card = document.createElement('div');
        card.className = 'song-card';
        card.id = `song-${song.id}`;
        card.innerHTML = `
            <h4>${song.cancion}</h4>
            <p>De: <strong>${song.solicitante}</strong></p>
            ${song.dedicatoria ? `<p class="dedication">"${song.dedicatoria}"</p>` : ''}
            <div class="card-actions">
                ${song.estado === 'pendiente' ? `<button class="action-btn play" data-id="${song.id}">▶ Tocar</button>` : ''}
                ${song.estado !== 'cancelada' ? `<button class="action-btn cancel" data-id="${song.id}">✖ Cancelar</button>` : ''}
            </div>
        `;
        return card;
    }

    function renderDashboard() {
        // Limpiar columnas
        pendingColumn.innerHTML = '<h2>Pendientes</h2>';
        playedColumn.innerHTML = '<h2>Reproducidas</h2>';
        canceledColumn.innerHTML = '<h2>Canceladas</h2>';

        // Filtrar y contar canciones
        const pendingSongs = songs.filter(s => s.estado === 'pendiente');
        const playedSongs = songs.filter(s => s.estado === 'reproducida');
        const canceledSongs = songs.filter(s => s.estado === 'cancelada');

        pendingSongs.forEach(song => pendingColumn.appendChild(createSongCard(song)));
        playedSongs.forEach(song => playedColumn.appendChild(createSongCard(song)));
        canceledSongs.forEach(song => canceledColumn.appendChild(createSongCard(song)));

        // Actualizar contadores
        pendingCountEl.textContent = pendingSongs.length;
        playedCountEl.textContent = playedSongs.length;
        canceledCountEl.textContent = canceledSongs.length;
        totalCountEl.textContent = songs.length;
    }

   // --- Funciones de Interacción ---

    function updateSongStatus(songId, newStatus) {
        socket.emit('actualizar_estado', { id: songId, estado: newStatus });
    }

    // --- Inicialización de la Página ---
    async function initializePage() {
        try {
            const response = await fetch('/api/user');
            if (!response.ok) {
                window.location.href = '/login.html';
                return;
            }
            const user = await response.json();
            
            // Configurar bienvenida
            welcomeMessage.textContent = `Bienvenido, ${user.dj_name}`;

            // Configurar la sección de la Sala
            const publicUrl = `${window.location.origin}/public-form.html?dj=${user.public_slug}`;
            publicUrlInput.value = publicUrl;
            salaToggle.checked = user.is_accepting_requests;
            updateSalaStatus(user.is_accepting_requests);

            // Cargar las canciones pendientes de la sesión actual
            socket.emit('cargar_sesion_actual');

        } catch (error) {
            console.error('Error al inicializar el dashboard:', error);
            window.location.href = '/login.html';
        }

        // Iniciar reloj
        setInterval(() => { clockEl.textContent = new Date().toLocaleTimeString('es-ES'); }, 1000);
    }

    // --- Event Listeners ---
    salaToggle.addEventListener('change', toggleSala);
    copyUrlButton.addEventListener('click', copyPublicUrl);
    clearSessionButton.addEventListener('click', clearCurrentSession);
    document.querySelector('.dashboard-main').addEventListener('click', (e) => {
        if (e.target.matches('.action-btn')) {
            const songId = e.target.dataset.id;
            const newStatus = e.target.classList.contains('play') ? 'reproducida' : 'cancelada';
            updateSongStatus(songId, newStatus);
        }
    });

    // --- Lógica de Socket.IO ---
    socket.on('connect', () => console.log('Conectado al servidor como DJ.'));
    socket.on('sesion_actual', (initialSongs) => { songs = initialSongs; renderDashboard(); });
    socket.on('nueva_cancion', (newSong) => { songs.push(newSong); renderDashboard(); });
    socket.on('estado_actualizado', (updatedSong) => {
        const songIndex = songs.findIndex(s => s.id === updatedSong.id);
        if (songIndex !== -1) { songs[songIndex] = updatedSong; renderDashboard(); }
    });

    initializePage();
});
