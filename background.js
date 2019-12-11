const init = () => {
  browser.menus.create({
    id: "move-to-folder",
    title: "Move to Folder",
    contexts: ["all"],
  });

  browser.menus.create({
    id: "add-to-folder",
    title: "Add to Folder",
    contexts: ["all"],
  });

  browser.menus.create({
    id: "open-hmt-page",
    title: "Open HMT Page",
    contexts: ["all"],
  });

  browser.menus.onClicked.addListener(async (info, tab) => {
    const hmtTab = await findClosestHmtTabOnLeft(tab.index);

    try {
      switch (info.menuItemId) {
        case 'move-to-folder': {
          if (!hmtTab) throw 'HMT tab does not exist.';
          await addTabToHmtTab(tab, hmtTab);
          await browser.tabs.remove(tab.id); // Close the tab
          break;
        }
        case 'add-to-folder': {
          if (!hmtTab) throw 'HMT tab does not exist.';
          await addTabToHmtTab(tab, hmtTab);
          break;
        }
        case 'open-hmt-page': {
          // Open extension page previous to current tab
          openHmtPage(tab.index);
          break;
        }
      }
    } catch (e) {
      // Do nothing
    }
  });

  browser.browserAction.onClicked.addListener(async (tab, onClickData) => {
    try {
      const hmtTab = await findClosestHmtTabOnLeft(tab.index);
      if (!hmtTab) throw 'HMT tab does not exist.';
    
      await addTabToHmtTab(tab, hmtTab);
      await browser.tabs.remove(tab.id); // Close the tab
    } catch (e) {
      // Open extension page previous to current tab
      openHmtPage(tab.index);
    }
  });
};

const openHmtPage = (index) => {
  return browser.tabs.create({
    url: "/bookmark-folder.html",
    index: index,
  });
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
 * Add tab into HMT tab.
 * @param {tabs.Tab} tab - The tab to be moved.
 * @param {tabs.Tab} hmtTab - The HMT tab to be moved into.
 * @returns {?Promise<bookmarks.BookmarkTreeNode>}
 *    The newly created bookmark, or null if the tab is already bookmarked.
 */
const addTabToHmtTab = async (tab, hmtTab) => {
  // Get folder data
  const folder = await getFolderFromHmtTab(hmtTab);

  return addTabToFolder(tab, folder);
};

/**
 * Bookmark the tab if it is not already in the folder.
 * @param {tabs.Tab} tab 
 * @param {bookmarks.BookmarkTreeNode} folder 
 * @throws {string}
 * @returns {?Promise<bookmarks.BookmarkTreeNode>}
 *    The newly created bookmark, or null if the tab is already bookmarked.
 */
const addTabToFolder = async (tab, folder) => {
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

init();
