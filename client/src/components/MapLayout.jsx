import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
  ZoomControl,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
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
import { ListChevronsDownUp, ListChevronsUpDown, Menu } from "lucide-react";

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

function MapInstanceCapture({ mapRef, onReady }) {
  const map = useMap();

  useEffect(() => {
    mapRef.current = map;
    onReady?.(map);
  }, [map, mapRef, onReady]);

  return null;
}

function ZoomWatcher({ onZoomChange }) {
  const map = useMapEvents({
    zoom() {
      onZoomChange(map.getZoom());
    },
    zoomend() {
      onZoomChange(map.getZoom());
    },
  });

  useEffect(() => {
    onZoomChange(map.getZoom());
  }, [map, onZoomChange]);

  return null;
}

function ZoomLevelControl({ zoom }) {
  return <div className="zoom-level-control leaflet-control">{zoom}</div>;
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
            : "Sélectionnez un support disposant de calques"
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
  onShowAll,
  onHideAll,
  position,
  onPositionChange,
  currentMapZoom,
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
        <button
          type="button"
          className="layers-panel__close-floating"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Fermer le panneau des calques"
        >
          ×
        </button>

        <div className="layers-panel__header-row">
          <div className="layers-panel__title">Calques</div>

          <div className="layers-panel__header-actions">
            <button
              type="button"
              className="layers-panel__header-btn"
              onClick={(e) => {
                e.stopPropagation();
                onShowAll();
              }}
              disabled={loading || layers.length === 0}
              title="Tout afficher"
              aria-label="Tout afficher"
            >
              ✓
            </button>

            <button
              type="button"
              className="layers-panel__header-btn"
              onClick={(e) => {
                e.stopPropagation();
                onHideAll();
              }}
              disabled={loading || layers.length === 0}
              title="Tout masquer"
              aria-label="Tout masquer"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="layers-panel__subtitle-inline">
          {contextLabel || "Aucun contexte sélectionné"}
        </div>
      </div>

      {loading ? (
        <div className="layers-panel__state">Chargement des calques...</div>
      ) : error ? (
        <div className="layers-panel__state layers-panel__state--error">
          {error}
        </div>
      ) : layers.length === 0 ? (
        <div className="layers-panel__state">
          Aucun calque disponible pour ce support.
        </div>
      ) : (
        <div className="layers-panel__list">
          {layers.map((layer) => {
            const minZoom = Number.isFinite(layer.min_zoom)
              ? layer.min_zoom
              : 0;
            const maxZoom = Number.isFinite(layer.max_zoom)
              ? layer.max_zoom
              : 22;
            const isInZoomRange =
              currentMapZoom >= minZoom && currentMapZoom <= maxZoom;
            console.log("TOOLBAR DEBUG", {
              name: layer.lib_calque,
              type: layer.type,
              minZoom,
              maxZoom,
              currentMapZoom,
              isInZoomRange,
            });
            return (
              <label
                key={layer.id_calque}
                className={`layers-panel__item ${!isInZoomRange ? "layers-panel__item--out-of-range" : ""}`}
              >
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
            );
          })}
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatKey(key) {
  return key.replaceAll("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function getLayerPointIcon(layer) {
  const markerType = String(layer?.marker_type || "circle").toLowerCase();
  const color = layer?.marker_color || "#2563eb";
  const size = Number.isFinite(layer?.marker_size) ? layer.marker_size : 28;
  const iconUrl = layer?.marker_icon_url || null;
  const iconName = String(layer?.marker_icon_name || "").toLowerCase();

  if (markerType === "image" && iconUrl) {
    return L.icon({
      iconUrl,
      iconSize: [size, size],
      iconAnchor: [size / 2, size],
      popupAnchor: [0, -size],
      className: "custom-layer-image-marker",
    });
  }

  let symbol = "●";

  if (iconName === "camera") symbol = "📷";
  else if (iconName === "hydrant") symbol = "🧯";
  else if (iconName === "access") symbol = "🚪";
  else if (iconName === "sensor") symbol = "📡";
  else if (iconName === "alarm") symbol = "🚨";
  else if (iconName === "default") symbol = "●";

  const safeSymbol = escapeHtml(symbol);

  return L.divIcon({
    className: "custom-layer-divicon-wrapper",
    html: `
      <div
        class="custom-layer-divicon"
        style="
          width:${size}px;
          height:${size}px;
          background:${color};
          border:2px solid #ffffff;
          box-shadow:0 2px 8px rgba(15,23,42,0.28);
          border-radius:50%;
          display:flex;
          align-items:center;
          justify-content:center;
          color:#ffffff;
          font-size:${Math.max(12, Math.round(size * 0.5))}px;
          line-height:1;
        "
      >
        ${safeSymbol}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -Math.round(size / 2)],
  });
}

function toLatLng(coords) {
  if (!Array.isArray(coords) || coords.length < 2) return null;
  return [coords[1], coords[0]];
}

function createPopupHtml(obj) {
  const props = obj?.properties ?? {};
  const title = escapeHtml(obj.lib_objet || obj.code_objet || "Objet");

  const description = obj?.description_objet
    ? `<div class="marker-popup__description">${escapeHtml(obj.description_objet)}</div>`
    : "";

  const rows = Object.entries(props)
    .map(([key, value]) => {
      return `
        <tr>
          <td class="marker-table__key">${escapeHtml(formatKey(key))}</td>
          <td class="marker-table__value">${escapeHtml(value)}</td>
        </tr>
      `;
    })
    .join("");

  const table = rows
    ? `
      <table class="marker-table">
        <tbody>
          ${rows}
        </tbody>
      </table>
    `
    : "";

  return `
    <div class="marker-popup">
      <div class="marker-popup__title">${title}</div>
      ${description}
      ${table}
    </div>
  `;
}

function createLayerFromGeometry(obj, layer) {
  const geom = obj?.geom;
  if (!geom || !geom.type) return null;

  const popupHtml = createPopupHtml(obj);

  if (geom.type === "Point") {
    const latLng = toLatLng(geom.coordinates);
    if (!latLng) return null;
    return L.marker(latLng, { icon: getLayerPointIcon(layer) }).bindPopup(
      popupHtml,
    );
  }

  if (geom.type === "MultiPoint") {
    const group = L.layerGroup();
    geom.coordinates?.forEach((coords) => {
      const latLng = toLatLng(coords);
      if (latLng) {
        group.addLayer(
          L.marker(latLng, { icon: getLayerPointIcon(layer) }).bindPopup(
            popupHtml,
          ),
        );
      }
    });
    return group;
  }

  if (geom.type === "LineString") {
    const latLngs = geom.coordinates?.map(toLatLng).filter(Boolean) ?? [];
    if (latLngs.length === 0) return null;
    return L.polyline(latLngs).bindPopup(popupHtml);
  }

  if (geom.type === "MultiLineString") {
    const latLngs =
      geom.coordinates?.map((line) => line.map(toLatLng).filter(Boolean)) ?? [];
    if (latLngs.length === 0) return null;
    return L.polyline(latLngs).bindPopup(popupHtml);
  }

  if (geom.type === "Polygon") {
    const latLngs =
      geom.coordinates?.map((ring) => ring.map(toLatLng).filter(Boolean)) ?? [];
    if (latLngs.length === 0) return null;
    return L.polygon(latLngs).bindPopup(popupHtml);
  }

  if (geom.type === "MultiPolygon") {
    const latLngs =
      geom.coordinates?.map((polygon) =>
        polygon.map((ring) => ring.map(toLatLng).filter(Boolean)),
      ) ?? [];
    if (latLngs.length === 0) return null;
    return L.polygon(latLngs).bindPopup(popupHtml);
  }

  return null;
}

function isClusterLayer(layer) {
  const type = String(layer?.type_entite || "").toLowerCase();
  return type === "point" || type === "multi_point" || type === "multipoint";
}

function extractNodeContextId(node, nodeType) {
  if (!node) return null;

  if (nodeType === "installation") {
    return (
      node?.entityId ??
      node?.data?.id_installation ??
      node?.id_installation ??
      node?.data?.installation_id ??
      node?.installation_id ??
      node?.data?.id ??
      null
    );
  }

  if (nodeType === "site") {
    return (
      node?.entityId ??
      node?.data?.id_site ??
      node?.id_site ??
      node?.data?.site_id ??
      node?.site_id ??
      node?.data?.id ??
      null
    );
  }

  if (nodeType === "service") {
    return (
      node?.entityId ??
      node?.data?.id_service ??
      node?.id_service ??
      node?.data?.service_id ??
      node?.service_id ??
      node?.data?.id ??
      null
    );
  }

  if (nodeType === "file_plan") {
    return (
      node?.data?.fileId ??
      node?.fileId ??
      node?.data?.id_file ??
      node?.id_file ??
      node?.data?.id ??
      null
    );
  }

  if (typeof node?.id === "string") {
    const prefix = `${nodeType}-`;
    if (node.id.startsWith(prefix)) {
      return node.id.slice(prefix.length);
    }
  }

  return null;
}

function findNodePathLabels(tree, targetNodeId) {
  if (!Array.isArray(tree) || !targetNodeId) return [];

  function walk(nodes, parents = []) {
    for (const node of nodes) {
      const currentPath = [...parents, node];

      if (node?.id === targetNodeId) {
        return currentPath
          .filter((item) =>
            ["service", "site", "installation", "plan"].includes(item?.type),
          )
          .map((item) => item?.label)
          .filter(Boolean);
      }

      if (Array.isArray(node?.children) && node.children.length > 0) {
        const found = walk(node.children, currentPath);
        if (found.length) return found;
      }
    }

    return [];
  }

  return walk(tree, []);
}

function getNodeSupportType(node) {
  const nodeType = node?.type ?? node?.data?.type ?? null;
  const category = node?.data?.categorie_file ?? node?.categorie_file ?? null;

  if (nodeType === "plan" || category === "plan") return "file_plan";
  if (nodeType === "service") return "service";
  if (nodeType === "site") return "site";
  if (nodeType === "installation") return "installation";

  return null;
}

export default function MapLayout({
  session,
  profile,
  onLoginClick,
  onLogout,
}) {
  const mapRef = useRef(null);
  const layerGroupsRef = useRef({});
  const layerMetaRef = useRef({});
  const zoomHandlerAttachedRef = useRef(false);

  const contextVersionRef = useRef(0);
  const desiredVisibleLayersRef = useRef({});
  const pendingControllersRef = useRef({});

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
  const [currentMapZoom, setCurrentMapZoom] = useState(DEFAULT_MAP_ZOOM);
  const layerListRequestControllerRef = useRef(null);
  const layerListRequestVersionRef = useRef(0);
  const [planLayerObjects, setPlanLayerObjects] = useState({});
  const [currentPlanZoom, setCurrentPlanZoom] = useState(0);
  const [layersPanelPosition, setLayersPanelPosition] = useState({
    x: 0,
    y: 18,
  });

  const abortAllPendingLayerRequests = useCallback(() => {
    Object.values(pendingControllersRef.current).forEach((controller) => {
      try {
        controller.abort();
      } catch {
        // noop
      }
    });
    pendingControllersRef.current = {};
  }, []);

  const clearRenderedLayers = useCallback(() => {
    abortAllPendingLayerRequests();
    desiredVisibleLayersRef.current = {};
    contextVersionRef.current += 1;
    setPlanLayerObjects({});

    const map = mapRef.current;
    if (map) {
      Object.values(layerGroupsRef.current).forEach((group) => {
        if (map.hasLayer(group)) {
          map.removeLayer(group);
        }
        if (typeof group.clearLayers === "function") {
          group.clearLayers();
        }
      });
    }

    layerGroupsRef.current = {};
    layerMetaRef.current = {};
  }, [abortAllPendingLayerRequests]);

  const syncRenderedLayersWithZoom = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const zoom = map.getZoom();

    Object.entries(layerGroupsRef.current).forEach(([layerId, group]) => {
      if (!desiredVisibleLayersRef.current[layerId]) {
        if (map.hasLayer(group)) {
          map.removeLayer(group);
        }
        return;
      }

      const meta = layerMetaRef.current[layerId];
      if (!meta) return;

      const minZoom = Number.isFinite(meta.minZoom) ? meta.minZoom : 0;
      const maxZoom = Number.isFinite(meta.maxZoom) ? meta.maxZoom : 22;
      const inRange = zoom >= minZoom && zoom <= maxZoom;

      if (inRange) {
        if (!map.hasLayer(group)) {
          group.addTo(map);
        }
      } else if (map.hasLayer(group)) {
        map.removeLayer(group);
      }
    });
  }, []);

  const removeLayerFromMap = useCallback((layerId) => {
    desiredVisibleLayersRef.current[layerId] = false;

    const controller = pendingControllersRef.current[layerId];
    if (controller) {
      try {
        controller.abort();
      } catch {
        // noop
      }
      delete pendingControllersRef.current[layerId];
    }

    setPlanLayerObjects((prev) => {
      const next = { ...prev };
      delete next[layerId];
      return next;
    });

    const map = mapRef.current;
    const group = layerGroupsRef.current[layerId];

    if (map && group) {
      if (map.hasLayer(group)) {
        map.removeLayer(group);
      }

      if (typeof group.clearLayers === "function") {
        group.clearLayers();
      }
    }

    delete layerGroupsRef.current[layerId];
    delete layerMetaRef.current[layerId];
  }, []);

  const addLayerToMap = useCallback(
    async (layer) => {
      const map = mapRef.current;
      if (!map || !layer?.id_calque) return;

      const layerId = layer.id_calque;
      const requestContextVersion = contextVersionRef.current;

      desiredVisibleLayersRef.current[layerId] = true;

      const existingGroup = layerGroupsRef.current[layerId];
      if (existingGroup) {
        if (map.hasLayer(existingGroup)) {
          map.removeLayer(existingGroup);
        }
        if (typeof existingGroup.clearLayers === "function") {
          existingGroup.clearLayers();
        }
      }

      delete layerGroupsRef.current[layerId];
      delete layerMetaRef.current[layerId];

      const previousController = pendingControllersRef.current[layerId];
      if (previousController) {
        try {
          previousController.abort();
        } catch (error) {
          console.warn("Abort controller error:", error);
        }
      }

      const controller = new AbortController();
      pendingControllersRef.current[layerId] = controller;

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/carto/layer-objects`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              layerIds: [layerId],
            }),
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Erreur HTTP ${response.status} - ${text}`);
        }

        const objects = await response.json();
        const normalizedObjects = Array.isArray(objects) ? objects : [];

        setPlanLayerObjects((prev) => ({
          ...prev,
          [layerId]: normalizedObjects,
        }));
        console.log("VIEWMODE DEBUG", viewMode);
        if (viewMode === "plan") {
          console.log("STOP addLayerToMap in plan mode");
          return;
        }

        if (viewMode === "plan") {
          return;
        }
        if (controller.signal.aborted) return;
        if (requestContextVersion !== contextVersionRef.current) return;
        if (!desiredVisibleLayersRef.current[layerId]) return;

        const group = isClusterLayer(layer)
          ? L.markerClusterGroup({
              zoomToBoundsOnClick: false,
              spiderfyOnMaxZoom: true,
              showCoverageOnHover: false,
            })
          : L.layerGroup();

        if (isClusterLayer(layer)) {
          group.on("clusterclick", (event) => {
            event.layer.spiderfy();
          });
        }

        normalizedObjects.forEach((obj) => {
          const leafletLayer = createLayerFromGeometry(obj, layer);
          if (!leafletLayer) return;

          if (isClusterLayer(layer)) {
            if (leafletLayer instanceof L.Marker) {
              group.addLayer(leafletLayer);
            } else {
              console.warn("Objet ignoré dans cluster group :", {
                calque: layer.lib_calque,
                typeEntite: layer.type_entite,
                geomType: obj?.geom?.type,
                leafletType: leafletLayer?.constructor?.name,
                obj,
              });
            }
          } else {
            group.addLayer(leafletLayer);
          }
        });

        if (requestContextVersion !== contextVersionRef.current) {
          if (typeof group.clearLayers === "function") {
            group.clearLayers();
          }
          return;
        }

        if (!desiredVisibleLayersRef.current[layerId]) {
          if (typeof group.clearLayers === "function") {
            group.clearLayers();
          }
          return;
        }

        layerGroupsRef.current[layerId] = group;

        const minZoom = Number.isFinite(layer.min_zoom) ? layer.min_zoom : 0;
        const maxZoom = Number.isFinite(layer.max_zoom) ? layer.max_zoom : 22;

        layerMetaRef.current[layerId] = {
          minZoom,
          maxZoom,
        };

        const currentZoom = map.getZoom();
        const inRange = currentZoom >= minZoom && currentZoom <= maxZoom;

        if (inRange && !map.hasLayer(group)) {
          group.addTo(map);
        }

        if (typeof group.refreshClusters === "function") {
          group.refreshClusters();
        }

        syncRenderedLayersWithZoom();
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.error("Erreur chargement objets du calque :", error);
        }
      } finally {
        if (pendingControllersRef.current[layerId] === controller) {
          delete pendingControllersRef.current[layerId];
        }
      }
    },
    [syncRenderedLayersWithZoom, viewMode],
  );

  const showAllLayers = useCallback(() => {
    setAvailableLayers((prev) => {
      const next = prev.map((layer) => ({ ...layer, visible: true }));
      next.forEach((layer) => {
        desiredVisibleLayersRef.current[layer.id_calque] = true;
        addLayerToMap(layer);
      });
      return next;
    });
  }, [addLayerToMap]);

  const hideAllLayers = useCallback(() => {
    setAvailableLayers((prev) => {
      prev.forEach((layer) => {
        if (layer.visible) {
          removeLayerFromMap(layer.id_calque);
        }
      });

      return prev.map((layer) => ({
        ...layer,
        visible: false,
      }));
    });
  }, [removeLayerFromMap]);

  useEffect(() => {
    if (!layersOpen) return;

    const mapShell = document.querySelector(".map-shell");
    const panel = document.querySelector(".layers-panel");
    if (!mapShell || !panel) return;

    const margin = 16;

    setLayersPanelPosition({
      x: Math.max(0, mapShell.clientWidth - panel.offsetWidth - margin),
      y: 18,
    });
  }, [layersOpen, viewMode]);

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
    setLayersOpen(false);
    setAvailableLayers([]);
    setLayerContext(null);
    setLayersError("");
    setLayersLoading(false);
    clearRenderedLayers();
  }, [clearRenderedLayers]);

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

  const loadLayersForNode = useCallback(
    async (node) => {
      const supportType = getNodeSupportType(node);

      clearRenderedLayers();
      setLayersOpen(false);

      if (
        supportType !== "site" &&
        supportType !== "service" &&
        supportType !== "installation" &&
        supportType !== "file_plan"
      ) {
        setLayerContext(null);
        setAvailableLayers([]);
        setLayersError("");
        setLayersLoading(false);
        return;
      }

      const contextId = extractNodeContextId(node, supportType);

      const context = {
        type: supportType,
        id: contextId,
        label: node?.label ?? "Sans nom",
      };

      setLayerContext(context);

      if (!context.id) {
        setAvailableLayers([]);
        setLayersError("Contexte de carte incomplet.");
        setLayersLoading(false);
        return;
      }

      if (layerListRequestControllerRef.current) {
        try {
          layerListRequestControllerRef.current.abort();
        } catch {
          // noop
        }
      }

      const controller = new AbortController();
      layerListRequestControllerRef.current = controller;
      const requestVersion = ++layerListRequestVersionRef.current;

      try {
        setLayersLoading(true);
        setLayersError("");

        const url = `${API_BASE_URL}/api/carto/map-layers?type=${encodeURIComponent(
          context.type,
        )}&id=${encodeURIComponent(context.id)}`;

        const response = await fetch(url, {
          signal: controller.signal,
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Erreur HTTP ${response.status} - ${text}`);
        }

        const data = await response.json();

        if (controller.signal.aborted) return;
        if (requestVersion !== layerListRequestVersionRef.current) return;

        const normalized = Array.isArray(data)
          ? data.map((layer) => ({
              ...layer,
              visible:
                typeof layer.visible === "boolean"
                  ? layer.visible
                  : Boolean(layer.visible_defaut),
            }))
          : [];

        desiredVisibleLayersRef.current = {};
        normalized.forEach((layer) => {
          desiredVisibleLayersRef.current[layer.id_calque] = Boolean(
            layer.visible,
          );
        });

        setAvailableLayers(normalized);

        normalized.forEach((layer) => {
          if (layer.visible) {
            addLayerToMap(layer);
          }
        });
      } catch (error) {
        if (error?.name === "AbortError") {
          return;
        }

        console.error("Erreur chargement calques :", error);
        setAvailableLayers([]);
        setLayersError(error?.message || "Impossible de charger les calques.");
      } finally {
        if (layerListRequestControllerRef.current === controller) {
          layerListRequestControllerRef.current = null;
        }

        if (requestVersion === layerListRequestVersionRef.current) {
          setLayersLoading(false);
        }
      }
    },
    [addLayerToMap, clearRenderedLayers],
  );

  const openPlan = useCallback(
    async (node) => {
      const rawPath = node?.data?.path_file ?? node?.path_file ?? null;

      if (!rawPath) {
        console.error("Aucun path_file trouvé pour le plan :", node);
        return;
      }

      try {
        await loadLayersForNode(node);

        const { data } = supabase.storage
          .from(PLAN_BUCKET)
          .getPublicUrl(rawPath);

        const breadcrumb = findNodePathLabels(treeData, node?.id);

        setActivePlan({
          id:
            node?.data?.fileId ??
            node?.fileId ??
            node?.data?.id_file ??
            node?.id_file ??
            node?.id,
          title:
            node?.label ??
            node?.data?.lib_file ??
            node?.data?.name_file ??
            node?.name_file ??
            "Plan",
          breadcrumb,
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
    },
    [loadLayersForNode, treeData],
  );

  const toggleLayersPanel = useCallback(() => {
    setLayersOpen((prev) => !prev);
  }, []);

  const closeLayersPanel = useCallback(() => {
    setLayersOpen(false);
  }, []);

  const toggleLayerVisibility = useCallback(
    (idCalque) => {
      setAvailableLayers((prev) =>
        prev.map((layer) => {
          if (layer.id_calque !== idCalque) return layer;

          const nextVisible = !layer.visible;
          desiredVisibleLayersRef.current[idCalque] = nextVisible;

          if (nextVisible) {
            addLayerToMap({ ...layer, visible: true });
          } else {
            removeLayerFromMap(idCalque);
          }

          return {
            ...layer,
            visible: nextVisible,
          };
        }),
      );
    },
    [addLayerToMap, removeLayerFromMap],
  );

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

  const layersEnabled = useMemo(() => {
    if (viewMode === "map") {
      return (
        layerContext?.type === "site" ||
        layerContext?.type === "service" ||
        layerContext?.type === "installation"
      );
    }

    if (viewMode === "plan") {
      return layerContext?.type === "file_plan";
    }

    return false;
  }, [layerContext?.type, viewMode]);

  const layerContextLabel = useMemo(() => {
    if (viewMode === "plan") {
      if (
        Array.isArray(activePlan?.breadcrumb) &&
        activePlan.breadcrumb.length
      ) {
        return activePlan.breadcrumb.join(" › ");
      }
      return activePlan?.title || layerContext?.label || "";
    }

    return layerContext?.label || "";
  }, [
    activePlan?.breadcrumb,
    activePlan?.title,
    layerContext?.label,
    viewMode,
  ]);

  const handleMapReady = useCallback(
    (map) => {
      if (zoomHandlerAttachedRef.current) return;

      const handleZoomEnd = () => {
        syncRenderedLayersWithZoom();
      };

      const handleMoveEnd = () => {
        syncRenderedLayersWithZoom();
      };

      map.on("zoomend", handleZoomEnd);
      map.on("moveend", handleMoveEnd);

      zoomHandlerAttachedRef.current = true;
      syncRenderedLayersWithZoom();
    },
    [syncRenderedLayersWithZoom],
  );

  useEffect(() => {
    return () => {
      clearRenderedLayers();
    };
  }, [clearRenderedLayers]);

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
            <Menu size={20} />
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
          <div className="sidebar-header sidebar-header--search">
            <input
              id="searchInput"
              type="text"
              className="modern-input modern-input--search"
              placeholder="Rechercher dans la base documentaire..."
            />

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
                  <ListChevronsDownUp size={18} />
                  <span className="tree-toolbar-tooltip">Tout déplier</span>
                </button>

                <button
                  type="button"
                  className="tree-toolbar-icon-btn"
                  onClick={collapseAll}
                  aria-label="Tout replier"
                >
                  <ListChevronsUpDown size={18} />
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
          <LayersPanel
            open={layersOpen}
            contextLabel={layerContextLabel}
            layers={availableLayers}
            loading={layersLoading}
            error={layersError}
            onClose={closeLayersPanel}
            onToggleLayer={toggleLayerVisibility}
            onShowAll={showAllLayers}
            onHideAll={hideAllLayers}
            position={layersPanelPosition}
            onPositionChange={setLayersPanelPosition}
            currentMapZoom={
              viewMode === "plan" ? currentPlanZoom : currentMapZoom
            }
          />

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

              <MapContainer
                center={CENTER}
                zoom={DEFAULT_MAP_ZOOM}
                className="map"
                maxZoom={22}
                zoomControl={false}
              >
                <MapInstanceCapture mapRef={mapRef} onReady={handleMapReady} />
                <ZoomWatcher onZoomChange={setCurrentMapZoom} />
                <ResizeMap
                  menuOpen={menuOpen}
                  selectedFeature={selectedFeature}
                />
                <ZoomLevelControl zoom={currentMapZoom} />
                <ZoomControl position="bottomright" />

                <TileLayer
                  key={basemapConfig.key}
                  attribution={basemapConfig.attribution}
                  url={basemapConfig.url}
                  maxZoom={22}
                  maxNativeZoom={19}
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

                <div className="plan-toolbar-heading">
                  <div className="plan-toolbar-breadcrumb">
                    {Array.isArray(activePlan?.breadcrumb) &&
                    activePlan.breadcrumb.length > 0
                      ? activePlan.breadcrumb.join(" › ")
                      : (activePlan?.title ?? "Plan")}
                  </div>
                </div>

                <div className="plan-toolbar-actions">
                  <button
                    type="button"
                    className={`plan-layers-btn ${layersOpen ? "active" : ""}`}
                    onClick={toggleLayersPanel}
                    aria-pressed={layersOpen}
                    aria-label="Afficher les calques du plan"
                    title={
                      layersEnabled
                        ? "Afficher les calques du plan"
                        : "Aucun calque disponible pour ce plan"
                    }
                    disabled={!layersEnabled}
                  >
                    <span className="plan-layers-btn__icon layers-icon-wrap">
                      <svg
                        viewBox="0 0 24 24"
                        width="22"
                        height="22"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polygon
                          points="12 3 3 8 12 13 21 8 12 3"
                          fill="currentColor"
                          opacity="0.22"
                        />
                        <polyline points="3 12 12 17 21 12" />
                        <polyline points="3 16 12 21 21 16" />
                      </svg>

                      {activeLayersCount > 0 && (
                        <span className="layers-badge-dot" />
                      )}
                    </span>

                    <span className="plan-layers-btn__label">Calques</span>
                  </button>
                </div>
              </div>

              <div className="plan-canvas">
                <PlanViewer
                  plan={activePlan}
                  menuOpen={menuOpen}
                  layers={availableLayers}
                  layerObjects={planLayerObjects}
                  onZoomChange={setCurrentPlanZoom}
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
