// --- public/auth.js (Versión Corregida y Mejorada) ---

document.addEventListener('DOMContentLoaded', () => {
    // --- LÓGICA PARA EL FORMULARIO DE LOGIN ---
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        // ¡CORRECCIÓN! Buscar el div de error por su ID específico.
        const statusMessage = document.getElementById('error-message');

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevenir la recarga de la página

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const submitButton = loginForm.querySelector('button');

            // Mostrar feedback al usuario
            submitButton.disabled = true;
            statusMessage.textContent = 'Iniciando sesión...';
            statusMessage.style.color = '#00f2ff'; // Azul neón

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    // Si la respuesta no es 2xx, lanzar un error con el mensaje del servidor
                    throw new Error(data.message || 'Error desconocido.');
                }

                // Si el login es exitoso (respuesta 200 OK)
                statusMessage.textContent = '¡Éxito! Redirigiendo...';
                statusMessage.style.color = '#39ff14'; // Verde neón
                
                // Redirigimos al dashboard principal
                window.location.href = '/';

            } catch (error) {
                // Si hay un error, mostrarlo en el div de estado
                statusMessage.textContent = `Error: ${error.message}`;
                statusMessage.style.color = '#ff4500'; // Rojo/Naranja
                submitButton.disabled = false; // Volver a habilitar el botón
            }
        });
    }

    // --- LÓGICA PARA EL FORMULARIO DE REGISTRO ---
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        // ¡CORRECCIÓN! Buscar el div de error por su ID específico también aquí.
        const statusMessage = document.getElementById('error-message');

        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dj_name = document.getElementById('dj_name').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const submitButton = registerForm.querySelector('button');

            submitButton.disabled = true;
            statusMessage.textContent = 'Registrando...';
            statusMessage.style.color = '#00f2ff';

            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dj_name, email, password })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Error al registrar.');
                }

                statusMessage.textContent = '¡Registro exitoso! Redirigiendo a la página de login...';
                statusMessage.style.color = '#39ff14';

                // Esperar un momento para que el usuario vea el mensaje antes de redirigir
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 1500);

            } catch (error) {
                statusMessage.textContent = `Error: ${error.message}`;
                statusMessage.style.color = '#ff4500';
                submitButton.disabled = false;
            }
        });
    }
});
