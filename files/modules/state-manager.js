/**
 * 状態管理モジュール
 * Observer パターンを使用した状態変更の通知システム
 */
import { AppConfig } from './config.js';

/**
 * アプリケーション状態の一元管理クラス
 * Observer パターンを使用した状態変更の通知システム
 */
export class StateManager {
    /**
     * 初期状態でStateManagerを作成
     * すべてのアプリケーション状態とオブザーバー配列を初期化
     */
    constructor() {
        this.state = { ...AppConfig.DEFAULT_SETTINGS };
        this.observers = [];
        this.history = []; // 状態履歴（Undo/Redo用）
        this.maxHistorySize = 50;
    }

    /**
     * 状態を更新し、登録済みオブザーバーに変更を通知
     * @param {Object} updates - 更新する状態プロパティのオブジェクト
     * @param {boolean} saveToHistory - 履歴に保存するかどうか
     */
    setState(updates, saveToHistory = true) {
        const oldState = { ...this.state };
        this.state = { ...this.state, ...updates };
        
        // 履歴に保存
        if (saveToHistory) {
            this.saveToHistory(oldState);
        }
        
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
     * 特定のプロパティの値を取得
     * @param {string} key - 取得するプロパティのキー
     * @returns {*} プロパティの値
     */
    get(key) {
        return this.state[key];
    }

    /**
     * 特定のプロパティの値を設定
     * @param {string} key - 設定するプロパティのキー
     * @param {*} value - 設定する値
     * @param {boolean} saveToHistory - 履歴に保存するかどうか
     */
    set(key, value, saveToHistory = true) {
        this.setState({ [key]: value }, saveToHistory);
    }

    /**
     * 状態変更通知を受け取るオブザーバーを登録
     * @param {Function} callback - 状態変更時に呼び出されるコールバック関数
     * @returns {Function} 登録解除用の関数
     */
    subscribe(callback) {
        this.observers.push(callback);
        
        // 登録解除用の関数を返す
        return () => {
            this.unsubscribe(callback);
        };
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

    /**
     * 状態を履歴に保存
     * @param {Object} state - 保存する状態
     * @private
     */
    saveToHistory(state) {
        this.history.push(JSON.parse(JSON.stringify(state)));
        
        // 履歴サイズ制限
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }
    }

    /**
     * 前の状態に戻る（Undo）
     * @returns {boolean} 成功した場合true
     */
    undo() {
        if (this.history.length === 0) {
            return false;
        }
        
        const previousState = this.history.pop();
        const currentState = { ...this.state };
        this.state = previousState;
        
        this.notifyObservers(currentState, this.state);
        return true;
    }

    /**
     * 状態をリセット
     */
    reset() {
        const oldState = { ...this.state };
        this.state = { ...AppConfig.DEFAULT_SETTINGS };
        this.history = [];
        this.notifyObservers(oldState, this.state);
    }

    /**
     * 状態の検証
     * @returns {Object} 検証結果
     */
    validate() {
        const errors = [];
        const warnings = [];
        
        // 必須フィールドの検証
        if (!this.state.siteName.trim()) {
            warnings.push('現場名が入力されていません');
        }
        
        if (!this.state.personName.trim()) {
            warnings.push('担当者名が入力されていません');
        }
        
        // 写真数の検証
        if (this.state.photos.length === 0) {
            warnings.push('写真が追加されていません');
        }
        
        if (this.state.photos.length > AppConfig.MAX_FILE_COUNT) {
            errors.push(`写真数が制限を超えています（最大${AppConfig.MAX_FILE_COUNT}枚）`);
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
}
