browser.browserAction.onClicked.addListener(async function(){
    // Get current tab
    const currentTab = (await browser.tabs.query({currentWindow: true, active: true}))[0];

    const hmtTab = await findClosestHmtTabOnLeft(currentTab.index);

    if (hmtTab) {
        // Get folder data
        const folder = await getFolderFromHmtTab(hmtTab);

        try {
            moveTabToFolder(currentTab, folder);
        } catch (e) {
            // Do nothing
        }
    } else {
        // Open extension page
        browser.tabs.create({
            url: "/bookmark-folder.html",
            index: currentTab.index, // Previous to current tab
        });
    }
});

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

async function moveTabToFolder(tab, folder) {
    // Bookmark current tab
    await browser.bookmarks.create({
        parentId: folder.id,
        index: folder.children.length,
        title: tab.title,
        url: tab.url,
    });

    // Close current tab
    return browser.tabs.remove(tab.id);
}
