/**
 * メモリ管理モジュール
 * メモリ使用量の監視と最適化
 */
import { AppConfig } from './config.js';

/**
 * メモリ管理クラス
 * メモリ使用量の監視、警告、クリーンアップ機能を提供
 */
export class MemoryManager {
    constructor() {
        this.imageCache = new Map();
        this.memoryThreshold = 0.8; // 80%で警告
        this.cleanupInterval = null;
    }

    /**
     * メモリ使用量の監視
     * @returns {Object|null} メモリ使用量情報
     */
    getMemoryUsage() {
        if (performance.memory) {
            return {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            };
        }
        return null;
    }

    /**
     * メモリ使用量が閾値を超えているかチェック
     * @returns {boolean} 閾値を超えている場合true
     */
    isMemoryUsageHigh() {
        const usage = this.getMemoryUsage();
        if (usage) {
            return usage.used > usage.limit * this.memoryThreshold;
        }
        return false;
    }

    /**
     * メモリ使用量の警告表示
     * @param {Function} showWarning - 警告表示関数
     */
    checkMemoryUsage(showWarning) {
        const usage = this.getMemoryUsage();
        if (usage) {
            const usagePercent = (usage.used / usage.limit) * 100;
            
            if (usagePercent > 90) {
                showWarning(`メモリ使用量が危険レベルです（${usagePercent.toFixed(1)}%）`);
            } else if (usagePercent > 80) {
                showWarning(`メモリ使用量が高くなっています（${usagePercent.toFixed(1)}%）`);
            }
        }
    }

    /**
     * 画像キャッシュに追加
     * @param {string} id - 画像ID
     * @param {Object} data - キャッシュデータ
     */
    addToCache(id, data) {
        this.imageCache.set(id, data);
        this.cleanupCache();
    }

    /**
     * 画像キャッシュから削除
     * @param {string} id - 画像ID
     */
    removeFromCache(id) {
        this.imageCache.delete(id);
    }

    /**
     * 画像キャッシュをクリーンアップ
     */
    cleanupCache() {
        if (this.imageCache.size > AppConfig.MAX_CACHE_SIZE) {
            const keysToDelete = Array.from(this.imageCache.keys()).slice(0, this.imageCache.size - AppConfig.MAX_CACHE_SIZE);
            keysToDelete.forEach(key => this.imageCache.delete(key));
        }
    }

    /**
     * 指定された写真のURLを解放し、メモリ使用量を減らす
     * @param {string} photoId - 解放する写真のID
     * @param {Object} photo - 写真オブジェクト
     */
    revokeImageUrl(photoId, photo) {
        if (photo) {
            // オリジナル画像URLの解放
            if (photo.url && photo.url.startsWith('data:image/')) {
                photo.url = null;
            }
            
            // サムネイルURLの解放
            if (photo.thumbnail && photo.thumbnail.startsWith('data:image/')) {
                photo.thumbnail = null;
            }
            
            // キャッシュからの削除
            this.removeFromCache(photoId);
        }
    }

    /**
     * すべての画像URLを解放し、メモリをクリーンアップ
     * @param {Array} photos - 写真配列
     */
    cleanupAllImageUrls(photos) {
        photos.forEach(photo => {
            if (photo.url && photo.url.startsWith('data:image/')) {
                photo.url = null;
            }
            if (photo.thumbnail && photo.thumbnail.startsWith('data:image/')) {
                photo.thumbnail = null;
            }
        });
        
        this.imageCache.clear();
        
        // ガベージコレクションの実行を促す
        if (window.gc) {
            window.gc();
        }
        
        console.log('メモリクリーンアップが完了しました');
    }

    /**
     * メモリ監視を開始
     * @param {Function} showWarning - 警告表示関数
     * @param {number} interval - 監視間隔（ミリ秒）
     */
    startMonitoring(showWarning, interval = 5000) {
        this.cleanupInterval = setInterval(() => {
            this.checkMemoryUsage(showWarning);
        }, interval);
    }

    /**
     * メモリ監視を停止
     */
    stopMonitoring() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    /**
     * メモリ統計情報を取得
     * @returns {Object} メモリ統計情報
     */
    getMemoryStats() {
        const usage = this.getMemoryUsage();
        return {
            memory: usage,
            cacheSize: this.imageCache.size,
            cacheLimit: AppConfig.MAX_CACHE_SIZE,
            isHighUsage: this.isMemoryUsageHigh()
        };
    }
}
