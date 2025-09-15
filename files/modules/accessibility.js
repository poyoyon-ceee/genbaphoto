/**
 * アクセシビリティモジュール
 * WCAG 2.1 AA準拠のアクセシビリティ機能を提供
 */

/**
 * アクセシビリティ管理クラス
 * キーボードナビゲーション、スクリーンリーダー対応、フォーカス管理を提供
 */
export class AccessibilityManager {
    constructor() {
        this.focusableElements = [];
        this.currentFocusIndex = -1;
        this.isKeyboardMode = false;
        this.announcements = [];
        this.setupKeyboardDetection();
    }

    /**
     * キーボード使用の検出
     */
    setupKeyboardDetection() {
        document.addEventListener('keydown', () => {
            this.isKeyboardMode = true;
        });
        
        document.addEventListener('mousedown', () => {
            this.isKeyboardMode = false;
        });
    }

    /**
     * フォーカス可能な要素を更新
     * @param {HTMLElement} container - コンテナ要素
     */
    updateFocusableElements(container) {
        this.focusableElements = Array.from(container.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )).filter(el => !el.disabled && el.offsetParent !== null);
    }

    /**
     * 次の要素にフォーカス
     * @param {HTMLElement} currentElement - 現在の要素
     */
    focusNext(currentElement) {
        this.updateFocusableElements(document.body);
        const currentIndex = this.focusableElements.indexOf(currentElement);
        const nextIndex = (currentIndex + 1) % this.focusableElements.length;
        this.focusableElements[nextIndex]?.focus();
    }

    /**
     * 前の要素にフォーカス
     * @param {HTMLElement} currentElement - 現在の要素
     */
    focusPrevious(currentElement) {
        this.updateFocusableElements(document.body);
        const currentIndex = this.focusableElements.indexOf(currentElement);
        const prevIndex = currentIndex <= 0 ? this.focusableElements.length - 1 : currentIndex - 1;
        this.focusableElements[prevIndex]?.focus();
    }

    /**
     * スクリーンリーダー向けのアナウンス
     * @param {string} message - アナウンスするメッセージ
     * @param {string} priority - 優先度 ('polite' | 'assertive')
     */
    announce(message, priority = 'polite') {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', priority);
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = message;
        
        document.body.appendChild(announcement);
        
        // アナウンス後に要素を削除
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }

    /**
     * フォーカストラップの設定
     * @param {HTMLElement} container - トラップするコンテナ
     */
    setupFocusTrap(container) {
        const focusableElements = Array.from(container.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )).filter(el => !el.disabled);

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        const handleTabKey = (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        lastElement.focus();
                        e.preventDefault();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        firstElement.focus();
                        e.preventDefault();
                    }
                }
            }
        };

        container.addEventListener('keydown', handleTabKey);
        firstElement.focus();

        return () => {
            container.removeEventListener('keydown', handleTabKey);
        };
    }

    /**
     * ARIA属性の設定
     * @param {HTMLElement} element - 対象要素
     * @param {Object} attributes - ARIA属性
     */
    setAriaAttributes(element, attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
            if (key.startsWith('aria-')) {
                element.setAttribute(key, value);
            }
        });
    }

    /**
     * 高コントラストモードの検出
     * @returns {boolean} 高コントラストモードの場合true
     */
    isHighContrastMode() {
        return window.matchMedia('(prefers-contrast: high)').matches;
    }

    /**
     * アニメーション減らしモードの検出
     * @returns {boolean} アニメーション減らしモードの場合true
     */
    prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    /**
     * カラーテーマの検出
     * @returns {string} 'light' | 'dark' | 'no-preference'
     */
    getColorScheme() {
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
            return 'light';
        }
        return 'no-preference';
    }

    /**
     * フォントサイズの検出
     * @returns {string} 'small' | 'medium' | 'large'
     */
    getFontSize() {
        const fontSize = window.getComputedStyle(document.documentElement).fontSize;
        const size = parseFloat(fontSize);
        
        if (size < 14) return 'small';
        if (size > 18) return 'large';
        return 'medium';
    }

    /**
     * アクセシビリティ設定の適用
     */
    applyAccessibilitySettings() {
        const root = document.documentElement;
        
        // 高コントラストモード
        if (this.isHighContrastMode()) {
            root.classList.add('high-contrast');
        }
        
        // アニメーション減らし
        if (this.prefersReducedMotion()) {
            root.classList.add('reduced-motion');
        }
        
        // ダークモード
        if (this.getColorScheme() === 'dark') {
            root.classList.add('dark-theme');
        }
        
        // フォントサイズ
        const fontSize = this.getFontSize();
        root.classList.add(`font-size-${fontSize}`);
    }

    /**
     * キーボードショートカットの設定
     * @param {Object} shortcuts - ショートカット設定
     */
    setupKeyboardShortcuts(shortcuts) {
        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            const modifier = e.ctrlKey || e.metaKey ? 'ctrl' : '';
            const shortcut = `${modifier}+${key}`.replace(/^\+/, '');
            
            if (shortcuts[shortcut]) {
                e.preventDefault();
                shortcuts[shortcut]();
            }
        });
    }

    /**
     * フォームのアクセシビリティ向上
     * @param {HTMLElement} form - フォーム要素
     */
    enhanceFormAccessibility(form) {
        const inputs = form.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            // ラベルとの関連付け
            if (!input.id && !input.getAttribute('aria-label')) {
                const label = form.querySelector(`label[for="${input.name}"]`);
                if (label) {
                    input.id = input.name;
                }
            }
            
            // エラー状態の管理
            input.addEventListener('invalid', () => {
                this.setAriaAttributes(input, {
                    'aria-invalid': 'true',
                    'aria-describedby': `${input.id}-error`
                });
            });
            
            input.addEventListener('input', () => {
                if (input.validity.valid) {
                    this.setAriaAttributes(input, {
                        'aria-invalid': 'false'
                    });
                }
            });
        });
    }
}

/**
 * アクセシビリティユーティリティ関数
 */
export const AccessibilityUtils = {
    /**
     * スクリーンリーダー専用の要素を作成
     * @param {string} text - 表示するテキスト
     * @returns {HTMLElement} sr-only要素
     */
    createScreenReaderOnly(text) {
        const element = document.createElement('span');
        element.className = 'sr-only';
        element.textContent = text;
        return element;
    },

    /**
     * フォーカス可能な要素にスキップリンクを追加
     * @param {string} targetId - ターゲット要素のID
     * @param {string} text - スキップリンクのテキスト
     * @returns {HTMLElement} スキップリンク要素
     */
    createSkipLink(targetId, text = 'メインコンテンツへスキップ') {
        const link = document.createElement('a');
        link.href = `#${targetId}`;
        link.textContent = text;
        link.className = 'skip-link';
        return link;
    },

    /**
     * プログレッシブエンハンスメントの確認
     * @returns {boolean} JavaScriptが有効な場合true
     */
    isJavaScriptEnabled() {
        return typeof window !== 'undefined' && 'querySelector' in document;
    }
};
