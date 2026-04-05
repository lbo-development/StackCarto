import React, { useEffect, useMemo, useState } from "react";
import TreeNode from "./TreeNode";

function normalizeData(data) {
  return Array.isArray(data) ? data : [];
}

function collectExpandableKeys(nodes, result = new Set()) {
  for (const node of nodes) {
    const children = Array.isArray(node?.children) ? node.children : [];
    const key = node?.key ?? node?.id ?? null;

    if (children.length > 0 && key) {
      result.add(key);
      collectExpandableKeys(children, result);
    }
  }

  return result;
}

export default function CartoTree({
  data = [],
  selectedNodeId = null,
  onSelectNode,
  treeAction = null,
  treeActionToken = 0,
}) {
  const treeData = useMemo(() => normalizeData(data), [data]);
  const [expandedKeys, setExpandedKeys] = useState(new Set());

  useEffect(() => {
    if (treeAction === "expand") {
      setExpandedKeys(collectExpandableKeys(treeData, new Set()));
      return;
    }

    if (treeAction === "collapse") {
      setExpandedKeys(new Set());
    }
  }, [treeAction, treeActionToken, treeData]);

  const handleToggle = (nodeKey) => {
    if (!nodeKey) return;

    setExpandedKeys((prev) => {
      const next = new Set(prev);

      if (next.has(nodeKey)) {
        next.delete(nodeKey);
      } else {
        next.add(nodeKey);
      }

      return next;
    });
  };

  const handleSelect = (node) => {
    onSelectNode?.(node);
  };

  if (treeData.length === 0) {
    return <div className="carto-tree__state">Aucun élément.</div>;
  }

  return (
    <div className="carto-tree">
      {treeData.map((node) => (
        <TreeNode
          key={node?.key ?? node?.id}
          node={node}
          level={0}
          expandedKeys={expandedKeys}
          selectedKey={selectedNodeId}
          onToggle={handleToggle}
          onSelect={handleSelect}
        />
      ))}
    </div>
  );
}
