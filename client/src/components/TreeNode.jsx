import { useMemo, useRef, useState, useEffect } from "react";

const LONG_PRESS_DELAY = 650;

function CaretIcon({ open }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`tree-caret-svg ${open ? "open" : ""}`}
      aria-hidden="true"
    >
      <path
        d="M5 3.5l5 4.5-5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FolderIcon({ open }) {
  return (
    <svg viewBox="0 0 20 20" className="tree-svg-icon" aria-hidden="true">
      <path
        d="M2.5 6.5a2 2 0 0 1 2-2h3l1.4 1.4h6.6a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-7Z"
        fill={open ? "#fbbf24" : "#fcd34d"}
        stroke="#d97706"
        strokeWidth="1"
      />
    </svg>
  );
}

function ServiceIcon() {
  return (
    <svg viewBox="0 0 20 20" className="tree-svg-icon" aria-hidden="true">
      <rect
        x="3"
        y="4"
        width="14"
        height="12"
        rx="2"
        fill="#cbd5e1"
        stroke="#64748b"
        strokeWidth="1"
      />
      <path
        d="M6 8h8M6 11h8"
        stroke="#475569"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function InstallationIcon() {
  return (
    <svg viewBox="0 0 20 20" className="tree-svg-icon" aria-hidden="true">
      <path
        d="M4 15h12M6 15V9l4-3 4 3v6"
        fill="#dbeafe"
        stroke="#2563eb"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function FileIcon({ fileType }) {
  const isSvg = fileType?.toLowerCase().includes("svg");

  return (
    <svg viewBox="0 0 20 20" className="tree-svg-icon" aria-hidden="true">
      <path
        d="M6 2.5h5l4 4V16a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 5 16V4A1.5 1.5 0 0 1 6.5 2.5Z"
        fill={isSvg ? "#dcfce7" : "#ffffff"}
        stroke={isSvg ? "#16a34a" : "#94a3b8"}
        strokeWidth="1.1"
      />
      <path
        d="M11 2.5V6.5H15"
        fill="none"
        stroke={isSvg ? "#16a34a" : "#94a3b8"}
        strokeWidth="1.1"
      />
      {!isSvg && (
        <path
          d="M7.3 10h5.4M7.3 12.5h5.4"
          stroke="#64748b"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      )}
      {isSvg && (
        <path
          d="M7.2 13l2-2 1.6 1.4 2.2-2.4"
          fill="none"
          stroke="#16a34a"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

function getNodeIcon(node, open) {
  switch (node.type) {
    case "service":
      return <ServiceIcon />;
    case "site":
      return <FolderIcon open={open} />;
    case "installation":
      return <InstallationIcon />;
    case "folder":
      return <FolderIcon open={open} />;
    case "file":
      return <FileIcon fileType={node.fileType} />;
    default:
      return null;
  }
}

export default function TreeNode({
  node,
  level = 0,
  onFileClick,
  onFileContextMenu,
  selectedFileId,
  treeMode = "default",
}) {
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;

  const initialOpen = useMemo(() => {
    if (treeMode === "expand") return hasChildren;
    if (treeMode === "collapse") return false;
    return level < 2 || node.type === "service" || node.type === "site";
  }, [treeMode, hasChildren, level, node.type]);

  const [open, setOpen] = useState(initialOpen);

  const isSelected = node.type === "file" && selectedFileId === node.id;

  const longPressTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);
  const touchStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleClick = () => {
    if (node.type === "file") {
      if (longPressTriggeredRef.current) {
        longPressTriggeredRef.current = false;
        return;
      }

      onFileClick?.(node);
      return;
    }

    if (hasChildren) {
      setOpen((prev) => !prev);
    }
  };

  const handleContextMenu = (event) => {
    if (node.type !== "file") return;

    event.preventDefault();
    event.stopPropagation();

    onFileContextMenu?.({
      file: node,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleTouchStart = (event) => {
    if (node.type !== "file") return;

    const touch = event.touches?.[0];
    if (!touch) return;

    longPressTriggeredRef.current = false;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };

    clearLongPress();

    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;

      onFileContextMenu?.({
        file: node,
        x: touch.clientX,
        y: touch.clientY,
      });
    }, LONG_PRESS_DELAY);
  };

  const handleTouchMove = (event) => {
    if (node.type !== "file") return;

    const touch = event.touches?.[0];
    if (!touch) return;

    const dx = Math.abs(touch.clientX - touchStartRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartRef.current.y);

    if (dx > 10 || dy > 10) {
      clearLongPress();
    }
  };

  const handleTouchEnd = () => {
    clearLongPress();
  };

  const handleTouchCancel = () => {
    clearLongPress();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClick();
    }

    if (event.key === "ArrowRight" && hasChildren && !open) {
      setOpen(true);
    }

    if (event.key === "ArrowLeft" && hasChildren && open) {
      setOpen(false);
    }
  };

  return (
    <div
      className="tree-node"
      role="treeitem"
      aria-expanded={hasChildren ? open : undefined}
    >
      <div
        className={`tree-row ${node.type} ${isSelected ? "selected" : ""}`}
        style={{ marginLeft: `${level * 14}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <span className="tree-caret" aria-hidden="true">
          {hasChildren ? <CaretIcon open={open} /> : null}
        </span>

        <span className="tree-icon" aria-hidden="true">
          {getNodeIcon(node, open)}
        </span>

        <span className="tree-label" title={node.label}>
          {node.label}
        </span>
      </div>

      {hasChildren && open && (
        <div className="tree-children" role="group">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              onFileClick={onFileClick}
              onFileContextMenu={onFileContextMenu}
              selectedFileId={selectedFileId}
              treeMode={treeMode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
