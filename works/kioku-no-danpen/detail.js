document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('../kioku-no-danpen.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        const workAuthor = document.getElementById('work-author');
        const workTitle = document.getElementById('work-title');
        const breadcrumbCurrent = document.querySelector('.breadcrumb-current');
        const pageTitle = document.querySelector('title');
        const conceptText = document.getElementById('concept-text');
        const commentText = document.getElementById('comment-text');
        const iframeTitle = document.getElementById('work-iframe');

        if (workAuthor) workAuthor.textContent = `作者：${data.author}`;
        if (workTitle) workTitle.textContent = data.title;
        if (breadcrumbCurrent) breadcrumbCurrent.textContent = data.title;
        if (pageTitle) pageTitle.textContent = `${data.title} - XXX大学 卒業・修了制作展`;
        if (conceptText) conceptText.textContent = data.concept;
        if (commentText) commentText.textContent = data.comment;
        if (iframeTitle) iframeTitle.title = `${data.title} - インタラクティブコンテンツ`;


    } catch (error) {
        console.error('作品情報の読み込みに失敗しました:', error);
        const mainContent = document.querySelector('.main-content');
        if(mainContent) {
            mainContent.innerHTML = '<p style="text-align: center; width: 100%;">作品情報の読み込みに失敗しました。</p>';
        }
    }
});
