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

  const handleNodeClick = useCallback(
    async (node) => {
      setSelectedNode(node);

      const nodeType = node?.type ?? node?.data?.type ?? null;
      const category =
        node?.data?.categorie_file ?? node?.categorie_file ?? null;

      if (nodeType === "folder") {
        setSelectedFeature(null);
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
        window.open(
          node?.data?.path_file ?? node?.path_file,
          "_blank",
          "noopener,noreferrer",
        );
      }
    },
    [closePlan, flyToNodeCenter, openPlan, viewMode],
  );

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
                            <path d="M6.6 10.8a15 15 0 006.6 6.6l2.2-2.2a1 1 0 011-.24 11.4 11.4 0 003.6.6 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 5a1 1 0 011-1h2.4a1 1 0 011 1 11.4 11.4 0 00.6 3.6 1 1 0 01-.24 1z" />
                          </svg>
                        </span>
                        <span className="business-card__text">
                          +33 7 69 86 26 64
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
                <BasemapSwitcher basemap={basemap} setBasemap={setBasemap} />
              </div>

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
