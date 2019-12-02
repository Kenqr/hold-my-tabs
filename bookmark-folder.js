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
  const rootFolderTree = createBookmarkTree(rootNode, true);
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

function createBookmarkTree(node, folderOnly=false) {
  const ul = document.createElement('ul');
  ul.classList.add('bookmark-folder-content');
  for (child of node.children) {
    // Skip non-folders if folderOnly==true
    if (folderOnly && getBmtnType(child) !== 'folder') continue;

    // Create list item
    const li = document.createElement('li');
    li.classList.add('bmti'); // Bookmark tree item
    li.dataset.bookmarkId = child.id;

    const bmtn = document.createElement('div');
    li.appendChild(bmtn);

    const buttonSet = document.createElement('div');
    buttonSet.classList.add('bmtn__button-set');
    bmtn.appendChild(buttonSet);

    switch (getBmtnType(child)) {
      case 'separator': {
        bmtn.classList.add('bmtn', 'bmtn_separator');

        const deleteButton = document.createElement('button');
        deleteButton.classList.add('bmtn__button');
        deleteButton.textContent = '🗑️';
        deleteButton.addEventListener('click', deleteBookmarkButtonEventHandler);
        buttonSet.appendChild(deleteButton);

        const bmtnBody = document.createElement('div');
        bmtnBody.classList.add('bmtn__body');
        bmtn.appendChild(bmtnBody);

        const title = document.createElement('span');
        title.classList.add('bmtn__title');
        title.textContent = '--------------------------------';
        bmtnBody.appendChild(title);

        break;
      }
      case 'bookmark': {
        bmtn.classList.add('bmtn', 'bmtn_bookmark');

        const deleteButton = document.createElement('button');
        deleteButton.classList.add('bmtn__button');
        deleteButton.textContent = '🗑️';
        deleteButton.addEventListener('click', deleteBookmarkButtonEventHandler);
        buttonSet.appendChild(deleteButton);

        const renameButton = document.createElement('button');
        renameButton.classList.add('bmtn__button');
        renameButton.textContent = '✏';
        renameButton.addEventListener('click', renameBookmarkButtonEventHandler);
        buttonSet.appendChild(renameButton);

        const bmtnBody = document.createElement('a');
        bmtnBody.classList.add('bmtn__body');
        bmtnBody.href = child.url;
        bmtnBody.target = '_blank';
        bmtn.appendChild(bmtnBody);

        const icon = document.createElement('div');
        icon.classList.add('bmtn__icon');
        const favicon = document.createElement('img');
        favicon.src = getFavicon(child.url);
        favicon.width = 16;
        icon.appendChild(favicon);
        bmtnBody.appendChild(icon);

        const title = document.createElement('span');
        title.classList.add('bmtn__title');
        title.textContent = child.title;
        bmtnBody.appendChild(title);

        break;
      }
      case 'folder': {
        bmtn.classList.add('bmtn', 'bmtn_folder');

        const deleteButton = document.createElement('button');
        deleteButton.classList.add('bmtn__button');
        deleteButton.textContent = '🗑️';
        deleteButton.addEventListener('click', deleteBookmarkButtonEventHandler);
        buttonSet.appendChild(deleteButton);

        const bmtnBody = document.createElement('a');
        bmtnBody.classList.add('bmtn__body');
        bmtnBody.href = '#'+child.id;
        bmtn.appendChild(bmtnBody);

        const icon = document.createElement('div');
        icon.classList.add('bmtn__icon');
        icon.textContent = '📁';
        bmtnBody.appendChild(icon);

        const title = document.createElement('span');
        title.classList.add('bmtn__title');
        title.textContent = child.title;
        bmtnBody.appendChild(title);

        break;
      }
    }
    ul.appendChild(li);

    // Create child list
    if (getBmtnType(child) === 'folder') {
      const subTree = createBookmarkTree(child, folderOnly);
      if (subTree.hasChildNodes()) li.appendChild(subTree);
    }
  }
  return ul;
}

async function deleteBookmarkButtonEventHandler(event) {
  // Get list item and bookmark id
  const bmti = event.target.closest('.bmti');
  const bookmarkId = bmti.dataset.bookmarkId;
  const node = (await browser.bookmarks.get(bookmarkId))[0];
  const nodeType = getBmtnType(node);

  // Confirm deletion
  const msg = `
    Do you want to delete this ${nodeType}?
    This action cannot be undone.
  `;
  const confirmed = (nodeType === 'separator') ? true : confirm(msg);
  if (!confirmed) return;

  // Delete DOM element and bookmark
  bmti.remove();
  if (nodeType === 'folder') {
    browser.bookmarks.removeTree(bookmarkId);
  } else {
    browser.bookmarks.remove(bookmarkId);
  }
}

async function renameBookmarkButtonEventHandler(event) {
  // Get list item and bookmark id
  const bmti = event.target.closest('.bmti');
  const bookmarkId = bmti.dataset.bookmarkId;
  const bookmarkTreeNode = (await(browser.bookmarks.get(bookmarkId)))[0];

  const newTitle = prompt('Rename bookmark to:', bookmarkTreeNode.title);
  if (newTitle !== null) {
    // Rename list item and bookmark
    const bmtn = event.target.closest('.bmtn');
    bmtn.querySelector('.bmtn__title').textContent = newTitle;
    browser.bookmarks.update(
      bookmarkId,
      {title: newTitle}
    );
  }
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
function getBmtnType(node) {
  if (node.type) {
    return node.type;
  } else {
    return node.url ? 'bookmark' : 'folder';
  }
}

init();
