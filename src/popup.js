import {$, $create} from './helper.js';

const init = async () => {
  const {collection = []} = await browser.storage.local.get('collection');

  const title = $create(['h3', {}, 'My collection']);
  $('#collection').append(title);

  const bookmarks = await browser.bookmarks.get(collection);
  bookmarks.forEach(bookmark => {
    $('#collection').append($create([
      'div', {},
      ['a', {
        // If there is no url property, it is a folder
        href: bookmark.url ?? browser.runtime.getURL(`bookmark-folder.html#${bookmark.id}`),
        target: '_blank',
        class: 'bookmark',
      }, bookmark.title]
    ]));
  });

  // Close the popup after clicking a bookmark
  document.querySelectorAll('.bookmark').forEach(elem => {
    elem.addEventListener('click', () => {
      setTimeout(() => window.close(), 1);
    });
  });
};

init();
