# Ayrıntılı kullanım ve geliştirme

Modül yapısıyla birçok yardımcı özellik içerir. Türkçe, koyu temalı, kompakt araçlar: eklenti yönetimi, QR tasarımı, ses, font, renk, çizim, yeni sekme, kısayol, tam sayfa PNG, koyu mod, sekme gruplama, sayfa editörü ve video ayarları. Modül kontrolleri popup içinde, yeni sekme düzeni yeni sekmede açılır. React, Vite ve CRXJS ile geliştirilir. Chrome 116+ gereklidir.

## Component yapısı

`components/popup/App.jsx` modül seçimini yönetir. Ana ekranda `ExtensionMenu` ve içindeki `ExtensionMenuTile` kutuları gösterilir. Bir modül açıldığında seçilen modül ve bağımsız `PageHeader` render edilir. Header altta sabittir; 600 px sınırında yalnızca modül içeriği kaydırılır.

İlk açılışta Extension Manager ve Volume Booster aktiftir; diğer modüller pasiftir. Sağ üstteki çark düzenleme modunu açar ve pasif grubu aşağıda gösterir. Modülleri gruplar arasında sürükleyerek etkinleştirip kapatabilir, aynı grupta sürükleyerek sıralayabilirsin. Her bırakma işlemi otomatik kaydedilir; ayrı kaydet butonu yoktur. Seçimler sonraki açılışlarda korunur. Yeni modüller mevcut sıralamanı bozmadan pasif gruba eklenir.

Pasife alınan Volume Booster bütün sekmelerdeki ses işlemesini durdurur ve ses belgesini kapatır. Yazı Tipi Bulucu sayfalardaki katman ve dinleyicilerini kaldırır. Pasif modüllerin başlatılması arka planda da engellenir. Son 10 dakikada açılmış aktif modüllerin kodları popup açılınca önceden yüklenir. Ana menüde aktif bir kart üzerinde fare 200 ms kalırsa kodu hazırlanır; erken ayrılınca bekleme iptal olur. Ön yükleme component oluşturmaz veya modülü çalıştırmaz. Açılma zamanları `storage.session` içinde tutulur ve tarayıcı yeniden başladığında temizlenir.

- Ortak componentler: `components/Button.jsx`, `Toggle.jsx`, `Slider.jsx`, `PageHeader.jsx`, `ExtensionMenu.jsx`, `ExtensionMenuTile.jsx`.
- Modüller: `components/modules/` altında her özelliğin kendi klasöründe bulunur. Yeni sekme sayfası ve bileşenleri `components/modules/newtab/` içindedir.

`ExtensionMenuTile`, `variant` özelliğiyle `icon`, `picture`, `icon-tiny` veya `picture-tiny` kullanır. Varsayılan `icon` varyantıdır. Resimli varyantlara PNG yolu `picture` özelliğiyle verilir; resim kartı doldurur ve taşan bölümü kırpılır. `tiny` varyantları 2:1 oranındadır.

Settings ekranından `dull` ve `win8` temaları seçilebilir. Her temanın `components/popup/styles.css` içindeki `--dull-*` veya `--win8-*` değişkenleri bağımsızdır. Kart görseli politikası `components/menuThemes.js` içindedir: dull ikon kullanır; win8, kartın `picture` değeri varsa görseli, yoksa veya görsel yüklenemezse ikonu gösterir. Eski `theme-1` ve `theme-2` seçimleri yeni adlara taşınır.
- Volume Booster, Yazı Tipi Bulucu, Sayfaya Çizim veya Sayfa Editörü işlem yapıyorsa menü kartının sağ üstünde beyaz bir nokta görünür. Koyu Mod açıkken de gösterge görünür. Salt görüntülenen çizim göstergeyi açmaz. Gösterge çalışma olaylarıyla güncellenir; sürekli sorgulama yapılmaz.
- Chrome ses motoru: `background.js` ve `components/modules/volume-booster/` içindeki offscreen ve ses ayar dosyaları.
- Sayfaya enjekte edilen font inceleme: `components/modules/font-finder/font-inspector.js`.

## Geliştirme ve otomatik güncelleme

Node.js 22.12+ veya 24+ gereklidir.

```sh
npm ci
npm run dev
```

1. Chrome'da `chrome://extensions` sayfasını aç ve **Geliştirici modu**nu etkinleştir.
2. **Paketlenmemiş öğe yükle** ile bu projenin **dist-chrome.dev** klasörünü seç. Kaynak klasörü yerine bu klasörü kullan.
3. Eklentiyi araç çubuğuna sabitle ve popup'ı aç.
4. Geliştirme boyunca `npm run dev` açık kalsın. Kaydedilen arayüz değişiklikleri CRXJS üzerinden otomatik yansır.

Klasörü bir kez seçmek yeterlidir. Geliştirme sunucusu kapatılırsa yeniden `npm run dev` çalıştır. Manifest veya izin değişikliklerinden sonra gerekirse eklenti kartındaki **Yeniden yükle**ye bas.

## Normal kullanım için derleme

```sh
npm run build
```

Chrome'a **dist-chrome** klasörünü yükle. Bu sürüm geliştirme sunucusuna ihtiyaç duymaz. Yeni bir derlemeden sonra aynı eklenti kartından **Yeniden yükle**ye bas; klasörü tekrar seçmen gerekmez. Geliştirme ve normal kullanım sürümlerini aynı anda etkinleştirme. Firefox çıktısı **dist-firefox**, Chrome hot reload çıktısı **dist-chrome.dev** klasörüdür.

## Kullanım

İkona basıp menüden **Extension Manager**ı seç. Her şey popup içinde açılır. Eklentileri açıp kapatabilir; **Aktif**, **Pasif** veya **Alfabetik** sıralayabilirsin. Varsayılan sıralama Aktif'tir; değiştirdiğin seçim kalıcı olarak saklanır. Aktif ve Pasif seçenekleri ilgili grubu önce gösterir; hiçbir eklenti gizlenmez. Popup içerik kadar büyür, 600 px sınırında liste kaydırılır.

QR Oluşturucu şimdilik tasarım ekranıdır. Metin/bağlantı, boyut, renk ve hata düzeltme seçenekleri vardır; encoder, QR üretimi ve indirme henüz yoktur.

Video Araçları varsayılan pasiftir. Çarktan aktifleştir, video sayfasında modülü açıp **Video araçlarını aç** düğmesine bas. En büyük görünür video seçilir. Üst ortadaki **ZOOM** normal görünüm ile yakınlaştırma arasında geçiş yapar; sağdaki çark iki sayfalı menüyü açar. Menü açılınca küçük kontrolün konumu değişmez. Fare hareketiyle görünür olur; menü açıkken gizlenmez. En Boy sayfasında ekranı doldurma, 1.00–4.00× yakınlaştırma, yatay/dikey germe ve konum; Görüntü sayfasında parlaklık, kontrast, doygunluk ve keskinlik vardır. Sıfırla yalnızca açık sayfanın ayarlarını sıfırlar. Akıcılık ve ara kare üretimi bu sürümde bulunmaz.

İşlemler video elementine uygulanır; oynatıcıya ait ayrı altyazı ve kontrol elementleri değiştirilmez. Videonun içine gömülü yazılar görüntüyle birlikte büyür. Ekranı doldurma video ve oynatıcı geometrisini kullanır; görüntünün içine kodlanmış siyah bantlar için manuel yakınlaştırma gerekir. Dikey/yatay germe doğrusal çalışır. Görüntü filtreleri piksel okumadan CSS/SVG ile uygulanır; video indirilmez veya yeniden kodlanmaz. Keskinlik için kullanılan SVG filtresinin maliyeti çözünürlük ve GPU'ya göre değişir.

Menüdeki **Tam ekran**, oynatıcı kapsayıcısını açar; video üstü kontroller görünür kalır. Tarayıcının doğrudan video elementini açtığı yerleşik tam ekranda HTML katmanı etkileşimli gösterilemediğinden araçlar ve efektler geçici olarak gizlenir; çıkınca ayarlar geri uygulanır. Standart video elementinin kendi kontrol çubuğu ve yerleşik altyazıları video ile birlikte dönüşebilir; ayrı HTML oynatıcı kontrolleri bu durumdan etkilenmez.

Popup kapandıktan sonra araçlar bu sekmede açık kalır. Kapat veya modülü pasife al, stiller geri yüklenir; katman, SVG filtreleri ve dinleyiciler kaldırılır. Sayfa yenilenince veya URL değişince araçlar kapanır. **Bu site için hatırla** isteğe bağlıdır; ayarlar origin bazında yerel hafızada tutulur ve sonraki manuel açılışta yüklenir. Kendiliğinden site kodu yükleme veya arka planda kare işleme yoktur. Ana belgedeki standart HTML video elementleri hedeflenir; ayrı iframe ve kapalı shadow DOM oynatıcıları bu ilk sürümün dışında kalır.

Firefox için `npm run build:firefox` çalıştır; çıktı **dist-firefox** klasörüdür. `about:debugging#/runtime/this-firefox` → Geçici eklenti yükle ile bu klasördeki manifest.json dosyasını seç. Bu paket Firefox'un modül tabanlı arka plan scriptini kullanır; Chrome'a özgü offscreen/tabCapture izinlerini içermez. Video araçlarının ortak DOM/CSS/SVG uygulaması iki tarayıcı içindir; Volume Booster ve debugger tabanlı tam sayfa görüntüsü gibi mevcut Chrome'a özgü modüller bu Firefox paketinde desteklenmez. [Firefox arka plan scriptleri](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background).

Volume Booster aktif sekmenin sesini 0.0–6.0 aralığında işler. 1.0 normal seviyedir. Altı bantlı EQ ve Düz, Bas, Vokal, Rock, Elektronik presetleri vardır. Anahtarla etkinleştirilir; kapatıldığında normal sekme sesi geri gelir. Ayarlar sekme başına uygulanır, popup kapandıktan sonra da çalışır. Medya akışı kaydedilmez ve dışarı gönderilmez. Yüksek kazanç veya EQ değerleri kaynak sese bağlı olarak bozulma oluşturabilir.

Yazı Tipi Bulucu modül ekranına girince otomatik açılır. Bu ekran açıkken sayfadaki yazıların üzerine geldiğinde CSS font ailesi, boyutu ve kalınlığı imleç yanında görünür. Menüye dönünce veya popup kapanınca bağlantı kesilir ve font katmanı ile dinleyicileri kaldırılır. Esc ile de kapatılabilir. Chrome'un dahili sayfalarında, Web Mağazası'nda ve ana sayfadan ayrı iframe belgelerinde çalışmaz. Font ailesi CSS'in tanımladığı font/fallback listesidir.

Renk Seçici açıldığında sayfanın görüntüsü üzerinde seçim başlar. İmlecin yanındaki büyüteç ve HEX kodu ile piksel seçilir; son renk saklanır. Esc seçimi iptal eder. Sayfa kaydırıldığında veya yeniden boyutlandırıldığında görüntü yenilenir.

Klavye Kısayolları varsayılan pasiftir; çarktan aktif gruba taşı. `Ctrl+Q` açık sekmeler arasında son kullandığın iki sekmeye sırayla döner (2 → 3 → Ctrl+Q → 2 → Ctrl+Q → 3). Her pencerenin geçmişi ayrıdır. Sekme kimlikleri `storage.session` içinde tutulur; worker uyuyunca korunur, tarayıcı yeniden başladığında sıfırlanır. Pasifken sekme takibi ve kısayol işlemleri durur; geçmiş temizlenir, özel kısayollar ve koşulları korunur.

Hazır ve özel kısayolların her birinde Koşul seçilebilir: **Her zaman çalışsın**, **Metin alanı aktifken çalışmasın** veya **Sadece metin alanı aktifken çalışsın**. Metin alanının aktif olması, YouTube arama kutusu gibi bir inputun odakta olmasıdır; henüz yazı yazılması gerekmez. Textarea, düzenlenebilir metin, shadow DOM ve erişilebilir iframe içindeki alanlar da kapsanır. Son seçenek yalnızca böyle bir alana odaklanıldığında çalışır. Odak durumu doğrulanamayan iframe veya Chrome'un adres çubuğu iki metin koşulunu da sağlamaz. Koşul anında yerel hafızaya kaydedilir. Yeni özel kısayollarda metin alanında engelleme açık gelir; önceki seçimler korunur. Eski kayıtların varsayılan davranışı korunur: ok tuşu içeren atamalarda koruma açık, Ctrl+Q'da kapalıdır; her biri elle değiştirilebilir. Kontrol yalnızca kısayola basınca tek seferlik yapılır; sürekli sayfa dinleyicisi veya ek izin yoktur. Bu koşul eklentinin işlemini engeller; Chrome'daki tuş atamasını kaldırmaz ve tuşun sayfaya iletilmesini değiştirmez. [Chrome Commands API](https://developer.chrome.com/docs/extensions/reference/api/commands), [Scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting).

Satırdaki tuş etiketine tıklamak veya alttaki **Tuşları Chrome'da ayarla** düğmesi Chrome'un kısayol ekranını açar. Atamayı orada düzenleyebilirsin; popup yeniden açılınca güncel tuşlar okunur. Alt bölümde yalnızca bu düğme bulunur.

Kısayollar ikon, ad, kısa açıklama ve tuş etiketi olan kartlarda gösterilir. Sağdaki ayar düğmesi koşul seçimini açar; özel kısayollar aynı bölümden silinir. Ekleme formunda İşlem ve Kısayol yan yanadır. Formdaki Kısayol alanından Chrome'a geçerken ad, işlem, bağlantı ve koşul geçici oturum hafızasında korunur; popup yeniden açıldığında geri gelir, ekleme tamamlanınca temizlenir.

`Ctrl+Sol Ok` ve `Ctrl+Sağ Ok` sekme çubuğundaki sıralamaya göre sola/sağa geçer. Çubuğun uçlarında yerinde kalır. Ad ve işlem seçerek en fazla 8 özel kısayol eklenebilir: önceki sekmeye dönüş, sol/sağ sekme, yeni sekme, sekmeyi çoğaltma veya HTTP/HTTPS bağlantısı açma. Ekleme/silme anında yerel hafızaya kaydedilir. Tuşları Chrome'da ayarla düğmesi `chrome://extensions/shortcuts` ekranını açar; buradaki Özel kısayol 1–8 numaraları popup satırlarıyla eşleşir. Chrome komutları manifestte sabittir; tuş atamasını koddan oluşturma/değiştirme API'si yoktur. Bu nedenle silinen veya pasif komutların Chrome tuş ataması otomatik kaldırılmaz, sadece işlem yapmaları engellenir. Başka bir eklentiyle çakışan tuş Atanmamış gösterilir; Chrome ekranından başka tuş seçilebilir. Yeni manifest için eklentiyi bir kez yeniden yükle. [Chrome Commands API](https://developer.chrome.com/docs/extensions/reference/api/commands).

Sayfa Fotoğrafı tek düğmeyle aktif HTTP/HTTPS sayfasının tüm belge alanını tek PNG olarak indirir. İlk kullanımda isteğe bağlı `debugger` ve `downloads` izinleri alınır. Chrome görüntü alınırken hata ayıklama bildirimi gösterir; bağlantı hata olsa bile kapatılır. İndirme worker'dan başlatılır, popup kapansa da tamamlanır. Sayfa kaydırılmaz veya yeniden boyutlandırılmaz. Henüz yüklenmemiş sonsuz kaydırma içeriğini yüklemez; ayrı iç kaydırma alanlarını açmaz. [Chrome Debugger API](https://developer.chrome.com/docs/extensions/reference/api/debugger).

Koyu Mod, [Dark Reader 4.9.133 API](https://github.com/darkreader/darkreader#using-dark-reader-on-a-website) motorunu yerel olarak paketler (MIT lisansı derlemeye eklenir). Açarken bütün HTTP/HTTPS sitelerine isteğe bağlı erişim istenir. Açık sayfalara ve sonraki sayfalara uygulanır; parlaklık, kontrast, sıcaklık, arka plan ve yazı rengi özelleştirilebilir. Aktif site hariç tutulabilir. Ayarlar anında saklanır; popup kapandıktan sonra da çalışır. Motor yalnızca açıkken sayfalara yüklenir; pasife alınca stil/izleyiciler kaldırılır ve otomatik script kaydı silinir. Chrome dahili sayfalarına ve Web Mağazası'na uygulanamaz. Kaynak CSS/resimler gerekli olduğunda worker üzerinden çerezsiz yüklenir; analiz hizmetine veri gönderilmez. API'nin `chrome.runtime` uyarlaması motorun kendi kapsamına alınır; MV3 CSP için kapalı proxy'ler enjekte edilmez.

Sekme Grupları mevcut pencerede aynı hostname'e ait en az iki sekmeyi Chrome gruplarına alır. `www.` aynı domain kabul edilir; diğer alt domainler ayrı tutulur. Grup adı domaindir, uygun mevcut grup tekrar kullanılır. Sabitlenmiş ve dahili sekmeler korunur. İlk tıklamada isteğe bağlı `tabs` ve `tabGroups` izni alınır; otomatik arka plan gruplaması yoktur. [Chrome Tab Groups API](https://developer.chrome.com/docs/extensions/reference/api/tabGroups).

Sayfa Editörü manuel açılır. Metne sol tıklayıp düzenleyebilirsin; açıkken link gezinmesi ve sayfa tıklama işlemleri engellenir. Popup kapansa da devam eder. Sayfadaki Bitir veya Esc dinleyicileri/araç çubuğunu kaldırır ve düzenlenebilirlik niteliklerini eski haline getirir; linkler yeniden çalışır. Değişiklikler yalnızca bu sekmenin DOM'undadır; yenileyince silinir. Modül pasife alınca bütün sekmelerde kapatılır. Sitelerin dinamik render işlemleri düzenlenen metni tekrar değiştirebilir.

Sayfaya Çizim manuel başlatılır ve popup kapandıktan sonra sayfadaki araç çubuğuyla devam eder. Kalem, silgi, renk, kalınlık, geri al ve temizle araçları vardır. Bitir/Esc salt görüntülemeye geçer; ✕ katmanı kaldırır. Çizgi tamamlanınca tam URL'ye (sorgu ve fragment dahil) otomatik kaydedilir. Modülü yeniden açıp çizim modunu başlatınca kayıt yüklenir.

Otomatik geri yükleme varsayılan kapalıdır. Açarken Chrome isteğe bağlı HTTP/HTTPS site erişimi ister. Yalnızca kayıtlı URL'lerde çizimler salt görüntüleme olarak geri yüklenir; çizim yapmak için Düzenle'ye basılır. Otomatik yükleme kapalıyken sayfalara kendiliğinden çizim kodu eklenmez. Modül pasife alınınca bütün sekmelerde katman ve dinleyicileri kaldırılır, otomatik yükleme engellenir; kayıtlar korunur.

Özel kaydet çizimi adıyla, URL'den bağımsız bir kopya olarak eklenti hafızasında saklar. Kayıt başka bir sayfaya yüklenebilir veya silinebilir. URL kaydı ve özel kayıt birbirinden bağımsızdır. PNG indir yalnızca çizimleri şeffaf arka planla dışa aktarır; büyük sayfalarda en uzun kenar 4096 px olacak şekilde oran korunur. Kayıtlar sayfa koordinatlarını kullanır; sayfanın yerleşimi değişirse çizimlerin içerikle hizası değişebilir.

Yeni Sekme varsayılan pasiftir. Çarktan aktifleştirince Chrome'un yeni sekmeleri özelleştirilmiş ekranı açar. Modül içindeki Yeni sekmeyi aç düğmesi de bu ekranı açar. Google aramasında Site ve Dosya türü alanları sorguya `site:` ve `filetype:` olarak eklenir; arama kutusuna operatörler doğrudan da yazılabilir. Arama metni saklanmaz; filtreler ve yerleşim yerel hafızada tutulur. Arama yapılana kadar sorgu dışarı gönderilmez.

Arama filtresi düğmesi cam görünümlü bir panel açar. Site kısayolları, en fazla 6 özel alan adı, dosya türü ve zaman seçenekleri vardır. Uygula seçimi kaydeder ve paneli kapatır; arama kutusunda Enter aramayı başlatır. Temizle filtreleri sıfırlar, özel site listesini korur; sıfırlamayı da Uygula ile kaydet. Dışarı tıklamak veya Esc kaydedilmemiş seçimleri bırakır. Gmail/Notion gibi seçenekler sitenin Google'da indekslenen sayfalarını arar. Görsel seçimi görsel dosya uzantılarını kapsar. Bu hafta pazartesiden, Bu ay ayın başından, Bu yıl yılın başından itibaren sonuçları hedefler; Son 24 saat Google'ın son gün filtresini kullanır. [Google arama operatörleri](https://support.google.com/websearch/answer/2466433?hl=en).

Yeni sekme gün batımı arka planı, büyük saat, selamlama, yuvarlak arama çubuğu ve site kısayollarıyla açılır. Sağ alttaki çarktan Saat, Arama, Kısayollar, Yapılacaklar, Hızlı notlar, Hava durumu, Odak süresi ve Gelişmiş filtreler bileşenleri açılabilir veya kaldırılabilir. Site/dosya filtreleri ayrıca arama çubuğundaki filtre ikonundan açılır. Eski filtre değerleri korunur. Düzenleme açıkken başlıklarından sürükleyerek taşınır, sağ alt köşelerinden boyutlandırılır. Kontrol odaktayken ok tuşlarıyla da taşınabilir/boyutlandırılabilir; Shift adımı büyütür. Geometri yalnızca bırakınca kaydedilir. Küçük pencerelerde öğeler görünür alana sığdırılır. Ayrı kaydet düğmesi yoktur.

Yapılacaklar ve Hızlı notlar, yuvarlak işaret kutuları olan yarı saydam kartlardır. Bugün kartına ok düğmesiyle görev eklenir; isteğe bağlı saat gösterilebilir, hatırlatma bildirimi oluşturulmaz. Hızlı notlar + düğmesinden eklenir ve görevlerden ayrı saklanır. İki listede de işaretleme/silme vardır; kayıtlar ile site kısayolları yerel hafızada kalır. Hava durumu sağ üstte küçük şehir/sıcaklık kartı, Odak süresi kısayolların altında ince bir kapsül olarak görünür. Ayrıntılar ve kontroller tıklanınca açılır; dışarı tıklamak veya Esc paneli kapatır. Eski büyük kart yerleşimi yeni kompakt düzene taşınır; kayıtlar ve seçilen bileşenler korunur. Odak süresi 5, 15, 25 veya 50 dakika seçilebilir, duraklatılabilir ve sıfırlanabilir. Bitiş zamanı kaydedildiğinden sekme kapanıp açıldığında kalan süre doğru hesaplanır; arka planda sürekli çalışan timer veya bildirim servisi yoktur. Bileşen kaldırılınca kayıtları korunur.

Hava durumu manuel şehir seçimiyle çalışır. İlk şehir aramasında yalnızca Open-Meteo servislerine isteğe bağlı erişim istenir. Cihaz konumu alınmaz; girilen şehir ve seçilen koordinatlar Open-Meteo servisine gönderilir. Veri 30 dakika önbellekte tutulur, yalnızca bileşen açıkken gerektiğinde alınır. Bileşen kaldırılınca istekler iptal edilir. [Open-Meteo tahmin API](https://open-meteo.com/en/docs), [şehir arama API](https://open-meteo.com/en/docs/geocoding-api).

Arka plan olarak kullanıcı tarafından sağlanan `assets/newtab-1.png` paketle birlikte yüklenir; uzak görsel servisine bağlantı yoktur. İkonlar `assets/icon-16x.png`, `icon-32x.png`, `icon-48x.png`, `icon-64x.png` ve `icon-128x.png` dosyalarından alınır; üç çıktı paketi de aynı kaynakları kullanır. [Arka plan kaynak notu](../assets/newtab-background.md).

Chrome yeni sekme değiştirmesini manifestte sabit tanımlar. Bu nedenle `components/modules/newtab/newtab.js` giriş kodu modülün durumunu kontrol eder; pasifken React ve düzenleyiciyi yüklemeden Chrome'un kendi `chrome://new-tab-page/` ekranına yönlendirir. Açık özelleştirilmiş sekmeler de modül pasife alındığında native ekrana döner. Başka bir eklentinin yeni sekme ekranını geri yüklemez. Manifest değiştiği için eklentiyi Chrome'da bir kez yeniden yükle.

İzinler: `storage` modül düzeni, yeni sekme yerleşimi, renk ve çizimleri saklamak; `management` eklenti yönetimi; `activeTab` ve `scripting` seçilen sekmede font inceleme ve çizim; `tabCapture` ve `offscreen` popup kapalıyken de sekme sesini işlemek için kullanılır. Manuel kullanım kalıcı site erişimi istemez; otomatik çizim geri yüklemesi için isteğe bağlı site erişimi alınır. Görevler, çizimler, yerleşim ve odak kayıtları yerelde kalır; hava durumu için yalnızca seçilen şehir/koordinatlar Open-Meteo servisine gönderilir; geliştirme sürümü otomatik güncelleme için yerel Vite sunucusuna bağlanır. Yeni manifestin tanınması için mevcut eklentiyi bir kez yeniden yükle.

- [CRXJS belgeleri](https://crxjs.dev/guide/introduction/)
- [Chrome management API](https://developer.chrome.com/docs/extensions/reference/api/management)
