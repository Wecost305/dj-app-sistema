document.addEventListener('DOMContentLoaded', () => {
    const welcomeMessage = document.getElementById('welcome-message');
    const clockEl = document.getElementById('clock');
    const eventFilter = document.getElementById('event-filter');
    
    // ... (variables para los KPIs y las gráficas) ...
    let hourlyChart, songsChart;

    async function initializePage() {
        // ¡CLAVE! Obtener los datos del usuario para esta página también
        try {
            const response = await fetch('/api/user');
            if (!response.ok) {
                window.location.href = '/login.html';
                return;
            }
            const user = await response.json();
            welcomeMessage.textContent = `Bienvenido, ${user.dj_name}`;
        } catch (error) {
            console.error('Error al cargar datos del usuario:', error);
            window.location.href = '/login.html';
        }

        // Iniciar reloj
        setInterval(() => { clockEl.textContent = new Date().toLocaleTimeString('es-ES'); }, 1000);

        // Cargar las estadísticas
        loadStats();
    }

    async function loadStats(evento_id = '') {
        // ... (Aquí va toda la lógica de loadStats que ya teníamos) ...
    }

    eventFilter.addEventListener('change', () => loadStats(eventFilter.value));

    initializePage();
});
