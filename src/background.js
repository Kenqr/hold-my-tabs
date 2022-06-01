const openHmtPage = async ({index, bookmarkId} = {}) => {
  const bookmarkFolderId = bookmarkId ? (await getClosestFolderId(bookmarkId)) : '';

  return browser.tabs.create({
    url: `/bookmark-folder.html#${bookmarkFolderId}`,
    index: index,
  });
};

/**
 * Get id of closest folder from this bookmark
 * @param {string} bookmarkId - Id of this bookmark
 * @returns {string} - bookmarkId if this bookmark is a folder, otherwise parent id
 */
const getClosestFolderId = async (bookmarkId) => {
  const bookmarks = await browser.bookmarks.get(bookmarkId);
  return bookmarks[0].url ? bookmarks[0].parentId : bookmarkId;
};

const findClosestHmtTabOnLeft = async (currentTabIndex) => {
  // Get extension page url
  const url = browser.runtime.getURL('bookmark-folder.html');
  
  // Get HMT tabs in current window
  const tabList = await browser.tabs.query({
    currentWindow: true,
    url: [
      url,
      url + '#*',
    ],
  });
  
  // Find tab with largest index but smaller than currentTab
  for (let i=tabList.length-1; i>=0; i--) {
    if (tabList[i].index < currentTabIndex) return tabList[i];
  }
  
  return null;
};

const getFolderFromHmtTab = async (hmtTab) => {
  const url = new URL(hmtTab.url);
  const folderId = url.hash ? url.hash.substring(1) : 'unfiled_____';

  return (await browser.bookmarks.getSubTree(folderId))[0];
};

/**
* Check if folder contains a direct child with url.
*
* @param {bookmarks.BookmarkTreeNode} folder
* @param {string} url 
* @returns {boolean}
*/
const folderHasChildWithUrl = (folder, url) => {
  for (const child of folder.children) {
    if (child.url === url) return true;
  }
  return false;
};

/**
 * Copy tab into HMT tab.
 * @param {tabs.Tab} tab - The tab to be copied.
 * @param {tabs.Tab} hmtTab - The HMT tab to be copied into.
 * @returns {?Promise<bookmarks.BookmarkTreeNode>}
 *    The newly created bookmark, or null if the tab is already bookmarked.
 */
const copyTabToHmtTab = async (tab, hmtTab) => {
  // Get folder data
  const folder = await getFolderFromHmtTab(hmtTab);

  return copyTabToFolder(tab, folder);
};

/**
 * Bookmark the tab if it is not already in the folder.
 * @param {tabs.Tab} tab 
 * @param {bookmarks.BookmarkTreeNode} folder 
 * @throws {string}
 * @returns {?Promise<bookmarks.BookmarkTreeNode>}
 *    The newly created bookmark, or null if the tab is already bookmarked.
 */
const copyTabToFolder = async (tab, folder) => {
  if (folderHasChildWithUrl(folder, tab.url)) return null;

  try {
    return await browser.bookmarks.create({
      parentId: folder.id,
      index: folder.children.length,
      title: tab.title,
      url: tab.url,
    });
  } catch (e) {
    throw `Cannot add tab to folder: "${folder.title}"`;
  }
};

/**
 * Bookmark & close tabs between this tab and previous HMT tab.
 * @param {tabs.Tab} tab - This tab.
 * @param {tabs.Tab} hmtTab - Previous HMT tab.
 */
const menuMoveTabsToFolder = async (tab, hmtTab) => {
  const tabsCopied = await menuCopyTabsToFolder(tab, hmtTab);
  for (tab of tabsCopied) {
    browser.tabs.remove(tab.id); // Close the tab
  }
};

/**
 * Bookmark tabs between this tab and previous HMT tab.
 * @param {tabs.Tab} tab - This tab.
 * @param {tabs.Tab} hmtTab - Previous HMT tab.
 * @returns {tabs.Tab[]} Bookmarked tabs.
 */
const menuCopyTabsToFolder = async (tab, hmtTab) => {
  const folder = await getFolderFromHmtTab(hmtTab);

  // Get to-be-copied tab list
  const startIndex = hmtTab.index + 1;
  const endIndex = tab.index;
  const tabsInWindow = await browser.tabs.query({
    currentWindow: true,
  });
  const tabsToBeCopied = tabsInWindow.slice(startIndex, endIndex + 1);

  // Copy tabs
  const tabsCopied = [];
  for (tab of tabsToBeCopied) {
    try {
      await copyTabToFolder(tab, folder);
      tabsCopied.push(tab);
    } catch (e) {
      // Do nothing
    }
  }

  return tabsCopied;
};


// Create menu items
browser.menus.create({
  id: 'move-to-folder',
  title: 'Move to Folder',
  contexts: ['all', 'tab'],
});

browser.menus.create({
  id: 'copy-to-folder',
  title: 'Copy to Folder',
  contexts: ['all', 'tab'],
});

browser.menus.create({
  id: 'move-tabs-to-folder',
  title: 'Move Tabs to Folder',
  contexts: ['all', 'tab'],
});

browser.menus.create({
  id: 'copy-tabs-to-folder',
  title: 'Copy Tabs to Folder',
  contexts: ['all', 'tab'],
});

browser.menus.create({
  id: 'open-hmt-page',
  title: 'Open HMT Page',
  contexts: ['all', 'tab'],
});

browser.menus.create({
  id: 'open-as-hmt-page',
  title: 'Open as HMT Page',
  contexts: ['bookmark'],
});

browser.menus.create({
  id: 'add-to-collection',
  title: 'Add to collection',
  contexts: ['bookmark'],
});


// Create event listeners
browser.menus.onClicked.addListener(async (info, tab) => {
  const hmtTab = tab ? await findClosestHmtTabOnLeft(tab.index) : null;

  try {
    switch (info.menuItemId) {
      case 'move-to-folder': {
        if (!hmtTab) throw 'HMT tab does not exist.';
        await copyTabToHmtTab(tab, hmtTab);
        await browser.tabs.remove(tab.id); // Close the tab
        break;
      }
      case 'copy-to-folder': {
        if (!hmtTab) throw 'HMT tab does not exist.';
        await copyTabToHmtTab(tab, hmtTab);
        break;
      }
      case 'move-tabs-to-folder': {
        if (!hmtTab) throw 'HMT tab does not exist.';
        await menuMoveTabsToFolder(tab, hmtTab);
        break;
      }
      case 'copy-tabs-to-folder': {
        if (!hmtTab) throw 'HMT tab does not exist.';
        await menuCopyTabsToFolder(tab, hmtTab);
        break;
      }
      case 'open-hmt-page': {
        // Open extension page previous to current tab
        await openHmtPage({index: tab.index});
        break;
      }
      case 'open-as-hmt-page': {
        // Open selected bookmark in HMT
        await openHmtPage({bookmarkId: info.bookmarkId});
        break;
      }
      case 'add-to-collection': {
        try {
          const bookmarks = await browser.bookmarks.get(info.bookmarkId);
          if (bookmarks[0].type === 'separator') throw 'Cannot add separators';

          const {collection = []} = await browser.storage.local.get('collection');
          if (collection.includes(info.bookmarkId)) throw 'Already in collection';

          collection.push(info.bookmarkId);
          await browser.storage.local.set({ collection });
        } catch (e) {
          console.warn(e);
        }
        break;
      }
    }
  } catch (e) {
    // Do nothing
  }
});

browser.pageAction.onClicked.addListener(async (tab) => {
  try {
    const hmtTab = await findClosestHmtTabOnLeft(tab.index);
    if (!hmtTab) throw 'HMT tab does not exist.';
  
    await copyTabToHmtTab(tab, hmtTab);
    await browser.tabs.remove(tab.id); // Close the tab
  } catch (e) {
    // Open extension page previous to current tab
    await openHmtPage({index: tab.index});
  }
});
