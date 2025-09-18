document.addEventListener('DOMContentLoaded', () => {
    // --- 状態管理オブジェクト ---
    let state = {
        siteName: '',
        personName: '',
        date: '',
        photosPerPage: 4,
        orientation: 'portrait',
        fontFamily: 'sans-serif',
        fontSize: 10,
        fontWeight: 'normal',
        imageQuality: 'high', // 'high' or 'highest'
        imageDisplayMode: 'trim', // 'trim' or 'fit'
        photos: [],
        zoomLevel: 1.0, // 初期値は動的計算で上書きされます
    };

    // --- DOM要素 ---
    const siteNameInput = document.getElementById('siteName');
    const personNameInput = document.getElementById('personName');
    const dateInput = document.getElementById('date');
    const photosPerPageSelect = document.getElementById('photosPerPage');
    const orientationSelect = document.getElementById('orientation');
    const fontFamilySelect = document.getElementById('fontFamily');
    const fontSizeInput = document.getElementById('fontSize');
    const fontWeightSelect = document.getElementById('fontWeight');
    const imageQualityRadios = document.querySelectorAll('input[name="imageQuality"]');
    const imageDisplayModeRadios = document.querySelectorAll('input[name="imageDisplayMode"]');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const photoListContainer = document.getElementById('photo-list');
    const previewPanel = document.getElementById('preview-panel');
    const previewContainer = document.getElementById('preview-container');
    const printButton = document.getElementById('print-button');
    const zoomInButton = document.getElementById('zoom-in-button');
    const zoomOutButton = document.getElementById('zoom-out-button');
    const zoomResetButton = document.getElementById('zoom-reset-button');
    const zoomDisplay = document.getElementById('zoom-display');
    const saveButton = document.getElementById('save-button');
    const loadButton = document.getElementById('load-button');
    const loadInput = document.getElementById('load-input');

    // --- 初期化 ---
    function initialize() {
        dateInput.valueAsDate = new Date();
        state.date = dateInput.value;
        render();
        // 初回レンダリング後に最適なズームを計算
        setTimeout(calculateAndSetOptimalZoom, 0);
    }

    // --- レンダリング関数 ---
    function render() {
        renderPhotoList();
        renderPreview();
    }

    function renderPhotoList() {
        photoListContainer.innerHTML = '';
        if (state.photos.length === 0) {
            photoListContainer.innerHTML = '<p class="text-center text-gray-500 text-sm">写真がありません。</p>';
            return;
        }
        state.photos.forEach((photo) => {
            const div = document.createElement('div');
            div.className = 'p-3 bg-slate-50 border rounded-lg shadow-sm draggable';
            div.dataset.id = photo.id;
            div.draggable = true;
            div.innerHTML = `
                <div class="flex items-start gap-3">
                    <img src="${photo.url}" class="w-16 h-16 object-cover rounded-md flex-shrink-0" draggable="false">
                    <div class="flex-1 space-y-2">
                        <input type="text" data-id="${photo.id}" data-field="location" value="${photo.location}" placeholder="場所" class="w-full text-sm p-1 rounded-md input-highlight">
                        <textarea data-id="${photo.id}" data-field="comment" rows="2" placeholder="コメント" class="w-full text-sm p-1 rounded-md input-highlight">${photo.comment}</textarea>
                    </div>
                    <button data-id="${photo.id}" class="remove-btn text-red-500 hover:text-red-700 font-bold text-xl flex-shrink-0">×</button>
                </div>`;
            photoListContainer.appendChild(div);
        });
    }

    function renderPreview() {
        previewContainer.innerHTML = '';
        if (state.photos.length === 0) {
            previewContainer.innerHTML = '<div class="flex items-center justify-center h-full"><p class="text-gray-500 text-2xl">プレビューはありません</p></div>';
            return;
        }
        const orientationClass = state.orientation === 'portrait' ? 'a4-portrait' : 'a4-landscape';
        const chunks = chunkArray(state.photos, state.photosPerPage);
        chunks.forEach((chunk) => {
            const pageWrapper = document.createElement('div');
            pageWrapper.className = `a4-page-container bg-white p-6 shadow-lg border ${orientationClass}`;
            pageWrapper.style.fontFamily = state.fontFamily;
            pageWrapper.style.fontSize = `${state.fontSize}pt`;
            pageWrapper.style.fontWeight = state.fontWeight;
            const gridLayout = getGridLayout(state.photosPerPage, state.orientation);
            const warekiDate = toWareki(state.date);
            const siteNameHTML = `<div>現場名: ${state.siteName || 'N/A'}</div>`;
            const personNameHTML = `<div>担当者: ${state.personName || 'N/A'}</div>`;
            const dateHTML = `<div>日時: ${warekiDate || 'N/A'}</div>`;
            const photoCellsHTML = chunk.map(photo => {
                const locationHTML = photo.location ? `<p><strong>場所:</strong> ${photo.location}</p>` : '';
                const commentHTML = photo.comment ? `<p class="pre-wrap-break"><strong>コメント:</strong> ${photo.comment}</p>` : '';
                const imageContainerClass = state.imageDisplayMode === 'trim' ? 'overflow-hidden' : '';
                const imageClass = state.imageDisplayMode === 'trim' ? 'max-w-full max-h-full object-contain' : 'w-full h-full object-contain';
                
                return `<div class="preview-photo-cell border border-gray-300 p-2 flex flex-col h-full" draggable="true" data-photo-id="${photo.id}">
                    <div class="mb-1 flex-shrink-0">${locationHTML}${commentHTML}</div>
                    <div class="bg-gray-100 flex items-center justify-center ${imageContainerClass} min-h-0 flex-grow photo-area">
                        <img src="${photo.url}" class="${imageClass}" draggable="false">
                    </div>
                </div>`;
            }).join('');
            pageWrapper.innerHTML = `
                <header class="flex justify-between items-end border-b-2 border-black pb-2 mb-4 flex-shrink-0">
                    <div class="font-bold text-lg">${siteNameHTML}</div>
                    <div class="text-right text-sm flex-shrink-0">${personNameHTML}${dateHTML}</div>
                </header>
                <main class="grid ${gridLayout} gap-4 flex-grow min-h-0">${photoCellsHTML}</main>`;
            previewContainer.appendChild(pageWrapper);
        });
    }

    // --- ヘルパー関数 ---

    /**
     * 最適なズームレベルを計算して適用する関数
     */
    function calculateAndSetOptimalZoom() {
        const previewPage = previewContainer.querySelector('.a4-page-container');
        const previewControls = document.getElementById('preview-controls');

        // 必要な要素がなければ処理を中断
        if (!previewPage || !previewControls || previewPanel.clientWidth === 0 || previewPanel.clientHeight === 0) {
            return;
        }

        // プレビューパネルのCSSスタイルを取得してパディング値を読み込む
        const panelStyle = window.getComputedStyle(previewPanel);
        const panelPaddingX = parseFloat(panelStyle.paddingLeft) + parseFloat(panelStyle.paddingRight);
        const panelPaddingY = parseFloat(panelStyle.paddingTop) + parseFloat(panelStyle.paddingBottom);

        // 利用可能な「横幅」を計算 (パネルの内側の幅)
        const availableWidth = previewPanel.clientWidth - panelPaddingX;

        // 利用可能な「高さ」を計算 (パネルの内側の高さから、上部の操作バーの高さを引く)
        const controlsHeight = previewControls.offsetHeight;
        const availableHeight = previewPanel.clientHeight - panelPaddingY - controlsHeight;

        // A4プレビューの元のサイズを取得
        const pageNaturalWidth = previewPage.offsetWidth;
        const pageNaturalHeight = previewPage.offsetHeight;

        // 0除算を避ける
        if (pageNaturalWidth > 0 && pageNaturalHeight > 0) {
            // 横幅に合わせる場合のズーム倍率
            const widthRatio = availableWidth / pageNaturalWidth;
            // 高さに合わせる場合のズーム倍率
            const heightRatio = availableHeight / pageNaturalHeight;

            // 2つの倍率のうち、より小さい方を採用する
            // これにより、縦横両方が必ず表示領域に収まる
            state.zoomLevel = Math.min(widthRatio, heightRatio) * 0.98; // 2%の余白を持たせる

            // 計算したズーム倍率を適用
            updateZoom();
        }
    }


    function debounce(func, delay = 250) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }

    const debouncedRenderPreview = debounce(() => renderPreview());
    const debouncedCalculateAndSetOptimalZoom = debounce(calculateAndSetOptimalZoom, 150);

    function updateZoom() {
        previewContainer.style.transform = `scale(${state.zoomLevel})`;
        previewContainer.style.transformOrigin = 'top center';
        zoomDisplay.textContent = `${Math.round(state.zoomLevel * 100)}%`;
    }

    function chunkArray(arr, size) {
        const chunked = [];
        for (let i = 0; i < arr.length; i += size) {
            chunked.push(arr.slice(i, i + size));
        }
        return chunked;
    }

    function getGridLayout(count, orientation) {
        switch (Number(count)) {
            case 1: return 'grid-cols-1 grid-rows-1';
            case 2: return orientation === 'portrait' ? 'grid-cols-1 grid-rows-2' : 'grid-cols-2 grid-rows-1';
            case 3: return orientation === 'portrait' ? 'grid-cols-1 grid-rows-3' : 'grid-cols-3 grid-rows-1';
            case 4: return 'grid-cols-2 grid-rows-2';
            case 6: return orientation === 'portrait' ? 'grid-cols-2 grid-rows-3' : 'grid-cols-3 grid-rows-2';
            case 8: return orientation === 'portrait' ? 'grid-cols-2 grid-rows-4' : 'grid-cols-4 grid-rows-2';
            default: return 'grid-cols-2 grid-rows-2';
        }
    }

    function toWareki(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
        try {
            return new Intl.DateTimeFormat('ja-JP-u-ca-japanese', {
                era: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }).format(date);
        }
        catch (e) {
            console.warn("Wareki formatting failed, falling back to western calendar:", e);
            return date.toLocaleString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
    }

    function handleFiles(files) {
        Array.from(files).forEach(file => {
            if (!file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                compressImage(e.target.result, (compressedUrl) => {
                    state.photos.push({
                        id: Date.now() + Math.random(),
                        url: compressedUrl,
                        location: '',
                        comment: ''
                    });
                    render();
                });
            };
            reader.readAsDataURL(file);
        });
    }

    function compressImage(src, callback) {
        let MAX_DIMENSION, QUALITY;

        if (state.imageQuality === 'highest') {
            MAX_DIMENSION = 2560;
            QUALITY = 0.92;
        } else { // 'high' (default)
            MAX_DIMENSION = 1920;
            QUALITY = 0.90;
        }

        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_DIMENSION) {
                    height *= MAX_DIMENSION / width;
                    width = MAX_DIMENSION;
                }
            } else {
                if (height > MAX_DIMENSION) {
                    width *= MAX_DIMENSION / height;
                    height = MAX_DIMENSION;
                }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', QUALITY));
        };
        img.src = src;
    }


    // --- イベントリスナー ---
    function setupEventListeners() {
        siteNameInput.addEventListener('input', e => {
            state.siteName = e.target.value;
            debouncedRenderPreview();
        });

        personNameInput.addEventListener('input', e => {
            state.personName = e.target.value;
            debouncedRenderPreview();
        });

        dateInput.addEventListener('change', e => {
            state.date = e.target.value;
            renderPreview();
        });

        photosPerPageSelect.addEventListener('change', e => {
            state.photosPerPage = parseInt(e.target.value, 10);
            render();
            setTimeout(calculateAndSetOptimalZoom, 0); // レイアウト変更後に再計算
        });

        orientationSelect.addEventListener('change', e => {
            state.orientation = e.target.value;
            render();
            setTimeout(calculateAndSetOptimalZoom, 0); // レイアウト変更後に再計算
        });

        fontFamilySelect.addEventListener('change', e => {
            state.fontFamily = e.target.value;
            renderPreview();
        });

        fontSizeInput.addEventListener('change', e => {
            state.fontSize = parseInt(e.target.value, 10);
            renderPreview();
        });

        fontWeightSelect.addEventListener('change', e => {
            state.fontWeight = e.target.value;
            renderPreview();
        });

        imageQualityRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                state.imageQuality = e.target.value;
            });
        });

        imageDisplayModeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                state.imageDisplayMode = e.target.value;
                renderPreview();
            });
        });

        photoListContainer.addEventListener('input', e => {
            if (e.target.matches('input[type="text"], textarea')) {
                const photoId = parseFloat(e.target.dataset.id);
                const photo = state.photos.find(p => p.id === photoId);
                if (photo) {
                    photo[e.target.dataset.field] = e.target.value;
                    debouncedRenderPreview();
                }
            }
        });

        photoListContainer.addEventListener('click', e => {
            if (e.target.closest('.remove-btn')) {
                const photoId = parseFloat(e.target.closest('.remove-btn').dataset.id);
                state.photos = state.photos.filter(p => p.id !== photoId);
                render();
            }
        });

        dropZone.addEventListener('dragover', e => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('bg-indigo-50');
        });

        dropZone.addEventListener('dragleave', e => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('bg-indigo-50');
        });

        dropZone.addEventListener('drop', e => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('bg-indigo-50');
            handleFiles(e.dataTransfer.files);
        });

        fileInput.addEventListener('change', e => handleFiles(e.target.files));

        dropZone.addEventListener('click', () => fileInput.click());

        // ドラッグアンドドロップ並び替え機能
        let draggedItemId = null;

        photoListContainer.addEventListener('dragstart', e => {
            const draggable = e.target.closest('.draggable');
            if (draggable) {
                draggedItemId = parseFloat(draggable.dataset.id);
                setTimeout(() => draggable.classList.add('dragging'), 0);
            }
        });

        photoListContainer.addEventListener('dragover', e => {
            e.preventDefault();
            const target = e.target.closest('.draggable');
            if (!target || !draggedItemId || parseFloat(target.dataset.id) === draggedItemId) return;
            document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => el.classList.remove('drag-over-top', 'drag-over-bottom'));
            const rect = target.getBoundingClientRect();
            const isOverTopHalf = e.clientY < rect.top + rect.height / 2;
            target.classList.toggle('drag-over-top', isOverTopHalf);
            target.classList.toggle('drag-over-bottom', !isOverTopHalf);
        });

        photoListContainer.addEventListener('drop', e => {
            e.preventDefault();
            if (!draggedItemId) return;
            const dropTarget = e.target.closest('.draggable');
            document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => el.classList.remove('drag-over-top', 'drag-over-bottom'));
            if (!dropTarget) return;
            const dropTargetId = parseFloat(dropTarget.dataset.id);
            const draggedIndex = state.photos.findIndex(p => p.id === draggedItemId);
            if (draggedIndex === -1) return;
            const [draggedItem] = state.photos.splice(draggedIndex, 1);
            const dropTargetIndex = state.photos.findIndex(p => p.id === dropTargetId);
            const rect = dropTarget.getBoundingClientRect();
            const isOverTopHalf = e.clientY < rect.top + rect.height / 2;
            state.photos.splice(isOverTopHalf ? dropTargetIndex : dropTargetIndex + 1, 0, draggedItem);
            render();
        });

        previewContainer.addEventListener('dragstart', e => {
            const target = e.target.closest('.preview-photo-cell');
            if (target) {
                draggedItemId = parseFloat(target.dataset.photoId);
                setTimeout(() => target.classList.add('dragging'), 0);
            }
        });

        previewContainer.addEventListener('dragover', e => {
            e.preventDefault();
            const dropTarget = e.target.closest('.preview-photo-cell');
            if (dropTarget && draggedItemId && parseFloat(dropTarget.dataset.photoId) !== draggedItemId) {
                document.querySelectorAll('.preview-drag-over').forEach(el => el.classList.remove('preview-drag-over'));
                dropTarget.classList.add('preview-drag-over');
            }
        });

        previewContainer.addEventListener('drop', e => {
            e.preventDefault();
            if (!draggedItemId) return;
            const dropTarget = e.target.closest('.preview-photo-cell');
            document.querySelectorAll('.preview-drag-over, .dragging').forEach(el => el.classList.remove('preview-drag-over', 'dragging'));
            if (!dropTarget) return;
            const dropTargetId = parseFloat(dropTarget.dataset.photoId);
            const draggedIndex = state.photos.findIndex(p => p.id === draggedItemId);
            const dropIndex = state.photos.findIndex(p => p.id === dropTargetId);
            if (draggedIndex > -1 && dropIndex > -1) {
                const temp = state.photos[draggedIndex];
                state.photos[draggedIndex] = state.photos[dropIndex];
                state.photos[dropIndex] = temp;
                render();
            }
        });

        document.addEventListener('dragend', () => {
            draggedItemId = null;
            document.querySelectorAll('.dragging, .drag-over-top, .drag-over-bottom, .preview-drag-over').forEach(el => {
                el.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom', 'preview-drag-over');
            });
        });

        // ズーム機能
        zoomInButton.addEventListener('click', () => {
            state.zoomLevel = Math.min(2.0, state.zoomLevel + 0.1);
            updateZoom();
        });

        zoomOutButton.addEventListener('click', () => {
            state.zoomLevel = Math.max(0.1, state.zoomLevel - 0.1);
            updateZoom();
        });

        zoomResetButton.addEventListener('click', () => {
            // 最適なズームレベルを再計算して適用
            calculateAndSetOptimalZoom();
        });
        
        // ウィンドウリサイズ時にも最適ズームを再計算
        window.addEventListener('resize', debouncedCalculateAndSetOptimalZoom);

        // 保存・読み込み機能
        saveButton.addEventListener('click', () => {
            const dataStr = JSON.stringify(state, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = state.siteName ? `genba_${state.siteName}.json` : 'genba_現場データ.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });

        loadButton.addEventListener('click', () => {
            loadInput.click();
        });

        loadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const loadedState = JSON.parse(event.target.result);
                    if (!loadedState.imageQuality) {
                        loadedState.imageQuality = 'high';
                    } // 古いファイルへの後方互換性
                    state = loadedState;
                    siteNameInput.value = state.siteName;
                    personNameInput.value = state.personName;
                    dateInput.value = state.date;
                    photosPerPageSelect.value = state.photosPerPage;
                    orientationSelect.value = state.orientation;
                    fontFamilySelect.value = state.fontFamily;
                    fontSizeInput.value = state.fontSize;
                    fontWeightSelect.value = state.fontWeight;
                    document.querySelector(`input[name="imageQuality"][value="${state.imageQuality}"]`).checked = true;
                    render();
                    setTimeout(calculateAndSetOptimalZoom, 0); // ロード後にもズームを再計算
                } catch (err) {
                    alert('ファイルの読み込みに失敗しました。正しいJSONファイルを選択してください。');
                    console.error(err);
                }
            };
            reader.readAsText(file);
            e.target.value = '';
        });

    }

    // --- 初期実行 ---
    setupEventListeners();
    initialize();

    // サービスワーカーの登録
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('service-worker.js')
                .then(registration => {
                    console.log('Service Worker registered with scope:', registration.scope);
                })
                .catch(error => {
                    console.log('Service Worker registration failed:', error);
                });
        });
    }
});