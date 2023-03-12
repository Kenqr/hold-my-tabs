import {$, $$, $create, asyncFilter} from './helper.js';

const init = async () => {
  refreshCollectionView();
};

const refreshCollectionView = async () => {
  $('#collection').textContent = '';

  // Create elements for the popup
  const collectionAppend = (bookmark, removable = true) => {
    const children = [];
    if (removable) {
      children.push(['a', {
        class: 'bookmark__remove',
        style: 'cursor: pointer;',
      }, '❌']);
    }
    children.push(['a', {
        // If there is no url property, it is a folder
        href: bookmark.url ?? browser.runtime.getURL(`bookmark-folder.html#${bookmark.id}`),
        target: '_blank',
        class: `bookmark__title ${bookmark.url ? 'bookmark__title--url' : 'bookmark__title--folder'}`,
      }, bookmark.title
    ]);

    $('#collection').append($create([
      'div', {
        class: 'bookmark',
        'data-bookmark-id': bookmark.id,
      },
      ...children,
    ]));
  };
  const collection = await getCollection();
  const unfiled = (await getBookmarks(['unfiled_____']))[0]; // Other Bookmarks
  collection.forEach(bookmark => collectionAppend(bookmark));
  collectionAppend(unfiled, false);

  if (!collection.length) {
    $('#collection').append($create([
      'div', {}, 'Add bookmarks or folders to the collection to see them here.'
    ]));
  }

  // Remove the bookmark from the collection when the cross symbol is clicked
  const removeBookmarkHandler = async (event) => {
    const bmElem = event.currentTarget.closest('.bookmark');
    const bmId = bmElem.dataset.bookmarkId;

    // Remove the bookmark element from the popup
    bmElem.remove();

    // Remove the bookmark from the collection
    const {collection = []} = await browser.storage.local.get('collection');
    const index = collection.indexOf(bmId);
    collection.splice(index, 1);
    await browser.storage.local.set({ collection });
  };
  document.querySelectorAll('.bookmark__remove').forEach(elem => {
    elem.addEventListener('click', removeBookmarkHandler);
  });

  // Allow drag and drop
  (() => {
    const onDragStart = (ev) => {
      const bm = ev.target.closest('div.bookmark');
      ev.dataTransfer.setData('application/holdmytabs-bookmarkid', bm.dataset.bookmarkId);
    };
    const onDragOver = (ev) => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
    };
    const onDrop = async (ev) => {
      ev.preventDefault();
      const from = ev.dataTransfer.getData('application/holdmytabs-bookmarkid');
      const to = ev.target.closest('div.bookmark').dataset.bookmarkId;

      // Remove the bookmark from the collection
      const {collection = []} = await browser.storage.local.get('collection');
      const fromIndex = collection.indexOf(from);
      const toIndex = collection.indexOf(to);
      collection.splice(fromIndex, 1);
      collection.splice(toIndex, 0, from);
      await browser.storage.local.set({ collection });
      refreshCollectionView();
    };

    $$('.bookmark__title').forEach(bmTitle => {
      bmTitle.setAttribute('draggable', 'true');
      bmTitle.addEventListener('dragstart', onDragStart);
      bmTitle.addEventListener('dragover', onDragOver);
      bmTitle.addEventListener('drop', onDrop);
    })
  })();

  // Close the popup after clicking any bookmark
  const closePopupHandler = () => {
    setTimeout(() => window.close(), 1);
  };
  document.querySelectorAll('.bookmark__title').forEach(elem => {
    elem.addEventListener('click', closePopupHandler);
  });
};

/**
 * Get the collection as bookmarks, but remove deleted bookmarks beforehand.
 * @returns {Promise.<browser.bookmarks.BookmarkTreeNode>} The collection as bookmarks
 */
const getCollection = async () => {
  const {collection = []} = await browser.storage.local.get('collection');
  const bookmarks = await getBookmarks(collection);
  if (bookmarks) return bookmarks; // All bookmarks in the collection still exist

  const newCollection = await asyncFilter(collection, async (bookmarkId) => {
    const bookmarks = await getBookmarks([bookmarkId]);
    return bookmarks;
  });
  await browser.storage.local.set({ collection: newCollection });

  return await getBookmarks(newCollection);
};

/**
 * Get bookmarks from array of bookmark id.
 *
 * Same as browser.bookmarks.get, except:
 * 1. Returns false instead of throwing an error when any of the bookmarks does not exist.
 * 2. Does not accept a single string to be the parameter.
 * 3. Accepts an empty array as the parameter.
 * @param {string[]} bookmarkIds 
 * @returns {browser.bookmarks.BookmarkTreeNode[]}
 *    Array of bookmarks on success, false if any of the bookmarks does not exist
 */
const getBookmarks = async (bookmarkIds) => {
  if (bookmarkIds.length === 0) return [];

  try {
    return await browser.bookmarks.get(bookmarkIds);
  } catch (e) {
    return false;
  }
};

init();
