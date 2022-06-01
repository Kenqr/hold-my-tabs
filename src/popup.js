import {$, $create, asyncFilter} from './helper.js';

const init = async () => {
  // Create elements for the popup
  const collection = await getCollection();
  collection.forEach(bookmark => {
    $('#collection').append($create([
      'div', {
        class: 'bookmark',
        'data-bookmark-id': bookmark.id,
      },
      ['a', {
        class: 'bookmark__remove',
        style: 'cursor: pointer;',
      }, '❌'],
      ['a', {
        // If there is no url property, it is a folder
        href: bookmark.url ?? browser.runtime.getURL(`bookmark-folder.html#${bookmark.id}`),
        target: '_blank',
        class: `bookmark__title ${bookmark.url ? 'bookmark__title--url' : 'bookmark__title--folder'}`,
      }, bookmark.title],
    ]));
  });

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
 * @returns {Promise<bookmarks.BookmarkTreeNode>} The collection as bookmarks
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
 * @returns {bookmarks.BookmarkTreeNode[]}
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
