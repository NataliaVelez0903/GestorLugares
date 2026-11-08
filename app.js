
const formulario = document.getElementById("formulario");
const nombre = document.getElementById("nombre");
const listaLugares = document.getElementById("listaLugares");
const listaFavoritos = document.getElementById("listaFavoritos");
const zonaLugares = document.getElementById("zonaLugares");
const zonaFavoritos = document.getElementById("zonaFavoritos");

let lugares = JSON.parse(localStorage.getItem("lugares")) || [];

// Guardar los lugares
function guardarLugares() {
    localStorage.setItem("lugares", JSON.stringify(lugares));
}

// Agregar un lugar
formulario.addEventListener("submit", function(evento) {
    evento.preventDefault();

    const nuevoNombre = nombre.value.trim();
    if (nuevoNombre === "") return;

    const lugar = {
        id: Date.now(),
        nombre: nuevoNombre,
        favorito: false
    };

    lugares.push(lugar);
    guardarLugares();
    mostrarLugares();
    formulario.reset();
});

// Mostrar las tarjetas
function mostrarLugares() {
    listaLugares.innerHTML = "";
    listaFavoritos.innerHTML = "";

    lugares.forEach(function(lugar) {
        const tarjeta = document.createElement("div");
        tarjeta.className = "tarjeta";
        tarjeta.draggable = true;

        const texto = document.createElement("strong");
        texto.textContent = lugar.nombre;

        const boton = document.createElement("button");
        boton.textContent = "Eliminar";

        boton.addEventListener("click", function() {
            eliminarLugar(lugar.id);
        });

        tarjeta.appendChild(texto);
        tarjeta.appendChild(boton);

        tarjeta.addEventListener("dragstart", function(evento) {
            evento.dataTransfer.setData("text/plain", String(lugar.id));
        });

        if (lugar.favorito) {
            listaFavoritos.appendChild(tarjeta);
        } else {
            listaLugares.appendChild(tarjeta);
        }
    });

    const cantidadFavoritos = lugares.filter(lugar => lugar.favorito).length;
    const cantidadLugares = lugares.length - cantidadFavoritos;

    document.getElementById("totalLugares").textContent = lugares.length;
    document.getElementById("cantidadLugares").textContent = cantidadLugares;
    document.getElementById("cantidadFavoritos").textContent = cantidadFavoritos;

    if (cantidadLugares === 0) {
        listaLugares.innerHTML = '<p class="vacio">No hay lugares registrados</p>';
    }

    if (cantidadFavoritos === 0) {
        listaFavoritos.innerHTML = '<p class="vacio">No hay favoritos</p>';
    }
}

// Eliminar un lugar
function eliminarLugar(id) {
    lugares = lugares.filter(lugar => lugar.id !== id);
    guardarLugares();
    mostrarLugares();
}

// Mover tarjetas entre las dos zonas
function prepararZona(zona, esFavorito) {
    zona.addEventListener("dragover", function(evento) {
        evento.preventDefault();
        zona.classList.add("arrastrando");
    });

    zona.addEventListener("dragleave", function(evento) {
        if (!zona.contains(evento.relatedTarget)) {
            zona.classList.remove("arrastrando");
        }
    });

    zona.addEventListener("drop", function(evento) {
        evento.preventDefault();
        zona.classList.remove("arrastrando");

        const id = Number(evento.dataTransfer.getData("text/plain"));
        const lugar = lugares.find(lugar => lugar.id === id);

        if (lugar) {
            lugar.favorito = esFavorito;
            guardarLugares();
            mostrarLugares();
        }
    });
}

prepararZona(zonaLugares, false);
prepararZona(zonaFavoritos, true);



/* =====================================
   UBICACIÓN DEL USUARIO
===================================== */

// Coordenadas iniciales de Manizales
const CENTRO_INICIAL = [5.0689, -75.5174];

// Crear el mapa
const mapa = L.map("mapa").setView(CENTRO_INICIAL, 13);

// Agregar OpenStreetMap
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(mapa);

// Configuración del GPS
const OPCIONES_GPS = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0
};

let marcadorUsuario = null;
let circuloPrecision = null;
let ultimaPosicion = null;

// Mostrar mensajes
function mostrarInfo(mensaje) {
    document.getElementById("ubicacion").textContent = mensaje;
}

// Manejar errores de ubicación
function mensajeErrorGPS(error) {
    const mensajes = {
        1: "Permiso denegado. Activa la ubicación en el navegador.",
        2: "No se pudo determinar la ubicación.",
        3: "Se agotó el tiempo de espera."
    };

    return mensajes[error.code] || "Error desconocido de geolocalización.";
}

// Mostrar la ubicación en el mapa
function pintarUbicacion(pos) {
    const { latitude, longitude, accuracy } = pos.coords;

    ultimaPosicion = {
        lat: latitude,
        lng: longitude,
        accuracy
    };

    const lugar = [latitude, longitude];

    // Eliminar marcador anterior
    if (marcadorUsuario) {
        mapa.removeLayer(marcadorUsuario);
    }

    // Eliminar círculo anterior
    if (circuloPrecision) {
        mapa.removeLayer(circuloPrecision);
    }

    // Crear marcador de ubicación
    marcadorUsuario = L.marker(lugar)
        .addTo(mapa)
        .bindPopup("Mi ubicación");

    // Crear círculo de precisión
    circuloPrecision = L.circle(lugar, {
        radius: accuracy,
        color: "#2563eb",
        fillOpacity: 0.15
    }).addTo(mapa);

    // Centrar mapa en el usuario
    mapa.setView(lugar, 17);
    marcadorUsuario.openPopup();

    // Dibujar el punto en el canvas
    dibujarCanvas();
}

// Dibujar ubicación en el canvas
function dibujarCanvas() {
    const canvas = document.getElementById("canvasUbicacion");
    const contexto = canvas.getContext("2d");

    contexto.clearRect(0, 0, canvas.width, canvas.height);

    const x = 65;
    const y = canvas.height / 2;

    contexto.beginPath();
    contexto.arc(x, y, 9, 0, Math.PI * 2);
    contexto.fillStyle = "#2563eb";
    contexto.fill();

    contexto.fillStyle = "#1e293b";
    contexto.font = "15px Arial";
    contexto.textAlign = "left";
    contexto.fillText("Mi ubicación actual", x + 25, y + 5);
}

// Solicitar ubicación
function solicitarUbicacion(alExito) {
    if (!("geolocation" in navigator)) {
        mostrarInfo("Tu navegador no soporta geolocalización.");
        return;
    }

    mostrarInfo("Buscando tu ubicación...");

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            pintarUbicacion(pos);
            alExito(pos);
        },
        (error) => {
            mostrarInfo(mensajeErrorGPS(error));
        },
        OPCIONES_GPS
    );
}

// Ubicar al usuario
function ubicarUsuario() {
    solicitarUbicacion((pos) => {
        const { latitude, longitude, accuracy } = pos.coords;

        mostrarInfo(
            `Latitud: ${latitude.toFixed(6)} | Longitud: ${longitude.toFixed(6)} | Precisión: ${Math.round(accuracy)} m`
        );
    });
}

// Botón para actualizar ubicación
document.getElementById("actualizarUbicacion")
    .addEventListener("click", ubicarUsuario);

// Iniciar aplicación
mostrarLugares();
ubicarUsuario();
