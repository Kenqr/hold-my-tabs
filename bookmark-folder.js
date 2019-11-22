const init = async function() {
  renderFolderTree();

  renderBookmarkTree();
  window.addEventListener('hashchange', renderBookmarkTree);

  // Click .folder-tree-toggle to toggle #folderTreeDiv
  document.querySelector('.folder-tree-toggle').addEventListener('click', () => {
    document.querySelector('#folderTreeDiv').classList.toggle('hidden');
  });

  // Show folder tree if no folder is selected
  if (location.hash==='') {
    document.querySelector('#folderTreeDiv').classList.remove('hidden');
  }
};

async function renderFolderTree() {
  const rootNode = (await browser.bookmarks.getTree())[0];
  const rootFolderTree = createBookmarkTree(rootNode, false);
  document.querySelector('#folderTree').appendChild(rootFolderTree);
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

function createBookmarkTree(node, showBookmarks=true) {
  const ul = document.createElement('ul');
  ul.classList.add('bookmark-folder-content');
  for (child of node.children) {
    // Skip bookmarks if showBookmarks==false
    if (!showBookmarks && getBtnType(child) === 'bookmark') continue;

    // Create list item
    const li = document.createElement('li');
    switch (getBtnType(child)) {
      case 'separator': {
        const div = document.createElement('div');
        div.classList.add('bmtn', 'bmtn_separator');
        div.textContent = '--------------------------------';
        li.appendChild(div);
        break;
      }
      case 'bookmark': {
        const anchor = document.createElement('a');
        anchor.classList.add('bmtn', 'bmtn_bookmark');
        anchor.href = child.url;
        anchor.target = '_blank';

        const favicon = document.createElement('img');
        favicon.src = getFavicon(child.url);
        favicon.width = 16;

        const title = document.createElement('span');
        title.textContent = child.title;

        anchor.appendChild(favicon);
        anchor.appendChild(title);
        li.appendChild(anchor);
        break;
      }
      case 'folder': {
        const anchor = document.createElement('a');
        anchor.classList.add('bmtn', 'bmtn_folder');
        anchor.href = '#'+child.id;
        anchor.textContent = '📁'+child.title;
        li.appendChild(anchor);
        break;
      }
    }
    ul.appendChild(li);

    // Create child list
    if (getBtnType(child) === 'folder') {
      const subTree = createBookmarkTree(child, showBookmarks);
      if (subTree.hasChildNodes()) li.appendChild(subTree);
    }
  }
  return ul;
}

function getFavicon(url) {
  // Use domain name to get favicon from Google S2
  const anchor = document.createElement('a');
  anchor.href = url;
  return 'http://www.google.com/s2/favicons?domain=' + anchor.hostname;
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
