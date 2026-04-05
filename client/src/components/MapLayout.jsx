import { useCallback, useEffect, useMemo, useState } from "react";
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
import { fetchCartoTree } from "../lib/cartoApi";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const CENTER = [43.2965, 5.3698];
const DEFAULT_MAP_ZOOM = 13;
const DEFAULT_FEATURE_ZOOM = 16;

function ResizeMap({ menuOpen }) {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [map, menuOpen]);

  return null;
}

function BasemapSwitcher({ basemap, setBasemap }) {
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
    </div>
  );
}

function SelectedMarker({ feature }) {
  const map = useMap();

  useEffect(() => {
    if (!feature?.geometry || feature.geometry.type !== "Point") return;

    const coordinates = feature.geometry.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) return;

    const [lng, lat] = coordinates;
    const zoom =
      Number.isFinite(feature.zoom) && feature.zoom > 0
        ? feature.zoom
        : DEFAULT_FEATURE_ZOOM;

    map.flyTo([lat, lng], zoom, { duration: 0.8 });
  }, [feature, map]);

  if (!feature?.geometry || feature.geometry.type !== "Point") return null;

  const coordinates = feature.geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const [lng, lat] = coordinates;

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
        ) : (
          <div>
            <strong>{feature.nom}</strong>
          </div>
        )}
      </Popup>
    </Marker>
  );
}

export default function MapLayout() {
  const [menuOpen, setMenuOpen] = useState(true);
  const [basemap, setBasemap] = useState("road");

  const [treeAction, setTreeAction] = useState(null);
  const [treeActionToken, setTreeActionToken] = useState(0);

  const [treeData, setTreeData] = useState([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [treeError, setTreeError] = useState("");

  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedFeature, setSelectedFeature] = useState(null);

  const toggleMenu = useCallback(() => {
    setMenuOpen((prev) => !prev);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setTreeLoading(true);
        setTreeError("");

        const data = await fetchCartoTree();

        if (!cancelled) {
          setTreeData(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("Erreur chargement arborescence :", error);

        if (!cancelled) {
          setTreeError("Impossible de charger l'arborescence.");
          setTreeData([]);
        }
      } finally {
        if (!cancelled) {
          setTreeLoading(false);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  const reloadTree = useCallback(async () => {
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
  }, []);

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

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node);

    const geometry = node?.data?.geometry;
    const zoom = node?.data?.zoom;
    const code =
      node?.data?.code_site ??
      node?.data?.code_service ??
      node?.data?.code ??
      null;

    const isSelectablePoint =
      (node?.type === "site" || node?.type === "service") &&
      geometry?.type === "Point" &&
      Array.isArray(geometry.coordinates) &&
      geometry.coordinates.length >= 2;

    if (isSelectablePoint) {
      setSelectedFeature({
        id: node.id,
        type: node.type,
        nom: node.label ?? "Sans nom",
        code,
        zoom: Number.isFinite(zoom) && zoom > 0 ? zoom : DEFAULT_FEATURE_ZOOM,
        geometry,
      });
      return;
    }

    setSelectedFeature(null);

    if (node?.type === "document" && node?.data?.path_file) {
      window.open(node.data.path_file, "_blank", "noopener,noreferrer");
    }
  }, []);

  const expandAll = useCallback(() => {
    setTreeAction("expand");
    setTreeActionToken((v) => v + 1);
  }, []);

  const collapseAll = useCallback(() => {
    setTreeAction("collapse");
    setTreeActionToken((v) => v + 1);
  }, []);

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

          <div className="topbar-brand">
            <p className="topbar-subtitle">Navigation cartographique</p>
            <h1 className="topbar-title">Tableau de bord cartographique</h1>
          </div>
        </div>

        <button type="button" className="topbar-action">
          Connexion
        </button>
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
                Arborescence documentaire
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

            {treeLoading ? (
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
          <div className="map-hover-ui">
            <BasemapSwitcher basemap={basemap} setBasemap={setBasemap} />
          </div>

          <MapContainer
            center={CENTER}
            zoom={DEFAULT_MAP_ZOOM}
            className="map"
            zoomControl={false}
          >
            <ResizeMap menuOpen={menuOpen} />
            <ZoomControl position="bottomright" />

            <TileLayer
              key={basemapConfig.key}
              attribution={basemapConfig.attribution}
              url={basemapConfig.url}
            />

            {selectedFeature?.geometry?.type === "Point" && (
              <SelectedMarker feature={selectedFeature} />
            )}
          </MapContainer>
        </main>
      </div>
    </div>
  );
}
