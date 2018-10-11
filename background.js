browser.browserAction.onClicked.addListener(async function(){
    // Get current tab
    const currentTab = await browser.tabs.query({currentWindow: true, active: true});

    // Open extension page
    browser.tabs.create({
        url: "/bookmark-folder.html",
        index: currentTab[0].index, // Previous to current tab
    });
});
