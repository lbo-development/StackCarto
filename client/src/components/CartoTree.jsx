import TreeNode from "./TreeNode";

export default function CartoTree({
  data = [],
  onFileClick,
  onFileContextMenu,
  selectedFileId,
  treeMode = "default",
}) {
  return (
    <div
      className="carto-tree"
      role="tree"
      aria-label="Arborescence documentaire"
    >
      {data.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          level={0}
          onFileClick={onFileClick}
          onFileContextMenu={onFileContextMenu}
          selectedFileId={selectedFileId}
          treeMode={treeMode}
        />
      ))}
    </div>
  );
}
