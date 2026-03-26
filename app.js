import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

let manifest = null;
let zonaActual = null;
let escenaActualIndex = 0;

let scene, camera, renderer, sphere, controls;

const zoneListEl = document.getElementById("zoneList");
const projectTitleEl = document.getElementById("projectTitle");
const sceneTitleEl = document.getElementById("sceneTitle");
const sceneInfoEl = document.getElementById("sceneInfo");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const overlayPanel = document.getElementById("overlayPanel");
const togglePanelBtn = document.getElementById("togglePanelBtn");

async function init() {
  try {
    initThree();

    const response = await fetch("Manifest.json");
    if (!response.ok) {
      throw new Error(`No se pudo cargar Manifest.json (${response.status})`);
    }

    manifest = await response.json();
    projectTitleEl.textContent = manifest.nombre || "Tour VR";

    renderBotonesZona();

    if (manifest.zonas?.length > 0) {
      cargarZona(manifest.zonas[0].id);
    }
  } catch (error) {
    console.error(error);
    sceneTitleEl.textContent = "Error al iniciar";
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

  renderer = new THREE.WebGLRenderer({ antialias: true });
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

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });

  window.addEventListener("resize", onWindowResize);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function renderBotonesZona() {
  zoneListEl.innerHTML = "";

  manifest.zonas.forEach((zona) => {
    const btn = document.createElement("button");
    btn.className = "zone-button";
    btn.textContent = `${zona.nombre} (${zona.imagenes.length})`;

    btn.addEventListener("click", () => cargarZona(zona.id));
    zoneListEl.appendChild(btn);
  });
}

function actualizarBotonesActivos() {
  const botones = zoneListEl.querySelectorAll(".zone-button");

  botones.forEach((btn, index) => {
    const zona = manifest.zonas[index];
    btn.classList.toggle("active", zona.id === zonaActual?.id);
  });
}

function cargarZona(zonaId) {
  zonaActual = manifest.zonas.find((z) => z.id === zonaId);
  if (!zonaActual) return;

  escenaActualIndex = 0;
  actualizarBotonesActivos();
  cargarEscena(0);
}

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
    },
    undefined,
    (error) => {
      console.error("Error cargando textura:", ruta, error);
      sceneTitleEl.textContent = "Error de carga";
      sceneInfoEl.textContent = `No se pudo cargar ${ruta}`;
    }
  );
}

function actualizarPanelInfo() {
  if (!zonaActual) return;

  const archivo = zonaActual.imagenes[escenaActualIndex];
  sceneTitleEl.textContent = `${zonaActual.nombre} - Escena ${escenaActualIndex + 1}`;
  sceneInfoEl.textContent = `Archivo: ${archivo}`;

  prevBtn.disabled = escenaActualIndex === 0;
  nextBtn.disabled = escenaActualIndex === zonaActual.imagenes.length - 1;
}

prevBtn.addEventListener("click", () => {
  if (escenaActualIndex > 0) {
    cargarEscena(escenaActualIndex - 1);
  }
});

nextBtn.addEventListener("click", () => {
  if (escenaActualIndex < zonaActual.imagenes.length - 1) {
    cargarEscena(escenaActualIndex + 1);
  }
});

fullscreenBtn.addEventListener("click", () => {
  const elem = document.documentElement;

  if (!document.fullscreenElement) {
    elem.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
});

togglePanelBtn?.addEventListener("click", () => {
  overlayPanel.classList.toggle("collapsed");
});

init();
