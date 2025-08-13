document.addEventListener('DOMContentLoaded', () => {
    const usersTableBody = document.getElementById('users-table-body');
    const usersTable = document.getElementById('users-table');
    const loadingMessage = document.getElementById('loading-message');
    const welcomeMessage = document.getElementById('welcome-message');

    // Función para obtener el nombre del admin y mostrarlo
    const fetchAdminInfo = async () => {
        try {
            const response = await fetch('/api/user');
            if (!response.ok) throw new Error('No se pudo obtener la información del admin.');
            const admin = await response.json();
            welcomeMessage.textContent = `Admin: ${admin.dj_name}`;
        } catch (error) {
            console.error('Error:', error);
            welcomeMessage.textContent = 'Panel de Administración';
        }
    };

    // Función para cargar y mostrar la lista de usuarios
    const loadUsers = async () => {
        try {
            const response = await fetch('/api/admin/users');
            if (!response.ok) {
                throw new Error('No se pudo cargar la lista de usuarios. ¿Eres administrador?');
            }
            const users = await response.json();

            // Limpiar la tabla antes de llenarla
            usersTableBody.innerHTML = '';

            if (users.length === 0) {
                loadingMessage.textContent = 'No hay otros usuarios registrados.';
                return;
            }

            users.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.id}</td>
                    <td>${user.dj_name}</td>
                    <td>${user.email}</td>
                    <td><span class="status-badge status-${user.role === 'admin' ? 'reproducida' : 'pendiente'}">${user.role}</span></td>
                    <td>
                        <button class="action-btn cancel delete-btn" data-user-id="${user.id}" data-user-name="${user.dj_name}">Eliminar</button>
                    </td>
                `;
                usersTableBody.appendChild(row);
            });

            // Ocultar mensaje de carga y mostrar la tabla
            loadingMessage.style.display = 'none';
            usersTable.style.display = 'table'; // 'table' es el display correcto para una tabla

        } catch (error) {
            loadingMessage.textContent = `Error: ${error.message}`;
            loadingMessage.style.color = 'var(--neon-red)';
        }
    };

    // Función para manejar la eliminación de un usuario
    const handleDeleteUser = async (event) => {
        // Nos aseguramos de que el clic fue en un botón de eliminar
        if (!event.target.classList.contains('delete-btn')) {
            return;
        }

        const button = event.target;
        const userId = button.dataset.userId;
        const userName = button.dataset.userName;

        // Pedir confirmación antes de una acción destructiva
        const isConfirmed = confirm(`¿Estás seguro de que quieres eliminar al usuario "${userName}" (ID: ${userId})? Esta acción no se puede deshacer.`);

        if (!isConfirmed) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('El servidor rechazó la solicitud de eliminación.');
            }

            // Si la eliminación fue exitosa, eliminamos la fila de la tabla visualmente
            button.closest('tr').remove();
            alert(`Usuario "${userName}" eliminado con éxito.`);

        } catch (error) {
            console.error('Error al eliminar usuario:', error);
            alert('No se pudo eliminar el usuario. Revisa la consola para más detalles.');
        }
    };

    // --- INICIALIZACIÓN ---
    
    // Añadir el listener de clics a toda la tabla (event delegation)
    usersTableBody.addEventListener('click', handleDeleteUser);

    // Cargar todo al iniciar la página
    fetchAdminInfo();
    loadUsers();

    // Lógica del reloj (reutilizada del dashboard)
    const clockElement = document.getElementById('clock');
    if (clockElement) {
        setInterval(() => {
            clockElement.textContent = new Date().toLocaleTimeString('es-ES');
        }, 1000);
    }
});
