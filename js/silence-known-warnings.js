/* This page intentionally loads two independent Three.js builds: the
   global classic build (js/script.js particle canvases) and the copy
   bundled inside <model-viewer> (GLB logo rendering). Three.js prints
   "Multiple instances of Three.js being imported" whenever it detects
   a second copy, purely as a heads-up — the two builds run in fully
   separate contexts here and don't interact. The one real side effect
   this used to cause (model-viewer's built-in auto-rotate freezing)
   is already worked around in js/script.js by driving rotation
   manually via cameraOrbit. This filters only that one known-benign
   message so it doesn't bury other, real console warnings.
   Must load before the model-viewer and three.min.js script tags. */
(function () {
  var nativeWarn = console.warn;
  console.warn = function () {
    if (typeof arguments[0] === 'string' && arguments[0].indexOf('Multiple instances of Three.js') !== -1) return;
    nativeWarn.apply(console, arguments);
  };
})();
