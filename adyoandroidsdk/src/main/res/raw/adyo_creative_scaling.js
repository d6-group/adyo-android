(function() {
    var MAX_UPSCALE = 2.0;

    // Held transparent while we measure, so the tag's own build — 0x0, placeholder, then
    // the creative — and the upscale after it happen off-camera rather than as a series
    // of visible steps.
    //
    // `opacity`, not `visibility`. A `visibility:hidden` subframe isn't rendered at all,
    // and an AMP creative that boots inside one stalls partway and never retries: lifting
    // the hide a second later left it blank at 9s, every time. An opacity-0 element is
    // still laid out, rendered and composited, so nothing about the creative's world
    // says "not rendered" — it's merely see-through.
    var hideStyle = document.createElement('style');
    hideStyle.textContent = 'html{opacity:0;}';
    document.documentElement.appendChild(hideStyle);

    // The layout the scaled creative needs: no margins to offset it, no scrollbars from
    // the overhang, and centred so the transform grows it evenly.
    //
    // Applied only once a creative is found that actually needs upscaling. Laying it on
    // every document broke the ones that didn't: an AMP creative controls its own body,
    // and `display:flex` with `height:100%` on a 56pt viewport left the slot blank — for
    // no gain, since a creative already at slot width is never transformed anyway.
    var layoutStyle = null;

    function applyFittingLayout() {
        if (layoutStyle) { return; }
        layoutStyle = document.createElement('style');
        layoutStyle.textContent =
            'html,body{height:100%;margin:0;padding:0;overflow:hidden;}' +
            'body{display:flex;align-items:center;justify-content:center;}';
        document.documentElement.appendChild(layoutStyle);
    }

    function removeFittingLayout() {
        if (!layoutStyle) { return; }
        if (layoutStyle.parentNode) { layoutStyle.parentNode.removeChild(layoutStyle); }
        layoutStyle = null;
    }

    // The creative is the largest image *or iframe* by rendered area. Adyo serves both:
    // a plain image creative, and a `tag` creative that renders inside an iframe. An ad
    // tag builds several iframes, most of them 0x0 or 1x1 housekeeping, so picking the
    // largest finds the real one. Transforming the iframe element is fine from out here —
    // we're scaling the element, not reaching into its document.
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

    // An ad tag builds its iframe in stages — 0x0, then a placeholder, then the real
    // creative — so measuring on every mutation applies a different scale each time and
    // the ad visibly grows in two or three steps. Instead the first measurement of
    // something big enough to be the real creative settles it, and that is the scale that
    // ships. Only a resize re-opens the question.
    var MIN_CREATIVE_WIDTH = 80;
    var MIN_CREATIVE_HEIGHT = 12;
    var settled = false;
    var revealed = false;

    function reveal() {
        if (revealed) { return; }
        revealed = true;
        if (hideStyle.parentNode) { hideStyle.parentNode.removeChild(hideStyle); }
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
        var applied = scale > 1.01 && scale <= MAX_UPSCALE;

        if (applied) {
            applyFittingLayout();
            el.style.transformOrigin = 'center center';
            el.style.transform = 'scale(' + scale.toFixed(4) + ')';
        } else {
            // Already filling it, or too few pixels to survive being blown up: a centred
            // small creative beats a blurry full-width one. Nothing is applied at all, so
            // the creative is left exactly as its author laid it out.
            removeFittingLayout();
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

    // Nothing is ever left invisible: if no creative big enough to measure turns up, show
    // the document anyway and let it render at whatever size it is.
    setTimeout(reveal, 1200);

    // The SDK can inject the creative after load, in which case the listeners above have
    // all fired against an empty document. Re-fit whenever the DOM changes, debounced so a
    // creative that builds itself in several steps only gets measured once it settles.
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
