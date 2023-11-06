import { $ } from './helper.js';
import Toastify from './lib/toastify-es-1.12.0.js';

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

/** @param {DragEvent} ev */
const onDragStart = (ev) => {
  const bmti = ev.target.closest('li.bmti');
  const bmtn = $('.bmtn', bmti);
  const isFolder = bmtn.classList.contains('bmtn_folder');
  const isBookmark = bmtn.classList.contains('bmtn_bookmark');

  const bookmarkId = bmti.dataset.bookmarkId;
  ev.dataTransfer.setData('application/holdmytabs-bookmarkid', bookmarkId);

  if (isBookmark) {
    const url = $('a.bmtn__body', bmti).getAttribute('href');
    ev.dataTransfer.setData('text/uri-list', url);
    ev.dataTransfer.setData('text/plain', url);
  } else if (isFolder) {
    const title = $('.bmtn__title', bmti).textContent;
    ev.dataTransfer.setData('text/plain', title);
  }
};
/** @param {DragEvent} ev */
const onDragOver = (ev) => {
  ev.preventDefault();
  if (ev.ctrlKey) ev.dataTransfer.dropEffect = 'copy';
  else ev.dataTransfer.dropEffect = 'move';
};
/** @param {DragEvent} ev */
const onDrop = async (ev) => {
  ev.preventDefault();
  const dt = ev.dataTransfer;
  const ctrlKey = ev.ctrlKey;

  // Skip if the event is from a child bookmark,
  // to avoid events from being processed multiple times.
  if (ev.target.closest('li.bmti') !== ev.currentTarget.closest('li.bmti')) return;

  const to = ev.target.closest('li.bmti').dataset.bookmarkId;
  const toBmtn = (await browser.bookmarks.get(to))[0];
  const droppedOnFolder = getBmtnType(toBmtn) === 'folder';
  const toParentId = droppedOnFolder ? toBmtn.id : toBmtn.parentId;
  const toIndex = droppedOnFolder ? undefined : toBmtn.index;

  // Move dragged bookmark to the new position
  const from = dt.getData('application/holdmytabs-bookmarkid');
  if (from) {
    return browser.bookmarks.move(from, { parentId: toParentId, index: toIndex });
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
        parentId: toParentId,
        index: toIndex,
        title: tstTree.tab.title,
        url: tstTree.tab.url,
      });
    }
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e;
  }

  // Move dropped bookmark to new location
  const mozPlace = dt.getData('text/x-moz-place');
  if (mozPlace) {
    const placeObject = JSON.parse(mozPlace);
    return browser.bookmarks.move(placeObject.itemGuid, { parentId: toParentId, index: toIndex });
  }

  // Try to extract urls from dropped data and add as bookmarks
  const urlList = extractUrlFromDropData(dt);
  if (urlList) addBookmarks(urlList, toParentId, toIndex);
};

/**
 * @param {DataTransfer} dt
 * @returns {?URL[]}
 */
const extractUrlFromDropData = (dt) => {
  const types = dt.types;

  const extractMethods = {
    'text/x-moz-url': extractUrlFromTextXMozUrl,
    'text/uri-list': extractUrlFromTextUriList,
    'text/html': extractUrlFromTextHtml,
    'text/plain': extractUrlFromTextPlain,
  };

  for (const format in extractMethods) {
    if (!types.includes(format)) continue;
    const urlList = extractMethods[format](dt);
    if (urlList?.length) return urlList;
  }

  return null;
};

/**
 * @param {DataTransfer} dt
 * @returns {?URL[]}
 */
const extractUrlFromTextXMozUrl = (dt) => {
  const mozUrl = dt.getData('text/x-moz-url');
  const pieces = mozUrl.split('\n');
  const urlList = [];
  for (let i = 0; i < pieces.length; i += 2) {
    try {
      const url = new URL(pieces[i]);
      url.title = pieces[i+1];
      urlList.push(url);
    } catch (e) {
      if (!(e instanceof TypeError)) throw e;
    }
  }
  return urlList;
};

/**
 * @param {DataTransfer} dt
 * @returns {?URL[]}
 */
const extractUrlFromTextUriList = (dt) => {
  return dt.getData('text/uri-list')
    .split('\n')
    .filter(str => str.charAt(0) !== '#') // Remove comments
    .map(str => str.trim())
    .map(str => {
      try {
        return new URL(str);
      } catch (e) {
        return null;
      }
    })
    .filter(str => str)
  ;
};

/**
 * @param {DataTransfer} dt
 * @returns {?URL[]}
 */
const extractUrlFromTextHtml = (dt) => {
  const html = dt.getData('text/html');
  const doc = (new DOMParser()).parseFromString(html, 'text/html');
  const links = [...doc.querySelectorAll('a')];

  return links.map(link => {
    const url = new URL(link.getAttribute('href'));
    url.title = link.textContent;
    return url;
  });
};

/**
 * @param {DataTransfer} dt
 * @returns {?URL[]}
 */
const extractUrlFromTextPlain = (dt) => {
  return dt.getData('text/plain')
    .split('\n')
    .map(str => str.trim())
    .map(str => {
      try {
        return new URL(str);
      } catch (e) {
        return null;
      }
    })
    .filter(str => str)
  ;
};

/**
 * @param {URL[]} urlList
 * @param {string} parentId
 * @param {number=} index
 * @returns {Promise.<browser.bookmarks.BookmarkTreeNode[]>}
 */
const addBookmarks = async (urlList, parentId, index) => {
  if (urlList.length === 1) {
    const url = urlList[0];
    url.title ??= prompt('Title for the new bookmark:', url.href);
    if (url.title === null) return;
  } else if (urlList.length >= 2) {
    urlList.forEach(url => url.title ??= url.href); // Use href as the default title

    // Confirm adding multiple bookmarks
    const msg = `Do you want to create ${urlList.length} new bookmarks?\n\n` +
        urlList.map(url => url.title).join('\n');
    if (!confirm(msg)) return;
  }

  const bmtnList = [];
  for (let i = 0; i < urlList.length; i++) {
    const url = urlList[i];
    const newIndex = index === undefined ? undefined : index + i;
    const bmtn = await browser.bookmarks.create({
      index: newIndex,
      parentId: parentId,
      title: url.title,
      url: url.href,
    });
    bmtnList.push(bmtn);
  }
  return bmtnList;
};

/** @param {MouseEvent} ev */
const onBookmarkClick = async (ev) => {
  if (!ev.altKey) { // Open the bookmark in a new tab
    ev.preventDefault();
    const url = ev.currentTarget.href;
    const newTabActive = !ev.ctrlKey; // Ctrl-click will open the new tab in the background
    const removeBookmark = ev.shiftKey; // Shift-click will also remove the bookmark
    const bookmarkId = ev.currentTarget.closest('.bmti').dataset.bookmarkId;

    // Get the id of this HMT tab
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const hmtTabId = tabs[0].id;

    // Open the bookmark in a new child tab
    await browser.tabs.create({ url, active: newTabActive, openerTabId: hmtTabId });

    if (removeBookmark) browser.bookmarks.remove(bookmarkId);

    // Discards current HMT tab if it is no longer active
    if (newTabActive) browser.tabs.discard(hmtTabId);
  }
}

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

        const title = document.createElement('hr');
        title.classList.add('bmtn__title');
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
        bmtnBody.addEventListener('click', onBookmarkClick);
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

  // Confirm deletion for folders
  const msg = `Do you want to delete this folder?\n📁${node.title}`;
  if (nodeType === 'folder' && !confirm(msg)) return;

  // Delete DOM element and bookmark
  bmti.remove();
  let cancelled = false;
  // Move the bookmark to a temporary position
  browser.bookmarks.move(bookmarkId, { parentId: 'unfiled_____' });
  const toast = Toastify({
    text: `The ${nodeType}:\n${node.title}\nis deleted. Click here to undo.`,
    duration: 5000,
    gravity: 'bottom',
    position: 'right',
    stopOnFocus: true,
    onClick: function() {
      // Restore the bookmark
      cancelled = true;
      browser.bookmarks.move(bookmarkId, { parentId: node.parentId, index: node.index });
      toast.hideToast();
    },
    callback: function() {
      if (cancelled) return;
      // Actually delete the bookmark
      if (nodeType === 'folder') {
        browser.bookmarks.removeTree(bookmarkId);
      } else {
        browser.bookmarks.remove(bookmarkId);
      }
    },
  }).showToast();
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
 * @param {browser.bookmarks.BookmarkTreeNode} bookmark - The bookmark tree node.
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
 * @param {browser.bookmarks.BookmarkTreeNode} node - The bookmark tree node.
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
