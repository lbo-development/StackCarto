import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  ZoomControl,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./MapLayout.css";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

import roadImg from "../assets/map-road.png";
import satelliteImg from "../assets/map-satellite.png";
import CartoTree from "./CartoTree";
import PlanViewer from "./PlanViewer";
import { fetchCartoTree } from "../lib/cartoApi";
import { supabase } from "../lib/supabase";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const CENTER = [43.2965, 5.3698];
const DEFAULT_MAP_ZOOM = 13;
const DEFAULT_FEATURE_ZOOM = 16;
const PLAN_BUCKET = "documents_services";

const rawApiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

function normalizeApiBaseUrl(url) {
  if (!url) return "http://localhost:4000";

  const trimmed = url.trim().replace(/\/+$/, "");

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

const API_BASE_URL = normalizeApiBaseUrl(rawApiBaseUrl);

function ResizeMap({ menuOpen, selectedFeature }) {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [map, menuOpen, selectedFeature]);

  return null;
}

function MapInstanceCapture({ mapRef }) {
  const map = useMap();

  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);

  return null;
}

function LayersIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="basemap-dock-layers-icon"
      aria-hidden="true"
    >
      <path
        d="M12 4 20 8 12 12 4 8 12 4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 11 12 14.5 18.5 11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 14.5 12 18 18.5 14.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BasemapSwitcher({
  basemap,
  setBasemap,
  onToggleLayers,
  layersOpen,
  layersEnabled,
  activeLayersCount,
}) {
  const options = [
    { key: "road", label: "Route", img: roadImg },
    { key: "satellite", label: "Satellite", img: satelliteImg },
  ];

  return (
    <div
      className="basemap-dock"
      role="group"
      aria-label="Choix du fond de carte"
    >
      {options.map((option) => {
        const active = basemap === option.key;

        return (
          <button
            key={option.key}
            type="button"
            className={`basemap-dock-item ${active ? "active" : ""}`}
            onClick={() => setBasemap(option.key)}
            aria-pressed={active}
          >
            <span className="basemap-dock-thumb-wrap">
              <img src={option.img} alt="" className="basemap-dock-thumb" />
            </span>
            <span className="basemap-dock-label">{option.label}</span>
          </button>
        );
      })}

      <button
        type="button"
        className={`basemap-dock-item ${layersOpen ? "active" : ""}`}
        onClick={onToggleLayers}
        aria-pressed={layersOpen}
        aria-label="Afficher les calques disponibles"
        title={
          layersEnabled
            ? "Afficher les calques disponibles"
            : "Sélectionnez un service, un site ou une installation"
        }
        disabled={!layersEnabled}
      >
        <span className="basemap-dock-thumb-wrap basemap-dock-thumb-wrap--icon layers-icon-wrap">
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="#2563eb"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="12 3 3 8 12 13 21 8 12 3" fill="#60a5fa" />
            <polyline points="3 12 12 17 21 12" />
            <polyline points="3 16 12 21 21 16" />
          </svg>

          {activeLayersCount > 0 && <span className="layers-badge-dot" />}
        </span>

        <span className="basemap-dock-label">Calques</span>
      </button>
    </div>
  );
}

function LayersPanel({
  open,
  contextLabel,
  layers,
  loading,
  error,
  onClose,
  onToggleLayer,
  position,
  onPositionChange,
}) {
  const panelRef = useRef(null);
  const dragStateRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  const startDrag = useCallback(
    (clientX, clientY) => {
      dragStateRef.current = {
        dragging: true,
        startX: clientX,
        startY: clientY,
        originX: position.x,
        originY: position.y,
      };
    },
    [position.x, position.y],
  );

  const onMouseDownHeader = useCallback(
    (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      startDrag(event.clientX, event.clientY);
    },
    [startDrag],
  );

  const onTouchStartHeader = useCallback(
    (event) => {
      const touch = event.touches?.[0];
      if (!touch) return;
      startDrag(touch.clientX, touch.clientY);
    },
    [startDrag],
  );

  useEffect(() => {
    function moveAt(clientX, clientY) {
      if (!dragStateRef.current.dragging) return;

      const dx = clientX - dragStateRef.current.startX;
      const dy = clientY - dragStateRef.current.startY;

      const panel = panelRef.current;
      const parent = panel?.offsetParent;

      let nextX = dragStateRef.current.originX + dx;
      let nextY = dragStateRef.current.originY + dy;

      if (panel && parent) {
        const maxX = Math.max(0, parent.clientWidth - panel.offsetWidth);
        const maxY = Math.max(0, parent.clientHeight - panel.offsetHeight);

        nextX = Math.min(Math.max(0, nextX), maxX);
        nextY = Math.min(Math.max(0, nextY), maxY);
      }

      onPositionChange({ x: nextX, y: nextY });
    }

    function handleMouseMove(event) {
      moveAt(event.clientX, event.clientY);
    }

    function handleTouchMove(event) {
      const touch = event.touches?.[0];
      if (!touch) return;
      moveAt(touch.clientX, touch.clientY);
    }

    function stopDrag() {
      dragStateRef.current.dragging = false;
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopDrag);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", stopDrag);
    window.addEventListener("touchcancel", stopDrag);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopDrag);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", stopDrag);
      window.removeEventListener("touchcancel", stopDrag);
    };
  }, [onPositionChange]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="layers-panel layers-panel--draggable"
      role="dialog"
      aria-modal="false"
      aria-label="Calques disponibles"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div
        className="layers-panel__header layers-panel__header--draggable"
        onMouseDown={onMouseDownHeader}
        onTouchStart={onTouchStartHeader}
      >
        <div>
          <div className="layers-panel__title">Calques</div>
          <div className="layers-panel__subtitle">
            {contextLabel || "Aucun contexte sélectionné"}
          </div>
        </div>

        <button
          type="button"
          className="layers-panel__close"
          onClick={onClose}
          aria-label="Fermer le panneau des calques"
        >
          ×
        </button>
      </div>

      {loading ? (
        <div className="layers-panel__state">Chargement des calques...</div>
      ) : error ? (
        <div className="layers-panel__state layers-panel__state--error">
          {error}
        </div>
      ) : layers.length === 0 ? (
        <div className="layers-panel__state">
          Aucun calque disponible pour cette carte.
        </div>
      ) : (
        <div className="layers-panel__list">
          {layers.map((layer) => (
            <label key={layer.id_calque} className="layers-panel__item">
              <input
                type="checkbox"
                checked={Boolean(layer.visible)}
                onChange={() => onToggleLayer(layer.id_calque)}
              />
              <span className="layers-panel__item-text">
                <span className="layers-panel__item-label">
                  {layer.lib_calque || layer.code_calque || "Calque sans nom"}
                </span>
                {layer.description_calque ? (
                  <span className="layers-panel__item-description">
                    {layer.description_calque}
                  </span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function SelectedMarker({ feature }) {
  const map = useMap();

  let lat = null;
  let lng = null;

  if (
    feature?.geometry?.type === "Point" &&
    Array.isArray(feature.geometry.coordinates) &&
    feature.geometry.coordinates.length >= 2
  ) {
    [lng, lat] = feature.geometry.coordinates;
  } else if (
    feature?.center &&
    Number.isFinite(feature.center.lat) &&
    Number.isFinite(feature.center.lng)
  ) {
    lat = feature.center.lat;
    lng = feature.center.lng;
  }

  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const zoom =
      Number.isFinite(feature?.zoom) && feature.zoom > 0
        ? feature.zoom
        : DEFAULT_FEATURE_ZOOM;

    map.flyTo([lat, lng], zoom, { duration: 0.8 });
  }, [feature, lat, lng, map]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return (
    <Marker key={`${feature.type}-${feature.id}`} position={[lat, lng]}>
      <Popup>
        {feature.type === "site" ? (
          <div>
            <strong>📍 Site</strong>
            <div>{feature.nom}</div>
            {feature.code ? <div>Code : {feature.code}</div> : null}
          </div>
        ) : feature.type === "service" ? (
          <div>
            <strong>🧩 Service</strong>
            <div>{feature.nom}</div>
            {feature.code ? <div>Code : {feature.code}</div> : null}
          </div>
        ) : feature.type === "installation" ? (
          <div>
            <strong>🏗️ Installation</strong>
            <div>{feature.nom}</div>
            {feature.code ? <div>Code : {feature.code}</div> : null}
          </div>
        ) : (
          <div>
            <strong>{feature.nom}</strong>
          </div>
        )}
      </Popup>
    </Marker>
  );
}

export default function MapLayout({
  session,
  profile,
  onLoginClick,
  onLogout,
}) {
  const mapRef = useRef(null);

  const [menuOpen, setMenuOpen] = useState(true);
  const [basemap, setBasemap] = useState("road");

  const [treeAction, setTreeAction] = useState(null);
  const [treeActionToken, setTreeActionToken] = useState(0);

  const [treeData, setTreeData] = useState([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [treeError, setTreeError] = useState("");

  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedFeature, setSelectedFeature] = useState(null);

  const [viewMode, setViewMode] = useState("map");
  const [activePlan, setActivePlan] = useState(null);

  const [layersOpen, setLayersOpen] = useState(false);
  const [layersLoading, setLayersLoading] = useState(false);
  const [layersError, setLayersError] = useState("");
  const [availableLayers, setAvailableLayers] = useState([]);
  const [layerContext, setLayerContext] = useState(null);
  const [layersPanelPosition, setLayersPanelPosition] = useState({
    x: 0,
    y: 18,
  });
  useEffect(() => {
    if (!layersOpen) return;

    const panelWidth = 320;
    const rightMargin = 14;

    const mapShell = document.querySelector(".map-shell");
    const panel = document.querySelector(".layers-panel");
    if (!mapShell || !panel) return;
    const margin = 16;
    setLayersPanelPosition({
      x: mapShell.clientWidth - panel.offsetWidth - margin,
      y: 18,
    });
    const nextX = Math.max(0, mapShell.clientWidth - panelWidth - rightMargin);

    setLayersPanelPosition((prev) => ({
      x: nextX,
      y: prev?.y ?? 18,
    }));
  }, [layersOpen]);

  const activeLayersCount = useMemo(
    () => availableLayers.filter((layer) => Boolean(layer.visible)).length,
    [availableLayers],
  );

  const toggleMenu = useCallback(() => {
    setMenuOpen((prev) => !prev);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const reloadTree = useCallback(async () => {
    if (!session) {
      setTreeData([]);
      setTreeLoading(false);
      setTreeError("");
      return;
    }

    try {
      setTreeLoading(true);
      setTreeError("");

      const data = await fetchCartoTree();
      setTreeData(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erreur chargement arborescence :", error);
      setTreeError("Impossible de charger l'arborescence.");
      setTreeData([]);
    } finally {
      setTreeLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session) {
      setTreeData([]);
      setTreeLoading(false);
      setTreeError("");
      return;
    }

    reloadTree();
  }, [session, reloadTree]);

  const basemapConfig = useMemo(() => {
    if (basemap === "satellite") {
      return {
        key: "satellite",
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution:
          "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      };
    }

    return {
      key: "road",
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: "&copy; OpenStreetMap contributors",
    };
  }, [basemap]);

  const closePlan = useCallback(() => {
    setActivePlan(null);
    setViewMode("map");
  }, []);

  const openPlan = useCallback(async (node) => {
    const rawPath = node?.data?.path_file ?? node?.path_file ?? null;

    if (!rawPath) {
      console.error("Aucun path_file trouvé pour le plan :", node);
      return;
    }

    try {
      const { data } = supabase.storage.from(PLAN_BUCKET).getPublicUrl(rawPath);

      setActivePlan({
        id: node?.data?.fileId ?? node?.fileId ?? node?.id,
        title:
          node?.label ??
          node?.data?.lib_file ??
          node?.data?.name_file ??
          node?.name_file ??
          "Plan",
        url: data?.publicUrl,
        path_file: rawPath,
        name_file: node?.data?.name_file ?? node?.name_file ?? null,
        mime_type: node?.data?.mime_type ?? node?.mime_type ?? null,
        svg_width: node?.data?.svg_width ?? node?.svg_width ?? null,
        svg_height: node?.data?.svg_height ?? node?.svg_height ?? null,
        svg_viewbox: node?.data?.svg_viewbox ?? node?.svg_viewbox ?? null,
      });

      setSelectedFeature(null);
      setViewMode("plan");
    } catch (error) {
      console.error("Erreur ouverture plan :", error);
    }
  }, []);

  const flyToNodeCenter = useCallback((node) => {
    const center = node?.center ?? node?.data?.center ?? null;
    const zoom = node?.zoom ?? node?.data?.zoom ?? DEFAULT_FEATURE_ZOOM;

    if (
      mapRef.current &&
      center &&
      Number.isFinite(center.lat) &&
      Number.isFinite(center.lng)
    ) {
      mapRef.current.flyTo(
        [center.lat, center.lng],
        Number(zoom) || DEFAULT_FEATURE_ZOOM,
        { duration: 0.8 },
      );
    }
  }, []);

  const loadLayersForNode = useCallback(async (node) => {
    const nodeType = node?.type ?? null;

    if (
      nodeType !== "site" &&
      nodeType !== "service" &&
      nodeType !== "installation"
    ) {
      setLayerContext(null);
      setAvailableLayers([]);
      setLayersError("");
      setLayersLoading(false);
      return;
    }

    // 🔥 EXTRACTION UUID depuis node.id
    let contextId = null;

    if (typeof node?.id === "string") {
      const parts = node.id.split("-");
      contextId = parts.slice(1).join("-");
    }

    const context = {
      type: nodeType,
      id: contextId,
      label: node?.label ?? "Sans nom",
    };

    console.log("MAP LAYERS CONTEXT =", context);

    setLayerContext(context);

    if (!context.id) {
      setAvailableLayers([]);
      setLayersError("Contexte de carte incomplet.");
      setLayersLoading(false);
      return;
    }

    try {
      setLayersLoading(true);
      setLayersError("");

      const url = `${API_BASE_URL}/api/map-layers?type=${encodeURIComponent(context.type)}&id=${encodeURIComponent(context.id)}`;

      const response = await fetch(url);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Erreur HTTP ${response.status} - ${text}`);
      }

      const data = await response.json();

      const normalized = Array.isArray(data)
        ? data.map((layer) => ({
            ...layer,
            visible:
              typeof layer.visible === "boolean"
                ? layer.visible
                : Boolean(layer.visible_defaut),
          }))
        : [];

      setAvailableLayers(normalized);
    } catch (error) {
      console.error("Erreur chargement calques :", error);
      setAvailableLayers([]);
      setLayersError(error?.message || "Impossible de charger les calques.");
    } finally {
      setLayersLoading(false);
    }
  }, []);

  const toggleLayersPanel = useCallback(() => {
    setLayersOpen((prev) => !prev);
  }, []);

  const closeLayersPanel = useCallback(() => {
    setLayersOpen(false);
  }, []);

  const toggleLayerVisibility = useCallback((idCalque) => {
    setAvailableLayers((prev) =>
      prev.map((layer) =>
        layer.id_calque === idCalque
          ? { ...layer, visible: !layer.visible }
          : layer,
      ),
    );
  }, []);

  const handleNodeClick = useCallback(
    async (node) => {
      setSelectedNode(node);

      const nodeType = node?.type ?? node?.data?.type ?? null;
      const category =
        node?.data?.categorie_file ?? node?.categorie_file ?? null;

      if (nodeType === "folder") {
        setSelectedFeature(null);
        closeLayersPanel();
        return;
      }

      const isPlan = nodeType === "plan" || category === "plan";
      if (isPlan) {
        closeLayersPanel();
        await openPlan(node);
        return;
      }

      if (viewMode === "plan") {
        closePlan();
      }

      const geometry = node?.data?.geometry ?? node?.geometry ?? null;
      const center = node?.center ?? node?.data?.center ?? null;
      const zoom = node?.data?.zoom ?? node?.zoom;
      const code =
        node?.data?.code_site ??
        node?.data?.code_service ??
        node?.data?.code_installation ??
        node?.data?.code ??
        node?.code ??
        null;

      const hasPointGeometry =
        geometry?.type === "Point" &&
        Array.isArray(geometry.coordinates) &&
        geometry.coordinates.length >= 2;

      const hasCenter =
        center && Number.isFinite(center.lat) && Number.isFinite(center.lng);

      if (
        nodeType === "site" ||
        nodeType === "service" ||
        nodeType === "installation"
      ) {
        await loadLayersForNode(node);

        if (hasPointGeometry) {
          setSelectedFeature({
            id: node.id,
            type: nodeType,
            nom: node.label ?? "Sans nom",
            code,
            zoom:
              Number.isFinite(zoom) && zoom > 0 ? zoom : DEFAULT_FEATURE_ZOOM,
            geometry,
            center: null,
          });
          return;
        }

        if (hasCenter) {
          setSelectedFeature({
            id: node.id,
            type: nodeType,
            nom: node.label ?? "Sans nom",
            code,
            zoom:
              Number.isFinite(zoom) && zoom > 0 ? zoom : DEFAULT_FEATURE_ZOOM,
            geometry: null,
            center,
          });
          flyToNodeCenter(node);
          return;
        }
      }

      setSelectedFeature(null);
      flyToNodeCenter(node);

      if (
        nodeType === "document" &&
        (node?.data?.path_file || node?.path_file)
      ) {
        closeLayersPanel();
        window.open(
          node?.data?.path_file ?? node?.path_file,
          "_blank",
          "noopener,noreferrer",
        );
      }
    },
    [
      closeLayersPanel,
      closePlan,
      flyToNodeCenter,
      loadLayersForNode,
      openPlan,
      viewMode,
    ],
  );

  const expandAll = useCallback(() => {
    setTreeAction("expand");
    setTreeActionToken((v) => v + 1);
  }, []);

  const collapseAll = useCallback(() => {
    setTreeAction("collapse");
    setTreeActionToken((v) => v + 1);
  }, []);

  const layersEnabled =
    viewMode === "map" &&
    (layerContext?.type === "site" ||
      layerContext?.type === "service" ||
      layerContext?.type === "installation");

  const layerContextLabel = layerContext
    ? `${layerContext.type} · ${layerContext.label}`
    : "";

  return (
    <div className={`app ${menuOpen ? "menu-open" : ""}`}>
      <header className="topbar">
        <div className="topbar-left">
          <button
            type="button"
            className="hamburger"
            onClick={toggleMenu}
            aria-label="Ouvrir le menu"
            aria-expanded={menuOpen}
            aria-controls="sidebar"
          >
            <span />
            <span />
            <span />
          </button>

          <div className="topbar-brand topbar-brand--has-card">
            <img
              src="/DIgitalBonsai.png"
              alt="Digital Bonsai"
              className="topbar-logo"
            />

            <div className="logo-hover-card" role="tooltip" aria-hidden="true">
              <div className="business-card">
                <div className="business-card__main">
                  <div className="business-card__left">
                    <img
                      src="/DIgitalBonsai.png"
                      alt="Digital Bonsai"
                      className="business-card__logo"
                    />
                  </div>

                  <div className="business-card__right">
                    <h3 className="business-card__name">Laurent BOHBOT</h3>
                    <p className="business-card__role">
                      Automation & Digital Transformation Expert
                    </p>

                    <div className="business-card__contacts">
                      <div className="business-card__contact">
                        <span className="business-card__icon icon-solid">
                          <svg
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                            fill="white"
                            aria-hidden="true"
                          >
                            <path d="M6.6 10.8a15 15 0 006.6 6.6l2.2-2.2a1.5 1.5 0 011.53-.36c1.17.39 2.42.6 3.7.6A1.5 1.5 0 0120 17.08V21a1.5 1.5 0 01-1.5 1.5C9.94 22.5 1.5 14.06 1.5 3.5A1.5 1.5 0 013 2h3.92a1.5 1.5 0 011.48 1.28c.1 1.28.31 2.53.7 3.7a1.5 1.5 0 01-.36 1.53l-2.14 2.29z" />
                          </svg>
                        </span>
                        <span className="business-card__text">
                          +33 6 95 03 01 46
                        </span>
                      </div>

                      <div className="business-card__contact">
                        <span className="business-card__icon icon-solid">
                          <svg
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                            fill="none"
                            aria-hidden="true"
                          >
                            <rect
                              x="4"
                              y="6"
                              width="16"
                              height="12"
                              rx="1.5"
                              fill="white"
                            />
                            <path
                              d="M5.5 7.5 12 12.5l6.5-5"
                              stroke="#16835d"
                              strokeWidth="1.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                        <span className="business-card__text">
                          laurent.bohbot@digitalbonsai.tech
                        </span>
                      </div>

                      <div className="business-card__contact">
                        <span className="business-card__icon icon-web">
                          <svg
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                            fill="none"
                            aria-hidden="true"
                          >
                            <circle
                              cx="12"
                              cy="12"
                              r="9"
                              stroke="#16835d"
                              strokeWidth="1.6"
                            />
                            <path
                              d="M3.8 12h16.4M12 3.2c2.4 2.3 3.8 5.4 3.8 8.8 0 3.4-1.4 6.5-3.8 8.8m0-17.6C9.6 5.5 8.2 8.6 8.2 12c0 3.4 1.4 6.5 3.8 8.8"
                              stroke="#16835d"
                              strokeWidth="1.4"
                              strokeLinecap="round"
                            />
                          </svg>
                        </span>
                        <span className="business-card__text">
                          www.digitalbonsai.tech
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="business-card__footer">
                  Votre partenaire de voyage à travers l’univers du digital
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="topbar-center">
          <h1 className="topbar-title topbar-title--center">SPADIA</h1>
          <p className="topbar-subtitle topbar-subtitle--center">
            L'informatique technique au coeur de vos installations
          </p>
        </div>

        <div className="header-auth">
          {session ? (
            <div className="header-user-badge">
              <span className="header-user-icon">👤</span>
              <span className="header-user-name">
                {profile?.full_name || profile?.email || "Utilisateur"}
              </span>

              <button
                type="button"
                className="header-logout-btn"
                onClick={onLogout}
                title="Se déconnecter"
              >
                ⎋
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="header-login-btn"
              onClick={onLoginClick}
              title="Connexion"
            >
              <span className="header-login-btn__icon">🔐</span>
              <span className="header-login-btn__text">Connexion</span>
            </button>
          )}
        </div>
      </header>

      <div className="layout">
        <aside id="sidebar" className="sidebar">
          <div className="sidebar-header">
            <h2>Explorateur</h2>
            <button
              type="button"
              className="close-btn"
              onClick={closeMenu}
              aria-label="Fermer le menu"
            >
              ×
            </button>
          </div>

          <div className="sidebar-section">
            <label htmlFor="searchInput" className="section-label">
              Recherche
            </label>
            <input
              id="searchInput"
              type="text"
              className="modern-input"
              placeholder="Rechercher un site, une installation ou un fichier..."
            />
          </div>

          <div className="sidebar-section">
            <div className="tree-section-header">
              <p className="section-label tree-section-label">
                Base documentaire spatiale
              </p>

              <div className="tree-toolbar">
                <button
                  type="button"
                  className="tree-toolbar-icon-btn"
                  onClick={expandAll}
                  aria-label="Tout déplier"
                >
                  <svg
                    viewBox="0 0 20 20"
                    className="tree-toolbar-icon"
                    aria-hidden="true"
                  >
                    <path
                      d="M6 5l4 4 4-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M6 10l4 4 4-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="tree-toolbar-tooltip">Tout déplier</span>
                </button>

                <button
                  type="button"
                  className="tree-toolbar-icon-btn"
                  onClick={collapseAll}
                  aria-label="Tout replier"
                >
                  <svg
                    viewBox="0 0 20 20"
                    className="tree-toolbar-icon"
                    aria-hidden="true"
                  >
                    <path
                      d="M7 6l4 4-4 4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M11 6l4 4-4 4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="tree-toolbar-tooltip">Tout replier</span>
                </button>
              </div>
            </div>

            {!session ? (
              <div className="carto-tree__state">
                Connectez-vous pour afficher l’arborescence.
              </div>
            ) : treeLoading ? (
              <div className="carto-tree__state">Chargement...</div>
            ) : treeError ? (
              <div className="carto-tree__state carto-tree__state--error">
                <div>{treeError}</div>
                <button type="button" onClick={reloadTree}>
                  Réessayer
                </button>
              </div>
            ) : (
              <CartoTree
                data={treeData}
                selectedNodeId={selectedNode?.id}
                onSelectNode={handleNodeClick}
                treeAction={treeAction}
                treeActionToken={treeActionToken}
              />
            )}
          </div>
        </aside>

        <button
          type="button"
          className="overlay"
          aria-label="Fermer le menu"
          onClick={closeMenu}
        />

        <main className="map-shell">
          {viewMode === "map" ? (
            <>
              <div className="map-hover-ui">
                <BasemapSwitcher
                  basemap={basemap}
                  setBasemap={setBasemap}
                  onToggleLayers={toggleLayersPanel}
                  layersOpen={layersOpen}
                  layersEnabled={layersEnabled}
                  activeLayersCount={activeLayersCount}
                />
              </div>

              <LayersPanel
                open={layersOpen}
                contextLabel={layerContextLabel}
                layers={availableLayers}
                loading={layersLoading}
                error={layersError}
                onClose={closeLayersPanel}
                onToggleLayer={toggleLayerVisibility}
                position={layersPanelPosition}
                onPositionChange={setLayersPanelPosition}
              />

              <MapContainer
                center={CENTER}
                zoom={DEFAULT_MAP_ZOOM}
                className="map"
                zoomControl={false}
              >
                <MapInstanceCapture mapRef={mapRef} />
                <ResizeMap
                  menuOpen={menuOpen}
                  selectedFeature={selectedFeature}
                />
                <ZoomControl position="bottomright" />

                <TileLayer
                  key={basemapConfig.key}
                  attribution={basemapConfig.attribution}
                  url={basemapConfig.url}
                />

                {selectedFeature && (
                  <SelectedMarker feature={selectedFeature} />
                )}
              </MapContainer>
            </>
          ) : (
            <div className="plan-mode-wrapper">
              <div className="plan-toolbar">
                <button
                  type="button"
                  className="plan-toolbar-back-btn"
                  onClick={closePlan}
                >
                  ← Retour carte
                </button>

                <div className="plan-toolbar-title">
                  {activePlan?.title ?? "Plan"}
                </div>
              </div>

              <div className="plan-canvas">
                <PlanViewer plan={activePlan} menuOpen={menuOpen} />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
