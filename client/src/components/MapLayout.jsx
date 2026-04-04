import { useEffect, useMemo, useState } from "react";
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

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const center = [43.2965, 5.3698];

function ResizeMap({ menuOpen }) {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => clearTimeout(timer);
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

function buildCartoTree(services, sites, installations, files) {
  const serviceMap = new Map();
  const siteMap = new Map();
  const installationMap = new Map();

  services.forEach((service) => {
    serviceMap.set(service.id_service, {
      id: service.id_service,
      label: service.lib_service,
      type: "service",
      children: [],
    });
  });

  sites.forEach((site) => {
    const siteNode = {
      id: site.id_site,
      label: site.lib_site,
      type: "site",
      children: [
        {
          id: `${site.id_site}-documents`,
          label: "Documents",
          type: "folder",
          children: [],
        },
        {
          id: `${site.id_site}-plans`,
          label: "Plans",
          type: "folder",
          children: [],
        },
      ],
    };

    siteMap.set(site.id_site, siteNode);

    const serviceNode = serviceMap.get(site.id_service);
    if (serviceNode) {
      serviceNode.children.push(siteNode);
    }
  });

  installations.forEach((installation) => {
    const installationNode = {
      id: installation.id_installation,
      label: installation.lib_installation,
      type: "installation",
      children: [
        {
          id: `${installation.id_installation}-documents`,
          label: "Documents",
          type: "folder",
          children: [],
        },
        {
          id: `${installation.id_installation}-plans`,
          label: "Plans",
          type: "folder",
          children: [],
        },
      ],
    };

    installationMap.set(installation.id_installation, installationNode);

    const siteNode = siteMap.get(installation.id_site);
    if (siteNode) {
      siteNode.children.push(installationNode);
    }
  });

  files.forEach((file) => {
    const fileNode = {
      id: file.id_files,
      label: file.name_file,
      type: "file",
      fileType: file.type_file,
      path: file.path_file,
      raw: file,
    };

    const category = (file.categorie_file || "").toLowerCase().includes("plan")
      ? "Plans"
      : "Documents";

    if (file.id_installation && installationMap.has(file.id_installation)) {
      const installationNode = installationMap.get(file.id_installation);
      const targetFolder = installationNode.children.find(
        (child) => child.label === category,
      );
      targetFolder?.children.push(fileNode);
      return;
    }

    if (file.id_site && siteMap.has(file.id_site)) {
      const siteNode = siteMap.get(file.id_site);
      const targetFolder = siteNode.children.find(
        (child) => child.label === category,
      );
      targetFolder?.children.push(fileNode);
    }
  });

  return Array.from(serviceMap.values());
}

const mockServices = [
  { id_service: "service-1", lib_service: "Service Voyageurs" },
];

const mockSites = [
  { id_site: "site-1", id_service: "service-1", lib_site: "Site n°1" },
  { id_site: "site-2", id_service: "service-1", lib_site: "Site n°2" },
];

const mockInstallations = [
  {
    id_installation: "inst-1",
    id_site: "site-1",
    lib_installation: "Installation 1",
  },
  {
    id_installation: "inst-2",
    id_site: "site-1",
    lib_installation: "Installation 2",
  },
];

const mockFiles = [
  {
    id_files: "file-1",
    id_site: "site-1",
    id_installation: null,
    name_file: "Site_1_Doc1.pdf",
    path_file: "/docs/Site_1_Doc1.pdf",
    type_file: "pdf",
    categorie_file: "Documents",
  },
  {
    id_files: "file-2",
    id_site: "site-1",
    id_installation: null,
    name_file: "Site_1_Plan1.svg",
    path_file: "/plans/Site_1_Plan1.svg",
    type_file: "svg",
    categorie_file: "Plans",
  },
  {
    id_files: "file-3",
    id_site: "site-1",
    id_installation: "inst-1",
    name_file: "Site_1_Installation_1_Doc1.pdf",
    path_file: "/docs/Site_1_Installation_1_Doc1.pdf",
    type_file: "pdf",
    categorie_file: "Documents",
  },
  {
    id_files: "file-4",
    id_site: "site-1",
    id_installation: "inst-1",
    name_file: "Site_1_Installation_1_Plan1.svg",
    path_file: "/plans/Site_1_Installation_1_Plan1.svg",
    type_file: "svg",
    categorie_file: "Plans",
  },
  {
    id_files: "file-5",
    id_site: "site-1",
    id_installation: "inst-2",
    name_file: "Site_1_Installation_2_Doc1.pdf",
    path_file: "/docs/Site_1_Installation_2_Doc1.pdf",
    type_file: "pdf",
    categorie_file: "Documents",
  },
];

export default function MapLayout() {
  const [menuOpen, setMenuOpen] = useState(true);
  const [basemap, setBasemap] = useState("road");
  const [selectedFile, setSelectedFile] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [treeMode, setTreeMode] = useState("default");
  const [treeVersion, setTreeVersion] = useState(0);

  const toggleMenu = () => setMenuOpen((prev) => !prev);
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    function closeContextMenu() {
      setContextMenu(null);
    }

    window.addEventListener("click", closeContextMenu);
    window.addEventListener("resize", closeContextMenu);
    window.addEventListener("scroll", closeContextMenu);

    return () => {
      window.removeEventListener("click", closeContextMenu);
      window.removeEventListener("resize", closeContextMenu);
      window.removeEventListener("scroll", closeContextMenu);
    };
  }, []);

  const treeData = useMemo(() => {
    return buildCartoTree(
      mockServices,
      mockSites,
      mockInstallations,
      mockFiles,
    );
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

  const handleFileClick = (fileNode) => {
    setSelectedFile(fileNode);
    setContextMenu(null);
  };

  const handleFileContextMenu = ({ file, x, y }) => {
    setSelectedFile(file);
    setContextMenu({
      file,
      x,
      y,
    });
  };

  const expandAll = () => {
    setTreeMode("expand");
    setTreeVersion((v) => v + 1);
  };

  const collapseAll = () => {
    setTreeMode("collapse");
    setTreeVersion((v) => v + 1);
  };

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

            <CartoTree
              key={`${treeMode}-${treeVersion}`}
              data={treeData}
              selectedFileId={selectedFile?.id}
              onFileClick={handleFileClick}
              onFileContextMenu={handleFileContextMenu}
              treeMode={treeMode}
            />
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
            center={center}
            zoom={13}
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

            <Marker position={center}>
              <Popup>Marseille</Popup>
            </Marker>
          </MapContainer>
        </main>

        {contextMenu && (
          <div
            className="file-context-menu"
            style={{
              top: `${contextMenu.y}px`,
              left: `${contextMenu.x}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="file-context-title">{contextMenu.file.label}</div>
            <div className="file-context-row">
              <span className="file-context-key">Type</span>
              <span className="file-context-value">
                {contextMenu.file.fileType || "inconnu"}
              </span>
            </div>
            <div className="file-context-row">
              <span className="file-context-key">Chemin</span>
              <span className="file-context-value">
                {contextMenu.file.path}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
