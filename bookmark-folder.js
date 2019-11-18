const init = async function() {
  renderFolderTree();
};

async function renderFolderTree() {
  const rootNode = (await browser.bookmarks.getTree())[0];
  const rootFolderTree = createFolderTree(rootNode);
  document.querySelector('#folderTree').appendChild(rootFolderTree);
}

function createFolderTree(node) {
  const ul = document.createElement('ul');
  for (child of node.children) {
    if (child.url) continue; // Skip bookmarks

    // Create list item
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = child.title;
    li.appendChild(span);
    ul.appendChild(li);

    // Create child list
    const subTree = createFolderTree(child);
    if (subTree.hasChildNodes()) li.appendChild(subTree);
  }
  return ul;
}

init();
