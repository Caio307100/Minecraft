const DB_NAME = 'minecraft-1-browser-assets';
const STORE_NAME = 'files';
const MANIFEST_URL = './public/assets-manifest.json';
let requiredAssetsPromise;

async function getRequiredAssets() {
    if (!requiredAssetsPromise) {
        requiredAssetsPromise = fetch(MANIFEST_URL, { cache: 'no-store' })
            .then(response => {
                if (!response.ok) throw new Error(`Manifesto de assets indisponível: ${response.status}`);
                return response.json();
            })
            .then(manifest => {
                if (!Array.isArray(manifest.files) || !manifest.files.length) throw new Error('Manifesto de assets inválido.');
                return manifest.files;
            });
    }
    return requiredAssetsPromise;
}

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
}

function normalizeAssetPath(value) {
    let path = String(value).replaceAll('\\', '/').replace(/^\/+/, '');
    path = path.replace(/^public\/assets\//, '').replace(/^assets\//, '');
    return path;
}

function showImportScreen(message) {
    const screen = document.querySelector('#asset-loader');
    const status = document.querySelector('#asset-loader-status');
    screen.hidden = false;
    status.textContent = message;
    document.querySelector('#asset-folder').focus();
}

async function readStoredAssets(db, requiredAssets) {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).getAllKeys();
    const keys = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    if (!requiredAssets.every(path => keys.includes(path))) return null;

    const read = db.transaction(STORE_NAME, 'readonly');
    const store = read.objectStore(STORE_NAME);
    const entries = await Promise.all(keys.map(path => new Promise((resolve, reject) => {
        const item = store.get(path);
        item.onsuccess = () => resolve([path, item.result]);
        item.onerror = () => reject(item.error);
    })));
    const stored = new Map(entries.filter(([, blob]) => blob instanceof Blob));
    return requiredAssets.every(path => stored.has(path)) ? stored : null;
}

async function readStaticAssets(requiredAssets) {
    if (location.protocol === 'file:') return [];
    const checks = await Promise.all(requiredAssets.map(async path => {
        try {
            const response = await fetch(`./public/assets/${path}`, { method: 'HEAD', cache: 'no-store' });
            return response.ok ? null : path;
        } catch {
            return path;
        }
    }));
    return checks.filter(Boolean);
}

function installAssetResolvers(assetUrls) {
    const resolveAsset = value => {
        if (typeof value !== 'string') return value;
        try {
            const url = new URL(value, location.href);
            const prefix = '/public/assets/';
            const index = url.pathname.indexOf(prefix);
            if (index < 0) return value;
            const key = decodeURIComponent(url.pathname.slice(index + prefix.length));
            return assetUrls.get(key) || value;
        } catch {
            return value;
        }
    };

    window.mcAssetUrl = path => resolveAsset(path);

    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
        const source = input instanceof Request ? input.url : input;
        const resolved = resolveAsset(source);
        return originalFetch(resolved, init);
    };

    const imageSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (imageSrc?.set && imageSrc?.get) {
        Object.defineProperty(HTMLImageElement.prototype, 'src', {
            configurable: true,
            enumerable: imageSrc.enumerable,
            get() { return imageSrc.get.call(this); },
            set(value) { imageSrc.set.call(this, resolveAsset(value)); }
        });
    }

    // Atualiza backgrounds declarados no CSS depois que os arquivos locais foram importados.
    for (const style of document.querySelectorAll('style')) {
        style.textContent = style.textContent.replace(
            /url\((['"]?)(\.\/public\/assets\/[^)'"]+)\1\)/g,
            (match, quote, path) => `url("${resolveAsset(path)}")`
        );
    }
}

function waitForFolder(db, requiredAssets) {
    return new Promise((resolve, reject) => {
        const input = document.querySelector('#asset-folder');
        const status = document.querySelector('#asset-loader-status');
        input.addEventListener('change', async () => {
            const files = [...input.files];
            if (!files.length) return;
            status.textContent = `Importando ${files.length} arquivos...`;

            const selected = new Map();
            for (const file of files) {
                const relative = file.webkitRelativePath || file.name;
                const marker = relative.indexOf('/assets/');
                const path = marker >= 0
                    ? relative.slice(marker + '/assets/'.length)
                    : normalizeAssetPath(relative);
                if (path && !path.includes('../')) selected.set(path, file);
            }

            const missing = requiredAssets.filter(path => !selected.has(path));
            if (missing.length) {
                status.textContent = `Pasta incompleta. Faltam: ${missing.join(', ')}. Selecione a pasta public/assets do projeto.`;
                input.value = '';
                return;
            }

            try {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                store.clear();
                for (const [path, file] of selected) store.put(file, path);
                await transactionDone(transaction);
                status.textContent = 'Assets importados. Iniciando o jogo...';
                resolve(new Map([...selected].map(([path, file]) => [path, file])));
            } catch (error) {
                status.textContent = `Não foi possível salvar os assets: ${error.message}`;
                reject(error);
            }
        });
    });
}

export async function initializeWebAssets() {
    window.mcAssetUrl = path => path;
    // No Electron, os assets locais já foram verificados antes de abrir a janela.
    if (location.protocol === 'file:') return;

    // Sempre prioriza os arquivos publicados junto com a versão atual do port.
    // O IndexedDB pode conter uma importação antiga e não deve sobrescrever assets novos.
    let requiredAssets;
    try {
        requiredAssets = await getRequiredAssets();
    } catch (error) {
        showImportScreen(`Não foi possível verificar os assets desta versão: ${error.message}. Atualize o manifesto do projeto e recarregue a página.`);
        throw error;
    }

    const missingStaticAssets = await readStaticAssets(requiredAssets);
    if (!missingStaticAssets.length) return;

    const db = await openDatabase();
    let assets = await readStoredAssets(db, requiredAssets);

    if (missingStaticAssets.length) {
        showImportScreen(`Faltam ${missingStaticAssets.length} assets nesta versão (${missingStaticAssets.slice(0, 8).join(', ')}${missingStaticAssets.length > 8 ? ', ...' : ''}). Reimporte a pasta public/assets atualizada para corrigir.`);
        assets = await waitForFolder(db, requiredAssets);
    } else if (!assets) {
        showImportScreen(`Os assets importados estão incompletos ou desatualizados. Selecione novamente a pasta public/assets atualizada (${requiredAssets.length} arquivos esperados).`);
        assets = await waitForFolder(db, requiredAssets);
    }

    const urls = new Map();
    for (const [path, blob] of assets) {
        urls.set(path, URL.createObjectURL(blob));
    }
    installAssetResolvers(urls);
    document.querySelector('#asset-loader').hidden = true;
    db.close();
}
