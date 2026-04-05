import React, { useEffect, useMemo, useState } from "react";
import TreeNode from "./TreeNode";

function buildInitialExpandedState(nodes, expanded, level = 0) {
  for (const node of nodes) {
    if (Array.isArray(node.children) && node.children.length > 0) {
      // Ouvre uniquement le premier niveau : les services
      expanded[node.id] = level === 0;
      buildInitialExpandedState(node.children, expanded, level + 1);
    }
  }
}

function setExpandedStateRecursively(nodes, expanded, isExpanded) {
  for (const node of nodes) {
    if (Array.isArray(node.children) && node.children.length > 0) {
      expanded[node.id] = isExpanded;
      setExpandedStateRecursively(node.children, expanded, isExpanded);
    }
  }
}

export default function CartoTree({
  data = [],
  selectedNodeId = null,
  onSelectNode,
  className = "",
  treeAction = null,
  treeActionToken = 0,
}) {
  const initialExpandedNodes = useMemo(() => {
    const expanded = {};
    buildInitialExpandedState(data, expanded, 0);
    return expanded;
  }, [data]);

  const [expandedNodes, setExpandedNodes] = useState(initialExpandedNodes);

  useEffect(() => {
    setExpandedNodes(initialExpandedNodes);
  }, [initialExpandedNodes]);

  useEffect(() => {
    if (!treeActionToken) return;

    if (treeAction === "expand") {
      const expanded = {};
      setExpandedStateRecursively(data, expanded, true);
      setExpandedNodes(expanded);
      return;
    }

    if (treeAction === "collapse") {
      const expanded = {};
      setExpandedStateRecursively(data, expanded, false);
      setExpandedNodes(expanded);
    }
  }, [treeAction, treeActionToken, data]);

  const toggleNode = (nodeId) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  return (
    <div className={`carto-tree ${className}`}>
      <div className="carto-tree__body">
        {data.length === 0 ? (
          <div className="carto-tree__empty">Aucune donnée disponible</div>
        ) : (
          data.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              level={0}
              expandedNodes={expandedNodes}
              selectedNodeId={selectedNodeId}
              onToggle={toggleNode}
              onSelect={onSelectNode}
            />
          ))
        )}
      </div>
    </div>
  );
}
