/**
 * アプリケーション設定管理モジュール
 * すべての設定値を一元管理し、型安全性を提供
 */
export const AppConfig = {
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
    },
    
    // ログレベル設定
    LOG_LEVELS: {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3
    },
    
    // 現在のログレベル（本番環境ではWARN以上、開発環境ではDEBUG以上）
    CURRENT_LOG_LEVEL: (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') ? 2 : 0,
    
    // ログ関数
    log: function(level, message, ...args) {
        if (level >= this.CURRENT_LOG_LEVEL) {
            const timestamp = new Date().toISOString();
            const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
            console.log(`[${timestamp}] [${levelNames[level]}] ${message}`, ...args);
        }
    },
    
    // デフォルト設定
    DEFAULT_SETTINGS: {
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
    }
};

/**
 * エラーコード定義
 */
export const ERROR_CODES = {
    INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
    FILE_TOO_LARGE: 'FILE_TOO_LARGE',
    TOO_MANY_FILES: 'TOO_MANY_FILES',
    COMPRESSION_FAILED: 'COMPRESSION_FAILED',
    INVALID_IMAGE_DATA: 'INVALID_IMAGE_DATA',
    MEMORY_LIMIT: 'MEMORY_LIMIT',
    NETWORK_ERROR: 'NETWORK_ERROR',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};
