const cv = require("opencv4nodejs");

/**
 * Perform a vertical (left-hand) margin crop on every uploaded file.
 * @param {Array<{originalname:string, buffer:Buffer}>} files – multer file objects
 * @returns {Object} results[filename] = { cropMat, marginX, marginSum }
 */
function marginCropImages(files) {
  const results = {};

  files.forEach((file) => {
    // Decode JPEG/PNG bytes → Mat
    const img = cv.imdecode(file.buffer);
    if (!img || img.empty) return; // unreadable → skip

    const h = img.rows;
    const w = img.cols;

    // --- pipeline (identical to your Python) ----------------------------- //
    const gray = img.cvtColor(cv.COLOR_BGR2GRAY);
    const blur = gray.gaussianBlur(new cv.Size(5, 5), 0);
    const sobel = blur.sobel(cv.CV_64F, 1, 0, 3);
    const absS = sobel.abs();
    const maxVal = absS.max();
    const scaled = absS
      .div(maxVal === 0 ? 1 : maxVal)
      .mul(255)
      .convertTo(cv.CV_8U);

    const { thresh: binary } = scaled.threshold(
      0,
      255,
      cv.THRESH_BINARY | cv.THRESH_OTSU
    );

    const kernelH = Math.max(5, Math.floor(h / 50));
    const kernel = cv.getStructuringElement(
      cv.MORPH_RECT,
      new cv.Size(3, kernelH)
    );
    const closed = binary.morphologyEx(kernel, cv.MORPH_CLOSE);

    // Left half only
    const left = closed.getRegion(new cv.Rect(0, 0, Math.floor(w / 2), h));
    const colSums = new Array(left.cols).fill(0);
    for (let x = 0; x < left.cols; x++) {
      let total = 0;
      for (let y = 0; y < left.rows; y++) total += left.atRaw(y, x);
      colSums[x] = total;
    }

    const marginX = colSums.indexOf(Math.max(...colSums));
    const marginSum = colSums[marginX];

    const cropMat = img.getRegion(new cv.Rect(0, 0, marginX, h));
    results[file.originalname] = { cropMat, marginX, marginSum };
  });

  return results;
}

module.exports = marginCropImages;
