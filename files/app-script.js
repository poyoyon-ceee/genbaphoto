document.addEventListener('DOMContentLoaded', () => {
    // --- アプリケーション設定 ---
    const CONFIG = {
        // ファイル制限
        MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
        MAX_FILE_COUNT: 100,
        ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        
        // 画像圧縮設定
        IMAGE_QUALITY: {
            HIGH: { maxDimension: 1920, quality: 0.90 },
            HIGHEST: { maxDimension: 2560, quality: 0.92 }
        },
        
        // UI設定
        MAX_CONCURRENT_UPLOADS: 3,
        MAX_CACHE_SIZE: 50,
        THUMBNAIL_SIZE: 64,
        RENDER_THROTTLE_MS: 16, // 60fps相当
        DEBOUNCE_DELAY: 300,
        
        // 文字数制限
        MAX_SITE_NAME_LENGTH: 50,
        MAX_PERSON_NAME_LENGTH: 30,
        MAX_LOCATION_LENGTH: 100,
        MAX_COMMENT_LENGTH: 500,
        
        // 仮想スクロール
        VIRTUAL_SCROLL_THRESHOLD: 50,
        VIRTUAL_SCROLL_ITEM_HEIGHT: 120,
        
        // 通知設定
        NOTIFICATION_DURATION: {
            ERROR: 6000,
            SUCCESS: 3000,
            WARNING: 6000,
            INFO: 5000,
            HELP: 8000
        }
    };

    // --- セキュリティ関数 ---
    /**
     * テキストをHTMLエスケープして安全な文字列に変換
     * XSS攻撃を防ぐためのユーティリティ関数
     * @param {*} text - サニタイズするテキスト
     * @returns {string} エスケープされた安全な文字列
     */
    function sanitizeText(text) {
        if (typeof text !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // --- エラーハンドリング ---
    /**
     * アプリケーション専用のカスタムエラークラス
     * エラーコードと詳細情報を含む構造化されたエラー管理
     */
    class PhotoAppError extends Error {
        /**
         * @param {string} message - エラーメッセージ
         * @param {string} code - エラーコード（ERROR_CODESから選択）
         * @param {Object|null} details - 追加のエラー詳細情報
         */
        constructor(message, code, details = null) {
            super(message);
            this.name = 'PhotoAppError';
            this.code = code;
            this.details = details;
        }
    }

    const ERROR_CODES = {
        INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
        FILE_TOO_LARGE: 'FILE_TOO_LARGE',
        TOO_MANY_FILES: 'TOO_MANY_FILES',
        COMPRESSION_FAILED: 'COMPRESSION_FAILED',
        INVALID_IMAGE_DATA: 'INVALID_IMAGE_DATA',
        MEMORY_LIMIT: 'MEMORY_LIMIT'
    };

    /**
     * アップロードされた画像ファイルのバリデーションを実行
     * ファイル形式とサイズの制限をチェック
     * @param {File} file - バリデーションする画像ファイル
     * @returns {boolean} バリデーション成功時はtrue
     * @throws {PhotoAppError} バリデーション失敗時にエラーを投げる
     */
    function validateImageFile(file) {
        if (!CONFIG.ALLOWED_FILE_TYPES.includes(file.type)) {
            throw new PhotoAppError(
                'サポートされていないファイル形式です。JPEG、PNG、GIF、WebPのみ対応しています。',
                ERROR_CODES.INVALID_FILE_TYPE,
                { fileType: file.type }
            );
        }
        
        if (file.size > CONFIG.MAX_FILE_SIZE) {
            throw new PhotoAppError(
                `ファイルサイズが大きすぎます（${Math.round(CONFIG.MAX_FILE_SIZE / 1024 / 1024)}MB以下にしてください）`,
                ERROR_CODES.FILE_TOO_LARGE,
                { fileSize: file.size, maxSize: CONFIG.MAX_FILE_SIZE }
            );
        }
        
        return true;
    }

    /**
     * 統一されたエラーハンドリング関数
     * エラーの種類に応じて適切な通知を表示し、ログを出力
     * @param {Error} error - 処理するエラーオブジェクト
     * @param {string} context - エラーが発生したコンテキスト（操作名など）
     * @returns {PhotoAppError} 標準化されたエラーオブジェクト
     */
    function handleError(error, context = '') {
        console.error(`[${context}] エラー:`, error);
        
        if (error instanceof PhotoAppError) {
            showNotification(error.message, 'error', CONFIG.NOTIFICATION_DURATION.ERROR);
            return error;
        }
        
        // 予期しないエラー
        const genericMessage = context ? `${context}中にエラーが発生しました` : 'エラーが発生しました';
        showNotification(genericMessage, 'error', CONFIG.NOTIFICATION_DURATION.ERROR);
        return new PhotoAppError(genericMessage, 'UNKNOWN_ERROR', { originalError: error });
    }

    // --- 状態管理 ---
    /**
     * アプリケーション状態の一元管理クラス
     * Observer パターンを使用した状態変更の通知システム
     */
    class StateManager {
        /**
         * 初期状態でStateManagerを作成
         * すべてのアプリケーション状態とオブザーバー配列を初期化
         */
        constructor() {
            this.state = {
                siteName: '',
                personName: '',
                date: '',
                photosPerPage: 4,
                orientation: 'portrait',
                fontFamily: 'sans-serif',
                fontSize: 10,
                fontWeight: 'normal',
                imageQuality: 'high',
                imageDisplayMode: 'trim',
                photos: [],
                zoomLevel: 1.0
            };
            this.observers = [];
        }

        /**
         * 状態を更新し、登録済みオブザーバーに変更を通知
         * @param {Object} updates - 更新する状態プロパティのオブジェクト
         */
        setState(updates) {
            const oldState = { ...this.state };
            this.state = { ...this.state, ...updates };
            this.notifyObservers(oldState, this.state);
        }

        /**
         * 現在の状態のコピーを取得
         * @returns {Object} 現在の状態のシャローコピー
         */
        getState() {
            return { ...this.state };
        }

        /**
         * 状態変更通知を受け取るオブザーバーを登録
         * @param {Function} callback - 状態変更時に呼び出されるコールバック関数
         */
        subscribe(callback) {
            this.observers.push(callback);
        }

        /**
         * 登録済みオブザーバーを解除
         * @param {Function} callback - 解除するコールバック関数
         */
        unsubscribe(callback) {
            this.observers = this.observers.filter(obs => obs !== callback);
        }

        /**
         * すべての登録済みオブザーバーに状態変更を通知
         * @param {Object} oldState - 変更前の状態
         * @param {Object} newState - 変更後の状態
         * @private
         */
        notifyObservers(oldState, newState) {
            this.observers.forEach(callback => {
                try {
                    callback(newState, oldState);
                } catch (error) {
                    console.error('Observer error:', error);
                }
            });
        }
    }

    // --- パフォーマンス関数 ---
    const imageCache = new Map();
    
    /**
     * 指定された写真のURLを解放し、メモリ使用量を減らす
     * Base64データの大きなメモリ使用量を防ぐための清掃関数
     * @param {string} photoId - 解放する写真のID
     */
    function revokeImageUrl(photoId) {
        const photo = stateManager.getState().photos.find(p => p.id === photoId);
        if (photo && photo.url && photo.url.startsWith('data:image/')) {
            photo.url = null;
            imageCache.delete(photoId);
        }
    }
    
    /**
     * 画像キャッシュを最大サイズ以下に制限
     * メモリ使用量を管理し、古いエントリを自動的に削除
     */
    function cleanupImageCache() {
        if (imageCache.size > CONFIG.MAX_CACHE_SIZE) {
            const keysToDelete = Array.from(imageCache.keys()).slice(0, imageCache.size - CONFIG.MAX_CACHE_SIZE);
            keysToDelete.forEach(key => imageCache.delete(key));
        }
    }
    
    /**
     * 元画像から正方形のサムネイルを非同期で作成
     * UIのパフォーマンスを向上させるための最適化されたサムネイル生成
     * @param {string} originalDataUrl - 元画像のData URL
     * @param {Function} callback - サムネイル作成完了時のコールバック(thumbnailDataUrl)
     */
    function createThumbnail(originalDataUrl, callback) {
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                const size = CONFIG.THUMBNAIL_SIZE;
                canvas.width = size;
                canvas.height = size;
                
                const scale = Math.min(size / img.width, size / img.height);
                const width = img.width * scale;
                const height = img.height * scale;
                const x = (size - width) / 2;
                const y = (size - height) / 2;
                
                ctx.fillStyle = '#f3f4f6';
                ctx.fillRect(0, 0, size, size);
                ctx.drawImage(img, x, y, width, height);
                
                callback(canvas.toDataURL('image/jpeg', 0.7));
            } catch (error) {
                handleError(error, 'サムネイル作成');
            }
        };
        img.onerror = () => handleError(new Error('サムネイル画像の読み込みに失敗'), 'サムネイル作成');
        img.src = originalDataUrl;
    }

    // --- 状態管理インスタンス作成 ---
    const stateManager = new StateManager();
    
    // 後方互換性のため、state参照を維持
    let state = stateManager.state;

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
    /**
     * アプリケーション全体のレンダリングを実行
     * 写真リストとプレビューパネルの更新
     */
    function render() {
        renderPhotoList();
        renderPreview();
    }

    // --- 仮想スクロール管理 ---
    let virtualScrollState = {
        containerHeight: 0,
        itemHeight: CONFIG.VIRTUAL_SCROLL_ITEM_HEIGHT,
        visibleStart: 0,
        visibleEnd: 10,
        totalItems: 0
    };
    
    /**
     * 仮想スクロールの状態を更新
     * 表示サイズとアイテム数に基づいて表示範囲を計算
     */
    function updateVirtualScrollState() {
        const container = photoListContainer.parentElement;
        if (!container) return;
        
        virtualScrollState.containerHeight = container.clientHeight;
        virtualScrollState.totalItems = state.photos.length;
        
        const visibleItems = Math.ceil(virtualScrollState.containerHeight / virtualScrollState.itemHeight) + 2; // バッファ
        virtualScrollState.visibleEnd = Math.min(
            virtualScrollState.visibleStart + visibleItems,
            virtualScrollState.totalItems
        );
    }
    
    /**
     * 写真リストのレンダリング方式を選択
     * 写真数に応じて標準レンダリングまたは仮想スクロールを使用
     */
    function renderPhotoList() {
        if (state.photos.length > CONFIG.VIRTUAL_SCROLL_THRESHOLD) {
            renderVirtualPhotoList();
        } else {
            renderStandardPhotoList();
        }
    }
    
    /**
     * 標準的な写真リストのレンダリング
     * 少数の写真で使用し、すべてのアイテムをDOMに追加
     */
    function renderStandardPhotoList() {
        photoListContainer.innerHTML = '';
        if (state.photos.length === 0) {
            const p = document.createElement('p');
            p.className = 'text-center text-gray-500 text-sm';
            p.textContent = '写真がありません。';
            photoListContainer.appendChild(p);
            return;
        }
        state.photos.forEach((photo, index) => {
            const div = createPhotoListItem(photo, index);
            photoListContainer.appendChild(div);
        });
    }
    
    function renderVirtualPhotoList() {
        photoListContainer.innerHTML = '';
        if (state.photos.length === 0) {
            const p = document.createElement('p');
            p.className = 'text-center text-gray-500 text-sm';
            p.textContent = '写真がありません。';
            photoListContainer.appendChild(p);
            return;
        }
        
        updateVirtualScrollState();
        
        // 全体の高さを設定するためのスペーサー
        const totalHeight = virtualScrollState.totalItems * virtualScrollState.itemHeight;
        photoListContainer.style.height = `${totalHeight}px`;
        photoListContainer.style.position = 'relative';
        
        // 可視範囲のアイテムのみレンダリング
        for (let i = virtualScrollState.visibleStart; i < virtualScrollState.visibleEnd && i < state.photos.length; i++) {
            const photo = state.photos[i];
            const div = createPhotoListItem(photo, i);
            div.style.position = 'absolute';
            div.style.top = `${i * virtualScrollState.itemHeight}px`;
            div.style.width = '100%';
            photoListContainer.appendChild(div);
        }
    }
    
    /**
     * 写真リストの個別アイテム要素を作成
     * ドラッグ&ドロップ、編集、削除機能を含む完全なリストアイテム
     * @param {Object} photo - 写真オブジェクト（id, url, location, comment等）
     * @param {number} index - リスト内のインデックス番号
     * @returns {HTMLElement} 作成されたリストアイテムのDOM要素
     */
    function createPhotoListItem(photo, index) {
        const div = document.createElement('div');
        div.className = 'p-3 bg-slate-50 border rounded-lg shadow-sm draggable';
        div.dataset.id = photo.id;
        div.dataset.index = index;
        div.draggable = true;

        // 安全なDOM要素作成
        const container = document.createElement('div');
        container.className = 'flex items-start gap-3';

        const img = document.createElement('img');
        // サムネイルがあれば使用、なければオリジナル
        img.src = photo.thumbnail || photo.url;
        img.className = 'w-16 h-16 object-cover rounded-md flex-shrink-0';
        img.draggable = false;
        
        // 遅延読み込みの実装
        if (photo.thumbnail && index > 10) {
            img.loading = 'lazy';
        }

        const inputContainer = document.createElement('div');
        inputContainer.className = 'flex-1 space-y-2';

        const locationInput = document.createElement('input');
        locationInput.type = 'text';
        locationInput.dataset.id = photo.id;
        locationInput.dataset.field = 'location';
        locationInput.value = sanitizeText(photo.location);
        locationInput.placeholder = '場所';
        locationInput.className = 'w-full text-sm p-1 rounded-md input-highlight';

        const commentTextarea = document.createElement('textarea');
        commentTextarea.dataset.id = photo.id;
        commentTextarea.dataset.field = 'comment';
        commentTextarea.rows = 2;
        commentTextarea.placeholder = 'コメント';
        commentTextarea.className = 'w-full text-sm p-1 rounded-md input-highlight';
        commentTextarea.textContent = sanitizeText(photo.comment);

        const removeBtn = document.createElement('button');
        removeBtn.dataset.id = photo.id;
        removeBtn.className = 'remove-btn text-red-500 hover:text-red-700 font-bold text-xl flex-shrink-0';
        removeBtn.textContent = '×';

        inputContainer.appendChild(locationInput);
        inputContainer.appendChild(commentTextarea);
        container.appendChild(img);
        container.appendChild(inputContainer);
        container.appendChild(removeBtn);
        div.appendChild(container);
        
        return div;
    }

    /**
     * 印刷プレビューのレンダリング
     * A4ページ形式で写真と情報をレイアウトした印刷用プレビューを生成
     */
    function renderPreview() {
        previewContainer.innerHTML = '';
        if (state.photos.length === 0) {
            const div = document.createElement('div');
            div.className = 'flex items-center justify-center h-full';
            const p = document.createElement('p');
            p.className = 'text-gray-500 text-2xl';
            p.textContent = 'プレビューはありません';
            div.appendChild(p);
            previewContainer.appendChild(div);
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
            
            // ヘッダー作成
            const header = document.createElement('header');
            header.className = 'flex justify-between items-end border-b-2 border-black pb-2 mb-4 flex-shrink-0';
            
            const siteNameDiv = document.createElement('div');
            siteNameDiv.className = 'font-bold text-lg';
            const siteNameInner = document.createElement('div');
            siteNameInner.textContent = `現場名: ${sanitizeText(state.siteName) || 'N/A'}`;
            siteNameDiv.appendChild(siteNameInner);
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'text-right text-sm flex-shrink-0';
            
            const personNameDiv = document.createElement('div');
            personNameDiv.textContent = `担当者: ${sanitizeText(state.personName) || 'N/A'}`;
            
            const dateDiv = document.createElement('div');
            dateDiv.textContent = `日時: ${warekiDate || 'N/A'}`;
            
            infoDiv.appendChild(personNameDiv);
            infoDiv.appendChild(dateDiv);
            header.appendChild(siteNameDiv);
            header.appendChild(infoDiv);
            
            // メインコンテンツ作成
            const main = document.createElement('main');
            main.className = `grid ${gridLayout} gap-4 flex-grow min-h-0`;
            
            chunk.forEach(photo => {
                const photoCell = document.createElement('div');
                photoCell.className = 'preview-photo-cell border border-gray-300 p-2 flex flex-col h-full';
                photoCell.draggable = true;
                photoCell.dataset.photoId = photo.id;
                
                const textDiv = document.createElement('div');
                textDiv.className = 'mb-1 flex-shrink-0';
                
                if (photo.location) {
                    const locationP = document.createElement('p');
                    const locationStrong = document.createElement('strong');
                    locationStrong.textContent = '場所:';
                    locationP.appendChild(locationStrong);
                    locationP.appendChild(document.createTextNode(' ' + sanitizeText(photo.location)));
                    textDiv.appendChild(locationP);
                }
                
                if (photo.comment) {
                    const commentP = document.createElement('p');
                    commentP.className = 'pre-wrap-break';
                    const commentStrong = document.createElement('strong');
                    commentStrong.textContent = 'コメント:';
                    commentP.appendChild(commentStrong);
                    commentP.appendChild(document.createTextNode(' ' + sanitizeText(photo.comment)));
                    textDiv.appendChild(commentP);
                }
                
                const imageContainer = document.createElement('div');
                const imageContainerClass = state.imageDisplayMode === 'trim' ? 'overflow-hidden' : '';
                imageContainer.className = `bg-gray-100 flex items-center justify-center ${imageContainerClass} min-h-0 flex-grow`;
                
                const img = document.createElement('img');
                img.src = photo.url;
                const imageClass = state.imageDisplayMode === 'trim' ? 'max-w-full max-h-full object-contain' : 'w-full h-full object-contain';
                img.className = imageClass;
                img.draggable = false;
                
                imageContainer.appendChild(img);
                photoCell.appendChild(textDiv);
                photoCell.appendChild(imageContainer);
                main.appendChild(photoCell);
            });
            
            pageWrapper.appendChild(header);
            pageWrapper.appendChild(main);
            previewContainer.appendChild(pageWrapper);
        });
    }

    // --- ヘルパー関数 ---

    /**
     * 最適なズームレベルを計算して適用する関数
     */
    /**
     * プレビューパネルのサイズに基づいて最適なズーム倍率を計算・設定
     * A4ページがパネルに完全に収まるよう自動調整
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


    /**
     * 関数の実行を指定時間遅延させるユーティリティ関数
     * 連続呼び出し時に最後の呼び出しのみを実行してパフォーマンスを向上
     * @param {Function} func - 遅延実行する関数
     * @param {number} delay - 遅延時間（ミリ秒）
     * @returns {Function} デバウンスされた関数
     */
    function debounce(func, delay = 250) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }

    // --- レンダリング最適化 ---
    let renderScheduled = false;
    let lastRenderTime = 0;
    
    /**
     * パフォーマンス最適化されたレンダリング関数
     * FPS制限とスケジューリングでUIの応答性を維持
     */
    function optimizedRender() {
        const now = Date.now();
        
        if (now - lastRenderTime >= RENDER_THROTTLE_MS && !renderScheduled) {
            renderScheduled = true;
            requestAnimationFrame(() => {
                render();
                lastRenderTime = Date.now();
                renderScheduled = false;
            });
        } else if (!renderScheduled) {
            renderScheduled = true;
            setTimeout(() => {
                requestAnimationFrame(() => {
                    render();
                    lastRenderTime = Date.now();
                    renderScheduled = false;
                });
            }, RENDER_THROTTLE_MS - (now - lastRenderTime));
        }
    }
    
    function optimizedRenderPreview() {
        const now = Date.now();
        
        if (now - lastRenderTime >= RENDER_THROTTLE_MS && !renderScheduled) {
            renderScheduled = true;
            requestAnimationFrame(() => {
                renderPreview();
                lastRenderTime = Date.now();
                renderScheduled = false;
            });
        } else if (!renderScheduled) {
            renderScheduled = true;
            setTimeout(() => {
                requestAnimationFrame(() => {
                    renderPreview();
                    lastRenderTime = Date.now();
                    renderScheduled = false;
                });
            }, RENDER_THROTTLE_MS - (now - lastRenderTime));
        }
    }

    const debouncedRenderPreview = debounce(() => optimizedRenderPreview(), 300);
    const debouncedCalculateAndSetOptimalZoom = debounce(calculateAndSetOptimalZoom, 150);

    /**
     * 現在のズーム倍率でプレビューを拡大縮小
     * CSS transformを使用して高速なズーム処理を実現
     */
    function updateZoom() {
        previewContainer.style.transform = `scale(${state.zoomLevel})`;
        previewContainer.style.transformOrigin = 'top center';
        zoomDisplay.textContent = `${Math.round(state.zoomLevel * 100)}%`;
    }

    /**
     * 配列を指定されたサイズのチャンクに分割
     * 印刷ページごとに写真をグルーピングするためのユーティリティ
     * @param {Array} arr - 分割する配列
     * @param {number} size - チャンクのサイズ
     * @returns {Array[]} チャンクに分割された配列の配列
     */
    function chunkArray(arr, size) {
        const chunked = [];
        for (let i = 0; i < arr.length; i += size) {
            chunked.push(arr.slice(i, i + size));
        }
        return chunked;
    }

    /**
     * ページ向きと写真数に応じた最適なTailwind CSSグリッドレイアウトクラスを取得
     * 印刷用ページの美しいレイアウトを保証
     * @param {number} count - 1ページあたりの写真数
     * @param {string} orientation - ページの向き（'portrait' | 'landscape'）
     * @returns {string} CSSグリッドクラス名
     */
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

    /**
     * 西暦日付を和暦（日本の元号）形式に変換
     * 印刷物で使用する日本的な日付表示を提供
     * @param {string} dateString - ISO形式の日付文字列
     * @returns {string} 和暦形式の日付文字列（例: 令和6年1月1日）
     */
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

    /**
     * リッチな通知システムでユーザーにフィードバックを表示
     * アイコン、アニメーション、自動消去機能付きの高機能通知
     * @param {string} message - 表示するメッセージ
     * @param {string} type - 通知タイプ（'info', 'success', 'warning', 'error'）
     * @param {number} duration - 表示時間（ミリ秒、0で手動閉じるのみ）
     * @returns {HTMLElement} 作成された通知要素
     */
    function showNotification(message, type = 'info', duration = 5000) {
        // 既存の同タイプ通知を削除
        const existingNotifications = document.querySelectorAll(`.notification-${type}`);
        existingNotifications.forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = `notification-${type} fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-md`;
        notification.setAttribute('role', 'alert');
        notification.setAttribute('aria-live', 'polite');
        
        // アイコンとメッセージの構造化
        const iconMap = {
            error: '❌',
            success: '✅', 
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        const bgColorMap = {
            error: 'bg-red-500 text-white',
            success: 'bg-green-500 text-white',
            warning: 'bg-yellow-500 text-black',
            info: 'bg-blue-500 text-white'
        };
        
        notification.className += ` ${bgColorMap[type] || bgColorMap.info}`;
        
        const content = document.createElement('div');
        content.className = 'flex items-start gap-3';
        
        const icon = document.createElement('span');
        icon.textContent = iconMap[type] || iconMap.info;
        icon.className = 'flex-shrink-0';
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'flex-1';
        messageDiv.style.whiteSpace = 'pre-line'; // 改行を有効にする
        messageDiv.textContent = message;
        
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '×';
        closeButton.className = 'flex-shrink-0 ml-2 text-lg font-bold hover:opacity-70';
        closeButton.setAttribute('aria-label', '通知を閉じる');
        closeButton.onclick = () => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(-50%) translateY(-100px)';
            setTimeout(() => notification.remove(), 300);
        };
        
        content.appendChild(icon);
        content.appendChild(messageDiv);
        content.appendChild(closeButton);
        notification.appendChild(content);
        
        document.body.appendChild(notification);
        
        // 上から降りてくるアニメーション
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(-50%) translateY(-100px)';
        
        requestAnimationFrame(() => {
            notification.style.transition = 'opacity 0.4s ease-out, transform 0.4s ease-out';
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(-50%) translateY(0)';
        });
        
        // 自動削除
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.style.opacity = '0';
                    notification.style.transform = 'translateX(-50%) translateY(-100px)';
                    setTimeout(() => notification.remove(), 400);
                }
            }, duration);
        }
        
        return notification;
    }
    
    /**
     * ヘルプメッセージを長時間表示で表示
     * @param {string} message - ヘルプメッセージの内容
     */
    function showHelp(message) {
        showNotification(message, 'info', 8000); // ヘルプは長めに表示
    }
    
    /**
     * 警告メッセージを表示
     * @param {string} message - 警告メッセージの内容
     */
    function showWarning(message) {
        showNotification(message, 'warning', 6000);
    }
    
    /**
     * モーダル確認ダイアログでユーザーの破壊的アクションを確認
     * アクセシビリティ完全対応でESCキーやフォーカス管理を実装
     * @param {string} message - 確認メッセージ
     * @param {Function} callback - 「実行」ボタンを押した時の処理
     */
    function confirmAction(message, callback) {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'confirm-title');
        
        const modal = document.createElement('div');
        modal.className = 'bg-white p-6 rounded-lg shadow-xl max-w-md mx-4';
        
        const title = document.createElement('h3');
        title.id = 'confirm-title';
        title.className = 'text-lg font-semibold mb-4 text-gray-800';
        title.textContent = '確認';
        
        const messageDiv = document.createElement('p');
        messageDiv.className = 'text-gray-600 mb-6';
        messageDiv.textContent = message;
        
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'flex gap-3 justify-end';
        
        const cancelButton = document.createElement('button');
        cancelButton.className = 'px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors';
        cancelButton.textContent = 'キャンセル';
        cancelButton.onclick = () => overlay.remove();
        
        const confirmButton = document.createElement('button');
        confirmButton.className = 'px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors';
        confirmButton.textContent = '実行';
        confirmButton.onclick = () => {
            callback();
            overlay.remove();
        };
        
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(confirmButton);
        modal.appendChild(title);
        modal.appendChild(messageDiv);
        modal.appendChild(buttonContainer);
        overlay.appendChild(modal);
        
        document.body.appendChild(overlay);
        
        // ESCキーで閉じる
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                overlay.remove();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
        
        // 最初のボタンにフォーカス
        cancelButton.focus();
    }

    /**
     * ファイル配列を非同期で処理し、プログレスを表示しながら写真を追加
     * 同時処理数制限、エラーハンドリング、パフォーマンス最適化を実装
     * @param {FileList|File[]} files - 処理するファイルのリスト
     * @returns {Promise<void>} 非同期処理の結果
     */
    async function handleFilesAsync(files) {
        const fileArray = Array.from(files);
        const maxFiles = 100;
        const maxConcurrent = 3; // 同時処理数制限
        
        // ファイル数制限
        if (state.photos.length + fileArray.length > maxFiles) {
            showNotification(`ファイル数が制限を超えています（最大${maxFiles}枚）`, 'error');
            return;
        }
        
        let processedCount = 0;
        let errorCount = 0;
        const totalFiles = fileArray.length;
        
        // プログレス表示
        const progressNotification = document.createElement('div');
        progressNotification.className = 'fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 bg-blue-500 text-white';
        progressNotification.innerHTML = `
            <div>画像処理中: <span id="progress-count">0</span>/${totalFiles}</div>
            <div class="w-full bg-blue-300 rounded-full h-2 mt-2">
                <div id="progress-bar" class="bg-white h-2 rounded-full" style="width: 0%"></div>
            </div>
        `;
        document.body.appendChild(progressNotification);
        
        // バッチ処理で非同期実行
        for (let i = 0; i < fileArray.length; i += maxConcurrent) {
            const batch = fileArray.slice(i, i + maxConcurrent);
            const batchPromises = batch.map(file => processFileAsync(file));
            
            try {
                const results = await Promise.allSettled(batchPromises);
                results.forEach((result, index) => {
                    if (result.status === 'fulfilled') {
                        const photoData = result.value;
                        if (photoData) {
                            // サムネイル作成
                            createThumbnail(photoData.url, (thumbnailUrl) => {
                                photoData.thumbnail = thumbnailUrl;
                                imageCache.set(photoData.id, {
                                    thumbnail: thumbnailUrl,
                                    original: photoData.url
                                });
                                cleanupImageCache();
                            });
                            
                            state.photos.push(photoData);
                            processedCount++;
                        }
                    } else {
                        errorCount++;
                        console.error('ファイル処理エラー:', result.reason);
                    }
                    
                    // プログレス更新
                    const progressCount = document.getElementById('progress-count');
                    const progressBar = document.getElementById('progress-bar');
                    if (progressCount && progressBar) {
                        progressCount.textContent = processedCount + errorCount;
                        const percentage = ((processedCount + errorCount) / totalFiles) * 100;
                        progressBar.style.width = `${percentage}%`;
                    }
                });
                
                // レンダリング更新（バッチ完了時のみ）
                render();
                
            } catch (batchError) {
                console.error('バッチ処理エラー:', batchError);
                errorCount += batch.length;
            }
        }
        
        // プログレス通知を削除
        setTimeout(() => {
            progressNotification.remove();
        }, 1000);
        
        // 完了通知
        if (processedCount > 0) {
            showNotification(`${processedCount}枚の画像を追加しました`, 'success');
        }
        if (errorCount > 0) {
            showNotification(`${errorCount}枚の画像でエラーが発生しました`, 'error');
        }
    }
    
    /**
     * 個別ファイルを非同期で処理し写真オブジェクトを作成
     * ファイルバリデーション、読み込み、圧縮処理を含む完全なパイプライン
     * @param {File} file - 処理する画像ファイル
     * @returns {Promise<Object>} 写真オブジェクト（id, url, location, comment）
     */
    async function processFileAsync(file) {
        return new Promise((resolve, reject) => {
            try {
                validateImageFile(file);
                
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const compressedUrl = await compressImageAsync(e.target.result);
                        resolve({
                            id: Date.now() + Math.random(),
                            url: compressedUrl,
                            location: '',
                            comment: ''
                        });
                    } catch (compressionError) {
                        reject(compressionError);
                    }
                };
                reader.onerror = () => reject(new Error('ファイル読み込みエラー'));
                reader.readAsDataURL(file);
                
            } catch (validationError) {
                reject(validationError);
            }
        });
    }
    
    /**
     * 同期圧縮関数をPromiseベースにラッピングして非同期化
     * @param {string} src - 圧縮する画像のData URL
     * @returns {Promise<string>} 圧縮後の画像Data URL
     */
    async function compressImageAsync(src) {
        return new Promise((resolve, reject) => {
            compressImage(src, resolve);
        });
    }

    /**
     * メインのファイル処理エントリポイント
     * 非同期処理へのラッパーで、グローバルエラーハンドリングを含む
     * @param {FileList|File[]} files - 処理するファイルのリスト
     */
    function handleFiles(files) {
        // 非同期処理に移行
        handleFilesAsync(files).catch(error => {
            console.error('ファイル処理の全体エラー:', error);
            showNotification('ファイル処理中に予期しないエラーが発生しました', 'error');
        });
    }

    /**
     * 画像を指定された品質設定で圧縮してメモリ使用量を最適化
     * Canvasを使用した高品質リサイズとJPEG圧縮処理
     * @param {string} src - 圧縮する画像のData URL
     * @param {Function} callback - 圧縮完了時のコールバック(compressedDataUrl)
     */
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
            try {
                let width = img.width;
                let height = img.height;

                // 画像サイズの妥当性チェック
                if (width === 0 || height === 0) {
                    throw new Error('無効な画像ファイルです');
                }

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
                
                if (!ctx) {
                    throw new Error('Canvas context の作成に失敗しました');
                }
                
                // セキュリティ: Canvas汚染チェック
                ctx.drawImage(img, 0, 0, width, height);
                
                const compressedDataUrl = canvas.toDataURL('image/jpeg', QUALITY);
                
                // データURL の妥当性チェック
                if (!compressedDataUrl.startsWith('data:image/')) {
                    throw new Error('画像データの変換に失敗しました');
                }
                
                callback(compressedDataUrl);
            } catch (error) {
                console.error('画像圧縮エラー:', error);
                throw error;
            }
        };
        
        img.onerror = () => {
            throw new Error('画像の読み込みに失敗しました');
        };
        
        // データURL の検証
        if (!src.startsWith('data:image/')) {
            throw new Error('無効な画像データです');
        }
        
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
                const field = e.target.dataset.field;
                const value = e.target.value;
                
                if (photo && field && (field === 'location' || field === 'comment')) {
                    // 入力値の長さ制限
                    const maxLength = field === 'location' ? 100 : 500;
                    if (value.length > maxLength) {
                        showNotification(`${field === 'location' ? '場所' : 'コメント'}は${maxLength}文字以内で入力してください`, 'error');
                        e.target.value = value.substring(0, maxLength);
                        return;
                    }
                    
                    photo[field] = sanitizeText(value);
                    debouncedRenderPreview();
                }
            }
        });

        photoListContainer.addEventListener('click', e => {
            if (e.target.closest('.remove-btn')) {
                const photoId = parseFloat(e.target.closest('.remove-btn').dataset.id);
                
                // 確認ダイアログを表示
                confirmAction('この写真を削除しますか？', () => {
                    // メモリリークを防ぐために画像URLを解放
                    revokeImageUrl(photoId);
                    
                    state.photos = state.photos.filter(p => p.id !== photoId);
                    updatePhotoCount();
                    optimizedRender();
                    showNotification('写真を削除しました', 'success');
                });
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
        
        // ウィンドウリサイズ時にも最適ズームを再計算と仮想スクロール更新
        window.addEventListener('resize', debounce(() => {
            calculateAndSetOptimalZoom();
            updateVirtualScrollState();
            if (state.photos.length > 50) {
                renderVirtualPhotoList();
            }
        }, 150));
        
        // 仮想スクロール用のスクロールイベント
        const photoListScrollContainer = photoListContainer.parentElement;
        if (photoListScrollContainer) {
            photoListScrollContainer.addEventListener('scroll', debounce(() => {
                if (state.photos.length > 50) {
                    const scrollTop = photoListScrollContainer.scrollTop;
                    const newVisibleStart = Math.floor(scrollTop / virtualScrollState.itemHeight);
                    
                    if (newVisibleStart !== virtualScrollState.visibleStart) {
                        virtualScrollState.visibleStart = Math.max(0, newVisibleStart - 2); // バッファ
                        updateVirtualScrollState();
                        renderVirtualPhotoList();
                    }
                }
            }, 50));
        }

        // 保存・読み込み機能
        saveButton.addEventListener('click', () => {
            const dataStr = JSON.stringify(state, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = state.siteName ? `${state.siteName}.json` : '現場データ.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });

        loadButton.addEventListener('click', () => {
            loadInput.click();
        });

        // 印刷ボタン（バリデーションなし）
        printButton.addEventListener('click', () => {
            console.log('印刷ボタンがクリックされました');
            try {
                window.print();
                console.log('window.print()が呼び出されました');
            } catch (error) {
                console.error('印刷エラー:', error);
                showNotification('印刷処理でエラーが発生しました', 'error');
            }
        });

        loadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // ファイルタイプの検証
            if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
                showNotification('JSONファイル以外は読み込めません', 'error');
                e.target.value = '';
                return;
            }
            
            // ファイルサイズ制限 (10MB)
            if (file.size > 10 * 1024 * 1024) {
                showNotification('ファイルサイズが大きすぎます（10MB以下）', 'error');
                e.target.value = '';
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const jsonText = event.target.result;
                    
                    // JSON文字列の基本的な検証
                    if (typeof jsonText !== 'string' || jsonText.length === 0) {
                        throw new Error('無効なファイル内容です');
                    }
                    
                    const loadedState = JSON.parse(jsonText);
                    
                    // 読み込んだデータの基本的な検証
                    if (typeof loadedState !== 'object' || loadedState === null) {
                        throw new Error('無効なデータ形式です');
                    }
                    
                    // 必要なプロパティの検証とサニタイゼーション
                    const sanitizedState = {
                        siteName: sanitizeText(loadedState.siteName || ''),
                        personName: sanitizeText(loadedState.personName || ''),
                        date: loadedState.date || '',
                        photosPerPage: Number(loadedState.photosPerPage) || 4,
                        orientation: ['portrait', 'landscape'].includes(loadedState.orientation) ? loadedState.orientation : 'portrait',
                        fontFamily: ['sans-serif', 'serif'].includes(loadedState.fontFamily) ? loadedState.fontFamily : 'sans-serif',
                        fontSize: Math.min(Math.max(Number(loadedState.fontSize) || 10, 6), 20),
                        fontWeight: ['normal', 'bold'].includes(loadedState.fontWeight) ? loadedState.fontWeight : 'normal',
                        imageQuality: ['high', 'highest'].includes(loadedState.imageQuality) ? loadedState.imageQuality : 'high',
                        imageDisplayMode: ['trim', 'fit'].includes(loadedState.imageDisplayMode) ? loadedState.imageDisplayMode : 'trim',
                        photos: Array.isArray(loadedState.photos) ? loadedState.photos.slice(0, 100).map(photo => ({
                            id: Number(photo.id) || Date.now() + Math.random(),
                            url: (typeof photo.url === 'string' && photo.url.startsWith('data:image/')) ? photo.url : '',
                            location: sanitizeText(photo.location || '').substring(0, 100),
                            comment: sanitizeText(photo.comment || '').substring(0, 500)
                        })).filter(photo => photo.url) : [],
                        zoomLevel: Number(loadedState.zoomLevel) || 1.0
                    };
                    
                    state = sanitizedState;
                    siteNameInput.value = state.siteName;
                    personNameInput.value = state.personName;
                    dateInput.value = state.date;
                    photosPerPageSelect.value = state.photosPerPage;
                    orientationSelect.value = state.orientation;
                    fontFamilySelect.value = state.fontFamily;
                    fontSizeInput.value = state.fontSize;
                    fontWeightSelect.value = state.fontWeight;
                    
                    const qualityRadio = document.querySelector(`input[name="imageQuality"][value="${state.imageQuality}"]`);
                    if (qualityRadio) {
                        qualityRadio.checked = true;
                    }
                    
                    const displayModeRadio = document.querySelector(`input[name="imageDisplayMode"][value="${state.imageDisplayMode}"]`);
                    if (displayModeRadio) {
                        displayModeRadio.checked = true;
                    }
                    
                    render();
                    setTimeout(calculateAndSetOptimalZoom, 0);
                    showNotification('ファイルを正常に読み込みました', 'success');
                    
                } catch (err) {
                    console.error('ファイル読み込みエラー:', err);
                    showNotification('ファイルの読み込みに失敗しました。正しいJSONファイルを選択してください。', 'error');
                }
            };
            
            reader.onerror = () => {
                showNotification('ファイルの読み込み中にエラーが発生しました', 'error');
            };
            
            reader.readAsText(file);
            e.target.value = '';
        });
    }

    // --- ユーザビリティ改善関数 ---
    function updatePhotoCount() {
        const countElement = document.getElementById('photo-count');
        if (countElement) {
            countElement.textContent = `写真: ${state.photos.length}枚`;
            if (state.photos.length >= 90) {
                countElement.className = 'text-sm text-red-600 mb-2';
                showWarning('写真が90枚を超えました。パフォーマンスのため100枚以内に収めることをお勧めします。');
            } else if (state.photos.length >= 50) {
                countElement.className = 'text-sm text-yellow-600 mb-2';
            } else {
                countElement.className = 'text-sm text-gray-600 mb-2';
            }
        }
    }
    
    // validateRequiredFields関数を削除（必須チェック不要）
    
    function setupHelpSystem() {
        // 写真追加ヘルプ
        const helpPhotos = document.getElementById('help-photos');
        if (helpPhotos) {
            helpPhotos.addEventListener('click', () => {
                showHelp('写真の追加方法:\n\n1. ドラッグ&ドロップ: フォルダから写真を直接ドラッグしてください\n2. クリック選択: エリアをクリックしてファイル選択ダイアログを開けます\n3. 対応形式: JPEG, PNG, GIF, WebP\n4. 制限: 1ファイル50MB以下、全体で100枚まで\n5. 順番変更: 写真をドラッグして並び替えできます');
            });
        }
        
        // 共通情報ヘルプ
        const helpInfo = document.getElementById('help-info');
        if (helpInfo) {
            helpInfo.addEventListener('click', () => {
                showHelp('共通情報の入力について:\n\n• 現場名: 印刷される書類の見出しになります\n• 担当者: 責任者名を記入してください\n• 日時: 撮影日や報告日を選択してください（和暦で印刷されます）\n\n空欄のままでも印刷できます。必要に応じて入力してください。');
            });
        }
    }
    
    function setupKeyboardNavigation() {
        // ESCキーで通知を閉じる
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const notifications = document.querySelectorAll('[class*="notification-"]');
                notifications.forEach(n => n.remove());
            }
        });
        
        // Ctrl+S で保存
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (state.photos.length > 0) {
                    document.getElementById('save-button').click();
                    showNotification('データを保存しました', 'success');
                }
            }
        });
        
        // Ctrl+P で印刷
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                e.preventDefault();
                window.print();
            }
        });
        
        // ドロップゾーンのキーボード対応
        const dropZone = document.getElementById('drop-zone');
        if (dropZone) {
            dropZone.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    document.getElementById('file-input').click();
                }
            });
        }
    }

    // --- 初期実行 ---
    setupEventListeners();
    setupHelpSystem();
    setupKeyboardNavigation();
    initialize();
    updatePhotoCount();

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