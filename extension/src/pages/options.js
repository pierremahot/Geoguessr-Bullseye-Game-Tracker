document.addEventListener('DOMContentLoaded', () => {
    const apiUrlInput = document.getElementById('apiUrl');
    const apiTokenInput = document.getElementById('apiToken');
    const saveBtn = document.getElementById('saveBtn');
    const statusDiv = document.getElementById('status');

    // Load saved settings
    chrome.storage.local.get(['apiUrl', 'apiToken'], (result) => {
        if (result.apiUrl) {
            apiUrlInput.value = result.apiUrl;
        }
        if (result.apiToken) {
            apiTokenInput.value = result.apiToken;
        }
    });

    // Save settings
    saveBtn.addEventListener('click', () => {
        const apiUrl = apiUrlInput.value.trim();
        const apiToken = apiTokenInput.value.trim();

        chrome.storage.local.set({
            apiUrl: apiUrl,
            apiToken: apiToken
        }, () => {
            showStatus('Settings saved successfully!', 'success');
        });
    });

    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = type;
        statusDiv.style.display = 'block';
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    }
});
