document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const djSlug = params.get('dj');

    // Elementos del DOM
    const djNameTitle = document.getElementById('dj-name-title');
    const formWrapper = document.getElementById('form-wrapper');
    const songRequestForm = document.getElementById('song-request-form');
    const statusMessage = document.getElementById('status-message');
    const loadingSpinner = document.getElementById('loading-spinner');

    if (!djSlug) {
        loadingSpinner.style.display = 'none';
        djNameTitle.textContent = "Error";
        statusMessage.textContent = "URL inválida. No se especificó un DJ.";
        return;
    }

    try {
        const response = await fetch(`/api/sala/${djSlug}`);
        const djData = await response.json();

        if (!response.ok) throw new Error(djData.message || 'No se pudo encontrar al DJ.');

        // Ocultar spinner y mostrar el título y formulario
        loadingSpinner.style.display = 'none';
        djNameTitle.textContent = `Pide tu Canción para ${djData.dj_name}`;
        formWrapper.style.display = 'block';

        if (djData.is_accepting_requests) {
            // La sala está ABIERTA
            statusMessage.textContent = '¡Envía tu solicitud!';
            statusMessage.style.color = '#39ff14';

            songRequestForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitButton = songRequestForm.querySelector('button');
                submitButton.disabled = true;
                submitButton.textContent = 'Enviando...';

                try {
                    const requestBody = {
                        cancion: document.getElementById('cancion').value,
                        solicitante: document.getElementById('solicitante').value,
                        dedicatoria: document.getElementById('dedicatoria').value,
                        dj_id: djData.id
                    };

                    const submitResponse = await fetch('/api/solicitud', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody)
                    });

                    if (!submitResponse.ok) throw new Error('El servidor rechazó la solicitud.');

                    statusMessage.textContent = '¡Tu solicitud fue enviada con éxito!';
                    statusMessage.style.color = '#00f2ff';
                    songRequestForm.reset();

                } catch (error) {
                    statusMessage.textContent = 'No se pudo enviar. Inténtalo de nuevo.';
                    statusMessage.style.color = '#ff4500';
                } finally {
                    submitButton.disabled = false;
                    submitButton.textContent = 'Enviar Solicitud';
                }
            });
        } else {
            // La sala está CERRADA
            formWrapper.style.display = 'none';
            statusMessage.textContent = `Lo sentimos, ${djData.dj_name} no está aceptando solicitudes en este momento.`;
            statusMessage.style.color = '#ff4500';
        }
    } catch (error) {
        loadingSpinner.style.display = 'none';
        djNameTitle.textContent = "Error de Conexión";
        statusMessage.textContent = `No se pudo contactar al sistema. (${error.message})`;
        statusMessage.style.color = '#ff4500';
    }
});
