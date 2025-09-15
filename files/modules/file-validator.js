/**
 * ファイル検証モジュール
 * セキュリティを重視したファイル検証機能
 */
import { AppConfig, ERROR_CODES } from './config.js';
import { PhotoAppError } from './error-handler.js';

/**
 * ファイルヘッダーを検証して画像ファイルかどうかを確認
 * @param {File} file - 検証するファイル
 * @returns {Promise<boolean>} 画像ファイルの場合true
 */
export async function validateFileHeader(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const bytes = new Uint8Array(e.target.result);
            
            // ファイルヘッダーのマジックナンバーをチェック
            const isValidImage = (
                // JPEG: FF D8 FF
                (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) ||
                // PNG: 89 50 4E 47 0D 0A 1A 0A
                (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
                 bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A) ||
                // GIF: 47 49 46 38 (GIF8)
                (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) ||
                // WebP: 52 49 46 46 (RIFF) + 57 45 42 50 (WEBP)
                (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
                 bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50)
            );
            
            resolve(isValidImage);
        };
        reader.onerror = () => reject(new Error('ファイル読み込みエラー'));
        reader.readAsArrayBuffer(file.slice(0, 12)); // 最初の12バイトを読み込み
    });
}

/**
 * アップロードされた画像ファイルのバリデーションを実行
 * ファイル形式、サイズ、ヘッダーの制限をチェック
 * @param {File} file - バリデーションする画像ファイル
 * @returns {Promise<boolean>} バリデーション成功時はtrue
 * @throws {PhotoAppError} バリデーション失敗時にエラーを投げる
 */
export async function validateImageFile(file) {
    // ファイルサイズのチェック
    if (file.size > AppConfig.MAX_FILE_SIZE) {
        throw new PhotoAppError(
            `ファイルサイズが大きすぎます（${Math.round(AppConfig.MAX_FILE_SIZE / 1024 / 1024)}MB以下にしてください）`,
            ERROR_CODES.FILE_TOO_LARGE,
            { fileSize: file.size, maxSize: AppConfig.MAX_FILE_SIZE }
        );
    }
    
    // ファイルサイズが0の場合
    if (file.size === 0) {
        throw new PhotoAppError(
            '空のファイルです',
            ERROR_CODES.INVALID_FILE_TYPE,
            { fileType: file.type }
        );
    }
    
    // Content-Typeのチェック
    if (!AppConfig.ALLOWED_FILE_TYPES.includes(file.type)) {
        throw new PhotoAppError(
            'サポートされていないファイル形式です。JPEG、PNG、GIF、WebPのみ対応しています。',
            ERROR_CODES.INVALID_FILE_TYPE,
            { fileType: file.type }
        );
    }
    
    // ファイルヘッダーの検証
    try {
        const isValidHeader = await validateFileHeader(file);
        if (!isValidHeader) {
            throw new PhotoAppError(
                'ファイルヘッダーが無効です。正しい画像ファイルを選択してください。',
                ERROR_CODES.INVALID_FILE_TYPE,
                { fileType: file.type }
            );
        }
    } catch (error) {
        if (error instanceof PhotoAppError) {
            throw error;
        }
        throw new PhotoAppError(
            'ファイルの検証中にエラーが発生しました',
            ERROR_CODES.INVALID_FILE_TYPE,
            { originalError: error }
        );
    }
    
    return true;
}

/**
 * 複数ファイルのバリデーション
 * @param {FileList|File[]} files - 検証するファイルのリスト
 * @returns {Promise<Object>} 検証結果
 */
export async function validateMultipleFiles(files) {
    const fileArray = Array.from(files);
    const results = {
        valid: [],
        invalid: [],
        total: fileArray.length
    };
    
    for (const file of fileArray) {
        try {
            await validateImageFile(file);
            results.valid.push(file);
        } catch (error) {
            results.invalid.push({
                file,
                error
            });
        }
    }
    
    return results;
}
