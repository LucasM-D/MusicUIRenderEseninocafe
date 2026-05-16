let settingsContainer = document.getElementById('settings-container');
let currentUrl = window.location.href.split('?')[0].replace('index.html', '').replace(/\/$/, '');
settingsContainer.src = `https://nuttylmao.github.io/widget-customizer?settingsJson=${currentUrl}/settings.json`;

function reloadWidget(data) {
    let widget = document.getElementById("widget");
    widget.src = `${getParentUrl()}?${data}`;
}

function getParentUrl() {
    const currentUrl = window.location.href.split('?')[0];
    const urlParts = currentUrl.split('/');
    urlParts.pop();
    urlParts.pop();
    const parentUrl = urlParts.join('/');
    return parentUrl + '/';
}