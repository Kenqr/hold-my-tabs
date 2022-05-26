// Alias for document.querySelector
export const $ = (...args) => document.querySelector(...args);

/**
 * Create a new element
 * @param {string} tag - The name of the element
 * @param {object} attrs - Attributes of the element
 * @param {array} children - Child elements to be created recursively
 * @returns The new element
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
