// 印刷用JavaScript
document.addEventListener('DOMContentLoaded', () => {
    const printButton = document.getElementById('print-button');
    
    // 印刷機能（バリデーション統合は app-script.js で実行）
    if (printButton) {
        // print-script.js では基本的な印刷機能のみ提供
        // バリデーションは app-script.js の setupEventListeners() で追加される
    }
    
    // 印刷前の処理
    window.addEventListener('beforeprint', () => {
        console.log('印刷プレビューが開かれました');
        
        // 印刷時のアクセシビリティ向上
        document.body.setAttribute('aria-busy', 'true');
        
        // 印刷用に不要な要素を一時的に非表示
        const elementsToHide = document.querySelectorAll('[data-print-hide]');
        elementsToHide.forEach(el => {
            el.style.display = 'none';
        });
    });
    
    // 印刷後の処理
    window.addEventListener('afterprint', () => {
        console.log('印刷プレビューが閉じられました');
        
        // アクセシビリティ属性をリセット
        document.body.removeAttribute('aria-busy');
        
        // 非表示にした要素を復元
        const hiddenElements = document.querySelectorAll('[data-print-hide]');
        hiddenElements.forEach(el => {
            el.style.display = '';
        });
        
        // 印刷完了の通知（グローバル関数が利用可能な場合）
        if (typeof showNotification === 'function') {
            showNotification('印刷処理が完了しました', 'success');
        }
    });
});