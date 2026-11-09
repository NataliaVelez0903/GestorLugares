"use strict";

/* =====================================================================
   GESTOR DE LUGARES VISITADOS
   Solo HTML5 + CSS + JavaScript puro (sin librerías ni servidor).

   APIs nativas que usamos:
   1. Drag & Drop de HTML5  -> arrastrar tarjetas a Favoritos
   2. Geolocation API       -> obtener la ubicación del usuario
   3. Canvas 2D             -> dibujar "mi ubicación" y los lugares
   4. localStorage          -> recordar los datos en futuras sesiones

   LÓGICA PROPIA DEL GRUPO 1:
   - Validaciones: 3-40 caracteres, caracteres permitidos y sin nombres
     repetidos (ignorando mayúsculas y tildes).
   - Regla de negocio: máximo 5 favoritos.
   - Se recuerda la última ubicación conocida si el GPS falla.
===================================================================== */


/* ---------------------------------------------------------------------
   1. CONSTANTES Y ESTADO
--------------------------------------------------------------------- */
const CLAVE_LUGARES = "lugares";                    // clave en localStorage
const CLAVE_POSICION = "gestorLugares.ultimaPosicion";
const MAX_FAVORITOS = 5;
const MIN_NOMBRE = 3;
const MAX_NOMBRE = 40;

const OPCIONES_GPS = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

// Referencias al DOM (se buscan una sola vez)
const formulario = document.getElementById("formulario");
const campoNombre = document.getElementById("nombre");
const errorNombre = document.getElementById("errorNombre");
const listaLugares = document.getElementById("listaLugares");
const listaFavoritos = document.getElementById("listaFavoritos");
const zonaLugares = document.getElementById("zonaLugares");
const zonaFavoritos = document.getElementById("zonaFavoritos");
const canvas = document.getElementById("canvasUbicacion");
const aviso = document.getElementById("aviso");

// Estado de la aplicación
let lugares = cargarJSON(CLAVE_LUGARES, []);   // [{id, nombre, favorito, fecha}]
let posicion = cargarJSON(CLAVE_POSICION, null); // {lat, lng, accuracy, fecha} | null


/* ---------------------------------------------------------------------
   2. PERSISTENCIA (localStorage)
--------------------------------------------------------------------- */

// Lee y convierte de JSON. Si no existe o está dañado, devuelve el valor por defecto.
function cargarJSON(clave, porDefecto) {
    try {
        const texto = localStorage.getItem(clave);
        return texto ? JSON.parse(texto) : porDefecto;
    } catch (error) {
        return porDefecto;
    }
}

function guardarJSON(clave, valor) {
    try {
        localStorage.setItem(clave, JSON.stringify(valor));
    } catch (error) {
        mostrarAviso("No se pudo guardar en este navegador.", true);
    }
}

const guardarLugares = () => guardarJSON(CLAVE_LUGARES, lugares);


/* ---------------------------------------------------------------------
   3. VALIDACIONES (funciones puras: reciben datos y devuelven un mensaje o null)
--------------------------------------------------------------------- */

// Quita tildes, pasa a minúscula y colapsa espacios: "  Café  Central " -> "cafe central"
function normalizar(texto) {
    return texto
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

// Devuelve el texto del error, o null si el nombre es válido.
function validarNombre(texto) {
    const limpio = texto.replace(/\s+/g, " ").trim();

    if (limpio === "") return "Escribe el nombre del lugar.";
    if (limpio.length < MIN_NOMBRE) return `Usa al menos ${MIN_NOMBRE} caracteres.`;
    if (limpio.length > MAX_NOMBRE) return `Usa como máximo ${MAX_NOMBRE} caracteres.`;

    // Debe empezar con letra o número; luego se permiten espacios y signos básicos.
    if (!/^[\p{L}\p{N}][\p{L}\p{N} .,'&()-]*$/u.test(limpio)) {
        return "Solo letras, números y . , ' & ( ) -";
    }

    const repetido = lugares.some(l => normalizar(l.nombre) === normalizar(limpio));
    if (repetido) return "Ya registraste un lugar con ese nombre.";

    return null;
}

function mostrarErrorNombre(texto) {
    errorNombre.textContent = texto || "";
    campoNombre.setAttribute("aria-invalid", texto ? "true" : "false");
}


/* ---------------------------------------------------------------------
   4. TARJETAS: crear, mostrar, mover y eliminar
--------------------------------------------------------------------- */

function agregarLugar(nombre) {
    lugares.push({
        id: Date.now(),
        nombre: nombre.replace(/\s+/g, " ").trim(),
        favorito: false,
        fecha: new Date().toISOString()
    });

    guardarLugares();
    mostrarLugares();
}

function eliminarLugar(id) {
    lugares = lugares.filter(l => l.id !== id);
    guardarLugares();
    mostrarLugares();
}

// REGLA DE NEGOCIO: no se pueden tener más de MAX_FAVORITOS.
// Devuelve true si el movimiento se hizo.
function moverLugar(id, aFavoritos) {
    const lugar = lugares.find(l => l.id === id);
    if (!lugar || lugar.favorito === aFavoritos) return false;

    const totalFavoritos = lugares.filter(l => l.favorito).length;
    if (aFavoritos && totalFavoritos >= MAX_FAVORITOS) {
        mostrarAviso(`Solo puedes tener ${MAX_FAVORITOS} favoritos. Quita uno primero.`, true);
        return false;
    }

    lugar.favorito = aFavoritos;
    guardarLugares();
    mostrarLugares();
    return true;
}

// Crea un botón pequeño con su clase y su acción
function crearBoton(texto, clase, alClick) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.textContent = texto;
    boton.className = clase;
    boton.addEventListener("click", alClick);
    return boton;
}

// Construye el elemento HTML de una tarjeta
function crearTarjeta(lugar) {
    const tarjeta = document.createElement("div");
    tarjeta.className = "tarjeta";
    tarjeta.draggable = true;

    const titulo = document.createElement("strong");
    titulo.textContent = lugar.nombre;           // textContent evita inyectar HTML (XSS)

    const fecha = new Date(lugar.fecha || lugar.id).toLocaleDateString("es-CO");

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `Registrado el ${fecha}`;

    // Botones: alternativa al arrastre (celular / teclado)
    const acciones = document.createElement("div");
    acciones.className = "acciones";
    if (lugar.favorito) {
        acciones.appendChild(crearBoton("Quitar ★", "btn-quitar", () => moverLugar(lugar.id, false)));
    } else {
        acciones.appendChild(crearBoton("★ Favorito", "btn-fav", () => moverLugar(lugar.id, true)));
    }
    acciones.appendChild(crearBoton("Eliminar", "btn-eliminar", () => eliminarLugar(lugar.id)));

    tarjeta.append(titulo, meta, acciones);

    // Eventos de arrastre: guardamos el id en el "paquete" de datos del drag
    tarjeta.addEventListener("dragstart", evento => {
        evento.dataTransfer.setData("text/plain", String(lugar.id));
        evento.dataTransfer.effectAllowed = "move";
        tarjeta.classList.add("arrastrada");
    });
    tarjeta.addEventListener("dragend", () => tarjeta.classList.remove("arrastrada"));

    return tarjeta;
}

// Vuelve a dibujar las dos columnas, los contadores y el canvas
function mostrarLugares() {
    listaLugares.replaceChildren();
    listaFavoritos.replaceChildren();

    lugares.forEach(lugar => {
        (lugar.favorito ? listaFavoritos : listaLugares).appendChild(crearTarjeta(lugar));
    });

    const nFavoritos = lugares.filter(l => l.favorito).length;
    const nLugares = lugares.length - nFavoritos;

    document.getElementById("totalLugares").textContent = lugares.length;
    document.getElementById("totalFavoritos").textContent = `${nFavoritos}/${MAX_FAVORITOS}`;
    document.getElementById("cantidadLugares").textContent = nLugares;
    document.getElementById("cantidadFavoritos").textContent = nFavoritos;

    if (nLugares === 0) listaLugares.appendChild(crearVacio("No hay lugares registrados"));
    if (nFavoritos === 0) listaFavoritos.appendChild(crearVacio("No hay favoritos"));

    dibujarCanvas();
}

function crearVacio(texto) {
    const p = document.createElement("p");
    p.className = "vacio";
    p.textContent = texto;
    return p;
}


/* ---------------------------------------------------------------------
   5. DRAG & DROP: las zonas reciben tarjetas
--------------------------------------------------------------------- */
function prepararZona(zona, esFavorito) {
    // dragover: hay que cancelar el comportamiento por defecto para PERMITIR soltar
    zona.addEventListener("dragover", evento => {
        evento.preventDefault();
        zona.classList.add("arrastrando");
    });

    zona.addEventListener("dragleave", evento => {
        if (!zona.contains(evento.relatedTarget)) zona.classList.remove("arrastrando");
    });

    zona.addEventListener("drop", evento => {
        evento.preventDefault();
        zona.classList.remove("arrastrando");
        const id = Number(evento.dataTransfer.getData("text/plain"));
        moverLugar(id, esFavorito);
    });
}

prepararZona(zonaLugares, false);
prepararZona(zonaFavoritos, true);


/* ---------------------------------------------------------------------
   6. FORMULARIO
--------------------------------------------------------------------- */
formulario.addEventListener("submit", evento => {
    evento.preventDefault();                       // evita recargar la página

    const error = validarNombre(campoNombre.value);
    mostrarErrorNombre(error);
    if (error) {
        campoNombre.focus();
        return;
    }

    agregarLugar(campoNombre.value);
    formulario.reset();
    mostrarAviso("Lugar agregado.");
});

// Al escribir se limpia el error para no molestar mientras corrige
campoNombre.addEventListener("input", () => mostrarErrorNombre(null));


/* ---------------------------------------------------------------------
   7. AVISOS (reemplazo de alert)
--------------------------------------------------------------------- */
let temporizadorAviso = null;

function mostrarAviso(texto, esError = false) {
    aviso.textContent = texto;
    aviso.className = esError ? "error-aviso" : "";
    aviso.hidden = false;
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => { aviso.hidden = true; }, 3500);
}


/* ---------------------------------------------------------------------
   8. CANVAS: punto de "mi ubicación"
--------------------------------------------------------------------- */

function dibujarCanvas() {
    const ctx = canvas.getContext("2d");
    const ancho = canvas.width;
    const alto = canvas.height;
    const cx = ancho / 2;
    const cy = alto / 2;

    ctx.clearRect(0, 0, ancho, alto);
    ctx.textAlign = "center";

    // Sin ubicación: solo un mensaje
    if (!posicion) {
        ctx.fillStyle = "#64748b";
        ctx.font = "18px Arial";
        ctx.fillText("Activa la ubicación para ver tu punto", cx, cy);
        return;
    }

    // Círculos decorativos alrededor del punto
    ctx.strokeStyle = "#bfdbfe";
    ctx.lineWidth = 1;
    [40, 80, 120].forEach(r => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
    });

    // MI UBICACIÓN: punto azul en el centro
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.fillStyle = "#2563eb33";               // halo translúcido
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fillStyle = "#2563eb";
    ctx.fill();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 16px Arial";
    ctx.fillText("Mi ubicación", cx, cy + 45);
    ctx.font = "13px Arial";
    ctx.fillStyle = "#64748b";
    ctx.fillText(`${posicion.lat.toFixed(4)}, ${posicion.lng.toFixed(4)}`, cx, cy + 65);
}


/* ---------------------------------------------------------------------
   9. GEOLOCALIZACIÓN
--------------------------------------------------------------------- */
function mostrarInfo(mensaje) {
    document.getElementById("ubicacion").textContent = mensaje;
}

function mensajeErrorGPS(error) {
    const mensajes = {
        1: "Permiso denegado. Activa la ubicación en el navegador.",
        2: "No se pudo determinar la ubicación.",
        3: "Se agotó el tiempo de espera."
    };
    return mensajes[error.code] || "Error desconocido de geolocalización.";
}

function textoPosicion(p) {
    return `Latitud: ${p.lat.toFixed(6)} | Longitud: ${p.lng.toFixed(6)} | Precisión: ${Math.round(p.accuracy)} m`;
}

function ubicarUsuario() {
    if (!("geolocation" in navigator)) {
        mostrarInfo("Tu navegador no soporta geolocalización.");
        return;
    }

    mostrarInfo("Buscando tu ubicación...");

    navigator.geolocation.getCurrentPosition(
        pos => {
            posicion = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                fecha: new Date().toISOString()
            };
            guardarJSON(CLAVE_POSICION, posicion);   // se recuerda para la próxima sesión
            mostrarInfo(textoPosicion(posicion));
            dibujarCanvas();                         // redibuja el punto con la nueva posición
        },
        error => {
            // Si falló pero hay una posición guardada, la usamos avisando que es antigua
            if (posicion) {
                const hora = new Date(posicion.fecha).toLocaleString("es-CO");
                mostrarInfo(`${mensajeErrorGPS(error)} Última ubicación conocida (${hora}): ${textoPosicion(posicion)}`);
            } else {
                mostrarInfo(mensajeErrorGPS(error));
            }
            dibujarCanvas();
        },
        OPCIONES_GPS
    );
}

document.getElementById("actualizarUbicacion").addEventListener("click", ubicarUsuario);


/* ---------------------------------------------------------------------
   10. INICIO
--------------------------------------------------------------------- */
mostrarLugares();
ubicarUsuario();
