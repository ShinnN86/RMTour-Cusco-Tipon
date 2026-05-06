import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

let manifest = null;
let zonaActual = null;
let escenaActualIndex = 0;

let scene, camera, renderer, sphere, controls;
let raycaster, pointer;
let infoHotspot = null;

// Giroscopio nativo
let gyroActivo = false;
let gyroListenerActivo = false;
let yaw = 0;
let pitch = 0;

// Detección por apuntado
let gazeStartTime = null;
let infoAbiertaPorApuntado = false;

const GAZE_OPEN_DELAY = 700;
const CENTER_GAZE_RADIUS = 0.16;

// UI principal
const projectTitleEl = document.getElementById("projectTitle");
const sceneTitleEl = document.getElementById("sceneTitle");
const sceneInfoEl = document.getElementById("sceneInfo");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const overlayPanel = document.getElementById("overlayPanel");
const togglePanelBtn = document.getElementById("togglePanelBtn");
const floatingBtn = document.getElementById("floatingMenuBtn");
const gyroBtn = document.getElementById("gyroBtn");
const toggleMapBtn = document.getElementById("toggleMapBtn");
const miniMap = document.getElementById("miniMap");

// Menú Lugares
const lugaresToggleBtn = document.getElementById("lugaresToggleBtn");
const lugaresList = document.getElementById("lugaresList");
const lugaresChevron = document.getElementById("lugaresChevron");

// Modal de información
const infoBtn = document.getElementById("infoBtn");
const infoModalOverlay = document.getElementById("infoModalOverlay");
const closeInfoBtn = document.getElementById("closeInfoBtn");
const infoCardTitle = document.getElementById("infoCardTitle");
const infoCardContent = document.getElementById("infoCardContent");

// Puntero central
const centerPointer = document.getElementById("centerPointer");

// Mini mapa
const gpsMarker = document.getElementById("gpsMarker");
const mapPoints = document.querySelectorAll(".map-point");

// Coordenadas del mapa por zona
const mapaCoords = {
  zona1: { left: "39.5%", top: "72%" },
  zona2: { left: "65%", top: "29.5%" },
  zona3: { left: "75%", top: "19%" },
  zona4: { left: "19%", top: "30%" },
  zona5: { left: "28%", top: "4.5%" }
};

const infoEscenas = {
  zona1: [
    { 
      titulo: "Tipón", 
      texto: "Bienvenido a Tipón, un complejo arqueológico inca conocido por su avanzado sistema hidráulico y su armonía con la naturaleza." 
    },
    { 
      titulo: "Tipón", 
      texto: "Bienvenido a Tipón, un complejo arqueológico inca conocido por su avanzado sistema hidráulico y su armonía con la naturaleza." 
    },
    { 
      titulo: "Tipón", 
      texto: "Bienvenido a Tipón, un complejo arqueológico inca conocido por su avanzado sistema hidráulico y su armonía con la naturaleza." 
    }
  ],

  zona2: [
    { 
     titulo: "Sistema de riego", 
      texto: "El agua fluye de manera constante gracias a canales diseñados con gran precisión por los incas." 
    },
    { 
      titulo: "Sistema de riego", 
      texto: "El agua fluye de manera constante gracias a canales diseñados con gran precisión por los incas." 
    },
    { 
      titulo: "Sistema de riego", 
      texto: "El agua fluye de manera constante gracias a canales diseñados con gran precisión por los incas."
      } 
  ],

  zona3: [
    { 
       titulo: "Tipón", 
      texto: "Bienvenido a Tipón, un complejo arqueológico inca conocido por su avanzado sistema hidráulico y su armonía con la naturaleza." 
    },
    { 
       titulo: "Tipón", 
      texto: "Bienvenido a Tipón, un complejo arqueológico inca conocido por su avanzado sistema hidráulico y su armonía con la naturaleza." 
    },
    { 
      titulo: "Ingreso a Tipón", 
      texto: "Bienvenido a Tipón, un complejo arqueológico inca conocido por su avanzado sistema hidráulico y su armonía con la naturaleza." 
    }
  ],

  zona4: [
    { 
      titulo: "Tipón", 
      texto: "Bienvenido a Tipón, un complejo arqueológico inca conocido por su avanzado sistema hidráulico y su armonía con la naturaleza." 
    },
    { 
      titulo: "Tipón", 
      texto: "Bienvenido a Tipón, un complejo arqueológico inca conocido por su avanzado sistema hidráulico y su armonía con la naturaleza." 
    }
  ],

  zona5: [
    { 
       titulo: "Tipón", 
      texto: "Bienvenido a Tipón, un complejo arqueológico inca conocido por su avanzado sistema hidráulico y su armonía con la naturaleza." 
    },
    { 
      titulo: "Tipón", 
      texto: "Bienvenido a Tipón, un complejo arqueológico inca conocido por su avanzado sistema hidráulico y su armonía con la naturaleza." 
    }
  ]
};

function esMovil() {
  return /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent);
}

async function init() {
  try {
    initThree();

    const response = await fetch("./Manifest.json");
    if (!response.ok) {
      throw new Error(`No se pudo cargar Manifest.json (${response.status})`);
    }

    manifest = await response.json();
    projectTitleEl.textContent = manifest.nombre || "Tour VR";

    bindLugaresMenu();
    bindMiniMapa();

    if (gyroBtn) {
      gyroBtn.style.display = esMovil() ? "inline-block" : "none";
    }

    if (manifest.zonas?.length > 0) {
      cargarZona(manifest.zonas[0].id);
    } else {
      sceneTitleEl.textContent = "Sin escenas";
      sceneInfoEl.textContent = "No hay zonas registradas en el manifest.";
    }
  } catch (error) {
    console.error("Error al iniciar:", error);
    projectTitleEl.textContent = "Error";
    sceneTitleEl.textContent = "No se pudo iniciar";
    sceneInfoEl.textContent = error.message;
  }
}

function initThree() {
  const container = document.getElementById("panorama");

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    1,
    1100
  );
  camera.position.set(0, 0, 0.1);
  camera.rotation.order = "YXZ";

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;

  container.appendChild(renderer.domElement);
  document.body.appendChild(VRButton.createButton(renderer));

  const geometry = new THREE.SphereGeometry(500, 60, 40);
  geometry.scale(-1, 1, 1);

  const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  sphere = new THREE.Mesh(geometry, material);
  scene.add(sphere);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.rotateSpeed = -0.25;
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = Math.PI;

  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();

  renderer.domElement.addEventListener("click", onSceneClick);
  renderer.domElement.addEventListener("mousemove", onSceneMouseMove);

  crearHotspotInfo();

  renderer.setAnimationLoop(() => {
    if (!renderer.xr.isPresenting) {
      if (gyroActivo) {
        camera.rotation.order = "YXZ";
        camera.rotation.y = yaw;
        camera.rotation.x = pitch;
      } else {
        controls.update();
      }
    }

    if (infoHotspot) {
      infoHotspot.lookAt(camera.position);
    }

    detectarApuntadoAutomatico();
    renderer.render(scene, camera);
  });

  window.addEventListener("resize", onWindowResize);
}

function bindLugaresMenu() {
  lugaresToggleBtn?.addEventListener("click", () => {
    lugaresList?.classList.toggle("open");
    lugaresChevron?.classList.toggle("rotated");
  });

}
//Enlaza los eventos del mapa y caraga la zona
function bindMiniMapa() {
  mapPoints.forEach((point) => {
    point.addEventListener("click", () => {
      const zonaId = point.dataset.zona;
      if (zonaId) {
        cargarZona(zonaId);
      }
    });
  });
}
//Funcion para actualizar la posicion del marcador en el minimapa acorde a la zona seleccionada
function actualizarMiniMapa() { 
  if (!gpsMarker || !zonaActual) return;
  const pos = mapaCoords[zonaActual.id];
  if (!pos) return;
  gpsMarker.style.left = pos.left;
  gpsMarker.style.top = pos.top;
  mapPoints.forEach((point) => {
    point.classList.toggle("active", point.dataset.zona === zonaActual.id);
  });
}

function crearHotspotInfo() {
  if (infoHotspot) {
    scene.remove(infoHotspot);
    infoHotspot = null;
  }

  const group = new THREE.Group();

  const circleGeo = new THREE.CircleGeometry(6, 48);
  const circleMat = new THREE.MeshBasicMaterial({
    color: 0x00bcd4,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide
  });
  const circle = new THREE.Mesh(circleGeo, circleMat);
  group.add(circle);

  const ringGeo = new THREE.RingGeometry(7, 9, 48);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  group.add(ring);

  const sprite = crearTextoSprite("i");
  sprite.scale.set(6, 6, 1);
  sprite.position.set(0, 0, 1);
  group.add(sprite);

  group.position.set(0, -20, -120);
  group.userData.isInfoHotspot = true;

  infoHotspot = group;
  scene.add(infoHotspot);
}

function crearTextoSprite(texto) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "white";
  ctx.font = "bold 180px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(texto, canvas.width / 2, canvas.height / 2 + 8);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true
  });

  return new THREE.Sprite(material);
}

function onSceneMouseMove(event) {
  if (!infoHotspot) return;

  updatePointer(event);

  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObject(infoHotspot, true);

  renderer.domElement.style.cursor =
    intersects.length > 0 ? "pointer" : "default";
}

function onSceneClick(event) {
  if (!infoHotspot) return;
  if (infoModalOverlay && !infoModalOverlay.classList.contains("hidden")) return;

  updatePointer(event);

  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObject(infoHotspot, true);

  if (intersects.length > 0) {
    abrirInfoEscena();
  }
}

function updatePointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function detectarApuntadoAutomatico() {
  if (!infoHotspot || !camera || !raycaster || !zonaActual) return;

  if (infoModalOverlay && !infoModalOverlay.classList.contains("hidden")) {
    gazeStartTime = null;
    centerPointer?.classList.remove("active");
    return;
  }

  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

  const intersects = raycaster.intersectObject(infoHotspot, true);

  const screenPos = infoHotspot.position.clone().project(camera);
  const dentroDelCentro =
    Math.abs(screenPos.x) < CENTER_GAZE_RADIUS &&
    Math.abs(screenPos.y) < CENTER_GAZE_RADIUS &&
    screenPos.z < 1;

  const apuntando = intersects.length > 0 && dentroDelCentro;

  if (apuntando) {
    centerPointer?.classList.add("active");

    if (gazeStartTime === null) {
      gazeStartTime = performance.now();
    }

    const elapsed = performance.now() - gazeStartTime;

    if (elapsed >= GAZE_OPEN_DELAY && !infoAbiertaPorApuntado) {
      abrirInfoEscena();
      infoAbiertaPorApuntado = true;
    }
  } else {
    gazeStartTime = null;
    infoAbiertaPorApuntado = false;
    centerPointer?.classList.remove("active");
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function cargarZona(zonaId) {
  if (!manifest?.zonas) return;

  zonaActual = manifest.zonas.find((z) => z.id === zonaId);
  if (!zonaActual) return;

  escenaActualIndex = 0;
 // marcarLugarActivo(zonaId);
  actualizarMiniMapa();
  cargarEscena(0);
}

/*function marcarLugarActivo(zonaId) {
  document.querySelectorAll(".lugar-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.zona === zonaId);
  });
}*/

function cargarEscena(index) {
  if (!zonaActual) return;
  if (index < 0 || index >= zonaActual.imagenes.length) return;

  const ruta = `${zonaActual.ruta}${zonaActual.imagenes[index]}`;
  console.log("Cargando:", ruta);

  const loader = new THREE.TextureLoader();
  loader.load(
    ruta,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      sphere.material.map = texture;
      sphere.material.needsUpdate = true;

      escenaActualIndex = index;
      actualizarPanelInfo();
      cerrarInfoEscena();
      actualizarPosicionHotspot();

      gazeStartTime = null;
      infoAbiertaPorApuntado = false;
    },
    undefined,
    (error) => {
      console.error("Error cargando textura:", ruta, error);
      sceneTitleEl.textContent = "Error de carga";
      sceneInfoEl.textContent = `No se pudo cargar ${ruta}`;
    }
  );
}

function actualizarPosicionHotspot() {
  if (!infoHotspot || !zonaActual) return;

  if (zonaActual.id === "zona1") {
    infoHotspot.position.set(0, -20, -120);
  } else if (zonaActual.id === "zona2") {
    infoHotspot.position.set(40, -10, -110);
  } else if (zonaActual.id === "zona3") {
    infoHotspot.position.set(-45, -5, -115);
  } else if (zonaActual.id === "zona4") {
    infoHotspot.position.set(10, -8, -110);
  } else if (zonaActual.id === "zona5") {
    infoHotspot.position.set(-18, -12, -112);
  } else {
    infoHotspot.position.set(0, -20, -120);
  }
}

function actualizarPanelInfo() {
  if (!zonaActual) return;

  const archivo = zonaActual.imagenes[escenaActualIndex];
  sceneTitleEl.textContent =
    `${zonaActual.nombre} - Escena ${escenaActualIndex + 1}`;
  sceneInfoEl.textContent = `Archivo: ${archivo}`;

  prevBtn.disabled = escenaActualIndex === 0;
  nextBtn.disabled = escenaActualIndex === zonaActual.imagenes.length - 1;
}

function abrirInfoEscena() {
  if (!zonaActual || !infoModalOverlay || !infoCardTitle || !infoCardContent) return;

  const dataZona = infoEscenas[zonaActual.id];
  const dataEscena = dataZona?.[escenaActualIndex];

  infoCardTitle.textContent =
    dataEscena?.titulo ||
    `${zonaActual.nombre} - Escena ${escenaActualIndex + 1}`;

  infoCardContent.textContent =
    dataEscena?.texto || "No hay información registrada para esta escena.";

  infoModalOverlay.classList.remove("hidden");
}

function cerrarInfoEscena() {
  if (!infoModalOverlay) return;

  infoModalOverlay.classList.add("hidden");
  gazeStartTime = null;
  infoAbiertaPorApuntado = false;
  centerPointer?.classList.remove("active");
}

function manejarOrientacion(event) {
  if (!gyroActivo) return;

  const alpha = event.alpha;
  const beta = event.beta;

  if (alpha == null || beta == null) return;

  yaw = THREE.MathUtils.degToRad(alpha);
  const betaClamped = Math.max(-85, Math.min(85, beta));
  pitch = THREE.MathUtils.degToRad(betaClamped);
}

async function activarGiroscopio() {
  if (!esMovil()) return;

  try {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      const permission = await DeviceOrientationEvent.requestPermission();

      if (permission !== "granted") {
        alert("No se concedió permiso para usar el giroscopio.");
        return;
      }
    }

    if (!gyroListenerActivo) {
      window.addEventListener("deviceorientation", manejarOrientacion, true);
      gyroListenerActivo = true;
    }

    gyroActivo = true;
    controls.enabled = false;

    if (gyroBtn) {
      gyroBtn.textContent = "Gyro ON";
    }
  } catch (error) {
    console.error("Error activando giroscopio:", error);
    alert("No se pudo activar el giroscopio en este dispositivo.");
  }
}

function desactivarGiroscopio() {
  gyroActivo = false;
  controls.enabled = true;

  if (gyroBtn) {
    gyroBtn.textContent = "Giroscopio";
  }
}

prevBtn?.addEventListener("click", () => {
  if (escenaActualIndex > 0) {
    cargarEscena(escenaActualIndex - 1);
  }
});

nextBtn?.addEventListener("click", () => {
  if (zonaActual && escenaActualIndex < zonaActual.imagenes.length - 1) {
    cargarEscena(escenaActualIndex + 1);
  }
});

fullscreenBtn?.addEventListener("click", async () => {
  const elem = document.documentElement;

  if (!document.fullscreenElement) {
    await elem.requestFullscreen?.();
  } else {
    await document.exitFullscreen?.();
  }
});

// estado inicial
floatingBtn.style.display = "none";

// botón del panel (cerrar/abrir)
togglePanelBtn?.addEventListener("click", () => {
  overlayPanel.classList.toggle("collapsed");

  const isClosed = overlayPanel.classList.contains("collapsed");

  floatingBtn.style.display = isClosed ? "block" : "none";
});

// botón flotante (abrir)
floatingBtn?.addEventListener("click", () => {
  overlayPanel.classList.remove("collapsed");
  floatingBtn.style.display = "none";
});


infoBtn?.addEventListener("click", abrirInfoEscena);
closeInfoBtn?.addEventListener("click", cerrarInfoEscena);

toggleMapBtn.addEventListener("click", () => {
  miniMap.classList.toggle("hidden");
});

gyroBtn?.addEventListener("click", async () => {
  if (!esMovil()) return;

  if (gyroActivo) {
    desactivarGiroscopio();
  } else {
    await activarGiroscopio();
  }
});

infoModalOverlay?.addEventListener("click", (e) => {
  if (e.target === infoModalOverlay) {
    cerrarInfoEscena();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    cerrarInfoEscena();
  }
});
const expandMapBtn = document.getElementById("expandMapBtn");
const closeMapBtn = document.getElementById("closeMapBtn");
const mapOverlay = document.getElementById("mapOverlay");
const miniMapCanvas = document.getElementById("miniMapCanvas");
const mapExpandedContent = document.getElementById("mapExpandedContent");

expandMapBtn?.addEventListener("click", () => {
  abrirMapaGrande();
});

closeMapBtn?.addEventListener("click", () => {
  cerrarMapaGrande();
});

function abrirMapaGrande() {
  if (!miniMapCanvas || !mapExpandedContent) return;

  // Clonar mapa
  const clone = miniMapCanvas.cloneNode(true);

  // limpiar contenedor
  mapExpandedContent.innerHTML = "";
  mapExpandedContent.appendChild(clone);

  mapOverlay.classList.remove("hidden");

  // volver a bindear eventos del mapa
  const puntos = clone.querySelectorAll(".map-point");
  puntos.forEach(p => {
    p.addEventListener("click", () => {
      const zonaId = p.dataset.zona;
      if (zonaId) cargarZona(zonaId);
      cerrarMapaGrande();
    });
  });

  // actualizar gps
  const gps = clone.querySelector("#gpsMarker");
  if (gps && zonaActual) {
    const pos = mapaCoords[zonaActual.id];
    if (pos) {
      gps.style.left = pos.left;
      gps.style.top = pos.top;
    }
  }
}

function cerrarMapaGrande() {
  mapOverlay.classList.add("hidden");
}



init();
