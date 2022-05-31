import {$, $create, asyncFilter} from './helper.js';

const init = async () => {
  const collection = await getCollection();
  collection.forEach(bookmark => {
    $('#collection').append($create(['a', {
        // If there is no url property, it is a folder
        href: bookmark.url ?? browser.runtime.getURL(`bookmark-folder.html#${bookmark.id}`),
        target: '_blank',
        class: 'bookmark',
      }, bookmark.title
    ]));
  });

  // Close the popup after clicking a bookmark
  document.querySelectorAll('.bookmark').forEach(elem => {
    elem.addEventListener('click', () => {
      setTimeout(() => window.close(), 1);
    });
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
