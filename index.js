/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// 作品データ
const works = [
  {
    year: 2025,
    author: "暁No.9",
    title: "インタラクティブシンセサイザー",
    Genre: "電子楽器",
    imageUrl: "works/2025/anogakki/thumbnail.png",
    appUrl: "works/2025/anogakki/"
  },
  {
    year: 2025,
    author: "暁No.9",
    title: "ピクセルアートにグリッドを引くツール",
    Genre: "ツール",
    imageUrl: "works/2025/Grid_Drawer/thumbnail.png",
    appUrl: "works/2025/Grid_Drawer/"
  },
  {
    year: 2025,
    author: "暁No.9",
    title: "あるAIの記録",
    Genre: "UIデザイン",
    imageUrl: "works/2025/Spectra_Communicator/thumbnail.png",
    appUrl: "works/2025/Spectra_Communicator/"
  },
	{
    year: "collabo",
    author: "蒼",
    title: "数独パズル",
    Genre: "パズル",
    imageUrl: "works/gakusei/sudoku/thumbnail.png",
    appUrl: "works/gakusei/sudoku/"
  },
  {
    year: "collabo",
    author: "R",
    title: "小さな勇者",
    Genre: "ARPG",
    imageUrl: "works/gakusei/little_brave/thumbnail.png",
    appUrl: "works/gakusei/little_brave/"
  },
];

document.addEventListener('DOMContentLoaded', () => {
  const years = [2025, "collabo"];

  /**
   * 内部IDから表示名を取得する関数
   * @param {string | number} yearValue 
   * @returns {string} 表示用の年度名
   */
  const getYearDisplayName = (yearValue) => {
    return yearValue === 'collabo' ? '協力作品' : yearValue.toString();
  };
  
  /**
   * URLのクエリパラメータから有効な年度を取得する関数
   * @returns {string | number | null} 年度、またはnull
   */
  const getYearFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const yearParam = params.get('year');
    
    if (yearParam === 'collabo') {
      return 'collabo';
    }
    
    // yearParamが数値に変換できるかチェックし、years配列に含まれるか確認
    const yearNum = parseInt(yearParam || '', 10);
    if (!isNaN(yearNum) && years.includes(yearNum)) {
      return yearNum;
    }
    
    return null;
  };

  // URLから年度を取得し、なければデフォルト値を設定
  let currentYear = getYearFromUrl() || 2025;

  const yearSelector = document.getElementById('year-selector');
  const selectedYearEl = document.getElementById('selected-year');
  const yearDropdown = document.getElementById('year-dropdown');
  const galleryGrid = document.getElementById('gallery-grid');

  const renderGallery = (year) => {
    if (!galleryGrid) return;
    galleryGrid.innerHTML = ''; // Clear existing items
    
    const filteredWorks = works.filter(work => work.year === year);
    
    if (filteredWorks.length === 0) {
        galleryGrid.innerHTML = `<p class="no-results">この年度の作品はありません。</p>`;
        return;
    }

    filteredWorks.forEach(work => {
      const gridItemLink = document.createElement('a');
      gridItemLink.className = 'grid-item-link';
      // If appUrl is not provided, prevent navigation.
      if (work.appUrl) {
        gridItemLink.href = work.appUrl;
      } else {
        gridItemLink.href = '#';
        gridItemLink.addEventListener('click', (e) => e.preventDefault());
        gridItemLink.style.cursor = 'default';
      }
      
      const gridItemHTML = `
        <div class="grid-item ${!work.appUrl ? 'no-link' : ''}">
          <div class="grid-item-image-wrapper">
            <img src="${work.imageUrl}" alt="${work.title}" loading="lazy">
          </div>
          <div class="grid-item-info">
            <h3 class="work-title">${work.title}</h3>
            <p class="work-genre">ジャンル：${work.Genre}</p>
            <p class="work-author">作者：${work.author}</p>
          </div>
        </div>
      `;
      gridItemLink.innerHTML = gridItemHTML;
      galleryGrid.appendChild(gridItemLink);
    });
  };

  const updateDropdown = () => {
    if (!yearDropdown) return;
    yearDropdown.innerHTML = '';
    years.forEach(year => {
      const option = document.createElement('div');
      option.className = 'year-option';
      option.textContent = getYearDisplayName(year); // Use display name
      option.setAttribute('data-year', year.toString());
      option.setAttribute('role', 'menuitem');
      if (year === currentYear) {
        option.classList.add('selected');
      }
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        currentYear = year;
        if (selectedYearEl) {
            selectedYearEl.textContent = getYearDisplayName(currentYear); // Use display name
        }
        // Update URL without reloading the page
        const newUrl = `${window.location.pathname}?year=${currentYear}`;
        window.history.pushState({path:newUrl}, '', newUrl);

        renderGallery(currentYear);
        toggleDropdown(false);
      });
      yearDropdown.appendChild(option);
    });
  };
  
  const toggleDropdown = (show) => {
    if (!yearDropdown || !yearSelector) return;

    const isVisible = yearDropdown.classList.contains('show');
    const newVisibility = show !== undefined ? show : !isVisible;
    
    yearDropdown.classList.toggle('show', newVisibility);
    yearSelector.setAttribute('aria-expanded', newVisibility.toString());
  };

  if (yearSelector) {
    if(selectedYearEl) {
      selectedYearEl.textContent = getYearDisplayName(currentYear); // Use display name for initial load
    }
    yearSelector.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown();
    });
  }

  document.addEventListener('click', () => {
    toggleDropdown(false);
  });

  // Initial render
  renderGallery(currentYear);
  updateDropdown();

  // Slideshow Logic
  const slides = document.querySelectorAll('.slide');
  const indicators = document.querySelectorAll('.indicator');
  if (slides.length > 0) {
    let currentSlide = 0;
    const slideInterval = 5000; // 5秒ごとに切り替え

    const showSlide = (index) => {
      slides.forEach((slide, i) => {
        slide.classList.toggle('active', i === index);
      });
      indicators.forEach((indicator, i) => {
        indicator.classList.toggle('active', i === index);
      });
    };

    const nextSlide = () => {
      currentSlide = (currentSlide + 1) % slides.length;
      showSlide(currentSlide);
    };

    let intervalId = setInterval(nextSlide, slideInterval);
    
    indicators.forEach(indicator => {
      indicator.addEventListener('click', () => {
        const slideTo = parseInt(indicator.getAttribute('data-slide-to') || '0');
        if (!isNaN(slideTo) && slideTo !== currentSlide) {
          currentSlide = slideTo;
          showSlide(currentSlide);
          clearInterval(intervalId);
          intervalId = setInterval(nextSlide, slideInterval);
        }
      });
    });
  }
});
