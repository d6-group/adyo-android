(function() {
    var MAX_UPSCALE = 2.0;

    var style = document.createElement('style');
    style.textContent =
        'html,body{height:100%;margin:0;padding:0;overflow:hidden;}' +
        'body{display:flex;align-items:center;justify-content:center;}' +
        'html{visibility:hidden;}';
    document.documentElement.appendChild(style);

    function creative() {
        var best = null, bestArea = 0;
        function consider(list) {
            for (var i = 0; i < list.length; i++) {
                var area = list[i].offsetWidth * list[i].offsetHeight;
                if (area > bestArea) { bestArea = area; best = list[i]; }
            }
        }
        consider(document.images);
        consider(document.getElementsByTagName('iframe'));
        return best;
    }

    var MIN_CREATIVE_WIDTH = 80;
    var MIN_CREATIVE_HEIGHT = 12;
    var settled = false;
    var revealed = false;

    function reveal() {
        if (revealed) { return; }
        revealed = true;
        document.documentElement.style.visibility = 'visible';
    }

    function fit() {
        if (settled) { return; }

        var el = creative();
        if (!el
            || el.offsetWidth < MIN_CREATIVE_WIDTH
            || el.offsetHeight < MIN_CREATIVE_HEIGHT) {
            return;
        }

        var scale = window.innerWidth / el.offsetWidth;
        if (scale > 1.01 && scale <= MAX_UPSCALE) {
            el.style.transformOrigin = 'center center';
            el.style.transform = 'scale(' + scale.toFixed(4) + ')';
        } else {
            el.style.transform = '';
        }

        settled = true;
        reveal();
    }

    function refitForNewSize() {
        settled = false;
        fit();
    }

    document.addEventListener('DOMContentLoaded', fit);
    window.addEventListener('load', fit);
    window.addEventListener('resize', refitForNewSize);

    setTimeout(reveal, 1200);

    var pending = null;
    function refit() {
        if (settled) { return; }
        if (pending) { clearTimeout(pending); }
        pending = setTimeout(function() { pending = null; fit(); }, 80);
    }
    if (window.MutationObserver) {
        var start = function() {
            if (!document.body) { return setTimeout(start, 10); }
            new MutationObserver(refit).observe(document.body, {
                childList: true, subtree: true
            });
        };
        start();
    }
})();
