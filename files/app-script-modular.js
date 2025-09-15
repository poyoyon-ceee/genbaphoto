/**
 * 現場写真印刷アプリ - モジュール化版メインスクリプト
 * モジュール分離、状態管理最適化、アクセシビリティ強化を実装
 */
import { AppConfig, ERROR_CODES } from './modules/config.js';
import { PhotoAppError, handleError, getErrorMessage } from './modules/error-handler.js';
import { StateManager } from './modules/state-manager.js';
import { validateImageFile, validateMultipleFiles } from './modules/file-validator.js';
import { MemoryManager } from './modules/memory-manager.js';
import { AccessibilityManager, AccessibilityUtils } from './modules/accessibility.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- モジュールインスタンスの初期化 ---
    const stateManager = new StateManager();
    const memoryManager = new MemoryManager();
    const accessibilityManager = new AccessibilityManager();
    
    // --- フォーカス管理変数 ---
    let activeInputElement = null;
    let isInputInProgress = false;
    
    // --- フォーカス管理関数 ---
    /**
     * 入力中のフォーカスを保護する
     * @param {HTMLElement} element - フォーカスを保護する要素
     */
    function protectFocus(element) {
        activeInputElement = element;
        isInputInProgress = true;
        AppConfig.log(AppConfig.LOG_LEVELS.DEBUG, 'フォーカス保護開始:', element.tagName, element.id || element.className);
        
        // フォーカスを強制的に維持
        element.focus();
    }
    
    /**
     * フォーカス保護を解除する
     */
    function releaseFocus() {
        AppConfig.log(AppConfig.LOG_LEVELS.DEBUG, 'フォーカス保護解除');
        activeInputElement = null;
        isInputInProgress = false;
    }
    
    /**
     * フォーカスを復元する
     */
    function restoreFocus() {
        if (activeInputElement && isInputInProgress) {
            setTimeout(() => {
                activeInputElement.focus();
                // カーソル位置を最後に移動
                if (activeInputElement.setSelectionRange) {
                    const length = activeInputElement.value.length;
                    activeInputElement.setSelectionRange(length, length);
                }
            }, 0);
        }
    }

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

    // --- 通知システム ---
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
        closeButton.textContent = '×';
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
        
        // スクリーンリーダー向けアナウンス
        accessibilityManager.announce(message, type === 'error' ? 'assertive' : 'polite');
        
        return notification;
    }

    // --- DOM要素の取得 ---
    const elements = {
        siteNameInput: document.getElementById('siteName'),
        personNameInput: document.getElementById('personName'),
        dateInput: document.getElementById('date'),
        photosPerPageSelect: document.getElementById('photosPerPage'),
        orientationSelect: document.getElementById('orientation'),
        fontFamilySelect: document.getElementById('fontFamily'),
        fontSizeInput: document.getElementById('fontSize'),
        fontWeightSelect: document.getElementById('fontWeight'),
        imageQualityRadios: document.querySelectorAll('input[name="imageQuality"]'),
        imageDisplayModeRadios: document.querySelectorAll('input[name="imageDisplayMode"]'),
        dropZone: document.getElementById('drop-zone'),
        fileInput: document.getElementById('file-input'),
        photoListContainer: document.getElementById('photo-list'),
        previewPanel: document.getElementById('preview-panel'),
        previewContainer: document.getElementById('preview-container'),
        printButton: document.getElementById('print-button'),
        zoomInButton: document.getElementById('zoom-in-button'),
        zoomOutButton: document.getElementById('zoom-out-button'),
        zoomResetButton: document.getElementById('zoom-reset-button'),
        zoomDisplay: document.getElementById('zoom-display'),
        saveButton: document.getElementById('save-button'),
        loadButton: document.getElementById('load-button'),
        loadInput: document.getElementById('load-input')
    };

    // --- アクセシビリティ強化 ---
    function enhanceAccessibility() {
        // アクセシビリティ設定の適用
        accessibilityManager.applyAccessibilitySettings();
        
        // フォームのアクセシビリティ向上
        const forms = document.querySelectorAll('form, .form-container');
        forms.forEach(form => accessibilityManager.enhanceFormAccessibility(form));
        
        // キーボードショートカットの設定
        accessibilityManager.setupKeyboardShortcuts({
            'ctrl+s': () => {
                if (stateManager.get('photos').length > 0) {
                    elements.saveButton.click();
                    showNotification('データを保存しました', 'success');
                }
            },
            'ctrl+p': () => {
                window.print();
            },
            'escape': () => {
                const notifications = document.querySelectorAll('[class*="notification-"]');
                notifications.forEach(n => n.remove());
            }
        });
        
        // ドロップゾーンのアクセシビリティ向上
        if (elements.dropZone) {
            accessibilityManager.setAriaAttributes(elements.dropZone, {
                'aria-label': '写真をアップロード',
                'aria-describedby': 'drop-zone-instructions',
                'role': 'button',
                'tabindex': '0'
            });
            
            elements.dropZone.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    elements.fileInput.click();
                }
            });
        }
    }

    // --- 画像処理関数 ---
    /**
     * 元画像から正方形のサムネイルを非同期で作成
     * @param {string} originalDataUrl - 元画像のData URL
     * @param {Function} callback - サムネイル作成完了時のコールバック
     */
    function createThumbnail(originalDataUrl, callback) {
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                const size = AppConfig.THUMBNAIL_SIZE;
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
                handleError(error, 'サムネイル作成', showNotification);
            }
        };
        img.onerror = () => handleError(new Error('サムネイル画像の読み込みに失敗'), 'サムネイル作成', showNotification);
        img.src = originalDataUrl;
    }

    /**
     * 画像を指定された品質設定で圧縮
     * @param {string} src - 圧縮する画像のData URL
     * @returns {Promise<string>} 圧縮後の画像Data URL
     */
    async function compressImageAsync(src) {
        return new Promise((resolve, reject) => {
            const quality = stateManager.get('imageQuality');
            const config = AppConfig.IMAGE_QUALITY[quality.toUpperCase()];
            
            const img = new Image();
            img.onload = () => {
                try {
                    let width = img.width;
                    let height = img.height;

                    if (width === 0 || height === 0) {
                        throw new Error('無効な画像ファイルです');
                    }

                    if (width > height) {
                        if (width > config.maxDimension) {
                            height *= config.maxDimension / width;
                            width = config.maxDimension;
                        }
                    } else {
                        if (height > config.maxDimension) {
                            width *= config.maxDimension / height;
                            height = config.maxDimension;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    
                    if (!ctx) {
                        throw new Error('Canvas context の作成に失敗しました');
                    }
                    
                    ctx.drawImage(img, 0, 0, width, height);
                    const compressedDataUrl = canvas.toDataURL('image/jpeg', config.quality);
                    
                    if (!compressedDataUrl.startsWith('data:image/')) {
                        throw new Error('画像データの変換に失敗しました');
                    }
                    
                    resolve(compressedDataUrl);
                } catch (error) {
                    reject(error);
                }
            };
            
            img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
            img.src = src;
        });
    }

    // --- ファイル処理関数 ---
    /**
     * 個別ファイルを非同期で処理し写真オブジェクトを作成
     * @param {File} file - 処理する画像ファイル
     * @returns {Promise<Object>} 写真オブジェクト
     */
    async function processFileAsync(file) {
        try {
            await validateImageFile(file);
            
            return new Promise((resolve, reject) => {
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
            });
            
        } catch (validationError) {
            throw validationError;
        }
    }

    /**
     * ファイル配列を非同期で処理し、プログレスを表示しながら写真を追加
     * @param {FileList|File[]} files - 処理するファイルのリスト
     */
    async function handleFilesAsync(files) {
        const fileArray = Array.from(files);
        const currentPhotos = stateManager.get('photos');
        
        // ファイル数制限
        if (currentPhotos.length + fileArray.length > AppConfig.MAX_FILE_COUNT) {
            showNotification(`ファイル数が制限を超えています（最大${AppConfig.MAX_FILE_COUNT}枚）`, 'error');
            return;
        }
        
        let processedCount = 0;
        let errorCount = 0;
        const totalFiles = fileArray.length;
        
        // プログレス表示
        const progressNotification = document.createElement('div');
        progressNotification.className = 'fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 bg-blue-500 text-white';
        
        const progressText = document.createElement('div');
        progressText.textContent = `画像処理中: 0/${totalFiles}`;
        progressText.id = 'progress-text';
        
        const progressBarContainer = document.createElement('div');
        progressBarContainer.className = 'w-full bg-blue-300 rounded-full h-2 mt-2';
        
        const progressBar = document.createElement('div');
        progressBar.id = 'progress-bar';
        progressBar.className = 'bg-white h-2 rounded-full';
        progressBar.style.width = '0%';
        
        progressBarContainer.appendChild(progressBar);
        progressNotification.appendChild(progressText);
        progressNotification.appendChild(progressBarContainer);
        document.body.appendChild(progressNotification);
        
        // バッチ処理で非同期実行
        for (let i = 0; i < fileArray.length; i += AppConfig.MAX_CONCURRENT_UPLOADS) {
            const batch = fileArray.slice(i, i + AppConfig.MAX_CONCURRENT_UPLOADS);
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
                                memoryManager.addToCache(photoData.id, {
                                    thumbnail: thumbnailUrl,
                                    original: photoData.url
                                });
                            });
                            
                            const currentPhotos = stateManager.get('photos');
                            stateManager.set('photos', [...currentPhotos, photoData]);
                            processedCount++;
                        }
                    } else {
                        errorCount++;
                        console.error('ファイル処理エラー:', result.reason);
                    }
                    
                    // プログレス更新
                    const progressTextEl = document.getElementById('progress-text');
                    const progressBarEl = document.getElementById('progress-bar');
                    if (progressTextEl && progressBarEl) {
                        progressTextEl.textContent = `画像処理中: ${processedCount + errorCount}/${totalFiles}`;
                        const percentage = ((processedCount + errorCount) / totalFiles) * 100;
                        progressBarEl.style.width = `${percentage}%`;
                    }
                });
                
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
            accessibilityManager.announce(`${processedCount}枚の画像を追加しました`);
        }
        if (errorCount > 0) {
            showNotification(`${errorCount}枚の画像でエラーが発生しました`, 'error');
        }
    }

    // --- レンダリング関数 ---
    /**
     * 写真リストのレンダリング
     */
    function renderPhotoList() {
        // 入力中はレンダリングをスキップ
        if (isInputInProgress) {
            AppConfig.log(AppConfig.LOG_LEVELS.DEBUG, '入力中のため写真リストレンダリングをスキップ');
            return;
        }
        
        // 現在のフォーカス状態を保存
        const currentFocus = document.activeElement;
        const isCurrentlyFocused = currentFocus && currentFocus.matches('input[type="text"], textarea');
        
        elements.photoListContainer.innerHTML = '';
        const photos = stateManager.get('photos');
        
        if (photos.length === 0) {
            const p = document.createElement('p');
            p.className = 'text-center text-gray-500 text-sm';
            p.textContent = '写真がありません。';
            elements.photoListContainer.appendChild(p);
            return;
        }
        
        photos.forEach((photo, index) => {
            const div = createPhotoListItem(photo, index);
            elements.photoListContainer.appendChild(div);
        });
        
        updatePhotoCount();
        
        // フォーカスを復元
        if (isCurrentlyFocused && currentFocus.dataset.id) {
            const photoId = currentFocus.dataset.id;
            const field = currentFocus.dataset.field;
            const restoredElement = elements.photoListContainer.querySelector(`[data-id="${photoId}"][data-field="${field}"]`);
            if (restoredElement) {
                setTimeout(() => {
                    restoredElement.focus();
                    // カーソル位置を最後に移動
                    if (restoredElement.setSelectionRange) {
                        const length = restoredElement.value.length;
                        restoredElement.setSelectionRange(length, length);
                    }
                }, 0);
            }
        }
    }

    /**
     * 写真リストの個別アイテム要素を作成
     * @param {Object} photo - 写真オブジェクト
     * @param {number} index - リスト内のインデックス番号
     * @returns {HTMLElement} 作成されたリストアイテムのDOM要素
     */
    function createPhotoListItem(photo, index) {
        const div = document.createElement('div');
        div.className = 'p-3 bg-slate-50 border rounded-lg shadow-sm draggable';
        div.dataset.id = photo.id;
        div.dataset.index = index;
        div.draggable = true;

        // アクセシビリティ属性の設定
        accessibilityManager.setAriaAttributes(div, {
            'aria-label': `写真 ${index + 1}: ${photo.location || '場所未設定'}`,
            'role': 'listitem'
        });

        const container = document.createElement('div');
        container.className = 'flex items-start gap-3';

        const img = document.createElement('img');
        img.src = photo.thumbnail || photo.url;
        img.className = 'w-16 h-16 object-cover rounded-md flex-shrink-0';
        img.draggable = false;
        img.alt = `写真 ${index + 1}`;
        
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
        locationInput.setAttribute('aria-label', '写真の場所');

        const commentTextarea = document.createElement('textarea');
        commentTextarea.dataset.id = photo.id;
        commentTextarea.dataset.field = 'comment';
        commentTextarea.rows = 2;
        commentTextarea.placeholder = 'コメント';
        commentTextarea.className = 'w-full text-sm p-1 rounded-md input-highlight';
        commentTextarea.textContent = sanitizeText(photo.comment);
        commentTextarea.setAttribute('aria-label', '写真のコメント');

        const removeBtn = document.createElement('button');
        removeBtn.dataset.id = photo.id;
        removeBtn.className = 'remove-btn text-red-500 hover:text-red-700 font-bold text-xl flex-shrink-0';
        removeBtn.textContent = '×';
        removeBtn.setAttribute('aria-label', `写真 ${index + 1} を削除`);

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
     */
    function renderPreview() {
        // 入力中はレンダリングをスキップ
        if (isInputInProgress) {
            AppConfig.log(AppConfig.LOG_LEVELS.DEBUG, '入力中のためプレビューレンダリングをスキップ');
            return;
        }
        
        elements.previewContainer.innerHTML = '';
        const photos = stateManager.get('photos');
        
        if (photos.length === 0) {
            const div = document.createElement('div');
            div.className = 'flex items-center justify-center h-full';
            const p = document.createElement('p');
            p.className = 'text-gray-500 text-2xl';
            p.textContent = 'プレビューはありません';
            div.appendChild(p);
            elements.previewContainer.appendChild(div);
            return;
        }
        
        const orientation = stateManager.get('orientation');
        const photosPerPage = stateManager.get('photosPerPage');
        const orientationClass = orientation === 'portrait' ? 'a4-portrait' : 'a4-landscape';
        const chunks = chunkArray(photos, photosPerPage);
        
        chunks.forEach((chunk, pageIndex) => {
            const pageWrapper = document.createElement('div');
            pageWrapper.className = `a4-page-container bg-white p-6 shadow-lg border ${orientationClass}`;
            pageWrapper.style.fontFamily = stateManager.get('fontFamily');
            pageWrapper.style.fontSize = `${stateManager.get('fontSize')}pt`;
            pageWrapper.style.fontWeight = stateManager.get('fontWeight');
            
            const gridLayout = getGridLayout(photosPerPage, orientation);
            const warekiDate = toWareki(stateManager.get('date'));
            
            // ヘッダー作成
            const header = document.createElement('header');
            header.className = 'flex justify-between items-end border-b-2 border-black pb-2 mb-4 flex-shrink-0';
            
            const siteNameDiv = document.createElement('div');
            siteNameDiv.className = 'font-bold text-lg';
            const siteNameInner = document.createElement('div');
            siteNameInner.textContent = `現場名: ${sanitizeText(stateManager.get('siteName')) || 'N/A'}`;
            siteNameDiv.appendChild(siteNameInner);
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'text-right text-sm flex-shrink-0';
            
            const personNameDiv = document.createElement('div');
            personNameDiv.textContent = `担当者: ${sanitizeText(stateManager.get('personName')) || 'N/A'}`;
            
            const dateDiv = document.createElement('div');
            dateDiv.textContent = `日時: ${warekiDate || 'N/A'}`;
            
            infoDiv.appendChild(personNameDiv);
            infoDiv.appendChild(dateDiv);
            header.appendChild(siteNameDiv);
            header.appendChild(infoDiv);
            
            // メインコンテンツ作成
            const main = document.createElement('main');
            main.className = `grid ${gridLayout} gap-4 flex-grow min-h-0`;
            
            chunk.forEach((photo, photoIndex) => {
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
                const imageContainerClass = stateManager.get('imageDisplayMode') === 'trim' ? 'overflow-hidden' : '';
                imageContainer.className = `bg-gray-100 flex items-center justify-center ${imageContainerClass} min-h-0 flex-grow`;
                
                const img = document.createElement('img');
                img.src = photo.url;
                const imageClass = stateManager.get('imageDisplayMode') === 'trim' ? 'max-w-full max-h-full object-contain' : 'w-full h-full object-contain';
                img.className = imageClass;
                img.draggable = false;
                img.alt = `写真 ${photoIndex + 1}: ${photo.location || '場所未設定'}`;
                
                imageContainer.appendChild(img);
                photoCell.appendChild(textDiv);
                photoCell.appendChild(imageContainer);
                main.appendChild(photoCell);
            });
            
            pageWrapper.appendChild(header);
            pageWrapper.appendChild(main);
            elements.previewContainer.appendChild(pageWrapper);
        });
    }

    // --- ユーティリティ関数 ---
    /**
     * 関数の実行を指定時間遅延させるユーティリティ関数
     * @param {Function} func - 遅延実行する関数
     * @param {number} delay - 遅延時間（ミリ秒）
     * @returns {Function} デバウンスされた関数
     */
    function debounce(func, delay = AppConfig.DEBOUNCE_DELAY) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }

    function updatePhotoCount() {
        const countElement = document.getElementById('photo-count');
        if (countElement) {
            const photoCount = stateManager.get('photos').length;
            countElement.textContent = `写真: ${photoCount}枚`;
            
            if (photoCount >= 90) {
                countElement.className = 'text-sm text-red-600 mb-2';
                showNotification('写真が90枚を超えました。パフォーマンスのため100枚以内に収めることをお勧めします。', 'warning');
            } else if (photoCount >= 50) {
                countElement.className = 'text-sm text-yellow-600 mb-2';
            } else {
                countElement.className = 'text-sm text-gray-600 mb-2';
            }
        }
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

    // --- イベントリスナーの設定 ---
    function setupEventListeners() {
        // 状態変更の監視
        stateManager.subscribe((newState, oldState) => {
            console.log('状態変更:', { newState, oldState, isInputInProgress });
            
            // 写真リストの更新
            if (newState.photos !== oldState.photos) {
                console.log('写真リストを更新');
                renderPhotoList();
            }
            
            // プレビューの更新
            if (newState.photos !== oldState.photos || 
                newState.photosPerPage !== oldState.photosPerPage ||
                newState.orientation !== oldState.orientation ||
                newState.fontFamily !== oldState.fontFamily ||
                newState.fontSize !== oldState.fontSize ||
                newState.fontWeight !== oldState.fontWeight ||
                newState.imageDisplayMode !== oldState.imageDisplayMode ||
                newState.siteName !== oldState.siteName ||
                newState.personName !== oldState.personName ||
                newState.date !== oldState.date) {
                console.log('プレビューを更新');
                renderPreview();
            }
        });

        // フォーム入力の監視（デバウンス付き）
        const debouncedSiteNameUpdate = debounce((value) => {
            stateManager.set('siteName', value);
            // 入力完了後にレンダリングを実行
            setTimeout(() => {
                if (!isInputInProgress) {
                    console.log('現場名入力完了後のレンダリング実行');
                    renderPreview();
                }
            }, 100);
        }, 500);

        const debouncedPersonNameUpdate = debounce((value) => {
            stateManager.set('personName', value);
            // 入力完了後にレンダリングを実行
            setTimeout(() => {
                if (!isInputInProgress) {
                    console.log('担当者名入力完了後のレンダリング実行');
                    renderPreview();
                }
            }, 100);
        }, 500);

        elements.siteNameInput.addEventListener('focus', e => {
            protectFocus(e.target);
        });
        
        elements.siteNameInput.addEventListener('input', e => {
            console.log('現場名入力:', e.target.value);
            debouncedSiteNameUpdate(e.target.value);
        });
        
        elements.siteNameInput.addEventListener('blur', e => {
            // 少し遅延してフォーカスを解除（入力完了を待つ）
            setTimeout(() => {
                releaseFocus();
            }, 200);
        });

        elements.personNameInput.addEventListener('focus', e => {
            protectFocus(e.target);
        });
        
        elements.personNameInput.addEventListener('input', e => {
            console.log('担当者名入力:', e.target.value);
            debouncedPersonNameUpdate(e.target.value);
        });
        
        elements.personNameInput.addEventListener('blur', e => {
            // 少し遅延してフォーカスを解除（入力完了を待つ）
            setTimeout(() => {
                releaseFocus();
            }, 200);
        });

        elements.dateInput.addEventListener('change', e => {
            stateManager.set('date', e.target.value);
        });

        elements.photosPerPageSelect.addEventListener('change', e => {
            stateManager.set('photosPerPage', parseInt(e.target.value, 10));
        });

        elements.orientationSelect.addEventListener('change', e => {
            stateManager.set('orientation', e.target.value);
        });

        elements.fontFamilySelect.addEventListener('change', e => {
            stateManager.set('fontFamily', e.target.value);
        });

        elements.fontSizeInput.addEventListener('change', e => {
            stateManager.set('fontSize', parseInt(e.target.value, 10));
        });

        elements.fontWeightSelect.addEventListener('change', e => {
            stateManager.set('fontWeight', e.target.value);
        });

        elements.imageQualityRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                stateManager.set('imageQuality', e.target.value);
            });
        });

        elements.imageDisplayModeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                stateManager.set('imageDisplayMode', e.target.value);
            });
        });

        // 写真リストのイベント（デバウンス付き）
        const debouncedPhotoUpdate = debounce((photoId, field, value) => {
            const photos = stateManager.get('photos');
            const photo = photos.find(p => p.id === photoId);
            
            if (photo && field && (field === 'location' || field === 'comment')) {
                photo[field] = sanitizeText(value);
                stateManager.set('photos', [...photos]);
                // 入力完了後にレンダリングを実行
                setTimeout(() => {
                    if (!isInputInProgress) {
                        console.log('入力完了後のレンダリング実行');
                        renderPhotoList();
                        renderPreview();
                    }
                }, 100);
            }
        }, 500);

        // 写真リストのイベント委譲（フォーカス保護付き）
        elements.photoListContainer.addEventListener('focusin', e => {
            if (e.target.matches('input[type="text"], textarea')) {
                protectFocus(e.target);
            }
        });
        
        elements.photoListContainer.addEventListener('focusout', e => {
            if (e.target.matches('input[type="text"], textarea')) {
                // 少し遅延してフォーカスを解除（入力完了を待つ）
                setTimeout(() => {
                    releaseFocus();
                }, 200);
            }
        });
        
        elements.photoListContainer.addEventListener('input', e => {
            if (e.target.matches('input[type="text"], textarea')) {
                const photoId = parseFloat(e.target.dataset.id);
                const field = e.target.dataset.field;
                const value = e.target.value;
                
                console.log('写真入力:', { photoId, field, value });
                
                if (field && (field === 'location' || field === 'comment')) {
                    const maxLength = field === 'location' ? AppConfig.MAX_LOCATION_LENGTH : AppConfig.MAX_COMMENT_LENGTH;
                    if (value.length > maxLength) {
                        showNotification(`${field === 'location' ? '場所' : 'コメント'}は${maxLength}文字以内で入力してください`, 'error');
                        e.target.value = value.substring(0, maxLength);
                        return;
                    }
                    
                    debouncedPhotoUpdate(photoId, field, value);
                }
            }
        });

        elements.photoListContainer.addEventListener('click', e => {
            if (e.target.closest('.remove-btn')) {
                const photoId = parseFloat(e.target.closest('.remove-btn').dataset.id);
                const photos = stateManager.get('photos');
                const photo = photos.find(p => p.id === photoId);
                
                if (confirm('この写真を削除しますか？')) {
                    memoryManager.revokeImageUrl(photoId, photo);
                    const updatedPhotos = photos.filter(p => p.id !== photoId);
                    stateManager.set('photos', updatedPhotos);
                    showNotification('写真を削除しました', 'success');
                    accessibilityManager.announce('写真を削除しました');
                }
            }
        });

        // ドラッグ&ドロップ
        elements.dropZone.addEventListener('dragover', e => {
            e.preventDefault();
            e.stopPropagation();
            elements.dropZone.classList.add('bg-indigo-50');
        });

        elements.dropZone.addEventListener('dragleave', e => {
            e.preventDefault();
            e.stopPropagation();
            elements.dropZone.classList.remove('bg-indigo-50');
        });

        elements.dropZone.addEventListener('drop', e => {
            e.preventDefault();
            e.stopPropagation();
            elements.dropZone.classList.remove('bg-indigo-50');
            handleFilesAsync(e.dataTransfer.files);
        });

        elements.fileInput.addEventListener('change', e => handleFilesAsync(e.target.files));
        elements.dropZone.addEventListener('click', () => elements.fileInput.click());

        // 保存・読み込み
        elements.saveButton.addEventListener('click', () => {
            const state = stateManager.getState();
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
            showNotification('データを保存しました', 'success');
        });

        elements.loadButton.addEventListener('click', () => {
            elements.loadInput.click();
        });

        elements.loadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
                showNotification('JSONファイル以外は読み込めません', 'error');
                e.target.value = '';
                return;
            }
            
            if (file.size > 10 * 1024 * 1024) {
                showNotification('ファイルサイズが大きすぎます（10MB以下）', 'error');
                e.target.value = '';
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const jsonText = event.target.result;
                    
                    if (typeof jsonText !== 'string' || jsonText.length === 0) {
                        throw new Error('無効なファイル内容です');
                    }
                    
                    const loadedState = JSON.parse(jsonText);
                    
                    if (typeof loadedState !== 'object' || loadedState === null) {
                        throw new Error('無効なデータ形式です');
                    }
                    
                    // データの検証とサニタイゼーション
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
                        photos: Array.isArray(loadedState.photos) ? loadedState.photos.slice(0, AppConfig.MAX_FILE_COUNT).map(photo => ({
                            id: Number(photo.id) || Date.now() + Math.random(),
                            url: (typeof photo.url === 'string' && photo.url.startsWith('data:image/')) ? photo.url : '',
                            location: sanitizeText(photo.location || '').substring(0, AppConfig.MAX_LOCATION_LENGTH),
                            comment: sanitizeText(photo.comment || '').substring(0, AppConfig.MAX_COMMENT_LENGTH)
                        })).filter(photo => photo.url) : [],
                        zoomLevel: Number(loadedState.zoomLevel) || 1.0
                    };
                    
                    stateManager.setState(sanitizedState);
                    
                    // UI要素の更新
                    elements.siteNameInput.value = sanitizedState.siteName;
                    elements.personNameInput.value = sanitizedState.personName;
                    elements.dateInput.value = sanitizedState.date;
                    elements.photosPerPageSelect.value = sanitizedState.photosPerPage;
                    elements.orientationSelect.value = sanitizedState.orientation;
                    elements.fontFamilySelect.value = sanitizedState.fontFamily;
                    elements.fontSizeInput.value = sanitizedState.fontSize;
                    elements.fontWeightSelect.value = sanitizedState.fontWeight;
                    
                    const qualityRadio = document.querySelector(`input[name="imageQuality"][value="${sanitizedState.imageQuality}"]`);
                    if (qualityRadio) {
                        qualityRadio.checked = true;
                    }
                    
                    const displayModeRadio = document.querySelector(`input[name="imageDisplayMode"][value="${sanitizedState.imageDisplayMode}"]`);
                    if (displayModeRadio) {
                        displayModeRadio.checked = true;
                    }
                    
                    showNotification('ファイルを正常に読み込みました', 'success');
                    accessibilityManager.announce('ファイルを正常に読み込みました');
                    
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

        // 印刷ボタン
        elements.printButton.addEventListener('click', () => {
            if (validateBeforePrint()) {
                try {
                    window.print();
                    console.log('window.print()が呼び出されました');
                } catch (error) {
                    handleError(error, '印刷処理', showNotification);
                }
            }
        });
    }

    // --- 印刷前バリデーション ---
    function validateBeforePrint() {
        const state = stateManager.getState();
        const errors = [];
        
        if (!state.siteName.trim()) {
            errors.push('現場名を入力してください');
        }
        
        if (!state.personName.trim()) {
            errors.push('担当者名を入力してください');
        }
        
        if (state.photos.length === 0) {
            errors.push('写真を追加してください');
        }
        
        if (errors.length > 0) {
            showNotification(errors.join('\n'), 'error');
            return false;
        }
        
        return true;
    }

    // --- 初期化 ---
    function initialize() {
        console.log('アプリケーションを初期化中...');
        
        // 日付の初期設定
        elements.dateInput.valueAsDate = new Date();
        stateManager.set('date', elements.dateInput.value);
        console.log('初期日付設定完了');
        
        // アクセシビリティの強化
        enhanceAccessibility();
        console.log('アクセシビリティ設定完了');
        
        // メモリ監視の開始
        memoryManager.startMonitoring((message) => {
            showNotification(message, 'warning');
        });
        console.log('メモリ監視開始');
        
        // ページ離脱時のメモリクリーンアップ
        window.addEventListener('beforeunload', () => {
            const photos = stateManager.get('photos');
            memoryManager.cleanupAllImageUrls(photos);
        });
        
        // 初回レンダリング
        renderPhotoList();
        renderPreview();
        console.log('初回レンダリング完了');
        
        console.log('アプリケーション初期化完了');
    }

    // --- 実行 ---
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
                    handleError(error, 'Service Worker登録', showNotification);
                });
        });
    }
});
