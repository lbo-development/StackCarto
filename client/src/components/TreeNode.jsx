import React, { useEffect, useRef } from "react";

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

function ServiceIcon() {
  return (
    <svg viewBox="0 0 20 20" className="tree-svg-icon" aria-hidden="true">
      <rect
        x="3"
        y="4"
        width="14"
        height="12"
        rx="2"
        fill="#e2e8f0"
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

function SiteIcon() {
  return (
    <svg viewBox="0 0 20 20" className="tree-svg-icon" aria-hidden="true">
      <path
        d="M10 2.8c-2.7 0-4.8 2.1-4.8 4.8 0 3.5 4.8 8.8 4.8 8.8s4.8-5.3 4.8-8.8c0-2.7-2.1-4.8-4.8-4.8Z"
        fill="#dbeafe"
        stroke="#2563eb"
        strokeWidth="1.1"
      />
      <circle cx="10" cy="7.6" r="1.6" fill="#2563eb" />
    </svg>
  );
}

function InstallationIcon() {
  return (
    <svg viewBox="0 0 20 20" className="tree-svg-icon" aria-hidden="true">
      <path
        d="M4 15h12M6 15V9l4-3 4 3v6"
        fill="#e0f2fe"
        stroke="#0284c7"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function FolderIcon({ variant = "documents", open }) {
  const fill =
    variant === "plans"
      ? open
        ? "#bfdbfe"
        : "#dbeafe"
      : open
        ? "#fbbf24"
        : "#fde68a";
  const stroke = variant === "plans" ? "#2563eb" : "#d97706";

  return (
    <svg viewBox="0 0 20 20" className="tree-svg-icon" aria-hidden="true">
      <path
        d="M2.5 6.5a2 2 0 0 1 2-2h3l1.4 1.4h6.6a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-7Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="1"
      />
    </svg>
  );
}

function FileIcon({ plan = false }) {
  return (
    <svg viewBox="0 0 20 20" className="tree-svg-icon" aria-hidden="true">
      <path
        d="M6 2.5h5l4 4V16a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 5 16V4A1.5 1.5 0 0 1 6.5 2.5Z"
        fill={plan ? "#ecfeff" : "#ffffff"}
        stroke={plan ? "#0891b2" : "#94a3b8"}
        strokeWidth="1.1"
      />
      <path
        d="M11 2.5V6.5H15"
        fill="none"
        stroke={plan ? "#0891b2" : "#94a3b8"}
        strokeWidth="1.1"
      />
      {plan ? (
        <path
          d="M7.1 13.3l2-2 1.7 1.2 2.1-2.2"
          fill="none"
          stroke="#0891b2"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M7.3 10h5.4M7.3 12.5h5.4"
          stroke="#64748b"
          strokeWidth="1.1"
          strokeLinecap="round"
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
      return <SiteIcon />;
    case "installation":
      return <InstallationIcon />;
    case "folder": {
      const label = (node.label || "").toLowerCase();
      const variant = label.includes("plan") ? "plans" : "documents";
      return <FolderIcon variant={variant} open={open} />;
    }
    case "document":
      return <FileIcon plan={false} />;
    case "plan":
      return <FileIcon plan />;
    default:
      return <FileIcon plan={false} />;
  }
}

export default function TreeNode({
  node,
  level = 0,
  expandedNodes = {},
  selectedNodeId = null,
  onToggle,
  onSelect,
  onContextMenu,
}) {
  const rowRef = useRef(null);

  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const isOpen = !!expandedNodes[node.id];
  const isSelected = selectedNodeId === node.id;

  useEffect(() => {
    if (isSelected && rowRef.current) {
      rowRef.current.scrollIntoView({
        block: "nearest",
      });
    }
  }, [isSelected]);

  const handleToggleClick = (event) => {
    event.stopPropagation();
    if (hasChildren) {
      onToggle?.(node.id);
    }
  };

  const handleRowClick = () => {
    onSelect?.(node);
  };

  const handleContextMenu = (event) => {
    if (node.type !== "document" && node.type !== "plan") return;

    event.preventDefault();
    event.stopPropagation();

    onContextMenu?.({
      node,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleDoubleClick = () => {
    if (node.type === "document" || node.type === "plan") {
      onSelect?.(node);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleRowClick();
    }

    if (event.key === "ArrowRight" && hasChildren && !isOpen) {
      event.preventDefault();
      onToggle?.(node.id);
    }

    if (event.key === "ArrowLeft" && hasChildren && isOpen) {
      event.preventDefault();
      onToggle?.(node.id);
    }
  };

  return (
    <div
      className="tree-node"
      role="treeitem"
      aria-expanded={hasChildren ? isOpen : undefined}
      aria-selected={isSelected}
    >
      <div
        ref={rowRef}
        className={[
          "tree-row",
          `tree-row--${node.type || "default"}`,
          isSelected ? "selected" : "",
        ].join(" ")}
        style={{ paddingLeft: `${level * 18 + 6}px` }}
        onClick={handleRowClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <button
          type="button"
          className={`tree-caret ${hasChildren ? "" : "tree-caret--empty"}`}
          onClick={handleToggleClick}
          aria-label={
            hasChildren ? (isOpen ? "Replier" : "Déplier") : "Sans enfant"
          }
          disabled={!hasChildren}
          tabIndex={-1}
        >
          {hasChildren ? <CaretIcon open={isOpen} /> : null}
        </button>

        <span className="tree-icon" aria-hidden="true">
          {getNodeIcon(node, isOpen)}
        </span>

        <span className="tree-label" title={node.label}>
          {node.label}
        </span>
      </div>

      {hasChildren && isOpen && (
        <div className="tree-children" role="group">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              expandedNodes={expandedNodes}
              selectedNodeId={selectedNodeId}
              onToggle={onToggle}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
}
