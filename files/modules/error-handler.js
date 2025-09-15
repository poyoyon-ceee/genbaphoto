/**
 * エラーハンドリングモジュール
 * 統一されたエラー管理とユーザーフレンドリーなメッセージ提供
 */
import { ERROR_CODES, AppConfig } from './config.js';

/**
 * アプリケーション専用のカスタムエラークラス
 * エラーコードと詳細情報を含む構造化されたエラー管理
 */
export class PhotoAppError extends Error {
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

/**
 * エラーコードからユーザーフレンドリーなメッセージを生成
 * @param {string} code - エラーコード
 * @param {Object} details - エラー詳細情報
 * @returns {string} ユーザー向けメッセージ
 */
export function getErrorMessage(code, details = {}) {
    const errorMessages = {
        'INVALID_FILE_TYPE': 'サポートされていないファイル形式です。JPEG、PNG、GIF、WebPのみ対応しています。',
        'FILE_TOO_LARGE': `ファイルサイズが大きすぎます（${Math.round(AppConfig.MAX_FILE_SIZE / 1024 / 1024)}MB以下にしてください）`,
        'TOO_MANY_FILES': `ファイル数が多すぎます（最大${AppConfig.MAX_FILE_COUNT}枚まで）`,
        'COMPRESSION_FAILED': '画像の圧縮に失敗しました。別の画像を試してください。',
        'INVALID_IMAGE_DATA': '画像データが無効です。ファイルが破損している可能性があります。',
        'MEMORY_LIMIT': 'メモリ不足です。画像数を減らすか、画像サイズを小さくしてください。',
        'NETWORK_ERROR': 'ネットワークエラーが発生しました。インターネット接続を確認してください。',
        'PERMISSION_DENIED': 'ファイルアクセスが拒否されました。ブラウザの設定を確認してください。',
        'UNKNOWN_ERROR': '予期しないエラーが発生しました。ページを再読み込みしてください。'
    };
    
    return errorMessages[code] || errorMessages['UNKNOWN_ERROR'];
}

/**
 * 統一されたエラーハンドリング関数
 * エラーの種類に応じて適切な通知を表示し、ログを出力
 * @param {Error} error - 処理するエラーオブジェクト
 * @param {string} context - エラーが発生したコンテキスト（操作名など）
 * @param {Function} showNotification - 通知表示関数
 * @returns {PhotoAppError} 標準化されたエラーオブジェクト
 */
export function handleError(error, context = '', showNotification) {
    console.error(`[${context}] エラー:`, error);
    
    if (error instanceof PhotoAppError) {
        const userMessage = getErrorMessage(error.code, error.details);
        if (showNotification) {
            showNotification(userMessage, 'error', AppConfig.NOTIFICATION_DURATION.ERROR);
        }
        return error;
    }
    
    // 一般的なエラーパターンの検出
    let errorCode = ERROR_CODES.UNKNOWN_ERROR;
    let userMessage = '予期しないエラーが発生しました';
    
    if (error.name === 'NetworkError' || error.message.includes('network')) {
        errorCode = ERROR_CODES.NETWORK_ERROR;
        userMessage = 'ネットワークエラーが発生しました。インターネット接続を確認してください。';
    } else if (error.name === 'NotAllowedError' || error.message.includes('permission')) {
        errorCode = ERROR_CODES.PERMISSION_DENIED;
        userMessage = 'ファイルアクセスが拒否されました。ブラウザの設定を確認してください。';
    } else if (error.message.includes('memory') || error.message.includes('quota')) {
        errorCode = ERROR_CODES.MEMORY_LIMIT;
        userMessage = 'メモリ不足です。画像数を減らすか、画像サイズを小さくしてください。';
    } else if (context) {
        userMessage = `${context}中にエラーが発生しました。操作をやり直してください。`;
    }
    
    if (showNotification) {
        showNotification(userMessage, 'error', AppConfig.NOTIFICATION_DURATION.ERROR);
    }
    return new PhotoAppError(userMessage, errorCode, { originalError: error, context });
}
