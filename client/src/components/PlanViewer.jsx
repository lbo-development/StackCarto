import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ImageOverlay,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  useMap,
  useMapEvents,
  ZoomControl,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

function parseViewBox(viewBox) {
  if (!viewBox || typeof viewBox !== "string") return null;

  const values = viewBox
    .trim()
    .split(/[ ,]+/)
    .map(Number)
    .filter((value) => Number.isFinite(value));

  if (values.length !== 4) return null;

  const [minX, minY, width, height] = values;
  return { minX, minY, width, height };
}

function resolveMarkerIconUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;

  const url = rawUrl.trim();
  if (!url) return null;

  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return url;

  return `/${url}`;
}

function getObjectMarkerIconUrl(layer, obj) {
  return (
    obj?.marker_icon_url ||
    obj?.marker_ico_url ||
    obj?.properties?.marker_icon_url ||
    obj?.properties?.marker_ico_url ||
    obj?.style?.marker_icon_url ||
    obj?.style?.marker_ico_url ||
    layer?.marker_icon_url ||
    layer?.marker_ico_url ||
    null
  );
}

function getMarkerIconSize(layer, obj) {
  if (Array.isArray(obj?.style?.iconSize) && obj.style.iconSize.length >= 2) {
    const [width, height] = obj.style.iconSize;
    return [
      Math.max(12, Number(width) || 28),
      Math.max(12, Number(height) || 28),
    ];
  }

  if (Number.isFinite(obj?.style?.iconSize)) {
    const size = Math.max(12, Number(obj.style.iconSize));
    return [size, size];
  }

  if (Number.isFinite(layer?.marker_size)) {
    const size = Math.max(16, Number(layer.marker_size));
    return [size, size];
  }

  return [28, 28];
}

function buildLeafletIcon(layer, obj) {
  const rawUrl = getObjectMarkerIconUrl(layer, obj);
  const iconUrl = resolveMarkerIconUrl(rawUrl);

  if (!iconUrl) return null;

  const [width, height] = getMarkerIconSize(layer, obj);

  return L.icon({
    iconUrl,
    iconSize: [width, height],
    iconAnchor: [Math.round(width / 2), height],
    popupAnchor: [0, -Math.round(height * 0.85)],
  });
}

function buildFallbackMarkerIcon(layer, obj) {
  const radius = getPointRadius(layer, obj);
  const size = Math.max(radius * 2 + 6, 16);

  return L.divIcon({
    html: `
      <div
        style="
          width:${size}px;
          height:${size}px;
          border-radius:50%;
          background:#2563eb;
          border:2px solid #ffffff;
          box-shadow:0 2px 8px rgba(0,0,0,0.25);
          box-sizing:border-box;
        "
      ></div>
    `,
    className: "plan-fallback-marker-wrapper",
    iconSize: [size, size],
    iconAnchor: [Math.round(size / 2), Math.round(size / 2)],
    popupAnchor: [0, -Math.round(size / 2)],
  });
}

function createPlanClusterIcon(cluster) {
  const count = cluster.getChildCount();

  let size = 36;
  let background = "linear-gradient(135deg, #2563eb, #1d4ed8)";

  if (count >= 10 && count < 50) {
    size = 42;
    background = "linear-gradient(135deg, #f59e0b, #d97706)";
  } else if (count >= 50) {
    size = 48;
    background = "linear-gradient(135deg, #dc2626, #b91c1c)";
  }

  return L.divIcon({
    html: `
      <div
        style="
          width:${size}px;
          height:${size}px;
          border-radius:999px;
          display:flex;
          align-items:center;
          justify-content:center;
          color:#ffffff;
          font-weight:700;
          font-size:13px;
          border:3px solid #ffffff;
          box-shadow:0 4px 14px rgba(0,0,0,0.28);
          background:${background};
          box-sizing:border-box;
        "
      >
        ${count}
      </div>
    `,
    className: "plan-marker-cluster-wrapper",
    iconSize: [size, size],
  });
}

function FitBounds({ bounds, menuOpen }) {
  const map = useMap();

  useEffect(() => {
    if (!bounds) return;

    map.fitBounds(bounds, { padding: [20, 20] });
    map.setMaxBounds(bounds);
  }, [map, bounds]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [map, menuOpen]);

  return null;
}

function PlanInteractionWatcher({ onMouseChange, onMouseLeave, onZoomChange }) {
  const map = useMapEvents({
    mousemove(event) {
      const lat = event?.latlng?.lat;
      const lng = event?.latlng?.lng;

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      onMouseChange({
        x: Math.round(lng),
        y: Math.round(lat),
      });
    },
    mouseout() {
      onMouseLeave();
    },
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

function PlanStatusBadge({ coordinates, zoom }) {
  const hasCoords =
    Number.isFinite(coordinates?.x) && Number.isFinite(coordinates?.y);

  return (
    <div className="plan-coordinates-badge leaflet-control">
      {hasCoords
        ? `X : ${coordinates.x} | Y : ${coordinates.y} | Zoom : ${zoom}`
        : `X : - | Y : - | Zoom : ${zoom}`}
    </div>
  );
}

function toPlanLatLng(coords) {
  if (!Array.isArray(coords) || coords.length < 2) return null;
  return [coords[1], coords[0]];
}

function getLayerColor(layer, obj) {
  return (
    obj?.style?.color || obj?.style?.stroke || layer?.marker_color || "#2563eb"
  );
}

function getLayerFillColor(layer, obj) {
  return obj?.style?.fillColor || obj?.style?.fill || getLayerColor(layer, obj);
}

function getLayerWeight(obj) {
  return Number.isFinite(obj?.style?.weight) ? obj.style.weight : 2;
}

function getPointRadius(layer, obj) {
  if (Number.isFinite(obj?.style?.radius)) return obj.style.radius;
  if (Number.isFinite(layer?.marker_size)) {
    return Math.max(4, Math.round(layer.marker_size / 4));
  }
  return 7;
}

function renderPopupContent(obj) {
  const title = obj?.lib_objet || obj?.code_objet || "Objet";
  const description = obj?.description_objet || "";
  const props =
    obj?.properties && typeof obj.properties === "object" ? obj.properties : {};

  return (
    <div className="marker-popup">
      <div className="marker-popup__title">{title}</div>

      {description ? (
        <div className="marker-popup__description">{description}</div>
      ) : null}

      {Object.keys(props).length > 0 ? (
        <table className="marker-table">
          <tbody>
            {Object.entries(props).map(([key, value]) => (
              <tr key={key}>
                <td className="marker-table__key">
                  {String(key).replaceAll("_", " ")}
                </td>
                <td className="marker-table__value">{String(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

function PlanObjectsLayer({ layers = [], layerObjects = {}, currentZoom = 0 }) {
  const visibleEntries = useMemo(() => {
    return layers.filter((layer) => {
      if (!layer?.visible) return false;

      const minZoom = Number.isFinite(layer?.min_zoom) ? layer.min_zoom : -99;
      const maxZoom = Number.isFinite(layer?.max_zoom) ? layer.max_zoom : 99;

      return currentZoom >= minZoom && currentZoom <= maxZoom;
    });
  }, [layers, currentZoom]);

  const { pointMarkers, vectorShapes } = useMemo(() => {
    const markers = [];
    const shapes = [];

    visibleEntries.forEach((layer) => {
      const objects = Array.isArray(layerObjects?.[layer.id_calque])
        ? layerObjects[layer.id_calque]
        : [];

      objects.forEach((obj) => {
        const geom = obj?.geom;
        if (!geom?.type) return;

        const color = getLayerColor(layer, obj);
        const fillColor = getLayerFillColor(layer, obj);
        const weight = getLayerWeight(obj);
        const key = `${layer.id_calque}-${obj.id_objet}`;

        if (geom.type === "Point") {
          const center = toPlanLatLng(geom.coordinates);
          if (!center) return;

          const icon =
            buildLeafletIcon(layer, obj) || buildFallbackMarkerIcon(layer, obj);

          markers.push(
            <Marker key={key} position={center} icon={icon}>
              <Popup>{renderPopupContent(obj)}</Popup>
            </Marker>,
          );
          return;
        }

        if (geom.type === "MultiPoint") {
          geom.coordinates.forEach((coords, index) => {
            const center = toPlanLatLng(coords);
            if (!center) return;

            const icon =
              buildLeafletIcon(layer, obj) ||
              buildFallbackMarkerIcon(layer, obj);

            markers.push(
              <Marker key={`${key}-${index}`} position={center} icon={icon}>
                <Popup>{renderPopupContent(obj)}</Popup>
              </Marker>,
            );
          });
          return;
        }

        if (geom.type === "LineString") {
          const positions = geom.coordinates?.map(toPlanLatLng).filter(Boolean);
          if (!positions?.length) return;

          shapes.push(
            <Polyline
              key={key}
              positions={positions}
              pathOptions={{
                color,
                weight,
              }}
            >
              <Popup>{renderPopupContent(obj)}</Popup>
            </Polyline>,
          );
          return;
        }

        if (geom.type === "MultiLineString") {
          const positions =
            geom.coordinates?.map((line) =>
              line.map(toPlanLatLng).filter(Boolean),
            ) ?? [];

          if (!positions.length) return;

          shapes.push(
            <Polyline
              key={key}
              positions={positions}
              pathOptions={{
                color,
                weight,
              }}
            >
              <Popup>{renderPopupContent(obj)}</Popup>
            </Polyline>,
          );
          return;
        }

        if (geom.type === "Polygon") {
          const positions =
            geom.coordinates?.map((ring) =>
              ring.map(toPlanLatLng).filter(Boolean),
            ) ?? [];

          if (!positions.length) return;

          shapes.push(
            <Polygon
              key={key}
              positions={positions}
              pathOptions={{
                color,
                fillColor,
                fillOpacity: 0.25,
                weight,
              }}
            >
              <Popup>{renderPopupContent(obj)}</Popup>
            </Polygon>,
          );
          return;
        }

        if (geom.type === "MultiPolygon") {
          const positions =
            geom.coordinates?.map((polygon) =>
              polygon.map((ring) => ring.map(toPlanLatLng).filter(Boolean)),
            ) ?? [];

          if (!positions.length) return;

          shapes.push(
            <Polygon
              key={key}
              positions={positions}
              pathOptions={{
                color,
                fillColor,
                fillOpacity: 0.25,
                weight,
              }}
            >
              <Popup>{renderPopupContent(obj)}</Popup>
            </Polygon>,
          );
        }
      });
    });

    return {
      pointMarkers: markers,
      vectorShapes: shapes,
    };
  }, [visibleEntries, layerObjects]);

  return (
    <>
      <MarkerClusterGroup
        chunkedLoading
        maxClusterRadius={40}
        spiderfyOnMaxZoom
        showCoverageOnHover={false}
        zoomToBoundsOnClick
        iconCreateFunction={createPlanClusterIcon}
      >
        {pointMarkers}
      </MarkerClusterGroup>

      {vectorShapes}
    </>
  );
}

export default function PlanViewer({
  plan,
  menuOpen = true,
  layers = [],
  layerObjects = {},
  onZoomChange,
}) {
  const [mouseCoordinates, setMouseCoordinates] = useState({
    x: null,
    y: null,
  });
  const [currentZoom, setCurrentZoom] = useState(0);

  const bounds = useMemo(() => {
    if (!plan?.url) return null;

    const parsedViewBox = parseViewBox(plan.svg_viewbox);
    if (parsedViewBox) {
      const { minX, minY, width, height } = parsedViewBox;
      return [
        [minY, minX],
        [minY + height, minX + width],
      ];
    }

    const width = Number(plan.svg_width ?? plan.width) || 2000;
    const height = Number(plan.svg_height ?? plan.height) || 1400;

    return [
      [0, 0],
      [height, width],
    ];
  }, [plan]);

  const handleMouseChange = useCallback((coords) => {
    setMouseCoordinates(coords);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setMouseCoordinates({ x: null, y: null });
  }, []);

  const handleZoomChange = useCallback(
    (zoom) => {
      setCurrentZoom(zoom);
      onZoomChange?.(zoom);
    },
    [onZoomChange],
  );

  if (!plan?.url || !bounds) {
    return null;
  }

  return (
    <MapContainer
      crs={L.CRS.Simple}
      bounds={bounds}
      minZoom={-3}
      maxZoom={5}
      zoomControl={false}
      attributionControl={false}
      className="map"
    >
      <ZoomControl position="bottomright" />
      <ImageOverlay url={plan.url} bounds={bounds} />
      <FitBounds bounds={bounds} menuOpen={menuOpen} />
      <PlanInteractionWatcher
        onMouseChange={handleMouseChange}
        onMouseLeave={handleMouseLeave}
        onZoomChange={handleZoomChange}
      />
      <PlanObjectsLayer
        layers={layers}
        layerObjects={layerObjects}
        currentZoom={currentZoom}
      />
      <PlanStatusBadge coordinates={mouseCoordinates} zoom={currentZoom} />
    </MapContainer>
  );
}
