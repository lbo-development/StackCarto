import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ImageOverlay,
  MapContainer,
  useMap,
  useMapEvents,
  ZoomControl,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

export default function PlanViewer({ plan, menuOpen = true }) {
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

  const handleZoomChange = useCallback((zoom) => {
    setCurrentZoom(zoom);
  }, []);

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
      <PlanStatusBadge coordinates={mouseCoordinates} zoom={currentZoom} />
    </MapContainer>
  );
}
