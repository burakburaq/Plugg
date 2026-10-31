import fontUrl from "../assets/fonts/BebasNeue-Regular.ttf?inline";
import appFontUrl from "../assets/fonts/BarlowCondensed-Light.ttf?inline";

let loading;
export function loadPluggFont() {
  if (!loading) {
    const loadFont = (name, url, descriptors) => {
      const bytes = Uint8Array.from(atob(url.split(",")[1]), character => character.charCodeAt(0));
      return new FontFace(name, bytes, descriptors).load().then(font => { document.fonts.add(font); });
    };
    loading = Promise.all([
      loadFont("Bebas Neue", fontUrl),
      loadFont("Barlow Condensed", appFontUrl, { weight: "300" })
    ])
      .catch(error => console.error("Font yüklenemedi:", error));
  }
  return loading;
}
