const init = async function() {
  renderFolderTree();

  renderBookmarkTree();
  window.addEventListener('hashchange', renderBookmarkTree)
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
    const anchor = document.createElement('a');
    anchor.href = '#'+child.id;
    anchor.textContent = child.title;
    li.appendChild(anchor);
    ul.appendChild(li);

    // Create child list
    const subTree = createFolderTree(child);
    if (subTree.hasChildNodes()) li.appendChild(subTree);
  }
  return ul;
}

async function renderBookmarkTree() {
  document.querySelector('#bookmarkTree').innerHTML = '';
  if (location.hash=='') {
    document.title = 'Hold My Tabs';
    document.querySelector('#folderTitle').innerHTML = '';
  } else {
    const folderId = location.hash.substring(1);
    const subTree = (await browser.bookmarks.getSubTree(folderId))[0];
    document.querySelector('#folderTitle').textContent = subTree.title;
    document.title = subTree.title + ' - Hold My Tabs';
    const bookmarkTree = createBookmarkTree(subTree);
    document.querySelector('#bookmarkTree').appendChild(bookmarkTree);
  }
}

function createBookmarkTree(node) {
  const ul = document.createElement('ul');
  for (child of node.children) {
    // Create list item
    const li = document.createElement('li');
    switch (getBtnType(child)) {
      case 'separator': {
        const span = document.createElement('span');
        span.textContent = '--------------------------------';
        li.appendChild(span);
        break;
      }
      case 'bookmark': {
        const anchor = document.createElement('a');
        anchor.href = child.url;
        anchor.target = '_blank';
        anchor.textContent = child.title;
        li.appendChild(anchor);
        break;
      }
      case 'folder': {
        const anchor = document.createElement('a');
        anchor.href = '#'+child.id;
        anchor.textContent = '📁'+child.title;
        li.appendChild(anchor);
        break;
      }
    }
    ul.appendChild(li);

    // Create child list
    if (getBtnType(child) === 'folder') {
      const subTree = createBookmarkTree(child);
      if (subTree.hasChildNodes()) li.appendChild(subTree);
    }
  }
  return ul;
}

/**
 * Get the type of the bookmark tree node.
 * 
 * @param {bookmarks.BookmarkTreeNode} node - The bookmark tree node.
 * @returns {string} The type of the bookmark tree node,
 *    which is one of the following three values: 'bookmark'|'folder'|'separator'
 */
function getBtnType(node) {
  if (node.type) {
    return node.type;
  } else {
    return node.url ? 'bookmark' : 'folder';
  }
}

init();
