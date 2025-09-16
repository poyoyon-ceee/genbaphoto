// 印刷用JavaScript
document.addEventListener('DOMContentLoaded', () => {
    const printButton = document.getElementById('print-button');
    
    // 印刷機能
    if (printButton) {
        printButton.addEventListener('click', () => {
            window.print();
        });
    }
    
    // 印刷前の処理（必要に応じて拡張）
    window.addEventListener('beforeprint', () => {
        console.log('印刷プレビューが開かれました');
        // 印刷前に必要な処理があればここに追加
    });
    
    // 印刷後の処理（必要に応じて拡張）
    window.addEventListener('afterprint', () => {
        console.log('印刷プレビューが閉じられました');
        // 印刷後に必要な処理があればここに追加
    });
});