import React, { useEffect, useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "./PdfViewerModal.css";

// Worker PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfViewerModal({
  open,
  title = "Document PDF",
  pdfUrl = "",
  onClose,
}) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.1);
  const [containerWidth, setContainerWidth] = useState(900);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    const updateWidth = () => {
      const viewportWidth = window.innerWidth;
      if (viewportWidth < 640) {
        setContainerWidth(viewportWidth - 32);
      } else if (viewportWidth < 1024) {
        setContainerWidth(Math.min(700, viewportWidth - 48));
      } else {
        setContainerWidth(Math.min(1000, viewportWidth - 80));
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);

    return () => {
      window.removeEventListener("resize", updateWidth);
    };
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!open) return;

      if (event.key === "Escape") {
        onClose?.();
      }

      if (event.key === "ArrowRight") {
        setPageNumber((prev) => Math.min(prev + 1, numPages || 1));
      }

      if (event.key === "ArrowLeft") {
        setPageNumber((prev) => Math.max(prev - 1, 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, numPages, onClose]);

  const fileConfig = useMemo(() => {
    if (!pdfUrl) return null;
    return { url: pdfUrl };
  }, [pdfUrl]);

  const handleLoadSuccess = ({ numPages: totalPages }) => {
    setNumPages(totalPages);
    setPageNumber(1);
    setError("");
  };

  const handleLoadError = (err) => {
    console.error("Erreur chargement PDF :", err);
    setError("Impossible de charger ce document PDF.");
  };

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(0.6, Number((prev - 0.1).toFixed(2))));
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(2.5, Number((prev + 0.1).toFixed(2))));
  };

  const resetZoom = () => {
    setScale(1.1);
  };

  if (!open) return null;

  return (
    <div className="pdf-modal__backdrop" onClick={onClose}>
      <div className="pdf-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pdf-modal__header">
          <div className="pdf-modal__title-wrap">
            <div className="pdf-modal__title">{title}</div>
            <div className="pdf-modal__subtitle">
              {numPages > 0
                ? `${numPages} page${numPages > 1 ? "s" : ""}`
                : "Chargement..."}
            </div>
          </div>

          <div className="pdf-modal__actions">
            <button
              type="button"
              className="pdf-modal__tool-btn"
              onClick={zoomOut}
              title="Zoom -"
            >
              −
            </button>

            <button
              type="button"
              className="pdf-modal__tool-btn pdf-modal__zoom-value"
              onClick={resetZoom}
              title="Réinitialiser le zoom"
            >
              {Math.round(scale * 100)}%
            </button>

            <button
              type="button"
              className="pdf-modal__tool-btn"
              onClick={zoomIn}
              title="Zoom +"
            >
              +
            </button>

            <button
              type="button"
              className="pdf-modal__close"
              onClick={onClose}
              aria-label="Fermer"
              title="Fermer"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="pdf-modal__toolbar">
          <button
            type="button"
            className="pdf-modal__nav-btn"
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
          >
            ← Précédente
          </button>

          <div className="pdf-modal__page-indicator">
            Page <strong>{pageNumber}</strong>
            {numPages > 0 ? ` / ${numPages}` : ""}
          </div>

          <button
            type="button"
            className="pdf-modal__nav-btn"
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
          >
            Suivante →
          </button>
        </div>

        <div className="pdf-modal__body">
          {!pdfUrl ? (
            <div className="pdf-modal__state">Aucun document à afficher.</div>
          ) : error ? (
            <div className="pdf-modal__state pdf-modal__state--error">
              {error}
            </div>
          ) : (
            <div className="pdf-modal__viewer">
              <Document
                file={fileConfig}
                onLoadSuccess={handleLoadSuccess}
                onLoadError={handleLoadError}
                loading={
                  <div className="pdf-modal__state">Chargement du PDF...</div>
                }
                error={
                  <div className="pdf-modal__state pdf-modal__state--error">
                    Erreur d'affichage du PDF.
                  </div>
                }
                noData={
                  <div className="pdf-modal__state">Document introuvable.</div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  width={containerWidth}
                  renderTextLayer
                  renderAnnotationLayer
                  loading={
                    <div className="pdf-modal__state">Rendu de la page...</div>
                  }
                />
              </Document>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
