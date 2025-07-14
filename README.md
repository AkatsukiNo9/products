# AkatsukiNo9/products リポジトリ構造ガイド

このリポジトリは、AkatsukiNo9による作品・プロジェクト群を管理するためのものです。  
主なディレクトリ構造とその役割について説明します。

---

## 主要ディレクトリ

```
products/
├── works/
│   └── 2024/
│       └── kioku-no-danpen/
│           ├── index.html
│           ├── detail.js
│           ├── concept.pdf
│           └── app/
│               ├── index.html
│               ├── style.css
│               └── script.js
├── Thumbnails/
│   └── logo.png
│   └── ...（作品サムネイル画像など）
├── README.md
└── ...（その他管理ファイル）
```

---

### ディレクトリ詳細

- **works/**  
  作品・プロジェクトの本体を格納するディレクトリ。年度ごと（例：2024）にサブディレクトリを作成し、その下に各作品のディレクトリを配置します。

  - **2024/**  
    2024年度の作品をまとめるディレクトリ。

    - **kioku-no-danpen/**  
      「記憶の断片」作品のディレクトリ。  
      - `index.html` … 作品詳細ページ  
      - `detail.js` … 作品情報取得・表示用のJavaScript  
      - `concept.pdf` … 作品コンセプトのPDF  
      - **app/** … インタラクティブコンテンツ（パズルなど）の実装
        - `index.html` … アプリ本体のHTML
        - `style.css` … アプリのスタイル
        - `script.js` … アプリのロジック

- **Thumbnails/**  
  各作品やサイトのロゴ・サムネイル画像を格納。

- **README.md**  
  リポジトリの説明・構造ガイド。

---

## 備考

- 各年度ごとに `works/年度/作品名/` の構造で作品を追加してください。
- 静的なWebコンテンツやPDF、画像、JSなどを整理・管理しています。
- GitHub Pagesで公開する場合は、公開ディレクトリやパスに注意してください。

---
