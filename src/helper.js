/**
 * Alias for querySelector
 * @param {string} selectors - A string containing one or more selectors to match
 * @param {Element} element - The base element that would be matched against
 * @returns {?Element} The first element that matches the selectors
 */
export const $ = (selectors, element = document) => element.querySelector(selectors);

/**
 * Alias for querySelectorAll
 * @param {string} selectors - A string containing one or more selectors to match
 * @param {Element} element - The base element that would be matched against
 * @returns {NodeList.<Element>} A non-live NodeList containing matched elements
 */
export const $$ = (selectors, element = document) => element.querySelectorAll(selectors);

/**
 * Create a new element
 * @param {string} tag - The name of the element
 * @param {Object} attrs - Attributes of the element
 * @param {Array} children - Child elements to be created recursively
 * @returns {Element} The new element
 */
export const $create = ([tag, attrs = {}, ...children]) => {
  // Create the base element
  const elem = document.createElement(tag);

  // Set attributes
  Object.getOwnPropertyNames(attrs).forEach(name => {
    elem.setAttribute(name, attrs[name]);
  });

  // Create children
  children.map(child => {
    if (typeof child === 'object') return $create(child);
    return document.createTextNode(child);
  }).forEach(node => elem.appendChild(node));

  return elem;
};

/**
 * @param {Array} array
 * @param {Function} callback
 * @returns {Promise.<Array>}
 */
export const asyncMap = async (array, callback) => {
  return Promise.all(array.map(callback));
}

/**
 * @param {Array} array
 * @param {Function} callback
 * @returns {Promise.<Array>}
 */
export const asyncFilter = async (array, callback) => {
  const filterMap = await asyncMap(array, callback);
  return array.filter((value, index) => filterMap[index]);
}

/**
 * Get id of closest folder from this bookmark
 * @param {string} bookmarkId - Id of this bookmark
 * @returns {string} BookmarkId if this bookmark is a folder, otherwise parent id
 */
export const getClosestFolderId = async (bookmarkId) => {
  const bookmarks = await browser.bookmarks.get(bookmarkId);
  return bookmarks[0].url ? bookmarks[0].parentId : bookmarkId;
};
