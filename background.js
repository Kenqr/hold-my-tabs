function init() {
  browser.menus.create({
    id: "move-to-folder",
    title: "Move to Folder",
    contexts: ["all"],
  });

  browser.menus.create({
    id: "open-hmt-page",
    title: "Open HMT Page",
    contexts: ["all"],
  });

  browser.menus.onClicked.addListener(async (info, tab) => {
    switch (info.menuItemId) {
      case 'move-to-folder': {
        try {
          await moveTabToLeftHmtFolder(tab);
        } catch (e) {
          // Do nothing
        }
        break;
      }
      case 'open-hmt-page': {
        // Open extension page previous to current tab
        openHmtPage(tab.index);
        break;
      }
    }
  });

  browser.browserAction.onClicked.addListener(async (tab, onClickData) => {
    try {
      await moveTabToLeftHmtFolder(tab);
    } catch (e) {
      // Open extension page previous to current tab
      openHmtPage(tab.index);
    }
  });
}

function openHmtPage(index) {
  return browser.tabs.create({
    url: "/bookmark-folder.html",
    index: index,
  });
}

async function findClosestHmtTabOnLeft(currentTabIndex) {
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
}

async function getFolderFromHmtTab(hmtTab) {
  const url = new URL(hmtTab.url);
  const folderId = url.hash.substring(1);
  
  if (folderId) {
    return (await browser.bookmarks.getSubTree(folderId))[0];
  } else {
    return null;
  }
}

/**
* Check if folder contains a direct child with url.
*
* @param {bookmarks.BookmarkTreeNode} folder
* @param {string} url 
* @returns {boolean}
*/
function folderHasChildWithUrl(folder, url) {
  for (const child of folder.children) {
    if (child.url === url) return true;
  }
  return false;
}

/**
 * Move tab into closest HMT tab on the left side.
 * @param {tab.Tab} tab - The tab to be moved.
 * @throws {string}
 */
async function moveTabToLeftHmtFolder(tab) {
  const hmtTab = await findClosestHmtTabOnLeft(tab.index);
  if (!hmtTab) throw 'HMT tab does not exist.';

  // Get folder data
  const folder = await getFolderFromHmtTab(hmtTab);
  if (!folder) throw 'No folder selected';

  try {
    moveTabToFolder(tab, folder);
  } catch (e) {
    throw `Cannot move tab to folder: "${folder.title}"`;
  }
}

async function moveTabToFolder(tab, folder) {
  // Bookmark the tab if it is not already in the folder
  if (!folderHasChildWithUrl(folder, tab.url)) {
    await browser.bookmarks.create({
      parentId: folder.id,
      index: folder.children.length,
      title: tab.title,
      url: tab.url,
    });
  }
  
  // Close the tab
  return browser.tabs.remove(tab.id);
}

init();
