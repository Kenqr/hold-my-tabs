import {$} from './helper.js';

const init = async () => {
  renderFolderTree();

  renderBookmarkTree();
  window.addEventListener('hashchange', renderBookmarkTree);

  // Click .folder-tree-toggle to toggle #folderTreeDiv
  $('.folder-tree-toggle').addEventListener('click', () => {
    $('#folderTreeDiv').classList.toggle('hidden');
  });

  // Show folder tree if no folder is selected
  if (!location.hash) {
    $('#folderTreeDiv').classList.remove('hidden');
  }

  // Auto update bookmark tree
  browser.bookmarks.onCreated.addListener(onBookmarkCreated);
  browser.bookmarks.onRemoved.addListener(onBookmarkRemoved);
  browser.bookmarks.onChanged.addListener(onBookmarkChanged);
  browser.bookmarks.onMoved.addListener(onBookmarkMoved);
};

const renderFolderTree = async () => {
  $('#folderTree').innerHTML = '';
  const rootNode = (await browser.bookmarks.getTree())[0];
  const rootFolderTree = createBookmarkTree(rootNode, true);
  $('#folderTree').appendChild(rootFolderTree);
};

const renderBookmarkTree = async () => {
  const folderId = getCurrentFolderId();
  const subTree = (await browser.bookmarks.getSubTree(folderId))[0];
  const bookmarkTree = createBookmarkTree(subTree);
  document.title = subTree.title + ' - HMT';
  $('#folderTitle').textContent = subTree.title;
  $('#bookmarkTree').innerHTML = '';
  $('#bookmarkTree').appendChild(bookmarkTree);
};

const onDragStart = (ev) => {
  const li = ev.target.closest('li.bmti');
  ev.dataTransfer.setData('application/holdmytabs-bookmarkid', li.dataset.bookmarkId);
};
const onDragOver = (ev) => {
  ev.preventDefault();
  ev.dataTransfer.dropEffect = 'move';
};
const onDrop = async (ev) => {
  ev.preventDefault();
  const dt = ev.dataTransfer;
  const ctrlKey = ev.ctrlKey;

  const to = ev.target.closest('li.bmti').dataset.bookmarkId;
  const toBmtn = (await browser.bookmarks.get(to))[0];

  // Move dragged bookmark to the new position
  const from = dt.getData('application/holdmytabs-bookmarkid');
  if (from) {
    const fromBmtn = (await browser.bookmarks.get(from))[0];
    // Only moving within the same folder is allowed for now
    if (fromBmtn.parentId === toBmtn.parentId) {
      return browser.bookmarks.move(from, {index: toBmtn.index})
    }
  }

  // Add dragged tab from the tst sidebar to the current folder
  try {
    const tstTree = JSON.parse(dt.getData('application/x-treestyletab-tree'));
    if (tstTree?.tab?.title && tstTree?.tab?.url) {
      // Close the tab if ctrl is not pressed
      if (!ctrlKey && tstTree?.tab?.id) {
        browser.tabs.remove(tstTree.tab.id);
      }

      return browser.bookmarks.create({
        parentId: toBmtn.parentId,
        index: toBmtn.index,
        title: tstTree.tab.title,
        url: tstTree.tab.url,
      });
    }
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e;
  }
};

const createBookmarkTree = (node, folderOnly = false) => {
  const ul = document.createElement('ul');
  ul.classList.add('bookmark-folder-content');
  for (let child of node.children) {
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

    // Drag and Drop
    if (!folderOnly) {
      li.setAttribute('draggable', 'true');
      li.addEventListener('dragstart', onDragStart);
      li.addEventListener('dragover', onDragOver);
      li.addEventListener('drop', onDrop);
    }

    switch (getBmtnType(child)) {
      case 'separator': {
        bmtn.classList.add('bmtn', 'bmtn_separator');

        const deleteButton = createBmtnButton(buttonDetails.delete);
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

        const deleteButton = createBmtnButton(buttonDetails.delete);
        buttonSet.appendChild(deleteButton);

        const openAndDeleteButton = createBmtnButton(buttonDetails.openAndDelete);
        buttonSet.appendChild(openAndDeleteButton);

        const renameButton = createBmtnButton(buttonDetails.rename);
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

        const deleteButton = createBmtnButton(buttonDetails.delete);
        buttonSet.appendChild(deleteButton);

        const renameButton = createBmtnButton(buttonDetails.rename);
        buttonSet.appendChild(renameButton);

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
};

const createBmtnButton = ({text, eventHandler, title}) => {
  const button = document.createElement('button');
  button.classList.add('bmtn__button');
  button.textContent = text;
  button.addEventListener('click', eventHandler);
  if (title) button.title = title;
  return button;
};

const deleteBookmarkButtonEventHandler = async (event) => {
  // Get list item and bookmark id
  const bmti = event.target.closest('.bmti');
  const bookmarkId = bmti.dataset.bookmarkId;
  const node = await getNode(bookmarkId);
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
};

const openAndDeleteBookmarkButtonEventHandler = async (event) => {
  // Get list item and bookmark id
  const bmti = event.target.closest('.bmti');
  const bookmarkId = bmti.dataset.bookmarkId;
  const bookmark = await getNode(bookmarkId);

  // Open url in a new tab
  browser.tabs.create({
    url: bookmark.url,
  });

  // Delete DOM element and bookmark
  bmti.remove();
  browser.bookmarks.remove(bookmarkId);
};

const renameBookmarkButtonEventHandler = async (event) => {
  // Get list item and bookmark id
  const bmti = event.target.closest('.bmti');
  const bookmarkId = bmti.dataset.bookmarkId;
  const bookmarkTreeNode = await getNode(bookmarkId);

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
};

const buttonDetails = {
  delete: {
    text: '🗑️',
    eventHandler: deleteBookmarkButtonEventHandler,
    title: 'Delete',
  },
  openAndDelete: {
    text: '↗️',
    eventHandler: openAndDeleteBookmarkButtonEventHandler,
    title: 'Open & Delete',
  },
  rename: {
    text: '✏',
    eventHandler: renameBookmarkButtonEventHandler,
    title: 'Rename',
  },
};

const getFavicon = (url) => {
  const protocol = (new URL(url)).protocol;
  // Use domain name to get favicon from Google S2 for https and http
  if (protocol === 'https:' || protocol === 'http:') {
    const anchor = document.createElement('a');
    anchor.href = url;
    return 'https://www.google.com/s2/favicons?domain=' + anchor.hostname;
  }

  // No favicon for other protocols
  return '';
};

/**
 * Decides if bookmark is in current folder
 * 
 * @param {bookmarks.BookmarkTreeNode} bookmark - The bookmark tree node.
 * @returns {boolean} Whether bookmark is in current folder or not.
 */
 const isInCurrentFolder = async (bookmark) => {
  const folderId = getCurrentFolderId();

  for (let b = bookmark; ; b = await getNode(b.parentId)) {
    if (b.id === folderId) return true;
    if (!b.parentId) break;
  }

  return false;
};

const onBookmarkCreated = async (id, bookmark) => {
  renderFolderTreeIfIsFolder(id);

  // Re-render bookmark tree if current folder is the new bookmark's ancestor
  if (isInCurrentFolder(bookmark)) renderBookmarkTree();
};

const onBookmarkRemoved = async (id, {node: bookmark}) => {
  renderFolderTreeIfIsFolder(bookmark);

  // Re-render bookmark tree if current folder is the removed bookmark's ancestor
  if (isInCurrentFolder(bookmark)) renderBookmarkTree();
}

const onBookmarkChanged = async (id) => {
  renderFolderTreeIfIsFolder(id);

  // Re-render bookmark tree if current folder is the changed bookmark's ancestor
  if (isInCurrentFolder(await getNode(id))) renderBookmarkTree();
}

const onBookmarkMoved = async (id, {parentId, oldParentId}) => {
  renderFolderTreeIfIsFolder(id);

  // Re-render bookmark tree if current folder is the moved bookmark's ancestor
  if (
    isInCurrentFolder(await getNode(parentId)) ||
    isInCurrentFolder(await getNode(oldParentId))
  ) renderBookmarkTree();
};

const renderFolderTreeIfIsFolder = async (bookmarkOrId) => {
  const bookmark = (typeof bookmarkOrId === 'string') ? await getNode(bookmarkOrId) : bookmarkOrId;
  if (getBmtnType(bookmark) === 'folder') renderFolderTree();
};

/**
 * Get current folder id from hash
 * 
 * @returns {?string} Current folder id, or null if no folder is selected.
 */
const getCurrentFolderId = () => {
  return location.hash ? location.hash.substring(1) : 'unfiled_____';
};

/**
 * Get the type of the bookmark tree node.
 * 
 * @param {bookmarks.BookmarkTreeNode} node - The bookmark tree node.
 * @returns {string} The type of the bookmark tree node,
 *    which is one of the following three values: 'bookmark'|'folder'|'separator'
 */
const getBmtnType = (node) => {
  if (node.type) {
    return node.type;
  } else {
    return node.url ? 'bookmark' : 'folder';
  }
};

const getNode = async (bmId) => {
  return (await browser.bookmarks.get(bmId))[0];
};

init();
