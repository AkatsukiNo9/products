作品を置くとこ
↓置き方
```
products/
├── works/
│   └── 2025/
│       └── Grid_Drawer/
│           ├── concept.pdf (コンセプトや企画書)
│           ├── detail.js
│           ├── index.html
|           ├── style.css 
|           ├── summary.json (作品情報)
|           ├── thumbnail.png (作品のサムネイル画像)
│           └── app/
│               ├── index.css
│               ├── index.html
│               └── index.js
├── Thumbnails/
│   └── logo.png (ロゴ)
│   └── slideshow_1.png（スライドショー画像１～５など共通で表示するもの）
├── README.md
└── ...（その他管理ファイル）
```

---

### ディレクトリ詳細

- **works/**  
  作品・プロジェクトの本体を格納するディレクトリ。年度ごと（例：2025）にサブディレクトリを作成し、その下に各作品のディレクトリを配置します。

  - **2025/**  
    2025年度の作品をまとめるディレクトリ。

    - **Grid_Drawer/**  
      「ピクセルアートにグリッドを引くツール」作品のディレクトリ。  
      - `index.html` … 作品詳細ページ  
      - `detail.js` … 作品情報取得・表示用のJavaScript  
      - `concept.pdf` … 作品コンセプトのPDF  
      - **app/** … インタラクティブコンテンツ（パズルなど）の実装
        - `index.css` … アプリのスタイル
        - `index.html` … アプリ本体のHTML
        - `index.js` … アプリのロジック

- **Thumbnails/**  
  サイトのロゴ・スライドショー画像を格納。

- **README.md**  
  リポジトリの説明・構造ガイド。

---

## 備考

- 各年度ごとに `works/年度/作品名/` の構造で作品を追加してください。
- 静的なWebコンテンツやPDF、画像、JSなどを整理・管理しています。
- GitHub Pagesで公開する場合は、公開ディレクトリやパスに注意してください。
