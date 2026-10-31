# Kaynaklar ve üçüncü taraf bildirimleri

plugg kaynak kodu [MIT](LICENSE) lisanslıdır. Bağımlılıkların telif ve lisans
bildirimleri kendi sahiplerine aittir; plugg lisansı bunların yerine geçmez.
Kesin bağımlılık sürümleri ve geçişli bağımlılıklar `package-lock.json` içindedir.

## Paketlenen çalışma zamanı bağımlılıkları

| Bağımlılık | Sürüm | Lisans | Kaynak |
| --- | --- | --- | --- |
| React | 19.3.0 | MIT | [facebook/react](https://github.com/facebook/react) |
| React DOM | 19.3.0 | MIT | [facebook/react](https://github.com/facebook/react/tree/main/packages/react-dom) |
| Scheduler | 0.28.0 | MIT | [facebook/react](https://github.com/facebook/react/tree/main/packages/scheduler) |
| Dark Reader | 4.9.133 | MIT | [darkreader/darkreader](https://github.com/darkreader/darkreader) |
| Bebas Neue | Regular | SIL Open Font License 1.1 | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/bebasneue) |
| Barlow Condensed | Light | SIL Open Font License 1.1 | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/barlowcondensed) |

Derleme bu paketlerin tam lisans metinlerini kurulu bağımlılıklardan okuyarak
`LICENSES/` klasörüne ekler. Dark Reader lisansı ayrıca
`vendor/darkreader-LICENSE.txt` olarak korunur. Dark Reader motorunun taşıma
katmanı yerel kapsama alınır ve kapalı proxy kodunun MV3 CSP altında enjekte
edilmesi engellenir; özgün lisans ve telif bildirimleri korunur.
Bebas Neue lisansı `fonts/BebasNeue-OFL.txt` içinde dağıtılır.
Barlow Condensed lisansı `fonts/BarlowCondensed-OFL.txt` içinde dağıtılır.

## Geliştirme araçları

| Araç | Sürüm | Lisans | Kaynak |
| --- | --- | --- | --- |
| Vite | 8.3.1 | MIT | [vitejs/vite](https://github.com/vitejs/vite) |
| Vite React eklentisi | 6.1.1 | MIT | [vitejs/vite-plugin-react](https://github.com/vitejs/vite-plugin-react) |
| CRXJS Vite eklentisi | 3.0.0 | MIT | [crxjs/chrome-extension-tools](https://github.com/crxjs/chrome-extension-tools) |

Bu araçlar derleme/geliştirme içindir. Onların geçişli bağımlılıklarının lisans
metinleri, `npm ci` sonrasında ilgili `node_modules` paketlerinde bulunur.
Bağımlılık güncellenirken bu tablo da güncellenmelidir.

## Görseller

- `assets/icon-16x.png`, `icon-32x.png`, `icon-48x.png`, `icon-64x.png` ve
  `icon-128x.png`: proje sahibi tarafından sağlanan plugg ikonları.
- `assets/newtab-1.png`: proje sahibi tarafından sağlanan yeni sekme arka planı.
  Harici özgün kaynak/üretici ve ayrı bir görsel lisansı bildirilmemiştir.
  Kaynak koduna verilen MIT izni, bu görselin üçüncü taraf haklarına ilişkin
  bir doğrulama değildir. [Görsel kaynak notu](assets/newtab-background.md).
- `docs/screenshots/`: geliştirme sırasında örnek verilerle alınan uygulama
  ekran görüntüleri. Hava durumu ve görevler gibi örnek içerikler canlı kullanıcı
  verisi veya servis doğrulaması olarak değerlendirilmemelidir.

## Harici servisler

- İsteğe bağlı hava durumu bileşeni [Open-Meteo tahmin](https://open-meteo.com/en/docs)
  ve [şehir arama](https://open-meteo.com/en/docs/geocoding-api) servislerini
  kullanır. Veriler [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
  kapsamındadır; ücretsiz API ticari olmayan kullanım içindir. Servis erişimi,
  kod lisansından ayrı olarak sağlayıcının
  [kullanım koşullarına](https://open-meteo.com/en/terms) tabidir.
- Yeni sekmedeki arama, kullanıcı gönderdiğinde Google'a yönlenir. Site
  kısayollarındaki hizmet adları/markalar kendi sahiplerine aittir; bağlantı
  verilmesi ortaklık veya destek anlamına gelmez.
