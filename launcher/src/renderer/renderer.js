const elements = {
  form: document.getElementById('settings-form'),
  appName: document.getElementById('app-name'),
  appIcon: document.getElementById('brand-icon'),
  statusBadge: document.getElementById('status-badge'),
  apiScheme: document.getElementById('api-scheme'),
  apiHost: document.getElementById('api-host'),
  apiPort: document.getElementById('api-port'),
  frontendHost: document.getElementById('frontend-host'),
  frontendPort: document.getElementById('frontend-port'),
  networkAddresses: document.getElementById('network-addresses'),
  error: document.getElementById('error-message'),
  urls: document.getElementById('url-list'),
  startButton: document.getElementById('start-button'),
  stopButton: document.getElementById('stop-button'),
  openButton: document.getElementById('open-button'),
};

function showError(message) {
  elements.error.textContent = message ?? '';
  elements.error.hidden = !message;
}

function renderState(state) {
  document.documentElement.dataset.brand = state.appKind;
  document.title = `${state.appName} Launcher`;
  elements.appName.textContent = state.appName;
  elements.appIcon.src = state.iconDataUrl;
  elements.statusBadge.textContent = state.running ? 'Running' : 'Stopped';
  elements.statusBadge.classList.toggle('is-running', state.running);
  elements.startButton.textContent = state.running ? 'Save & Restart' : 'Save & Start';
  elements.stopButton.disabled = !state.running;
  elements.openButton.disabled = !state.running;

  elements.networkAddresses.replaceChildren();
  for (const item of state.networkAddresses ?? []) {
    const option = document.createElement('option');
    option.value = item.address;
    option.label = `${item.interfaceName} · ${item.address}`;
    elements.networkAddresses.append(option);
  }

  elements.urls.replaceChildren();
  const urls = state.urls ?? [];
  if (state.running && urls.length) {
    const heading = document.createElement('strong');
    heading.textContent = 'Available on this PC and network:';
    elements.urls.append(heading);
    for (const url of urls) {
      const link = document.createElement('a');
      link.href = url;
      link.textContent = url;
      link.addEventListener('click', (event) => {
        event.preventDefault();
        void window.launcher.openApp();
      });
      elements.urls.append(link);
    }
    elements.urls.hidden = false;
  } else {
    elements.urls.hidden = true;
  }

  if (state.settings) {
    elements.apiScheme.value = state.settings.apiScheme;
    elements.apiHost.value = state.settings.apiHost;
    elements.apiPort.value = state.settings.apiPort;
    elements.frontendHost.value = state.settings.frontendHost;
    elements.frontendPort.value = state.settings.frontendPort;
  }
  showError(state.error);
}

elements.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showError(null);
  elements.startButton.disabled = true;
  elements.startButton.textContent = 'Starting…';

  const result = await window.launcher.start({
    apiScheme: elements.apiScheme.value,
    apiHost: elements.apiHost.value,
    apiPort: elements.apiPort.value,
    frontendHost: elements.frontendHost.value,
    frontendPort: elements.frontendPort.value,
  });
  elements.startButton.disabled = false;
  if (!result.ok) {
    showError(result.error);
  }
  if (result.state) renderState(result.state);
});

elements.stopButton.addEventListener('click', async () => {
  showError(null);
  const result = await window.launcher.stop();
  if (!result.ok) showError(result.error);
  if (result.state) renderState(result.state);
});

elements.openButton.addEventListener('click', async () => {
  const result = await window.launcher.openApp();
  if (!result.ok) showError(result.error);
});

window.launcher.onStateChange(renderState);
window.launcher.getInitialState().then(renderState).catch((error) => {
  showError(`Could not load launcher settings: ${error.message}`);
});
