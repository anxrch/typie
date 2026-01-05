# Typie Desktop

## System dependencies

- **Linux**: Install GTK/WebKit dependencies plus CJK fonts to render Korean/Japanese/Chinese menu labels correctly, for example:
  ```bash
  sudo apt-get update
  sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf fonts-noto-cjk
  ```
  The `fonts-noto-cjk` package (or an equivalent Noto Sans CJK font) ensures menu text renders without fallback issues.
- **macOS / Windows**: Use the platform’s default system fonts; no additional font installation is required.
