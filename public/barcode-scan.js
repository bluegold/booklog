(function () {
  function init() {
    var btn = document.getElementById('barcode-scan-btn');
    var fileInput = document.getElementById('barcode-file-input');
    if (!btn || !fileInput) return;

    var scanner = createScanner();
    if (!scanner) return;

    btn.hidden = false;

    btn.addEventListener('click', function () {
      fileInput.click();
    });

    fileInput.addEventListener('change', async function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;

      try {
        var raw = normalizeIsbn(await scanner.detect(file));
        if (!raw) {
          showScanError('ISBN 形式ではありませんでした。手入力してください。');
          return;
        }

        var isbnInput = document.getElementById('isbn-input');
        if (isbnInput) {
          isbnInput.value = raw;
          submitIsbnForm(isbnInput);
        }
      } catch (_e) {
        showScanError('読み取りに失敗しました。手入力してください。');
      } finally {
        fileInput.value = '';
      }
    });
  }

  function createScanner() {
    var barcodeDetectorScanner = createBarcodeDetectorScanner();
    if (barcodeDetectorScanner) return barcodeDetectorScanner;

    return createZxingScanner();
  }

  function createBarcodeDetectorScanner() {
    if (!('BarcodeDetector' in window)) return null;

    try {
      var detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8'] });
      return {
        detect: async function (file) {
          var bitmap = await createImageBitmap(file);
          try {
            var results = await detector.detect(bitmap);
            if (!results || results.length === 0 || !results[0].rawValue) throw new Error('not found');
            return results[0].rawValue;
          } finally {
            bitmap.close();
          }
        },
      };
    } catch (_e) {
      return null;
    }
  }

  function createZxingScanner() {
    if (!window.ZXing) return null;

    try {
      var ZXing = window.ZXing;
      var hints = new Map();
      hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8]);
      var codeReader = new ZXing.BrowserMultiFormatReader(hints);
      return {
        detect: async function (file) {
          var imageUrl = URL.createObjectURL(file);
          try {
            var result = await codeReader.decodeFromImageUrl(imageUrl);
            return result.getText();
          } finally {
            URL.revokeObjectURL(imageUrl);
          }
        },
      };
    } catch (_e) {
      return null;
    }
  }

  function normalizeIsbn(text) {
    var normalized = String(text || '').replace(/[^0-9Xx]/g, '').toUpperCase();
    if (normalized.length === 13 && /^97[89][0-9]{10}$/.test(normalized)) return normalized;
    if (normalized.length === 10 && /^[0-9]{9}[0-9X]$/.test(normalized)) return normalized;
    return '';
  }

  function submitIsbnForm(isbnInput) {
    var form = isbnInput.closest('form');
    if (!form) {
      isbnInput.focus();
      return;
    }

    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit();
      return;
    }

    form.submit();
  }

  function showScanError(msg) {
    var el = document.getElementById('barcode-scan-error');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    setTimeout(function () {
      el.hidden = true;
    }, 4000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
