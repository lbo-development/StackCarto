import React, { useMemo } from "react";

function Chevron({ expanded, hasChildren }) {
  if (!hasChildren) {
    return <span className="tree-node-chevron tree-node-chevron--empty" />;
  }

  return (
    <span
      className={`tree-node-chevron ${expanded ? "expanded" : ""}`}
      aria-hidden="true"
    >
      ▸
    </span>
  );
}

function NodeIcon({ node }) {
  const type = node?.type ?? "";
  const folderType = node?.folderType ?? node?.data?.folderType ?? "";

  if (type === "service") return <span className="tree-node-icon">🏢</span>;
  if (type === "site") return <span className="tree-node-icon">📍</span>;
  if (type === "installation")
    return <span className="tree-node-icon">🏭</span>;

  if (type === "folder" && folderType === "documents")
    return <span className="tree-node-icon">📁</span>;

  if (type === "folder" && folderType === "plans")
    return <span className="tree-node-icon">🗂️</span>;

  if (type === "document") return <span className="tree-node-icon">📄</span>;
  if (type === "plan") return <span className="tree-node-icon">🗺️</span>;

  return <span className="tree-node-icon">•</span>;
}

export default function TreeNode({
  node,
  level = 0,
  expandedKeys,
  selectedKey,
  onToggle,
  onSelect,
}) {
  const children = useMemo(
    () => (Array.isArray(node?.children) ? node.children : []),
    [node],
  );

  const hasChildren = children.length > 0;
  const nodeKey = node?.key ?? node?.id;

  const expanded = expandedKeys?.has(nodeKey);
  const isSelected = selectedKey === node?.id;

  const handleToggle = (e) => {
    e.stopPropagation();
    onToggle?.(nodeKey);
  };

  const handleClick = () => {
    onSelect?.(node);
  };

  return (
    <div className="tree-node">
      <div
        className={`tree-node-row ${isSelected ? "selected" : ""}`}
        style={{ paddingLeft: `${level * 18 + 8}px` }}
        onClick={handleClick}
      >
        <button
          type="button"
          className="tree-node-toggle"
          onClick={handleToggle}
          tabIndex={-1}
        >
          <Chevron expanded={expanded} hasChildren={hasChildren} />
        </button>

        <NodeIcon node={node} />

        <span className="tree-node-label">{node?.label}</span>
      </div>

      {hasChildren && expanded && (
        <div className="tree-node-children">
          {children.map((child) => (
            <TreeNode
              key={child?.key ?? child?.id}
              node={child}
              level={level + 1}
              expandedKeys={expandedKeys}
              selectedKey={selectedKey}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
