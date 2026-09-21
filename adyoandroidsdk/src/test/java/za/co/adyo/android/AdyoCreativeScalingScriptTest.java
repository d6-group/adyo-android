package za.co.adyo.android;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.assertFalse;

import org.junit.Test;
import org.mozilla.javascript.Context;
import org.mozilla.javascript.Scriptable;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

public class AdyoCreativeScalingScriptTest {

    /** The script under test, read verbatim from the raw resource on disk. */
    private String script() throws Exception {
        File f = new File("src/main/res/raw/adyo_creative_scaling.js");
        assertTrue("script resource missing: " + f.getAbsolutePath(), f.exists());
        return new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8);
    }

    /**
     * Runs the script in a fake DOM and returns the transform applied to the chosen creative.
     * @param innerWidth  window.innerWidth
     * @param imagesJs    JS array literal of image elements (may be "[]")
     * @param iframesJs   JS array literal of iframe elements (may be "[]")
     */
    private String runFit(int innerWidth, String imagesJs, String iframesJs) throws Exception {
        String prelude =
            "function elem(w,h){return {offsetWidth:w,offsetHeight:h,style:{}};}\n" +
            "var __images=" + imagesJs + ";\n" +
            "var __iframes=" + iframesJs + ";\n" +
            "var document={__h:{}," +
            "  documentElement:{style:{},appendChild:function(){}}," +
            "  createElement:function(t){return {textContent:'',style:{}};}," +
            "  images:__images, body:{}," +
            "  getElementsByTagName:function(t){return t==='iframe'?__iframes:[];}," +
            "  addEventListener:function(t,fn){this.__h[t]=fn;}};\n" +
            "function MutationObserver(cb){this.observe=function(){};}\n" +
            "function setTimeout(fn,ms){}\n" +
            "var window={innerWidth:" + innerWidth + ",__h:{}," +
            "  addEventListener:function(t,fn){this.__h[t]=fn;}," +
            "  MutationObserver:MutationObserver};\n";
        String fire =
            "\n;document.__h['DOMContentLoaded'] && document.__h['DOMContentLoaded']();\n" +
            "(function(){var el=(__images.length?__images[0]:(__iframes.length?__iframes[0]:null));" +
            " return el && el.style && el.style.transform ? String(el.style.transform) : '';})();";

        Context cx = Context.enter();
        try {
            cx.setOptimizationLevel(-1); // interpreter mode; no bytecode compilation
            cx.setLanguageVersion(Context.VERSION_ES6);
            Scriptable scope = cx.initStandardObjects();
            cx.evaluateString(scope, prelude, "prelude", 1, null);
            cx.evaluateString(scope, script(), "script", 1, null);
            Object result = cx.evaluateString(scope, fire, "fire", 1, null);
            return Context.toString(result);
        } finally {
            Context.exit();
        }
    }

    @Test
    public void image320InWiderSlot_isUpscaled() throws Exception {
        // 440 / 320 = 1.375, within (1.01, 2.0] -> scaled.
        String t = runFit(440, "[elem(320,50)]", "[]");
        assertEquals("scale(1.3750)", t);
    }

    @Test
    public void creativeAlreadyAsWideAsSlot_isLeftNatural() throws Exception {
        // 440 / 440 = 1.0, not > 1.01 -> transform cleared.
        String t = runFit(440, "[elem(440,55)]", "[]");
        assertEquals("", t);
    }

    @Test
    public void creativeNeedingMoreThan2x_isLeftNatural() throws Exception {
        // 440 / 100 = 4.4, over MAX_UPSCALE -> transform cleared.
        String t = runFit(440, "[elem(100,30)]", "[]");
        assertEquals("", t);
    }

    @Test
    public void tagCreativeInIframe_isSelectedAndScaled() throws Exception {
        // No image; largest iframe is the creative. 440 / 300 = 1.4667.
        String t = runFit(440, "[]", "[elem(300,50)]");
        assertEquals("scale(1.4667)", t);
    }

    @Test
    public void creativeBelowSizeFloor_isNotScaled() throws Exception {
        // offsetHeight 8 < MIN_CREATIVE_HEIGHT (12) -> fit returns early, no scale.
        String t = runFit(440, "[elem(60,8)]", "[]");
        assertFalse(t.startsWith("scale("));
    }
}
