/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// 仮の作品データ
const works = [
  {
    year: 2024,
    author: "高橋 次郎",
    title: "記憶の断片",
    Genre: "彫刻学科",
    imageUrl: "Thumbnails/sample_4.png",
    appUrl: "works/kioku-no-danpen/"
  },
  {
    year: 2024,
    author: "伊藤 三郎",
    title: "光と影のダンス",
    Genre: "デザイン情報学科",
    imageUrl: "Thumbnails/sample_5.png"
  },
  {
    year: 2024,
    author: "渡辺 久美子",
    title: "鉄の心臓",
    Genre: "彫刻学科",
    imageUrl: "Thumbnails/sample_6.png"
  },
  {
    year: 2023,
    author: "山本 良子",
    title: "水中のささやき",
    Genre: "油絵学科",
    imageUrl: "Thumbnails/sample_7.png"
  },
  {
    year: 2023,
    author: "中村 健太",
    title: "星屑のポートレート",
    Genre: "視覚伝達デザイン学科",
    imageUrl: "Thumbnails/sample_8.png"
  },
  {
    year: 2023,
    author: "小林 愛",
    title: "都市の鼓動",
    Genre: "デザイン情報学科",
    imageUrl: "Thumbnails/sample_9.png"
  },
  {
    year: 2022,
    author: "加藤 誠",
    title: "風の彫刻",
    Genre: "彫刻学科",
    imageUrl: "Thumbnails/sample_10.png"
  },
  {
    year: 2022,
    author: "吉田 沙羅",
    title: "色の交響曲",
    Genre: "油絵学科",
    imageUrl: "Thumbnails/sample_11.png"
  },
  {
    year: 2022,
    author: "山田 大輔",
    title: "サイバーパンク・ナイト",
    Genre: "視覚伝達デザイン学科",
    imageUrl: "Thumbnails/sample_12.png"
  },
  {
    year: 2021,
    author: "斎藤 一",
    title: "時の流れ",
    Genre: "油絵学科",
    imageUrl: "Thumbnails/sample_13.png"
  },
  {
    year: 2020,
    author: "藤田 五郎",
    title: "黎明",
    Genre: "デザイン情報学科",
    imageUrl: "Thumbnails/sample_14.png"
  },
  {
    year: 2019,
    author: "松本 恵",
    title: "再生",
    Genre: "彫刻学科",
    imageUrl: "Thumbnails/sample_15.png"
  },
];

document.addEventListener('DOMContentLoaded', () => {
  const years = [2024, 2023, 2022, 2021, 2020, 2019];
  
  // Check for year in URL query parameters
  const params = new URLSearchParams(window.location.search);
  const yearFromUrl = parseInt(params.get('year') || '', 10);
  let currentYear = years.includes(yearFromUrl) ? yearFromUrl : 2024;

  const yearSelector = document.getElementById('year-selector');
  const selectedYearEl = document.getElementById('selected-year');
  const yearDropdown = document.getElementById('year-dropdown');
  const galleryGrid = document.getElementById('gallery-grid');


  const renderGallery = (year: number) => {
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
      option.textContent = year.toString();
      option.setAttribute('data-year', year.toString());
      option.setAttribute('role', 'menuitem');
      if (year === currentYear) {
        option.classList.add('selected');
      }
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        currentYear = year;
        if (selectedYearEl) {
            selectedYearEl.textContent = year.toString();
        }
        // Update URL without reloading the page
        const newUrl = `${window.location.pathname}?year=${currentYear}`;
        window.history.pushState({path:newUrl}, '', newUrl);

        renderGallery(currentYear);
        updateDropdown(); // Re-render to update selected state
        toggleDropdown(false);
      });
      yearDropdown.appendChild(option);
    });
  };
  
  const toggleDropdown = (show?: boolean) => {
    if (!yearDropdown || !yearSelector) return;

    const isVisible = yearDropdown.classList.contains('show');
    const newVisibility = show !== undefined ? show : !isVisible;
    
    yearDropdown.classList.toggle('show', newVisibility);
    yearSelector.setAttribute('aria-expanded', newVisibility.toString());
  };

  if (yearSelector) {
    if(selectedYearEl) {
      selectedYearEl.textContent = currentYear.toString();
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

    const showSlide = (index: number) => {
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