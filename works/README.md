作品を置くとこ
↓置き方
```
/ (プロジェクトルート)
├── index.html              ...現在のギャラリーページ
├── index.css
├── index.tsx
├── Thumbnails/
│
└── works/                  ...新しく作成する作品格納用ディレクトリ
    │
    ├── kioku-no-danpen/    ...作品「記憶の断片」のディレクトリ
    │   ├── index.html      ...作品詳細の共通部分のHTML
    │   ├── style.css
    |   ├── app/            ...作品「記憶の断片」の本体ディレクトリ
    │   │   ├── app.js
    │   │   ├── index.html
    │   │   ├── style.css
    │   │   └── ... その他の画像やJSファイル
    │   └── ... その他の画像やJSファイル
    │
    ├── hikari-to-kage/     ...作品「光と影のダンス」のディレクトリ
    │   ├── index.html
    │   ├── app.js
    │   └── ...
    │
    └── ... 他の作品も同様に配置
```
